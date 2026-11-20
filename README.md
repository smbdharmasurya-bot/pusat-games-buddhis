# PUSAT GAMES BUDDHIS

**Pusat Games Buddhis** adalah platform edukasi permainan digital full-stack berbasis **React 19 + TypeScript + Tailwind CSS + Express + SQLite (`node:sqlite`)** dengan database relasional terpusat (*Single Source of Truth*), sinkronisasi real-time antar komputer melalui **Server-Sent Events (SSE)**, **Lazy Loading Halaman (Route-based Code Splitting)** & **Scroll-based Lazy Loading**, **Perlindungan Data Baseline Dinamis**, serta **Pemantauan Akses Pengguna Global**.

---

## Fitur Utama

### 1. Optimasi Performa Web: Lazy Loading & Code Splitting
- **Route-based Code Splitting (`React.lazy` + `<Suspense>`)**: Halaman rute (`#/games`, `#/featured`, `#/leaderboard`, `#/testimonials`) serta modal berukuran besar (`AdminHubModal`, `GamePlayerModal`, `AuthModal`, `CertificateVerifierModal`) dipecah menjadi berkas *chunk* JavaScript terpisah. Browser hanya mengunduh modul yang benar-benar dibuka pengguna.
- **Scroll-based Lazy Loading (`IntersectionObserver`)**: Bagian halaman di bawah lipatan layar (*below-the-fold*, seperti etalase *Permainan Edukasi Pilihan Terbaik* dan banner *Papan Peringkat*) baru dimuat ketika pengguna menggulir mendekati bagian tersebut (`LazySection`).
- **Lazy Image & Binary Media Proxy**: Thumbnail game dan logo Hero disimpan aman di database SQLite dan disajikan melalui endpoint biner ringan (`/api/v1/games/:id/thumbnail`, `/api/v1/games/:id/icon`, `/api/v1/settings/hero-image`) dengan atribut `loading="lazy"` dan `decoding="async"`.
- **On-Demand HTML5 Game Loading**: Daftar katalog `/api/v1/games` hanya memuat metadata ringan (~2–5 KB), sedangkan kode permainan HTML5 lengkap baru diunduh saat pengguna menekan tombol **Mainkan** (`/api/v1/games/:id`).

### 2. Manajemen Kategori Manual & Dinamis
- Kategori permainan **tidak lagi menggunakan preset statis bawaan** — seluruh kategori diisi dan dikelola secara **manual** sesuai kebutuhan sekolah, jenjang pendidikan (misalnya `TK`, `SD`, `SMP`), atau topik pembelajaran.
- Pengelola dapat menambah, mengedit, menghapus, atau mengunggah ikon kustom (`.ico`, `.webp`, `.png`) melalui **Admin Hub → Kelola Kategori**, atau membuat kategori baru langsung saat mengunggah permainan baru.
- Perubahan nama kategori atau judul game otomatis tersinkronisasi ke seluruh permainan, papan peringkat, log akses, dan dropdown ulasan pengguna.

### 3. Database SQL Terpusat & Sinkronisasi Real-Time Multi-Komputer
- Semua data (permainan, kategori manual, pengguna, papan peringkat, testimoni, lisensi, sertifikat, pengaturan Hero, log akses global, dan log audit) tersimpan terpusat di SQLite (`data/portal_game.db`).
- Perubahan dari komputer atau perangkat mana pun melalui jaringan internet langsung dipancarkan ke seluruh pengguna aktif melalui **Server-Sent Events (`/api/v1/realtime/stream`)**, didukung pemeriksaan revisi berkala (`/api/v1/sync/state`) saat tab kembali aktif atau koneksi pulih.

### 4. Perlindungan Data Baseline Dinamis & Akses Global
- **Baseline Dinamis Berkembang**: Snapshot baseline otomatis (`data/backups/auto-baseline_*.db`) terus berkembang maju (*forward-only*) mengikuti setiap kunjungan pengguna dari seluruh dunia, sesi permainan baru, pencatatan skor, testimoni, serta unggahan/pembaruan game — tersinkron otomatis **setiap 1 menit (60 detik)** dan setiap terjadi perubahan data.
- **Rekonsiliasi Aman Saat Startup**: Ketika server dinyalakan ulang atau dilakukan pengembangan baru, sistem memastikan data yang sudah terekam pada situs terpublish tidak terhapus dan menggabungkan perkembangan terbaru secara non-destruktif.
- **Deteksi Lokasi Pengunjung Seluruh Dunia**: Mendukung identifikasi negara secara global via header CDN/Proxy, >70 zona waktu IANA, kode bahasa browser, dan 249 kode negara ISO 3166-1 alpha-2, sembari menyaring bot/headless browser agar statistik tetap berisi aktivitas pengguna nyata.

### 5. Multi-Engine Game Player & Pencatatan Skor Otomatis
- Mendukung **Game HTML5 Portable mandiri** (`.html`, `.json`, `.js`) dalam iframe sandbox aman, **Iframe Embed**, **Kuis Interaktif**, dan **Memory Card Match**.
- Skor pemain tercatat otomatis ke **Papan Peringkat Real-Time** ketika permainan selesai maupun ketika pemain menutup jendela permainan, dengan papan peringkat selalu mengikuti daftar permainan aktif terbaru.

### 6. Admin Hub Studio Pro & Peran Akses
- Mendukung peran **Admin (Pengelola Penuh)** dan **Uploader (Pengunggah Game)** serta manajemen akun siswa/guru.
- **Fitur Admin Hub**:
  - **Katalog Permainan**: Kelola game aktif/nonaktif, edit judul, kategori, deskripsi, thumbnail, ikon, dan status PRO/Gratis.
  - **Upload Game**: Unggah paket HTML5 portable (`.html`/`.json`/`.js`) beserta thumbnail, ikon, dan pembuatan kategori manual langsung.
  - **Kelola Kategori**: Tambah, edit, hapus, dan atur ikon kategori manual.
  - **Pengaturan Hero & Logo**: Kustomisasi judul banner, subjudul, dan unggah logo sekolah/vihara.
  - **Moderasi Testimoni**: Setujui/hapus ulasan pengguna dengan pilihan dropdown game aktif.
  - **Lisensi & Arsip Sertifikat**: Kelola lisensi institusi dan penerbitan/verifikasi sertifikat digital.
  - **Kelola Pengguna & Reset/Kelola Skor**: Kelola akun serta atur/reset skor berdasarkan game aktif.
  - **Statistik & Log Akses Real-Time**: Pantau akses pengguna nyata lintas negara, jenis perangkat, browser, serta pembersihan log dummy.
  - **Backup, Restore & Perlindungan Baseline**: Ekspor/impor backup lengkap JSON maupun SQLite (`.db`) dalam mode **Gabungkan (Merge — Aman)** atau **Timpa**, tarik data dari URL situs terpublish, dan kelola snapshot server.
  - **Log Audit Server**: Jejak aktivitas administratif server.

---

## Panduan Instalasi & Menjalankan Aplikasi

### Prasyarat
- **Node.js** versi 22+ (wajib mendukung modul bawaan `node:sqlite`).
- **npm** versi 10+.

### 1. Instalasi Dependensi
```bash
npm install
```

### 2. Menjalankan Mode Pengembangan (Full-Stack Express + Vite)
```bash
npm run dev
```
Server berjalan pada `http://localhost:3000`. Express menangani seluruh endpoint `/api/v1/*` dan SSE real-time, sedangkan Vite menyajikan frontend React secara terintegrasi.

### 3. Menjalankan Unit Test
Menjalankan seluruh rangkaian pengujian unit (`node:test` melalui `tsx`) untuk logika game, sinkronisasi kategori manual, media gambar, sertifikat, backup/restore, sinkronisasi real-time, skor otomatis, perlindungan baseline, log akses global, API response guard, dan routing lazy-loading:
```bash
npm test
```

### 4. Pemeriksaan Tipe TypeScript (Lint)
```bash
npm run lint
```

### 5. Build & Menjalankan Mode Produksi
```bash
# Build frontend (dist/) dengan code-splitting & bundle backend (app.js)
npm run build:all

# Jalankan server produksi (port 3000)
NODE_ENV=production npm run start:prod
```
*(Alternatif menjalankan langsung tanpa bundling backend: `NODE_ENV=production npm start`.)*

---

## Struktur Direktori Utama

```text
├── server.ts                       # Server Express: REST API /api/v1/*, SSE, media biner, & auto-baseline 1 menit
├── src/
│   ├── App.tsx                     # Root SPA: Route-based Code Splitting (React.lazy) & sinkronisasi real-time
│   ├── main.tsx                    # Entry point React
│   ├── types/index.ts              # Definisi tipe TypeScript bersama
│   ├── services/api.ts             # Klien REST API & SSE dengan retry otomatis & validasi JSON aman
│   ├── server/db.ts                # Skema SQLite (node:sqlite), rekonsiliasi baseline dinamis & proteksi data
│   ├── components/
│   │   ├── Navbar.tsx              # Navigasi utama (eager)
│   │   ├── HeroSection.tsx         # Bagian atas beranda & indikator akses global (eager)
│   │   ├── CategoryBar.tsx         # Daftar kategori manual (eager)
│   │   ├── LazySection.tsx         # Wrapper scroll-based lazy loading (IntersectionObserver)
│   │   ├── RouteFallback.tsx       # Skeleton & fallback untuk React.Suspense
│   │   ├── HomeShowcaseSection.tsx # Etalase game & CTA leaderboard (lazy chunk saat scroll)
│   │   ├── CatalogView.tsx         # Rute #/games (lazy chunk)
│   │   ├── FeaturedView.tsx        # Rute #/featured (lazy chunk)
│   │   ├── LeaderboardView.tsx     # Rute #/leaderboard (lazy chunk)
│   │   ├── TestimonialsView.tsx    # Rute #/testimonials (lazy chunk)
│   │   ├── GamePlayerModal.tsx     # Pemutar game on-demand (lazy chunk)
│   │   ├── AdminHubModal.tsx       # Panel Admin Hub Studio Pro (lazy chunk)
│   │   ├── AuthModal.tsx           # Modal masuk/daftar pengguna (lazy chunk)
│   │   └── CertificateVerifierModal.tsx # Verifikasi sertifikat digital (lazy chunk)
│   └── utils/                      # Modul logika murni & file unit test (*.test.ts)
├── data/
│   ├── portal_game.db              # Database SQLite utama (jangan dihapus)
│   └── backups/                    # Snapshot otomatis baseline & snapshot manual (.db)
└── scripts/                        # Utilitas backup, restore, dan migrasi CLI
```

---

## Dokumentasi Teknis Tambahan

- **[ARCHITECTURE.md](./ARCHITECTURE.md)**: Arsitektur full-stack, diagram alur SSE real-time, dan isolasi iframe game.
- **[DATABASE.md](./DATABASE.md)**: Skema tabel SQLite, indeks, dan mekanisme perlindungan baseline dinamis.
- **[API.md](./API.md)**: Daftar endpoint REST API `/api/v1/*` dan event SSE.
- **[DEPLOYMENT.md](./DEPLOYMENT.md)**: Panduan deployment server produksi, reverse proxy, dan HTTPS.
- **[SECURITY.md](./SECURITY.md)**: Kontrol akses peran, keamanan query SQL, dan audit log.
- **[MIGRATION.md](./MIGRATION.md)**: Panduan migrasi data dari format lama ke database SQLite terpusat.

---

## Utilitas Pemeliharaan CLI

- `node scripts/backup-database.js` — Membuat snapshot cadangan database SQLite dengan stempel waktu.
- `node scripts/restore-database.js <file.db>` — Memulihkan database dari berkas snapshot cadangan.
- `node scripts/migrate-localstorage.js <dump.json>` — Mengimpor berkas ekspor JSON lama ke database server.
