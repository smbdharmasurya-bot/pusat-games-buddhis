import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import {
  selectAutoBaselineSnapshotsToDelete,
  shouldRunInitialSeed,
} from '../utils/baselineProtection.ts';
import { formatSnapshotTimestamp } from '../utils/backupSync.ts';

const resolvedCustomDb = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : null;
const DATA_DIR = resolvedCustomDb ? path.dirname(resolvedCustomDb) : path.resolve(process.cwd(), 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const DB_PATH = resolvedCustomDb || path.join(DATA_DIR, 'portal_game.db');

function repairDatabaseFileIfNeeded(dbPath: string): void {
  if (!fs.existsSync(dbPath)) return;

  // Choose the best source database if a newer/richer snapshot exists in BACKUP_DIR
  let sourceDbPath = dbPath;
  let needsRebuild = false;

  const inspectDbCandidate = (candidatePath: string) => {
    const conn = new DatabaseSync(candidatePath);
    try {
      try {
        conn.exec('PRAGMA wal_checkpoint(PASSIVE);');
      } catch {
        // ignore
      }
      let integrityOk = false;
      try {
        const res = conn.prepare('PRAGMA integrity_check').all() as { integrity_check?: string }[];
        integrityOk = Boolean(res.length && res[0]?.integrity_check === 'ok');
      } catch {
        integrityOk = false;
      }
      const gamesCount = Number((conn.prepare('SELECT COUNT(*) as c FROM games').get() as { c: number } | undefined)?.c || 0);
      const usersCount = Number((conn.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number } | undefined)?.c || 0);
      const maxAuditId = Number((conn.prepare('SELECT MAX(id) as m FROM audit_logs').get() as { m: number | null } | undefined)?.m || 0);
      return { integrityOk, gamesCount, usersCount, maxAuditId };
    } catch {
      return { integrityOk: false, gamesCount: 0, usersCount: 0, maxAuditId: 0 };
    } finally {
      try {
        conn.close();
      } catch {
        // ignore
      }
    }
  };

  const mainStats = inspectDbCandidate(dbPath);
  if (!mainStats.integrityOk) {
    needsRebuild = true;
  }

  // If main DB has 0 games (e.g. from an earlier uncheckpointed restart) while a recent snapshot in BACKUP_DIR has games & newer audit logs, recover from that snapshot
  if (mainStats.gamesCount === 0 && fs.existsSync(BACKUP_DIR)) {
    const snapshotFiles = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.endsWith('.db') && (f.startsWith('portal_game_backup_') || f.startsWith('auto-baseline_') || f.startsWith('pre-merge_')))
      .map((f) => ({
        name: f,
        fullPath: path.join(BACKUP_DIR, f),
        mtimeMs: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs,
        size: fs.statSync(path.join(BACKUP_DIR, f)).size,
      }))
      .filter((f) => f.size > 0)
      .sort((a, b) => b.mtimeMs - a.mtimeMs);

    for (const snap of snapshotFiles) {
      const snapStats = inspectDbCandidate(snap.fullPath);
      if (snapStats.gamesCount > mainStats.gamesCount && snapStats.maxAuditId >= mainStats.maxAuditId) {
        sourceDbPath = snap.fullPath;
        needsRebuild = true;
        break;
      }
    }
  }

  if (!needsRebuild) return;

  const tempPath = `${dbPath}.repaired_${Date.now()}.db`;
  const oldDb = new DatabaseSync(sourceDbPath, { readOnly: true });
  const newDb = new DatabaseSync(tempPath);
  try {
    newDb.exec(`
      CREATE TABLE IF NOT EXISTS sync_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS site_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        slug TEXT NOT NULL,
        icon TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        status INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        slug TEXT NOT NULL,
        category TEXT NOT NULL,
        difficulty TEXT DEFAULT 'Mudah',
        type TEXT DEFAULT 'quiz',
        rating REAL DEFAULT 4.9,
        players INTEGER DEFAULT 0,
        thumbnail TEXT,
        icon TEXT,
        description TEXT,
        is_premium INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        html5_code TEXT,
        url TEXT,
        status TEXT DEFAULT 'published',
        featured INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS leaderboard (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_name TEXT NOT NULL,
        user_email TEXT,
        avatar TEXT,
        game_id INTEGER,
        game_title TEXT NOT NULL,
        score INTEGER NOT NULL,
        xp_earned INTEGER NOT NULL,
        badge TEXT NOT NULL,
        school TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        avatar TEXT,
        xp INTEGER DEFAULT 100,
        badge TEXT DEFAULT 'Sahabat Pemula Dharma',
        level INTEGER DEFAULT 1,
        school TEXT,
        role TEXT DEFAULT 'user',
        password TEXT DEFAULT 'dharma123',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS testimonials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        game TEXT NOT NULL,
        rating INTEGER DEFAULT 5,
        message TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS licenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        school_name TEXT NOT NULL,
        plan TEXT NOT NULL,
        status TEXT DEFAULT 'Aktif',
        expires_date TEXT NOT NULL,
        license_key TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS certificates (
        id TEXT PRIMARY KEY,
        student_name TEXT NOT NULL,
        module TEXT NOT NULL,
        institution TEXT NOT NULL,
        date TEXT NOT NULL,
        certificate_number TEXT NOT NULL,
        verification_code TEXT UNIQUE NOT NULL,
        is_active INTEGER DEFAULT 1,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS game_access_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER,
        game_title TEXT NOT NULL,
        game_category TEXT,
        user_id TEXT,
        user_name TEXT NOT NULL,
        user_role TEXT DEFAULT 'tamu',
        ip_address TEXT,
        device_type TEXT,
        device_model TEXT,
        browser TEXT,
        os TEXT,
        screen_resolution TEXT,
        country TEXT DEFAULT 'Indonesia',
        country_code TEXT DEFAULT 'ID',
        city TEXT,
        user_agent TEXT,
        duration_seconds INTEGER DEFAULT 0,
        completed INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const copyTableRows = (table: string) => {
      try {
        const rows = oldDb.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];
        if (!rows.length) return;
        const cols = Object.keys(rows[0]);
        const placeholders = cols.map(() => '?').join(', ');
        const stmt = newDb.prepare(`INSERT OR IGNORE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`);
        for (const r of rows) {
          stmt.run(...cols.map((c) => r[c] as string | number | bigint | null | Uint8Array));
        }
      } catch {
        // Fallback row-by-row by id for tables with a corrupted page
        try {
          const maxRow = oldDb.prepare(`SELECT MAX(id) as m FROM ${table}`).get() as { m: number | null } | undefined;
          const maxId = Math.min(Number(maxRow?.m || 2000), 20000);
          const getById = oldDb.prepare(`SELECT * FROM ${table} WHERE id = ?`);
          let stmt: ReturnType<DatabaseSync['prepare']> | null = null;
          let cols: string[] = [];
          for (let id = 1; id <= maxId; id++) {
            try {
              const r = getById.get(id) as Record<string, unknown> | undefined;
              if (!r) continue;
              if (!stmt) {
                cols = Object.keys(r);
                const placeholders = cols.map(() => '?').join(', ');
                stmt = newDb.prepare(`INSERT OR IGNORE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`);
              }
              stmt.run(...cols.map((c) => r[c] as string | number | bigint | null | Uint8Array));
            } catch {
              // skip corrupted entry
            }
          }
        } catch {
          // ignore
        }
      }
    };

    newDb.exec('BEGIN IMMEDIATE');
    for (const t of [
      'sync_metadata',
      'site_settings',
      'categories',
      'games',
      'leaderboard',
      'users',
      'testimonials',
      'licenses',
      'certificates',
      'audit_logs',
      'game_access_logs',
    ]) {
      copyTableRows(t);
    }
    newDb.exec('COMMIT');
    oldDb.close();
    newDb.close();

    for (const suffix of ['', '-wal', '-shm']) {
      try {
        if (fs.existsSync(`${dbPath}${suffix}`)) {
          fs.unlinkSync(`${dbPath}${suffix}`);
        }
      } catch {
        // ignore
      }
    }
    fs.renameSync(tempPath, dbPath);
  } catch (err) {
    console.warn('Database file repair skipped:', (err as Error).message);
    try {
      oldDb.close();
    } catch {}
    try {
      newDb.close();
    } catch {}
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {}
  }
}

repairDatabaseFileIfNeeded(DB_PATH);
const db = new DatabaseSync(DB_PATH);

// Enable WAL mode, busy timeout & foreign keys for concurrent multi-user durability
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA synchronous = NORMAL;');
db.exec('PRAGMA busy_timeout = 5000;');
db.exec('PRAGMA foreign_keys = ON;');

// Initialize Relational SQL Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS sync_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    slug TEXT NOT NULL,
    icon TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    status INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    category TEXT NOT NULL,
    difficulty TEXT DEFAULT 'Mudah',
    type TEXT DEFAULT 'quiz',
    rating REAL DEFAULT 4.9,
    players INTEGER DEFAULT 0,
    thumbnail TEXT,
    icon TEXT,
    description TEXT,
    is_premium INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    html5_code TEXT,
    url TEXT,
    status TEXT DEFAULT 'published',
    featured INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS leaderboard (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_name TEXT NOT NULL,
    user_email TEXT,
    avatar TEXT,
    game_id INTEGER,
    game_title TEXT NOT NULL,
    score INTEGER NOT NULL,
    xp_earned INTEGER NOT NULL,
    badge TEXT NOT NULL,
    school TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    avatar TEXT,
    xp INTEGER DEFAULT 100,
    badge TEXT DEFAULT 'Sahabat Pemula Dharma',
    level INTEGER DEFAULT 1,
    school TEXT,
    role TEXT DEFAULT 'user',
    password TEXT DEFAULT 'dharma123',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS testimonials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    game TEXT NOT NULL,
    rating INTEGER DEFAULT 5,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS licenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_name TEXT NOT NULL,
    plan TEXT NOT NULL,
    status TEXT DEFAULT 'Aktif',
    expires_date TEXT NOT NULL,
    license_key TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS certificates (
    id TEXT PRIMARY KEY,
    student_name TEXT NOT NULL,
    module TEXT NOT NULL,
    institution TEXT NOT NULL,
    date TEXT NOT NULL,
    certificate_number TEXT NOT NULL,
    verification_code TEXT UNIQUE NOT NULL,
    is_active INTEGER DEFAULT 1,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS game_access_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER,
    game_title TEXT NOT NULL,
    game_category TEXT,
    user_id TEXT,
    user_name TEXT NOT NULL,
    user_role TEXT DEFAULT 'tamu',
    ip_address TEXT,
    device_type TEXT,
    device_model TEXT,
    browser TEXT,
    os TEXT,
    screen_resolution TEXT,
    country TEXT DEFAULT 'Indonesia',
    country_code TEXT DEFAULT 'ID',
    city TEXT,
    user_agent TEXT,
    duration_seconds INTEGER DEFAULT 0,
    completed INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_games_category ON games(category);
  CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboard(score DESC);
  CREATE INDEX IF NOT EXISTS idx_testimonials_status ON testimonials(status);
  CREATE INDEX IF NOT EXISTS idx_access_logs_created ON game_access_logs(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_access_logs_game ON game_access_logs(game_id);
  CREATE INDEX IF NOT EXISTS idx_access_logs_device ON game_access_logs(device_type);
`);

// Safe column migrations for existing databases
try {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';");
} catch {
  // column already exists
}

try {
  db.exec("ALTER TABLE users ADD COLUMN password TEXT DEFAULT 'dharma123';");
} catch {
  // column already exists
}

try {
  db.exec("ALTER TABLE games ADD COLUMN is_active INTEGER DEFAULT 1;");
} catch {
  // column already exists
}

try {
  db.exec("ALTER TABLE games ADD COLUMN icon TEXT DEFAULT '';");
} catch {
  // column already exists
}

try {
  db.exec("ALTER TABLE certificates ADD COLUMN is_active INTEGER DEFAULT 1;");
} catch {
  // column already exists
}

try {
  db.exec("ALTER TABLE certificates ADD COLUMN status TEXT DEFAULT 'active';");
} catch {
  // column already exists
}

export function pruneInactiveLeaderboardScores(): number {
  const result = db.prepare(`
    DELETE FROM leaderboard
    WHERE NOT EXISTS (
      SELECT 1 FROM games g
      WHERE g.is_active = 1
        AND (g.status IS NULL OR g.status != 'inactive')
        AND (
          (leaderboard.game_id IS NOT NULL AND leaderboard.game_id = g.id)
          OR LOWER(TRIM(leaderboard.game_title)) = LOWER(TRIM(g.title))
        )
    )
  `).run();
  return Number(result.changes || 0);
}

export function healMalformedAccessLogsIfNeeded(): boolean {
  try {
    db.prepare('SELECT COUNT(DISTINCT ip_address) as c FROM game_access_logs').get();
    return false;
  } catch (err) {
    if (!String((err as Error).message || '').includes('malformed')) {
      return false;
    }
    try {
      const maxRow = db.prepare('SELECT MAX(id) as maxId FROM game_access_logs').get() as { maxId: number | null } | undefined;
      const maxId = Math.min(Number(maxRow?.maxId || 2000), 10000);
      const validRows: Record<string, unknown>[] = [];
      const selectById = db.prepare('SELECT * FROM game_access_logs WHERE id = ?');
      for (let id = 1; id <= maxId; id++) {
        try {
          const row = selectById.get(id) as Record<string, unknown> | undefined;
          if (row) validRows.push(row);
        } catch {
          // skip corrupted B-tree page entry
        }
      }

      db.exec('BEGIN IMMEDIATE');
      try {
        db.exec('DROP INDEX IF EXISTS idx_access_logs_created;');
        db.exec('DROP INDEX IF EXISTS idx_access_logs_game;');
        db.exec('DROP INDEX IF EXISTS idx_access_logs_device;');
        db.exec('DROP TABLE IF EXISTS game_access_logs;');
        db.exec(`
          CREATE TABLE game_access_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            game_id INTEGER,
            game_title TEXT NOT NULL,
            game_category TEXT,
            user_id TEXT,
            user_name TEXT NOT NULL,
            user_role TEXT DEFAULT 'tamu',
            ip_address TEXT,
            device_type TEXT,
            device_model TEXT,
            browser TEXT,
            os TEXT,
            screen_resolution TEXT,
            country TEXT DEFAULT 'Indonesia',
            country_code TEXT DEFAULT 'ID',
            city TEXT,
            user_agent TEXT,
            duration_seconds INTEGER DEFAULT 0,
            completed INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX idx_access_logs_created ON game_access_logs(created_at DESC);
          CREATE INDEX idx_access_logs_game ON game_access_logs(game_id);
          CREATE INDEX idx_access_logs_device ON game_access_logs(device_type);
        `);

        const insertStmt = db.prepare(`
          INSERT INTO game_access_logs (
            id, game_id, game_title, game_category, user_id, user_name, user_role,
            ip_address, device_type, device_model, browser, os, screen_resolution,
            country, country_code, city, user_agent, duration_seconds, completed, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const r of validRows) {
          insertStmt.run(
            r.id as number,
            (r.game_id as number | null) ?? null,
            String(r.game_title || 'Permainan Dharma'),
            (r.game_category as string | null) ?? 'Umum',
            (r.user_id as string | null) ?? null,
            String(r.user_name || 'Tamu'),
            String(r.user_role || 'tamu'),
            (r.ip_address as string | null) ?? '127.0.0.1',
            (r.device_type as string | null) ?? 'Desktop PC',
            (r.device_model as string | null) ?? '',
            (r.browser as string | null) ?? 'Browser Web',
            (r.os as string | null) ?? 'OS',
            (r.screen_resolution as string | null) ?? null,
            String(r.country || 'Indonesia'),
            String(r.country_code || 'ID'),
            (r.city as string | null) ?? 'Nusantara',
            (r.user_agent as string | null) ?? '',
            Number(r.duration_seconds || 0),
            Number(r.completed ? 1 : 0),
            String(r.created_at || new Date().toISOString())
          );
        }
        db.exec('COMMIT');
        try {
          db.exec('VACUUM;');
        } catch {
          // ignore vacuum error
        }
        return true;
      } catch (txErr) {
        try {
          db.exec('ROLLBACK');
        } catch {
          // ignore
        }
        console.warn('Self-heal rollback:', (txErr as Error).message);
        return false;
      }
    } catch (outerErr) {
      console.warn('Self-heal skipped:', (outerErr as Error).message);
      return false;
    }
  }
}

export function getBaselineDatabaseCounts() {
  return {
    games: Number((db.prepare('SELECT COUNT(*) as count FROM games').get() as { count: number }).count || 0),
    categories: Number((db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number }).count || 0),
    leaderboard: Number((db.prepare('SELECT COUNT(*) as count FROM leaderboard').get() as { count: number }).count || 0),
    users: Number((db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count || 0),
    certificates: Number((db.prepare('SELECT COUNT(*) as count FROM certificates').get() as { count: number }).count || 0),
    testimonials: Number((db.prepare('SELECT COUNT(*) as count FROM testimonials').get() as { count: number }).count || 0),
    licenses: Number((db.prepare('SELECT COUNT(*) as count FROM licenses').get() as { count: number }).count || 0),
    accessLogs: Number((db.prepare('SELECT COUNT(*) as count FROM game_access_logs').get() as { count: number }).count || 0),
  };
}

export function ensureAutoBaselineSnapshotOnStartup(): string | null {
  try {
    const counts = getBaselineDatabaseCounts();
    const hasRecordedData =
      counts.games > 0 ||
      counts.categories > 0 ||
      counts.leaderboard > 0 ||
      counts.certificates > 0 ||
      counts.testimonials > 0 ||
      counts.accessLogs > 0 ||
      counts.users > 4;

    if (!hasRecordedData) {
      return null;
    }

    const existingFiles = fs.existsSync(BACKUP_DIR)
      ? fs.readdirSync(BACKUP_DIR).filter((f) => /^auto-baseline_.*\.db$/i.test(f))
      : [];

    const ONE_HOUR_MS = 60 * 60 * 1000;
    const now = Date.now();
    for (const file of existingFiles) {
      const full = path.join(BACKUP_DIR, file);
      const stat = fs.statSync(full);
      if (stat.size <= 0) {
        try {
          fs.unlinkSync(full);
        } catch {
          // ignore cleanup error
        }
        continue;
      }
      if (now - stat.mtimeMs < ONE_HOUR_MS) {
        return file;
      }
    }

    const filename = `auto-baseline_${formatSnapshotTimestamp()}.db`;
    const destPath = path.join(BACKUP_DIR, filename);
    const escapedPath = destPath.replace(/'/g, "''");
    try {
      db.exec(`VACUUM INTO '${escapedPath}'`);
    } catch {
      try {
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      } catch {
        // ignore
      }
      try {
        db.exec('REINDEX;');
        db.exec(`VACUUM INTO '${escapedPath}'`);
      } catch {
        try {
          if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
        } catch {
          // ignore
        }
        try {
          db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
        } catch {
          // ignore
        }
        fs.copyFileSync(DB_PATH, destPath);
      }
    }

    if (!fs.existsSync(destPath) || fs.statSync(destPath).size <= 0) {
      try {
        db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
      } catch {
        // ignore
      }
      fs.copyFileSync(DB_PATH, destPath);
    }

    const updatedFiles = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.db'));
    for (const oldFile of selectAutoBaselineSnapshotsToDelete(updatedFiles, 5)) {
      try {
        fs.unlinkSync(path.join(BACKUP_DIR, oldFile));
      } catch {
        // ignore rotation error
      }
    }

    return filename;
  } catch (err) {
    console.warn('Auto-baseline snapshot skipped:', (err as Error).message);
    return null;
  }
}

// Non-destructive database initialization & baseline preservation
function seedDatabase() {
  // Self-heal any corrupted B-tree pages in game_access_logs while preserving all valid records
  healMalformedAccessLogsIfNeeded();

  // Prune stale leaderboard entries for non-active/deleted games while preserving all active game records
  pruneInactiveLeaderboardScores();

  const seedFlagRow = db
    .prepare("SELECT value FROM sync_metadata WHERE key = 'initial_seed_completed'")
    .get() as { value?: string } | undefined;
  const initialSeedCompleted = seedFlagRow?.value === '1';

  const rowCounts = {
    users: Number((db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count || 0),
    certificates: Number((db.prepare('SELECT COUNT(*) as count FROM certificates').get() as { count: number }).count || 0),
    testimonials: Number((db.prepare('SELECT COUNT(*) as count FROM testimonials').get() as { count: number }).count || 0),
    licenses: Number((db.prepare('SELECT COUNT(*) as count FROM licenses').get() as { count: number }).count || 0),
    siteSettings: Number((db.prepare('SELECT COUNT(*) as count FROM site_settings').get() as { count: number }).count || 0),
  };

  const seedDecision = shouldRunInitialSeed(initialSeedCompleted, rowCounts);

  if (seedDecision.seedTestimonials) {
    const insertTesti = db.prepare(`
      INSERT INTO testimonials (name, role, game, rating, message, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertTesti.run(
      'Bhikkhu Dhammacaro',
      'Guru Agama Buddha / Pengurus Vihara',
      'Platform Keseluruhan',
      5,
      'Platform ini sangat luar biasa! Dukungan game portable dan database terpusat memudahkan penambahan materi pembelajaran baru untuk kelas Minggu.',
      'approved'
    );

    insertTesti.run(
      'Dewi Lestari, S.Ag.',
      'Guru Agama Buddha SMP',
      'Kuis Perjalanan Siddhartha',
      5,
      'Peserta didik sangat antusias berebut posisi di Papan Peringkat Real-time. Materi yang disajikan akurat dan sesuai silabus kurikulum nasional.',
      'approved'
    );

    insertTesti.run(
      'Sujana Dharmawira, M.Pd.',
      'Kepala Sekolah Buddhis',
      'Memory Candi Borobudur',
      5,
      'Integrasi visual candi dan sertifikat digital yang dapat diverifikasi kode resminya membuat pembelajaran agama menjadi modern dan bermakna.',
      'approved'
    );
  }

  if (seedDecision.seedLicenses) {
    const insertLic = db.prepare(`
      INSERT INTO licenses (school_name, plan, status, expires_date, license_key)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertLic.run('SMP Maitreyawira Jakarta', 'Pro School License (Unlimited)', 'Aktif', '2027-12-31', 'PGB-LIC-MTW-2027');
    insertLic.run('Vihara Mendut Magelang', 'Vihara Learning Pack', 'Aktif', '2028-06-30', 'PGB-LIC-MND-2028');
    insertLic.run('SMA Bodhisatta Tangerang', 'Pro Institutional Suite', 'Aktif', '2027-10-15', 'PGB-LIC-BDS-2027');
  }

  if (seedDecision.seedCertificates) {
    const insertCert = db.prepare(`
      INSERT INTO certificates (id, student_name, module, institution, date, certificate_number, verification_code)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertCert.run(
      'CERT-2026-001',
      'Ananda Budi Santoso',
      'Dasar-Dasar Tripitaka & Sejarah Buddhis',
      'Vihara Buddhayana',
      '2026-03-15',
      'PGB/DHARMA/2026/001',
      'CERT-2026-001'
    );
    insertCert.run(
      'CERT-2026-002',
      'Saddhavati Dewi Lestari',
      'Penerapan Pancasila Buddhis dalam Kehidupan',
      'SMP Maitreyawira',
      '2026-04-10',
      'PGB/DHARMA/2026/002',
      'CERT-2026-002'
    );
  }

  if (seedDecision.seedUsers) {
    const insertUser = db.prepare(`
      INSERT INTO users (id, name, email, avatar, xp, badge, level, school, role, password)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    // 1. Super Admin
    insertUser.run(
      'usr-admin',
      'Bhadra Dharmasurya (Super Admin)',
      'admin@dharmasurya.sch.id',
      'https://api.dicebear.com/7.x/bottts/svg?seed=AdminDharma',
      2500,
      'Maha Pandita Dharma',
      10,
      'Pusat Kendali Pengelola Dharma',
      'admin',
      'admin321'
    );
    // 2. Uploader
    insertUser.run(
      'usr-uploader',
      'Upasaka Studio (Uploader Game)',
      'uploader@dharmasurya.sch.id',
      'https://api.dicebear.com/7.x/bottts/svg?seed=UploaderGame',
      950,
      'Penyelaras Sila & Samadhi',
      5,
      'Studio Media Pembelajaran Dharma',
      'uploader',
      'uploader123'
    );
    // 3. User / Murid Dharma
    insertUser.run(
      'usr-1',
      'Ananda Metta Putra',
      'ananda.m@dharmasurya.sch.id',
      'https://api.dicebear.com/7.x/bottts/svg?seed=Ananda',
      980,
      'Maha Pandita Dharma',
      5,
      'SMP Maitreyawira Jakarta',
      'user',
      'dharma123'
    );
    insertUser.run(
      'usr-2',
      'Saddhavati Dewi',
      'dewi.s@vihara.org',
      'https://api.dicebear.com/7.x/bottts/svg?seed=Saddhavati',
      950,
      'Penjaga Bodhicitta',
      4,
      'Vihara Mendut Magelang',
      'user',
      'dharma123'
    );
  } else {
    // Ensure default admin & uploader exist without modifying any existing user's XP, name, or password
    const adminExists = db.prepare("SELECT id FROM users WHERE role = 'admin' OR email = 'admin@dharmasurya.sch.id'").get();
    if (!adminExists) {
      db.prepare(`
        INSERT INTO users (id, name, email, avatar, xp, badge, level, school, role, password)
        VALUES ('usr-admin', 'Bhadra Dharmasurya (Super Admin)', 'admin@dharmasurya.sch.id', 'https://api.dicebear.com/7.x/bottts/svg?seed=AdminDharma', 2500, 'Maha Pandita Dharma', 10, 'Pusat Kendali Pengelola Dharma', 'admin', 'admin321')
      `).run();
    }
    const uploaderExists = db.prepare("SELECT id FROM users WHERE role = 'uploader' OR email = 'uploader@dharmasurya.sch.id'").get();
    if (!uploaderExists) {
      db.prepare(`
        INSERT INTO users (id, name, email, avatar, xp, badge, level, school, role, password)
        VALUES ('usr-uploader', 'Upasaka Studio (Uploader Game)', 'uploader@dharmasurya.sch.id', 'https://api.dicebear.com/7.x/bottts/svg?seed=UploaderGame', 950, 'Penyelaras Sila & Samadhi', 5, 'Studio Media Pembelajaran Dharma', 'uploader', 'uploader123')
      `).run();
    }
    // Backfill only NULL/empty columns without altering populated rows
    db.prepare("UPDATE users SET role = 'user' WHERE role IS NULL OR role = ''").run();
    db.prepare("UPDATE users SET password = 'admin321' WHERE role = 'admin' AND (password IS NULL OR password = '')").run();
    db.prepare("UPDATE users SET password = 'uploader123' WHERE role = 'uploader' AND (password IS NULL OR password = '')").run();
    db.prepare("UPDATE users SET password = 'dharma123' WHERE password IS NULL OR password = ''").run();
  }

  if (seedDecision.seedSettings) {
    const insertSetting = db.prepare(`INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)`);
    insertSetting.run('title', 'Candi & Stupa Dharma');
    insertSetting.run('subtitle', 'Nilai Kebijaksanaan & Kemurnian');
    insertSetting.run('emoji', '');
    insertSetting.run('imageUrl', '');
    insertSetting.run('announcement', 'Selamat datang di Pusat Games Buddhis - Media Pembelajaran Dharma Interaktif Berbasis SQL Terpusat!');
  }

  db.prepare("INSERT OR IGNORE INTO sync_metadata (key, value) VALUES ('data_revision', '1')").run();
  db.prepare("INSERT OR IGNORE INTO sync_metadata (key, value) VALUES ('initial_seed_completed', '1')").run();
  db.prepare("INSERT OR IGNORE INTO sync_metadata (key, value) VALUES ('baseline_protection', 'enabled')").run();
  db.prepare("INSERT OR IGNORE INTO sync_metadata (key, value) VALUES ('baseline_established_at', ?)").run(new Date().toISOString());

  ensureAutoBaselineSnapshotOnStartup();
}

seedDatabase();

export { db, DATA_DIR, DB_PATH, BACKUP_DIR };
