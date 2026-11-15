import { pageButtons } from '../lib/pagination';
import { Icon } from './icons';

export function Pagination({
  page,
  pages,
  onChange,
}: {
  page: number;
  pages: number;
  onChange: (page: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Pagination">
      <button disabled={page === 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
        <Icon name="chevronLeft" />
      </button>
      {pageButtons(page, pages).map((n, i) =>
        n === '…' ? (
          <span key={`e${i}`} className="ellipsis">
            …
          </span>
        ) : (
          <button
            key={n}
            className={n === page ? 'active' : ''}
            onClick={() => onChange(n)}
            aria-current={n === page ? 'page' : undefined}
          >
            {n}
          </button>
        ),
      )}
      <button disabled={page === pages} onClick={() => onChange(page + 1)} aria-label="Next page">
        <Icon name="chevronRight" />
      </button>
    </nav>
  );
}
