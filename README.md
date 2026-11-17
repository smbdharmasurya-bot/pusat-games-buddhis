# PUSAT GAMES BUDDHIS
## Centralized Full-Stack Buddhist Educational Game Platform

**Pusat Games Buddhis** adalah platform permainan edukasi Buddhis modern yang dirancang untuk pembelajaran Dharma interaktif di sekolah dan vihara. Platform ini telah direfaktor dari arsitektur single-client HTML5/localStorage menjadi sistem **Full-Stack dengan Database Relasional Terpusat (SQL Database as Single Source of Truth)**, dilengkapi **Real-Time Leaderboard System**, **Admin Hub Studio Pro**, **Sistem XP & Gelar Kebijaksanaan**, dan **Verifikasi Sertifikat Digital**.

---

## 🌟 Fitur Utama

1. **Database Relasional Terpusat (SQL Engine)**
   - Semua data permainan, kategori kurikulum, skor leaderboard, lisensi, sertifikat, dan pengaturan situs tersimpan permanen di database SQL server.
   - Tidak ada lagi risiko data hilang saat cache/localStorage browser dibersihkan.
   - Perubahan yang dilakukan Admin di Komputer A langsung tersimpan dan dapat diakses dari Komputer B secara real-time.

2. **Real-Time Leaderboard System (Papan Peringkat Terkini)**
   - Podium Juara Top 3 (Emas Paramita, Perak Bodhi, Perunggu Teratai) dengan animasi mahkota dan lencana kehormatan.
   - Sinkronisasi real-time instan menggunakan **Server-Sent Events (SSE)**: pembaruan skor dari pemain di mana saja langsung memicu kalkulasi ulang peringkat secara otomatis tanpa reload halaman.
   - Filter periode (Sepanjang Waktu, Mingguan, Bulanan) dan pencarian instan nama siswa atau sekolah/vihara.
   - Tombol pengujian live ("Uji Kirim Skor Baru") untuk verifikasi broadcast instan.

3. **Katalog Permainan & Filter Kurikulum Interaktif**
   - Mendukung 14 kategori kurikulum Buddhis resmi (Sejarah Buddha, Riwayat Pangeran Siddhartha, Empat Kebenaran Mulia, Delapan Jalan Mulia, Pancasila Buddhis, Tripitaka, Meditasi, dll).
   - Filter multi-dimensi berdasarkan topik, tingkat kesulitan (Mudah, Sedang, Sangat Sulit), dan engine game.

4. **Multi-Engine Game Player**
   - **Kuis Interaktif Dharma**: Pilihan ganda bertahap, streak multiplier, Web Audio chimes, dan penjelasan kontekstual.
   - **Memory Card Match**: Mengasah konsentrasi dengan simbol suci Buddhis (🪷 Teratai, ☸️ Dharmachakra, 🔔 Ghanta, 📜 Sutta, 🕯️ Lilin Altar, 🍃 Daun Bodhi).
   - **Standalone Portable HTML5 Game**: Menjalankan paket game HTML5 mandiri di dalam container iframe terisolasi dengan atribut sandbox yang aman.

5. **Admin Hub Studio Pro**
   - Dilindungi gerbang otentikasi kata sandi server (`admin321`).
   - **Tab 1: Dashboard & Log Audit**: Pemantauan jejak aktivitas administrator server.
   - **Tab 2: Katalog Permainan**: Tambah, edit, hapus, toggle akses PRO/Gratis, dan reset counter pemain.
   - **Tab 3: Upload Game Portable**: Unggah file paket `.html`, `.json`, `.js` beserta thumbnail sampul game.
   - **Tab 4: Kelola Kategori & Ikon**: Tambah kategori baru dengan upload file `.ico` / `.webp` / `.png` atau kode ikon FontAwesome.
   - **Tab 5: Pengaturan Hero & Stupa**: Kustomisasi judul banner, teks mutiara Dharma, emoji teratai, dan upload hiasan stupa/candi Borobudur.
   - **Tab 6: Moderasi Testimoni**: Menyetujui atau menolak ulasan dari guru dan siswa sebelum tampil di publik.
   - **Tab 7: Lisensi & Sertifikat**: Manajemen lisensi SaaS sekolah/vihara dan penerbitan sertifikat digital resmi.

6. **Verifikasi Sertifikat Siswa Mandiri**
   - Pemeriksaan keaslian sertifikat kelulusan modul Dharma menggunakan kode unik verifikasi (contoh: `CERT-2026-001`).

7. **Desain Modern & Responsif (Frontend Design Constitution)**
   - Mengikuti disiplin *Zero-Pill Metadata*: metadata ditampilkan sebagai teks bersih dengan pemisah tipografis (`·`), bukan tumpukan kapsul pill.
   - Tipografi Cinzel (Judul) dipadukan dengan Plus Jakarta Sans (Teks isi) dan JetBrains Mono (Angka tabular).
   - Dukungan tema Dark Mode & Light Mode yang konsisten dan nyaman di mata.
   - Audio feedback sintesis Web Audio API (Lonceng Ghanta, denting kuis benar/salah, fanfare kemenangan) tanpa ketergantungan file eksternal yang rentan 404.

---

## 🚀 Panduan Menjalankan Aplikasi

### 1. Prasyarat
- Node.js versi 20+ atau 22+ (rekomendasi LTS).

### 2. Instalasi & Menjalankan
```bash
# Instal dependensi
npm install

# Jalankan dalam mode pengembangan (Full-stack Express + Vite)
npm run dev

# Buka browser pada
http://localhost:3000
```

### 3. Unit Testing (Ultra Mode)
Untuk menguji logika perhitungan skor, tiering leaderboard, validasi sertifikat, dan filter game:
```bash
npx --yes tsx --test src/utils/gameLogic.test.ts
```

### 4. Build Produksi
```bash
npm run build
npm start
```

---

## 📚 Dokumentasi Teknis Lengkap

Platform ini dilengkapi dengan dokumentasi arsitektur dan operasional lengkap sesuai standar Master Prompt:

- 🏗️ **[ARCHITECTURE.md](./ARCHITECTURE.md)**: Arsitektur Monolith Full-Stack, diagram relasi data, diagram alur SSE real-time antar-admin, isolasi runtime iframe sandboxed.
- 🗄️ **[DATABASE.md](./DATABASE.md)**: Skema relasional SQLite/PostgreSQL, definisi indeks, konstrain foreign key, seed data, dan pola query transaksi.
- 🔌 **[API.md](./API.md)**: Spesifikasi seluruh endpoint REST API `/api/v1/*` dan streaming event real-time Server-Sent Events (SSE).
- 🚀 **[DEPLOYMENT.md](./DEPLOYMENT.md)**: Panduan instalasi server VPS, konfigurasi Nginx reverse proxy, manajemen proses PM2, sertifikat SSL Let's Encrypt, dan hosting subdomain sekolah (`games.namasekolah.com`).
- 🛡️ **[SECURITY.md](./SECURITY.md)**: Matriks peran & hak akses (RBAC), pencegahan injeksi SQL, isolasi keamanan game portable, dan pencatatan audit log.
- 🔄 **[MIGRATION.md](./MIGRATION.md)**: Prosedur pemetaan dan migrasi data lama dari browser `localStorage` ke SQL database terpusat.

---

## 🛠️ Skrip Utilitas & Pemeliharaan

- `node scripts/backup-database.js` – Membuat snapshot cadangan berkas database SQL dengan stempel waktu otomatis.
- `node scripts/restore-database.js <file.db>` – Memulihkan database dari snapshot cadangan dengan proteksi backup pengaman.
- `node scripts/migrate-localstorage.js <dump.json>` – Mengimpor data dump JSON dari versi portal lawas langsung ke database server.
