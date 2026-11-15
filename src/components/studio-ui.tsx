import { useEffect, useRef, type ReactNode } from 'react';
import type { ReleaseType } from '../../shared/studio';
import { Icon } from './icons';

export function TypeBadge({ type, lg = false }: { type: ReleaseType | null | undefined; lg?: boolean }) {
  if (!type) return null;
  return <span className={`rbadge rbadge-${type.toLowerCase()} ${lg ? 'lg' : ''}`}>{type}</span>;
}

export function Modal({ title, onClose, children, labelledBy = 'modal-title', wide = false }: {
  title: string; onClose: () => void; children: ReactNode; labelledBy?: string; wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, []);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1} ref={ref}>
        <div className="modal-head">
          <h2 id={labelledBy}>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close dialog"><Icon name="close" /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

/** Placeholder rows while the release table loads. */
export function SkeletonRows({ rows, cols }: { rows: number; cols: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r} className="skeleton-row" aria-hidden="true">
          {Array.from({ length: cols }, (_, c) => <td key={c}><span className="skeleton" style={{ width: `${[60, 70, 55, 80][c % 4]}%` }} /></td>)}
        </tr>
      ))}
    </>
  );
}
