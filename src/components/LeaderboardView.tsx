import React from 'react';
import { LeaderboardEntry } from '../types';
import { Trophy, Medal, Sparkles, Search, Filter, RefreshCw, Zap } from 'lucide-react';
import { getPlayerTier } from '../utils/gameLogic';
import { playCorrectSound } from '../utils/soundEffects';

interface LeaderboardViewProps {
  entries: LeaderboardEntry[];
  isLoading: boolean;
  onRefresh: () => void;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  entries,
  isLoading,
  onRefresh,
}) => {
  const [search, setSearch] = React.useState('');
  const [filterPeriod, setFilterPeriod] = React.useState<'all' | 'weekly' | 'monthly'>('all');
  const [filterGame, setFilterGame] = React.useState<string>('all');

  const filteredEntries = entries.filter((e) => {
    const matchesSearch =
      search === '' ||
      e.userName.toLowerCase().includes(search.toLowerCase()) ||
      (e.school && e.school.toLowerCase().includes(search.toLowerCase()));

    const matchesGame = filterGame === 'all' || e.gameTitle === filterGame;

    return matchesSearch && matchesGame;
  });

  const top1 = filteredEntries[0];
  const top2 = filteredEntries[1];
  const top3 = filteredEntries[2];
  const restEntries = filteredEntries.slice(3);

  // Extract unique games for filtering
  const uniqueGames = Array.from(new Set(entries.map((e) => e.gameTitle)));

  return (
    <div className="space-y-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header & Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-semibold mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block -ml-3.5" />
            <span>Papan Peringkat Real-Time SQL</span>
          </div>
          <h2 className="font-heading font-extrabold text-2xl sm:text-4xl text-slate-900 dark:text-white">
            Papan Peringkat Kebijaksanaan Dharma
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Skor terpusat seluruh siswa dan vihara di Indonesia. Tersinkronisasi otomatis antarperangkat secara real-time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              playCorrectSound();
              onRefresh();
            }}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-amber-500 text-xs font-semibold flex items-center gap-1.5 transition"
            title="Muat Ulang Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-500' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <div className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-2 shadow-sm">
            <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            <span className="hidden sm:inline">Skor Dicatat Otomatis Saat Game Selesai</span>
            <span className="sm:hidden">Skor Otomatis</span>
          </div>
        </div>
      </div>

      {/* Top 3 Champions Podium */}
      {filteredEntries.length >= 1 && (
        <div className="relative pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end max-w-4xl mx-auto">
            {/* Rank 2 (Silver) */}
            {top2 ? (
              <div className="order-2 md:order-1 bg-white dark:bg-slate-900 rounded-3xl p-6 border-2 border-slate-300 dark:border-slate-700 shadow-md flex flex-col items-center text-center relative overflow-hidden group hover:scale-[1.02] transition-transform">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-slate-400 to-slate-200" />
                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm flex items-center justify-center mb-2 shadow-inner">
                  2
                </div>
                <img
                  src={top2.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${top2.userName}`}
                  alt={top2.userName}
                  className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 object-cover p-1 border-2 border-slate-300 shadow"
                />
                <h4 className="font-heading font-bold text-base text-slate-900 dark:text-white mt-3 leading-tight">
                  {top2.userName}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  {top2.school || 'Umum'}
                </p>
                <div className="mt-3 py-1.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-full">
                  <span className="font-mono font-bold text-lg text-slate-800 dark:text-slate-100 tabular-nums">
                    {top2.score}
                  </span>
                  <span className="text-[11px] text-slate-500 ml-1">pts</span>
                </div>
                <div className="text-[10px] text-slate-500 font-medium mt-1">
                  +{top2.xpEarned} XP · {top2.badge}
                </div>
              </div>
            ) : <div className="order-2 md:order-1" />}

            {/* Rank 1 (Gold Paramita Champion) */}
            {top1 && (
              <div className="order-1 md:order-2 bg-gradient-to-b from-amber-500/10 via-white to-white dark:from-amber-950/40 dark:via-slate-900 dark:to-slate-900 rounded-3xl p-7 border-2 border-amber-500 shadow-xl flex flex-col items-center text-center relative overflow-hidden group hover:scale-[1.03] transition-transform">
                <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-500 to-orange-500" />
                <div className="flex items-center gap-1 text-amber-500 mb-1">
                  <Trophy className="w-5 h-5 fill-amber-500" />
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="w-9 h-9 rounded-full bg-amber-500 text-white font-extrabold text-sm flex items-center justify-center mb-2 shadow-md shadow-amber-500/30">
                  1
                </div>
                <img
                  src={top1.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${top1.userName}`}
                  alt={top1.userName}
                  className="w-20 h-20 rounded-2xl bg-amber-500/10 object-cover p-1 border-2 border-amber-500 shadow-lg shadow-amber-500/20"
                />
                <h4 className="font-heading font-extrabold text-lg text-slate-900 dark:text-white mt-3 leading-tight">
                  {top1.userName}
                </h4>
                <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
                  {top1.school || 'Umum'}
                </p>
                <div className="mt-3 py-2 px-5 rounded-xl bg-amber-500/10 border border-amber-500/30 w-full">
                  <span className="font-mono font-black text-2xl text-amber-600 dark:text-amber-400 tabular-nums">
                    {top1.score}
                  </span>
                  <span className="text-xs text-amber-700 dark:text-amber-300 font-bold ml-1">pts</span>
                </div>
                <div className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold mt-1.5">
                  +{top1.xpEarned} XP · {top1.badge}
                </div>
              </div>
            )}

            {/* Rank 3 (Bronze) */}
            {top3 ? (
              <div className="order-3 bg-white dark:bg-slate-900 rounded-3xl p-6 border-2 border-amber-700/40 dark:border-amber-800 shadow-md flex flex-col items-center text-center relative overflow-hidden group hover:scale-[1.02] transition-transform">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-700 to-amber-900" />
                <div className="w-8 h-8 rounded-full bg-amber-900/10 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-bold text-sm flex items-center justify-center mb-2 shadow-inner">
                  3
                </div>
                <img
                  src={top3.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${top3.userName}`}
                  alt={top3.userName}
                  className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 object-cover p-1 border-2 border-amber-700/50 shadow"
                />
                <h4 className="font-heading font-bold text-base text-slate-900 dark:text-white mt-3 leading-tight">
                  {top3.userName}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  {top3.school || 'Umum'}
                </p>
                <div className="mt-3 py-1.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-full">
                  <span className="font-mono font-bold text-lg text-slate-800 dark:text-slate-100 tabular-nums">
                    {top3.score}
                  </span>
                  <span className="text-[11px] text-slate-500 ml-1">pts</span>
                </div>
                <div className="text-[10px] text-slate-500 font-medium mt-1">
                  +{top3.xpEarned} XP · {top3.badge}
                </div>
              </div>
            ) : <div className="order-3" />}
          </div>
        </div>
      )}

      {/* Filter and Search Controls */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
        {/* Search */}
        <div className="sm:col-span-5 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari siswa atau sekolah / vihara..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border-0 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
          />
        </div>

        {/* Filter Game */}
        <div className="sm:col-span-4">
          <select
            value={filterGame}
            onChange={(e) => setFilterGame(e.target.value)}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border-0 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
          >
            <option value="all">Semua Judul Permainan</option>
            {uniqueGames.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        {/* Period Selector (Segmented buttons - Allowed by Frontend Design) */}
        <div className="sm:col-span-3 flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          <button
            onClick={() => setFilterPeriod('all')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              filterPeriod === 'all'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Semua
          </button>
          <button
            onClick={() => setFilterPeriod('weekly')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              filterPeriod === 'weekly'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Mingguan
          </button>
          <button
            onClick={() => setFilterPeriod('monthly')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              filterPeriod === 'monthly'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Bulanan
          </button>
        </div>
      </div>

      {/* Main Ranking Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase text-slate-400">
                <th className="py-3.5 px-4 w-16 text-center">Peringkat</th>
                <th className="py-3.5 px-4">Peserta Didik / Sekolah</th>
                <th className="py-3.5 px-4">Permainan Dimainkan</th>
                <th className="py-3.5 px-4 text-right">Skor Resmi</th>
                <th className="py-3.5 px-4 text-center">XP Perolehan</th>
                <th className="py-3.5 px-4">Gelar Kebijaksanaan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredEntries.map((entry, idx) => {
                const rank = idx + 1;
                const tier = getPlayerTier(rank);
                return (
                  <tr
                    key={entry.id || idx}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors text-xs"
                  >
                    {/* Rank Indicator */}
                    <td className="py-4 px-4 text-center font-bold">
                      {rank === 1 ? (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-500 text-white font-black text-xs shadow-sm">
                          1
                        </span>
                      ) : rank === 2 ? (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-300 dark:bg-slate-600 text-slate-800 dark:text-white font-bold text-xs shadow-sm">
                          2
                        </span>
                      ) : rank === 3 ? (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-800 text-white font-bold text-xs shadow-sm">
                          3
                        </span>
                      ) : (
                        <span className="font-mono text-slate-500 font-semibold tabular-nums">
                          #{rank}
                        </span>
                      )}
                    </td>

                    {/* Player Info */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={entry.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${entry.userName}`}
                          alt={entry.userName}
                          className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 object-cover"
                        />
                        <div>
                          <div className="font-bold text-slate-900 dark:text-slate-100">
                            {entry.userName}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {entry.school || 'Umum / Mandiri'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Game */}
                    <td className="py-4 px-4 text-slate-700 dark:text-slate-300 font-medium">
                      {entry.gameTitle}
                    </td>

                    {/* Score */}
                    <td className="py-4 px-4 text-right">
                      <span className="font-mono font-bold text-sm text-slate-900 dark:text-white tabular-nums">
                        {entry.score}
                      </span>
                    </td>

                    {/* XP Earned */}
                    <td className="py-4 px-4 text-center font-mono font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                      +{entry.xpEarned} XP
                    </td>

                    {/* Wisdom Badge Tier */}
                    <td className="py-4 px-4">
                      <div className="text-xs font-semibold" style={{ color: tier.color }}>
                        {entry.badge}
                      </div>
                      <div className="text-[10px] text-slate-400">{tier.tier}</div>
                    </td>
                  </tr>
                );
              })}

              {filteredEntries.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                    Belum ada data skor yang cocok dengan kriteria pencarian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
