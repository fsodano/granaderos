import {Vector3} from 'three';
import {architectureTrimColour} from './world-architecture-finish';
import type {WorldBatch} from './world-geometry';
import type {WorldMaterials} from './world-materials';

type SillFace={axis:'x'|'y';mid:number;cross:number;base:number;sill:number;top:number;width:number;span:number;thickness:number;style:string;finish:string;light:number};
const V=25.066666666666666;

/** The source Opening draws a 2.5-unit sill beyond either jamb. Put its
 * whole thickness below the retained aperture; slope both exposed edges
 * away from the masonry instead of filling the window's sight gap. */
export function addWindowSill(batch:WorldBatch,materials:WorldMaterials,face:SillFace){
  const colour=architectureTrimColour(face.finish);
  if(!colour||!['barred','small','arched','lattice','shutters'].includes(face.style))return;
  if(![face.mid,face.cross,face.base,face.sill,face.top,face.width,face.span,face.thickness,face.light].every(Number.isFinite))return;
  if(face.width<=0||face.width>face.span||face.thickness<=0||face.sill<=2.5/V||face.top<=face.sill)return;
  const sourceWidth=face.style==='small'?10:18,width=face.width*(sourceWidth+4)/sourceWidth;
  if(width>face.span)return;
  const half=face.thickness*.5,depth=half+.03+1.5/V,height=2.5/V,bevel=.3/V;
  const profile=[[-depth,-height],[depth,-height],[depth,-bevel],[half,0],[-half,0],[-depth,-bevel]];
  const point=(x:number,p:readonly number[])=>face.axis==='x'?new Vector3(face.mid+x,face.base+face.sill+p[1],face.cross+p[0]):new Vector3(face.cross+p[0],face.base+face.sill+p[1],face.mid+x);
  const material=materials.get(`window-sill-${face.finish}`,{colour});
  for(const side of [-1,1]){
    const points=profile.map(p=>point(side*width*.5,p));
    batch.polygon(material,side*(face.axis==='x'?1:-1)>0?points.reverse():points,face.light);
  }
  for(let i=0;i<profile.length;i++){
    const a=profile[i],b=profile[(i+1)%profile.length];
    const points=[point(-width*.5,a),point(width*.5,a),point(width*.5,b),point(-width*.5,b)];
    batch.polygon(material,face.axis==='y'?points.reverse():points,face.light);
  }
}
