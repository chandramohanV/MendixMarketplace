import { Icon } from '../../components/icons';
import { Modal } from '../../components/Modal';
import type { StudioRelease } from '../../../shared/studio';
import { longDate } from '../../lib/dates';
import { getRelease } from './api';
import { TypeBadge } from './ui';
import { useApiQuery } from './useApiQuery';

export type DownloadHandler = (release: { version: string }, platform: string) => void;

/** Fetches one release (list items have no notes) and shows its notes with download buttons. */
export function ReleaseNotesDialog({
  version,
  onClose,
  onDownload,
}: {
  version: string;
  onClose: () => void;
  onDownload: DownloadHandler;
}) {
  const {
    data: release,
    error,
    loading,
    reload,
  } = useApiQuery(`release:${version}`, (signal) => getRelease(version, signal));
  const isGone = error?.status === 404;
  return (
    <Modal title={`Studio ${version} Release Notes`} onClose={onClose}>
      {loading && (
        <p className="muted" role="status">
          Loading release notes…
        </p>
      )}
      {error && (
        <div className="inline-error" role="alert">
          <span>{isGone ? 'This release no longer exists.' : error.message}</span>
          {!isGone && (
            <button className="btn btn-secondary sm" onClick={reload}>
              Retry
            </button>
          )}
        </div>
      )}
      {release && <ReleaseNotes release={release} onDownload={onDownload} />}
    </Modal>
  );
}

function ReleaseNotes({ release, onDownload }: { release: StudioRelease; onDownload: DownloadHandler }) {
  const sections = Object.entries(release.notes);
  return (
    <>
      <div className="notes-meta">
        <TypeBadge type={release.type} />
        <span className="muted">Released {longDate(release.date)}</span>
      </div>
      {sections.length === 0 && <p className="muted">No release notes were published for this version.</p>}
      {sections.map(([section, items]) => (
        <section key={section} className="notes-section">
          <h3>{section}</h3>
          <ul>
            {items.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </section>
      ))}
      <div className="row-end">
        {release.mac && (
          <button className="btn btn-secondary" onClick={() => onDownload(release, 'MacOS (Beta)')}>
            <Icon name="apple" /> Download for Mac
          </button>
        )}
        <button className="btn btn-primary" onClick={() => onDownload(release, 'Windows')}>
          <Icon name="windows" /> Download for Windows
        </button>
      </div>
    </>
  );
}
