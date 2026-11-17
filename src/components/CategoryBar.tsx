import React from 'react';
import { Category, Game } from '../types';
import {
  Sprout,
  Landmark,
  Footprints,
  Gem,
  MapPin,
  ShieldCheck,
  BookOpen,
  Calendar,
  Church,
  Flame,
  Heart,
  Smile,
  HelpCircle,
  Folder,
  FolderOpen,
} from 'lucide-react';
import { playBellSound } from '../utils/soundEffects';
import { countGamesByCategory } from '../utils/categorySync';

interface CategoryBarProps {
  categories: Category[];
  games?: Game[];
  selectedCategory: string;
  onSelectCategory: (name: string) => void;
}

export const CategoryBar: React.FC<CategoryBarProps> = ({
  categories,
  games = [],
  selectedCategory,
  onSelectCategory,
}) => {
  const gameCounts = React.useMemo(
    () => countGamesByCategory(games, categories),
    [games, categories]
  );

  // Map fontawesome names to clean lucide icon components as fallback
  const getLucideIcon = (iconStr: string) => {
    switch (iconStr) {
      case 'fa-seedling':
        return <Sprout className="w-5 h-5" />;
      case 'fa-landmark':
        return <Landmark className="w-5 h-5" />;
      case 'fa-person-walking':
        return <Footprints className="w-5 h-5" />;
      case 'fa-dharmachakra':
        return <span className="text-xl">☸</span>;
      case 'fa-gem':
        return <Gem className="w-5 h-5" />;
      case 'fa-map-signs':
        return <MapPin className="w-5 h-5" />;
      case 'fa-shield-halved':
        return <ShieldCheck className="w-5 h-5" />;
      case 'fa-book-open':
        return <BookOpen className="w-5 h-5" />;
      case 'fa-calendar-day':
        return <Calendar className="w-5 h-5" />;
      case 'fa-place-of-worship':
        return <Church className="w-5 h-5" />;
      case 'fa-gopuram':
        return <Flame className="w-5 h-5" />;
      case 'fa-heart':
        return <Heart className="w-5 h-5" />;
      case 'fa-om':
        return <Smile className="w-5 h-5" />;
      case 'fa-circle-question':
        return <HelpCircle className="w-5 h-5" />;
      default:
        return <Folder className="w-5 h-5" />;
    }
  };

  const renderIcon = (iconStr: string) => {
    if (!iconStr) return <Sprout className="w-5 h-5" />;
    if (iconStr.startsWith('http') || iconStr.startsWith('data:image')) {
      return <img src={iconStr} alt="Category Icon" className="w-6 h-6 object-contain rounded" />;
    }
    return getLucideIcon(iconStr);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading font-bold text-xl text-slate-900 dark:text-white">
            Kategori Pembelajaran Buddhis
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Pilih topik kurikulum Dharma sesuai tingkatan peserta didik
          </p>
        </div>

        {selectedCategory !== 'all' && categories.length > 0 && (
          <button
            onClick={() => onSelectCategory('all')}
            className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
          >
            Tampilkan Semua ({categories.length})
          </button>
        )}
      </div>

      {categories.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
            <FolderOpen className="w-6 h-6" />
          </div>
          <h3 className="font-heading font-bold text-sm text-slate-800 dark:text-slate-200">
            Kategori Pembelajaran Belum Tersedia
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Kategori pembelajaran masih kosong dan akan terisi otomatis secara tersinkronisasi saat pengelola mengunggah game baru atau menambahkan kategori melalui Admin Hub.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.name;
            const count = gameCounts[cat.name] || 0;
            return (
              <button
                type="button"
                key={cat.id || cat.name}
                onClick={() => {
                  playBellSound();
                  onSelectCategory(cat.name);
                }}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-center space-y-2 group ${
                  isSelected
                    ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-600/20'
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700/80 hover:border-amber-500 hover:shadow-sm'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto transition ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:bg-amber-500 group-hover:text-white'
                  }`}
                >
                  {renderIcon(cat.icon)}
                </div>
                <div className="space-y-0.5">
                  <h3 className="font-bold text-xs line-clamp-2 leading-tight">
                    {cat.name}
                  </h3>
                  <p
                    className={`text-[10px] font-semibold tabular-nums ${
                      isSelected ? 'text-amber-100' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {count} Permainan
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
