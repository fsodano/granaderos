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

test('contact support uses only disclosed passable floors at the actor height',()=>{
 const state=field(),contact=presentedActBattle(state,{type:'melee',unitId:'attacker',targetId:'target'}).frames.find(frame=>frame.type==='contact'),known=structuredClone(contact.state);
 const alter=(x,y,change)=>Object.assign(known.tiles.find(tile=>tile.x===x&&tile.y===y),change);
 alter(1,1,{type:'wall',blocked:true});alter(2,1,{type:'window',blocked:false});alter(3,1,{type:'door',blocked:false,open:false});
 alter(1,2,{elevation:.5});alter(1,3,{roomId:'unreadable-room'});
 known.props=[{id:'known-table',x:2,y:3,blocksMovement:true},{id:'private-table',x:3,y:3,roomId:'unreadable-room',blocksMovement:true}];
 const before=structuredClone(known),revealed=new Set(),entries=admittedActors(known,known.units.filter(unit=>unit.side==='player'),revealed);
 const support=attacker(presentActors(known,entries,{},revealed,{frame:{...contact,state:known,sequenceId:'paid',actionId:1,startedAt:100,durationMs:650}})).cue.contactSupport;
 assert.deepEqual(support.floors.map(floor=>[(floor.minX+floor.maxX)/2/TILE_METRES,(floor.minZ+floor.maxZ)/2/TILE_METRES]),[[2,2],[3,2],[3,3]]);
 assert.ok(support.floors.every(floor=>floor.height===0));assert.deepEqual(known,before);
});


test('only an admitted active climber removes the open hatch from visible melee footing',()=>{
 const state=field({tacticalLevel:1}),a=state.units.find(unit=>unit.id==='attacker');a.tacticalLevel=1;
 state.upperSurfaces=Array.from({length:9},(_,i)=>({x:1+i%3,y:1+Math.floor(i/3),type:'floor',tacticalLevel:1,elevation:3,blocked:false}));
 state.climbLinks=[{id:'visible-hatch',kind:'climb',from:{x:2,y:2},to:{x:2,y:2,tacticalLevel:1}}];
 state.units.push({...a,id:'climber',name:'Escaladora',x:2,y:2,tacticalLevel:0,weapon:0,activeSlot:'unarmed'});
 const frame=presentedActBattle(state,{type:'melee',unitId:'attacker',targetId:'target'}).frames.find(frame=>frame.type==='contact');assert.ok(frame);
 const players=frame.state.units.filter(unit=>unit.side==='player'),revealed=new Set(visibleRooms(frame.state)),entries=admittedActors(frame.state,players,revealed);
 const motion={x:2,y:2,renderedHeight:1.5,tacticalLevel:0,direction:5,frame:1,moving:true,kind:'climb',linkId:'visible-hatch',climbDirection:1};
 const support=(list,motions)=>attacker(render(frame,motions,list)).cue.contactSupport.floors;
 const closed=support(entries,{}),open=support(entries,{'unit:climber':motion}),area=floors=>floors.reduce((sum,floor)=>sum+(floor.maxX-floor.minX)*(floor.maxZ-floor.minZ),0);
 assert.ok(Math.abs(area(closed)-area(open)-1.14*.88)<1e-8,'the complete visible aperture cannot support a step');
 assert.deepEqual(support(entries.filter(entry=>entry.key!=='unit:climber'),{'unit:climber':motion}),closed,'a private motion alone cannot open visible footing');
 assert.deepEqual(support(entries,{'unit:climber':{...motion,moving:false}}),closed,'an idle ladder retains a closed walking cover');
 assert.deepEqual(support(entries,{'unit:climber':{...motion,linkId:'other'}}),closed,'an unrelated link cannot change this floor');
});
