# PANDUAN MIGRASI DATA – PUSAT GAMES BUDDHIS
## Migrasi dari LocalStorage Versi Lama ke Database SQL Terpusat

Dokumen ini menjelaskan prosedur migrasi data dari implementasi portal lama (HTML standalone dengan penyimpanan `localStorage` browser) ke dalam arsitektur database SQL terpusat.

---

## 1. Pemetaan Kunci LocalStorage ke Tabel Relasional SQL

| Kunci LocalStorage Lama | Tabel SQL Baru | Keterangan & Transformasi |
| :--- | :--- | :--- |
| `portal_games` / `portal_games_v3` | `games` | Array game dipetakan menjadi baris relasional. Atribut `id`, `title`, `engine`, `difficulty`, `html5_code` disimpan utuh. |
| `portal_categories` | `categories` | Menjaga mapping slug kategori, tipe ikon (`fa` atau gambar `.webp`/`.ico`), dan urutan tampilan. |
| `portal_leaderboard` | `leaderboard` | Rekor nilai siswa dipetakan dengan foreign key ke `game_id`. |
| `portal_testimonials` | `testimonials` | Ulasan dipetakan dengan status default `approved` untuk ulasan lawas. |
| `portal_hero_config` | `site_settings` | Kustomisasi teks hero, ornamen stupa Borobudur, dan mutiara Dharma disimpan dalam key-value pairs. |
| `portal_certificates` | `certificates` | Arsip kelulusan siswa disimpan dengan indeks unik pada `verification_code`. |
| `portal_licenses` | `licenses` | Lisensi sekolah disimpan dengan masa kedaluwarsa dan status aktif. |

---

## 2. Cara Menjalankan Migrasi

### Metode A: Menggunakan Skrip Node.js Otomatis

Tersedia skrip migrasi siap pakai di `scripts/migrate-localstorage.js`:

1. Ekstrak data localStorage browser Anda dengan menjalankan snippet berikut di DevTools Console pada halaman portal lama:
   ```javascript
   const dump = {};
   for (let i = 0; i < localStorage.length; i++) {
     const key = localStorage.key(i);
     try {
       dump[key] = JSON.parse(localStorage.getItem(key));
     } catch (e) {
       dump[key] = localStorage.getItem(key);
     }
   }
   console.log(JSON.stringify(dump, null, 2));
   copy(JSON.stringify(dump, null, 2));
   ```

2. Simpan hasil salinan tersebut ke dalam berkas `data/legacy_dump.json`.

3. Jalankan skrip migrasi:
   ```bash
   node scripts/migrate-localstorage.js data/legacy_dump.json
   ```

4. Skrip akan menampilkan rekap:
   ```text
   === LAPORAN MIGRASI DATA ===
   ✓ Kategori berhasil diimpor: 14
   ✓ Game berhasil diimpor: 8
   ✓ Rekor Leaderboard diimpor: 24
   ✓ Testimoni berhasil diimpor: 5
   ✓ Sertifikat berhasil diimpor: 12
   ✓ Lisensi berhasil diimpor: 3
   ✓ Pengaturan Beranda berhasil disinkronkan.
   Status: SUKSES TANPA KONFLIK
   ```

---

## 3. Validasi & Pengujian Pasca-Migrasi

Setelah migrasi selesai:
1. Buka antarmuka web di browser `http://localhost:3000`.
2. Pastikan seluruh game lama muncul di katalog beranda.
3. Buka halaman Papan Peringkat untuk memastikan skor siswa lama terhitung dengan benar.
4. Buka tab Verifikasi Sertifikat dan uji salah satu kode sertifikat lama.
5. Jalankan unit test sistem:
   ```bash
   npx tsx --test src/utils/gameLogic.test.ts
   ```
