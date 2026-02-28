#!/usr/bin/env node
/**
 * Generate a 2000x2000 world for The Oasis
 * Uses the WORLD project pipeline (copied to src/world/)
 * 
 * For now: just copies the existing generated world from WORLD project
 * TODO: integrate pipeline directly once TypeScript compilation is set up
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'output');
const outPath = join(outDir, 'world.json');

// For now, use the already-generated world from WORLD project
const WORLD_PROJECT = join(__dirname, '..', '..', 'WORLD', 'output', 'world-2k-v3.json');

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

if (existsSync(WORLD_PROJECT)) {
  console.log('Copying world from WORLD project...');
  const data = readFileSync(WORLD_PROJECT);
  writeFileSync(outPath, data);
  const world = JSON.parse(data);
  console.log(`✅ World saved: ${world.width}x${world.height} tiles → output/world.json`);
} else {
  console.error('❌ No generated world found at:', WORLD_PROJECT);
  console.error('Run the WORLD pipeline first, or generate inline (TODO)');
  process.exit(1);
}
