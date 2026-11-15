// Deterministic dummy release history; the Studio API seeds its data file from RELEASES.
import { compareVersionsDesc, type ReleaseType, type StudioRelease } from '../../shared/studio';
import { hashString } from '../lib/hash';

type SupportType = Extract<ReleaseType, 'LTS' | 'MTS'>;
type ReleaseNotes = StudioRelease['notes'];

/** Supported lines: [major, minor, support type, number of patch releases]. */
const LINES: [major: number, minor: number, type: SupportType, patches: number][] = [
  [11, 12, 'LTS', 8],
  [11, 6, 'MTS', 5],
  [10, 24, 'LTS', 16],
  [10, 18, 'MTS', 7],
  [10, 12, 'MTS', 10],
  [10, 6, 'MTS', 9],
  [9, 24, 'LTS', 41],
  [9, 18, 'MTS', 6],
  [9, 12, 'MTS', 5],
  [9, 6, 'MTS', 11],
];
const MAJORS: Record<number, { minors: number; start: string }> = {
  9: { minors: 24, start: '2021-06-01' },
  10: { minors: 24, start: '2023-06-01' },
  11: { minors: 16, start: '2025-06-03' },
};
const TODAY = '2026-11-14';

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const NOTE_POOL = {
  'New Features': [
    'Blox Assist can now generate page layouts from a short description.',
    'Added a visual diff view when merging branches.',
    'Workflow editor supports parallel splits with timeouts.',
    'New data grid column templates for faster page building.',
    'Improved IntelliSense for expressions with inline documentation.',
    'You can now pin frequently used documents in the App Explorer.',
  ],
  Improvements: [
    'Opening large apps is up to 30% faster.',
    'Reduced memory usage of the domain model editor.',
    'Error pane groups related consistency errors.',
    'Improved keyboard navigation in property dialogs.',
  ],
  Fixes: [
    'Fixed an issue where undo did not restore deleted microflow parameters.',
    'Fixed a crash when renaming a module with open documents.',
    'Fixed incorrect validation of nested XPath constraints.',
    'Fixed an issue where the local runtime failed to start on some proxies.',
    'Fixed layout glitches in the toolbox at high DPI scaling.',
  ],
};

function notesFor(version: string, patch: number): ReleaseNotes {
  const h = hashString(version);
  const take = (pool: string[], n: number, offset: number) =>
    Array.from({ length: n }, (_, i) => pool[(h + offset + i * 7) % pool.length]).filter(
      (v, i, all) => all.indexOf(v) === i,
    );
  if (patch > 0) {
    return { Fixes: take(NOTE_POOL.Fixes, 2 + (h % 2), 0), Improvements: take(NOTE_POOL.Improvements, 1, 3) };
  }
  return {
    'New Features': take(NOTE_POOL['New Features'], 2 + (h % 2), 1),
    Improvements: take(NOTE_POOL.Improvements, 2, 5),
    Fixes: take(NOTE_POOL.Fixes, 2, 2),
  };
}

function release(major: number, minor: number, patch: number, date: string, type: ReleaseType | null): StudioRelease {
  const version = `${major}.${minor}.${patch}`;
  return {
    version,
    major,
    minor,
    patch,
    type,
    date,
    line: `${major}.${minor}`,
    mac: major >= 10,
    notes: notesFor(version, patch),
  };
}

function build(): StudioRelease[] {
  const byVersion = new Map<string, StudioRelease>();
  const add = (r: StudioRelease) => byVersion.set(r.version, r);

  // One x.y.0 release per month for each major version.
  for (const [major, { minors, start }] of Object.entries(MAJORS)) {
    for (let minor = 0; minor <= minors; minor++)
      add(release(Number(major), minor, 0, addDays(start, minor * 30), null));
  }
  // Supported lines get their type and a train of patch releases.
  for (const [major, minor, type, patches] of LINES) {
    const base = byVersion.get(`${major}.${minor}.0`);
    if (!base) throw new Error(`Missing base release ${major}.${minor}.0`);
    base.type = type;
    const ltsGap = major === 9 ? 26 : 30;
    const gap = type === 'LTS' ? ltsGap : 24;
    for (let p = 1; p < patches; p++) add(release(major, minor, p, addDays(base.date, p * gap + ((p * 7) % 9)), type));
  }

  const list = [...byVersion.values()].filter((r) => r.date <= TODAY);
  list.push({ ...release(11, 17, 0, '2026-11-12', 'BETA'), notes: notesFor('11.17.0', 0) });
  list.sort(compareVersionsDesc);

  // The latest GA gets a patch so it reads like a real release train.
  const latest = list.find((r) => r.type !== 'BETA' && r.minor === 16 && r.major === 11);
  if (!latest) throw new Error('Missing 11.16.0');
  const patchRelease: StudioRelease = {
    ...latest,
    version: '11.16.1',
    patch: 1,
    date: '2026-11-03',
    type: 'LATEST',
    notes: notesFor('11.16.1', 1),
  };
  list.splice(list.indexOf(latest), 0, patchRelease);
  return list;
}

export const RELEASES: StudioRelease[] = build();
