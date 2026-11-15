// Date formatting for YYYY-MM-DD strings. Always UTC, so a date never shifts with the viewer's time zone.
const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** "Nov 3, 2026" */
export const shortDate = (iso: string): string =>
  toDate(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });

/** "November 03, 2026" */
export const longDate = (iso: string): string =>
  toDate(iso).toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric', timeZone: 'UTC' });

/** "Nov, 2026" */
export const monthYear = (iso: string): string =>
  toDate(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }).replace(' ', ', ');
