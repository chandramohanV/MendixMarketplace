// Component detail helpers. Pure: no React.
import type { ComponentTab } from '../../lib/routes';
import type { Component, Review } from '../../types';

export const TABS: readonly ComponentTab[] = ['Overview', 'Documentation', 'Releases', 'Reviews', 'Developers'];
export const isTab = (value: string | null): value is ComponentTab =>
  value !== null && (TABS as readonly string[]).includes(value);

const DEVELOPER_NAMES = [
  'Anna Kowalski',
  'Ravi Shankar',
  'Jonas Meyer',
  'Priya Raman',
  'Tom de Vries',
  'Lena Berg',
  'Carlos Diaz',
  'Mei Lin',
];

/** Dummy developer list: the submitter for user submissions, 2–4 stable names otherwise. */
export function developersFor(c: Component): string[] {
  if (c.status) return ['Demo User'];
  return Array.from({ length: (c.id % 3) + 2 }, (_, i) => DEVELOPER_NAMES[(c.id + i * 3) % DEVELOPER_NAMES.length]);
}

/** Up to three other components in the same category or from the same publisher. */
export const relatedComponents = (c: Component, all: Component[]): Component[] =>
  all.filter((x) => x.id !== c.id && (x.category === c.category || x.publisher === c.publisher)).slice(0, 3);

/** "10.24.0": the minimum Studio version, as shown in the UI. */
export const requiredStudio = (c: Component): string => `${c.minPlatform}.0`;

/** Only public components can be favorited and reviewed (not your own pending/rejected submissions). */
export const isPublic = (c: Component): boolean => !c.status || c.status === 'published';

/**
 * Synthesized star distribution for the rating bars: weights centred on the average, nudged by the
 * reviews we actually have, scaled to the rating count.
 */
export function ratingDistribution(reviews: Review[], rating: number, count: number) {
  const weights = [5, 4, 3, 2, 1].map((stars) => {
    const base = Math.max(0, 1 - Math.abs(stars - rating) / 2.2);
    return { stars, weight: base + reviews.filter((r) => r.stars === stars).length * 0.2 };
  });
  const total = weights.reduce((sum, w) => sum + w.weight, 0) || 1;
  return weights.map(({ stars, weight }) => ({
    stars,
    percent: (weight / total) * 100,
    count: Math.round((weight / total) * count),
  }));
}
