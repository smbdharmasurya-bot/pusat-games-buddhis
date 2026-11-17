import { Category, Game } from '../types';

/**
 * Normalizes a category name by trimming and collapsing repeated whitespace.
 */
export function normalizeCategoryName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/**
 * Generates a URL-safe slug from a category name.
 */
export function slugifyCategory(name: string): string {
  const normalized = normalizeCategoryName(name);
  return normalized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Finds an existing category matching the input name (case-insensitive, trimmed).
 */
export function resolveCategoryMatch(
  inputName: string,
  categories: Array<Pick<Category, 'id' | 'name'>>
): { matchedCategory: Pick<Category, 'id' | 'name'> | null; normalizedInput: string } {
  const normalizedInput = normalizeCategoryName(inputName);
  if (!normalizedInput) {
    return { matchedCategory: null, normalizedInput: '' };
  }

  const lower = normalizedInput.toLowerCase();
  const match = categories.find((c) => normalizeCategoryName(c.name).toLowerCase() === lower) || null;
  return { matchedCategory: match, normalizedInput };
}

/**
 * Counts how many games belong to each category name (canonicalized).
 */
export function countGamesByCategory(
  games: Game[],
  categories: Category[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const cat of categories) {
    counts[cat.name] = 0;
  }

  for (const game of games) {
    const { matchedCategory } = resolveCategoryMatch(game.category || '', categories);
    if (matchedCategory) {
      counts[matchedCategory.name] = (counts[matchedCategory.name] || 0) + 1;
    } else if (game.category) {
      const normalized = normalizeCategoryName(game.category);
      counts[normalized] = (counts[normalized] || 0) + 1;
    }
  }

  return counts;
}

/**
 * Ensures the currently selected category still exists in the categories list; falls back to 'all'.
 */
export function sanitizeSelectedCategory(selectedCategory: string, categories: Category[]): string {
  if (!selectedCategory || selectedCategory === 'all') return 'all';
  const exists = categories.some(
    (c) => normalizeCategoryName(c.name).toLowerCase() === normalizeCategoryName(selectedCategory).toLowerCase()
  );
  return exists ? selectedCategory : 'all';
}
