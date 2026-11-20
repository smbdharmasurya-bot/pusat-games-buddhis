import React from 'react';

interface LazySectionProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  rootMargin?: string;
  minHeightClass?: string;
  id?: string;
}

/**
 * Scroll-based Lazy Loading container using IntersectionObserver.
 * Defers mounting (and triggering React.lazy chunk downloads) until the user
 * scrolls close to this section in the viewport.
 */
export const LazySection: React.FC<LazySectionProps> = ({
  children,
  fallback,
  rootMargin = '220px 0px',
  minHeightClass = 'min-h-[240px]',
  id,
}) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = React.useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
      return true;
    }
    return false;
  });

  React.useEffect(() => {
    if (isVisible) return;
    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold: 0.01 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [isVisible, rootMargin]);

  return (
    <div ref={containerRef} id={id} data-lazy-loaded={isVisible ? 'true' : 'false'}>
      {isVisible
        ? children
        : fallback || (
            <div
              className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${minHeightClass} flex items-center justify-center`}
              aria-busy="true"
              aria-label="Memuat bagian halaman..."
            >
              <div className="w-full rounded-3xl border border-slate-200/70 dark:border-slate-800/70 bg-white/60 dark:bg-slate-900/60 p-8 animate-pulse space-y-4">
                <div className="h-5 w-52 rounded-lg bg-slate-200 dark:bg-slate-800" />
                <div className="h-3 w-72 rounded bg-slate-200/80 dark:bg-slate-800/80" />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="h-36 rounded-2xl bg-slate-200/70 dark:bg-slate-800/70" />
                  <div className="h-36 rounded-2xl bg-slate-200/70 dark:bg-slate-800/70" />
                  <div className="h-36 rounded-2xl bg-slate-200/70 dark:bg-slate-800/70" />
                </div>
              </div>
            </div>
          )}
    </div>
  );
};
