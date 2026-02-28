// Weather System — Full Atmospheric Simulation
// Weather emerges from physical atmosphere state (moisture, pressure, wind, temperature)
// instead of random selection from a list.

export function initWeather({ loadJSON, saveJSON, broadcast, addWorldNews }) {
  // --- Constants ---
  const GAME_DAY_MS = 60 * 60 * 1000; // 1 real hour = 1 game day
  const GAME_EPOCH = new Date('2026-01-01T00:00:00Z').getTime();
  const SEASON_LENGTH = 30; // game days per season
  const TICK_INTERVAL = 5 * 60 * 1000; // check every 5 real minutes (~2 game hours)

  // Season baselines: affect temperature and moisture tendencies
  const SEASON_PROFILES = {
    spring: { base_temp: 15, moisture_tendency: 0.6, pressure_variability: 0.5, wind_base: 8 },
    summer: { base_temp: 30, moisture_tendency: 0.3, pressure_variability: 0.3, wind_base: 6 },
    autumn: { base_temp: 12, moisture_tendency: 0.5, pressure_variability: 0.7, wind_base: 12 },
    winter: { base_temp: -2, moisture_tendency: 0.4, pressure_variability: 0.4, wind_base: 10 },
  };

  // Terrain microclimate modifiers (keyed by terrain type)
  const TERRAIN_MICROCLIMATES = {
    cave:     { temp_offset: -8, moisture_offset: 10, wind_mult: 0.1, pressure_offset: 0 },
    sand:     { temp_offset: 3,  moisture_offset: 15, wind_mult: 1.3, pressure_offset: 0 },
    grass:    { temp_offset: 0,  moisture_offset: 5,  wind_mult: 0.7, pressure_offset: 0 },
    rocky:    { temp_offset: -3, moisture_offset: -5,  wind_mult: 1.5, pressure_offset: -5 },
    forest:   { temp_offset: -1, moisture_offset: 5,  wind_mult: 0.4, pressure_offset: 0 },
    path:     { temp_offset: 1,  moisture_offset: -5,  wind_mult: 0.8, pressure_offset: 0 },
    coast:    { temp_offset: 2,  moisture_offset: 10,  wind_mult: 1.2, pressure_offset: 0 },
    swamp:    { temp_offset: 1,  moisture_offset: 20,  wind_mult: 0.3, pressure_offset: 0 },
    mountain: { temp_offset: -10, moisture_offset: -5, wind_mult: 2.5, pressure_offset: -10 },
    water:    { temp_offset: -2,  moisture_offset: 20, wind_mult: 1.5, pressure_offset: 0 },
  };

  // Weather type definitions (for display + effects)
  const WEATHER_TYPES = {
    clear:  { id: 'clear',  name: 'Clear',    emoji: '☀️', effects: {} },
    cloudy: { id: 'cloudy', name: 'Cloudy',   emoji: '☁️', effects: {} },
    rain:   { id: 'rain',   name: 'Rain',     emoji: '🌧️', effects: { grass: 1.5, sand: 0.7 } },
    storm:  { id: 'storm',  name: 'Storm',    emoji: '⛈️', effects: { rocky_rare: 1.5, cave_blocked: true } },
    snow:   { id: 'snow',   name: 'Snow',     emoji: '❄️', effects: { movement_penalty: 0.8, snow_crystals: true } },
    fog:    { id: 'fog',    name: 'Fog',       emoji: '🌫️', effects: { hidden_items: true } },
    heatwave: { id: 'heatwave', name: 'Heat Wave', emoji: '🔥', effects: { energy_drain: true } },
  };

  // --- State ---
  let atmosphere = loadJSON('world-weather.json', null);
  if (!atmosphere || !atmosphere.moisture) {
    // Initialize with fresh atmosphere
    atmosphere = {
      moisture: 40,       // 0-100: global moisture level
      pressure: 1013,     // 950-1050 hPa
      wind_speed: 8,      // 0-60 km/h
      temperature: 18,    // -10 to 45°C (global, before zone modifiers)
      wind_direction: 180, // 0-360 degrees
      current: 'clear',   // derived weather type
      changedAt: Date.now(),
      tickCount: 0,
      // Cycle state for natural oscillation
      pressure_phase: Math.random() * Math.PI * 2,
      moisture_phase: Math.random() * Math.PI * 2,
    };
    saveAtmosphere();
  }

  function saveAtmosphere() {
    saveJSON('world-weather.json', atmosphere);
  }

  // --- Game time helpers ---
  function getGameTime() {
    const elapsed = Date.now() - GAME_EPOCH;
    const dayCount = Math.floor(elapsed / GAME_DAY_MS);
    const dayProgress = (elapsed % GAME_DAY_MS) / GAME_DAY_MS;
    const hour = Math.floor(dayProgress * 24);
    return { hour, dayCount, dayProgress };
  }

  function getSeason() {
    const { dayCount } = getGameTime();
    const seasonIndex = Math.floor((dayCount % (SEASON_LENGTH * 4)) / SEASON_LENGTH);
    const seasons = ['spring', 'summer', 'autumn', 'winter'];
    return seasons[seasonIndex];
  }

  function getSeasonProgress() {
    const { dayCount } = getGameTime();
    return (dayCount % SEASON_LENGTH) / SEASON_LENGTH;
  }

  // --- Atmosphere simulation ---
  function tickAtmosphere() {
    const season = getSeason();
    const profile = SEASON_PROFILES[season];
    const { hour } = getGameTime();
    atmosphere.tickCount++;

    // Phase oscillation (creates natural pressure/moisture cycles over hours)
    atmosphere.pressure_phase += 0.05 + Math.random() * 0.03;
    atmosphere.moisture_phase += 0.04 + Math.random() * 0.02;

    // --- Pressure simulation ---
    // Oscillates around 1013 hPa with seasonal variability
    const pressureTarget = 1013 + Math.sin(atmosphere.pressure_phase) * 30 * profile.pressure_variability;
    // Drift toward target with some randomness
    const pressureDelta = (pressureTarget - atmosphere.pressure) * 0.15 + (Math.random() - 0.5) * 4;
    atmosphere.pressure = clamp(atmosphere.pressure + pressureDelta, 950, 1050);

    // --- Temperature simulation ---
    // Base from season + diurnal cycle (colder at night, warmer midday)
    const diurnalOffset = Math.sin((hour - 6) / 24 * Math.PI * 2) * 8; // ±8°C swing
    const tempTarget = profile.base_temp + diurnalOffset;
    // Cloud cover (high moisture) reduces diurnal swing
    const cloudDamping = atmosphere.moisture > 60 ? 0.5 : 1.0;
    const tempDelta = (tempTarget - atmosphere.temperature) * 0.12 * cloudDamping + (Math.random() - 0.5) * 1.5;
    atmosphere.temperature = clamp(atmosphere.temperature + tempDelta, -10, 45);

    // --- Moisture simulation ---
    // Moisture tendency from season + pressure effects
    const moistureTarget = profile.moisture_tendency * 100;
    // Low pressure pulls in moisture, high pressure pushes it away
    const pressureEffect = (1013 - atmosphere.pressure) * 0.15;
    const moistureDelta = (moistureTarget + pressureEffect - atmosphere.moisture) * 0.08 + (Math.random() - 0.5) * 3;

    // Rain/snow depletes moisture
    if (atmosphere.current === 'rain' || atmosphere.current === 'storm') {
      atmosphere.moisture = Math.max(0, atmosphere.moisture - 2);
    } else if (atmosphere.current === 'snow') {
      atmosphere.moisture = Math.max(0, atmosphere.moisture - 1);
    }
    atmosphere.moisture = clamp(atmosphere.moisture + moistureDelta, 0, 100);

    // --- Wind simulation ---
    // Wind speed responds to pressure gradients (lower pressure = more wind potential)
    const pressureGradient = Math.abs(1013 - atmosphere.pressure) / 50;
    const windTarget = profile.wind_base + pressureGradient * 15;
    const windDelta = (windTarget - atmosphere.wind_speed) * 0.1 + (Math.random() - 0.5) * 3;
    atmosphere.wind_speed = clamp(atmosphere.wind_speed + windDelta, 0, 60);

    // Wind direction drifts slowly
    atmosphere.wind_direction = (atmosphere.wind_direction + (Math.random() - 0.5) * 15 + 360) % 360;

    // --- Derive weather type from atmosphere ---
    const oldWeather = atmosphere.current;
    atmosphere.current = deriveWeatherType();
    atmosphere.changedAt = Date.now();

    saveAtmosphere();

    if (oldWeather !== atmosphere.current) {
      const w = getWeatherType(atmosphere.current);
      broadcast({ type: 'weatherChange', weather: w.id, name: w.name, emoji: w.emoji, effects: w.effects });
      addWorldNews('weather', null, 'World', `Weather changed to ${w.emoji} ${w.name}`, null);
    }
  }

  function deriveWeatherType() {
    const { moisture, pressure, wind_speed, temperature } = atmosphere;

    // Storm: high moisture + low pressure + high wind
    if (moisture > 65 && pressure < 990 && wind_speed > 20) return 'storm';
    // Snow: low temp + decent moisture
    if (temperature < 2 && moisture > 35) return 'snow';
    // Rain: high moisture + low-to-mid pressure
    if (moisture > 55 && pressure < 1010) return 'rain';
    // Fog: high moisture + still air + moderate temp
    if (moisture > 50 && wind_speed < 8 && temperature > 0 && temperature < 25) return 'fog';
    // Heat wave: very high temp + low moisture
    if (temperature > 35 && moisture < 25) return 'heatwave';
    // Cloudy: moderate moisture
    if (moisture > 40 && pressure < 1020) return 'cloudy';
    // Clear: default
    return 'clear';
  }

  // Start ticking
  setInterval(tickAtmosphere, TICK_INTERVAL);
  // First tick after 30 seconds
  setTimeout(tickAtmosphere, 30000);

  // --- Public API ---

  function getWeatherType(id) {
    return WEATHER_TYPES[id] || WEATHER_TYPES.clear;
  }

  function getCurrentWeather() {
    return getWeatherType(atmosphere.current);
  }

  function getAtmosphere() {
    return {
      moisture: Math.round(atmosphere.moisture * 10) / 10,
      pressure: Math.round(atmosphere.pressure * 10) / 10,
      wind_speed: Math.round(atmosphere.wind_speed * 10) / 10,
      temperature: Math.round(atmosphere.temperature * 10) / 10,
      wind_direction: Math.round(atmosphere.wind_direction),
      weather: atmosphere.current,
      season: getSeason(),
    };
  }

  function getZoneAtmosphere(zone) {
    const micro = TERRAIN_MICROCLIMATES[zone] || {};
    const base = getAtmosphere();
    return {
      ...base,
      temperature: Math.round((base.temperature + (micro.temp_offset || 0)) * 10) / 10,
      moisture: clamp(Math.round((base.moisture + (micro.moisture_offset || 0)) * 10) / 10, 0, 100),
      wind_speed: Math.round(base.wind_speed * (micro.wind_mult || 1) * 10) / 10,
      pressure: Math.round((base.pressure + (micro.pressure_offset || 0)) * 10) / 10,
    };
  }

  function getGatherModifier(zone) {
    const w = getCurrentWeather();
    if (w.effects[zone]) return w.effects[zone];
    // Heat wave reduces all gathering slightly
    if (atmosphere.current === 'heatwave') return 0.8;
    return 1.0;
  }

  function isCaveBlocked() {
    return atmosphere.current === 'storm';
  }

  function getWeatherForecast() {
    // Simple forecast based on current atmosphere trends
    const forecasts = [];
    const { moisture, pressure, temperature, wind_speed } = atmosphere;

    if (moisture > 60 && pressure < 1000) forecasts.push('Storm approaching');
    else if (moisture > 50 && pressure < 1010) forecasts.push('Rain likely');
    else if (temperature < 3 && moisture > 30) forecasts.push('Snow possible');
    else if (moisture > 45 && wind_speed < 6) forecasts.push('Fog may form');
    else if (temperature > 32 && moisture < 30) forecasts.push('Heat building');
    else if (pressure > 1020 && moisture < 35) forecasts.push('Clear skies expected');
    else forecasts.push('Stable conditions');

    return forecasts;
  }

  function setupRoutes(app) {
    app.get('/api/world/weather', (req, res) => {
      const w = getCurrentWeather();
      res.json({
        weather: w.id, name: w.name, emoji: w.emoji, effects: w.effects,
        atmosphere: getAtmosphere(),
        forecast: getWeatherForecast(),
        changedAt: atmosphere.changedAt,
      });
    });
  }

  return {
    setupRoutes,
    getCurrentWeather,
    getAtmosphere,
    getZoneAtmosphere,
    getGatherModifier,
    isCaveBlocked,
    getWeatherForecast,
    getSeason,
    WEATHER_TYPES,
    TERRAIN_MICROCLIMATES,
  };
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}
