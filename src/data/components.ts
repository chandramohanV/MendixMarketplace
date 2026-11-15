// Deterministic dummy data for the marketplace.
import type { Component, ComponentType, LicenseModel, Publisher, Release, Review, SupportLevel } from '../types';

function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
// Fisher–Yates: always consumes the same number of random values, so the
// generated data is identical in every JS engine (a random sort comparator is not).
const pickN = <T>(arr: readonly T[], n: number): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
};
const int = (min: number, max: number): number => Math.floor(rand() * (max - min + 1)) + min;

export const TYPES: ComponentType[] = [
  'Module',
  'Widget',
  'Service',
  'Solution',
  'Sample',
  'Starter App',
  'Industry Template',
];
export const CATEGORIES: string[] = [
  'Data',
  'Connectors',
  'Artificial Intelligence',
  'Authentication',
  'Agents',
  'Charts',
  'Communication',
  'Documents',
  'IoT',
  'Maps & Location',
  'Mobile',
  'Payments',
  'Security',
  'User Interface',
  'Utility',
  'Workflow',
];
export const SUPPORT: SupportLevel[] = ['Platform', 'Partner', 'Community', 'Deprecated'];
export const SUPPORT_INFO: Record<SupportLevel, string> = {
  Platform: 'Supported and maintained by the platform team.',
  Partner: 'Supported by a certified technology partner.',
  Community: 'Contributed and supported by the community.',
  Deprecated: 'No longer actively maintained.',
};
/** Newest first. */
export const PLATFORM_VERSIONS: string[] = ['11.5', '11.0', '10.24', '10.18', '10.12', '9.24'];
export const INDUSTRIES: string[] = [
  'Agnostic',
  'Insurance',
  'Retail',
  'Manufacturing Industries',
  'Financial Services',
  'Healthcare',
  'Public Sector',
];
export const LICENSES: LicenseModel[] = ['Free', 'Paid', 'Free trial'];
export const LICENSE_TYPES: string[] = ['Apache V2', 'MIT', 'Commercial', 'BSD', 'GPL v3'];

const PUBLISHERS: Publisher[] = [
  { name: 'Northwind Labs', verified: true, country: 'Netherlands' },
  { name: 'BlueOrbit Software', verified: true, country: 'Germany' },
  { name: 'Pixelcraft Studio', verified: false, country: 'United States' },
  { name: 'Acme Integrations', verified: true, country: 'United Kingdom' },
  { name: 'Lumen Data', verified: true, country: 'India' },
  { name: 'Quantum Widgets', verified: false, country: 'Canada' },
  { name: 'Riverbank Consulting', verified: true, country: 'Belgium' },
  { name: 'Open Source Collective', verified: false, country: 'Global' },
  { name: 'Helix Systems', verified: true, country: 'Sweden' },
  { name: 'Sunrise Apps', verified: false, country: 'Australia' },
  { name: 'Platform Team', verified: true, country: 'Netherlands' },
];

const NAME_PARTS: Record<ComponentType, string[]> = {
  Module: [
    'Excel Importer',
    'Email Connector',
    'Data Grid Export',
    'Audit Trail',
    'Encryption',
    'Community Commons',
    'SAML Single Sign-On',
    'OIDC SSO',
    'Scheduled Job Manager',
    'Deep Link',
    'PDF Generator',
    'Feedback',
    'Forgot Password',
    'Data Importer',
    'Process Queue',
    'Unit Testing',
    'Logging Toolkit',
    'Model Reflection',
    'Workflow Commons',
    'Document Templates',
  ],
  Widget: [
    'Data Grid 2',
    'Rich Text Editor',
    'Charts Pro',
    'Calendar',
    'Progress Circle',
    'Star Rating',
    'Image Crop',
    'Signature Pad',
    'Kanban Board',
    'Tree View',
    'Color Picker',
    'Timeline',
    'Badge Button',
    'Range Slider',
    'Maps',
    'Accordion',
    'Carousel',
    'QR Code Scanner',
    'Gantt Chart',
    'Drag & Drop List',
  ],
  Service: [
    'REST Consume Kit',
    'Salesforce Connector',
    'SAP OData Connector',
    'Azure Blob Storage',
    'AWS S3 Connector',
    'OpenAI Connector',
    'Snowflake Connector',
    'Kafka Connector',
    'Slack Connector',
    'Twilio SMS',
    'Stripe Payments',
    'Google Sheets',
    'Microsoft Teams',
    'MQTT Client',
    'Databricks',
    'ServiceNow Connector',
    'Jira Connector',
    'Bedrock Connector',
  ],
  Solution: ['Supplier Portal', 'Quality Inspection', 'Maintenance Planner', 'Contract Manager', 'Inventory Hub'],
  Sample: [
    'GenAI Showcase App',
    'Design Patterns Sample',
    'Workflow Showcase',
    'Mobile Showcase',
    'Data Grid Samples',
    'Agent Playground',
  ],
  'Starter App': [
    'AI Bot Starter App',
    'Agent Builder Starter App',
    'Customer Portal Starter',
    'Employee Onboarding',
    'Field Service App',
    'Asset Management',
    'Expense Tracker',
    'Incident Reporting',
  ],
  'Industry Template': [
    'Claims Processing',
    'Loan Origination',
    'Patient Intake',
    'Policy Administration',
    'Retail Store Ops',
  ],
};

const TYPE_CATEGORY: Record<ComponentType, string[]> = {
  Module: ['Utility', 'Security', 'Authentication', 'Data', 'Documents', 'Workflow'],
  Widget: ['User Interface', 'Charts', 'Maps & Location', 'Mobile'],
  Service: ['Connectors', 'Artificial Intelligence', 'Data', 'Communication', 'Payments', 'IoT', 'Agents'],
  Solution: ['Workflow', 'Documents', 'Data'],
  Sample: ['Artificial Intelligence', 'User Interface', 'Agents', 'Mobile'],
  'Starter App': ['Artificial Intelligence', 'Agents', 'Workflow', 'Mobile'],
  'Industry Template': ['Workflow', 'Documents'],
};

export const COLORS = [
  '#264ae5',
  '#0595db',
  '#3cb33d',
  '#e46b2b',
  '#a347d0',
  '#d43957',
  '#1aa59e',
  '#f2a60c',
  '#5b6aff',
  '#e2367c',
];
export const ICONS = ['◆', '▲', '●', '■', '★', '⬢', '⬣', '✦', '❖', '⚙', '⚡', '☁', '⌘', '◎'];

const FEATURE_POOL = [
  'Drag-and-drop configuration in the visual editor',
  'Works on web, native mobile and PWA',
  'Fully themeable with design tokens',
  'Supports offline-first applications',
  'Accessible (WCAG 2.1 AA) out of the box',
  'Built-in error handling and retry logic',
  'Configurable via constants for every environment',
  'Includes sample pages and microflows',
  'Lightweight, no external runtime dependencies',
  'Bulk processing for large data sets',
  'Detailed logging for troubleshooting',
  'Secure credential storage',
  'Localization support for 20+ languages',
  'Responsive across all screen sizes',
];

const REVIEWERS = [
  'Anna K.',
  'Ravi S.',
  'Jonas M.',
  'Priya R.',
  'Tom V.',
  'Lena B.',
  'Carlos D.',
  'Mei L.',
  'Oliver P.',
  'Fatima Z.',
  'Sam W.',
  'Noah H.',
];
const REVIEW_TEXT: [title: string, body: string][] = [
  ['Works great', 'Set it up in ten minutes and it just worked. Documentation is clear.'],
  ['Very useful', 'Saved us a lot of development time. Would love a few more configuration options.'],
  ['Solid component', 'Stable in production for months. Upgrades were painless.'],
  ['Good but needs updates', 'Works, but the latest platform version showed some warnings.'],
  ['Must-have', 'We use this in every project. Highly recommended.'],
  ['Decent', 'Does what it says. The sample module helped a lot.'],
  ['Had issues', 'Struggled with configuration at first; support responded quickly though.'],
  ['Excellent support', 'Publisher fixed a bug within a day of reporting it.'],
];

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function dateDaysAgo(days: number): string {
  const d = new Date('2026-11-14T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function buildComponents(): Component[] {
  const list: Component[] = [];
  let id = 1;
  for (const type of TYPES) {
    for (const baseName of NAME_PARTS[type]) {
      const publisher = type === 'Sample' || rand() < 0.18 ? PUBLISHERS[10] : pick(PUBLISHERS.slice(0, 10));
      let support: SupportLevel =
        publisher.name === 'Platform Team'
          ? 'Platform'
          : publisher.verified
            ? pick<SupportLevel>(['Partner', 'Partner', 'Community'])
            : 'Community';
      if (rand() < 0.06) support = 'Deprecated';
      const category = pick(TYPE_CATEGORY[type]);
      const license: LicenseModel =
        publisher.name === 'Platform Team'
          ? 'Free'
          : pick<LicenseModel>(['Free', 'Free', 'Free', 'Paid', 'Free trial']);
      const ratingCount = int(0, 240);
      const rating = ratingCount === 0 ? 0 : Math.round((3 + rand() * 2) * 10) / 10;
      const major = int(1, 9);
      const minor = int(0, 15);
      const patch = int(0, 9);
      const minVersion = pick(PLATFORM_VERSIONS.slice(1));
      const compatible = PLATFORM_VERSIONS.slice(0, PLATFORM_VERSIONS.indexOf(minVersion) + 1);
      const updatedDays = int(1, 700);
      const releases: Release[] = Array.from({ length: int(3, 7) }, (_, i) => ({
        version: `${major}.${Math.max(0, minor - i)}.${i === 0 ? patch : int(0, 9)}`,
        date: dateDaysAgo(updatedDays + i * int(20, 90)),
        minPlatform:
          i === 0
            ? minVersion
            : PLATFORM_VERSIONS[
                Math.min(PLATFORM_VERSIONS.length - 1, PLATFORM_VERSIONS.indexOf(minVersion) + Math.floor(i / 2))
              ],
        notes: pickN(
          [
            'Fixed an issue where the component failed to load in certain browsers.',
            'Added support for the latest platform version.',
            'Improved performance for large data sets.',
            'Updated third-party libraries to address security advisories.',
            'Added new configuration options.',
            'Improved accessibility labels.',
            'Fixed layout issues on small screens.',
            'Initial release.',
          ],
          int(1, 3),
        ),
      }));
      const reviews: Review[] = Array.from({ length: Math.min(ratingCount, int(2, 6)) }, () => {
        const [title, body] = pick(REVIEW_TEXT);
        return {
          author: pick(REVIEWERS),
          stars: Math.max(1, Math.min(5, Math.round(rating + (rand() - 0.5) * 2))),
          title,
          body,
          date: dateDaysAgo(int(1, 500)),
          helpful: int(0, 40),
        };
      });
      const name = baseName;
      list.push({
        id: id,
        slug: `${id}-${slugify(name)}`,
        name,
        type,
        category,
        industry: rand() < 0.65 ? 'Agnostic' : pick(INDUSTRIES.slice(1)),
        publisher: publisher.name,
        publisherVerified: publisher.verified,
        publisherCountry: publisher.country,
        support,
        license,
        licenseType: license === 'Free' ? pick(LICENSE_TYPES.filter((l) => l !== 'Commercial')) : 'Commercial',
        price: license === 'Paid' ? int(5, 60) * 10 : license === 'Free trial' ? int(10, 40) * 10 : 0,
        rating,
        ratingCount,
        downloads: Math.floor(Math.pow(rand(), 2) * 120000) + int(50, 900),
        version: releases[0].version,
        minPlatform: minVersion,
        compatible,
        updated: releases[0].date,
        created: dateDaysAgo(updatedDays + int(200, 1400)),
        color: pick(COLORS),
        icon: pick(ICONS),
        featured: rand() < 0.12,
        tags: pickN(
          [
            'open source',
            'low-code',
            'enterprise',
            'mobile',
            'web',
            'native',
            'ai',
            'data',
            'security',
            'ux',
            'cloud',
            'api',
          ],
          int(2, 4),
        ),
        short: shortDescription(type, name, category),
        features: pickN(FEATURE_POOL, int(4, 6)),
        releases,
        reviews,
        repo: rand() < 0.5 ? `https://github.com/example/${slugify(name)}` : null,
      });
      id++;
    }
  }
  return list;
}

function shortDescription(type: ComponentType, name: string, category: string): string {
  const templates: Record<ComponentType, string> = {
    Module: `A reusable module that adds ${name.toLowerCase()} capabilities to your app with minimal setup.`,
    Widget: `A pluggable ${category.toLowerCase()} widget: drop ${name} on a page and configure it visually.`,
    Service: `Connect your app to external services in minutes with the ${name}.`,
    Solution: `A complete, adaptable ${name.toLowerCase()} solution you can extend to fit your processes.`,
    Sample: `Explore working examples and best practices in the ${name}.`,
    'Starter App': `A ready-to-run starter application to jump-start your ${name.toLowerCase()} project.`,
    'Industry Template': `An industry template for ${name.toLowerCase()} you can adapt to your organization.`,
  };
  return templates[type];
}

export const COMPONENTS = buildComponents();
export const PUBLISHER_LIST = PUBLISHERS;

/** Looks up a catalog component only; use `useCatalog()` to include user submissions. */
export function getComponent(slug: string): Component | undefined {
  return COMPONENTS.find((c) => c.slug === slug);
}

export function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

export function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
