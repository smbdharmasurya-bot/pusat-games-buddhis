import {
  BackupPayload,
  BackupSummary,
  SiteSettings,
} from '../types';
import { normalizeCategoryName, slugifyCategory } from './categorySync';
import { normalizeGameMediaValue } from './gameMedia';

export interface NormalizedBackupGame {
  title: string;
  slug: string;
  category: string;
  difficulty: string;
  type: string;
  rating: number;
  players: number;
  thumbnail: string;
  icon: string;
  description: string;
  isPremium: boolean;
  isActive: boolean;
  html5Code: string;
  url: string;
  status: string;
  featured: boolean;
}

export interface NormalizedBackupCategory {
  name: string;
  slug: string;
  icon: string;
  sortOrder: number;
  status: number;
}

export interface NormalizedBackupCertificate {
  id: string;
  studentName: string;
  module: string;
  institution: string;
  date: string;
  certificateNumber: string;
  verificationCode: string;
  isActive: boolean;
  status: 'active' | 'inactive';
}

export interface NormalizedBackupTestimonial {
  name: string;
  role: string;
  game: string;
  rating: number;
  message: string;
  status: string;
}

export interface NormalizedBackupLicense {
  schoolName: string;
  plan: string;
  status: string;
  expiresDate: string;
  licenseKey: string;
}

export interface NormalizedBackupLeaderboard {
  userName: string;
  userEmail: string;
  avatar: string;
  gameTitle: string;
  score: number;
  xpEarned: number;
  badge: string;
  school: string;
}

export interface NormalizedBackupUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  xp: number;
  badge: string;
  level: number;
  school: string;
  role: 'admin' | 'uploader' | 'user';
}

export interface NormalizedBackupAccessLog {
  gameTitle: string;
  gameCategory: string;
  userId: string | null;
  userName: string;
  userRole: string;
  ipAddress: string;
  deviceType: string;
  deviceModel: string;
  browser: string;
  os: string;
  screenResolution: string;
  country: string;
  countryCode: string;
  city: string;
  userAgent: string;
  durationSeconds: number;
  completed: boolean;
  createdAt: string;
}

export interface NormalizedBackupData {
  games: NormalizedBackupGame[];
  categories: NormalizedBackupCategory[];
  siteSettings: Partial<SiteSettings>;
  certificates: NormalizedBackupCertificate[];
  testimonials: NormalizedBackupTestimonial[];
  licenses: NormalizedBackupLicense[];
  leaderboard: NormalizedBackupLeaderboard[];
  users: NormalizedBackupUser[];
  accessLogs?: NormalizedBackupAccessLog[];
}

function asRecord(val: unknown): Record<string, unknown> | null {
  return val && typeof val === 'object' && !Array.isArray(val)
    ? (val as Record<string, unknown>)
    : null;
}

function str(val: unknown, fallback = ''): string {
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  return fallback;
}

function num(val: unknown, fallback = 0): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function bool(val: unknown, fallback = false): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  if (typeof val === 'string') {
    const lower = val.trim().toLowerCase();
    if (lower === 'true' || lower === '1' || lower === 'active') return true;
    if (lower === 'false' || lower === '0' || lower === 'inactive') return false;
  }
  return fallback;
}

function normalizeGameRecord(raw: unknown): NormalizedBackupGame | null {
  const r = asRecord(raw);
  if (!r) return null;
  const title = str(r.title).trim();
  if (!title) return null;
  const category = normalizeCategoryName(str(r.category)) || 'Umum Dharma';
  const slug = str(r.slug).trim() || slugifyCategory(title) || `game-${Date.now()}`;
  const isActive =
    r.isActive !== undefined
      ? bool(r.isActive, true)
      : r.is_active !== undefined
      ? bool(r.is_active, true)
      : true;

  return {
    title,
    slug,
    category,
    difficulty: str(r.difficulty, 'Mudah') || 'Mudah',
    type: str(r.type, 'html5') || 'html5',
    rating: num(r.rating, 4.9),
    players: Math.max(0, Math.round(num(r.players, 0))),
    thumbnail: normalizeGameMediaValue(str(r.thumbnail)),
    icon: normalizeGameMediaValue(str(r.icon)),
    description: str(r.description),
    isPremium: bool(r.isPremium ?? r.is_premium, false),
    isActive,
    html5Code: str(r.html5Code ?? r.html5_code),
    url: str(r.url ?? r.external_url),
    status: str(r.status, 'published') || 'published',
    featured: bool(r.featured, false),
  };
}

function normalizeCategoryRecord(raw: unknown): NormalizedBackupCategory | null {
  const r = asRecord(raw);
  if (!r) return null;
  const name = normalizeCategoryName(str(r.name));
  if (!name) return null;
  return {
    name,
    slug: str(r.slug).trim() || slugifyCategory(name) || `kat-${Date.now()}`,
    icon: str(r.icon).trim() || 'fa-seedling',
    sortOrder: Math.round(num(r.sortOrder ?? r.sort_order, 0)),
    status: Math.round(num(r.status, 1)),
  };
}

function normalizeCertificateRecord(raw: unknown): NormalizedBackupCertificate | null {
  const r = asRecord(raw);
  if (!r) return null;
  const studentName = str(r.studentName ?? r.student_name).trim();
  const verificationCode = str(r.verificationCode ?? r.verification_code ?? r.id).trim();
  if (!studentName || !verificationCode) return null;

  const statusRaw = str(r.status).trim().toLowerCase();
  const active =
    r.isActive !== undefined
      ? bool(r.isActive, true)
      : r.is_active !== undefined
      ? bool(r.is_active, true)
      : statusRaw !== 'inactive';

  return {
    id: str(r.id).trim() || verificationCode,
    studentName,
    module: str(r.module, 'Pembelajaran Dharma').trim() || 'Pembelajaran Dharma',
    institution: str(r.institution, 'Pusat Games Buddhis Indonesia').trim() || 'Pusat Games Buddhis Indonesia',
    date: str(r.date, new Date().toISOString().split('T')[0]),
    certificateNumber: str(r.certificateNumber ?? r.certificate_number, `PGB/CERT/${verificationCode}`),
    verificationCode,
    isActive: active,
    status: active ? 'active' : 'inactive',
  };
}

function normalizeTestimonialRecord(raw: unknown): NormalizedBackupTestimonial | null {
  const r = asRecord(raw);
  if (!r) return null;
  const name = str(r.name).trim();
  const message = str(r.message).trim();
  if (!name || !message) return null;
  return {
    name,
    role: str(r.role, 'Peserta Didik') || 'Peserta Didik',
    game: str(r.game, 'Platform Keseluruhan') || 'Platform Keseluruhan',
    rating: Math.min(5, Math.max(1, Math.round(num(r.rating, 5)))),
    message,
    status: str(r.status, 'approved') || 'approved',
  };
}

function normalizeLicenseRecord(raw: unknown): NormalizedBackupLicense | null {
  const r = asRecord(raw);
  if (!r) return null;
  const schoolName = str(r.schoolName ?? r.school_name).trim();
  const licenseKey = str(r.licenseKey ?? r.license_key).trim();
  if (!schoolName || !licenseKey) return null;
  return {
    schoolName,
    plan: str(r.plan, 'Pro School Suite') || 'Pro School Suite',
    status: str(r.status, 'Aktif') || 'Aktif',
    expiresDate: str(r.expiresDate ?? r.expires_date, '2027-12-31'),
    licenseKey,
  };
}

function normalizeLeaderboardRecord(raw: unknown): NormalizedBackupLeaderboard | null {
  const r = asRecord(raw);
  if (!r) return null;
  const userName = str(r.userName ?? r.user_name).trim();
  const gameTitle = str(r.gameTitle ?? r.game_title).trim();
  if (!userName || !gameTitle) return null;
  return {
    userName,
    userEmail: str(r.userEmail ?? r.user_email),
    avatar: str(r.avatar),
    gameTitle,
    score: Math.max(0, Math.round(num(r.score, 0))),
    xpEarned: Math.max(0, Math.round(num(r.xpEarned ?? r.xp_earned, 0))),
    badge: str(r.badge, 'Sahabat Pemula Dharma') || 'Sahabat Pemula Dharma',
    school: str(r.school),
  };
}

function normalizeUserRecord(raw: unknown): NormalizedBackupUser | null {
  const r = asRecord(raw);
  if (!r) return null;
  const email = str(r.email).trim();
  const name = str(r.name).trim();
  if (!email || !name) return null;
  const roleRaw = str(r.role, 'user').trim().toLowerCase();
  const role: 'admin' | 'uploader' | 'user' =
    roleRaw === 'admin' || roleRaw === 'uploader' ? roleRaw : 'user';
  return {
    id: str(r.id).trim() || `usr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name,
    email,
    avatar: str(r.avatar),
    xp: Math.max(0, Math.round(num(r.xp, 100))),
    badge: str(r.badge, 'Sahabat Pemula Dharma') || 'Sahabat Pemula Dharma',
    level: Math.max(1, Math.round(num(r.level, 1))),
    school: str(r.school),
    role,
  };
}

function normalizeAccessLogRecord(raw: unknown): NormalizedBackupAccessLog | null {
  const r = asRecord(raw);
  if (!r) return null;
  const gameTitle = str(r.gameTitle ?? r.game_title).trim();
  const userName = str(r.userName ?? r.user_name).trim();
  if (!gameTitle || !userName) return null;
  return {
    gameTitle,
    gameCategory: str(r.gameCategory ?? r.game_category, 'Umum') || 'Umum',
    userId: str(r.userId ?? r.user_id).trim() || null,
    userName,
    userRole: str(r.userRole ?? r.user_role, 'tamu') || 'tamu',
    ipAddress: str(r.ipAddress ?? r.ip_address, '127.0.0.1') || '127.0.0.1',
    deviceType: str(r.deviceType ?? r.device_type, 'Desktop PC') || 'Desktop PC',
    deviceModel: str(r.deviceModel ?? r.device_model, 'Desktop PC'),
    browser: str(r.browser, 'Browser Web') || 'Browser Web',
    os: str(r.os, 'OS') || 'OS',
    screenResolution: str(r.screenResolution ?? r.screen_resolution),
    country: str(r.country, 'Indonesia') || 'Indonesia',
    countryCode: str(r.countryCode ?? r.country_code, 'ID') || 'ID',
    city: str(r.city, 'Nusantara') || 'Nusantara',
    userAgent: str(r.userAgent ?? r.user_agent),
    durationSeconds: Math.max(0, Math.round(num(r.durationSeconds ?? r.duration_seconds, 0))),
    completed: bool(r.completed, false),
    createdAt: str(r.createdAt ?? r.created_at) || new Date().toISOString(),
  };
}

function normalizeSettings(raw: unknown): Partial<SiteSettings> {
  if (!raw) return {};
  if (Array.isArray(raw)) {
    const out: Partial<SiteSettings> = {};
    for (const item of raw) {
      const r = asRecord(item);
      if (!r) continue;
      const k = str(r.key).trim();
      const v = str(r.value);
      if (k === 'title' || k === 'subtitle' || k === 'emoji' || k === 'imageUrl' || k === 'announcement') {
        out[k] = v;
      }
    }
    return out;
  }
  const r = asRecord(raw);
  if (!r) return {};
  const out: Partial<SiteSettings> = {};
  if (r.title !== undefined) out.title = str(r.title);
  if (r.subtitle !== undefined) out.subtitle = str(r.subtitle);
  if (r.emoji !== undefined) out.emoji = str(r.emoji);
  if (r.imageUrl !== undefined || r.image_url !== undefined) {
    out.imageUrl = str(r.imageUrl ?? r.image_url);
  }
  if (r.announcement !== undefined) out.announcement = str(r.announcement);
  return out;
}

export function parseBackupPayload(input: string | unknown): NormalizedBackupData {
  let parsed: unknown = input;
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) {
      throw new Error('Isi file atau teks JSON backup masih kosong.');
    }
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error('Format JSON backup tidak valid. Pastikan file merupakan JSON yang utuh.');
    }
  }

  // Support direct /api/v1/games array or /api/v1/categories array
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      throw new Error('Array JSON backup kosong, tidak ada data untuk diimpor.');
    }
    const first = asRecord(parsed[0]);
    if (first && first.title !== undefined) {
      return {
        games: parsed.map(normalizeGameRecord).filter((x): x is NormalizedBackupGame => x !== null),
        categories: [],
        siteSettings: {},
        certificates: [],
        testimonials: [],
        licenses: [],
        leaderboard: [],
        users: [],
        accessLogs: [],
      };
    }
    if (first && first.name !== undefined && first.slug !== undefined) {
      return {
        games: [],
        categories: parsed.map(normalizeCategoryRecord).filter((x): x is NormalizedBackupCategory => x !== null),
        siteSettings: {},
        certificates: [],
        testimonials: [],
        licenses: [],
        leaderboard: [],
        users: [],
        accessLogs: [],
      };
    }
    throw new Error('Struktur array JSON tidak dikenali sebagai daftar game atau kategori.');
  }

  const root = asRecord(parsed);
  if (!root) {
    throw new Error('Format payload backup harus berupa objek JSON atau array.');
  }

  const container = asRecord(root.data) ?? root;

  const games = Array.isArray(container.games)
    ? container.games.map(normalizeGameRecord).filter((x): x is NormalizedBackupGame => x !== null)
    : [];
  const categories = Array.isArray(container.categories)
    ? container.categories.map(normalizeCategoryRecord).filter((x): x is NormalizedBackupCategory => x !== null)
    : [];
  const siteSettings = normalizeSettings(container.siteSettings ?? container.settings ?? (root.title !== undefined && root.subtitle !== undefined ? root : null));
  const certificates = Array.isArray(container.certificates)
    ? container.certificates.map(normalizeCertificateRecord).filter((x): x is NormalizedBackupCertificate => x !== null)
    : [];
  const testimonials = Array.isArray(container.testimonials)
    ? container.testimonials.map(normalizeTestimonialRecord).filter((x): x is NormalizedBackupTestimonial => x !== null)
    : [];
  const licenses = Array.isArray(container.licenses)
    ? container.licenses.map(normalizeLicenseRecord).filter((x): x is NormalizedBackupLicense => x !== null)
    : [];
  const leaderboard = Array.isArray(container.leaderboard)
    ? container.leaderboard.map(normalizeLeaderboardRecord).filter((x): x is NormalizedBackupLeaderboard => x !== null)
    : [];
  const users = Array.isArray(container.users)
    ? container.users.map(normalizeUserRecord).filter((x): x is NormalizedBackupUser => x !== null)
    : [];
  const accessAssetList = container.accessLogs ?? container.game_access_logs;
  const accessLogs = Array.isArray(accessAssetList)
    ? accessAssetList.map(normalizeAccessLogRecord).filter((x): x is NormalizedBackupAccessLog => x !== null)
    : [];

  const totalItems =
    games.length +
    categories.length +
    Object.keys(siteSettings).length +
    certificates.length +
    testimonials.length +
    licenses.length +
    leaderboard.length +
    users.length +
    accessLogs.length;

  if (totalItems === 0) {
    throw new Error('Tidak ditemukan data game, kategori, pengaturan, sertifikat, atau entitas lain yang valid di dalam backup.');
  }

  return {
    games,
    categories,
    siteSettings,
    certificates,
    testimonials,
    licenses,
    leaderboard,
    users,
    accessLogs,
  };
}

export function summarizeBackupPayload(data: NormalizedBackupData | BackupPayload): BackupSummary {
  const source = 'data' in data ? data.data : data;
  return {
    games: source.games?.length || 0,
    categories: source.categories?.length || 0,
    siteSettings: source.siteSettings ? Object.keys(source.siteSettings).length : 0,
    certificates: source.certificates?.length || 0,
    testimonials: source.testimonials?.length || 0,
    licenses: source.licenses?.length || 0,
    leaderboard: source.leaderboard?.length || 0,
    users: source.users?.length || 0,
    accessLogs: source.accessLogs?.length || 0,
  };
}

export function isValidSqliteHeader(bytes: Uint8Array): boolean {
  const magic = 'SQLite format 3\0';
  if (!bytes || bytes.length < magic.length) return false;
  for (let i = 0; i < magic.length; i++) {
    if (bytes[i] !== magic.charCodeAt(i)) return false;
  }
  return true;
}

export function formatSnapshotTimestamp(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, '-');
}
