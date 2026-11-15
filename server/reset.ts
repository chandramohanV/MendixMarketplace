// `npm run api:reset`: deletes the data file and reseeds it from the generator.
import fs from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_DATA_DIR } from './server';
import { ReleaseStore } from './store';

const dataDir = process.env.DATA_DIR ?? DEFAULT_DATA_DIR;
await fs.rm(path.join(dataDir, 'releases.json'), { force: true });
const store = await ReleaseStore.open(dataDir);
console.log(
  `[api] Reseeded ${store.list({ sort: 'version', page: 1, pageSize: 1 }).total} releases into ${store.file}`,
);
