# KEBIJAKAN KEAMANAN – PUSAT GAMES BUDDHIS
## Application Security & Hardening Policy

Platform **Pusat Games Buddhis** mengimplementasikan prinsip *Security by Design* untuk melindungi integritas data kurikulum, privasi siswa, dan stabilitas server.

---

## 1. Matriks Akses Peran (RBAC)

| Modul / Tab | Siswa (Publik) | Guru (Evaluator) | Administrator Sekolah |
| :--- | :---: | :---: | :---: |
| **Bermain Game (Quiz & Memory)** | ✅ Akses | ✅ Akses | ✅ Akses |
| **Papan Peringkat (Leaderboard)** | ✅ Lihat & Kirim Skor | ✅ Lihat & Filter | ✅ Kelola & Reset |
| **Verifikasi Sertifikat Digital** | ✅ Cek Kode | ✅ Cek & Cetak | ✅ Terbitkan & Arsip |
| **Kirim Testimoni Publik** | ✅ Kirim (Pending) | ✅ Kirim (Pending) | ✅ Moderasi (Setujui/Tolak) |
| **Upload Game Portable HTML5** | ❌ Ditolak | ❌ Ditolak | ✅ Akses Penuh |
| **Kelola Kategori & Ikon** | ❌ Ditolak | ❌ Ditolak | ✅ Akses Penuh |
| **Kustomisasi Beranda & Hero** | ❌ Ditolak | ❌ Ditolak | ✅ Akses Penuh |
| **Manajemen Lisensi Sekolah** | ❌ Ditolak | ❌ Ditolak | ✅ Akses Penuh |
| **Log Audit Administratif** | ❌ Ditolak | ❌ Ditolak | ✅ Akses Penuh |

---

## 2. Isolasi Runtime Permainan Portable (Iframe Sandboxing)

Game HTML5 pihak ketiga dijalankan di dalam container `<iframe>` dengan isolasi ketat:

```html
<iframe
  srcdoc={game.html5_code}
  sandbox="allow-scripts allow-same-origin"
  allow="autoplay; fullscreen"
  title={game.title}
  className="w-full h-full border-0"
/>
```

**Batasan Keamanan yang Diberlakukan:**
- **Mencegah Akses DOM Induk**: Game yang diunggah tidak dapat memanipulasi dokumen parent atau mengakses localStorage/cookie aplikasi utama.
- **Mencegah Eksekusi Sisi Server**: Berkas game tidak pernah dieksekusi oleh runtime Node.js di server. Semua kode dieksekusi secara terisolasi di sisi browser pengguna.
- **Mencegah Pengalihan Halaman Paksa**: Atribut sandbox tanpa `allow-top-navigation` mencegah skrip game nakal mengarahkan peramban pengguna ke situs luar tanpa izin.

---

## 3. Pencegahan SQL Injection

Semua operasi query ke database SQL (`node:sqlite`) wajib menggunakan **Prepared Statements** dan parameter binding:

```typescript
// Aman: Parameter binding mencegah interpolasi karakter jahat
const stmt = db.prepare(`SELECT * FROM games WHERE category_slug = ? AND difficulty = ?`);
const results = stmt.all(categorySlug, difficulty);
```

Penggabungan string langsung (`"SELECT * FROM games WHERE slug = '" + input + "'"` ) secara mutlak dilarang di seluruh arsitektur backend.

---

## 4. Perlindungan Autentikasi & Brute Force

- Kata sandi administrator diverifikasi di backend melalui endpoint `/api/v1/auth/admin-login`.
- Kredensial tidak pernah disimpan secara hardcode di frontend bundle.
- Setiap percobaan login dan tindakan perubahan konfigurasi secara otomatis dicatat ke dalam tabel `audit_logs` beserta stempel waktu dan jenis aksi.

---

## 5. Validasi Upload & Ukuran Payload

- Batas upload payload JSON Express dibatasi pada batas aman (`limit: '50mb'`).
- Validasi tipe MIME dan integritas struktur sebelum file game dikomit ke database.

---

## 6. Audit Trail & Jejak Kepatuhan

Setiap kali data kritis dimodifikasi (tambah game, hapus game, ubah lisensi, ubah pengaturan stupa/hero), sistem menyisipkan catatan ke tabel `audit_logs`:

```json
{
  "id": "audit-1731234567890",
  "action": "SETTINGS_UPDATED",
  "details": "Admin mengubah judul hero dan gaya ornamen stupa",
  "ip_address": "127.0.0.1",
  "created_at": "2026-11-10T08:15:20Z"
}
```
Log ini dapat ditinjau kapan saja melalui tab *Log Audit* di Admin Hub Studio Pro.
