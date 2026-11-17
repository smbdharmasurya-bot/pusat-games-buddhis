export interface Game {
  id: number;
  title: string;
  slug: string;
  category: string;
  difficulty: 'Mudah' | 'Sedang' | 'Sangat Sulit';
  type: 'quiz' | 'memory' | 'html5' | 'iframe';
  rating: number;
  players: number;
  thumbnail?: string;
  icon?: string;
  description: string;
  isPremium?: boolean;
  isActive?: boolean;
  status?: string;
  html5Code?: string;
  url?: string;
  featured?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Category {
  id?: number;
  name: string;
  slug?: string;
  icon: string; // FontAwesome class or image/base64 URL
  sortOrder?: number;
  status?: boolean;
}

export interface LeaderboardEntry {
  id: number;
  userName: string;
  userEmail?: string;
  avatar?: string;
  gameId?: number;
  gameTitle: string;
  score: number;
  xpEarned: number;
  badge: string;
  school?: string;
  createdAt: string;
  rank?: number;
}

export interface Testimonial {
  id: number;
  name: string;
  role: string;
  game: string;
  rating: number;
  message: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface License {
  id: number;
  schoolName: string;
  plan: string;
  status: 'Aktif' | 'Kedaluwarsa' | 'Ditangguhkan';
  expiresDate: string;
  licenseKey: string;
}

export interface Certificate {
  id: string; // e.g. "CERT-2026-001"
  studentName: string;
  module: string;
  institution: string;
  date: string;
  certificateNumber: string;
  verificationCode: string;
  isActive?: boolean;
  status?: 'active' | 'inactive' | string;
  createdAt?: string;
}

export type UserRole = 'admin' | 'uploader' | 'user' | 'tamu';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
  xp: number;
  badge: string;
  level: number;
  school?: string;
  role: UserRole;
  password?: string;
  createdAt?: string;
}

export interface SiteSettings {
  title: string;
  subtitle: string;
  emoji: string;
  imageUrl?: string;
  announcement?: string;
}

export interface AuditLog {
  id: number;
  actor: string;
  action: string;
  details: string;
  createdAt: string;
}

export interface StatsOverview {
  totalGames: number;
  totalPlayers: number;
  totalCategories: number;
  totalLeaderboardEntries: number;
  totalCertificates: number;
}

export interface GameAccessLog {
  id: number;
  gameId?: number;
  gameTitle: string;
  gameCategory?: string;
  userId?: string;
  userName: string;
  userRole: UserRole;
  ipAddress: string;
  deviceType: 'Ponsel (HP)' | 'Tablet' | 'Desktop PC';
  deviceModel?: string;
  browser: string;
  os: string;
  screenResolution?: string;
  country: string;
  countryCode?: string;
  city?: string;
  userAgent?: string;
  durationSeconds: number;
  completed: boolean;
  createdAt: string;
}

export interface UserAccessStats {
  totalAccess: number;
  uniqueIps: number;
  registeredUsersCount: number;
  guestUsersCount: number;
  completedGamesCount: number;
  devices: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
  browsers: { name: string; count: number }[];
  operatingSystems: { name: string; count: number }[];
  countries: { name: string; code: string; count: number }[];
  topGames: { title: string; count: number }[];
}

export type BackupImportMode = 'merge' | 'replace';

export interface BackupSummary {
  games: number;
  categories: number;
  siteSettings: number;
  certificates: number;
  testimonials: number;
  licenses: number;
  leaderboard: number;
  users: number;
}

export interface BackupPayload {
  version: string;
  exportedAt: string;
  counts?: BackupSummary;
  data: {
    games: Partial<Game>[];
    categories: Partial<Category>[];
    siteSettings: Partial<SiteSettings>;
    certificates: Partial<Certificate>[];
    testimonials: Partial<Testimonial>[];
    licenses: Partial<License>[];
    leaderboard: Partial<LeaderboardEntry>[];
    users: Partial<UserProfile>[];
  };
}

export interface BackupSnapshotInfo {
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

export interface BackupImportResult {
  success: boolean;
  message: string;
  mode: BackupImportMode;
  safetySnapshot: string;
  imported: BackupSummary;
}

