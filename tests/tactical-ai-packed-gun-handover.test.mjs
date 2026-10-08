import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,endTurn,presentedEndTurn,actBattle,canSee,hasLineOfSight,transferPreview,actionCosts} from '../game/tactical.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {handRecord,inventoryUsage,transferItemQuantity} from '../game/tactical-inventory.js';
import {ammunitionByType,totalReserveAmmunition} from '../game/ammunition-types.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {setTestAmmunition} from './typed-ammunition-fixture.mjs';
import {makeGrenadeStack} from '../game/grenades.js';
import {weaponMetadata} from '../game/weapon-definition.js';
import {defaultContentPackage} from '../game/content-package.js';

const tiles=Array.from({length:160},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',blocked:false,cover:0}));
const spare={weapon:1806,count:1,weight:1.3,loaded:1,condition:84,instanceId:'donor-spare',name:'Pistola de reserva',provenance:{owner:'Donante'}};
const unit=(s,id)=>s.units.find(u=>u.id===id);
const donor=s=>unit(s,'d');
const recipient=s=>unit(s,'e');
const restored=s=>validateBattleSnapshot(JSON.parse(JSON.stringify(s)));
function field(d={},e={}){
 const shared={facing:2,weapon:1805,ammo:0,priming:0,medical:0,medkits:0,rations:0,torches:0,boleadoras:0,patrol:false,marksmanship:100};
 const s=createBattle([{id:'p',x:12,y:3,facing:6,loaded:0,ammo:0,experienceLevel:1}],{width:20,height:8,seed:45,tiles,enemies:[
  {...shared,id:'d',x:6,y:4,weaponInstanceId:'donor-primary',loaded:1,inventory:{spare},...d},
  {...shared,id:'e',x:6,y:3,weaponInstanceId:'recipient-empty',loaded:0,...e},
 ]});unit(s,'p').ap=0;donor(s).ap=d.ap??4;recipient(s).ap=e.ap??14;return s;
}
const order={type:'transfer',unitId:'d',targetId:'e',item:'inventory:spare',count:1};
const isHandover=s=>chooseEnemyAction(s,donor(s))?.type==='transfer';
const carried=u=>[handRecord(u,'primary'),...(u.offHand?[handRecord(u,'offhand')]:[]),...Object.values(u.inventory??{})].filter(Boolean);
const charged=s=>s.units.reduce((sum,u)=>sum+carried(u).reduce((n,r)=>n+(r.loaded??0)*r.count,0),0);

test('the real enemy turn pays one adjacent owned pack-gun handover, equip and shot',()=>{
 const s=field(),before=structuredClone(s),held=handRecord(donor(s),'primary'),old=handRecord(recipient(s),'primary');
 assert.deepEqual(chooseEnemyAction(s,donor(s)),order);assert.equal(chooseEnemyAction(s,recipient(s)),null);
 const preview=transferPreview({...s,phase:'enemy'},donor(s),recipient(s),order.item,1);
 assert.equal(preview.valid,true);assert.equal(preview.kind,'give');assert.equal(preview.pa,4);assert.equal(preview.route.length,2);
 const n=endTurn(s),d=donor(n),e=recipient(n),incoming=handRecord(e,'primary');
 assert.equal(n.lastError,null);assert.equal(d.ap,0);assert.equal(e.ap,0);assert.equal(n.elapsedSeconds,6);assert.equal(n.phase,'player');
 assert.deepEqual(handRecord(d,'primary'),held);assert.equal(d.inventory.spare,undefined);
 assert.equal(e.weaponInstanceId,'donor-spare');assert.equal(e.weapon,1806);assert.equal(e.loaded,0);assert.equal(e.condition,83);
 assert.deepEqual({...incoming,loaded:1,condition:84},{...spare,jammed:false});
 assert.deepEqual(Object.values(e.inventory).find(r=>r.instanceId==='recipient-empty'),old);
 assert.equal(charged(s)-charged(n),1);assert.equal(totalReserveAmmunition(d),0);assert.equal(totalReserveAmmunition(e),0);
 assert.ok(unit(n,'p').hp<100);assert.equal(n.log.filter(l=>l.includes('entrega el objeto')).length,1);assert.equal(n.log.filter(l=>l.includes('equipa Pistola')).length,1);
 assert.deepEqual(s,before);assert.deepEqual(n,endTurn(restored(s)));assert.doesNotThrow(()=>restored(n));
});

test('a broken recipient gun keeps its owned loaded charge and unfinished work when displaced',()=>{
 for(const work of [{loaded:1},{loaded:0,reloadProgress:.375}]){
 const s=field({}, {condition:0,...work,weaponMetadata:{provenance:{owner:'Receptor'}}});
 const old=handRecord(recipient(s),'primary'),before=structuredClone(s);
 assert.deepEqual(chooseEnemyAction(s,donor(s)),order);
 const n=endTurn(s);assert.equal(n.lastError,null);assert.deepEqual(Object.values(recipient(n).inventory).find(r=>r.instanceId==='recipient-empty'),old);
 assert.equal(recipient(n).weaponInstanceId,'donor-spare');assert.equal(recipient(n).loaded,0);assert.equal(donor(n).loaded,1);assert.equal(charged(s)-charged(n),1);assert.deepEqual(s,before);assert.doesNotThrow(()=>restored(n));
 }
});

test('the donor retains a useful held firearm and never hands over its active or other-hand gun',()=>{
 for(const patch of [{loaded:0},{jammed:true},{condition:0},{weaponDropped:true},{activeSlot:'blade',blade:1813},{ap:3},{knockedDown:true},{entangled:true},{unconscious:true},{routed:true},{surrendered:true}]){
  const s=field(patch);Object.assign(donor(s),patch);const before=structuredClone(s);assert.equal(isHandover(s),false,JSON.stringify(patch));assert.deepEqual(s,before);
 }
 const s=field({inventory:{},offHand:spare});assert.equal(isHandover(s),false);assert.equal(donor(s).offHand.instanceId,'donor-spare');
});

test('only one ready serviceable explicitly owned packed firearm can qualify',()=>{
 for(const patch of [{loaded:0},{jammed:true},{condition:0},{count:0},{count:2},{instanceId:undefined},{weapon:1813,loaded:0}]){
  const s=field({inventory:{spare:{...spare,...patch}}}),before=structuredClone(s);assert.equal(isHandover(s),false,JSON.stringify(patch));assert.deepEqual(s,before);
 }
 assert.equal(isHandover(field({inventory:{spare:{...spare,condition:1}}})),true);
});

test('own ready guns, reloadable charges and useful melee prevent a redundant recipient handover',()=>{
 for(const patch of [{loaded:1},{ammo:1},{jammed:true},{reloadProgress:.375},{offHand:{...spare,instanceId:'recipient-other'}},{inventory:{own:{...spare,instanceId:'recipient-own'}}}]){
  const s=field({},patch),before=structuredClone(s);assert.equal(isHandover(s),false,JSON.stringify(patch));assert.deepEqual(s,before);
 }
 const close=field({}, {blade:1813,activeSlot:'blade'});unit(close,'p').x=7;assert.equal(isHandover(close),false);
 const brokenSpare=field({}, {inventory:{broken:{...spare,instanceId:'recipient-broken',condition:0}}});assert.equal(isHandover(brokenSpare),true,'an unusable owned gun is not a useful alternative');
});

test('a recipient must be able to pay the actual equip and one useful shot this turn',()=>{
 for(const ap of [0,5,6,11])assert.equal(isHandover(field({}, {ap})),false,String(ap));
 const enough=field({}, {ap:12});assert.equal(isHandover(enough),true);const paid=endTurn(enough);assert.equal(recipient(paid).ap,0);assert.equal(recipient(paid).loaded,0);assert.ok(unit(paid,'p').hp<100);
 assert.equal(isHandover(field({}, {ap:14})),true);
 for(const patch of [{hp:0},{unconscious:true},{knockedDown:true},{entangled:true},{routed:true},{surrendered:true},{departure:{edge:'E'}},{weaponDropped:true}]){const s=field({},patch);Object.assign(recipient(s),patch);assert.equal(isHandover(s),false,JSON.stringify(patch));}
});

test('real transfer and displaced-gun capacity both gate the handover without discarding gear',()=>{
 const s=field({}, {inventory:Object.fromEntries(Array.from({length:4},(_,i)=>['long-'+i,{weapon:1800,count:1,weight:4,loaded:0,instanceId:'packed-long-'+i}]))});
 const e=recipient(s);for(const slot of inventoryUsage(e).slots.filter(slot=>!slot.entry))e.inventory['full-'+slot.id]={count:1,weight:.1};
 assert.equal(inventoryUsage(e).overloaded,false);assert.equal(inventoryUsage(e).free,0);assert.doesNotThrow(()=>restored(s));
 const before=structuredClone(s);assert.equal(isHandover(s),false);assert.deepEqual(s,before);assert.equal(donor(s).inventory.spare.instanceId,'donor-spare');
});

test('there is no gun supply trip, relay, cross-floor or obstacle handover',()=>{
 for(const patch of [{x:6,y:1},{x:5,y:1},{tacticalLevel:1}]){const s=field({},patch);Object.assign(recipient(s),patch);assert.equal(isHandover(s),false,JSON.stringify(patch));}
 const wall=field({}, {x:7,y:3});const tile=wall.tiles.find(t=>t.x===6&&t.y===3);tile.type='wall';tile.blocked=true;tile.blocksSight=true;assert.equal(isHandover(wall),false);
 const far=field({}, {x:9,y:3});far.units.push({...structuredClone(recipient(far)),id:'relay',x:7,y:3,ap:4,weaponInstanceId:'relay-empty'});assert.equal(isHandover(far),false,'an intervening ally does not turn this policy into a relay');
});

test('both the donor and recipient must independently see an affordable clear target',()=>{
 const donorBlind=field({facing:6});assert.equal(canSee(donorBlind,donor(donorBlind),unit(donorBlind,'p')),false);assert.equal(isHandover(donorBlind),false);
 const recipientBlind=field({}, {facing:6});assert.equal(canSee(recipientBlind,recipient(recipientBlind),unit(recipientBlind,'p')),false);assert.equal(isHandover(recipientBlind),false);
 const blocked=field();blocked.units.push({...structuredClone(recipient(blocked)),id:'friend',x:9,y:3,ap:0,weaponInstanceId:'friend-empty'});assert.equal(isHandover(blocked),false);
 const wall=field();wall.tiles.find(t=>t.x===9&&t.y===3).blocked=true;wall.tiles.find(t=>t.x===9&&t.y===3).blocksSight=true;assert.equal(hasLineOfSight(wall,recipient(wall),unit(wall,'p')),false);assert.equal(isHandover(wall),false);
});

test('hidden opposing positions and private target supplies do not change the handover',()=>{
 const s=field(),other=structuredClone(s);Object.assign(unit(other,'p'),{energy:2,ammo:500,medkits:99,inventory:{secret:{count:1,weight:.1}},condition:0});
 other.units.push({...structuredClone(unit(other,'p')),id:'hidden',x:0,y:7,weaponInstanceId:'hidden-gun'});assert.equal(canSee(other,donor(other),other.units.at(-1)),false);assert.equal(canSee(other,recipient(other),other.units.at(-1)),false);
 const before=structuredClone(other);assert.deepEqual(chooseEnemyAction(other,donor(other)),order);other.units.at(-1).x=1;assert.deepEqual(chooseEnemyAction(other,donor(other)),order);assert.deepEqual(chooseEnemyAction(s,donor(s)),order);other.units.at(-1).x=0;assert.deepEqual(other,before);
});

test('ordinary ammunition and dressing handovers keep priority over an owned gun',()=>{
 const ammo=field({ammo:1});assert.equal(isHandover(ammo),false,'between-turn projection does not outrank existing supply demand');assert.equal(chooseEnemyAction({...ammo,phase:'enemy'},donor(ammo)).item,'inventory:ammo:pistol_69');const paid=endTurn(ammo);assert.equal(donor(paid).inventory.spare.instanceId,'donor-spare');assert.equal(recipient(paid).ammo,1);
 const dress=field({medkits:1},{medical:60,hp:50,bleeding:2,ap:40});assert.equal(isHandover(dress),false);assert.equal(chooseEnemyAction({...dress,phase:'enemy'},donor(dress)).item,'medkits');
});

test('a useful own shot and immediate defense keep priority over sharing the packed gun',()=>{
 const shot=field({ap:40});assert.equal(chooseEnemyAction(shot,donor(shot)).type,'fire');
 const close=field({ap:24});Object.assign(unit(close,'p'),{x:7,y:4});assert.equal(chooseEnemyAction(close,donor(close)).type,'melee');
});

test('recipient and gun ties are stable and a received alternative removes further demand',()=>{
 const s=field({inventory:{z:{...spare,instanceId:'pack-z'},a:{...spare,instanceId:'pack-a'}}});s.units.push({...structuredClone(recipient(s)),id:'a-recipient',x:7,y:4,weaponInstanceId:'other-empty'});
 s.enemyTurn={unitIds:['d','a-recipient','e'],unitIndex:0,actionsTaken:0,started:true};
 const choice=chooseEnemyAction(s,donor(s));assert.equal(choice.targetId,'a-recipient');assert.equal(choice.item,'inventory:a');s.units.reverse();assert.deepEqual(chooseEnemyAction(s,donor(s)),choice);
 const transfer=transferItemQuantity(donor(s),unit(s,'a-recipient'),choice.item,1);Object.assign(donor(s),transfer.source);Object.assign(unit(s,'a-recipient'),transfer.target);assert.equal(chooseEnemyAction(s,donor(s))?.targetId,'e','a useful owned incoming spare cancels the first demand');
});

test('two donors cannot overfill or pass a ready owned gun back after the actual recipient decision',()=>{
 const s=field();s.units.splice(2,0,{...structuredClone(donor(s)),id:'other-donor',weaponInstanceId:'other-primary',x:5,y:3,inventory:{spare:{...spare,instanceId:'other-spare'}}});
 const n=endTurn(s);assert.equal(recipient(n).weaponInstanceId,'donor-spare');assert.equal(unit(n,'other-donor').inventory.spare.instanceId,'other-spare');assert.equal(unit(n,'other-donor').ap,4);assert.equal(donor(n).inventory.spare,undefined);assert.equal(recipient(n).loaded,0);assert.equal(recipient(n).ap,0);assert.equal(n.log.filter(l=>l.includes('entrega el objeto')).length,1);assert.deepEqual(n,endTurn(restored(s)));assert.doesNotThrow(()=>restored(n));
});

test('a nested saved interruption retains the completed handover and never repeats equip or shot',()=>{
 const s=field({experienceLevel:5},{experienceLevel:5});Object.assign(unit(s,'p'),{ap:24,agility:30,experienceLevel:1});
 s.units.push({...structuredClone(unit(s,'p')),id:'observer',x:12,y:5,facing:2,loaded:1,ap:20,agility:100,experienceLevel:10,weaponInstanceId:'observer-gun'});
 const paused=actBattle(s,{type:'move',unitId:'p',x:11,y:3});assert.equal(paused.lastError,null);assert.equal(paused.phase,'interrupt');assert.equal(paused.interrupt.returnTo,'reaction');
 assert.equal(recipient(paused).weaponInstanceId,'donor-spare');assert.equal(recipient(paused).loaded,0);assert.equal(donor(paused).ap,0);
 const n=endTurn(restored(paused));assert.deepEqual(n,endTurn(paused));assert.equal(n.phase,'player');assert.equal(n.turn,1);assert.equal(n.elapsedSeconds,6);assert.equal(n.log.filter(l=>l.includes('entrega el objeto')).length,1);assert.equal(n.log.filter(l=>l.includes('equipa Pistola')).length,1);assert.equal(recipient(n).loaded,0);assert.equal(recipient(n).weaponInstanceId,'donor-spare');assert.doesNotThrow(()=>restored(n));
});

test('public player orders cannot force an enemy handover',()=>{
 const s=field(),before=structuredClone(s),n=actBattle(s,order);assert.ok(n.lastError);assert.deepEqual(n.units,s.units);assert.equal(n.elapsedSeconds,s.elapsedSeconds);assert.equal(n.seed,s.seed);assert.deepEqual(s,before);
});


test('packed authored double-barrel partial work, same-key records and typed reserves remain exact',()=>{
 const definition={...defaultContentPackage().weapons.find(w=>w.template===1808),id:'named-backup',name:'Pistola personal',capacity:2};
 const incoming={...spare,weapon:1808,loaded:1,reloadProgress:.375,ammunitionChoice:'ammoPistol',...weaponMetadata(definition)};
 const oldPack={...spare,instanceId:'recipient-broken-pack',condition:0};
 const s=field({inventory:{spare:incoming}},{inventory:{spare:oldPack}});
 donor(s).inventory['ammo:musket_75']={kind:'ammunition',ammoType:'musket_75',count:3,weight:.04,name:'Cartuchos de mosquete'};
 const before=structuredClone(s),old=handRecord(recipient(s),'primary'),n=endTurn(s),after=handRecord(recipient(n),'primary');
 assert.equal(n.lastError,null);assert.equal(after.instanceId,'donor-spare');assert.equal(after.loaded,0);assert.equal(after.condition,83);assert.equal(after.reloadProgress,.375);
 assert.deepEqual({...after,loaded:1,condition:84},{...incoming,jammed:false});
 assert.deepEqual(Object.values(recipient(n).inventory).find(r=>r.instanceId==='recipient-empty'),old);
 assert.deepEqual(Object.values(recipient(n).inventory).find(r=>r.instanceId==='recipient-broken-pack'),oldPack);
 assert.deepEqual(ammunitionByType(donor(n)),ammunitionByType(donor(s)));assert.equal(totalReserveAmmunition(donor(n)),3);assert.deepEqual(s,before);assert.deepEqual(n,endTurn(restored(s)));assert.doesNotThrow(()=>restored(n));
});

test('existing recipient medical work, grenade preparation and non-primary modes receive no new gun',()=>{
 const medical=field({}, {activeSlot:'medical',medical:60,medkits:1,hp:50,bleeding:2,ap:32});
 assert.equal(isHandover(medical),false);assert.equal(chooseEnemyAction(medical,recipient(medical)).type,'useItem');const healed=endTurn(medical);assert.equal(donor(healed).inventory.spare.instanceId,'donor-spare');assert.equal(recipient(healed).weaponInstanceId,'recipient-empty');assert.equal(recipient(healed).bleeding,0);
 const primaryMedic=field({}, {medical:60,medkits:1});assert.equal(isHandover(primaryMedic),false,'supplied medics remain outside this conservative gun recipient scope');
 for(const activeSlot of ['blade','medical','tool','supply','item','unarmed']){const s=field({}, {activeSlot});recipient(s).activeSlot=activeSlot;assert.equal(isHandover(s),false,activeSlot);}
 const grenade=field({}, {activeSlot:'item',activeItem:'inventory:grenade',inventory:{grenade:makeGrenadeStack()},dexterity:100,strength:100,morale:100,ap:20});
 assert.equal(isHandover(grenade),false);assert.equal(chooseEnemyAction(grenade,recipient(grenade)).type,'throwGrenade');const thrown=endTurn(grenade);assert.equal(donor(thrown).inventory.spare.instanceId,'donor-spare');assert.equal(recipient(thrown).weaponInstanceId,'recipient-empty');assert.equal(recipient(thrown).inventory.grenade,undefined);
 const packedGrenade=field({}, {inventory:{grenade:makeGrenadeStack()}});assert.equal(isHandover(packedGrenade),false,'a prepared grenade alternative retains its ordinary priority');
});

test('artillery operators and nearby prospective crew retain their gun duties instead of a new personal gun',()=>{
 for(const x of [7,10]){
  const s=field({}, {ap:60});s.artillery=[{id:'piece',type:'swivel',side:'enemy',x,y:3,facing:0,loaded:true,ammo:0}];
  assert.equal(isHandover(s),false,String(x));assert.equal(chooseEnemyAction({...s,phase:'enemy'},recipient(s))?.type,x===7?'artillery':'move');const before=structuredClone(s),n=endTurn(s);assert.equal(n.lastError,null);assert.equal(donor(n).inventory.spare.instanceId,'donor-spare');assert.equal(recipient(n).weaponInstanceId,'recipient-empty');assert.deepEqual(n,endTurn(restored(s)));assert.deepEqual(s,before);assert.doesNotThrow(()=>restored(n));
 }
});

test('broken-only cartridge demand no longer blocks the paid owned gun handover',()=>{
 const s=field({ammo:1},{condition:0}),before=structuredClone(s),held=handRecord(donor(s),'primary'),old=handRecord(recipient(s),'primary');
 assert.deepEqual(chooseEnemyAction({...s,phase:'enemy'},donor(s)),order);
 const n=endTurn(s);assert.equal(n.lastError,null);assert.equal(donor(n).inventory.spare,undefined);assert.equal(donor(n).ap,0);assert.equal(donor(n).ammo,1);assert.deepEqual(handRecord(donor(n),'primary'),held);
 assert.equal(recipient(n).weaponInstanceId,'donor-spare');assert.equal(recipient(n).condition,83);assert.equal(recipient(n).loaded,0);assert.equal(recipient(n).ammo,0);assert.equal(recipient(n).ap,0);assert.ok(unit(n,'p').hp<100);assert.equal(n.elapsedSeconds,6);
 assert.deepEqual(Object.values(recipient(n).inventory).find(r=>r.instanceId==='recipient-empty'),old);assert.deepEqual(s,before);assert.deepEqual(n,endTurn(restored(s)));assert.doesNotThrow(()=>restored(n));
});


test('a donor-only reaction retains the packed gun when the recipient did not qualify',()=>{
 const s=field({experienceLevel:10,agility:100,overwatch:true},{experienceLevel:1,agility:30,overwatch:false});Object.assign(unit(s,'p'),{ap:24,agility:30,experienceLevel:1});
 const before=structuredClone(s),n=actBattle(s,{type:'move',unitId:'p',x:11,y:3});assert.equal(n.lastError,null);assert.equal(n.phase,'player');assert.equal(n.turn,1);assert.equal(n.elapsedSeconds,6);assert.equal(donor(n).ap,4);assert.equal(donor(n).inventory.spare.instanceId,'donor-spare');assert.equal(recipient(n).ap,14);assert.equal(recipient(n).weaponInstanceId,'recipient-empty');assert.equal(recipient(n).inventory.spare,undefined);assert.deepEqual(n,actBattle(restored(s),{type:'move',unitId:'p',x:11,y:3}));assert.deepEqual(s,before);assert.doesNotThrow(()=>restored(n));
});

test('only a recipient still upcoming in the actual turn queue can receive this gun',()=>{
 const prior=field();prior.units=[unit(prior,'p'),recipient(prior),donor(prior)];assert.equal(isHandover(prior),false);const n=endTurn(prior);assert.equal(n.lastError,null);assert.equal(donor(n).inventory.spare.instanceId,'donor-spare');assert.equal(recipient(n).weaponInstanceId,'recipient-empty');assert.equal(recipient(n).ap,14);
 const future=field();future.phase='enemy';future.enemyTurn={unitIds:['d','e'],unitIndex:0,actionsTaken:0,started:true};assert.deepEqual(chooseEnemyAction(future,donor(future)),order);
 future.enemyTurn={unitIds:['e','d'],unitIndex:1,actionsTaken:0,started:true};assert.equal(isHandover(future),false);
 future.enemyTurn={unitIds:['d'],unitIndex:0,actionsTaken:0,started:true};assert.equal(isHandover(future),false);
 future.enemyTurn={unitIds:['d','e'],unitIndex:0,actionsTaken:0,started:true};future.reactionStack=[{unitIds:['d'],unitIndex:0,actionsTaken:0,resumePhase:'player'}];assert.equal(isHandover(future),false,'the active reaction takes precedence over a suspended enemy turn');
});


test('the real recorder preserves paid transfer/equip/fire ordering without exposing unseen guns',()=>{
 for(const hidden of [false,true]){
  const s=field(),before=structuredClone(s);if(hidden)unit(s,'p').facing=2;
  const initial=structuredClone(s),r=presentedEndTurn(s);assert.deepEqual(r.state,endTurn(s));assert.deepEqual(s,initial);assert.deepEqual(r.state,endTurn(restored(s)));
  assert.equal(donor(r.state).inventory.spare,undefined);assert.equal(recipient(r.state).weaponInstanceId,'donor-spare');assert.equal(recipient(r.state).loaded,0);assert.equal(donor(r.state).loaded,1);
  if(hidden){for(const frame of r.frames){assert.equal(frame.unitId,null);assert.equal(frame.visibleIds.includes('d'),false);assert.equal(frame.visibleIds.includes('e'),false);assert.equal(frame.shotVisual,undefined);assert.equal(frame.shotHand,undefined);}}
  else{
   assert.deepEqual(r.frames.map(f=>[f.type,f.action]),[['prepare','transfer'],['result','transfer'],['prepare','equipLoot'],['result','equipLoot'],['prepare','fire'],['projectile','fire'],['impact','fire'],['result','fire']]);
   const give=r.frames[1];assert.equal(donor(give.state).ap,0);assert.equal(recipient(give.state).ap,14);assert.equal(recipient(give.state).weaponInstanceId,'recipient-empty');assert.equal(Object.values(recipient(give.state).inventory).find(x=>x.instanceId==='donor-spare').loaded,1);
   const equipped=r.frames[3];assert.equal(recipient(equipped.state).ap,8);assert.equal(recipient(equipped.state).weaponInstanceId,'donor-spare');assert.equal(recipient(equipped.state).loaded,1);assert.equal(Object.values(recipient(equipped.state).inventory).find(x=>x.instanceId==='recipient-empty').loaded,0);
   const projectile=r.frames[5];assert.equal(projectile.shotHand,'primary');assert.equal(recipient(projectile.state).ap,0);assert.equal(recipient(projectile.state).loaded,0);assert.equal(r.frames.at(-1).shotComplete,true);assert.equal(r.frames.filter(f=>f.type==='projectile').length,1);
  }
 }
});
