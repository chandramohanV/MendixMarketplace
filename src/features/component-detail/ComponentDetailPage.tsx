import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import NotFoundPage from '../../components/NotFoundPage';
import { ComponentCard } from '../../components/ComponentCard';
import { routes, type ComponentTab } from '../../lib/routes';
import { useDownloads, useReviews } from '../../store/contexts';
import { useCatalog } from '../../store/useCatalog';
import { developersFor, isPublic, isTab, relatedComponents, TABS } from './detail';
import { DetailHeader } from './DetailHeader';
import { DetailSidebar } from './DetailSidebar';
import { DevelopersTab, DocumentationTab, OverviewTab, ReleasesTab } from './DetailTabs';
import { ReviewsTab } from './ReviewsTab';

export default function ComponentDetailPage() {
  const { slug = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const { userReviews } = useReviews();
  const { recordDownload } = useDownloads();
  const { components, findBySlug } = useCatalog();
  const c = findBySlug(slug);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [isWritingReview, setIsWritingReview] = useState(false);
  const [helpfulVotes, setHelpfulVotes] = useState<Record<number, boolean>>({});

  if (!c) return <NotFoundPage />;

  const tabParam = params.get('tab');
  const tab: ComponentTab = isTab(tabParam) ? tabParam : 'Overview';
  const setTab = (t: ComponentTab) => setParams(t === 'Overview' ? {} : { tab: t }, { replace: true });
  const release = c.releases.find((r) => r.version === selectedVersion) || c.releases[0];
  const reviews = [...(userReviews[c.id] || []), ...c.reviews];
  const related = relatedComponents(c, components);
  const download = (version: string) => recordDownload(c.id, version, c.name);

  return (
    <div className="detail">
      <nav className="breadcrumbs">
        <Link to={routes.home}>Home</Link> / <Link to={routes.explore({ type: c.type })}>{c.type}</Link> /{' '}
        <span>{c.name}</span>
      </nav>

      {c.support === 'Deprecated' && (
        <div className="alert">This component is deprecated and no longer maintained. Consider an alternative.</div>
      )}
      {c.status === 'pending' && (
        <div className="alert alert-info" role="status">
          This submission is pending review and is only visible to you.{' '}
          <Link to={routes.myMarketplace('submissions')}>Manage your submissions</Link>
        </div>
      )}
      {c.status === 'rejected' && (
        <div className="alert" role="status">
          This submission was rejected and is only visible to you.
        </div>
      )}

      <div className="detail-grid">
        <div className="detail-main">
          <DetailHeader c={c} onUseInStudio={() => download(c.version)} />

          <div className="tabs" role="tablist">
            {TABS.map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                className={tab === t ? 'active' : ''}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === 'Overview' && <OverviewTab c={c} />}
          {tab === 'Documentation' && <DocumentationTab c={c} />}
          {tab === 'Releases' && <ReleasesTab c={c} onDownload={download} />}
          {tab === 'Reviews' && (
            <ReviewsTab
              c={c}
              reviews={reviews}
              canReview={isPublic(c)}
              isWritingReview={isWritingReview}
              onWritingChange={setIsWritingReview}
              helpfulVotes={helpfulVotes}
              onToggleHelpful={(i) => setHelpfulVotes((votes) => ({ ...votes, [i]: !votes[i] }))}
            />
          )}
          {tab === 'Developers' && <DevelopersTab developers={developersFor(c)} publisher={c.publisher} />}
        </div>

        <DetailSidebar
          c={c}
          selectedVersion={release.version}
          onSelectVersion={setSelectedVersion}
          onDownload={download}
          onShowReleases={() => setTab('Releases')}
        />
      </div>

      {related.length > 0 && (
        <section className="section related">
          <div className="section-head">
            <h2>Related Components</h2>
          </div>
          <div className="card-grid">
            {related.map((r) => (
              <ComponentCard key={r.id} c={r} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
