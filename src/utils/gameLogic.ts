import { Game, LeaderboardEntry } from '../types';

/**
 * Calculates game score and XP gained based on correct answers, difficulty, and streak.
 */
export function calculateScoreAndXP(
  baseScore: number,
  difficulty: 'Mudah' | 'Sedang' | 'Sangat Sulit',
  streak: number = 0,
  hintsUsed: number = 0
): { score: number; xp: number } {
  let multiplier = 1.0;
  if (difficulty === 'Sedang') multiplier = 1.5;
  if (difficulty === 'Sangat Sulit') multiplier = 2.0;

  const streakBonus = Math.min(streak * 10, 50);
  const hintPenalty = Math.min(hintsUsed * 5, 25);

  const rawScore = Math.max(0, Math.round(baseScore * multiplier + streakBonus - hintPenalty));
  const xp = Math.max(10, Math.round(rawScore * 0.5));

  return { score: rawScore, xp };
}

/**
 * Determines a student's Dharma Wisdom Badge based on cumulative XP.
 */
export function getBadgeForXP(xp: number): { badge: string; level: number; nextLevelXP: number } {
  if (xp >= 2000) return { badge: 'Maha Pandita Dharma', level: 5, nextLevelXP: 3000 };
  if (xp >= 1000) return { badge: 'Penjaga Bodhicitta', level: 4, nextLevelXP: 2000 };
  if (xp >= 500) return { badge: 'Penyelaras Sila & Samadhi', level: 3, nextLevelXP: 1000 };
  if (xp >= 200) return { badge: 'Penjelajah Sutta & Tripitaka', level: 2, nextLevelXP: 500 };
  return { badge: 'Sahabat Pemula Dharma', level: 1, nextLevelXP: 200 };
}

/**
 * Assigns tier bracket based on leaderboard rank and total participant count.
 */
export function getPlayerTier(rank: number): { tier: string; color: string } {
  if (rank === 1) return { tier: 'Emas Paramita', color: '#D97706' };
  if (rank === 2) return { tier: 'Perak Bodhi', color: '#64748B' };
  if (rank === 3) return { tier: 'Perunggu Teratai', color: '#B45309' };
  if (rank <= 10) return { tier: 'Peringkat Utama', color: '#2563EB' };
  return { tier: 'Peserta Dharma', color: '#475569' };
}

/**
 * Filters and searches game catalogue.
 */
export function filterAndSortGames(
  games: Game[],
  query: string,
  category: string,
  difficulty: string,
  type: string
): Game[] {
  const normalizedQuery = query.trim().toLowerCase();

  return games.filter((game) => {
    const matchesQuery =
      normalizedQuery === '' ||
      game.title.toLowerCase().includes(normalizedQuery) ||
      game.description.toLowerCase().includes(normalizedQuery) ||
      game.category.toLowerCase().includes(normalizedQuery);

    const matchesCategory = category === 'all' || game.category === category;
    const matchesDifficulty = difficulty === 'all' || game.difficulty === difficulty;
    const matchesType = type === 'all' || game.type === type;

    return matchesQuery && matchesCategory && matchesDifficulty && matchesType;
  });
}

/**
 * Calculates rank ordering for leaderboard entries.
 */
export function computeLeaderboardRanks(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  const sorted = [...entries].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.xpEarned - a.xpEarned;
  });

  return sorted.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
}

/**
 * Validates Buddhist Learning certificate verification code format.
 */
export function validateVerificationCode(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  const trimmed = code.trim().toUpperCase();
  // Valid format: CERT-YYYY-XXX or PGB-XXXXXX
  const pattern = /^(CERT-\d{4}-\w{3,8}|PGB-[A-Z0-9]{4,10})$/;
  return pattern.test(trimmed);
}
