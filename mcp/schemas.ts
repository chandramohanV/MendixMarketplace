// Tool input schemas. Enum values come from the catalog and shared/studio.ts, so they never drift.
import { z } from 'zod';
import { ListQuerySchema } from '../shared/studio';
import { CATEGORIES, INDUSTRIES, LICENSE_MODELS, PLATFORM_VERSIONS, SUPPORT, TYPES } from '../src/data/components';
import { MAX_LIMIT, SEARCH_SORTS } from './tools';

export const componentRef = z
  .string()
  .min(1)
  .describe('Component slug (e.g. "1-excel-importer"), numeric id, or exact name');

export const searchInput = {
  query: z.string().optional().describe('Free-text search, e.g. "pdf" or "excel import"'),
  type: z.enum(TYPES).optional(),
  category: z.enum(CATEGORIES).optional(),
  industry: z.enum(INDUSTRIES).optional(),
  support: z.enum(SUPPORT).optional(),
  publisher: z.string().optional().describe('Exact publisher name (see list_publishers)'),
  license: z.enum(LICENSE_MODELS).optional(),
  minRating: z.number().min(0).max(5).optional().describe('Minimum average star rating'),
  platformVersion: z
    .enum(PLATFORM_VERSIONS)
    .optional()
    .describe('Only components compatible with this platform version'),
  featured: z.boolean().optional(),
  sort: z.enum(SEARCH_SORTS).optional().describe('Default: downloads (most popular)'),
  limit: z.number().int().min(1).max(MAX_LIMIT).optional().describe('Default 10'),
};

export const reviewsInput = {
  component: componentRef,
  limit: z.number().int().min(1).max(50).optional(),
};

export const publishersInput = {
  verified: z.boolean().optional(),
  country: z.string().optional().describe('e.g. "Germany"'),
};

export const compareInput = { components: z.array(componentRef).min(2).max(4) };

/** The Studio API's own list query, plus an optional exact version for one release with notes. */
export const studioReleasesInput = {
  ...ListQuerySchema.shape,
  version: z.string().optional().describe('Exact version (e.g. "11.2.0") to get that release with its notes'),
};
