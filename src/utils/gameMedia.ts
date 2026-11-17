export const DEFAULT_GAME_THUMBNAIL =
  'https://images.unsplash.com/photo-1609743522653-52354461eb27?auto=format&fit=crop&w=600&q=80';

export const DEFAULT_GAME_ICON = '🎮';

export const GAME_ICON_PRESETS: Array<{ value: string; label: string }> = [
  { value: '🎮', label: 'Gamepad' },
  { value: '🪷', label: 'Teratai' },
  { value: '☸️', label: 'Roda Dharma' },
  { value: '📿', label: 'Mala' },
  { value: '🏛️', label: 'Candi' },
  { value: '📖', label: 'Kitab' },
  { value: '🧘', label: 'Meditasi' },
  { value: '🛡️', label: 'Sila' },
  { value: '⭐', label: 'Bintang' },
  { value: '🏆', label: 'Juara' },
  { value: '🧩', label: 'Puzzle' },
  { value: '🧠', label: 'Kuis' },
];

export function normalizeGameMediaValue(value?: string | null): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

export function isImageMediaSource(value?: string | null): boolean {
  const normalized = normalizeGameMediaValue(value);
  if (!normalized) return false;
  return (
    normalized.startsWith('http://') ||
    normalized.startsWith('https://') ||
    normalized.startsWith('data:image/') ||
    normalized.startsWith('/')
  );
}

export function hasCustomThumbnail(thumbnail?: string | null): boolean {
  return normalizeGameMediaValue(thumbnail).length > 0;
}

export function resolveGameThumbnail(thumbnail?: string | null, hasImageError = false): string {
  const normalized = normalizeGameMediaValue(thumbnail);
  if (!hasImageError && normalized) {
    return normalized;
  }
  return DEFAULT_GAME_THUMBNAIL;
}

export function resolveGameIcon(icon?: string | null): {
  kind: 'image' | 'text' | 'default';
  value: string;
} {
  const normalized = normalizeGameMediaValue(icon);
  if (!normalized) {
    return { kind: 'default', value: DEFAULT_GAME_ICON };
  }
  if (isImageMediaSource(normalized)) {
    return { kind: 'image', value: normalized };
  }
  return { kind: 'text', value: normalized };
}

export function mergeGameMediaPatch(
  existing: { thumbnail?: string | null; icon?: string | null },
  patch: { thumbnail?: string | null; icon?: string | null }
): { thumbnail: string; icon: string } {
  const nextThumbnail =
    patch.thumbnail !== undefined
      ? normalizeGameMediaValue(patch.thumbnail)
      : normalizeGameMediaValue(existing.thumbnail);

  const nextIcon =
    patch.icon !== undefined
      ? normalizeGameMediaValue(patch.icon)
      : normalizeGameMediaValue(existing.icon);

  return {
    thumbnail: nextThumbnail,
    icon: nextIcon,
  };
}
