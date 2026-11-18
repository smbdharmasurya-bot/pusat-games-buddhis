import {
  Game,
  Category,
  LeaderboardEntry,
  Testimonial,
  License,
  Certificate,
  SiteSettings,
  AuditLog,
  StatsOverview,
  UserProfile,
  GameAccessLog,
  UserAccessStats,
  BackupImportMode,
  BackupPayload,
  BackupSnapshotInfo,
  BackupImportResult,
} from '../types';
import { REALTIME_SYNC_EVENTS, SyncStateResponse } from '../utils/realtimeSync';

const API_BASE = '/api/v1';

async function fetchJSON<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    cache: 'no-store',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      ...(options?.headers || {}),
    },
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.message || `HTTP ${res.status}: Terjadi kesalahan pada server`);
  }
  return json.data !== undefined ? json.data : json;
}

export const api = {
  // Stats
  async getStats(): Promise<StatsOverview> {
    return fetchJSON<StatsOverview>('/stats/overview');
  },

  // Settings / Hero
  async getSettings(): Promise<SiteSettings> {
    return fetchJSON<SiteSettings>('/settings');
  },

  async updateSettings(settings: Partial<SiteSettings>): Promise<{ message: string }> {
    return fetchJSON<{ message: string }>('/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  },

  // Categories
  async getCategories(): Promise<Category[]> {
    return fetchJSON<Category[]>('/categories');
  },

  async createCategory(cat: { name: string; icon: string }): Promise<Category> {
    return fetchJSON<Category>('/categories', {
      method: 'POST',
      body: JSON.stringify(cat),
    });
  },

  async updateCategory(id: number, cat: { name: string; icon: string }): Promise<{ message: string }> {
    return fetchJSON<{ message: string }>(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(cat),
    });
  },

  async deleteCategory(id: number): Promise<{ message: string }> {
    return fetchJSON<{ message: string }>(`/categories/${id}`, {
      method: 'DELETE',
    });
  },

  // Games
  async getGames(params?: { category?: string; difficulty?: string; type?: string; search?: string }): Promise<Game[]> {
    const query = new URLSearchParams();
    if (params?.category) query.set('category', params.category);
    if (params?.difficulty) query.set('difficulty', params.difficulty);
    if (params?.type) query.set('type', params.type);
    if (params?.search) query.set('search', params.search);
    const qs = query.toString();
    return fetchJSON<Game[]>(`/games${qs ? '?' + qs : ''}`);
  },

  async getGameById(id: number): Promise<Game> {
    return fetchJSON<Game>(`/games/${id}`);
  },

  async createGame(game: Partial<Game> & { categoryIcon?: string }): Promise<{ message: string; id: number; category?: string }> {
    return fetchJSON<{ message: string; id: number; category?: string }>('/games', {
      method: 'POST',
      body: JSON.stringify(game),
    });
  },

  async updateGame(id: number, game: Partial<Game> & { categoryIcon?: string }): Promise<{ message: string }> {
    return fetchJSON<{ message: string }>(`/games/${id}`, {
      method: 'PUT',
      body: JSON.stringify(game),
    });
  },

  async toggleGameStatus(id: number, isActive?: boolean): Promise<{ message: string; isActive: boolean; status: string }> {
    return fetchJSON<{ message: string; isActive: boolean; status: string }>(`/games/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    });
  },

  async deleteGame(id: number): Promise<{ message: string }> {
    return fetchJSON<{ message: string }>(`/games/${id}`, {
      method: 'DELETE',
    });
  },

  async resetPlayerStats(password: string): Promise<{ message: string }> {
    return fetchJSON<{ message: string }>('/games/reset-stats', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  },

  // Leaderboard
  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    return fetchJSON<LeaderboardEntry[]>('/leaderboard');
  },

  async submitScore(entry: {
    userName: string;
    userEmail?: string;
    avatar?: string;
    gameId?: number;
    gameTitle: string;
    score: number;
    xpEarned?: number;
    badge?: string;
    school?: string;
    isCompleted?: boolean;
    accessLogId?: number;
  }): Promise<{ message: string; id: number }> {
    return fetchJSON<{ message: string; id: number }>('/leaderboard', {
      method: 'POST',
      body: JSON.stringify({ ...entry, isCompleted: entry.isCompleted !== false }),
    });
  },

  async resetLeaderboard(password: string, gameTitle?: string): Promise<{ message: string }> {
    return fetchJSON<{ message: string }>('/leaderboard/reset', {
      method: 'POST',
      body: JSON.stringify({ password, gameTitle }),
    });
  },

  async deleteLeaderboardEntry(id: number): Promise<{ message: string }> {
    return fetchJSON<{ message: string }>(`/leaderboard/${id}`, {
      method: 'DELETE',
    });
  },

  // Testimonials
  async getTestimonials(includePending: boolean = false): Promise<Testimonial[]> {
    return fetchJSON<Testimonial[]>(`/testimonials${includePending ? '?all=1' : ''}`);
  },

  async submitTestimonial(testi: {
    name: string;
    role: string;
    game: string;
    rating: number;
    message: string;
  }): Promise<{ message: string }> {
    return fetchJSON<{ message: string }>('/testimonials', {
      method: 'POST',
      body: JSON.stringify(testi),
    });
  },

  async moderateTestimonial(id: number, status: 'approved' | 'rejected'): Promise<{ message: string }> {
    return fetchJSON<{ message: string }>(`/testimonials/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  async deleteTestimonial(id: number): Promise<{ message: string }> {
    return fetchJSON<{ message: string }>(`/testimonials/${id}`, {
      method: 'DELETE',
    });
  },

  // Licenses
  async getLicenses(): Promise<License[]> {
    return fetchJSON<License[]>('/licenses');
  },

  async createLicense(license: { schoolName: string; plan: string; expiresDate: string }): Promise<License> {
    return fetchJSON<License>('/licenses', {
      method: 'POST',
      body: JSON.stringify(license),
    });
  },

  async deleteLicense(id: number): Promise<{ message: string }> {
    return fetchJSON<{ message: string }>(`/licenses/${id}`, {
      method: 'DELETE',
    });
  },

  // Users Management
  async getUsers(): Promise<UserProfile[]> {
    return fetchJSON<UserProfile[]>('/users');
  },

  async createUser(user: {
    name: string;
    email: string;
    avatar?: string;
    xp?: number;
    badge?: string;
    level?: number;
    school?: string;
    role?: 'admin' | 'uploader' | 'user';
    password?: string;
  }): Promise<{ message: string; id: string }> {
    return fetchJSON<{ message: string; id: string }>('/users', {
      method: 'POST',
      body: JSON.stringify(user),
    });
  },

  async updateUser(id: string, updates: Partial<UserProfile> & { password?: string }): Promise<{ message: string }> {
    return fetchJSON<{ message: string }>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async deleteUser(id: string): Promise<{ message: string }> {
    return fetchJSON<{ message: string }>(`/users/${id}`, {
      method: 'DELETE',
    });
  },

  // User Authentication
  async registerUser(data: {
    name: string;
    email: string;
    password: string;
    school?: string;
  }): Promise<{ success: boolean; message: string; user: UserProfile }> {
    return fetchJSON<{ success: boolean; message: string; user: UserProfile }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async loginUser(data: {
    email: string;
    password: string;
  }): Promise<{ success: boolean; message: string; user: UserProfile }> {
    return fetchJSON<{ success: boolean; message: string; user: UserProfile }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Certificates
  async getCertificates(): Promise<Certificate[]> {
    return fetchJSON<Certificate[]>('/certificates');
  },

  async verifyCertificate(code: string): Promise<Certificate & { isValid: boolean }> {
    return fetchJSON<Certificate & { isValid: boolean }>(`/certificates/verify/${encodeURIComponent(code)}`);
  },

  async issueCertificate(cert: { studentName: string; module: string; institution: string }): Promise<{ message: string; id: string; verificationCode: string }> {
    return fetchJSON<{ message: string; id: string; verificationCode: string }>('/certificates', {
      method: 'POST',
      body: JSON.stringify(cert),
    });
  },

  async toggleCertificateStatus(id: string, isActive?: boolean): Promise<{ message: string; isActive: boolean; status: string }> {
    return fetchJSON<{ message: string; isActive: boolean; status: string }>(`/certificates/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    });
  },

  async deleteCertificate(id: string): Promise<{ message: string }> {
    return fetchJSON<{ message: string }>(`/certificates/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  // Audit Logs
  async getAuditLogs(): Promise<AuditLog[]> {
    return fetchJSON<AuditLog[]>('/audit-logs');
  },

  // Admin & Uploader login
  async adminLogin(password: string): Promise<{ success: boolean; role?: 'admin' | 'uploader'; message: string }> {
    const res = await fetch(`${API_BASE}/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(json?.message || 'Kata sandi tidak valid');
    }
    return json;
  },

  // Game Access Tracking & Analytics
  async recordGameAccess(data: {
    gameId?: number;
    gameTitle: string;
    gameCategory?: string;
    user?: { id?: string; name?: string; role?: string };
    clientInfo?: { screen?: string; timezone?: string };
  }): Promise<{ success: boolean; logId: number; detected: Record<string, string> }> {
    return fetchJSON<{ success: boolean; logId: number; detected: Record<string, string> }>('/analytics/game-access', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateGameHeartbeat(logId: number, durationSeconds: number, completed?: boolean): Promise<{ success: boolean }> {
    return fetchJSON<{ success: boolean }>('/analytics/game-heartbeat', {
      method: 'POST',
      body: JSON.stringify({ logId, durationSeconds, completed }),
    });
  },

  async getAccessStats(): Promise<UserAccessStats> {
    return fetchJSON<UserAccessStats>('/analytics/stats');
  },

  async getAccessLogs(params?: { limit?: number; search?: string; device?: string }): Promise<GameAccessLog[]> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.search) query.set('search', params.search);
    if (params?.device) query.set('device', params.device);
    const qs = query.toString();
    return fetchJSON<GameAccessLog[]>(`/analytics/logs${qs ? '?' + qs : ''}`);
  },

  async clearAccessLogs(password: string): Promise<{ message: string }> {
    return fetchJSON<{ message: string }>('/analytics/logs', {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    });
  },

  // Backup Export, Import & Snapshots
  async exportBackupJson(): Promise<BackupPayload> {
    return fetchJSON<BackupPayload>('/backup/export');
  },

  getBackupJsonDownloadUrl(): string {
    return `${API_BASE}/backup/export?download=1`;
  },

  getBackupDbDownloadUrl(): string {
    return `${API_BASE}/backup/export-db`;
  },

  async getBackupSnapshots(): Promise<BackupSnapshotInfo[]> {
    return fetchJSON<BackupSnapshotInfo[]>('/backup/snapshots');
  },

  async createBackupSnapshot(): Promise<BackupSnapshotInfo> {
    return fetchJSON<BackupSnapshotInfo>('/backup/snapshots', {
      method: 'POST',
    });
  },

  getSnapshotDownloadUrl(filename: string): string {
    return `${API_BASE}/backup/snapshots/${encodeURIComponent(filename)}/download`;
  },

  async importBackupJson(mode: BackupImportMode, payload: unknown): Promise<BackupImportResult> {
    return fetchJSON<BackupImportResult>('/backup/import', {
      method: 'POST',
      body: JSON.stringify({ mode, payload }),
    });
  },

  async importBackupDb(mode: BackupImportMode, fileName: string, base64Data: string): Promise<BackupImportResult> {
    return fetchJSON<BackupImportResult>('/backup/import-db', {
      method: 'POST',
      body: JSON.stringify({ mode, fileName, base64Data }),
    });
  },

  async restoreBackupSnapshot(filename: string, mode: BackupImportMode): Promise<BackupImportResult> {
    return fetchJSON<BackupImportResult>(`/backup/snapshots/${encodeURIComponent(filename)}/restore`, {
      method: 'POST',
      body: JSON.stringify({ mode }),
    });
  },

  async getBaselineStatus(): Promise<import('../types').BaselineStatus> {
    return fetchJSON<import('../types').BaselineStatus>('/backup/baseline-status');
  },

  async syncFromPublishedUrl(sourceUrl: string, mode: BackupImportMode = 'merge'): Promise<BackupImportResult> {
    return fetchJSON<BackupImportResult>('/backup/sync-from-url', {
      method: 'POST',
      body: JSON.stringify({ sourceUrl, mode }),
    });
  },

  async getSyncState(): Promise<SyncStateResponse> {
    return fetchJSON<SyncStateResponse>('/sync/state');
  },

  // Subscribe to Realtime SSE updates
  subscribeRealtime(onEvent: (event: string, data: unknown) => void): () => void {
    if (typeof window === 'undefined' || !window.EventSource) {
      return () => {};
    }

    const eventSource = new EventSource(`${API_BASE}/realtime/stream`);

    REALTIME_SYNC_EVENTS.forEach((evt) => {
      eventSource.addEventListener(evt, (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data);
          onEvent(evt, parsed);
        } catch {
          onEvent(evt, e.data);
        }
      });
    });

    eventSource.onerror = () => {
      // Reconnect handled automatically by EventSource
    };

    return () => {
      eventSource.close();
    };
  },
};
