import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createBattle,visibleRooms,canSee,presentedActBattle,actBattle} from '../game/tactical.js';
import {buildSectorMap} from '../game/maps.js';import {buildTerrace} from '../game/buildings.js';import {OPERATIVES} from '../game/data.js';import {propBlocksAt} from '../game/props.js';
import {relativeBodyHeight} from '../game/sight-geometry.js';
const {admittedActors,presentActors,presentWorld,actorItems,semanticOrder,observedActorTransitions}=await import('../web/lib/three/presentation.ts');
const {createSceneTerrainCache}=await import('../game/scene-terrain.js');
function floor(){return createBattle([{id:'one',x:2,y:2,skinTone:'dark',weapon:1800,blade:1810,activeSlot:'primary'}],{width:12,height:12,tiles:Array.from({length:144},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0})),enemies:[],exploration:true});}

test('actor renderer records preserve game state and the shared body-height contract',()=>{
 const state=floor(),players=state.units.filter(u=>u.side==='player'),revealed=new Set(visibleRooms(state)),before=structuredClone(state),entries=admittedActors(state,players,revealed);
 for(const stance of ['standing','crouched','prone'])for(const skin of ['light','brown','dark']){
  const copy={...state,units:state.units.map(unit=>({...unit,stance,skinTone:skin}))},actors=presentActors(copy,admittedActors(copy,copy.units,revealed),{},revealed);
  assert.equal(actors.length,1);assert.equal(actors[0].skin,skin);assert.equal(actors[0].posture,stance);
  for(const part of ['head','torso','legs','muzzle'])assert.equal(actors[0].bodyHeights[part],relativeBodyHeight(copy.units[0],part));
 }
 presentWorld(state,createSceneTerrainCache()(state),players,revealed,entries,0);assert.deepEqual(state,before);
});
test('real hand ownership supplies held, dropped and stowed equipment',()=>{
 const unit={weapon:1800,blade:1810,offHand:{weapon:1805},activeSlot:'primary'};
 assert.equal(actorItems(unit).find(item=>item.id==='1800').socket,'handRight');assert.ok(!actorItems(unit).some(item=>item.socket==='handLeft'));
 const pistol={...unit,activeSlot:'offhand',leftHandItem:'blade'};
 assert.equal(actorItems(pistol).find(item=>item.id==='1805').socket,'handRight');assert.equal(actorItems(pistol).find(item=>item.id==='1810').socket,'handLeft');assert.equal(actorItems(pistol).find(item=>item.id==='1800').socket,'back');
 assert.ok(!actorItems({...unit,weaponDropped:true}).some(item=>item.id==='1800'));
});
test('inventory identity remains separate from its rendered equipment kind',()=>{
 const records=[
  [{kind:'grenade',grenadeType:'arsenal',count:1},'grenade'],
  [{kind:'ammunition',ammoType:'ammoMusket',count:8},'ammunition'],
  [{itemType:'tool',toolKey:'crowbar',count:1},'crowbar'],
  [{kind:'outfit',outfit:'poncho',count:1},'item'],
  [{id:'letter-from-command',name:'Carta',count:1},'item'],
  [{weapon:1805,contentWeapon:{id:'authored-pistol',template:1805},count:1},'1805'],
 ];
 for(const [record,expected]of records){const unit={activeSlot:'item',activeItem:'inventory:custom-key',inventory:{'custom-key':record}};assert.equal(actorItems(unit)[0].id,expected);assert.equal(actorItems(unit)[0].reference,'inventory:custom-key');}
});
test('preserved-facing lateral movement selects anatomical left or right without rotating the unit',()=>{
 const state=floor(),actor=state.units[0],entry={key:'unit:one',kind:'unit',actor},before=structuredClone(actor);
 for(const [travelX,expected]of [[1,'strafeLeft'],[-1,'strafeRight']]){
  const rendered=presentActors(state,[entry],{'unit:one':{x:2.5,y:2,direction:5,moving:true,travelX,travelY:0}},new Set())[0];
  assert.equal(rendered.action,expected);assert.equal(rendered.yaw,0);
 }
 assert.deepEqual(actor,before);
});
test('hidden roof actors and dynamic objects never cross the renderer boundary',()=>{
 const map=buildSectorMap({sector:'tucuman',compactLayout:true,squad:[OPERATIVES[0]],enemies:[],exploration:true}),building=map.buildings[0];Object.assign(map,buildTerrace(building));
 const ground=map.tiles.find(tile=>tile.roomId===building.rooms[0].id&&!tile.blocked&&!propBlocksAt(map,tile.x,tile.y));Object.assign(map.squad[0],{id:'observer',x:ground.x,y:ground.y});
 const point={x:ground.x+1,y:ground.y,tacticalLevel:1};map.enemies=[{id:'secret',name:'Guardia oculto',...point,patrol:false}];
 const state=createBattle(map.squad,map);state.props.push({id:'roof-chest',type:'chest',...point});state.lights=[{id:'secret-light',...point,type:'torch',radius:3,intensity:1}];state.smoke=[{...point,radius:1}];
 const players=state.units.filter(unit=>unit.side==='player'),revealed=new Set(visibleRooms(state)),entries=admittedActors(state,players,revealed),world=presentWorld(state,createSceneTerrainCache()(state),players,revealed,entries,1);
 assert.equal(canSee(state,players[0],point),false);assert.ok(!entries.some(entry=>entry.actor.id==='secret'));assert.ok(!world.terrain.props.some(prop=>prop.id==='roof-chest'));assert.equal(world.terrain.lights.length,0);assert.equal(world.smoke.length,0);assert.equal('units'in world,false);assert.equal('npcs'in world,false);
 assert.ok(world.terrain.upperSurfaces.length>0,'known static building geometry remains without its occupants');
});
test('life state overrides an old attack cue and animation does not infer attacks from ammunition',()=>{
 const state=floor(),revealed=new Set(),actor=state.units[0],entry={key:'unit:one',kind:'unit',actor};
 const dead={...entry,actor:{...actor,hp:0}};assert.equal(presentActors(state,[dead],{},revealed,{cues:{'unit:one':{id:'old',action:'fire',startedAt:0}}})[0].action,'dead');
 const after={...entry,actor:{...actor,loaded:false,ammo:0}};assert.equal(presentActors(state,[after],{},revealed)[0].action,'idle');
 const hit={...entry,actor:{...actor,unconscious:true}};assert.equal(presentActors(state,[hit],{},revealed)[0].action,'unconscious');
});

test('confirmed melee uses the held usable bayonet, while loose, stowed and broken fittings cannot select it',()=>{
 const state=floor(),actor=state.units[0],fitting={weapon:1811,fittingPattern:'india_socket',instanceId:'fixed-bayonet',condition:72};
 const fixed={...actor,weapon:1800,activeSlot:'primary',weaponFittings:{bayonet:fitting}};
 for(const type of ['melee','meleePoint','charge'])assert.equal(semanticOrder(type,{},fixed),'bayonet');
 assert.equal(semanticOrder('bayonet',{},fixed),'bayonet','explicit authoritative semantic remains supported');
 for(const alternative of [{...fixed,activeSlot:'blade'},{...fixed,weaponDropped:true},{...fixed,weaponFittings:{bayonet:{...fitting,condition:0}}},{...fixed,weaponFittings:{}},{...fixed,weapon:1801}])assert.equal(semanticOrder('melee',{},alternative),'strike');
 const frame={unitId:actor.id,action:'melee',type:'contact',sequenceId:'paid-contact',actionId:1,startedAt:100,durationMs:650};
 const entry={key:'unit:one',kind:'unit',actor:fixed};
 const rendered=presentActors(state,[entry],{},new Set(),{frame})[0];assert.equal(rendered.action,'bayonet');assert.equal(rendered.cue.action,'bayonet');assert.equal(rendered.equipment,'long-gun');
 assert.equal(presentActors(state,[{...entry,actor}],{},new Set(),{frame})[0].action,'strike');
 assert.equal(presentActors(state,[entry],{},new Set(),{frame:{...frame,performed:false}})[0].action,'idle');
});

test('visible HP transitions admit nonfatal hit reactions with life state priority',()=>{
 const entry=(kind,actor)=>({key:`${kind}:${actor.id}`,kind,actor});
 const old={id:'one',hp:80,stance:'standing',mounted:false,unconscious:false};
 const before=[entry('unit',old)];
 assert.deepEqual(observedActorTransitions(before,[entry('unit',{...old,hp:72})]),[{key:'unit:one',action:'hit',extra:{fromPosture:'standing'}}]);
 assert.equal(observedActorTransitions(before,[entry('unit',{...old,hp:0})])[0].action,'die');
 assert.equal(observedActorTransitions(before,[entry('unit',{...old,hp:20,unconscious:true})])[0].action,'collapse');
 assert.equal(observedActorTransitions([entry('unit',{...old,unconscious:true})],[entry('unit',{...old,hp:70})])[0].action,'recover');
 assert.equal(observedActorTransitions(before,[entry('unit',{...old,hp:70,knockedDown:true,stance:'prone'})])[0].action,'knockdown');
 assert.deepEqual(observedActorTransitions(before,[entry('unit',{...old,loaded:0,ammo:0,ap:0})]),[],'ammunition and action points are not evidence of attacks');
 assert.deepEqual(observedActorTransitions(before,[entry('unit',{...old,hp:90})]),[]);
 assert.deepEqual(observedActorTransitions([],before),[],'first admission does not infer an earlier injury');
 assert.deepEqual(observedActorTransitions(before,[]),[]);
 assert.deepEqual(observedActorTransitions(before,[entry('npc',{...old,hp:50})]),[],'unit and NPC identity namespaces stay distinct');
 assert.deepEqual(observedActorTransitions([entry('npc',old)],[entry('npc',{...old,hp:72})])[0].key,'npc:one');
});

test('only admitted nonfatal frame impacts select hit reactions and movement does not erase them',()=>{
 const state=floor(),actor=state.units[0],entry={key:'unit:one',kind:'unit',actor};
 const frame={sequenceId:'visible-damage',index:2,unitId:'other',action:'fire',type:'impact',startedAt:100,durationMs:900,impacts:[{unitId:'one',damage:8,fatal:false}]};
 const motion={'unit:one':{x:2.2,y:2,direction:5,moving:true,travelX:0,travelY:1}};
 const rendered=presentActors(state,[entry],motion,new Set(),{frame})[0];assert.equal(rendered.action,'hit');assert.equal(rendered.cue.id,'visible-damage:2:impact:unit:one');assert.equal(rendered.cue.durationMs,900);
 for(const impact of [{unitId:'hidden',damage:8},{unitId:'one',victimKind:'npc',damage:8},{unitId:'one',damage:0},{unitId:'one',damage:NaN},{unitId:'one',damage:8,fatal:true}])assert.equal(presentActors(state,[entry],{},new Set(),{frame:{...frame,impacts:[impact]}})[0].action,'idle');
 assert.deepEqual(presentActors(state,[],{},new Set(),{frame}),[]);
 const npc={...entry,key:'npc:one',kind:'npc'};assert.equal(presentActors(state,[npc],{},new Set(),{frame:{...frame,impacts:[{unitId:'one',victimKind:'npc',damage:8}]}})[0].action,'hit');
 for(const [changes,action]of [[{hp:0},'dead'],[{unconscious:true},'unconscious'],[{knockedDown:true,stance:'prone'},'idle']])assert.equal(presentActors(state,[{...entry,actor:{...actor,...changes}}],{},new Set(),{frame})[0].action,action);
});

test('life transition cues survive attack frames and admitted damage cues',()=>{
 const state=floor(),actor=state.units[0],entry={key:'unit:one',kind:'unit',actor};
 const frame={unitId:'one',action:'fire',type:'impact',sequenceId:'attack',index:1,impacts:[{unitId:'one',damage:10}],startedAt:0,durationMs:400};
 for(const [changes,action]of [[{hp:0},'die'],[{hp:30,unconscious:true},'collapse'],[{hp:40},'recover']]){
  const cue={id:'life-cue',action,startedAt:0,fromPosture:'mounted'};
  const rendered=presentActors(state,[{...entry,actor:{...actor,...changes}}],{},new Set(),{frame,cues:{'unit:one':cue}})[0];assert.equal(rendered.action,action);assert.equal(rendered.cue.id,'life-cue');
 }
});

test('the HP observer and admitted frame share one hit ID, clear once, and forget hidden actors',async()=>{
 const [{JSDOM},React,{createRoot},{useActorCues}]=await Promise.all([
  import('../web/node_modules/jsdom/lib/api.js'),import('../web/node_modules/react/index.js'),
  import('../web/node_modules/react-dom/client.js'),import('../web/lib/three/useActorCues.ts'),
 ]);
 const dom=new JSDOM('<div id="test-root"></div>'),saved=new Map(['window','document','IS_REACT_ACT_ENVIRONMENT'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 Object.defineProperty(globalThis,'window',{value:dom.window,configurable:true});Object.defineProperty(globalThis,'document',{value:dom.window.document,configurable:true});Object.defineProperty(globalThis,'IS_REACT_ACT_ENVIRONMENT',{value:true,configurable:true});
 const root=createRoot(dom.window.document.getElementById('test-root'));let hook;
 function Probe({entries,frame}){hook=useActorCues('sector-test',entries,frame);return null;}
 const render=async(entries,frame)=>React.act(async()=>{root.render(React.createElement(Probe,{entries,frame}));});
 const actor={id:'one',hp:80,mounted:false,stance:'standing'},entry={key:'unit:one',kind:'unit',actor};
 try{
  await render([entry]);assert.deepEqual(hook.cues,{});
  // Caller mutation must not alter the observer's prior HP snapshot.
  actor.hp=72;
  const frame={sequenceId:'sequence',index:4,type:'impact',startedAt:100,durationMs:900,impacts:[{unitId:'one',damage:8}]};
  await render([entry],frame);const cue=hook.cues['unit:one'];assert.equal(cue.id,'sequence:4:impact:unit:one');assert.equal(cue.action,'hit');
  await React.act(async()=>hook.complete('unit:one',cue.id));assert.deepEqual(hook.cues,{});
  await render([entry],{...frame,index:5,impacts:[]});assert.deepEqual(hook.cues,{},'the next phase cannot replay a completed HP reaction');
  await render([]);actor.hp=60;await render([entry]);assert.deepEqual(hook.cues,{},'reappearance cannot reveal when hidden damage occurred');
  actor.weapon=1800;actor.activeSlot='primary';actor.weaponFittings={bayonet:{weapon:1811,fittingPattern:'india_socket',instanceId:'held',condition:50}};
  await React.act(async()=>hook.accepted('one','melee'));assert.equal(hook.cues['unit:one'].action,'bayonet');
 }finally{
  await React.act(async()=>root.unmount());dom.window.close();
  for(const [key,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];
 }
});

test('actual paired playback binds each admitted discharge to its real held hand with distinct cue IDs',()=>{
 const state=createBattle([{id:'p',x:2,y:2,facing:2,weapon:1805,loaded:1,ammo:8,condition:81,marksmanship:100,weaponInstanceId:'first',offHand:{count:1,weapon:1808,weight:1.3,loaded:2,condition:100,jammed:false,instanceId:'second'}}],{width:20,height:8,seed:127,tiles:Array.from({length:160},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',cover:0,blocked:false})),enemies:[{id:'e',x:5,y:2,patrol:false,overwatch:false},{id:'reserve',x:18,y:6,patrol:false,overwatch:false}]});
 for(const unit of state.units.filter(unit=>unit.side==='enemy'))unit.ap=0;
 const order={type:'fire',unitId:'p',targetId:'e',aim:4,hitLocation:'legs'},before=structuredClone(state),result=presentedActBattle(state,order);
 assert.deepEqual(result.state,actBattle(state,order));assert.deepEqual(state,before);
 const shots=result.frames.filter(frame=>frame.type==='projectile'&&frame.shotVisual?.discharge!==false);assert.equal(shots.length,2);
 const cues=shots.map((record,index)=>{
  const frame={...record,index,sequenceId:'paired-sequence',actionId:1,startedAt:1000+index*1000,durationMs:400};
  const actor=frame.state.units.find(unit=>unit.id==='p'),entry={key:'unit:p',kind:'unit',actor};
  const rendered=presentActors(frame.state,[entry],{},new Set(),{frame})[0];assert.equal(rendered.action,'fire');
  assert.equal(rendered.cue.shotHand,index?'offhand':'primary');assert.equal(rendered.cue.hand,index?'handLeft':'handRight');
  assert.equal(rendered.items.find(item=>item.reference===rendered.cue.shotHand).socket,rendered.cue.hand);
  const continuation={...frame,index:index+10,shotVisual:{...frame.shotVisual,discharge:false}};
  assert.notEqual(presentActors(frame.state,[entry],{},new Set(),{frame:continuation})[0].action,'fire','a continued trajectory cannot trigger another discharge');
  return rendered.cue;
 });
 assert.notEqual(cues[0].id,cues[1].id,'the second actual discharge has its own recoil clock');
});

test('knockdown preserves the pre-impact posture then rests on the ground without replaying the fall',()=>{
 const state=floor(),actor=state.units[0];
 for(const mounted of [false,true]){
  const before={key:'unit:one',kind:'unit',actor:{...actor,mounted,stance:'standing'}},after={...before,actor:{...actor,hp:50,mounted:false,stance:'prone',knockedDown:true}};
  const change=observedActorTransitions([before],[after])[0];assert.equal(change.action,'knockdown');assert.equal(change.extra.fromPosture,mounted?'mounted':'standing');
  const cue={id:'fall',action:change.action,startedAt:100,...change.extra};
  const falling=presentActors(state,[after],{},new Set(),{cues:{'unit:one':cue}})[0];assert.equal(falling.action,'knockdown');assert.equal(falling.cue.fromPosture,mounted?'mounted':'standing');assert.equal(falling.posture,'prone');
  const resting=presentActors(state,[after],{},new Set())[0];assert.equal(resting.action,'idle');assert.equal(resting.posture,'prone');assert.equal(resting.cue,undefined);
  assert.deepEqual(observedActorTransitions([after],[{...after,actor:{...after.actor,hp:40}}]),[],'later damage cannot replay an already completed fall');
 }
});

test('hidden ground smoke, active lights and live cannons stay behind the same sight boundary as actors',()=>{
 const state=createBattle([{id:'observer',x:1,y:1,facing:2}],{width:30,height:24,night:true,tiles:Array.from({length:720},(_,i)=>({x:i%30,y:Math.floor(i/30),type:'grass',cover:0,blocked:false})),enemies:[{id:'hidden',x:21,y:17,patrol:false}]});
 const near={x:2,y:1,tacticalLevel:0},far={x:21,y:17,tacticalLevel:0};
 state.smoke=[{...near,radius:1,turns:3},{...far,radius:1,turns:3}];
 state.lights=[{...near,id:'known-light',type:'torch',radius:2,intensity:1},{...far,id:'hidden-light',type:'campfire',radius:2,intensity:1}];
 state.artillery=[{...near,id:'known-gun',type:'bronze4',loaded:true},{...far,id:'hidden-gun',type:'field8',loaded:false}];
 state.props.push({...far,id:'known-static-barrel',type:'barrel'});
 const players=state.units.filter(unit=>unit.side==='player'),revealed=new Set(),before=structuredClone(state);
 assert.ok(canSee(state,players[0],near));assert.equal(canSee(state,players[0],far),false);
 const entries=admittedActors(state,players,revealed);assert.deepEqual(entries.map(entry=>entry.actor.id),['observer']);
 const world=presentWorld(state,createSceneTerrainCache()(state),players,revealed,entries,0);
 assert.equal(world.smoke.length,1);assert.equal(world.smoke[0].x,near.x);assert.deepEqual(world.terrain.lights.map(light=>light.id),['known-light']);assert.deepEqual(world.cannons.map(gun=>gun.id),['known-gun']);
 assert.ok(world.terrain.props.some(prop=>prop.id==='known-static-barrel'),'known static geometry is retained');
 assert.equal(world.illumination.get('0:21,17'),.08,'unseen active lighting cannot leak through terrain tint');assert.deepEqual(state,before);
});

test('recorded bayonet style survives fitting breakage and admitted artillery crews receive distinct cues',()=>{
 const state=floor(),actor=state.units[0],fixed={...actor,weaponFittings:{bayonet:{weapon:1811,fittingPattern:'india_socket',instanceId:'worn-out',condition:0}}};
 const frame={unitId:'one',action:'melee',meleeStyle:'bayonet',type:'impact',sequenceId:'melee',actionId:1,startedAt:100,durationMs:300};
 assert.equal(presentActors(state,[{key:'unit:one',kind:'unit',actor:fixed}],{},new Set(),{frame})[0].action,'bayonet');
 const entries=[{key:'unit:one',kind:'unit',actor},{key:'unit:helper',kind:'unit',actor:{...actor,id:'helper',x:3}},{key:'unit:bystander',kind:'unit',actor:{...actor,id:'bystander',x:4}}];
 for(const [action,expected]of [['artillery','artilleryFire'],['artilleryReload','artilleryReload'],['artilleryMove','artilleryMove'],['artilleryPivot','artilleryPivot']]){
  const current={...frame,action,type:'result',crewIds:['one','helper','hidden-helper']};delete current.meleeStyle;
  const rendered=presentActors(state,entries,{},new Set(),{frame:current});assert.deepEqual(rendered.map(actor=>actor.action),[expected,expected,'idle']);assert.notEqual(rendered[0].cue.id,rendered[1].cue.id);assert.equal(rendered.length,3,'crew metadata cannot admit an unseen actor');
 }
 const firearm={...frame,action:'fire',type:'projectile',crewIds:['one','helper']};delete firearm.meleeStyle;
 assert.deepEqual(presentActors(state,entries,{},new Set(),{frame:firearm}).map(actor=>actor.action),['fire','idle','idle'],'crew records cannot turn a bystander into a firearm shooter');
});
