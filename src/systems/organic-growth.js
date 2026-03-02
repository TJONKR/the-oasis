// Organic Growth System — Phase 2B
// Seeds grow into plants. Forests regrow after fire. Seasons affect growth.
// The Oasis breathes.

// Growth sites — tiles where something is growing
// "x,y" → { type, progress, maxProgress, plantType, plantedBy, startTick }
const growthSites = new Map();

// Season multipliers for growth speed
const SEASON_GROWTH = {
  spring: 2.0,
  summer: 1.5,
  autumn: 0.7,
  winter: 0.25,
};

// What can be planted and what it grows into
const PLANTABLE = {
  acorns:      { growsInto: 'oak_tree',  decoId: 151, ticks: 300, zones: ['grass', 'grassland', 'forest'] },
  pine_nuts:   { growsInto: 'pine_tree', decoId: 150, ticks: 350, zones: ['grass', 'grassland', 'forest', 'mountain'] },
  coconuts:    { growsInto: 'palm_tree', decoId: 152, ticks: 250, zones: ['coast', 'sand'] },
  'Memory Seed': { growsInto: 'memory_flower', decoId: 155, ticks: 150, zones: ['grass', 'grassland', 'forest', 'swamp'] },
  flowers:     { growsInto: 'flower',    decoId: 155, ticks: 100, zones: ['grass', 'grassland'] },
  herbs:       { growsInto: 'herb',      decoId: 155, ticks: 120, zones: ['grass', 'grassland', 'forest', 'swamp'] },
  mushrooms:   { growsInto: 'mushroom',  decoId: 157, ticks: 80,  zones: ['forest', 'swamp', 'cave'] },
  reeds:       { growsInto: 'reed',      decoId: 158, ticks: 100, zones: ['swamp', 'coast'] },
};

// Post-fire regrowth — burned forest tiles gradually regrow
const FIRE_REGROWTH = {
  forest:    { decoId: 150, ticks: 500, chance: 0.7 },  // pine tree
  grass:     { decoId: 155, ticks: 200, chance: 0.5 },  // flowers
  grassland: { decoId: 155, ticks: 200, chance: 0.5 },
  swamp:     { decoId: 158, ticks: 300, chance: 0.4 },  // reeds
};

function getSeason(day) {
  const seasonDay = day % 120; // 120-day year
  if (seasonDay < 30) return 'spring';
  if (seasonDay < 60) return 'summer';
  if (seasonDay < 90) return 'autumn';
  return 'winter';
}

export function initOrganicGrowth(shared) {
  const { broadcast, addWorldNews, worldGrid } = shared;
  
  /**
   * Plant a seed at a tile position. Returns true if successful.
   */
  function plantSeed(item, tileX, tileY, zone, agentId) {
    const plantDef = PLANTABLE[item.name];
    if (!plantDef) return false;
    if (!plantDef.zones.includes(zone)) return false;
    
    const key = `${tileX},${tileY}`;
    if (growthSites.has(key)) return false; // already growing something
    
    // Check if tile already has a decoration
    const existingDeco = worldGrid?.getDecoration?.(tileX, tileY);
    if (existingDeco) return false; // tile occupied
    
    growthSites.set(key, {
      type: 'planted',
      plantType: plantDef.growsInto,
      decoId: plantDef.decoId,
      progress: 0,
      maxProgress: plantDef.ticks,
      plantedBy: agentId,
      startTick: shared.tick || 0,
    });
    
    if (broadcast) {
      broadcast({ type: 'tileEffect', effect: 'sparkle', tileX, tileY, duration: 1500 });
    }
    
    return true;
  }
  
  /**
   * Mark a tile for fire regrowth (called when fire burns out on a tile).
   * Fire ash enriches soil with nutrients (nutrient cycle).
   */
  function markFireRegrowth(tileX, tileY, zone) {
    const regrowth = FIRE_REGROWTH[zone];
    if (!regrowth) return;
    if (Math.random() > regrowth.chance) return;
    
    const key = `${tileX},${tileY}`;
    if (growthSites.has(key)) return;
    
    // Fire ash enriches soil - add fertile ash to ground
    if (shared.decayLifecycle?.groundItems) {
      if (!shared.decayLifecycle.groundItems.has(key)) {
        shared.decayLifecycle.groundItems.set(key, []);
      }
      
      shared.decayLifecycle.groundItems.get(key).push({
        item: {
          name: 'Fire Ash',
          type: 'material',
          description: 'Nutrient-rich ash from burned vegetation. Excellent fertilizer.',
          properties: { 
            fertility: 10, // very fertile!
            organic: 0.8, 
            decay_rate: 0.05, // slow decay
            weight: 0.2,
            solubility: 6, // dissolves into soil easily
          },
        },
        dropTick: shared.tick || 0,
        decayProgress: 0,
      });
    }
    
    // Delayed start — nothing grows immediately after fire
    growthSites.set(key, {
      type: 'regrowth',
      plantType: zone + '_regrowth',
      decoId: regrowth.decoId,
      progress: -50, // 50-tick delay before growth starts
      maxProgress: regrowth.ticks,
      plantedBy: 'nature',
      startTick: shared.tick || 0,
    });
    
    if (shared.broadcast) {
      shared.addWorldNews?.('growth', null, 'Nature',
        `Fire at (${tileX},${tileY}) left fertile ash. Plants will regrow stronger here.`, zone);
    }
  }
  
  /**
   * Tick all growth sites.
   */
  function tick(tickNum, gameTime) {
    if (tickNum % 10 !== 0) return; // check every 5 seconds
    
    const season = getSeason(gameTime?.day || 0);
    const seasonMult = SEASON_GROWTH[season] || 1;
    const isNight = gameTime?.period === 'night';
    const growthRate = seasonMult * (isNight ? 0.5 : 1.0); // slower at night
    
    for (const [key, site] of growthSites) {
      // Get soil fertility boost from decay system
      const [x, y] = key.split(',').map(Number);
      let fertilityBoost = 1;
      if (shared.decayLifecycle?.getTileFertility) {
        const fert = shared.decayLifecycle.getTileFertility(x, y);
        fertilityBoost = 1 + fert * 0.1; // each fertility point = +10% growth
      }
      
      site.progress += growthRate * fertilityBoost;
      
      if (site.progress >= site.maxProgress) {
        // Growth complete! Place decoration on the tile
        // (We can't actually modify the world data easily, but we can track it)
        growthSites.delete(key);
        
        if (broadcast) {
          broadcast({ type: 'tileEffect', effect: 'sparkle', tileX: x, tileY: y, duration: 2000 });
          broadcast({ type: 'growthComplete', tileX: x, tileY: y, decoId: site.decoId, plantType: site.plantType });
          
          if (site.type === 'planted') {
            addWorldNews?.('growth', null, 'Nature',
              `A ${site.plantType} has grown at (${x},${y})!`, '');
          }
        }
      }
    }
  }
  
  /**
   * Get growth sites for frontend rendering (show growing plants).
   */
  function getGrowthSites() {
    const sites = [];
    for (const [key, site] of growthSites) {
      const [x, y] = key.split(',').map(Number);
      sites.push({
        tileX: x, tileY: y,
        progress: Math.max(0, site.progress) / site.maxProgress,
        plantType: site.plantType,
        type: site.type,
      });
    }
    return sites;
  }
  
  return { tick, plantSeed, markFireRegrowth, getGrowthSites, getSeason, growthSites };
}

export { PLANTABLE, FIRE_REGROWTH, SEASON_GROWTH };
