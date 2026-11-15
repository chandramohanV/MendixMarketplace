import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { COMPONENTS } from '../../src/data/components';
import { buildCatalog, isNameTaken, submissionToComponent } from '../../src/lib/catalog';
import { isArray, isPlainObject, loadJson, saveJson } from '../../src/store/persistence';
import {
  autoPublishDelay,
  createSubmission,
  MAX_TIMER_MS,
  nextSubmissionId,
  reviseSubmission,
  SUBMISSION_ID_BASE,
} from '../../src/store/submissions';
import type { Submission, SubmissionInput } from '../../src/types';

const INPUT: SubmissionInput = {
  name: '  My Widget  ',
  type: 'Widget',
  category: 'User Interface',
  short: 'A widget for the unit tests.',
  version: '1.0.0',
  minPlatform: '10.24',
  file: { name: 'w.mpk', size: 10 },
  license: 'MIT',
  repo: '',
  description: '',
};
const NOW = new Date('2026-11-01T12:00:00.000Z');

describe('submission records', () => {
  it('numbers submissions after the catalog id range', () => {
    expect(nextSubmissionId([])).toBe(SUBMISSION_ID_BASE + 1);
    const existing = [createSubmission(INPUT, [], NOW, 0)];
    expect(nextSubmissionId(existing)).toBe(SUBMISSION_ID_BASE + 2);
  });

  it('creates a pending submission with a trimmed name, slug and publish time', () => {
    const s = createSubmission(INPUT, [], NOW, 5000);
    expect(s).toMatchObject({ name: 'My Widget', slug: `${SUBMISSION_ID_BASE + 1}-my-widget`, status: 'pending' });
    expect(s.submittedAt).toBe(NOW.toISOString());
    expect(s.publishAt).toBe('2026-11-01T12:00:05.000Z');
  });

  it('revises a submission, keeping its id and restarting the review timer', () => {
    const s = createSubmission(INPUT, [], NOW, 5000);
    const later = new Date('2026-11-02T00:00:00.000Z');
    const revised = reviseSubmission(s, { ...INPUT, name: 'Renamed' }, later, 1000);
    expect(revised).toMatchObject({ id: s.id, slug: `${s.id}-renamed`, submittedAt: s.submittedAt });
    expect(revised.updatedAt).toBe(later.toISOString());
    expect(revised.publishAt).toBe('2026-11-02T00:00:01.000Z');
  });

  it.each([
    ['due in 5 s', { status: 'pending', publishAt: '2026-11-01T12:00:05.000Z' }, 5000],
    ['overdue', { status: 'pending', publishAt: '2026-11-01T11:00:00.000Z' }, 0],
    ['already published', { status: 'published', publishAt: '2026-11-01T12:00:05.000Z' }, null],
    ['no publish time', { status: 'pending', publishAt: null }, null],
    // setTimeout would overflow and fire immediately (the bug fixed in a51c8ea).
    ['too far away for setTimeout', { status: 'pending', publishAt: '2099-01-01T00:00:00.000Z' }, null],
  ] as const)('auto-publish delay: %s', (_case, patch, expected) => {
    const s = { ...createSubmission(INPUT, [], NOW, 0), ...patch } as Submission;
    expect(autoPublishDelay(s, NOW.getTime())).toBe(expected);
  });

  it('schedules a delay exactly at the setTimeout limit', () => {
    const s = { ...createSubmission(INPUT, [], NOW, 0), publishAt: new Date(NOW.getTime() + MAX_TIMER_MS).toISOString() };
    expect(autoPublishDelay(s, NOW.getTime())).toBe(MAX_TIMER_MS);
  });
});

describe('catalog', () => {
  const pending = createSubmission(INPUT, [], NOW, 5000);
  const published: Submission = { ...createSubmission({ ...INPUT, name: 'Shipped' }, [pending], NOW, 0), status: 'published' };

  it('maps a submission onto a Community component by Demo User', () => {
    const c = submissionToComponent(published);
    expect(c).toMatchObject({
      id: published.id,
      publisher: 'Demo User',
      support: 'Community',
      rating: 0,
      ratingCount: 0,
      status: 'published',
      releases: [{ version: '1.0.0', minPlatform: '10.24' }],
    });
    expect(c.compatible).toEqual(['11.5', '11.0', '10.24']);
    expect(submissionToComponent(published).color).toBe(c.color); // deterministic
  });

  it('lists published submissions publicly but finds pending ones by slug', () => {
    const catalog = buildCatalog(COMPONENTS, [pending, published]);
    expect(catalog.components).toHaveLength(COMPONENTS.length + 1);
    expect(catalog.components.some((c) => c.id === pending.id)).toBe(false);
    expect(catalog.findBySlug(pending.slug)?.status).toBe('pending');
    expect(catalog.findById(published.id)?.name).toBe('Shipped');
  });

  it.each([
    ['catalog name, other case', 'excel importer', undefined, true],
    ['own submission', 'my widget', undefined, true],
    ['own submission being edited', 'My Widget', pending.id, false],
    ['new name', 'Brand New', undefined, false],
  ])('isNameTaken: %s', (_case, name, except, taken) => {
    expect(isNameTaken(name, COMPONENTS, [pending], except)).toBe(taken);
  });
});

describe('persistence', () => {
  const store = new Map<string, string>();
  const original = globalThis.localStorage;
  beforeEach(() => {
    store.clear();
    globalThis.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    } as Storage;
  });
  afterEach(() => {
    globalThis.localStorage = original;
  });

  it('round-trips JSON', () => {
    saveJson('k', [1, 2]);
    expect(loadJson('k', [], isArray)).toEqual([1, 2]);
  });

  it.each([
    ['missing', null],
    ['corrupt JSON', '{nope'],
    ['wrong shape', '"a string"'],
  ])('falls back when the value is %s', (_case, raw) => {
    if (raw !== null) store.set('k', raw);
    expect(loadJson('k', ['fallback'], isArray)).toEqual(['fallback']);
    expect(loadJson('k', {}, isPlainObject)).toEqual({});
  });

  it('does not throw when storage is unavailable', () => {
    globalThis.localStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    } as unknown as Storage;
    expect(() => saveJson('k', 1)).not.toThrow();
    expect(loadJson('k', 'fallback', () => true)).toBe('fallback');
  });
});
