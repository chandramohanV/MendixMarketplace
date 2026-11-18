// A list of records kept in memory and saved through a pluggable backend after every change
// (a JSON file under Node — see file-persistence.ts — or Workers KV on Cloudflare — see worker.ts).

/** Where a list lives. `load` returns null when nothing has been stored yet. */
export interface Persistence<T> {
  /** Human-readable location, for log messages. */
  readonly location: string;
  load(): Promise<T[] | null>;
  save(data: T[]): Promise<void>;
}

export class PersistedList<T> {
  private queue: Promise<unknown> = Promise.resolve();

  private constructor(
    private readonly persistence: Persistence<T>,
    private current: T[],
  ) {}

  /** Loads the list, seeding (and saving) it on first run. */
  static async open<T>(persistence: Persistence<T>, seed: () => T[]): Promise<PersistedList<T>> {
    const stored = await persistence.load();
    if (stored) return new PersistedList(persistence, stored);
    const seeded = seed();
    await persistence.save(seeded);
    return new PersistedList(persistence, seeded);
  }

  get location(): string {
    return this.persistence.location;
  }

  /** The committed records. Callers must not mutate them; use `mutate` instead. */
  get items(): readonly T[] {
    return this.current;
  }

  /** Runs `fn` on a copy of the data, persists it, then commits. Calls never overlap. */
  mutate<R>(fn: (draft: T[]) => R): Promise<R> {
    const run = this.queue.then(async () => {
      const draft = structuredClone(this.current);
      const result = fn(draft);
      await this.persistence.save(draft);
      this.current = draft;
      return structuredClone(result);
    });
    this.queue = run.catch(() => undefined); // keep the queue alive after a rejected write
    return run;
  }
}
