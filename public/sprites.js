/**
 * WorldBox-style minimalistic pixel characters
 * ~8x10 pixels, blocky, simple silhouettes with color variety
 */

function seedRng(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return function() { h = (h * 1103515245 + 12345) & 0x7fffffff; return (h >> 16) / 32768; };
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const SKIN = ['#FFDCB2','#F5C6A0','#E8B48A','#D4956B','#B87A50','#8D5E3C','#6B4226','#4A2D1A'];
const HAIR = ['#2C1810','#4A3728','#6B4E32','#8B6914','#C4A35A','#E8D5A0','#D44E28','#1A1A1A','#F0F0F0'];
const SHIRT = [
  '#8B2500','#A0522D','#CD853F','#2E5E1A','#4A8C2C','#1A3A6E','#3E72C4',
  '#6E1A1A','#B03030','#5C4A8E','#D4A020','#4A4A4A','#F0E6D0','#2080A0',
];
const PANTS = ['#3C2A14','#2A2A3C','#4A6032','#6E5A3C','#1A1A2E','#384A22'];
const HATS = ['none','none','none','none','hood','straw','helmet','crown','bandana','wizard','cowboy'];

function dk(hex, n=40) {
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return `rgb(${Math.max(0,r-n)},${Math.max(0,g-n)},${Math.max(0,b-n)})`;
}

const spriteCache = new Map();
const SW = 10, SH = 12;

function generateSprite(agentId) {
  if (spriteCache.has(agentId)) return spriteCache.get(agentId);
  const rng = seedRng(agentId);
  
  const skin = pick(rng, SKIN);
  const hair = pick(rng, HAIR);
  const shirt = pick(rng, SHIRT);
  const pants = pick(rng, PANTS);
  const hat = pick(rng, HATS);
  const boot = pick(rng, ['#3C2A14','#2A2A2A','#4E3820']);
  
  const oc = document.createElement('canvas');
  oc.width = SW; oc.height = SH;
  const c = oc.getContext('2d');
  c.imageSmoothingEnabled = false;
  
  const px = (x,y,col) => { c.fillStyle = col; c.fillRect(x,y,1,1); };
  const rect = (x,y,w,h,col) => { c.fillStyle = col; c.fillRect(x,y,w,h); };

  // Boots (y:10-11)
  rect(3,10,2,1,boot);
  rect(6,10,2,1,boot);
  px(2,10,dk(boot)); // toe
  px(7,10,dk(boot));
  
  // Legs (y:8-10)
  rect(3,8,2,2,pants);
  rect(6,8,2,2,pants);
  
  // Body (y:4-8)
  rect(3,4,5,4,shirt);
  px(3,4,dk(shirt)); // shadow edges
  px(7,4,dk(shirt));
  
  // Arms (y:5-7)
  rect(2,5,1,3,shirt);
  rect(8,5,1,3,shirt);
  // Hands
  px(2,7,skin);
  px(8,7,skin);
  
  // Head (y:1-4)
  rect(3,1,5,3,skin);
  // Eyes
  px(4,2,'#1A1A1A');
  px(6,2,'#1A1A1A');
  
  // Hair (on top + sides)
  if (hat === 'none' || hat === 'bandana' || hat === 'crown') {
    rect(3,0,5,1,hair);
    px(3,1,hair);
    px(7,1,hair);
    if (rng() > 0.5) { // long hair
      px(2,1,hair); px(2,2,hair);
      px(8,1,hair); px(8,2,hair);
    }
  }
  
  // Hats
  if (hat === 'hood') {
    rect(2,0,7,2,dk(shirt));
    px(2,2,dk(shirt));
    px(8,2,dk(shirt));
  } else if (hat === 'straw') {
    rect(2,0,7,1,'#D4C070');
    rect(3,0,5,1,'#E8D48A');
    px(1,0,'#C4B060'); px(9,0,'#C4B060');
  } else if (hat === 'helmet') {
    rect(3,0,5,1,'#8A8A88');
    rect(2,0,7,1,'#AAAAAA');
    px(5,0,'#D4A020');
  } else if (hat === 'crown') {
    rect(3,0,5,1,'#D4A020');
    px(3,0,'#E8C840'); px(5,0,'#E01010'); px(7,0,'#E8C840');
  } else if (hat === 'bandana') {
    rect(3,0,5,1,'#C02020');
    px(2,1,'#C02020');
  } else if (hat === 'wizard') {
    rect(3,0,5,1,'#5C4A8E');
    rect(4,-1,3,1,'#5C4A8E');
    px(5,-2,'#7B62B8');
  } else if (hat === 'cowboy') {
    rect(2,0,7,1,'#8B6914');
    rect(3,-1,5,1,'#A07A1A');
    px(1,0,'#6B5010'); px(9,0,'#6B5010');
  }

  // Shadow under feet
  c.fillStyle = 'rgba(0,0,0,0.15)';
  c.fillRect(2, 11, 7, 1);

  const result = { canvas: oc, w: SW, h: SH };
  spriteCache.set(agentId, result);
  return result;
}

function drawAgentSprite(ctx, agent, tileSize) {
  const sprite = generateSprite(agent.id);
  // Scale: sprite should be about 1 tile tall
  const scale = tileSize / sprite.h;
  const drawW = sprite.w * scale;
  const drawH = sprite.h * scale;
  const x = agent.tileX * tileSize + tileSize/2 - drawW/2;
  const y = agent.tileY * tileSize + tileSize - drawH;
  ctx.drawImage(sprite.canvas, x, y, drawW, drawH);
}

window.drawAgentSprite = drawAgentSprite;
window.generateSprite = generateSprite;
