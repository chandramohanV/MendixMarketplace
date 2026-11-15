/** FNV-1a 32-bit hash: a fast, stable string hash for picking deterministic dummy values. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (const ch of s) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
