import {hiredAssaultOrder} from './hired-assault-driver.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,isSupplied,rosterFor,contractQuote,deploymentCost} from '../game/campaign.js';
import {fight} from './opening-driver.mjs';
import {actBattle,endTurn,teamCanSee} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {ammoCount} from '../game/ammo-types.js';
import {ammunitionOrderQuote} from '../game/campaign-ammunition.js';
import {sameCell} from '../game/tactical-space.js';
import {syncBattleTime} from '../game/time.js';
import {prepareCampaignBattle} from '../game/battle-handoff.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {travelLegHours} from '../game/squad-travel.js';

const owned=c=>Object.entries(c.sectors).filter(([,s])=>s.owner==='patriot').map(([id])=>id).sort();
const assaultHireIds=[128,142,123,115,131,110];
function explicitlyFundedAssaultCampaign(){
 const campaign=initialCampaign(8),workingReserve=campaign.resources.treasury;
 const quotedCost=assaultHireIds.reduce((sum,id)=>sum+contractQuote(campaign,rosterFor(campaign).find(o=>o.id===id),'day').price,0);
 assert.ok(quotedCost>workingReserve,'the stock starting budget cannot buy this six-person specialist force');
 // This combat/return fixture prepays the actual hiring quotes and retains
 // the stock budget as a finite supply reserve. It is not a new-start claim.
 campaign.resources.treasury=quotedCost+workingReserve;
 return {campaign,quotedCost,workingReserve};
}

test('an explicitly funded hired-only squad earns its first expansion from Retiro and retains injuries and equipment on return',()=>{
 const prepared=explicitlyFundedAssaultCampaign();let c=prepared.campaign;const fundedTreasury=c.resources.treasury;
 const order=action=>{c=dispatchCampaign(c,action);assert.equal(c.lastError,null,JSON.stringify(action)+': '+c.lastError);};
 assert.deepEqual(owned(c),['retiro']);assert.deepEqual(c.recruited,[]);
 // Ordinary paid day contracts and issued finite equipment. The declared
 // force still earns expansion through real orders on the authored map.
 for(const id of assaultHireIds)order({type:'recruitCivic',id,term:'day'});
 const hiredTreasury=c.resources.treasury;
 assert.equal(fundedTreasury-hiredTreasury,prepared.quotedCost,'all six day contracts pay their actual quotes');assert.equal(hiredTreasury,prepared.workingReserve);
 // Each initial hire carries one finite service allowance; entry buys nothing.
 const stagingTreasury=c.resources.treasury,carriedBefore=Object.fromEntries(c.squad.map(id=>[id,c.operativeState[id].carriedAmmo]));
 assert.ok(Object.values(carriedBefore).every(count=>count===10));
 const daylight=(12-c.hour%24-travelLegHours(c.location,'buenos_aires')+24)%24;
 if(daylight)order({type:'wait',hours:daylight});
 order({type:'attack',sector:'buenos_aires'});
 const request=structuredClone(c.pendingBattle);
 assert.equal(c.hour,12);assert.equal(c.officer,null);assert.deepEqual(owned(c),['retiro']);assert.equal(request.enemies.length,4);
 assert.ok(request.squad.every(u=>u.loaded===1&&u.ammo===9),'every hire draws its ten real matching loads');
 const orders=[];
 const result=fight(request,undefined,{controller:(b,u)=>{
  const action=hiredAssaultOrder(b,u);
  if(action)orders.push(action);
  return action;
 }});let {battle,actions}=result;
 assert.equal(battle.status,'victory');assert.ok(actions>0);assert.ok(battle.turn>1);
 assert.equal(battle.width,64);assert.equal(battle.height,48,'the squad must fight on the full authored map');
 assert.ok(orders.filter(a=>a.type==='fire').length>request.squad.length,'the assault requires more than the issued opening volley');
 assert.ok(orders.some(a=>a.type==='reload'),'finite ammunition must be reloaded during combat');
 assert.ok(orders.some(a=>a.type==='fire'&&a.hitLocation==='head'));
 assert.deepEqual(battle.npcs.map(n=>n.id).sort(),request.npcs.map(n=>n.id).sort(),'the assault retains every real civilian');
 assert.ok(orders.some(a=>a.type==='stance'&&a.stance==='prone'),'the squad pays for its current useful firing posture');
 let replay=enterSector(request);
 for(let index=0;index<result.orders.length;index++){
  const action=result.orders[index];
  if(action.type==='fire')assert.equal(teamCanSee(replay,'player',replay.units.find(unit=>unit.id===action.targetId)),true);
  replay=action.type==='endTurn'?endTurn(replay):actBattle(replay,action);assert.equal(replay.lastError,null,JSON.stringify(action));
  if(index===Math.floor(result.orders.length/2))replay=validateBattleSnapshot(JSON.parse(JSON.stringify(replay)));
 }
 assert.deepEqual(replay,battle,'all real orders replay exactly across a tactical save');
 // The changed firing lanes need not produce the former rout. Exercise a
 // real field-weapon transaction after the earned victory instead of forcing
 // a particular survivor to panic or assigning a weapon directly to the map.
 const donor=battle.units.find(u=>u.side==='player'&&u.hp>=15&&!u.unconscious&&!u.routed&&!u.weaponDropped&&u.loaded>0);
 assert.ok(donor);const carried={weapon:donor.weapon,condition:donor.condition,loaded:donor.loaded,instanceId:donor.weaponInstanceId};
 battle=actBattle(battle,{type:'explore'});assert.equal(battle.lastError,null);assert.equal(battle.sectorCleared,true);
 battle=actBattle(battle,{type:'drop',unitId:donor.id,item:'primary'});assert.equal(battle.lastError,null);
 const fieldWeapon=battle.groundItems.find(g=>g.item==='weapon'&&g.weapon===carried.weapon&&sameCell(g,donor));
 assert.ok(fieldWeapon);assert.ok(fieldWeapon.id);assert.equal(fieldWeapon.count,1);assert.equal(fieldWeapon.condition,carried.condition);assert.equal(fieldWeapon.loaded,carried.loaded);
 assert.equal(battle.units.find(u=>u.id===donor.id).loaded,0,'dropping the loaded firearm cannot leave its charge with the soldier');
 if(carried.instanceId!==undefined)assert.equal(fieldWeapon.instanceId,carried.instanceId);
 const players=battle.units.filter(u=>u.side==='player'),dead=players.filter(u=>u.hp<=0),survivors=players.filter(u=>u.hp>0);
 assert.ok(players.some(u=>u.hp<request.squad.find(initial=>String(initial.id)===u.id).hp),'the assault must retain its actual wounds');
 // The four-enemy opening can be won without deaths. Preserve every actual
 // participant; casualty settlement has explicit coverage in battle-report.
 assert.equal(players.length,request.squad.length);
 assert.deepEqual(players.map(u=>u.id).sort(),request.squad.map(u=>String(u.id)).sort());
 assert.ok(survivors.some(u=>u.hp<request.squad.find(initial=>String(initial.id)===u.id).hp),'wounded survivors must retain their actual injuries');
 assert.ok(survivors.length>0);
 const pair=syncBattleTime(c,battle);assert.equal(pair.error,null);
 const saved=decodeSave(encodeSave(pair.campaign,pair.battle));
 assert.deepEqual(saved.battle,pair.battle);c=saved.campaign;
 order({type:'battleResult',battleId:request.id,outcome:'victory',survivors:saved.battle.units.filter(u=>u.side==='player'),sectorState:saved.battle});
 assert.deepEqual(owned(c),['buenos_aires','retiro']);assert.equal(c.location,'buenos_aires');assert.equal(c.officer,null);
 assert.equal(isSupplied(c,'buenos_aires'),true);assert.equal(c.sectors.ensenada.owner,'royalist');
 assert.ok(c.resources.treasury>=0&&stagingTreasury===prepared.workingReserve);
 for(const u of dead){assert.equal(c.operativeState[u.id].alive,false);assert.ok(!c.squad.includes(Number(u.id)));}
 for(const u of survivors){
  const r=c.operativeState[u.id];assert.equal(r.hp,u.hp);
  assert.equal(Boolean(r.weaponDropped),Boolean(u.weaponDropped));
  assert.equal(r.carriedLoaded,u.weaponDropped?undefined:u.loaded,'a dropped rifle must stay on the field, not return as an empty carried weapon');
  assert.equal(r.condition,u.condition);assert.equal(r.medkits,u.medkits);assert.equal(r.jammed,u.jammed);
 }
 const dropped=battle.droppedWeapons.filter(g=>players.some(u=>u.id===g.unitId));
 assert.deepEqual(c.sectorStates.buenos_aires.droppedWeapons.filter(g=>players.some(u=>u.id===g.unitId)),dropped);
 assert.deepEqual(c.sectorStates.buenos_aires.groundItems.find(g=>g.id===fieldWeapon.id),fieldWeapon,'the actual discarded weapon stays in the sector with its finite load');
 const restored=decodeSave(encodeSave(c));assert.deepEqual(restored.campaign,c);c=restored.campaign;
 const secondOfHour=c.secondOfHour,treasury=c.resources.treasury,reentryCost=deploymentCost(c);
 order({type:'visitSector'});const visit=prepareCampaignBattle(c);assert.equal(visit.error,null);
 assert.equal(visit.battle.mode,'exploration');assert.equal(visit.battle.sectorCleared,true);
 assert.equal(visit.campaign.hour,c.hour);assert.equal(visit.campaign.secondOfHour,secondOfHour);
 assert.deepEqual(visit.battle.droppedWeapons.filter(g=>players.some(u=>u.id===g.unitId)),dropped,'reentry preserves the exact abandoned guns and their ammunition');
 assert.deepEqual(visit.battle.groundItems.find(g=>g.id===fieldWeapon.id),fieldWeapon);
 assert.equal(visit.battle.groundItems.filter(g=>g.id===fieldWeapon.id).length,1);
 for(const u of dead){const body=visit.battle.units.find(v=>v.id===u.id);assert.ok(body);assert.equal(body.hp,0);assert.equal(body.weapon,u.weapon);assert.equal(body.loaded,u.loaded);}
 for(const u of survivors){const actor=visit.battle.units.find(v=>v.id===u.id);assert.equal(actor.hp,u.hp);assert.equal(actor.loaded,u.loaded);assert.equal(Boolean(actor.weaponDropped),Boolean(u.weaponDropped));assert.equal(actor.condition,u.condition);assert.equal(actor.jammed,u.jammed);}
 const visitSave=decodeSave(encodeSave(visit.campaign,visit.battle));c=visitSave.campaign;
 order({type:'leaveSector',battleId:c.pendingBattle.id,survivors:visitSave.battle.units.filter(u=>u.side==='player'),sectorState:visitSave.battle});
 assert.equal(c.resources.treasury,treasury-reentryCost,'reentry has no charge and cannot refill spent ammunition');
 assert.deepEqual(owned(c),['buenos_aires','retiro']);assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
});
