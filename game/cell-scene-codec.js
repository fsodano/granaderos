// The tile codec has no campaign dependencies. Low-level item validation can
// inspect retained terrain without importing the world or the campaign engine.
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const need=condition=>{if(!condition)throw Error('El terreno comprimido de la celda es inválido.');};
export function expandCellTiles(scene){
 if(!scene||Array.isArray(scene.tiles)||scene.tiles===undefined)return scene?.tiles??[];
 const packed=scene.tiles,{width,height}=scene;
 need(object(packed)&&packed.format==='cell-tiles-v1'&&Object.keys(packed).length===3);
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
 return tiles;
}
