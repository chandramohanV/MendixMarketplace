import { useState } from 'react';
import { Icon } from '../../components/icons';
import { Modal } from '../../components/Modal';
import { useNotify } from '../../store/contexts';
import { getSummary, listReleases } from './api';
import { ReleaseNotesDialog, type DownloadHandler } from './ReleaseNotesDialog';
import { RELEASES_PAGE_SIZE, ReleasesSection } from './ReleasesSection';
import { StudioHero } from './StudioHero';
import { useApiQuery } from '../../lib/useApiQuery';
import { useReleaseFilters } from './useReleaseFilters';

export default function StudioPage() {
  const notify = useNotify();
  const filters = useReleaseFilters();
  const [notesFor, setNotesFor] = useState<string | null>(null);
  const [isVideoOpen, setIsVideoOpen] = useState(false);

  const { q, line, sort, page } = filters;
  const summary = useApiQuery('summary', getSummary);
  const list = useApiQuery(JSON.stringify({ q, line, sort, page }), (signal) =>
    listReleases(
      {
        q: q.trim() || undefined,
        line: line || undefined,
        sort: sort || 'version',
        page,
        pageSize: RELEASES_PAGE_SIZE,
      },
      signal,
    ),
  );

  const download: DownloadHandler = (release, platform) =>
    notify(`Downloading Studio ${release.version} for ${platform}… (demo)`);

  return (
    <div className="studio">
      <StudioHero
        summary={summary.data}
        isLoading={summary.loading}
        error={summary.error}
        onRetry={summary.reload}
        onOpenNotes={setNotesFor}
        onDownload={download}
        onPlayVideo={() => setIsVideoOpen(true)}
      />
      <ReleasesSection
        filters={filters}
        summary={summary.data}
        list={list}
        onOpenNotes={setNotesFor}
        onDownload={download}
      />

      {notesFor && (
        <ReleaseNotesDialog
          version={notesFor}
          onClose={() => setNotesFor(null)}
          onDownload={(release, platform) => {
            download(release, platform);
            setNotesFor(null);
          }}
        />
      )}
      {isVideoOpen && (
        <Modal title="Blox Assist: 2x as Powerful" onClose={() => setIsVideoOpen(false)}>
          <div className="fake-player">
            <Icon name="play" size={40} />
            <p>Video playback isn't available in this demo.</p>
          </div>
        </Modal>
      )}
    </div>
  );
}
