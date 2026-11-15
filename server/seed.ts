// Seed data comes from the deterministic generator that used to feed the Studio page directly.
import type { StudioRelease } from '../shared/studio';
import { RELEASES } from '../src/data/studio';

export function buildSeed(): StudioRelease[] {
  return RELEASES.map((r) => ({
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
