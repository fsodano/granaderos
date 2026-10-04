import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor,recruitmentStatus} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {civilianIncidents} from '../game/civilian-harm.js';
import {totalReserveAmmunition} from '../game/ammunition-types.js';
import {enterSector} from '../game/world.js';
import {canSee} from '../game/tactical.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {serviceReturnSources} from '../game/service-equipment-return.js';
import {readItemStack} from '../game/tactical-inventory.js';
import {preparedConductArena,performConductEvent,executePaidConductRoute,conductActor,conductWitness,conductCivilian,conductOrder,conductStep,saveConductPair} from './conduct-objections-fixture.mjs';

const now=state=>state.hour*3600+(state.secondOfHour??0);
const rounds=unit=>unit.loaded+totalReserveAmmunition(unit);
const objection={kind:'civilian-killing',civilianKey:'npc-local-buenos_aires',attackerId:'100'};
const complaints=b=>b.log.filter(line=>line.includes('No acepto la muerte de'));
const letters=c=>(c.correspondence??[]).filter(message=>message.id==='service-objection:107');
const packets=stacks=>stacks.map(stack=>JSON.stringify(stack)).sort();
function reject(campaign,action){
 const original=structuredClone(campaign),rejected=dispatchCampaign(campaign,action);assert.ok(rejected.lastError,action.type);
 assert.deepEqual(campaign,original);assert.deepEqual({...rejected,lastError:null},{...campaign,lastError:null});return rejected.lastError;
}
function gear(campaign,id){
 const model=sectorInventoryModel(campaign,'retiro',rosterFor(campaign),id);assert.ok(model.personal);
 return model.carried.map(row=>readItemStack(model.personal,row.item,row.count));
}
function returnedGear(campaign){
 return [...(campaign.sectorStates.retiro?.groundItems??[]).filter(item=>item.id.startsWith('service-return-')).map(({id,type,x,y,tacticalLevel,knownToPlayer,...stack})=>stack),
  ...serviceReturnSources(campaign,'retiro').filter(row=>row.stack).map(row=>row.stack)];
}
function advanceTo(campaign,target,history){
 for(let i=0;i<40&&now(campaign)<target;i++){
  const action={type:'advanceStrategicTime',seconds:Math.min(3600,target-now(campaign))};
  const before=now(campaign);campaign=conductOrder(campaign,action);assert.ok(now(campaign)>before,'the actual clock must progress through its warning stops');history?.push(action);
  campaign=saveConductPair({campaign}).campaign;
 }
 assert.equal(now(campaign),target);return campaign;
}

test('paid native observed conduct objection survives replay and serves its full term before one finite gear return',t=>{
 const setup=preparedConductArena(),initial=structuredClone(setup.start),terms=structuredClone(initial.campaign.contracts),issued=initial.battle.units.filter(unit=>unit.side==='player');
 assert.deepEqual(setup.prices,[{id:107,price:84},{id:100,price:36}]);assert.deepEqual(initial.battle.conductObserverIds,[107]);assert.equal(conductCivilian(initial.battle).noncombatant,true);
 const result=executePaidConductRoute(initial),{pair,history}=result;
 assert.deepEqual(setup.start,initial);assert.deepEqual(conductWitness(pair.battle).serviceObjection,objection);
 for(const checkpoint of result.checkpoints.slice(0,-1))assert.equal(conductWitness(checkpoint.battle).serviceObjection,undefined,'a wound is not a direct fatal act');
 const death=civilianIncidents(conductCivilian(pair.battle)).at(-1);
 assert.deepEqual(death,{sequence:2,kind:'death',attackerId:'100',side:'player',militia:false,intentional:true,hpBefore:4,hpAfter:0});
 assert.deepEqual(complaints(pair.battle),['Inés Aguirre: No acepto la muerte de Administrador del puerto. Cumpliré el plazo pagado, pero no aceptaré otro contrato.']);
 assert.equal(pair.battle.seed,42);assert.equal(pair.battle.elapsedSeconds,29);assert.equal(pair.battle.status,'retreat');
 for(const unit of issued){const actual=pair.battle.units.find(actor=>actor.id===unit.id);assert.equal(actual.hp,unit.hp);assert.equal(actual.bleeding,0);assert.equal(rounds(actual),rounds(unit));assert.equal(actual.condition,unit.condition);assert.equal(actual.bladeCondition,unit.bladeCondition);assert.deepEqual(actual.inventory,unit.inventory);}
 assert.equal(pair.campaign.operativeState[107].serviceObjection,undefined,'the issued receipt is returned through the real settlement');
 assert.deepEqual(pair.campaign.pendingBattle.squad.find(unit=>unit.id===107).serviceObjection,objection);
 assert.equal(letters(pair.campaign).length,0);reject(pair.campaign,{type:'renewContract',id:107,term:'day'});
 const pendingQuote=contractQuote(pair.campaign,rosterFor(pair.campaign).find(actor=>actor.id===107),'day');assert.equal(pendingQuote.available,false);assert.match(pendingQuote.reason,/presenciar|civil/);
 let replay=saveConductPair(initial);for(const action of history)replay=conductStep(replay,action);assert.deepEqual(replay,pair,'all strikes, paid moves and exits replay through official saved pairs');
 let campaign=result.returned;assert.deepEqual(campaign.contracts,terms);assert.equal(campaign.resources.treasury,3080);assert.deepEqual(campaign.operativeState[107].serviceObjection,objection);
 assert.deepEqual(letters(campaign),[{id:'service-objection:107',sender:'Inés Aguirre',subject:'Una objeción al mando',text:'Vi la muerte de Administrador del puerto. No acepto esa orden. Cumpliré el plazo pagado, pero no aceptaré otro contrato.',hour:18,received:true}]);
 const letter=structuredClone(letters(campaign)[0]);assert.equal(campaign.operativeState[107].alive,true);assert.equal(campaign.operativeState[100].alive,true);
 reject(campaign,{type:'battleResult',battleId:pair.campaign.pendingBattle.id,outcome:'retreat',sectorState:pair.battle,survivors:pair.battle.units.filter(unit=>unit.side==='player')});
 assert.match(reject(campaign,{type:'renewContract',id:107,term:'day'}),/presenciar|civil/);assert.equal(contractQuote(campaign,rosterFor(campaign).find(actor=>actor.id===107),'day').available,false);
 // Ordinary local entries retain the receipt and finite issue. Discovering a
 // retained death or completing another scene cannot issue a second complaint.
 for(let i=0;i<2;i++){
  campaign=conductOrder(saveConductPair({campaign}).campaign,{type:'visitSector'});let local=saveConductPair({campaign,battle:enterSector(campaign.pendingBattle,campaign.sectorStates.retiro)});
  assert.deepEqual(conductWitness(local.battle).serviceObjection,objection);assert.equal(rounds(conductWitness(local.battle)),10);
  const actor=conductWitness(local.battle);local=conductStep(local,{type:'look',unitId:actor.id,x:actor.x+(actor.facing===2?-1:1),y:actor.y});assert.equal(complaints(local.battle).length,0);
  campaign=conductOrder(local.campaign,{type:'leaveSector',battleId:local.campaign.pendingBattle.id,sectorState:local.battle,survivors:local.battle.units.filter(actor=>actor.side==='player')});
  assert.deepEqual(letters(campaign),[letter]);assert.deepEqual(campaign.contracts,terms);assert.equal(campaign.operativeState[107].hp,72);assert.equal(campaign.operativeState[100].hp,70);
 }
 const expectedGear=packets([...gear(campaign,107),...gear(campaign,100)]),expiry=contractExpiresSeconds(campaign.contracts[107]),beforeWaiting=saveConductPair({campaign}).campaign,clockOrders=[];
 assert.equal(expiry,30*3600);assert.equal(returnedGear(campaign).length,0);
 campaign=advanceTo(campaign,expiry-1,clockOrders);assert.ok(campaign.recruited.includes(107));assert.deepEqual(campaign.contracts[107],terms[107]);assert.equal(returnedGear(campaign).length,0);
 const lastSecond={type:'advanceStrategicTime',seconds:1};campaign=conductOrder(campaign,lastSecond);clockOrders.push(lastSecond);campaign=saveConductPair({campaign}).campaign;
 assert.equal(now(campaign),expiry);assert.equal(campaign.recruited.includes(107),false);assert.equal(campaign.recruited.includes(100),false);assert.equal(campaign.contracts[107],undefined);
 assert.equal(campaign.operativeState[107].alive,true);assert.equal(campaign.operativeState[107].hp,72);assert.deepEqual(campaign.operativeState[107].serviceObjection,objection);
 assert.equal(campaign.resources.treasury,3080);assert.deepEqual(packets(returnedGear(campaign)),expectedGear,'every original physical record returns once at the actual Retiro location');
 assert.equal(campaign.loadouts[107].weapon,0);assert.equal(campaign.operativeState[107].carriedAmmo,0);
 assert.equal(recruitmentStatus(campaign,107).available,false);assert.match(reject(campaign,{type:'recruitCivic',id:107,term:'day'}),/presenciar|civil/);
 let clockReplay=beforeWaiting;for(const action of clockOrders)clockReplay=saveConductPair({campaign:conductOrder(clockReplay,action)}).campaign;assert.deepEqual(clockReplay,campaign,'warning and exact expiry replay without an early discharge');
 const stocks=structuredClone(returnedGear(campaign));campaign=conductOrder(campaign,{type:'advanceStrategicTime',seconds:1});assert.deepEqual(returnedGear(campaign),stocks);assert.deepEqual(letters(campaign),[letter]);assert.deepEqual(saveConductPair({campaign}).campaign,campaign);
 t.diagnostic(JSON.stringify({scenario:'Declared flat BA observation arena; native force and port resident, not an opening victory',prices:setup.prices,treasury:campaign.resources.treasury,arrivalHour:6,arenaHour:18,orders:history.length,actionSeconds:pair.battle.elapsedSeconds,seed:pair.battle.seed,HP:{107:72,100:70},rounds:{107:rounds(conductWitness(pair.battle)),100:rounds(conductActor(pair.battle))},civilian:death,paidExpiry:expiry,clockOrders:clockOrders.length,returnedStacks:stocks.length,complaints:complaints(pair.battle).length,letters:letters(campaign).length}));
});

test('old pinned omission and a physically unobserved killing remain neutral through real saved orders',t=>{
 const observed=preparedConductArena(),reference=performConductEvent(observed.start),receipts=[];
 for(const options of [{oldPinned:true},{hiddenWitness:true}]){
  const setup=preparedConductArena(options),result=performConductEvent(setup.start);let pair=result.pair;
  assert.equal(conductCivilian(pair.battle).hp,0);assert.equal(conductWitness(pair.battle).serviceObjection,undefined);assert.equal(complaints(pair.battle).length,0);assert.equal(letters(pair.campaign).length,0);
  assert.deepEqual(civilianIncidents(conductCivilian(pair.battle)),civilianIncidents(conductCivilian(reference.pair.battle)));
  assert.equal(pair.battle.seed,reference.pair.battle.seed);assert.equal(pair.battle.elapsedSeconds,reference.pair.battle.elapsedSeconds);assert.deepEqual(conductActor(pair.battle),conductActor(reference.pair.battle));
  let replay=saveConductPair(setup.start);for(const action of result.history)replay=conductStep(replay,action);assert.deepEqual(replay,pair);
  if(options.hiddenWitness){
   assert.equal(canSee(pair.battle,conductWitness(pair.battle),conductCivilian(pair.battle)),false);
   pair=conductStep(pair,{type:'move',unitId:'107',x:6,y:3});pair=conductStep(pair,{type:'look',unitId:'107',x:3,y:3});
   assert.equal(canSee(pair.battle,conductWitness(pair.battle),conductCivilian(pair.battle)),true);assert.equal(conductWitness(pair.battle).serviceObjection,undefined,'later observation of the corpse cannot backfill a witnessed act');
  }
  assert.equal(contractQuote(pair.campaign,rosterFor(pair.campaign).find(actor=>actor.id===107),'day').available,true);assert.equal(complaints(pair.battle).length,0);
  receipts.push({control:options,seconds:pair.battle.elapsedSeconds,seed:pair.battle.seed,rounds:rounds(conductWitness(pair.battle)),civilianHP:conductCivilian(pair.battle).hp});
 }
 t.diagnostic(JSON.stringify({controls:'Both geometry/content controls declared before initial official save; no health, gear, seed or outcome changes during execution',receipts}));
});
