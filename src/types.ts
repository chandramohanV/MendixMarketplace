// Shared domain types for the marketplace.

export type ComponentType = 'Module' | 'Widget' | 'Service' | 'Solution' | 'Sample' | 'Starter App' | 'Industry Template';
export type SupportLevel = 'Platform' | 'Partner' | 'Community' | 'Deprecated';
export type LicenseModel = 'Free' | 'Paid' | 'Free trial';
export type SubmissionStatus = 'pending' | 'published' | 'rejected';

export interface Release {
  version: string;
  date: string; // YYYY-MM-DD
  minPlatform: string;
  notes: string[];
}

export interface Review {
  author: string;
  stars: number;
  title: string;
  body: string;
  date: string; // YYYY-MM-DD
  helpful: number;
  mine?: boolean;
}

export interface Publisher {
  name: string;
  verified: boolean;
  country: string;
}

export interface Component {
  id: number;
  slug: string;
  name: string;
  type: ComponentType;
  category: string;
  industry: string;
  publisher: string;
  publisherVerified: boolean;
  publisherCountry: string;
  support: SupportLevel;
  license: LicenseModel;
  licenseType: string;
  price: number;
  rating: number;
  ratingCount: number;
  downloads: number;
  version: string;
  minPlatform: string;
  compatible: string[];
  updated: string;
  created: string;
  color: string;
  icon: string;
  featured: boolean;
  tags: string[];
  short: string;
  /** Long description; only set for user-submitted components. */
  description?: string;
  features: string[];
  releases: Release[];
  reviews: Review[];
  repo: string | null;
  /** Set for components that came from a user submission. */
  status?: SubmissionStatus;
}

export interface PackageFile {
  name: string;
  size: number; // bytes — the file contents are never stored
}

/** Everything the submit form collects. */
export interface SubmissionInput {
  name: string;
  type: ComponentType;
  category: string;
  short: string;
  version: string;
  minPlatform: string;
  file: PackageFile | null;
  license: string;
  repo: string;
  description: string;
}

export interface Submission extends SubmissionInput {
  id: number;
  slug: string;
  status: SubmissionStatus;
  submittedAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  /** ISO timestamp when the demo reviewer auto-publishes a pending submission. */
  publishAt: string | null;
}

export interface DownloadRecord {
  id: number;
  version: string;
  date: string; // ISO timestamp
}
