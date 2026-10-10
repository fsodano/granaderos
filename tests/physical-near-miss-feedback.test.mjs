import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,presentedActBattle,presentedEndTurn,teamCanSee} from '../game/tactical.js';
import {getFirearmNearMissFeedback} from '../game/firearm-near-miss-feedback.js';
import {contextualBanter} from '../game/tactical-feedback.js';
import {battleFrameDuration,battleFrameFocus} from '../game/battle-playback.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {compileWeaponDefinition} from '../game/weapon-definition.js';
import {defaultContentPackage} from '../game/content-package.js';
import {isInteriorVisible} from '../game/tactical-visibility.js';
const tiles=(width,height)=>Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0}));
const speech={contact:'Contacto nuevo.',near:'Esa bala pasó cerca.',wounded:'Estoy herido.',interrupt:'Ahora puedo actuar.'};
const actor=(state,id='p')=>state.units.find(unit=>unit.id===id);
const saved=state=>validateBattleSnapshot(JSON.parse(JSON.stringify(state)));
const nearFrames=shown=>shown.frames.filter(frame=>frame.nearMissIds);
const publicFrame=frame=>({type:frame.type,action:frame.action,unitId:frame.unitId,visibleIds:frame.visibleIds,impacts:frame.impacts,shotVisual:frame.shotVisual,targetPoint:frame.targetPoint,nearMissIds:frame.nearMissIds,duration:battleFrameDuration(frame),focus:battleFrameFocus(frame)});

// Declared finite geometry fixtures, not stock campaign victories. Their AP,
// weather and firearm state are fixed before the first snapshot admission.
function hostile(player={},enemy={},extra={}){
 const state=createBattle([{id:'p',name:'Defensor',x:7,y:3,facing:6,weapon:1800,loaded:0,agility:34,storyProfile:{speech},...player}],{width:20,height:8,seed:3,tiles:tiles(20,8),enemies:[{id:'e',name:'Tirador',x:1,y:3,facing:2,weapon:1800,marksmanship:42,loaded:1,ammo:0,condition:100,patrol:false,overwatch:false,...enemy}],...extra});
 actor(state).ap=0;actor(state,'e').ap=12;return saved(state);
}
function fired(state,action){
 const before=structuredClone(state),ordinary=action?actBattle(state,action):endTurn(state),shown=action?presentedActBattle(state,action):presentedEndTurn(state);
 assert.equal(ordinary.lastError,null,ordinary.lastError);assert.deepEqual(shown.state,ordinary);assert.deepEqual(state,before);
 assert.deepEqual(action?actBattle(saved(state),action):endTurn(saved(state)),ordinary);assert.deepEqual(saved(ordinary),ordinary);
 return {ordinary,shown};
}

test('real hostile near passage has transient own-player evidence without learning eligibility or duplicate speech',()=>{
 const state=hostile(),{ordinary,shown}=fired(state),frames=nearFrames(shown);
 assert.equal(actor(ordinary).hp,100);assert.equal(actor(ordinary).agility,34);assert.equal(actor(ordinary,'e').loaded,0);assert.equal(actor(ordinary,'e').ap,0);assert.equal(ordinary.elapsedSeconds,6);
 assert.deepEqual(getFirearmNearMissFeedback(state,ordinary),['p']);assert.equal(contextualBanter(state,ordinary,3).text,speech.near);assert.equal(contextualBanter(state,ordinary,6),null);
 assert.equal(frames.length,1);const frame=frames[0];assert.deepEqual(frame.nearMissIds,['p']);assert.equal(frame.unitId,null);assert.equal(frame.shotVisual,undefined);assert.deepEqual(frame.impacts,[]);assert.equal(battleFrameDuration(frame),0);assert.equal(battleFrameFocus(frame),null);
 assert.equal(contextualBanter(state,frame.state,3,frame).text,speech.near);assert.equal(contextualBanter(state,frame.state,6,frame),null);assert.equal(contextualBanter(state,shown.state,9),null,'the final commit cannot repeat a presented passage');
 assert.deepEqual(getFirearmNearMissFeedback(state,saved(ordinary)),[]);assert.equal(contextualBanter(state,saved(ordinary),3),null);assert.ok(!JSON.stringify(ordinary).includes('nearMissIds'));
 const copy=getFirearmNearMissFeedback(state,ordinary);copy.push('e');assert.deepEqual(getFirearmNearMissFeedback(state,ordinary),['p']);
 const worker=structuredClone(presentedEndTurn(state)),transport=nearFrames(worker)[0];assert.equal(contextualBanter(state,transport.state,3,transport).text,speech.near,'worker cloning transports only the admitted IDs');assert.equal(contextualBanter(transport.state,transport.state,6,transport),null);
});

test('hits, early physical stops, misfires and rejected or cancelled orders cannot create near feedback',()=>{
 const hit=hostile({}, {marksmanship:100}),wounded=fired(hit);assert.ok(actor(wounded.ordinary).hp<100);assert.deepEqual(getFirearmNearMissFeedback(hit,wounded.ordinary),[]);assert.deepEqual(nearFrames(wounded.shown),[]);
 const stopped=hostile();stopped.wallEdges.push({id:'early-stop',x:5,y:4,axis:'x',projectileResistance:1000,type:'wall',material:'stone',blocked:true,blocksSight:false});const stop=fired(stopped);assert.equal(actor(stop.ordinary).hp,100);assert.equal(actor(stop.ordinary,'e').loaded,0);assert.deepEqual(getFirearmNearMissFeedback(stopped,stop.ordinary),[]);assert.deepEqual(nearFrames(stop.shown),[]);
 const wet=hostile({}, {},{weather:{rain:100,humidity:100}}),misfire=fired(wet);assert.equal(actor(misfire.ordinary,'e').jammed,true);assert.equal(actor(misfire.ordinary,'e').loaded,1);assert.deepEqual(getFirearmNearMissFeedback(wet,misfire.ordinary),[]);assert.deepEqual(nearFrames(misfire.shown),[]);
 for(const action of [{type:'fire',unitId:'p',targetId:'e'},{type:'firePoint',unitId:'p',x:99,y:3},{type:'fire',unitId:'e',targetId:'p'}]){
  const state=hostile(),shown=presentedActBattle(state,action);assert.ok(shown.state.lastError);assert.deepEqual(nearFrames(shown),[]);assert.deepEqual(getFirearmNearMissFeedback(state,shown.state),[]);assert.equal(actor(shown.state,'e').loaded,1);assert.equal(shown.state.seed,state.seed);
 }
 const cancelled=hostile();cancelled.status='retreat';const result=presentedEndTurn(cancelled);assert.deepEqual(nearFrames(result),[]);assert.deepEqual(getFirearmNearMissFeedback(cancelled,result.state),[]);assert.equal(actor(result.state,'e').loaded,1);
});

test('unseen hostile passage can be perceived without attacker, terminal, camera or added playback delay',()=>{
 const state=hostile({facing:2});assert.equal(teamCanSee(state,'player',actor(state,'e')),false);
 const {shown}=fired(state);assert.equal(shown.frames.length,1);const frame=shown.frames[0];assert.deepEqual(frame.nearMissIds,['p']);assert.equal(frame.unitId,null);assert.equal(frame.shotVisual,undefined);assert.equal(frame.targetPoint,undefined);assert.equal(battleFrameFocus(frame),null);assert.equal(battleFrameDuration(frame),0);
 assert.equal(JSON.stringify(publicFrame(frame)).includes('Tirador'),false);assert.equal(contextualBanter(state,frame.state,3,frame).text,speech.near);
});

function friendly(mode='point',extra={}){
 const weapon=mode==='pair'||mode==='reflection'?1805:mode==='pellet'?1807:1800,position=mode==='reflection'?{x:11,y:3}:{x:9,y:4};
 const state=createBattle([{id:'p',name:'Tirador',x:1,y:3,facing:2,weapon,loaded:1,ammo:2,condition:100,marksmanship:100,...(mode==='pair'?{offHand:{weapon:1808,count:1,loaded:1,condition:100,weight:1.3}}:{})},{id:'ally',name:'Compañero',...position,weapon:1800,loaded:0,storyProfile:{speech}}],{width:32,height:16,seed:8,weather:{rain:0,humidity:0},tiles:tiles(32,16),enemies:[{id:'e',x:28,y:14,patrol:false,overwatch:false}],...extra});
 if(mode==='reflection')state.wallEdges.push({id:'reflection-face',x:7,y:5,axis:'x',type:'wall',material:'stone',blocked:true,blocksSight:true});
 return saved(state);
}
const point={type:'firePoint',unitId:'p',x:10,y:5,aim:4};
test('point, paired, pellet and reflected real friendly fire use their resolved finite paths and exclude the muzzle owner',()=>{
 for(const mode of ['point','pair','pellet','reflection']){
  const state=friendly(mode),{ordinary,shown}=fired(state,point);
  assert.equal(actor(ordinary,'ally').hp,100,mode);assert.deepEqual(getFirearmNearMissFeedback(state,ordinary),['ally'],mode);assert.deepEqual(nearFrames(shown).flatMap(frame=>frame.nearMissIds),['ally'],mode);
  assert.equal(actor(ordinary).loaded,0);assert.ok(actor(ordinary).ap<actor(state).ap);assert.equal(actor(ordinary).condition,99);assert.equal(ordinary.elapsedSeconds,6);
  if(mode==='pair')assert.equal(actor(ordinary).offHand.loaded,0);
  if(mode==='reflection')assert.equal(shown.frames.filter(frame=>frame.type==='projectile').length,2);
  const projectile=shown.frames.findIndex(frame=>frame.type==='projectile'),near=shown.frames.findIndex(frame=>frame.nearMissIds);assert.ok(projectile>=0&&near>projectile,'receipt follows actual discharge/passage resolution');
 }
 const distant=friendly();actor(distant,'ally').y=7;const far=fired(distant,point);assert.equal(actor(far.ordinary,'ally').hp,100);assert.deepEqual(getFirearmNearMissFeedback(distant,far.ordinary),[]);
 const hit=friendly();actor(hit,'ally').y=5;const injury=fired(hit,point);assert.ok(actor(injury.ordinary,'ally').hp<100);assert.deepEqual(getFirearmNearMissFeedback(hit,injury.ordinary),[],'real contact cannot be called a near miss');
});

test('private tail material cannot change public passage feedback and a projected fallback cannot invent a physical passage',()=>{
 const kinetic=compileWeaponDefinition(defaultContentPackage().weapons.find(weapon=>weapon.template===1800));
 const make=props=>{const state=friendly('point',{props});actor(state).contentWeapon=kinetic;return saved(state);};
 const clear=make([]),baseline=fired(clear,point);
 const hidden=make([{id:'hidden-tail',type:'barrels',x:15,y:6,material:'stone',obstacleHeight:2,projectileResistance:100,blocksMovement:false,blocksSight:false,roomId:'private-room'}]);assert.equal(isInteriorVisible(hidden,hidden.props[0],new Set(hidden.revealedRooms)),false);
 const tail=fired(hidden,point);assert.deepEqual(getFirearmNearMissFeedback(hidden,tail.ordinary),['ally']);assert.deepEqual(tail.shown.frames.map(publicFrame),baseline.shown.frames.map(publicFrame));
 const stopped=make([{id:'hidden-stop',type:'barrels',x:5,y:4,material:'stone',obstacleHeight:2,projectileResistance:100,blocksMovement:false,blocksSight:false,roomId:'private-room'}]);assert.equal(isInteriorVisible(stopped,stopped.props[0],new Set(stopped.revealedRooms)),false);
 const stop=fired(stopped,point);assert.deepEqual(getFirearmNearMissFeedback(stopped,stop.ordinary),[]);assert.deepEqual(nearFrames(stop.shown),[]);assert.equal(actor(stop.ordinary,'ally').hp,100);
 assert.deepEqual(stop.shown.frames.filter(frame=>frame.type==='projectile').map(publicFrame),baseline.shown.frames.filter(frame=>frame.type==='projectile').map(publicFrame),'known projected flight remains private-neutral while perception uses only actual travel');
});

test('event sampling advances only for a real candidate and consumes sparse-silent passage frames',()=>{
 const state=hostile(),shown=presentedEndTurn(state);let count=0;const sequence=()=>count++;
 assert.equal(contextualBanter(state,state,sequence),null);assert.equal(count,0);
 const frame=nearFrames(shown)[0];assert.equal(contextualBanter(state,frame.state,sequence,frame).text,speech.near);assert.equal(count,1);
 assert.equal(contextualBanter(state,frame.state,sequence,frame),null);assert.equal(count,1);
 const next=nearFrames(presentedEndTurn(state))[0];assert.equal(contextualBanter(state,next.state,sequence,next),null);assert.equal(count,2);assert.equal(contextualBanter(state,next.state,sequence,next),null);assert.equal(count,2);
 assert.equal(contextualBanter(state,shown.state,sequence),null);assert.equal(count,2);
});
