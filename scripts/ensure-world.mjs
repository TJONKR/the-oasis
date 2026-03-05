#!/usr/bin/env node
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const worldPath = join(__dirname, '..', 'output', 'world.json');

if (existsSync(worldPath)) {
  console.log('✅ World exists, skipping generation');
  process.exit(0);
}

console.log('🌍 Generating world (first deploy)...');
execSync('npm run generate', { cwd: join(__dirname, '..'), stdio: 'inherit' });
console.log('✅ World generated');
