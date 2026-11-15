// Every localStorage key the app uses. Changing a value orphans data users already have saved.
export const STORAGE_KEYS = {
  favorites: 'mp.favorites',
  reviews: 'mp.reviews',
  downloads: 'mp.downloads',
  submissions: 'mp.submissions',
  submitDraft: 'mp.submitDraft',
  /** Demo/test knob: overrides the auto-publish delay (see demoSettings.ts). */
  autoPublishMs: 'mp.autoPublishMs',
} as const;
