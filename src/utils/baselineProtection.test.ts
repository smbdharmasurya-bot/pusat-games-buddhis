import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTO_BASELINE_SYNC_INTERVAL_MS,
  AUTO_BASELINE_SYNC_INTERVAL_SECONDS,
  calculateNextAutoBaselineSyncSeconds,
  hasSnapshotGrownBeyondCurrentBaseline,
  mergeExistingAndImportedSettings,
  resolveBaselineGrowthReason,
  selectAutoBaselineSnapshotsToDelete,
  shouldCreateAutoBaselineSnapshot,
  shouldRunInitialSeed,
  validatePublishedSyncUrl,
} from './baselineProtection';

test('shouldRunInitialSeed skips re-seeding deleted tables after initial setup', () => {
  const freshDb = shouldRunInitialSeed(false, {
    users: 0,
    certificates: 0,
    testimonials: 0,
    licenses: 0,
    siteSettings: 0,
  });
  assert.deepEqual(freshDb, {
    seedTestimonials: true,
    seedLicenses: true,
    seedCertificates: true,
    seedUsers: true,
    seedSettings: true,
  });

  const existingPublishedDb = shouldRunInitialSeed(true, {
    users: 7,
    certificates: 0, // admin deleted all certs intentionally
    testimonials: 0,
    licenses: 0,
    siteSettings: 5,
  });
  assert.deepEqual(existingPublishedDb, {
    seedTestimonials: false,
    seedLicenses: false,
    seedCertificates: false,
    seedUsers: false,
    seedSettings: false,
  });

  const legacyDbWithoutFlag = shouldRunInitialSeed(false, {
    users: 4,
    certificates: 0,
    testimonials: 0,
    licenses: 0,
    siteSettings: 5,
  });
  assert.equal(legacyDbWithoutFlag.seedCertificates, false);
  assert.equal(legacyDbWithoutFlag.seedTestimonials, false);
  assert.equal(legacyDbWithoutFlag.seedSettings, false);
});

test('mergeExistingAndImportedSettings preserves non-empty local settings during merge mode', () => {
  const merged = mergeExistingAndImportedSettings(
    {
      title: 'Vihara Dharma Surya',
      subtitle: 'Pusat Belajar',
      emoji: '☸️',
      imageUrl: 'data:image/png;base64,LIVE_LOGO',
      announcement: 'Pengumuman Aktif',
    },
    {
      title: 'Candi Baru',
      imageUrl: '', // backup had empty logo
    },
    'merge'
  );

  assert.equal(merged.title, 'Candi Baru');
  assert.equal(merged.imageUrl, 'data:image/png;base64,LIVE_LOGO');
  assert.equal(merged.emoji, '☸️');
});

test('selectAutoBaselineSnapshotsToDelete only rotates excess auto-baseline files', () => {
  const files = [
    'portal_game_backup_2026-11-10.db',
    'pre-merge_2026-11-17.db',
    'auto-baseline_2026-11-17T01-00-00.db',
    'auto-baseline_2026-11-17T03-00-00.db',
    'auto-baseline_2026-11-17T02-00-00.db',
    'auto-baseline_2026-11-17T06-00-00.db',
    'auto-baseline_2026-11-17T05-00-00.db',
    'auto-baseline_2026-11-17T04-00-00.db',
    'auto-baseline_2026-11-17T07-00-00.db',
  ];

  const toDelete = selectAutoBaselineSnapshotsToDelete(files, 5);
  assert.deepEqual(toDelete, [
    'auto-baseline_2026-11-17T02-00-00.db',
    'auto-baseline_2026-11-17T01-00-00.db',
  ]);
});

test('validatePublishedSyncUrl normalizes trailing slashes and rejects invalid URLs', () => {
  assert.equal(
    validatePublishedSyncUrl('https://ais-pre-example.run.app///'),
    'https://ais-pre-example.run.app'
  );
  assert.throws(() => validatePublishedSyncUrl(''), /wajib diisi/i);
  assert.throws(() => validatePublishedSyncUrl('not-a-url'), /tidak valid/i);
  assert.throws(() => validatePublishedSyncUrl('ftp://example.com'), /https/i);
});

test('shouldCreateAutoBaselineSnapshot enforces 1-minute (60,000 ms) interval and revision detection', () => {
  assert.equal(AUTO_BASELINE_SYNC_INTERVAL_MS, 60_000);
  assert.equal(AUTO_BASELINE_SYNC_INTERVAL_SECONDS, 60);

  const now = 1_700_000_100_000;

  // Less than 1 minute elapsed and same revision -> skip creating new file
  assert.equal(
    shouldCreateAutoBaselineSnapshot({
      lastSnapshotMtimeMs: now - 30_000,
      nowMs: now,
      lastSyncedRevision: 10,
      currentRevision: 10,
    }),
    false
  );

  // At least 1 minute (60,000 ms) elapsed -> create new snapshot
  assert.equal(
    shouldCreateAutoBaselineSnapshot({
      lastSnapshotMtimeMs: now - 60_000,
      nowMs: now,
      lastSyncedRevision: 10,
      currentRevision: 10,
    }),
    true
  );

  // Revision changed within 1 minute -> create new snapshot immediately
  assert.equal(
    shouldCreateAutoBaselineSnapshot({
      lastSnapshotMtimeMs: now - 15_000,
      nowMs: now,
      lastSyncedRevision: 10,
      currentRevision: 11,
    }),
    true
  );
});

test('calculateNextAutoBaselineSyncSeconds computes remaining countdown within 60-second cycle', () => {
  const baseMs = Date.parse('2026-11-18T12:00:00.000Z');
  assert.equal(calculateNextAutoBaselineSyncSeconds('2026-11-18T12:00:00.000Z', baseMs + 15_000), 45);
  assert.equal(calculateNextAutoBaselineSyncSeconds('2026-11-18T12:00:00.000Z', baseMs + 59_000), 1);
  assert.equal(calculateNextAutoBaselineSyncSeconds(null, baseMs), 60);
});

test('hasSnapshotGrownBeyondCurrentBaseline detects forward growth in players, games, access logs, or revision', () => {
  const base = {
    games: 3,
    totalPlayers: 440,
    categories: 3,
    leaderboard: 4,
    users: 9,
    testimonials: 12,
    certificates: 0,
    accessLogs: 4,
    revision: 120,
  };

  assert.equal(hasSnapshotGrownBeyondCurrentBaseline(base, { ...base }), false);
  assert.equal(
    hasSnapshotGrownBeyondCurrentBaseline(base, { ...base, totalPlayers: 445, accessLogs: 6 }),
    true
  );
  assert.equal(
    hasSnapshotGrownBeyondCurrentBaseline(base, { ...base, games: 4 }),
    true
  );
  assert.equal(
    hasSnapshotGrownBeyondCurrentBaseline(base, { ...base, revision: 125 }),
    true
  );
});

test('resolveBaselineGrowthReason describes game updates and global user access clearly', () => {
  assert.equal(
    resolveBaselineGrowthReason('game:updated', { title: 'Catur Paramita' }),
    'Pembaruan Game: Catur Paramita'
  );
  assert.equal(
    resolveBaselineGrowthReason('stats:updated', { gameTitle: 'Jejak tradisi nusantara', country: 'Jepang' }),
    'Akses Pengguna Global (Jepang) — Jejak tradisi nusantara'
  );
  assert.equal(
    resolveBaselineGrowthReason('game:created', { title: 'Dharma Nusantara' }),
    'Unggah Game Baru: Dharma Nusantara'
  );
});

