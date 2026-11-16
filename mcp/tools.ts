// MCP tool logic: pure functions over the marketplace catalog. No MCP SDK imports, so it is easy to test.
import {
  CATEGORIES,
  COMPONENTS,
  INDUSTRIES,
  LICENSE_TYPES,
  PLATFORM_VERSIONS,
  PUBLISHER_LIST,
  SUPPORT,
  SUPPORT_INFO,
  TYPES,
} from '../src/data/components';
import { filterAndSort, type ExploreFilters, type SortKey } from '../src/features/explore/filters';
import type { Component, ComponentType, LicenseModel, SupportLevel } from '../src/types';
import { fail, ok, type ToolResult } from './result';

export const LICENSE_MODELS: LicenseModel[] = ['Free', 'Paid', 'Free trial'];

// ---------- search ----------
export const SEARCH_SORTS = ['downloads', 'rating', 'updated', 'newest', 'name'] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];
const SORT_KEYS: Record<SearchSort, SortKey> = {
  downloads: 'relevance',
  rating: 'rating',
  updated: 'updated',
  newest: 'newest',
  name: 'az',
};

export interface SearchInput {
  query?: string;
  type?: ComponentType;
  category?: string;
  industry?: string;
  support?: SupportLevel;
  publisher?: string;
  license?: LicenseModel;
  minRating?: number;
  platformVersion?: string;
  featured?: boolean;
  sort?: SearchSort;
  limit?: number;
}

export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 50;

export function summarize(c: Component) {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    type: c.type,
    category: c.category,
    publisher: c.publisher,
    support: c.support,
    license: c.license,
    rating: c.rating,
    ratingCount: c.ratingCount,
    downloads: c.downloads,
    version: c.version,
    short: c.short,
  };
}
export type ComponentSummary = ReturnType<typeof summarize>;

export function searchComponents(input: SearchInput, catalog: Component[] = COMPONENTS) {
  const filters: ExploreFilters = {
    q: input.query?.trim() ?? '',
    version: input.platformVersion ?? '',
    rating: input.minRating ?? 0,
    sort: SORT_KEYS[input.sort ?? 'downloads'],
    page: 1,
    view: 'all',
    type: input.type ? [input.type] : [],
    category: input.category ? [input.category] : [],
    support: input.support ? [input.support] : [],
    industry: input.industry ? [input.industry] : [],
    publisher: input.publisher ? [input.publisher] : [],
  };
  const matches = filterAndSort(catalog, filters).filter(
    (c) =>
      (input.license === undefined || c.license === input.license) &&
      (input.featured === undefined || c.featured === input.featured),
  );
  const limit = Math.min(Math.max(1, input.limit ?? DEFAULT_LIMIT), MAX_LIMIT);
  return {
    total: matches.length,
    returned: Math.min(limit, matches.length),
    results: matches.slice(0, limit).map(summarize),
  };
}

// ---------- lookup ----------
const norm = (s: string) => s.trim().toLowerCase();

/** Finds a component by id ("12"), slug ("12-excel-importer") or name (case-insensitive). */
export function findComponent(ref: string | number, catalog: Component[] = COMPONENTS): Component | undefined {
  const key = norm(String(ref));
  if (/^\d+$/.test(key)) return catalog.find((c) => c.id === Number(key));
  return catalog.find((c) => c.slug === key) ?? catalog.find((c) => norm(c.name) === key);
}

/** 2 points per word found in the name, 1 per word found only in the short description. */
function matchScore(c: Component, words: string[]): number {
  const name = norm(c.name);
  const short = norm(c.short);
  return words.reduce((score, word) => {
    if (name.includes(word)) return score + 2;
    return short.includes(word) ? score + 1 : score;
  }, 0);
}

/** The closest component names to an unknown reference, best first. */
export function suggestComponents(ref: string, catalog: Component[] = COMPONENTS, max = 5): ComponentSummary[] {
  const words = norm(ref.replace(/^\d+-/, '').replace(/-/g, ' ')).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return catalog
    .map((component) => ({ component, score: matchScore(component, words) }))
    .filter((match) => match.score > 0)
    .toSorted((a, b) => b.score - a.score || b.component.downloads - a.component.downloads)
    .slice(0, max)
    .map((match) => summarize(match.component));
}

function notFound(ref: string | number): ToolResult<never> {
  const suggestions = suggestComponents(String(ref));
  const hint = suggestions.length
    ? ` Did you mean: ${suggestions.map((s) => `${s.name} (${s.slug})`).join(', ')}?`
    : ' Use search_components to find the right slug.';
  return fail(`No component matches "${ref}".${hint}`);
}

export function reviewStats(c: Component) {
  const breakdown: Record<'1' | '2' | '3' | '4' | '5', number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of c.reviews) breakdown[String(r.stars) as keyof typeof breakdown]++;
  return {
    averageRating: c.rating,
    ratingCount: c.ratingCount,
    sampleReviewCount: c.reviews.length,
    starBreakdown: breakdown,
  };
}

export function getComponent(ref: string | number) {
  const c = findComponent(ref);
  if (!c) return notFound(ref);
  const { color: _color, icon: _icon, reviews: _reviews, releases, ...rest } = c;
  return ok({
    ...rest,
    latestReleases: releases.slice(0, 3),
    totalReleases: releases.length,
    reviewSummary: reviewStats(c),
  });
}

export function getComponentReviews(ref: string | number, limit = 10) {
  const c = findComponent(ref);
  if (!c) return notFound(ref);
  const reviews = c.reviews.toSorted((a, b) => b.helpful - a.helpful).slice(0, Math.max(1, limit));
  return ok({ component: c.name, slug: c.slug, ...reviewStats(c), reviews });
}

export function getComponentReleases(ref: string | number) {
  const c = findComponent(ref);
  if (!c) return notFound(ref);
  return ok({
    component: c.name,
    slug: c.slug,
    currentVersion: c.version,
    minPlatform: c.minPlatform,
    releases: c.releases,
  });
}

// ---------- publishers / taxonomy ----------
export function listPublishers(
  input: { verified?: boolean; country?: string } = {},
  catalog: Component[] = COMPONENTS,
) {
  return PUBLISHER_LIST.filter(
    (p) =>
      (input.verified === undefined || p.verified === input.verified) &&
      (!input.country || norm(p.country) === norm(input.country)),
  ).map((p) => {
    const own = catalog.filter((c) => c.publisher === p.name);
    return {
      ...p,
      componentCount: own.length,
      totalDownloads: own.reduce((sum, c) => sum + c.downloads, 0),
    };
  });
}

export function listTaxonomy() {
  return {
    types: TYPES,
    categories: CATEGORIES,
    industries: INDUSTRIES,
    supportLevels: SUPPORT.map((level) => ({ level, description: SUPPORT_INFO[level] })),
    licenseModels: LICENSE_MODELS,
    licenseTypes: LICENSE_TYPES,
    platformVersions: PLATFORM_VERSIONS,
    publishers: PUBLISHER_LIST.map((p) => p.name),
    totalComponents: COMPONENTS.length,
  };
}

// ---------- compare ----------
export function compareComponents(refs: (string | number)[]) {
  if (refs.length < 2 || refs.length > 4) return fail('Compare between 2 and 4 components.');
  const found: Component[] = [];
  for (const ref of refs) {
    const c = findComponent(ref);
    if (!c) return notFound(ref);
    found.push(c);
  }
  return ok(
    found.map((c) => ({
      name: c.name,
      slug: c.slug,
      type: c.type,
      category: c.category,
      publisher: c.publisher,
      publisherVerified: c.publisherVerified,
      support: c.support,
      license: c.license,
      licenseType: c.licenseType,
      price: c.price,
      rating: c.rating,
      ratingCount: c.ratingCount,
      downloads: c.downloads,
      version: c.version,
      minPlatform: c.minPlatform,
      compatible: c.compatible,
      updated: c.updated,
      features: c.features,
    })),
  );
}
