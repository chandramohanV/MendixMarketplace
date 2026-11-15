// Release store: all mutations are serialized and saved through a pluggable backend
// (a JSON file under Node — see file-persistence.ts — or Workers KV on Cloudflare).
import type { z } from 'zod';
import {
  compareVersionsDesc,
  defaultMac,
  macRuleError,
  parseVersion,
  RELEASE_TYPE_INFO,
  type CreateReleaseSchema,
  type FieldError,
  type ListQuerySchema,
  type PatchReleaseSchema,
  type ReleaseListItem,
  type ReleaseType,
  type StudioRelease,
  type StudioSummary,
  type UpdateReleaseSchema,
} from '../shared/studio';
import { buildSeed } from './seed';

type CreateBody = z.output<typeof CreateReleaseSchema>;
type UpdateBody = z.output<typeof UpdateReleaseSchema>;
type PatchBody = z.output<typeof PatchReleaseSchema>;
type ListParams = z.output<typeof ListQuerySchema>;

/** A rule violation that maps directly to an HTTP error response. */
export class HttpError extends Error {
  constructor(
    public status: 400 | 404 | 409 | 422,
    public code: string,
    message: string,
    public details?: FieldError[],
  ) {
    super(message);
  }
}

const notFound = (version: string) => new HttpError(404, 'not_found', `Release ${version} was not found.`);
const withoutNotes = ({ notes: _notes, ...rest }: StudioRelease): ReleaseListItem => rest;

/** Where the release list lives. `load` returns null when nothing has been stored yet. */
export interface Persistence {
  /** Human-readable location, for log messages. */
  readonly location: string;
  load(): Promise<StudioRelease[] | null>;
  save(data: StudioRelease[]): Promise<void>;
}

type Comparator = (a: StudioRelease, b: StudioRelease) => number;
const SORTS: Record<ListParams['sort'], Comparator> = {
  version: compareVersionsDesc,
  'date-asc': (a, b) => a.date.localeCompare(b.date) || -compareVersionsDesc(a, b),
  'date-desc': (a, b) => b.date.localeCompare(a.date) || compareVersionsDesc(a, b),
};

export class ReleaseStore {
  private releases: StudioRelease[] = [];
  private queue: Promise<unknown> = Promise.resolve();

  private constructor(private readonly persistence: Persistence) {}

  /** Where the data is stored (for log messages). */
  get file(): string {
    return this.persistence.location;
  }

  /** Loads the store from `persistence`, seeding it on first run. */
  static async load(persistence: Persistence): Promise<ReleaseStore> {
    const store = new ReleaseStore(persistence);
    const stored = await persistence.load();
    if (stored) {
      store.releases = stored;
    } else {
      store.releases = buildSeed();
      await persistence.save(store.releases);
    }
    return store;
  }

  // ---------- reads ----------
  list(q: ListParams): { items: ReleaseListItem[]; total: number; page: number; pageSize: number } {
    let rows = this.releases;
    if (q.q) rows = rows.filter((r) => r.version.includes(q.q as string));
    if (q.line) rows = rows.filter((r) => r.line === q.line);
    if (q.type) rows = rows.filter((r) => (q.type === 'none' ? r.type === null : r.type === q.type));
    const sorted = rows.toSorted(SORTS[q.sort]);
    const start = (q.page - 1) * q.pageSize;
    return {
      items: sorted.slice(start, start + q.pageSize).map(withoutNotes),
      total: sorted.length,
      page: q.page,
      pageSize: q.pageSize,
    };
  }

  get(version: string): StudioRelease {
    const r = this.releases.find((x) => x.version === version);
    if (!r) throw notFound(version);
    return structuredClone(r);
  }

  summary(): StudioSummary {
    const byVersion = this.releases.toSorted(compareVersionsDesc);
    const latest = byVersion.find((r) => r.type === 'LATEST');
    const lts = byVersion.find((r) => r.type === 'LTS');
    const lines = new Map<string, 'LTS' | 'MTS'>();
    for (const r of byVersion)
      if ((r.type === 'LTS' || r.type === 'MTS') && !lines.has(r.line)) lines.set(r.line, r.type);
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
      if (draft.some((r) => r.version === version))
        throw new HttpError(409, 'conflict', `Release ${version} already exists.`, [
          { field: 'version', message: `Release ${version} already exists.` },
        ]);
      const release: StudioRelease = {
        version,
        ...parseVersion(version),
        type: null,
        date: body.date,
        mac: this.resolveMac(version, body.mac),
        notes: normalizeNotes(body.notes),
      };
      draft.push(release);
      this.applyType(draft, release, body.type);
      return release;
    });
  }

  update(version: string, body: UpdateBody): Promise<StudioRelease> {
    if (body.version !== undefined && body.version.trim() !== version) {
      throw new HttpError(422, 'validation_failed', 'The version cannot be changed.', [
        {
          field: 'version',
          message: 'The version cannot be changed; delete the release and create a new one instead.',
        },
      ]);
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
        throw new HttpError(
          409,
          'latest_protected',
          `Release ${version} is the current LATEST release. Promote another release to LATEST before deleting it.`,
        );
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
        throw new HttpError(422, 'validation_failed', 'A beta release cannot be LATEST.', [
          {
            field: 'type',
            message: 'A beta release cannot be LATEST. Change it to a GA type (none, LTS or MTS) first.',
          },
        ]);
      }
      for (const other of draft)
        if (other !== release && other.type === 'LATEST') other.type = demotedType(draft, other);
    } else if (release.type === 'LATEST') {
      throw new HttpError(
        409,
        'latest_required',
        'There must always be one LATEST release. Promote another release to LATEST instead.',
        [
          {
            field: 'type',
            message: 'There must always be one LATEST release. Promote another release to LATEST instead.',
          },
        ],
      );
    }
    release.type = type;
  }

  // ---------- persistence ----------
  /** Runs `fn` on a copy of the data, persists it atomically, then commits. Calls never overlap. */
  private mutate<T>(fn: (draft: StudioRelease[]) => T): Promise<T> {
    const run = this.queue.then(async () => {
      const draft = structuredClone(this.releases);
      const result = fn(draft);
      await this.persistence.save(draft);
      this.releases = draft;
      return structuredClone(result);
    });
    this.queue = run.catch(() => undefined); // keep the queue alive after a rejected write
    return run;
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
