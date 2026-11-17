#!/usr/bin/env node
/**
 * Skrip Restore Database SQLite – Pusat Games Buddhis
 * Penggunaan: node scripts/restore-database.js <path/to/backup_file.db>
 */

import fs from 'node:fs';
import path from 'node:path';

const backupFile = process.argv[2];
const targetDb = process.env.DB_PATH || path.join(process.cwd(), 'data', 'portal_game.db');

console.log('=== PEMULIHAN (RESTORE) DATABASE SQLITE ===');

if (!backupFile) {
  console.error('[Error] Harap sertakan path berkas backup!');
  console.log('Contoh: node scripts/restore-database.js data/backups/portal_game_backup_2026-11-10T08-00-00-000Z.db');
  process.exit(1);
}

if (!fs.existsSync(backupFile)) {
  console.error(`[Error] Berkas backup tidak ditemukan di: ${backupFile}`);
  process.exit(1);
}

console.log(`Berkas Backup:  ${backupFile}`);
console.log(`Database Target: ${targetDb}`);

try {
  // Jika database target ada, buat cadangan sementara sebelum menimpa
  if (fs.existsSync(targetDb)) {
    const safetyBackup = `${targetDb}.pre-restore.bak`;
    fs.copyFileSync(targetDb, safetyBackup);
    console.log(`[Info] Cadangan pengaman dibuat di: ${safetyBackup}`);
  }

  fs.copyFileSync(backupFile, targetDb);
  console.log('\n✓ Database berhasil dipulihkan dari snapshot cadangan!');
  console.log('Silakan restart server Node.js untuk memuat data terbaru.');
} catch (err) {
  console.error(`\n[Gagal] Gagal memulihkan database: ${err.message}`);
  process.exit(1);
}
