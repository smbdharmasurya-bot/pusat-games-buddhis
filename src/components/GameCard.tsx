import React from 'react';
import { Game } from '../types';
import { Play, Star, Users, Crown } from 'lucide-react';
import { playBellSound } from '../utils/soundEffects';
import { resolveGameThumbnail } from '../utils/gameMedia';
import { GameIconBadge } from './GameIconBadge';

interface GameCardProps {
  game: Game;
  onPlay: (game: Game) => void;
}

export const GameCard: React.FC<GameCardProps> = ({ game, onPlay }) => {
  const [imgError, setImgError] = React.useState(false);

  React.useEffect(() => {
    setImgError(false);
  }, [game.thumbnail]);

  const thumbUrl = resolveGameThumbnail(game.thumbnail, imgError);

  const handlePlay = () => {
    playBellSound();
    onPlay(game);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-xl hover:border-amber-500/50 transition-all flex flex-col justify-between group">
      <div>
        {/* Thumbnail Viewport (Clickable to Play) */}
        <button
          type="button"
          onClick={handlePlay}
          aria-label={`Mainkan ${game.title} melalui gambar thumbnail`}
          title={`Mainkan ${game.title}`}
          className="relative h-44 w-full overflow-hidden bg-slate-900 block text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500"
        >
          <img
            src={thumbUrl}
            alt={game.title}
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
          />
          <span className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none block" />

          {/* Hover Play Cue */}
          <span className="absolute inset-0 flex items-center justify-center bg-slate-950/0 group-hover:bg-slate-950/25 transition pointer-events-none">
            <span className="w-11 h-11 rounded-full bg-amber-500/90 text-white flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 transition">
              <Play className="w-5 h-5 fill-white ml-0.5" />
            </span>
          </span>

          {/* Top Status */}
          <span className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
            <span className="text-[11px] font-semibold bg-slate-900/80 backdrop-blur-md text-amber-300 px-3 py-1 rounded-full border border-amber-500/20">
              {game.category}
            </span>
            {game.isPremium ? (
              <span className="text-[10px] bg-amber-500 text-white font-bold px-2.5 py-0.5 rounded-full shadow-md flex items-center gap-1">
                <Crown className="w-3 h-3" /> PRO
              </span>
            ) : (
              <span className="text-[10px] bg-emerald-600/90 text-white font-bold px-2.5 py-0.5 rounded-full shadow-md">
                GRATIS
              </span>
            )}
          </span>

          {/* Bottom Thumbnail Overlay Readouts */}
          <span className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs font-medium pointer-events-none">
            <span className="bg-slate-950/70 backdrop-blur-md px-2.5 py-1 rounded-xl text-[11px] flex items-center gap-1 tabular-nums">
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              {game.rating}
            </span>
            <span className="bg-slate-950/70 backdrop-blur-md px-2.5 py-1 rounded-xl text-[11px] flex items-center gap-1 tabular-nums">
              <Users className="w-3 h-3 text-slate-300" />
              {game.players} Pemain
            </span>
          </span>
        </button>

        {/* Card Body */}
        <div className="p-5 space-y-2">
          {/* Unboxed Metadata Line (Zero-Pill Discipline) */}
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>{game.difficulty}</span>
            <span aria-hidden="true">·</span>
            <span className="uppercase">{game.type}</span>
            <span aria-hidden="true">·</span>
            <span className="text-amber-600 dark:text-amber-400 font-semibold">{game.category}</span>
          </div>

          <div className="flex items-center gap-2.5">
            <GameIconBadge icon={game.icon} title={`Ikon ${game.title}`} size="sm" />
            <h3 className="font-heading font-bold text-base text-slate-900 dark:text-white leading-snug line-clamp-2 flex-1 min-w-0">
              <button
                type="button"
                onClick={handlePlay}
                title={`Mainkan ${game.title}`}
                className="text-left hover:text-amber-600 dark:hover:text-amber-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition cursor-pointer focus:outline-none focus-visible:underline"
              >
                {game.title}
              </button>
            </h3>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
            {game.description}
          </p>
        </div>
      </div>

      {/* Card Action Footer */}
      <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400 uppercase bg-slate-200/70 dark:bg-slate-800 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
          <GameIconBadge icon={game.icon} title={`Ikon ${game.title}`} size="xs" />
          <span>{game.type}</span>
        </span>

        <button
          type="button"
          onClick={handlePlay}
          className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-md shadow-amber-600/20 transition cursor-pointer"
        >
          <span>Mainkan</span>
          <Play className="w-3.5 h-3.5 fill-white" />
        </button>
      </div>
    </div>
  );
};


