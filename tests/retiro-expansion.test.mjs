import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,isSupplied} from '../game/campaign.js';
import {combatOrder,fight} from './opening-driver.mjs';
import {actionCosts,canSee,hasLineOfSight,shotChance} from '../game/tactical.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {syncBattleTime} from '../game/time.js';
import {prepareCampaignBattle} from '../game/battle-handoff.js';
import {encodeSave,decodeSave} from '../game/save.js';

const owned=c=>Object.entries(c.sectors).filter(([,s])=>s.owner==='patriot').map(([id])=>id).sort();

function hiredAssaultOrder(b,u){
 const action=combatOrder(b,u);
 if(action?.type!=='stance'||action.stance!=='prone')return action;
 // Baker rifles take 105 PA to reload prone, against 70 PA kneeling. Keep
 // these muzzle-loaders crouched so the next volley need not wait two turns.
 // The shared controller still supplies reconnaissance, aid and maintenance.
 if(u.stance==='standing')return {...action,stance:'crouched'};
 const active=v=>v.hp>0&&!v.departure&&!v.surrendered&&!v.unconscious&&!v.routed;
 const observers=b.units.filter(v=>v.side===u.side&&active(v)&&v.hp>=15);
 const target=b.units.filter(v=>v.side!==u.side&&active(v)&&hasLineOfSight(b,u,v)&&observers.some(p=>canSee(b,p,v)))
  .sort((a,c)=>shotChance(b,u,c,4)-shotChance(b,u,a,4))[0];
 assert.ok(target,'a proposed firing posture must have an observed target');
 const cost=actionCosts(b,u,target);
 let aim=Math.min(4,Math.floor((u.ap-cost.fire)/cost.aim));
 const chance=shotChance(b,u,target,aim);
 while(aim>0&&shotChance(b,u,target,aim-1)===chance)aim--;
 if(chance>=25)return {type:'fire',unitId:u.id,targetId:target.id,aim};
 const automatic=chooseEnemyAction(b,u);
 return automatic?.type==='charge'?null:automatic;
}

test('a hired-only squad earns its first expansion from Retiro and retains casualties and equipment on return',()=>{
 let c=initialCampaign(8);
 const order=action=>{c=dispatchCampaign(c,action);assert.equal(c.lastError,null,JSON.stringify(action)+': '+c.lastError);};
 assert.deepEqual(owned(c),['retiro']);assert.deepEqual(c.recruited,[]);
 // Ordinary day contracts and issued finite equipment; no free areas, custom
 // super-soldier, edited enemy stats, clock changes or post-hoc casualty removal.
 for(const id of [128,142,123,115,131,110])order({type:'recruitCivic',id,term:'day'});
 const stagingTreasury=c.resources.treasury;
 assert.equal(3200-stagingTreasury,155,'all six day contracts are paid from the starting treasury');
 order({type:'attack',sector:'buenos_aires'});
 const request=structuredClone(c.pendingBattle);
 assert.equal(c.hour,12);assert.equal(c.officer,null);assert.deepEqual(owned(c),['retiro']);assert.equal(request.enemies.length,6);
 const orders=[];
 const {battle,actions}=fight(request,undefined,{controller:(b,u)=>{
  const action=hiredAssaultOrder(b,u);
  if(action)orders.push(action);
  return action;
 }});
 assert.equal(battle.status,'victory');assert.ok(actions>0);assert.ok(battle.turn>1);
 assert.equal(battle.width,64);assert.equal(battle.height,48,'the squad must fight on the full authored map');
 assert.ok(orders.filter(a=>a.type==='fire').length>request.squad.length,'the assault requires more than the issued opening volley');
 assert.ok(orders.some(a=>a.type==='reload'),'finite ammunition must be reloaded during combat');
 assert.ok(orders.some(a=>a.type==='stance'&&a.stance==='crouched'));
 assert.ok(!orders.some(a=>a.type==='stance'&&a.stance==='prone'));
 const players=battle.units.filter(u=>u.side==='player'),dead=players.filter(u=>u.hp<=0),survivors=players.filter(u=>u.hp>0);
 assert.ok(dead.length>0,'the regression keeps the actual cost of the assault');
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
 assert.ok(dropped.length>0,'the rout leaves actual weapons on the battlefield');
 assert.deepEqual(c.sectorStates.buenos_aires.droppedWeapons.filter(g=>players.some(u=>u.id===g.unitId)),dropped);
 const restored=decodeSave(encodeSave(c));assert.deepEqual(restored.campaign,c);c=restored.campaign;
 const secondOfHour=c.secondOfHour,treasury=c.resources.treasury;
 order({type:'visitSector'});const visit=prepareCampaignBattle(c);assert.equal(visit.error,null);
 assert.equal(visit.battle.mode,'exploration');assert.equal(visit.battle.sectorCleared,true);
 assert.equal(visit.campaign.hour,c.hour);assert.equal(visit.campaign.secondOfHour,secondOfHour);
 assert.deepEqual(visit.battle.droppedWeapons.filter(g=>players.some(u=>u.id===g.unitId)),dropped,'reentry preserves the exact abandoned guns and their ammunition');
 for(const u of dead){const body=visit.battle.units.find(v=>v.id===u.id);assert.ok(body);assert.equal(body.hp,0);assert.equal(body.weapon,u.weapon);assert.equal(body.loaded,u.loaded);}
 for(const u of survivors){const actor=visit.battle.units.find(v=>v.id===u.id);assert.equal(actor.hp,u.hp);assert.equal(actor.loaded,u.loaded);assert.equal(Boolean(actor.weaponDropped),Boolean(u.weaponDropped));assert.equal(actor.condition,u.condition);assert.equal(actor.jammed,u.jammed);}
 const visitSave=decodeSave(encodeSave(visit.campaign,visit.battle));c=visitSave.campaign;
 order({type:'leaveSector',battleId:c.pendingBattle.id,survivors:visitSave.battle.units.filter(u=>u.side==='player'),sectorState:visitSave.battle});
 assert.equal(c.resources.treasury,treasury,'revisiting the battlefield cannot grant another victory reward');
 assert.deepEqual(owned(c),['buenos_aires','retiro']);assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
});
