import assert from 'node:assert/strict';
import {ownedArtilleryCount} from '../game/campaign-artillery.js';
import {enterSector} from '../game/world.js';
import {autoBandageBattle} from '../game/auto-bandage.js';
import {order,saved,visit,sync,leave} from './local-contract-fixture.mjs';
import {freshNorthernRoute} from './fresh-northern-fixture.mjs';
import {assembleCreatedCuyo,prepareCreatedMendozaAssault} from './created-cuyo-route.mjs';
import {startFreshFoundry,prepareFreshArmyFunding,completeFreshArmyFunding} from './fresh-cuyo-route.mjs';
import {prepareFreshUspallataAssault,recoverFreshUspallata,prepareFreshLosPatosAssault,completeFreshAndesPreparation} from './fresh-mountain-route.mjs';
import {coastalBatteryController} from './coastal-command-driver.mjs';
import {fightNorthernSector} from './northern-route.mjs';
import {rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {extractItemQuantity} from '../game/tactical-inventory.js';
import {createdLosPatosBattery} from './created-los-patos-battery.mjs';

const deaths=c=>Object.entries(c.operativeState).filter(([,r])=>!r.alive).map(([id])=>Number(id));

// Continue a real new campaign. Preparation pays for the survivors, finite
// supplies and physical journeys; every battle is replayed and saved in full.
export function freshCuyoRoute({onCheckpoint,northernCheckpoint}={}){
 const prefix=northernCheckpoint?{campaign:northernCheckpoint,notes:[]}:freshNorthernRoute();
 assert.equal(prefix.campaign.phase,3);assert.equal(prefix.campaign.missions.yatasto.completed,true);assert.equal(prefix.campaign.flags.northPact,true);
 let c=assembleCreatedCuyo(prefix.campaign);const notes=[];
 const checkpoint=(stage,extra={})=>{
  c=saved({campaign:c}).campaign;
  const record={stage,hour:c.hour,second:c.secondOfHour,funds:c.resources.treasury,phase:c.phase,squad:[...c.squad],deaths:deaths(c),engineerHp:c.operativeState[2].hp,commanderHp:c.operativeState[57].hp,...extra};
  notes.push(record);onCheckpoint?.(stage,c,notes);
 };
 const fight=sector=>{
  assert.ok(c.pendingBattle);assert.equal(c.pendingBattle.sector,sector);
  const initial=enterSector(c.pendingBattle,c.sectorStates[sector]);
  const result=fightNorthernSector(c,sector,sector==='los_patos'?createdLosPatosBattery():{controller:coastalBatteryController(initial,{sharedArtillerySight:true})});
  c=result.campaign;assert.equal(c.defeated,false);assert.equal(c.sectors[sector].owner,'patriot');assert.equal(c.completed,false);
  checkpoint(sector,{actions:result.summary.actions,turns:result.summary.turns});
 };
 let shortTermSupport=[];
 c=prepareCreatedMendozaAssault(c,{report:event=>{if(event.event==='createdMendozaSupport')shortTermSupport=event.ids;}});fight('mendoza');
 assert.equal(c.operativeState[2].alive,true);assert.equal(c.operativeState[57].alive,true);assert.ok(!c.recruited.includes(57));
 const survivors=c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured&&c.operativeState[id].location==='mendoza');
 assert.ok(survivors.length>0);
 // Keep every actual survivor in a lawful local group. Treat the critical
 // group first, before foundry meetings or travel can advance the clock.
 const beforeFormation=structuredClone(c),groups=[];
 for(let offset=0;offset<survivors.length;offset+=6){
  const ids=survivors.slice(offset,offset+6);
  c=order(c,{type:'createSquad',name:'Socorro de Mendoza',ids,sector:'mendoza'});
  groups.push({id:c.activeSquadId,members:ids});
  assert.deepEqual(c.squads.find(q=>q.id===c.activeSquadId).members,ids);
  assert.ok(ids.length<=6);
 }
 assert.deepEqual(c.operativeState,beforeFormation.operativeState,'local formation keeps all wounds, health and locations');
 assert.deepEqual(c.loadouts,beforeFormation.loadouts);assert.deepEqual(c.contracts,beforeFormation.contracts);
 assert.equal(c.resources.treasury,beforeFormation.resources.treasury);assert.equal(c.hour,beforeFormation.hour);assert.equal(c.secondOfHour,beforeFormation.secondOfHour);
 const urgent=group=>group.members.some(id=>c.operativeState[id].hp<15||c.operativeState[id].bleeding>0);
 for(const group of [...groups].sort((a,b)=>Number(urgent(b))-Number(urgent(a)))){
  c=order(c,{type:'selectSquad',id:group.id});
  const p=visit(c),dressings=p.battle.units.filter(u=>u.side==='player').reduce((n,u)=>n+u.medkits,0),aid=autoBandageBattle(p.battle);
  assert.equal(aid.battle.lastError,null);
  const treatments=aid.steps.filter(action=>action.type==='useItem').length;
  assert.equal(aid.battle.units.filter(u=>u.side==='player').reduce((n,u)=>n+u.medkits,0),dressings-treatments,'first aid consumes one existing dressing per treatment');
  c=leave(sync({campaign:p.campaign,battle:aid.battle}));
  for(const id of group.members){assert.ok(c.operativeState[id].hp>=15);assert.equal(c.operativeState[id].bleeding,0);assert.equal(c.operativeState[id].location,'mendoza');}
  c=saved({campaign:c}).campaign;
 }
 c=order(c,{type:'selectSquad',id:groups[0].id});
 for(const id of survivors)assert.equal(c.operativeState[id].alive,true,'recovery does not discard overflow survivors');
 // End any short specialist service normally before the foundry wait.
 // Every exact carried item remains in Mendoza for collection.
 for(const supportId of shortTermSupport.filter(id=>survivors.includes(id))){
  const before=structuredClone(c),collectorId=survivors.find(id=>id!==supportId&&c.recruited.includes(id)&&c.operativeState[id].hp>=15&&!c.operativeState[id].asleep);
  assert.notEqual(collectorId,undefined);
  const model=sectorInventoryModel(c,'mendoza',rosterFor(c),supportId),kit=model.carried.map(row=>extractItemQuantity(model.personal,row.item,row.count).stack);
  const oldKeys=new Set(sectorInventoryModel(c,'mendoza',rosterFor(c),collectorId).entries.map(row=>row.key));
  assert.equal(c.contracts[supportId].kind,'paid');assert.equal(c.contracts[supportId].term,'day');
  c=order(c,{type:'dismiss',id:supportId});
  assert.equal(c.operativeState[supportId].alive,true);assert.ok(!c.recruited.includes(supportId));assert.equal(c.contracts[supportId],undefined);
  for(const key of ['hp','maxHp','bleeding','bandaged','energy','fatigue','morale','location'])assert.deepEqual(c.operativeState[supportId][key],before.operativeState[supportId][key],'ending service keeps the actual survivor condition');
  assert.equal(c.resources.treasury,before.resources.treasury);assert.equal(c.hour,before.hour);assert.equal(c.secondOfHour,before.secondOfHour);
  const returned=sectorInventoryModel(c,'mendoza',rosterFor(c),collectorId).entries.filter(row=>!oldKeys.has(row.key)).map(row=>JSON.parse(row.expected));
  const key=stack=>`${stack.item}:${stack.weapon??stack.outfit??stack.ammoType??''}`;
  const sorted=stacks=>[...stacks].sort((a,b)=>key(a).localeCompare(key(b)));
  assert.deepEqual(sorted(returned),sorted(kit),'every exact carried stack remains in the local return once');
  c=saved({campaign:c}).campaign;
 }
 c=startFreshFoundry(c);assert.equal(c.flags.foundry,true);assert.ok(c.recruited.includes(2)&&c.recruited.includes(7));
 c=completeFreshArmyFunding(prepareFreshArmyFunding(c));assert.equal(c.flags.armyFunded,true);assert.ok(ownedArtilleryCount(c)>=3);assert.equal(c.phase,3);checkpoint('funded',{artillery:ownedArtilleryCount(c)});
 c=prepareFreshUspallataAssault(c);fight('uspallata');
 c=prepareFreshLosPatosAssault(recoverFreshUspallata(c));fight('los_patos');
 assert.ok(!c.recruited.includes(57),'the commander joins through the subsequent physical meeting');
 c=completeFreshAndesPreparation(c);
 assert.equal(c.phase,4);assert.ok(c.recruited.includes(57));assert.equal(c.contracts[57].expiresAt,null);assert.equal(c.contracts[57].paid,0);assert.ok(c.squad.includes(57));assert.ok(c.operativeState[57].hp>0);
 for(const id of deaths(prefix.campaign))assert.equal(c.operativeState[id].alive,false);
 assert.ok(c.squad.every(id=>c.operativeState[id].alive));assert.equal(c.defeated,false);assert.equal(c.completed,false);assert.equal(c.pendingBattle,null);assert.ok(c.resources.treasury>=0);
 checkpoint('commander');return {campaign:c,notes,prefix:prefix.notes};
}
