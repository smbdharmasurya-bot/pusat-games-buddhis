import React from 'react';
import { Gamepad2 } from 'lucide-react';
import { resolveGameIcon } from '../utils/gameMedia';

interface GameIconBadgeProps {
  icon?: string | null;
  title?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<GameIconBadgeProps['size']>, { box: string; text: string; lucide: string }> = {
  xs: { box: 'w-5 h-5 rounded-md', text: 'text-xs', lucide: 'w-3 h-3' },
  sm: { box: 'w-7 h-7 rounded-lg', text: 'text-sm', lucide: 'w-3.5 h-3.5' },
  md: { box: 'w-9 h-9 rounded-xl', text: 'text-base', lucide: 'w-4 h-4' },
  lg: { box: 'w-12 h-12 rounded-2xl', text: 'text-2xl', lucide: 'w-6 h-6' },
};

export const GameIconBadge: React.FC<GameIconBadgeProps> = ({
  icon,
  title = 'Ikon Game',
  size = 'sm',
  className = '',
}) => {
  const [imgFailed, setImgFailed] = React.useState(false);

  React.useEffect(() => {
    setImgFailed(false);
  }, [icon]);

  const resolved = resolveGameIcon(icon);
  const dims = SIZE_CLASSES[size];

  if (resolved.kind === 'image' && !imgFailed) {
    return (
      <div
        className={`${dims.box} overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 ${className}`}
        title={title}
      >
        <img
          src={resolved.value}
          alt={title}
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  if (resolved.kind === 'text') {
    return (
      <div
        className={`${dims.box} bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25 flex items-center justify-center font-bold leading-none shrink-0 select-none ${dims.text} ${className}`}
        title={title}
      >
        <span>{resolved.value}</span>
      </div>
    );
  }

  return (
    <div
      className={`${dims.box} bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0 ${className}`}
      title={title}
    >
      <Gamepad2 className={dims.lucide} />
    </div>
  );
};
