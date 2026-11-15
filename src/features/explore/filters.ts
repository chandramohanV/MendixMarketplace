// Explore filters: URL <-> filter state, matching, sorting, chips and home sections. Pure: no React.
import { routes } from '../../lib/routes';
import type { Component } from '../../types';

export const PAGE_SIZE = 18;
export const MULTI_FILTERS = ['type', 'category', 'support', 'industry', 'publisher'] as const;
export type MultiFilterKey = (typeof MULTI_FILTERS)[number];

type Compare = (a: Component, b: Component) => number;
export const SORTS = {
  relevance: { label: 'Most popular', compare: ((a, b) => b.downloads - a.downloads) as Compare },
  rating: {
    label: 'Highest rated',
    compare: ((a, b) => b.rating - a.rating || b.ratingCount - a.ratingCount) as Compare,
  },
  updated: { label: 'Recently updated', compare: ((a, b) => b.updated.localeCompare(a.updated)) as Compare },
  newest: { label: 'Newest', compare: ((a, b) => b.created.localeCompare(a.created)) as Compare },
  az: { label: 'Name (A–Z)', compare: ((a, b) => a.name.localeCompare(b.name)) as Compare },
};
export type SortKey = keyof typeof SORTS;
const isSortKey = (v: string): v is SortKey => v in SORTS;

export interface ExploreFilters extends Record<MultiFilterKey, string[]> {
  q: string;
  version: string;
  rating: number;
  sort: SortKey;
  page: number;
  /** "all" shows the results view even without filters (the "View All" links). */
  view: string;
}

export function parseFilters(params: URLSearchParams): ExploreFilters {
  const sort = params.get('sort') || 'relevance';
  return {
    q: params.get('q') || '',
    version: params.get('version') || '',
    rating: Number(params.get('rating') || 0),
    sort: isSortKey(sort) ? sort : 'relevance',
    page: Number(params.get('page') || 1),
    view: params.get('view') || '',
    type: params.getAll('type'),
    category: params.getAll('category'),
    support: params.getAll('support'),
    industry: params.getAll('industry'),
    publisher: params.getAll('publisher'),
  };
}

/** Every word of the query must appear in the component's searchable text. */
function matchesQuery(c: Component, q: string): boolean {
  const haystack = `${c.name} ${c.short} ${c.publisher} ${c.category} ${c.type} ${c.tags.join(' ')}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((word) => haystack.includes(word));
}

export function matchesFilters(c: Component, f: ExploreFilters): boolean {
  if (f.q && !matchesQuery(c, f.q)) return false;
  for (const key of MULTI_FILTERS) if (f[key].length && !f[key].includes(c[key])) return false;
  if (f.version && !c.compatible.includes(f.version)) return false;
  if (f.rating && (c.ratingCount === 0 || c.rating < f.rating)) return false;
  return true;
}

export const filterAndSort = (components: Component[], f: ExploreFilters): Component[] =>
  components.filter((c) => matchesFilters(c, f)).toSorted(SORTS[f.sort].compare);

export const ratingLabel = (stars: number): string => (stars === 5 ? '5 stars' : `${stars}+ stars`);

/** A removable "Filtered by" chip; removing a multi-value chip drops only that value. */
export type FilterChip =
  | { label: string; kind: 'single'; param: 'q' | 'version' | 'rating' }
  | { label: string; kind: 'multi'; param: MultiFilterKey; value: string };

export function activeFilterChips(f: ExploreFilters): FilterChip[] {
  const chips: FilterChip[] = [];
  if (f.q) chips.push({ label: `"${f.q}"`, kind: 'single', param: 'q' });
  for (const key of MULTI_FILTERS)
    for (const value of f[key]) chips.push({ label: value, kind: 'multi', param: key, value });
  if (f.version) chips.push({ label: `Studio ${f.version}`, kind: 'single', param: 'version' });
  if (f.rating) chips.push({ label: ratingLabel(f.rating), kind: 'single', param: 'rating' });
  return chips;
}

export interface ExploreSection {
  title: string;
  link: string;
  items: Component[];
}

const topThree = (list: Component[], compare: Compare) => list.toSorted(compare).slice(0, 3);

/** The curated rows on the Explore home view (three components each). */
export function buildSections(components: Component[]): ExploreSection[] {
  const live = components.filter((c) => c.support !== 'Deprecated');
  return [
    {
      title: 'Smarter with AI',
      link: routes.explore({ category: 'Artificial Intelligence' }),
      items: topThree(
        live.filter((c) => ['Artificial Intelligence', 'Agents'].includes(c.category)),
        (a, b) => b.downloads - a.downloads,
      ),
    },
    {
      title: 'From our Partners',
      link: routes.explore({ support: 'Partner' }),
      items: topThree(
        live.filter((c) => c.support === 'Partner'),
        (a, b) => b.rating - a.rating,
      ),
    },
    {
      title: "What's New",
      link: routes.explore({ view: 'all', sort: 'newest' }),
      items: topThree(live, (a, b) => b.created.localeCompare(a.created) || b.id - a.id),
    },
    {
      title: 'Most Downloaded',
      link: routes.explore({ view: 'all', sort: 'relevance' }),
      items: topThree(live, (a, b) => b.downloads - a.downloads),
    },
  ];
}
