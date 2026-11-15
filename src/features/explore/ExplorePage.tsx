import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { HeroArt, Icon } from '../../components/icons';
import { useCatalog } from '../../store/useCatalog';
import { ExploreHome, ExploreResults } from './ExploreViews';
import {
  activeFilterChips,
  buildSections,
  filterAndSort,
  PAGE_SIZE,
  parseFilters,
  type FilterChip,
  type MultiFilterKey,
} from './filters';
import { FiltersPanel } from './FiltersPanel';

export default function ExplorePage() {
  const [params, setParams] = useSearchParams();
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const { components } = useCatalog();

  const filters = useMemo(() => parseFilters(params), [params]);
  const results = useMemo(() => filterAndSort(components, filters), [components, filters]);
  const sections = useMemo(() => buildSections(components), [components]);
  const chips = activeFilterChips(filters);
  const isFiltering = chips.length > 0 || filters.view === 'all';

  const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const page = Math.min(filters.page, pages);
  const pageItems = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Every filter change resets to page 1, except paging itself.
  const updateParams = (change: (p: URLSearchParams) => void, keepPage = false) => {
    const next = new URLSearchParams(params);
    change(next);
    if (!keepPage) next.delete('page');
    setParams(next);
  };
  const toggleValue = (name: MultiFilterKey, value: string) =>
    updateParams((p) => {
      const values = p.getAll(name);
      p.delete(name);
      const nextValues = values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
      nextValues.forEach((v) => p.append(name, v));
    });
  const setValue = (name: string, value: string) => updateParams((p) => (value ? p.set(name, value) : p.delete(name)));
  const clearAll = () => setParams(new URLSearchParams());
  const removeChip = (chip: FilterChip) =>
    chip.kind === 'multi' ? toggleValue(chip.param, chip.value) : setValue(chip.param, '');
  const goToPage = (n: number) => {
    updateParams((p) => p.set('page', String(n)), true);
    document.querySelector('.main-scroll')?.scrollTo({ top: 300, behavior: 'smooth' });
  };

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
                setValue('q', String(new FormData(e.currentTarget).get('q') ?? '').trim());
              }}
            >
              <input
                name="q"
                defaultValue={filters.q}
                key={filters.q}
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
            <ExploreResults
              chips={chips}
              total={results.length}
              pageItems={pageItems}
              page={page}
              pages={pages}
              sort={filters.sort}
              onRemoveChip={removeChip}
              onClearAll={clearAll}
              onSortChange={(sort) => setValue('sort', sort)}
              onPageChange={goToPage}
              onOpenFilters={() => setIsFiltersOpen(true)}
            />
          ) : (
            <ExploreHome sections={sections} onOpenFilters={() => setIsFiltersOpen(true)} />
          )}
        </div>

        <FiltersPanel
          filters={filters}
          isOpen={isFiltersOpen}
          onClose={() => setIsFiltersOpen(false)}
          onToggle={toggleValue}
          onSet={setValue}
        />
        {isFiltersOpen && (
          <div className="backdrop" role="presentation" aria-hidden="true" onClick={() => setIsFiltersOpen(false)} />
        )}
      </div>
    </div>
  );
}
