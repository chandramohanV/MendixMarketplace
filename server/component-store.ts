// Component store: the marketplace catalog that admins edit, on top of a PersistedList (see persisted-list.ts).
import { COMPONENTS, PUBLISHER_LIST, slugify } from '../src/data/components';
import { colorFor, compatibleVersions, iconFor } from '../src/lib/catalog';
import type { Component, Publisher } from '../src/types';
import type { ComponentInput } from '../shared/components';
import { todayISO } from '../shared/studio';
import { HttpError } from './http-error';
import { PersistedList, type Persistence } from './persisted-list';

const INITIAL_RELEASE_NOTE = 'Initial release.';
const ADMIN_RELEASE_NOTE = 'Version updated by an administrator.';

const notFound = (slug: string) => new HttpError(404, 'not_found', `Component ${slug} was not found.`);
const normalizeName = (name: string) => name.trim().toLowerCase();

function publisherNamed(name: string): Publisher {
  const publisher = PUBLISHER_LIST.find((p) => p.name === name);
  // The input schema only accepts known publishers, so a miss is a bug, not a user error.
  if (!publisher) throw new Error(`Unknown publisher "${name}"`);
  return publisher;
}

function assertNameIsFree(draft: Component[], name: string, exceptId?: number): void {
  const taken = draft.some((c) => c.id !== exceptId && normalizeName(c.name) === normalizeName(name));
  if (!taken) return;
  const message = `A component named “${name}” already exists.`;
  throw new HttpError(409, 'conflict', message, [{ field: 'name', message }]);
}

/** The fields that come straight from admin input (plus the publisher details derived from it). */
function editableFields(input: ComponentInput) {
  const publisher = publisherNamed(input.publisher);
  return {
    name: input.name,
    type: input.type,
    category: input.category,
    industry: input.industry,
    publisher: publisher.name,
    publisherVerified: publisher.verified,
    publisherCountry: publisher.country,
    support: input.support,
    license: input.license,
    licenseType: input.licenseType,
    price: input.price,
    version: input.version,
    minPlatform: input.minPlatform,
    compatible: compatibleVersions(input.minPlatform),
    featured: input.featured,
    tags: input.tags,
    short: input.short,
    features: input.features,
    repo: input.repo,
  };
}

export function buildComponent(input: ComponentInput, id: number, today: string): Component {
  const slug = `${id}-${slugify(input.name)}`;
  return {
    id,
    slug,
    ...editableFields(input),
    rating: 0,
    ratingCount: 0,
    downloads: 0,
    updated: today,
    created: today,
    color: colorFor(input.name),
    icon: iconFor(slug),
    releases: [{ version: input.version, date: today, minPlatform: input.minPlatform, notes: [INITIAL_RELEASE_NOTE] }],
    reviews: [],
  };
}

/** Applies admin input to an existing component. The slug never changes, so links keep working. */
export function applyInput(component: Component, input: ComponentInput, today: string): Component {
  const isNewVersion = input.version !== component.version;
  const releases = isNewVersion
    ? [
        { version: input.version, date: today, minPlatform: input.minPlatform, notes: [ADMIN_RELEASE_NOTE] },
        ...component.releases,
      ]
    : component.releases;
  return { ...component, ...editableFields(input), releases, updated: today };
}

export class ComponentStore {
  private constructor(
    private readonly data: PersistedList<Component>,
    private readonly today: () => string,
  ) {}

  /** Loads the catalog from `persistence`, seeding it with the generated components on first run. */
  static async load(persistence: Persistence<Component>, today: () => string = todayISO): Promise<ComponentStore> {
    return new ComponentStore(await PersistedList.open(persistence, () => structuredClone(COMPONENTS)), today);
  }

  get location(): string {
    return this.data.location;
  }

  list(): Component[] {
    return structuredClone([...this.data.items]);
  }

  get(slug: string): Component {
    const component = this.data.items.find((c) => c.slug === slug);
    if (!component) throw notFound(slug);
    return structuredClone(component);
  }

  create(input: ComponentInput): Promise<Component> {
    return this.data.mutate((draft) => {
      assertNameIsFree(draft, input.name);
      const nextId = Math.max(0, ...draft.map((c) => c.id)) + 1;
      const component = buildComponent(input, nextId, this.today());
      draft.push(component);
      return component;
    });
  }

  update(slug: string, input: ComponentInput): Promise<Component> {
    return this.data.mutate((draft) => {
      const index = draft.findIndex((c) => c.slug === slug);
      if (index === -1) throw notFound(slug);
      assertNameIsFree(draft, input.name, draft[index].id);
      draft[index] = applyInput(draft[index], input, this.today());
      return draft[index];
    });
  }

  remove(slug: string): Promise<void> {
    return this.data.mutate((draft) => {
      const index = draft.findIndex((c) => c.slug === slug);
      if (index === -1) throw notFound(slug);
      draft.splice(index, 1);
    });
  }
}
