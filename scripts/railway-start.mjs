#!/usr/bin/env node
/**
 * Railway startup: seed data volume if empty, decompress world if missing, start server.
 */
import { existsSync, readdirSync, cpSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// 1. Seed data volume if empty (Railway mounts empty volume over /app/data)
const dataDir = join(root, 'data');
const seedDir = join(root, 'data-seed');

if (existsSync(seedDir)) {
  const dataFiles = existsSync(dataDir) ? readdirSync(dataDir) : [];
  if (dataFiles.length === 0) {
    console.log('📦 Seeding data volume from data-seed/...');
    mkdirSync(dataDir, { recursive: true });
    cpSync(seedDir, dataDir, { recursive: true });
    console.log('✅ Data seeded');
  } else {
    console.log(`✅ Data volume has ${dataFiles.length} files, skipping seed`);
  }
}

// 2. Decompress world if missing
const outputDir = join(root, 'output');
const worldPath = join(outputDir, 'world.json');
const worldGz = join(root, 'assets', 'world.json.gz');

if (!existsSync(worldPath)) {
  console.log('🌍 Decompressing world...');
  mkdirSync(outputDir, { recursive: true });
  execSync(`gunzip -k "${worldGz}" && mv "${join(root, 'assets', 'world.json')}" "${worldPath}"`, { stdio: 'inherit' });
  console.log('✅ World ready');
} else {
  console.log('✅ World exists');
}

// 3. Start server
console.log('🚀 Starting server...');
execSync('node --max-old-space-size=1024 server.js', { cwd: root, stdio: 'inherit' });
