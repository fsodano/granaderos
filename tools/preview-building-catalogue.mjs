// Compare the actual building renderer before and after room revelation.
import {register} from 'node:module';
register('../tests/tactical-render-loader.mjs',import.meta.url);
import {mkdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup} from '../web/node_modules/react-dom/server.node.js';
import sharp from '../web/node_modules/sharp/lib/index.js';
import {BUILDING_TYPES} from '../game/building-types.js';
import {placeBuilding} from '../game/buildings.js';
const {default:TacticalScene}=await import('../web/app/TacticalScene.tsx');
const output=resolve(process.argv[2]??'assets/previews/buildings');
await mkdir(output,{recursive:true});
const panels=[];
for(const [architecture,style] of Object.entries(BUILDING_TYPES)){
const ground=Array.from({length:100},(_,i)=>({x:i%10,y:Math.floor(i/10),type:'grass',blocked:false}));
const [width,height]=({house:[4,4],farmhouse:[5,3],estancia:[8,4],church:[4,7],mansion:[6,5],cabildo:[9,4],pulperia:[5,4],warehouse:[6,5],barracks:[8,3]})[architecture];
const x=1,y=1,doorX=x+Math.floor((width-1)/2);
const {tiles,building}=placeBuilding(ground,{id:'posta',architecture,x,y,width,height,doors:[{x:doorX,y:y+height-1},{x:doorX+1,y:y+height-1,open:true}],windows:[{x:x+width-1,y:y+1}]});
const roomId=building.rooms[0].id;
const state={tiles,buildings:[building],units:[],npcs:[],props:[],artillery:[],lights:[],smoke:[]};
for(const inside of [false,true]){
 const project=(x,y)=>({x:270+(x-y)*26,y:160+(x+y)*14});
 let svg=renderToStaticMarkup(h('svg',{xmlns:'http://www.w3.org/2000/svg',width:1080,height:880,viewBox:'0 0 540 440'},h('rect',{width:540,height:440,fill:'#77704a'}),h('text',{x:20,y:28,fill:'#eee0bb',fontSize:16,fontFamily:'sans-serif'},style.name+(inside?' · interior':'')),h(TacticalScene,{state,players:[],units:[],positions:{},poses:{},directions:{},reachable:[],sight:new Set(),revealed:new Set(inside?[roomId]:[]),project})));
 for(const url of new Set([...svg.matchAll(/href="(\/art\/[^\"]+)"/g)].map(m=>m[1]))){
  const data=await sharp(await readFile(resolve('web/public',`.${url}`))).png().toBuffer();
  svg=svg.replaceAll(`href="${url}"`,`href="data:image/png;base64,${data.toString('base64')}"`);
 }
 const file=resolve(output,`${architecture}-${inside?'interior':'exterior'}.png`);
 await sharp(Buffer.from(svg)).png().toFile(file);
 if(!inside)panels.push(await sharp(file).resize(540,440).toBuffer());
}
}
await sharp({create:{width:1620,height:1320,channels:4,background:'#77704a'}}).composite(panels.map((input,i)=>({input,left:i%3*540,top:Math.floor(i/3)*440}))).png().toFile(resolve(output,'catalogue.png'));
console.log(output);
