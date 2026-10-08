import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {AnimationClip,AnimationMixer,Group,InterpolateDiscrete,InterpolateLinear,LoopOnce,Object3D,QuaternionKeyframeTrack,Vector3,VectorKeyframeTrack} from '../../web/node_modules/three/build/three.module.js';
import {GLTFLoader} from '../../web/node_modules/three/examples/jsm/loaders/GLTFLoader.js';

const root=new URL('../../',import.meta.url),publicRoot=new URL('web/public/',root);
const manifestPath=new URL('models/characters/manifest.json',publicRoot);
const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
const widths={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
const format={5121:['readUInt8',1],5123:['readUInt16LE',2],5125:['readUInt32LE',4],5126:['readFloatLE',4]};
function glb(url){
 const bytes=readFileSync(new URL(`.${url}`,publicRoot)),size=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+size)),binary=bytes.subarray(28+size);
 const access=index=>{
  const a=json.accessors[index],view=json.bufferViews[a.bufferView],[read,size]=format[a.componentType],width=widths[a.type];
  if(a.sparse||a.normalized)throw Error('Crawl calibration requires packed native float accessors');
  return Array.from({length:a.count*width},(_,i)=>binary[read]((view.byteOffset??0)+(a.byteOffset??0)+Math.floor(i/width)*(view.byteStride??size*width)+i%width*size));
 };
 return {json,access};
}
function measureCrawl(body,data,spec){
 const nodes=body.nodes.map(def=>{const node=new Object3D();node.name=def.name;if(def.matrix)node.matrix.fromArray(def.matrix).decompose(node.position,node.quaternion,node.scale);else{if(def.translation)node.position.fromArray(def.translation);if(def.rotation)node.quaternion.fromArray(def.rotation);if(def.scale)node.scale.fromArray(def.scale);}return node;});
 body.nodes.forEach((def,i)=>(def.children??[]).forEach(child=>nodes[i].add(nodes[child])));
 const scene=new Group();for(const i of body.scenes[body.scene??0].nodes)scene.add(nodes[i]);
 const def=data.json.animations.find(entry=>entry.name===spec.name);if(!def)throw Error(`Missing exported crawl: ${spec.name}`);
 const animation=new AnimationClip(spec.name,-1,def.channels.map(channel=>{const sampler=def.samplers[channel.sampler],property={translation:'position',rotation:'quaternion',scale:'scale'}[channel.target.path],Track=property==='quaternion'?QuaternionKeyframeTrack:VectorKeyframeTrack;return new Track(`${data.json.nodes[channel.target.node].name}.${property}`,data.access(sampler.input),data.access(sampler.output),sampler.interpolation==='STEP'?InterpolateDiscrete:InterpolateLinear);}));
 const mixer=new AnimationMixer(scene),action=mixer.clipAction(animation).setLoop(LoopOnce,1);action.clampWhenFinished=true;action.play();
 const count=Math.round(spec.duration*spec.sampleRate),points=[];
 for(let i=0;i<=count;i++){
  mixer.setTime(animation.duration*i/count);scene.updateMatrixWorld(true);
  points.push(spec.strideMeasurement.bones.map(name=>{const node=scene.getObjectByName(name);if(!node)throw Error(`Missing crawl support bone: ${name}`);return node.getWorldPosition(new Vector3());}));
 }
 const speeds=[];
 for(let i=1;i<count;i++)for(let side=0;side<2;side++){
  const a=points[i-1][side],p=points[i][side],b=points[i+1][side],velocity=(a.z-b.z)/(2*animation.duration/count);
  if(p.y<=spec.strideMeasurement.maximumContactHeight&&velocity>0)speeds.push(velocity);
 }
 mixer.stopAllAction();mixer.uncacheRoot(scene);
 if(!speeds.length)throw Error(`Exported crawl has no forearm support: ${spec.name}`);
 speeds.sort((a,b)=>a-b);const mid=Math.floor(speeds.length/2),median=speeds.length%2?speeds[mid]:(speeds[mid-1]+speeds[mid])/2;
 return {speed:Number(median.toFixed(6)),sampleCount:speeds.length};
}
async function measurePlantedCrawl(url,data,spec){
 // Read the complete published forearm skin. A bone pivot or a median of
 // positive velocities does not measure the displacement of a planted pull.
 const bytes=readFileSync(new URL(`.${url}`,publicRoot)),length=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+length));
 delete doc.images;delete doc.textures;delete doc.samplers;doc.materials=(doc.materials??[]).map(material=>({name:material.name}));
 const json=Buffer.from(JSON.stringify(doc)),padded=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]),binary=bytes.subarray(20+length),header=Buffer.from(bytes.subarray(0,20));
 header.writeUInt32LE(20+padded.length+binary.length,8);header.writeUInt32LE(padded.length,12);
 const buffer=Buffer.concat([header,padded,binary]),body=await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.length),'');
 const def=data.json.animations.find(entry=>entry.name===spec.name);if(!def)throw Error(`Missing exported crawl: ${spec.name}`);
 const animation=new AnimationClip(spec.name,-1,def.channels.map(channel=>{const sampler=def.samplers[channel.sampler],property={translation:'position',rotation:'quaternion',scale:'scale'}[channel.target.path],Track=property==='quaternion'?QuaternionKeyframeTrack:VectorKeyframeTrack;return new Track(`${data.json.nodes[channel.target.node].name}.${property}`,data.access(sampler.input),data.access(sampler.output),sampler.interpolation==='STEP'?InterpolateDiscrete:InterpolateLinear);}));
 const mixer=new AnimationMixer(body.scene),action=mixer.clipAction(animation).setLoop(LoopOnce,1),meshes=[],surfaces={l:[],r:[]};action.clampWhenFinished=true;action.play();
 body.scene.traverse(node=>{if(node.isSkinnedMesh)meshes.push(node);});
 for(const mesh of meshes){const p=mesh.geometry.attributes.position,indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;for(let i=0;i<p.count;i++)for(const side of ['l','r']){let weight=0;for(let j=0;j<4;j++)if(['upperarm_'+side,'lowerarm_'+side].includes(mesh.skeleton.bones[indices.getComponent(i,j)].name))weight+=weights.getComponent(i,j);if(weight>.7)surfaces[side].push({mesh,index:i});}}
 const pose=phase=>{mixer.setTime(animation.duration*phase);body.scene.updateMatrixWorld(true);for(const mesh of meshes)mesh.skeleton.update();};
 const point=p=>p.mesh.getVertexPosition(p.index,new Vector3()).applyMatrix4(p.mesh.matrixWorld),pulls=[];
 for(const [side,start,end] of [['r',0,.5],['l',.5,1]]){
  if(!surfaces[side].length)throw Error(`Missing published forearm skin: ${side}`);
  pose((start+end)/2);let anchor,height=Infinity;for(const candidate of surfaces[side]){const y=point(candidate).y;if(y<height){height=y;anchor=candidate;}}
  if(height<.001||height>.008)throw Error(`Published crawl lacks planted forearm support: ${side}:${height}`);
  pose(start);const a=point(anchor);pose(end);const b=point(anchor),distance=a.z-b.z;
  if(distance<.1||distance>.2)throw Error(`Invalid native forearm pull: ${side}:${distance}`);
  pulls.push({hand:side,from:start,to:end,distance:Number(distance.toFixed(6)),duration:Number((animation.duration*(end-start)).toFixed(6))});
 }
 mixer.stopAllAction();mixer.uncacheRoot(body.scene);
 return {speed:Number((pulls.reduce((sum,pull)=>sum+pull.distance,0)/animation.duration).toFixed(6)),duration:animation.duration,pulls};
}
const banks={};
for(const [gender,bank]of Object.entries(manifest.animationLibraries)){
 const clip=bank.clips.find(clip=>clip.name==='prone.crawl.unarmed');
 if(!(clip?.nativeStrideSpeed>0)||!clip.strideMeasurement)throw Error(`Missing calibrated crawl: ${gender}`);
 const appearance=Object.values(manifest.appearances).find(appearance=>appearance.animationLibrary===gender);
 const planted=clip.strideMeasurement.method==='native forearm planted pull displacement';
 const measured=planted?await measurePlantedCrawl(appearance.lods[0].url,glb(bank.url),clip):measureCrawl(glb(appearance.lods[0].url).json,glb(bank.url),clip);
 for(const variant of bank.clips.filter(variant=>variant.gesture==='crawl'&&(!planted||variant===clip))){
  variant.authoredStrideSpeed??=variant.nativeStrideSpeed;
  variant.locomotionSpeed=variant.nativeStrideSpeed=measured.speed;
  variant.strideDistance=Number((measured.speed*(planted?measured.duration:variant.duration)).toFixed(6));
  variant.strideMeasurement={...variant.strideMeasurement,...(planted?{pulls:measured.pulls}:{sampleCount:measured.sampleCount}),space:'exported-gltf',referenceClip:clip.name};
 }
 bank.locomotionSpeed.crawl=measured.speed;
 const gaits=bank.clips.filter(clip=>['walk','run','crawl','strafeLeft','strafeRight'].includes(clip.gesture));
 for(const gait of gaits)if(!((gait.nativeStrideSpeed??gait.locomotionSpeed)>0))throw Error(`Missing native movement speed: ${gender}:${gait.name}`);
 const actions=bank.clips.filter(clip=>['heal','reload','reprime','repair','unload','artilleryReload','throw','throwKnife','bolas','mount','dismount','climbUp','climbDown'].includes(clip.gesture));
 banks[gender]={crawl:{nativeStrideSpeed:measured.speed,duration:clip.duration,playbackRate:clip.playbackRate??1},clips:Object.fromEntries(gaits.map(clip=>[clip.name,{nativeStrideSpeed:clip.nativeStrideSpeed??clip.locomotionSpeed,duration:clip.duration,playbackRate:clip.playbackRate??1}])),actions:Object.fromEntries(actions.map(clip=>[clip.name,{duration:clip.duration,loop:clip.loop,markers:clip.markers}]))};
}
const horse=Object.fromEntries(['walk','run'].map(action=>{
 const clip=manifest.horse.clips.find(clip=>clip.name===manifest.horse.actions[action]);
 if(!(clip?.locomotionSpeed>0))throw Error(`Missing native horse speed: ${action}`);
 return [action,{nativeStrideSpeed:clip.nativeStrideSpeed??clip.locomotionSpeed,duration:clip.duration,playbackRate:clip.playbackRate??1}];
}));
const itemClips=Object.fromEntries(Object.entries(manifest.equipment.items).filter(([,item])=>item.clipOverrides).map(([id,item])=>[id,item.clipOverrides]));
const profile={version:1,source:'web/public/models/characters/manifest.json',appearances:Object.fromEntries(Object.entries(manifest.appearances).map(([id,appearance])=>[id,appearance.animationLibrary])),banks,horse,itemClips,itemAliases:manifest.equipment.aliases};
const path=fileURLToPath(new URL('web/lib/three/locomotion-profile.json',root)),text=JSON.stringify(profile,null,2)+'\n',manifestText=JSON.stringify(manifest,null,2)+'\n';
if(process.argv.includes('--check')){
 if(readFileSync(path,'utf8')!==text||readFileSync(manifestPath,'utf8')!==manifestText)throw Error('Character locomotion calibration is stale. Run tools/characters-3d/compile-locomotion-profile.mjs.');
}else{writeFileSync(manifestPath,manifestText);writeFileSync(path,text);}
console.log(`Character locomotion calibration ${process.argv.includes('--check')?'verified':'written'}.`);
