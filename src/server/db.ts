import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

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

// Seed Default Data if empty
function seedDatabase() {
  // Categories and games intentionally start empty so admins/uploaders populate
  // and synchronize them when uploading new games or creating categories.

  const lbCount = (db.prepare('SELECT COUNT(*) as count FROM leaderboard').get() as { count: number }).count;
  if (lbCount === 0) {
    const insertLB = db.prepare(`
      INSERT INTO leaderboard (user_name, user_email, avatar, game_title, score, xp_earned, badge, school)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertLB.run('Ananda Metta Putra', 'ananda.m@dharmasurya.sch.id', 'https://api.dicebear.com/7.x/bottts/svg?seed=Ananda', 'Kuis Perjalanan Siddhartha', 980, 490, 'Maha Pandita Dharma', 'SMP Maitreyawira Jakarta');
    insertLB.run('Saddhavati Dewi', 'dewi.s@vihara.org', 'https://api.dicebear.com/7.x/bottts/svg?seed=Saddhavati', 'Memory Candi Borobudur', 950, 475, 'Penjaga Bodhicitta', 'Vihara Mendut Magelang');
    insertLB.run('Bodhi Tanujaya', 'bodhi.t@bodhisatta.sch.id', 'https://api.dicebear.com/7.x/bottts/svg?seed=Bodhi', 'Refleks Teratai Suci (HTML5)', 910, 455, 'Penyelaras Sila & Samadhi', 'SMA Bodhisatta Tangerang');
    insertLB.run('Kalyana Mitta', 'kalyana@buddhis.id', 'https://api.dicebear.com/7.x/bottts/svg?seed=Kalyana', 'Misteri Empat Kebenaran Mulia', 860, 430, 'Penyelaras Sila & Samadhi', 'SMP Tri Ratna Jakarta');
    insertLB.run('Dhammasena Wijaya', 'wijaya.d@vihara.id', 'https://api.dicebear.com/7.x/bottts/svg?seed=Dhammasena', 'Pancasila Buddhis & Etika Harian', 820, 410, 'Penjelajah Sutta & Tripitaka', 'Sekolah Cinta Kasih Tzu Chi');
  }

  const testiCount = (db.prepare('SELECT COUNT(*) as count FROM testimonials').get() as { count: number }).count;
  if (testiCount === 0) {
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

  const licCount = (db.prepare('SELECT COUNT(*) as count FROM licenses').get() as { count: number }).count;
  if (licCount === 0) {
    const insertLic = db.prepare(`
      INSERT INTO licenses (school_name, plan, status, expires_date, license_key)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertLic.run('SMP Maitreyawira Jakarta', 'Pro School License (Unlimited)', 'Aktif', '2027-12-31', 'PGB-LIC-MTW-2027');
    insertLic.run('Vihara Mendut Magelang', 'Vihara Learning Pack', 'Aktif', '2028-06-30', 'PGB-LIC-MND-2028');
    insertLic.run('SMA Bodhisatta Tangerang', 'Pro Institutional Suite', 'Aktif', '2027-10-15', 'PGB-LIC-BDS-2027');
  }

  const certCount = (db.prepare('SELECT COUNT(*) as count FROM certificates').get() as { count: number }).count;
  if (certCount === 0) {
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

  const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
  if (userCount === 0) {
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
    // Ensure default admin & uploader exist if only regular users were previously seeded
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
    // Set fallback role 'user' for any rows missing a role
    db.prepare("UPDATE users SET role = 'user' WHERE role IS NULL OR role = ''").run();
    // Set fallback passwords for existing rows
    db.prepare("UPDATE users SET password = 'admin321' WHERE role = 'admin' AND (password IS NULL OR password = '')").run();
    db.prepare("UPDATE users SET password = 'uploader123' WHERE role = 'uploader' AND (password IS NULL OR password = '')").run();
    db.prepare("UPDATE users SET password = 'dharma123' WHERE password IS NULL OR password = ''").run();
    // Clear lotus emoji from site_settings to honor user request
    db.prepare("UPDATE site_settings SET value = '' WHERE key = 'emoji'").run();
  }

  const settingsCount = (db.prepare('SELECT COUNT(*) as count FROM site_settings').get() as { count: number }).count;
  if (settingsCount === 0) {
    const insertSetting = db.prepare(`INSERT INTO site_settings (key, value) VALUES (?, ?)`);
    insertSetting.run('title', 'Candi & Stupa Dharma');
    insertSetting.run('subtitle', 'Nilai Kebijaksanaan & Kemurnian');
    insertSetting.run('emoji', '');
    insertSetting.run('imageUrl', '');
    insertSetting.run('announcement', 'Selamat datang di Pusat Games Buddhis - Media Pembelajaran Dharma Interaktif Berbasis SQL Terpusat!');
  }
  const revExists = db.prepare("SELECT value FROM sync_metadata WHERE key = 'data_revision'").get();
  if (!revExists) {
    db.prepare("INSERT INTO sync_metadata (key, value) VALUES ('data_revision', '1')").run();
  }
}

seedDatabase();

export { db, DATA_DIR, DB_PATH, BACKUP_DIR };
