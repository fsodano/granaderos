import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {AnimationClip,AnimationMixer,Group,InterpolateDiscrete,InterpolateLinear,LoopOnce,Object3D,QuaternionKeyframeTrack,Vector3,VectorKeyframeTrack} from '../../web/node_modules/three/build/three.module.js';

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
const banks={};
for(const [gender,bank]of Object.entries(manifest.animationLibraries)){
 const clip=bank.clips.find(clip=>clip.name==='prone.crawl.unarmed');
 if(!(clip?.nativeStrideSpeed>0)||!clip.strideMeasurement)throw Error(`Missing calibrated crawl: ${gender}`);
 const appearance=Object.values(manifest.appearances).find(appearance=>appearance.animationLibrary===gender);
 const measured=measureCrawl(glb(appearance.lods[0].url).json,glb(bank.url),clip);
 for(const variant of bank.clips.filter(clip=>clip.gesture==='crawl')){
  variant.authoredStrideSpeed??=variant.nativeStrideSpeed;
  variant.locomotionSpeed=variant.nativeStrideSpeed=measured.speed;
  variant.strideDistance=Number((measured.speed*variant.duration).toFixed(6));
  variant.strideMeasurement={...variant.strideMeasurement,sampleCount:measured.sampleCount,space:'exported-gltf',referenceClip:clip.name};
 }
 bank.locomotionSpeed.crawl=measured.speed;
 const gaits=bank.clips.filter(clip=>['walk','run','crawl','strafeLeft','strafeRight'].includes(clip.gesture));
 for(const gait of gaits)if(!((gait.nativeStrideSpeed??gait.locomotionSpeed)>0))throw Error(`Missing native movement speed: ${gender}:${gait.name}`);
 const actions=bank.clips.filter(clip=>['reload','reprime','repair','unload','artilleryReload','throw','throwKnife','bolas','mount','dismount','climbUp','climbDown'].includes(clip.gesture));
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
