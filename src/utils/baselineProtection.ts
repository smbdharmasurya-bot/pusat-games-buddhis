import { SiteSettings } from '../types';

export const AUTO_BASELINE_SYNC_INTERVAL_MS = 60 * 1000; // 1 minute (60,000 ms)
export const AUTO_BASELINE_SYNC_INTERVAL_SECONDS = 60;
export const DEFAULT_PUBLISHED_SYNC_URL =
  'https://ais-pre-xhwkshuuvdxnrrph6r3vvw-42774090488.asia-east1.run.app';

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

export interface AutoBaselineSnapshotCheckParams {
  lastSnapshotMtimeMs: number;
  nowMs: number;
  lastSyncedRevision?: number | null;
  currentRevision?: number | null;
  intervalMs?: number;
  forceCreate?: boolean;
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
 * Determines whether a new `auto-baseline_*.db` snapshot should be created
 * on the 1-minute automatic synchronization schedule or when data revision changes.
 */
export function shouldCreateAutoBaselineSnapshot(
  params: AutoBaselineSnapshotCheckParams
): boolean {
  if (params.forceCreate) {
    return true;
  }
  const intervalMs =
    typeof params.intervalMs === 'number' && params.intervalMs > 0
      ? params.intervalMs
      : AUTO_BASELINE_SYNC_INTERVAL_MS;

  if (!params.lastSnapshotMtimeMs || params.lastSnapshotMtimeMs <= 0) {
    return true;
  }

  if (
    typeof params.currentRevision === 'number' &&
    typeof params.lastSyncedRevision === 'number' &&
    params.currentRevision !== params.lastSyncedRevision
  ) {
    return true;
  }

  return params.nowMs - params.lastSnapshotMtimeMs >= intervalMs;
}

/**
 * Calculates remaining seconds (1..60) until the next automatic 1-minute baseline sync cycle.
 */
export function calculateNextAutoBaselineSyncSeconds(
  lastSyncIso: string | null | undefined,
  nowMs: number = Date.now(),
  intervalMs: number = AUTO_BASELINE_SYNC_INTERVAL_MS
): number {
  const intervalSec = Math.max(1, Math.round(intervalMs / 1000));
  if (!lastSyncIso) {
    return intervalSec;
  }
  const parsedMs = Date.parse(lastSyncIso);
  if (!Number.isFinite(parsedMs) || parsedMs <= 0) {
    return intervalSec;
  }
  const elapsedMs = Math.max(0, nowMs - parsedMs);
  const remainingMs = intervalMs - (elapsedMs % intervalMs);
  return Math.max(1, Math.min(intervalSec, Math.ceil(remainingMs / 1000)));
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

export interface BaselineGrowthVector {
  games: number;
  totalPlayers: number;
  categories: number;
  leaderboard: number;
  users: number;
  testimonials: number;
  certificates: number;
  accessLogs: number;
  revision?: number;
}

/**
 * Determines whether a backup/auto-baseline snapshot contains evolved data
 * (more games, more total plays, more leaderboard entries, more real access logs,
 * more users/testimonials, or a higher revision) that should be merged forward
 * into the live baseline database on startup.
 */
export function hasSnapshotGrownBeyondCurrentBaseline(
  current: BaselineGrowthVector,
  snapshot: BaselineGrowthVector
): boolean {
  if (snapshot.games > current.games) return true;
  if (snapshot.totalPlayers > current.totalPlayers) return true;
  if (snapshot.categories > current.categories) return true;
  if (snapshot.leaderboard > current.leaderboard) return true;
  if (snapshot.users > current.users) return true;
  if (snapshot.testimonials > current.testimonials) return true;
  if (snapshot.certificates > current.certificates) return true;
  if (snapshot.accessLogs > current.accessLogs) return true;
  if (
    typeof snapshot.revision === 'number' &&
    typeof current.revision === 'number' &&
    snapshot.revision > current.revision
  ) {
    return true;
  }
  return false;
}

/**
 * Maps a live website mutation event or user access into a human-readable
 * Indonesian baseline evolution summary.
 */
export function resolveBaselineGrowthReason(event: string, data?: unknown): string {
  const rec =
    data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  const title = typeof rec.title === 'string' ? rec.title : typeof rec.gameTitle === 'string' ? rec.gameTitle : '';
  const country = typeof rec.country === 'string' ? rec.country : '';

  switch (event) {
    case 'game:created':
      return title ? `Unggah Game Baru: ${title}` : 'Unggah Game Baru';
    case 'game:updated':
      return title ? `Pembaruan Game: ${title}` : 'Pembaruan Game & Kurikulum';
    case 'game:deleted':
      return title ? `Penyesuaian Katalog Game: ${title}` : 'Penyesuaian Katalog Game';
    case 'stats:updated':
      if (title && country) {
        return `Akses Pengguna Global (${country}) — ${title}`;
      }
      if (title) {
        return `Akses Permainan: ${title}`;
      }
      if (country) {
        return `Kunjungan Website Global (${country})`;
      }
      return 'Perkembangan Akses Pengguna Global';
    case 'leaderboard:updated':
      return title ? `Skor Baru Tercatat: ${title}` : 'Pembaruan Skor Papan Peringkat';
    case 'user:created':
    case 'user:updated':
      return 'Pertumbuhan Profil & XP Pengguna';
    case 'testimonial:created':
    case 'testimonial:updated':
      return 'Evaluasi & Testimoni Pengguna Baru';
    case 'category:created':
    case 'category:updated':
      return 'Pembaruan Kategori Pembelajaran';
    case 'certificate:created':
    case 'certificate:updated':
      return 'Pembaruan Arsip Sertifikat Dharma';
    case 'settings:updated':
      return 'Pembaruan Tampilan & Identitas Portal';
    case 'backup:imported':
      return 'Sinkronisasi & Penggabungan Data Terpublish';
    default:
      return 'Sinkronisasi Otomatis Baseline Aktif';
  }
}

