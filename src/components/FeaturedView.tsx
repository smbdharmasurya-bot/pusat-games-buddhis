import React from 'react';
import { Game } from '../types';
import { GameCard } from './GameCard';
import { Sparkles, CheckCircle } from 'lucide-react';

interface FeaturedViewProps {
  games: Game[];
  onPlay: (game: Game) => void;
}

export const FeaturedView: React.FC<FeaturedViewProps> = ({ games, onPlay }) => {
  const featuredGames = games.filter((g) => g.featured || g.rating >= 4.85);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-transparent p-6 rounded-3xl border border-amber-500/20">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 text-xs font-semibold mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Kurikulum Terverifikasi Dewan Guru Buddhis</span>
        </div>
        <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white">
          Game Unggulan Rekomendasi Guru & Vihara
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-2xl">
          Koleksi permainan edukasi terpilih dengan tingkat keterlibatan tertinggi, dirancang khusus untuk memperdalam pemahaman Dharma secara kontekstual dan menyenangkan.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 mt-2 border-t border-amber-500/20 text-xs text-slate-700 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Materi akurat sesuai Tripitaka</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Mendukung Penilaian Berkelanjutan & XP</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Tersinkronisasi ke Papan Peringkat</span>
          </div>
        </div>
      </div>

      {featuredGames.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 p-8 space-y-2">
          <p className="text-slate-700 dark:text-slate-200 font-bold text-sm">
            Belum Ada Permainan Unggulan
          </p>
          <p className="text-slate-400 text-xs max-w-md mx-auto">
            Game unggulan akan tampil di halaman ini setelah pengelola mengunggah game pembelajaran baru.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuredGames.map((game) => (
            <GameCard key={game.id} game={game} onPlay={onPlay} />
          ))}
        </div>
      )}
    </div>
  );
};
