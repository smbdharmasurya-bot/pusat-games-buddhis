import { UserProfile } from '../types';

export const REALTIME_SYNC_EVENTS = [
  'connected',
  'settings:updated',
  'category:created',
  'category:updated',
  'category:deleted',
  'game:created',
  'game:updated',
  'game:deleted',
  'stats:updated',
  'leaderboard:updated',
  'testimonial:created',
  'testimonial:updated',
  'testimonial:deleted',
  'license:created',
  'license:deleted',
  'certificate:created',
  'certificate:updated',
  'certificate:deleted',
  'user:created',
  'user:updated',
  'user:deleted',
  'backup:imported',
] as const;

export type RealtimeSyncEvent = (typeof REALTIME_SYNC_EVENTS)[number];

export interface SyncStateResponse {
  revision: number;
  serverTime: string;
  activeClients: number;
  counts: {
    games: number;
    activeGames: number;
    categories: number;
    certificates: number;
    leaderboard: number;
    testimonials: number;
    licenses: number;
    users: number;
  };
}

export function resolveRealtimeToastMessage(event: string): string | null {
  switch (event) {
    case 'game:created':
      return 'Permainan baru telah ditambahkan dan disinkronkan!';
    case 'game:updated':
      return 'Data atau media permainan baru saja diperbarui!';
    case 'game:deleted':
      return 'Salah satu permainan telah dihapus dari katalog.';
    case 'category:created':
    case 'category:updated':
    case 'category:deleted':
      return 'Kategori pembelajaran telah disinkronkan.';
    case 'leaderboard:updated':
      return 'Papan Peringkat baru saja diperbarui dengan skor terbaru!';
    case 'settings:updated':
      return 'Tampilan Beranda diperbarui oleh pengelola.';
    case 'certificate:created':
    case 'certificate:updated':
    case 'certificate:deleted':
      return 'Arsip sertifikat digital baru saja disinkronkan.';
    case 'backup:imported':
      return 'Database & data portal baru saja disinkronkan dari backup!';
    default:
      return null;
  }
}

export function hasSyncRevisionChanged(prevRevision: number | null, nextRevision: number | undefined): boolean {
  if (typeof nextRevision !== 'number' || !Number.isFinite(nextRevision)) {
    return false;
  }
  if (prevRevision === null) {
    return true;
  }
  return nextRevision !== prevRevision;
}

export function shouldAutoRefreshOnVisibility(
  visibilityState: string,
  lastSyncMs: number,
  nowMs: number,
  minIntervalMs = 2000
): boolean {
  if (visibilityState !== 'visible') {
    return false;
  }
  return nowMs - lastSyncMs >= minIntervalMs;
}

export function reconcileActiveUser(
  currentUser: UserProfile | null,
  serverUsers: UserProfile[]
): { user: UserProfile | null; changed: boolean } {
  if (!currentUser) {
    return { user: null, changed: false };
  }
  const match = serverUsers.find(
    (u) => u.id === currentUser.id || u.email.toLowerCase() === currentUser.email.toLowerCase()
  );
  if (!match) {
    return { user: null, changed: true };
  }
  const nextUser: UserProfile = {
    ...currentUser,
    id: match.id,
    name: match.name,
    email: match.email,
    avatar: match.avatar,
    xp: match.xp,
    badge: match.badge,
    level: match.level,
    school: match.school,
    role: match.role,
  };
  const changed =
    nextUser.name !== currentUser.name ||
    nextUser.xp !== currentUser.xp ||
    nextUser.badge !== currentUser.badge ||
    nextUser.level !== currentUser.level ||
    nextUser.school !== currentUser.school ||
    nextUser.role !== currentUser.role ||
    nextUser.avatar !== currentUser.avatar;

  return { user: nextUser, changed };
}
