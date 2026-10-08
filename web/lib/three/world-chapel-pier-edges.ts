import {CylinderGeometry,Matrix4,Quaternion,Vector3} from 'three';
import type {MeshStandardMaterial} from 'three';
import type {WorldBatch} from './world-geometry';

type Rectangle={minX:number;maxX:number;minZ:number;maxZ:number};
type Border={rect:Rectangle;support:Rectangle;bottom:number;top:number;base:number;light:number;bottomStroke?:boolean;topStroke?:number};

/** ArchitectureVolume outlines its retained faces at .45 source units and
 * its exposed cap at .5. Keep that local recipe on the real closed pier. */
export function addChapelPierEdges(batch:WorldBatch,material:MeshStandardMaterial,border:Border){
  const {rect,support,bottom,top,base,light}=border,V=25.066666666666666;
  const corners=[[rect.minX,rect.minZ],[rect.maxX,rect.minZ],[rect.maxX,rect.maxZ],[rect.minX,rect.maxZ]].map(([x,z])=>new Vector3(x,base+bottom,z));
  const raised=corners.map(point=>new Vector3(point.x,base+top,point.z));
  const edge=(a:Vector3,b:Vector3,width:number)=>{
    const vector=b.clone().sub(a);if(vector.lengthSq()<1e-12)return;
    const radius=width/V*.5,line=new CylinderGeometry(radius,radius,vector.length(),6),matrix=new Matrix4().compose(a.clone().add(b).multiplyScalar(.5),new Quaternion().setFromUnitVectors(new Vector3(0,1,0),vector.normalize()),new Vector3(1,1,1));
    line.applyMatrix4(matrix);
    // A fallback corner can clip a source face at the support boundary.
    // Its stroke must keep the same cell and never continue below the floor.
    const points=line.getAttribute('position');
    for(let n=0;n<points.count;n++)points.setXYZ(n,Math.max(support.minX,Math.min(support.maxX,points.getX(n))),Math.max(base,points.getY(n)),Math.max(support.minZ,Math.min(support.maxZ,points.getZ(n))));
    line.computeVertexNormals();batch.add(line,material,undefined,light);line.dispose();
  };
  for(let n=0;n<4;n++){
    const next=(n+1)%4;edge(corners[n],raised[n],.45);
    if(border.bottomStroke)edge(corners[n],corners[next],.45);
    if(border.topStroke)edge(raised[n],raised[next],border.topStroke);
  }
}
