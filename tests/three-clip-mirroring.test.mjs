import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {AnimationClip,AnimationMixer,Euler,InterpolateDiscrete,InterpolateLinear,Group,Matrix4,Object3D,Quaternion,QuaternionKeyframeTrack,Vector3,VectorKeyframeTrack} from '../web/node_modules/three/build/three.module.js';
const {mirroredClip,fitMirroredSockets,withMirroredProps}=await import('../web/lib/three/clip-mirroring.ts');
const root=new URL('../web/public/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('models/characters/manifest.json',root),'utf8'));
function glb(url){
 const bytes=readFileSync(new URL(`.${url}`,root)),length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length)),binary=bytes.subarray(28+length);
 const access=index=>{const a=json.accessors[index],v=json.bufferViews[a.bufferView],size={SCALAR:1,VEC3:3,VEC4:4}[a.type];assert.equal(a.componentType,5126);assert.ok(size);return Array.from({length:a.count*size},(_,i)=>binary.readFloatLE((v.byteOffset??0)+(a.byteOffset??0)+Math.floor(i/size)*(v.byteStride??size*4)+i%size*4));};
 return {json,access};
}
function rig(json){
 const nodes=json.nodes.map(def=>{const node=new Object3D();node.name=def.name;if(def.matrix){node.matrix.fromArray(def.matrix).decompose(node.position,node.quaternion,node.scale);}else{if(def.translation)node.position.fromArray(def.translation);if(def.rotation)node.quaternion.fromArray(def.rotation);if(def.scale)node.scale.fromArray(def.scale);}return node;});
 json.nodes.forEach((def,i)=>(def.children??[]).forEach(child=>nodes[i].add(nodes[child])));const scene=new Group();for(const i of json.scenes[json.scene??0].nodes)scene.add(nodes[i]);scene.updateMatrixWorld(true);return scene;
}
function clip(data,name){
 const def=data.json.animations.find(entry=>entry.name===name);assert.ok(def,name);
 return new AnimationClip(name,-1,def.channels.map(channel=>{const sampler=def.samplers[channel.sampler],property={translation:'position',rotation:'quaternion',scale:'scale'}[channel.target.path],Class=property==='quaternion'?QuaternionKeyframeTrack:VectorKeyframeTrack;assert.ok(['LINEAR','STEP'].includes(sampler.interpolation??'LINEAR'));return new Class(`${data.json.nodes[channel.target.node].name}.${property}`,data.access(sampler.input),data.access(sampler.output),sampler.interpolation==='STEP'?InterpolateDiscrete:InterpolateLinear);}));
}

for(const [appearance,bank]of [['granadero','male'],['woman-scout','female']])test(`${bank} native pistol clips mirror hand motion and preserve all native bone lengths`,()=>{
 const body=glb(manifest.appearances[appearance].lods[0].url),rest=rig(body.json),data=glb(manifest.animationLibraries[bank].url),spec=manifest.animationMirroring;
 assert.equal(Object.keys(spec.bones).length,53);
 for(const posture of ['stand','crouch','prone','mounted'])for(const action of ['aim','fire']){
  const original=clip(data,`${posture}.${action}.short-gun`),values=original.tracks.map(track=>Array.from(track.values));
  const mirrored=mirroredClip(original,rest,spec);assert.equal(mirroredClip(original,rest,spec),mirrored,'one derived clip is cached per source model and source clip');
  const a=rest.clone(true),b=rest.clone(true),am=new AnimationMixer(a),bm=new AnimationMixer(b);fitMirroredSockets(a,manifest.appearances[appearance].sockets);fitMirroredSockets(b,manifest.appearances[appearance].sockets);am.clipAction(original).play();bm.clipAction(mirrored).play();
  for(const time of [0,.11,.20,.36]){
   am.setTime(time);bm.setTime(time);a.updateMatrixWorld(true);b.updateMatrixWorld(true);
   const sockets=manifest.appearances[appearance].sockets,right=a.getObjectByName(sockets.handRight_pistol.node),left=b.getObjectByName(sockets.handLeft_pistol.node);
   const aim=new Vector3(1,0,0).transformDirection(right.matrixWorld);aim.x*=-1;
   const offhandAim=new Vector3(1,0,0).transformDirection(left.matrixWorld);
   assert.ok(aim.dot(offhandAim)>.999,`${original.name} mirrored pistol points away: ${aim.dot(offhandAim)}`);
   for(const [name,targetName]of Object.entries(spec.bones)){
    const source=a.getObjectByName(name),target=b.getObjectByName(targetName),expected=source.getWorldPosition(new Vector3());expected.x*=-1;
    const actual=target.getWorldPosition(new Vector3());assert.ok(actual.distanceTo(expected)<.00004,`${original.name} ${time} ${name} head differs by ${actual.distanceTo(expected)}m`);
    const restTarget=rest.getObjectByName(targetName);
    if(name!==manifest.bones.root)assert.ok(Math.abs(target.position.length()-restTarget.position.length())<.00005,`${targetName} native local length changed`);
   }
  }
  original.tracks.forEach((track,index)=>assert.deepEqual(Array.from(track.values),values[index],'shared source animation is not modified'));
 }
});

test('mirror bindings and channels are explicit and missing mappings cannot silently animate the wrong side',()=>{
 const root=new Group(),bone=new Object3D();bone.name='right';root.add(bone);
 const clip=new AnimationClip('source',1,[new QuaternionKeyframeTrack('right.quaternion',[0,1],[0,0,0,1,0,0,0,1])]);
 assert.throws(()=>mirroredClip(clip,root,{axis:'x',bones:{right:'missing'}}),/Missing symmetric animation bone/);
});

for(const appearance of ['granadero','woman-scout'])test(`${appearance} mirrored loading props fit the opposite native socket with a proper rod frame`,()=>{
 const rest=rig(glb(manifest.appearances[appearance].lods[0].url).json),spec={name:'loading',loop:false,propCues:[{item:'ramrod',socket:'socket_handLeft_tool',start:2.208,end:4.128,scale:1/3}]},before=structuredClone(spec),derived=withMirroredProps(spec,rest),cue=derived.propCues[0];
 assert.equal(withMirroredProps(spec,rest),derived);assert.equal(cue.socket,'socket_handRight_tool');assert.equal(cue.scale,1/3);assert.deepEqual(spec,before);
 const source=rest.getObjectByName(spec.propCues[0].socket),target=rest.getObjectByName(cue.socket),matrix=target.matrixWorld.clone().multiply(new Matrix4().compose(new Vector3().fromArray(cue.position),new Quaternion().setFromEuler(new Euler(...cue.rotation)),new Vector3(1,1,1)));
 const expected=source.getWorldPosition(new Vector3());expected.x*=-1;assert.ok(new Vector3().setFromMatrixPosition(matrix).distanceTo(expected)<.000001);
 const rod=new Vector3(0,1,0).transformDirection(source.matrixWorld);rod.x*=-1;assert.ok(rod.dot(new Vector3(0,1,0).transformDirection(matrix))>.999999,'The mirrored rod follows the reflected barrel direction');assert.ok(matrix.determinant()>0,'The prop retains positive dimensions');
 assert.throws(()=>withMirroredProps({...spec,propCues:[{...spec.propCues[0],socket:'missing'}]},rest),/Missing mirrored prop socket/);
});

test('exported mounted fall metadata releases saddle support by each actual ground marker',()=>{
 for(const bank of Object.values(manifest.animationLibraries))for(const name of ['life.mounted.die','life.mounted.collapse','life.mounted.knockdown']){
  const clip=bank.clips.find(clip=>clip.name===name);assert.ok(clip.markers.ground>0);assert.equal(clip.seatWeight[0].weight,1);
  assert.ok(clip.seatWeight.some(key=>key.time<=clip.markers.ground&&key.weight===0));assert.equal(clip.seatWeight.at(-1).weight,0);
 }
});
