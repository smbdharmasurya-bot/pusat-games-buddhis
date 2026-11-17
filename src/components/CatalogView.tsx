import React from 'react';
import { Game, Category } from '../types';
import { GameCard } from './GameCard';
import { Search } from 'lucide-react';

interface CatalogViewProps {
  games: Game[];
  categories: Category[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  onPlay: (game: Game) => void;
}

export const CatalogView: React.FC<CatalogViewProps> = ({
  games,
  categories,
  selectedCategory,
  onSelectCategory,
  onPlay,
}) => {
  const [search, setSearch] = React.useState('');
  const [difficulty, setDifficulty] = React.useState('all');
  const [type, setType] = React.useState('all');

  const filteredGames = games.filter((g) => {
    const matchSearch =
      search === '' ||
      g.title.toLowerCase().includes(search.toLowerCase()) ||
      g.description.toLowerCase().includes(search.toLowerCase());

    const matchCategory = selectedCategory === 'all' || g.category === selectedCategory;
    const matchDifficulty = difficulty === 'all' || g.difficulty === difficulty;
    const matchType = type === 'all' || g.type === type;

    return matchSearch && matchCategory && matchDifficulty && matchType;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white">
          Katalog Permainan Buddhis
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Temukan dan mainkan berbagai game edukasi interaktif Dharma dari database SQL pusat.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* Search Input */}
        <div>
          <label className="text-[11px] font-bold uppercase text-slate-400">Pencarian Game</label>
          <div className="relative mt-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari judul atau topik..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Category Dropdown */}
        <div>
          <label className="text-[11px] font-bold uppercase text-slate-400">Kategori Topik</label>
          <select
            value={selectedCategory}
            onChange={(e) => onSelectCategory(e.target.value)}
            className="w-full mt-1 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
          >
            <option value="all">Semua Kategori ({categories.length})</option>
            {categories.map((c) => (
              <option key={c.id || c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Difficulty */}
        <div>
          <label className="text-[11px] font-bold uppercase text-slate-400">Tingkat Kesulitan</label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="w-full mt-1 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
          >
            <option value="all">Semua Kesulitan</option>
            <option value="Mudah">Mudah</option>
            <option value="Sedang">Sedang</option>
            <option value="Sangat Sulit">Sangat Sulit</option>
          </select>
        </div>

        {/* Type / Engine */}
        <div>
          <label className="text-[11px] font-bold uppercase text-slate-400">Tipe / Engine Game</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full mt-1 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
          >
            <option value="all">Semua Tipe</option>
            <option value="quiz">Kuis Interaktif</option>
            <option value="memory">Memory Card Match</option>
            <option value="html5">HTML5 Portable Code</option>
            <option value="iframe">URL Embed Iframe</option>
          </select>
        </div>
      </div>

      {/* Games Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredGames.map((game) => (
          <GameCard key={game.id} game={game} onPlay={onPlay} />
        ))}
      </div>

      {filteredGames.length === 0 && (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 p-8 space-y-2">
          {games.length === 0 ? (
            <>
              <p className="text-slate-700 dark:text-slate-200 font-bold text-sm">
                Belum Ada Permainan di Katalog
              </p>
              <p className="text-slate-400 text-xs max-w-md mx-auto">
                Permainan dan kategori masih kosong. Pengelola dapat mengunggah permainan baru beserta kategorinya melalui Admin Hub.
              </p>
            </>
          ) : (
            <>
              <p className="text-slate-400 font-medium text-sm">
                Tidak ada game yang sesuai dengan filter pencarian.
              </p>
              <button
                onClick={() => {
                  setSearch('');
                  onSelectCategory('all');
                  setDifficulty('all');
                  setType('all');
                }}
                className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
              >
                Reset Semua Filter
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
