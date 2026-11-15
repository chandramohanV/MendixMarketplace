import { Link } from 'react-router-dom';
import { Icon } from '../../components/icons';
import { ComponentCard } from '../../components/ComponentCard';
import { Pagination } from '../../components/Pagination';
import { routes } from '../../lib/routes';
import type { Component } from '../../types';
import { SORTS, type ExploreSection, type FilterChip, type SortKey } from './filters';

/** The default view: Studio promo plus curated rows. */
export function ExploreHome({ sections, onOpenFilters }: { sections: ExploreSection[]; onOpenFilters: () => void }) {
  return (
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
        <button className="btn btn-secondary filters-toggle" onClick={onOpenFilters}>
          <Icon name="filter" /> Filters
        </button>
      </div>
      {sections.map((section) => (
        <section key={section.title} className="section">
          <div className="section-head">
            <h2>{section.title}</h2>
            <Link to={section.link} className="text-btn">
              View All
            </Link>
          </div>
          <div className="card-grid">
            {section.items.map((c) => (
              <ComponentCard key={c.id} c={c} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

/** Shown once any filter is active (or via "View All"): chips, result count, sort, grid and pages. */
export function ExploreResults({
  chips,
  total,
  pageItems,
  page,
  pages,
  sort,
  onRemoveChip,
  onClearAll,
  onSortChange,
  onPageChange,
  onOpenFilters,
}: {
  chips: FilterChip[];
  total: number;
  pageItems: Component[];
  page: number;
  pages: number;
  sort: SortKey;
  onRemoveChip: (chip: FilterChip) => void;
  onClearAll: () => void;
  onSortChange: (sort: string) => void;
  onPageChange: (page: number) => void;
  onOpenFilters: () => void;
}) {
  return (
    <>
      <div className="filtered-by">
        <span className="filtered-label">Filtered by:</span>
        {chips.map((chip, i) => (
          <button
            key={i}
            className="chip"
            onClick={() => onRemoveChip(chip)}
            aria-label={`Remove filter ${chip.label}`}
          >
            {chip.label} <Icon name="close" size={10} />
          </button>
        ))}
        {chips.length > 0 && (
          <button className="text-btn link" onClick={onClearAll}>
            Clear all
          </button>
        )}
        {chips.length === 0 && <span className="muted">All components</span>}
      </div>
      <div className="results-head">
        <h2>{total} Results Found</h2>
        <div className="results-tools">
          <button className="btn btn-secondary filters-toggle" onClick={onOpenFilters}>
            <Icon name="filter" /> Filters
          </button>
          <label className="sort">
            <span>Sort by</span>
            <select value={sort} onChange={(e) => onSortChange(e.target.value)}>
              {Object.entries(SORTS).map(([key, s]) => (
                <option key={key} value={key}>
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
          <button className="btn btn-primary" onClick={onClearAll}>
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
      <Pagination page={page} pages={pages} onChange={onPageChange} />
    </>
  );
}
