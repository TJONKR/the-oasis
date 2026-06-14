#!/usr/bin/env node
import { existsSync, readdirSync, cpSync, mkdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dataDir = join(root, 'data');
const seedDir = join(root, 'data-seed');

// 1. Seed data if agents.json is missing or empty
if (existsSync(seedDir)) {
  const agentsPath = join(dataDir, 'agents.json');
  let needsSeed = !existsSync(agentsPath);
  if (!needsSeed) {
    try {
      const agents = JSON.parse(readFileSync(agentsPath, 'utf-8'));
      needsSeed = Object.keys(agents).length === 0;
    } catch { needsSeed = true; }
  }
  if (needsSeed) {
    console.log('📦 Seeding data volume from data-seed/...');
    mkdirSync(dataDir, { recursive: true });
    for (const f of readdirSync(seedDir)) {
      cpSync(join(seedDir, f), join(dataDir, f), { recursive: true, force: true });
    }
    console.log('✅ Data seeded:', readdirSync(dataDir).filter(f => f.endsWith('.json')).length, 'files');
  } else {
    console.log('✅ Data volume OK, agents present');
  }
}

// 2. Decompress world if missing
const worldPath = join(root, 'output', 'world.json');
const worldGz = join(root, 'assets', 'world.json.gz');
if (!existsSync(worldPath) && existsSync(worldGz)) {
  console.log('🌍 Decompressing world...');
  mkdirSync(join(root, 'output'), { recursive: true });
  execSync(`gunzip -c "${worldGz}" > "${worldPath}"`, { stdio: 'inherit' });
  console.log('✅ World ready');
}

// 3. Start server
// Use spawn (not execSync) so we can FORWARD the platform's stop signal down to
// the server process. Railway sends SIGTERM to this wrapper on stop/redeploy/
// memory-limit; with execSync the signal never reached server.js and its
// graceful-shutdown handler could not run. Now it does.
console.log('🚀 Starting server...');
const child = spawn('node', ['--max-old-space-size=1024', 'server.js'], {
  cwd: root,
  stdio: 'inherit',
});

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => child.kill(sig));
}

child.on('exit', (code, signal) => {
  // Mirror the child's outcome so the platform sees an accurate exit status.
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
