# Content pack workflow

Pack = a folder of videos + Japanese subtitle files + `manifest.json`,
served over plain HTTP(S). The app streams clips from the pack URL —
nothing is downloaded up front.

## 1. Prepare input

One folder per series; one `meta.json` (optional) for the display title:

```
packs/my-show/
  meta.json            {"title": "My Show"}          (optional)
  poster.jpg                                        (optional)
  e01.mp4              video, any common format
  e01.ja.srt           Japanese subtitles (required) — .srt or .ass
  e01.en.srt           translation (optional)
```

Episode numbering comes from the file stem (`e01`, `e02`, … or `29`, `30`).
Browser playback needs H.264 + AAC; pass `--transcode` to convert anything
else with the bundled ffmpeg.

## 2. Build

```bash
node tools/pack/build-pack.mjs ./packs/my-show ./out/my-show
# optional: --transcode to force H.264/AAC mp4
```

Output: `out/my-show/manifest.json` + media files. Serve the folder as-is.

## 3. Serve

```bash
node tools/pack/serve.mjs ./out/my-show 8090
# → http://localhost:8090/manifest.json
```

The built-in server handles Range requests (video seeking) and CORS
(cross-origin pack loading), which most naive static servers do not.

Then in the app: Library → Load pack → paste the manifest URL.

## 4. Hosting & size

- Any static host works (NAS, object storage, nginx). If you use nginx,
  make sure Range requests pass through (`proxy_pass` with no buffering
  restrictions) and CORS headers are set if the app is served elsewhere.
- Size is dominated by the video files. Typical per episode at 1080p:
  - H.264 crf 23 (~370 MB) — current default
  - H.264 crf 26 (~250 MB)
  - 720p crf 24 (~150 MB)
- The app never downloads whole episodes: it requests byte ranges for the
  clips you actually watch.

## 5. Subtitle timing

WebRip subtitles are usually within seconds of BDRip releases; if a pack is
consistently off, adjust the cue times in the SRT/ASS before building
(any subtitle editor, or a scripted offset).
