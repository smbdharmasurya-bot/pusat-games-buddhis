# DOKUMENTASI REST API & SSE STREAM – PUSAT GAMES BUDDHIS
## Endpoint Reference v1

Dokumentasi lengkap untuk semua antarmuka REST API dan streaming real-time pada `/api/v1`.

- **Base URL**: `/api/v1`
- **Format Pertukaran Data**: `application/json`
- **Autentikasi Admin**: Header `Authorization: Bearer <session_token>` atau kata sandi terverifikasi pada sesi.

---

## 1. Status & Statistik Sistem

### GET `/api/v1/health`
Pemeriksaan kesehatan server dan database.

- **Response `200 OK`**:
```json
{
  "status": "healthy",
  "version": "3.1.0",
  "engine": "node:sqlite",
  "timestamp": "2026-11-10T15:30:00.000Z"
}
```

### GET `/api/v1/stats/overview`
Statistik agregat untuk dashboard publik dan admin hub.

- **Response `200 OK`**:
```json
{
  "totalGames": 6,
  "totalPlays": 1420,
  "totalStudents": 482,
  "totalSchools": 18,
  "topCategory": "riwayat-hidup",
  "categoriesCount": 14
}
```

---

## 2. Katalog Permainan (`/games`)

### GET `/api/v1/games`
Mengambil seluruh daftar permainan dengan filter opsional.

- **Query Parameters**:
  - `category` (opsional): filter berdasarkan `slug` kategori.
  - `difficulty` (opsional): `Mudah`, `Sedang`, `Sulit`, `Sangat Sulit`.
  - `search` (opsional): pencarian pada judul atau deskripsi.
  - `featured` (opsional): `true` / `false`.
- **Response `200 OK`**:
```json
[
  {
    "id": "game-01",
    "title": "Kuis Jejak Riwayat Sang Buddha",
    "description": "Uji pengetahuan tentang masa kelahiran hingga pencapaian Pencerahan Sempurna.",
    "category_slug": "riwayat-hidup",
    "engine": "quiz",
    "difficulty": "Mudah",
    "thumbnail": "https://images.unsplash.com/...",
    "is_featured": 1,
    "is_premium": 0,
    "plays_count": 520,
    "rating": 4.9,
    "created_at": "2026-11-10T00:00:00.000Z"
  }
]
```

### POST `/api/v1/games`
Menambah permainan baru atau mengunggah game portable HTML5 mandiri.

- **Request Body**:
```json
{
  "title": "Kuis Hukum Kamma & Punabbhava",
  "description": "Memahami benih karma dan hukum sebab akibat.",
  "category_slug": "kamma",
  "engine": "quiz",
  "difficulty": "Sedang",
  "thumbnail": "https://...",
  "html5_code": "<!DOCTYPE html><html>...</html>",
  "is_featured": 1,
  "is_premium": 0
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "id": "game-1731234567890",
  "message": "Permainan berhasil ditambahkan"
}
```

### POST `/api/v1/games/:id/play`
Mencatat interaksi main siswa dan menambah `plays_count`.

- **Response `200 OK`**:
```json
{
  "success": true,
  "plays_count": 521
}
```

### DELETE `/api/v1/games/:id`
Menghapus permainan dari katalog (Admin Only).

- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Permainan berhasil dihapus"
}
```

---

## 3. Kategori Permainan Manual (`/categories`)

### GET `/api/v1/categories`
Mengambil daftar kategori permainan yang dikelola secara manual oleh pengelola (contoh: `TK`, `SD`, `SMP`, atau topik kustom lainnya) beserta ikon dan urutan tampilnya.

- **Response `200 OK`**:
```json
{
  "success": true,
  "data": [
    {
      "id": 23,
      "name": "TK",
      "slug": "tk",
      "icon": "fa-seedling",
      "sort_order": 1,
      "status": 1
    }
  ]
}
```

### POST `/api/v1/categories`
Menambah kategori baru (Admin Only).

- **Request Body**:
```json
{
  "name": "Buddhisme Terapan & Lingkungan",
  "slug": "buddhisme-terapan",
  "description": "Penerapan ajaran Buddha dalam pelestarian bumi dan satwa",
  "icon_type": "fa",
  "icon_val": "fa-leaf",
  "color": "#10b981",
  "display_order": 15
}
```
- **Response `201 Created`**

---

## 4. Leaderboard & Papan Peringkat (`/leaderboard`)

### GET `/api/v1/leaderboard`
Mengambil entri papan peringkat teratas.

- **Query Parameters**:
  - `period` (opsional): `all` (default), `monthly`, `weekly`.
  - `limit` (opsional): jumlah rekor (default `50`).
- **Response `200 OK`**:
```json
[
  {
    "id": "lb-01",
    "player_name": "Ananda Dharma",
    "game_id": "game-01",
    "game_title": "Kuis Jejak Riwayat Sang Buddha",
    "score": 9850,
    "xp_earned": 500,
    "time_seconds": 105,
    "accuracy": 98.5,
    "school_vihara": "SMP Bodhisatta",
    "submitted_at": "2026-11-10T12:00:00.000Z"
  }
]
```

### POST `/api/v1/leaderboard`
Mengirimkan rekor skor baru setelah permainan selesai. Otomatis memicu kalkulasi XP dan siaran event real-time SSE ke seluruh klien yang sedang aktif.

- **Request Body**:
```json
{
  "player_name": "Siddhartha Putra",
  "game_id": "game-01",
  "game_title": "Kuis Jejak Riwayat Sang Buddha",
  "score": 9200,
  "xp_earned": 460,
  "time_seconds": 118,
  "accuracy": 95.0,
  "school_vihara": "SMA Tri Ratna"
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "id": "lb-1731234567890",
  "message": "Skor berhasil disimpan ke papan peringkat"
}
```

---

## 5. Testimoni Publik (`/testimonials`)

### GET `/api/v1/testimonials`
Mengambil ulasan yang telah berstatus `approved` untuk tampilan publik.

### POST `/api/v1/testimonials`
Siswa atau guru mengirimkan testimoni baru (status awal otomatis `pending`).

### PATCH `/api/v1/testimonials/:id/status`
Admin menyetujui (`approved`) atau menolak (`rejected`) ulasan.

---

## 6. Verifikasi Sertifikat Siswa (`/certificates`)

### GET `/api/v1/certificates/verify/:code`
Verifikasi publik keabsahan sertifikat siswa berdasarkan kode unik.

- **Contoh Request**: `GET /api/v1/certificates/verify/CERT-2026-001`
- **Response `200 OK` (Valid)**:
```json
{
  "valid": true,
  "certificate": {
    "verification_code": "CERT-2026-001",
    "student_name": "Kalyana Mitta",
    "course_name": "Pancasila Buddhis & Moralitas Dasar",
    "score": 98,
    "total_xp": 1450,
    "issue_date": "2026-02-15",
    "issuer_name": "Pusat Games Buddhis Indonesia"
  }
}
```
- **Response `404 Not Found` (Tidak Ditemukan)**:
```json
{
  "valid": false,
  "message": "Kode sertifikat tidak ditemukan di arsip resmi"
}
```

---

## 7. Pengaturan Situs & Hero (`/settings`)

### GET `/api/v1/settings`
Mengambil seluruh konfigurasi tampilan beranda, ornamen stupa/candi, dan mutiara Dharma.

### PUT `/api/v1/settings`
Memperbarui pengaturan beranda (Admin Only).

- **Request Body**:
```json
{
  "hero_title": "Pusat Games Buddhis Indonesia",
  "hero_subtitle": "Media Edukasi Dharma Interaktif",
  "hero_dharma_quote": "Akkodhena jine kodhaṃ — Taklukkan amarah dengan cinta kasih.",
  "stupa_style": "borobudur"
}
```

---

## 8. Real-Time Server-Sent Events (`/realtime/stream`)

### GET `/api/v1/realtime/stream`
Saluran streaming satu arah (Server to Client) berkecepatan tinggi tanpa beban overhead handshake ganda.

- **Headers Response**:
  - `Content-Type: text/event-stream`
  - `Cache-Control: no-cache`
  - `Connection: keep-alive`

- **Tipe Event yang Disiarkan**:
  1. `heartbeat`: Ping berkala server (setiap 25 detik).
  2. `game:created`: Penambahan game baru oleh administrator.
  3. `game:deleted`: Penghapusan game dari katalog.
  4. `category:updated`: Pembaruan daftar atau ikon kategori.
  5. `leaderboard:updated`: Pembaruan rekor peringkat oleh siswa.
  6. `settings:updated`: Perubahan tema atau pengaturan hero beranda.
  7. `testimonial:updated`: Pembaruan moderasi testimoni.
