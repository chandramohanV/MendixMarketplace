import { useSearchParams } from 'react-router-dom';
import type { MyMarketplaceTab } from '../../lib/routes';
import { useDownloads, useFavorites, useReviews, useSubmissions } from '../../store/contexts';
import { useCatalog } from '../../store/useCatalog';
import type { Component } from '../../types';
import { DownloadsTab, FavoritesTab, MyReviewsTab, SubmissionsTab } from './MyMarketplaceTabs';

const TABS: readonly MyMarketplaceTab[] = ['favorites', 'downloads', 'reviews', 'submissions'];
const isTab = (value: string | null): value is MyMarketplaceTab =>
  value !== null && (TABS as readonly string[]).includes(value);

export default function MyMarketplacePage() {
  const [params, setParams] = useSearchParams();
  const { favorites } = useFavorites();
  const { downloads } = useDownloads();
  const { userReviews } = useReviews();
  const { submissions } = useSubmissions();
  const { findById } = useCatalog();
  const tabParam = params.get('tab');
  const tab: MyMarketplaceTab = isTab(tabParam) ? tabParam : 'favorites';

  const favoriteComponents = favorites.map(findById).filter((c): c is Component => c !== undefined);
  const myReviews = Object.entries(userReviews).flatMap(([id, reviews]) => {
    const component = findById(Number(id));
    return component ? reviews.map((review) => ({ ...review, component })) : [];
  });

  const labels: Record<MyMarketplaceTab, string> = {
    favorites: `Favorites (${favoriteComponents.length})`,
    downloads: `Downloads (${downloads.length})`,
    reviews: `My reviews (${myReviews.length})`,
    submissions: `My submissions (${submissions.length})`,
  };

  return (
    <div className="container page">
      <h1>My Marketplace</h1>
      <div className="tabs" role="tablist">
        {TABS.map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? 'active' : ''}
            onClick={() => setParams(key === 'favorites' ? {} : { tab: key })}
          >
            {labels[key]}
          </button>
        ))}
      </div>

      {tab === 'favorites' && <FavoritesTab favorites={favoriteComponents} />}
      {tab === 'downloads' && <DownloadsTab downloads={downloads} findById={findById} />}
      {tab === 'reviews' && <MyReviewsTab reviews={myReviews} />}
      {tab === 'submissions' && <SubmissionsTab submissions={submissions} />}
    </div>
  );
}
