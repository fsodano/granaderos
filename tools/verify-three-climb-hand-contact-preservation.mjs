import {register} from 'node:module';register('../tests/tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Vector3,Plane} from '../web/node_modules/three/build/three.module.js';
import {GLTFLoader} from '../web/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
const {ActorRuntime}=await import('../web/lib/three/actor-runtime.ts');
const {TILE_METRES}=await import('../web/lib/three/projection.ts');
import {ladderGeometry,sampleLadderClimb,referenceClimbFraction} from '../game/climb-geometry.js';
const publicRoot=new URL('../web/public/',import.meta.url),manifest=JSON.parse(readFileSync(new URL('models/characters/manifest.json',publicRoot))),loaded=new Map();
function load(url){
 if(loaded.has(url))return loaded.get(url);
 // Keep published buffers, rig, and animation tracks. Browser image decoding
 // is not required for CPU contact checks on the actual skinned geometry.
 const bytes=readFileSync(new URL(`.${url}`,publicRoot)),length=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+length));
 delete doc.images;delete doc.textures;delete doc.samplers;doc.materials=(doc.materials??[]).map(material=>({name:material.name}));
 const json=Buffer.from(JSON.stringify(doc)),padded=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]),binary=bytes.subarray(20+length),header=Buffer.from(bytes.subarray(0,20));
 header.writeUInt32LE(20+padded.length+binary.length,8);header.writeUInt32LE(padded.length,12);
 const buffer=Buffer.concat([header,padded,binary]),promise=new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.length),'');loaded.set(url,promise);return promise;
}
async function asset(id,lod=1){
 const appearance=manifest.appearances[id],library=manifest.animationLibraries[appearance.gender];
 const [body,animation,equipment,horse]=await Promise.all([load(appearance.lods[lod].url),load(library.url),load(manifest.equipment.url),load(manifest.horse.lods[1].url)]);
 return {manifest,appearance,body,animation,equipment,horse,clips:library.clips,lod};
}
function visual(id,action,extra={}){
 const mounted=false;
 return {key:`unit:${id}`,id,kind:'unit',appearance:id,skin:'light',side:'player',tacticalLevel:0,position:[4,0,7],yaw:0,posture:'standing',mounted,action,idleAction:'idle',equipment:'unarmed',items:[],garments:{headwear:null,outfit:null,legwear:null},selected:false,bodyHeights:{},cue:{id:`${id}:${action}`,action,startedAt:0,fromPosture:mounted?'standing':'mounted'},...extra};
}
function point(actor,name){actor.root.updateMatrixWorld(true);return actor.root.worldToLocal(actor.model.getObjectByName(name).getWorldPosition(new Vector3()));}
function closeVector(actual,expected,tolerance,message){assert.ok(actual.distanceTo(new Vector3(...expected))<tolerance,`${message}: ${actual.toArray()} != ${expected}`);}

function palm(actor,side){return point(actor,'hand_'+side).lerp(point(actor,'middle_01_'+side),.72);}
function binding(source,spec){source.body.scene.updateMatrixWorld(true);return Object.fromEntries(['l','r'].map(side=>[side,source.body.scene.getObjectByName('foot_'+side).worldToLocal(new Vector3(...spec.climbSupport.feetBindRest[side]))]));}
function boot(actor,side,binding){actor.root.updateMatrixWorld(true);return actor.root.worldToLocal(actor.model.getObjectByName('foot_'+side).localToWorld(binding[side].clone()));}
function relative(plan,contact){return new Vector3(...contact.position).sub(new Vector3(0,plan.root.height,plan.root.forward));}
function shape(actor){const values=new Map();actor.model.traverse(node=>{if(node.isBone)values.set(node.name,{position:node.position.clone(),scale:node.scale.clone()});});return values;}
function nativeShape(actor,values){actor.model.traverse(node=>{if(node.isBone){if(node.name!=='Root')assert.ok(node.position.distanceTo(values.get(node.name).position)<.0001,node.name+' keeps its native joint offset');assert.ok(node.scale.distanceTo(values.get(node.name).scale)<.0001,node.name+' keeps its native scale');}});}
function supportSkin(actor){
 const result={feet:{l:[],r:[]},hands:{l:[],r:[]}};
 actor.model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  const position=mesh.geometry.attributes.position,indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
  for(let index=0;index<position.count;index++)for(const side of ['l','r']){
   if(mesh.name.startsWith('Human_footwear_')&&Math.abs(position.getY(index)-.007)<.0001&&(position.getX(index)>0)===(side==='l'))result.feet[side].push({mesh,index});
   if(!mesh.name.startsWith('Exposed_Human_Skin'))continue;
   let handWeight=0;for(let j=0;j<4;j++){const bone=mesh.skeleton.bones[indices.getComponent(index,j)].name;if(/^(hand|thumb|index|middle|ring|pinky)_/.test(bone)&&bone.endsWith('_'+side))handWeight+=weights.getComponent(index,j);}
   if(handWeight>.7)result.hands[side].push({mesh,index});
  }
 });return result;
}
function lowestSurface(actor,vertices){
 const meshes=new Set(vertices.map(vertex=>vertex.mesh));for(const mesh of meshes)mesh.skeleton.update();
 return Math.min(...vertices.map(({mesh,index})=>actor.root.worldToLocal(mesh.getVertexPosition(index,new Vector3()).applyMatrix4(mesh.matrixWorld)).y));
}


const {mkdtempSync,writeFileSync,mkdirSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join,resolve}=await import('node:path');const {pathToFileURL}=await import('node:url');
const oldPath=process.argv.find(a=>a.startsWith('--before-helper='))?.slice(16);assert.ok(oldPath,'Pass --before-helper=<exact predecessor helper>');const oldSource=readFileSync(resolve(oldPath),'utf8'),scratch=mkdtempSync(join(tmpdir(),'granaderos-climb-contact-before-'));const beforeModule=join(scratch,'before.ts');writeFileSync(beforeModule,oldSource.replace("'../../../game/climb-geometry.js'",JSON.stringify(new URL('../game/climb-geometry.js',import.meta.url).href)).replace("'three'",JSON.stringify(new URL('../web/node_modules/three/build/three.module.js',import.meta.url).href)));
const {NativeClimbContactFit:BeforeFit}=await import(pathToFileURL(beforeModule).href);
function fullArm(actor){const out=[];actor.model.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const p=mesh.geometry.attributes.position,si=mesh.geometry.attributes.skinIndex,sw=mesh.geometry.attributes.skinWeight;for(let i=0;i<p.count;i++){let w=0;for(let j=0;j<4;j++)if(/^(upperarm|lowerarm|hand|thumb|index|middle|ring|pinky)_/.test(mesh.skeleton.bones[si.getComponent(i,j)].name))w+=sw.getComponent(i,j);if(w>.5)out.push({mesh,index:i});}});return out;}
function vertices(list){for(const m of new Set(list.map(v=>v.mesh)))m.skeleton.update();return list.map(({mesh,index})=>mesh.getVertexPosition(index,new Vector3()).applyMatrix4(mesh.matrixWorld));}
function pose(actor){const out={};actor.model.traverse(n=>{if(n.isBone)out[n.name]={p:n.position.toArray(),s:n.scale.toArray(),q:n.quaternion.toArray()};});return out;}
function tick(actor,id,action,g,spec,up){const f=action==='climbDown'?1-up:up,p=sampleLadderClimb(g,up,spec.climbSupport.feetRest),duration=Math.max(spec.duration,g.height/.65);actor.update(visual(id,action,{cue:undefined,position:[0,g.lower[1]+p.root.height,p.root.forward],motion:{moving:true,segmentFraction:f,climbGeometry:g}}),duration*1000*f);actor.tick(0,duration*1000*f);actor.root.updateMatrixWorld(true);return p;}
const cases=[],edges=[],broadPalm=[],wraps=[];
for(const id of ['granadero','woman-scout'])for(const lod of [0,1,2]){const source=await asset(id,lod);for(const action of ['climbUp','climbDown'])for(const H of [2,3,4.2,5.6]){const spec=source.clips.find(s=>s.name==='life.'+action),base=H===5.6?1.2:H===4.2?1.1:.4,g=ladderGeometry([0,base,0],[0,base+H,TILE_METRES],TILE_METRES),current=new ActorRuntime(source,visual(id,action,{cue:undefined})),old=new ActorRuntime(source,visual(id,action,{cue:undefined}));const calibration=old.climbFit;old.climbFit=new BeforeFit(old.model,old.root);for(const [key,limb]of old.climbFit.limbs){const measured=calibration.limbs.get(key);limb.first=measured.first;limb.second=measured.second;limb.contact.copy(measured.contact);}let changed=0,unchanged=0,largestOldGap=0,largestNewGap=0;
const samples=new Set(Array.from({length:121},(_,i)=>i/120));for(let t=.635;t<=.665;t+=1/(H/.65*240))samples.add(t);for(const t of [.098,.099,.1,.91,.911,.912,.913,.979,.98])samples.add(t);
for(const up of [...samples].sort((a,b)=>a-b)){const p=tick(current,id,action,g,spec,up);tick(old,id,action,g,spec,up);const cp=pose(current),op=pose(old);for(const [name,n]of Object.entries(cp)){assert.deepEqual(n.p,op[name].p);assert.deepEqual(n.s,op[name].s);if(!/^(upperarm|lowerarm|hand)_[lr]$/.test(name))assert.deepEqual(n.q,op[name].q,`${id} ${H} ${up}: ${name} exact`);}
assert.deepEqual(current.root.position.toArray(),old.root.position.toArray());assert.deepEqual(current.root.quaternion.toArray(),old.root.quaternion.toArray());assert.equal(current.action.time,old.action.time);assert.equal(current.mixer.time,old.mixer.time);if(JSON.stringify(cp)===JSON.stringify(op))unchanged++;else{changed++;assert.equal(H,5.6);assert.ok(old.climbFit.rejectedFits>0);assert.ok(up>.64&&up<.66);}
for(const side of ['l','r'])if(p.hands[side].planted&&p.hands[side].weight>.999){largestOldGap=Math.max(largestOldGap,palm(old,side).distanceTo(relative(p,p.hands[side])));largestNewGap=Math.max(largestNewGap,palm(current,side).distanceTo(relative(p,p.hands[side])));}
}
if(H!==5.6)assert.equal(changed,0);else assert.ok(changed>0);
cases.push({id,lod,action,height:H,base,changed,unchanged,largestOldPlantedPalmGapMm:1000*largestOldGap,largestNewPlantedPalmGapMm:1000*largestNewGap});
if(H===5.6){const center=.12+.64*15/(g.steps-2),epsilon=1e-7;tick(current,id,action,g,spec,center-epsilon);const wrapBefore=vertices(fullArm(current)),wristBefore=['l','r'].map(s=>current.model.getObjectByName('hand_'+s).getWorldPosition(new Vector3())),palmBefore=['l','r'].map(s=>current.root.localToWorld(palm(current,s)));tick(current,id,action,g,spec,center+epsilon);const wrapAfter=vertices(fullArm(current)),wristAfter=['l','r'].map(s=>current.model.getObjectByName('hand_'+s).getWorldPosition(new Vector3())),palmAfter=['l','r'].map(s=>current.root.localToWorld(palm(current,s))),armShift=Math.max(...wrapAfter.map((v,i)=>v.distanceTo(wrapBefore[i]))),wristShift=Math.max(...wristAfter.map((v,i)=>v.distanceTo(wristBefore[i]))),palmShift=Math.max(...palmAfter.map((v,i)=>v.distanceTo(palmBefore[i])));assert.ok(palmShift<.001,'Actual rung trajectory stays joined at rejection exit/native phase wrap');wraps.push({id,lod,action,fraction:center,nativeBefore:current.climbFit.nativeFraction(g,center-epsilon,spec),nativeAfter:current.climbFit.nativeFraction(g,center+epsilon,spec),armShiftMm:armShift*1000,wristShiftMm:wristShift*1000,palmShiftMm:palmShift*1000});let a=.64,b=.65;for(let i=0;i<40;i++){const m=(a+b)*.5;tick(old,id,action,g,spec,m);if(old.climbFit.rejectedFits)b=m;else a=m;}const edge=(a+b)*.5,dtFraction=1e-6;
for(const center of [edge,.099,.1,.91,.911,.912,.913,.98]){tick(current,id,action,g,spec,center-dtFraction);const beforeSkin=vertices(fullArm(current)),beforeWrist=['l','r'].map(s=>current.model.getObjectByName('hand_'+s).getWorldPosition(new Vector3())),beforePalm=['l','r'].map(s=>current.root.localToWorld(palm(current,s)));tick(current,id,action,g,spec,center+dtFraction);const afterSkin=vertices(fullArm(current)),afterWrist=['l','r'].map(s=>current.model.getObjectByName('hand_'+s).getWorldPosition(new Vector3())),afterPalm=['l','r'].map(s=>current.root.localToWorld(palm(current,s))),dt=2*dtFraction*H/.65,skinSpeed=Math.max(...afterSkin.map((v,i)=>v.distanceTo(beforeSkin[i])/dt)),wristSpeed=Math.max(...afterWrist.map((v,i)=>v.distanceTo(beforeWrist[i])/dt)),palmSpeed=Math.max(...afterPalm.map((v,i)=>v.distanceTo(beforePalm[i])/dt));const coarse=dtFraction*100;tick(current,id,action,g,spec,center-coarse);const coarseBefore=vertices(fullArm(current));tick(current,id,action,g,spec,center+coarse);const coarseAfter=vertices(fullArm(current)),coarseSpeed=Math.max(...coarseAfter.map((v,i)=>v.distanceTo(coarseBefore[i])/(2*coarse*H/.65)));assert.ok(skinSpeed<=coarseSpeed*1.02+.01,`${center}: weighted skin displacement decreases with frame interval, without a fixed jump`);edges.push({id,lod,action,center,skinSpeed,wristSpeed,palmSpeed,coarseSpeed});}
}
const skin=supportSkin(current);for(const up of [.82,.84,.86,.88,.9,.91]){const p=tick(current,id,action,g,spec,up);tick(old,id,action,g,spec,up);for(const side of ['l','r']){const c=p.hands[side];if(c.planted&&c.roofWeight>.999&&c.weight>.999){const y=lowestSurface(current,skin.hands[side])+p.root.height-H;if(y<-.004){assert.deepEqual(pose(current),pose(old),'Broader palm failure remains exact');broadPalm.push({id,lod,action,height:H,up,side,minimumMm:y*1000,unchangedFromBefore:true});}}}}
current.dispose();old.dispose();}}
const report={cases,edges,broadPalm,wraps,scope:'48 cases; all non-hand bones, native offsets/scales, root, paid clock and untouched ordinary routes exact. Dense gate and fade edges. Separate remapped phase wrap is outside continuous-edge claim.'};const output=process.argv.find(a=>a.startsWith('--output='))?.slice(9)??'artifacts/varied-climb-preservation.json';mkdirSync(resolve(output,'..'),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n');rmSync(scratch,{recursive:true,force:true});console.log(JSON.stringify({cases:cases.length,edges:edges.length,maxGateSkinSpeed:Math.max(...edges.map(e=>e.skinSpeed)),maxGateWristSpeed:Math.max(...edges.map(e=>e.wristSpeed)),maxGatePalmSpeed:Math.max(...edges.map(e=>e.palmSpeed)),broadPalm},null,2));

if(process.argv.includes('--require-full-palm-clearance'))assert.equal(broadPalm.length,0,'Broader published palm roof clearance remains outside this contact cut');
if(process.argv.includes('--require-continuous-native-wrap'))assert.ok(wraps.every(w=>w.armShiftMm<1),'Broader remapped native phase wrap remains discontinuous');
