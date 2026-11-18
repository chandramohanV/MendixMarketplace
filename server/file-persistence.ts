// Node backend for the stores: one JSON file per list, written atomically (temp file + rename).
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Component } from '../src/types';
import type { StudioRelease } from '../shared/studio';
import { ComponentStore } from './component-store';
import type { Persistence } from './persisted-list';
import { ReleaseStore } from './store';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const RELEASES_FILE = 'releases.json';
export const COMPONENTS_FILE = 'components.json';

export class FilePersistence<T> implements Persistence<T> {
  private tmpCounter = 0;

  constructor(readonly location: string) {}

  async load(): Promise<T[] | null> {
    try {
      const parsed: unknown = JSON.parse(await fs.readFile(this.location, 'utf8'));
      if (!Array.isArray(parsed)) throw new Error(`${path.basename(this.location)} must contain an array`);
      return parsed as T[];
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw e;
    }
  }

  async save(data: T[]): Promise<void> {
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

export interface FileStores {
  releases: ReleaseStore;
  components: ComponentStore;
}

/** Opens (and seeds on first run) both stores as JSON files in `dataDir`. */
export async function openFileStores(dataDir: string): Promise<FileStores> {
  await fs.mkdir(dataDir, { recursive: true });
  const [releases, components] = await Promise.all([
    ReleaseStore.load(new FilePersistence<StudioRelease>(path.join(dataDir, RELEASES_FILE))),
    ComponentStore.load(new FilePersistence<Component>(path.join(dataDir, COMPONENTS_FILE))),
  ]);
  return { releases, components };
}
