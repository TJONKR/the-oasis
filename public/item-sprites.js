/**
 * Item Sprite System — Procedural pixel art generation
 * WorldBox style: clean pixel art, no outlines, top-left light source, 3-4 color ramps per material
 */

function seedRng(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return function() { h = (h * 1103515245 + 12345) & 0x7fffffff; return (h >> 16) / 32768; };
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

// Color palettes for different material categories
const STONE_COLORS = ['#8C7853', '#A08B6B', '#B5A584', '#6B5D42'];
const MINERAL_COLORS = ['#7A6F5D', '#958A78', '#B0A593', '#5C5346'];
const WOOD_COLORS = ['#8B4513', '#A0522D', '#D2691E', '#654321'];
const PLANT_COLORS = ['#228B22', '#32CD32', '#7CFC00', '#006400'];
const FOOD_COLORS = ['#FF6347', '#FFA500', '#FFD700', '#FF4500'];
const DRIED_COLORS = ['#DEB887', '#D2B48C', '#F4A460', '#CD853F'];
const COOKED_COLORS = ['#DAA520', '#B8860B', '#FFD700', '#CD853F'];
const FERMENTED_COLORS = ['#8B4513', '#A0522D', '#CD853F', '#D2691E'];
const METAL_COLORS = ['#708090', '#778899', '#B0C4DE', '#2F4F4F'];

const MATERIAL_CATEGORIES = {
  // Stone/mineral items
  stone: 'stone', sand: 'stone', shells: 'stone', flint: 'stone',
  
  // Wood items
  driftwood: 'wood', wood: 'wood',
  
  // Plant/food items  
  herbs: 'plant', cactus_fruit: 'food', seaweed: 'plant', coconuts: 'food',
  berries: 'food', fruit: 'food', nuts: 'food', mushrooms: 'food', fish: 'food',
  
  // Special items
  'Corpse': 'corpse', 'Bones': 'bone',
  'Compost': 'plant'
};

const spriteCache = new Map();

function getCategoryColors(category, properties) {
  let baseColors;
  
  // Determine base colors by category
  switch (category) {
    case 'stone': baseColors = STONE_COLORS; break;
    case 'wood': baseColors = WOOD_COLORS; break;
    case 'plant': baseColors = PLANT_COLORS; break;
    case 'food': baseColors = FOOD_COLORS; break;
    case 'corpse': baseColors = ['#8B4513', '#654321', '#4A2C17', '#2F1B0C']; break;
    case 'bone': baseColors = ['#F5F5DC', '#DDBF8F', '#C8B99C', '#A0826D']; break;
    default: baseColors = STONE_COLORS; break;
  }
  
  // Apply property-based modifications
  if (properties) {
    // Dried items
    if (properties.decay_rate <= 0.02) {
      baseColors = DRIED_COLORS;
    }
    
    // Cooked/fermented items (check name for now)
    // In a real implementation, we'd have better properties for this
    
    // High energy items get green accent
    if (properties.energy > 15) {
      baseColors = [...baseColors, '#32CD32'];
    }
    
    // Flammable items get red-orange tint
    if (properties.flammability > 6) {
      baseColors = baseColors.map(c => tintColor(c, '#FF4500', 0.2));
    }
    
    // Hard items get grey tint
    if (properties.hardness > 5) {
      baseColors = baseColors.map(c => tintColor(c, '#708090', 0.15));
    }
    
    // High melt point items get metallic sheen
    if (properties.melt_point > 800) {
      baseColors = METAL_COLORS;
    }
  }
  
  return baseColors;
}

function tintColor(baseHex, tintHex, strength) {
  const base = hexToRgb(baseHex);
  const tint = hexToRgb(tintHex);
  const r = Math.round(base.r * (1 - strength) + tint.r * strength);
  const g = Math.round(base.g * (1 - strength) + tint.g * strength);
  const b = Math.round(base.b * (1 - strength) + tint.b * strength);
  return rgbToHex(r, g, b);
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16), 
    b: parseInt(result[3], 16)
  } : {r: 0, g: 0, b: 0};
}

function rgbToHex(r, g, b) {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function darken(hex, amount = 40) {
  const rgb = hexToRgb(hex);
  const r = Math.max(0, rgb.r - amount);
  const g = Math.max(0, rgb.g - amount);
  const b = Math.max(0, rgb.b - amount);
  return rgbToHex(r, g, b);
}

function generateItemSprite(itemName, properties) {
  const cacheKey = itemName;
  if (spriteCache.has(cacheKey)) return spriteCache.get(cacheKey);
  
  const rng = seedRng(itemName);
  const category = MATERIAL_CATEGORIES[itemName] || 
    MATERIAL_CATEGORIES[itemName.toLowerCase()] || 'stone';
  
  const colors = getCategoryColors(category, properties);
  const primaryColor = pick(rng, colors);
  const highlightColor = colors[Math.min(colors.length - 1, colors.indexOf(primaryColor) + 1)] || primaryColor;
  const shadowColor = darken(primaryColor, 60);
  
  // Determine sprite size and shape based on category
  let spriteData;
  
  switch (category) {
    case 'stone':
      spriteData = generateStoneSprite(rng, primaryColor, highlightColor, shadowColor);
      break;
    case 'wood':
      spriteData = generateWoodSprite(rng, primaryColor, highlightColor, shadowColor);
      break;
    case 'plant':
      spriteData = generatePlantSprite(rng, primaryColor, highlightColor, shadowColor);
      break;
    case 'food':
      spriteData = generateFoodSprite(rng, primaryColor, highlightColor, shadowColor);
      break;
    case 'corpse':
      spriteData = generateCorpseSprite(rng, primaryColor, highlightColor, shadowColor);
      break;
    case 'bone':
      spriteData = generateBoneSprite(rng, primaryColor, highlightColor, shadowColor);
      break;
    default:
      spriteData = generateStoneSprite(rng, primaryColor, highlightColor, shadowColor);
      break;
  }
  
  // Add luminosity glow if applicable
  if (properties && properties.luminosity > 0) {
    spriteData = addGlow(spriteData, '#FFFF00');
  }
  
  spriteCache.set(cacheKey, spriteData);
  return spriteData;
}

function generateStoneSprite(rng, primary, highlight, shadow) {
  // Rounded blob, 3x3 to 4x4
  const size = rng() > 0.5 ? 3 : 4;
  const pixels = [];
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Create rounded shape
      const centerX = size / 2 - 0.5;
      const centerY = size / 2 - 0.5;
      const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      
      if (dist <= size / 2) {
        let color = primary;
        
        // Top-left highlight
        if (x === 0 && y === 0 && size > 3) color = highlight;
        else if (x <= 1 && y <= 1) color = highlight;
        
        // Bottom-right shadow
        else if (x === size - 1 && y === size - 1) color = shadow;
        else if (x >= size - 2 && y >= size - 2 && rng() > 0.5) color = shadow;
        
        pixels.push({ x, y, color });
      }
    }
  }
  
  return pixels;
}

function generateWoodSprite(rng, primary, highlight, shadow) {
  // Horizontal stick shape, 5x2 to 6x3
  const width = rng() > 0.5 ? 5 : 6;
  const height = rng() > 0.6 ? 2 : 3;
  const pixels = [];
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let color = primary;
      
      // Top edge highlight
      if (y === 0) color = highlight;
      
      // Bottom edge shadow
      else if (y === height - 1) color = shadow;
      
      // Add some wood grain
      if (x % 2 === 0 && rng() > 0.7) color = darken(color, 20);
      
      pixels.push({ x, y, color });
    }
  }
  
  return pixels;
}

function generatePlantSprite(rng, primary, highlight, shadow) {
  // Organic shape, 3x4
  const pixels = [];
  
  // Create a small organic blob
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 3; x++) {
      if ((x === 1) || (x === 0 && y >= 1 && y <= 2) || (x === 2 && y >= 1 && y <= 2)) {
        let color = primary;
        
        // Top highlight
        if (y === 0) color = highlight;
        
        // Bottom shadow
        if (y === 3) color = shadow;
        
        // Random variation
        if (rng() > 0.8) color = darken(color, 15);
        
        pixels.push({ x, y, color });
      }
    }
  }
  
  return pixels;
}

function generateFoodSprite(rng, primary, highlight, shadow) {
  // Small rounded food item, 3x3 to 4x4
  const size = rng() > 0.4 ? 3 : 4;
  const pixels = [];
  
  // Create rounded food shape
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if ((x === 0 && y === 0) || (x === size-1 && y === size-1)) {
        continue; // Skip corners for rounded look
      }
      
      let color = primary;
      
      // Highlight on top-left
      if (x === 0 || y === 0) color = highlight;
      
      // Shadow on bottom-right
      else if (x === size-1 || y === size-1) color = shadow;
      
      pixels.push({ x, y, color });
    }
  }
  
  return pixels;
}

function generateCorpseSprite(rng, primary, highlight, shadow) {
  // Larger, more complex shape for corpse, 5x4
  const pixels = [];
  
  // Body shape
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 5; x++) {
      if ((y === 1 || y === 2) || (x >= 1 && x <= 3 && (y === 0 || y === 3))) {
        let color = primary;
        
        if (x === 0 || y === 0) color = highlight;
        else if (x === 4 || y === 3) color = shadow;
        
        pixels.push({ x, y, color });
      }
    }
  }
  
  return pixels;
}

function generateBoneSprite(rng, primary, highlight, shadow) {
  // Bone shape, 4x2
  const pixels = [];
  
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 4; x++) {
      let color = primary;
      
      if (y === 0) color = highlight;
      else if (y === 1) color = shadow;
      
      pixels.push({ x, y, color });
    }
  }
  
  return pixels;
}

function addGlow(spriteData, glowColor) {
  // Add a glow pixel around the sprite
  const maxX = Math.max(...spriteData.map(p => p.x));
  const maxY = Math.max(...spriteData.map(p => p.y));
  const glowPixels = [...spriteData];
  
  // Add glow pixel at top-right corner
  glowPixels.push({ x: maxX + 1, y: 0, color: glowColor });
  
  return glowPixels;
}

function drawItemSprite(ctx, spriteData, x, y, scale = 1) {
  for (const pixel of spriteData) {
    ctx.fillStyle = pixel.color;
    ctx.fillRect(x + pixel.x * scale, y + pixel.y * scale, scale, scale);
  }
}

function getRandomOffset(rng, spread = 3) {
  return {
    x: Math.floor((rng() - 0.5) * spread),
    y: Math.floor((rng() - 0.5) * spread)
  };
}

// Export for use in world.html
window.ItemSprites = {
  generateItemSprite,
  drawItemSprite,
  getRandomOffset,
  seedRng
};