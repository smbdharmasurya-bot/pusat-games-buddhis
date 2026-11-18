import { Game, LeaderboardEntry } from '../types';
import { calculateScoreAndXP } from './gameLogic';

export interface AutoCloseScoreInput {
  gameType: Game['type'];
  difficulty: Game['difficulty'];
  quizScore: number;
  streak: number;
  matchedPairs: number;
  detectedPortableScore: number;
  playDurationSeconds: number;
}

export function resolveAutoCloseScore(input: AutoCloseScoreInput): { score: number; xp: number } {
  const duration = Math.max(1, Math.floor(input.playDurationSeconds || 0));

  if (input.gameType === 'quiz') {
    if (input.quizScore > 0) {
      return calculateScoreAndXP(input.quizScore, input.difficulty, input.streak);
    }
    const baseScore = 0;
    return { score: baseScore, xp: 0 };
  }

  if (input.gameType === 'memory') {
    if (input.matchedPairs > 0) {
      const baseMemoryScore = Math.max(50, input.matchedPairs * 60);
      return calculateScoreAndXP(baseMemoryScore, input.difficulty, input.matchedPairs);
    }
    return { score: 0, xp: 0 };
  }

  // Portable HTML5 or Iframe games
  if (input.detectedPortableScore > 0) {
    const score = Math.round(input.detectedPortableScore);
    return { score, xp: Math.max(1, Math.round(score * 0.5)) };
  }

  // Automatic duration-based score when HTML5/iframe game is closed without DOM score
  const autoScore = Math.max(10, Math.min(500, duration * 10));
  return { score: autoScore, xp: Math.max(5, Math.round(autoScore * 0.5)) };
}

export function findMatchingActiveGame(
  entry: Pick<LeaderboardEntry, 'gameId' | 'gameTitle'>,
  activeGames: Game[]
): Game | undefined {
  if (entry.gameId !== undefined && entry.gameId !== null) {
    const byId = activeGames.find((g) => g.id === entry.gameId && g.isActive !== false);
    if (byId) return byId;
  }
  const targetTitle = String(entry.gameTitle || '').trim().toLowerCase();
  if (!targetTitle) return undefined;
  return activeGames.find(
    (g) => g.isActive !== false && g.title.trim().toLowerCase() === targetTitle
  );
}

export function filterActiveGamesLeaderboard(
  entries: LeaderboardEntry[],
  games: Game[]
): LeaderboardEntry[] {
  const activeGames = games.filter((g) => g.isActive !== false);
  const result: LeaderboardEntry[] = [];

  for (const entry of entries) {
    const matched = findMatchingActiveGame(entry, activeGames);
    if (matched) {
      result.push({
        ...entry,
        gameId: matched.id,
        gameTitle: matched.title,
      });
    }
  }
  return result;
}

export function getEvaluatableGameOptions(games: Game[]): Game[] {
  return games
    .filter((g) => g.isActive !== false && Boolean(g.title && g.title.trim()))
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title, 'id'));
}

export function getResettableLeaderboardGameNames(
  games: Game[],
  entries: LeaderboardEntry[]
): string[] {
  const activeGames = games.filter((g) => g.isActive !== false);
  const seen = new Set<string>();
  const names: string[] = [];

  // Prioritize active games that actually have opened/recorded leaderboard entries
  for (const entry of entries) {
    const matched = findMatchingActiveGame(entry, activeGames);
    if (matched && !seen.has(matched.title)) {
      seen.add(matched.title);
      names.push(matched.title);
    }
  }

  // Also include all other currently active uploaded games so admin can manage/filter them
  for (const g of activeGames) {
    if (!seen.has(g.title)) {
      seen.add(g.title);
      names.push(g.title);
    }
  }

  return names;
}
