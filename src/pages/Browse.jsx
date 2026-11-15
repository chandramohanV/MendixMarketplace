import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { COMPONENTS, TYPES, CATEGORIES, SUPPORT, PLATFORM_VERSIONS, INDUSTRIES } from '../data/components';
import { ComponentCard, Pagination, Stars } from '../components/ui';
import { HeroArt, Icon } from '../components/icons';

const PAGE_SIZE = 18;
const MULTI = ['type', 'category', 'support', 'industry', 'publisher'];
const SUPPORT_FILTERS = SUPPORT.filter((s) => s !== 'Deprecated');

const SORTS = {
  relevance: { label: 'Most popular', fn: (a, b) => b.downloads - a.downloads },
  rating: { label: 'Highest rated', fn: (a, b) => b.rating - a.rating || b.ratingCount - a.ratingCount },
  updated: { label: 'Recently updated', fn: (a, b) => b.updated.localeCompare(a.updated) },
  newest: { label: 'Newest', fn: (a, b) => b.created.localeCompare(a.created) },
  az: { label: 'Name (A–Z)', fn: (a, b) => a.name.localeCompare(b.name) },
};

function matches(c, f) {
  if (f.q) {
    const hay = `${c.name} ${c.short} ${c.publisher} ${c.category} ${c.type} ${c.tags.join(' ')}`.toLowerCase();
    if (!f.q.toLowerCase().split(/\s+/).every((w) => hay.includes(w))) return false;
  }
  for (const key of MULTI) if (f[key].length && !f[key].includes(c[key])) return false;
  if (f.version && !c.compatible.includes(f.version)) return false;
  if (f.rating && (c.ratingCount === 0 || c.rating < f.rating)) return false;
  return true;
}

function CheckGroup({ title, name, options, selected, onToggle, initial }) {
  const [more, setMore] = useState(false);
  const visible = initial && !more ? options.slice(0, initial) : options;
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
        <button className="show-more" onClick={() => setMore((m) => !m)}>
          <Icon name="chevronDown" className={more ? 'flip' : ''} /> {more ? 'Show Less' : 'Show More'}
        </button>
      )}
    </fieldset>
  );
}

function Section({ title, link, items }) {
  return (
    <section className="section">
      <div className="section-head">
        <h2>{title}</h2>
        <Link to={link} className="text-btn">View All</Link>
      </div>
      <div className="card-grid">{items.map((c) => <ComponentCard key={c.id} c={c} />)}</div>
    </section>
  );
}

export default function Browse() {
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const f = {
    q: params.get('q') || '',
    version: params.get('version') || '',
    rating: Number(params.get('rating') || 0),
    sort: params.get('sort') || 'relevance',
    page: Number(params.get('page') || 1),
    view: params.get('view') || '',
  };
  MULTI.forEach((k) => { f[k] = params.getAll(k); });

  const update = (mutator, keepPage = false) => {
    const next = new URLSearchParams(params);
    mutator(next);
    if (!keepPage) next.delete('page');
    setParams(next);
  };
  const toggle = (name, value) => update((p) => {
    const vals = p.getAll(name);
    p.delete(name);
    (vals.includes(value) ? vals.filter((v) => v !== value) : [...vals, value]).forEach((v) => p.append(name, v));
  });
  const setOne = (name, value) => update((p) => (value ? p.set(name, value) : p.delete(name)));
  const clearAll = () => setParams(new URLSearchParams());

  const chips = [];
  if (f.q) chips.push({ label: `"${f.q}"`, remove: () => setOne('q', '') });
  MULTI.forEach((k) => f[k].forEach((v) => chips.push({ label: v, remove: () => toggle(k, v) })));
  if (f.version) chips.push({ label: `Studio ${f.version}`, remove: () => setOne('version', '') });
  if (f.rating) chips.push({ label: f.rating === 5 ? '5 stars' : `${f.rating}+ stars`, remove: () => setOne('rating', '') });
  const filtering = chips.length > 0 || f.view === 'all';

  const results = useMemo(() => {
    const sortFn = SORTS[f.sort]?.fn || SORTS.relevance.fn;
    return COMPONENTS.filter((c) => matches(c, f)).sort(sortFn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const page = Math.min(f.page, pages);
  const pageItems = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const sections = useMemo(() => {
    const live = COMPONENTS.filter((c) => c.support !== 'Deprecated');
    const top = (list, fn) => [...list].sort(fn).slice(0, 3);
    return [
      { title: 'Smarter with AI', link: '/components?category=Artificial+Intelligence', items: top(live.filter((c) => ['Artificial Intelligence', 'Agents'].includes(c.category)), (a, b) => b.downloads - a.downloads) },
      { title: 'From our Partners', link: '/components?support=Partner', items: top(live.filter((c) => c.support === 'Partner'), (a, b) => b.rating - a.rating) },
      { title: "What's New", link: '/components?view=all&sort=newest', items: top(live, (a, b) => b.created.localeCompare(a.created)) },
      { title: 'Most Downloaded', link: '/components?view=all&sort=relevance', items: top(live, (a, b) => b.downloads - a.downloads) },
    ];
  }, []);

  return (
    <div className="explore">
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-text">
            <h1>Explore BloxMarket</h1>
            <p>Find components to help you build software faster.</p>
            <form className="hero-search" onSubmit={(e) => { e.preventDefault(); setOne('q', new FormData(e.target).get('q').trim()); }}>
              <input name="q" defaultValue={f.q} key={f.q} placeholder="Search by component or company" aria-label="Search by component or company" />
              <button type="submit" aria-label="Search"><Icon name="search" /></button>
            </form>
          </div>
          <HeroArt />
        </div>
      </section>

      <div className="explore-body">
        <div className="explore-main">
          {filtering ? (
            <>
              <div className="filtered-by">
                <span className="filtered-label">Filtered by:</span>
                {chips.map((c, i) => (
                  <button key={i} className="chip" onClick={c.remove} aria-label={`Remove filter ${c.label}`}>{c.label} <Icon name="close" size={10} /></button>
                ))}
                {chips.length > 0 && <button className="text-btn link" onClick={clearAll}>Clear all</button>}
                {chips.length === 0 && <span className="muted">All components</span>}
              </div>
              <div className="results-head">
                <h2>{results.length} Results Found</h2>
                <div className="results-tools">
                  <button className="btn btn-secondary filters-toggle" onClick={() => setFiltersOpen(true)}><Icon name="filter" /> Filters</button>
                  <label className="sort">
                    <span>Sort by</span>
                    <select value={f.sort} onChange={(e) => setOne('sort', e.target.value)}>
                      {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
                    </select>
                  </label>
                </div>
              </div>
              {pageItems.length === 0 ? (
                <div className="empty">
                  <h3>No results found</h3>
                  <p className="muted">Try removing some filters or using different keywords.</p>
                  <button className="btn btn-primary" onClick={clearAll}>Clear all filters</button>
                </div>
              ) : (
                <div className="card-grid">{pageItems.map((c) => <ComponentCard key={c.id} c={c} />)}</div>
              )}
              <Pagination page={page} pages={pages} onChange={(n) => { update((p) => p.set('page', String(n)), true); document.querySelector('.main-scroll')?.scrollTo({ top: 300, behavior: 'smooth' }); }} />
            </>
          ) : (
            <>
              <div className="promo">
                <span className="studio-mark lg">bx</span>
                <div className="promo-text">
                  <h2>Scale with Studio</h2>
                  <p>Boost up the development process using reusable components.</p>
                </div>
                <button className="btn btn-primary" onClick={(e) => e.preventDefault()}>Download Studio</button>
                <button className="btn btn-secondary filters-toggle" onClick={() => setFiltersOpen(true)}><Icon name="filter" /> Filters</button>
              </div>
              {sections.map((s) => <Section key={s.title} {...s} />)}
            </>
          )}
        </div>

        <aside className={`filters ${filtersOpen ? 'open' : ''}`} aria-label="Filters">
          <div className="filters-head">
            <h2>Filters</h2>
            <button className="icon-btn close-filters" onClick={() => setFiltersOpen(false)} aria-label="Close filters"><Icon name="close" /></button>
          </div>
          <fieldset className="fgroup">
            <legend>Compatibility</legend>
            <select value={f.version} onChange={(e) => setOne('version', e.target.value)} aria-label="Compatible Studio version">
              <option value="">Select Version</option>
              {PLATFORM_VERSIONS.map((v) => <option key={v} value={v}>Studio {v}</option>)}
            </select>
          </fieldset>
          <CheckGroup title="Content Type" name="type" options={TYPES} selected={f.type} onToggle={toggle} />
          <CheckGroup title="Support" name="support" options={SUPPORT_FILTERS} selected={f.support} onToggle={toggle} />
          <CheckGroup title="Category" name="category" options={CATEGORIES} selected={f.category} onToggle={toggle} initial={5} />
          <CheckGroup title="Industry" name="industry" options={INDUSTRIES} selected={f.industry} onToggle={toggle} />
          <fieldset className="fgroup">
            <legend>Rating</legend>
            {[5, 4, 3].map((r) => (
              <label key={r} className={`rating-opt ${f.rating === r ? 'on' : ''}`}>
                <input type="radio" name="rating" checked={f.rating === r} onChange={() => {}} onClick={() => setOne('rating', f.rating === r ? '' : String(r))} />
                <Stars value={r} /> <span>{r === 5 ? '5 stars' : `${r}+ stars`}</span>
              </label>
            ))}
          </fieldset>
        </aside>
        {filtersOpen && <div className="backdrop" onClick={() => setFiltersOpen(false)} />}
      </div>
    </div>
  );
}
