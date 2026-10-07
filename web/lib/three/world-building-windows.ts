import {Quaternion,Vector3} from 'three';
import {addParishArchedBars} from './world-parish-window-bars';
import type {WorldBatch} from './world-geometry';
import type {WorldMaterials} from './world-materials';

type WindowFace={axis:'x'|'y';mid:number;cross:number;base:number;sill:number;top:number;width:number;style:string;light:number;sourceParish?:boolean};

/** Opening dimensions and disclosure belong to the shell. This helper only
 * dresses a retained full-height window, from either side of its wall. */
export function addWindowFace(batch:WorldBatch,materials:WorldMaterials,face:WindowFace){
  const {axis,mid,cross,base,sill,top,width,style,light}=face,height=top-sill;
  const point=(x:number,y:number,d=0)=>axis==='x'?new Vector3(mid+x,base+y,cross+d):new Vector3(cross+d,base+y,mid+x);
  const box=(x:number,y:number,w:number,h:number,d:number,material:ReturnType<WorldMaterials['get']>,offset=0)=>{const p=point(x,y,offset);batch.box(material,p.x,p.y,p.z,axis==='x'?w:d,h,axis==='x'?d:w,light);};
  box(0,(top+sill)*.5,width,height,.025,materials.get('glass',{opacity:.38}));
  if(style==='lattice'){
    const timber=materials.get('timber-lattice',{colour:'#b29970'});
    // The sprite has four diagonals from each upper jamb. Their ends stop
    // within the opening; the lower part remains open and readable.
    for(const side of [-1,1])for(let n=0;n<4;n++){
      const x=side*(-width*.5+width*(1+n*4)/18),y=top-height/19,dx=side*width*Math.min(8,16-n*4)/18,dy=-height*Math.min(12,(16-n*4)*1.5)/19;
      for(const d of [-.033,.033]){
        const a=point(x,y,d),b=point(x+dx,y+dy,d),vector=b.clone().sub(a),rotation=new Quaternion().setFromUnitVectors(new Vector3(0,1,0),vector.clone().normalize());
        batch.primitive('box',timber,a.clone().add(b).multiplyScalar(.5),axis==='x'?[.030,vector.length(),.018]:[.018,vector.length(),.030],rotation,light);
      }
    }
  }else if(style==='arched'&&face.sourceParish){
    addParishArchedBars(batch,materials,face);
  }else if(['barred','small','arched'].includes(style)){
    const iron=materials.get('iron');for(let n=0;n<4;n++)box(-width*.38+width*.25*n,(top+sill)*.5,.018,height,.035,iron);box(0,sill+height*.48,width,.018,.035,iron);
  }else if(style==='shutters'){
    // Opening draws two green six-unit panels inside its eighteen-unit span.
    // A post outside the span is swallowed by the solid masonry jamb. Keep
    // the source's central gap and dress both actual camera faces instead.
    const panel=materials.get('timber-shutter',{colour:'#65705a'}),edge=materials.get('shutter-edge',{colour:'#434a3b'}),rail=materials.get('shutter-rail',{colour:'#a8ac84'});
    const panelWidth=width/3,panelHeight=height*17/19,centre=(top+sill)*.5,border=width*.8/18;
    for(const side of [-1,1]){
      const x=side*width/3;
      box(x,centre,panelWidth,panelHeight,.060,panel);
      for(const offset of [-.036,.036]){
        for(const sign of [-1,1]){
          box(x+sign*(panelWidth-border)*.5,centre,border,panelHeight,.010,edge,offset);
          box(x,centre+sign*(panelHeight-border)*.5,panelWidth,border,.010,edge,offset);
        }
        for(const down of [5,10,15])box(x,top-height*down/19,width*4/18,height*.8/19,.012,rail,offset);
      }
    }
  }
}
