#!/usr/bin/env node
/**
 * Railway startup: seed data volume if empty, generate world if missing, then start server.
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

// 2. Generate world if missing
const worldPath = join(root, 'output', 'world.json');
if (!existsSync(worldPath)) {
  console.log('🌍 Generating world...');
  mkdirSync(join(root, 'output'), { recursive: true });
  execSync('npm run generate', { cwd: root, stdio: 'inherit' });
}

// 3. Start server
console.log('🚀 Starting server...');
execSync('node --max-old-space-size=1024 server.js', { cwd: root, stdio: 'inherit' });
