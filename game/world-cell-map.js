import {worldCell} from './world-cells.js';
import {placeBuilding} from './buildings.js';
import {roadsideDiscoveryProps} from './roadside-discoveries.js';

// Schematic terrain, not a copy of the nearest locality's landmark or loot.
// The cell key supplies stable geometry independent of the campaign's clock.
export function worldCellPlan(id,roadsideDiscoveryDefinitions){
 const cell=worldCell(id);
 if(!cell?.land||cell.anchor)throw Error('La celda no tiene un plano terrestre independiente.');
 const width=20,height=16,seed=(cell.col+1)*7919+(cell.row+1)*104729;
 let tiles=Array.from({length:width*height},(_,i)=>{
  const x=i%width,y=Math.floor(i/width),value=(x*37+y*71+seed)%101;
  const road=y===8||x===2,stone=cell.biome==='mountain'&&y<3&&value<70;
  return {x,y,type:road?'road':stone?'stone':cell.biome==='wetland'&&value<45?'mud':value<12?'scrub':'grass',blocked:stone,cover:stone?30:!road&&value<12?10:0};
 });
 const buildings=[];
 if(cell.district)for(const [i,x]of [7,14].entries()){
  const result=placeBuilding(tiles,{id:`${id}:house-${i}`,name:`Casa ${i+1}`,x,y:3,width:5,height:5,doors:[{x:x+2,y:7}],windows:[{x,y:5}],material:'adobe',roof:'tile'});
  tiles=result.tiles;buildings.push({...result.building,purpose:'home'});
 }
 return {worldCell:true,width,height,tiles,buildings,props:roadsideDiscoveryProps(id,roadsideDiscoveryDefinitions),lights:[],groundItems:[],decor:[],sourceMapId:id,sourceMapRevision:1};
}
