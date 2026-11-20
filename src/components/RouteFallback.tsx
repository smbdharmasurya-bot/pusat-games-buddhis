import React from 'react';

export const RoutePageSkeleton: React.FC<{ label?: string }> = ({ label = 'Memuat halaman...' }) => (
  <div
    className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6 animate-pulse"
    aria-busy="true"
    aria-label={label}
  >
    <div className="space-y-2">
      <div className="h-7 w-64 rounded-xl bg-slate-200 dark:bg-slate-800" />
      <div className="h-4 w-96 max-w-full rounded-lg bg-slate-200/80 dark:bg-slate-800/80" />
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <div className="h-72 rounded-3xl bg-slate-200/70 dark:bg-slate-800/70" />
      <div className="h-72 rounded-3xl bg-slate-200/70 dark:bg-slate-800/70" />
      <div className="h-72 rounded-3xl bg-slate-200/70 dark:bg-slate-800/70" />
    </div>
  </div>
);

export const ModalChunkFallback: React.FC<{ label?: string }> = ({ label = 'Memuat modul...' }) => (
  <div
    className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
    role="status"
    aria-live="polite"
  >
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-5 shadow-2xl flex items-center gap-3">
      <div className="w-5 h-5 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin shrink-0" />
      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{label}</span>
    </div>
  </div>
);
