import test from 'node:test';
import assert from 'node:assert/strict';
import {manifest,readGlb} from './character-bank-fixture.mjs';

const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const length=a=>Math.hypot(...a);
const vector=(values,index)=>values.slice(index*3,index*3+3);

function headDetails({json,access}){
 const head=json.skins[0].joints.findIndex(index=>json.nodes[index].name==='head');
 assert.ok(head>=0,'The native head joint exists');
 const components=[];
 for(const mesh of json.meshes)for(const primitive of mesh.primitives){
  if(json.materials[primitive.material].name==='Skin'||json.materials[primitive.material].extras?.role==='skin')continue;
  const positions=access(primitive.attributes.POSITION),normals=access(primitive.attributes.NORMAL),joints=access(primitive.attributes.JOINTS_0),weights=access(primitive.attributes.WEIGHTS_0),indices=access(primitive.indices);
  const onHead=index=>[0,1,2,3].reduce((sum,slot)=>sum+(joints[index*4+slot]===head?weights[index*4+slot]:0),0)>.999;
  // UV seams and ellipsoid poles can have duplicate render vertices. Weld
  // positions at 0.1 micrometre before testing the actual closed surface.
  const keys=new Map(),canonical=new Map(),points=[],parents=[];
  function weld(index){
   if(canonical.has(index))return canonical.get(index);
   const point=vector(positions,index),key=point.map(v=>Math.round(v/1e-7)).join(',');
   if(!keys.has(key)){keys.set(key,points.length);parents.push(points.length);points.push(point);}
   const id=keys.get(key);canonical.set(index,id);return id;
  }
  function find(index){while(parents[index]!==index){parents[index]=parents[parents[index]];index=parents[index];}return index;}
  const faces=[];
  for(let offset=0;offset<indices.length;offset+=3){
   const raw=indices.slice(offset,offset+3);if(!raw.every(onHead))continue;
   const ids=raw.map(weld);if(new Set(ids).size!==3)continue;
   const [a,b,c]=raw.map(index=>vector(positions,index)),normal=cross(sub(b,a),sub(c,a));
   if(length(normal)<1e-14)continue;
   for(const id of ids.slice(1))parents[find(id)]=find(ids[0]);
   faces.push({raw,ids,normal});
  }
  const groups=new Map();
  for(const face of faces){const id=find(face.ids[0]);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(face);}
  for(const group of groups.values()){
   const vertices=[...new Set(group.flatMap(face=>face.ids))].map(id=>points[id]);
   const low=[0,1,2].map(axis=>Math.min(...vertices.map(v=>v[axis]))),high=[0,1,2].map(axis=>Math.max(...vertices.map(v=>v[axis]))),center=low.map((v,i)=>(v+high[i])/2),dimensions=sub(high,low);
   const edges=new Map(),directions=new Map();let area=0,volume=0,normalAgreement=0,outwardNormals=0,front=0,frontNormals=0;
   for(const {raw,ids,normal} of group){
    for(let i=0;i<3;i++){const key=[ids[i],ids[(i+1)%3]].sort((a,b)=>a-b).join(',');edges.set(key,(edges.get(key)??0)+1);directions.set(key,(directions.get(key)??0)+(ids[i]<ids[(i+1)%3]?1:-1));}
    const [a,b,c]=raw.map(index=>vector(positions,index)),centroid=a.map((v,i)=>(v+b[i]+c[i])/3),radial=sub(centroid,center),weight=length(normal),vertexNormal=[0,1,2].map(axis=>raw.reduce((sum,index)=>sum+normals[index*3+axis]/3,0));
    area+=weight;volume+=dot(sub(a,center),cross(sub(b,center),sub(c,center)))/6;
    if(dot(normal,vertexNormal)>0)normalAgreement+=weight;
    if(dot(vertexNormal,radial)>0)outwardNormals+=weight;
    // Native bodies face +Z in the exported GLB. Both winding and supplied
    // shading normals must point toward the visible front of each eye.
    if(normal[2]>0)front+=weight;
    if(vertexNormal[2]>0)frontNormals+=weight;
   }
   components.push({center,dimensions,closed:[...edges.values()].every(count=>count===2),volume,consistentWinding:[...directions.values()].every(value=>value===0),normalAgreement:normalAgreement/area,outwardNormals:outwardNormals/area,front:front/area,frontNormals:frontNormals/area});
  }
 }
 return components;
}

for(const appearance of Object.values(manifest.appearances))for(const lod of appearance.lods)test(`${appearance.id} LOD${lod.lod} eyes have outward sclera and forward iris/pupil surfaces`,()=>{
 const parts=headDetails(readGlb(lod.url));
 // The two roughly 23 mm closed eye shells remain distinguishable after
 // LOD reduction. Broad size limits allow its asymmetric collapsed facets;
 // the coaxial iris/pupil pairing below rejects other small head details.
 const eyes=parts.filter(c=>c.closed&&c.dimensions.every(d=>d>.015&&d<.035));
 assert.equal(eyes.length,2,'Exactly two closed native-head eye shells survive export');
 for(const eye of eyes){
  const side=eye.center[0]>0?'left':'right';
  assert.ok(eye.volume>0,`${side} sclera has positive signed volume (outward winding)`);
  // Signed volume plus consistent manifold orientation works for the mildly
  // concave reduced shells too; a centre-radial test wrongly rejects them.
  assert.ok(eye.consistentWinding,`${side} sclera has opposite winding at each shared edge`);
  assert.ok(eye.normalAgreement>.999,`${side} sclera shading normals agree with outward triangle winding`);
  assert.ok(eye.outwardNormals>.999,`${side} sclera shading normals face outward`);
  for(const [name,low,high] of [['iris',.007,.013],['pupil',.002,.005]]){
   const patches=parts.filter(c=>!c.closed&&c.dimensions[0]>low&&c.dimensions[0]<high&&c.dimensions[1]>low&&c.dimensions[1]<high&&c.dimensions[2]<.003&&Math.hypot(c.center[0]-eye.center[0],c.center[1]-eye.center[1])<.003&&c.center[2]>eye.center[2]+.005&&c.center[2]<eye.center[2]+.018);
   assert.equal(patches.length,1,`${side} eye retains one coaxial ${name} surface`);
   assert.ok(patches[0].front>.999,`${side} ${name} triangles face forward`);
   assert.ok(patches[0].frontNormals>.999,`${side} ${name} shading normals face forward`);
  }
 }
});
