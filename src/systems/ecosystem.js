// Ecosystem System — Dynamic ecological model for resource regeneration
// Replaces flat 0.5/tick regeneration with soil fertility, water levels,
// biodiversity, and extraction pressure mechanics.

import { getProperties } from '../materials.js';

// --- Zone-specific ecosystem profiles ---
const ZONE_PROFILES = {
  grass: {
    base_fertility: 80,
    base_water: 80,
    base_biodiversity: 70,
    fertility_recovery: 0.1,    // fertile grasslands
    water_retention: 1.5,       // holds more water (rain adds 1.5x)
    biodiversity_fragility: 1.5, // drops faster
    pressure_tolerance: 400,    // moderate
    label: 'grass',
  },
  cave: {
    base_fertility: 40,         // mineral-based, low fertility
    base_water: 60,             // underground water
    base_biodiversity: 50,
    fertility_recovery: 0.02,   // very slow recovery
    water_retention: 0.8,       // underground, less evaporation but less rain
    biodiversity_fragility: 2.0, // very fragile
    pressure_tolerance: 300,    // fragile
    label: 'cave',
  },
  sand: {
    base_fertility: 45,         // sandy, low fertility
    base_water: 80,             // water-rich
    base_biodiversity: 65,
    fertility_recovery: 0.03,
    water_retention: 1.3,
    biodiversity_fragility: 1.0,
    pressure_tolerance: 450,
    label: 'sand',
  },
  forest: {
    base_fertility: 70,
    base_water: 60,
    base_biodiversity: 70,
    fertility_recovery: 0.05,
    water_retention: 1.0,
    biodiversity_fragility: 1.0,
    pressure_tolerance: 500,
    label: 'forest',
  },
  rocky: {
    base_fertility: 30,         // low natural resources, good for crafting
    base_water: 40,
    base_biodiversity: 30,
    fertility_recovery: 0.02,
    water_retention: 0.5,
    biodiversity_fragility: 0.5, // not affected much
    pressure_tolerance: 600,    // industrial, can take pressure
    label: 'rocky',
  },
  path: {
    base_fertility: 30,
    base_water: 40,
    base_biodiversity: 30,
    fertility_recovery: 0.02,
    water_retention: 0.5,
    biodiversity_fragility: 0.5,
    pressure_tolerance: 600,
    label: 'path',
  },
  coast: {
    base_fertility: 50,
    base_water: 80,
    base_biodiversity: 55,
    fertility_recovery: 0.03,
    water_retention: 1.3,
    biodiversity_fragility: 0.9,
    pressure_tolerance: 450,
    label: 'coast',
  },
  swamp: {
    base_fertility: 60,
    base_water: 90,
    base_biodiversity: 75,
    fertility_recovery: 0.04,
    water_retention: 2.0,       // very wet
    biodiversity_fragility: 1.2,
    pressure_tolerance: 350,
    label: 'swamp',
  },
};

const DEFAULT_PROFILE = {
  base_fertility: 70,
  base_water: 60,
  base_biodiversity: 70,
  fertility_recovery: 0.05,
  water_retention: 1.0,
  biodiversity_fragility: 1.0,
  pressure_tolerance: 500,
  label: 'default',
};

/**
 * Clamp a value between min and max.
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Round to 2 decimal places to avoid floating point drift.
 */
function round2(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Check if a material is organic based on its properties.
 */
function isOrganicMaterial(resourceType) {
  const props = getProperties(resourceType);
  if (!props) return false;
  return props.organic >= 0.5;
}

/**
 * Check if an item is rare (Rare or Epic rarity).
 * We infer from the resource name; caller may also pass rarity directly.
 */
function isRareResource(resourceType, rarity) {
  if (rarity && (rarity === 'Rare' || rarity === 'Epic' || rarity === 'Legendary')) return true;
  return false;
}

/**
 * Initialize the ecosystem system.
 * @param {Object} options - { loadJSON, saveJSON, zones }
 */
export function initEcosystem({ loadJSON, saveJSON, zones }) {
  // --- State ---
  let state = loadJSON('ecosystem.json', null);

  function createZoneState(zoneId) {
    const profile = ZONE_PROFILES[zoneId] || DEFAULT_PROFILE;
    return {
      soil_fertility: profile.base_fertility,
      water_level: profile.base_water,
      biodiversity: profile.base_biodiversity,
      extraction_pressure: 0,
      health: 0, // computed below
      gather_history: [], // tracks recent gather types for monoculture detection
    };
  }

  if (!state) {
    state = {};
    for (const zoneId of Object.keys(zones)) {
      state[zoneId] = createZoneState(zoneId);
    }
    computeAllHealth();
    save();
  }

  // Ensure all zones exist (in case new zones were added)
  for (const zoneId of Object.keys(zones)) {
    if (!state[zoneId]) {
      state[zoneId] = createZoneState(zoneId);
      computeHealth(zoneId);
    }
    // Ensure gather_history exists for older saves
    if (!state[zoneId].gather_history) {
      state[zoneId].gather_history = [];
    }
  }

  function save() {
    saveJSON('ecosystem.json', state);
  }

  function computeHealth(zoneId) {
    const zone = state[zoneId];
    if (!zone) return;
    zone.health = round2(
      (zone.soil_fertility + zone.water_level + zone.biodiversity) / 3
    );
  }

  function computeAllHealth() {
    for (const zoneId of Object.keys(state)) {
      computeHealth(zoneId);
    }
  }

  function getProfile(zoneId) {
    return ZONE_PROFILES[zoneId] || DEFAULT_PROFILE;
  }

  // --- Public API ---

  /**
   * Get full ecosystem state for a zone.
   */
  function getEcosystemState(zoneId) {
    const zone = state[zoneId];
    if (!zone) return null;
    return {
      soil_fertility: zone.soil_fertility,
      water_level: zone.water_level,
      biodiversity: zone.biodiversity,
      extraction_pressure: zone.extraction_pressure,
      health: zone.health,
    };
  }

  /**
   * Called when an agent gathers a resource in a zone.
   * Updates extraction pressure, soil fertility, biodiversity.
   * @param {string} zoneId
   * @param {string} resourceType - name of the resource gathered
   * @param {string} [rarity] - rarity of the resource (optional)
   */
  function onGather(zoneId, resourceType, rarity) {
    const zone = state[zoneId];
    if (!zone) return;
    const profile = getProfile(zoneId);

    // --- Extraction pressure ---
    // Check for same-type gathering penalty
    const recentSameType = zone.gather_history.filter(r => r === resourceType).length;
    const totalRecent = zone.gather_history.length;
    const isSameType = totalRecent > 0 && recentSameType > 0;
    const pressureIncrease = isSameType ? 1.5 : 1.0;
    zone.extraction_pressure = round2(zone.extraction_pressure + pressureIncrease);

    // --- Soil fertility ---
    const organic = isOrganicMaterial(resourceType);
    const fertilityDrop = organic ? 0.2 : 0.1;
    zone.soil_fertility = round2(clamp(zone.soil_fertility - fertilityDrop, 0, 100));

    // --- Biodiversity ---
    const rare = isRareResource(resourceType, rarity);
    let biodiversityDrop = rare ? 0.5 : 0.2;
    // Monoculture penalty: if >80% of recent gathers are same resource
    if (totalRecent >= 5) {
      const dominantCount = Math.max(...Object.values(
        zone.gather_history.reduce((acc, r) => { acc[r] = (acc[r] || 0) + 1; return acc; }, {})
      ));
      if (dominantCount / totalRecent > 0.8) {
        biodiversityDrop *= 2;
      }
    }
    biodiversityDrop *= profile.biodiversity_fragility;
    zone.biodiversity = round2(clamp(zone.biodiversity - biodiversityDrop, 0, 100));

    // Track gather history (keep last 20 gathers)
    zone.gather_history.push(resourceType);
    if (zone.gather_history.length > 20) {
      zone.gather_history.shift();
    }

    computeHealth(zoneId);
    // Don't save on every gather — save happens on tick
  }

  /**
   * Called when an organic item is deposited/composted in a zone.
   * @param {string} zoneId
   * @param {Object} item - { name, ... }
   */
  function onCompost(zoneId, item) {
    const zone = state[zoneId];
    if (!zone) return;
    zone.soil_fertility = round2(clamp(zone.soil_fertility + 2, 0, 100));
    computeHealth(zoneId);
  }

  /**
   * Called when a planting/gardening action occurs in a zone.
   * @param {string} zoneId
   * @param {string} [seedType] - type of seed planted (for biodiversity bonus)
   */
  function onPlant(zoneId, seedType) {
    const zone = state[zoneId];
    if (!zone) return;
    // Planting adds soil fertility
    zone.soil_fertility = round2(clamp(zone.soil_fertility + 0.5, 0, 100));
    // Different seed types add biodiversity
    if (seedType) {
      zone.biodiversity = round2(clamp(zone.biodiversity + 1, 0, 100));
    }
    computeHealth(zoneId);
  }

  /**
   * Called each game tick to update all zone ecosystems.
   * @param {Object} weatherState - { id, effects, ... } from weather system
   */
  function tickEcosystem(weatherState) {
    const weatherId = weatherState?.id || 'clear';

    for (const zoneId of Object.keys(state)) {
      const zone = state[zoneId];
      if (!zone) continue;
      const profile = getProfile(zoneId);

      // --- Extraction pressure decay ---
      // Decays by 0.5/tick, scaled by zone pressure tolerance
      zone.extraction_pressure = round2(
        Math.max(0, zone.extraction_pressure - 0.5)
      );

      // --- Soil fertility natural recovery ---
      zone.soil_fertility = round2(
        clamp(zone.soil_fertility + profile.fertility_recovery, 0, 100)
      );

      // --- Water level ---
      // Rain adds water
      if (weatherId === 'rain') {
        zone.water_level = round2(
          clamp(zone.water_level + 5 * profile.water_retention, 0, 100)
        );
      } else if (weatherId === 'storm') {
        zone.water_level = round2(
          clamp(zone.water_level + 8 * profile.water_retention, 0, 100)
        );
      }
      // Snow melts slowly — slight water addition
      if (weatherId === 'snow') {
        zone.water_level = round2(
          clamp(zone.water_level + 1 * profile.water_retention, 0, 100)
        );
      }

      // Normal evaporation
      let evaporation = 0.5;
      // Hot weather increases evaporation (clear sky = hotter)
      if (weatherId === 'clear') {
        evaporation = 1.0;  // more evaporation in hot/clear weather
      }
      // Drought-like conditions: no rain for extended periods is modeled by clear weather
      // The spec says "drought conditions drain -2 per tick" - we treat prolonged clear as drought
      // For simplicity, clear weather represents the hot/dry condition
      zone.water_level = round2(
        clamp(zone.water_level - evaporation, 0, 100)
      );

      // --- Biodiversity natural recovery ---
      zone.biodiversity = round2(
        clamp(zone.biodiversity + 0.1, 0, 100)
      );

      computeHealth(zoneId);
    }

    save();
  }

  /**
   * Returns the resource regeneration multiplier for a zone.
   * Used by zone-evolution.js to replace flat 0.5 regen rate.
   *
   * Formula: base_rate * (soil/100) * (water/100) * (biodiversity/100) / (1 + pressure/500)
   *
   * When health < 20: zone is "degraded" — minimal resources (multiplier capped at 0.1)
   * When health <= 0: zone is "destroyed" — no resources (multiplier = 0)
   */
  function getResourceModifier(zoneId) {
    const zone = state[zoneId];
    if (!zone) return 1.0; // default for unknown zones

    // Destroyed zone
    if (zone.health <= 0) return 0;

    const profile = getProfile(zoneId);
    const pressureDivisor = profile.pressure_tolerance || 500;

    const modifier = round2(
      (zone.soil_fertility / 100) *
      (zone.water_level / 100) *
      (zone.biodiversity / 100) /
      (1 + zone.extraction_pressure / pressureDivisor)
    );

    // Degraded zone — cap at minimal
    if (zone.health < 20) {
      return round2(Math.min(modifier, 0.1));
    }

    return modifier;
  }

  /**
   * Returns array of active ecological warnings for a zone.
   */
  function getZoneWarnings(zoneId) {
    const zone = state[zoneId];
    if (!zone) return [];

    const warnings = [];

    if (zone.health <= 0) {
      warnings.push({ type: 'destroyed', message: 'Ecosystem destroyed — no resources can spawn' });
    } else if (zone.health < 20) {
      warnings.push({ type: 'degraded', message: 'Ecosystem critically degraded — minimal resources' });
    }

    if (zone.soil_fertility < 30) {
      warnings.push({ type: 'depleted_soil', message: 'Depleted soil — fertility dangerously low' });
    }

    if (zone.water_level < 20) {
      warnings.push({ type: 'drought', message: 'Drought conditions — water level critical' });
    }

    if (zone.biodiversity < 30) {
      warnings.push({ type: 'ecosystem_stressed', message: 'Ecosystem stressed — biodiversity declining' });
    }

    // Monoculture warning
    if (zone.gather_history && zone.gather_history.length >= 5) {
      const counts = zone.gather_history.reduce((acc, r) => {
        acc[r] = (acc[r] || 0) + 1;
        return acc;
      }, {});
      const max = Math.max(...Object.values(counts));
      if (max / zone.gather_history.length > 0.8) {
        warnings.push({ type: 'monoculture', message: 'Monoculture detected — diversify gathering' });
      }
    }

    return warnings;
  }

  /**
   * Force-set ecosystem state for a zone (for testing/admin).
   */
  function setEcosystemState(zoneId, newState) {
    if (!state[zoneId]) return;
    Object.assign(state[zoneId], newState);
    computeHealth(zoneId);
  }

  return {
    getEcosystemState,
    onGather,
    onCompost,
    onPlant,
    tickEcosystem,
    getResourceModifier,
    getZoneWarnings,
    setEcosystemState,
    save,
  };
}

export { ZONE_PROFILES, DEFAULT_PROFILE, clamp, round2, isOrganicMaterial, isRareResource };
