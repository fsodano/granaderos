// Compare the actual building renderer before and after room revelation.
import {register} from 'node:module';
register('../tests/tactical-render-loader.mjs',import.meta.url);
import {mkdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup} from '../web/node_modules/react-dom/server.node.js';
import sharp from '../web/node_modules/sharp/lib/index.js';
import {BUILDING_TYPES,BUILDING_FOOTPRINTS} from '../game/building-types.js';
import {placePulperiaCart} from '../game/props.js';
import {placeBuilding} from '../game/buildings.js';
const {default:TacticalScene}=await import('../web/app/TacticalScene.tsx');
const output=resolve(process.argv[2]??'assets/previews/buildings');
await mkdir(output,{recursive:true});
const requested=process.argv.slice(3);
for(const architecture of requested)if(!BUILDING_TYPES[architecture])throw new Error(`Unknown building type: ${architecture}`);
const catalogue=Object.entries(BUILDING_TYPES).filter(([architecture])=>!requested.length||requested.includes(architecture));
// Every panel uses the game projection and the same frame. Large landmarks must
// not be scaled down separately from houses, soldiers or the approved cart.
const maxWidth=Math.max(...Object.values(BUILDING_FOOTPRINTS).map(([width])=>width));
const maxHeight=Math.max(...Object.values(BUILDING_FOOTPRINTS).map(([,height])=>height));
const groundWidth=maxWidth+4,groundHeight=maxHeight+5;
const frameWidth=(groundWidth+groundHeight)*26+64;
const origin={x:32+groundHeight*26,y:96+Math.max(...Object.values(BUILDING_TYPES).map(style=>style.height))};
const frameHeight=Math.ceil(origin.y+(groundWidth+groundHeight-1)*14+42);
const project=(x,y)=>({x:origin.x+(x-y)*26,y:origin.y+(x+y)*14});
const imageCache=new Map();
const panels=[];
for(const [architecture,style] of catalogue){
const [width,height]=BUILDING_FOOTPRINTS[architecture];
const x=2+Math.floor((maxWidth-width)/2),y=2+Math.floor((maxHeight-height)/2),doorX=x+Math.floor((width-1)/2);
const ground=Array.from({length:groundWidth*groundHeight},(_,i)=>({x:i%groundWidth,y:Math.floor(i/groundWidth),type:Math.floor(i/groundWidth)>=y+height?'road':'grass',blocked:false}));
const {tiles,building}=placeBuilding(ground,{id:'posta',architecture,x,y,width,height,doors:[{x:doorX,y:y+height-1},{x:doorX+1,y:y+height-1,open:true}],windows:[{x:x+width-1,y:y+1}]});
const roomId=building.rooms[0].id;
const granadero={id:'scale-granadero',name:'Granadero',side:'player',spriteAppearance:'granadero',hp:100,maxHp:100,facing:2,stance:'standing',mounted:false,x:x+width-1,y:y+height+1};
const state={width:groundWidth,height:groundHeight,tiles,buildings:[building],units:[granadero],npcs:[],props:[],artillery:[],lights:[],smoke:[]};
placePulperiaCart(state,building);
for(const inside of [false,true]){
 const units=inside?[granadero,{...granadero,id:'interior-granadero',x:x+width-2,y:y+height-2}]:[granadero];
 const sceneState={...state,units};
 let svg=renderToStaticMarkup(h('svg',{xmlns:'http://www.w3.org/2000/svg',width:frameWidth*2,height:frameHeight*2,viewBox:`0 0 ${frameWidth} ${frameHeight}`},
  h('rect',{width:frameWidth,height:frameHeight,fill:'#343b2a'}),
  h('text',{x:24,y:30,fill:'#eee0bb',fontSize:18,fontFamily:'sans-serif'},style.name+(inside?' · interior':'')),
  h('text',{x:24,y:50,fill:'#b9b89a',fontSize:11,fontFamily:'sans-serif'},`${width} × ${height} casillas · Granadero a escala del juego`),
  h(TacticalScene,{state:sceneState,players:units,units,positions:{},poses:{},directions:{},reachable:[],sight:new Set(),revealed:new Set(inside?[roomId]:[]),project}),
  h('text',{x:24,y:frameHeight-16,fill:'#b9b89a',fontSize:11,fontFamily:'sans-serif'},architecture==='pulperia'?'Carreta y granadero conservan su tamaño.':'Misma escala en todos los edificios.')));
 for(const url of new Set([...svg.matchAll(/href="(\/art\/[^\"]+)"/g)].map(m=>m[1]))){
  if(!imageCache.has(url))imageCache.set(url,(await sharp(await readFile(resolve('web/public',`.${url}`))).png().toBuffer()).toString('base64'));
  svg=svg.replaceAll(`href="${url}"`,`href="data:image/png;base64,${imageCache.get(url)}"`);
 }
 const file=resolve(output,`${architecture}-${inside?'interior':'exterior'}.png`);
 await sharp(Buffer.from(svg)).png().toFile(file);
 if(!inside)panels.push(await sharp(file).resize(frameWidth,frameHeight).toBuffer());
}
}
const columns=Math.min(3,panels.length),rows=Math.ceil(panels.length/columns);
await sharp({create:{width:columns*frameWidth,height:rows*frameHeight,channels:4,background:'#343b2a'}}).composite(panels.map((input,i)=>({input,left:i%columns*frameWidth,top:Math.floor(i/columns)*frameHeight}))).png().toFile(resolve(output,requested.length?'selection.png':'catalogue.png'));
console.log(output);
