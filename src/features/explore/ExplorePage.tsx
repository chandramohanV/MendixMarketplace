import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { TYPES, CATEGORIES, SUPPORT, PLATFORM_VERSIONS, INDUSTRIES } from '../../data/components';
import { useCatalog } from '../../catalog';
import { ComponentCard, Pagination, Stars } from '../../components/ui';
import { HeroArt, Icon } from '../../components/icons';
import type { Component } from '../../types';
import { routes } from '../../lib/routes';

const PAGE_SIZE = 18;
const MULTI = ['type', 'category', 'support', 'industry', 'publisher'] as const;
type MultiKey = (typeof MULTI)[number];
const SUPPORT_FILTERS = SUPPORT.filter((s) => s !== 'Deprecated');

type SortKey = 'relevance' | 'rating' | 'updated' | 'newest' | 'az';
const SORTS: Record<SortKey, { label: string; fn: (a: Component, b: Component) => number }> = {
  relevance: { label: 'Most popular', fn: (a, b) => b.downloads - a.downloads },
  rating: { label: 'Highest rated', fn: (a, b) => b.rating - a.rating || b.ratingCount - a.ratingCount },
  updated: { label: 'Recently updated', fn: (a, b) => b.updated.localeCompare(a.updated) },
  newest: { label: 'Newest', fn: (a, b) => b.created.localeCompare(a.created) },
  az: { label: 'Name (A–Z)', fn: (a, b) => a.name.localeCompare(b.name) },
};
const isSortKey = (v: string): v is SortKey => v in SORTS;

interface Filters extends Record<MultiKey, string[]> {
  q: string;
  version: string;
  rating: number;
  sort: SortKey;
  page: number;
  view: string;
}

function matches(c: Component, f: Filters): boolean {
  if (f.q) {
    const hay = `${c.name} ${c.short} ${c.publisher} ${c.category} ${c.type} ${c.tags.join(' ')}`.toLowerCase();
    if (
      !f.q
        .toLowerCase()
        .split(/\s+/)
        .every((w) => hay.includes(w))
    )
      return false;
  }
  for (const key of MULTI) if (f[key].length && !f[key].includes(c[key])) return false;
  if (f.version && !c.compatible.includes(f.version)) return false;
  if (f.rating && (c.ratingCount === 0 || c.rating < f.rating)) return false;
  return true;
}

function CheckGroup({
  title,
  name,
  options,
  selected,
  onToggle,
  initial,
}: {
  title: string;
  name: MultiKey;
  options: string[];
  selected: string[];
  onToggle: (name: MultiKey, value: string) => void;
  initial?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = initial && !showAll ? options.slice(0, initial) : options;
  return (
    <fieldset className="fgroup">
      <legend>{title}</legend>
      {visible.map((opt) => (
        <label key={opt} className="check">
          <input type="checkbox" checked={selected.includes(opt)} onChange={() => onToggle(name, opt)} />
          <span>{opt}</span>
        </label>
      ))}
      {initial && options.length > initial && (
        <button className="show-more" onClick={() => setShowAll((v) => !v)}>
          <Icon name="chevronDown" className={showAll ? 'flip' : ''} /> {showAll ? 'Show Less' : 'Show More'}
        </button>
      )}
    </fieldset>
  );
}

function Section({ title, link, items }: { title: string; link: string; items: Component[] }) {
  return (
    <section className="section">
      <div className="section-head">
        <h2>{title}</h2>
        <Link to={link} className="text-btn">
          View All
        </Link>
      </div>
      <div className="card-grid">
        {items.map((c) => (
          <ComponentCard key={c.id} c={c} />
        ))}
      </div>
    </section>
  );
}

export default function ExplorePage() {
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { components } = useCatalog();

  const sortParam = params.get('sort') || 'relevance';
  const f: Filters = {
    q: params.get('q') || '',
    version: params.get('version') || '',
    rating: Number(params.get('rating') || 0),
    sort: isSortKey(sortParam) ? sortParam : 'relevance',
    page: Number(params.get('page') || 1),
    view: params.get('view') || '',
    type: params.getAll('type'),
    category: params.getAll('category'),
    support: params.getAll('support'),
    industry: params.getAll('industry'),
    publisher: params.getAll('publisher'),
  };

  const update = (mutator: (p: URLSearchParams) => void, keepPage = false) => {
    const next = new URLSearchParams(params);
    mutator(next);
    if (!keepPage) next.delete('page');
    setParams(next);
  };
  const toggle = (name: MultiKey, value: string) =>
    update((p) => {
      const vals = p.getAll(name);
      p.delete(name);
      (vals.includes(value) ? vals.filter((v) => v !== value) : [...vals, value]).forEach((v) => p.append(name, v));
    });
  const setOne = (name: string, value: string) => update((p) => (value ? p.set(name, value) : p.delete(name)));
  const clearAll = () => setParams(new URLSearchParams());

  const chips: { label: string; remove: () => void }[] = [];
  if (f.q) chips.push({ label: `"${f.q}"`, remove: () => setOne('q', '') });
  MULTI.forEach((k) => f[k].forEach((v) => chips.push({ label: v, remove: () => toggle(k, v) })));
  if (f.version) chips.push({ label: `Studio ${f.version}`, remove: () => setOne('version', '') });
  if (f.rating)
    chips.push({ label: f.rating === 5 ? '5 stars' : `${f.rating}+ stars`, remove: () => setOne('rating', '') });
  const isFiltering = chips.length > 0 || f.view === 'all';

  const results = useMemo(
    () => components.filter((c) => matches(c, f)).toSorted(SORTS[f.sort].fn),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params, components],
  );

  const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const page = Math.min(f.page, pages);
  const pageItems = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const sections = useMemo(() => {
    const live = components.filter((c) => c.support !== 'Deprecated');
    const top = (list: Component[], fn: (a: Component, b: Component) => number) => list.toSorted(fn).slice(0, 3);
    return [
      {
        title: 'Smarter with AI',
        link: routes.explore({ category: 'Artificial Intelligence' }),
        items: top(
          live.filter((c) => ['Artificial Intelligence', 'Agents'].includes(c.category)),
          (a, b) => b.downloads - a.downloads,
        ),
      },
      {
        title: 'From our Partners',
        link: routes.explore({ support: 'Partner' }),
        items: top(
          live.filter((c) => c.support === 'Partner'),
          (a, b) => b.rating - a.rating,
        ),
      },
      {
        title: "What's New",
        link: routes.explore({ view: 'all', sort: 'newest' }),
        items: top(live, (a, b) => b.created.localeCompare(a.created) || b.id - a.id),
      },
      {
        title: 'Most Downloaded',
        link: routes.explore({ view: 'all', sort: 'relevance' }),
        items: top(live, (a, b) => b.downloads - a.downloads),
      },
    ];
  }, [components]);

  return (
    <div className="explore">
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-text">
            <h1>Explore BloxMarket</h1>
            <p>Find components to help you build software faster.</p>
            <form
              className="hero-search"
              onSubmit={(e) => {
                e.preventDefault();
                setOne('q', String(new FormData(e.currentTarget).get('q') ?? '').trim());
              }}
            >
              <input
                name="q"
                defaultValue={f.q}
                key={f.q}
                placeholder="Search by component or company"
                aria-label="Search by component or company"
              />
              <button type="submit" aria-label="Search">
                <Icon name="search" />
              </button>
            </form>
          </div>
          <HeroArt />
        </div>
      </section>

      <div className="explore-body">
        <div className="explore-main">
          {isFiltering ? (
            <>
              <div className="filtered-by">
                <span className="filtered-label">Filtered by:</span>
                {chips.map((c, i) => (
                  <button key={i} className="chip" onClick={c.remove} aria-label={`Remove filter ${c.label}`}>
                    {c.label} <Icon name="close" size={10} />
                  </button>
                ))}
                {chips.length > 0 && (
                  <button className="text-btn link" onClick={clearAll}>
                    Clear all
                  </button>
                )}
                {chips.length === 0 && <span className="muted">All components</span>}
              </div>
              <div className="results-head">
                <h2>{results.length} Results Found</h2>
                <div className="results-tools">
                  <button className="btn btn-secondary filters-toggle" onClick={() => setFiltersOpen(true)}>
                    <Icon name="filter" /> Filters
                  </button>
                  <label className="sort">
                    <span>Sort by</span>
                    <select value={f.sort} onChange={(e) => setOne('sort', e.target.value)}>
                      {Object.entries(SORTS).map(([k, s]) => (
                        <option key={k} value={k}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
              {pageItems.length === 0 ? (
                <div className="empty">
                  <h3>No results found</h3>
                  <p className="muted">Try removing some filters or using different keywords.</p>
                  <button className="btn btn-primary" onClick={clearAll}>
                    Clear all filters
                  </button>
                </div>
              ) : (
                <div className="card-grid">
                  {pageItems.map((c) => (
                    <ComponentCard key={c.id} c={c} />
                  ))}
                </div>
              )}
              <Pagination
                page={page}
                pages={pages}
                onChange={(n) => {
                  update((p) => p.set('page', String(n)), true);
                  document.querySelector('.main-scroll')?.scrollTo({ top: 300, behavior: 'smooth' });
                }}
              />
            </>
          ) : (
            <>
              <div className="promo">
                <span className="studio-mark lg">bx</span>
                <div className="promo-text">
                  <h2>Scale with Studio</h2>
                  <p>Boost up the development process using reusable components.</p>
                </div>
                <Link to={routes.studio} className="btn btn-primary">
                  Download Studio
                </Link>
                <button className="btn btn-secondary filters-toggle" onClick={() => setFiltersOpen(true)}>
                  <Icon name="filter" /> Filters
                </button>
              </div>
              {sections.map((s) => (
                <Section key={s.title} {...s} />
              ))}
            </>
          )}
        </div>

        <aside className={`filters ${filtersOpen ? 'open' : ''}`} aria-label="Filters">
          <div className="filters-head">
            <h2>Filters</h2>
            <button className="icon-btn close-filters" onClick={() => setFiltersOpen(false)} aria-label="Close filters">
              <Icon name="close" />
            </button>
          </div>
          <fieldset className="fgroup">
            <legend>Compatibility</legend>
            <select
              value={f.version}
              onChange={(e) => setOne('version', e.target.value)}
              aria-label="Compatible Studio version"
            >
              <option value="">Select Version</option>
              {PLATFORM_VERSIONS.map((v) => (
                <option key={v} value={v}>
                  Studio {v}
                </option>
              ))}
            </select>
          </fieldset>
          <CheckGroup title="Content Type" name="type" options={TYPES} selected={f.type} onToggle={toggle} />
          <CheckGroup title="Support" name="support" options={SUPPORT_FILTERS} selected={f.support} onToggle={toggle} />
          <CheckGroup
            title="Category"
            name="category"
            options={CATEGORIES}
            selected={f.category}
            onToggle={toggle}
            initial={5}
          />
          <CheckGroup title="Industry" name="industry" options={INDUSTRIES} selected={f.industry} onToggle={toggle} />
          <fieldset className="fgroup">
            <legend>Rating</legend>
            {[5, 4, 3].map((r) => (
              <label key={r} className={`rating-opt ${f.rating === r ? 'on' : ''}`}>
                <input
                  type="radio"
                  name="rating"
                  checked={f.rating === r}
                  onChange={() => {}}
                  onClick={() => setOne('rating', f.rating === r ? '' : String(r))}
                />
                <Stars value={r} /> <span>{r === 5 ? '5 stars' : `${r}+ stars`}</span>
              </label>
            ))}
          </fieldset>
        </aside>
        {filtersOpen && (
          <div className="backdrop" role="presentation" aria-hidden="true" onClick={() => setFiltersOpen(false)} />
        )}
      </div>
    </div>
  );
}
