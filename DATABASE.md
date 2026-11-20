# DOKUMENTASI DATABASE – PUSAT GAMES BUDDHIS
## Relational Database Schema & Query Reference

Sistem Pusat Games Buddhis dirancang dengan **Database Relasional Terpusat (SQL)** sebagai *Single Source of Truth* untuk menggantikan ketergantungan pada `localStorage` browser.

Implementasi default menggunakan engine bawaan Node.js 22 **`node:sqlite`** dengan file database persisten di `/data/portal_game.db`. Skema ini 100% kompatibel dan siap dimigrasikan ke PostgreSQL/MySQL untuk instalasi skala besar.

---

## 1. Konfigurasi Database Engine

- **Mode Operasi**: SQLite3 via Node 22 `node:sqlite` (`DatabaseSync`).
- **Pragma Optimal**:
  - `PRAGMA journal_mode = WAL;` (Write-Ahead Logging untuk konkurensi tinggi & performa baca-tulis optimal).
  - `PRAGMA foreign_keys = ON;` (Integritas referensial relasi antar-tabel aktif).
  - `PRAGMA synchronous = NORMAL;` (Keseimbangan keamanan durabilitas ACID dan kecepatan I/O disk).
- **Lokasi Berkas**: `/data/portal_game.db` (dapat dikonfigurasi via environment `DB_PATH`).

---

## 2. Struktur Tabel & Skema Relasional

### A. Tabel `categories`
Menyimpan kategori kurikulum Dharma Buddhis beserta metadata ikon tampilan.

```sql
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon_type TEXT DEFAULT 'fa',        -- 'fa' (FontAwesome), 'image' (ICO/WEBP/PNG)
  icon_val TEXT NOT NULL,             -- Kelas fa (mis. 'fa-book-open') atau URL gambar
  color TEXT DEFAULT '#d97706',       -- Warna aksen hex
  display_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_order ON categories(display_order);
```

### B. Tabel `games`
Menyimpan katalog permainan edukasi, kode sumber game portable sandboxed, level kesulitan, dan statistik main.

```sql
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category_slug TEXT NOT NULL,
  engine TEXT NOT NULL,              -- 'quiz', 'memory', 'html5', 'embed'
  difficulty TEXT DEFAULT 'Sedang',  -- 'Mudah', 'Sedang', 'Sulit', 'Sangat Sulit'
  thumbnail TEXT,
  html5_code TEXT,                   -- Berkas HTML5 mandiri untuk eksekusi iframe
  external_url TEXT,
  is_featured INTEGER DEFAULT 0,     -- 1 untuk Unggulan, 0 biasa
  is_premium INTEGER DEFAULT 0,      -- 1 untuk PRO, 0 untuk Gratis
  plays_count INTEGER DEFAULT 0,
  rating REAL DEFAULT 5.0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_slug) REFERENCES categories(slug) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_games_category ON games(category_slug);
CREATE INDEX IF NOT EXISTS idx_games_featured ON games(is_featured);
CREATE INDEX IF NOT EXISTS idx_games_plays ON games(plays_count DESC);
```

### C. Tabel `leaderboard`
Menyimpan rekor skor pemain, XP yang didapat, akurasi, waktu selesai, dan nama institusi/sekolah.

```sql
CREATE TABLE IF NOT EXISTS leaderboard (
  id TEXT PRIMARY KEY,
  player_name TEXT NOT NULL,
  game_id TEXT NOT NULL,
  game_title TEXT NOT NULL,
  score INTEGER NOT NULL,
  xp_earned INTEGER DEFAULT 0,
  time_seconds INTEGER DEFAULT 0,
  accuracy REAL DEFAULT 100.0,
  school_vihara TEXT DEFAULT 'Umum',
  avatar TEXT,
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lb_score ON leaderboard(score DESC);
CREATE INDEX IF NOT EXISTS idx_lb_game ON leaderboard(game_id);
CREATE INDEX IF NOT EXISTS idx_lb_submitted ON leaderboard(submitted_at DESC);
```

### D. Tabel `testimonials`
Menyimpan ulasan dari siswa, guru, dan pembina vihara, dengan mekanisme moderasi administrator.

```sql
CREATE TABLE IF NOT EXISTS testimonials (
  id TEXT PRIMARY KEY,
  author_name TEXT NOT NULL,
  role TEXT NOT NULL,                 -- 'Guru Agama Buddha', 'Siswa SMP', dll.
  school_or_vihara TEXT,
  comment TEXT NOT NULL,
  rating INTEGER DEFAULT 5,
  status TEXT DEFAULT 'pending',     -- 'approved', 'pending', 'rejected'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_testimonials_status ON testimonials(status);
```

### E. Tabel `licenses`
Menyimpan lisensi institusi sekolah atau vihara untuk aktivasi fitur PRO dan verifikasi langganan.

```sql
CREATE TABLE IF NOT EXISTS licenses (
  id TEXT PRIMARY KEY,
  school_name TEXT NOT NULL,
  license_key TEXT UNIQUE NOT NULL,
  tier TEXT DEFAULT 'PRO',           -- 'Basic', 'PRO', 'Enterprise'
  is_active INTEGER DEFAULT 1,
  max_students INTEGER DEFAULT 500,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_licenses_key ON licenses(license_key);
```

### F. Tabel `certificates`
Menyimpan arsip sertifikat digital kelulusan modul pembelajaran dengan kode verifikasi publik.

```sql
CREATE TABLE IF NOT EXISTS certificates (
  id TEXT PRIMARY KEY,
  verification_code TEXT UNIQUE NOT NULL, -- Format: CERT-YYYY-NNN
  student_name TEXT NOT NULL,
  course_name TEXT NOT NULL,
  score INTEGER NOT NULL,
  total_xp INTEGER NOT NULL,
  issue_date TEXT NOT NULL,
  issuer_name TEXT DEFAULT 'Pusat Games Buddhis Indonesia',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_certs_code ON certificates(verification_code);
```

### G. Tabel `site_settings`
Menyimpan konfigurasi beranda, kustomisasi teks hero, ornamen stupa/candi, dan mutiara kata Dharma.

```sql
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### H. Tabel `audit_logs`
Mencatat seluruh tindakan administratif untuk kepatuhan keamanan dan jejak audit sistem.

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  details TEXT,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
```

---

## 3. Inisialisasi & Pengelolaan Data Baseline Dinamis

Database SQLite (`data/portal_game.db`) menggunakan prinsip **Kategori Manual & Perlindungan Baseline Dinamis**:

1. **Kategori Permainan (Diisi Manual)**:
   - Sistem **tidak menyuntikkan 14 kategori kurikulum statis**.
   - Pengelola dapat menambahkan, mengubah, atau menghapus kategori secara manual melalui **Admin Hub → Kelola Kategori** atau secara otomatis tersinkronisasi saat mengunggah permainan baru (misalnya `TK`, `SD`, `SMP`, atau topik pilihan lainnya).

2. **Perlindungan Data Baseline Dinamis**:
   - Seluruh data permainan aktif, kategori manual, skor leaderboard, pengguna, testimoni, logo Hero, dan log akses pengguna global yang sudah terekam dipertahankan dan terus berkembang maju (*forward-only*).
   - Snapshot baseline otomatis (`data/backups/auto-baseline_*.db`) disinkronkan setiap 1 menit dan setiap kali terjadi pembaruan data atau akses pengguna nyata.

3. **Pengaturan Beranda Standar**:
   - `hero_title`: "Pusat Games Buddhis"
   - `hero_subtitle`: "Platform Edukasi Dharma Digital & Game Interaktif Buddhis Indonesia"
   - `hero_dharma_quote`: "Nibbānaṃ paramaṃ sukhaṃ — Ketenangan batin sejati adalah kebahagiaan tertinggi."
   - `stupa_style`: "borobudur"
   - `enable_lotus_effects`: "true"

---

## 4. Pola Query & Transaksi Database

### Transaksi Aman untuk Penambahan Game & Logging
```javascript
const insertGame = db.prepare(`
  INSERT INTO games (id, title, description, category_slug, engine, difficulty, thumbnail, html5_code, external_url, is_featured, is_premium)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertAudit = db.prepare(`
  INSERT INTO audit_logs (id, action, details) VALUES (?, ?, ?)
`);

// Eksekusi atomic
db.exec("BEGIN TRANSACTION;");
try {
  insertGame.run(...gameValues);
  insertAudit.run(auditId, 'GAME_CREATED', `Game "${title}" ditambahkan`);
  db.exec("COMMIT;");
} catch (err) {
  db.exec("ROLLBACK;");
  throw err;
}
```

---

## 5. Prosedur Backup & Restore

### A. Backup Otomatis
```bash
# Membuat salinan snapshot database dengan timestamp
node scripts/backup-database.js
```
Script akan menyalin berkas `/data/portal_game.db` ke `/data/backups/portal_game_YYYY-MM-DD_HH-mm-ss.db` secara non-blocking.

### B. Restore Database
```bash
# Memulihkan database dari snapshot tertentu
node scripts/restore-database.js data/backups/portal_game_2026-11-10_07-00-00.db
```
