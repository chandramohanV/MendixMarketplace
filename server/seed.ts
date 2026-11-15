// Seed data comes from the deterministic generator that used to feed the Studio page directly.
import { RELEASES } from '../src/data/studio.js';
import type { ReleaseType, StudioRelease } from '../shared/studio';

interface GeneratedRelease {
  version: string;
  major: number;
  minor: number;
  patch: number;
  line: string;
  type: ReleaseType | null;
  date: string;
  mac: boolean;
  notes: Record<string, string[]>;
}

export function buildSeed(): StudioRelease[] {
  return (RELEASES as GeneratedRelease[]).map((r) => ({
    version: r.version,
    major: r.major,
    minor: r.minor,
    patch: r.patch,
    line: r.line,
    type: r.type,
    date: r.date,
    mac: r.mac,
    notes: structuredClone(r.notes),
  }));
}
