import { useState } from 'react';
import { Icon } from '../../components/icons';
import { Stars } from '../../components/Stars';
import { CATEGORIES, INDUSTRIES, PLATFORM_VERSIONS, SUPPORT, TYPES } from '../../data/components';
import { ratingLabel, type ExploreFilters, type MultiFilterKey } from './filters';

const SUPPORT_FILTERS = SUPPORT.filter((s) => s !== 'Deprecated');
const RATING_OPTIONS = [5, 4, 3];

function CheckGroup({
  title,
  name,
  options,
  selected,
  onToggle,
  initiallyVisible,
}: {
  title: string;
  name: MultiFilterKey;
  options: string[];
  selected: string[];
  onToggle: (name: MultiFilterKey, value: string) => void;
  /** Show only this many options until "Show More" is clicked. */
  initiallyVisible?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = initiallyVisible && !showAll ? options.slice(0, initiallyVisible) : options;
  return (
    <fieldset className="fgroup">
      <legend>{title}</legend>
      {visible.map((option) => (
        <label key={option} className="check">
          <input type="checkbox" checked={selected.includes(option)} onChange={() => onToggle(name, option)} />
          <span>{option}</span>
        </label>
      ))}
      {initiallyVisible && options.length > initiallyVisible && (
        <button className="show-more" onClick={() => setShowAll((v) => !v)}>
          <Icon name="chevronDown" className={showAll ? 'flip' : ''} /> {showAll ? 'Show Less' : 'Show More'}
        </button>
      )}
    </fieldset>
  );
}

/** Filter sidebar (a slide-in drawer on small screens). */
export function FiltersPanel({
  filters,
  isOpen,
  onClose,
  onToggle,
  onSet,
}: {
  filters: ExploreFilters;
  isOpen: boolean;
  onClose: () => void;
  onToggle: (name: MultiFilterKey, value: string) => void;
  onSet: (name: 'version' | 'rating', value: string) => void;
}) {
  return (
    <aside className={`filters ${isOpen ? 'open' : ''}`} aria-label="Filters">
      <div className="filters-head">
        <h2>Filters</h2>
        <button className="icon-btn close-filters" onClick={onClose} aria-label="Close filters">
          <Icon name="close" />
        </button>
      </div>
      <fieldset className="fgroup">
        <legend>Compatibility</legend>
        <select
          value={filters.version}
          onChange={(e) => onSet('version', e.target.value)}
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
      <CheckGroup title="Content Type" name="type" options={TYPES} selected={filters.type} onToggle={onToggle} />
      <CheckGroup
        title="Support"
        name="support"
        options={SUPPORT_FILTERS}
        selected={filters.support}
        onToggle={onToggle}
      />
      <CheckGroup
        title="Category"
        name="category"
        options={CATEGORIES}
        selected={filters.category}
        onToggle={onToggle}
        initiallyVisible={5}
      />
      <CheckGroup
        title="Industry"
        name="industry"
        options={INDUSTRIES}
        selected={filters.industry}
        onToggle={onToggle}
      />
      <fieldset className="fgroup">
        <legend>Rating</legend>
        {RATING_OPTIONS.map((stars) => (
          <label key={stars} className={`rating-opt ${filters.rating === stars ? 'on' : ''}`}>
            {/* onClick (not onChange) so clicking the selected rating again clears it. */}
            <input
              type="radio"
              name="rating"
              checked={filters.rating === stars}
              onChange={() => {}}
              onClick={() => onSet('rating', filters.rating === stars ? '' : String(stars))}
            />
            <Stars value={stars} /> <span>{ratingLabel(stars)}</span>
          </label>
        ))}
      </fieldset>
    </aside>
  );
}
