import {Color,Vector3} from 'three';
import {seeded,WorldBatch} from './world-geometry';
import type {WorldMaterials} from './world-materials';

type WallSurface={axis:'x'|'y';first:number;last:number;cross:number;base:number;height:number;thickness:number;opening?:'door'|'window';openingWidth:number;finish:string;colour:Color;x:number;y:number;face:number;cut:boolean;light:number};

/** Surface details share the wall's authored footprint and opening spans. */
export function addWallSurfaceDetails(batch:WorldBatch,materials:WorldMaterials,s:WallSurface){
  const at=(u:number,y:number,d:number)=>s.axis==='x'?new Vector3(u,s.base+y,s.cross+d):new Vector3(s.cross+d,s.base+y,u);
  const box=(u:number,y:number,w:number,h:number,d:number,material:ReturnType<WorldMaterials['get']>)=>s.axis==='x'?batch.box(material,u,s.base+y,s.cross,w,h,d,s.light):batch.box(material,s.cross,s.base+y,u,d,h,w,s.light);
  const mid=(s.first+s.last)*.5,footHeight=Math.min(.20,s.height-.035),stone=materials.get('stone');
  // The retained sprite has a five-pixel stone footing (about 20 cm), with
  // visible joints. Continue it under door jambs while leaving the threshold.
  const spans=s.opening==='door'?[[s.first,mid-s.openingWidth*.5],[mid+s.openingWidth*.5,s.last]]:[[s.first,s.last]];
  const blockWidth=.40,joint=.014;
  for(const [first,last]of spans)for(let index=Math.floor(first/blockWidth);index*blockWidth<last;index++){
    const a=Math.max(first,index*blockWidth+joint*.5),b=Math.min(last,(index+1)*blockWidth-joint*.5);
    if(b>a)box((a+b)*.5,footHeight*.5,b-a,footHeight,s.thickness+.045,stone);
  }
  // Masonry textures already expose their joints. Wear reveals a muted
  // undercoat only on plaster finishes, without changing the wall pigment.
  if(s.cut||s.opening||!['limewash','ochre','adobe'].includes(s.finish)||s.last-s.first<.30)return;
  const undercoat=s.colour.clone().lerp(new Color('#a69570'),s.finish==='limewash'?.60:.38);
  const chip=materials.get('plaster-wear',{colour:`#${undercoat.getHexString()}`});
  const pale=materials.get('plaster-scuff',{colour:`#${s.colour.clone().lerp(new Color('#eee3c4'),.24).getHexString()}`});
  const seed=seeded(s.x,s.y,s.face+19),width=Math.min(.30+seed*.12,(s.last-s.first)*.65),u=s.first+width*.5+.025+seed*Math.max(0,s.last-s.first-width-.05),bottom=.205;
  const points:readonly (readonly [number,number])[]=[[-.50,.04],[-.40,.23],[-.17,.30],[.31,.27],[.50,.12],[.23,0],[-.17,.015]];
  for(const side of [-1,1]){
    const d=side*(s.thickness*.5+.003);
    batch.polygon(chip,points.map(([x,y])=>at(u+x*width,bottom+y*(.72+seed*.45),d)),s.light);
    for(let n=0;n<8;n++){
      const q=seeded(s.x*43+n,s.y*29+s.face,7),length=.035+.075*q,center=s.first+.065+q*Math.max(0,s.last-s.first-.13),y=.32+seeded(s.x+n,s.y,s.face+31)*Math.min(1.05,s.height-.45);
      batch.polygon(n%3===0?chip:pale,[at(center-length*.5,y,d),at(center+length*.5,y,d),at(center+length*.5,y+.022,d),at(center-length*.5,y+.022,d)],s.light);
    }
  }
}
