#!/usr/bin/env node
/**
 * Skrip Migrasi Data dari LocalStorage Dump ke Database SQLite Terpusat
 * Penggunaan: node scripts/migrate-localstorage.js [path/to/dump.json]
 */

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dumpFilePath = process.argv[2] || path.join(process.cwd(), 'data', 'legacy_dump.json');
const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'portal_game.db');

console.log('=== SKRIP MIGRASI DATA LOCALSTORAGE KE SQLITE ===');
console.log(`Target Database: ${dbPath}`);
console.log(`Sumber Dump:     ${dumpFilePath}`);

if (!fs.existsSync(dumpFilePath)) {
  console.log('\n[Pemberitahuan] Berkas dump tidak ditemukan. Membuat contoh format dump di:');
  console.log(dumpFilePath);
  
  const exampleDump = {
    portal_games: [
      {
        id: "legacy-game-1",
        title: "Kuis Pangeran Siddhartha",
        description: "Permainan migrasi dari portal versi lama.",
        category_slug: "riwayat-hidup",
        engine: "quiz",
        difficulty: "Mudah",
        plays_count: 150,
        rating: 4.8
      }
    ],
    portal_leaderboard: [
      {
        id: "legacy-lb-1",
        player_name: "Bodhi Siswa",
        game_id: "legacy-game-1",
        game_title: "Kuis Pangeran Siddhartha",
        score: 8500,
        xp_earned: 425,
        school_vihara: "Vihara Dharma Surya"
      }
    ],
    portal_testimonials: [
      {
        id: "legacy-testi-1",
        author_name: "Upasaka Dharma",
        role: "Guru Pembina",
        comment: "Sangat membantu proses belajar Dharma anak-anak di vihara.",
        rating: 5,
        status: "approved"
      }
    ]
  };

  fs.mkdirSync(path.dirname(dumpFilePath), { recursive: true });
  fs.writeFileSync(dumpFilePath, JSON.stringify(exampleDump, null, 2), 'utf-8');
  console.log('Contoh berkas berhasil dibuat. Silakan isi dengan data localStorage nyata dan jalankan kembali skrip ini.');
  process.exit(0);
}

try {
  const rawData = fs.readFileSync(dumpFilePath, 'utf-8');
  const dump = JSON.parse(rawData);
  const db = new DatabaseSync(dbPath);

  let gamesCount = 0;
  let lbCount = 0;
  let testiCount = 0;

  // Migrasi Games
  const games = dump.portal_games || dump.portal_games_v3 || dump.games || [];
  if (Array.isArray(games) && games.length > 0) {
    const insertGame = db.prepare(`
      INSERT OR REPLACE INTO games (id, title, description, category_slug, engine, difficulty, thumbnail, html5_code, plays_count, rating)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const g of games) {
      insertGame.run(
        g.id || `migrated-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        g.title || 'Untitled Game',
        g.description || '',
        g.category_slug || g.category || 'riwayat-hidup',
        g.engine || 'quiz',
        g.difficulty || 'Sedang',
        g.thumbnail || null,
        g.html5_code || null,
        g.plays_count || 0,
        g.rating || 5.0
      );
      gamesCount++;
    }
  }

  // Migrasi Leaderboard
  const leaderboard = dump.portal_leaderboard || dump.leaderboard || [];
  if (Array.isArray(leaderboard) && leaderboard.length > 0) {
    const insertLB = db.prepare(`
      INSERT OR REPLACE INTO leaderboard (id, player_name, game_id, game_title, score, xp_earned, time_seconds, accuracy, school_vihara)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const lb of leaderboard) {
      insertLB.run(
        lb.id || `migrated-lb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        lb.player_name || 'Anonymous',
        lb.game_id || 'game-01',
        lb.game_title || 'Permainan Dharma',
        lb.score || 0,
        lb.xp_earned || Math.round((lb.score || 0) * 0.05),
        lb.time_seconds || 60,
        lb.accuracy || 100.0,
        lb.school_vihara || 'Umum'
      );
      lbCount++;
    }
  }

  // Migrasi Testimonials
  const testimonials = dump.portal_testimonials || dump.testimonials || [];
  if (Array.isArray(testimonials) && testimonials.length > 0) {
    const insertTesti = db.prepare(`
      INSERT OR REPLACE INTO testimonials (id, author_name, role, school_or_vihara, comment, rating, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const t of testimonials) {
      insertTesti.run(
        t.id || `migrated-testi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        t.author_name || 'Sahabat Dharma',
        t.role || 'Siswa',
        t.school_or_vihara || '',
        t.comment || '',
        t.rating || 5,
        t.status || 'approved'
      );
      testiCount++;
    }
  }

  // Catat ke Audit Log
  const insertAudit = db.prepare(`INSERT INTO audit_logs (id, action, details) VALUES (?, ?, ?)`);
  insertAudit.run(
    `audit-migrasi-${Date.now()}`,
    'DATA_MIGRATED',
    `Migrasi berhasil: ${gamesCount} game, ${lbCount} skor, ${testiCount} testimoni.`
  );

  console.log('\n=== REKAPITULASI HASIL MIGRASI ===');
  console.log(`✓ Game berhasil diimpor:        ${gamesCount}`);
  console.log(`✓ Rekor Leaderboard diimpor:    ${lbCount}`);
  console.log(`✓ Testimoni berhasil diimpor:   ${testiCount}`);
  console.log('Status: Migrasi selesai dengan sukses!');
} catch (error) {
  console.error('\n[Gagal] Terjadi kesalahan saat migrasi:', error.message);
  process.exit(1);
}
