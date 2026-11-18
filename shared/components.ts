// Component catalog schemas shared by the API server and the browser client (admin editing).
import { z } from 'zod';
import {
  CATEGORIES,
  INDUSTRIES,
  LICENSE_MODELS,
  LICENSE_TYPES,
  PLATFORM_VERSIONS,
  PUBLISHER_LIST,
  SUPPORT,
  TYPES,
} from '../src/data/components';
import type { Component } from '../src/types';

export const COMPONENT_LIMITS = {
  nameMin: 3,
  nameMax: 60,
  shortMin: 10,
  shortMax: 160,
  maxPrice: 100_000,
  tags: 10,
  tagLength: 30,
  features: 12,
  featureLength: 160,
} as const;

const PUBLISHER_NAMES = PUBLISHER_LIST.map((p) => p.name);

const isHttpsUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

const listOf = (max: number, itemLength: number, label: string) =>
  z
    .array(
      z
        .string()
        .trim()
        .min(1, `${label} cannot be empty.`)
        .max(itemLength, `${label} can be at most ${itemLength} characters.`),
    )
    .max(max, `At most ${max} ${label.toLowerCase()} are allowed.`);

/** What an admin can set on a component. Everything else (id, slug, ratings, reviews…) is managed by the server. */
export const ComponentInputSchema = z
  .strictObject({
    name: z
      .string()
      .trim()
      .min(COMPONENT_LIMITS.nameMin, `Name must be ${COMPONENT_LIMITS.nameMin}–${COMPONENT_LIMITS.nameMax} characters.`)
      .max(
        COMPONENT_LIMITS.nameMax,
        `Name must be ${COMPONENT_LIMITS.nameMin}–${COMPONENT_LIMITS.nameMax} characters.`,
      ),
    type: z.enum(TYPES),
    category: z.enum(CATEGORIES),
    industry: z.enum(INDUSTRIES),
    publisher: z.enum(PUBLISHER_NAMES),
    support: z.enum(SUPPORT),
    license: z.enum(LICENSE_MODELS),
    licenseType: z.enum(LICENSE_TYPES),
    price: z
      .number({ error: 'Enter the price as a whole number.' })
      .int('Price must be a whole number.')
      .min(0, 'Price cannot be negative.')
      .max(COMPONENT_LIMITS.maxPrice, `Price can be at most ${COMPONENT_LIMITS.maxPrice}.`),
    version: z
      .string()
      .trim()
      .regex(/^\d+\.\d+\.\d+$/, 'Use semantic versioning, for example 1.0.0.'),
    minPlatform: z.enum(PLATFORM_VERSIONS),
    short: z
      .string()
      .trim()
      .min(
        COMPONENT_LIMITS.shortMin,
        `Short description must be ${COMPONENT_LIMITS.shortMin}–${COMPONENT_LIMITS.shortMax} characters.`,
      )
      .max(
        COMPONENT_LIMITS.shortMax,
        `Short description must be ${COMPONENT_LIMITS.shortMin}–${COMPONENT_LIMITS.shortMax} characters.`,
      ),
    featured: z.boolean(),
    tags: listOf(COMPONENT_LIMITS.tags, COMPONENT_LIMITS.tagLength, 'Tags'),
    features: listOf(COMPONENT_LIMITS.features, COMPONENT_LIMITS.featureLength, 'Features'),
    repo: z.string().trim().refine(isHttpsUrl, 'Repository URL must be a valid https:// address.').nullable(),
  })
  .superRefine((input, ctx) => {
    const isFree = input.license === 'Free';
    if (isFree && input.price !== 0)
      ctx.addIssue({ code: 'custom', path: ['price'], message: 'Free components must have a price of 0.' });
    if (!isFree && input.price === 0)
      ctx.addIssue({ code: 'custom', path: ['price'], message: `${input.license} components need a price above 0.` });
  });
export type ComponentInput = z.output<typeof ComponentInputSchema>;

/** A stored component, as the API returns it. `satisfies` keeps it in step with the shared `Component` type. */
export const ComponentSchema = z.object({
  id: z.number().int(),
  slug: z.string(),
  name: z.string(),
  type: z.enum(TYPES),
  category: z.string(),
  industry: z.string(),
  publisher: z.string(),
  publisherVerified: z.boolean(),
  publisherCountry: z.string(),
  support: z.enum(SUPPORT),
  license: z.enum(LICENSE_MODELS),
  licenseType: z.string(),
  price: z.number(),
  rating: z.number(),
  ratingCount: z.number(),
  downloads: z.number(),
  version: z.string(),
  minPlatform: z.string(),
  compatible: z.array(z.string()),
  updated: z.string(),
  created: z.string(),
  color: z.string(),
  icon: z.string(),
  featured: z.boolean(),
  tags: z.array(z.string()),
  short: z.string(),
  description: z.string().optional(),
  features: z.array(z.string()),
  releases: z.array(
    z.object({ version: z.string(), date: z.string(), minPlatform: z.string(), notes: z.array(z.string()) }),
  ),
  reviews: z.array(
    z.object({
      author: z.string(),
      stars: z.number(),
      title: z.string(),
      body: z.string(),
      date: z.string(),
      helpful: z.number(),
      mine: z.boolean().optional(),
    }),
  ),
  repo: z.string().nullable(),
  status: z.enum(['pending', 'published', 'rejected']).optional(),
}) satisfies z.ZodType<Component>;

export const ComponentListSchema = z.object({ items: z.array(ComponentSchema) });
export type ComponentList = z.infer<typeof ComponentListSchema>;
