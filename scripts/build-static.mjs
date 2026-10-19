import { cp, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, '_site');
await mkdir(output, { recursive: true });
const directories = ['assets', 'dist', 'favicon', 'atlason', 'more', 'pagination', 'works'];
const files = (await readdir(root)).filter(name =>
  name.endsWith('.html') || /^portfolio-.*\.(css|js|json)$/.test(name));
for (const name of [...directories, ...files]) {
  await cp(path.join(root, name), path.join(output, name), { recursive: true });
}
console.log('Static portfolio prepared in _site');
