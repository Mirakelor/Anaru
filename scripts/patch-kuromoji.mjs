// Vendors a patched copy of kuromoji's browser build into src/lib/nlp/vendor/.
//
// Why: Android's aapt2 unpacks .gz assets when building the APK — it strips
// the .gz extension and gunzips the bytes (dict/base.dat.gz becomes
// dict/base.dat with raw data). kuromoji's BrowserDictionaryLoader requests
// <name>.dat.gz and unconditionally gunzips, so the tokenizer can never load
// on Android. The patch adds a fallback: if the .gz request fails (or the
// bytes are not gzip magic), retry without the .gz suffix and pass the raw
// bytes through.
//
// Run via the predev/prebuild hooks; the output is committed so tests and
// fresh clones work without node_modules.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = path.join(root, 'node_modules', 'kuromoji', 'build', 'kuromoji.js');
const target = path.join(root, 'src', 'lib', 'nlp', 'vendor', 'kuromoji.js');

if (!existsSync(source)) {
  console.error('kuromoji build not found. Run npm install first.');
  process.exit(1);
}

const code = readFileSync(source, 'utf8');

const marker = 'BrowserDictionaryLoader.prototype.loadArrayBuffer = function (url, callback) {';
if (!code.includes(marker)) {
  console.error('kuromoji loader marker not found — version changed? Refusing to patch.');
  process.exit(1);
}

// Rewrite the UMD wrapper into an explicit ESM module: vite serves files
// under src/ as-is in dev (no CJS interop), so the raw UMD would export
// nothing. The IIFE still runs untouched inside.
const umdHead = '(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.kuromoji = f()}})(function(){';
if (!code.startsWith(umdHead)) {
  console.error('kuromoji UMD header not found — version changed? Refusing to patch.');
  process.exit(1);
}

let patched = 'const kuromojiUMD = (function(){' + code.slice(umdHead.length);
const trimmed = patched.replace(/\s+$/, '');
if (!trimmed.endsWith('});')) {
  console.error('kuromoji UMD tail not found — version changed? Refusing to patch.');
  process.exit(1);
}
patched = trimmed.slice(0, -3) + '})();\nexport default kuromojiUMD;\n';

const markerRe = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
patched = patched.replace(
  new RegExp(markerRe + String.raw`\s*var xhr = new XMLHttpRequest\(\);[\s\S]*?^};$`, 'm'),
  `BrowserDictionaryLoader.prototype.loadArrayBuffer = function (url, callback) {
    // Anaru patch: Android aapt2 unpacks .gz assets (drops the suffix and
    // gunzips the bytes), so the primary <name>.dat.gz request can 404 or
    // return raw data. Fall back to <name>.dat and skip gunzip when the
    // bytes are not gzip magic.
    var tryUrl = url;
    var retried = false;
    function next(err) {
      if (!retried && /\\.gz$/.test(url)) {
        retried = true;
        tryUrl = url.replace(/\\.gz$/, "");
        attempt();
      } else {
        callback(err, null);
      }
    }
    function attempt() {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", tryUrl, true);
      xhr.responseType = "arraybuffer";
      xhr.onload = function () {
        var arraybuffer = this.response;
        if ((this.status > 0 && this.status !== 200) || !arraybuffer) {
          next(new Error("failed to load " + tryUrl));
          return;
        }
        var bytes = new Uint8Array(arraybuffer);
        if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
          try {
            var gz = new zlib.Zlib.Gunzip(bytes);
            callback(null, gz.decompress().buffer);
          } catch (e) {
            next(e);
          }
        } else {
          callback(null, arraybuffer);
        }
      };
      xhr.onerror = function (err) {
        next(err);
      };
      xhr.send();
    }
    attempt();
  };`,
);

if (!patched.includes('Anaru patch')) {
  console.error('Patch application failed — output has no patch marker.');
  process.exit(1);
}

mkdirSync(path.dirname(target), { recursive: true });
writeFileSync(target, patched);
console.log('patched kuromoji written to src/lib/nlp/vendor/kuromoji.js');
