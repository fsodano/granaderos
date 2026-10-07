import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createBattle,presentedActBattle,actBattle,visibleRooms} from '../game/tactical.js';
const {admittedActors,presentActors}=await import('../web/lib/three/presentation.ts');
const {TILE_METRES,actorYaw}=await import('../web/lib/three/projection.ts');

function field(target={},sector={}){
 return createBattle([{id:'attacker',x:2,y:2,weapon:1809,activeSlot:'primary',facing:2,strength:100,dexterity:100,agility:100,wisdom:100,experienceLevel:10}],{width:18,height:12,tiles:Array.from({length:216},(_,i)=>({x:i%18,y:Math.floor(i/18),type:'grass',blocked:false,cover:0})),seed:45,enemies:[{id:'target',x:3,y:2,weapon:0,activeSlot:'unarmed',patrol:false,overwatch:false,ap:0,...target},{id:'reserve',x:16,y:10,patrol:false}],...sector});
}
function render(frame,positions={},entries){
 const state=frame.state,players=state.units.filter(unit=>unit.side==='player'),revealed=new Set(visibleRooms(state));
 return presentActors(state,entries??admittedActors(state,players,revealed),positions,revealed,{frame:{...frame,sequenceId:'paid',actionId:1,startedAt:100,durationMs:650}});
}
const attacker=actors=>actors.find(actor=>actor.key==='unit:attacker');

for(const [name,target]of [['cardinal',{}],['diagonal',{y:3,stance:'crouched',movementMode:'crouch'}]])test(`${name} paid melee retains the actual admitted target pose without changing its outcome`,()=>{
 const state=field(target),before=structuredClone(state),order={type:'melee',unitId:'attacker',targetId:'target'},presentation=presentedActBattle(state,order),contact=presentation.frames.find(frame=>frame.type==='contact');
 assert.ok(contact);assert.equal(contact.targetPoint.kind,'unit');
 const actors=render(contact),other=actors.find(actor=>actor.key==='unit:target'),cue=attacker(actors).cue;
 assert.deepEqual(cue.contactTarget,{key:other.key,appearance:other.appearance,position:other.position,yaw:other.yaw,posture:other.posture,mounted:other.mounted,action:other.action,bodyHeights:other.bodyHeights});
 assert.notEqual(cue.contactTarget.position,other.position,'contact records do not share a mutable position');
 assert.deepEqual(presentation.state,actBattle(state,order));assert.deepEqual(state,before);
 assert.ok(presentation.frames.filter(frame=>frame.type==='impact').every(frame=>!attacker(render(frame)).cue?.contactTarget),'future damage is not used to fit the attack');
});

test('typed civilian contact cannot substitute an admitted soldier with the same ID',()=>{
 const state=field({x:8},{npcs:[{id:'target',name:'Habitante',x:3,y:2,hp:100,appearance:'woman-scout'}]}),result=presentedActBattle(state,{type:'melee',unitId:'attacker',targetId:'target',targetKind:'npc'}),contact=result.frames.find(frame=>frame.type==='contact');
 assert.equal(contact.targetPoint.kind,'npc');
 const cue=attacker(render(contact)).cue;assert.equal(cue.contactTarget.key,'npc:target');assert.deepEqual(cue.contactTarget.position,[3*TILE_METRES,0,2*TILE_METRES]);
 assert.equal(result.state.units.find(unit=>unit.id==='target').hp,100);
});

test('contact cannot disclose a hidden, missing, stale, self or untyped body',()=>{
 const state=field(),contact=presentedActBattle(state,{type:'melee',unitId:'attacker',targetId:'target'}).frames.find(frame=>frame.type==='contact'),actors=render(contact);
 const admitted=actors.map(visual=>({key:visual.key,kind:visual.kind,actor:contact.state.units.find(unit=>unit.id===visual.id)}));
 for(const point of [undefined,{...contact.targetPoint,kind:undefined},{...contact.targetPoint,kind:'other'},{...contact.targetPoint,id:'missing'},{...contact.targetPoint,x:4},{...contact.targetPoint,tacticalLevel:1},{kind:'unit',id:'attacker',x:2,y:2},{...contact.targetPoint,x:NaN}])assert.equal(attacker(render({...contact,targetPoint:point})).cue.contactTarget,undefined);
 assert.equal(attacker(render(contact,{},admitted.filter(entry=>entry.key!=='unit:target'))).cue.contactTarget,undefined,'the raw frame state cannot admit a target');
 assert.equal(attacker(render(contact,{},[...admitted,admitted.find(entry=>entry.key==='unit:target')])).cue.contactTarget,undefined,'ambiguous body records cannot fit contact');
 assert.equal(attacker(render({...contact,performed:false})).cue,undefined);
 const pointSwing=presentedActBattle(state,{type:'meleePoint',unitId:'attacker',x:3,y:2}).frames.find(frame=>frame.type==='contact');assert.equal(attacker(render(pointSwing)).cue.contactTarget,undefined);
});

test('contact follows the visible target position and facing during playback',()=>{
 const state=field({facing:5}),contact=presentedActBattle(state,{type:'melee',unitId:'attacker',targetId:'target'}).frames.find(frame=>frame.type==='contact'),motion={x:3.1,y:2.2,direction:2,moving:true,travelX:0,travelY:1};
 const actors=render(contact,{'unit:target':motion}),target=actors.find(actor=>actor.key==='unit:target'),cue=attacker(actors).cue;
 assert.deepEqual(cue.contactTarget.position,target.position);assert.equal(cue.contactTarget.yaw,actorYaw(2));
 assert.deepEqual(cue.contactTarget.position,[3.1*TILE_METRES,0,2.2*TILE_METRES]);
});

test('a room that is not readable cannot supply contact even when its entry is supplied',()=>{
 const state=field(),contact=presentedActBattle(state,{type:'melee',unitId:'attacker',targetId:'target'}).frames.find(frame=>frame.type==='contact');
 const concealed={...contact.state,units:contact.state.units.map(unit=>unit.id==='target'?{...unit,roomId:'unreadable-room'}:unit)};
 const entries=concealed.units.filter(unit=>['attacker','target'].includes(unit.id)).map(actor=>({key:`unit:${actor.id}`,kind:'unit',actor}));
 const actors=presentActors(concealed,entries,{},new Set(),{frame:{...contact,sequenceId:'paid',actionId:1}});
 assert.deepEqual(actors.map(actor=>actor.id),['attacker']);assert.equal(attacker(actors).cue.contactTarget,undefined);
});
