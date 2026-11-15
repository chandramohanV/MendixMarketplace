// File-backed release store: all mutations are serialized and written atomically.
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  compareVersionsDesc, defaultMac, macRuleError, parseVersion, RELEASE_TYPE_INFO,
  type FieldError, type ReleaseListItem, type ReleaseType, type StudioRelease, type StudioSummary,
} from '../shared/studio';
import type { z } from 'zod';
import type { CreateReleaseSchema, ListQuerySchema, PatchReleaseSchema, UpdateReleaseSchema } from '../shared/studio';
import { buildSeed } from './seed';

type CreateBody = z.output<typeof CreateReleaseSchema>;
type UpdateBody = z.output<typeof UpdateReleaseSchema>;
type PatchBody = z.output<typeof PatchReleaseSchema>;
type ListParams = z.output<typeof ListQuerySchema>;

/** A rule violation that maps directly to an HTTP error response. */
export class HttpError extends Error {
  constructor(public status: 400 | 404 | 409 | 422, public code: string, message: string, public details?: FieldError[]) {
    super(message);
  }
}

const notFound = (version: string) => new HttpError(404, 'not_found', `Release ${version} was not found.`);
const withoutNotes = ({ notes: _notes, ...rest }: StudioRelease): ReleaseListItem => rest;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class ReleaseStore {
  private releases: StudioRelease[] = [];
  private queue: Promise<unknown> = Promise.resolve();
  private tmpCounter = 0;

  private constructor(readonly file: string) {}

  /** Opens (and seeds on first run) the store in `dataDir`. */
  static async open(dataDir: string): Promise<ReleaseStore> {
    await fs.mkdir(dataDir, { recursive: true });
    const store = new ReleaseStore(path.join(dataDir, 'releases.json'));
    try {
      const parsed: unknown = JSON.parse(await fs.readFile(store.file, 'utf8'));
      if (!Array.isArray(parsed)) throw new Error('releases.json must contain an array');
      store.releases = parsed as StudioRelease[];
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
      store.releases = buildSeed();
      await store.persist(store.releases);
    }
    return store;
  }

  // ---------- reads ----------
  list(q: ListParams): { items: ReleaseListItem[]; total: number; page: number; pageSize: number } {
    let rows = this.releases;
    if (q.q) rows = rows.filter((r) => r.version.includes(q.q as string));
    if (q.line) rows = rows.filter((r) => r.line === q.line);
    if (q.type) rows = rows.filter((r) => (q.type === 'none' ? r.type === null : r.type === q.type));
    const sorted = [...rows].sort(
      q.sort === 'date-asc' ? (a, b) => a.date.localeCompare(b.date) || -compareVersionsDesc(a, b)
        : q.sort === 'date-desc' ? (a, b) => b.date.localeCompare(a.date) || compareVersionsDesc(a, b)
          : compareVersionsDesc,
    );
    const start = (q.page - 1) * q.pageSize;
    return { items: sorted.slice(start, start + q.pageSize).map(withoutNotes), total: sorted.length, page: q.page, pageSize: q.pageSize };
  }

  get(version: string): StudioRelease {
    const r = this.releases.find((x) => x.version === version);
    if (!r) throw notFound(version);
    return structuredClone(r);
  }

  summary(): StudioSummary {
    const byVersion = [...this.releases].sort(compareVersionsDesc);
    const latest = byVersion.find((r) => r.type === 'LATEST');
    const lts = byVersion.find((r) => r.type === 'LTS');
    const lines = new Map<string, 'LTS' | 'MTS'>();
    for (const r of byVersion) if ((r.type === 'LTS' || r.type === 'MTS') && !lines.has(r.line)) lines.set(r.line, r.type);
    return {
      latest: latest ? withoutNotes(latest) : null,
      recommendedLts: lts ? withoutNotes(lts) : null,
      supportedLines: [...lines].map(([value, type]) => ({ value, type, label: `${value} (${type})` })),
      types: RELEASE_TYPE_INFO,
    };
  }

  // ---------- writes ----------
  create(body: CreateBody): Promise<StudioRelease> {
    return this.mutate((draft) => {
      const version = body.version.trim();
      if (draft.some((r) => r.version === version)) throw new HttpError(409, 'conflict', `Release ${version} already exists.`, [{ field: 'version', message: `Release ${version} already exists.` }]);
      const release: StudioRelease = {
        version, ...parseVersion(version), type: null, date: body.date,
        mac: this.resolveMac(version, body.mac), notes: normalizeNotes(body.notes),
      };
      draft.push(release);
      this.applyType(draft, release, body.type);
      return release;
    });
  }

  update(version: string, body: UpdateBody): Promise<StudioRelease> {
    if (body.version !== undefined && body.version.trim() !== version) {
      throw new HttpError(422, 'validation_failed', 'The version cannot be changed.', [{ field: 'version', message: 'The version cannot be changed; delete the release and create a new one instead.' }]);
    }
    return this.mutate((draft) => {
      const release = draft.find((r) => r.version === version);
      if (!release) throw notFound(version);
      release.date = body.date;
      release.mac = this.resolveMac(version, body.mac);
      release.notes = normalizeNotes(body.notes);
      this.applyType(draft, release, body.type);
      return release;
    });
  }

  patch(version: string, body: PatchBody): Promise<StudioRelease> {
    return this.mutate((draft) => {
      const release = draft.find((r) => r.version === version);
      if (!release) throw notFound(version);
      if (body.date !== undefined) release.date = body.date;
      if (body.mac !== undefined) release.mac = this.resolveMac(version, body.mac);
      if (body.notes !== undefined) release.notes = normalizeNotes(body.notes);
      if (body.type !== undefined) this.applyType(draft, release, body.type);
      return release;
    });
  }

  remove(version: string): Promise<void> {
    return this.mutate((draft) => {
      const i = draft.findIndex((r) => r.version === version);
      if (i === -1) throw notFound(version);
      if (draft[i].type === 'LATEST') {
        throw new HttpError(409, 'latest_protected', `Release ${version} is the current LATEST release. Promote another release to LATEST before deleting it.`);
      }
      draft.splice(i, 1);
    });
  }

  // ---------- rules ----------
  private resolveMac(version: string, mac: boolean | undefined): boolean {
    const err = macRuleError(version, mac);
    if (err) throw new HttpError(422, 'validation_failed', err, [{ field: 'mac', message: err }]);
    return mac ?? defaultMac(version);
  }

  /** Changes a release's type while keeping exactly one LATEST. Mutates `draft`. */
  private applyType(draft: StudioRelease[], release: StudioRelease, type: ReleaseType | null): void {
    if (type === release.type) return;
    if (type === 'LATEST') {
      if (release.type === 'BETA') {
        throw new HttpError(422, 'validation_failed', 'A beta release cannot be LATEST.', [{ field: 'type', message: 'A beta release cannot be LATEST. Change it to a GA type (none, LTS or MTS) first.' }]);
      }
      for (const other of draft) if (other !== release && other.type === 'LATEST') other.type = demotedType(draft, other);
    } else if (release.type === 'LATEST') {
      throw new HttpError(409, 'latest_required', 'There must always be one LATEST release. Promote another release to LATEST instead.', [{ field: 'type', message: 'There must always be one LATEST release. Promote another release to LATEST instead.' }]);
    }
    release.type = type;
  }

  // ---------- persistence ----------
  /** Runs `fn` on a copy of the data, persists it atomically, then commits. Calls never overlap. */
  private mutate<T>(fn: (draft: StudioRelease[]) => T): Promise<T> {
    const run = this.queue.then(async () => {
      const draft = structuredClone(this.releases);
      const result = fn(draft);
      await this.persist(draft);
      this.releases = draft;
      return structuredClone(result);
    });
    this.queue = run.catch(() => undefined); // keep the queue alive after a rejected write
    return run;
  }

  private async persist(data: StudioRelease[]): Promise<void> {
    const tmp = `${this.file}.${process.pid}.${++this.tmpCounter}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 1));
    // rename() replaces the target atomically; retry briefly if Windows has the file locked.
    for (let attempt = 0; ; attempt++) {
      try { await fs.rename(tmp, this.file); return; } catch (e) {
        const code = (e as NodeJS.ErrnoException).code;
        if (attempt >= 5 || (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES')) { await fs.rm(tmp, { force: true }); throw e; }
        await sleep(20 * (attempt + 1));
      }
    }
  }
}

/** What a LATEST release falls back to: its line's support type, or none. */
function demotedType(draft: StudioRelease[], release: StudioRelease): ReleaseType | null {
  const sibling = draft.find((r) => r !== release && r.line === release.line && (r.type === 'LTS' || r.type === 'MTS'));
  return sibling ? sibling.type : null;
}

function normalizeNotes(notes: Record<string, string[]>): Record<string, string[]> {
  return Object.fromEntries(Object.entries(notes).map(([k, items]) => [k.trim(), items.map((s) => s.trim())]));
}
