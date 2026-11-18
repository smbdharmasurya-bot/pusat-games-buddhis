import express, { Request, Response } from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import {
  db,
  DB_PATH,
  BACKUP_DIR,
  pruneInactiveLeaderboardScores,
  getBaselineDatabaseCounts,
  ensureAutoBaselineSnapshotOnStartup,
} from './src/server/db.ts';
import { normalizeCategoryName, slugifyCategory, resolveCategoryMatch } from './src/utils/categorySync.ts';
import { mergeGameMediaPatch, normalizeGameMediaValue } from './src/utils/gameMedia.ts';
import {
  formatSnapshotTimestamp,
  isValidSqliteHeader,
  NormalizedBackupData,
  parseBackupPayload,
  summarizeBackupPayload,
} from './src/utils/backupSync.ts';
import {
  mergeExistingAndImportedSettings,
  validatePublishedSyncUrl,
} from './src/utils/baselineProtection.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Dev server must run on port 3000 (Cloud Run container environment has PORT=8080 for proxy ingress)
const PORT = (process.env.PORT && process.env.PORT !== '8080') ? Number(process.env.PORT) : 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Ensure no proxy or browser caches live database responses across computers
app.use('/api/v1', (_req: Request, res: Response, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// Real-Time Server-Sent Events (SSE) client registry
interface SSEClient {
  id: number;
  res: Response;
}
let sseClients: SSEClient[] = [];
let nextClientId = 1;

function getDataRevision(): number {
  try {
    const row = db
      .prepare("SELECT value FROM sync_metadata WHERE key = 'data_revision'")
      .get() as { value?: string } | undefined;
    const rev = Number(row?.value);
    return Number.isFinite(rev) && rev > 0 ? rev : 1;
  } catch {
    return 1;
  }
}

function bumpDataRevision(): number {
  const nextRev = getDataRevision() + 1;
  try {
    db.prepare(`
      INSERT INTO sync_metadata (key, value, updated_at) VALUES ('data_revision', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run(String(nextRev));
  } catch (err) {
    console.error('Sync revision bump error:', err);
  }
  return nextRev;
}

export function broadcastEvent(event: string, data: unknown) {
  const revision = event === 'connected' ? getDataRevision() : bumpDataRevision();
  const enriched =
    typeof data === 'object' && data !== null && !Array.isArray(data)
      ? { ...(data as Record<string, unknown>), revision }
      : { value: data, revision };
  const payload = `event: ${event}\ndata: ${JSON.stringify(enriched)}\n\n`;
  sseClients = sseClients.filter((client) => {
    try {
      client.res.write(payload);
      return true;
    } catch {
      return false;
    }
  });
}

function recordAudit(actor: string, action: string, details: string) {
  try {
    db.prepare('INSERT INTO audit_logs (actor, action, details) VALUES (?, ?, ?)').run(actor, action, details);
  } catch (err) {
    console.error('Audit log error:', err);
  }
}

interface SynchronizedCategoryResult {
  name: string;
  createdCategory?: {
    id: number | bigint;
    name: string;
    slug: string;
    icon: string;
  };
}

function ensureSynchronizedCategoryWithMeta(rawCategoryName: string, icon?: string): SynchronizedCategoryResult {
  const normalized = normalizeCategoryName(rawCategoryName);
  if (!normalized) {
    throw new Error('Kategori pembelajaran wajib diisi atau dipilih');
  }

  const existingRows = db.prepare('SELECT id, name FROM categories').all() as { id: number; name: string }[];
  const { matchedCategory } = resolveCategoryMatch(normalized, existingRows);
  if (matchedCategory) {
    return { name: matchedCategory.name };
  }

  const slug = slugifyCategory(normalized) || `kategori-${Date.now()}`;
  const maxSort = (db.prepare('SELECT MAX(sort_order) as m FROM categories').get() as { m: number | null }).m || 0;
  const catIcon = icon && icon.trim() ? icon.trim() : 'fa-seedling';

  const info = db.prepare(`
    INSERT INTO categories (name, slug, icon, sort_order, status)
    VALUES (?, ?, ?, ?, 1)
  `).run(normalized, slug, catIcon, maxSort + 1);

  return {
    name: normalized,
    createdCategory: {
      id: info.lastInsertRowid,
      name: normalized,
      slug,
      icon: catIcon,
    },
  };
}

function ensureSynchronizedCategory(rawCategoryName: string, icon?: string, emitEvents = true): string {
  const result = ensureSynchronizedCategoryWithMeta(rawCategoryName, icon);
  if (emitEvents && result.createdCategory) {
    recordAudit('Admin', 'CREATE_CATEGORY', `Auto-synchronized category from game upload: ${result.createdCategory.name}`);
    broadcastEvent('category:created', result.createdCategory);
  }
  return result.name;
}

// ==========================================
// REST API ROUTES (/api/v1)
// ==========================================

// SSE Realtime Stream with proxy anti-buffering & keepalive heartbeat
app.get('/api/v1/realtime/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const clientId = nextClientId++;
  const client: SSEClient = { id: clientId, res };
  sseClients.push(client);

  res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', clientId, revision: getDataRevision() })}\n\n`);

  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients = sseClients.filter((c) => c.id !== clientId);
  });
});

// Fast Multi-Device Sync State Endpoint
app.get('/api/v1/sync/state', (_req: Request, res: Response) => {
  try {
    const revision = getDataRevision();
    const gamesCount = (db.prepare('SELECT COUNT(*) as c FROM games').get() as { c: number }).c;
    const activeGamesCount = (db.prepare("SELECT COUNT(*) as c FROM games WHERE is_active = 1 AND (status IS NULL OR status != 'inactive')").get() as { c: number }).c;
    const categoriesCount = (db.prepare('SELECT COUNT(*) as c FROM categories').get() as { c: number }).c;
    const certificatesCount = (db.prepare('SELECT COUNT(*) as c FROM certificates').get() as { c: number }).c;
    const leaderboardCount = (db.prepare('SELECT COUNT(*) as c FROM leaderboard').get() as { c: number }).c;
    const testimonialsCount = (db.prepare('SELECT COUNT(*) as c FROM testimonials').get() as { c: number }).c;
    const licensesCount = (db.prepare('SELECT COUNT(*) as c FROM licenses').get() as { c: number }).c;
    const usersCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;

    res.json({
      success: true,
      data: {
        revision,
        serverTime: new Date().toISOString(),
        activeClients: sseClients.length,
        counts: {
          games: gamesCount,
          activeGames: activeGamesCount,
          categories: categoriesCount,
          certificates: certificatesCount,
          leaderboard: leaderboardCount,
          testimonials: testimonialsCount,
          licenses: licensesCount,
          users: usersCount,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

// Health check
app.get('/api/v1/health', (_req: Request, res: Response) => {
  res.json({ success: true, message: 'Server is healthy', revision: getDataRevision(), timestamp: new Date().toISOString() });
});

// Stats overview
app.get('/api/v1/stats/overview', (_req: Request, res: Response) => {
  try {
    const totalGames = (db.prepare("SELECT COUNT(*) as count FROM games WHERE is_active = 1 AND (status IS NULL OR status != 'inactive')").get() as { count: number }).count;
    const totalCategories = (db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number }).count;
    const totalPlayersSum = (db.prepare('SELECT SUM(players) as sum FROM games').get() as { sum: number }).sum || 0;
    const totalLeaderboardEntries = (db.prepare('SELECT COUNT(*) as count FROM leaderboard').get() as { count: number }).count;
    const totalCertificates = (db.prepare("SELECT COUNT(*) as count FROM certificates WHERE is_active = 1 AND (status IS NULL OR status != 'inactive')").get() as { count: number }).count;

    res.json({
      success: true,
      data: {
        totalGames,
        totalCategories,
        totalPlayers: totalPlayersSum,
        totalLeaderboardEntries,
        totalCertificates,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

// Site Settings
app.get('/api/v1/settings', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT key, value FROM site_settings').all() as { key: string; value: string }[];
    const settings: Record<string, string> = {};
    rows.forEach((r) => {
      settings[r.key] = r.value;
    });
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

app.post('/api/v1/settings', (req: Request, res: Response) => {
  try {
    const { title, subtitle, emoji, imageUrl, announcement } = req.body;
    const updateStmt = db.prepare(`
      INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `);

    if (title !== undefined) updateStmt.run('title', title);
    if (subtitle !== undefined) updateStmt.run('subtitle', subtitle);
    if (emoji !== undefined) updateStmt.run('emoji', emoji);
    if (imageUrl !== undefined) updateStmt.run('imageUrl', imageUrl);
    if (announcement !== undefined) updateStmt.run('announcement', announcement);

    recordAudit('Admin', 'UPDATE_SETTINGS', `Updated Hero banner settings: ${title}`);
    broadcastEvent('settings:updated', { title, subtitle, emoji, imageUrl, announcement });

    res.json({ success: true, message: 'Pengaturan beranda berhasil disimpan!' });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

// Categories
app.get('/api/v1/categories', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT * FROM categories ORDER BY sort_order ASC, id ASC').all();
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

app.post('/api/v1/categories', (req: Request, res: Response) => {
  try {
    const { name, icon } = req.body;
    const normalized = typeof name === 'string' ? normalizeCategoryName(name) : '';
    if (!normalized) {
      res.status(400).json({ success: false, message: 'Nama kategori wajib diisi' });
      return;
    }

    const existingRows = db.prepare('SELECT id, name FROM categories').all() as { id: number; name: string }[];
    const { matchedCategory } = resolveCategoryMatch(normalized, existingRows);
    if (matchedCategory) {
      res.status(400).json({ success: false, message: `Kategori "${matchedCategory.name}" sudah terdaftar` });
      return;
    }

    const slug = slugifyCategory(normalized) || `kategori-${Date.now()}`;
    const maxSort = (db.prepare('SELECT MAX(sort_order) as m FROM categories').get() as { m: number | null }).m || 0;
    const catIcon = icon && String(icon).trim() ? String(icon).trim() : 'fa-seedling';

    const info = db.prepare(`
      INSERT INTO categories (name, slug, icon, sort_order, status)
      VALUES (?, ?, ?, ?, 1)
    `).run(normalized, slug, catIcon, maxSort + 1);

    recordAudit('Admin', 'CREATE_CATEGORY', `Added category: ${normalized}`);
    broadcastEvent('category:created', { id: info.lastInsertRowid, name: normalized, slug, icon: catIcon });

    res.json({ success: true, message: 'Kategori berhasil ditambahkan', data: { id: info.lastInsertRowid, name: normalized, slug, icon: catIcon } });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

app.put('/api/v1/categories/:id', (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name, icon } = req.body;
    const oldCat = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as { id: number; name: string } | undefined;
    if (!oldCat) {
      res.status(404).json({ success: false, message: 'Kategori tidak ditemukan' });
      return;
    }

    const normalized = typeof name === 'string' ? normalizeCategoryName(name) : '';
    if (!normalized) {
      res.status(400).json({ success: false, message: 'Nama kategori wajib diisi' });
      return;
    }

    const existingRows = db.prepare('SELECT id, name FROM categories WHERE id != ?').all(id) as { id: number; name: string }[];
    const { matchedCategory } = resolveCategoryMatch(normalized, existingRows);
    if (matchedCategory) {
      res.status(400).json({ success: false, message: `Kategori "${matchedCategory.name}" sudah digunakan` });
      return;
    }

    const slug = slugifyCategory(normalized) || `kategori-${id}`;
    let updatedGamesCount = 0;
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('UPDATE categories SET name = ?, slug = ?, icon = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
        normalized,
        slug,
        icon,
        id
      );

      // Synchronize related games category name atomically
      const gameUpdate = db.prepare('UPDATE games SET category = ?, updated_at = CURRENT_TIMESTAMP WHERE category = ?').run(normalized, oldCat.name);
      updatedGamesCount = Number(gameUpdate.changes || 0);
      db.exec('COMMIT');
    } catch (txErr) {
      try { db.exec('ROLLBACK'); } catch {}
      throw txErr;
    }

    recordAudit('Admin', 'UPDATE_CATEGORY', `Updated category: ${oldCat.name} -> ${normalized} (synced ${updatedGamesCount} games)`);
    broadcastEvent('category:updated', { id, name: normalized, icon });
    if (updatedGamesCount > 0) {
      broadcastEvent('game:updated', { oldCategory: oldCat.name, category: normalized });
    }

    res.json({ success: true, message: 'Kategori dan game terkait berhasil disinkronkan!' });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

app.delete('/api/v1/categories/:id', (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as { name: string } | undefined;
    if (!cat) {
      res.status(404).json({ success: false, message: 'Kategori tidak ditemukan' });
      return;
    }

    const linkedGames = (db.prepare('SELECT COUNT(*) as count FROM games WHERE category = ?').get(cat.name) as { count: number }).count;
    if (linkedGames > 0) {
      res.status(400).json({
        success: false,
        message: `Kategori "${cat.name}" masih digunakan oleh ${linkedGames} permainan.`,
      });
      return;
    }

    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    recordAudit('Admin', 'DELETE_CATEGORY', `Deleted category: ${cat.name}`);
    broadcastEvent('category:deleted', { id, name: cat.name });

    res.json({ success: true, message: 'Kategori berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

// Games
app.get('/api/v1/games', (req: Request, res: Response) => {
  try {
    const { category, difficulty, type, search } = req.query;
    let query = 'SELECT * FROM games WHERE 1=1';
    const params: (string | number | bigint | null | Uint8Array)[] = [];

    if (category && category !== 'all' && typeof category === 'string') {
      query += ' AND category = ?';
      params.push(category);
    }
    if (difficulty && difficulty !== 'all' && typeof difficulty === 'string') {
      query += ' AND difficulty = ?';
      params.push(difficulty);
    }
    if (type && type !== 'all' && typeof type === 'string') {
      query += ' AND type = ?';
      params.push(type);
    }
    if (search && typeof search === 'string' && search.trim() !== '') {
      query += ' AND (title LIKE ? OR description LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    query += ' ORDER BY featured DESC, id DESC';
    const games = db.prepare(query).all(...params) as Record<string, unknown>[];

    const formatted = games.map((g) => ({
      id: g.id,
      title: g.title,
      slug: g.slug,
      category: g.category,
      difficulty: g.difficulty,
      type: g.type,
      rating: g.rating,
      players: g.players,
      thumbnail: g.thumbnail || '',
      icon: g.icon || '',
      description: g.description,
      isPremium: Boolean(g.is_premium),
      isActive: g.is_active === 0 || g.status === 'inactive' ? false : true,
      status: (g.status as string) || (g.is_active === 0 ? 'inactive' : 'published'),
      html5Code: g.html5_code,
      url: g.url,
      featured: Boolean(g.featured),
      createdAt: g.created_at,
      updatedAt: g.updated_at,
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

app.get('/api/v1/games/:id', (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const g = db.prepare('SELECT * FROM games WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!g) {
      res.status(404).json({ success: false, message: 'Permainan tidak ditemukan' });
      return;
    }
    res.json({
      success: true,
      data: {
        id: g.id,
        title: g.title,
        slug: g.slug,
        category: g.category,
        difficulty: g.difficulty,
        type: g.type,
        rating: g.rating,
        players: g.players,
        thumbnail: g.thumbnail || '',
        icon: g.icon || '',
        description: g.description,
        isPremium: Boolean(g.is_premium),
        isActive: g.is_active === 0 || g.status === 'inactive' ? false : true,
        status: (g.status as string) || (g.is_active === 0 ? 'inactive' : 'published'),
        html5Code: g.html5_code,
        url: g.url,
        featured: Boolean(g.featured),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

app.post('/api/v1/games', (req: Request, res: Response) => {
  try {
    const { title, category, categoryIcon, difficulty, type, description, isPremium, isActive, thumbnail, icon, url, html5Code } = req.body;
    if (!title || !String(title).trim() || !description || !String(description).trim()) {
      res.status(400).json({ success: false, message: 'Judul dan deskripsi game wajib diisi' });
      return;
    }
    if (!category || !normalizeCategoryName(String(category))) {
      res.status(400).json({ success: false, message: 'Kategori pembelajaran wajib dipilih atau diisi saat upload game baru' });
      return;
    }

    const slug = slugifyCategory(String(title)) || `game-${Date.now()}`;
    const activeValue = isActive === false ? 0 : 1;
    const statusValue = isActive === false ? 'inactive' : 'published';
    const cleanThumbnail = normalizeGameMediaValue(thumbnail);
    const cleanIcon = normalizeGameMediaValue(icon);

    let syncedCategory = '';
    let createdCategoryMeta: SynchronizedCategoryResult['createdCategory'];
    let newGameId: number | bigint = 0;

    db.exec('BEGIN IMMEDIATE');
    try {
      const catSync = ensureSynchronizedCategoryWithMeta(String(category), categoryIcon);
      syncedCategory = catSync.name;
      createdCategoryMeta = catSync.createdCategory;
      const info = db.prepare(`
        INSERT INTO games (title, slug, category, difficulty, type, rating, players, thumbnail, icon, description, is_premium, is_active, html5_code, url, status, featured)
        VALUES (?, ?, ?, ?, ?, 5.0, 1, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(
        String(title).trim(),
        slug,
        syncedCategory,
        difficulty || 'Mudah',
        type || 'html5',
        cleanThumbnail,
        cleanIcon,
        String(description).trim(),
        isPremium ? 1 : 0,
        activeValue,
        html5Code || null,
        url || null,
        statusValue
      );
      newGameId = info.lastInsertRowid;
      db.exec('COMMIT');
    } catch (txErr) {
      try { db.exec('ROLLBACK'); } catch {}
      throw txErr;
    }

    if (createdCategoryMeta) {
      recordAudit('Admin', 'CREATE_CATEGORY', `Auto-synchronized category from game upload: ${createdCategoryMeta.name}`);
      broadcastEvent('category:created', createdCategoryMeta);
    }
    recordAudit('Admin', 'CREATE_GAME', `Added game: ${title} -> Kategori: ${syncedCategory} (${statusValue})`);
    broadcastEvent('game:created', {
      id: newGameId,
      title: String(title).trim(),
      category: syncedCategory,
      type,
      thumbnail: cleanThumbnail,
      icon: cleanIcon,
      isActive: Boolean(activeValue),
    });

    res.json({
      success: true,
      message: `Permainan "${String(title).trim()}" berhasil disimpan dan disinkronkan ke kategori "${syncedCategory}"!`,
      id: newGameId,
      category: syncedCategory,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

app.put('/api/v1/games/:id', (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM games WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json({ success: false, message: 'Permainan tidak ditemukan' });
      return;
    }

    const {
      title = existing.title,
      category = existing.category,
      categoryIcon,
      difficulty = existing.difficulty,
      type = existing.type,
      description = existing.description,
      isPremium = existing.is_premium,
      isActive,
      status,
      thumbnail,
      icon,
      url = existing.url,
      html5Code = existing.html5_code
    } = req.body;

    const nextTitle = String(title).trim();
    const nextSlug = slugifyCategory(nextTitle) || String(existing.slug || `game-${id}`);

    const currentIsActive = existing.is_active === 0 || existing.status === 'inactive' ? 0 : 1;
    const newIsActive = isActive !== undefined ? (isActive ? 1 : 0) : (status !== undefined ? (status === 'inactive' ? 0 : 1) : currentIsActive);
    const newStatus = status !== undefined ? String(status) : (newIsActive === 1 ? 'published' : 'inactive');

    const mergedMedia = mergeGameMediaPatch(
      {
        thumbnail: (existing.thumbnail as string) || '',
        icon: (existing.icon as string) || '',
      },
      {
        thumbnail: thumbnail !== undefined ? String(thumbnail) : undefined,
        icon: icon !== undefined ? String(icon) : undefined,
      }
    );

    let syncedCategory = String(existing.category);
    let createdCategoryMeta: SynchronizedCategoryResult['createdCategory'];
    db.exec('BEGIN IMMEDIATE');
    try {
      if (category && normalizeCategoryName(String(category))) {
        const catSync = ensureSynchronizedCategoryWithMeta(String(category), categoryIcon);
        syncedCategory = catSync.name;
        createdCategoryMeta = catSync.createdCategory;
      }

      db.prepare(`
        UPDATE games
        SET title = ?, slug = ?, category = ?, difficulty = ?, type = ?, description = ?, is_premium = ?, is_active = ?, status = ?, thumbnail = ?, icon = ?, url = ?, html5_code = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        nextTitle,
        nextSlug,
        syncedCategory,
        difficulty,
        type,
        String(description).trim(),
        isPremium ? 1 : 0,
        newIsActive,
        newStatus,
        mergedMedia.thumbnail,
        mergedMedia.icon,
        url || null,
        html5Code || null,
        id
      );

      if (nextTitle !== String(existing.title)) {
        db.prepare('UPDATE leaderboard SET game_title = ? WHERE game_id = ? OR game_title = ?')
          .run(nextTitle, id, String(existing.title));
      }
      if (nextTitle !== String(existing.title) || syncedCategory !== String(existing.category)) {
        db.prepare('UPDATE game_access_logs SET game_title = ?, game_category = ? WHERE game_id = ?')
          .run(nextTitle, syncedCategory, id);
      }
      db.exec('COMMIT');
    } catch (txErr) {
      try { db.exec('ROLLBACK'); } catch {}
      throw txErr;
    }

    if (!newIsActive) {
      pruneInactiveLeaderboardScores();
    }

    if (createdCategoryMeta) {
      recordAudit('Admin', 'CREATE_CATEGORY', `Auto-synchronized category from game update: ${createdCategoryMeta.name}`);
      broadcastEvent('category:created', createdCategoryMeta);
    }
    recordAudit(
      'Admin',
      'UPDATE_GAME',
      `Updated game ID ${id} (${nextTitle}) -> Kategori: ${syncedCategory}, Thumbnail: ${mergedMedia.thumbnail ? 'Diperbarui' : 'Default'}, Icon: ${mergedMedia.icon || 'Default'}, Status: ${newIsActive ? 'Aktif' : 'Nonaktif'}`
    );
    broadcastEvent('game:updated', {
      id,
      title: nextTitle,
      category: syncedCategory,
      thumbnail: mergedMedia.thumbnail,
      icon: mergedMedia.icon,
      isActive: Boolean(newIsActive),
      status: newStatus,
    });
    if (!newIsActive) {
      broadcastEvent('leaderboard:updated', { pruned: true });
    }

    res.json({
      success: true,
      message: `Data, thumbnail & ikon permainan "${nextTitle}" berhasil diperbarui dan disinkronkan!`,
      thumbnail: mergedMedia.thumbnail,
      icon: mergedMedia.icon,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

app.patch('/api/v1/games/:id/status', (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM games WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json({ success: false, message: 'Permainan tidak ditemukan' });
      return;
    }

    const { isActive } = req.body;
    const currentActive = existing.is_active === 0 || existing.status === 'inactive' ? 0 : 1;
    const newActive = isActive !== undefined ? (isActive ? 1 : 0) : (currentActive === 1 ? 0 : 1);
    const newStatus = newActive === 1 ? 'published' : 'inactive';

    db.prepare(`
      UPDATE games
      SET is_active = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newActive, newStatus, id);

    let prunedCount = 0;
    if (!newActive) {
      prunedCount = pruneInactiveLeaderboardScores();
    }

    recordAudit('Admin', 'TOGGLE_GAME_STATUS', `Game "${existing.title}" diubah status menjadi: ${newActive ? 'Aktif' : 'Nonaktif'}`);
    broadcastEvent('game:updated', { id, title: existing.title, isActive: Boolean(newActive), status: newStatus });
    if (prunedCount > 0) {
      broadcastEvent('leaderboard:updated', { pruned: true });
    }

    res.json({
      success: true,
      message: `Permainan "${existing.title}" berhasil di-${newActive ? 'aktifkan' : 'nonaktifkan'}!`,
      isActive: Boolean(newActive),
      status: newStatus,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

app.delete('/api/v1/games/:id', (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const g = db.prepare('SELECT title FROM games WHERE id = ?').get(id) as { title: string } | undefined;
    if (!g) {
      res.status(404).json({ success: false, message: 'Permainan tidak ditemukan' });
      return;
    }

    db.prepare('DELETE FROM games WHERE id = ?').run(id);
    db.prepare('DELETE FROM leaderboard WHERE game_id = ? OR LOWER(TRIM(game_title)) = LOWER(TRIM(?))').run(id, g.title);
    pruneInactiveLeaderboardScores();

    recordAudit('Admin', 'DELETE_GAME', `Deleted game: ${g.title}`);
    broadcastEvent('game:deleted', { id, title: g.title });
    broadcastEvent('leaderboard:updated', { deletedGame: g.title });

    res.json({ success: true, message: 'Permainan berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

app.post('/api/v1/games/reset-stats', (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    if (password !== 'admin321') {
      recordAudit('Anonymous', 'RESET_STATS_DENIED', 'Percobaan reset total pemain dengan kata sandi salah');
      res.status(403).json({ success: false, message: 'Kata sandi salah! Reset total permainan dibatalkan.' });
      return;
    }

    db.prepare('UPDATE games SET players = 0').run();
    recordAudit('Admin', 'RESET_STATS', 'Reset counter total pemain seluruh game ke 0');
    broadcastEvent('stats:updated', { playersReset: true });
    res.json({ success: true, message: 'Total permainan berhasil direset ke 0!' });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

// Real-Time Leaderboard (strictly active uploaded games)
app.get('/api/v1/leaderboard', (_req: Request, res: Response) => {
  try {
    pruneInactiveLeaderboardScores();
    const rows = db.prepare(`
      SELECT
        l.*,
        g.id AS resolved_game_id,
        g.title AS resolved_game_title
      FROM leaderboard l
      INNER JOIN games g
        ON (
          (l.game_id IS NOT NULL AND l.game_id = g.id)
          OR (l.game_id IS NULL AND LOWER(TRIM(l.game_title)) = LOWER(TRIM(g.title)))
        )
      WHERE g.is_active = 1
        AND (g.status IS NULL OR g.status != 'inactive')
      ORDER BY l.score DESC, l.xp_earned DESC, l.id DESC
      LIMIT 100
    `).all() as Record<string, unknown>[];

    const formatted = rows.map((r, index) => ({
      id: r.id,
      userName: r.user_name,
      userEmail: r.user_email,
      avatar: r.avatar,
      gameId: r.resolved_game_id ?? r.game_id,
      gameTitle: r.resolved_game_title || r.game_title,
      score: r.score,
      xpEarned: r.xp_earned,
      badge: r.badge,
      school: r.school,
      createdAt: r.created_at,
      rank: index + 1,
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

app.post('/api/v1/leaderboard', (req: Request, res: Response) => {
  try {
    const { userName, userEmail, avatar, gameId, gameTitle, score, xpEarned, badge, school, isCompleted, accessLogId } = req.body;
    if (!userName || !gameTitle || score === undefined) {
      res.status(400).json({ success: false, message: 'Nama pemain, judul game, dan skor wajib disertakan' });
      return;
    }

    if (isCompleted === false) {
      res.status(400).json({
        success: false,
        message: 'Catat skor hanya berlaku jika Anda mampu menyelesaikan permainan hingga akhir, bukan hanya membuka saja.',
      });
      return;
    }

    // Resolve against currently active game
    const numericGameId = gameId ? Number(gameId) : null;
    const matchedGame = (
      numericGameId
        ? db.prepare("SELECT id, title FROM games WHERE id = ? AND is_active = 1 AND (status IS NULL OR status != 'inactive')").get(numericGameId)
        : db.prepare("SELECT id, title FROM games WHERE LOWER(TRIM(title)) = LOWER(TRIM(?)) AND is_active = 1 AND (status IS NULL OR status != 'inactive') LIMIT 1").get(String(gameTitle))
    ) as { id: number; title: string } | undefined;

    if (!matchedGame) {
      res.status(400).json({
        success: false,
        message: 'Permainan sudah tidak aktif atau tidak ditemukan di katalog aktif.',
      });
      return;
    }

    const numericScore = Math.max(0, Math.round(Number(score) || 0));
    const numericXp = xpEarned !== undefined ? Math.max(0, Math.round(Number(xpEarned) || 0)) : Math.round(numericScore * 0.5);

    const info = db.prepare(`
      INSERT INTO leaderboard (user_name, user_email, avatar, game_id, game_title, score, xp_earned, badge, school)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      String(userName).trim(),
      userEmail || null,
      avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(String(userName))}`,
      matchedGame.id,
      matchedGame.title,
      numericScore,
      numericXp,
      badge || 'Sahabat Pemula Dharma',
      school || 'Umum / Mandiri'
    );

    if (userEmail && numericXp > 0) {
      try {
        db.prepare('UPDATE users SET xp = xp + ?, updated_at = CURRENT_TIMESTAMP WHERE LOWER(email) = LOWER(?)')
          .run(numericXp, String(userEmail).trim());
      } catch {
        // ignore if user row update fails
      }
    }

    if (accessLogId) {
      try {
        db.prepare('UPDATE game_access_logs SET completed = 1 WHERE id = ?').run(accessLogId);
      } catch (logErr) {
        console.error('Error updating access log completion:', logErr);
      }
    }

    db.prepare('UPDATE games SET players = players + 1 WHERE id = ?').run(matchedGame.id);

    broadcastEvent('leaderboard:updated', { id: info.lastInsertRowid, userName, gameTitle: matchedGame.title, score: numericScore });

    res.json({ success: true, message: 'Skor berhasil dicatat di Papan Peringkat!', id: info.lastInsertRowid });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

// Reset Leaderboard All or By Game Title (Password Protected)
app.post('/api/v1/leaderboard/reset', (req: Request, res: Response) => {
  try {
    const { password, gameTitle } = req.body;
    if (password !== 'admin321') {
      recordAudit('Anonymous', 'RESET_LEADERBOARD_DENIED', 'Percobaan reset skor leaderboard dengan kata sandi salah');
      res.status(403).json({ success: false, message: 'Kata sandi salah! Reset skor leaderboard dibatalkan.' });
      return;
    }

    if (gameTitle && String(gameTitle).trim()) {
      const cleanTitle = String(gameTitle).trim();
      const matched = db.prepare('SELECT id FROM games WHERE LOWER(TRIM(title)) = LOWER(TRIM(?)) LIMIT 1').get(cleanTitle) as { id: number } | undefined;
      if (matched) {
        db.prepare('DELETE FROM leaderboard WHERE game_id = ? OR LOWER(TRIM(game_title)) = LOWER(TRIM(?))').run(matched.id, cleanTitle);
      } else {
        db.prepare('DELETE FROM leaderboard WHERE LOWER(TRIM(game_title)) = LOWER(TRIM(?))').run(cleanTitle);
      }
      recordAudit('Admin', 'RESET_LEADERBOARD_GAME', `Reset skor leaderboard untuk permainan: ${cleanTitle}`);
    } else {
      db.prepare('DELETE FROM leaderboard').run();
      recordAudit('Admin', 'RESET_LEADERBOARD_ALL', 'Reset seluruh data skor leaderboard');
    }

    pruneInactiveLeaderboardScores();
    broadcastEvent('leaderboard:updated', { reset: true, gameTitle: gameTitle || null });
    res.json({
      success: true,
      message: gameTitle
        ? `Seluruh skor permainan "${gameTitle}" berhasil direset!`
        : 'Seluruh skor di Papan Peringkat berhasil direset total!',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

// Delete individual leaderboard score entry
app.delete('/api/v1/leaderboard/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const entry = db.prepare('SELECT * FROM leaderboard WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!entry) {
      res.status(404).json({ success: false, message: 'Data skor leaderboard tidak ditemukan' });
      return;
    }

    db.prepare('DELETE FROM leaderboard WHERE id = ?').run(id);
    recordAudit('Admin', 'DELETE_LEADERBOARD_SCORE', `Hapus skor ID #${id} milik ${entry.user_name} (${entry.game_title})`);
    broadcastEvent('leaderboard:updated', { deletedId: id });

    res.json({ success: true, message: 'Entri skor berhasil dihapus dari leaderboard' });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

// Testimonials
app.get('/api/v1/testimonials', (req: Request, res: Response) => {
  try {
    const { all } = req.query;
    let query = 'SELECT * FROM testimonials';
    if (!all) {
      query += " WHERE status = 'approved'";
    }
    query += ' ORDER BY id DESC';

    const rows = db.prepare(query).all() as Record<string, unknown>[];
    const formatted = rows.map((r) => ({
      id: r.id,
      name: r.name,
      role: r.role,
      game: r.game,
      rating: r.rating,
      message: r.message,
      status: r.status,
      createdAt: r.created_at,
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

app.post('/api/v1/testimonials', (req: Request, res: Response) => {
  try {
    const { name, role, game, rating, message } = req.body;
    if (!name || !message) {
      res.status(400).json({ success: false, message: 'Nama dan pesan ulasan wajib diisi' });
      return;
    }

    const info = db.prepare(`
      INSERT INTO testimonials (name, role, game, rating, message, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).run(name.trim(), role || 'Siswa', game || 'Platform Keseluruhan', Number(rating) || 5, message.trim());

    broadcastEvent('testimonial:created', { id: info.lastInsertRowid, name });

    res.json({ success: true, message: 'Testimoni Anda berhasil dikirim dan menunggu moderasi admin!' });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

app.patch('/api/v1/testimonials/:id/status', (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    if (!status || !['approved', 'pending', 'rejected'].includes(status)) {
      res.status(400).json({ success: false, message: 'Status tidak valid' });
      return;
    }

    db.prepare('UPDATE testimonials SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);
    recordAudit('Admin', 'MODERATE_TESTIMONIAL', `Testimonial ID ${id} set to ${status}`);
    broadcastEvent('testimonial:updated', { id, status });

    res.json({ success: true, message: `Status testimoni diperbarui menjadi: ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

app.delete('/api/v1/testimonials/:id', (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM testimonials WHERE id = ?').run(id);
    recordAudit('Admin', 'DELETE_TESTIMONIAL', `Deleted testimonial ID ${id}`);
    broadcastEvent('testimonial:deleted', { id });
    res.json({ success: true, message: 'Testimoni berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

// Licenses
app.get('/api/v1/licenses', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT * FROM licenses ORDER BY id DESC').all() as Record<string, unknown>[];
    const formatted = rows.map((r) => ({
      id: r.id,
      schoolName: r.school_name,
      plan: r.plan,
      status: r.status,
      expiresDate: r.expires_date,
      licenseKey: r.license_key,
    }));
    res.json({ success: true, data: formatted });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

app.post('/api/v1/licenses', (req: Request, res: Response) => {
  try {
    const { schoolName, plan, expiresDate } = req.body;
    if (!schoolName || !plan) {
      res.status(400).json({ success: false, message: 'Nama institusi dan paket lisensi wajib diisi' });
      return;
    }
    const cleanKey = 'PGB-LIC-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const info = db.prepare(`
      INSERT INTO licenses (school_name, plan, status, expires_date, license_key)
      VALUES (?, ?, 'Aktif', ?, ?)
    `).run(schoolName.trim(), plan.trim(), expiresDate || '2028-12-31', cleanKey);

    recordAudit('Admin', 'CREATE_LICENSE', `Issued license for: ${schoolName}`);
    broadcastEvent('license:created', { id: info.lastInsertRowid, schoolName: schoolName.trim(), licenseKey: cleanKey });
    res.json({ success: true, message: 'Lisensi berhasil diterbitkan', id: info.lastInsertRowid, licenseKey: cleanKey });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

app.delete('/api/v1/licenses/:id', (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const lic = db.prepare('SELECT school_name FROM licenses WHERE id = ?').get(id) as { school_name: string } | undefined;
    if (!lic) {
      res.status(404).json({ success: false, message: 'Lisensi sekolah tidak ditemukan' });
      return;
    }

    db.prepare('DELETE FROM licenses WHERE id = ?').run(id);
    recordAudit('Admin', 'DELETE_LICENSE', `Deleted school license: ${lic.school_name} (ID: ${id})`);
    broadcastEvent('license:deleted', { id, schoolName: lic.school_name });
    res.json({ success: true, message: `Lisensi untuk "${lic.school_name}" berhasil dihapus` });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

// Users Management
app.get('/api/v1/users', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all() as Record<string, unknown>[];
    const formatted = rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      avatar: r.avatar,
      xp: r.xp,
      badge: r.badge,
      level: r.level,
      school: r.school,
      role: (r.role as string) || 'user',
      createdAt: r.created_at,
    }));
    res.json({ success: true, data: formatted });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

app.post('/api/v1/users', (req: Request, res: Response) => {
  try {
    const { name, email, avatar, xp, badge, level, school, role, password } = req.body;
    if (!name || !email) {
      res.status(400).json({ success: false, message: 'Nama dan email pengguna wajib diisi' });
      return;
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase());
    if (existing) {
      res.status(400).json({ success: false, message: `Pengguna dengan email "${email}" sudah terdaftar` });
      return;
    }

    const id = 'usr-' + Date.now();
    const userRole = role && ['admin', 'uploader', 'user'].includes(role) ? role : 'user';
    const userPassword = password && String(password).trim().length > 0 ? String(password).trim() : 'dharma123';
    const userAvatar = avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name.trim())}`;
    db.prepare(`
      INSERT INTO users (id, name, email, avatar, xp, badge, level, school, role, password)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name.trim(),
      email.trim().toLowerCase(),
      userAvatar,
      Number(xp) || 100,
      badge || 'Sahabat Pemula Dharma',
      Number(level) || 1,
      school ? school.trim() : 'Umum',
      userRole,
      userPassword
    );

    recordAudit('Admin', 'CREATE_USER', `Added user: ${name} (${email}) as [${userRole}] with configured password`);
    broadcastEvent('user:created', { id, name, role: userRole });
    res.json({ success: true, message: `Pengguna baru tingkat "${userRole}" berhasil ditambahkan dengan kata sandi terkonfigurasi`, id });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

app.put('/api/v1/users/:id', (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { name, email, avatar, xp, badge, level, school, role, password } = req.body;
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as {
      name: string;
      email: string;
      avatar: string | null;
      xp: number;
      badge: string;
      level: number;
      school: string | null;
      role?: string;
      password?: string;
    } | undefined;

    if (!existing) {
      res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan' });
      return;
    }

    const updatedRole = role && ['admin', 'uploader', 'user'].includes(role) ? role : existing.role || 'user';
    const updatedPassword = password !== undefined && String(password).trim().length > 0 ? String(password).trim() : (existing.password || 'dharma123');
    
    db.prepare(`
      UPDATE users
      SET name = ?, email = ?, avatar = ?, xp = ?, badge = ?, level = ?, school = ?, role = ?, password = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name !== undefined ? String(name).trim() : existing.name,
      email !== undefined ? String(email).trim().toLowerCase() : existing.email,
      avatar !== undefined ? String(avatar) : (existing.avatar || ''),
      xp !== undefined ? Number(xp) : existing.xp,
      badge !== undefined ? String(badge) : existing.badge,
      level !== undefined ? Number(level) : existing.level,
      school !== undefined ? String(school).trim() : (existing.school || 'Umum'),
      String(updatedRole),
      String(updatedPassword),
      String(id)
    );

    recordAudit('Admin', 'UPDATE_USER', `Updated user ${id} (Role: ${updatedRole}, password updated: ${password ? 'Yes' : 'No'})`);
    broadcastEvent('user:updated', { id, role: updatedRole });
    res.json({ success: true, message: `Data pengguna berhasil diperbarui (Tingkat: ${updatedRole})` });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

// User Auth Endpoints: Register & Login with Password
app.post('/api/v1/auth/register', (req: Request, res: Response) => {
  try {
    const { name, email, password, school } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ success: false, message: 'Nama lengkap, email, dan kata sandi wajib diisi' });
      return;
    }

    if (String(password).trim().length < 4) {
      res.status(400).json({ success: false, message: 'Kata sandi minimal 4 karakter' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (existing) {
      res.status(400).json({ success: false, message: 'Email sudah terdaftar. Silakan masuk menggunakan kata sandi Anda.' });
      return;
    }

    const id = 'usr-' + Date.now();
    const userRole = 'user';
    const cleanName = name.trim();
    const cleanPassword = String(password).trim();
    const avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanName)}`;
    const cleanSchool = school ? String(school).trim() : 'Umum / Mandiri';

    db.prepare(`
      INSERT INTO users (id, name, email, avatar, xp, badge, level, school, role, password)
      VALUES (?, ?, ?, ?, 150, 'Sahabat Pemula Dharma', 1, ?, ?, ?)
    `).run(id, cleanName, cleanEmail, avatar, cleanSchool, userRole, cleanPassword);

    const newUser = {
      id,
      name: cleanName,
      email: cleanEmail,
      avatar,
      xp: 150,
      badge: 'Sahabat Pemula Dharma',
      level: 1,
      school: cleanSchool,
      role: userRole,
    };

    recordAudit(cleanName, 'USER_REGISTER', `Pendaftaran akun baru: ${cleanName} (${cleanEmail})`);
    broadcastEvent('user:created', { id, name: cleanName, role: userRole });
    res.json({ success: true, message: 'Pendaftaran akun berhasil! Selamat datang di Pusat Games Buddhis.', user: newUser });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

app.post('/api/v1/auth/login', (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email dan kata sandi wajib diisi' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = String(password).trim();

    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail) as {
      id: string;
      name: string;
      email: string;
      avatar: string | null;
      xp: number;
      badge: string;
      level: number;
      school: string | null;
      role?: string;
      password?: string;
      created_at: string;
    } | undefined;

    if (!row) {
      res.status(404).json({ success: false, message: 'Akun dengan email ini belum terdaftar. Silakan daftar akun baru terlebih dahulu.' });
      return;
    }

    const validPassword = row.password || 'dharma123';
    // Allow matching the stored password, or the master superadmin/uploader passwords if matching role
    const isPasswordValid =
      cleanPassword === validPassword ||
      (row.role === 'admin' && cleanPassword === 'admin321') ||
      (row.role === 'uploader' && cleanPassword === 'uploader123');

    if (!isPasswordValid) {
      recordAudit(row.name, 'USER_LOGIN_FAILED', `Percobaan login gagal untuk email ${cleanEmail}`);
      res.status(401).json({ success: false, message: 'Kata sandi salah. Silakan periksa kembali kata sandi Anda.' });
      return;
    }

    const userProfile = {
      id: row.id,
      name: row.name,
      email: row.email,
      avatar: row.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(row.name)}`,
      xp: row.xp,
      badge: row.badge,
      level: row.level,
      school: row.school || 'Umum',
      role: (row.role as 'admin' | 'uploader' | 'user') || 'user',
      createdAt: row.created_at,
    };

    recordAudit(row.name, 'USER_LOGIN_SUCCESS', `Login berhasil sebagai [${userProfile.role}]`);
    res.json({ success: true, message: `Selamat datang kembali, ${row.name}!`, user: userProfile });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

app.delete('/api/v1/users/:id', (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const u = db.prepare('SELECT name, role FROM users WHERE id = ?').get(id) as { name: string; role?: string } | undefined;
    if (!u) {
      res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan' });
      return;
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    recordAudit('Admin', 'DELETE_USER', `Deleted user: ${u.name} (Role: ${u.role}, ID: ${id})`);
    broadcastEvent('user:deleted', { id, name: u.name });
    res.json({ success: true, message: `Pengguna "${u.name}" berhasil dihapus` });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

// Certificates
app.get('/api/v1/certificates', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT * FROM certificates ORDER BY created_at DESC, id DESC').all() as Record<string, unknown>[];
    const formatted = rows.map((r) => {
      const active = r.is_active === 0 || r.status === 'inactive' ? false : true;
      return {
        id: r.id,
        studentName: r.student_name,
        module: r.module,
        institution: r.institution,
        date: r.date,
        certificateNumber: r.certificate_number,
        verificationCode: r.verification_code,
        isActive: active,
        status: active ? 'active' : 'inactive',
        createdAt: r.created_at,
      };
    });
    res.json({ success: true, data: formatted });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

app.get('/api/v1/certificates/verify/:code', (req: Request, res: Response) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    const r = db.prepare('SELECT * FROM certificates WHERE verification_code = ? OR id = ?').get(code, code) as Record<string, unknown> | undefined;

    if (!r) {
      res.status(404).json({ success: false, message: `Kode sertifikat "${code}" tidak ditemukan dalam arsip resmi.` });
      return;
    }

    const active = r.is_active === 0 || r.status === 'inactive' ? false : true;

    res.json({
      success: true,
      data: {
        id: r.id,
        studentName: r.student_name,
        module: r.module,
        institution: r.institution,
        date: r.date,
        certificateNumber: r.certificate_number,
        verificationCode: r.verification_code,
        isActive: active,
        status: active ? 'active' : 'inactive',
        isValid: active,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

app.post('/api/v1/certificates', (req: Request, res: Response) => {
  try {
    const { studentName, module, institution } = req.body;
    if (!studentName || !module) {
      res.status(400).json({ success: false, message: 'Nama siswa dan modul wajib diisi' });
      return;
    }

    const year = new Date().getFullYear();
    let nextId = `CERT-${year}-${Math.floor(100 + Math.random() * 900)}`;
    while (db.prepare('SELECT id FROM certificates WHERE id = ?').get(nextId)) {
      nextId = `CERT-${year}-${Math.floor(1000 + Math.random() * 9000)}`;
    }
    const certNum = `PGB/DHARMA/${year}/${Math.floor(1000 + Math.random() * 9000)}`;
    const today = new Date().toISOString().split('T')[0];

    db.prepare(`
      INSERT INTO certificates (id, student_name, module, institution, date, certificate_number, verification_code, is_active, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'active')
    `).run(nextId, studentName.trim(), module.trim(), institution || 'Pusat Games Buddhis Indonesia', today, certNum, nextId);

    recordAudit('Admin', 'ISSUE_CERTIFICATE', `Issued certificate ${nextId} for ${studentName}`);
    broadcastEvent('certificate:created', { id: nextId, studentName: studentName.trim() });

    res.json({ success: true, message: 'Sertifikat berhasil diterbitkan!', id: nextId, verificationCode: nextId });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

app.patch('/api/v1/certificates/:id/status', (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).trim();
    const existing = db.prepare('SELECT id, student_name, verification_code, is_active, status FROM certificates WHERE id = ? OR verification_code = ?').get(id, id) as
      | { id: string; student_name: string; verification_code: string; is_active?: number; status?: string }
      | undefined;
    if (!existing) {
      res.status(404).json({ success: false, message: 'Sertifikat tidak ditemukan' });
      return;
    }

    const { isActive } = req.body;
    const currentActive = existing.is_active === 0 || existing.status === 'inactive' ? 0 : 1;
    const newActive = isActive !== undefined ? (isActive ? 1 : 0) : (currentActive === 1 ? 0 : 1);
    const newStatus = newActive === 1 ? 'active' : 'inactive';

    db.prepare('UPDATE certificates SET is_active = ?, status = ? WHERE id = ?').run(newActive, newStatus, existing.id);

    recordAudit(
      'Admin',
      'TOGGLE_CERTIFICATE_STATUS',
      `Sertifikat ${existing.verification_code} (${existing.student_name}) diubah status menjadi: ${newActive ? 'Aktif' : 'Nonaktif'}`
    );
    broadcastEvent('certificate:updated', { id: existing.id, isActive: Boolean(newActive), status: newStatus });

    res.json({
      success: true,
      message: `Sertifikat "${existing.verification_code}" berhasil di-${newActive ? 'aktifkan' : 'nonaktifkan'}!`,
      isActive: Boolean(newActive),
      status: newStatus,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

app.delete('/api/v1/certificates/:id', (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).trim();
    const existing = db.prepare('SELECT id, student_name, verification_code FROM certificates WHERE id = ? OR verification_code = ?').get(id, id) as
      | { id: string; student_name: string; verification_code: string }
      | undefined;

    if (!existing) {
      res.status(404).json({ success: false, message: 'Sertifikat tidak ditemukan' });
      return;
    }

    db.prepare('DELETE FROM certificates WHERE id = ?').run(existing.id);
    recordAudit('Admin', 'DELETE_CERTIFICATE', `Deleted certificate ${existing.verification_code} (${existing.student_name})`);
    broadcastEvent('certificate:deleted', { id: existing.id, verificationCode: existing.verification_code });

    res.json({
      success: true,
      message: `Sertifikat "${existing.verification_code}" (${existing.student_name}) berhasil dihapus dari arsip!`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

// Audit Logs
app.get('/api/v1/audit-logs', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 50').all() as Record<string, unknown>[];
    const formatted = rows.map((r) => ({
      id: r.id,
      actor: r.actor,
      action: r.action,
      details: r.details,
      createdAt: r.created_at,
    }));
    res.json({ success: true, data: formatted });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

// Admin & Uploader Auth Gate
app.post('/api/v1/auth/admin-login', (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    if (password === 'admin321') {
      recordAudit('Admin', 'LOGIN_SUCCESS', 'Administrator logged into Admin Hub Studio (Pengelola Penuh)');
      res.json({ success: true, role: 'admin', message: 'Akses Administrator Penuh (Pengelola Penuh) diverifikasi' });
    } else if (password === 'uploader123') {
      recordAudit('Uploader', 'LOGIN_SUCCESS', 'Uploader logged into Admin Hub Studio (Khusus Upload Game)');
      res.json({ success: true, role: 'uploader', message: 'Akses Uploader (Khusus Upload Game) diverifikasi' });
    } else {
      recordAudit('Anonymous', 'LOGIN_FAILED', 'Gagal verifikasi kata sandi admin/uploader');
      res.status(401).json({ success: false, message: 'Kata sandi salah! Gunakan sandi admin321 (Pengelola Penuh) atau uploader123 (Upload Game).' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

// ==========================================
// USER ACTIVITY & GAME ACCESS TRACKING
// ==========================================
function parseDeviceInfo(uaString: string) {
  const ua = uaString || '';
  let deviceType: 'Ponsel (HP)' | 'Tablet' | 'Desktop PC' = 'Desktop PC';
  let deviceModel = 'Komputer / Laptop';

  const isTablet = /iPad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk/i.test(ua);
  const isMobile = /Mobile|iPhone|Android.*Mobile|iPod|BlackBerry|IEMobile|Opera Mini|webOS|Windows Phone/i.test(ua);

  if (isTablet) {
    deviceType = 'Tablet';
    if (/iPad/i.test(ua)) deviceModel = 'Apple iPad';
    else if (/Android/i.test(ua)) deviceModel = 'Android Tablet';
    else deviceModel = 'Tablet Layar Sentuh';
  } else if (isMobile) {
    deviceType = 'Ponsel (HP)';
    if (/iPhone/i.test(ua)) deviceModel = 'Apple iPhone';
    else if (/Samsung|SM-|GT-/i.test(ua)) deviceModel = 'Samsung Galaxy';
    else if (/Xiaomi|Redmi|POCO/i.test(ua)) deviceModel = 'Xiaomi / Redmi';
    else if (/Oppo|CPH/i.test(ua)) deviceModel = 'OPPO Smartphone';
    else if (/Vivo/i.test(ua)) deviceModel = 'Vivo Smartphone';
    else if (/Android/i.test(ua)) deviceModel = 'Android Smartphone';
    else deviceModel = 'Smartphone Seluler';
  } else {
    deviceType = 'Desktop PC';
    if (/Macintosh|Mac OS X/i.test(ua)) deviceModel = 'Apple Mac / MacBook';
    else if (/Windows/i.test(ua)) deviceModel = 'Windows PC / Laptop';
    else if (/Linux/i.test(ua)) deviceModel = 'Linux Desktop';
    else deviceModel = 'Desktop PC';
  }

  let os = 'Unknown OS';
  if (/Windows NT 10.0/i.test(ua)) os = 'Windows 10/11';
  else if (/Windows NT 6.3/i.test(ua)) os = 'Windows 8.1';
  else if (/Windows NT 6.1/i.test(ua)) os = 'Windows 7';
  else if (/Android\s([0-9\.]+)/i.test(ua)) {
    const match = ua.match(/Android\s([0-9\.]+)/i);
    os = `Android ${match ? match[1] : ''}`.trim();
  } else if (/iPhone OS\s([0-9_]+)/i.test(ua) || /CPU OS\s([0-9_]+)/i.test(ua)) {
    const match = ua.match(/(iPhone|CPU)\sOS\s([0-9_]+)/i);
    os = `iOS ${match ? match[2].replace(/_/g, '.') : ''}`.trim();
  } else if (/Mac OS X\s([0-9_]+)/i.test(ua)) {
    const match = ua.match(/Mac OS X\s([0-9_]+)/i);
    os = `macOS ${match ? match[1].replace(/_/g, '.') : ''}`.trim();
  } else if (/Linux/i.test(ua)) os = 'Linux';
  else if (/CrOS/i.test(ua)) os = 'ChromeOS';

  let browser = 'Browser Web';
  if (/Edg\/([0-9\.]+)/i.test(ua)) {
    const m = ua.match(/Edg\/([0-9\.]+)/i);
    browser = `Microsoft Edge ${m ? m[1].split('.')[0] : ''}`.trim();
  } else if (/Chrome\/([0-9\.]+)/i.test(ua) && !/Edg/i.test(ua) && !/OPR/i.test(ua)) {
    const m = ua.match(/Chrome\/([0-9\.]+)/i);
    browser = `Google Chrome ${m ? m[1].split('.')[0] : ''}`.trim();
  } else if (/Safari\/([0-9\.]+)/i.test(ua) && !/Chrome/i.test(ua)) {
    const m = ua.match(/Version\/([0-9\.]+)/i);
    browser = `Safari ${m ? m[1].split('.')[0] : ''}`.trim();
  } else if (/Firefox\/([0-9\.]+)/i.test(ua)) {
    const m = ua.match(/Firefox\/([0-9\.]+)/i);
    browser = `Mozilla Firefox ${m ? m[1].split('.')[0] : ''}`.trim();
  } else if (/OPR\/([0-9\.]+)/i.test(ua) || /Opera/i.test(ua)) {
    browser = 'Opera Browser';
  } else if (/SamsungBrowser\/([0-9\.]+)/i.test(ua)) {
    browser = 'Samsung Internet';
  }

  return { deviceType, deviceModel, browser, os };
}

function resolveClientLocation(req: Request, clientTz?: string): { country: string; code: string; city: string } {
  const cfCountry = req.headers['cf-ipcountry'] as string;
  const gcpCountry = (req.headers['x-appengine-country'] || req.headers['x-country-code']) as string;
  const code = (cfCountry || gcpCountry || '').toUpperCase();

  const countryNames: Record<string, string> = {
    ID: 'Indonesia',
    SG: 'Singapura',
    MY: 'Malaysia',
    TH: 'Thailand',
    VN: 'Vietnam',
    PH: 'Filipina',
    US: 'Amerika Serikat',
    AU: 'Australia',
    JP: 'Jepang',
    KR: 'Korea Selatan',
    TW: 'Taiwan',
    CN: 'Tiongkok',
    IN: 'India',
    GB: 'Inggris',
    DE: 'Jerman',
    NL: 'Belanda',
  };

  if (code && countryNames[code]) {
    return { country: countryNames[code], code, city: (req.headers['x-appengine-city'] as string) || 'Online' };
  }

  if (clientTz) {
    if (clientTz.includes('Jakarta') || clientTz.includes('Makassar') || clientTz.includes('Jayapura') || clientTz.includes('Pontianak') || clientTz.includes('Asia/Jakarta')) {
      return { country: 'Indonesia', code: 'ID', city: clientTz.split('/')[1] || 'Indonesia' };
    }
    if (clientTz.includes('Singapore')) return { country: 'Singapura', code: 'SG', city: 'Singapore' };
    if (clientTz.includes('Kuala_Lumpur')) return { country: 'Malaysia', code: 'MY', city: 'Kuala Lumpur' };
    if (clientTz.includes('Bangkok')) return { country: 'Thailand', code: 'TH', city: 'Bangkok' };
    if (clientTz.includes('Tokyo')) return { country: 'Jepang', code: 'JP', city: 'Tokyo' };
  }

  return { country: 'Indonesia', code: 'ID', city: 'Nusantara' };
}

// 1. Record Game Access (called whenever any user - logged in or guest - launches/plays a game)
app.post('/api/v1/analytics/game-access', (req: Request, res: Response) => {
  try {
    const { gameId, gameTitle, gameCategory, user, clientInfo } = req.body;
    if (!gameTitle) {
      res.status(400).json({ success: false, message: 'gameTitle wajib disertakan' });
      return;
    }

    const uaString = req.headers['user-agent'] || '';
    const { deviceType, deviceModel, browser, os } = parseDeviceInfo(uaString);
    const { country, code: countryCode, city } = resolveClientLocation(req, clientInfo?.timezone);

    // Resolve IP address
    const forwarded = req.headers['x-forwarded-for'];
    const ipAddress = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : (req.headers['x-real-ip'] as string)) || req.socket.remoteAddress || '127.0.0.1';

    const userId = user?.id || null;
    const userName = user?.name ? user.name.trim() : 'Tamu / Pengunjung Tanpa Login';
    const userRole = user?.role || (user?.id ? 'member' : 'tamu');
    const screenRes = clientInfo?.screen || null;

    const info = db.prepare(`
      INSERT INTO game_access_logs (
        game_id, game_title, game_category, user_id, user_name, user_role,
        ip_address, device_type, device_model, browser, os, screen_resolution,
        country, country_code, city, user_agent, duration_seconds, completed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
    `).run(
      gameId || null,
      gameTitle,
      gameCategory || 'Umum',
      userId,
      userName,
      userRole,
      ipAddress,
      deviceType,
      deviceModel,
      browser,
      os,
      screenRes,
      country,
      countryCode,
      city,
      uaString.slice(0, 255)
    );

    // Increment player count in games table and notify connected clients
    if (gameId) {
      db.prepare('UPDATE games SET players = players + 1 WHERE id = ?').run(gameId);
    }
    broadcastEvent('stats:updated', { gameId: gameId || null, gameTitle });

    res.json({
      success: true,
      logId: info.lastInsertRowid,
      detected: { deviceType, deviceModel, browser, os, country, ipAddress },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

// 2. Game Heartbeat / Duration & Completion update
app.post('/api/v1/analytics/game-heartbeat', (req: Request, res: Response) => {
  try {
    const { logId, durationSeconds, completed } = req.body;
    if (!logId) {
      res.status(400).json({ success: false, message: 'logId wajib disertakan' });
      return;
    }

    if (completed) {
      db.prepare('UPDATE game_access_logs SET duration_seconds = ?, completed = 1 WHERE id = ?').run(durationSeconds || 0, logId);
      broadcastEvent('stats:updated', { logId, completed: true });
    } else {
      db.prepare('UPDATE game_access_logs SET duration_seconds = ? WHERE id = ?').run(durationSeconds || 0, logId);
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

// 3. Get User Access Statistics Overview
app.get('/api/v1/analytics/stats', (_req: Request, res: Response) => {
  try {
    const totalAccess = (db.prepare('SELECT COUNT(*) as count FROM game_access_logs').get() as { count: number }).count;
    const uniqueIps = (db.prepare('SELECT COUNT(DISTINCT ip_address) as count FROM game_access_logs').get() as { count: number }).count;
    const registeredUsersCount = (db.prepare("SELECT COUNT(*) as count FROM game_access_logs WHERE user_role != 'tamu'").get() as { count: number }).count;
    const guestUsersCount = (db.prepare("SELECT COUNT(*) as count FROM game_access_logs WHERE user_role = 'tamu'").get() as { count: number }).count;
    const completedGamesCount = (db.prepare('SELECT COUNT(*) as count FROM game_access_logs WHERE completed = 1').get() as { count: number }).count;

    // Devices breakdown
    const mobileCount = (db.prepare("SELECT COUNT(*) as count FROM game_access_logs WHERE device_type LIKE '%Ponsel%'").get() as { count: number }).count;
    const tabletCount = (db.prepare("SELECT COUNT(*) as count FROM game_access_logs WHERE device_type LIKE '%Tablet%'").get() as { count: number }).count;
    const desktopCount = (db.prepare("SELECT COUNT(*) as count FROM game_access_logs WHERE device_type LIKE '%Desktop%'").get() as { count: number }).count;

    // Browsers breakdown
    const browsers = db.prepare(`
      SELECT browser as name, COUNT(*) as count
      FROM game_access_logs
      GROUP BY browser
      ORDER BY count DESC
      LIMIT 6
    `).all() as { name: string; count: number }[];

    // Operating systems breakdown
    const operatingSystems = db.prepare(`
      SELECT os as name, COUNT(*) as count
      FROM game_access_logs
      GROUP BY os
      ORDER BY count DESC
      LIMIT 6
    `).all() as { name: string; count: number }[];

    // Countries breakdown
    const countries = db.prepare(`
      SELECT country as name, country_code as code, COUNT(*) as count
      FROM game_access_logs
      GROUP BY country, country_code
      ORDER BY count DESC
      LIMIT 8
    `).all() as { name: string; code: string; count: number }[];

    // Top accessed games
    const topGames = db.prepare(`
      SELECT game_title as title, COUNT(*) as count
      FROM game_access_logs
      GROUP BY game_title
      ORDER BY count DESC
      LIMIT 8
    `).all() as { title: string; count: number }[];

    res.json({
      success: true,
      data: {
        totalAccess,
        uniqueIps,
        registeredUsersCount,
        guestUsersCount,
        completedGamesCount,
        devices: {
          mobile: mobileCount,
          tablet: tabletCount,
          desktop: desktopCount,
        },
        browsers,
        operatingSystems,
        countries,
        topGames,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

// 4. Get Detailed Access Logs List
app.get('/api/v1/analytics/logs', (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const device = typeof req.query.device === 'string' ? req.query.device.trim() : '';

    let query = 'SELECT * FROM game_access_logs';
    const params: (string | number)[] = [];
    const conditions: string[] = [];

    if (search) {
      conditions.push('(game_title LIKE ? OR user_name LIKE ? OR ip_address LIKE ? OR country LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (device) {
      conditions.push('device_type LIKE ?');
      params.push(`%${device}%`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY id DESC LIMIT ?';
    params.push(limit);

    const rows = db.prepare(query).all(...params) as Record<string, unknown>[];
    const formatted = rows.map((r) => ({
      id: r.id,
      gameId: r.game_id,
      gameTitle: r.game_title,
      gameCategory: r.game_category,
      userId: r.user_id,
      userName: r.user_name,
      userRole: r.user_role,
      ipAddress: r.ip_address,
      deviceType: r.device_type,
      deviceModel: r.device_model,
      browser: r.browser,
      os: r.os,
      screenResolution: r.screen_resolution,
      country: r.country,
      countryCode: r.country_code,
      city: r.city,
      durationSeconds: r.duration_seconds,
      completed: !!r.completed,
      createdAt: r.created_at,
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

// 5. Delete / Clear Access Logs (Protected with password admin321)
app.delete('/api/v1/analytics/logs', (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    if (password !== 'admin321') {
      recordAudit('Anonymous', 'CLEAR_ACCESS_LOGS_DENIED', 'Percobaan hapus log akses dengan kata sandi salah');
      res.status(403).json({ success: false, message: 'Kata sandi salah! Pembersihan log dibatalkan.' });
      return;
    }

    db.prepare('DELETE FROM game_access_logs').run();
    recordAudit('Admin', 'CLEAR_ACCESS_LOGS', 'Membersihkan seluruh data log akses game pengguna');
    broadcastEvent('stats:updated', { logsCleared: true });
    res.json({ success: true, message: 'Seluruh riwayat log akses pengguna berhasil dibersihkan!' });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

// ==========================================
// BACKUP EXPORT, IMPORT & SNAPSHOT ROUTES
// ==========================================

function createDbSnapshotFile(targetPath: string) {
  if (fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath);
  }
  const escaped = targetPath.replace(/'/g, "''");
  try {
    db.exec(`VACUUM INTO '${escaped}'`);
  } catch {
    try {
      if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
    } catch {
      // ignore
    }
    try {
      db.exec('REINDEX;');
      db.exec(`VACUUM INTO '${escaped}'`);
    } catch {
      try {
        if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
      } catch {
        // ignore
      }
      try {
        db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
      } catch {
        // ignore
      }
      fs.copyFileSync(DB_PATH, targetPath);
    }
  }
  if (!fs.existsSync(targetPath) || fs.statSync(targetPath).size <= 0) {
    try {
      db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    } catch {
      // ignore
    }
    fs.copyFileSync(DB_PATH, targetPath);
  }
}

function createSafetySnapshotInBackupDir(prefix = 'portal_game_backup'): string {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  const filename = `${prefix}_${formatSnapshotTimestamp()}.db`;
  const fullPath = path.join(BACKUP_DIR, filename);
  createDbSnapshotFile(fullPath);
  return filename;
}

function buildCurrentBackupPayload() {
  const games = (db.prepare('SELECT * FROM games ORDER BY id ASC').all() as Record<string, unknown>[]).map((g) => ({
    id: g.id,
    title: g.title,
    slug: g.slug,
    category: g.category,
    difficulty: g.difficulty,
    type: g.type,
    rating: g.rating,
    players: g.players,
    thumbnail: g.thumbnail || '',
    icon: g.icon || '',
    description: g.description || '',
    isPremium: Boolean(g.is_premium),
    isActive: g.is_active === undefined || g.is_active === null ? true : Boolean(g.is_active),
    html5Code: g.html5_code || '',
    url: g.url || '',
    status: g.status || 'published',
    featured: Boolean(g.featured),
  }));

  const categories = (db.prepare('SELECT * FROM categories ORDER BY sort_order ASC, id ASC').all() as Record<string, unknown>[]).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    icon: c.icon,
    sortOrder: c.sort_order ?? 0,
    status: c.status ?? 1,
  }));

  const settingsRows = db.prepare('SELECT key, value FROM site_settings').all() as { key: string; value: string }[];
  const siteSettings: Record<string, string> = {};
  settingsRows.forEach((s) => {
    siteSettings[s.key] = s.value;
  });

  const certificates = (db.prepare('SELECT * FROM certificates ORDER BY created_at ASC').all() as Record<string, unknown>[]).map((c) => ({
    id: c.id,
    studentName: c.student_name,
    module: c.module,
    institution: c.institution,
    date: c.date,
    certificateNumber: c.certificate_number,
    verificationCode: c.verification_code,
    isActive: c.is_active === 0 || c.status === 'inactive' ? false : true,
    status: c.is_active === 0 || c.status === 'inactive' ? 'inactive' : 'active',
  }));

  const testimonials = (db.prepare('SELECT * FROM testimonials ORDER BY id ASC').all() as Record<string, unknown>[]).map((t) => ({
    name: t.name,
    role: t.role,
    game: t.game,
    rating: t.rating,
    message: t.message,
    status: t.status,
  }));

  const licenses = (db.prepare('SELECT * FROM licenses ORDER BY id ASC').all() as Record<string, unknown>[]).map((l) => ({
    schoolName: l.school_name,
    plan: l.plan,
    status: l.status,
    expiresDate: l.expires_date,
    licenseKey: l.license_key,
  }));

  const leaderboard = (db.prepare('SELECT * FROM leaderboard ORDER BY id ASC').all() as Record<string, unknown>[]).map((lb) => ({
    userName: lb.user_name,
    userEmail: lb.user_email || '',
    avatar: lb.avatar || '',
    gameTitle: lb.game_title,
    score: lb.score,
    xpEarned: lb.xp_earned,
    badge: lb.badge || 'Sahabat Pemula Dharma',
    school: lb.school || '',
  }));

  // Export non-sensitive user metadata (never expose raw passwords in backup exports)
  const users = (db.prepare('SELECT id, name, email, avatar, xp, badge, level, school, role FROM users ORDER BY created_at ASC').all() as Record<string, unknown>[]).map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    avatar: u.avatar || '',
    xp: u.xp ?? 100,
    badge: u.badge || 'Sahabat Pemula Dharma',
    level: u.level ?? 1,
    school: u.school || '',
    role: u.role || 'user',
  }));

  const payload = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    data: {
      games,
      categories,
      siteSettings,
      certificates,
      testimonials,
      licenses,
      leaderboard,
      users,
    },
  };

  return {
    ...payload,
    counts: summarizeBackupPayload(parseBackupPayload(payload)),
  };
}

function readBackupDataFromSqliteFile(sqliteFilePath: string): NormalizedBackupData {
  const extDb = new DatabaseSync(sqliteFilePath, { readOnly: true });
  try {
    const tableRows = extDb
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as { name: string }[];
    const tables = new Set(tableRows.map((t) => t.name));

    const safeAll = (table: string, cols = '*') => {
      if (!tables.has(table)) return [];
      return extDb.prepare(`SELECT ${cols} FROM ${table}`).all() as Record<string, unknown>[];
    };

    const rawUsers = tables.has('users')
      ? (extDb.prepare('SELECT id, name, email, avatar, xp, badge, level, school, role FROM users').all() as Record<string, unknown>[])
      : [];

    return parseBackupPayload({
      data: {
        games: safeAll('games'),
        categories: safeAll('categories'),
        siteSettings: safeAll('site_settings'),
        certificates: safeAll('certificates'),
        testimonials: safeAll('testimonials'),
        licenses: safeAll('licenses'),
        leaderboard: safeAll('leaderboard'),
        users: rawUsers,
      },
    });
  } finally {
    extDb.close();
  }
}

function executeNormalizedBackupImport(
  parsed: NormalizedBackupData,
  mode: 'merge' | 'replace',
  sourceLabel: string
) {
  const safetySnapshot = createSafetySnapshotInBackupDir(`pre-${mode}`);

  db.exec('BEGIN IMMEDIATE');
  try {
    if (mode === 'replace') {
      db.prepare('DELETE FROM games').run();
      db.prepare('DELETE FROM categories').run();
      db.prepare('DELETE FROM certificates').run();
      db.prepare('DELETE FROM testimonials').run();
      db.prepare('DELETE FROM licenses').run();
      db.prepare('DELETE FROM leaderboard').run();
    }

    // 1. Categories
    for (const cat of parsed.categories) {
      const existingCats = db.prepare('SELECT id, name FROM categories').all() as { id: number; name: string }[];
      const { matchedCategory } = resolveCategoryMatch(cat.name, existingCats);
      if (matchedCategory && matchedCategory.id !== undefined) {
        db.prepare('UPDATE categories SET icon = ?, sort_order = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(cat.icon || 'fa-seedling', cat.sortOrder, cat.status, matchedCategory.id);
      } else {
        db.prepare('INSERT INTO categories (name, slug, icon, sort_order, status) VALUES (?, ?, ?, ?, ?)')
          .run(cat.name, cat.slug, cat.icon || 'fa-seedling', cat.sortOrder, cat.status);
      }
    }

    // 2. Games (auto-synchronizes category and preserves existing thumbnail, icon, HTML5 code in merge mode)
    for (const game of parsed.games) {
      const syncedCategory = ensureSynchronizedCategory(game.category, undefined, false);
      const existingGame = db
        .prepare('SELECT id, players, thumbnail, icon, html5_code, url FROM games WHERE LOWER(title) = LOWER(?) AND LOWER(category) = LOWER(?)')
        .get(game.title, syncedCategory) as {
          id: number;
          players: number;
          thumbnail: string | null;
          icon: string | null;
          html5_code: string | null;
          url: string | null;
        } | undefined;

      if (existingGame) {
        const mergedPlayers = Math.max(Number(existingGame.players || 0), game.players);
        const mergedThumbnail =
          mode === 'merge'
            ? (game.thumbnail && String(game.thumbnail).trim() ? game.thumbnail : String(existingGame.thumbnail || ''))
            : game.thumbnail;
        const mergedIcon =
          mode === 'merge'
            ? (game.icon && String(game.icon).trim() ? game.icon : String(existingGame.icon || ''))
            : game.icon;
        const mergedHtml5 =
          mode === 'merge'
            ? (game.html5Code || String(existingGame.html5_code || ''))
            : game.html5Code;
        const mergedUrl =
          mode === 'merge'
            ? (game.url || String(existingGame.url || ''))
            : game.url;

        db.prepare(`
          UPDATE games
          SET slug = ?, difficulty = ?, type = ?, rating = ?, players = ?,
              thumbnail = ?, icon = ?, description = ?, is_premium = ?, is_active = ?,
              html5_code = ?, url = ?, status = ?, featured = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          game.slug,
          game.difficulty,
          game.type,
          game.rating,
          mergedPlayers,
          mergedThumbnail,
          mergedIcon,
          game.description,
          game.isPremium ? 1 : 0,
          game.isActive ? 1 : 0,
          mergedHtml5,
          mergedUrl,
          game.status,
          game.featured ? 1 : 0,
          existingGame.id
        );
      } else {
        db.prepare(`
          INSERT INTO games (
            title, slug, category, difficulty, type, rating, players,
            thumbnail, icon, description, is_premium, is_active, html5_code, url, status, featured
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          game.title,
          game.slug,
          syncedCategory,
          game.difficulty,
          game.type,
          game.rating,
          game.players,
          game.thumbnail,
          game.icon,
          game.description,
          game.isPremium ? 1 : 0,
          game.isActive ? 1 : 0,
          game.html5Code,
          game.url,
          game.status,
          game.featured ? 1 : 0
        );
      }
    }

    // 3. Site Settings (Banner, Hero Title/Subtitle, Logo Image, Announcement) - non-destructive in merge mode
    const currentSettingRows = db.prepare('SELECT key, value FROM site_settings').all() as { key: string; value: string }[];
    const currentSettingsObj: Record<string, string> = {};
    for (const r of currentSettingRows) {
      currentSettingsObj[r.key] = r.value;
    }
    const finalSettings = mergeExistingAndImportedSettings(
      currentSettingsObj,
      parsed.siteSettings,
      mode
    );
    const upsertSetting = db.prepare(`
      INSERT INTO site_settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `);
    for (const [k, v] of Object.entries(finalSettings)) {
      if (v !== undefined) {
        upsertSetting.run(k, String(v));
      }
    }

    // 4. Certificates
    for (const cert of parsed.certificates) {
      const existingCert = db
        .prepare('SELECT id FROM certificates WHERE id = ? OR verification_code = ?')
        .get(cert.id, cert.verificationCode) as { id: string } | undefined;

      if (existingCert) {
        db.prepare(`
          UPDATE certificates
          SET student_name = ?, module = ?, institution = ?, date = ?,
              certificate_number = ?, verification_code = ?, is_active = ?, status = ?
          WHERE id = ?
        `).run(
          cert.studentName,
          cert.module,
          cert.institution,
          cert.date,
          cert.certificateNumber,
          cert.verificationCode,
          cert.isActive ? 1 : 0,
          cert.status,
          existingCert.id
        );
      } else {
        db.prepare(`
          INSERT INTO certificates (id, student_name, module, institution, date, certificate_number, verification_code, is_active, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          cert.id,
          cert.studentName,
          cert.module,
          cert.institution,
          cert.date,
          cert.certificateNumber,
          cert.verificationCode,
          cert.isActive ? 1 : 0,
          cert.status
        );
      }
    }

    // 5. Testimonials
    for (const testi of parsed.testimonials) {
      const dup = db
        .prepare('SELECT id FROM testimonials WHERE LOWER(name) = LOWER(?) AND LOWER(game) = LOWER(?) AND message = ?')
        .get(testi.name, testi.game, testi.message);
      if (!dup) {
        db.prepare(`
          INSERT INTO testimonials (name, role, game, rating, message, status)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(testi.name, testi.role, testi.game, testi.rating, testi.message, testi.status);
      }
    }

    // 6. Licenses
    for (const lic of parsed.licenses) {
      const existingLic = db
        .prepare('SELECT id FROM licenses WHERE license_key = ?')
        .get(lic.licenseKey) as { id: number } | undefined;
      if (existingLic) {
        db.prepare(`
          UPDATE licenses SET school_name = ?, plan = ?, status = ?, expires_date = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(lic.schoolName, lic.plan, lic.status, lic.expiresDate, existingLic.id);
      } else {
        db.prepare(`
          INSERT INTO licenses (school_name, plan, status, expires_date, license_key)
          VALUES (?, ?, ?, ?, ?)
        `).run(lic.schoolName, lic.plan, lic.status, lic.expiresDate, lic.licenseKey);
      }
    }

    // 7. Leaderboard (prune entries for non-active/deleted games)
    for (const lb of parsed.leaderboard) {
      const matchedGame = db
        .prepare("SELECT id, title FROM games WHERE LOWER(TRIM(title)) = LOWER(TRIM(?)) AND is_active = 1 AND (status IS NULL OR status != 'inactive') LIMIT 1")
        .get(lb.gameTitle) as { id: number; title: string } | undefined;
      if (!matchedGame) continue;
      const dup = db
        .prepare('SELECT id FROM leaderboard WHERE LOWER(user_name) = LOWER(?) AND game_id = ? AND score = ?')
        .get(lb.userName, matchedGame.id, lb.score);
      if (!dup) {
        db.prepare(`
          INSERT INTO leaderboard (user_name, user_email, avatar, game_id, game_title, score, xp_earned, badge, school)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(lb.userName, lb.userEmail, lb.avatar, matchedGame.id, matchedGame.title, lb.score, lb.xpEarned, lb.badge, lb.school);
      }
    }
    pruneInactiveLeaderboardScores();

    // 8. Users (preserve existing passwords; never downgrade XP/level or wipe avatar/school in merge mode)
    for (const u of parsed.users) {
      const existingUser = db
        .prepare('SELECT id, xp, level, badge, school, avatar FROM users WHERE id = ? OR LOWER(email) = LOWER(?)')
        .get(u.id, u.email) as {
          id: string;
          xp: number;
          level: number;
          badge: string | null;
          school: string | null;
          avatar: string | null;
        } | undefined;
      if (existingUser) {
        const mergedXp = mode === 'merge' ? Math.max(Number(existingUser.xp || 0), u.xp) : u.xp;
        const mergedLevel = mode === 'merge' ? Math.max(Number(existingUser.level || 1), u.level) : u.level;
        const mergedAvatar = mode === 'merge' ? (u.avatar || String(existingUser.avatar || '')) : u.avatar;
        const mergedSchool = mode === 'merge' ? (u.school || String(existingUser.school || '')) : u.school;
        const mergedBadge = mode === 'merge' ? (u.badge || String(existingUser.badge || 'Sahabat Pemula Dharma')) : u.badge;

        db.prepare(`
          UPDATE users SET name = ?, avatar = ?, xp = ?, badge = ?, level = ?, school = ?, role = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(u.name, mergedAvatar, mergedXp, mergedBadge, mergedLevel, mergedSchool, u.role, existingUser.id);
      } else {
        db.prepare(`
          INSERT INTO users (id, name, email, avatar, xp, badge, level, school, role, password)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(u.id, u.name, u.email, u.avatar, u.xp, u.badge, u.level, u.school, u.role, 'dharma123');
      }
    }

    db.exec('COMMIT');
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignore rollback error
    }
    throw err;
  }

  const importedCounts = summarizeBackupPayload(parsed);
  recordAudit(
    'Admin',
    'IMPORT_BACKUP',
    `Import backup (${mode}) dari ${sourceLabel}: ${importedCounts.games} game, ${importedCounts.categories} kategori, ${importedCounts.certificates} sertifikat. Snapshot pengaman: ${safetySnapshot}`
  );
  broadcastEvent('backup:imported', { mode, imported: importedCounts, safetySnapshot });

  return {
    safetySnapshot,
    imported: importedCounts,
  };
}

// 1. Export Full JSON Backup
app.get('/api/v1/backup/export', (req: Request, res: Response) => {
  try {
    const payload = buildCurrentBackupPayload();
    if (req.query.download === '1') {
      const filename = `portal_game_backup_${formatSnapshotTimestamp()}.json`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.send(JSON.stringify(payload, null, 2));
      return;
    }
    res.json({ success: true, data: payload });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

// 2. Export Raw SQLite .db Snapshot Download
app.get('/api/v1/backup/export-db', (_req: Request, res: Response) => {
  const filename = `portal_game_backup_${formatSnapshotTimestamp()}.db`;
  const tempPath = path.join(os.tmpdir(), filename);
  try {
    createDbSnapshotFile(tempPath);
    res.download(tempPath, filename, () => {
      try {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch {
        // ignore cleanup error
      }
    });
  } catch (error) {
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {
      // ignore
    }
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

// 3. List Saved Server Snapshots in data/backups/
app.get('/api/v1/backup/snapshots', (_req: Request, res: Response) => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      res.json({ success: true, data: [] });
      return;
    }
    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.endsWith('.db'))
      .map((filename) => {
        const stats = fs.statSync(path.join(BACKUP_DIR, filename));
        return {
          filename,
          sizeBytes: stats.size,
          createdAt: stats.mtime.toISOString(),
        };
      })
      .filter((f) => f.sizeBytes > 0)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    res.json({ success: true, data: files });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

// 4. Create Manual Server Snapshot in data/backups/
app.post('/api/v1/backup/snapshots', (_req: Request, res: Response) => {
  try {
    const filename = createSafetySnapshotInBackupDir('portal_game_backup');
    const stats = fs.statSync(path.join(BACKUP_DIR, filename));
    recordAudit('Admin', 'CREATE_SNAPSHOT', `Membuat snapshot backup server: ${filename}`);
    res.json({
      success: true,
      message: `Snapshot server "${filename}" berhasil dibuat!`,
      data: {
        filename,
        sizeBytes: stats.size,
        createdAt: stats.mtime.toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

// 5. Download Specific Server Snapshot .db
app.get('/api/v1/backup/snapshots/:filename/download', (req: Request, res: Response) => {
  try {
    const rawName = String(req.params.filename || '');
    const safeName = path.basename(rawName);
    if (!safeName || safeName !== rawName || !safeName.endsWith('.db')) {
      res.status(400).json({ success: false, message: 'Nama berkas snapshot tidak valid' });
      return;
    }
    const fullPath = path.join(BACKUP_DIR, safeName);
    if (!fs.existsSync(fullPath)) {
      res.status(404).json({ success: false, message: 'Berkas snapshot tidak ditemukan' });
      return;
    }
    res.download(fullPath, safeName);
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

// 6. Import JSON Backup (Merge or Replace)
app.post('/api/v1/backup/import', (req: Request, res: Response) => {
  try {
    const mode = req.body?.mode === 'replace' ? 'replace' : 'merge';
    const rawPayload = req.body?.payload;
    if (rawPayload === undefined || rawPayload === null) {
      res.status(400).json({ success: false, message: 'Payload JSON backup tidak boleh kosong.' });
      return;
    }

    const parsed = parseBackupPayload(rawPayload);
    const result = executeNormalizedBackupImport(parsed, mode, 'File/Teks JSON');

    res.json({
      success: true,
      message: `Import backup (${mode === 'replace' ? 'Ganti Total' : 'Gabungkan'}) berhasil! ${result.imported.games} game & ${result.imported.categories} kategori disinkronkan.`,
      mode,
      safetySnapshot: result.safetySnapshot,
      imported: result.imported,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
});

// 7. Import SQLite .db Backup File (Base64 uploaded via Admin Hub)
app.post('/api/v1/backup/import-db', (req: Request, res: Response) => {
  const mode = req.body?.mode === 'replace' ? 'replace' : 'merge';
  const fileName = String(req.body?.fileName || 'uploaded.db');
  const base64Data = String(req.body?.base64Data || '');

  if (!base64Data) {
    res.status(400).json({ success: false, message: 'Berkas SQLite (.db) kosong.' });
    return;
  }

  const cleanedBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const buffer = Buffer.from(cleanedBase64, 'base64');

  if (!isValidSqliteHeader(buffer)) {
    res.status(400).json({
      success: false,
      message: 'Berkas bukan file database SQLite (.db) yang valid.',
    });
    return;
  }

  const tempPath = path.join(os.tmpdir(), `import_db_${Date.now()}_${Math.floor(Math.random() * 1000)}.db`);
  try {
    fs.writeFileSync(tempPath, buffer);
    const parsed = readBackupDataFromSqliteFile(tempPath);
    const result = executeNormalizedBackupImport(parsed, mode, `SQLite (${path.basename(fileName)})`);

    res.json({
      success: true,
      message: `Restore file .db (${mode === 'replace' ? 'Ganti Total' : 'Gabungkan'}) berhasil! ${result.imported.games} game & ${result.imported.categories} kategori disinkronkan.`,
      mode,
      safetySnapshot: result.safetySnapshot,
      imported: result.imported,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  } finally {
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {
      // ignore temp cleanup error
    }
  }
});

// 8. Restore From Existing Server Snapshot in data/backups/
app.post('/api/v1/backup/snapshots/:filename/restore', (req: Request, res: Response) => {
  try {
    const rawName = String(req.params.filename || '');
    const safeName = path.basename(rawName);
    if (!safeName || safeName !== rawName || !safeName.endsWith('.db')) {
      res.status(400).json({ success: false, message: 'Nama berkas snapshot tidak valid' });
      return;
    }

    const fullPath = path.join(BACKUP_DIR, safeName);
    if (!fs.existsSync(fullPath)) {
      res.status(404).json({ success: false, message: 'Berkas snapshot tidak ditemukan' });
      return;
    }

    const mode = req.body?.mode === 'replace' ? 'replace' : 'merge';
    const parsed = readBackupDataFromSqliteFile(fullPath);
    const result = executeNormalizedBackupImport(parsed, mode, `Snapshot (${safeName})`);

    res.json({
      success: true,
      message: `Snapshot "${safeName}" berhasil dipulihkan (${mode === 'replace' ? 'Ganti Total' : 'Gabungkan'})!`,
      mode,
      safetySnapshot: result.safetySnapshot,
      imported: result.imported,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
});

// 9. Get Baseline Data Protection Status & Live Recorded Counts
app.get('/api/v1/backup/baseline-status', (_req: Request, res: Response) => {
  try {
    ensureAutoBaselineSnapshotOnStartup();
    const metaRows = db
      .prepare("SELECT key, value FROM sync_metadata WHERE key IN ('baseline_protection', 'initial_seed_completed', 'baseline_established_at')")
      .all() as { key: string; value: string }[];
    const metaMap: Record<string, string> = {};
    for (const r of metaRows) {
      metaMap[r.key] = r.value;
    }

    let latestBaselineSnapshot: { filename: string; sizeBytes: number; createdAt: string } | null = null;
    if (fs.existsSync(BACKUP_DIR)) {
      const dbFiles = fs
        .readdirSync(BACKUP_DIR)
        .filter((f) => f.endsWith('.db'))
        .map((filename) => {
          const stats = fs.statSync(path.join(BACKUP_DIR, filename));
          return {
            filename,
            sizeBytes: stats.size,
            createdAt: stats.mtime.toISOString(),
          };
        })
        .filter((f) => f.sizeBytes > 0)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

      latestBaselineSnapshot =
        dbFiles.find((f) => /^auto-baseline_.*\.db$/i.test(f.filename)) || dbFiles[0] || null;
    }

    res.json({
      success: true,
      data: {
        protected: metaMap.baseline_protection === 'enabled',
        initialSeedCompleted: metaMap.initial_seed_completed === '1',
        baselineEstablishedAt: metaMap.baseline_established_at || null,
        latestBaselineSnapshot,
        counts: getBaselineDatabaseCounts(),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

// 10. Pull & Merge Backup From a Published Website URL
app.post('/api/v1/backup/sync-from-url', async (req: Request, res: Response) => {
  try {
    const cleanUrl = validatePublishedSyncUrl(String(req.body?.sourceUrl || ''));
    const mode = req.body?.mode === 'replace' ? 'replace' : 'merge';
    const exportEndpoint = `${cleanUrl}/api/v1/backup/export`;

    const resp = await fetch(exportEndpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
      },
      signal: AbortSignal.timeout(15000),
    });

    const contentType = String(resp.headers.get('content-type') || '').toLowerCase();
    if (!resp.ok || !contentType.includes('application/json')) {
      res.status(400).json({
        success: false,
        message: `Gagal menarik data otomatis dari "${cleanUrl}" (HTTP ${resp.status} atau halaman memerlukan autentikasi browser). Silakan buka website terpublish di browser -> Admin Hub -> Tab Backup & Restore -> klik "Unduh Backup JSON" atau "Unduh File SQLite (.db)", lalu impor file tersebut di sini menggunakan Mode Gabungkan (Merge).`,
      });
      return;
    }

    const rawJson = (await resp.json()) as Record<string, unknown>;
    const payloadCandidate = rawJson?.data && rawJson?.success === true ? rawJson.data : rawJson;
    const parsed = parseBackupPayload(payloadCandidate);
    const result = executeNormalizedBackupImport(parsed, mode, `Website Terpublish (${cleanUrl})`);

    res.json({
      success: true,
      message: `Data dari website terpublish (${cleanUrl}) berhasil ditarik & ${mode === 'replace' ? 'dipulihkan' : 'digabungkan tanpa menghapus data lokal'}! (${result.imported.games} game, ${result.imported.categories} kategori, ${result.imported.users} pengguna)`,
      mode,
      safetySnapshot: result.safetySnapshot,
      imported: result.imported,
    });
  } catch (error) {
    const msg = (error as Error).message || 'Gagal menyinkronkan dari URL terpublish.';
    res.status(400).json({ success: false, message: msg });
  }
});

// ==========================================
// VITE DEV SERVER / PRODUCTION STATIC
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Pusat Games Buddhis] Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server start error:', err);
});
