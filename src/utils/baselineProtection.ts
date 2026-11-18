import { SiteSettings } from '../types';

export interface SeedRowCounts {
  users: number;
  certificates: number;
  testimonials: number;
  licenses: number;
  siteSettings: number;
}

export interface InitialSeedDecision {
  seedTestimonials: boolean;
  seedLicenses: boolean;
  seedCertificates: boolean;
  seedUsers: boolean;
  seedSettings: boolean;
}

/**
 * Determines which default sample tables should be seeded.
 * Once a database has already been initialized (`initialSeedCompleted` or existing users),
 * startup NEVER re-inserts sample records into tables that an admin intentionally emptied,
 * and NEVER overwrites existing site settings.
 */
export function shouldRunInitialSeed(
  initialSeedCompleted: boolean,
  counts: SeedRowCounts
): InitialSeedDecision {
  if (initialSeedCompleted || counts.users > 0) {
    return {
      seedTestimonials: false,
      seedLicenses: false,
      seedCertificates: false,
      seedUsers: counts.users === 0,
      seedSettings: counts.siteSettings === 0,
    };
  }

  return {
    seedTestimonials: counts.testimonials === 0,
    seedLicenses: counts.licenses === 0,
    seedCertificates: counts.certificates === 0,
    seedUsers: counts.users === 0,
    seedSettings: counts.siteSettings === 0,
  };
}

/**
 * Merges imported SiteSettings with existing SiteSettings without erasing
 * already-configured values when in safe 'merge' mode.
 */
export function mergeExistingAndImportedSettings(
  existing: Partial<SiteSettings>,
  imported: Partial<SiteSettings>,
  mode: 'merge' | 'replace'
): Partial<SiteSettings> {
  if (mode === 'replace') {
    return { ...imported };
  }

  const keys: (keyof SiteSettings)[] = ['title', 'subtitle', 'emoji', 'imageUrl', 'announcement'];
  const merged: Partial<SiteSettings> = { ...existing };

  for (const key of keys) {
    const incomingVal = imported[key];
    const currentVal = existing[key];
    if (incomingVal !== undefined) {
      const trimmedIncoming = String(incomingVal).trim();
      const trimmedCurrent = currentVal !== undefined ? String(currentVal).trim() : '';
      if (trimmedIncoming.length > 0 || trimmedCurrent.length === 0) {
        merged[key] = String(incomingVal);
      }
    }
  }

  return merged;
}

/**
 * Returns excess `auto-baseline_*.db` snapshot filenames to prune while keeping
 * the newest `maxKeep` files. Manual and pre-import safety snapshots are never touched.
 */
export function selectAutoBaselineSnapshotsToDelete(
  filenames: string[],
  maxKeep: number = 5
): string[] {
  const autoFiles = filenames
    .filter((name) => /^auto-baseline_.*\.db$/i.test(name))
    .slice()
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));

  if (autoFiles.length <= Math.max(1, maxKeep)) {
    return [];
  }
  return autoFiles.slice(Math.max(1, maxKeep));
}

export function validatePublishedSyncUrl(rawUrl: string): string {
  const trimmed = String(rawUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) {
    throw new Error('URL website terpublish wajib diisi.');
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Format URL website tidak valid. Contoh: https://nama-app.run.app');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('URL harus menggunakan protokol https:// atau http://');
  }
  return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '');
}
