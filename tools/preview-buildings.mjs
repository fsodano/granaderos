// Compare the actual building renderer before and after room revelation.
import {register} from 'node:module';
register('../tests/tactical-render-loader.mjs',import.meta.url);
import {mkdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup} from '../web/node_modules/react-dom/server.node.js';
import sharp from '../web/node_modules/sharp/lib/index.js';
import {placeBuilding} from '../game/buildings.js';
const {default:TacticalScene}=await import('../web/app/TacticalScene.tsx');
const output=resolve(process.argv[2]??'assets/previews/buildings');
await mkdir(output,{recursive:true});
const ground=Array.from({length:100},(_,i)=>({x:i%10,y:Math.floor(i/10),type:'grass',blocked:false}));
const {tiles,building}=placeBuilding(ground,{id:'posta',x:2,y:2,width:6,height:5,doors:[{x:4,y:6},{x:5,y:6,open:true}],windows:[{x:7,y:4},{x:2,y:4}]});
const roomId=building.rooms[0].id;
const state={tiles,buildings:[building],units:[],npcs:[],props:[{id:'table',type:'table',x:4,y:3,roomId},{id:'chest',type:'chest',x:6,y:3,roomId},{id:'bed',type:'bed',x:3,y:4,roomId,footprint:{width:1,height:2},blocksMovement:true},{id:'bench',type:'bench',x:5,y:3,roomId}],artillery:[],lights:[],smoke:[]};
for(const inside of [false,true]){
 const project=(x,y)=>({x:270+(x-y)*26,y:75+(x+y)*14});
 let svg=renderToStaticMarkup(h('svg',{xmlns:'http://www.w3.org/2000/svg',width:1080,height:760,viewBox:'0 0 540 380'},h('rect',{width:540,height:380,fill:'#77704a'}),h(TacticalScene,{state,players:[],units:[],positions:{},poses:{},directions:{},reachable:[],sight:new Set(),revealed:new Set(inside?[roomId]:[]),project})));
 for(const url of new Set([...svg.matchAll(/href="(\/art\/[^\"]+)"/g)].map(m=>m[1]))){
  const data=await sharp(await readFile(resolve('web/public',`.${url}`))).png().toBuffer();
  svg=svg.replaceAll(`href="${url}"`,`href="data:image/png;base64,${data.toString('base64')}"`);
 }
 await sharp(Buffer.from(svg)).png().toFile(resolve(output,inside?'interior.png':'exterior.png'));
}
console.log(output);
