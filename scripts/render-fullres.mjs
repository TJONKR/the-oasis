#!/usr/bin/env node
/**
 * Full-resolution renderer: 1 pixel per tile → 2000×2000 PNG
 * Reuses the same palette/logic from render.mjs but outputs at native resolution.
 */
import { readFileSync, writeFileSync } from 'fs';
import { deflateSync } from 'zlib';
import Alea from 'alea';
import { createNoise2D } from 'simplex-noise';

const clamp=v=>Math.max(0,Math.min(255,v|0));

function makePNG(buf,w,h){
  const raw=Buffer.alloc(h*(1+w*3));
  for(let y=0;y<h;y++){raw[y*(1+w*3)]=0;buf.copy(raw,y*(1+w*3)+1,y*w*3,(y+1)*w*3);}
  const idat=deflateSync(raw,{level:6});
  function crc32(d){let c=0xffffffff;for(let i=0;i<d.length;i++){c^=d[i];for(let j=0;j<8;j++)c=(c>>>1)^(c&1?0xedb88320:0);}return(c^0xffffffff)>>>0;}
  function chunk(t,d){const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc32(td));return Buffer.concat([l,td,c]);}
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',(()=>{const b=Buffer.alloc(13);b.writeUInt32BE(w,0);b.writeUInt32BE(h,4);b[8]=8;b[9]=2;return b;})()),chunk('IDAT',idat),chunk('IEND',Buffer.alloc(0))]);
}

const worldPath=process.argv[2]||'output/world.json';
console.log('Loading...');
const world=JSON.parse(readFileSync(worldPath,'utf-8'));
const{width,height,terrain,decorations,tileDefs,decoTints}=world;
const defById=new Map();for(const d of tileDefs)defById.set(d.id,d);

console.log(`World: ${width}x${height}`);
console.log('Building maps...');

const BI={ocean:0,beach:1,grassland:2,forest:3,desert:4,mountain:5,tundra:6,swamp:7};
const bm=new Uint8Array(width*height);
for(let i=0;i<terrain.length;i++){const d=defById.get(terrain[i]);bm[i]=d?(BI[d.biome]??0):0;}

// Distance from land (ocean depth bands)
const distL=new Int16Array(width*height).fill(-1);
const q=[];for(let i=0;i<bm.length;i++)if(bm[i]!==0){distL[i]=0;q.push(i);}
let qi=0;while(qi<q.length){const ci=q[qi++];const cx=ci%width,cy=(ci/width)|0,cd=distL[ci];if(cd>=40)continue;for(const[dx,dy]of[[-1,0],[1,0],[0,-1],[0,1]]){const nx=cx+dx,ny=cy+dy;if(nx<0||nx>=width||ny<0||ny>=height)continue;const ni=ny*width+nx;if(distL[ni]===-1){distL[ni]=cd+1;q.push(ni);}}}

// Shore adjacency
const shoreAdj=new Uint8Array(width*height);
for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*width+x;if(bm[i]===0)continue;let m=0;if(y>0&&bm[i-width]===0)m|=1;if(x<width-1&&bm[i+1]===0)m|=2;if(y<height-1&&bm[i+width]===0)m|=4;if(x>0&&bm[i-1]===0)m|=8;shoreAdj[i]=m;}

// Noise for elevation
const prng=Alea(world.seed||'oasis');
const noise2D=createNoise2D(prng);
function fbm(x,y,freq,oct){let v=0,f=freq,a=1,m=0;for(let i=0;i<oct;i++){v+=noise2D(x*f,y*f)*a;m+=a;f*=2;a*=0.5;}return(v/m+1)/2;}

// Rivers
console.log('Rivers...');
const riverSet=new Set();
const elev=new Float32Array(width*height);
for(let i=0;i<width*height;i++){const x=i%width,y=(i/width)|0;elev[i]=fbm(x,y,0.003,4);}
// Simple river: trace downhill from high points
function traceRiver(sx,sy){const pts=[];let x=sx,y=sy;for(let step=0;step<2000;step++){const i=y*width+x;if(bm[i]===0)break;pts.push(i);riverSet.add(i);let best=-1,bestE=elev[i];for(const[dx,dy]of[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]]){const nx=x+dx,ny=y+dy;if(nx<0||nx>=width||ny<0||ny>=height)continue;const ni=ny*width+nx;if(elev[ni]<bestE&&!riverSet.has(ni)){bestE=elev[ni];best=ni;}}if(best===-1)break;x=best%width;y=(best/width)|0;}return pts;}
// Seed a few rivers from mountain peaks
const mountainTiles=[];for(let i=0;i<bm.length;i++)if(bm[i]===5&&elev[i]>0.7)mountainTiles.push(i);
const rngR=Alea((world.seed||'oasis')+'rivers');
for(let r=0;r<Math.min(8,mountainTiles.length);r++){const idx=mountainTiles[(rngR()*mountainTiles.length)|0];traceRiver(idx%width,(idx/width)|0);}

// Palettes
const PALETTES={
  ocean:[
    [0x5C,0xB8,0xE0],[0x48,0x9E,0xCC],[0x38,0x8A,0xBC],[0x2E,0x7A,0xAC],
    [0x24,0x68,0x9C],[0x1C,0x58,0x8C],[0x16,0x48,0x7C],[0x10,0x38,0x6C],
  ],
  beach:    [0xD4,0xC0,0x7A],
  grassland:[0x5A,0x9C,0x4A],
  forest:   [0x38,0x7A,0x2E],
  desert:   [0xC4,0xA8,0x5A],
  mountain: [0x8A,0x8A,0x88],
  tundra:   [0xCC,0xCC,0xCC],
  swamp:    [0x5A,0x7A,0x4A],
};

function getTileColor(x,y){
  const i=y*width+x;
  const b=bm[i];
  
  // River
  if(riverSet.has(i)) return [0x48,0x9E,0xCC];
  
  // Ocean with depth bands
  if(b===0){
    const d=distL[i]===-1?40:distL[i];
    const band=Math.min(7,Math.floor(d/5));
    return PALETTES.ocean[band];
  }
  
  const biome=['ocean','beach','grassland','forest','desert','mountain','tundra','swamp'][b];
  const base=PALETTES[biome]||[128,128,128];
  
  // Checkerboard dither
  const checker=((x+y)%2===0)?4:-4;
  
  // Elevation shading
  const e=elev[i];
  const shade=(e-0.5)*30;
  
  return [clamp(base[0]+checker+shade),clamp(base[1]+checker+shade),clamp(base[2]+checker+shade)];
}

// Render full resolution
console.log('Rendering full 2000x2000...');
const buf=Buffer.alloc(width*height*3);
for(let y=0;y<height;y++){
  for(let x=0;x<width;x++){
    const c=getTileColor(x,y);
    const idx=(y*width+x)*3;
    
    // Decorations (trees = darker green tint)
    let r=c[0],g=c[1],b2=c[2];
    const did=decorations?.[y*width+x];
    if(did){
      const dd=defById.get(did);
      if(dd?.name?.includes('tree')){r=clamp(r*0.7+0x28*0.3);g=clamp(g*0.7+0x78*0.3);b2=clamp(b2*0.7+0x2C*0.3);}
      else if(dd?.name?.includes('flower')){r=clamp(r*0.7+0xE0*0.3);g=clamp(g*0.8);b2=clamp(b2*0.7+0x40*0.3);}
      else if(dd?.name?.includes('rock')){r=clamp(r*0.8+0x70*0.2);g=clamp(g*0.8+0x70*0.2);b2=clamp(b2*0.8+0x70*0.2);}
    }
    
    // Shore shadow
    if(shoreAdj[y*width+x]){r=clamp(r-25);g=clamp(g-25);b2=clamp(b2-25);}
    
    buf[idx]=r;buf[idx+1]=g;buf[idx+2]=b2;
  }
  if(y%500===0)console.log(`  ${y}/${height}...`);
}

console.log('Encoding PNG...');
const png=makePNG(buf,width,height);
writeFileSync('output/world-fullres.png',png);
console.log(`Saved output/world-fullres.png (${(png.length/1024/1024).toFixed(1)} MB)`);

// Also copy to public for the viewer
writeFileSync('public/world-overview.png',png);
console.log('Copied to public/world-overview.png');
console.log('Done!');
