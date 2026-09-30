import {expandCellTiles} from './cell-scene-codec.js';
import {worldCell} from './world-cells.js';

const FORMAT='cell-tiles-v1';
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const cellScene=scene=>worldCell(scene?.sectorId)?.anchor===false&&scene.sourceMapId===scene.sectorId;
const need=condition=>{if(!condition)throw Error('El terreno comprimido de la celda es inválido.');};

// Retained scenes keep every tile property but omit repeated coordinates and
// terrain records. Active scenes always use the ordinary expanded tile array.
export function compactCellScene(scene){
 if(!Array.isArray(scene?.tiles)||!cellScene(scene))return scene;
 const {width,height,tiles}=scene;
 if(tiles.length!==width*height||!tiles.every((t,i)=>t.x===i%width&&t.y===Math.floor(i/width)))return scene;
 const palette=[],indices=new Map(),runs=[];
 for(const {x,y,...tile}of tiles){
  const key=JSON.stringify(tile);let index=indices.get(key);
  if(index===undefined){index=palette.length;indices.set(key,index);palette.push(tile);}
  if(runs.length&&runs.at(-2)===index)runs[runs.length-1]++;
  else runs.push(index,1);
 }
 return {...scene,tiles:{format:FORMAT,palette,runs}};
}

export function expandCellScene(scene){
 if(!object(scene)||Array.isArray(scene.tiles)||scene.tiles===undefined)return scene;
 const packed=scene.tiles,{width,height}=scene;
 need(cellScene(scene)&&object(packed)&&packed.format===FORMAT&&Object.keys(packed).length===3);
 // These are the two actual cell layouts, not dimensions supplied by the codec.
 need(width===64&&height===48||width===20&&height===16);
 return {...scene,tiles:expandCellTiles(scene)};
}

export function cellSceneSaveReplacer(replacer){
 return function(key,value){return replacer(key,compactCellScene(value));};
}
