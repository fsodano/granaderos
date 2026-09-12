import {readFile,writeFile} from 'node:fs/promises';
import sharp from '../web/node_modules/sharp/lib/index.js';
import {SPRITE_APPEARANCES} from '../game/sprite-appearances.js';
import {ILLUSTRATED_SEQUENCES} from './illustrated-sprite-prompts.mjs';

const root='assets/previews/illustrated-sprites';
const manifest=JSON.parse(await readFile(`${root}/packed/manifest.json`,'utf8'));
const directions=manifest.directions;
const names=Object.keys(SPRITE_APPEARANCES).map(id=>`${id}-idle`).filter(name=>manifest.atlases[name]);
const tiles=[];
const label=(text,width=1248,height=30)=>Buffer.from(`<svg width="${width}" height="${height}"><text x="12" y="22" fill="#ece4d6" font-family="sans-serif" font-size="16">${text}</text></svg>`);
tiles.push({input:label('Legacy sprites — 3× zoom'),left:0,top:0});
tiles.push({input:await sharp('web/public/art/pixel/granadero-idle-atlas.png').resize(1248,156,{kernel:'nearest'}).png().toBuffer(),left:0,top:30});
for(const [i,name] of names.entries()){
 const top=186*(i+1);
 tiles.push({input:label(`${name} — new source at the same map scale`),left:0,top});
 tiles.push({input:await sharp(`${root}/packed/${name}.png`).png().toBuffer(),left:0,top:top+30});
}
await sharp({create:{width:1248,height:186*(names.length+1),channels:3,background:'#676658'}}).composite(tiles).png().toFile(`${root}/comparison.png`);

const variety=[];
for(const [index,name] of names.entries()){
 const entry=manifest.atlases[name],left=index%5*180,top=Math.floor(index/5)*188;
 variety.push({input:label(name.replace(/-idle$/,''),180,30),left,top});
 variety.push({input:await sharp(`${root}/packed/${name}.png`).extract({left:3*entry.cell,top:0,width:entry.cell,height:entry.cell}).resize(156,156,{kernel:'nearest'}).png().toBuffer(),left:left+12,top:top+30});
}
await sharp({create:{width:900,height:Math.ceil(names.length/5)*188,channels:3,background:'#676658'}}).composite(variety).png().toFile(`${root}/variety.png`);

const items=Object.entries(manifest.atlases).map(([name,entry])=>{
 const appearance=Object.keys(SPRITE_APPEARANCES).find(id=>name.startsWith(id+'-'));
 return {name,appearance,sequence:name.slice(appearance.length+1),...entry};
});
const sequences=[...new Set(items.map(item=>item.sequence))];
const expected=Object.keys(SPRITE_APPEARANCES).flatMap(id=>(id==='civilian'?['idle','walk','dead-idle','unconscious-breathe']:ILLUSTRATED_SEQUENCES).map(sequence=>`${id}-${sequence}`));
const coverage=expected.every(name=>manifest.atlases[name])
 ? `All ${expected.length} applicable atlases are present across ${Object.keys(SPRITE_APPEARANCES).length} shared appearances.`
 : `${items.length} of ${expected.length} applicable atlases are present. Replacement is in progress.`;
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Granaderos sprite art review</title>
<style>body{background:#232a28;color:#e7e0cf;font:16px system-ui;margin:24px}h1{font-size:24px}p{max-width:75ch}button,select{font:inherit;padding:6px;background:#374440;color:inherit;border:1px solid #75837c;border-radius:4px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:18px}.card{background:#666657;padding:12px;border-radius:4px}.frame{position:relative;overflow:hidden;margin:auto}.frame:before{content:'';position:absolute;top:0;bottom:0;left:var(--anchor-x);border-left:1px solid #faf4ba55}.frame:after{content:'';position:absolute;left:0;right:0;top:var(--anchor-y);border-top:1px solid #faf4ba55}img{position:absolute;max-width:none;image-rendering:pixelated}h2{font-size:14px}.timing{font-size:12px;color:#ddd6bd}header{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin:20px 0}</style>
<h1>Illustrated sprite art review</h1><p>${coverage} This page shows the selected staging atlases. Check identity, directions, alternating legs, and foot placement. Guides show each atlas's fixed map anchor; playback uses its own frame rate.</p>
<header><label>Appearance <select id="appearance"><option value="">All</option>${Object.keys(SPRITE_APPEARANCES).map(id=>`<option>${id}</option>`).join('')}</select></label><label>Action <select id="sequence"><option value="">All</option>${sequences.map(id=>`<option>${id}</option>`).join('')}</select></label><label>Direction <select id="direction">${directions.map((d,i)=>`<option value="${i}" ${i===3?'selected':''}>${d.toUpperCase()}</option>`).join('')}</select></label><label>Zoom <select id="zoom"><option value="1">1×</option><option value="2">2×</option><option value="3" selected>3×</option><option value="6">6× art inspection</option></select></label><button id="play">Pause</button><button id="step">Next frame</button></header><main></main>
<script>
const items=${JSON.stringify(items)},main=document.querySelector('main');let playing=true;
for(const item of items){const card=document.createElement('section');card.className='card';card.innerHTML='<h2>'+item.name+'</h2><div class="frame"><img src="packed/'+item.file+'"></div><p class="timing"></p>';main.append(card);item.card=card;item.element=card.querySelector('.frame');item.image=card.querySelector('img');item.timing=card.querySelector('.timing');item.elapsed=0;}
function draw(){
 const direction=Number(document.querySelector('#direction').value),zoom=Number(document.querySelector('#zoom').value),appearance=document.querySelector('#appearance').value,sequence=document.querySelector('#sequence').value;
 const visible=items.filter(item=>(!appearance||item.appearance===appearance)&&(!sequence||item.sequence===sequence));
 const width=Math.max(52,...visible.map(item=>item.logicalCell))*zoom;
 const top=Math.max(46,...visible.map(item=>item.anchor[1]*item.logicalCell/item.cell))*zoom;
 const bottom=Math.max(6,...visible.map(item=>(item.cell-item.anchor[1])*item.logicalCell/item.cell))*zoom;
 main.style.gridTemplateColumns='repeat(auto-fit,minmax('+Math.max(180,width+24)+'px,1fr))';
 for(const item of items){
  item.card.hidden=!visible.includes(item);
  const scale=zoom*item.logicalCell/item.cell,n=item.framesPerDirection,frame=n===1?0:Math.floor(item.elapsed*item.fps/1000)%n,col=n===1?direction:frame,row=n===1?0:direction;
  item.element.style.width=width+'px';item.element.style.height=(top+bottom)+'px';
  item.element.style.setProperty('--anchor-x',width/2+'px');item.element.style.setProperty('--anchor-y',top+'px');
  item.timing.textContent=n===1?'Still':'Frame '+(frame+1)+' / '+n+' · '+item.fps+' fps';
  Object.assign(item.image.style,{width:item.size[0]*scale+'px',height:item.size[1]*scale+'px',left:width/2-item.anchor[0]*scale-col*item.cell*scale+'px',top:top-item.anchor[1]*scale-row*item.cell*scale+'px'});
 }
}
for(const id of ['direction','zoom','appearance','sequence'])document.querySelector('#'+id).onchange=draw;
document.querySelector('#play').onclick=()=>{playing=!playing;document.querySelector('#play').textContent=playing?'Pause':'Play'};
document.querySelector('#step').onclick=()=>{playing=false;document.querySelector('#play').textContent='Play';for(const item of items)if(item.fps)item.elapsed=(Math.floor(item.elapsed*item.fps/1000)+1)*1000/item.fps;draw()};
setInterval(()=>{if(playing){for(const item of items)item.elapsed+=100;draw()}},100);draw();
</script></html>`;
await writeFile(`${root}/index.html`,html);
console.log(`Wrote ${root}/comparison.png and interactive animation review.`);
