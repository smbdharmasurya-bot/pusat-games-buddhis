/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Game, Category, LeaderboardEntry, Testimonial, License, Certificate, SiteSettings, AuditLog, StatsOverview, UserProfile } from './types';
import { api } from './services/api';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { CategoryBar } from './components/CategoryBar';
import { LazySection } from './components/LazySection';
import { RoutePageSkeleton, ModalChunkFallback } from './components/RouteFallback';
import { sanitizeSelectedCategory } from './utils/categorySync';
import {
  hasSyncRevisionChanged,
  reconcileActiveUser,
  resolveRealtimeToastMessage,
  shouldAutoRefreshOnVisibility,
} from './utils/realtimeSync';
import { filterActiveGamesLeaderboard } from './utils/scoreAutoSync';
import {
  AppRouteView,
  getRouteHashForView,
  isValidRouteView,
  parseViewFromLocation,
} from './utils/routeLazySync';

// Route-based Code Splitting & On-Demand Lazy Chunks (React.lazy)
const HomeShowcaseSection = React.lazy(() =>
  import('./components/HomeShowcaseSection').then((m) => ({ default: m.HomeShowcaseSection }))
);
const CatalogView = React.lazy(() =>
  import('./components/CatalogView').then((m) => ({ default: m.CatalogView }))
);
const FeaturedView = React.lazy(() =>
  import('./components/FeaturedView').then((m) => ({ default: m.FeaturedView }))
);
const LeaderboardView = React.lazy(() =>
  import('./components/LeaderboardView').then((m) => ({ default: m.LeaderboardView }))
);
const TestimonialsView = React.lazy(() =>
  import('./components/TestimonialsView').then((m) => ({ default: m.TestimonialsView }))
);
const GamePlayerModal = React.lazy(() =>
  import('./components/GamePlayerModal').then((m) => ({ default: m.GamePlayerModal }))
);
const AdminHubModal = React.lazy(() =>
  import('./components/AdminHubModal').then((m) => ({ default: m.AdminHubModal }))
);
const CertificateVerifierModal = React.lazy(() =>
  import('./components/CertificateVerifierModal').then((m) => ({ default: m.CertificateVerifierModal }))
);
const AuthModal = React.lazy(() =>
  import('./components/AuthModal').then((m) => ({ default: m.AuthModal }))
);

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'warning' | 'info';
}

export default function App() {
  // Navigation & Route View (synchronized with URL hash for route-based code splitting)
  const [currentView, setCurrentView] = React.useState<AppRouteView>(() => {
    if (typeof window !== 'undefined') {
      return parseViewFromLocation(window.location.hash, window.location.pathname);
    }
    return 'home';
  });
  const [selectedCategory, setSelectedCategory] = React.useState<string>('all');

  const navigateToView = React.useCallback((view: string, scrollTop = true) => {
    const nextView: AppRouteView = isValidRouteView(view) ? view : 'home';
    setCurrentView(nextView);
    if (typeof window !== 'undefined') {
      const targetHash = getRouteHashForView(nextView);
      if (window.location.hash !== targetHash) {
        window.history.pushState(null, '', targetHash);
      }
      if (scrollTop) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncFromUrl = () => {
      setCurrentView(parseViewFromLocation(window.location.hash, window.location.pathname));
    };
    window.addEventListener('hashchange', syncFromUrl);
    window.addEventListener('popstate', syncFromUrl);
    return () => {
      window.removeEventListener('hashchange', syncFromUrl);
      window.removeEventListener('popstate', syncFromUrl);
    };
  }, []);

  // Theme
  const [isDark, setIsDark] = React.useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') ||
        window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // User Profile
  const [currentUser, setCurrentUser] = React.useState<UserProfile | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pgb_active_user');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return null;
        }
      }
    }
    return null;
  });

  // State from SQL Database
  const [games, setGames] = React.useState<Game[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [leaderboard, setLeaderboard] = React.useState<LeaderboardEntry[]>([]);
  const [testimonials, setTestimonials] = React.useState<Testimonial[]>([]);
  const [licenses, setLicenses] = React.useState<License[]>([]);
  const [certificates, setCertificates] = React.useState<Certificate[]>([]);
  const [auditLogs, setAuditLogs] = React.useState<AuditLog[]>([]);
  const [stats, setStats] = React.useState<StatsOverview>({
    totalGames: 0,
    totalPlayers: 0,
    totalCategories: 0,
    totalLeaderboardEntries: 0,
    totalCertificates: 0,
  });
  const [settings, setSettings] = React.useState<SiteSettings>({
    title: 'Candi & Stupa Dharma',
    subtitle: 'Nilai Kebijaksanaan & Kemurnian',
    emoji: '',
    imageUrl: '',
    announcement: '',
  });

  // Modals & Interactivity
  const [activeGame, setActiveGame] = React.useState<Game | null>(null);
  const [adminModalOpen, setAdminModalOpen] = React.useState(false);
  const [authModalOpen, setAuthModalOpen] = React.useState(false);
  const [verifierModalOpen, setVerifierModalOpen] = React.useState(false);

  // Loading & Synchronization refs
  const [isLoading, setIsLoading] = React.useState(true);
  const hasLoadedOnceRef = React.useRef(false);
  const inFlightLoadRef = React.useRef(false);
  const pendingReloadRef = React.useRef(false);
  const lastRevisionRef = React.useRef<number | null>(null);
  const lastSyncTimeRef = React.useRef<number>(0);
  const hasConnectedSseRef = React.useRef(false);
  const currentUserRef = React.useRef<UserProfile | null>(currentUser);

  React.useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Toasts
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const showToast = React.useCallback((message: string, type: 'success' | 'warning' | 'info' = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);

  // Sync theme with HTML class
  React.useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark((prev) => !prev);
  };

  // Load all data from Backend REST API with coalescing & revision tracking
  const loadAllData = React.useCallback(async () => {
    if (inFlightLoadRef.current) {
      pendingReloadRef.current = true;
      return;
    }

    inFlightLoadRef.current = true;
    try {
      if (!hasLoadedOnceRef.current) {
        setIsLoading(true);
      }

      const activeSessionUser = currentUserRef.current;
      const [
        fetchedGames,
        fetchedCategories,
        fetchedLeaderboard,
        fetchedTestimonials,
        fetchedLicenses,
        fetchedCertificates,
        fetchedSettings,
        fetchedStats,
        fetchedAuditLogs,
        fetchedSyncState,
        fetchedUsers,
      ] = await Promise.all([
        api.getGames(),
        api.getCategories(),
        api.getLeaderboard(),
        api.getTestimonials(true),
        api.getLicenses().catch(() => [] as License[]),
        api.getCertificates().catch(() => [] as Certificate[]),
        api.getSettings(),
        api.getStats(),
        api.getAuditLogs().catch(() => [] as AuditLog[]),
        api.getSyncState().catch(() => null),
        activeSessionUser ? api.getUsers().catch(() => null) : Promise.resolve(null),
      ]);

      setGames(Array.isArray(fetchedGames) ? fetchedGames : []);
      setCategories(Array.isArray(fetchedCategories) ? fetchedCategories : []);
      setLeaderboard(Array.isArray(fetchedLeaderboard) ? fetchedLeaderboard : []);
      setTestimonials(Array.isArray(fetchedTestimonials) ? fetchedTestimonials : []);
      setLicenses(Array.isArray(fetchedLicenses) ? fetchedLicenses : []);
      setCertificates(Array.isArray(fetchedCertificates) ? fetchedCertificates : []);
      if (fetchedSettings && typeof fetchedSettings === 'object') {
        setSettings(fetchedSettings);
      }
      if (fetchedStats && typeof fetchedStats === 'object') {
        setStats(fetchedStats);
      }
      setAuditLogs(Array.isArray(fetchedAuditLogs) ? fetchedAuditLogs : []);

      if (fetchedSyncState && typeof fetchedSyncState.revision === 'number') {
        lastRevisionRef.current = fetchedSyncState.revision;
      }
      lastSyncTimeRef.current = Date.now();
      hasLoadedOnceRef.current = true;

      if (fetchedUsers && currentUserRef.current) {
        const reconciled = reconcileActiveUser(currentUserRef.current, fetchedUsers);
        if (reconciled.changed) {
          setCurrentUser(reconciled.user);
          if (reconciled.user) {
            localStorage.setItem('pgb_active_user', JSON.stringify(reconciled.user));
          } else {
            localStorage.removeItem('pgb_active_user');
          }
        }
      }
    } catch (err) {
      console.error('Error loading data from SQL backend:', err);
      showToast('Gagal memuat data dari server SQL. Mencoba sinkronisasi ulang...', 'warning');
      if (!hasLoadedOnceRef.current) {
        window.setTimeout(() => {
          if (!hasLoadedOnceRef.current) {
            void loadAllData();
          }
        }, 2500);
      }
    } finally {
      setIsLoading(false);
      inFlightLoadRef.current = false;
      if (pendingReloadRef.current) {
        pendingReloadRef.current = false;
        void loadAllData();
      }
    }
  }, [showToast]);

  // Initial fetch, worldwide visitor tracking, Realtime SSE listener, and multi-computer fallback auto-sync
  React.useEffect(() => {
    void loadAllData();

    // Record global website visit so baseline data evolves with worldwide user accesses
    const activeUser = currentUserRef.current;
    void api
      .recordSiteVisit({
        user: activeUser
          ? { id: activeUser.id, name: activeUser.name, role: activeUser.role }
          : undefined,
        clientInfo: {
          screen: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : undefined,
          timezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined,
          language: typeof navigator !== 'undefined' ? navigator.language : undefined,
        },
      })
      .catch(() => {});

    const syncIfRevisionChanged = async () => {
      try {
        const state = await api.getSyncState();
        if (hasSyncRevisionChanged(lastRevisionRef.current, state.revision)) {
          await loadAllData();
        } else {
          lastSyncTimeRef.current = Date.now();
        }
      } catch {
        // Ignore transient offline errors; will retry on next visibility/online/interval check
      }
    };

    // Subscribe to server real-time push events (SSE)
    const unsubscribe = api.subscribeRealtime((event, data) => {
      const payloadRevision =
        data && typeof data === 'object' && 'revision' in data && typeof (data as { revision?: unknown }).revision === 'number'
          ? (data as { revision: number }).revision
          : undefined;

      if (event === 'connected') {
        if (!hasConnectedSseRef.current) {
          hasConnectedSseRef.current = true;
          if (hasSyncRevisionChanged(lastRevisionRef.current, payloadRevision)) {
            void loadAllData();
          }
          return;
        }
        // Reconnected after network interruption -> catch up any missed server updates
        void loadAllData();
        return;
      }

      const toastMsg = resolveRealtimeToastMessage(event);
      if (toastMsg) {
        showToast(toastMsg, 'info');
      }
      void loadAllData();
    });

    // Periodic revision check fallback (handles corporate proxies/firewalls that interrupt SSE)
    const pollInterval = window.setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        void syncIfRevisionChanged();
      }
    }, 15000);

    const handleVisibilityOrFocus = () => {
      if (typeof document !== 'undefined' && shouldAutoRefreshOnVisibility(document.visibilityState, lastSyncTimeRef.current, Date.now(), 2000)) {
        void syncIfRevisionChanged();
      }
    };

    const handleOnline = () => {
      void loadAllData();
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleVisibilityOrFocus);
      window.addEventListener('online', handleOnline);
    }

    return () => {
      unsubscribe();
      window.clearInterval(pollInterval);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleVisibilityOrFocus);
        window.removeEventListener('online', handleOnline);
      }
    };
  }, [loadAllData, showToast]);

  // User auth actions
  const handleLoginSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    localStorage.setItem('pgb_active_user', JSON.stringify(user));
    showToast(`Selamat datang, ${user.name}! Level: ${user.level} (${user.xp} XP)`, 'success');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('pgb_active_user');
    showToast('Anda telah keluar dari akun.', 'info');
  };

  // Submit score to Leaderboard
  const handleSubmitScore = async (
    gameTitle: string,
    scoreVal: number,
    xpEarned: number,
    isCompleted: boolean = true,
    accessLogId?: number,
    gameId?: number
  ) => {
    try {
      const pName = currentUser?.name || 'Tamu Dharma';
      const pEmail = currentUser?.email || undefined;
      const pSchool = currentUser?.school || (currentUser ? 'Sekolah Dharma' : 'Tamu (Tanpa Login)');
      const pAvatar = currentUser?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(pName)}`;

      await api.submitScore({
        userName: pName,
        userEmail: pEmail,
        gameId,
        gameTitle,
        score: scoreVal,
        xpEarned,
        school: pSchool,
        avatar: pAvatar,
        isCompleted: isCompleted !== false,
        accessLogId,
      });

      // Update local user XP
      if (currentUser) {
        const updatedUser = {
          ...currentUser,
          xp: currentUser.xp + xpEarned,
        };
        setCurrentUser(updatedUser);
        localStorage.setItem('pgb_active_user', JSON.stringify(updatedUser));
      }

      showToast(`Skor (${scoreVal} pts / +${xpEarned} XP) untuk "${gameTitle}" berhasil dicatat otomatis ke Papan Peringkat!`, 'success');
      loadAllData();
    } catch (err) {
      showToast((err as Error).message, 'warning');
    }
  };

  // Submit community testimonial
  const handleSubmitTestimonial = async (testi: {
    name: string;
    role: string;
    game: string;
    rating: number;
    message: string;
  }) => {
    await api.submitTestimonial(testi);
    showToast('Testimoni berhasil dikirim dan menunggu moderasi admin.', 'success');
    loadAllData();
  };

  const activeGames = React.useMemo(() => games.filter((g) => g.isActive !== false), [games]);
  const featuredGames = React.useMemo(() => activeGames.filter((g) => g.featured || g.rating >= 4.9), [activeGames]);
  const activeLeaderboard = React.useMemo(
    () => filterActiveGamesLeaderboard(leaderboard, games),
    [leaderboard, games]
  );

  React.useEffect(() => {
    setSelectedCategory((prev) => sanitizeSelectedCategory(prev, categories));
  }, [categories]);

  React.useEffect(() => {
    setActiveGame((prev) => {
      if (!prev) return null;
      const fresh = games.find((g) => g.id === prev.id);
      return fresh || prev;
    });
  }, [games]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-semibold text-white transition-all transform animate-bounce-once ${
              toast.type === 'success'
                ? 'bg-emerald-600'
                : toast.type === 'warning'
                ? 'bg-amber-600'
                : 'bg-slate-800'
            }`}
          >
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Top Navigation */}
      <Navbar
        currentView={currentView}
        onNavigate={(v) => navigateToView(v, true)}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        currentUser={currentUser}
        onOpenAuth={() => setAuthModalOpen(true)}
        onLogout={handleLogout}
        onOpenAdmin={() => setAdminModalOpen(true)}
        onOpenVerifier={() => setVerifierModalOpen(true)}
      />

      {/* Main Views Container (Route-based Code Splitting via React.lazy + Suspense) */}
      <main className="flex-grow">
        {/* VIEW 1: HOME */}
        {currentView === 'home' && (
          <div className="space-y-16 pb-16">
            {/* Above-the-Fold Hero Section (Eagerly loaded for instant FCP) */}
            <HeroSection
              settings={settings}
              stats={stats}
              onExplore={() => navigateToView('catalog', true)}
              onOpenLeaderboard={() => navigateToView('leaderboard', true)}
            />

            {/* Manual Categories Strip */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <CategoryBar
                categories={categories}
                games={activeGames}
                selectedCategory={selectedCategory}
                onSelectCategory={(catName) => {
                  setSelectedCategory(catName);
                  navigateToView('catalog', true);
                }}
              />
            </div>

            {/* Scroll-based Lazy Loaded Below-the-Fold Showcase (IntersectionObserver + React.lazy) */}
            <LazySection id="home-showcase-lazy" rootMargin="240px 0px" minHeightClass="min-h-[340px]">
              <React.Suspense fallback={<RoutePageSkeleton label="Memuat permainan pilihan..." />}>
                <HomeShowcaseSection
                  featuredGames={featuredGames}
                  totalActiveGames={activeGames.length}
                  onPlayGame={(g) => setActiveGame(g)}
                  onOpenCatalog={() => navigateToView('catalog', true)}
                  onOpenLeaderboard={() => navigateToView('leaderboard', true)}
                />
              </React.Suspense>
            </LazySection>
          </div>
        )}

        {/* VIEW 2: CATALOG GAMES (Lazy Route Chunk) */}
        {currentView === 'catalog' && (
          <React.Suspense fallback={<RoutePageSkeleton label="Memuat katalog permainan..." />}>
            <CatalogView
              games={activeGames}
              categories={categories}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              onPlay={(g) => setActiveGame(g)}
            />
          </React.Suspense>
        )}

        {/* VIEW 3: FEATURED GAMES (Lazy Route Chunk) */}
        {currentView === 'featured' && (
          <React.Suspense fallback={<RoutePageSkeleton label="Memuat game unggulan..." />}>
            <FeaturedView
              games={activeGames}
              onPlay={(g) => setActiveGame(g)}
            />
          </React.Suspense>
        )}

        {/* VIEW 4: REAL-TIME LEADERBOARD (Lazy Route Chunk) */}
        {currentView === 'leaderboard' && (
          <React.Suspense fallback={<RoutePageSkeleton label="Memuat papan peringkat real-time..." />}>
            <LeaderboardView
              entries={activeLeaderboard}
              isLoading={isLoading}
              onRefresh={loadAllData}
            />
          </React.Suspense>
        )}

        {/* VIEW 5: TESTIMONIALS (Lazy Route Chunk) */}
        {currentView === 'testimonials' && (
          <React.Suspense fallback={<RoutePageSkeleton label="Memuat ulasan & testimoni..." />}>
            <TestimonialsView
              testimonials={testimonials.filter((t) => t.status === 'approved')}
              games={activeGames}
              onSubmit={handleSubmitTestimonial}
            />
          </React.Suspense>
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-10 mt-auto transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <span className="text-xl">☸</span>
            <span className="font-heading font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
              PUSAT GAMES BUDDHIS
            </span>
          </div>
          <p className="text-xs text-slate-500 italic max-w-lg mx-auto">
            "Belajar Dharma, Bermain dengan Bijak, Bertumbuh dalam Kebijaksanaan."
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400">
            <span>Database SQL Terpusat</span>
            <span>·</span>
            <span>Real-Time Leaderboard Synchronized</span>
            <span>·</span>
            <span>Admin Hub Studio Pro</span>
            <span>·</span>
            <button
              onClick={() => setVerifierModalOpen(true)}
              className="hover:text-amber-500 transition cursor-pointer"
            >
              Verifikasi Sertifikat
            </button>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            &copy; 2026 Pusat Games Buddhis Indonesia. Hak cipta dilindungi undang-undang.
          </p>
        </div>
      </footer>

      {/* GAME PLAYER FULLSCREEN MODAL (Loaded On-Demand) */}
      {activeGame && (
        <React.Suspense fallback={<ModalChunkFallback label="Memuat pemutar permainan..." />}>
          <GamePlayerModal
            game={activeGame}
            onClose={() => setActiveGame(null)}
            onSubmitScore={handleSubmitScore}
            playerName={currentUser?.name || 'Tamu Dharma'}
            currentUser={currentUser}
          />
        </React.Suspense>
      )}

      {/* ADMIN HUB STUDIO PRO MODAL (Loaded On-Demand Only When Opened) */}
      {adminModalOpen && (
        <React.Suspense fallback={<ModalChunkFallback label="Memuat Admin Hub Studio Pro..." />}>
          <AdminHubModal
            isOpen={adminModalOpen}
            onClose={() => setAdminModalOpen(false)}
            games={games}
            categories={categories}
            testimonials={testimonials}
            licenses={licenses}
            certificates={certificates}
            settings={settings}
            auditLogs={auditLogs}
            onDataChanged={loadAllData}
          />
        </React.Suspense>
      )}

      {/* CERTIFICATE VERIFIER MODAL (Loaded On-Demand) */}
      {verifierModalOpen && (
        <React.Suspense fallback={<ModalChunkFallback label="Memuat verifikasi sertifikat..." />}>
          <CertificateVerifierModal
            isOpen={verifierModalOpen}
            onClose={() => setVerifierModalOpen(false)}
          />
        </React.Suspense>
      )}

      {/* USER AUTH MODAL (Loaded On-Demand) */}
      {authModalOpen && (
        <React.Suspense fallback={<ModalChunkFallback label="Memuat halaman masuk..." />}>
          <AuthModal
            isOpen={authModalOpen}
            onClose={() => setAuthModalOpen(false)}
            onLoginSuccess={handleLoginSuccess}
          />
        </React.Suspense>
      )}
    </div>
  );
}
