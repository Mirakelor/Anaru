// Copies the kuromoji IPA dictionary into public/dict so the tokenizer can
// load it at runtime without bundling ~15 MB into JS.
import { cpSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = path.join(root, 'node_modules', 'kuromoji', 'dict');
const target = path.join(root, 'public', 'dict');

if (!existsSync(source)) {
  console.error('kuromoji dict not found. Run npm install first.');
  process.exit(1);
}
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });
console.log('kuromoji dictionary copied to public/dict');
