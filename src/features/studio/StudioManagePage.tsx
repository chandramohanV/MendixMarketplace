import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/icons';
import type { ReleaseListItem, StudioRelease } from '../../../shared/studio';
import { longDate } from '../../lib/dates';
import { routes } from '../../lib/routes';
import { useNotify } from '../../store/contexts';
import { listReleases } from './api';
import { CreateReleaseDialog, DeleteReleaseDialog, EditReleaseDialog } from './ReleaseDialogs';
import { SkeletonRows, TypeBadge } from './ui';
import { useApiQuery } from '../../lib/useApiQuery';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 250;

type DialogState =
  { kind: 'create' } | { kind: 'edit'; version: string } | { kind: 'delete'; release: ReleaseListItem } | null;

export default function StudioManagePage() {
  const notify = useNotify();
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<DialogState>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const list = useApiQuery(JSON.stringify({ q: query, page }), (signal) =>
    listReleases({ q: query || undefined, page, pageSize: PAGE_SIZE }, signal),
  );
  const total = (list.data ?? list.previous)?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstShown = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const lastShown = Math.min(page * PAGE_SIZE, total);

  const closeDialog = () => setDialog(null);
  const onSaved = (release: StudioRelease, created: boolean) => {
    closeDialog();
    notify(created ? `Release ${release.version} created` : `Release ${release.version} updated`);
    list.reload();
  };

  return (
    <div className="manage">
      <nav className="breadcrumbs">
        <Link to={routes.studio}>Studio</Link> / <span>Manage releases</span>
      </nav>
      <div className="manage-head">
        <div>
          <h1>Manage releases</h1>
          <p className="muted">
            Create, edit and delete Studio releases. Changes are saved through the Studio API and show up on the
            download page immediately.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setDialog({ kind: 'create' })}>
          + New release
        </button>
      </div>

      <div className="release-controls">
        <div className="input-icon">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by Version Number"
            aria-label="Search by version number"
          />
          <Icon name="search" />
        </div>
      </div>

      <div className="table-wrap">
        <table className="release-table manage-table" aria-busy={list.loading || undefined}>
          <thead>
            <tr>
              <th scope="col">Version</th>
              <th scope="col">Release date</th>
              <th scope="col">Mac</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.loading && <SkeletonRows rows={8} cols={4} />}
            {list.error && (
              <tr>
                <td colSpan={4} className="no-rows">
                  <div className="inline-error center-row" role="alert">
                    <span>Couldn't load releases. {list.error.message}</span>
                    <button className="btn btn-secondary sm" onClick={list.reload}>
                      Retry
                    </button>
                  </div>
                </td>
              </tr>
            )}
            {list.data?.items.map((r) => (
              <tr key={r.version}>
                <td data-label="Version">
                  <span className="version-text">{r.version}</span> <TypeBadge type={r.type} />
                </td>
                <td data-label="Released">{longDate(r.date)}</td>
                <td data-label="Mac">{r.mac ? 'Yes' : '—'}</td>
                <td className="actions-cell">
                  <div className="actions">
                    <button
                      className="btn btn-secondary sm"
                      onClick={() => setDialog({ kind: 'edit', version: r.version })}
                      aria-label={`Edit ${r.version}`}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-secondary sm"
                      onClick={() => setDialog({ kind: 'delete', release: r })}
                      aria-label={`Delete ${r.version}`}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {list.data && list.data.items.length === 0 && (
              <tr>
                <td colSpan={4} className="no-rows">
                  No releases match “{query}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <nav className="table-pager" aria-label="Release table pages">
        <button
          className="icon-btn"
          disabled={page === 1 || list.loading}
          onClick={() => setPage(page - 1)}
          aria-label="Previous page"
        >
          <Icon name="chevronLeft" />
        </button>
        <span className="pager-status" aria-live="polite">
          {list.loading ? 'Loading…' : `${firstShown} to ${lastShown} of ${total}`}
        </span>
        <button
          className="icon-btn"
          disabled={page >= pages || list.loading}
          onClick={() => setPage(page + 1)}
          aria-label="Next page"
        >
          <Icon name="chevronRight" />
        </button>
      </nav>

      {dialog?.kind === 'create' && <CreateReleaseDialog onClose={closeDialog} onSaved={onSaved} />}
      {dialog?.kind === 'edit' && (
        <EditReleaseDialog version={dialog.version} onClose={closeDialog} onSaved={onSaved} />
      )}
      {dialog?.kind === 'delete' && (
        <DeleteReleaseDialog
          release={dialog.release}
          onClose={closeDialog}
          onDeleted={() => {
            closeDialog();
            notify(`Release ${dialog.release.version} deleted`);
            list.reload();
          }}
        />
      )}
    </div>
  );
}
