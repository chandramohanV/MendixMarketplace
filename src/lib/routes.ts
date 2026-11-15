// Every in-app URL in one place. Query values are encoded with encodeURIComponent, like the links
// were before, so existing bookmarks and the filter parsing in ExplorePage keep working.

export type ExploreQuery = Partial<
  Record<'q' | 'type' | 'category' | 'support' | 'industry' | 'publisher' | 'view' | 'sort', string>
>;
export type MyMarketplaceTab = 'favorites' | 'downloads' | 'reviews' | 'submissions';
export type ComponentTab = 'Overview' | 'Documentation' | 'Releases' | 'Reviews' | 'Developers';

function withQuery(path: string, query: Record<string, string | number | undefined> = {}): string {
  const parts = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`);
  return parts.length ? `${path}?${parts.join('&')}` : path;
}

export const routes = {
  home: '/',
  guidelines: '/guidelines',
  publishers: '/publishers',
  studio: '/studio',
  studioManage: '/studio/manage',
  submit: '/submit',
  explore: (query?: ExploreQuery) => withQuery('/components', query),
  component: (slug: string, tab?: ComponentTab) => withQuery(`/components/${slug}`, { tab }),
  myMarketplace: (tab?: MyMarketplaceTab) => withQuery('/my', { tab }),
  submitEdit: (submissionId: number) => withQuery('/submit', { edit: submissionId }),
};
