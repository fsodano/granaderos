import assert from 'node:assert/strict';
import {register} from 'node:module';import test from 'node:test';
register('./tactical-render-loader.mjs',import.meta.url);
const {ActorRuntime}=await import('../web/lib/three/actor-runtime.ts');
const {presentActors}=await import('../web/lib/three/presentation.ts');
const {TILE_METRES}=await import('../web/lib/three/projection.ts');
const {publishedActor}=await import('./published-actor-fixture.mjs');
const {createBattle,presentedActBattle,actBattle}=await import('../game/tactical.js');
const {Vector3,Triangle,Matrix4,Quaternion}=await import('../web/node_modules/three/build/three.module.js');
const {capsuleSurfaceGap}=await import('./skinned-surface-contact-fixture.mjs');

async function pair(appearance='granadero',diagonal=false,posture='standing',weapon=1800,lod=0,options={}){
 const squad=[{id:'sabre',name:'Culata',x:6,y:10,facing:2,spriteAppearance:appearance,weapon,weaponInstanceId:'rifle-butt-owned',activeSlot:'primary',weaponMode:'melee',loaded:1,ammo:12,blade:0,condition:81,agility:90,dexterity:85,strength:85,wisdom:80,experienceLevel:7,energy:100,stance:'standing',movementMode:'walk',skinTone:'brown',headwear:null,outfit:null,legwear:null}],enemy={id:'target-sabre',name:'Realista',x:7,y:10+(diagonal?1:0),facing:6,weapon:1800,loaded:1,ammo:6,hp:100,morale:100,patrol:false,overwatch:false,marksmanship:55,spriteAppearance:'royalist',skinTone:'light',stance:posture,movementMode:posture==='crouched'?'crouch':'walk'};
 if(options.offhand)squad[0].offHand={weapon:1806,loaded:1,count:1,weight:1.2,condition:57,jammed:false,instanceId:'rifle-butt-owned-left'};
 const state=createBattle(squad,{id:'rifle-butt-contact',width:24,height:20,seed:45,tiles:Array.from({length:480},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',blocked:false,cover:0})),enemies:[enemy,{id:'reserve',x:22,y:18,patrol:false,overwatch:false}]});
 for(const actor of state.units)actor.ap=actor.id==='sabre'?100:0;const unit=state.units.find(unit=>unit.id==='sabre'),target=state.units.find(unit=>unit.id==='target-sabre');
 if(options.bayonet)unit.weaponFittings={bayonet:{weapon:1811,fittingPattern:'india_socket',condition:80,instanceId:'owned-fixed-bayonet'}};
 const before=JSON.stringify(state),result=presentedActBattle(state,{type:'melee',unitId:unit.id,targetId:target.id}),contact=result.frames.find(frame=>frame.type==='contact');
 assert.ok(contact,`The real rules admit one paid strike: ${result.state.lastError}`);assert.equal(JSON.stringify(state),before);assert.deepEqual(result.state,actBattle(state,{type:'melee',unitId:unit.id,targetId:target.id}));
 assert.equal(result.frames.filter(frame=>frame.type==='contact'&&frame.unitId===unit.id).length,1);assert.equal(result.state.units.find(actor=>actor.id===unit.id).loaded,unit.loaded);assert.equal(result.state.units.find(actor=>actor.id===unit.id).ammo,unit.ammo);
 const frame={...contact,sequenceId:'rifle-butt-contact-review',actionId:1,index:1,startedAt:420,durationMs:650,actionStartedAt:0,actionDurationMs:1970};
 const admitted=frame.state.units.filter(actor=>['sabre','target-sabre'].includes(actor.id)).map(actor=>({key:`unit:${actor.id}`,kind:'unit',actor})),actors=presentActors(frame.state,admitted,{},new Set(),{frame,now:420}),attacker=actors.find(actor=>actor.id==='sabre'),defender=actors.find(actor=>actor.id==='target-sabre');
 assert.ok(attacker.cue.contactTarget);assert.ok(attacker.cue.contactSupport.floors.length);
 const [asset,other]=await Promise.all([publishedActor(appearance,lod),publishedActor(defender.appearance,lod)]),body=new ActorRuntime(other,defender);body.tick(.1,1070);body.root.updateMatrixWorld(true);
 return {attacker,defender,asset,body,frame,result,state,weapon};
}
function faces(root,accept=()=>true){
 const result=[];root.traverse(mesh=>{
  if(!mesh.isSkinnedMesh||!mesh.visible||!accept(mesh))return;
  const index=mesh.geometry.index,vertices=[],accepted=[];const vertex=i=>vertices[i]??(vertices[i]=mesh.localToWorld(mesh.getVertexPosition(i,new Vector3()))),keep=i=>accepted[i]??(accepted[i]=accept(mesh,i));
  for(let i=0;i<index.count;i+=3){const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];if(!ids.every(keep))continue;const face=ids.map(vertex);if(new Triangle(...face).getArea()>1e-10)result.push(face);}
 });return result;
}
function capFaces(runtime,weapon){
 const item=runtime.model.getObjectByName(`primary:${weapon}`);assert.ok(item);item.updateWorldMatrix(true,true);const meshes=[];item.traverse(mesh=>{if(mesh.isMesh&&mesh.visible&&mesh.material.name==='Equipment_Aged_Brass')meshes.push(mesh);});assert.ok(meshes.length);
 const points=meshes.map(mesh=>Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>item.worldToLocal(mesh.localToWorld(new Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i))))),bottom=Math.min(...points.flatMap(vertices=>vertices.map(point=>point.x))),faces=[];
 for(let m=0;m<meshes.length;m++){const mesh=meshes[m],index=mesh.geometry.index;for(let i=0;i<index.count;i+=3){const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];if(!ids.every(vertex=>Math.abs(points[m][vertex].x-bottom)<1e-6))continue;const face=ids.map(vertex=>item.localToWorld(points[m][vertex].clone()));if(new Triangle(...face).getArea()>1e-10)faces.push(face);}}
 assert.equal(faces.length,2,'The measured contact part is the two actual exported brass butt-face triangles');return faces;
}
function gap(a,b){
 // Only surface gaps within the 1 mm assertion matter. This conservative
 // triangle-AABB filter removes rifle parts far from either actual palm.
 const low=new Vector3(Infinity,Infinity,Infinity),high=new Vector3(-Infinity,-Infinity,-Infinity);for(const face of a)for(const point of face){low.min(point);high.max(point);}low.addScalar(-.00101);high.addScalar(.00101);
 const near=b.filter(face=>!['x','y','z'].some(axis=>Math.max(...face.map(point=>point[axis]))<low[axis]||Math.min(...face.map(point=>point[axis]))>high[axis]));let minimum=Infinity;
 for(const face of a)for(let i=0;i<3;i++){const start=face[i],end=face[(i+1)%3];if(start.distanceToSquared(end)<1e-12)continue;minimum=Math.min(minimum,capsuleSurfaceGap(start,end,0,near));if(minimum<=1e-8)return minimum;}return minimum;
}
function weaponFaces(runtime,weapon,forestock=false){const item=runtime.model.getObjectByName(`primary:${weapon}`),faces=[];item.traverse(mesh=>{if(!mesh.isMesh||!mesh.visible||forestock&&mesh.material.name!=='Equipment_Walnut')return;const p=mesh.geometry.attributes.position,index=mesh.geometry.index;for(let i=0;i<index.count;i+=3)faces.push([0,1,2].map(offset=>mesh.localToWorld(new Vector3().fromBufferAttribute(p,index.getX(i+offset)))));});return faces;}
function palmFaces(runtime,side='r'){return faces(runtime.model,(mesh,index)=>{if(mesh.material.name!=='Skin')return false;if(index===undefined)return true;let weight=0;for(let slot=0;slot<4;slot++)if(mesh.skeleton.bones[mesh.geometry.attributes.skinIndex.getComponent(index,slot)].name===`hand_${side}`)weight+=mesh.geometry.attributes.skinWeight.getComponent(index,slot);return weight>.5;});}
function lowestSole(runtime){const mesh=runtime.model.getObjectByName(runtime.asset.appearance.parts.footwear.replace('{lod}',String(runtime.asset.lod))),p=mesh.geometry.attributes.position;let minimum=Infinity;for(let i=0;i<p.count;i++)minimum=Math.min(minimum,mesh.localToWorld(mesh.getVertexPosition(i,new Vector3())).y);return minimum;}
function nativeBones(asset){const bones=new Map();asset.body.scene.traverse(node=>{if(node.isBone)bones.set(node.name,{position:node.position.clone(),scale:node.scale.clone()});});return bones;}
function assertNative(runtime,bones,position){assert.deepEqual(runtime.root.position.toArray(),position);assert.ok(Math.abs(runtime.root.rotation.y-runtime.visual.yaw)<1e-10);runtime.model.traverse(node=>{const original=bones.get(node.name);if(!original)return;if(node.name!=='Root')assert.ok(node.position.distanceTo(original.position)<1e-6,`${node.name} native offset`);assert.ok(node.scale.distanceTo(original.scale)<1e-6,`${node.name} native scale`);});}
function assertGuard(runtime,source){
 // The finger grip remains authored. Both whole palms translate with the gun;
 // neither native hand orientation nor any bone offset/length is changed.
 for(const side of ['l','r']){
  const hand=runtime.model.getObjectByName(`hand_${side}`),native=source.model.getObjectByName(`hand_${side}`),currentWorld=hand.getWorldQuaternion(new Quaternion()),nativeWorld=native.getWorldQuaternion(new Quaternion());
  assert.ok(currentWorld.toArray().every((value,index)=>Math.abs(value-nativeWorld.toArray()[index])<1e-6),`${side} native wrist rotation`);
  hand.traverse(node=>{if(!node.isBone||node===hand)return;const original=source.model.getObjectByName(node.name);assert.ok(node.quaternion.toArray().every((value,index)=>Math.abs(value-original.quaternion.toArray()[index])<1e-8),`${node.name} native finger grip`);});
 }
}
function gripMatrix(runtime,weapon,side='r'){const item=runtime.model.getObjectByName(`primary:${weapon}`);return new Matrix4().copy(runtime.model.getObjectByName(`hand_${side}`).matrixWorld).invert().multiply(item.matrixWorld);}
function assertGrip(runtime,source,weapon){for(const side of ['l','r']){const current=gripMatrix(runtime,weapon,side).elements,native=gripMatrix(source,weapon,side).elements;assert.ok(current.every((value,index)=>Math.abs(value-native[index])<1e-6),`The same owned rifle keeps its native ${side} wrist grip`);}}
function assertPalms(runtime,weapon,label){const surfaces=weaponFaces(runtime,weapon);for(const side of ['l','r'])assert.ok(gap(palmFaces(runtime,side),surfaces)<=.001,`${label} actual ${side} palm on rifle surface`);assert.ok(gap(palmFaces(runtime,'l'),weaponFaces(runtime,weapon,true))<=.001,`${label} actual left palm on walnut stock`);}
function assertIntendedWrists(runtime,source,label){
 const plan=runtime.meleeFit.plan;
 if(!plan){
  assert.equal(runtime.visual.action,runtime.visual.idleAction,label+' completes in its native idle');
  for(const side of ['l','r'])assert.ok(runtime.model.getObjectByName(`hand_${side}`).getWorldPosition(new Vector3()).distanceTo(source.model.getObjectByName(`hand_${side}`).getWorldPosition(new Vector3()))<1e-8,label+' final '+side+' wrist returns exactly to source');
  return;
 }
 const time=runtime.action.time,contact=runtime.clipSpec.markers.contact,end=runtime.action.getClip().duration,smooth=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);},weight=time<=contact?smooth(time/contact):1-smooth((time-contact)/(end*.9-contact)),delta=plan.hand.clone().applyQuaternion(runtime.root.quaternion).multiplyScalar(weight);
 for(const side of ['l','r']){
  // This desired endpoint comes from a separately rendered source wrist,
  // rather than the fit's clamped hand or its accumulated diagnostics.
  const a=source.model.getObjectByName(`upperarm_${side}`).getWorldPosition(new Vector3()),b=source.model.getObjectByName(`lowerarm_${side}`).getWorldPosition(new Vector3()),c=source.model.getObjectByName(`hand_${side}`).getWorldPosition(new Vector3()),length=a.distanceTo(b)+b.distanceTo(c),desired=c.add(delta),shoulder=runtime.model.getObjectByName(`upperarm_${side}`).getWorldPosition(new Vector3()),wrist=runtime.model.getObjectByName(`hand_${side}`).getWorldPosition(new Vector3());
  assert.ok(Math.max(0,shoulder.distanceTo(desired)-(length-.001))<1e-7,`${label} intended ${side} wrist stays within native arm reach`);
  assert.ok(wrist.distanceTo(desired)<1e-6,`${label} actual ${side} wrist reaches the independently defined endpoint`);
 }
}
test('all forty-eight real rifle-butt pairings meet the actual brass butt face with both native palms, grip and sole support',async()=>{
 for(const appearance of ['granadero','woman-scout'])for(const diagonal of [false,true])for(const posture of ['standing','crouched'])for(const weapon of [1800,1801,1802,1803,1804,1807]){
  const fixture=await pair(appearance,diagonal,posture,weapon),visual=fixture.attacker,surface=faces(fixture.body.model),before=JSON.stringify(fixture.frame.state),bones=nativeBones(fixture.asset),runtime=new ActorRuntime(fixture.asset,visual,undefined,()=>({model:fixture.body.model,root:fixture.body.root})),source=new ActorRuntime(fixture.asset,visual);
  runtime.tick(.1,1070);source.tick(.1,1070);runtime.root.updateMatrixWorld(true);source.root.updateMatrixWorld(true);const label=`${appearance}/${diagonal?'diagonal':'straight'}/${posture}/${weapon}`;
  assert.equal(runtime.action.getClip().name,'stand.butt.long-gun');assert.equal(runtime.action.time,.42);assert.equal(runtime.meleeFit.rejectedFits,0,label);assert.ok(gap(capFaces(runtime,weapon),surface)<=.001,label);assertPalms(runtime,weapon,label);assertGuard(runtime,source);assertGrip(runtime,source,weapon);assertIntendedWrists(runtime,source,label);
  const heldBody=runtime.model.getObjectByName('Root').position.clone(),heldHand=runtime.model.getObjectByName('hand_r').getWorldPosition(new Vector3());for(let tick=0;tick<12;tick++){runtime.tick(0,1070);runtime.root.updateMatrixWorld(true);assert.ok(runtime.model.getObjectByName('Root').position.distanceTo(heldBody)<1e-8);assert.ok(runtime.model.getObjectByName('hand_r').getWorldPosition(new Vector3()).distanceTo(heldHand)<1e-8);assertGuard(runtime,source);assertGrip(runtime,source,weapon);}
  for(let frame=0;frame<=120;frame++){
   const cue={...visual.cue,phase:undefined,phaseStartedAt:0,startedAt:0,durationMs:1000};delete cue.phaseDurationMs;const shown={...visual,cue},now=frame*1000/120;
   runtime.update(shown,now);source.update(shown,now);runtime.tick(0,now);source.tick(0,now);runtime.root.updateMatrixWorld(true);source.root.updateMatrixWorld(true);assertNative(runtime,bones,visual.position);assertGuard(runtime,source);assertGrip(runtime,source,weapon);assert.ok(runtime.meleeFit.footReachError<.001,label);assert.ok(runtime.meleeFit.handReachError<1e-7,label);assertIntendedWrists(runtime,source,`${label}/${frame}`);if(frame%4===0)assertPalms(runtime,weapon,`${label}/${frame}`);const sole=lowestSole(runtime)-visual.position[1];assert.ok(sole>=-.001&&sole<=.008,`${label} supported actual sole (${sole})`);
  }
  assert.equal(JSON.stringify(fixture.frame.state),before);runtime.dispose();source.dispose();fixture.body.dispose();
 }
});

test('missing, unsupported and blocked-corner rifle contacts keep the exact finite source pose',async()=>{
 const fixture=await pair('woman-scout',true),visual=fixture.attacker,source=new ActorRuntime(fixture.asset,visual);source.tick(.1,1070);source.root.updateMatrixWorld(true);const root=source.model.getObjectByName('Root').position.clone(),hand=source.model.getObjectByName('hand_r').getWorldPosition(new Vector3());
 const floor=visual=>({minX:visual.position[0]-TILE_METRES/2,maxX:visual.position[0]+TILE_METRES/2,minZ:visual.position[2]-TILE_METRES/2,maxZ:visual.position[2]+TILE_METRES/2,height:visual.position[1]});
 for(const [name,cue,resolve]of [
  ['missing model',visual.cue,()=>undefined],['no target admission',{...visual.cue,contactTarget:undefined},()=>assert.fail('No unreadable target lookup')],
  ['prone target',{...visual.cue,contactTarget:{...visual.cue.contactTarget,posture:'prone'}},()=>assert.fail('No unsupported target lookup')],
  ['mounted target',{...visual.cue,contactTarget:{...visual.cue.contactTarget,mounted:true}},()=>assert.fail('No unsupported mounted target lookup')],
  ['no floor',{...visual.cue,contactSupport:undefined},()=>({model:fixture.body.model,root:fixture.body.root})],
  ['wrong height',{...visual.cue,contactSupport:{floors:[{minX:-100,maxX:100,minZ:-100,maxZ:100,height:3}]}},()=>({model:fixture.body.model,root:fixture.body.root})],
  ['blocked diagonal side cells',{...visual.cue,contactSupport:{floors:[floor(visual),floor(fixture.defender)]}},()=>({model:fixture.body.model,root:fixture.body.root})],
 ]){const runtime=new ActorRuntime(fixture.asset,{...visual,cue},undefined,resolve);runtime.tick(.1,1070);runtime.root.updateMatrixWorld(true);assert.ok(runtime.model.getObjectByName('Root').position.distanceTo(root)<1e-8,name);assert.ok(runtime.model.getObjectByName('hand_r').getWorldPosition(new Vector3()).distanceTo(hand)<1e-8,name);assert.equal(runtime.action.getClip().name,source.action.getClip().name);assertGuard(runtime,source);assertGrip(runtime,source,fixture.weapon);runtime.dispose();}
 let available=true;const disappearing=new ActorRuntime(fixture.asset,visual,undefined,()=>available?{model:fixture.body.model,root:fixture.body.root}:undefined);disappearing.tick(.1,1070);assert.ok(disappearing.meleeFit.plan);available=false;disappearing.tick(0,1070);disappearing.root.updateMatrixWorld(true);assert.equal(disappearing.meleeFit.plan,undefined);assert.ok(disappearing.model.getObjectByName('Root').position.distanceTo(root)<1e-8,'Losing the admitted model restores the exact native body');assert.ok(disappearing.model.getObjectByName('hand_r').getWorldPosition(new Vector3()).distanceTo(hand)<1e-8);assertGrip(disappearing,source,fixture.weapon);disappearing.dispose();source.dispose();fixture.body.dispose();
 const dual=await pair('granadero',true,'standing',1800,0,{offhand:true});assert.notEqual(dual.attacker.items.find(item=>item.reference==='offhand').socket,'handLeft','The legal two-hand rifle stows the owned offhand pistol');
 const supported=new ActorRuntime(dual.asset,dual.attacker,undefined,()=>({model:dual.body.model,root:dual.body.root}));supported.tick(.1,1070);assert.ok(supported.meleeFit.plan);assert.deepEqual(supported.equipment.userData.attached.map(item=>item.name).sort(),['offhand:1806','primary:1800']);assert.equal(supported.equipment.userData.attached.find(item=>item.name==='offhand:1806').userData.presentationStowed,false);supported.dispose();
 const occupied={...dual.attacker,items:dual.attacker.items.map(item=>item.reference==='offhand'?{...item,socket:'handLeft'}:item)},native=new ActorRuntime(dual.asset,occupied),unsupported=new ActorRuntime(dual.asset,occupied,undefined,()=>assert.fail('An occupied support hand is outside this paired-hand fit'));native.tick(.1,1070);unsupported.tick(.1,1070);assert.ok(unsupported.model.getObjectByName('Root').position.distanceTo(native.model.getObjectByName('Root').position)<1e-8);assert.equal(unsupported.meleeFit.plan,undefined);assertGrip(unsupported,native,1800);assert.deepEqual(unsupported.equipment.userData.attached.map(item=>item.name).sort(),['offhand:1806','primary:1800']);unsupported.dispose();native.dispose();dual.body.dispose();
 const fixed=await pair('granadero',true,'standing',1800,0,{bayonet:true}),original=new ActorRuntime(fixed.asset,fixed.attacker),bayonet=new ActorRuntime(fixed.asset,fixed.attacker,undefined,()=>assert.fail('Fixed bayonet is a separate native fit'));original.tick(.1,1070);bayonet.tick(.1,1070);assert.equal(bayonet.action.getClip().name,'stand.bayonet.long-gun');assert.equal(bayonet.meleeFit.plan,undefined);assertGrip(bayonet,original,1800);assert.ok(bayonet.model.getObjectByName('fitting:india_socket'));bayonet.dispose();original.dispose();fixed.body.dispose();

});

test('replacement target and elevated support use the current surface, then hidden recovery completes once',async()=>{
 const fixture=await pair('woman-scout',true,'crouched',1807),other=await publishedActor(fixture.defender.appearance,1),height=3,defender={...fixture.defender,position:[fixture.defender.position[0],height,fixture.defender.position[2]]},replacement=new ActorRuntime(other,defender);replacement.tick(.1,1070);replacement.root.updateMatrixWorld(true);
 const visual={...fixture.attacker,position:[fixture.attacker.position[0],height,fixture.attacker.position[2]],cue:{...fixture.attacker.cue,contactTarget:{...fixture.attacker.cue.contactTarget,position:[...defender.position]},contactSupport:{floors:fixture.attacker.cue.contactSupport.floors.map(floor=>({...floor,height}))}}};
 const firstBody=new ActorRuntime(fixture.body.asset,defender);firstBody.tick(.1,1070);firstBody.root.updateMatrixWorld(true);let current=firstBody,reads=0,complete=0;const runtime=new ActorRuntime(fixture.asset,visual,()=>complete++,()=>{reads++;return {model:current.model,root:current.root};});runtime.tick(.1,1070);const first=runtime.meleeFit.plan;current=replacement;runtime.tick(0,1070);runtime.root.updateMatrixWorld(true);assert.notEqual(runtime.meleeFit.plan,first);assert.equal(runtime.meleeFit.plan.target,replacement.model);assert.ok(gap(capFaces(runtime,fixture.weapon),faces(replacement.model))<=.001);const sole=lowestSole(runtime)-height;assert.ok(sole>=-.001&&sole<=.008);
 const admittedReads=reads;current.root.visible=false;const cue={...visual.cue,phase:'impact',phaseStartedAt:1070,phaseDurationMs:900,contactTarget:undefined,contactSupport:undefined};runtime.update({...visual,cue},1070);runtime.tick(0,1470);assert.equal(reads,admittedReads);runtime.tick(0,1970);runtime.tick(0,2100);assert.equal(complete,1);assert.equal(runtime.visual.action,runtime.visual.idleAction);runtime.dispose();firstBody.dispose();replacement.dispose();fixture.body.dispose();
});

test('a paid empty-cell rifle swing keeps its finite result without inventing a target or reaction',async()=>{
 const fixture=await pair(),order={type:'meleePoint',unitId:'sabre',x:7,y:9},result=presentedActBattle(fixture.state,order);assert.equal(result.state.lastError,null);assert.deepEqual(result.state,actBattle(fixture.state,order));assert.ok(result.frames.every(frame=>frame.impacts.length===0));assert.equal(result.state.units.find(unit=>unit.id==='target-sabre').hp,fixture.state.units.find(unit=>unit.id==='target-sabre').hp);
 const contact=result.frames.find(frame=>frame.type==='contact'),frame={...contact,sequenceId:'pistol-point-review',actionId:1,index:1,startedAt:420,durationMs:650,actionStartedAt:0,actionDurationMs:1970};assert.ok(contact);
 const admitted=frame.state.units.filter(actor=>['sabre','target-sabre'].includes(actor.id)).map(actor=>({key:`unit:${actor.id}`,kind:'unit',actor})),visual=presentActors(frame.state,admitted,{},new Set(),{frame,now:420}).find(actor=>actor.id==='sabre');assert.equal(visual.cue.contactTarget,undefined);
 const before=JSON.stringify(result.state),source=new ActorRuntime(fixture.asset,visual),runtime=new ActorRuntime(fixture.asset,visual,undefined,()=>assert.fail('An empty coordinate swing cannot inspect an actor model'));source.tick(.1,1070);runtime.tick(.1,1070);runtime.root.updateMatrixWorld(true);source.root.updateMatrixWorld(true);assert.equal(runtime.meleeFit.plan,undefined);assert.ok(runtime.model.getObjectByName('Root').position.distanceTo(source.model.getObjectByName('Root').position)<1e-8);assert.ok(runtime.model.getObjectByName('hand_r').getWorldPosition(new Vector3()).distanceTo(source.model.getObjectByName('hand_r').getWorldPosition(new Vector3()))<1e-8);assertGuard(runtime,source);assertGrip(runtime,source,fixture.weapon);assert.equal(JSON.stringify(result.state),before);runtime.dispose();source.dispose();fixture.body.dispose();
});
