import {totalReserveAmmunition} from '../game/ammunition-types.js';
import {setReserve} from './typed-ammo-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchCampaign} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {actBattle,endTurn,getReachable} from '../game/tactical.js';
import {firstAidPlan} from '../game/first-aid.js';
import {returnAmmunition} from '../game/ammunition.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {refreshMilitaryCondition} from '../game/actor-condition.js';
import {weaponSpecification} from '../game/weapon-definition.js';
import {OPERATIVES} from '../game/data.js';
import {fight} from './opening-driver.mjs';
import {syncBattleTime} from '../game/time.js';
import {paidCasualty} from './paid-casualty-fixture.mjs';
import {order,visit,leave,saved,tactical} from './local-contract-fixture.mjs';

test('actual military casualties persist through saved sector visits with finite equipment and unchanged deaths',()=>{
 const {campaign:before,id}=paidCasualty(),bodies=before.sectorStates.buenos_aires.units.filter(u=>u.hp===0),death=before.operativeState[id].deathMinute;
 assert.ok(bodies.some(u=>u.side==='enemy'));assert.ok(bodies.some(u=>Number(u.id)===id));
 let p=visit(order(before,{type:'squad',ids:before.squad.filter(id=>before.operativeState[id].hp>=20)}));
 // Re-entry clears tactical memory and starts a new reaction clock. Every
 // physical body field, including wounds and finite possessions, must survive.
 for(const body of bodies){const {lastKnownEnemy,lastHeardNoise,lastTargetId,lastShotPosition,patrolTurn,lastInvestigatedTurn,...physical}=body;assert.deepEqual(p.battle.units.find(u=>u.id===body.id),{...physical,reactionTurn:0});}
 const body=p.battle.units.find(u=>Number(u.id)===id),actor=p.battle.units.find(u=>u.side==='player'&&u.hp>0&&!u.routed);
 const spot=getReachable(p.battle,actor).filter(t=>Math.hypot(t.x-body.x,t.y-body.y)<=1.5).sort((a,b)=>a.cost-b.cost)[0];assert.ok(spot);
 if(spot.cost)p=tactical(p,{type:'move',unitId:actor.id,x:spot.x,y:spot.y});
 const beforeLoot=p.battle.units.find(u=>u.id===body.id),[ammoKey,ammoStack]=Object.entries(beforeLoot.inventory).find(([,item])=>item.kind==='ammunition'&&item.count>0),ammo=ammoStack.count,cartridges=totalReserveAmmunition(actor)+actor.loaded;
 const ammunitionItem=`inventory:${ammoKey}`;
 assert.ok(ammo>0);p=tactical(p,{type:'loot',unitId:actor.id,targetId:body.id,item:ammunitionItem});
 assert.equal(p.battle.units.find(u=>u.id===body.id).inventory[ammoKey],undefined);
 assert.equal(totalReserveAmmunition(p.battle.units.find(u=>u.id===actor.id))+p.battle.units.find(u=>u.id===actor.id).loaded,cartridges+ammo);
 assert.ok(actBattle(p.battle,{type:'loot',unitId:actor.id,targetId:body.id,item:ammunitionItem}).lastError);
 p=tactical(p,{type:'loot',unitId:actor.id,targetId:body.id,item:'weapon'});
 const recovered=Object.values(p.battle.units.find(u=>u.id===actor.id).inventory).find(item=>item.weapon===body.weapon);assert.ok(recovered);assert.deepEqual(weaponSpecification(recovered),weaponSpecification(body));
 assert.equal(p.battle.units.find(u=>u.id===body.id).weaponDropped,true);
 const cash=p.campaign.resources.treasury,issued=p.campaign.pendingBattle.issuedCartridges;
 let s=saved({campaign:leave(p)}).campaign;assert.equal(s.resources.treasury,cash);assert.equal(totalReserveAmmunition(s.operativeState[actor.id])+s.operativeState[actor.id].carriedLoaded,cartridges+ammo);
 assert.equal(s.operativeState[id].deathMinute,death);assert.equal(s.operativeState[id].alive,false);
 const returnedBodies=s.sectorStates.buenos_aires.units.filter(u=>u.hp===0).map(u=>u.id).sort();
 assert.ok(bodies.every(u=>returnedBodies.includes(u.id)),'all original deaths remain; a bleeding critical casualty can also die during recovery');
 p=visit(s);assert.equal(p.battle.units.find(u=>u.id===body.id).ammo,0);assert.equal(p.battle.units.find(u=>u.id===body.id).weaponDropped,true);assert.ok(actBattle(p.battle,{type:'loot',unitId:actor.id,targetId:body.id,item:'weapon'}).lastError);assert.deepEqual(p.battle.units.filter(u=>u.hp===0).map(u=>u.id).sort(),returnedBodies);
 s=saved({campaign:leave(p)}).campaign;assert.equal(s.resources.treasury,cash);assert.equal(totalReserveAmmunition(s.operativeState[actor.id])+s.operativeState[actor.id].carriedLoaded,cartridges+ammo);
 assert.deepEqual(s.contentPresence.events,before.contentPresence.events);
});

test('fresh occupation keeps older enemy bodies separate from reused garrison identities and counts their finite ammunition once in the legacy helper',()=>{
 const request={id:'first',sector:'san_nicolas',squad:[{...OPERATIVES.find(u=>u.id===3),weapon:1800,loaded:1,ammo:9}],enemies:[{id:'enemy-0',hp:80,maxHp:80,ammo:7,loaded:1,weapon:1800}]};
 const first=enterSector(request);const old=first.units.find(u=>u.side==='enemy');old.hp=0;old.inventory.keepsake={count:1,weight:1};first.sectorCleared=true;
 const nextRequest={...request,id:'second',issuedCartridges:10},next=enterSector(nextRequest,first),bodies=next.units.filter(u=>u.hp===0);
 assert.equal(bodies.length,1);const body=bodies[0];assert.notEqual(body.id,'enemy-0');assert.equal(body.originalUnitId,'enemy-0');assert.equal(body.ammo,7);assert.deepEqual(body.inventory,old.inventory);assert.equal(next.units.find(u=>u.id==='enemy-0').hp,80);assert.doesNotThrow(()=>validateBattleSnapshot(next));
 // Isolate accounting from combat: both the old remains and the new defender can carry ammunition.
 const player=next.units.find(u=>u.side==='player');setReserve(body,0);setReserve(player,player.ammo+7);
 assert.equal(returnAmmunition(nextRequest,[player],next,first),17);
 const again=enterSector(nextRequest,next);assert.equal(again.units.filter(u=>u.hp===0).length,1);assert.equal(again.units.find(u=>u.id===body.id).ammo,0);
 assert.equal(returnAmmunition(nextRequest,[player],next,next),10);
 next.sectorCleared=true;next.units.find(u=>u.id==='enemy-0').hp=0;
 const third=enterSector({...nextRequest,id:'third'},next);assert.equal(third.units.filter(u=>u.hp===0).length,2);assert.equal(new Set(third.units.map(u=>u.id)).size,third.units.length);assert.equal(third.units.find(u=>u.id===body.id).ammo,0);assert.doesNotThrow(()=>validateBattleSnapshot(third));
});

test('a retained casualty cannot rejoin a living deployment or disguise an unrelated or revived report',()=>{
 const {campaign:before,id}=paidCasualty(),p=visit(before),reports=p.battle.units.filter(u=>u.side==='player'),action={type:'leaveSector',battleId:p.campaign.pendingBattle.id,sectorState:p.battle,survivors:reports};
 assert.ok(reports.some(u=>Number(u.id)===id));
 const summary=dispatchCampaign(p.campaign,{...action,survivors:reports.map(u=>Number(u.id)===id?{...u,hp:1}:u)});assert.equal(summary.lastError,null);assert.equal(summary.operativeState[id].hp,0);assert.equal(summary.operativeState[id].deathMinute,before.operativeState[id].deathMinute);
 assert.ok(dispatchCampaign(p.campaign,{...action,survivors:[...reports,{id:'9999',hp:0}]}).lastError);
 const changed=structuredClone(p.battle);changed.units.find(u=>Number(u.id)===id).hp=1;
 assert.ok(dispatchCampaign(p.campaign,{...action,sectorState:changed}).lastError);
 const request={...p.campaign.pendingBattle,squad:[...p.campaign.pendingBattle.squad,{...OPERATIVES.find(u=>u.id===3),id,hp:50}]};
 assert.throws(()=>enterSector(request,before.sectorStates.buenos_aires),/fallecido/);
});

// The occupation is prepared to isolate re-entry; the second battle still uses real actions.
test('a real second battle settles and saves with the original player and enemy bodies in its report',()=>{
 const {campaign:before,id}=paidCasualty(),oldBodies=before.sectorStates.buenos_aires.units.filter(u=>u.hp===0),oldDeath=before.operativeState[id].deathMinute;
 before.sectors.buenos_aires.owner='royalist';
 let s=order(before,{type:'attack',sector:'buenos_aires'}),request=s.pendingBattle;
 const {battle}=fight(request,s.sectorStates.buenos_aires);assert.notEqual(battle.status,'active');
 assert.ok(battle.units.some(u=>u.id===String(id)&&u.hp===0));assert.ok(battle.units.some(u=>u.originalUnitId&&u.hp===0));
 const pair=syncBattleTime(s,battle);assert.equal(pair.error,null);
 const restored=saved(pair);s=order(restored.campaign,{type:'battleResult',battleId:request.id,outcome:restored.battle.status,sectorState:restored.battle,survivors:restored.battle.units.filter(u=>u.side==='player')});
 s=saved({campaign:s}).campaign;assert.equal(s.operativeState[id].deathMinute,oldDeath);assert.equal(s.operativeState[id].alive,false);
 assert.ok(s.sectorStates.buenos_aires.units.filter(u=>u.hp===0).length>=oldBodies.length);
});

test('finite enemy first aid can stabilize a retained casualty without authorizing replacement, revival or unsupported health',()=>{
 // Seed 42 leaves native critical survivors and actual corpses. Only the new
 // occupation is declared here; no health, routing or supplies are changed.
 const {campaign:before}=paidCasualty(42);
 assert.ok(before.sectorStates.buenos_aires.units.some(unit=>unit.side==='enemy'&&unit.hp>0&&unit.hp<15&&!unit.routed));
 before.sectors.buenos_aires.owner='royalist';
 const campaign=order(before,{type:'attack',sector:'buenos_aires'}),request=campaign.pendingBattle;
 const initial=enterSector(request,campaign.sectorStates.buenos_aires),{battle,orders}=fight(request,campaign.sectorStates.buenos_aires);
 const healed=battle.units.filter(unit=>unit.side==='enemy'&&unit.originalUnitId&&unit.hp>initial.units.find(old=>old.id===unit.id).hp);
 assert.ok(healed.length>0,'the native new garrison must actually treat a retained living casualty');
 for(const unit of healed){assert.ok(unit.hp<=15);assert.ok(initial.units.find(old=>old.id===unit.id).hp>0);}
 const dressings=state=>state.units.filter(unit=>unit.side==='enemy').reduce((sum,unit)=>sum+unit.medkits,0);
 assert.ok(dressings(battle)<dressings(initial),'retained care consumes the actual finite enemy issue');
 const doctor=initial.units.find(unit=>unit.side==='enemy'&&unit.hp>=15&&unit.medical>0&&unit.medkits>battle.units.find(old=>old.id===unit.id).medkits);
 assert.ok(doctor,'native care spends supplies carried by a living medic');
 const treatment=firstAidPlan(doctor,initial.units.find(unit=>unit.id===healed[0].id));
 assert.equal(treatment.hpAfter,healed[0].hp);assert.equal(treatment.dressingsUsed,1);
 let replay=structuredClone(initial);
 for(let index=0;index<orders.length;index++){
  replay=orders[index].type==='endTurn'?endTurn(replay):actBattle(replay,orders[index]);assert.equal(replay.lastError,null,JSON.stringify(orders[index]));
  if(index===Math.floor(orders.length/2))replay=validateBattleSnapshot(JSON.parse(JSON.stringify(replay)));
 }
 assert.deepEqual(replay,battle,'native retained care and the actual outcome replay exactly across a tactical save');
 const pair=syncBattleTime(campaign,battle);assert.equal(pair.error,null);const admitted=saved(pair);
 const report={type:'battleResult',battleId:request.id,outcome:battle.status,sectorState:admitted.battle,survivors:admitted.battle.units.filter(unit=>unit.side==='player')};
 const accepted=order(admitted.campaign,report);assert.deepEqual(saved({campaign:accepted}).campaign,accepted);
 for(const unit of healed)assert.equal(accepted.sectorStates.buenos_aires.units.find(old=>old.id===unit.id).hp,unit.hp);
 const corpse=battle.units.find(unit=>unit.side==='enemy'&&unit.originalUnitId&&unit.hp===0);assert.ok(corpse);
 const changes=[
  scene=>{scene.units.find(unit=>unit.id===healed[0].id).id+=':replacement';},
  scene=>{scene.units.find(unit=>unit.id===healed[0].id).originalUnitId='unrelated-enemy';},
  scene=>{const unit=scene.units.find(unit=>unit.id===healed[0].id);unit.hp=16;unit.bandaged=unit.maxHp-unit.hp;},
  scene=>{for(const unit of scene.units.filter(unit=>unit.side==='enemy'))unit.medkits=initial.units.find(old=>old.id===unit.id).medkits;},
  scene=>{
   for(const unit of scene.units.filter(unit=>unit.side==='enemy'))unit.medkits=initial.units.find(old=>old.id===unit.id).medkits;
   // This native 12→15 HP treatment needs one living dressing. Refund every
   // living carrier, then charge only a real corpse for that exact expense.
   const dead=initial.units.find(unit=>unit.side==='enemy'&&unit.hp===0&&unit.medkits>=treatment.dressingsUsed);assert.ok(dead);
   scene.units.find(unit=>unit.id===dead.id).medkits-=treatment.dressingsUsed;
  },
  scene=>{const unit=scene.units.find(unit=>unit.id===corpse.id);unit.hp=1;unit.bandaged=unit.maxHp-unit.hp;refreshMilitaryCondition(unit);},
 ];
 for(const change of changes){
  const forged=structuredClone(report);change(forged.sectorState);const rejected=dispatchCampaign(admitted.campaign,forged);
  assert.match(rejected.lastError,/enemigos del despliegue/);assert.deepEqual({...rejected,lastError:null},{...admitted.campaign,lastError:null});
 }
});

// Prepared retained casualty: the case isolates revisiting a cleared sector.
test('a saved critical enemy can remain or die during a visit without authorizing revival or extra enemies',()=>{
 const {campaign:before}=paidCasualty();
 const wounded=before.sectorStates.buenos_aires.units.find(u=>u.side==='enemy'&&u.hp===0);
 assert.ok(wounded);Object.assign(wounded,{hp:8,bleeding:0,bandaged:wounded.maxHp-8,energy:0});refreshMilitaryCondition(wounded);
 const p=visit(saved({campaign:before}).campaign),retained=p.battle.units.find(u=>u.id===wounded.id);
 assert.equal(retained.hp,8);assert.equal(retained.unconscious,true);
 const action={type:'leaveSector',battleId:p.campaign.pendingBattle.id,sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')};
 const returned=order(p.campaign,action);assert.equal(returned.sectorStates.buenos_aires.units.find(u=>u.id===wounded.id).hp,8);
 assert.equal(visit(saved({campaign:returned}).campaign).battle.units.find(u=>u.id===wounded.id).hp,8);
 for(const patch of [{hp:9},{hp:80,unconscious:false},{id:'extra-enemy'}]){
  const forged=structuredClone(action),unit=forged.sectorState.units.find(u=>u.id===wounded.id);Object.assign(unit,patch);unit.bandaged=unit.maxHp-unit.hp;refreshMilitaryCondition(unit);
  const rejected=dispatchCampaign(p.campaign,forged);assert.match(rejected.lastError,/enemigos del despliegue/);assert.deepEqual(rejected.sectorStates,p.campaign.sectorStates);
 }
 // A corpse cannot be a doctor or subsidize invented treatment. Every retained
 // body must also remain present in the atomic report, including unlooted gear.
 const corpse=p.battle.units.find(unit=>unit.side==='enemy'&&unit.hp===0&&unit.medkits>=2);assert.ok(corpse);
 for(const omit of [false,true]){
  const forged=structuredClone(action),unit=forged.sectorState.units.find(unit=>unit.id===wounded.id);
  unit.hp=9;unit.bandaged=unit.maxHp-unit.hp;refreshMilitaryCondition(unit);
  if(omit)forged.sectorState.units=forged.sectorState.units.filter(unit=>unit.id!==corpse.id);
  else forged.sectorState.units.find(unit=>unit.id===corpse.id).medkits--;
  const rejected=dispatchCampaign(p.campaign,forged);assert.match(rejected.lastError,/enemigos del despliegue/);
  assert.deepEqual({...rejected,lastError:null},{...p.campaign,lastError:null});
 }
 const omitted=structuredClone(action);omitted.sectorState.units=omitted.sectorState.units.filter(unit=>unit.id!==corpse.id);
 const rejected=dispatchCampaign(p.campaign,omitted);assert.match(rejected.lastError,/enemigos del despliegue/);assert.deepEqual({...rejected,lastError:null},{...p.campaign,lastError:null});
 const died=structuredClone(action),dead=died.sectorState.units.find(u=>u.id===wounded.id);Object.assign(dead,{hp:0,bandaged:0});refreshMilitaryCondition(dead);
 assert.equal(order(p.campaign,died).sectorStates.buenos_aires.units.find(u=>u.id===wounded.id).hp,0);
});
