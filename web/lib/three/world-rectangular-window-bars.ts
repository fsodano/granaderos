import type {WorldBatch} from './world-geometry';
import type {WorldMaterials} from './world-materials';

type RectangularWindowFace={axis:'x'|'y';mid:number;cross:number;base:number;sill:number;top:number;width:number;style:'barred'|'small';light:number};

/** Opening paints three inset bars. Retain the real shell aperture and pane;
 * only map its authored rectangular strokes into that existing aperture. */
export function addRectangularWindowBars(batch:WorldBatch,materials:WorldMaterials,face:RectangularWindowFace){
  const {axis,mid,cross,base,sill,top,width,style,light}=face,height=top-sill,small=style==='small',span=small?10:18,rise=small?10:19;
  const iron=materials.get('iron',{colour:'#767c68'});
  const box=(x:number,y:number,w:number,h:number)=>batch.box(iron,axis==='x'?mid+x:cross,base+y,axis==='x'?cross:mid+x,axis==='x'?w:.035,h,axis==='x'?.035:w,light);
  // Regular Opening: x=11..29, y=-32..-13. Small: x=15..25,
  // y=-30..-20. Both use x=16/20/24 and one-unit end insets.
  const bottom=sill+height/rise,end=top-height/rise;
  for(const x of [-4,0,4])box(x*width/span,(bottom+end)*.5,width*.8/span,end-bottom);
  // The source small window has no transverse bar.
  if(!small)box(0,sill+height*9/19,width*16/18,height*.8/19);
}
