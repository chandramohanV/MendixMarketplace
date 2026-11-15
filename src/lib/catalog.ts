// Pure catalog logic: the dummy catalog combined with the user's submissions (see store/useCatalog).
import { COLORS, ICONS, PLATFORM_VERSIONS } from '../data/components';
import type { Component, Submission } from '../types';
import { hashString } from './hash';

const SUBMITTER_NAME = 'Demo User';

/** Turns a submission into a marketplace component (used for detail pages and listings). */
export function submissionToComponent(s: Submission): Component {
  const date = s.updatedAt.slice(0, 10);
  const minIndex = PLATFORM_VERSIONS.indexOf(s.minPlatform);
  return {
    id: s.id,
    slug: s.slug,
    name: s.name,
    type: s.type,
    category: s.category,
    industry: 'Agnostic',
    publisher: SUBMITTER_NAME,
    publisherVerified: false,
    publisherCountry: '—',
    support: 'Community',
    license: 'Free',
    licenseType: s.license,
    price: 0,
    rating: 0,
    ratingCount: 0,
    downloads: 0,
    version: s.version,
    minPlatform: s.minPlatform,
    compatible: minIndex >= 0 ? PLATFORM_VERSIONS.slice(0, minIndex + 1) : [s.minPlatform],
    updated: date,
    created: s.submittedAt.slice(0, 10),
    color: COLORS[hashString(s.name) % COLORS.length],
    icon: ICONS[hashString(s.slug) % ICONS.length],
    featured: false,
    tags: [s.type.toLowerCase(), s.category.toLowerCase(), 'community'],
    short: s.short,
    description: s.description || undefined,
    features: [],
    releases: [{ version: s.version, date, minPlatform: s.minPlatform, notes: ['Initial release.'] }],
    reviews: [],
    repo: s.repo || null,
    status: s.status,
  };
}

const normalizeName = (name: string) => name.trim().toLowerCase();

export interface Catalog {
  /** Everything public: the dummy catalog plus published submissions. */
  components: Component[];
  /** Finds any component by slug, including the user's own pending/rejected submissions. */
  findBySlug: (slug: string) => Component | undefined;
  findById: (id: number) => Component | undefined;
  /** Case-insensitive name check across the catalog and all submissions. */
  isNameTaken: (name: string, exceptSubmissionId?: number) => boolean;
}

/** Case-insensitive name check across the catalog and all submissions (except the one being edited). */
export function isNameTaken(
  name: string,
  catalog: Component[],
  submissions: Submission[],
  exceptSubmissionId?: number,
): boolean {
  const n = normalizeName(name);
  return (
    catalog.some((c) => normalizeName(c.name) === n) ||
    submissions.some((s) => s.id !== exceptSubmissionId && normalizeName(s.name) === n)
  );
}

export function buildCatalog(catalog: Component[], submissions: Submission[]): Catalog {
  const own = submissions.map(submissionToComponent);
  const all = [...catalog, ...own];
  return {
    components: [...catalog, ...own.filter((c) => c.status === 'published')],
    findBySlug: (slug) => all.find((c) => c.slug === slug),
    findById: (id) => all.find((c) => c.id === id),
    isNameTaken: (name, exceptSubmissionId) => isNameTaken(name, catalog, submissions, exceptSubmissionId),
  };
}
