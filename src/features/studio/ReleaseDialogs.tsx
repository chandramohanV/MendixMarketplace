import { useState } from 'react';
import { Modal } from '../../components/Modal';
import type { ReleaseListItem, StudioRelease } from '../../../shared/studio';
import { ApiError, deleteRelease, getRelease } from './api';
import { ReleaseForm } from './ReleaseForm';
import { useApiQuery } from '../../lib/useApiQuery';

type OnSaved = (release: StudioRelease, created: boolean) => void;

export function CreateReleaseDialog({ onClose, onSaved }: { onClose: () => void; onSaved: OnSaved }) {
  return (
    <Modal title="New release" onClose={onClose} wide>
      <ReleaseForm initial={null} onCancel={onClose} onSaved={onSaved} />
    </Modal>
  );
}

/** Loads the full release (list items have no notes), then shows the form. */
export function EditReleaseDialog({
  version,
  onClose,
  onSaved,
}: {
  version: string;
  onClose: () => void;
  onSaved: OnSaved;
}) {
  const { data, error, loading, reload } = useApiQuery(`release:${version}`, (signal) => getRelease(version, signal));
  return (
    <Modal title={`Edit Studio ${version}`} onClose={onClose} wide>
      {loading && (
        <p className="muted" role="status">
          Loading release…
        </p>
      )}
      {error && (
        <div className="inline-error" role="alert">
          <span>{error.message}</span>
          <button className="btn btn-secondary sm" onClick={reload}>
            Retry
          </button>
        </div>
      )}
      {data && <ReleaseForm initial={data} onCancel={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

/** Confirms deletion; the server's refusal (e.g. deleting the current LATEST) is shown in the dialog. */
export function DeleteReleaseDialog({
  release,
  onClose,
  onDeleted,
}: {
  release: ReleaseListItem;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirm = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await deleteRelease(release.version);
      onDeleted();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
      setIsDeleting(false);
    }
  };
  return (
    <Modal title={`Delete Studio ${release.version}?`} onClose={onClose}>
      <p>This permanently removes the release and its notes from the download page. This can't be undone.</p>
      {error && (
        <div className="form-alert" role="alert">
          {error}
        </div>
      )}
      <div className="row-end">
        <button className="btn btn-secondary" onClick={onClose} disabled={isDeleting}>
          Cancel
        </button>
        <button className="btn btn-danger" onClick={confirm} disabled={isDeleting} aria-busy={isDeleting || undefined}>
          {isDeleting ? 'Deleting…' : 'Delete release'}
        </button>
      </div>
    </Modal>
  );
}
