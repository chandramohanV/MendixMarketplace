// `npm run api:reset`: deletes the data file and reseeds it from the generator.
import fs from 'node:fs/promises';
import path from 'node:path';
import { openFileStore } from './file-persistence';
import { DEFAULT_DATA_DIR } from './server';

const dataDir = process.env.DATA_DIR ?? DEFAULT_DATA_DIR;
await fs.rm(path.join(dataDir, 'releases.json'), { force: true });
const store = await openFileStore(dataDir);
console.log(
  `[api] Reseeded ${store.list({ sort: 'version', page: 1, pageSize: 1 }).total} releases into ${store.file}`,
);
