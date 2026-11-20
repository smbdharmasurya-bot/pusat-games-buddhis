import React from 'react';
import { Game } from '../types';
import { GameCard } from './GameCard';
import { ArrowRight, Trophy, Sparkles, Gamepad2 } from 'lucide-react';
import { playBellSound } from '../utils/soundEffects';

interface HomeShowcaseSectionProps {
  featuredGames: Game[];
  totalActiveGames: number;
  onPlayGame: (game: Game) => void;
  onOpenCatalog: () => void;
  onOpenLeaderboard: () => void;
}

export const HomeShowcaseSection: React.FC<HomeShowcaseSectionProps> = ({
  featuredGames,
  totalActiveGames,
  onPlayGame,
  onOpenCatalog,
  onOpenLeaderboard,
}) => {
  return (
    <div className="space-y-16">
      {/* Featured Games Showcase */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading font-extrabold text-2xl text-slate-900 dark:text-white">
              Permainan Edukasi Pilihan Terbaik
            </h2>
            <p className="text-xs text-slate-500">
              Game interaktif paling disukai peserta didik dengan rating tertinggi
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              playBellSound();
              onOpenCatalog();
            }}
            className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Lihat Semua ({totalActiveGames})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {featuredGames.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center space-y-2.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <Gamepad2 className="w-6 h-6" />
            </div>
            <h3 className="font-heading font-bold text-sm text-slate-800 dark:text-slate-200">
              Belum Ada Permainan yang Diunggah
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Daftar permainan edukasi masih kosong. Pengelola dapat mengunggah permainan baru melalui Admin Hub agar langsung muncul dan tersinkronisasi dengan kategorinya.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredGames.slice(0, 6).map((game) => (
              <GameCard key={game.id} game={game} onPlay={onPlayGame} />
            ))}
          </div>
        )}
      </div>

      {/* Live Leaderboard Snippet on Homepage */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-transparent p-6 sm:p-8 rounded-3xl border border-amber-500/20 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs font-bold">
              <Trophy className="w-4 h-4 text-amber-500" />
              <span>Papan Peringkat Real-Time Nasional</span>
            </div>
            <h3 className="font-heading font-extrabold text-xl sm:text-2xl text-slate-900 dark:text-white">
              Jadilah Juara Kebijaksanaan Dharma Hari Ini!
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-xl">
              Kumpulkan XP dari setiap permainan edukasi interaktif. Posisi juara 1 berhak mendapatkan gelar Emas Paramita dan sertifikat digital resmi.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              playBellSound();
              onOpenLeaderboard();
            }}
            className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 text-white font-bold text-xs shadow-lg shadow-amber-600/25 hover:shadow-xl transition cursor-pointer whitespace-nowrap flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>Buka Papan Peringkat Lengkap</span>
          </button>
        </div>
      </div>
    </div>
  );
};
