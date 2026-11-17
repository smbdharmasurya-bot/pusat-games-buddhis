import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCategoryName,
  slugifyCategory,
  resolveCategoryMatch,
  countGamesByCategory,
  sanitizeSelectedCategory,
} from './categorySync';
import { Category, Game } from '../types';

test('normalizeCategoryName trims and collapses spaces', () => {
  assert.equal(normalizeCategoryName('  Sila   &   Etika  '), 'Sila & Etika');
  assert.equal(normalizeCategoryName('   '), '');
});

test('slugifyCategory generates clean slugs', () => {
  assert.equal(slugifyCategory('Sejarah Agama Buddha'), 'sejarah-agama-buddha');
  assert.equal(slugifyCategory('  Empat Kebenaran Mulia! '), 'empat-kebenaran-mulia');
});

test('resolveCategoryMatch performs case-insensitive canonical lookup', () => {
  const categories = [
    { id: 1, name: 'Sila & Etika Buddhis' },
    { id: 2, name: 'Sejarah Vihara' },
  ];

  const match1 = resolveCategoryMatch('  sila & etika buddhis ', categories);
  assert.equal(match1.matchedCategory?.name, 'Sila & Etika Buddhis');
  assert.equal(match1.normalizedInput, 'sila & etika buddhis');

  const match2 = resolveCategoryMatch('Meditasi Harian', categories);
  assert.equal(match2.matchedCategory, null);
  assert.equal(match2.normalizedInput, 'Meditasi Harian');

  const empty = resolveCategoryMatch('   ', categories);
  assert.equal(empty.matchedCategory, null);
  assert.equal(empty.normalizedInput, '');
});

test('countGamesByCategory accurately counts games per synchronized category', () => {
  const categories: Category[] = [
    { id: 1, name: 'Sila & Etika', slug: 'sila-etika', icon: 'fa-heart', sortOrder: 1, status: true },
    { id: 2, name: 'Sejarah Vihara', slug: 'sejarah-vihara', icon: 'fa-landmark', sortOrder: 2, status: true },
  ];

  const games: Game[] = [
    {
      id: 10,
      title: 'Kuis Sila',
      slug: 'kuis-sila',
      category: 'Sila & Etika',
      difficulty: 'Mudah',
      type: 'quiz',
      rating: 5,
      players: 1,
      description: 'Test',
    },
    {
      id: 11,
      title: 'Game Sila 2',
      slug: 'game-sila-2',
      category: 'sila & etika',
      difficulty: 'Mudah',
      type: 'html5',
      rating: 5,
      players: 2,
      description: 'Test 2',
    },
  ];

  const counts = countGamesByCategory(games, categories);
  assert.equal(counts['Sila & Etika'], 2);
  assert.equal(counts['Sejarah Vihara'], 0);
});

test('sanitizeSelectedCategory falls back to all when category is deleted or empty', () => {
  const categories: Category[] = [
    { id: 1, name: 'Sila & Etika', slug: 'sila-etika', icon: 'fa-heart', sortOrder: 1, status: true },
  ];

  assert.equal(sanitizeSelectedCategory('Sila & Etika', categories), 'Sila & Etika');
  assert.equal(sanitizeSelectedCategory('Kategori Terhapus', categories), 'all');
  assert.equal(sanitizeSelectedCategory('all', categories), 'all');
  assert.equal(sanitizeSelectedCategory('Sila & Etika', []), 'all');
});
