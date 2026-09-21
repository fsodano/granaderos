import {hiredAssaultOrder} from './hired-assault-driver.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,isSupplied,rosterFor,contractQuote} from '../game/campaign.js';
import {fight} from './opening-driver.mjs';
import {actBattle} from '../game/tactical.js';
import {sameCell} from '../game/tactical-space.js';
import {syncBattleTime} from '../game/time.js';
import {prepareCampaignBattle} from '../game/battle-handoff.js';
import {encodeSave,decodeSave} from '../game/save.js';

const owned=c=>Object.entries(c.sectors).filter(([,s])=>s.owner==='patriot').map(([id])=>id).sort();

test('a hired-only squad earns its first expansion from Retiro and retains casualties and equipment on return',()=>{
 let c=initialCampaign(8);
 const order=action=>{c=dispatchCampaign(c,action);assert.equal(c.lastError,null,JSON.stringify(action)+': '+c.lastError);};
 assert.deepEqual(owned(c),['retiro']);assert.deepEqual(c.recruited,[]);
 // Ordinary day contracts and issued finite equipment; no free areas, custom
 // super-soldier, edited enemy stats, clock changes or post-hoc casualty removal.
 const hireIds=[128,142,123,115,131,110],quotedCost=hireIds.reduce((sum,id)=>sum+contractQuote(c,rosterFor(c).find(o=>o.id===id),'day').price,0);
 for(const id of hireIds)order({type:'recruitCivic',id,term:'day'});
 const hiredTreasury=c.resources.treasury;
 assert.equal(3200-hiredTreasury,quotedCost,'all six day contracts are paid from the starting treasury');
 // Four Baker rifles need forty issued loads; Retiro starts with thirty.
 // Buy the missing ten before departure so Funes receives a usable weapon.
 const rifleStock=c.resources.ammo_rifle_62,merchantStock=c.merchants.retiro.ammunition.rifle_62;
 order({type:'purchaseAmmunition',ammoType:'rifle_62',quantity:10});
 const stagingTreasury=c.resources.treasury;
 assert.equal(hiredTreasury-stagingTreasury,30);
 assert.equal(c.resources.ammo_rifle_62,rifleStock+10);
 assert.equal(c.merchants.retiro.ammunition.rifle_62,merchantStock-10);
 order({type:'attack',sector:'buenos_aires'});
 const request=structuredClone(c.pendingBattle);
 assert.equal(c.hour,12);assert.equal(c.officer,null);assert.deepEqual(owned(c),['retiro']);assert.equal(request.enemies.length,6);
 assert.ok(request.squad.every(u=>u.loaded===1&&u.ammo===9),'every hire draws its ten real matching loads');
 const orders=[];
 let {battle,actions}=fight(request,undefined,{controller:(b,u)=>{
  const action=hiredAssaultOrder(b,u);
  if(action)orders.push(action);
  return action;
 }});
 assert.equal(battle.status,'victory');assert.ok(actions>0);assert.ok(battle.turn>1);
 assert.equal(battle.width,64);assert.equal(battle.height,48,'the squad must fight on the full authored map');
 assert.ok(orders.filter(a=>a.type==='fire').length>request.squad.length,'the assault requires more than the issued opening volley');
 assert.ok(orders.some(a=>a.type==='reload'),'finite ammunition must be reloaded during combat');
 assert.ok(orders.some(a=>a.type==='fire'&&a.hitLocation==='head'));
 assert.deepEqual(battle.npcs.map(n=>n.id).sort(),request.npcs.map(n=>n.id).sort(),'the assault retains every real civilian');
 assert.ok(orders.some(a=>a.type==='stance'&&a.stance==='crouched'));
 assert.ok(!orders.some(a=>a.type==='stance'&&a.stance==='prone'));
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
 assert.ok(dead.length>0,'the earned victory retains its actual deaths');
 assert.ok(survivors.some(u=>u.hp<request.squad.find(initial=>String(initial.id)===u.id).hp),'wounded survivors must retain their actual injuries');
 assert.ok(survivors.length>0);
 const pair=syncBattleTime(c,battle);assert.equal(pair.error,null);
 const saved=decodeSave(encodeSave(pair.campaign,pair.battle));
 assert.deepEqual(saved.battle,pair.battle);c=saved.campaign;
 order({type:'battleResult',battleId:request.id,outcome:'victory',survivors:saved.battle.units.filter(u=>u.side==='player'),sectorState:saved.battle});
 assert.deepEqual(owned(c),['buenos_aires','retiro']);assert.equal(c.location,'buenos_aires');assert.equal(c.officer,null);
 assert.equal(isSupplied(c,'buenos_aires'),true);assert.equal(c.sectors.ensenada.owner,'royalist');
 assert.ok(c.resources.treasury>=0&&stagingTreasury<3200);
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
 const secondOfHour=c.secondOfHour,treasury=c.resources.treasury;
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
 assert.equal(c.resources.treasury,treasury,'revisiting the battlefield cannot grant another victory reward');
 assert.deepEqual(owned(c),['buenos_aires','retiro']);assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
});
