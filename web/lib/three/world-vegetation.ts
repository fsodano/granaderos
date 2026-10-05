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
    if(!tree){for(let n=0;n<4;n++){const dx=(seeded(tile.x,tile.y,n+23)-.5)*.53,dz=(seeded(tile.y,tile.x,n+11)-.5)*.53,r=.23+seeded(tile.x,tile.y,n+63)*.15;batch.primitive(`crown-${n%3}`,leaf,[x+dx,ground+r*.7,z+dz],[r,r*.83,r*.9],undefined,light);}continue;}
    const height=2.6+seed*2.1,trunk=materials.get('trunk');
    batch.cylinder(trunk,new Vector3(x,ground,z),new Vector3(x+.07,ground+height*.69,z),.075+seed*.035,light,'taper');
    const poplar=seed>.7;
    for(let n=0;n<8;n++){
      const variation=seeded(tile.x,tile.y,n+17),angle=n*2.399+seed*5,spread=(poplar?.32:.48)+variation*(poplar?.15:.44),start=new Vector3(x,ground+height*(.40+variation*.19),z),end=new Vector3(x+Math.cos(angle)*spread,ground+height*(poplar?.49+n*.058:.63+variation*.18),z+Math.sin(angle)*spread);
      batch.cylinder(trunk,start,end,.018+(1-variation)*.012,light);
      for(const side of [-1,1]){const fork=end.clone().add(new Vector3(Math.cos(angle+side*.6)*.20,.10,Math.sin(angle+side*.6)*.20));batch.cylinder(trunk,end,fork,.008,light);}
      const radius=(poplar?.27:.35)+variation*(poplar?.17:.23);
      batch.primitive(`crown-${n%3}`,leaf,end.clone().add(new Vector3(0,.15,0)),[radius,radius*(poplar?1.40:1.05),radius*(.84+variation*.22)],new Quaternion().setFromAxisAngle(new Vector3(0,1,0),angle),light*(.86+variation*.14));
    }
    // Off-centre smaller clusters break the repeated spherical contour.
    for(let n=0;n<4;n++){
      const angle=n*2.67+seed*8,spread=poplar?.20:.67,y=ground+height*(.64+.13*seeded(tile.x,tile.y,n+201));
      batch.primitive(`crown-${(n+1)%3}`,leaf,[x+Math.cos(angle)*spread,y,z+Math.sin(angle)*spread],[.24,.29,.26],new Quaternion().setFromAxisAngle(new Vector3(0,1,0),angle),light*(.82+.15*seeded(tile.x,tile.y,n+94)));
    }
  }
  const group=batch.finish(`vegetation:${id}`);group.userData.kind='vegetation';group.userData.softenedCells=[...soft];return group;
}
