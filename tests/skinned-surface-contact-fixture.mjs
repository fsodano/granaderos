import assert from 'node:assert/strict';
import {Ray,Triangle,Vector3} from '../web/node_modules/three/build/three.module.js';

// Use the exported triangles and their native skin weights. A head pivot or
// a nearest vertex can miss the nose, jaw, or centre of a broad triangle.
export function skinnedSurface(root,accept){
 const parts=[];
 root.traverse(mesh=>{
  if(!mesh.isSkinnedMesh||!accept(mesh))return;
  const position=mesh.geometry.attributes.position,skinIndex=mesh.geometry.attributes.skinIndex,skinWeight=mesh.geometry.attributes.skinWeight,index=mesh.geometry.index,head=[];
  for(let vertex=0;vertex<position.count;vertex++){
   let weight=0;for(let slot=0;slot<4;slot++)if(accept(mesh,mesh.skeleton.bones[skinIndex.getComponent(vertex,slot)].name))weight+=skinWeight.getComponent(vertex,slot);
   head.push(weight>.5);
  }
  const triangles=[],vertices=new Set();
  for(let offset=0;offset<index.count;offset+=3){const face=[index.getX(offset),index.getX(offset+1),index.getX(offset+2)];if(face.every(vertex=>head[vertex])){triangles.push(face);for(const vertex of face)vertices.add(vertex);}}
  if(triangles.length)parts.push({mesh,position,triangles,vertices:[...vertices]});
 });
 assert.ok(parts.reduce((sum,part)=>sum+part.triangles.length,0)>0,'The contact review contains the actual exported surface');
 return ()=>parts.flatMap(({mesh,position,triangles,vertices})=>{
  const points=new Map(vertices.map(vertex=>[vertex,mesh.localToWorld(mesh.applyBoneTransform(vertex,new Vector3().fromBufferAttribute(position,vertex)))]));
  return triangles.map(face=>face.map(vertex=>points.get(vertex)));
 });
}
export function headSurface(root){
 const surface=skinnedSurface(root,(mesh,bone)=>bone===undefined?(mesh.material.name==='Skin'||mesh.material.userData.role==='skin'):['head','neck_01'].includes(bone));
 return ()=>{const faces=surface();assert.ok(faces.length>1000,'The review contains the actual face and neck triangles');return faces;};
}

const u=new Vector3(),v=new Vector3(),w=new Vector3(),onP=new Vector3(),onQ=new Vector3(),closest=new Vector3(),direction=new Vector3(),ray=new Ray(),triangle=new Triangle();
function segmentDistanceSquared(p0,p1,q0,q1){
 u.subVectors(p1,p0);v.subVectors(q1,q0);w.subVectors(p0,q0);
 const a=u.dot(u),b=u.dot(v),c=v.dot(v),d=u.dot(w),e=v.dot(w),denominator=a*c-b*b;
 if(a<1e-12)return closest.copy(q0).addScaledVector(v,c>1e-12?Math.max(0,Math.min(1,e/c)):0).distanceToSquared(p0);
 if(c<1e-12)return closest.copy(p0).addScaledVector(u,Math.max(0,Math.min(1,-d/a))).distanceToSquared(q0);
 let s=denominator>1e-12?Math.max(0,Math.min(1,(b*e-c*d)/denominator)):0,t=(b*s+e)/c;
 if(t<0){t=0;s=Math.max(0,Math.min(1,-d/a));}else if(t>1){t=1;s=Math.max(0,Math.min(1,(b-d)/a));}
 return onP.copy(p0).addScaledVector(u,s).distanceToSquared(onQ.copy(q0).addScaledVector(v,t));
}

export function capsuleSurfaceGap(start,end,radius,faces){
 assert.ok(radius>=0&&start.distanceToSquared(end)>1e-12);
 let minimum=Infinity;direction.subVectors(end,start).normalize();ray.set(start,direction);const lengthSquared=start.distanceToSquared(end);
 const low=[0,1,2].map(axis=>Math.min(start.getComponent(axis),end.getComponent(axis))),high=[0,1,2].map(axis=>Math.max(start.getComponent(axis),end.getComponent(axis)));
 for(const [a,b,c]of faces){
  // Box distance is a lower bound, so this skips distant triangles without
  // weakening the exact segment-to-triangle result for the nearest surface.
  let bound=0;for(let axis=0;axis<3;axis++){const triLow=Math.min(a.getComponent(axis),b.getComponent(axis),c.getComponent(axis)),triHigh=Math.max(a.getComponent(axis),b.getComponent(axis),c.getComponent(axis)),gap=Math.max(0,low[axis]-triHigh,triLow-high[axis]);bound+=gap*gap;}
  if(bound>=minimum)continue;
  triangle.set(a,b,c);
  if(triangle.getArea()<1e-12){
   // Collapsed cloth faces retain a line or point distance. Feeding their
   // zero-area barycentric denominator into closestPointToPoint yields NaN.
   minimum=Math.min(minimum,segmentDistanceSquared(start,end,a,b),segmentDistanceSquared(start,end,b,c),segmentDistanceSquared(start,end,c,a));continue;
  }
  if(ray.intersectTriangle(a,b,c,false,closest)&&closest.distanceToSquared(start)<=lengthSquared)return -radius;
  minimum=Math.min(minimum,triangle.closestPointToPoint(start,closest).distanceToSquared(start),triangle.closestPointToPoint(end,closest).distanceToSquared(end),segmentDistanceSquared(start,end,a,b),segmentDistanceSquared(start,end,b,c),segmentDistanceSquared(start,end,c,a));
 }
 return Math.sqrt(minimum)-radius;
}
