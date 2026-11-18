import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeExistingAndImportedSettings,
  selectAutoBaselineSnapshotsToDelete,
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
