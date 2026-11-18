import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isDummyAccessLog,
  isDummyAuditLog,
  normalizeClientIp,
  resolveCountryFlagEmoji,
  synthesizeRealAccessLogsFromLeaderboard,
} from './accessLogSync.ts';

test('isDummyAccessLog detects automated test loops, HeadlessChrome, and deleted sample games', () => {
  const activeTitles = [
    'Mufakat nusantara jejak kebijaksanaan',
    'Jejak tradisi nusantara',
    'Catur Paramita',
  ];

  assert.equal(
    isDummyAccessLog(
      {
        gameTitle: 'Uji Skor Otomatis',
        userName: 'Siswa Berkesadaran',
        userAgent: 'Mozilla/5.0 HeadlessChrome/131.0',
      },
      activeTitles
    ),
    true
  );

  assert.equal(
    isDummyAccessLog(
      {
        gameTitle: 'Petualangan energi ipas 30 soal',
        userName: 'Budi Santoso',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      activeTitles
    ),
    true
  );

  assert.equal(
    isDummyAccessLog(
      {
        gameTitle: 'Catur Paramita',
        userName: 'Retno Fajsr Suryani',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0',
      },
      activeTitles
    ),
    false
  );

  assert.equal(
    isDummyAccessLog(
      {
        gameTitle: 'Jejak tradisi nusantara',
        userName: 'Tamu Dharma',
        userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/131.0.0.0 Mobile',
      },
      activeTitles
    ),
    false
  );
});

test('isDummyAuditLog identifies automated test audit logs while keeping real admin logs', () => {
  assert.equal(
    isDummyAuditLog({
      actor: 'Admin',
      action: 'CREATE_GAME',
      details: 'Added game: Uji Skor Otomatis -> Kategori: Kategori Uji (published)',
    }),
    true
  );

  assert.equal(
    isDummyAuditLog({
      actor: 'Admin',
      action: 'CREATE_GAME',
      details: 'Added game: Game Sync Multi Komputer -> Kategori: Kategori Sync (published)',
    }),
    true
  );

  assert.equal(
    isDummyAuditLog({
      actor: 'Admin',
      action: 'IMPORT_BACKUP',
      details: 'Import backup (merge) dari SQLite (portal_game_backup_2026-11-18T08-22-27-505Z.db): 3 game, 3 kategori',
    }),
    false
  );

  assert.equal(
    isDummyAuditLog({
      actor: 'Admin',
      action: 'LOGIN_SUCCESS',
      details: 'Administrator logged into Admin Hub Studio (Pengelola Penuh)',
    }),
    false
  );
});

test('normalizeClientIp strips IPv4-mapped IPv6 prefix and extracts first forwarded IP', () => {
  assert.equal(normalizeClientIp('::ffff:127.0.0.1'), '127.0.0.1');
  assert.equal(normalizeClientIp('::1'), '127.0.0.1');
  assert.equal(normalizeClientIp('36.72.214.89, 10.0.0.1'), '36.72.214.89');
  assert.equal(normalizeClientIp(''), '127.0.0.1');
});

test('resolveCountryFlagEmoji converts ISO country codes into flag emojis', () => {
  assert.equal(resolveCountryFlagEmoji('ID', 'Indonesia'), '🇮🇩');
  assert.equal(resolveCountryFlagEmoji('SG', 'Singapura'), '🇸🇬');
  assert.equal(resolveCountryFlagEmoji('', 'Indonesia'), '🇮🇩');
});

test('synthesizeRealAccessLogsFromLeaderboard backfills missing real sessions for active games only', () => {
  const activeGames = [
    { id: 17, title: 'Catur Paramita', category: 'TK', isActive: true, status: 'published' },
    { id: 18, title: 'Jejak tradisi nusantara', category: 'SMP', isActive: true, status: 'published' },
    { id: 19, title: 'Mufakat nusantara jejak kebijaksanaan', category: 'SD', isActive: true, status: 'published' },
  ];

  const users = [
    { id: 'usr-1794974705852', name: 'Retno Fajsr Suryani', email: 'aa@gmail.com', role: 'user' },
  ];

  const leaderboardRows = [
    {
      id: 34,
      userName: 'Retno Fajsr Suryani',
      userEmail: 'aa@gmail.com',
      gameId: 19,
      gameTitle: 'Mufakat nusantara jejak kebijaksanaan',
      score: 500,
      createdAt: '2026-11-18 09:09:08',
    },
    {
      id: 35,
      userName: 'Tamu Dharma',
      userEmail: '',
      gameId: 18,
      gameTitle: 'Jejak tradisi nusantara',
      score: 480,
      createdAt: '2026-11-18 09:09:08',
    },
  ];

  const synthesized = synthesizeRealAccessLogsFromLeaderboard(leaderboardRows, activeGames, users, []);
  assert.equal(synthesized.length, 2);
  assert.equal(synthesized[0].gameTitle, 'Mufakat nusantara jejak kebijaksanaan');
  assert.equal(synthesized[0].userRole, 'user');
  assert.equal(synthesized[0].completed, 1);
  assert.equal(synthesized[1].gameTitle, 'Jejak tradisi nusantara');
  assert.equal(synthesized[1].userRole, 'tamu');

  // Calling again when logs already exist should not duplicate
  const secondRun = synthesizeRealAccessLogsFromLeaderboard(leaderboardRows, activeGames, users, synthesized);
  assert.equal(secondRun.length, 0);
});
