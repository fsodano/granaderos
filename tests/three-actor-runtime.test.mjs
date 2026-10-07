import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AnimationClip,Bone,BoxGeometry,Float32BufferAttribute,Group,Mesh,
  MeshStandardMaterial,NumberKeyframeTrack,Object3D,Skeleton,SkinnedMesh,
  Uint16BufferAttribute,Vector3,VectorKeyframeTrack,
} from '../web/node_modules/three/build/three.module.js';
const {ActorRuntime}=await import('../web/lib/three/actor-runtime.ts');
const {TILE_METRES}=await import('../web/lib/three/projection.ts');
const {ACTOR_ITEM_CLIP_OVERRIDES,ACTOR_STRIKE_CLIP_VARIANTS,selectActorClipVariant}=await import('../game/actor-action-contract.js');

// These are real CPU-side Three scenes. Names deliberately differ between
// models and from production assets, so tests cannot pass through hardcoded
// native bone, material, socket, or animation names.
function fixture(prefix='A'){
  const names=Object.fromEntries(['root','hips','spine','chest','head','handLeft','handRight','footLeft','footRight'].map(role=>[role,`${prefix}_${role}_bone`]));
  const makeRig=()=>{
    const scene=new Group();scene.name=`${prefix}_body_scene`;
    const bones=Object.fromEntries(Object.entries(names).map(([role,name])=>{const bone=new Bone();bone.name=name;return[role,bone];}));
    scene.add(bones.root);bones.root.add(bones.hips);bones.hips.position.y=.8;
    bones.hips.add(bones.spine);bones.spine.position.y=.25;bones.spine.add(bones.chest);bones.chest.position.y=.25;
    // Left intentionally precedes right in traversal. Dual weapons must not
    // resolve the right-hand muzzle through a global duplicate-name search.
    bones.chest.add(bones.head,bones.handLeft,bones.handRight);bones.head.position.y=.35;
    bones.handLeft.position.set(.30,-.1,.05);bones.handRight.position.set(-.30,-.1,.05);
    bones.hips.add(bones.footLeft,bones.footRight);bones.footLeft.position.set(.12,-.8,0);bones.footRight.position.set(-.12,-.8,0);
    scene.updateMatrixWorld(true);
    return {scene,bones,skeleton:new Skeleton(Object.values(bones))};
  };
  const rig=makeRig();
  function skinned(name,material,target=rig){
    const geometry=new BoxGeometry(.35,1.5,.2),count=geometry.attributes.position.count;
    geometry.setAttribute('skinIndex',new Uint16BufferAttribute(new Uint16Array(count*4),4));
    const weights=new Float32Array(count*4);for(let i=0;i<count;i++)weights[i*4]=1;
    geometry.setAttribute('skinWeight',new Float32BufferAttribute(weights,4));
    const mesh=new SkinnedMesh(geometry,material);mesh.name=name;target.scene.add(mesh);mesh.bind(target.skeleton);return mesh;
  }
  const skin=new MeshStandardMaterial({color:'#c68b62'});skin.name=`${prefix}_Dermis`;
  const cloth=new MeshStandardMaterial({color:'#30405a'});cloth.name=`${prefix}_Textile`;
  const body=skinned(`${prefix}_skin_0`,skin),coat=skinned(`${prefix}_outfit_0`,cloth),headwear=skinned(`${prefix}_headwear_0`,cloth);
  const sockets={};
  for(const role of ['handLeft','handRight'])for(const grip of ['rifle','pistol','sabre','tool']){
    const node=new Object3D();node.name=`${prefix}_${role}_${grip}_attachment`;node.position.set(0,.04,.06);rig.bones[role].add(node);sockets[`${role}_${grip}`]={node:node.name,bone:names[role]};
  }
  for(const [role,parent,position]of [['back','chest',[0,0,-.2]],['hipLeft','hips',[.2,0,0]],['hipRight','hips',[-.2,0,0]]]){
    const node=new Object3D();node.name=`${prefix}_${role}_attachment`;node.position.fromArray(position);rig.bones[parent].add(node);sockets[role]={node:node.name,bone:names[parent]};
  }
  const equipmentScene=new Group(),items={};
  for(const [id,grip,stowedSocket]of [['1800','rifle','back'],['1805','pistol','hipRight'],['1809','sabre','hipLeft'],['ramrod','tool','back']]){
    const node=new Group();node.name=`${prefix}_item_${id}`;
    const mesh=new Mesh(new BoxGeometry(.3,.04,.04),cloth);node.add(mesh);
    const muzzle=new Object3D();muzzle.name=`${prefix}_muzzle_${id}`;muzzle.position.set(.4,.02,0);node.add(muzzle);equipmentScene.add(node);
    items[id]={node:node.name,grip,stowedSocket,muzzle:muzzle.name,position:[.01,.02,.03],rotation:[0,.2,0],scale:.8};
  }
  const garmentRig=makeRig(),garment=skinned(`${prefix}_owned_poncho`,cloth,garmentRig);
  const horseScene=new Group();horseScene.name=`${prefix}_horse_scene`;const horseHead=new Bone();horseHead.name=`${prefix}_horse_head`;horseScene.add(horseHead);
  horseScene.updateMatrixWorld(true);
  const horseBody=skinned(`${prefix}_horse_mesh`,cloth,{scene:horseScene,skeleton:new Skeleton([horseHead])});
  const horseAnimations=['idle','walk','run'].map((name,index)=>new AnimationClip(`${prefix}_horse_${name}`,1,[new NumberKeyframeTrack(`${horseHead.name}.position[x]`,[0,1],[index*.01,index*.01]) ]));
  const entries=[
    ['stand.idle.unarmed',.01,true],['stand.idle.long-gun',.02,true],['stand.idle.short-gun',.03,true],['stand.idle.blade',.04,true],
    ['stand.aim.long-gun',.10,true],['stand.fire.long-gun',.20,false],['stand.reload.long-gun',.30,false],
    ['stand.walk.unarmed',.40,true],['stand.run.unarmed',.45,true],['prone.crawl.unarmed',.46,true],
    ['life.stand.die',.60,false],['life.stand.dead',.65,true],['life.stand.collapse',.70,false],['life.stand.unconscious',.75,true],
    ['mounted.idle.unarmed',.80,true],['mounted.walk.unarmed',.82,true],['mounted.run.unarmed',.84,true],['life.mount',.90,false],['life.dismount',.95,false],
  ];
  const values=Object.fromEntries(entries.map(([semantic,value])=>[semantic,value]));
  const clips=entries.map(([semantic,value,loop],index)=>({name:`${prefix}_animation_take_${index}`,semantic,loop,duration:2,
    ...(/walk|run|crawl/.test(semantic)?{locomotionSpeed:1}:{}),
    ...(semantic==='stand.reload.long-gun'?{propCues:[{item:'ramrod',socket:sockets.handLeft_tool.node,start:.5,end:1.4}]}:{}),
    ...(semantic.startsWith('mounted.')||semantic==='life.mount'||semantic==='life.dismount'?{seatAnchor:[.02,.9,.03],seatAnchorSpace:'gltf-model-local'}:{}),
    ...(semantic==='life.mount'?{seatWeight:[{time:0,weight:0},{time:2,weight:1}]}:{}),
    ...(semantic==='life.dismount'?{seatWeight:[{time:0,weight:1},{time:2,weight:0}]}:{}),
  }));
  const animations=clips.map((spec,index)=>new AnimationClip(spec.name,2,[new NumberKeyframeTrack(`${names.head}.position[x]`,[0,2],[entries[index][1],entries[index][1]])]));
  const appearance={id:`model-${prefix}`,gender:'male',height:1.76,animationLibrary:`bank-${prefix}`,lods:[{lod:0,url:'unused',triangles:12}],materials:{skin:skin.name},sockets,parts:{skin:`${prefix}_skin_{lod}`,outfit:`${prefix}_outfit_{lod}`,headwear:`${prefix}_headwear_{lod}`},baseAttire:{headwear:'appearance',outfit:'appearance',legwear:'appearance'},nullWornItem:'keepBaseAttire'};
  const manifest={version:1,bones:names,appearances:{[appearance.id]:appearance},skinTones:{light:'#e2ae86',brown:'#9b6543',dark:'#603b29'},animationLibraries:{[appearance.animationLibrary]:{url:'unused',clips}},equipment:{url:'unused',items},garments:{male:{url:'unused',items:{poncho:{node:garment.name,slot:'outfit',hideAppearanceParts:['outfit']}}}},horse:{lods:[{lod:0,url:'unused'}],saddle:{node:'unused',position:[.1,1.6,-.1]},actions:Object.fromEntries(['idle','walk','run'].map(name=>[name,`${prefix}_horse_${name}`])),clips:horseAnimations.map(clip=>({name:clip.name,loop:true,duration:1,locomotionSpeed:1}))}};
  const gltf=(scene,animations=[])=>({scene,scenes:[scene],animations,cameras:[],asset:{version:'2.0'},userData:{}});
  const asset={manifest,appearance,body:gltf(rig.scene),animation:gltf(new Group(),animations),clips,equipment:gltf(equipmentScene),garments:gltf(garmentRig.scene),horse:gltf(horseScene,horseAnimations),lod:0};
  return {asset,names,sockets,body,skin,cloth,coat,headwear,garment,horseBody,rig,values};
}
function visual(f,changes={}){
  return {key:'unit:actor',id:'actor',kind:'unit',appearance:f.asset.appearance.id,skin:'light',side:'player',tacticalLevel:0,position:[4,0,7],yaw:0,posture:'standing',mounted:false,action:'idle',idleAction:'idle',equipment:'unarmed',items:[],garments:{headwear:null,outfit:null,legwear:null},selected:false,bodyHeights:{head:1.6,torso:1.2,legs:.5,muzzle:1.3},...changes};
}
function close(actual,expected,message){assert.ok(Math.abs(actual-expected)<1e-6,`${message??'value'}: ${actual} != ${expected}`);}
function closeVector(actual,expected,message){assert.ok(actual.distanceTo(new Vector3(...expected))<1e-6,`${message??'vector'}: ${actual.toArray()} != ${expected}`);}
function actorHead(runtime,f){return runtime.model.getObjectByName(f.names.head);}
function settle(runtime,now){runtime.tick(.1,now);runtime.tick(.1,now);}
function attached(runtime,reference,id){return runtime.model.getObjectByName(`${reference}:${id}`);}

test('a replacement model binds renamed clips, bones, sockets and skin material roles',()=>{
  for(const prefix of ['Original','Replacement']){
    const f=fixture(prefix),v=visual(f,{action:'aim',idleAction:'aim',equipment:'long-gun',skin:'dark',items:[{id:'1800',reference:'primary',socket:'handRight'}]});
    const runtime=new ActorRuntime(f.asset,v);runtime.tick(0,0);
    close(actorHead(runtime,f).position.x,f.values['stand.aim.long-gun'],'renamed animation controls the renamed bone');
    const skin=runtime.model.getObjectByName(f.body.name).material;
    assert.equal(skin.color.getHexString(),'603b29');assert.notEqual(skin,f.skin);assert.equal(f.skin.color.getHexString(),'c68b62');
    assert.equal(attached(runtime,'primary','1800').parent.name,f.sockets.handRight_rifle.node);
    runtime.dispose();
  }
});

test('instances share geometry but have independent palettes, bones and garment skeleton bindings',()=>{
  const f=fixture(),a=new ActorRuntime(f.asset,visual(f,{skin:'light',garments:{headwear:null,outfit:'poncho',legwear:null}})),b=new ActorRuntime(f.asset,visual(f,{key:'unit:second',skin:'dark'}));
  const aBody=a.model.getObjectByName(f.body.name),bBody=b.model.getObjectByName(f.body.name);
  assert.equal(aBody.geometry,bBody.geometry);assert.equal(aBody.geometry,f.body.geometry);
  assert.notEqual(aBody.material,bBody.material);assert.notEqual(aBody.material,f.skin);assert.notEqual(aBody.skeleton,bBody.skeleton);
  assert.notEqual(aBody.skeleton.bones[0],bBody.skeleton.bones[0]);assert.notEqual(aBody.skeleton.bones[0],f.body.skeleton.bones[0]);
  aBody.skeleton.bones[0].position.x=3;assert.equal(bBody.skeleton.bones[0].position.x,0);assert.equal(f.body.skeleton.bones[0].position.x,0);
  const aGarment=a.model.getObjectByName(f.garment.name);assert.ok(aGarment.visible);
  for(const bone of aGarment.skeleton.bones)assert.equal(bone,a.model.getObjectByName(bone.name));
  assert.equal(a.model.getObjectByName(f.coat.name).visible,false);assert.equal(b.model.getObjectByName(f.coat.name).visible,true);
  assert.equal(a.model.getObjectByName(f.headwear.name).visible,true,'empty inventory slot retains declared base attire');
  let disposed=0,sourceDisposed=0;aBody.material.addEventListener('dispose',()=>disposed++);f.skin.addEventListener('dispose',()=>sourceDisposed++);
  a.dispose();assert.equal(disposed,1);assert.equal(sourceDisposed,0);assert.equal(bBody.material.color.getHexString(),'603b29');b.dispose();
});

test('left, right and stowed items attach to their declared sockets and remove without mutating shared assets',()=>{
  const f=fixture(),items=[{id:'1805',reference:'primary',socket:'handRight'},{id:'1805',reference:'offhand',socket:'handLeft'},{id:'1800',reference:'stowed-rifle',socket:'back'},{id:'1809',reference:'blade',socket:'hip'}];
  const runtime=new ActorRuntime(f.asset,visual(f,{equipment:'short-gun',items}));
  for(const [reference,id,socket]of [['primary','1805','handRight_pistol'],['offhand','1805','handLeft_pistol'],['stowed-rifle','1800','back'],['blade','1809','hipLeft']]){
    const object=attached(runtime,reference,id);assert.ok(object);assert.equal(object.parent.name,f.sockets[socket].node);closeVector(object.position,[.01,.02,.03]);close(object.scale.x,.8);
  }
  assert.notEqual(attached(runtime,'primary','1805'),attached(runtime,'offhand','1805'));
  runtime.update(visual(f),10);
  for(const item of items)assert.equal(attached(runtime,item.reference,item.id),undefined);
  assert.ok(f.asset.equipment.scene.getObjectByName(f.asset.manifest.equipment.items['1805'].node));runtime.dispose();
});

test('the muzzle anchor belongs to the right-hand instance when both hands carry the same pistol',()=>{
  const f=fixture(),runtime=new ActorRuntime(f.asset,visual(f,{equipment:'short-gun',items:[{id:'1805',reference:'primary',socket:'handRight'},{id:'1805',reference:'offhand',socket:'handLeft'}]}));
  runtime.root.updateMatrixWorld(true);
  const right=attached(runtime,'primary','1805').getObjectByName(f.asset.manifest.equipment.items['1805'].muzzle).getWorldPosition(new Vector3());
  const left=attached(runtime,'offhand','1805').getObjectByName(f.asset.manifest.equipment.items['1805'].muzzle).getWorldPosition(new Vector3());
  assert.ok(right.distanceTo(left)>.5);closeVector(runtime.anchor('muzzle'),right.toArray());runtime.dispose();
});

test('life state wins over an unrelated queued cue and its prior posture',()=>{
  const f=fixture(),done=[],runtime=new ActorRuntime(f.asset,visual(f,{action:'dead',cue:{id:'stale-shot',action:'fire',startedAt:0,durationMs:50,fromPosture:'mounted'}}),(...args)=>done.push(args));
  runtime.tick(.02,1000);close(actorHead(runtime,f).position.x,f.values['life.stand.dead']);assert.deepEqual(done,[]);
  runtime.update(visual(f,{action:'unconscious',cue:{id:'stale-reload',action:'reload',startedAt:0,durationMs:10}}),1100);settle(runtime,1200);
  close(actorHead(runtime,f).position.x,f.values['life.stand.unconscious']);assert.deepEqual(done,[]);runtime.dispose();
});

test('missing animation capability, data, carried item and socket fail explicitly',()=>{
  const capability=fixture();capability.asset.clips=capability.asset.clips.filter(c=>c.semantic!=='stand.aim.long-gun');
  assert.throws(()=>new ActorRuntime(capability.asset,visual(capability,{action:'aim',equipment:'long-gun'})),/Missing animation capability: stand\.aim\.long-gun/);
  const data=fixture();const name=data.asset.clips.find(c=>c.semantic==='stand.aim.long-gun').name;data.asset.animation.animations=data.asset.animation.animations.filter(c=>c.name!==name);
  assert.throws(()=>new ActorRuntime(data.asset,visual(data,{action:'aim',equipment:'long-gun'})),/Missing animation data:/);
  const item=fixture();assert.throws(()=>new ActorRuntime(item.asset,visual(item,{items:[{id:'missing',reference:'primary',socket:'handRight'}]})),/Missing carried item: missing/);
  const socket=fixture();socket.asset.body.scene.getObjectByName(socket.sockets.handRight_rifle.node).removeFromParent();
  assert.throws(()=>new ActorRuntime(socket.asset,visual(socket,{items:[{id:'1800',reference:'primary',socket:'handRight'}]})),/Missing handRight socket:/);
  const impossible=fixture();assert.throws(()=>new ActorRuntime(impossible.asset,visual(impossible,{action:'throwGrenade',posture:'prone'})),/Unsupported character action:/);
});

test('completed cues return to rest once and a repeated presentation does not restart them',()=>{
  const f=fixture(),events=[],v=visual(f,{action:'fire',equipment:'long-gun',cue:{id:'paid-shot',action:'fire',startedAt:1000,durationMs:400}}),runtime=new ActorRuntime(f.asset,v,(...args)=>events.push(args));
  runtime.tick(0,1200);close(actorHead(runtime,f).position.x,f.values['stand.fire.long-gun']);
  runtime.tick(0,1401);settle(runtime,1410);close(actorHead(runtime,f).position.x,f.values['stand.idle.long-gun']);assert.deepEqual(events,[['unit:actor','paid-shot']]);
  runtime.update(v,1600);settle(runtime,1650);close(actorHead(runtime,f).position.x,f.values['stand.idle.long-gun']);assert.equal(events.length,1);
  runtime.update({...v,cue:{...v.cue,id:'next-paid-shot',startedAt:2000}},2000);settle(runtime,2200);close(actorHead(runtime,f).position.x,f.values['stand.fire.long-gun']);runtime.dispose();
});

test('death and collapse cues finish in their matching persistent life states',()=>{
  for(const [action,rest]of [['die','dead'],['collapse','unconscious']]){
    const f=fixture(),runtime=new ActorRuntime(f.asset,visual(f,{action,cue:{id:'life',action,startedAt:0,durationMs:500}}));
    runtime.tick(0,501);settle(runtime,510);close(actorHead(runtime,f).position.x,f.values[`life.stand.${rest}`]);runtime.dispose();
  }
});

test('a ramrod exists only during the declared reload interval and leaves on interruption',()=>{
  const f=fixture(),v=visual(f,{action:'reload',equipment:'long-gun',cue:{id:'reload-1',action:'reload',startedAt:0,durationMs:1000}}),runtime=new ActorRuntime(f.asset,v);
  const socket=runtime.model.getObjectByName(f.sockets.handLeft_tool.node),name=f.asset.manifest.equipment.items.ramrod.node;
  runtime.tick(0,100);assert.equal(socket.getObjectByName(name),undefined);
  runtime.tick(0,300);const ramrod=socket.getObjectByName(name);assert.ok(ramrod);assert.notEqual(ramrod,f.asset.equipment.scene.getObjectByName(name));
  runtime.tick(0,400);assert.equal(socket.getObjectByName(name),ramrod,'cue does not clone one prop per frame');
  runtime.tick(0,800);assert.equal(socket.getObjectByName(name),undefined);
  runtime.update({...v,cue:{...v.cue,id:'reload-2',startedAt:1000}},1000);runtime.tick(0,1300);assert.ok(socket.getObjectByName(name));
  runtime.update(visual(f),1400);runtime.tick(0,1400);assert.equal(socket.getObjectByName(name),undefined);runtime.dispose();
});

test('mounted placement uses normalized model-local coordinates exactly once',()=>{
  const f=fixture(),v=visual(f,{mounted:true}),runtime=new ActorRuntime(f.asset,v);runtime.tick(0,0);
  closeVector(runtime.model.position,[.08,.7,-.13]);closeVector(runtime.root.position,v.position,'gameplay position is unchanged');
  const horse=runtime.root.getObjectByName('A_horse_scene');assert.ok(horse.visible);closeVector(horse.position,[0,0,0]);
  runtime.update(visual(f),100);runtime.tick(0,100);assert.equal(horse.visible,false);closeVector(runtime.model.position,[0,0,0]);runtime.dispose();
});

test('mount and dismount retain the horse while seat weight crosses the transition',()=>{
  const f=fixture(),mounted=visual(f,{mounted:true,action:'mount',cue:{id:'mount',action:'mount',startedAt:0,durationMs:1000,fromPosture:'standing',toPosture:'mounted'}}),runtime=new ActorRuntime(f.asset,mounted);
  const horse=runtime.root.getObjectByName('A_horse_scene');runtime.tick(0,0);assert.ok(horse.visible);closeVector(runtime.model.position,[0,0,0]);
  runtime.tick(0,500);closeVector(runtime.model.position,[.04,.35,-.065]);runtime.tick(0,1001);closeVector(runtime.model.position,[.08,.7,-.13]);assert.ok(horse.visible);
  const dismount=visual(f,{mounted:false,action:'dismount',cue:{id:'dismount',action:'dismount',startedAt:2000,durationMs:1000,fromPosture:'mounted',toPosture:'standing'}});
  runtime.update(dismount,2000);runtime.tick(0,2000);assert.ok(horse.visible,'already-dismounted simulation still retains horse for exit animation');closeVector(runtime.model.position,[.08,.7,-.13]);
  runtime.tick(0,2500);closeVector(runtime.model.position,[.04,.35,-.065]);runtime.tick(0,3001);assert.equal(horse.visible,false);closeVector(runtime.model.position,[0,0,0]);runtime.dispose();
});


test('actor removal releases cloned human, garment and horse bone textures while retaining shared resources',()=>{
  const f=fixture();
  const sourceRoots=[f.asset.body.scene,f.asset.garments.scene,f.asset.horse.scene,f.asset.equipment.scene];
  const sourceSkeletons=new Set(),sourceGeometries=new Set(),sourceMaterials=new Set();
  for(const root of sourceRoots)root.traverse(node=>{
    if(node instanceof SkinnedMesh)sourceSkeletons.add(node.skeleton);
    if(node instanceof Mesh){sourceGeometries.add(node.geometry);for(const material of Array.isArray(node.material)?node.material:[node.material])sourceMaterials.add(material);}
  });
  let sharedDisposed=0;
  for(const skeleton of sourceSkeletons){skeleton.computeBoneTexture();skeleton.boneTexture.addEventListener('dispose',()=>sharedDisposed++);}
  for(const resource of [...sourceGeometries,...sourceMaterials])resource.addEventListener('dispose',()=>sharedDisposed++);
  const a=new ActorRuntime(f.asset,visual(f,{mounted:true,garments:{headwear:null,outfit:'poncho',legwear:null}}));
  const b=new ActorRuntime(f.asset,visual(f,{key:'unit:remaining',mounted:true}));
  const actorSkeletons=runtime=>{const found=new Set();runtime.root.traverse(node=>{if(node instanceof SkinnedMesh)found.add(node.skeleton);});return found;};
  const ownedA=actorSkeletons(a),ownedB=actorSkeletons(b);assert.equal(ownedA.size,2,'human parts and garment share one palette; horse has its own palette');
  let disposedA=0,disposedB=0;
  for(const skeleton of ownedA){assert.ok(!sourceSkeletons.has(skeleton));skeleton.computeBoneTexture();skeleton.boneTexture.addEventListener('dispose',()=>disposedA++);}
  for(const skeleton of ownedB){assert.ok(!ownedA.has(skeleton));skeleton.computeBoneTexture();skeleton.boneTexture.addEventListener('dispose',()=>disposedB++);}
  const scene=new Group();scene.add(a.root,b.root);a.dispose();
  assert.equal(disposedA,ownedA.size,'all actor-owned bone textures are released');assert.equal(disposedB,0);assert.equal(sharedDisposed,0);assert.equal(a.root.parent,null);assert.equal(b.root.parent,scene);
  a.dispose();assert.equal(disposedA,ownedA.size,'dispose is idempotent');
  b.tick(.016,20);b.dispose();assert.equal(disposedB,ownedB.size);assert.equal(sharedDisposed,0);
});

test('metadata item aliases resolve the same equipment without changing presentation references',()=>{
  const f=fixture();f.asset.manifest.equipment.aliases={'inventory:issued-pistol':'1805'};
  const reference='inventory:issued-pistol';const runtime=new ActorRuntime(f.asset,visual(f,{equipment:'short-gun',items:[{id:reference,reference,socket:'handRight'}]}));
  const object=attached(runtime,reference,reference);assert.ok(object);assert.equal(object.parent.name,f.sockets.handRight_pistol.node);
  runtime.root.updateMatrixWorld(true);const expected=object.getObjectByName(f.asset.manifest.equipment.items['1805'].muzzle).getWorldPosition(new Vector3());
  closeVector(runtime.anchor('muzzle'),expected.toArray());runtime.dispose();
});

test('a fitted bayonet belongs to its weapon assembly and follows it from hand to back',()=>{
  const f=fixture(),bayonet=new Group();bayonet.name='A_fitting_geometry';bayonet.add(new Mesh(new BoxGeometry(.03,.35,.03),f.cloth));f.asset.equipment.scene.add(bayonet);
  f.asset.manifest.equipment.fittings={india_socket:{node:bayonet.name,hostWeapon:1800,position:[.43,.02,0],rotation:[0,0,-Math.PI/2],scale:.7}};
  const fitting={weapon:1811,fittingPattern:'india_socket',instanceId:'owned-bayonet',condition:72};
  const item={id:'1800',reference:'primary',socket:'handRight',fittings:{bayonet:fitting}};
  const v=visual(f,{equipment:'long-gun',items:[item]}),runtime=new ActorRuntime(f.asset,v);
  let assembly=attached(runtime,'primary','1800'),attachment=assembly.getObjectByName('fitting:india_socket');
  assert.ok(attachment);assert.equal(attachment.parent,assembly);closeVector(attachment.position,[.43,.02,0]);close(attachment.rotation.z,-Math.PI/2);close(attachment.scale.x,.7);
  assert.equal(bayonet.parent,f.asset.equipment.scene);assert.deepEqual(item.fittings,{bayonet:fitting},'display never edits inventory fitting state');
  runtime.update(visual(f,{items:[{...item,socket:'back'}]}),20);
  assembly=attached(runtime,'primary','1800');assert.equal(assembly.parent.name,f.sockets.back.node);assert.ok(assembly.getObjectByName('fitting:india_socket'));
  runtime.update(visual(f,{items:[{...item,socket:'back',fittings:{}}]}),40);
  assert.equal(attached(runtime,'primary','1800').getObjectByName('fitting:india_socket'),undefined);runtime.dispose();
});

test('missing fitting capability or geometry is explicit, never an invisible fitted item',()=>{
  for(const hasDefinition of [false,true]){
    const f=fixture();if(hasDefinition)f.asset.manifest.equipment.fittings={india_socket:{node:'absent-geometry'}};
    const item={id:'1800',reference:'primary',socket:'handRight',fittings:{bayonet:{fittingPattern:'india_socket'}}};
    assert.throws(()=>new ActorRuntime(f.asset,visual(f,{items:[item]})),hasDefinition?/Missing fitting geometry: absent-geometry/:/Missing fitting: india_socket/);
  }
});

function addClip(f,semantic,options={}){
  const {value=.51,...metadata}=options,name=`test_take_${f.asset.clips.length}`;
  const spec={name,semantic,duration:2,loop:false,...metadata};
  f.asset.clips.push(spec);f.asset.animation.animations.push(new AnimationClip(name,2,[new NumberKeyframeTrack(`${f.names.head}.position[x]`,[0,2],[value,value])]));
  return spec;
}

test('authored gesture hand requirements stow held weapons and restore the same instances',()=>{
  for(const [action,gesture,both]of [['heal','heal',true],['fitBayonet','fitting',true],['environment','tool',true],['transfer','offer',false],['throwTorch','throw',false]]){
    const f=fixture();addClip(f,`stand.gesture.${gesture}`,{gesture});
    const items=[{id:'1805',reference:'primary',socket:'handRight'},{id:'1809',reference:'offhand',socket:'handLeft'}];
    const copy=JSON.stringify(items),v=visual(f,{action,equipment:'short-gun',items,cue:{id:action,action,startedAt:0,durationMs:1000}}),runtime=new ActorRuntime(f.asset,v);
    const right=attached(runtime,'primary','1805'),left=attached(runtime,'offhand','1809');
    assert.equal(right.parent.name,f.sockets.hipRight.node,action);
    assert.equal(left.parent.name,f.sockets[both?'hipLeft':'handLeft_sabre'].node,action);
    runtime.tick(0,1001);
    assert.equal(attached(runtime,'primary','1805'),right);assert.equal(attached(runtime,'offhand','1809'),left);
    assert.equal(right.parent.name,f.sockets.handRight_pistol.node);assert.equal(left.parent.name,f.sockets.handLeft_sabre.node);
    assert.equal(JSON.stringify(items),copy,'visual stow never changes carried ownership');runtime.dispose();
  }
});

test('tools stay visible during their gesture and explicit freeHands can replace default requirements',()=>{
  const f=fixture(),spec=addClip(f,'stand.gesture.heal',{gesture:'heal'});
  f.asset.manifest.equipment.items.medkit={...f.asset.manifest.equipment.items.ramrod,category:'supply'};
  const v=visual(f,{action:'heal',items:[{id:'medkit',reference:'medical',socket:'handRight'},{id:'1805',reference:'offhand',socket:'handLeft'}]});
  const runtime=new ActorRuntime(f.asset,v),tool=attached(runtime,'medical','medkit'),pistol=attached(runtime,'offhand','1805');
  assert.equal(tool.parent.name,f.sockets.handRight_tool.node);assert.equal(pistol.parent.name,f.sockets.hipRight.node);
  spec.freeHands=[];runtime.tick(0,0);assert.equal(pistol.parent.name,f.sockets.handLeft_pistol.node);
  spec.gesture='replacement-treatment';spec.freeHands=['handLeft'];runtime.tick(0,0);assert.equal(pistol.parent.name,f.sockets.hipRight.node);
  runtime.update(visual(f,{items:v.items}),10);assert.equal(pistol.parent.name,f.sockets.handLeft_pistol.node);assert.equal(tool.parent.name,f.sockets.handRight_tool.node);runtime.dispose();
});

test('a timed ramrod claims only its declared hand and restores displaced equipment after its interval',()=>{
  const f=fixture(),items=[{id:'1800',reference:'primary',socket:'handRight'},{id:'1805',reference:'offhand',socket:'handLeft'}];
  const runtime=new ActorRuntime(f.asset,visual(f,{action:'reload',equipment:'long-gun',items,cue:{id:'reload',action:'reload',startedAt:0,durationMs:1000}}));
  const pistol=attached(runtime,'offhand','1805'),rifle=attached(runtime,'primary','1800');
  runtime.tick(0,100);assert.equal(pistol.parent.name,f.sockets.handLeft_pistol.node);
  runtime.tick(0,300);assert.equal(pistol.parent.name,f.sockets.hipRight.node);assert.equal(rifle.parent.name,f.sockets.handRight_rifle.node);
  assert.ok(runtime.model.getObjectByName(f.sockets.handLeft_tool.node).getObjectByName(f.asset.manifest.equipment.items.ramrod.node));
  runtime.tick(0,800);assert.equal(pistol.parent.name,f.sockets.handLeft_pistol.node);assert.equal(attached(runtime,'offhand','1805'),pistol);runtime.dispose();
});

test('an item can select a distinct lance clip through aliases without changing its rules equipment class',()=>{
  const f=fixture();addClip(f,'stand.idle.lance',{loop:true,value:.57});
  f.asset.manifest.equipment.items['1812']={...f.asset.manifest.equipment.items['1809'],clipOverrides:{'stand.idle.blade':'stand.idle.lance'}};
  f.asset.manifest.equipment.aliases={'inventory:lance':'1812'};
  const v=visual(f,{equipment:'blade',items:[{id:'inventory:lance',reference:'primary',socket:'handRight'}]});
  const runtime=new ActorRuntime(f.asset,v);runtime.tick(0,0);close(actorHead(runtime,f).position.x,.57);assert.equal(v.equipment,'blade');runtime.dispose();
  f.asset.manifest.equipment.items['1812'].clipOverrides['stand.idle.blade']='missing.lance';
  assert.throws(()=>new ActorRuntime(f.asset,v),/Missing animation capability: missing\.lance/);
});

test('sabre and aliased knife strikes bind stable variants throughout paid action phases',()=>{
  for(const [itemId,semantic]of [['1809','stand.slash.blade'],['inventory:knife','stand.slash.knife']]){
    const f=fixture(),values=new Map();
    for(const [index,name]of ACTOR_STRIKE_CLIP_VARIANTS[semantic].entries()){
      const value=.50+index*.03;values.set(name,value);addClip(f,name,{value,markers:{contact:.8}});
    }
    if(itemId==='inventory:knife'){
      addClip(f,'stand.idle.knife',{loop:true,value:.49});
      f.asset.manifest.equipment.items['1813']={...f.asset.manifest.equipment.items['1809'],category:'knife',clipOverrides:ACTOR_ITEM_CLIP_OVERRIDES['1813']};
      f.asset.manifest.equipment.aliases={'inventory:knife':'1813'};
    }
    const cue={id:'sequence:5:paid-strike:17:unit:actor',action:'strike',startedAt:1000,durationMs:900};
    const selected=selectActorClipVariant(semantic,cue.id),items=[{id:itemId,reference:'primary',socket:'handRight'}];
    const v=visual(f,{action:'strike',equipment:'blade',items,cue:{...cue,phase:'prepare',phaseStartedAt:1000,phaseDurationMs:300}});
    const before=JSON.stringify(v),runtime=new ActorRuntime(f.asset,v);
    for(const [index,phase]of ['prepare','contact','impact'].entries()){
      const start=1000+index*300;
      runtime.update({...v,cue:{...cue,phase,phaseStartedAt:start,phaseDurationMs:300}},start);
      runtime.tick(0,start+150);close(actorHead(runtime,f).position.x,values.get(selected),`${itemId}/${phase}`);
    }
    assert.equal(JSON.stringify(v),before,'presentation leaves action identity and inventory unchanged');
    runtime.dispose();
  }
});

test('reviewed clip metadata sets free-play speed while paid cue progress stays authoritative',()=>{
  const f=fixture(),idle=f.asset.clips.find(spec=>spec.semantic==='stand.idle.unarmed');idle.playbackRate=1.25;
  f.asset.animation.animations[f.asset.animation.animations.findIndex(clip=>clip.name===idle.name)]=new AnimationClip(idle.name,2,[new NumberKeyframeTrack(`${f.names.head}.position[x]`,[0,2],[0,2])]);
  const free=new ActorRuntime(f.asset,visual(f));free.tick(.1,100);close(actorHead(free,f).position.x,.125);free.dispose();
  const shot=f.asset.clips.find(spec=>spec.semantic==='stand.fire.long-gun');shot.playbackRate=1.25;
  f.asset.animation.animations[f.asset.animation.animations.findIndex(clip=>clip.name===shot.name)]=new AnimationClip(shot.name,2,[new NumberKeyframeTrack(`${f.names.head}.position[x]`,[0,2],[0,2])]);
  const paid=new ActorRuntime(f.asset,visual(f,{action:'fire',equipment:'long-gun',cue:{id:'paid-shot-rate',action:'fire',startedAt:0,durationMs:1000}}));
  paid.tick(.1,250);close(actorHead(paid,f).position.x,.5);paid.dispose();
});

test('mounted death and collapse retain the horse and seat until the paid transition finishes',()=>{
  for(const [action,rest]of [['die','dead'],['collapse','unconscious']]){
    const f=fixture();addClip(f,`life.mounted.${action}`,{seatAnchor:[.02,.9,.03],seatAnchorSpace:'gltf-model-local'});
    const runtime=new ActorRuntime(f.asset,visual(f,{mounted:false,action,cue:{id:action,action,startedAt:0,durationMs:1000,fromPosture:'mounted'}}));
    const horse=runtime.root.getObjectByName('A_horse_scene');runtime.tick(0,200);assert.ok(horse.visible);closeVector(runtime.model.position,[.08,.7,-.13]);
    runtime.tick(0,1001);settle(runtime,1020);assert.equal(horse.visible,false);closeVector(runtime.model.position,[0,0,0]);close(actorHead(runtime,f).position.x,f.values[`life.stand.${rest}`]);runtime.dispose();
  }
});

test('the rider follows the animated saddle after the horse mixer in actor-local coordinates',()=>{
  const f=fixture(),head=f.asset.horse.scene.getObjectByName('A_horse_head'),saddle=new Object3D();saddle.name='animated_saddle';saddle.position.set(.1,1.6,-.1);head.add(saddle);
  f.asset.manifest.horse.saddle={node:saddle.name,position:[9,9,9]};
  f.asset.horse.animations[0]=new AnimationClip('A_horse_idle',1,[new NumberKeyframeTrack(`${head.name}.position[y]`,[0,1],[0,.4])]);
  const v=visual(f,{mounted:true,position:[4,3,7],yaw:Math.PI/2}),runtime=new ActorRuntime(f.asset,v);
  runtime.tick(.1,100);closeVector(runtime.model.position,[.08,.74,-.13]);
  runtime.tick(.1,200);closeVector(runtime.model.position,[.08,.78,-.13]);closeVector(runtime.root.position,v.position);close(runtime.root.rotation.y,v.yaw);runtime.dispose();
});

test('locomotion uses total path length through turns and positive native strafe phases',()=>{
  const f=fixture();addClip(f,'stand.strafeLeft.unarmed',{loop:true,locomotionSpeed:1});addClip(f,'stand.strafeRight.unarmed',{loop:true,locomotionSpeed:1});
  const gait=f.asset.clips.find(c=>c.semantic==='stand.walk.unarmed');
  // A varying track exposes animation time without accessing private clocks.
  f.asset.animation.animations[f.asset.animation.animations.findIndex(c=>c.name===gait.name)]=new AnimationClip(gait.name,2,[new NumberKeyframeTrack(`${f.names.head}.position[x]`,[0,2],[0,2])]);
  for(const semantic of ['stand.strafeLeft.unarmed','stand.strafeRight.unarmed']){const spec=f.asset.clips.find(c=>c.semantic===semantic);f.asset.animation.animations[f.asset.animation.animations.findIndex(c=>c.name===spec.name)]=new AnimationClip(spec.name,2,[new NumberKeyframeTrack(`${f.names.head}.position[x]`,[0,2],[0,2])]);}
  // Net displacement is deliberately shorter
  // than total distance after the actor has turned through a multi-tile path.
  const motion={moving:true,elapsedDistance:.7,elapsedTravelX:.1,elapsedTravelY:.2,travelX:1,travelY:0,speed:1};
  const runtime=new ActorRuntime(f.asset,visual(f,{action:'walk',yaw:Math.PI/2,motion}));runtime.tick(0,0);close(actorHead(runtime,f).position.x,.7*TILE_METRES);
  runtime.update(visual(f,{action:'walk',yaw:Math.PI/2,motion:{...motion,travelX:-1}}),10);runtime.tick(0,10);close(actorHead(runtime,f).position.x,2-.7*TILE_METRES,'backward uses negative cumulative distance');
  for(const action of ['strafeLeft','strafeRight']){runtime.update(visual(f,{action,motion:{...motion,travelX:0,travelY:-1}}),20);settle(runtime,30);close(actorHead(runtime,f).position.x,.7*TILE_METRES,action);}
  runtime.dispose();
});

test('all compatible body parts and rebound garments share one skeleton per actor',()=>{
  const f=fixture(),a=new ActorRuntime(f.asset,visual(f,{garments:{outfit:'poncho'}})),b=new ActorRuntime(f.asset,visual(f,{key:'second'}));
  const skeleton=a.model.getObjectByName(f.body.name).skeleton;
  for(const name of [f.coat.name,f.headwear.name,f.garment.name])assert.equal(a.model.getObjectByName(name).skeleton,skeleton,name);
  assert.notEqual(b.model.getObjectByName(f.body.name).skeleton,skeleton);assert.notEqual(f.body.skeleton,skeleton);
  skeleton.computeBoneTexture();assert.equal(a.model.getObjectByName(f.coat.name).skeleton.boneTexture,skeleton.boneTexture);
  a.dispose();b.dispose();
});

test('parts with distinct inverse bind transforms retain distinct palettes',()=>{
  const f=fixture(),inverses=f.coat.skeleton.boneInverses.map(matrix=>matrix.clone());inverses[0].elements[12]+=.01;
  f.coat.skeleton=new Skeleton(f.coat.skeleton.bones,inverses);
  const runtime=new ActorRuntime(f.asset,visual(f));
  const body=runtime.model.getObjectByName(f.body.name),coat=runtime.model.getObjectByName(f.coat.name),headwear=runtime.model.getObjectByName(f.headwear.name);
  assert.notEqual(coat.skeleton,body.skeleton);assert.equal(headwear.skeleton,body.skeleton);assert.equal(coat.skeleton.bones[0],body.skeleton.bones[0]);
  close(coat.skeleton.boneInverses[0].elements[12]-body.skeleton.boneInverses[0].elements[12],.01);runtime.dispose();
});

test('a thrown knife stays in its hand until release and visibility resets on interruption or completion',()=>{
  const f=fixture();addClip(f,'stand.gesture.throwKnife',{gesture:'throwKnife',markers:{release:1},handProps:[{hand:'handRight',categories:['knife'],untilMarker:'release'}]});
  f.asset.manifest.equipment.items.knife={...f.asset.manifest.equipment.items['1809'],category:'knife'};
  const items=[{id:'knife',reference:'primary',socket:'handRight'}],v=visual(f,{action:'throwKnife',equipment:'blade',items,cue:{id:'throw',action:'throwKnife',startedAt:0,durationMs:1000}});
  const runtime=new ActorRuntime(f.asset,v),knife=attached(runtime,'primary','knife');
  runtime.tick(0,400);assert.equal(knife.parent.name,f.sockets.handRight_sabre.node);assert.ok(knife.visible);
  runtime.tick(0,600);assert.equal(knife.visible,false);assert.equal(v.items[0].id,'knife','release does not remove gameplay inventory');
  runtime.update(visual(f,{equipment:'blade',items}),650);assert.ok(knife.visible,'interrupted clip restores visibility');
  runtime.update({...v,cue:{...v.cue,id:'throw-next',startedAt:1000}},1000);runtime.tick(0,1600);assert.equal(knife.visible,false);
  runtime.tick(0,2001);assert.ok(knife.visible,'completed clip defers equipment ownership to the next presentation');assert.equal(attached(runtime,'primary','knife'),knife);runtime.dispose();
});

test('a different held weapon still stows during a knife throw and a missing release marker is explicit',()=>{
  const f=fixture(),clip=addClip(f,'stand.gesture.throwKnife',{gesture:'throwKnife',markers:{release:1},handProps:[{hand:'handRight',categories:['knife'],untilMarker:'release'}]});
  const v=visual(f,{action:'throwKnife',equipment:'blade',items:[{id:'1809',reference:'primary',socket:'handRight'}]});
  const runtime=new ActorRuntime(f.asset,v);assert.equal(attached(runtime,'primary','1809').parent.name,f.sockets.hipLeft.node);runtime.dispose();
  f.asset.manifest.equipment.items['1809'].category='knife';delete clip.markers.release;
  assert.throws(()=>new ActorRuntime(f.asset,v),/Missing held prop marker: release/);
});

test('recorded offhand pistol fire aims the left arm and resolves the left instance muzzle',()=>{
 const f=fixture();f.asset.manifest.animationMirroring={axis:'x',bones:Object.fromEntries(Object.entries(f.names).map(([role,name])=>[name,f.names[role.replace('Left','TEMP').replace('Right','Left').replace('TEMP','Right')]]))};
 addClip(f,'stand.fire.short-gun');
 const name=f.asset.clips.at(-1).name;
 f.asset.animation.animations[f.asset.animation.animations.length-1]=new AnimationClip(name,2,[
  new VectorKeyframeTrack(`${f.names.handRight}.position`,[0,.5,2],[-.3,-.1,.25,-.3,-.1,.35,-.3,-.1,.25]),
  new VectorKeyframeTrack(`${f.names.handLeft}.position`,[0,2],[.3,-.1,.05,.3,-.1,.05]),
 ]);
 const items=[{id:'1805',reference:'primary',socket:'handRight'},{id:'1805',reference:'offhand',socket:'handLeft'}];
 const v=visual(f,{equipment:'short-gun',action:'fire',items,cue:{id:'first-shot',action:'fire',hand:'handRight',shotHand:'primary',startedAt:0,durationMs:1000}});
 const runtime=new ActorRuntime(f.asset,v);runtime.tick(0,125);
 close(runtime.model.getObjectByName(f.names.handRight).position.z,.3);close(runtime.model.getObjectByName(f.names.handLeft).position.z,.05);
 runtime.update({...v,cue:{...v.cue,id:'second-shot',hand:'handLeft',shotHand:'offhand',startedAt:1000}},1000);runtime.tick(0,1125);
 close(runtime.model.getObjectByName(f.names.handLeft).position.z,.3);close(runtime.model.getObjectByName(f.names.handRight).position.z,.05);
 runtime.root.updateMatrixWorld(true);const left=attached(runtime,'offhand','1805').getObjectByName(f.asset.manifest.equipment.items['1805'].muzzle).getWorldPosition(new Vector3());closeVector(runtime.anchor('muzzle'),left.toArray());
 assert.deepEqual(f.asset.animation.animations.at(-1).tracks[0].values,new Float32Array([-.3,-.1,.25,-.3,-.1,.35,-.3,-.1,.25]),'shared right-hand source remains unchanged');
 runtime.dispose();delete f.asset.manifest.animationMirroring;
 assert.throws(()=>new ActorRuntime(f.asset,{...v,cue:{...v.cue,hand:'handLeft',shotHand:'offhand'}}),/Missing left-hand animation mapping/);
});

test('mounted falls blend the saddle offset to zero by ground contact and keep the horse through the exit',()=>{
 for(const action of ['die','collapse','knockdown']){
  const f=fixture();addClip(f,`life.mounted.${action}`,{seatAnchor:[.02,.9,.03],markers:{ground:1.2},seatWeight:[{time:0,weight:1},{time:1.2,weight:0},{time:2,weight:0}]});addClip(f,'prone.idle.unarmed',{loop:true});
  const runtime=new ActorRuntime(f.asset,visual(f,{mounted:false,posture:action==='knockdown'?'prone':'standing',action,idleAction:'aim',cue:{id:'fall',action,fromPosture:'mounted',startedAt:0,durationMs:1000}}));
  const horse=runtime.root.getObjectByName('A_horse_scene');runtime.tick(0,0);closeVector(runtime.model.position,[.08,.7,-.13]);
  runtime.tick(0,300);closeVector(runtime.model.position,[.04,.35,-.065]);runtime.tick(0,600);closeVector(runtime.model.position,[0,0,0]);assert.ok(horse.visible);
  runtime.tick(0,1001);assert.equal(horse.visible,false);closeVector(runtime.model.position,[0,0,0]);runtime.dispose();
 }
});
