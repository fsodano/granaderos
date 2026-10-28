import {Vector3} from 'three';
import {seeded} from './world-geometry';
import type {WorldBatch} from './world-geometry';
import type {WorldMaterials} from './world-materials';
import type {WorldTile} from './world-types';

/** Sparse clusters of shallow six-triangle chips. The four footprint corners
 * meet the exact ground height; no physics or obstruction record is added. */
export function soilFragments(batch:WorldBatch,tile:WorldTile,kind:string,T:number,materials:WorldMaterials,light:number){
  if(kind!=='dirt'||!['road','stone'].includes(tile.type)||tile.buildingId||tile.roomId||tile.blocked||(tile.tacticalLevel??0)!==0)return;
  // Quiet patches and local omissions keep the soil visible between groups.
  if(seeded(Math.floor(tile.x/3),Math.floor(tile.y/3),401)<.32||seeded(tile.x,tile.y,503)>.32)return;
  const x=tile.x*T,z=tile.y*T,h=tile.elevation??0,stone=materials.get('stone'),count=seeded(tile.x,tile.y,811)>.72?3:2;
  const centreX=x+(seeded(tile.x,tile.y,601)-.5)*T*.52,centreZ=z+(seeded(tile.y,tile.x,619)-.5)*T*.52;
  for(let n=0;n<count;n++){
    const random=(salt:number)=>seeded(tile.x,tile.y,salt+n*29),angle=random(641)*Math.PI*2,reach=(.035+random(659)*.10)*T;
    const rootX=centreX+Math.cos(angle)*reach,rootZ=centreZ+Math.sin(angle)*reach,rotation=random(677)*Math.PI*2,c=Math.cos(rotation),s=Math.sin(rotation);
    const w=(.0225+random(691)*.0175)*T,l=(.0325+random(709)*.0275)*T,rise=(.005+random(727)*.008)*T;
    const point=(px:number,pz:number,height=0)=>new Vector3(rootX+px*c-pz*s,h+height,rootZ+px*s+pz*c);
    const a=point(-w*(.85+random(761)*.15),-l),b=point(-w,l*(.78+random(769)*.22)),d=point(w,-l*(.78+random(787)*.22)),corner=point(w*(.78+random(777)*.22),l),p=point(-w*.10,-l*.22,rise),q=point(w*.08,l*.18,rise*.88);
    // Broad muted contrast keeps the small chips readable on pale dirt.
    const shade=light*(.65+random(743)*.20);
    batch.polygon(stone,[a,b,q,p],shade);batch.polygon(stone,[p,q,corner,d],shade);
    batch.polygon(stone,[a,p,d],shade*.86);batch.polygon(stone,[b,corner,q],shade*.86);
  }
}
