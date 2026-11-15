import { Icon } from '../../components/icons';
import type { ReleaseListItem, StudioSummary } from '../../../shared/studio';
import { monthYear } from '../../lib/dates';
import { useNotify } from '../../store/contexts';
import type { ApiError } from './api';
import type { DownloadHandler } from './ReleaseNotesDialog';
import { TypeBadge } from './ui';

/** Download hero (recommended LTS + video) and the two panels below it. */
export function StudioHero({
  summary,
  isLoading,
  error,
  onRetry,
  onOpenNotes,
  onDownload,
  onPlayVideo,
}: {
  summary: StudioSummary | undefined;
  isLoading: boolean;
  error: ApiError | undefined;
  onRetry: () => void;
  onOpenNotes: (version: string) => void;
  onDownload: DownloadHandler;
  onPlayVideo: () => void;
}) {
  const notify = useNotify();
  const lts = summary?.recommendedLts;
  const latest = summary?.latest;
  return (
    <section className="studio-hero" aria-busy={isLoading || undefined}>
      <div className="studio-hero-inner">
        <div className="studio-intro">
          <h1>
            Download Studio <TypeBadge type="LTS" lg />
          </h1>
          <p className="lead-light">
            Use the Studio IDE to build high-quality applications faster with AI-assisted development.
          </p>
          <RecommendedRelease
            error={error}
            release={lts}
            onRetry={onRetry}
            onOpenNotes={onOpenNotes}
            onTrustedClick={() => notify('Customer stories are not part of this demo')}
          />
          <div className="hero-actions">
            <button className="btn btn-primary lg" disabled={!lts} onClick={() => lts && onDownload(lts, 'Windows')}>
              <Icon name="windows" /> Download for Windows
            </button>
            <button
              className="btn btn-outline-light lg"
              disabled={!lts}
              onClick={() => lts && onDownload(lts, 'Mac (Beta)')}
            >
              <Icon name="apple" /> Download for Mac (Beta)
            </button>
          </div>
        </div>
        <VideoCard onPlay={onPlayVideo} latest={latest} />
      </div>
      <div className="studio-panels">
        <div className="glass-panel">
          <h2>Get Latest Features</h2>
          {latest ? (
            <>
              <p>
                Download{' '}
                <button className="inline-link" onClick={() => onOpenNotes(latest.version)}>
                  Studio {latest.version}
                </button>{' '}
                for all the latest features.
              </p>
              <p className="meta-light">
                Released {monthYear(latest.date)} ·{' '}
                <button className="inline-link" onClick={() => onOpenNotes(latest.version)}>
                  Release Notes
                </button>
              </p>
            </>
          ) : (
            <p>
              <span className="skeleton dark" style={{ width: '70%' }} />
            </p>
          )}
        </div>
        <div className="glass-panel">
          <h2>Build Applications Smarter</h2>
          <p>
            Learn more about{' '}
            <button className="inline-link" onClick={() => notify('Blox Assist docs are not part of this demo')}>
              Blox Assist for Smart Development
            </button>
            .
          </p>
          <p className="meta-light">
            <Icon name="sparkle" /> AI-assisted modeling, review and test generation
          </p>
        </div>
      </div>
    </section>
  );
}

/** Hero lines for the recommended LTS release: error, loaded, or loading placeholders. */
function RecommendedRelease({
  error,
  release,
  onRetry,
  onOpenNotes,
  onTrustedClick,
}: {
  error: ApiError | undefined;
  release: ReleaseListItem | null | undefined;
  onRetry: () => void;
  onOpenNotes: (version: string) => void;
  onTrustedClick: () => void;
}) {
  if (error) {
    return (
      <div className="inline-error dark" role="alert">
        <span>Couldn't load the recommended release. {error.message}</span>
        <button className="btn btn-outline-light sm" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }
  if (!release) {
    return (
      <>
        <p className="lead-light">
          <span className="skeleton dark" style={{ width: 260 }} />
        </p>
        <p className="meta-light">
          <span className="skeleton dark" style={{ width: 200 }} />
        </p>
      </>
    );
  }
  return (
    <>
      <p className="lead-light">
        Download{' '}
        <button className="inline-link" onClick={() => onOpenNotes(release.version)}>
          Studio {release.version}
        </button>{' '}
        with Long-Term Support.
      </p>
      <p className="meta-light">
        Released {monthYear(release.date)} ·{' '}
        <button className="inline-link" onClick={() => onOpenNotes(release.version)}>
          Release Notes
        </button>{' '}
        · Trusted by{' '}
        <button className="inline-link" onClick={onTrustedClick}>
          Industry Leaders
        </button>
      </p>
    </>
  );
}

function VideoCard({ onPlay, latest }: { onPlay: () => void; latest: ReleaseListItem | null | undefined }) {
  return (
    <button className="video-card" onClick={onPlay} aria-label="Play video: Blox Assist, twice as powerful">
      <div className="video-grid">
        <div className="vtile big">
          <span>
            Blox Assist
            <br />
            2x as Powerful
          </span>
        </div>
        <div className="vtile presenter" aria-hidden="true">
          <svg viewBox="0 0 120 120">
            <circle cx="60" cy="42" r="20" />
            <path d="M22 120c4-30 20-44 38-44s34 14 38 44z" />
          </svg>
        </div>
        <div className="vtile">
          <span className="vlogo">blox</span>
        </div>
        <div className="vtile">
          <small>STUDIO VERSION</small>
          <b>{latest ? `${latest.major}.${latest.minor}` : '—'}</b>
        </div>
      </div>
      <span className="play">
        <Icon name="play" size={28} />
      </span>
    </button>
  );
}
