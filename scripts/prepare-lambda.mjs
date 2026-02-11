import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('dist/src', { recursive: true });
await writeFile('dist/src/package.json', JSON.stringify({ type: 'module' }, null, 2) + '\n');
