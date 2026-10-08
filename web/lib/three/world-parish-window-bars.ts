import {Vector3} from 'three';
import type {WorldBatch} from './world-geometry';
import type {WorldMaterials} from './world-materials';

type ParishWindowFace={axis:'x'|'y';mid:number;cross:number;base:number;sill:number;top:number;width:number;light:number};

/** Dress the retained arched aperture with the three pale bars in Opening.
 * Masonry, both-face framing, glass, saved styles and disclosure stay with
 * the existing shell. This helper never changes the physical opening. */
export function addParishArchedBars(batch:WorldBatch,materials:WorldMaterials,face:ParishWindowFace){
  const {axis,mid,cross,base,sill,top,width,light}=face,height=top-sill,iron=materials.get('iron',{colour:'#767c68'});
  const box=(x:number,y:number,w:number,h:number)=>{const point=axis==='x'?new Vector3(mid+x,base+y,cross):new Vector3(cross,base+y,mid+x);batch.box(iron,point.x,point.y,point.z,axis==='x'?w:.035,h,axis==='x'?.035:w,light);};
  // Opening's retained arched span is x=11..29, y=-38..-13.
  // Its three lines run x=16/20/24 from y=-32 to -14.
  const bottom=sill+height/25,end=top-height*6/25;
  for(const x of [-4,0,4])box(x*width/18,(bottom+end)*.5,width*.8/18,end-bottom);
  // The transverse line is x=12..28 at y=-22.
  box(0,sill+height*9/25,width*16/18,height*.8/25);
}
