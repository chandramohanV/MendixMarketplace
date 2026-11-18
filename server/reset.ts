// `npm run api:reset`: deletes the data files and reseeds them from the generators.
import fs from 'node:fs/promises';
import path from 'node:path';
import { COMPONENTS_FILE, openFileStores, RELEASES_FILE } from './file-persistence';
import { DEFAULT_DATA_DIR } from './server';

const dataDir = process.env.DATA_DIR ?? DEFAULT_DATA_DIR;
await Promise.all([RELEASES_FILE, COMPONENTS_FILE].map((file) => fs.rm(path.join(dataDir, file), { force: true })));
const { releases, components } = await openFileStores(dataDir);
console.log(
  `[api] Reseeded ${releases.list({ sort: 'version', page: 1, pageSize: 1 }).total} releases into ${releases.file}`,
);
console.log(`[api] Reseeded ${components.list().length} components into ${components.location}`);
