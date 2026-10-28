import {Quaternion,Vector3} from 'three';
import {WorldBatch} from './world-geometry';
import type {WorldMaterials} from './world-materials';

/** A leaf keeps its existing hinge and span; decoration follows both faces. */
export function addDoorLeaf(batch:WorldBatch,materials:WorldMaterials,{width:w,height:h,sign,style,broken,light,sourceBands=false}:{width:number;height:number;sign:number;style:string;broken:boolean;light:number;sourceBands?:boolean}){
  const wood=materials.get('wood'),dark=materials.get('darkwood'),iron=materials.get('iron');
  // Opening's narrow timber mouldings and braces use lighter edge colours.
  // Retain the shared wood texture on the leaf rather than bleaching it.
  const moulding=materials.get('timber-edge',{colour:'#9c8058'}),brace=materials.get('timber-brace',{colour:'#baa077'});
  batch.box(wood,sign*w*.5,h*.5,0,w,h*.98,.06,light);
  const full=h>=.75;
  for(const face of [-1,1]){
    const z=face*.036;
    if(style==='panelled'&&full){
      const edge=.018,panelW=w*.27,panelH=h*.30;
      for(const x of [.28,.72])for(const y of [.30,.70]){
        const u=sign*w*x,v=h*y;
        batch.box(dark,u,v,z,panelW,panelH,.008,light);
        for(const side of [-1,1]){
          batch.box(moulding,u+side*(panelW+edge)*.5,v,face*.047,edge,panelH+edge*2,.022,light);
          batch.box(moulding,u,v+side*(panelH+edge)*.5,face*.047,panelW+edge*2,edge,.022,light);
        }
      }
    }else{
      const planks=style==='double'?3:6;
      for(let n=1;n<planks;n++)batch.box(dark,sign*w*n/planks,h*.5,z,.012,h*.93,.008,light);
      if(full){
        // Opening draws its two cross bands at 7/33 and 24/33 of the leaf,
        // 1.3 source units high, with a one-unit inset at each edge. Each
        // physical double leaf retains its own band and working hinge.
        const authored=sourceBands,wide=['double','barn','arched'].includes(style),span=authored?w*(1-2/(wide?28:18)):w*.82;
        const band=authored?materials.get('door-cross-band',{colour:'#4b4435'}):iron;
        for(const y of authored?[7/33,24/33]:[.21,.73])batch.box(band,sign*w*.5,h*y,face*.046,span,authored?h*1.3/33:.032,.016,light);
      }
    }
    if(style==='barn'&&full){
      batch.box(dark,sign*w*.5,h*.5,z,.014,h*.94,.009,light);
      // The source gate has two diagonal timber braces. A flat rectangular
      // section keeps their join legible without making round metal rods.
      for(const x of [.10,.90]){
        const a=new Vector3(sign*w*x,h*.88,face*.051),b=new Vector3(sign*w*.5,h*.10,face*.051),delta=b.clone().sub(a);
        batch.primitive('box',brace,a.clone().add(b).multiplyScalar(.5),[.045,delta.length(),.022],new Quaternion().setFromUnitVectors(new Vector3(0,1,0),delta.normalize()),light);
      }
    }
    if(full){
      for(const y of [.23,.75])batch.box(iron,sign*w*.09,h*y,face*.048,w*.15,.065,.018,light);
      batch.box(iron,sign*w*.83,h*.46,face*.047,.045,.09,.014,light);
      batch.primitive('sphere',materials.get('brass'),[sign*w*.83,h*.46,face*.062],[.023,.023,.018],undefined,light);
    }
    if(broken)batch.box(dark,sign*w*.5,h*.54,face*.047,w*.9,.035,.018,light);
  }
}
