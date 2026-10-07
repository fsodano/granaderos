import {readFileSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {AnimationClip,AnimationMixer,Group,InterpolateDiscrete,InterpolateLinear,LoopOnce,Object3D,QuaternionKeyframeTrack,Vector3,VectorKeyframeTrack} from '../web/node_modules/three/build/three.module.js';
const libraryRoot=process.env.GRANADEROS_CHARACTER_LIBRARY?pathToFileURL(resolve(process.env.GRANADEROS_CHARACTER_LIBRARY)+sep):new URL('../web/public/models/characters/',import.meta.url);
export const manifest=JSON.parse(readFileSync(new URL('manifest.json',libraryRoot),'utf8'));
const formats={5121:['readUInt8',1,255],5123:['readUInt16LE',2,65535],5125:['readUInt32LE',4,4294967295],5126:['readFloatLE',4]},widths={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
export function readGlb(url){
 const bytes=readFileSync(new URL(url.replace('/models/characters/',''),libraryRoot)),size=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+size)),binary=bytes.subarray(28+size),cache=new Map();
 const access=index=>{
  if(cache.has(index))return cache.get(index);
  const a=json.accessors[index],view=json.bufferViews[a.bufferView],[read,size,max]=formats[a.componentType],width=widths[a.type];
  assert.ok(width);assert.equal(a.sparse,undefined,'Animation tracks use packed accessors');
  const values=Array.from({length:a.count*width},(_,i)=>{const value=binary[read]((view.byteOffset??0)+(a.byteOffset??0)+Math.floor(i/width)*(view.byteStride??size*width)+i%width*size);return a.normalized?value/max:value;});
  cache.set(index,values);return values;
 };
 return {json,access};
}
export function nativeScene(json){
 const nodes=json.nodes.map(def=>{const node=new Object3D();node.name=def.name;if(def.matrix)node.matrix.fromArray(def.matrix).decompose(node.position,node.quaternion,node.scale);else{if(def.translation)node.position.fromArray(def.translation);if(def.rotation)node.quaternion.fromArray(def.rotation);if(def.scale)node.scale.fromArray(def.scale);}return node;});
 json.nodes.forEach((def,i)=>(def.children??[]).forEach(child=>nodes[i].add(nodes[child])));
 const scene=new Group();for(const i of json.scenes[json.scene??0].nodes)scene.add(nodes[i]);scene.updateMatrixWorld(true);return scene;
}
export const banks=Object.fromEntries([['male','granadero'],['female','woman-scout']].map(([gender,appearance])=>[gender,{body:readGlb(manifest.appearances[appearance].lods[0].url),data:readGlb(manifest.animationLibraries[gender].url),specs:manifest.animationLibraries[gender].clips}]));
export function sampleBank(bank,name,fractions,read){
 const def=bank.data.json.animations.find(entry=>entry.name===name);assert.ok(def,`Published motion ${name} exists`);
 const clip=new AnimationClip(name,-1,def.channels.map(channel=>{const sampler=def.samplers[channel.sampler],property={translation:'position',rotation:'quaternion',scale:'scale'}[channel.target.path],Track=property==='quaternion'?QuaternionKeyframeTrack:VectorKeyframeTrack;assert.ok(['LINEAR','STEP'].includes(sampler.interpolation??'LINEAR'));return new Track(`${bank.data.json.nodes[channel.target.node].name}.${property}`,bank.data.access(sampler.input),bank.data.access(sampler.output),sampler.interpolation==='STEP'?InterpolateDiscrete:InterpolateLinear);}));
 const scene=nativeScene(bank.body.json),mixer=new AnimationMixer(scene),action=mixer.clipAction(clip).setLoop(LoopOnce,1);action.clampWhenFinished=true;action.play();
 const bones=bank.body.json.skins[0].joints.map(index=>scene.getObjectByName(bank.body.json.nodes[index].name)),native=bones.map(bone=>({position:bone.position.clone(),scale:bone.scale.clone()}));
 const point=name=>{const node=scene.getObjectByName(name);assert.ok(node,`Native joint ${name}`);return node.getWorldPosition(new Vector3());};
 const result=fractions.map(fraction=>{
  const time=clip.duration*fraction;mixer.setTime(time);scene.updateMatrixWorld(true);
  for(let i=0;i<bones.length;i++){
   if(bones[i].name!=='Root')assert.ok(bones[i].position.distanceTo(native[i].position)<.0001,`${name}: ${bones[i].name} retains its native joint position`);
   assert.ok(bones[i].scale.distanceTo(native[i].scale)<.0001,`${name}: ${bones[i].name} retains its native bone scale`);
  }
  return {fraction,time,...read(point,scene,time)};
 });
 mixer.stopAllAction();mixer.uncacheRoot(scene);return result;
}
