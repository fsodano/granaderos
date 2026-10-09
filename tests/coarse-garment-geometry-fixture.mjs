// Independent decoded-stream and oriented-corner checks for native garments.
// No installer/source verdict decides whether the published data stays exact.
import {readFileSync} from 'node:fs';
import {Vector3} from '../web/node_modules/three/build/three.module.js';

const widths={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16};
const formats={5120:['readInt8',1,127],5121:['readUInt8',1,255],5122:['readInt16LE',2,32767],5123:['readUInt16LE',2,65535],5125:['readUInt32LE',4,4294967295],5126:['readFloatLE',4,1]};
export function decodedGlb(path){
 const raw=readFileSync(path),jsonBytes=raw.readUInt32LE(12),json=JSON.parse(raw.subarray(20,20+jsonBytes)),binary=raw.subarray(28+jsonBytes),cache=new Map();
 const rows=index=>{
  if(cache.has(index))return cache.get(index);
  const a=json.accessors[index],[read,size,max]=formats[a.componentType],width=widths[a.type],result=Array.from({length:a.count},()=>Array(width).fill(0));
  const readRows=(viewIndex,offset,count,stride=size*width)=>{const view=json.bufferViews[viewIndex],start=(view.byteOffset??0)+offset;return Array.from({length:count},(_,i)=>Array.from({length:width},(_,c)=>{const value=binary[read](start+i*stride+c*size);return a.normalized?Math.max(a.componentType===5120||a.componentType===5122?-1:0,value/max):value;}));};
  if(a.bufferView!==undefined){const view=json.bufferViews[a.bufferView];result.splice(0,result.length,...readRows(a.bufferView,a.byteOffset??0,a.count,view.byteStride??size*width));}
  if(a.sparse){const {indices,values,count}=a.sparse,[iread,isize]=formats[indices.componentType],iv=json.bufferViews[indices.bufferView],start=(iv.byteOffset??0)+(indices.byteOffset??0),patch=readRows(values.bufferView,values.byteOffset??0,count);for(let i=0;i<count;i++)result[binary[iread](start+i*isize)]=patch[i];}
  cache.set(index,result);return result;
 };
 return {raw,json,binary,rows};
}

export function primitiveFor(body,name){const node=body.json.nodes.find(n=>n.name===name);if(!node||node.mesh===undefined)throw Error('Missing native mesh '+name);const mesh=body.json.meshes[node.mesh];if(mesh.primitives.length!==1)throw Error('Expected one retained native primitive '+name);return {node,mesh,index:node.mesh,primitive:mesh.primitives[0]};}
export function triangleIndices(body,primitive){const flat=body.rows(primitive.indices).map(r=>r[0]);return Array.from({length:flat.length/3},(_,i)=>flat.slice(i*3,i*3+3));}
export function namedWeights(body,primitive,vertex,skinIndex=0){const joints=body.rows(primitive.attributes.JOINTS_0)[vertex],weights=body.rows(primitive.attributes.WEIGHTS_0)[vertex],skin=body.json.skins[skinIndex];return joints.map((joint,i)=>[body.json.nodes[skin.joints[joint]].name,weights[i]]).filter(([,weight])=>weight!==0).sort(([a],[b])=>a.localeCompare(b));}
export function canonicalTriangles(body,primitive,selected=null,ignored=[]){
 const ignore=new Set(ignored),attributes=Object.keys(primitive.attributes).filter(key=>!ignore.has(key)).sort(),values=Object.fromEntries(attributes.map(key=>[key,body.rows(primitive.attributes[key])])),targets=(primitive.targets??[]).map(target=>Object.fromEntries(Object.keys(target).filter(key=>!ignore.has(key)).sort().map(key=>[key,body.rows(target[key])]))),indices=triangleIndices(body,primitive);
 const corner=i=>JSON.stringify({attributes:Object.fromEntries(attributes.map(key=>[key,values[key][i]])),targets:targets.map(target=>Object.fromEntries(Object.entries(target).map(([key,rows])=>[key,rows[i]])))});
 return (selected??indices.map((_,i)=>i)).map(i=>{const corners=indices[i].map(corner);return [0,1,2].map(start=>JSON.stringify([corners[start],corners[(start+1)%3],corners[(start+2)%3]])).sort()[0];}).sort();
}

export function triangleNormal(vertices){const points=vertices.map(p=>p instanceof Vector3?p:new Vector3(...p));return new Vector3().crossVectors(points[1].clone().sub(points[0]),points[2].clone().sub(points[0])).normalize();}
