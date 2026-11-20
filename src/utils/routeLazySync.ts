export type AppRouteView = 'home' | 'catalog' | 'featured' | 'leaderboard' | 'testimonials';

const VALID_VIEWS: ReadonlySet<AppRouteView> = new Set([
  'home',
  'catalog',
  'featured',
  'leaderboard',
  'testimonials',
]);

const HASH_TO_VIEW: Record<string, AppRouteView> = {
  '': 'home',
  '/': 'home',
  home: 'home',
  '/home': 'home',
  games: 'catalog',
  '/games': 'catalog',
  catalog: 'catalog',
  '/catalog': 'catalog',
  featured: 'featured',
  '/featured': 'featured',
  unggulan: 'featured',
  '/unggulan': 'featured',
  leaderboard: 'leaderboard',
  '/leaderboard': 'leaderboard',
  peringkat: 'leaderboard',
  '/peringkat': 'leaderboard',
  testimonials: 'testimonials',
  '/testimonials': 'testimonials',
  testimoni: 'testimonials',
  '/testimoni': 'testimonials',
};

const VIEW_TO_HASH: Record<AppRouteView, string> = {
  home: '#/',
  catalog: '#/games',
  featured: '#/featured',
  leaderboard: '#/leaderboard',
  testimonials: '#/testimonials',
};

export function isValidRouteView(view: string): view is AppRouteView {
  return VALID_VIEWS.has(view as AppRouteView);
}

/**
 * Resolves the active route view from URL hash (primary) or pathname (fallback),
 * enabling deep-linking and route-based code splitting without breaking static routing.
 */
export function parseViewFromLocation(hash: string = '', pathname: string = '/'): AppRouteView {
  const cleanHash = String(hash || '')
    .replace(/^#/, '')
    .split('?')[0]
    .trim()
    .toLowerCase();

  if (cleanHash && cleanHash !== '/') {
    const normalizedHash = cleanHash.replace(/\/+$/, '');
    if (HASH_TO_VIEW[normalizedHash]) {
      return HASH_TO_VIEW[normalizedHash];
    }
  }

  const cleanPath = String(pathname || '/')
    .split('?')[0]
    .trim()
    .toLowerCase()
    .replace(/\/+$/, '');

  if (cleanPath && HASH_TO_VIEW[cleanPath]) {
    return HASH_TO_VIEW[cleanPath];
  }

  return 'home';
}

export function getRouteHashForView(view: AppRouteView): string {
  return VIEW_TO_HASH[view] || '#/';
}
