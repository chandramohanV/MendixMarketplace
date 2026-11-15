// Dummy release history for the Studio download page (deterministic).

export const RELEASE_TYPES = {
  LTS: 'Long-Term Support (LTS) is maintained with supported updates until a third consecutive major version is released. For example, support on Studio 10.24 ends with the GA release of Studio 13.',
  MTS: 'Medium-Term Support (MTS) provides support for 6~18 months. Suitable for a balance of new features and support.',
  LATEST: 'Most recent release.',
  BETA: 'Beta gives you early access to new features. Not recommended for production use.',
};

// Support lines: [major, minor, type, patch count]
const LINES = [
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
const MAJORS = {
  9: { minors: 24, start: '2021-06-01' },
  10: { minors: 24, start: '2023-06-01' },
  11: { minors: 16, start: '2025-06-03' },
};
const TODAY = new Date('2026-11-14T00:00:00Z');

function addDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z');
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

function hash(s) {
  let h = 2166136261;
  for (const ch of s) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function notesFor(version, patch) {
  const h = hash(version);
  const take = (arr, n, off) =>
    Array.from({ length: n }, (_, i) => arr[(h + off + i * 7) % arr.length]).filter((v, i, a) => a.indexOf(v) === i);
  if (patch > 0)
    return { Fixes: take(NOTE_POOL.Fixes, 2 + (h % 2), 0), Improvements: take(NOTE_POOL.Improvements, 1, 3) };
  return {
    'New Features': take(NOTE_POOL['New Features'], 2 + (h % 2), 1),
    Improvements: take(NOTE_POOL.Improvements, 2, 5),
    Fixes: take(NOTE_POOL.Fixes, 2, 2),
  };
}

function build() {
  const map = new Map();
  const add = (major, minor, patch, date, type) => {
    const version = `${major}.${minor}.${patch}`;
    map.set(version, {
      version,
      major,
      minor,
      patch,
      type,
      date,
      line: `${major}.${minor}`,
      mac: major >= 10,
      notes: notesFor(version, patch),
    });
  };
  for (const [major, { minors, start }] of Object.entries(MAJORS)) {
    for (let minor = 0; minor <= minors; minor++) add(Number(major), minor, 0, addDays(start, minor * 30), null);
  }
  for (const [major, minor, type, count] of LINES) {
    const base = map.get(`${major}.${minor}.0`);
    base.type = type;
    const gap = type === 'LTS' ? (major === 9 ? 26 : 30) : 24;
    for (let p = 1; p < count; p++) add(major, minor, p, addDays(base.date, p * gap + ((p * 7) % 9)), type);
  }
  const list = [...map.values()].filter((r) => r.date <= TODAY.toISOString().slice(0, 10));
  list.push({
    version: '11.17.0',
    major: 11,
    minor: 17,
    patch: 0,
    type: 'BETA',
    date: '2026-11-12',
    line: '11.17',
    mac: true,
    notes: notesFor('11.17.0', 0),
  });
  list.sort(compareVersionsDesc);
  const latest = list.find((r) => r.type !== 'BETA' && r.minor === 16 && r.major === 11);
  // Latest GA gets a patch so it reads like a real release train.
  const patchRelease = {
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

export function compareVersionsDesc(a, b) {
  return b.major - a.major || b.minor - a.minor || b.patch - a.patch;
}

export const RELEASES = build();
export const LATEST = RELEASES.find((r) => r.type === 'LATEST');
export const RECOMMENDED_LTS = RELEASES.filter((r) => r.type === 'LTS').toSorted(compareVersionsDesc)[0];
export const SUPPORTED_LINES = LINES.map(([ma, mi, type]) => ({
  value: `${ma}.${mi}`,
  label: `${ma}.${mi} (${type})`,
}));
export const monthYear = (iso) =>
  new Date(iso + 'T00:00:00Z')
    .toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
    .replace(' ', ', ');
export const longDate = (iso) =>
  new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', {
    month: 'long',
    day: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
