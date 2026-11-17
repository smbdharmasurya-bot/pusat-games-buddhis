# PANDUAN DEPLOYMENT PRODUKSI – PUSAT GAMES BUDDHIS
## Production Deployment, VPS Setup & Subdomain Hosting Guide

Panduan ini memandu pemasangan platform **Pusat Games Buddhis** pada server produksi (Ubuntu/Debian VPS) menggunakan subdomain sekolah atau vihara, misalnya:
`https://games.namasekolah.com` atau `https://dharma.vihara.or.id`.

---

## 1. Persyaratan Server

- **Sistem Operasi**: Ubuntu 22.04 LTS / 24.04 LTS atau Debian 12.
- **Node.js**: Versi 20.x atau 22.x LTS.
- **RAM**: Minimal 1 GB (Rekomendasi 2 GB).
- **Disk**: Minimal 10 GB SSD (disesuaikan dengan jumlah upload game HTML5).
- **Akses**: Akses root atau sudoer pada server.

---

## 2. Instalasi Dependensi Server

```bash
# Update paket sistem
sudo apt update && sudo apt upgrade -y

# Instal Node.js 22 LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git build-essential nginx certbot python3-certbot-nginx

# Instal PM2 Process Manager secara global
sudo npm install -g pm2
```

---

## 3. Clone Proyek & Konfigurasi Direktori

```bash
# Masuk ke direktori web root
cd /var/www

# Clone repositori proyek
sudo git clone <URL_REPOSITORY> pusat-games-buddhis
cd pusat-games-buddhis

# Buat direktori data untuk database SQLite persisten
sudo mkdir -p /var/www/pusat-games-buddhis/data
sudo mkdir -p /var/www/pusat-games-buddhis/data/backups

# Atur kepemilikan direktori kepada user operasional (mis. www-data atau ubuntu)
sudo chown -R $USER:$USER /var/www/pusat-games-buddhis
```

---

## 4. Konfigurasi Environment (`.env`)

Salin file contoh konfigurasi dan sesuaikan nilai rahasianya:

```bash
cp .env.example .env
nano .env
```

Contoh konfigurasi `.env` produksi:

```ini
NODE_ENV=production
PORT=3000

# URL publik subdomain sekolah
APP_URL="https://games.namasekolah.com"

# Kredensial Administrator
ADMIN_PASSWORD="KataSandiKuatRahasiaSekolah2026!"

# Lokasi Berkas Database Persisten
DB_PATH="/var/www/pusat-games-buddhis/data/portal_game.db"

# Batas Maksimal Upload File Game Portable (MB)
MAX_UPLOAD_SIZE_MB=50
```

---

## 5. Build Aplikasi & Menjalankan dengan PM2

```bash
# Instal seluruh paket dependensi
npm install

# Uji jalankan unit testing untuk memastikan keandalan fungsi
npx tsx --test src/utils/gameLogic.test.ts

# Jalankan build frontend produksi Vite
npm run build

# Daftarkan aplikasi ke PM2 Process Manager
pm2 start server.ts --name "pusat-games-buddhis" --interpreter="tsx"

# Konfigurasikan PM2 agar otomatis jalan saat server reboot
pm2 startup
pm2 save
```

---

## 6. Konfigurasi DNS Domain / Subdomain

Pada panel DNS registrar domain sekolah (Cloudflare, Niagahoster, Rumahweb, cPanel, dll):

| Tipe Rekor | Nama Subdomain | Nilai / Tujuan Target | TTL |
| :--- | :--- | :--- | :--- |
| **A** | `games` | `IP_PUBLIC_SERVER_ANDA` | Auto / 300 |

*Catatan: Jika menggunakan domain utama, gunakan nama `@`.*

---

## 7. Konfigurasi Nginx Reverse Proxy

Buat berkas konfigurasi Nginx baru:

```bash
sudo nano /etc/nginx/sites-available/games.namasekolah.com
```

Isi dengan konfigurasi berikut:

```nginx
server {
    listen 80;
    server_name games.namasekolah.com;

    # Batas ukuran upload file game HTML5
    client_max_body_size 50M;

    # Gzip Compression untuk performa cepat
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # Header standard proxy
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Konfigurasi Server-Sent Events (SSE) Real-Time
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
        chunked_transfer_encoding off;
    }
}
```

Aktifkan konfigurasi dan muat ulang Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/games.namasekolah.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 8. Pasang Sertifikat SSL Gratis (HTTPS) via Let's Encrypt

```bash
sudo certbot --nginx -d games.namasekolah.com
```

Certbot akan otomatis memperbarui konfigurasi Nginx menjadi HTTPS port 443 dengan auto-renewal terjadwal.

---

## 9. Pemeliharaan & Monitoring Operasional

### Status Proses & Log
```bash
# Memeriksa status aplikasi
pm2 status

# Melihat log aplikasi secara real-time
pm2 logs pusat-games-buddhis

# Restart aplikasi setelah update kode
pm2 restart pusat-games-buddhis
```

### Backup Database Terjadwal via Crontab
Tambahkan cronjob untuk backup harian otomatis setiap pukul 02:00 malam:

```bash
crontab -e
```

Tambahkan baris:
```cron
0 2 * * * cd /var/www/pusat-games-buddhis && /usr/bin/node scripts/backup-database.js >> /var/log/cron-db-backup.log 2>&1
```
