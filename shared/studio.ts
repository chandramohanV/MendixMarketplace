// Studio release schemas and rules shared by the API server and the browser client.
import { z } from 'zod';

export const RELEASE_TYPE_VALUES = ['LTS', 'MTS', 'LATEST', 'BETA'] as const;
export const ReleaseTypeSchema = z.enum(RELEASE_TYPE_VALUES);
export type ReleaseType = z.infer<typeof ReleaseTypeSchema>;

export const RELEASE_TYPE_INFO: Record<ReleaseType, string> = {
  LTS: 'Long-Term Support (LTS) is maintained with supported updates until a third consecutive major version is released. For example, support on Studio 10.24 ends with the GA release of Studio 13.',
  MTS: 'Medium-Term Support (MTS) provides support for 6~18 months. Suitable for a balance of new features and support.',
  LATEST: 'Most recent release.',
  BETA: 'Beta gives you early access to new features. Not recommended for production use.',
};

export const LIMITS = { sections: 5, itemsPerSection: 20, itemLength: 300, sectionNameLength: 60 } as const;
export const VERSION_RE = /^(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,4})$/;

/** Today's date as YYYY-MM-DD (UTC). */
export const todayISO = (): string => new Date().toISOString().slice(0, 10);

export function isRealDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function parseVersion(version: string): { major: number; minor: number; patch: number; line: string } {
  const [major, minor, patch] = version.split('.').map(Number);
  return { major, minor, patch, line: `${major}.${minor}` };
}

export const compareVersionsDesc = (a: { major: number; minor: number; patch: number }, b: { major: number; minor: number; patch: number }) =>
  b.major - a.major || b.minor - a.minor || b.patch - a.patch;

// ---------- field schemas ----------
const VersionSchema = z.string().trim().regex(VERSION_RE, 'Use semantic versioning, for example 11.2.0.');
const DateSchema = z.string()
  .refine(isRealDate, 'Enter a real date in YYYY-MM-DD format.')
  .refine((s) => !isRealDate(s) || s <= todayISO(), 'Release date cannot be in the future.');
const NoteItemSchema = z.string().trim()
  .min(1, 'Note items cannot be empty.')
  .max(LIMITS.itemLength, `Note items can be at most ${LIMITS.itemLength} characters.`);
export const NotesSchema = z.record(
  z.string().trim().min(1, 'Section names cannot be empty.').max(LIMITS.sectionNameLength, `Section names can be at most ${LIMITS.sectionNameLength} characters.`),
  z.array(NoteItemSchema).min(1, 'Each section needs at least one item.').max(LIMITS.itemsPerSection, `Each section can have at most ${LIMITS.itemsPerSection} items.`),
).refine((n) => Object.keys(n).length <= LIMITS.sections, `At most ${LIMITS.sections} note sections are allowed.`);

// ---------- stored / returned shapes ----------
export const StudioReleaseSchema = z.object({
  version: z.string(),
  major: z.number().int(),
  minor: z.number().int(),
  patch: z.number().int(),
  line: z.string(),
  type: ReleaseTypeSchema.nullable(),
  date: z.string(),
  mac: z.boolean(),
  notes: z.record(z.string(), z.array(z.string())),
});
export type StudioRelease = z.infer<typeof StudioReleaseSchema>;

export const ReleaseListItemSchema = StudioReleaseSchema.omit({ notes: true });
export type ReleaseListItem = z.infer<typeof ReleaseListItemSchema>;

export const ReleaseListSchema = z.object({
  items: z.array(ReleaseListItemSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type ReleaseList = z.infer<typeof ReleaseListSchema>;

export const SummarySchema = z.object({
  latest: ReleaseListItemSchema.nullable(),
  recommendedLts: ReleaseListItemSchema.nullable(),
  supportedLines: z.array(z.object({ value: z.string(), label: z.string(), type: z.enum(['LTS', 'MTS']) })),
  types: z.record(ReleaseTypeSchema, z.string()),
});
export type StudioSummary = z.infer<typeof SummarySchema>;

// ---------- request bodies (strict: derived fields like major/line are rejected) ----------
export const CreateReleaseSchema = z.strictObject({
  version: VersionSchema,
  type: ReleaseTypeSchema.nullable().default(null),
  date: DateSchema,
  mac: z.boolean().optional(),
  notes: NotesSchema.default({}),
});
export type CreateReleaseInput = z.input<typeof CreateReleaseSchema>;

export const UpdateReleaseSchema = z.strictObject({
  version: z.string().optional(), // allowed only if it matches the path
  type: ReleaseTypeSchema.nullable(),
  date: DateSchema,
  mac: z.boolean().optional(),
  notes: NotesSchema,
});
export type UpdateReleaseInput = z.input<typeof UpdateReleaseSchema>;

export const PatchReleaseSchema = z.strictObject({
  type: ReleaseTypeSchema.nullable().optional(),
  date: DateSchema.optional(),
  mac: z.boolean().optional(),
  notes: NotesSchema.optional(),
}).refine((v) => Object.keys(v).length > 0, 'Provide at least one of: type, date, mac, notes.');
export type PatchReleaseInput = z.input<typeof PatchReleaseSchema>;

export const ListQuerySchema = z.strictObject({
  q: z.string().trim().max(20).optional(),
  line: z.string().regex(/^\d+\.\d+$/, 'line must look like 11.12').optional(),
  type: z.enum([...RELEASE_TYPE_VALUES, 'none']).optional(),
  sort: z.enum(['version', 'date-asc', 'date-desc']).default('version'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});
export type ListQuery = z.input<typeof ListQuerySchema>;

// ---------- errors ----------
export interface FieldError { field: string; message: string }
export interface ApiErrorBody { error: { code: string; message: string; details?: FieldError[] } }
export const ApiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.array(z.object({ field: z.string(), message: z.string() })).optional() }),
});

/** Flattens Zod issues into `{ field, message }` with dotted paths (e.g. `notes.Fixes.2`). */
export function toFieldErrors(error: z.ZodError): FieldError[] {
  return error.issues.map((i) => ({
    field: i.path.length ? i.path.map(String).join('.') : '(body)',
    message: i.code === 'unrecognized_keys' ? `Unknown or read-only field(s): ${(i as { keys?: string[] }).keys?.join(', ')}` : i.message,
  }));
}

/** Rules that need the parsed version (shared so the client can validate before sending). */
export function macRuleError(version: string, mac: boolean | undefined): string | null {
  if (!VERSION_RE.test(version)) return null;
  return mac === true && parseVersion(version).major < 10 ? 'Mac downloads are only available for Studio 10 and later.' : null;
}
export const defaultMac = (version: string): boolean => VERSION_RE.test(version) && parseVersion(version).major >= 10;
