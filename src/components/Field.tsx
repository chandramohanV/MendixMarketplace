import type { ReactNode } from 'react';

/**
 * Label + control + inline error. The control itself must use `id`, and point `aria-describedby` at
 * `${id}-error` while there is an error.
 *
 * - `hint`: help text under the field; replaced by the error when there is one.
 * - `aside`: extra info on the right (e.g. a character counter); shown next to the error too.
 */
export function Field({
  id,
  label,
  error,
  hint,
  aside,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  const hasMeta = Boolean(error || hint || aside);
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hasMeta && (
        <div className="field-meta">
          <FieldMessage id={id} error={error} hint={hint} />
          {aside}
        </div>
      )}
    </div>
  );
}

function FieldMessage({ id, error, hint }: { id: string; error?: string; hint?: ReactNode }) {
  if (error) {
    return (
      <span className="field-error" id={`${id}-error`}>
        {error}
      </span>
    );
  }
  // An empty span keeps `aside` pushed to the right when there's nothing on the left.
  return hint ? <span className="muted">{hint}</span> : <span />;
}
