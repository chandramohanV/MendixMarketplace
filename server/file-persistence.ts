// Node backend for ReleaseStore: a JSON file, written atomically (temp file + rename).
import fs from 'node:fs/promises';
import path from 'node:path';
import type { StudioRelease } from '../shared/studio';
import { ReleaseStore, type Persistence } from './store';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class FilePersistence implements Persistence {
  private tmpCounter = 0;

  constructor(readonly location: string) {}

  async load(): Promise<StudioRelease[] | null> {
    try {
      const parsed: unknown = JSON.parse(await fs.readFile(this.location, 'utf8'));
      if (!Array.isArray(parsed)) throw new Error('releases.json must contain an array');
      return parsed as StudioRelease[];
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw e;
    }
  }

  async save(data: StudioRelease[]): Promise<void> {
    const tmp = `${this.location}.${process.pid}.${++this.tmpCounter}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 1));
    // rename() replaces the target atomically; retry briefly if Windows has the file locked.
    for (let attempt = 0; ; attempt++) {
      try {
        await fs.rename(tmp, this.location);
        return;
      } catch (e) {
        const code = (e as NodeJS.ErrnoException).code;
        if (attempt >= 5 || (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES')) {
          await fs.rm(tmp, { force: true });
          throw e;
        }
        await sleep(20 * (attempt + 1));
      }
    }
  }
}

/** Opens (and seeds on first run) the store in `dataDir/releases.json`. */
export async function openFileStore(dataDir: string): Promise<ReleaseStore> {
  await fs.mkdir(dataDir, { recursive: true });
  return ReleaseStore.load(new FilePersistence(path.join(dataDir, 'releases.json')));
}
