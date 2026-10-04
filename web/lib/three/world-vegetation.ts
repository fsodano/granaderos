import {Quaternion,Vector3} from 'three';
import {WorldBatch,seeded} from './world-geometry';
import {illuminationAt} from './world-materials';
import type {WorldGeometry} from './world-geometry';
import type {WorldMaterials} from './world-materials';
import type {WorldInput,WorldTile} from './world-types';

export function softenedFoliage(tiles:readonly WorldTile[],input:WorldInput){return tiles.filter(tile=>tile.type==='forest'&&(input.admittedActorPoints??[]).some(point=>(point.tacticalLevel??0)===(tile.tacticalLevel??0)&&Math.abs(point.x-tile.x)<1.4&&Math.abs(point.y-tile.y)<1.4)).map(tile=>`${tile.x},${tile.y}`);}
export function buildVegetationChunk(id:string,tiles:readonly WorldTile[],input:WorldInput,T:number,geometry:WorldGeometry,materials:WorldMaterials){
  const batch=new WorldBatch(geometry),soft=new Set(softenedFoliage(tiles,input));
  for(const tile of tiles){
    if(!['forest','scrub'].includes(tile.type)||tile.buildingId)continue;
    const seed=seeded(tile.x,tile.y),light=illuminationAt(input,tile),x=tile.x*T,z=tile.y*T,ground=tile.elevation??0,tree=tile.type==='forest'&&seed>.2;
    const faded=soft.has(`${tile.x},${tile.y}`),leaf=materials.get(seed>.7?'poplar':'leaf',{opacity:faded?.42:1});
    if(!tree){for(let n=0;n<3;n++){const dx=(seeded(tile.x,tile.y,n+23)-.5)*.48,dz=(seeded(tile.y,tile.x,n+11)-.5)*.48;batch.primitive('sphere',leaf,[x+dx,ground+.30,z+dz],[.31,.33,.30],undefined,light);}continue;}
    const height=2.6+seed*2.1,trunk=materials.get('trunk');
    batch.cylinder(trunk,new Vector3(x,ground,z),new Vector3(x+.07,ground+height*.69,z),.075+seed*.035,light,'taper');
    for(let n=0;n<4;n++){
      const angle=n*Math.PI*.5+seed*3,direction=new Vector3(Math.cos(angle),.65,Math.sin(angle)).normalize(),start=new Vector3(x,ground+height*(.40+n*.04),z),end=start.clone().addScaledVector(direction,.65);
      batch.cylinder(trunk,start,end,.027,light);
    }
    if(seed>.7){
      for(let n=0;n<4;n++)batch.primitive('sphere',leaf,[x+.025*n,ground+height*(.45+.14*n),z],[.42-.045*n,.74,.40-.04*n],undefined,light);
    }else for(let n=0;n<5;n++){
      const angle=n*2.4,rad=n===0?0:.44;batch.primitive('sphere',leaf,[x+Math.cos(angle)*rad,ground+height*(n===0?.78:.65),z+Math.sin(angle)*rad],[.72,.82,.68],new Quaternion().setFromAxisAngle(new Vector3(0,1,0),angle),light*(.87+.13*seeded(tile.x,tile.y,n)));
    }
  }
  const group=batch.finish(`vegetation:${id}`);group.userData.kind='vegetation';group.userData.softenedCells=[...soft];return group;
}
