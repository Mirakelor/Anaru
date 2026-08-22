// Content pack builder: turns a folder of user-supplied videos + subtitle
// files into a servable pack (manifest.json + media). Neutral tooling — it
// only processes files you place in the input directory.
//
// Usage:
//   node tools/pack/build-pack.mjs <inputDir> <outputDir> [--base-url https://host/packs] [--transcode]
//
// Input layout (one folder per series):
//   input/<series>/meta.json          optional {"title":"..."}
//   input/<series>/poster.jpg         optional
//   input/<series>/e01.mp4            video (mp4/webm/mkv/…)
//   input/<series>/e01.ja.srt|.ass    Japanese subtitles (required)
//   input/<series>/e01.en.srt         translation subtitles (optional)
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const FFMPEG = path.join(process.env.HOME, '.local', 'bin', 'ffmpeg');

const argv = process.argv.slice(2);
const flags = argv.filter(function (a) { return a.startsWith('--'); });
const positional = argv.filter(function (a) { return !a.startsWith('--'); });
const inputDir = path.resolve(positional[0] ?? '');
const outputDir = path.resolve(positional[1] ?? '');
const baseUrlFlag = flags.find(function (f) { return f.startsWith('--base-url'); });
const baseUrl = baseUrlFlag ? (baseUrlFlag.includes('=') ? baseUrlFlag.split('=')[1] : positional[2]) : null;
const transcode = flags.includes('--transcode');

if (!inputDir || !outputDir || !existsSync(inputDir)) {
  console.error('Usage: node tools/pack/build-pack.mjs <inputDir> <outputDir> [--base-url URL] [--transcode]');
  process.exit(1);
}

const VIDEO_EXT = ['.mp4', '.webm', '.mkv', '.m4v', '.avi'];
const JA_SUB_EXT = ['.ja.srt', '.ja.ass', '.ja.ssa', '.jpn.srt'];
const TR_SUB_EXT = ['.en.srt', '.zh.srt', '.en.ass'];

function slugify(title) {
  return (
    title
      .toLowerCase()
      .normalize('NFKC')
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'series'
  );
}

function transcodeToMp4(src, dest) {
  execFileSync(FFMPEG, [
    '-y', '-v', 'error', '-i', src,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-crf', '23',
    '-c:a', 'aac', '-b:a', '128k', dest,
  ]);
}

const manifest = { version: 1, series: [] };
const seriesDirs = readdirSync(inputDir)
  .map(function (name) { return path.join(inputDir, name); })
  .filter(function (dir) { return statSync(dir).isDirectory(); });

if (seriesDirs.length === 0) {
  console.error('No series folders found in ' + inputDir);
  process.exit(1);
}

for (const seriesDir of seriesDirs) {
  const folderName = path.basename(seriesDir);
  let title = folderName;
  let metaPoster = null;
  const metaPath = path.join(seriesDir, 'meta.json');
  if (existsSync(metaPath)) {
    try {
      const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
      if (meta.title) title = meta.title;
      if (meta.poster) metaPoster = meta.poster;
    } catch {
      console.warn('Skipping bad meta.json in ' + folderName);
    }
  }
  const slug = slugify(title);
  const outSeriesDir = path.join(outputDir, slug);
  mkdirSync(outSeriesDir, { recursive: true });

  let posterRel = null;
  const posterFile = metaPoster ? path.join(seriesDir, metaPoster) : path.join(seriesDir, 'poster.jpg');
  if (existsSync(posterFile)) {
    const ext = path.extname(posterFile);
    copyFileSync(posterFile, path.join(outSeriesDir, 'poster' + ext));
    posterRel = slug + '/poster' + ext;
  }

  const files = readdirSync(seriesDir);
  const videos = files.filter(function (f) { return VIDEO_EXT.includes(path.extname(f).toLowerCase()); });
  const episodes = [];

  for (const video of videos.sort()) {
    const stem = video.slice(0, video.lastIndexOf('.'));
    const jaSub = files.find(function (f) {
      return f.startsWith(stem) && JA_SUB_EXT.some(function (e) { return f.toLowerCase().endsWith(e); });
    });
    if (!jaSub) {
      console.warn('[' + slug + '] ' + video + ' skipped: no Japanese subtitle file (' + stem + '.ja.srt)');
      continue;
    }
    const trSub = files.find(function (f) {
      return f.startsWith(stem) && TR_SUB_EXT.some(function (e) { return f.toLowerCase().endsWith(e); });
    });

    const indexMatch = stem.match(/(\d+)\s*$/);
    const index = indexMatch ? parseInt(indexMatch[1], 10) : episodes.length + 1;

    let videoOutName = video;
    const videoSrc = path.join(seriesDir, video);
    const needsTranscode = transcode && path.extname(video).toLowerCase() !== '.mp4';
    if (needsTranscode) {
      videoOutName = stem + '.mp4';
      console.log('[' + slug + '] transcoding ' + video + '…');
      transcodeToMp4(videoSrc, path.join(outSeriesDir, videoOutName));
    } else {
      console.log('[' + slug + '] copying ' + video);
      copyFileSync(videoSrc, path.join(outSeriesDir, videoOutName));
    }
    copyFileSync(path.join(seriesDir, jaSub), path.join(outSeriesDir, jaSub));
    if (trSub) copyFileSync(path.join(seriesDir, trSub), path.join(outSeriesDir, trSub));

    episodes.push({
      index: index,
      title: 'Episode ' + index,
      video: slug + '/' + videoOutName,
      subtitle: slug + '/' + jaSub,
      translation: trSub ? slug + '/' + trSub : null,
    });
  }

  if (episodes.length === 0) {
    console.warn('[' + slug + '] no usable episodes, skipping series');
    continue;
  }
  episodes.sort(function (a, b) { return a.index - b.index; });
  manifest.series.push({ slug: slug, title: title, poster: posterRel, episodes: episodes });
  console.log('[' + slug + '] ' + episodes.length + ' episode(s)');
}

mkdirSync(outputDir, { recursive: true });
writeFileSync(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('Pack written to ' + outputDir);
console.log(baseUrl ? 'Manifest URL: ' + baseUrl.replace(/\/$/, '') + '/manifest.json' : 'Serve the folder with any static server, then paste <url>/manifest.json into the app.');
