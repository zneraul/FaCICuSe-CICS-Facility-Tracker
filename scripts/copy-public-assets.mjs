import { cp, mkdir } from 'node:fs/promises';

const outputDirectory = new URL('../dist/', import.meta.url);
const publicDirectory = new URL('../client/public/', import.meta.url);

await mkdir(outputDirectory, { recursive: true });
await cp(new URL('index.html', publicDirectory), new URL('landing.html', outputDirectory));
await cp(new URL('assets/', publicDirectory), new URL('assets/', outputDirectory), {
  recursive: true,
  force: true,
});
