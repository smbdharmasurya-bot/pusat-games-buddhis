import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseBackupPayload,
  summarizeBackupPayload,
  isValidSqliteHeader,
  formatSnapshotTimestamp,
} from './backupSync';

test('parseBackupPayload parses full backup JSON with games, icons, thumbnails, categories, and settings', () => {
  const payload = {
    version: '1.0',
    exportedAt: '2026-11-16T07:00:00.000Z',
    data: {
      games: [
        {
          title: 'Petualangan Siddhartha',
          category: '  Sejarah   Buddhis ',
          difficulty: 'Sedang',
          type: 'html5',
          thumbnail: 'data:image/png;base64,iVBORw0KGgo=',
          icon: '🪷',
          html5Code: '<html><body>Play</body></html>',
          isActive: false,
          isPremium: true,
        },
      ],
      categories: [
        { name: 'Sejarah Buddhis', icon: 'fa-landmark', sortOrder: 2, status: 1 },
      ],
      siteSettings: {
        title: 'Vihara Dharma Surya',
        subtitle: 'Belajar Sambil Bermain',
        imageUrl: 'data:image/png;base64,ABC',
      },
      certificates: [
        {
          id: 'CERT-2026-888',
          studentName: 'Bodhi Jaya',
          module: 'Tripitaka Dasar',
          institution: 'Vihara Surya',
          verificationCode: 'CERT-2026-888',
          isActive: false,
        },
      ],
    },
  };

  const parsed = parseBackupPayload(JSON.stringify(payload));
  assert.equal(parsed.games.length, 1);
  assert.equal(parsed.games[0].title, 'Petualangan Siddhartha');
  assert.equal(parsed.games[0].category, 'Sejarah Buddhis');
  assert.equal(parsed.games[0].thumbnail, 'data:image/png;base64,iVBORw0KGgo=');
  assert.equal(parsed.games[0].icon, '🪷');
  assert.equal(parsed.games[0].isActive, false);
  assert.equal(parsed.games[0].isPremium, true);

  assert.equal(parsed.categories.length, 1);
  assert.equal(parsed.categories[0].name, 'Sejarah Buddhis');
  assert.equal(parsed.siteSettings.title, 'Vihara Dharma Surya');
  assert.equal(parsed.certificates.length, 1);
  assert.equal(parsed.certificates[0].status, 'inactive');

  const summary = summarizeBackupPayload(parsed);
  assert.deepEqual(summary, {
    games: 1,
    categories: 1,
    siteSettings: 3,
    certificates: 1,
    testimonials: 0,
    licenses: 0,
    leaderboard: 0,
    users: 0,
    accessLogs: 0,
  });
});

test('parseBackupPayload accepts direct /api/v1/games array export', () => {
  const directGames = [
    {
      id: 9,
      title: 'Kuis Sila',
      category: 'Etika Sila',
      type: 'quiz',
      thumbnail: 'https://example.com/thumb.png',
      icon: 'https://example.com/icon.png',
      is_active: 1,
    },
  ];
  const parsed = parseBackupPayload(directGames);
  assert.equal(parsed.games.length, 1);
  assert.equal(parsed.games[0].title, 'Kuis Sila');
  assert.equal(parsed.games[0].icon, 'https://example.com/icon.png');
  assert.equal(parsed.games[0].isActive, true);
});

test('parseBackupPayload throws helpful Indonesian errors for invalid or empty input', () => {
  assert.throws(() => parseBackupPayload(''), /kosong/i);
  assert.throws(() => parseBackupPayload('{bad json'), /tidak valid/i);
  assert.throws(() => parseBackupPayload({ foo: 'bar' }), /Tidak ditemukan data/i);
});

test('isValidSqliteHeader validates 16-byte SQLite 3 magic header', () => {
  const valid = new TextEncoder().encode('SQLite format 3\0extra_bytes');
  const invalid = new TextEncoder().encode('Not a sqlite file');
  assert.equal(isValidSqliteHeader(valid), true);
  assert.equal(isValidSqliteHeader(invalid), false);
  assert.equal(isValidSqliteHeader(new Uint8Array([1, 2, 3])), false);
});

test('formatSnapshotTimestamp generates filesystem-safe ISO timestamp', () => {
  const ts = formatSnapshotTimestamp(new Date('2026-11-16T07:08:09.123Z'));
  assert.equal(ts, '2026-11-16T07-08-09-123Z');
});
