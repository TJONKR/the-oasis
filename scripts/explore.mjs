#!/usr/bin/env node
/**
 * Quick exploration script — scout the world around spawn without the server
 * Directly uses the world adapter
 */
import { readFileSync } from 'fs';
import { initWorldAdapter } from '../src/world-adapter.js';

console.log('Loading world...');
const world = JSON.parse(readFileSync('output/world.json', 'utf-8'));
console.log(`${world.width}x${world.height} loaded\n`);

const adapter = initWorldAdapter(world, 'data');
const sp = adapter.spawnPoint;

console.log(`\n🏜️  THE OASIS — Exploration Report`);
console.log(`📍 Spawn: (${sp.x}, ${sp.y}) — ${adapter.getZone(sp.x, sp.y)}\n`);

// Scout in all directions from spawn
const RANGE = 50;
const biomeCounts = {};
let rivers = 0, lakes = 0, coasts = 0;

for (let dy = -RANGE; dy <= RANGE; dy++) {
  for (let dx = -RANGE; dx <= RANGE; dx++) {
    if (dx*dx + dy*dy > RANGE*RANGE) continue;
    const x = sp.x + dx, y = sp.y + dy;
    const zone = adapter.getZone(x, y);
    biomeCounts[zone] = (biomeCounts[zone] || 0) + 1;
    const idx = y * world.width + x;
    if (adapter.riverMap[idx] > 0) rivers++;
    if (adapter.lakeMap[idx]) lakes++;
    if (zone === 'coast') coasts++;
  }
}

console.log(`🌍 Within ${RANGE} tiles of spawn:`);
const sorted = Object.entries(biomeCounts).sort((a,b) => b[1] - a[1]);
for (const [zone, count] of sorted) {
  const pct = (count / sorted.reduce((a,b) => a + b[1], 0) * 100).toFixed(1);
  console.log(`  ${zone.padEnd(10)} ${count} tiles (${pct}%)`);
}
console.log(`\n  🏞️  River tiles: ${rivers}`);
console.log(`  🏊 Lake tiles: ${lakes}`);
console.log(`  🏖️  Coast tiles: ${coasts}`);

// Find interesting nearby features
console.log(`\n🧭 Nearest features from spawn:`);
const features = [
  { name: 'Forest', test: (x,y) => adapter.getZone(x,y) === 'forest' },
  { name: 'River', test: (x,y) => adapter.riverMap[y*world.width+x] > 0 },
  { name: 'Coast', test: (x,y) => adapter.getZone(x,y) === 'coast' },
  { name: 'Rocky/Mountain', test: (x,y) => adapter.getZone(x,y) === 'rocky' || adapter.getZone(x,y) === 'cave' },
  { name: 'Swamp', test: (x,y) => adapter.getZone(x,y) === 'swamp' },
  { name: 'Desert/Sand', test: (x,y) => adapter.getZone(x,y) === 'sand' },
  { name: 'Lake', test: (x,y) => adapter.lakeMap[y*world.width+x] > 0 },
];

for (const feat of features) {
  let minDist = Infinity, fx = 0, fy = 0;
  for (let dy = -100; dy <= 100; dy++) {
    for (let dx = -100; dx <= 100; dx++) {
      const x = sp.x + dx, y = sp.y + dy;
      if (x < 0 || x >= world.width || y < 0 || y >= world.height) continue;
      if (feat.test(x, y)) {
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d < minDist) { minDist = d; fx = x; fy = y; }
      }
    }
  }
  if (minDist < Infinity) {
    const dir = getDirection(sp.x, sp.y, fx, fy);
    console.log(`  ${feat.name.padEnd(16)} ${Math.round(minDist)} tiles ${dir} → (${fx}, ${fy})`);
  } else {
    console.log(`  ${feat.name.padEnd(16)} not found within 100 tiles`);
  }
}

function getDirection(fx, fy, tx, ty) {
  const dx = tx - fx, dy = ty - fy;
  if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return '(here!)';
  let dir = '';
  if (dy < -3) dir += 'N'; else if (dy > 3) dir += 'S';
  if (dx > 3) dir += 'E'; else if (dx < -3) dir += 'W';
  return dir || '~';
}

// Simulate a walk
console.log(`\n🚶 Simulating a walk from spawn...`);
const agent = { tileX: sp.x, tileY: sp.y, zone: adapter.getZone(sp.x, sp.y), energy: 100 };
const directions = ['east', 'east', 'east', 'north', 'north', 'east', 'east', 'south', 'south', 'east'];
const journal = [];

for (const dir of directions) {
  const result = adapter.walkAgent(agent, dir);
  if (result.ok) {
    const res = adapter.getTileResources(agent.tileX, agent.tileY);
    journal.push(`  → ${dir.padEnd(6)} (${agent.tileX},${agent.tileY}) ${result.terrain} | energy: ${agent.energy} | resources: ${res?.resources?.join(', ') || 'none'}`);
  } else {
    journal.push(`  ✗ ${dir.padEnd(6)} BLOCKED: ${result.error}`);
  }
}

journal.forEach(l => console.log(l));
console.log(`\n✅ Final position: (${agent.tileX}, ${agent.tileY}) — ${agent.zone} — energy: ${agent.energy}`);
