// Demo-only knobs. The automated tests use these to make timing deterministic.

/** Default delay before the demo reviewer auto-publishes a pending submission. */
export const AUTO_PUBLISH_MS = 5000;

/**
 * Auto-publish delay in ms. Can be overridden with
 * `localStorage.setItem('mp.autoPublishMs', '<ms>')` (used by the e2e tests).
 */
export function getAutoPublishMs(): number {
  try {
    const v = Number(localStorage.getItem('mp.autoPublishMs'));
    return Number.isFinite(v) && v > 0 ? v : AUTO_PUBLISH_MS;
  } catch {
    return AUTO_PUBLISH_MS;
  }
}
