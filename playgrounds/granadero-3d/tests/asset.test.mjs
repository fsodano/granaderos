import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const bytes=readFileSync(new URL('../public/assets/granadero.glb',import.meta.url));
const manifest=JSON.parse(readFileSync(new URL('../public/assets/asset-manifest.json',import.meta.url),'utf8'));
const requiredClips=['Idle','Walk','Run','RifleAim','RifleFire','SabreReady','SabreSlash','PistolAim','PistolFire'];
const oneShotEvents={RifleFire:'shot',PistolFire:'shot',SabreSlash:'hit'};

function parseGlb(buffer){
 assert.ok(buffer.length>=20,'GLB header is present');
 assert.equal(buffer.readUInt32LE(0),0x46546c67,'GLB magic');
 assert.equal(buffer.readUInt32LE(4),2,'GLB version');
 assert.equal(buffer.readUInt32LE(8),buffer.length,'GLB declared length');
 const chunks=[];
 for(let offset=12;offset<buffer.length;){
  assert.ok(offset+8<=buffer.length,'Complete chunk header');
  const length=buffer.readUInt32LE(offset),type=buffer.readUInt32LE(offset+4);
  assert.equal(length%4,0,'Chunk is aligned to four bytes');
  assert.ok(offset+8+length<=buffer.length,'Chunk stays inside the file');
  chunks.push({type,data:buffer.subarray(offset+8,offset+8+length)});
  offset+=8+length;
 }
 assert.equal(chunks[0]?.type,0x4e4f534a,'JSON is the first chunk');
 assert.equal(chunks.filter(chunk=>chunk.type===0x4e4f534a).length,1,'One JSON chunk');
 assert.equal(chunks.filter(chunk=>chunk.type===0x004e4942).length,1,'One embedded binary chunk');
 return {gltf:JSON.parse(chunks[0].data.toString('utf8').trim()),binary:chunks.find(chunk=>chunk.type===0x004e4942).data};
}
const {gltf,binary}=parseGlb(bytes);
let cpuAsset;
function loadCpuAsset(){
 if(!cpuAsset){
  const loader=new GLTFLoader();
  // The CPU test exercises loader/material/animation wiring. Embedded image
  // bytes are checked below; the browser verifies their decoded appearance.
  loader.register(parser=>({
   name:'GranaderoCpuTexturePlaceholder',
   loadTexture(index){
    assert.ok(parser.json.textures?.[index],`Texture ${index} exists`);
    const texture=new THREE.Texture();
    texture.name=parser.json.textures[index].name??`CPU texture ${index}`;
    texture.userData.cpuTestPlaceholder=true;
    return Promise.resolve(texture);
   }
  }));
  cpuAsset=loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 }
 return cpuAsset;
}
const components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
const formats={
 5120:{size:1,read:'getInt8',max:127},5121:{size:1,read:'getUint8',max:255},
 5122:{size:2,read:'getInt16',max:32767},5123:{size:2,read:'getUint16',max:65535},
 5125:{size:4,read:'getUint32',max:4294967295},5126:{size:4,read:'getFloat32'}
};
const accessorCache=new Map();
function readAccessor(index){
 if(accessorCache.has(index))return accessorCache.get(index);
 const accessor=gltf.accessors[index];assert.ok(accessor,`Accessor ${index} exists`);
 const format=formats[accessor.componentType],width=components[accessor.type];
 assert.ok(format&&width,`Supported accessor format at ${index}`);
 assert.ok(Number.isInteger(accessor.count)&&accessor.count>0,`Accessor ${index} has elements`);
 const values=Array.from({length:accessor.count},()=>Array(width).fill(0));
 const read=(viewIndex,offset,count,stride,consume)=>{
  const view=gltf.bufferViews[viewIndex];assert.ok(view,`Buffer view ${viewIndex} exists`);
  assert.equal(view.buffer,0,'Accessor uses the embedded binary buffer');
  const start=(view.byteOffset??0)+offset;
  assert.ok(offset>=0&&offset+(count-1)*stride+width*format.size<=view.byteLength,`Accessor ${index} fits its buffer view`);
  const data=new DataView(binary.buffer,binary.byteOffset,binary.byteLength);
  for(let row=0;row<count;row++)for(let component=0;component<width;component++){
   let value=data[format.read](start+row*stride+component*format.size,true);
   if(accessor.normalized&&format.max)value=Math.max(-1,value/format.max);
   assert.ok(Number.isFinite(value),`Accessor ${index} has finite values`);consume(row,component,value);
  }
 };
 if(accessor.bufferView!==undefined){
  const view=gltf.bufferViews[accessor.bufferView];
  read(accessor.bufferView,accessor.byteOffset??0,accessor.count,view?.byteStride??width*format.size,(row,col,value)=>values[row][col]=value);
 }
 if(accessor.sparse){
  const sparse=accessor.sparse,indexFormat=formats[sparse.indices.componentType];
  assert.ok(indexFormat&&[5121,5123,5125].includes(sparse.indices.componentType),'Valid sparse index format');
  const view=gltf.bufferViews[sparse.indices.bufferView],offset=(view.byteOffset??0)+(sparse.indices.byteOffset??0);
  assert.ok((sparse.indices.byteOffset??0)+sparse.count*indexFormat.size<=view.byteLength,'Sparse indices fit their view');
  const data=new DataView(binary.buffer,binary.byteOffset,binary.byteLength),indices=[];
  for(let row=0;row<sparse.count;row++){
   const value=data[indexFormat.read](offset+row*indexFormat.size,true);
   assert.ok(value<accessor.count&&(row===0||value>indices[row-1]),'Sparse indices are ordered and in range');indices.push(value);
  }
  read(sparse.values.bufferView,sparse.values.byteOffset??0,sparse.count,width*format.size,(row,col,value)=>values[indices[row]][col]=value);
 }
 accessorCache.set(index,values);return values;
}
const allJoints=new Set((gltf.skins??[]).flatMap(skin=>skin.joints));
function descendants(index){
 const found=new Set(),pending=[index];
 while(pending.length){const next=pending.pop();if(found.has(next))continue;found.add(next);pending.push(...(gltf.nodes[next]?.children??[]));}
 return found;
}
function animationInfo(animation){
 let duration=0;const changingJoints=new Set();
 for(const channel of animation.channels){
  const sampler=animation.samplers[channel.sampler];assert.ok(sampler,`${animation.name} channel has a sampler`);
  const input=gltf.accessors[sampler.input];assert.equal(input?.type,'SCALAR','Animation key times are scalar');
  const times=readAccessor(sampler.input).map(row=>row[0]);
  for(let index=0;index<times.length;index++)assert.ok(times[index]>=0&&(index===0||times[index]>times[index-1]),`${animation.name} key times increase`);
  duration=Math.max(duration,times.at(-1));
  const output=readAccessor(sampler.output),cubic=sampler.interpolation==='CUBICSPLINE';
  assert.equal(output.length,times.length*(cubic?3:1),`${animation.name} key times and values match`);
  assert.ok(gltf.nodes[channel.target.node],`${animation.name} target exists`);
  const keys=cubic?times.map((_,index)=>output[index*3+1]):output;
  if(allJoints.has(channel.target.node)&&['rotation','translation'].includes(channel.target.path)&&keys.some(key=>key.some((value,index)=>Math.abs(value-keys[0][index])>1e-5)))changingJoints.add(channel.target.node);
 }
 return {duration,changingJoints};
}

test('GLB embeds its geometry and resources without network dependencies',()=>{
 assert.equal(gltf.asset.version,'2.0');assert.equal(gltf.buffers.length,1);
 assert.equal(gltf.buffers[0].uri,undefined,'Binary data is embedded');
 assert.ok(gltf.buffers[0].byteLength<=binary.length&&binary.length-gltf.buffers[0].byteLength<=3,'Binary length matches except optional padding');
 for(const view of gltf.bufferViews){assert.equal(view.buffer,0);assert.ok((view.byteOffset??0)>=0&&(view.byteOffset??0)+view.byteLength<=gltf.buffers[0].byteLength,'Buffer views stay inside the embedded data');}
 for(const image of gltf.images??[]){
  assert.equal(image.uri,undefined,'Textures have no external URI');
  const view=gltf.bufferViews[image.bufferView];assert.ok(view,'Texture is embedded');assert.ok(view.byteLength>0,'Embedded image is not empty');
  const data=binary.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength);
  if(image.mimeType==='image/png')assert.ok(data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'Embedded PNG has its file signature');
  else if(image.mimeType==='image/jpeg')assert.ok(data[0]===255&&data[1]===216,'Embedded JPEG has its file signature');
  else if(image.mimeType==='image/webp')assert.ok(data.subarray(0,4).toString()==='RIFF'&&data.subarray(8,12).toString()==='WEBP','Embedded WebP has its file signature');
  else assert.fail(`Unsupported embedded image MIME type: ${image.mimeType}`);
 }
 for(let index=0;index<gltf.accessors.length;index++)readAccessor(index);
});

test('the body has a real skeleton with normalized multi-bone deformation weights',()=>{
 assert.ok(gltf.skins?.length>0,'At least one armature skin');let blendedVertices=0,skinnedPrimitives=0;
 for(const skin of gltf.skins){
  assert.ok(skin.joints.length>=8,'Humanoid rig has multiple articulated joints');
  assert.equal(new Set(skin.joints).size,skin.joints.length,'Joint indices are unique');
  for(const joint of skin.joints)assert.ok(gltf.nodes[joint],'Joint node exists');
  assert.ok(skin.joints.some(joint=>(gltf.nodes[joint].children??[]).some(child=>skin.joints.includes(child))),'Joints form a hierarchy');
  assert.equal(gltf.accessors[skin.inverseBindMatrices]?.type,'MAT4','Inverse bind matrices are present');
  assert.equal(readAccessor(skin.inverseBindMatrices).length,skin.joints.length);
 }
 for(const node of gltf.nodes){
  if(node.skin===undefined)continue;const skin=gltf.skins[node.skin];assert.ok(skin);
  for(const primitive of gltf.meshes[node.mesh].primitives){
   const positions=readAccessor(primitive.attributes.POSITION),joints=readAccessor(primitive.attributes.JOINTS_0),weights=readAccessor(primitive.attributes.WEIGHTS_0);
   assert.equal(joints.length,positions.length);assert.equal(weights.length,positions.length);skinnedPrimitives++;
   for(let vertex=0;vertex<positions.length;vertex++){
    assert.equal(joints[vertex].length,4);assert.equal(weights[vertex].length,4);
    assert.ok(joints[vertex].every(joint=>Number.isInteger(joint)&&joint>=0&&joint<skin.joints.length),'Vertex joint indices are valid');
    assert.ok(weights[vertex].every(weight=>weight>=0&&weight<=1.001),'Vertex weights are in range');
    assert.ok(Math.abs(weights[vertex].reduce((sum,weight)=>sum+weight,0)-1)<.02,'Vertex weights add to one');
    if(weights[vertex].filter(weight=>weight>.01).length>1)blendedVertices++;
   }
  }
 }
 assert.ok(skinnedPrimitives>0,'Renderable body uses the skeleton');assert.ok(blendedVertices>0,'Joints blend instead of moving only rigid parts');
});

test('all requested animations contain keyed movement on the exported skeleton',()=>{
 const names=gltf.animations.map(animation=>animation.name);assert.equal(new Set(names).size,names.length,'Clip names are unique');
 for(const name of requiredClips){
  const animation=gltf.animations.find(animation=>animation.name===name);assert.ok(animation,`${name} exists`);
  const {duration,changingJoints}=animationInfo(animation);
  assert.ok(duration>0,`${name} has a positive duration`);assert.ok(changingJoints.size>0,`${name} contains changing joint transforms`);
  if(name==='Walk'||name==='Run')assert.ok(changingJoints.size>=2,`${name} moves multiple joints`);
 }
});

test('skin tone is a separate material and each weapon follows the rig with a muzzle marker',()=>{
 const skinIndex=gltf.materials.findIndex(material=>material.name==='Skin');assert.ok(skinIndex>=0,'Skin material exists');
 assert.ok(gltf.nodes.some(node=>node.skin!==undefined&&gltf.meshes[node.mesh]?.primitives.some(primitive=>primitive.material===skinIndex)),'Skin material belongs to the animated body');
 assert.ok(gltf.materials.some((_,index)=>index!==skinIndex),'Clothing has separate materials');
 for(const weapon of ['rifle','sabre','pistol']){
  const index=gltf.nodes.findIndex(node=>node.name===`weapon_${weapon}`);assert.ok(index>=0,`${weapon} group exists`);
  const children=descendants(index);assert.ok([...children].some(child=>gltf.nodes[child].mesh!==undefined),`${weapon} has geometry`);
  assert.ok([...allJoints].some(joint=>descendants(joint).has(index)),`${weapon} is attached to the skeleton`);
  if(weapon!=='sabre'){
   const muzzle=gltf.nodes.findIndex(node=>node.name===`muzzle_${weapon}`);assert.ok(muzzle>=0&&children.has(muzzle),`${weapon} muzzle follows its weapon`);
  }
 }
});

test('manifest identifies this export and action events lie inside their clips',()=>{
 assert.equal(manifest.asset,'granadero.glb');assert.equal(manifest.byteLength,bytes.length);
 assert.equal(manifest.sha256,createHash('sha256').update(bytes).digest('hex'),'Manifest checksum matches the GLB');
 assert.ok(Array.isArray(manifest.clips),'Manifest lists exported clips');
 for(const name of requiredClips){
  const entry=manifest.clips.find(clip=>clip.name===name);assert.ok(entry,`${name} appears in manifest`);
  const actual=animationInfo(gltf.animations.find(clip=>clip.name===name));
  assert.ok(Math.abs(entry.durationSeconds-actual.duration)<1e-4,`${name} duration matches export`);
  assert.equal(entry.loop,!oneShotEvents[name],`${name} has the appropriate playback mode`);
  if(oneShotEvents[name]){
   const at=entry.events?.[oneShotEvents[name]];
   assert.ok(Number.isFinite(at)&&at>0&&at<actual.duration,`${name} has an event inside the action`);
  }
 }
 for(const [key,value]of Object.entries(manifest.nodes??{}))assert.ok(gltf.nodes.some(node=>node.name===value),`Manifest node ${key} exists`);
 assert.equal(manifest.materials.skin,'Skin');
});

test('Three.js plays the exported clips and keeps weapon effects aligned with the animated hand',async()=>{
 const loaded=await loadCpuAsset();
 const scene=loaded.scene,mixer=new THREE.AnimationMixer(scene),bones=[];
 scene.traverse(object=>{if(object.isBone)bones.push(object);});
 assert.ok(bones.length>=8,'GLTFLoader creates actual Three.js bones');
 const sample=(name,time)=>{
  mixer.stopAllAction();
  const clip=THREE.AnimationClip.findByName(loaded.animations,name);
  mixer.clipAction(clip).reset().setLoop(THREE.LoopOnce,1).play();
  mixer.setTime(time);scene.updateMatrixWorld(true);
  return bones.flatMap(bone=>bone.matrixWorld.elements);
 };
 for(const name of requiredClips){
  const clip=THREE.AnimationClip.findByName(loaded.animations,name);
  const first=sample(name,clip.duration*.17),second=sample(name,clip.duration*.53);
  assert.ok(first.some((value,index)=>Math.abs(value-second[index])>1e-5),`${name} changes bone transforms through AnimationMixer`);
 }
 const directions={'+X':[1,0,0],'-X':[-1,0,0],'+Y':[0,1,0],'-Y':[0,-1,0],'+Z':[0,0,1],'-Z':[0,0,-1]};
 const worldForward=new THREE.Vector3(...directions[manifest.coordinates.forward]);
 for(const [weapon,ready,actionName]of [['rifle','RifleAim','RifleFire'],['pistol','PistolAim','PistolFire'],['sabre','SabreReady','SabreSlash']]){
  const group=scene.getObjectByName(`weapon_${weapon}`);assert.ok(group);
  let hand=group.parent;while(hand&&!hand.isBone)hand=hand.parent;
  assert.ok(hand?.isBone,`${weapon} is attached to an animated bone`);
  const actionClip=THREE.AnimationClip.findByName(loaded.animations,actionName),positions=[],offsets=[];
  for(const fraction of [.05,.4,.7]){
   sample(actionName,actionClip.duration*fraction);
   const world=group.getWorldPosition(new THREE.Vector3());positions.push(world.clone());offsets.push(hand.worldToLocal(world.clone()));
  }
  assert.ok(positions.some(position=>position.distanceTo(positions[0])>1e-4),`${weapon} follows hand movement during its action`);
  assert.ok(offsets.every(offset=>offset.distanceTo(offsets[0])<1e-5),`${weapon} remains attached without grip drift`);
  if(weapon==='sabre')continue;
  const axis=directions[manifest.weaponForwardLocal?.[weapon]];assert.ok(axis,`${weapon} declares an exported local barrel axis`);
  const muzzle=scene.getObjectByName(`muzzle_${weapon}`),readyClip=THREE.AnimationClip.findByName(loaded.animations,ready);
  for(const fraction of [.2,.5,.8]){
   sample(ready,readyClip.duration*fraction);
   const direction=new THREE.Vector3(...axis).applyQuaternion(group.getWorldQuaternion(new THREE.Quaternion())).normalize();
   const muzzleDirection=muzzle.getWorldPosition(new THREE.Vector3()).sub(group.getWorldPosition(new THREE.Vector3())).normalize();
   assert.ok(direction.dot(worldForward)>.8,`${weapon} barrel points forward in its aim pose`);
   assert.ok(direction.dot(muzzleDirection)>.9,`${weapon} effect direction agrees with the exported muzzle marker`);
  }
 }
 mixer.stopAllAction();mixer.uncacheRoot(scene);
});

test('changing loaded skin colors leaves clothing, weapons, and other materials unchanged',async()=>{
 const {scene}=await loadCpuAsset(),skins=new Set(),others=new Set();
 scene.traverse(object=>{
  if(!object.isMesh)return;
  for(const material of Array.isArray(object.material)?object.material:[object.material]){
   if(/^skin(?:[._]|$)/i.test(material.name))skins.add(material);else others.add(material);
  }
 });
 assert.ok(skins.size>0,'Loaded scene exposes skin materials');assert.ok(others.size>0,'Loaded scene exposes other materials');
 const originals=new Map([...skins].map(material=>[material,material.color.clone()]));
 const otherColors=new Map([...others].filter(material=>material.color).map(material=>[material,material.color.getHexString()]));
 try{
  for(const tone of ['#d8a783','#9b6441','#513023']){
   for(const material of skins)material.color.set(tone);
   for(const material of skins)assert.equal(material.color.getHexString(),tone.slice(1),'Skin tone reaches every exposed skin material');
   for(const [material,color]of otherColors)assert.equal(material.color.getHexString(),color,`Skin changes do not recolor ${material.name}`);
  }
 }finally{for(const [material,color]of originals)material.color.copy(color);}
});

test('textured uniform retains dark navy, crimson, and separate cream crossbelts after loading',async()=>{
 const {scene}=await loadCpuAsset(),materials=new Map();
 scene.traverse(object=>{
  if(!object.isMesh)return;
  for(const material of Array.isArray(object.material)?object.material:[object.material]){
   if(!materials.has(material.name))materials.set(material.name,new Set());materials.get(material.name).add(material);
  }
 });
 for(const name of ['Navy_Wool','Navy_Trousers']){
  assert.ok(materials.get(name)?.size,`${name} is used in the loaded scene`);
  for(const {color:{r,g,b}}of materials.get(name)){
   assert.ok(Math.max(r,g,b)<.15,`${name} stays dark instead of defaulting to white`);
   assert.ok(b>r*1.5&&b>g*1.15,`${name} retains its blue tint`);
  }
 }
 assert.ok(materials.get('Crimson_Facings')?.size,'Crimson facings are used in the loaded scene');
 for(const {color:{r,g,b}}of materials.get('Crimson_Facings'))assert.ok(r>.06&&r>g*2&&r>b*2,'Facings retain their red tint instead of defaulting to white');
 const straps=materials.get('Cream_Crossbelts'),skin=materials.get('Skin');
 assert.ok(straps?.size&&skin?.size,'Cream straps and skin have their own loaded materials');
 for(const material of straps){
  const {r,g,b}=material.color;
  assert.ok(Math.min(r,g,b)>.25&&r>=g&&g>=b&&r>b*1.1,'Crossbelts retain a light cream tint');
  assert.ok(!skin.has(material),'Crossbelts do not share the skin material');
  for(const skinMaterial of skin)assert.notEqual(material.color,skinMaterial.color,'Crossbelts do not share the skin color object');
 }
});

test('loop seams and one-shot return poses do not introduce skeletal jumps',async()=>{
 const {scene,animations}=await loadCpuAsset(),mixer=new THREE.AnimationMixer(scene),bones=[];
 scene.traverse(object=>{if(object.isBone)bones.push(object);});
 const pose=(name,atEnd=false)=>{
  mixer.stopAllAction();const clip=THREE.AnimationClip.findByName(animations,name),action=mixer.clipAction(clip);
  action.reset().setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
  mixer.setTime(atEnd?clip.duration:0);scene.updateMatrixWorld(true);
  return bones.map(bone=>({name:bone.name,position:bone.position.clone(),rotation:bone.quaternion.clone(),scale:bone.scale.clone()}));
 };
 const samePose=(first,last,label)=>{
  for(let index=0;index<first.length;index++){
   assert.ok(first[index].position.distanceTo(last[index].position)<1e-4,`${label}: ${first[index].name} position is continuous`);
   assert.ok(first[index].scale.distanceTo(last[index].scale)<1e-4,`${label}: ${first[index].name} scale is continuous`);
   // angleTo accepts equivalent quaternion signs (q and -q).
   assert.ok(first[index].rotation.clone().normalize().angleTo(last[index].rotation.clone().normalize())<1e-3,`${label}: ${first[index].name} rotation is continuous`);
  }
 };
 for(const name of ['Idle','Walk','Run','RifleAim','PistolAim','SabreReady'])samePose(pose(name),pose(name,true),`${name} loop seam`);
 for(const [name,ready]of [['RifleFire','RifleAim'],['PistolFire','PistolAim'],['SabreSlash','SabreReady']]){
  const reference=pose(ready);samePose(reference,pose(name),`${name} starts ready`);samePose(reference,pose(name,true),`${name} ends ready`);
 }
 mixer.stopAllAction();mixer.uncacheRoot(scene);
});

test('the adult rig retains human shoulder width and limb lengths',async()=>{
 const loaded=await loadCpuAsset();
 const mixer=new THREE.AnimationMixer(loaded.scene);
 const idle=THREE.AnimationClip.findByName(loaded.animations,'Idle');
 mixer.clipAction(idle).play();mixer.setTime(idle.duration*.25);
 loaded.scene.updateMatrixWorld(true);
 const joint=name=>{
  const bone=loaded.scene.getObjectByName(name);
  assert.ok(bone?.isBone,`Native anatomical joint ${name} exists`);
  return bone.getWorldPosition(new THREE.Vector3());
 };
 const within=(value,min,max,label)=>assert.ok(value>=min&&value<=max,`${label}: ${value.toFixed(3)} m must be within ${min}–${max} m`);
 within(joint('upperarm_l').distanceTo(joint('upperarm_r')),.32,.49,'Shoulder socket width');
 for(const side of ['l','r']){
  within(joint(`upperarm_${side}`).distanceTo(joint(`lowerarm_${side}`)),.23,.35,`${side} upper arm`);
  within(joint(`lowerarm_${side}`).distanceTo(joint(`hand_${side}`)),.20,.32,`${side} forearm`);
  within(joint(`thigh_${side}`).distanceTo(joint(`calf_${side}`)),.35,.50,`${side} thigh`);
  within(joint(`calf_${side}`).distanceTo(joint(`foot_${side}`)),.34,.50,`${side} lower leg`);
  within(joint(`hand_${side}`).distanceTo(joint(`middle_03_${side}`)),.11,.20,`${side} hand before fingertip`);
 }
});
