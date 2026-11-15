import { describe, expect, it } from 'vitest';
import { COMPONENTS } from '../../src/data/components';
import {
  activeFilterChips,
  buildSections,
  filterAndSort,
  matchesFilters,
  parseFilters,
  ratingLabel,
  SORTS,
} from '../../src/features/explore/filters';
import { routes } from '../../src/lib/routes';

const filtersFrom = (query: string) => parseFilters(new URLSearchParams(query));

describe('parseFilters', () => {
  it('has sensible defaults', () => {
    expect(filtersFrom('')).toEqual({
      q: '',
      version: '',
      rating: 0,
      sort: 'relevance',
      page: 1,
      view: '',
      type: [],
      category: [],
      support: [],
      industry: [],
      publisher: [],
    });
  });

  it('reads repeated multi-value params and ignores an unknown sort', () => {
    const f = filtersFrom('type=Widget&type=Module&sort=bogus&rating=4&page=2');
    expect(f.type).toEqual(['Widget', 'Module']);
    expect(f.sort).toBe('relevance');
    expect(f.rating).toBe(4);
    expect(f.page).toBe(2);
  });

  it('round-trips links built with routes.explore', () => {
    const url = new URL(routes.explore({ category: 'Artificial Intelligence', sort: 'newest' }), 'http://x');
    const f = parseFilters(url.searchParams);
    expect(f.category).toEqual(['Artificial Intelligence']);
    expect(f.sort).toBe('newest');
  });
});

describe('matchesFilters / filterAndSort', () => {
  const widget = COMPONENTS.find((c) => c.type === 'Widget' && c.ratingCount > 0);
  if (!widget) throw new Error('fixture: no rated widget');

  it('requires every query word to appear (case-insensitive)', () => {
    expect(matchesFilters(widget, filtersFrom(`q=${encodeURIComponent(widget.name.toUpperCase())}`))).toBe(true);
    expect(matchesFilters(widget, filtersFrom(`q=${encodeURIComponent(`${widget.name} zzzz`)}`))).toBe(false);
  });

  it('applies multi-value filters as OR within a group and AND across groups', () => {
    expect(matchesFilters(widget, filtersFrom('type=Module&type=Widget'))).toBe(true);
    expect(matchesFilters(widget, filtersFrom(`type=Widget&category=${encodeURIComponent('Not A Category')}`))).toBe(false);
  });

  it('filters by rating, excluding unrated components', () => {
    const unrated = COMPONENTS.find((c) => c.ratingCount === 0);
    if (unrated) expect(matchesFilters(unrated, filtersFrom('rating=3'))).toBe(false);
    expect(filterAndSort(COMPONENTS, filtersFrom('rating=4')).every((c) => c.rating >= 4 && c.ratingCount > 0)).toBe(true);
  });

  it.each(Object.keys(SORTS))('sorts by %s without mutating the input', (sort) => {
    const before = COMPONENTS.map((c) => c.id);
    const sorted = filterAndSort(COMPONENTS, filtersFrom(`sort=${sort}`));
    expect(COMPONENTS.map((c) => c.id)).toEqual(before);
    expect(sorted).toHaveLength(COMPONENTS.length);
  });

  it('sorts A–Z by name', () => {
    const names = filterAndSort(COMPONENTS, filtersFrom('sort=az')).map((c) => c.name);
    expect(names).toEqual(names.toSorted((a, b) => a.localeCompare(b)));
  });
});

describe('chips and sections', () => {
  it('describes each active filter as a removable chip', () => {
    const chips = activeFilterChips(filtersFrom('q=grid&type=Widget&type=Module&version=11.0&rating=5'));
    expect(chips.map((c) => c.label)).toEqual(['"grid"', 'Widget', 'Module', 'Studio 11.0', '5 stars']);
    expect(chips[1]).toEqual({ label: 'Widget', kind: 'multi', param: 'type', value: 'Widget' });
    expect(chips[0]).toEqual({ label: '"grid"', kind: 'single', param: 'q' });
  });

  it.each([
    [5, '5 stars'],
    [4, '4+ stars'],
    [3, '3+ stars'],
  ])('rating label %d', (stars, label) => {
    expect(ratingLabel(stars)).toBe(label);
  });

  it('builds four sections of three non-deprecated components', () => {
    const sections = buildSections(COMPONENTS);
    expect(sections.map((s) => s.title)).toEqual(['Smarter with AI', 'From our Partners', "What's New", 'Most Downloaded']);
    for (const s of sections) {
      expect(s.items).toHaveLength(3);
      expect(s.items.every((c) => c.support !== 'Deprecated')).toBe(true);
    }
    expect(sections[1].items.every((c) => c.support === 'Partner')).toBe(true);
  });
});
