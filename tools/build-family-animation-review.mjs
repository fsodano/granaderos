import fs from 'node:fs/promises';
import {SPRITE_APPEARANCES} from '../game/sprite-appearances.js';
import {FAMILY_SPRITE_SEQUENCES} from '../game/sprite-family-sequences.js';
const root='assets/previews/illustrated-sprites/family-actions';
const base=JSON.parse(await fs.readFile('assets/previews/illustrated-sprites/packed/manifest.json'));
const entries=[];
for(const appearance of Object.keys(SPRITE_APPEARANCES))for(const sequence of [...FAMILY_SPRITE_SEQUENCES,'dead-idle']){
 const name=`${appearance}-${sequence}`;let entry=base.atlases[name],url=`../packed/${entry?.file}`,staged=false;
 try{const m=JSON.parse(await fs.readFile(`${root}/${name}/manifest.json`));entry=m.atlases[name];url=`${name}/${entry.file}`;staged=true;}catch(e){if(e.code!=='ENOENT')throw e;}
 if(entry)entries.push({name,appearance,sequence,url,staged,cell:entry.cell,logicalCell:entry.logicalCell,anchor:entry.anchor,frames:entry.framesPerDirection,fps:entry.fps});
}
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Granaderos animation review</title>
<style>body{background:#15241c;color:#eee8cc;font:16px system-ui;margin:20px}header{position:sticky;top:0;background:#15241cf5;padding:12px;z-index:2}h1{font-size:24px}select,button,input{font:inherit;margin:4px;padding:8px}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}article{background:#253b2e;border:1px solid #a38d54;padding:12px}h2{font-size:16px;margin:0 0 8px}canvas{width:288px;height:288px;image-rendering:pixelated;background:#69735c}.meta{font-size:13px}</style>
<header><h1>Granaderos animation review</h1><label>Family <select id="family"><option value="">All</option></select></label><label>Action <select id="action"><option value="">All</option></select></label><label>Direction <select id="direction"></select></label><button id="pause">Pause</button><label>Frame <input id="phase" type="range" min="0" max="3" value="0"></label><label><input id="new" type="checkbox">New sheets only</label><p id="count"></p></header><main></main>
<script>const entries=${JSON.stringify(entries)},dirs=['N','NE','E','SE','S','SW','W','NW'];
const family=document.querySelector('#family'),action=document.querySelector('#action'),direction=document.querySelector('#direction'),phase=document.querySelector('#phase'),pause=document.querySelector('#pause'),onlyNew=document.querySelector('#new');
for(const [el,values] of [[family,[...new Set(entries.map(e=>e.appearance))]],[action,[...new Set(entries.map(e=>e.sequence))]],[direction,dirs]])for(const v of values){const o=document.createElement('option');o.value=v;o.textContent=v;el.append(o);}
let paused=false,cards=[];const images=new Map();
function render(){const shown=entries.filter(e=>(!family.value||e.appearance===family.value)&&(!action.value||e.sequence===action.value)&&(!onlyNew.checked||e.staged));document.querySelector('main').replaceChildren();cards=shown.map(e=>{const card=document.createElement('article'),h=document.createElement('h2'),c=document.createElement('canvas'),p=document.createElement('p');h.textContent=e.name;c.width=c.height=288;p.className='meta';p.textContent=e.frames+' frames × 8 directions · '+e.fps+' fps'+(e.staged?' · new':'');card.append(h,c,p);document.querySelector('main').append(card);let img=images.get(e.url);if(!img){img=new Image;img.src=e.url;images.set(e.url,img);}return{e,c,img};});document.querySelector('#count').textContent=shown.length+' animation sets';}
for(const el of [family,action,onlyNew])el.addEventListener('change',render);pause.onclick=()=>{paused=!paused;pause.textContent=paused?'Play':'Pause';};phase.oninput=()=>{paused=true;pause.textContent='Play';};
function tick(t){for(const {e,c,img} of cards){if(!img.complete||!img.naturalWidth)continue;const ctx=c.getContext('2d'),d=dirs.indexOf(direction.value),f=paused?Math.min(e.frames-1,+phase.value):Math.floor(t*e.fps/1000)%e.frames,scale=3/(e.cell/e.logicalCell);ctx.clearRect(0,0,288,288);ctx.imageSmoothingEnabled=false;ctx.strokeStyle='#b6ba8f';ctx.beginPath();ctx.moveTo(134,225);ctx.lineTo(154,225);ctx.moveTo(144,215);ctx.lineTo(144,235);ctx.stroke();ctx.drawImage(img,(e.frames===1?d:f)*e.cell,e.frames===1?0:d*e.cell,e.cell,e.cell,144-e.anchor[0]*scale,225-e.anchor[1]*scale,e.cell*scale,e.cell*scale);}requestAnimationFrame(tick);}
action.value='mounted-fire';render();requestAnimationFrame(tick);window.review={entries,cards:()=>cards};</script></html>`;
await fs.writeFile(`${root}/index.html`,html);console.log(`${entries.length} sets in review`);
