import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateScoreAndXP,
  getBadgeForXP,
  getPlayerTier,
  filterAndSortGames,
  computeLeaderboardRanks,
  validateVerificationCode,
} from './gameLogic';
import { Game, LeaderboardEntry } from '../types';

test('calculateScoreAndXP applies difficulty multipliers correctly', () => {
  // Easy multiplier = 1.0
  const easy = calculateScoreAndXP(100, 'Mudah', 0, 0);
  assert.equal(easy.score, 100);
  assert.equal(easy.xp, 50);

  // Medium multiplier = 1.5 + streak bonus
  const medium = calculateScoreAndXP(100, 'Sedang', 2, 0);
  assert.equal(medium.score, 170); // 100 * 1.5 + 20 = 170
  assert.equal(medium.xp, 85);

  // Very Hard multiplier = 2.0 with hint penalty
  const hard = calculateScoreAndXP(100, 'Sangat Sulit', 0, 2);
  assert.equal(hard.score, 190); // 100 * 2.0 - 10 = 190
  assert.equal(hard.xp, 95);
});

test('getBadgeForXP assigns appropriate wisdom titles across thresholds', () => {
  assert.equal(getBadgeForXP(50).badge, 'Sahabat Pemula Dharma');
  assert.equal(getBadgeForXP(50).level, 1);

  assert.equal(getBadgeForXP(250).badge, 'Penjelajah Sutta & Tripitaka');
  assert.equal(getBadgeForXP(250).level, 2);

  assert.equal(getBadgeForXP(750).badge, 'Penyelaras Sila & Samadhi');
  assert.equal(getBadgeForXP(750).level, 3);

  assert.equal(getBadgeForXP(1500).badge, 'Penjaga Bodhicitta');
  assert.equal(getBadgeForXP(1500).level, 4);

  assert.equal(getBadgeForXP(3000).badge, 'Maha Pandita Dharma');
  assert.equal(getBadgeForXP(3000).level, 5);
});

test('getPlayerTier maps top ranks to appropriate medals and titles', () => {
  assert.equal(getPlayerTier(1).tier, 'Emas Paramita');
  assert.equal(getPlayerTier(2).tier, 'Perak Bodhi');
  assert.equal(getPlayerTier(3).tier, 'Perunggu Teratai');
  assert.equal(getPlayerTier(7).tier, 'Peringkat Utama');
  assert.equal(getPlayerTier(25).tier, 'Peserta Dharma');
});

test('filterAndSortGames filters accurately by query, category, and difficulty', () => {
  const dummyGames: Game[] = [
    {
      id: 1,
      title: 'Kuis Siddhartha',
      slug: 'kuis-siddhartha',
      category: 'Riwayat Hidup',
      difficulty: 'Mudah',
      type: 'quiz',
      rating: 4.9,
      players: 100,
      description: 'Perjalanan Pangeran Siddhartha',
    },
    {
      id: 2,
      title: 'Memory Candi Borobudur',
      slug: 'memory-borobudur',
      category: 'Tempat Suci',
      difficulty: 'Sedang',
      type: 'memory',
      rating: 4.8,
      players: 200,
      description: 'Pasangkan kartu candi megah',
    },
  ];

  // Search by query
  const res1 = filterAndSortGames(dummyGames, 'Borobudur', 'all', 'all', 'all');
  assert.equal(res1.length, 1);
  assert.equal(res1[0].id, 2);

  // Filter by category
  const res2 = filterAndSortGames(dummyGames, '', 'Riwayat Hidup', 'all', 'all');
  assert.equal(res2.length, 1);
  assert.equal(res2[0].id, 1);

  // Filter by difficulty
  const res3 = filterAndSortGames(dummyGames, '', 'all', 'Sangat Sulit', 'all');
  assert.equal(res3.length, 0);
});

test('computeLeaderboardRanks orders descending by score and assigns rank integers', () => {
  const entries: LeaderboardEntry[] = [
    { id: 1, userName: 'Budi', gameTitle: 'Kuis', score: 200, xpEarned: 100, badge: 'Siswa', createdAt: '2026-03-01' },
    { id: 2, userName: 'Siti', gameTitle: 'Kuis', score: 350, xpEarned: 175, badge: 'Juara', createdAt: '2026-03-01' },
    { id: 3, userName: 'Agus', gameTitle: 'Kuis', score: 280, xpEarned: 140, badge: 'Master', createdAt: '2026-03-01' },
  ];

  const ranked = computeLeaderboardRanks(entries);
  assert.equal(ranked[0].userName, 'Siti');
  assert.equal(ranked[0].rank, 1);
  assert.equal(ranked[1].userName, 'Agus');
  assert.equal(ranked[1].rank, 2);
  assert.equal(ranked[2].userName, 'Budi');
  assert.equal(ranked[2].rank, 3);
});

test('validateVerificationCode accepts valid certificate codes and rejects malformed strings', () => {
  assert.equal(validateVerificationCode('CERT-2026-001'), true);
  assert.equal(validateVerificationCode('CERT-2025-ABC'), true);
  assert.equal(validateVerificationCode('PGB-X87Y2K'), true);
  assert.equal(validateVerificationCode('INVALID_CODE'), false);
  assert.equal(validateVerificationCode(''), false);
});
