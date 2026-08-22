export interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

function parseTimestampSrt(ts: string): number {
  const m = ts.trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/);
  if (!m) return 0;
  return (+m[1]) * 3600 + (+m[2]) * 60 + +m[3] + +m[4] / 1000;
}

function parseTimestampAss(ts: string): number {
  const m = ts.trim().match(/(\d+):(\d+):(\d+)(?:[.](\d+))?/);
  if (!m) return 0;
  return (+m[1]) * 3600 + (+m[2]) * 60 + +m[3] + (m[4] ? +m[4] / 100 : 0);
}

function stripSrtFormatting(text: string): string {
  return text
    .replace(/\{\\[^}]*\}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/<\/?(?:b|i|u|font)[^>]*>/gi, '')
    .trim();
}

function stripAssFormatting(text: string): string {
  return text
    .replace(/\{\\[^}]*\}/g, '')
    .replace(/\\N/g, '\n')
    .replace(/\\n/g, ' ')
    .replace(/\\h/g, ' ')
    .trim();
}

export function parseSrt(content: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const normalized = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim().length > 0);
    if (lines.length < 2) continue;
    let timingLine = -1;
    for (let i = 0; i < Math.min(lines.length, 2); i++) {
      if (lines[i].includes('-->')) {
        timingLine = i;
        break;
      }
    }
    if (timingLine === -1) continue;
    const [startStr, endStr] = lines[timingLine].split('-->');
    const text = lines.slice(timingLine + 1).join('\n');
    cues.push({
      start: parseTimestampSrt(startStr),
      end: parseTimestampSrt(endStr),
      text: stripSrtFormatting(text),
    });
  }
  return cues.filter((c) => c.text.length > 0 && c.end > c.start);
}

export function parseAss(content: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const normalized = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  let inEvents = false;
  let format: string[] = [];
  for (const line of normalized.split('\n')) {
    const trimmed = line.trim();
    if (/^\[Events\]/i.test(trimmed)) {
      inEvents = true;
      continue;
    }
    if (/^\[/.test(trimmed)) {
      inEvents = false;
      continue;
    }
    if (!inEvents) continue;
    if (/^Format:/i.test(trimmed)) {
      format = trimmed.slice(trimmed.indexOf(':') + 1).split(',').map((s) => s.trim().toLowerCase());
      continue;
    }
    if (!/^Dialogue:/i.test(trimmed)) continue;
    const value = trimmed.slice(trimmed.indexOf(':') + 1).trim();
    const textIndex = format.indexOf('text');
    const fieldCount = textIndex === -1 ? 9 : textIndex;
    const fields = value.split(',');
    if (fields.length <= fieldCount) continue;
    const get = (name: string): string => {
      const i = format.indexOf(name);
      return i === -1 ? '' : (fields[i] ?? '').trim();
    };
    const start = parseTimestampAss(get('start'));
    const end = parseTimestampAss(get('end'));
    const text = stripAssFormatting(fields.slice(fieldCount).join(','));
    if (text && end > start) cues.push({ start, end, text });
  }
  return cues;
}

export function parseSubtitles(filename: string, content: string): SubtitleCue[] {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.ass') || lower.endsWith('.ssa')) return parseAss(content);
  if (lower.endsWith('.srt')) return parseSrt(content);
  if (content.includes('[Events]') && /Dialogue:/i.test(content)) return parseAss(content);
  if (content.includes('-->')) return parseSrt(content);
  throw new Error('Unsupported subtitle format. Please provide an SRT or ASS file.');
}
