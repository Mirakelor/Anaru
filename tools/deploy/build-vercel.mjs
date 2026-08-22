// Merges the marketing site (site/) and the app build (dist/) into one
// deployable folder (deploy/): the site at the root, the app under /app/.
//
// Usage: node tools/deploy/build-vercel.mjs
import { cpSync, mkdirSync, rmSync, existsSync, statSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const siteDir = path.join(root, 'site');
const distDir = path.join(root, 'dist');
const outDir = path.join(root, 'deploy');

if (!existsSync(distDir)) {
  console.error('dist/ missing — run npm run build first.');
  process.exit(1);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// marketing site at the root (skip generated icons source and nothing else lives there)
cpSync(siteDir, outDir, { recursive: true, filter: (src) => !src.endsWith('icon.png') });

// site favicon/icons at the root (site pages reference /icons/…)
mkdirSync(path.join(outDir, 'icons'), { recursive: true });
cpSync(path.join(root, 'public', 'icons'), path.join(outDir, 'icons'), { recursive: true });

// app under /app/
mkdirSync(path.join(outDir, 'app'), { recursive: true });
cpSync(distDir, path.join(outDir, 'app'), { recursive: true });

console.log(`deploy/ ready: site at root, app under /app/ (${(du(outDir) / 1024 / 1024).toFixed(0)} MB)`);

function du(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    total += entry.isDirectory() ? du(p) : statSync(p).size;
  }
  return total;
}
