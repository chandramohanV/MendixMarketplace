/** First letters of the first two words, e.g. "Helix Systems" → "HS". Used for avatar placeholders. */
export function initials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2);
}
