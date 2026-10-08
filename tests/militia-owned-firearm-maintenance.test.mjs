import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,presentedEndTurn,presentedActBattle,firearmMaintenancePreview} from '../game/tactical.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {chooseOwnedFirearmRepair} from '../game/tactical-ai-repair.js';
import {automaticOrder} from '../game/autonomous-orders.js';
import {repairMaterialPoints} from '../game/repair-materials.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
const kit=(points=30,id='owned-kit')=>({kind:'repair-kit',name:'Herramientas',count:1,weight:2,repairPoints:points,instanceId:id});
const actor=s=>s.units.find(u=>u.id==='m');
const saved=s=>validateBattleSnapshot(JSON.parse(JSON.stringify(s)));
const repair={type:'repair',unitId:'m'};
const gear=u=>Object.fromEntries(['weapon','weaponInstanceId','loaded','ammo','reloadProgress','jammed','offHand','weaponMetadata','contentWeapon','ammunitionChoice','weaponFittings','weaponFittingPattern','x','y','stance','mounted'].map(k=>[k,u[k]]));
function quiet(patch={}){
 const s=createBattle([{id:'o',x:13,y:6,weapon:1813,ammo:0,medical:0,medkits:0,patrol:false},{id:'m',militia:true,x:10,y:4,weapon:1800,weaponInstanceId:'owned-gun',condition:0,loaded:1,ammo:0,medical:0,medkits:0,mechanical:60,inventory:{tools:kit()},patrol:false,...patch}],{width:16,height:8,seed:45,tiles:Array.from({length:128},(_,i)=>({x:i%16,y:Math.floor(i/16),type:i%16===8?'wall':'grass',blocked:i%16===8,blocksSight:i%16===8,cover:0})),enemies:[{id:'e',x:1,y:3,weapon:1813,ammo:0,patrol:false,overwatch:false}]});s.units[0].ap=0;actor(s).ap=patch.ap??41;return saved(s);
}
function reacting(interruptRepair=false){
 const width=16,height=interruptRepair?10:8;
 const squad=interruptRepair?[{id:'p',x:12,y:3,facing:6,hp:1000,maxHp:1000,agility:30,experienceLevel:1,weapon:1805,loaded:0,ammo:0,medical:0,medkits:0,patrol:false},{id:'m',militia:true,x:12,y:5,facing:2,hp:1000,maxHp:1000,weapon:1805,weaponInstanceId:'owned-gun',condition:0,loaded:1,ammo:0,marksmanship:100,medical:0,medkits:0,mechanical:60,agility:100,experienceLevel:10,inventory:{tools:kit()},patrol:false},{id:'o',x:12,y:7,facing:2,agility:100,experienceLevel:10,weapon:1805,loaded:1,ammo:0,medical:0,medkits:0,patrol:false}]:[{id:'o',hp:1000,maxHp:1000,x:6,y:5,facing:6,agility:100,experienceLevel:10,weapon:1805,loaded:1,ammo:0,medical:0,medkits:0,patrol:false},{id:'m',militia:true,x:6,y:3,facing:2,weapon:1805,weaponInstanceId:'owned-gun',condition:0,loaded:1,ammo:0,marksmanship:100,medical:0,medkits:0,mechanical:60,agility:60,experienceLevel:4,inventory:{tools:kit()},patrol:false}];
 const enemy=interruptRepair?{id:'e',x:6,y:3,facing:2,weapon:1805,loaded:1,ammo:0,hp:1000,maxHp:1000,agility:60,experienceLevel:4,marksmanship:100,patrol:false,overwatch:true}:{id:'e',x:12,y:3,facing:2,weapon:1805,loaded:1,ammo:0,hp:1000,maxHp:1000,agility:80,experienceLevel:6,marksmanship:100,patrol:false,overwatch:true};
 const s=createBattle(squad,{width,height,seed:45,tiles:Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0})),enemies:[enemy]});for(const u of s.units)u.ap=u.id==='m'?41:u.id==='e'?(interruptRepair?16:24):20;return saved(s);
}
function captureContexts(run,onMint=()=>{}){
 const original=WeakMap.prototype.set,contexts=[];
 WeakMap.prototype.set=function(context,entry){const result=original.call(this,context,entry);if(entry?.kind&&['allied','interrupt'].includes(entry.kind)&&entry.actor?.id==='m'&&entry.state){contexts.push({context,entry});onMint(context,entry);}return result;};
 try{return {value:run(),contexts};}finally{WeakMap.prototype.set=original;}
}

test('a real allied turn pays one finite owned repair and keeps the exact loaded primary',()=>{
 const s=quiet(),before=structuredClone(s),old=gear(actor(s)),r=presentedEndTurn(s);assert.deepEqual(r.state,endTurn(s));assert.deepEqual(r.state,endTurn(saved(s)));assert.deepEqual(s,before);assert.equal(r.state.lastError,null);assert.equal(actor(r.state).condition,30);assert.equal(repairMaterialPoints(actor(r.state)),0);assert.deepEqual(gear(actor(r.state)),old);assert.equal(r.state.turn,2);assert.equal(r.state.elapsedSeconds,6);assert.equal(actor(r.state).ap,116,'normal next-round budget includes the retained16AP');
 assert.deepEqual(r.frames.map(f=>[f.type,f.action,f.unitId]),[['prepare','repair','m'],['result','repair','m']]);assert.deepEqual(r.frames.map(f=>[actor(f.state).ap,actor(f.state).condition,repairMaterialPoints(actor(f.state)),f.state.alliedTurn.actionsTaken]),[[41,0,30,1],[16,30,0,1]]);assert.doesNotThrow(()=>saved(r.state));
});

test('default manual previews, forged contexts and public militia orders cannot grant control',()=>{
 const s=quiet(),before=structuredClone(s);for(const context of [undefined,{},true,{autonomous:true},{state:s,actor:actor(s)}]){const p=firearmMaintenancePreview(s,actor(s),context);assert.equal(p.valid,false);assert.match(p.reason,/milicia/);assert.equal(chooseOwnedFirearmRepair(s,actor(s),context),null);}
 assert.equal(chooseEnemyAction(s,actor(s)),null);assert.equal(automaticOrder(s,actor(s)),null);assert.deepEqual(s,before);
 for(const action of [repair,{...repair,autonomous:true},{...repair,maintenanceContext:{autonomous:true}},{type:'move',unitId:'m',x:11,y:4},{type:'weapon',unitId:'m',slot:'blade'}]){const n=actBattle(s,action);assert.match(n.lastError,/milicia/);assert.deepEqual(n.units,s.units);assert.equal(n.seed,s.seed);assert.equal(n.elapsedSeconds,s.elapsedSeconds);assert.equal(n.turn,s.turn);}
 const hired=quiet();actor(hired).militia=false;assert.equal(chooseOwnedFirearmRepair(hired,actor(hired)),null);assert.equal(chooseEnemyAction(hired,actor(hired)),null);
});

test('ordinary trait caps, minimum paid AP and partial owned kits bound the autonomous stroke',()=>{
 for(const [traits,pa,gain] of [[[],25,30],[['workshop_training'],25,40],[['gunsmith_artillerist'],18,45]]){const s=quiet({traits,ap:pa,inventory:{tools:kit(100)}}),r=presentedEndTurn(s),f=r.frames.find(f=>f.type==='result'&&f.action==='repair');assert.ok(f);assert.equal(actor(f.state).condition,gain);assert.equal(actor(f.state).ap,0);assert.deepEqual(actor(f.state).inventory.tools,{...actor(s).inventory.tools,repairPoints:100-gain});const n=endTurn(quiet({traits,ap:pa-1,inventory:{tools:kit(100)}}));assert.equal(actor(n).condition,0);assert.equal(repairMaterialPoints(actor(n)),100);}
 const s=quiet({inventory:{tools:kit(7,'last-seven')},leftHandItem:'inventory:tools'}),r=presentedEndTurn(s);assert.equal(actor(r.state).condition,7);assert.equal(repairMaterialPoints(actor(r.state)),0);assert.equal(actor(r.state).leftHandItem,null);assert.equal(actor(r.state).loaded,1);
});

test('reserve-first spending and paired saved loading records retain source identities',()=>{
 const s=quiet({weapon:1808,loaded:1,reloadProgress:.375,ap:25,offHand:{weapon:1805,count:1,weight:1,condition:0,loaded:0,reloadProgress:.25,instanceId:'broken-other'},toolkitPoints:5,inventory:{a:kit(13,'first'),b:kit(20,'second')},leftHandItem:'inventory:a'}),old=gear(actor(s)),r=presentedEndTurn(s),f=r.frames.find(f=>f.action==='repair'&&f.type==='result');assert.ok(f);assert.deepEqual(gear(actor(f.state)),old);assert.equal(actor(f.state).condition,30);assert.equal(actor(f.state).toolkitPoints,0);assert.equal(actor(f.state).inventory.a,undefined);assert.equal(actor(f.state).leftHandItem,null);assert.deepEqual(actor(f.state).inventory.b,{...actor(s).inventory.b,repairPoints:8});assert.deepEqual(r.state,endTurn(saved(s)));assert.doesNotThrow(()=>saved(r.state));
});

test('a real allied repair and paid shot pause in a nested reaction and saved continuation cannot repeat them',()=>{
 const b=reacting(),r=presentedEndTurn(b),paused=r.state;assert.equal(paused.phase,'interrupt');assert.ok(paused.alliedTurn);assert.ok(paused.reactionStack);assert.equal(paused.interrupt.returnTo,'reaction');assert.deepEqual(paused.interrupt.unitIds,['o']);assert.equal(paused.alliedTurn.actionsTaken,2);assert.equal(actor(paused).condition,29);assert.equal(actor(paused).loaded,0);assert.equal(repairMaterialPoints(actor(paused)),0);assert.equal(actor(paused).ap,0);assert.equal(paused.elapsedSeconds,6);assert.equal(r.frames.filter(f=>f.type==='result'&&f.action==='repair'&&f.unitId==='m').length,1);
 const copy=saved(paused),n=endTurn(copy);assert.deepEqual(n,endTurn(paused));assert.equal(actor(n).condition,29);assert.equal(actor(n).loaded,0);assert.equal(repairMaterialPoints(actor(n)),0);assert.equal(n.phase,'player');assert.equal(n.turn,2);assert.equal(n.elapsedSeconds,6);assert.equal(n.alliedTurn,undefined);assert.equal(n.reactionStack,undefined);assert.doesNotThrow(()=>saved(n));
 const denied=actBattle(copy,repair);assert.match(denied.lastError,/milicia/);assert.deepEqual(denied.units,copy.units);assert.deepEqual(denied.alliedTurn,copy.alliedTurn);assert.deepEqual(denied.reactionStack,copy.reactionStack);assert.equal(denied.elapsedSeconds,6);
});

test('an actually eligible militia interruption repairs once and preserves its paid work across the human window',()=>{
 const b=reacting(true),r=presentedEndTurn(b),paused=r.state;assert.equal(paused.phase,'interrupt');assert.ok(paused.enemyTurn);assert.ok(paused.interrupt.unitIds.includes('m'));assert.ok(paused.interrupt.unitIds.includes('o'));assert.equal(paused.alliedTurn,undefined);const pair=r.frames.filter(f=>f.action==='repair'&&f.unitId==='m');assert.deepEqual(pair.map(f=>[f.type,actor(f.state).ap,actor(f.state).condition,f.state.interrupt.militiaActions.m]),[['prepare',41,0,1],['result',16,30,1]]);assert.equal(actor(paused).condition,30);assert.equal(actor(paused).loaded,1);assert.equal(repairMaterialPoints(actor(paused)),0);
 const n=endTurn(saved(paused));assert.deepEqual(n,endTurn(paused));assert.equal(actor(n).condition,30);assert.equal(actor(n).loaded,1);assert.equal(repairMaterialPoints(actor(n)),0);assert.equal(n.elapsedSeconds,6);assert.equal(n.turn,2);assert.equal(n.phase,'player');assert.doesNotThrow(()=>saved(n));assert.equal(firearmMaintenancePreview(paused,actor(paused)).valid,false);
});

test('validated remaining allied action diagnostics admit selected count11 to12 and reject a thirteenth choice',()=>{
 // These validated recorder checkpoints test the count edge; they do not claim
 // that eleven earlier orders or a save inside stationary repair occurred.
 const frame=presentedEndTurn(quiet()).frames.find(f=>f.type==='prepare'&&f.action==='repair');
 for(const count of [11,12]){const s=structuredClone(frame.state);s.alliedTurn.actionsTaken=count;const b=saved(s),r=presentedEndTurn(b),repairs=r.frames.filter(f=>f.action==='repair');assert.equal(repairs.length,count===11?2:0);assert.equal(actor(r.state).condition,count===11?30:0);assert.equal(repairMaterialPoints(actor(r.state)),count===11?0:30);if(count===11){assert.deepEqual(repairs.map(f=>f.state.alliedTurn.actionsTaken),[12,12]);assert.equal(actor(repairs[1].state).ap,16);}assert.doesNotThrow(()=>saved(r.state));}
});

test('validated remaining interrupt diagnostics allow the selected twelfth repair and reject count12',()=>{
 const frame=presentedEndTurn(reacting(true)).frames.find(f=>f.type==='prepare'&&f.action==='repair'&&f.unitId==='m');
 for(const count of [11,12]){const s=structuredClone(frame.state);s.interrupt.militiaActions.m=count;const b=saved(s),r=presentedActBattle(b,{type:'look',unitId:'o',x:13,y:7}),pairs=r.frames.filter(f=>f.action==='repair'&&f.unitId==='m');assert.equal(r.state.lastError,null);assert.equal(pairs.length,count===11?2:0);assert.equal(actor(r.state).condition,count===11?30:0);if(count===11){assert.deepEqual(pairs.map(f=>f.state.interrupt.militiaActions.m),[12,12]);assert.equal(actor(pairs[1].state).ap,16);}assert.equal(repairMaterialPoints(actor(r.state)),count===11?0:30);assert.doesNotThrow(()=>saved(r.state));}
});

test('actual transient contexts reject future actor, stale identity and queue changes and expire after apply',()=>{
 const field=quiet();field.units.push({...structuredClone(actor(field)),id:'future',weaponInstanceId:'future-gun',inventory:{tools:kit(30,'future-kit')},x:11,y:5});const initial=saved(field);let admitted=0;const {value,contexts}=captureContexts(()=>endTurn(initial),(context,entry)=>{const s=entry.state,u=entry.actor;assert.equal(firearmMaintenancePreview(s,u,context).valid,true);admitted++;assert.equal(firearmMaintenancePreview(structuredClone(s),u,context).valid,false);assert.equal(firearmMaintenancePreview(s,{...u},context).valid,false);assert.equal(firearmMaintenancePreview(s,s.units.find(v=>v.id==='future'),context).valid,false);assert.equal(s.units.find(v=>v.id==='future').condition,0);
  const queue=s.alliedTurn;s.alliedTurn={...queue};assert.equal(firearmMaintenancePreview(s,u,context).valid,false);s.alliedTurn=queue;queue.actionsTaken+=2;assert.equal(firearmMaintenancePreview(s,u,context).valid,false);queue.actionsTaken-=2;
 });assert.equal(admitted,1);assert.equal(contexts.length,1);
 // Direct lifecycle diagnostics restore the old live fields only to show that
 // disposal, rather than spent stock alone, denies reuse. No state is executed.
 const accepted=saved(value),{context,entry}=contexts[0],s=entry.state,u=entry.actor;s.phase='player';s.roundTimeCharged=true;s.alliedTurn=entry.queue;s.alliedTurn.unitIndex=entry.index;s.alliedTurn.actionsTaken=entry.count;u.condition=0;u.inventory.tools=kit();assert.equal(firearmMaintenancePreview(s,u,context).valid,false);assert.equal(chooseOwnedFirearmRepair(s,u,context),null);assert.equal(firearmMaintenancePreview(saved(quiet()),actor(quiet()),context).valid,false);assert.equal(actor(accepted).condition,30,'accepted result was captured before direct lifecycle diagnostics');
});

test('unloaded, jammed, serviceable, dropped, legacy-only and missing owned materials do not enter the new policy',()=>{
 for(const patch of [{loaded:0},{jammed:true},{condition:1},{condition:100},{weaponDropped:true},{inventory:{},toolkitPoints:30},{inventory:{}},{ap:24}]){const b=quiet(patch),n=endTurn(b);assert.equal(actor(n).condition,patch.condition??0,JSON.stringify(patch));assert.equal(repairMaterialPoints(actor(n)),repairMaterialPoints(actor(b)));}
 const s=quiet({inventory:{}});s.units[0].inventory={tools:kit(30,'officer-owned')};const n=endTurn(saved(s));assert.equal(actor(n).condition,0);assert.deepEqual(n.units[0].inventory,s.units[0].inventory);
});

test('current care, useful held backup and recovery priority retain the kit when they consume the usable window',()=>{
 const care=quiet({hp:40,bleeding:2,medical:60,medkits:1,ap:29});const r=presentedEndTurn(care);assert.equal(actor(r.state).condition,0);assert.equal(repairMaterialPoints(actor(r.state)),30);assert.equal(actor(r.state).bleeding,0);assert.equal(r.frames.some(f=>f.action==='repair'),false);
 const backup=quiet({weapon:1805,ap:25,offHand:{weapon:1806,count:1,weight:1,condition:100,loaded:1,instanceId:'ready-other'}}),b=presentedEndTurn(backup);assert.equal(b.frames[0].action,'swapHands');assert.equal(repairMaterialPoints(actor(b.state)),30);assert.equal(actor(b.state).weaponInstanceId,'ready-other');
 for(const patch of [{knockedDown:true,ap:25},{entangled:true,ap:25}]){const x=presentedEndTurn(quiet(patch));assert.ok(['stance','free'].includes(x.frames[0].action));assert.equal(x.frames.some(f=>f.action==='repair'),false);assert.equal(repairMaterialPoints(actor(x.state)),30);}
});

test('admitted repair context reads only owned source and preserves the enemy allied-window refusal',()=>{
 const {contexts}=captureContexts(()=>endTurn(quiet()),(context,entry)=>{const s=entry.state,u=entry.actor,enemy=s.units.find(v=>v.side==='enemy'),descriptors=Object.getOwnPropertyDescriptors(enemy);for(const key of ['condition','loaded','ammo','jammed','inventory'])Object.defineProperty(enemy,key,{get(){throw Error('private enemy '+key);},configurable:true,enumerable:false});
  try{assert.equal(firearmMaintenancePreview(s,u,context).valid,true);assert.deepEqual(chooseOwnedFirearmRepair(s,u,context),repair);assert.deepEqual(chooseEnemyAction(s,u,{maintenanceContext:context}),repair);}finally{Object.defineProperties(enemy,descriptors);}
  const other={...enemy,weapon:1800,condition:0,loaded:1,jammed:false,activeSlot:'primary',inventory:{tools:kit(30,'enemy-owned')},ap:41},projected={...s,phase:'enemy'};const p=firearmMaintenancePreview(projected,other,context);assert.equal(p.valid,false);assert.match(p.reason,/milicia/);assert.equal(chooseOwnedFirearmRepair(projected,other,context),null);
 });assert.equal(contexts.length,1);
});

test('the live interrupt context rejects a replaced window or a newly earlier eligible militia',()=>{
 let seen=0;captureContexts(()=>endTurn(reacting(true)),(context,entry)=>{if(entry.kind!=='interrupt')return;seen++;const s=entry.state,u=entry.actor,window=s.interrupt;assert.equal(firearmMaintenancePreview(s,u,context).valid,true);s.interrupt={...window};assert.equal(firearmMaintenancePreview(s,u,context).valid,false);s.interrupt=window;
  const earlier=s.units.find(v=>v.id==='o'),old=structuredClone(earlier);Object.assign(earlier,{militia:true,condition:0,inventory:{tools:kit(30,'earlier-kit')}});assert.equal(firearmMaintenancePreview(s,u,context).valid,false);for(const key of Object.keys(earlier))if(!Object.hasOwn(old,key))delete earlier[key];Object.assign(earlier,old);assert.equal(firearmMaintenancePreview(s,u,context).valid,true);
 });assert.equal(seen,1);
});
