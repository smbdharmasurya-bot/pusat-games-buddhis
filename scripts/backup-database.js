#!/usr/bin/env node
/**
 * Skrip Backup Database SQLite Terpusat – Pusat Games Buddhis
 * Penggunaan: node scripts/backup-database.js [optional_dest_folder]
 */

import fs from 'node:fs';
import path from 'node:path';

const sourceDb = process.env.DB_PATH || path.join(process.cwd(), 'data', 'portal_game.db');
const backupDir = process.argv[2] || path.join(process.cwd(), 'data', 'backups');

console.log('=== PEMBUATAN SNAPSHOT BACKUP DATABASE ===');
console.log(`Database Sumber:  ${sourceDb}`);
console.log(`Direktori Backup: ${backupDir}`);

if (!fs.existsSync(sourceDb)) {
  console.error(`[Error] Berkas database sumber tidak ditemukan di: ${sourceDb}`);
  process.exit(1);
}

fs.mkdirSync(backupDir, { recursive: true });

const now = new Date();
const timestamp = now.toISOString().replace(/[:.]/g, '-');
const backupFileName = `portal_game_backup_${timestamp}.db`;
const targetPath = path.join(backupDir, backupFileName);

try {
  fs.copyFileSync(sourceDb, targetPath);
  const stats = fs.statSync(targetPath);
  console.log(`\n✓ Backup berhasil dibuat: ${backupFileName}`);
  console.log(`  Ukuran: ${(stats.size / 1024).toFixed(2)} KB`);
  console.log(`  Lokasi: ${targetPath}`);
} catch (err) {
  console.error(`\n[Gagal] Gagal mencadangkan database: ${err.message}`);
  process.exit(1);
}
