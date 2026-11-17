# ARSITEKTUR SISTEM – PUSAT GAMES BUDDHIS
## Centralized Full-Stack Buddhist Educational Game Platform

Dokumen ini menjelaskan arsitektur teknis, desain sistem, aliran data, dan protokol sinkronisasi real-time untuk platform **Pusat Games Buddhis**.

---

## 1. Ikhtisar Arsitektur Tingkat Tinggi

Pusat Games Buddhis mengadopsi arsitektur **Full-Stack Monolith Terpadu** yang memadukan backend Node.js/Express, database relasional SQL persisten (`node:sqlite`), dan frontend reaktif React SPA dengan Tailwind CSS.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          KLIEN BROWSER                                 │
│  ┌──────────────────────┐   ┌───────────────────┐   ┌────────────────┐ │
│  │  Siswa (Gameplay &   │   │ Guru (Katalog &   │   │  Admin Hub     │ │
│  │     Leaderboard)     │   │   Sertifikat)     │   │   Studio Pro   │ │
│  └──────────┬───────────┘   └─────────┬─────────┘   └────────┬───────┘ │
└─────────────┼─────────────────────────┼──────────────────────┼─────────┘
              │                         │                      │
       HTTP REST API             HTTP REST API         HTTP / SSE Stream
      (JSON / Payload)          (JSON / Payload)      (Real-time Broadcast)
              │                         │                      │
┌─────────────▼─────────────────────────▼──────────────────────▼─────────┐
│                      SERVER APPLICATION (Node.js)                      │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ Express Server (`server.ts`) - Port 3000                       │   │
│   │                                                                │   │
│   │  • Middleware: CORS, JSON parser (50MB), Cookie & Security     │   │
│   │  • Router API: `/api/v1/games`, `/api/v1/categories`, dll.     │   │
│   │  • Real-Time Hub: SSE Event Stream (`/api/v1/realtime/stream`) │   │
│   │  • Static & Game Assets Proxy Handler                          │   │
│   │  • Vite Middleware (Dev Mode) / Static Serve (Prod Mode)       │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
│                                   │                                    │
│   ┌───────────────────────────────▼────────────────────────────────┐   │
│   │ Database Layer (`src/server/db.ts`)                            │   │
│   │  • Engine: Built-in `node:sqlite` DatabaseSync                 │   │
│   │  • Relational Schema, Indexes, Prepared Statements             │   │
│   │  • WAL Mode (Write-Ahead Logging) & Foreign Key Constraints    │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
└───────────────────────────────────┼────────────────────────────────────┘
                                    │
                      ┌─────────────▼─────────────┐
                      │    STORAGE PERSISTEN      │
                      │  • `/data/portal_game.db` │
                      │  • Uploaded Sandboxed     │
                      │    Game Files & Assets    │
                      └───────────────────────────┘
```

---

## 2. Diagram Komunikasi Frontend-Backend-Database

Aliran pertukaran data standar untuk query dan mutasi data:

```
[ KLIEN 1 (Admin A) ]               [ BACKEND EXPRESS ]             [ SQL DATABASE ]           [ KLIEN 2 (Admin B) ]
        │                                   │                              │                             │
   1. Kirim Tambah Game                     │                              │                             │
      POST /api/v1/games ─────────────────>│                              │                             │
                                    2. Validasi &                          │                             │
                                       Sanitasi Input                      │                             │
                                            │                              │                             │
                                    3. Eksekusi INSERT                     │                             │
                                       ───────────────────────────────────>│                             │
                                            │                         4. Commit Data                     │
                                            │<─────────────────────────────│                             │
                                    5. Broadcast SSE Event                 │                             │
                                       event: game:created                 │                             │
                                       data: { gameId, ... } ──────────────┼────────────────────────────>│
                                            │                              │                             │
   6. Response 201 Created                  │                              │                       6. Menerima Event
     <──────────────────────────────────────│                              │                          SSE & Fetch Ulang
                                                                                                      GET /api/v1/games
```

---

## 3. Alur Autentikasi & Otorisasi

Admin Hub Studio dilindungi melalui verifikasi kata sandi kriptografis berbasis server:

1. **Otentikasi Klien**: Administrator memasukkan password pada modal login Admin Hub.
2. **Pengiriman Kredensial**: Klien mengirimkan `POST /api/v1/auth/admin-login` dengan payload `{ password }`.
3. **Pengecekan Server**: Backend memverifikasi kata sandi secara aman (default server secret: `admin321` atau konfigurasi environment `ADMIN_PASSWORD`).
4. **Token Sesi Sesaat**: Server menghasilkan token otentikasi sesi yang berlaku untuk durasi kerja admin dan dicatat pada tabel `audit_logs`.
5. **Role-Based Access Control (RBAC)**:
   - **Public / Siswa**: Akses Read-only untuk katalog game, leaderboard, modul sertifikat, dan pengiriman testimoni baru (status `pending`).
   - **Guru / Evaluator**: Akses Read-only ke katalog plus izin mencetak sertifikat siswa.
   - **Administrator**: Izin penuh (CRUD game, upload portable game, kelola kategori & ikon, ubah konfigurasi Hero & Stupa, moderasi testimoni, manajemen lisensi, serta akses log audit).

---

## 4. Alur Upload Game Portable & Eksekusi Sandboxed

Salah satu fitur unggulan sistem adalah kemampuan mengunggah game HTML5 mandiri (single-file bundle yang berisi HTML, CSS, JavaScript) dan menjalankannya tanpa risiko merusak host DOM:

```
[ FORM UPLOAD ADMIN ]                 [ BACKEND EXPRESS ]                 [ ISOLATED IFRAME RUNTIME ]
         │                                     │                                      │
  1. Upload file game (.html / .json)          │                                      │
     POST /api/v1/games                        │                                      │
     (html5_code, title, category, engine)────>│                                      │
                                        2. Validasi MIME                              │
                                           dan Sanitasi                               │
                                        3. Simpan ke Database                         │
                                           Kolom `html5_code`                         │
                                               │                                      │
                                               │                                      │
  4. Pengguna Memilih Game                     │                                      │
     GET /api/v1/games/:id ───────────────────>│                                      │
    <──────────────────────────────────────────│ (Data game dengan `html5_code`)      │
         │                                                                            │
  5. Mount Sandboxed Container                                                        │
     <iframe sandbox="allow-scripts allow-same-origin" srcdoc={html5_code} /> ───────>│
                                                                                      │
                                                                           6. Game Berjalan di Lingkungan
                                                                              Terisolasi Tanpa Akses ke
                                                                              Cookie / Storage Parent
```

**Spesifikasi Keamanan Sandbox:**
- `sandbox="allow-scripts allow-same-origin"`: Mengizinkan runtime JavaScript dan canvas game berfungsi normal, namun mencegah akses ke window parent, credential session, atau navigasi paksa.
- Skrip game tidak dijalankan di environment Node.js server, melainkan diinterpretasikan langsung di browser pemain.

---

## 5. Alur Sinkronisasi Real-Time (Server-Sent Events)

Untuk menjaga konsistensi state tanpa overhead kompleks dari WebSocket connection drops:

1. **Inisialisasi**: Saat aplikasi dimuat, `src/services/api.ts` membuka saluran koneksi SSE via:
   ```javascript
   const eventSource = new EventSource('/api/v1/realtime/stream');
   ```
2. **Koneksi Terjaga (Heartbeat)**: Server mengirimkan sinyal ping setiap 25 detik agar sambungan tidak diputus oleh proxy atau peramban.
3. **Penyebaran Event**: Setiap kali endpoint mutasi data dipanggil (`POST`, `PUT`, `DELETE`), server mengeksekusi helper `broadcastEvent(type, payload)`.
4. **Distribusi Kanal**:
   - `game:created`, `game:updated`, `game:deleted`: Memperbarui katalog game di semua layar terbuka.
   - `category:updated`: Memperbarui menu kategori dan ikon.
   - `leaderboard:updated`: Memperbarui tabel skor dan podium 3 besar seketika.
   - `settings:updated`: Memperbarui judul Hero, ornamen Stupa/Candi, dan mutiara kata Dharma.
   - `testimonial:updated`: Memperbarui daftar ulasan publik setelah disetujui admin.
5. **Fallback Polling**: Jika koneksi SSE terputus karena jaringan siswa tidak stabil, klien otomatis melakukan fallback polling berkala ke REST API.

---

## 6. Diagram Relasi Entitas (ERD) Ringkas

```
┌─────────────────┐       ┌─────────────────┐       ┌──────────────────┐
│   categories    │       │      games      │       │   leaderboard    │
├─────────────────┤       ├─────────────────┤       ├──────────────────┤
│ id (PK)         │◄─────┐│ id (PK)         │◄─────┐│ id (PK)          │
│ name            │      ││ title           │      ││ game_id (FK)     │
│ slug            │      └┼ category_slug   │      └┼ player_name      │
│ icon_type       │       │ engine          │       │ score            │
│ icon_val        │       │ html5_code      │       │ xp_earned        │
│ display_order   │       │ plays_count     │       │ submitted_at     │
└─────────────────┘       └─────────────────┘       └──────────────────┘

┌─────────────────┐       ┌─────────────────┐       ┌──────────────────┐
│  testimonials   │       │    licenses     │       │   certificates   │
├─────────────────┤       ├─────────────────┤       ├──────────────────┤
│ id (PK)         │       │ id (PK)         │       │ id (PK)          │
│ author_name     │       │ school_name     │       │ verification_code│
│ role            │       │ license_key     │       │ student_name     │
│ status (pending/│       │ tier (PRO/Basic)│       │ course_name      │
│         approved)│      │ expires_at      │       │ issue_date       │
└─────────────────┘       └─────────────────┘       └──────────────────┘
```
