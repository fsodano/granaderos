import {saveByteLength} from './save-limits.js';
import {cellSceneExpandedBytes} from './cell-scene-storage.js';

// Bound expansion before allocating tiles, independently of the file-size cap.
export const MAX_EXPANDED_SAVE_BYTES=20_000_000;
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const invalid=()=>{throw Error('El terreno compacto de la partida es inválido.');};
function maps(value){
 const c=value.campaign;
 return [value.battle,...Object.values(c?.sectorStates??{}),...Object.values(c?.sceneStates??{}),c?.pendingBattle?.resumeSnapshot].filter(object);
}
export function compactSaveTerrain(value){
 let changed=false;
 for(const map of maps(value)){
  const {width,height,tiles}=map;
  if(!Number.isInteger(width)||!Number.isInteger(height)||!Array.isArray(tiles)||tiles.length!==width*height||!tiles.every((t,i)=>object(t)&&t.x===i%width&&t.y===Math.floor(i/width)))continue;
  const palette=[],indices=[],known=new Map();
  for(const {x,y,...shape} of tiles){const key=JSON.stringify(shape);let index=known.get(key);if(index===undefined){index=palette.length;known.set(key,index);palette.push(shape);}indices.push(index);}
  const packed={encoding:'palette-v1',palette,indices};
  if(JSON.stringify(packed).length<JSON.stringify(tiles).length){map.tiles=packed;changed=true;}
 }
 return changed;
}
export function expandSaveTerrain(value){
 let bytes=saveByteLength(JSON.stringify(value));const plans=[];
 for(const map of maps(value)){
  if(Array.isArray(map.tiles))continue;
  const packed=map.tiles,{width,height}=map;
  if(packed?.format==='cell-tiles-v1'){
   bytes+=cellSceneExpandedBytes(map)-saveByteLength(JSON.stringify(packed));
   if(bytes>MAX_EXPANDED_SAVE_BYTES)throw Error('La partida expandida supera el límite de 20 MB.');
   continue;
  }
  if(!object(packed)||packed.encoding!=='palette-v1'||Object.keys(packed).some(k=>!['encoding','palette','indices'].includes(k))||!Number.isInteger(width)||width<4||width>128||!Number.isInteger(height)||height<4||height>128)invalid();
  const {palette,indices}=packed;
  if(!Array.isArray(indices)||indices.length!==width*height||!Array.isArray(palette)||!palette.length||palette.length>indices.length||!palette.every(t=>object(t)&&!Object.hasOwn(t,'x')&&!Object.hasOwn(t,'y'))||!indices.every(i=>Number.isInteger(i)&&i>=0&&i<palette.length))invalid();
  const lengths=palette.map(t=>saveByteLength(JSON.stringify(t)));
  // Count the exact expanded tile array without constructing any tile copies.
  let expanded=2;
  for(let i=0;i<indices.length;i++)expanded+=lengths[indices[i]]+`"x":${i%width},"y":${Math.floor(i/width)}`.length+(Object.keys(palette[indices[i]]).length?1:0)+(i?1:0);
  bytes+=expanded-saveByteLength(JSON.stringify(packed));
  if(bytes>MAX_EXPANDED_SAVE_BYTES)throw Error('La partida expandida supera el límite de 20 MB.');
  plans.push({map,palette,indices,width});
 }
 if(bytes>MAX_EXPANDED_SAVE_BYTES)throw Error('La partida expandida supera el límite de 20 MB.');
 for(const {map,palette,indices,width} of plans)map.tiles=indices.map((index,i)=>({x:i%width,y:Math.floor(i/width),...structuredClone(palette[index])}));
 return value;
}
