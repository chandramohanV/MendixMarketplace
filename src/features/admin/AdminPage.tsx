// Admin console: search, add, edit and delete catalog components, with a link to Studio Pro release management.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/icons';
import { Modal } from '../../components/Modal';
import { Pagination } from '../../components/Pagination';
import { ApiError } from '../../lib/api';
import { routes } from '../../lib/routes';
import { useNotify, useServerCatalog } from '../../store/contexts';
import type { Component } from '../../types';
import { deleteComponent } from './api';
import { ComponentForm } from './ComponentForm';

const PAGE_SIZE = 20;

type DialogState =
  { kind: 'create' } | { kind: 'edit'; component: Component } | { kind: 'delete'; component: Component };

function matchesSearch(c: Component, search: string): boolean {
  const needle = search.trim().toLowerCase();
  return !needle || `${c.name} ${c.publisher} ${c.type}`.toLowerCase().includes(needle);
}

export default function AdminPage() {
  const notify = useNotify();
  const { components, reload } = useServerCatalog();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const matches = components.filter((c) => matchesSearch(c, search)).toSorted((a, b) => a.name.localeCompare(b.name));
  const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const shown = matches.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const close = () => setDialog(null);
  const afterChange = (message: string) => {
    close();
    notify(message);
    reload();
  };

  return (
    <div className="manage admin">
      <div className="manage-head">
        <div>
          <h1>Admin</h1>
          <p className="muted">
            Add and edit marketplace components. Changes are saved on the server and show up for every user right away.
          </p>
        </div>
        <Link to={routes.studioManage} className="btn btn-secondary">
          Manage Studio Pro releases
        </Link>
      </div>

      <section aria-labelledby="admin-components-title">
        <div className="admin-section-head">
          <h2 id="admin-components-title">Components ({components.length})</h2>
          <button className="btn btn-primary" onClick={() => setDialog({ kind: 'create' })}>
            + New component
          </button>
        </div>
        <div className="release-controls">
          <div className="input-icon">
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, publisher or type"
              aria-label="Search components"
            />
            <Icon name="search" />
          </div>
        </div>
        <div className="table-wrap">
          <table className="release-table manage-table admin-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Type</th>
                <th scope="col">Publisher</th>
                <th scope="col">Version</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id}>
                  <td data-label="Name">
                    <Link to={routes.component(c.slug)} className="version-text">
                      {c.name}
                    </Link>
                  </td>
                  <td data-label="Type">{c.type}</td>
                  <td data-label="Publisher">{c.publisher}</td>
                  <td data-label="Version">{c.version}</td>
                  <td className="actions-cell">
                    <div className="actions">
                      <button
                        className="btn btn-secondary sm"
                        onClick={() => setDialog({ kind: 'edit', component: c })}
                        aria-label={`Edit ${c.name}`}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-secondary sm"
                        onClick={() => setDialog({ kind: 'delete', component: c })}
                        aria-label={`Delete ${c.name}`}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={5} className="no-rows">
                    No components match “{search}”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={current} pages={pages} onChange={setPage} />
      </section>

      {dialog?.kind === 'create' && (
        <Modal title="New component" onClose={close} wide>
          <ComponentForm initial={null} onCancel={close} onSaved={(c) => afterChange(`${c.name} created`)} />
        </Modal>
      )}
      {dialog?.kind === 'edit' && (
        <Modal title={`Edit ${dialog.component.name}`} onClose={close} wide>
          <ComponentForm
            initial={dialog.component}
            onCancel={close}
            onSaved={(c) => afterChange(`${c.name} updated`)}
          />
        </Modal>
      )}
      {dialog?.kind === 'delete' && (
        <DeleteComponentDialog
          component={dialog.component}
          onClose={close}
          onDeleted={() => afterChange(`${dialog.component.name} deleted`)}
        />
      )}
    </div>
  );
}

function DeleteComponentDialog({
  component,
  onClose,
  onDeleted,
}: {
  component: Component;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirm = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await deleteComponent(component.slug);
      onDeleted();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
      setIsDeleting(false);
    }
  };
  return (
    <Modal title={`Delete ${component.name}?`} onClose={onClose}>
      <p>
        This removes the component, its releases and reviews from the marketplace for everyone. This can't be undone.
      </p>
      {error && (
        <div className="form-alert" role="alert">
          {error}
        </div>
      )}
      <div className="row-end">
        <button className="btn btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-danger" onClick={confirm} disabled={isDeleting}>
          {isDeleting ? 'Deleting…' : 'Delete component'}
        </button>
      </div>
    </Modal>
  );
}
