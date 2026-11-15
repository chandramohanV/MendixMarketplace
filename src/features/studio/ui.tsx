import type { ReleaseType } from '../../../shared/studio';

export function TypeBadge({ type, lg = false }: { type: ReleaseType | null | undefined; lg?: boolean }) {
  if (!type) return null;
  return <span className={`rbadge rbadge-${type.toLowerCase()} ${lg ? 'lg' : ''}`}>{type}</span>;
}

/** Placeholder rows while the release table loads. */
export function SkeletonRows({ rows, cols }: { rows: number; cols: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_row, r) => (
        <tr key={r} className="skeleton-row" aria-hidden="true">
          {Array.from({ length: cols }, (_cell, c) => (
            <td key={c}>
              <span className="skeleton" style={{ width: `${[60, 70, 55, 80][c % 4]}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
