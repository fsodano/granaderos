import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import sharp from '../web/node_modules/sharp/lib/index.js';

const library=process.env.GRANADEROS_CHARACTER_LIBRARY?pathToFileURL(resolve(process.env.GRANADEROS_CHARACTER_LIBRARY)+sep):new URL('../web/public/models/characters/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',library),'utf8'));
const source=new URL('../assets/source/characters-3d/authoring/vendor/makehuman/',import.meta.url);
const formats={5121:['readUInt8',1,255],5123:['readUInt16LE',2,65535],5125:['readUInt32LE',4,4294967295],5126:['readFloatLE',4,1]};
const widths={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
const decoded=new Map();
function pixels(url){
 if(!decoded.has(url.href))decoded.set(url.href,sharp(url.pathname).toColourspace('srgb').removeAlpha().raw().toBuffer({resolveWithObject:true}));
 return decoded.get(url.href);
}
function glb(url){
 assert.ok(url.startsWith('/models/characters/'));
 const path=new URL(url.slice('/models/characters/'.length),library),raw=readFileSync(path),size=raw.readUInt32LE(12),json=JSON.parse(raw.subarray(20,20+size)),binary=raw.subarray(28+size);
 function access(index){
  const a=json.accessors[index],view=json.bufferViews[a.bufferView],[read,bytes,max]=formats[a.componentType],width=widths[a.type];
  assert.equal(a.sparse,undefined,'Surface attributes are stored directly');
  return Array.from({length:a.count},(_,i)=>Array.from({length:width},(_,c)=>{
   const value=binary[read]((view.byteOffset??0)+(a.byteOffset??0)+i*(view.byteStride??width*bytes)+c*bytes);
   return a.normalized?value/max:value;
  }));
 }
 return {path,json,access};
}
function faceUVs(model,material,channel=0){
 const {json,access}=model,head=json.skins[0].joints.findIndex(index=>json.nodes[index].name==='head');
 assert.ok(head>=0,'The native head joint is present');
 const uvs=[];
 for(const primitive of json.meshes.flatMap(mesh=>mesh.primitives).filter(p=>p.material===material)){
  const uv=access(primitive.attributes[`TEXCOORD_${channel}`]),normal=access(primitive.attributes.NORMAL),joints=access(primitive.attributes.JOINTS_0),weights=access(primitive.attributes.WEIGHTS_0),indices=access(primitive.indices).flat();
  // Native head weights and outward forward normals select the actual face,
  // without depending on an appearance's scale or an arbitrary UV rectangle.
  const faceVertex=i=>joints[i].reduce((sum,joint,c)=>sum+(joint===head?weights[i][c]:0),0)>.5&&normal[i][2]>.25;
  for(let i=0;i<indices.length;i+=3){
   const triangle=indices.slice(i,i+3);if(!triangle.every(faceVertex))continue;
   for(const id of triangle)uvs.push(uv[id]);
   uvs.push([0,1].map(c=>triangle.reduce((sum,id)=>sum+uv[id][c]/3,0)));
  }
 }
 assert.ok(uvs.length>0,'Forward-facing native head skin has texture coordinates');
 return uvs;
}
function sample(image,uv,channel){
 const {data,info}=image,x=Math.min(info.width-1,Math.max(0,Math.floor(uv[0]*info.width))),y=Math.min(info.height-1,Math.max(0,Math.floor(uv[1]*info.height)));
 return data[(y*info.width+x)*info.channels+channel];
}
function range(values){let low=Infinity,high=-Infinity;for(const value of values){low=Math.min(low,value);high=Math.max(high,value);}return high-low;}

for(const appearance of Object.values(manifest.appearances))for(const lod of appearance.lods)test(`${appearance.id} LOD${lod.lod} facial PBR maps retain source detail`,async()=>{
 const model=glb(lod.url),{json,path}=model,material=json.materials.findIndex(m=>m.name===appearance.materials.skin);
 assert.ok(material>=0,'Skin stays a separate material');
 const skin=json.materials[material],pbr=skin.pbrMetallicRoughness,generated=appearance.id==='granadero'&&Boolean(skin.extras?.skinAlbedoSourceSha256);
 const channels=[
  {role:'colour',texture:pbr.baseColorTexture,components:[0,1,2]},
  {role:'normal',texture:skin.normalTexture,components:[0,1]},
  {role:'roughness',texture:pbr.metallicRoughnessTexture,components:[1]},
 ];
 for(const {role,texture,components} of channels){
  assert.ok(texture,`Skin ${role} remains connected after export`);
  const registered=generated&&role==='colour',channel=registered?1:0,uvs=faceUVs(model,material,channel);
  assert.equal(texture.texCoord??0,channel,`${role} uses its retained or registered UV set`);
  const image=json.images[json.textures[texture.index].source];
  assert.equal(image.name,registered?'skin-granadero-generated-colour':`skin-${appearance.gender}-${role}`,`${role} belongs to the correct appearance source`);
  assert.ok(image.uri&&!image.uri.startsWith('data:'),'The image is a packaged library texture');
  if(registered){
   const bytes=readFileSync(new URL(image.uri,path)),original=readFileSync(new URL('../../generated/granadero-skin-colour.png',source));
   const hash=value=>createHash('sha256').update(value).digest('hex');
   assert.equal(hash(bytes),hash(original),'Generated albedo retains the exact registered source PNG');
   assert.equal(skin.extras.skinAlbedoSourceSha256,hash(original),'Tagged albedo identifies its exact source');
   const native=faceUVs(model,material,0);assert.equal(native.length,uvs.length);
   const shifts=uvs.map((uv,i)=>Math.hypot(uv[0]-native[i][0],uv[1]-native[i][1]));
   assert.ok(shifts.some(value=>value>1e-6),'Generated lips and brows use a local face registration');
   assert.ok(shifts.every(value=>Number.isFinite(value)&&value<.005),'Registration remains within the reviewed local face offset');
  }
  const [actual,expected]=await Promise.all([pixels(new URL(image.uri,path)),pixels(registered?new URL('../../generated/granadero-skin-colour.png',source):new URL(`skin-${appearance.gender}-${role}.png`,source))]);
  assert.deepEqual([actual.info.width,actual.info.height],[expected.info.width,expected.info.height],`${role} keeps the authored resolution`);
  for(const axis of [0,1])assert.ok(range(uvs.map(uv=>uv[axis]))*(axis?actual.info.height:actual.info.width)>1,'The face does not collapse onto a single texture texel');
  for(const component of components){
   const exported=uvs.map(uv=>sample(actual,uv,component)),authored=uvs.map(uv=>sample(expected,uv,component));
   assert.ok(range(authored)>2,`The authored face ${role} channel contains visible 8-bit detail`);
   let maxError=0;for(let i=0;i<exported.length;i++)maxError=Math.max(maxError,Math.abs(exported[i]-authored[i]));
   // A single quantization step permits encoding changes, but a grayscale,
   // constant, disconnected or clipped channel cannot reproduce these samples.
   assert.ok(maxError<=1,`Exported face ${role} channel ${component} differs from its authored map by ${maxError}/255`);
  }
 }
});
