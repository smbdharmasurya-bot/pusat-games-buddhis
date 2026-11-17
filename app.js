// server.ts
import express from "express";
import fs2 from "node:fs";
import os from "node:os";
import path2 from "node:path";
import { DatabaseSync as DatabaseSync2 } from "node:sqlite";
import { fileURLToPath } from "node:url";

// src/server/db.ts
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
var resolvedCustomDb = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : null;
var DATA_DIR = resolvedCustomDb ? path.dirname(resolvedCustomDb) : path.resolve(process.cwd(), "data");
var BACKUP_DIR = path.join(DATA_DIR, "backups");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}
var DB_PATH = resolvedCustomDb || path.join(DATA_DIR, "portal_game.db");
var db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA synchronous = NORMAL;");
db.exec("PRAGMA busy_timeout = 5000;");
db.exec("PRAGMA foreign_keys = ON;");
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
try {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';");
} catch {
}
try {
  db.exec("ALTER TABLE users ADD COLUMN password TEXT DEFAULT 'dharma123';");
} catch {
}
try {
  db.exec("ALTER TABLE games ADD COLUMN is_active INTEGER DEFAULT 1;");
} catch {
}
try {
  db.exec("ALTER TABLE games ADD COLUMN icon TEXT DEFAULT '';");
} catch {
}
try {
  db.exec("ALTER TABLE certificates ADD COLUMN is_active INTEGER DEFAULT 1;");
} catch {
}
try {
  db.exec("ALTER TABLE certificates ADD COLUMN status TEXT DEFAULT 'active';");
} catch {
}
function seedDatabase() {
  const lbCount = db.prepare("SELECT COUNT(*) as count FROM leaderboard").get().count;
  if (lbCount === 0) {
    const insertLB = db.prepare(`
      INSERT INTO leaderboard (user_name, user_email, avatar, game_title, score, xp_earned, badge, school)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertLB.run("Ananda Metta Putra", "ananda.m@dharmasurya.sch.id", "https://api.dicebear.com/7.x/bottts/svg?seed=Ananda", "Kuis Perjalanan Siddhartha", 980, 490, "Maha Pandita Dharma", "SMP Maitreyawira Jakarta");
    insertLB.run("Saddhavati Dewi", "dewi.s@vihara.org", "https://api.dicebear.com/7.x/bottts/svg?seed=Saddhavati", "Memory Candi Borobudur", 950, 475, "Penjaga Bodhicitta", "Vihara Mendut Magelang");
    insertLB.run("Bodhi Tanujaya", "bodhi.t@bodhisatta.sch.id", "https://api.dicebear.com/7.x/bottts/svg?seed=Bodhi", "Refleks Teratai Suci (HTML5)", 910, 455, "Penyelaras Sila & Samadhi", "SMA Bodhisatta Tangerang");
    insertLB.run("Kalyana Mitta", "kalyana@buddhis.id", "https://api.dicebear.com/7.x/bottts/svg?seed=Kalyana", "Misteri Empat Kebenaran Mulia", 860, 430, "Penyelaras Sila & Samadhi", "SMP Tri Ratna Jakarta");
    insertLB.run("Dhammasena Wijaya", "wijaya.d@vihara.id", "https://api.dicebear.com/7.x/bottts/svg?seed=Dhammasena", "Pancasila Buddhis & Etika Harian", 820, 410, "Penjelajah Sutta & Tripitaka", "Sekolah Cinta Kasih Tzu Chi");
  }
  const testiCount = db.prepare("SELECT COUNT(*) as count FROM testimonials").get().count;
  if (testiCount === 0) {
    const insertTesti = db.prepare(`
      INSERT INTO testimonials (name, role, game, rating, message, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertTesti.run(
      "Bhikkhu Dhammacaro",
      "Guru Agama Buddha / Pengurus Vihara",
      "Platform Keseluruhan",
      5,
      "Platform ini sangat luar biasa! Dukungan game portable dan database terpusat memudahkan penambahan materi pembelajaran baru untuk kelas Minggu.",
      "approved"
    );
    insertTesti.run(
      "Dewi Lestari, S.Ag.",
      "Guru Agama Buddha SMP",
      "Kuis Perjalanan Siddhartha",
      5,
      "Peserta didik sangat antusias berebut posisi di Papan Peringkat Real-time. Materi yang disajikan akurat dan sesuai silabus kurikulum nasional.",
      "approved"
    );
    insertTesti.run(
      "Sujana Dharmawira, M.Pd.",
      "Kepala Sekolah Buddhis",
      "Memory Candi Borobudur",
      5,
      "Integrasi visual candi dan sertifikat digital yang dapat diverifikasi kode resminya membuat pembelajaran agama menjadi modern dan bermakna.",
      "approved"
    );
  }
  const licCount = db.prepare("SELECT COUNT(*) as count FROM licenses").get().count;
  if (licCount === 0) {
    const insertLic = db.prepare(`
      INSERT INTO licenses (school_name, plan, status, expires_date, license_key)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertLic.run("SMP Maitreyawira Jakarta", "Pro School License (Unlimited)", "Aktif", "2027-12-31", "PGB-LIC-MTW-2027");
    insertLic.run("Vihara Mendut Magelang", "Vihara Learning Pack", "Aktif", "2028-06-30", "PGB-LIC-MND-2028");
    insertLic.run("SMA Bodhisatta Tangerang", "Pro Institutional Suite", "Aktif", "2027-10-15", "PGB-LIC-BDS-2027");
  }
  const certCount = db.prepare("SELECT COUNT(*) as count FROM certificates").get().count;
  if (certCount === 0) {
    const insertCert = db.prepare(`
      INSERT INTO certificates (id, student_name, module, institution, date, certificate_number, verification_code)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertCert.run(
      "CERT-2026-001",
      "Ananda Budi Santoso",
      "Dasar-Dasar Tripitaka & Sejarah Buddhis",
      "Vihara Buddhayana",
      "2026-03-15",
      "PGB/DHARMA/2026/001",
      "CERT-2026-001"
    );
    insertCert.run(
      "CERT-2026-002",
      "Saddhavati Dewi Lestari",
      "Penerapan Pancasila Buddhis dalam Kehidupan",
      "SMP Maitreyawira",
      "2026-04-10",
      "PGB/DHARMA/2026/002",
      "CERT-2026-002"
    );
  }
  const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
  if (userCount === 0) {
    const insertUser = db.prepare(`
      INSERT INTO users (id, name, email, avatar, xp, badge, level, school, role, password)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertUser.run(
      "usr-admin",
      "Bhadra Dharmasurya (Super Admin)",
      "admin@dharmasurya.sch.id",
      "https://api.dicebear.com/7.x/bottts/svg?seed=AdminDharma",
      2500,
      "Maha Pandita Dharma",
      10,
      "Pusat Kendali Pengelola Dharma",
      "admin",
      "admin321"
    );
    insertUser.run(
      "usr-uploader",
      "Upasaka Studio (Uploader Game)",
      "uploader@dharmasurya.sch.id",
      "https://api.dicebear.com/7.x/bottts/svg?seed=UploaderGame",
      950,
      "Penyelaras Sila & Samadhi",
      5,
      "Studio Media Pembelajaran Dharma",
      "uploader",
      "uploader123"
    );
    insertUser.run(
      "usr-1",
      "Ananda Metta Putra",
      "ananda.m@dharmasurya.sch.id",
      "https://api.dicebear.com/7.x/bottts/svg?seed=Ananda",
      980,
      "Maha Pandita Dharma",
      5,
      "SMP Maitreyawira Jakarta",
      "user",
      "dharma123"
    );
    insertUser.run(
      "usr-2",
      "Saddhavati Dewi",
      "dewi.s@vihara.org",
      "https://api.dicebear.com/7.x/bottts/svg?seed=Saddhavati",
      950,
      "Penjaga Bodhicitta",
      4,
      "Vihara Mendut Magelang",
      "user",
      "dharma123"
    );
  } else {
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
    db.prepare("UPDATE users SET role = 'user' WHERE role IS NULL OR role = ''").run();
    db.prepare("UPDATE users SET password = 'admin321' WHERE role = 'admin' AND (password IS NULL OR password = '')").run();
    db.prepare("UPDATE users SET password = 'uploader123' WHERE role = 'uploader' AND (password IS NULL OR password = '')").run();
    db.prepare("UPDATE users SET password = 'dharma123' WHERE password IS NULL OR password = ''").run();
    db.prepare("UPDATE site_settings SET value = '' WHERE key = 'emoji'").run();
  }
  const settingsCount = db.prepare("SELECT COUNT(*) as count FROM site_settings").get().count;
  if (settingsCount === 0) {
    const insertSetting = db.prepare(`INSERT INTO site_settings (key, value) VALUES (?, ?)`);
    insertSetting.run("title", "Candi & Stupa Dharma");
    insertSetting.run("subtitle", "Nilai Kebijaksanaan & Kemurnian");
    insertSetting.run("emoji", "");
    insertSetting.run("imageUrl", "");
    insertSetting.run("announcement", "Selamat datang di Pusat Games Buddhis - Media Pembelajaran Dharma Interaktif Berbasis SQL Terpusat!");
  }
  const revExists = db.prepare("SELECT value FROM sync_metadata WHERE key = 'data_revision'").get();
  if (!revExists) {
    db.prepare("INSERT INTO sync_metadata (key, value) VALUES ('data_revision', '1')").run();
  }
}
seedDatabase();

// src/utils/categorySync.ts
function normalizeCategoryName(name) {
  return name.trim().replace(/\s+/g, " ");
}
function slugifyCategory(name) {
  const normalized = normalizeCategoryName(name);
  return normalized.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
function resolveCategoryMatch(inputName, categories) {
  const normalizedInput = normalizeCategoryName(inputName);
  if (!normalizedInput) {
    return { matchedCategory: null, normalizedInput: "" };
  }
  const lower = normalizedInput.toLowerCase();
  const match = categories.find((c) => normalizeCategoryName(c.name).toLowerCase() === lower) || null;
  return { matchedCategory: match, normalizedInput };
}

// src/utils/gameMedia.ts
function normalizeGameMediaValue(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}
function mergeGameMediaPatch(existing, patch) {
  const nextThumbnail = patch.thumbnail !== void 0 ? normalizeGameMediaValue(patch.thumbnail) : normalizeGameMediaValue(existing.thumbnail);
  const nextIcon = patch.icon !== void 0 ? normalizeGameMediaValue(patch.icon) : normalizeGameMediaValue(existing.icon);
  return {
    thumbnail: nextThumbnail,
    icon: nextIcon
  };
}

// src/utils/backupSync.ts
function asRecord(val) {
  return val && typeof val === "object" && !Array.isArray(val) ? val : null;
}
function str(val, fallback = "") {
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  return fallback;
}
function num(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}
function bool(val, fallback = false) {
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val !== 0;
  if (typeof val === "string") {
    const lower = val.trim().toLowerCase();
    if (lower === "true" || lower === "1" || lower === "active") return true;
    if (lower === "false" || lower === "0" || lower === "inactive") return false;
  }
  return fallback;
}
function normalizeGameRecord(raw) {
  const r = asRecord(raw);
  if (!r) return null;
  const title = str(r.title).trim();
  if (!title) return null;
  const category = normalizeCategoryName(str(r.category)) || "Umum Dharma";
  const slug = str(r.slug).trim() || slugifyCategory(title) || `game-${Date.now()}`;
  const isActive = r.isActive !== void 0 ? bool(r.isActive, true) : r.is_active !== void 0 ? bool(r.is_active, true) : true;
  return {
    title,
    slug,
    category,
    difficulty: str(r.difficulty, "Mudah") || "Mudah",
    type: str(r.type, "html5") || "html5",
    rating: num(r.rating, 4.9),
    players: Math.max(0, Math.round(num(r.players, 0))),
    thumbnail: normalizeGameMediaValue(str(r.thumbnail)),
    icon: normalizeGameMediaValue(str(r.icon)),
    description: str(r.description),
    isPremium: bool(r.isPremium ?? r.is_premium, false),
    isActive,
    html5Code: str(r.html5Code ?? r.html5_code),
    url: str(r.url ?? r.external_url),
    status: str(r.status, "published") || "published",
    featured: bool(r.featured, false)
  };
}
function normalizeCategoryRecord(raw) {
  const r = asRecord(raw);
  if (!r) return null;
  const name = normalizeCategoryName(str(r.name));
  if (!name) return null;
  return {
    name,
    slug: str(r.slug).trim() || slugifyCategory(name) || `kat-${Date.now()}`,
    icon: str(r.icon).trim() || "fa-seedling",
    sortOrder: Math.round(num(r.sortOrder ?? r.sort_order, 0)),
    status: Math.round(num(r.status, 1))
  };
}
function normalizeCertificateRecord(raw) {
  const r = asRecord(raw);
  if (!r) return null;
  const studentName = str(r.studentName ?? r.student_name).trim();
  const verificationCode = str(r.verificationCode ?? r.verification_code ?? r.id).trim();
  if (!studentName || !verificationCode) return null;
  const statusRaw = str(r.status).trim().toLowerCase();
  const active = r.isActive !== void 0 ? bool(r.isActive, true) : r.is_active !== void 0 ? bool(r.is_active, true) : statusRaw !== "inactive";
  return {
    id: str(r.id).trim() || verificationCode,
    studentName,
    module: str(r.module, "Pembelajaran Dharma").trim() || "Pembelajaran Dharma",
    institution: str(r.institution, "Pusat Games Buddhis Indonesia").trim() || "Pusat Games Buddhis Indonesia",
    date: str(r.date, (/* @__PURE__ */ new Date()).toISOString().split("T")[0]),
    certificateNumber: str(r.certificateNumber ?? r.certificate_number, `PGB/CERT/${verificationCode}`),
    verificationCode,
    isActive: active,
    status: active ? "active" : "inactive"
  };
}
function normalizeTestimonialRecord(raw) {
  const r = asRecord(raw);
  if (!r) return null;
  const name = str(r.name).trim();
  const message = str(r.message).trim();
  if (!name || !message) return null;
  return {
    name,
    role: str(r.role, "Peserta Didik") || "Peserta Didik",
    game: str(r.game, "Platform Keseluruhan") || "Platform Keseluruhan",
    rating: Math.min(5, Math.max(1, Math.round(num(r.rating, 5)))),
    message,
    status: str(r.status, "approved") || "approved"
  };
}
function normalizeLicenseRecord(raw) {
  const r = asRecord(raw);
  if (!r) return null;
  const schoolName = str(r.schoolName ?? r.school_name).trim();
  const licenseKey = str(r.licenseKey ?? r.license_key).trim();
  if (!schoolName || !licenseKey) return null;
  return {
    schoolName,
    plan: str(r.plan, "Pro School Suite") || "Pro School Suite",
    status: str(r.status, "Aktif") || "Aktif",
    expiresDate: str(r.expiresDate ?? r.expires_date, "2027-12-31"),
    licenseKey
  };
}
function normalizeLeaderboardRecord(raw) {
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
    badge: str(r.badge, "Sahabat Pemula Dharma") || "Sahabat Pemula Dharma",
    school: str(r.school)
  };
}
function normalizeUserRecord(raw) {
  const r = asRecord(raw);
  if (!r) return null;
  const email = str(r.email).trim();
  const name = str(r.name).trim();
  if (!email || !name) return null;
  const roleRaw = str(r.role, "user").trim().toLowerCase();
  const role = roleRaw === "admin" || roleRaw === "uploader" ? roleRaw : "user";
  return {
    id: str(r.id).trim() || `usr-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
    name,
    email,
    avatar: str(r.avatar),
    xp: Math.max(0, Math.round(num(r.xp, 100))),
    badge: str(r.badge, "Sahabat Pemula Dharma") || "Sahabat Pemula Dharma",
    level: Math.max(1, Math.round(num(r.level, 1))),
    school: str(r.school),
    role
  };
}
function normalizeSettings(raw) {
  if (!raw) return {};
  if (Array.isArray(raw)) {
    const out2 = {};
    for (const item of raw) {
      const r2 = asRecord(item);
      if (!r2) continue;
      const k = str(r2.key).trim();
      const v = str(r2.value);
      if (k === "title" || k === "subtitle" || k === "emoji" || k === "imageUrl" || k === "announcement") {
        out2[k] = v;
      }
    }
    return out2;
  }
  const r = asRecord(raw);
  if (!r) return {};
  const out = {};
  if (r.title !== void 0) out.title = str(r.title);
  if (r.subtitle !== void 0) out.subtitle = str(r.subtitle);
  if (r.emoji !== void 0) out.emoji = str(r.emoji);
  if (r.imageUrl !== void 0 || r.image_url !== void 0) {
    out.imageUrl = str(r.imageUrl ?? r.image_url);
  }
  if (r.announcement !== void 0) out.announcement = str(r.announcement);
  return out;
}
function parseBackupPayload(input) {
  let parsed = input;
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) {
      throw new Error("Isi file atau teks JSON backup masih kosong.");
    }
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error("Format JSON backup tidak valid. Pastikan file merupakan JSON yang utuh.");
    }
  }
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      throw new Error("Array JSON backup kosong, tidak ada data untuk diimpor.");
    }
    const first = asRecord(parsed[0]);
    if (first && first.title !== void 0) {
      return {
        games: parsed.map(normalizeGameRecord).filter((x) => x !== null),
        categories: [],
        siteSettings: {},
        certificates: [],
        testimonials: [],
        licenses: [],
        leaderboard: [],
        users: []
      };
    }
    if (first && first.name !== void 0 && first.slug !== void 0) {
      return {
        games: [],
        categories: parsed.map(normalizeCategoryRecord).filter((x) => x !== null),
        siteSettings: {},
        certificates: [],
        testimonials: [],
        licenses: [],
        leaderboard: [],
        users: []
      };
    }
    throw new Error("Struktur array JSON tidak dikenali sebagai daftar game atau kategori.");
  }
  const root = asRecord(parsed);
  if (!root) {
    throw new Error("Format payload backup harus berupa objek JSON atau array.");
  }
  const container = asRecord(root.data) ?? root;
  const games = Array.isArray(container.games) ? container.games.map(normalizeGameRecord).filter((x) => x !== null) : [];
  const categories = Array.isArray(container.categories) ? container.categories.map(normalizeCategoryRecord).filter((x) => x !== null) : [];
  const siteSettings = normalizeSettings(container.siteSettings ?? container.settings ?? (root.title !== void 0 && root.subtitle !== void 0 ? root : null));
  const certificates = Array.isArray(container.certificates) ? container.certificates.map(normalizeCertificateRecord).filter((x) => x !== null) : [];
  const testimonials = Array.isArray(container.testimonials) ? container.testimonials.map(normalizeTestimonialRecord).filter((x) => x !== null) : [];
  const licenses = Array.isArray(container.licenses) ? container.licenses.map(normalizeLicenseRecord).filter((x) => x !== null) : [];
  const leaderboard = Array.isArray(container.leaderboard) ? container.leaderboard.map(normalizeLeaderboardRecord).filter((x) => x !== null) : [];
  const users = Array.isArray(container.users) ? container.users.map(normalizeUserRecord).filter((x) => x !== null) : [];
  const totalItems = games.length + categories.length + Object.keys(siteSettings).length + certificates.length + testimonials.length + licenses.length + leaderboard.length + users.length;
  if (totalItems === 0) {
    throw new Error("Tidak ditemukan data game, kategori, pengaturan, sertifikat, atau entitas lain yang valid di dalam backup.");
  }
  return {
    games,
    categories,
    siteSettings,
    certificates,
    testimonials,
    licenses,
    leaderboard,
    users
  };
}
function summarizeBackupPayload(data) {
  const source = "data" in data ? data.data : data;
  return {
    games: source.games?.length || 0,
    categories: source.categories?.length || 0,
    siteSettings: source.siteSettings ? Object.keys(source.siteSettings).length : 0,
    certificates: source.certificates?.length || 0,
    testimonials: source.testimonials?.length || 0,
    licenses: source.licenses?.length || 0,
    leaderboard: source.leaderboard?.length || 0,
    users: source.users?.length || 0
  };
}
function isValidSqliteHeader(bytes) {
  const magic = "SQLite format 3\0";
  if (!bytes || bytes.length < magic.length) return false;
  for (let i = 0; i < magic.length; i++) {
    if (bytes[i] !== magic.charCodeAt(i)) return false;
  }
  return true;
}
function formatSnapshotTimestamp(date = /* @__PURE__ */ new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

// server.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path2.dirname(__filename);
var app = express();
var PORT = process.env.PORT && process.env.PORT !== "8080" ? Number(process.env.PORT) : 3e3;
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use("/api/v1", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  next();
});
var sseClients = [];
var nextClientId = 1;
function getDataRevision() {
  try {
    const row = db.prepare("SELECT value FROM sync_metadata WHERE key = 'data_revision'").get();
    const rev = Number(row?.value);
    return Number.isFinite(rev) && rev > 0 ? rev : 1;
  } catch {
    return 1;
  }
}
function bumpDataRevision() {
  const nextRev = getDataRevision() + 1;
  try {
    db.prepare(`
      INSERT INTO sync_metadata (key, value, updated_at) VALUES ('data_revision', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run(String(nextRev));
  } catch (err) {
    console.error("Sync revision bump error:", err);
  }
  return nextRev;
}
function broadcastEvent(event, data) {
  const revision = event === "connected" ? getDataRevision() : bumpDataRevision();
  const enriched = typeof data === "object" && data !== null && !Array.isArray(data) ? { ...data, revision } : { value: data, revision };
  const payload = `event: ${event}
data: ${JSON.stringify(enriched)}

`;
  sseClients = sseClients.filter((client) => {
    try {
      client.res.write(payload);
      return true;
    } catch {
      return false;
    }
  });
}
function recordAudit(actor, action, details) {
  try {
    db.prepare("INSERT INTO audit_logs (actor, action, details) VALUES (?, ?, ?)").run(actor, action, details);
  } catch (err) {
    console.error("Audit log error:", err);
  }
}
function ensureSynchronizedCategoryWithMeta(rawCategoryName, icon) {
  const normalized = normalizeCategoryName(rawCategoryName);
  if (!normalized) {
    throw new Error("Kategori pembelajaran wajib diisi atau dipilih");
  }
  const existingRows = db.prepare("SELECT id, name FROM categories").all();
  const { matchedCategory } = resolveCategoryMatch(normalized, existingRows);
  if (matchedCategory) {
    return { name: matchedCategory.name };
  }
  const slug = slugifyCategory(normalized) || `kategori-${Date.now()}`;
  const maxSort = db.prepare("SELECT MAX(sort_order) as m FROM categories").get().m || 0;
  const catIcon = icon && icon.trim() ? icon.trim() : "fa-seedling";
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
      icon: catIcon
    }
  };
}
function ensureSynchronizedCategory(rawCategoryName, icon, emitEvents = true) {
  const result = ensureSynchronizedCategoryWithMeta(rawCategoryName, icon);
  if (emitEvents && result.createdCategory) {
    recordAudit("Admin", "CREATE_CATEGORY", `Auto-synchronized category from game upload: ${result.createdCategory.name}`);
    broadcastEvent("category:created", result.createdCategory);
  }
  return result.name;
}
app.get("/api/v1/realtime/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  const clientId = nextClientId++;
  const client = { id: clientId, res };
  sseClients.push(client);
  res.write(`event: connected
data: ${JSON.stringify({ status: "connected", clientId, revision: getDataRevision() })}

`);
  const heartbeat = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      clearInterval(heartbeat);
    }
  }, 2e4);
  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients = sseClients.filter((c) => c.id !== clientId);
  });
});
app.get("/api/v1/sync/state", (_req, res) => {
  try {
    const revision = getDataRevision();
    const gamesCount = db.prepare("SELECT COUNT(*) as c FROM games").get().c;
    const activeGamesCount = db.prepare("SELECT COUNT(*) as c FROM games WHERE is_active = 1 AND (status IS NULL OR status != 'inactive')").get().c;
    const categoriesCount = db.prepare("SELECT COUNT(*) as c FROM categories").get().c;
    const certificatesCount = db.prepare("SELECT COUNT(*) as c FROM certificates").get().c;
    const leaderboardCount = db.prepare("SELECT COUNT(*) as c FROM leaderboard").get().c;
    const testimonialsCount = db.prepare("SELECT COUNT(*) as c FROM testimonials").get().c;
    const licensesCount = db.prepare("SELECT COUNT(*) as c FROM licenses").get().c;
    const usersCount = db.prepare("SELECT COUNT(*) as c FROM users").get().c;
    res.json({
      success: true,
      data: {
        revision,
        serverTime: (/* @__PURE__ */ new Date()).toISOString(),
        activeClients: sseClients.length,
        counts: {
          games: gamesCount,
          activeGames: activeGamesCount,
          categories: categoriesCount,
          certificates: certificatesCount,
          leaderboard: leaderboardCount,
          testimonials: testimonialsCount,
          licenses: licensesCount,
          users: usersCount
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.get("/api/v1/health", (_req, res) => {
  res.json({ success: true, message: "Server is healthy", revision: getDataRevision(), timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
app.get("/api/v1/stats/overview", (_req, res) => {
  try {
    const totalGames = db.prepare("SELECT COUNT(*) as count FROM games WHERE is_active = 1 AND (status IS NULL OR status != 'inactive')").get().count;
    const totalCategories = db.prepare("SELECT COUNT(*) as count FROM categories").get().count;
    const totalPlayersSum = db.prepare("SELECT SUM(players) as sum FROM games").get().sum || 0;
    const totalLeaderboardEntries = db.prepare("SELECT COUNT(*) as count FROM leaderboard").get().count;
    const totalCertificates = db.prepare("SELECT COUNT(*) as count FROM certificates WHERE is_active = 1 AND (status IS NULL OR status != 'inactive')").get().count;
    res.json({
      success: true,
      data: {
        totalGames,
        totalCategories,
        totalPlayers: totalPlayersSum,
        totalLeaderboardEntries,
        totalCertificates
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.get("/api/v1/settings", (_req, res) => {
  try {
    const rows = db.prepare("SELECT key, value FROM site_settings").all();
    const settings = {};
    rows.forEach((r) => {
      settings[r.key] = r.value;
    });
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.post("/api/v1/settings", (req, res) => {
  try {
    const { title, subtitle, emoji, imageUrl, announcement } = req.body;
    const updateStmt = db.prepare(`
      INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `);
    if (title !== void 0) updateStmt.run("title", title);
    if (subtitle !== void 0) updateStmt.run("subtitle", subtitle);
    if (emoji !== void 0) updateStmt.run("emoji", emoji);
    if (imageUrl !== void 0) updateStmt.run("imageUrl", imageUrl);
    if (announcement !== void 0) updateStmt.run("announcement", announcement);
    recordAudit("Admin", "UPDATE_SETTINGS", `Updated Hero banner settings: ${title}`);
    broadcastEvent("settings:updated", { title, subtitle, emoji, imageUrl, announcement });
    res.json({ success: true, message: "Pengaturan beranda berhasil disimpan!" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.get("/api/v1/categories", (_req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM categories ORDER BY sort_order ASC, id ASC").all();
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.post("/api/v1/categories", (req, res) => {
  try {
    const { name, icon } = req.body;
    const normalized = typeof name === "string" ? normalizeCategoryName(name) : "";
    if (!normalized) {
      res.status(400).json({ success: false, message: "Nama kategori wajib diisi" });
      return;
    }
    const existingRows = db.prepare("SELECT id, name FROM categories").all();
    const { matchedCategory } = resolveCategoryMatch(normalized, existingRows);
    if (matchedCategory) {
      res.status(400).json({ success: false, message: `Kategori "${matchedCategory.name}" sudah terdaftar` });
      return;
    }
    const slug = slugifyCategory(normalized) || `kategori-${Date.now()}`;
    const maxSort = db.prepare("SELECT MAX(sort_order) as m FROM categories").get().m || 0;
    const catIcon = icon && String(icon).trim() ? String(icon).trim() : "fa-seedling";
    const info = db.prepare(`
      INSERT INTO categories (name, slug, icon, sort_order, status)
      VALUES (?, ?, ?, ?, 1)
    `).run(normalized, slug, catIcon, maxSort + 1);
    recordAudit("Admin", "CREATE_CATEGORY", `Added category: ${normalized}`);
    broadcastEvent("category:created", { id: info.lastInsertRowid, name: normalized, slug, icon: catIcon });
    res.json({ success: true, message: "Kategori berhasil ditambahkan", data: { id: info.lastInsertRowid, name: normalized, slug, icon: catIcon } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.put("/api/v1/categories/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, icon } = req.body;
    const oldCat = db.prepare("SELECT * FROM categories WHERE id = ?").get(id);
    if (!oldCat) {
      res.status(404).json({ success: false, message: "Kategori tidak ditemukan" });
      return;
    }
    const normalized = typeof name === "string" ? normalizeCategoryName(name) : "";
    if (!normalized) {
      res.status(400).json({ success: false, message: "Nama kategori wajib diisi" });
      return;
    }
    const existingRows = db.prepare("SELECT id, name FROM categories WHERE id != ?").all(id);
    const { matchedCategory } = resolveCategoryMatch(normalized, existingRows);
    if (matchedCategory) {
      res.status(400).json({ success: false, message: `Kategori "${matchedCategory.name}" sudah digunakan` });
      return;
    }
    const slug = slugifyCategory(normalized) || `kategori-${id}`;
    let updatedGamesCount = 0;
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare("UPDATE categories SET name = ?, slug = ?, icon = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(
        normalized,
        slug,
        icon,
        id
      );
      const gameUpdate = db.prepare("UPDATE games SET category = ?, updated_at = CURRENT_TIMESTAMP WHERE category = ?").run(normalized, oldCat.name);
      updatedGamesCount = Number(gameUpdate.changes || 0);
      db.exec("COMMIT");
    } catch (txErr) {
      try {
        db.exec("ROLLBACK");
      } catch {
      }
      throw txErr;
    }
    recordAudit("Admin", "UPDATE_CATEGORY", `Updated category: ${oldCat.name} -> ${normalized} (synced ${updatedGamesCount} games)`);
    broadcastEvent("category:updated", { id, name: normalized, icon });
    if (updatedGamesCount > 0) {
      broadcastEvent("game:updated", { oldCategory: oldCat.name, category: normalized });
    }
    res.json({ success: true, message: "Kategori dan game terkait berhasil disinkronkan!" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.delete("/api/v1/categories/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    const cat = db.prepare("SELECT * FROM categories WHERE id = ?").get(id);
    if (!cat) {
      res.status(404).json({ success: false, message: "Kategori tidak ditemukan" });
      return;
    }
    const linkedGames = db.prepare("SELECT COUNT(*) as count FROM games WHERE category = ?").get(cat.name).count;
    if (linkedGames > 0) {
      res.status(400).json({
        success: false,
        message: `Kategori "${cat.name}" masih digunakan oleh ${linkedGames} permainan.`
      });
      return;
    }
    db.prepare("DELETE FROM categories WHERE id = ?").run(id);
    recordAudit("Admin", "DELETE_CATEGORY", `Deleted category: ${cat.name}`);
    broadcastEvent("category:deleted", { id, name: cat.name });
    res.json({ success: true, message: "Kategori berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.get("/api/v1/games", (req, res) => {
  try {
    const { category, difficulty, type, search } = req.query;
    let query = "SELECT * FROM games WHERE 1=1";
    const params = [];
    if (category && category !== "all" && typeof category === "string") {
      query += " AND category = ?";
      params.push(category);
    }
    if (difficulty && difficulty !== "all" && typeof difficulty === "string") {
      query += " AND difficulty = ?";
      params.push(difficulty);
    }
    if (type && type !== "all" && typeof type === "string") {
      query += " AND type = ?";
      params.push(type);
    }
    if (search && typeof search === "string" && search.trim() !== "") {
      query += " AND (title LIKE ? OR description LIKE ?)";
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }
    query += " ORDER BY featured DESC, id DESC";
    const games = db.prepare(query).all(...params);
    const formatted = games.map((g) => ({
      id: g.id,
      title: g.title,
      slug: g.slug,
      category: g.category,
      difficulty: g.difficulty,
      type: g.type,
      rating: g.rating,
      players: g.players,
      thumbnail: g.thumbnail || "",
      icon: g.icon || "",
      description: g.description,
      isPremium: Boolean(g.is_premium),
      isActive: g.is_active === 0 || g.status === "inactive" ? false : true,
      status: g.status || (g.is_active === 0 ? "inactive" : "published"),
      html5Code: g.html5_code,
      url: g.url,
      featured: Boolean(g.featured),
      createdAt: g.created_at,
      updatedAt: g.updated_at
    }));
    res.json({ success: true, data: formatted });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.get("/api/v1/games/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    const g = db.prepare("SELECT * FROM games WHERE id = ?").get(id);
    if (!g) {
      res.status(404).json({ success: false, message: "Permainan tidak ditemukan" });
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
        thumbnail: g.thumbnail || "",
        icon: g.icon || "",
        description: g.description,
        isPremium: Boolean(g.is_premium),
        isActive: g.is_active === 0 || g.status === "inactive" ? false : true,
        status: g.status || (g.is_active === 0 ? "inactive" : "published"),
        html5Code: g.html5_code,
        url: g.url,
        featured: Boolean(g.featured)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.post("/api/v1/games", (req, res) => {
  try {
    const { title, category, categoryIcon, difficulty, type, description, isPremium, isActive, thumbnail, icon, url, html5Code } = req.body;
    if (!title || !String(title).trim() || !description || !String(description).trim()) {
      res.status(400).json({ success: false, message: "Judul dan deskripsi game wajib diisi" });
      return;
    }
    if (!category || !normalizeCategoryName(String(category))) {
      res.status(400).json({ success: false, message: "Kategori pembelajaran wajib dipilih atau diisi saat upload game baru" });
      return;
    }
    const slug = slugifyCategory(String(title)) || `game-${Date.now()}`;
    const activeValue = isActive === false ? 0 : 1;
    const statusValue = isActive === false ? "inactive" : "published";
    const cleanThumbnail = normalizeGameMediaValue(thumbnail);
    const cleanIcon = normalizeGameMediaValue(icon);
    let syncedCategory = "";
    let createdCategoryMeta;
    let newGameId = 0;
    db.exec("BEGIN IMMEDIATE");
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
        difficulty || "Mudah",
        type || "html5",
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
      db.exec("COMMIT");
    } catch (txErr) {
      try {
        db.exec("ROLLBACK");
      } catch {
      }
      throw txErr;
    }
    if (createdCategoryMeta) {
      recordAudit("Admin", "CREATE_CATEGORY", `Auto-synchronized category from game upload: ${createdCategoryMeta.name}`);
      broadcastEvent("category:created", createdCategoryMeta);
    }
    recordAudit("Admin", "CREATE_GAME", `Added game: ${title} -> Kategori: ${syncedCategory} (${statusValue})`);
    broadcastEvent("game:created", {
      id: newGameId,
      title: String(title).trim(),
      category: syncedCategory,
      type,
      thumbnail: cleanThumbnail,
      icon: cleanIcon,
      isActive: Boolean(activeValue)
    });
    res.json({
      success: true,
      message: `Permainan "${String(title).trim()}" berhasil disimpan dan disinkronkan ke kategori "${syncedCategory}"!`,
      id: newGameId,
      category: syncedCategory
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.put("/api/v1/games/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = db.prepare("SELECT * FROM games WHERE id = ?").get(id);
    if (!existing) {
      res.status(404).json({ success: false, message: "Permainan tidak ditemukan" });
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
    const currentIsActive = existing.is_active === 0 || existing.status === "inactive" ? 0 : 1;
    const newIsActive = isActive !== void 0 ? isActive ? 1 : 0 : status !== void 0 ? status === "inactive" ? 0 : 1 : currentIsActive;
    const newStatus = status !== void 0 ? String(status) : newIsActive === 1 ? "published" : "inactive";
    const mergedMedia = mergeGameMediaPatch(
      {
        thumbnail: existing.thumbnail || "",
        icon: existing.icon || ""
      },
      {
        thumbnail: thumbnail !== void 0 ? String(thumbnail) : void 0,
        icon: icon !== void 0 ? String(icon) : void 0
      }
    );
    let syncedCategory = String(existing.category);
    let createdCategoryMeta;
    db.exec("BEGIN IMMEDIATE");
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
        db.prepare("UPDATE leaderboard SET game_title = ? WHERE game_id = ? OR game_title = ?").run(nextTitle, id, String(existing.title));
      }
      if (nextTitle !== String(existing.title) || syncedCategory !== String(existing.category)) {
        db.prepare("UPDATE game_access_logs SET game_title = ?, game_category = ? WHERE game_id = ?").run(nextTitle, syncedCategory, id);
      }
      db.exec("COMMIT");
    } catch (txErr) {
      try {
        db.exec("ROLLBACK");
      } catch {
      }
      throw txErr;
    }
    if (createdCategoryMeta) {
      recordAudit("Admin", "CREATE_CATEGORY", `Auto-synchronized category from game update: ${createdCategoryMeta.name}`);
      broadcastEvent("category:created", createdCategoryMeta);
    }
    recordAudit(
      "Admin",
      "UPDATE_GAME",
      `Updated game ID ${id} (${nextTitle}) -> Kategori: ${syncedCategory}, Thumbnail: ${mergedMedia.thumbnail ? "Diperbarui" : "Default"}, Icon: ${mergedMedia.icon || "Default"}, Status: ${newIsActive ? "Aktif" : "Nonaktif"}`
    );
    broadcastEvent("game:updated", {
      id,
      title: nextTitle,
      category: syncedCategory,
      thumbnail: mergedMedia.thumbnail,
      icon: mergedMedia.icon,
      isActive: Boolean(newIsActive),
      status: newStatus
    });
    res.json({
      success: true,
      message: `Data, thumbnail & ikon permainan "${nextTitle}" berhasil diperbarui dan disinkronkan!`,
      thumbnail: mergedMedia.thumbnail,
      icon: mergedMedia.icon
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.patch("/api/v1/games/:id/status", (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = db.prepare("SELECT * FROM games WHERE id = ?").get(id);
    if (!existing) {
      res.status(404).json({ success: false, message: "Permainan tidak ditemukan" });
      return;
    }
    const { isActive } = req.body;
    const currentActive = existing.is_active === 0 || existing.status === "inactive" ? 0 : 1;
    const newActive = isActive !== void 0 ? isActive ? 1 : 0 : currentActive === 1 ? 0 : 1;
    const newStatus = newActive === 1 ? "published" : "inactive";
    db.prepare(`
      UPDATE games
      SET is_active = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newActive, newStatus, id);
    recordAudit("Admin", "TOGGLE_GAME_STATUS", `Game "${existing.title}" diubah status menjadi: ${newActive ? "Aktif" : "Nonaktif"}`);
    broadcastEvent("game:updated", { id, title: existing.title, isActive: Boolean(newActive), status: newStatus });
    res.json({
      success: true,
      message: `Permainan "${existing.title}" berhasil di-${newActive ? "aktifkan" : "nonaktifkan"}!`,
      isActive: Boolean(newActive),
      status: newStatus
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.delete("/api/v1/games/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    const g = db.prepare("SELECT title FROM games WHERE id = ?").get(id);
    if (!g) {
      res.status(404).json({ success: false, message: "Permainan tidak ditemukan" });
      return;
    }
    db.prepare("DELETE FROM games WHERE id = ?").run(id);
    recordAudit("Admin", "DELETE_GAME", `Deleted game: ${g.title}`);
    broadcastEvent("game:deleted", { id, title: g.title });
    res.json({ success: true, message: "Permainan berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.post("/api/v1/games/reset-stats", (req, res) => {
  try {
    const { password } = req.body;
    if (password !== "admin321") {
      recordAudit("Anonymous", "RESET_STATS_DENIED", "Percobaan reset total pemain dengan kata sandi salah");
      res.status(403).json({ success: false, message: "Kata sandi salah! Reset total permainan dibatalkan." });
      return;
    }
    db.prepare("UPDATE games SET players = 0").run();
    recordAudit("Admin", "RESET_STATS", "Reset counter total pemain seluruh game ke 0");
    broadcastEvent("stats:updated", { playersReset: true });
    res.json({ success: true, message: "Total permainan berhasil direset ke 0!" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.get("/api/v1/leaderboard", (_req, res) => {
  try {
    const rows = db.prepare(`
      SELECT * FROM leaderboard
      ORDER BY score DESC, xp_earned DESC, id ASC
      LIMIT 100
    `).all();
    const formatted = rows.map((r, index) => ({
      id: r.id,
      userName: r.user_name,
      userEmail: r.user_email,
      avatar: r.avatar,
      gameId: r.game_id,
      gameTitle: r.game_title,
      score: r.score,
      xpEarned: r.xp_earned,
      badge: r.badge,
      school: r.school,
      createdAt: r.created_at,
      rank: index + 1
    }));
    res.json({ success: true, data: formatted });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.post("/api/v1/leaderboard", (req, res) => {
  try {
    const { userName, userEmail, avatar, gameId, gameTitle, score, xpEarned, badge, school, isCompleted, accessLogId } = req.body;
    if (!userName || !gameTitle || score === void 0) {
      res.status(400).json({ success: false, message: "Nama pemain, judul game, dan skor wajib disertakan" });
      return;
    }
    if (isCompleted === false) {
      res.status(400).json({
        success: false,
        message: "Catat skor hanya berlaku jika Anda mampu menyelesaikan permainan hingga akhir, bukan hanya membuka saja."
      });
      return;
    }
    const info = db.prepare(`
      INSERT INTO leaderboard (user_name, user_email, avatar, game_id, game_title, score, xp_earned, badge, school)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userName.trim(),
      userEmail || null,
      avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(userName)}`,
      gameId || null,
      gameTitle,
      score,
      xpEarned || Math.round(score * 0.5),
      badge || "Sahabat Pemula Dharma",
      school || "Umum / Mandiri"
    );
    if (accessLogId) {
      try {
        db.prepare("UPDATE game_access_logs SET completed = 1 WHERE id = ?").run(accessLogId);
      } catch (logErr) {
        console.error("Error updating access log completion:", logErr);
      }
    }
    if (gameId) {
      db.prepare("UPDATE games SET players = players + 1 WHERE id = ?").run(gameId);
    } else {
      db.prepare("UPDATE games SET players = players + 1 WHERE title = ?").run(gameTitle);
    }
    broadcastEvent("leaderboard:updated", { id: info.lastInsertRowid, userName, score });
    res.json({ success: true, message: "Skor berhasil dicatat di Papan Peringkat!", id: info.lastInsertRowid });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.post("/api/v1/leaderboard/reset", (req, res) => {
  try {
    const { password, gameTitle } = req.body;
    if (password !== "admin321") {
      recordAudit("Anonymous", "RESET_LEADERBOARD_DENIED", "Percobaan reset skor leaderboard dengan kata sandi salah");
      res.status(403).json({ success: false, message: "Kata sandi salah! Reset skor leaderboard dibatalkan." });
      return;
    }
    if (gameTitle && gameTitle.trim()) {
      db.prepare("DELETE FROM leaderboard WHERE game_title = ?").run(gameTitle.trim());
      recordAudit("Admin", "RESET_LEADERBOARD_GAME", `Reset skor leaderboard untuk permainan: ${gameTitle}`);
    } else {
      db.prepare("DELETE FROM leaderboard").run();
      recordAudit("Admin", "RESET_LEADERBOARD_ALL", "Reset seluruh data skor leaderboard");
    }
    broadcastEvent("leaderboard:updated", { reset: true, gameTitle: gameTitle || null });
    res.json({
      success: true,
      message: gameTitle ? `Seluruh skor permainan "${gameTitle}" berhasil direset!` : "Seluruh skor di Papan Peringkat berhasil direset total!"
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.delete("/api/v1/leaderboard/:id", (req, res) => {
  try {
    const { id } = req.params;
    const entry = db.prepare("SELECT * FROM leaderboard WHERE id = ?").get(id);
    if (!entry) {
      res.status(404).json({ success: false, message: "Data skor leaderboard tidak ditemukan" });
      return;
    }
    db.prepare("DELETE FROM leaderboard WHERE id = ?").run(id);
    recordAudit("Admin", "DELETE_LEADERBOARD_SCORE", `Hapus skor ID #${id} milik ${entry.user_name} (${entry.game_title})`);
    broadcastEvent("leaderboard:updated", { deletedId: id });
    res.json({ success: true, message: "Entri skor berhasil dihapus dari leaderboard" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.get("/api/v1/testimonials", (req, res) => {
  try {
    const { all } = req.query;
    let query = "SELECT * FROM testimonials";
    if (!all) {
      query += " WHERE status = 'approved'";
    }
    query += " ORDER BY id DESC";
    const rows = db.prepare(query).all();
    const formatted = rows.map((r) => ({
      id: r.id,
      name: r.name,
      role: r.role,
      game: r.game,
      rating: r.rating,
      message: r.message,
      status: r.status,
      createdAt: r.created_at
    }));
    res.json({ success: true, data: formatted });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.post("/api/v1/testimonials", (req, res) => {
  try {
    const { name, role, game, rating, message } = req.body;
    if (!name || !message) {
      res.status(400).json({ success: false, message: "Nama dan pesan ulasan wajib diisi" });
      return;
    }
    const info = db.prepare(`
      INSERT INTO testimonials (name, role, game, rating, message, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).run(name.trim(), role || "Siswa", game || "Platform Keseluruhan", Number(rating) || 5, message.trim());
    broadcastEvent("testimonial:created", { id: info.lastInsertRowid, name });
    res.json({ success: true, message: "Testimoni Anda berhasil dikirim dan menunggu moderasi admin!" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.patch("/api/v1/testimonials/:id/status", (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    if (!status || !["approved", "pending", "rejected"].includes(status)) {
      res.status(400).json({ success: false, message: "Status tidak valid" });
      return;
    }
    db.prepare("UPDATE testimonials SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(status, id);
    recordAudit("Admin", "MODERATE_TESTIMONIAL", `Testimonial ID ${id} set to ${status}`);
    broadcastEvent("testimonial:updated", { id, status });
    res.json({ success: true, message: `Status testimoni diperbarui menjadi: ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.delete("/api/v1/testimonials/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    db.prepare("DELETE FROM testimonials WHERE id = ?").run(id);
    recordAudit("Admin", "DELETE_TESTIMONIAL", `Deleted testimonial ID ${id}`);
    broadcastEvent("testimonial:deleted", { id });
    res.json({ success: true, message: "Testimoni berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.get("/api/v1/licenses", (_req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM licenses ORDER BY id DESC").all();
    const formatted = rows.map((r) => ({
      id: r.id,
      schoolName: r.school_name,
      plan: r.plan,
      status: r.status,
      expiresDate: r.expires_date,
      licenseKey: r.license_key
    }));
    res.json({ success: true, data: formatted });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.post("/api/v1/licenses", (req, res) => {
  try {
    const { schoolName, plan, expiresDate } = req.body;
    if (!schoolName || !plan) {
      res.status(400).json({ success: false, message: "Nama institusi dan paket lisensi wajib diisi" });
      return;
    }
    const cleanKey = "PGB-LIC-" + Math.random().toString(36).substring(2, 8).toUpperCase();
    const info = db.prepare(`
      INSERT INTO licenses (school_name, plan, status, expires_date, license_key)
      VALUES (?, ?, 'Aktif', ?, ?)
    `).run(schoolName.trim(), plan.trim(), expiresDate || "2028-12-31", cleanKey);
    recordAudit("Admin", "CREATE_LICENSE", `Issued license for: ${schoolName}`);
    broadcastEvent("license:created", { id: info.lastInsertRowid, schoolName: schoolName.trim(), licenseKey: cleanKey });
    res.json({ success: true, message: "Lisensi berhasil diterbitkan", id: info.lastInsertRowid, licenseKey: cleanKey });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.delete("/api/v1/licenses/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    const lic = db.prepare("SELECT school_name FROM licenses WHERE id = ?").get(id);
    if (!lic) {
      res.status(404).json({ success: false, message: "Lisensi sekolah tidak ditemukan" });
      return;
    }
    db.prepare("DELETE FROM licenses WHERE id = ?").run(id);
    recordAudit("Admin", "DELETE_LICENSE", `Deleted school license: ${lic.school_name} (ID: ${id})`);
    broadcastEvent("license:deleted", { id, schoolName: lic.school_name });
    res.json({ success: true, message: `Lisensi untuk "${lic.school_name}" berhasil dihapus` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.get("/api/v1/users", (_req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM users ORDER BY created_at DESC").all();
    const formatted = rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      avatar: r.avatar,
      xp: r.xp,
      badge: r.badge,
      level: r.level,
      school: r.school,
      role: r.role || "user",
      createdAt: r.created_at
    }));
    res.json({ success: true, data: formatted });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.post("/api/v1/users", (req, res) => {
  try {
    const { name, email, avatar, xp, badge, level, school, role, password } = req.body;
    if (!name || !email) {
      res.status(400).json({ success: false, message: "Nama dan email pengguna wajib diisi" });
      return;
    }
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email.trim().toLowerCase());
    if (existing) {
      res.status(400).json({ success: false, message: `Pengguna dengan email "${email}" sudah terdaftar` });
      return;
    }
    const id = "usr-" + Date.now();
    const userRole = role && ["admin", "uploader", "user"].includes(role) ? role : "user";
    const userPassword = password && String(password).trim().length > 0 ? String(password).trim() : "dharma123";
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
      badge || "Sahabat Pemula Dharma",
      Number(level) || 1,
      school ? school.trim() : "Umum",
      userRole,
      userPassword
    );
    recordAudit("Admin", "CREATE_USER", `Added user: ${name} (${email}) as [${userRole}] with configured password`);
    broadcastEvent("user:created", { id, name, role: userRole });
    res.json({ success: true, message: `Pengguna baru tingkat "${userRole}" berhasil ditambahkan dengan kata sandi terkonfigurasi`, id });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.put("/api/v1/users/:id", (req, res) => {
  try {
    const id = req.params.id;
    const { name, email, avatar, xp, badge, level, school, role, password } = req.body;
    const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
    if (!existing) {
      res.status(404).json({ success: false, message: "Pengguna tidak ditemukan" });
      return;
    }
    const updatedRole = role && ["admin", "uploader", "user"].includes(role) ? role : existing.role || "user";
    const updatedPassword = password !== void 0 && String(password).trim().length > 0 ? String(password).trim() : existing.password || "dharma123";
    db.prepare(`
      UPDATE users
      SET name = ?, email = ?, avatar = ?, xp = ?, badge = ?, level = ?, school = ?, role = ?, password = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name !== void 0 ? String(name).trim() : existing.name,
      email !== void 0 ? String(email).trim().toLowerCase() : existing.email,
      avatar !== void 0 ? String(avatar) : existing.avatar || "",
      xp !== void 0 ? Number(xp) : existing.xp,
      badge !== void 0 ? String(badge) : existing.badge,
      level !== void 0 ? Number(level) : existing.level,
      school !== void 0 ? String(school).trim() : existing.school || "Umum",
      String(updatedRole),
      String(updatedPassword),
      String(id)
    );
    recordAudit("Admin", "UPDATE_USER", `Updated user ${id} (Role: ${updatedRole}, password updated: ${password ? "Yes" : "No"})`);
    broadcastEvent("user:updated", { id, role: updatedRole });
    res.json({ success: true, message: `Data pengguna berhasil diperbarui (Tingkat: ${updatedRole})` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.post("/api/v1/auth/register", (req, res) => {
  try {
    const { name, email, password, school } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ success: false, message: "Nama lengkap, email, dan kata sandi wajib diisi" });
      return;
    }
    if (String(password).trim().length < 4) {
      res.status(400).json({ success: false, message: "Kata sandi minimal 4 karakter" });
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(cleanEmail);
    if (existing) {
      res.status(400).json({ success: false, message: "Email sudah terdaftar. Silakan masuk menggunakan kata sandi Anda." });
      return;
    }
    const id = "usr-" + Date.now();
    const userRole = "user";
    const cleanName = name.trim();
    const cleanPassword = String(password).trim();
    const avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanName)}`;
    const cleanSchool = school ? String(school).trim() : "Umum / Mandiri";
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
      badge: "Sahabat Pemula Dharma",
      level: 1,
      school: cleanSchool,
      role: userRole
    };
    recordAudit(cleanName, "USER_REGISTER", `Pendaftaran akun baru: ${cleanName} (${cleanEmail})`);
    broadcastEvent("user:created", { id, name: cleanName, role: userRole });
    res.json({ success: true, message: "Pendaftaran akun berhasil! Selamat datang di Pusat Games Buddhis.", user: newUser });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.post("/api/v1/auth/login", (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ success: false, message: "Email dan kata sandi wajib diisi" });
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = String(password).trim();
    const row = db.prepare("SELECT * FROM users WHERE email = ?").get(cleanEmail);
    if (!row) {
      res.status(404).json({ success: false, message: "Akun dengan email ini belum terdaftar. Silakan daftar akun baru terlebih dahulu." });
      return;
    }
    const validPassword = row.password || "dharma123";
    const isPasswordValid = cleanPassword === validPassword || row.role === "admin" && cleanPassword === "admin321" || row.role === "uploader" && cleanPassword === "uploader123";
    if (!isPasswordValid) {
      recordAudit(row.name, "USER_LOGIN_FAILED", `Percobaan login gagal untuk email ${cleanEmail}`);
      res.status(401).json({ success: false, message: "Kata sandi salah. Silakan periksa kembali kata sandi Anda." });
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
      school: row.school || "Umum",
      role: row.role || "user",
      createdAt: row.created_at
    };
    recordAudit(row.name, "USER_LOGIN_SUCCESS", `Login berhasil sebagai [${userProfile.role}]`);
    res.json({ success: true, message: `Selamat datang kembali, ${row.name}!`, user: userProfile });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.delete("/api/v1/users/:id", (req, res) => {
  try {
    const id = req.params.id;
    const u = db.prepare("SELECT name, role FROM users WHERE id = ?").get(id);
    if (!u) {
      res.status(404).json({ success: false, message: "Pengguna tidak ditemukan" });
      return;
    }
    db.prepare("DELETE FROM users WHERE id = ?").run(id);
    recordAudit("Admin", "DELETE_USER", `Deleted user: ${u.name} (Role: ${u.role}, ID: ${id})`);
    broadcastEvent("user:deleted", { id, name: u.name });
    res.json({ success: true, message: `Pengguna "${u.name}" berhasil dihapus` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.get("/api/v1/certificates", (_req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM certificates ORDER BY created_at DESC, id DESC").all();
    const formatted = rows.map((r) => {
      const active = r.is_active === 0 || r.status === "inactive" ? false : true;
      return {
        id: r.id,
        studentName: r.student_name,
        module: r.module,
        institution: r.institution,
        date: r.date,
        certificateNumber: r.certificate_number,
        verificationCode: r.verification_code,
        isActive: active,
        status: active ? "active" : "inactive",
        createdAt: r.created_at
      };
    });
    res.json({ success: true, data: formatted });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.get("/api/v1/certificates/verify/:code", (req, res) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    const r = db.prepare("SELECT * FROM certificates WHERE verification_code = ? OR id = ?").get(code, code);
    if (!r) {
      res.status(404).json({ success: false, message: `Kode sertifikat "${code}" tidak ditemukan dalam arsip resmi.` });
      return;
    }
    const active = r.is_active === 0 || r.status === "inactive" ? false : true;
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
        status: active ? "active" : "inactive",
        isValid: active
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.post("/api/v1/certificates", (req, res) => {
  try {
    const { studentName, module, institution } = req.body;
    if (!studentName || !module) {
      res.status(400).json({ success: false, message: "Nama siswa dan modul wajib diisi" });
      return;
    }
    const year = (/* @__PURE__ */ new Date()).getFullYear();
    let nextId = `CERT-${year}-${Math.floor(100 + Math.random() * 900)}`;
    while (db.prepare("SELECT id FROM certificates WHERE id = ?").get(nextId)) {
      nextId = `CERT-${year}-${Math.floor(1e3 + Math.random() * 9e3)}`;
    }
    const certNum = `PGB/DHARMA/${year}/${Math.floor(1e3 + Math.random() * 9e3)}`;
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    db.prepare(`
      INSERT INTO certificates (id, student_name, module, institution, date, certificate_number, verification_code, is_active, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'active')
    `).run(nextId, studentName.trim(), module.trim(), institution || "Pusat Games Buddhis Indonesia", today, certNum, nextId);
    recordAudit("Admin", "ISSUE_CERTIFICATE", `Issued certificate ${nextId} for ${studentName}`);
    broadcastEvent("certificate:created", { id: nextId, studentName: studentName.trim() });
    res.json({ success: true, message: "Sertifikat berhasil diterbitkan!", id: nextId, verificationCode: nextId });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.patch("/api/v1/certificates/:id/status", (req, res) => {
  try {
    const id = String(req.params.id).trim();
    const existing = db.prepare("SELECT id, student_name, verification_code, is_active, status FROM certificates WHERE id = ? OR verification_code = ?").get(id, id);
    if (!existing) {
      res.status(404).json({ success: false, message: "Sertifikat tidak ditemukan" });
      return;
    }
    const { isActive } = req.body;
    const currentActive = existing.is_active === 0 || existing.status === "inactive" ? 0 : 1;
    const newActive = isActive !== void 0 ? isActive ? 1 : 0 : currentActive === 1 ? 0 : 1;
    const newStatus = newActive === 1 ? "active" : "inactive";
    db.prepare("UPDATE certificates SET is_active = ?, status = ? WHERE id = ?").run(newActive, newStatus, existing.id);
    recordAudit(
      "Admin",
      "TOGGLE_CERTIFICATE_STATUS",
      `Sertifikat ${existing.verification_code} (${existing.student_name}) diubah status menjadi: ${newActive ? "Aktif" : "Nonaktif"}`
    );
    broadcastEvent("certificate:updated", { id: existing.id, isActive: Boolean(newActive), status: newStatus });
    res.json({
      success: true,
      message: `Sertifikat "${existing.verification_code}" berhasil di-${newActive ? "aktifkan" : "nonaktifkan"}!`,
      isActive: Boolean(newActive),
      status: newStatus
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.delete("/api/v1/certificates/:id", (req, res) => {
  try {
    const id = String(req.params.id).trim();
    const existing = db.prepare("SELECT id, student_name, verification_code FROM certificates WHERE id = ? OR verification_code = ?").get(id, id);
    if (!existing) {
      res.status(404).json({ success: false, message: "Sertifikat tidak ditemukan" });
      return;
    }
    db.prepare("DELETE FROM certificates WHERE id = ?").run(existing.id);
    recordAudit("Admin", "DELETE_CERTIFICATE", `Deleted certificate ${existing.verification_code} (${existing.student_name})`);
    broadcastEvent("certificate:deleted", { id: existing.id, verificationCode: existing.verification_code });
    res.json({
      success: true,
      message: `Sertifikat "${existing.verification_code}" (${existing.student_name}) berhasil dihapus dari arsip!`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.get("/api/v1/audit-logs", (_req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 50").all();
    const formatted = rows.map((r) => ({
      id: r.id,
      actor: r.actor,
      action: r.action,
      details: r.details,
      createdAt: r.created_at
    }));
    res.json({ success: true, data: formatted });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.post("/api/v1/auth/admin-login", (req, res) => {
  try {
    const { password } = req.body;
    if (password === "admin321") {
      recordAudit("Admin", "LOGIN_SUCCESS", "Administrator logged into Admin Hub Studio (Pengelola Penuh)");
      res.json({ success: true, role: "admin", message: "Akses Administrator Penuh (Pengelola Penuh) diverifikasi" });
    } else if (password === "uploader123") {
      recordAudit("Uploader", "LOGIN_SUCCESS", "Uploader logged into Admin Hub Studio (Khusus Upload Game)");
      res.json({ success: true, role: "uploader", message: "Akses Uploader (Khusus Upload Game) diverifikasi" });
    } else {
      recordAudit("Anonymous", "LOGIN_FAILED", "Gagal verifikasi kata sandi admin/uploader");
      res.status(401).json({ success: false, message: "Kata sandi salah! Gunakan sandi admin321 (Pengelola Penuh) atau uploader123 (Upload Game)." });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
function parseDeviceInfo(uaString) {
  const ua = uaString || "";
  let deviceType = "Desktop PC";
  let deviceModel = "Komputer / Laptop";
  const isTablet = /iPad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk/i.test(ua);
  const isMobile = /Mobile|iPhone|Android.*Mobile|iPod|BlackBerry|IEMobile|Opera Mini|webOS|Windows Phone/i.test(ua);
  if (isTablet) {
    deviceType = "Tablet";
    if (/iPad/i.test(ua)) deviceModel = "Apple iPad";
    else if (/Android/i.test(ua)) deviceModel = "Android Tablet";
    else deviceModel = "Tablet Layar Sentuh";
  } else if (isMobile) {
    deviceType = "Ponsel (HP)";
    if (/iPhone/i.test(ua)) deviceModel = "Apple iPhone";
    else if (/Samsung|SM-|GT-/i.test(ua)) deviceModel = "Samsung Galaxy";
    else if (/Xiaomi|Redmi|POCO/i.test(ua)) deviceModel = "Xiaomi / Redmi";
    else if (/Oppo|CPH/i.test(ua)) deviceModel = "OPPO Smartphone";
    else if (/Vivo/i.test(ua)) deviceModel = "Vivo Smartphone";
    else if (/Android/i.test(ua)) deviceModel = "Android Smartphone";
    else deviceModel = "Smartphone Seluler";
  } else {
    deviceType = "Desktop PC";
    if (/Macintosh|Mac OS X/i.test(ua)) deviceModel = "Apple Mac / MacBook";
    else if (/Windows/i.test(ua)) deviceModel = "Windows PC / Laptop";
    else if (/Linux/i.test(ua)) deviceModel = "Linux Desktop";
    else deviceModel = "Desktop PC";
  }
  let os2 = "Unknown OS";
  if (/Windows NT 10.0/i.test(ua)) os2 = "Windows 10/11";
  else if (/Windows NT 6.3/i.test(ua)) os2 = "Windows 8.1";
  else if (/Windows NT 6.1/i.test(ua)) os2 = "Windows 7";
  else if (/Android\s([0-9\.]+)/i.test(ua)) {
    const match = ua.match(/Android\s([0-9\.]+)/i);
    os2 = `Android ${match ? match[1] : ""}`.trim();
  } else if (/iPhone OS\s([0-9_]+)/i.test(ua) || /CPU OS\s([0-9_]+)/i.test(ua)) {
    const match = ua.match(/(iPhone|CPU)\sOS\s([0-9_]+)/i);
    os2 = `iOS ${match ? match[2].replace(/_/g, ".") : ""}`.trim();
  } else if (/Mac OS X\s([0-9_]+)/i.test(ua)) {
    const match = ua.match(/Mac OS X\s([0-9_]+)/i);
    os2 = `macOS ${match ? match[1].replace(/_/g, ".") : ""}`.trim();
  } else if (/Linux/i.test(ua)) os2 = "Linux";
  else if (/CrOS/i.test(ua)) os2 = "ChromeOS";
  let browser = "Browser Web";
  if (/Edg\/([0-9\.]+)/i.test(ua)) {
    const m = ua.match(/Edg\/([0-9\.]+)/i);
    browser = `Microsoft Edge ${m ? m[1].split(".")[0] : ""}`.trim();
  } else if (/Chrome\/([0-9\.]+)/i.test(ua) && !/Edg/i.test(ua) && !/OPR/i.test(ua)) {
    const m = ua.match(/Chrome\/([0-9\.]+)/i);
    browser = `Google Chrome ${m ? m[1].split(".")[0] : ""}`.trim();
  } else if (/Safari\/([0-9\.]+)/i.test(ua) && !/Chrome/i.test(ua)) {
    const m = ua.match(/Version\/([0-9\.]+)/i);
    browser = `Safari ${m ? m[1].split(".")[0] : ""}`.trim();
  } else if (/Firefox\/([0-9\.]+)/i.test(ua)) {
    const m = ua.match(/Firefox\/([0-9\.]+)/i);
    browser = `Mozilla Firefox ${m ? m[1].split(".")[0] : ""}`.trim();
  } else if (/OPR\/([0-9\.]+)/i.test(ua) || /Opera/i.test(ua)) {
    browser = "Opera Browser";
  } else if (/SamsungBrowser\/([0-9\.]+)/i.test(ua)) {
    browser = "Samsung Internet";
  }
  return { deviceType, deviceModel, browser, os: os2 };
}
function resolveClientLocation(req, clientTz) {
  const cfCountry = req.headers["cf-ipcountry"];
  const gcpCountry = req.headers["x-appengine-country"] || req.headers["x-country-code"];
  const code = (cfCountry || gcpCountry || "").toUpperCase();
  const countryNames = {
    ID: "Indonesia",
    SG: "Singapura",
    MY: "Malaysia",
    TH: "Thailand",
    VN: "Vietnam",
    PH: "Filipina",
    US: "Amerika Serikat",
    AU: "Australia",
    JP: "Jepang",
    KR: "Korea Selatan",
    TW: "Taiwan",
    CN: "Tiongkok",
    IN: "India",
    GB: "Inggris",
    DE: "Jerman",
    NL: "Belanda"
  };
  if (code && countryNames[code]) {
    return { country: countryNames[code], code, city: req.headers["x-appengine-city"] || "Online" };
  }
  if (clientTz) {
    if (clientTz.includes("Jakarta") || clientTz.includes("Makassar") || clientTz.includes("Jayapura") || clientTz.includes("Pontianak") || clientTz.includes("Asia/Jakarta")) {
      return { country: "Indonesia", code: "ID", city: clientTz.split("/")[1] || "Indonesia" };
    }
    if (clientTz.includes("Singapore")) return { country: "Singapura", code: "SG", city: "Singapore" };
    if (clientTz.includes("Kuala_Lumpur")) return { country: "Malaysia", code: "MY", city: "Kuala Lumpur" };
    if (clientTz.includes("Bangkok")) return { country: "Thailand", code: "TH", city: "Bangkok" };
    if (clientTz.includes("Tokyo")) return { country: "Jepang", code: "JP", city: "Tokyo" };
  }
  return { country: "Indonesia", code: "ID", city: "Nusantara" };
}
app.post("/api/v1/analytics/game-access", (req, res) => {
  try {
    const { gameId, gameTitle, gameCategory, user, clientInfo } = req.body;
    if (!gameTitle) {
      res.status(400).json({ success: false, message: "gameTitle wajib disertakan" });
      return;
    }
    const uaString = req.headers["user-agent"] || "";
    const { deviceType, deviceModel, browser, os: os2 } = parseDeviceInfo(uaString);
    const { country, code: countryCode, city } = resolveClientLocation(req, clientInfo?.timezone);
    const forwarded = req.headers["x-forwarded-for"];
    const ipAddress = (typeof forwarded === "string" ? forwarded.split(",")[0].trim() : req.headers["x-real-ip"]) || req.socket.remoteAddress || "127.0.0.1";
    const userId = user?.id || null;
    const userName = user?.name ? user.name.trim() : "Tamu / Pengunjung Tanpa Login";
    const userRole = user?.role || (user?.id ? "member" : "tamu");
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
      gameCategory || "Umum",
      userId,
      userName,
      userRole,
      ipAddress,
      deviceType,
      deviceModel,
      browser,
      os2,
      screenRes,
      country,
      countryCode,
      city,
      uaString.slice(0, 255)
    );
    if (gameId) {
      db.prepare("UPDATE games SET players = players + 1 WHERE id = ?").run(gameId);
    }
    broadcastEvent("stats:updated", { gameId: gameId || null, gameTitle });
    res.json({
      success: true,
      logId: info.lastInsertRowid,
      detected: { deviceType, deviceModel, browser, os: os2, country, ipAddress }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.post("/api/v1/analytics/game-heartbeat", (req, res) => {
  try {
    const { logId, durationSeconds, completed } = req.body;
    if (!logId) {
      res.status(400).json({ success: false, message: "logId wajib disertakan" });
      return;
    }
    if (completed) {
      db.prepare("UPDATE game_access_logs SET duration_seconds = ?, completed = 1 WHERE id = ?").run(durationSeconds || 0, logId);
      broadcastEvent("stats:updated", { logId, completed: true });
    } else {
      db.prepare("UPDATE game_access_logs SET duration_seconds = ? WHERE id = ?").run(durationSeconds || 0, logId);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.get("/api/v1/analytics/stats", (_req, res) => {
  try {
    const totalAccess = db.prepare("SELECT COUNT(*) as count FROM game_access_logs").get().count;
    const uniqueIps = db.prepare("SELECT COUNT(DISTINCT ip_address) as count FROM game_access_logs").get().count;
    const registeredUsersCount = db.prepare("SELECT COUNT(*) as count FROM game_access_logs WHERE user_role != 'tamu'").get().count;
    const guestUsersCount = db.prepare("SELECT COUNT(*) as count FROM game_access_logs WHERE user_role = 'tamu'").get().count;
    const completedGamesCount = db.prepare("SELECT COUNT(*) as count FROM game_access_logs WHERE completed = 1").get().count;
    const mobileCount = db.prepare("SELECT COUNT(*) as count FROM game_access_logs WHERE device_type LIKE '%Ponsel%'").get().count;
    const tabletCount = db.prepare("SELECT COUNT(*) as count FROM game_access_logs WHERE device_type LIKE '%Tablet%'").get().count;
    const desktopCount = db.prepare("SELECT COUNT(*) as count FROM game_access_logs WHERE device_type LIKE '%Desktop%'").get().count;
    const browsers = db.prepare(`
      SELECT browser as name, COUNT(*) as count
      FROM game_access_logs
      GROUP BY browser
      ORDER BY count DESC
      LIMIT 6
    `).all();
    const operatingSystems = db.prepare(`
      SELECT os as name, COUNT(*) as count
      FROM game_access_logs
      GROUP BY os
      ORDER BY count DESC
      LIMIT 6
    `).all();
    const countries = db.prepare(`
      SELECT country as name, country_code as code, COUNT(*) as count
      FROM game_access_logs
      GROUP BY country, country_code
      ORDER BY count DESC
      LIMIT 8
    `).all();
    const topGames = db.prepare(`
      SELECT game_title as title, COUNT(*) as count
      FROM game_access_logs
      GROUP BY game_title
      ORDER BY count DESC
      LIMIT 8
    `).all();
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
          desktop: desktopCount
        },
        browsers,
        operatingSystems,
        countries,
        topGames
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.get("/api/v1/analytics/logs", (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const device = typeof req.query.device === "string" ? req.query.device.trim() : "";
    let query = "SELECT * FROM game_access_logs";
    const params = [];
    const conditions = [];
    if (search) {
      conditions.push("(game_title LIKE ? OR user_name LIKE ? OR ip_address LIKE ? OR country LIKE ?)");
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (device) {
      conditions.push("device_type LIKE ?");
      params.push(`%${device}%`);
    }
    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    query += " ORDER BY id DESC LIMIT ?";
    params.push(limit);
    const rows = db.prepare(query).all(...params);
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
      createdAt: r.created_at
    }));
    res.json({ success: true, data: formatted });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.delete("/api/v1/analytics/logs", (req, res) => {
  try {
    const { password } = req.body;
    if (password !== "admin321") {
      recordAudit("Anonymous", "CLEAR_ACCESS_LOGS_DENIED", "Percobaan hapus log akses dengan kata sandi salah");
      res.status(403).json({ success: false, message: "Kata sandi salah! Pembersihan log dibatalkan." });
      return;
    }
    db.prepare("DELETE FROM game_access_logs").run();
    recordAudit("Admin", "CLEAR_ACCESS_LOGS", "Membersihkan seluruh data log akses game pengguna");
    broadcastEvent("stats:updated", { logsCleared: true });
    res.json({ success: true, message: "Seluruh riwayat log akses pengguna berhasil dibersihkan!" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
function createDbSnapshotFile(targetPath) {
  if (fs2.existsSync(targetPath)) {
    fs2.unlinkSync(targetPath);
  }
  const escaped = targetPath.replace(/'/g, "''");
  try {
    db.exec(`VACUUM INTO '${escaped}'`);
  } catch {
    fs2.copyFileSync(DB_PATH, targetPath);
  }
}
function createSafetySnapshotInBackupDir(prefix = "portal_game_backup") {
  if (!fs2.existsSync(BACKUP_DIR)) {
    fs2.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  const filename = `${prefix}_${formatSnapshotTimestamp()}.db`;
  const fullPath = path2.join(BACKUP_DIR, filename);
  createDbSnapshotFile(fullPath);
  return filename;
}
function buildCurrentBackupPayload() {
  const games = db.prepare("SELECT * FROM games ORDER BY id ASC").all().map((g) => ({
    id: g.id,
    title: g.title,
    slug: g.slug,
    category: g.category,
    difficulty: g.difficulty,
    type: g.type,
    rating: g.rating,
    players: g.players,
    thumbnail: g.thumbnail || "",
    icon: g.icon || "",
    description: g.description || "",
    isPremium: Boolean(g.is_premium),
    isActive: g.is_active === void 0 || g.is_active === null ? true : Boolean(g.is_active),
    html5Code: g.html5_code || "",
    url: g.url || "",
    status: g.status || "published",
    featured: Boolean(g.featured)
  }));
  const categories = db.prepare("SELECT * FROM categories ORDER BY sort_order ASC, id ASC").all().map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    icon: c.icon,
    sortOrder: c.sort_order ?? 0,
    status: c.status ?? 1
  }));
  const settingsRows = db.prepare("SELECT key, value FROM site_settings").all();
  const siteSettings = {};
  settingsRows.forEach((s) => {
    siteSettings[s.key] = s.value;
  });
  const certificates = db.prepare("SELECT * FROM certificates ORDER BY created_at ASC").all().map((c) => ({
    id: c.id,
    studentName: c.student_name,
    module: c.module,
    institution: c.institution,
    date: c.date,
    certificateNumber: c.certificate_number,
    verificationCode: c.verification_code,
    isActive: c.is_active === 0 || c.status === "inactive" ? false : true,
    status: c.is_active === 0 || c.status === "inactive" ? "inactive" : "active"
  }));
  const testimonials = db.prepare("SELECT * FROM testimonials ORDER BY id ASC").all().map((t) => ({
    name: t.name,
    role: t.role,
    game: t.game,
    rating: t.rating,
    message: t.message,
    status: t.status
  }));
  const licenses = db.prepare("SELECT * FROM licenses ORDER BY id ASC").all().map((l) => ({
    schoolName: l.school_name,
    plan: l.plan,
    status: l.status,
    expiresDate: l.expires_date,
    licenseKey: l.license_key
  }));
  const leaderboard = db.prepare("SELECT * FROM leaderboard ORDER BY id ASC").all().map((lb) => ({
    userName: lb.user_name,
    userEmail: lb.user_email || "",
    avatar: lb.avatar || "",
    gameTitle: lb.game_title,
    score: lb.score,
    xpEarned: lb.xp_earned,
    badge: lb.badge || "Sahabat Pemula Dharma",
    school: lb.school || ""
  }));
  const users = db.prepare("SELECT id, name, email, avatar, xp, badge, level, school, role FROM users ORDER BY created_at ASC").all().map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    avatar: u.avatar || "",
    xp: u.xp ?? 100,
    badge: u.badge || "Sahabat Pemula Dharma",
    level: u.level ?? 1,
    school: u.school || "",
    role: u.role || "user"
  }));
  const payload = {
    version: "1.0",
    exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
    data: {
      games,
      categories,
      siteSettings,
      certificates,
      testimonials,
      licenses,
      leaderboard,
      users
    }
  };
  return {
    ...payload,
    counts: summarizeBackupPayload(parseBackupPayload(payload))
  };
}
function readBackupDataFromSqliteFile(sqliteFilePath) {
  const extDb = new DatabaseSync2(sqliteFilePath, { readOnly: true });
  try {
    const tableRows = extDb.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all();
    const tables = new Set(tableRows.map((t) => t.name));
    const safeAll = (table, cols = "*") => {
      if (!tables.has(table)) return [];
      return extDb.prepare(`SELECT ${cols} FROM ${table}`).all();
    };
    const rawUsers = tables.has("users") ? extDb.prepare("SELECT id, name, email, avatar, xp, badge, level, school, role FROM users").all() : [];
    return parseBackupPayload({
      data: {
        games: safeAll("games"),
        categories: safeAll("categories"),
        siteSettings: safeAll("site_settings"),
        certificates: safeAll("certificates"),
        testimonials: safeAll("testimonials"),
        licenses: safeAll("licenses"),
        leaderboard: safeAll("leaderboard"),
        users: rawUsers
      }
    });
  } finally {
    extDb.close();
  }
}
function executeNormalizedBackupImport(parsed, mode, sourceLabel) {
  const safetySnapshot = createSafetySnapshotInBackupDir(`pre-${mode}`);
  db.exec("BEGIN IMMEDIATE");
  try {
    if (mode === "replace") {
      db.prepare("DELETE FROM games").run();
      db.prepare("DELETE FROM categories").run();
      db.prepare("DELETE FROM certificates").run();
      db.prepare("DELETE FROM testimonials").run();
      db.prepare("DELETE FROM licenses").run();
      db.prepare("DELETE FROM leaderboard").run();
    }
    for (const cat of parsed.categories) {
      const existingCats = db.prepare("SELECT id, name FROM categories").all();
      const { matchedCategory } = resolveCategoryMatch(cat.name, existingCats);
      if (matchedCategory && matchedCategory.id !== void 0) {
        db.prepare("UPDATE categories SET icon = ?, sort_order = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(cat.icon || "fa-seedling", cat.sortOrder, cat.status, matchedCategory.id);
      } else {
        db.prepare("INSERT INTO categories (name, slug, icon, sort_order, status) VALUES (?, ?, ?, ?, ?)").run(cat.name, cat.slug, cat.icon || "fa-seedling", cat.sortOrder, cat.status);
      }
    }
    for (const game of parsed.games) {
      const syncedCategory = ensureSynchronizedCategory(game.category, void 0, false);
      const existingGame = db.prepare("SELECT id, players FROM games WHERE LOWER(title) = LOWER(?) AND LOWER(category) = LOWER(?)").get(game.title, syncedCategory);
      if (existingGame) {
        const mergedPlayers = Math.max(Number(existingGame.players || 0), game.players);
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
          game.thumbnail,
          game.icon,
          game.description,
          game.isPremium ? 1 : 0,
          game.isActive ? 1 : 0,
          game.html5Code,
          game.url,
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
    const upsertSetting = db.prepare(`
      INSERT INTO site_settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `);
    for (const [k, v] of Object.entries(parsed.siteSettings)) {
      if (v !== void 0) {
        upsertSetting.run(k, String(v));
      }
    }
    for (const cert of parsed.certificates) {
      const existingCert = db.prepare("SELECT id FROM certificates WHERE id = ? OR verification_code = ?").get(cert.id, cert.verificationCode);
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
    for (const testi of parsed.testimonials) {
      const dup = db.prepare("SELECT id FROM testimonials WHERE LOWER(name) = LOWER(?) AND LOWER(game) = LOWER(?) AND message = ?").get(testi.name, testi.game, testi.message);
      if (!dup) {
        db.prepare(`
          INSERT INTO testimonials (name, role, game, rating, message, status)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(testi.name, testi.role, testi.game, testi.rating, testi.message, testi.status);
      }
    }
    for (const lic of parsed.licenses) {
      const existingLic = db.prepare("SELECT id FROM licenses WHERE license_key = ?").get(lic.licenseKey);
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
    for (const lb of parsed.leaderboard) {
      const dup = db.prepare("SELECT id FROM leaderboard WHERE LOWER(user_name) = LOWER(?) AND LOWER(game_title) = LOWER(?) AND score = ?").get(lb.userName, lb.gameTitle, lb.score);
      if (!dup) {
        db.prepare(`
          INSERT INTO leaderboard (user_name, user_email, avatar, game_title, score, xp_earned, badge, school)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(lb.userName, lb.userEmail, lb.avatar, lb.gameTitle, lb.score, lb.xpEarned, lb.badge, lb.school);
      }
    }
    for (const u of parsed.users) {
      const existingUser = db.prepare("SELECT id FROM users WHERE id = ? OR LOWER(email) = LOWER(?)").get(u.id, u.email);
      if (existingUser) {
        db.prepare(`
          UPDATE users SET name = ?, avatar = ?, xp = ?, badge = ?, level = ?, school = ?, role = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(u.name, u.avatar, u.xp, u.badge, u.level, u.school, u.role, existingUser.id);
      } else {
        db.prepare(`
          INSERT INTO users (id, name, email, avatar, xp, badge, level, school, role, password)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(u.id, u.name, u.email, u.avatar, u.xp, u.badge, u.level, u.school, u.role, "dharma123");
      }
    }
    db.exec("COMMIT");
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
    }
    throw err;
  }
  const importedCounts = summarizeBackupPayload(parsed);
  recordAudit(
    "Admin",
    "IMPORT_BACKUP",
    `Import backup (${mode}) dari ${sourceLabel}: ${importedCounts.games} game, ${importedCounts.categories} kategori, ${importedCounts.certificates} sertifikat. Snapshot pengaman: ${safetySnapshot}`
  );
  broadcastEvent("backup:imported", { mode, imported: importedCounts, safetySnapshot });
  return {
    safetySnapshot,
    imported: importedCounts
  };
}
app.get("/api/v1/backup/export", (req, res) => {
  try {
    const payload = buildCurrentBackupPayload();
    if (req.query.download === "1") {
      const filename = `portal_game_backup_${formatSnapshotTimestamp()}.json`;
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.send(JSON.stringify(payload, null, 2));
      return;
    }
    res.json({ success: true, data: payload });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.get("/api/v1/backup/export-db", (_req, res) => {
  const filename = `portal_game_backup_${formatSnapshotTimestamp()}.db`;
  const tempPath = path2.join(os.tmpdir(), filename);
  try {
    createDbSnapshotFile(tempPath);
    res.download(tempPath, filename, () => {
      try {
        if (fs2.existsSync(tempPath)) fs2.unlinkSync(tempPath);
      } catch {
      }
    });
  } catch (error) {
    try {
      if (fs2.existsSync(tempPath)) fs2.unlinkSync(tempPath);
    } catch {
    }
    res.status(500).json({ success: false, message: error.message });
  }
});
app.get("/api/v1/backup/snapshots", (_req, res) => {
  try {
    if (!fs2.existsSync(BACKUP_DIR)) {
      res.json({ success: true, data: [] });
      return;
    }
    const files = fs2.readdirSync(BACKUP_DIR).filter((f) => f.endsWith(".db")).map((filename) => {
      const stats = fs2.statSync(path2.join(BACKUP_DIR, filename));
      return {
        filename,
        sizeBytes: stats.size,
        createdAt: stats.mtime.toISOString()
      };
    }).sort((a, b) => a.createdAt < b.createdAt ? 1 : -1);
    res.json({ success: true, data: files });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.post("/api/v1/backup/snapshots", (_req, res) => {
  try {
    const filename = createSafetySnapshotInBackupDir("portal_game_backup");
    const stats = fs2.statSync(path2.join(BACKUP_DIR, filename));
    recordAudit("Admin", "CREATE_SNAPSHOT", `Membuat snapshot backup server: ${filename}`);
    res.json({
      success: true,
      message: `Snapshot server "${filename}" berhasil dibuat!`,
      data: {
        filename,
        sizeBytes: stats.size,
        createdAt: stats.mtime.toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.get("/api/v1/backup/snapshots/:filename/download", (req, res) => {
  try {
    const rawName = String(req.params.filename || "");
    const safeName = path2.basename(rawName);
    if (!safeName || safeName !== rawName || !safeName.endsWith(".db")) {
      res.status(400).json({ success: false, message: "Nama berkas snapshot tidak valid" });
      return;
    }
    const fullPath = path2.join(BACKUP_DIR, safeName);
    if (!fs2.existsSync(fullPath)) {
      res.status(404).json({ success: false, message: "Berkas snapshot tidak ditemukan" });
      return;
    }
    res.download(fullPath, safeName);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.post("/api/v1/backup/import", (req, res) => {
  try {
    const mode = req.body?.mode === "replace" ? "replace" : "merge";
    const rawPayload = req.body?.payload;
    if (rawPayload === void 0 || rawPayload === null) {
      res.status(400).json({ success: false, message: "Payload JSON backup tidak boleh kosong." });
      return;
    }
    const parsed = parseBackupPayload(rawPayload);
    const result = executeNormalizedBackupImport(parsed, mode, "File/Teks JSON");
    res.json({
      success: true,
      message: `Import backup (${mode === "replace" ? "Ganti Total" : "Gabungkan"}) berhasil! ${result.imported.games} game & ${result.imported.categories} kategori disinkronkan.`,
      mode,
      safetySnapshot: result.safetySnapshot,
      imported: result.imported
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});
app.post("/api/v1/backup/import-db", (req, res) => {
  const mode = req.body?.mode === "replace" ? "replace" : "merge";
  const fileName = String(req.body?.fileName || "uploaded.db");
  const base64Data = String(req.body?.base64Data || "");
  if (!base64Data) {
    res.status(400).json({ success: false, message: "Berkas SQLite (.db) kosong." });
    return;
  }
  const cleanedBase64 = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;
  const buffer = Buffer.from(cleanedBase64, "base64");
  if (!isValidSqliteHeader(buffer)) {
    res.status(400).json({
      success: false,
      message: "Berkas bukan file database SQLite (.db) yang valid."
    });
    return;
  }
  const tempPath = path2.join(os.tmpdir(), `import_db_${Date.now()}_${Math.floor(Math.random() * 1e3)}.db`);
  try {
    fs2.writeFileSync(tempPath, buffer);
    const parsed = readBackupDataFromSqliteFile(tempPath);
    const result = executeNormalizedBackupImport(parsed, mode, `SQLite (${path2.basename(fileName)})`);
    res.json({
      success: true,
      message: `Restore file .db (${mode === "replace" ? "Ganti Total" : "Gabungkan"}) berhasil! ${result.imported.games} game & ${result.imported.categories} kategori disinkronkan.`,
      mode,
      safetySnapshot: result.safetySnapshot,
      imported: result.imported
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  } finally {
    try {
      if (fs2.existsSync(tempPath)) fs2.unlinkSync(tempPath);
    } catch {
    }
  }
});
app.post("/api/v1/backup/snapshots/:filename/restore", (req, res) => {
  try {
    const rawName = String(req.params.filename || "");
    const safeName = path2.basename(rawName);
    if (!safeName || safeName !== rawName || !safeName.endsWith(".db")) {
      res.status(400).json({ success: false, message: "Nama berkas snapshot tidak valid" });
      return;
    }
    const fullPath = path2.join(BACKUP_DIR, safeName);
    if (!fs2.existsSync(fullPath)) {
      res.status(404).json({ success: false, message: "Berkas snapshot tidak ditemukan" });
      return;
    }
    const mode = req.body?.mode === "replace" ? "replace" : "merge";
    const parsed = readBackupDataFromSqliteFile(fullPath);
    const result = executeNormalizedBackupImport(parsed, mode, `Snapshot (${safeName})`);
    res.json({
      success: true,
      message: `Snapshot "${safeName}" berhasil dipulihkan (${mode === "replace" ? "Ganti Total" : "Gabungkan"})!`,
      mode,
      safetySnapshot: result.safetySnapshot,
      imported: result.imported
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path2.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path2.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Pusat Games Buddhis] Server running at http://0.0.0.0:${PORT}`);
  });
}
startServer().catch((err) => {
  console.error("Fatal server start error:", err);
});
export {
  broadcastEvent
};
