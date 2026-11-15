// The live catalog: dummy components plus the user's submissions.
import { useMemo } from 'react';
import { COLORS, COMPONENTS, ICONS, PLATFORM_VERSIONS } from './data/components';
import { useStore } from './store';
import type { Component, Submission } from './types';

export const SUBMITTER_NAME = 'Demo User';

function hash(s: string): number {
  let h = 2166136261;
  for (const ch of s) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

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
    color: COLORS[hash(s.name) % COLORS.length],
    icon: ICONS[hash(s.slug) % ICONS.length],
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

const norm = (name: string) => name.trim().toLowerCase();

export interface Catalog {
  /** Everything public: the dummy catalog plus published submissions. */
  components: Component[];
  /** Finds any component by slug, including the user's own pending/rejected submissions. */
  findBySlug: (slug: string) => Component | undefined;
  findById: (id: number) => Component | undefined;
  /** Case-insensitive name check across the catalog and all submissions. */
  isNameTaken: (name: string, exceptSubmissionId?: number) => boolean;
}

export function useCatalog(): Catalog {
  const { submissions } = useStore();
  return useMemo(() => {
    const own = submissions.map(submissionToComponent);
    const components = [...COMPONENTS, ...own.filter((c) => c.status === 'published')];
    const all = [...COMPONENTS, ...own];
    return {
      components,
      findBySlug: (slug) => all.find((c) => c.slug === slug),
      findById: (id) => all.find((c) => c.id === id),
      isNameTaken: (name, exceptSubmissionId) => {
        const n = norm(name);
        return (
          COMPONENTS.some((c) => norm(c.name) === n) ||
          submissions.some((s) => s.id !== exceptSubmissionId && norm(s.name) === n)
        );
      },
    };
  }, [submissions]);
}
