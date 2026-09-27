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
 const count=width*height;
 need(Array.isArray(packed.palette)&&packed.palette.length>0&&packed.palette.length<=count&&packed.palette.every(tile=>object(tile)&&!Object.hasOwn(tile,'x')&&!Object.hasOwn(tile,'y')));
 need(Array.isArray(packed.runs)&&packed.runs.length>0&&packed.runs.length%2===0&&packed.runs.length<=count*2);
 const sizes=packed.palette.map(tile=>JSON.stringify(tile).length+32);
 let expandedSize=0;const used=new Set();
 for(let i=0;i<packed.runs.length;i+=2){
  const index=packed.runs[i],length=packed.runs[i+1];
  need(Number.isInteger(index)&&index>=0&&index<packed.palette.length&&Number.isInteger(length)&&length>0&&length<=count);
  used.add(index);
  expandedSize+=sizes[index]*length;need(expandedSize<=3_000_000);
 }
 need(used.size===packed.palette.length);
 const tiles=[];
 for(let i=0;i<packed.runs.length;i+=2){
  const index=packed.runs[i],length=packed.runs[i+1];
  need(Number.isInteger(index)&&index>=0&&index<packed.palette.length&&Number.isInteger(length)&&length>0&&length<=count-tiles.length);
  for(let n=0;n<length;n++){const at=tiles.length;tiles.push({...packed.palette[index],x:at%width,y:Math.floor(at/width)});}
 }
 need(tiles.length===count);
 return {...scene,tiles};
}

export function cellSceneSaveReplacer(replacer){
 return function(key,value){return replacer(key,compactCellScene(value));};
}
