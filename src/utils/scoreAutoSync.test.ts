import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterActiveGamesLeaderboard,
  getEvaluatableGameOptions,
  getResettableLeaderboardGameNames,
  resolveAutoCloseScore,
} from './scoreAutoSync';
import { Game, LeaderboardEntry } from '../types';

const sampleGames: Game[] = [
  {
    id: 1,
    title: 'Kuis Jalan Mulia',
    slug: 'kuis-jalan-mulia',
    category: 'Dharma',
    difficulty: 'Mudah',
    type: 'quiz',
    rating: 5,
    players: 3,
    thumbnail: '',
    description: 'Kuis',
    isPremium: false,
    isActive: true,
    featured: true,
  },
  {
    id: 2,
    title: 'Game Nonaktif Lama',
    slug: 'game-nonaktif-lama',
    category: 'Dharma',
    difficulty: 'Sedang',
    type: 'html5',
    rating: 4.5,
    players: 1,
    thumbnail: '',
    description: 'Nonaktif',
    isPremium: false,
    isActive: false,
    featured: false,
  },
];

test('resolveAutoCloseScore preserves detected HTML5 score or falls back to duration-based score', () => {
  const fromDom = resolveAutoCloseScore({
    gameType: 'html5',
    difficulty: 'Mudah',
    quizScore: 0,
    streak: 0,
    matchedPairs: 0,
    detectedPortableScore: 340,
    playDurationSeconds: 12,
  });
  assert.deepEqual(fromDom, { score: 340, xp: 170 });

  const fromDuration = resolveAutoCloseScore({
    gameType: 'html5',
    difficulty: 'Sedang',
    quizScore: 0,
    streak: 0,
    matchedPairs: 0,
    detectedPortableScore: 0,
    playDurationSeconds: 8,
  });
  assert.deepEqual(fromDuration, { score: 80, xp: 40 });
});

test('resolveAutoCloseScore computes quiz and memory scores accurately when closing mid-game', () => {
  const quiz = resolveAutoCloseScore({
    gameType: 'quiz',
    difficulty: 'Mudah',
    quizScore: 120,
    streak: 1,
    matchedPairs: 0,
    detectedPortableScore: 0,
    playDurationSeconds: 15,
  });
  assert.equal(quiz.score, 130);
  assert.equal(quiz.xp, 65);

  const memory = resolveAutoCloseScore({
    gameType: 'memory',
    difficulty: 'Mudah',
    quizScore: 0,
    streak: 0,
    matchedPairs: 3,
    detectedPortableScore: 0,
    playDurationSeconds: 20,
  });
  assert.equal(memory.score, 210);
  assert.equal(memory.xp, 105);
});

test('filterActiveGamesLeaderboard removes old/inactive games and keeps only active games', () => {
  const entries: LeaderboardEntry[] = [
    {
      id: 1,
      userName: 'Siswa A',
      gameId: 1,
      gameTitle: 'Judul Lama Sebelum Rename',
      score: 200,
      xpEarned: 100,
      badge: 'Pemula',
      createdAt: '2026-11-17T00:00:00Z',
    },
    {
      id: 2,
      userName: 'Siswa B',
      gameId: 2,
      gameTitle: 'Game Nonaktif Lama',
      score: 500,
      xpEarned: 250,
      badge: 'Pandita',
      createdAt: '2026-11-17T00:00:00Z',
    },
    {
      id: 3,
      userName: 'Siswa C',
      gameTitle: 'Kuis Perjalanan Siddhartha',
      score: 980,
      xpEarned: 490,
      badge: 'Pandita',
      createdAt: '2026-11-17T00:00:00Z',
    },
  ];

  const filtered = filterActiveGamesLeaderboard(entries, sampleGames);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].userName, 'Siswa A');
  assert.equal(filtered[0].gameTitle, 'Kuis Jalan Mulia');
});

test('getEvaluatableGameOptions and getResettableLeaderboardGameNames list only active uploaded games', () => {
  const evalOptions = getEvaluatableGameOptions(sampleGames);
  assert.deepEqual(
    evalOptions.map((g) => g.title),
    ['Kuis Jalan Mulia']
  );

  const resetNames = getResettableLeaderboardGameNames(sampleGames, [
    {
      id: 99,
      userName: 'X',
      gameTitle: 'Game Dihapus Lama',
      score: 999,
      xpEarned: 400,
      badge: 'B',
      createdAt: '2026-11-17T00:00:00Z',
    },
  ]);
  assert.deepEqual(resetNames, ['Kuis Jalan Mulia']);
});
