// Test-only HTTP server for the kuromoji dictionary. jsdom's XHR cannot reach
// the filesystem, and the browser loader is exactly what runs on Android, so
// the tests fetch over HTTP like the real app. Listens on port 3000 (jsdom's
// default document origin) so relative dict paths resolve like in the app:
//   /node_modules/kuromoji/dict/…  — the gzipped .dat.gz files as shipped
//   /dict-raw/…                    — .dat files, already gunzipped, .gz
//                                     requests 404 (simulates what Android's
//                                     aapt2 does to assets inside the APK)
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';

const PORT = 3000;
const dictRoot = path.resolve(process.cwd(), 'node_modules', 'kuromoji', 'dict');

function send404(res: ServerResponse) {
  res.statusCode = 404;
  res.end('not found');
}

export default async function setup() {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = (req.url ?? '').split('?')[0];
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/octet-stream');
    let name: string | null = null;
    let gunzip = false;
    if (url.startsWith('/dict-raw/')) {
      const file = url.slice('/dict-raw/'.length);
      if (!/\.dat$/.test(file)) return send404(res);
      name = file.replace(/\.dat$/, '.dat.gz');
      gunzip = true;
    } else if (url.startsWith('/node_modules/kuromoji/dict/')) {
      const file = url.slice('/node_modules/kuromoji/dict/'.length);
      if (!/\.dat\.gz$/.test(file)) return send404(res);
      name = file;
    }
    if (!name) return send404(res);
    const filePath = path.join(dictRoot, name);
    if (!existsSync(filePath)) return send404(res);
    const body = gunzip ? gunzipSync(readFileSync(filePath)) : readFileSync(filePath);
    res.end(body);
  });
  await new Promise<void>((resolve) => server.listen(PORT, '127.0.0.1', resolve));
  return () => server.close();
}
