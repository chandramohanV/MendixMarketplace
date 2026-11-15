import { describe, expect, it } from 'vitest';
import {
  compareVersionsDesc,
  CreateReleaseSchema,
  defaultMac,
  isRealDate,
  macRuleError,
  parseVersion,
  PatchReleaseSchema,
  toFieldErrors,
  VERSION_RE,
} from '../../shared/studio';
import { developersFor, isTab, ratingDistribution, relatedComponents, requiredStudio } from '../../src/features/component-detail/detail';
import { COMPONENTS } from '../../src/data/components';
import { longDate, monthYear, shortDate } from '../../src/lib/dates';
import { formatBytes, formatNumber } from '../../src/lib/format';
import { hashString } from '../../src/lib/hash';
import { pageButtons } from '../../src/lib/pagination';
import { routes } from '../../src/lib/routes';
import { initials } from '../../src/lib/text';

describe('shared studio rules', () => {
  it.each([
    ['2026-02-28', true],
    ['2024-02-29', true],
    ['2026-02-29', false],
    ['2026-13-01', false],
    ['2026-1-01', false],
    ['20260101', false],
  ])('isRealDate(%j) = %s', (date, ok) => {
    expect(isRealDate(date)).toBe(ok);
  });

  it.each([
    ['11.16.1', true],
    ['0.0.0', true],
    ['01.2.3', false],
    ['11.16', false],
    ['v1.2.3', false],
  ])('VERSION_RE %j', (version, ok) => {
    expect(VERSION_RE.test(version)).toBe(ok);
  });

  it('parses and orders versions numerically', () => {
    expect(parseVersion('10.24.3')).toEqual({ major: 10, minor: 24, patch: 3, line: '10.24' });
    const versions = ['9.24.10', '11.0.0', '10.24.2', '10.24.10'].map(parseVersion).toSorted(compareVersionsDesc);
    expect(versions.map((v) => `${v.major}.${v.minor}.${v.patch}`)).toEqual(['11.0.0', '10.24.10', '10.24.2', '9.24.10']);
  });

  it('allows Mac downloads only from Studio 10', () => {
    expect(defaultMac('10.0.0')).toBe(true);
    expect(defaultMac('9.24.0')).toBe(false);
    expect(macRuleError('9.24.0', true)).toContain('Studio 10');
    expect(macRuleError('9.24.0', false)).toBeNull();
    expect(macRuleError('not-a-version', true)).toBeNull();
  });

  it('rejects derived and unknown fields in request bodies', () => {
    const result = CreateReleaseSchema.safeParse({ version: '11.0.1', date: '2026-01-01', major: 11 });
    expect(result.success).toBe(false);
    if (!result.success) expect(toFieldErrors(result.error)[0].message).toContain('major');
  });

  it('requires at least one field in a PATCH', () => {
    expect(PatchReleaseSchema.safeParse({}).success).toBe(false);
    expect(PatchReleaseSchema.safeParse({ mac: false }).success).toBe(true);
  });
});

describe('component detail helpers', () => {
  const c = COMPONENTS[0];

  it('recognises tabs', () => {
    expect(isTab('Reviews')).toBe(true);
    expect(isTab('reviews')).toBe(false);
    expect(isTab(null)).toBe(false);
  });

  it('lists 2–4 stable developers for catalog components', () => {
    const devs = developersFor(c);
    expect(devs.length).toBeGreaterThanOrEqual(2);
    expect(devs.length).toBeLessThanOrEqual(4);
    expect(developersFor(c)).toEqual(devs);
    expect(developersFor({ ...c, status: 'pending' })).toEqual(['Demo User']);
  });

  it('finds up to three related components, never itself', () => {
    const related = relatedComponents(c, COMPONENTS);
    expect(related.length).toBeLessThanOrEqual(3);
    expect(related.every((r) => r.id !== c.id && (r.category === c.category || r.publisher === c.publisher))).toBe(true);
  });

  it('formats the Studio requirement', () => {
    expect(requiredStudio({ ...c, minPlatform: '10.24' })).toBe('10.24.0');
  });

  it('builds a rating distribution that sums to 100%', () => {
    const rows = ratingDistribution([], 4.2, 120);
    expect(rows.map((r) => r.stars)).toEqual([5, 4, 3, 2, 1]);
    expect(rows.reduce((sum, r) => sum + r.percent, 0)).toBeCloseTo(100);
    expect(ratingDistribution([], 0, 0).every((r) => r.count === 0)).toBe(true);
  });
});

describe('lib helpers', () => {
  it.each([
    [950, '950'],
    [1000, '1k'],
    [12345, '12.3k'],
    [3400000, '3.4M'],
  ])('formatNumber(%d) = %s', (n, text) => {
    expect(formatNumber(n)).toBe(text);
  });

  it.each([
    [512, '512 B'],
    [2048, '2 KB'],
    [1843200, '1.8 MB'],
  ])('formatBytes(%d) = %s', (n, text) => {
    expect(formatBytes(n)).toBe(text);
  });

  it('formats dates in UTC', () => {
    expect(shortDate('2026-11-03')).toBe('Nov 3, 2026');
    expect(longDate('2026-11-03')).toBe('November 03, 2026');
    expect(monthYear('2026-11-03')).toBe('Nov, 2026');
  });

  it('hashes strings deterministically (FNV-1a)', () => {
    expect(hashString('')).toBe(2166136261);
    expect(hashString('abc')).toBe(hashString('abc'));
    expect(hashString('abc')).not.toBe(hashString('abd'));
  });

  it.each([
    [1, 1, [1]],
    [1, 5, [1, 2, '…', 5]],
    [5, 10, [1, '…', 4, 5, 6, '…', 10]],
    [3, 4, [1, 2, 3, 4]],
  ])('pageButtons(%d, %d)', (page, pages, expected) => {
    expect(pageButtons(page, pages)).toEqual(expected);
  });

  it('builds routes with encoded query values', () => {
    expect(routes.explore()).toBe('/components');
    expect(routes.explore({ category: 'Maps & Location', q: '' })).toBe('/components?category=Maps%20%26%20Location');
    expect(routes.component('6-x', 'Reviews')).toBe('/components/6-x?tab=Reviews');
    expect(routes.myMarketplace('submissions')).toBe('/my?tab=submissions');
    expect(routes.submitEdit(1000001)).toBe('/submit?edit=1000001');
  });

  it('takes initials from the first two words', () => {
    expect(initials('Helix Systems')).toBe('HS');
    expect(initials('Open Source Collective')).toBe('OS');
    expect(initials('Demo')).toBe('D');
  });
});
