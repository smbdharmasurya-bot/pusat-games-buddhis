import React from 'react';
import { SiteSettings, StatsOverview } from '../types';
import { Compass, Trophy, Sparkles, CheckCircle2 } from 'lucide-react';
import { playBellSound } from '../utils/soundEffects';

interface HeroSectionProps {
  settings: SiteSettings;
  stats: StatsOverview;
  onExplore: () => void;
  onOpenLeaderboard: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  settings,
  stats,
  onExplore,
  onOpenLeaderboard,
}) => {
  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-amber-500/10 via-slate-50 to-slate-50 dark:from-amber-950/20 dark:via-slate-950 dark:to-slate-950 pt-10 pb-16 px-4 sm:px-6 lg:px-8 bodhi-pattern border-b border-slate-200/60 dark:border-slate-800/60">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        {/* Left Copy & Actions */}
        <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-semibold border border-amber-500/20">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Platform Digital Edukasi Buddhis Berbasis SQL Terpusat</span>
          </div>

          <h1 className="font-heading font-black text-3xl sm:text-5xl lg:text-6xl tracking-tight text-slate-900 dark:text-white leading-[1.15]">
            PUSAT GAMES <span className="text-amber-600 dark:text-amber-400">BUDDHIS</span>
          </h1>

          <p className="text-base sm:text-lg font-medium text-amber-700 dark:text-amber-300 italic">
            "Belajar Dharma, Bermain dengan Bijak, Bertumbuh dalam Kebijaksanaan."
          </p>

          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
            Jelajahi dunia pembelajaran Agama Buddha melalui permainan digital interaktif. Pelajari sejarah, ajaran Tripitaka, nilai moral Sila, dan meditasi berkesadaran dengan sinkronisasi database pusat dan leaderboard real-time.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
            <button
              onClick={() => {
                playBellSound();
                onExplore();
              }}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-semibold text-sm px-6 py-3.5 rounded-2xl shadow-lg shadow-amber-600/25 hover:shadow-xl transition-all cursor-pointer"
            >
              <span>JELAJAHI GAMES</span>
              <Compass className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                playBellSound();
                onOpenLeaderboard();
              }}
              className="inline-flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-sm px-6 py-3.5 rounded-2xl shadow-sm hover:border-amber-500 hover:text-amber-600 dark:hover:text-amber-400 transition cursor-pointer"
            >
              <span>PAPAN PERINGKAT REAL-TIME</span>
              <Trophy className="w-4 h-4 text-amber-500" />
            </button>
          </div>

          {/* Live SQL Stats Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-slate-200 dark:border-slate-800 text-center lg:text-left">
            <div>
              <div className="font-heading font-black text-2xl text-amber-600 dark:text-amber-400 tabular-nums">
                {stats.totalGames}
              </div>
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Total Permainan
              </div>
            </div>
            <div>
              <div className="font-heading font-black text-2xl text-amber-600 dark:text-amber-400 tabular-nums">
                {stats.totalPlayers}
              </div>
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Total Pemain
              </div>
            </div>
            <div>
              <div className="font-heading font-black text-2xl text-amber-600 dark:text-amber-400 tabular-nums">
                {stats.totalCategories}
              </div>
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Topik Kategori
              </div>
            </div>
            <div>
              <div className="font-heading font-black text-2xl text-amber-600 dark:text-amber-400 tabular-nums">
                {stats.totalLeaderboardEntries}
              </div>
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Skor Tercatat
              </div>
            </div>
          </div>
        </div>

        {/* Right Graphic: Hero Circle Frame with Perimeter Semi-Circular Banners and Clean Center for Photo/Logo */}
        <div className="lg:col-span-5 flex justify-center">
          <div className="relative w-80 h-80 sm:w-96 sm:h-96 rounded-full bg-gradient-to-tr from-amber-500/20 via-orange-400/15 to-transparent p-3 sm:p-4 flex items-center justify-center">
            {/* Spinning decorative halo */}
            <div className="absolute inset-0 rounded-full border-2 border-dashed border-amber-500/30 animate-spin-slow pointer-events-none" />

            {/* Inner Circular Frame */}
            <div className="w-full h-full rounded-full border-2 border-amber-500/40 flex items-center justify-center overflow-hidden relative shadow-xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-xs">
              {/* Uploaded Logo or Image */}
              {settings.imageUrl && settings.imageUrl.trim() !== '' ? (
                <div className="absolute inset-0 flex items-center justify-center p-8">
                  <img
                    src={settings.imageUrl}
                    alt="Logo Hero"
                    className="max-w-full max-h-full object-contain filter drop-shadow-md select-none"
                  />
                </div>
              ) : (
                /* Clean open placeholder when no logo is uploaded yet (no middle circle) */
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 pointer-events-none select-none">
                  <Sparkles className="w-7 h-7 text-amber-500/70 mb-2" />
                  <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                    Area Logo Hero
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 max-w-[190px] mt-1">
                    Unggah logo atau foto sekolah/vihara via Admin Hub
                  </span>
                </div>
              )}

              {/* Semi-Circular Curved Banner Text Positioned at the Outer Perimeter Only */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none select-none z-10"
                viewBox="0 0 340 340"
              >
                <defs>
                  {/* Upper Semi-Circle Path: R = 154, right at the outer perimeter */}
                  <path
                    id="bannerTitleArc"
                    d="M 16,170 A 154,154 0 0,1 324,170"
                    fill="none"
                  />

                  {/* Lower Semi-Circle Path: R = 154, right at the outer perimeter */}
                  <path
                    id="bannerSubtitleArc"
                    d="M 16,170 A 154,154 0 0,0 324,170"
                    fill="none"
                  />

                  {/* Shadow filter for sharp text contrast without dark bands */}
                  <filter id="bannerShadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="1" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.75" />
                  </filter>
                </defs>

                {/* Subtle Outer Guideline along the Extreme Perimeter Only (R = 158) */}
                <circle
                  cx="170"
                  cy="170"
                  r="158"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  className="text-amber-500/25 dark:text-amber-400/20"
                />

                {/* Curved Text: Judul Banner (Outer Rim Only) */}
                <text
                  filter="url(#bannerShadow)"
                  className="fill-amber-600 dark:fill-amber-300 font-heading text-[12px] sm:text-[13px] font-black tracking-[0.24em] uppercase"
                >
                  <textPath
                    href="#bannerTitleArc"
                    startOffset="50%"
                    textAnchor="middle"
                  >
                    {settings.title || 'CANDI & STUPA DHARMA'}
                  </textPath>
                </text>

                {/* Curved Text: Subjudul Banner (Outer Rim Only) */}
                <text
                  filter="url(#bannerShadow)"
                  className="fill-amber-700 dark:fill-amber-400 font-heading text-[9.5px] sm:text-[10.5px] font-bold tracking-[0.20em] uppercase"
                >
                  <textPath
                    href="#bannerSubtitleArc"
                    startOffset="50%"
                    textAnchor="middle"
                  >
                    • {settings.subtitle || 'Nilai Kebijaksanaan & Kemurnian'} •
                  </textPath>
                </text>

                {/* Subtle Diamond Anchor Pins on the Outer Rim */}
                <polygon
                  points="12,170 16,166 20,170 16,174"
                  className="fill-amber-500 dark:fill-amber-400 filter drop-shadow"
                />
                <polygon
                  points="320,170 324,166 328,170 324,174"
                  className="fill-amber-500 dark:fill-amber-400 filter drop-shadow"
                />
              </svg>
            </div>

            {/* Floating Live Sync Chip */}
            <div className="absolute -bottom-2 bg-white dark:bg-slate-800 px-3 py-1 rounded-full shadow-md border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 z-20">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Real-Time Sync Terhubung</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
