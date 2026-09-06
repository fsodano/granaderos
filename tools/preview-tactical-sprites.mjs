// Render the real React sprite component and tactical scene for offline art review.
// This is deterministic scene evidence, not a substitute for browser motion QA.
import {register} from 'node:module';
register('../tests/tactical-render-loader.mjs',import.meta.url);
import {mkdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup} from '../web/node_modules/react-dom/server.node.js';
import sharp from '../web/node_modules/sharp/lib/index.js';
import {createBattle} from '../game/tactical.js';
import {buildSectorMap} from '../game/maps.js';
import {spriteRender} from '../game/sprite-render.js';
const {default:SpriteFigure}=await import('../web/app/SpriteFigure.tsx');
const {default:TacticalScene}=await import('../web/app/TacticalScene.tsx');
const destination=resolve(process.argv[2]??'assets/previews/tactical-pixel-art');
await mkdir(destination,{recursive:true});
async function save(name,node,width,height){
 let svg=renderToStaticMarkup(h('svg',{xmlns:'http://www.w3.org/2000/svg',width,height,viewBox:`0 0 ${width} ${height}`},node));
 for(const url of new Set([...svg.matchAll(/href="(\/art\/[^\"]+)"/g)].map(m=>m[1]))){
  const file=await sharp(await readFile(resolve('web/public',`.${url}`))).png().toBuffer();
  svg=svg.replaceAll(`href="${url}"`,`href="data:image/png;base64,${file.toString('base64')}"`);
 }
 await sharp(Buffer.from(svg)).png().toFile(resolve(destination,`${name}.png`));
}
const families=[
 ['Granadero',{},'soldier','idle'],['Royalist',{side:'enemy'},'soldier','idle'],
 ['Civilian',{},'civilian','idle'],['Cavalry',{mounted:true},'soldier','idle'],
 ['Crouch',{movementMode:'crouch'},'soldier','idle'],
 ['Prone / gun',{stance:'prone',weapon:1800},'soldier','idle'],
 ['Prone / no gun',{stance:'prone',weaponDropped:true},'soldier','idle'],
 ['Prone / fire',{stance:'prone',weapon:1800},'soldier','fire'],
 ['Unconscious',{hp:80,unconscious:true},'soldier','idle'],
 ['Dead',{hp:0},'soldier','idle'],
 ['Fire',{},'soldier','fire'],['Reload',{},'soldier','reload'],['Strike',{},'soldier','strike'],
];
const sheet=[h('rect',{key:'bg',width:760,height:families.length*96,fill:'#666345'})];
for(const [row,[label,unit,appearance,pose]] of families.entries()){
 sheet.push(h('text',{key:`label-${row}`,x:12,y:row*96+20,fill:'#fff',fontSize:13},label));
 for(let direction=0;direction<8;direction++)sheet.push(h(SpriteFigure,{key:`${row}-${direction}`,unit:{side:'player',...unit},appearance,pose,position:{x:155+direction*80,y:row*96+78},motion:{direction,frame:0,moving:false}}));
}
await save('directions',sheet,760,families.length*96);
// Preview the same published source and frame timing as the runtime renderer.
for(const [name,unit,pose] of [
 ['granadero-unconscious-breathe-se',{hp:80,unconscious:true},'idle'],
 ['granadero-prone-armed-fire-se',{stance:'prone',weapon:1800},'fire'],
]){
 const sprite=spriteRender({side:'player',...unit},{direction:3,frame:0,moving:false},pose);
 const frames=[];
 for(let frame=0;frame<sprite.frames;frame++)frames.push(await sharp(resolve('web/public',`.${sprite.href}`))
  .extract({left:frame*sprite.cell,top:3*sprite.cell,width:sprite.cell,height:sprite.cell})
  .resize(320,320,{kernel:'nearest'}).png().toBuffer());
 await sharp(frames,{join:{animated:true}}).webp({lossless:true,loop:0,delay:frames.map(()=>Math.round(1000/sprite.fps))})
  .toFile(resolve(destination,`${name}.webp`));
}
for(const sector of ['san_lorenzo','yatasto']){
 const map=buildSectorMap({sector,squad:[],enemies:[]});
 const spots=map.tiles.filter(t=>!t.blocked&&(sector==='yatasto'?t.roomId:!t.buildingId&&t.x>9&&t.x<16&&t.y>5&&t.y<11));
 const people=spots.filter((_,i)=>i%3===0).slice(0,6).map((t,i)=>({id:String(i),name:`Soldado ${i+1}`,x:t.x,y:t.y,side:i%2?'enemy':'player',hp:100,maxHp:100}));
 const state=createBattle([],{...map,enemies:[],exploration:true});
 Object.assign(state,map,{units:people,npcs:[],night:false});
 const project=(x,y)=>({x:445+(x-y)*26,y:65+(x+y)*14});
 const scene=h(TacticalScene,{state,players:people,units:people,positions:{},poses:{},directions:{},reachable:[],sight:new Set(),revealed:new Set(map.tiles.map(t=>t.roomId).filter(Boolean)),project});
 await save(sector,scene,1000,600);
}
console.log(`Sprite contact sheet and two actual tactical scene renders: ${destination}`);
