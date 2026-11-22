import { cp, mkdir } from 'node:fs/promises';

const outputDirectory = new URL('../dist/', import.meta.url);
const homepageDirectory = new URL('../frontend/public/', import.meta.url);

await mkdir(outputDirectory, { recursive: true });
await cp(new URL('index.html', homepageDirectory), new URL('landing.html', outputDirectory));
await cp(new URL('assets/', homepageDirectory), new URL('assets/', outputDirectory), {
  recursive: true,
  force: true,
});
