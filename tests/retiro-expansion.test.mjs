import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,isSupplied} from '../game/campaign.js';
import {fight} from './opening-driver.mjs';
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
 for(const id of [128,142,123,115,131,110])order({type:'recruitCivic',id,term:'day'});
 const stagingTreasury=c.resources.treasury;
 order({type:'attack',sector:'buenos_aires'});
 const request=structuredClone(c.pendingBattle);
 assert.equal(c.hour,12);assert.equal(c.officer,null);assert.deepEqual(owned(c),['retiro']);assert.equal(request.enemies.length,6);
 const {battle,actions}=fight(request);
 assert.equal(battle.status,'victory');assert.ok(actions>0);assert.ok(battle.turn>1);
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
 for(const u of survivors){const r=c.operativeState[u.id];assert.equal(r.hp,u.hp);assert.equal(r.carriedLoaded,u.loaded);assert.equal(r.condition,u.condition);assert.equal(r.medkits,u.medkits);assert.equal(r.jammed,u.jammed);}
 const restored=decodeSave(encodeSave(c));assert.deepEqual(restored.campaign,c);c=restored.campaign;
 const secondOfHour=c.secondOfHour,treasury=c.resources.treasury;
 order({type:'visitSector'});const visit=prepareCampaignBattle(c);assert.equal(visit.error,null);
 assert.equal(visit.battle.mode,'exploration');assert.equal(visit.battle.sectorCleared,true);
 assert.equal(visit.campaign.hour,c.hour);assert.equal(visit.campaign.secondOfHour,secondOfHour);
 for(const u of dead){const body=visit.battle.units.find(v=>v.id===u.id);assert.ok(body);assert.equal(body.hp,0);assert.equal(body.weapon,u.weapon);assert.equal(body.loaded,u.loaded);}
 for(const u of survivors){const actor=visit.battle.units.find(v=>v.id===u.id);assert.equal(actor.hp,u.hp);assert.equal(actor.loaded,u.loaded);assert.equal(actor.condition,u.condition);assert.equal(actor.jammed,u.jammed);}
 const visitSave=decodeSave(encodeSave(visit.campaign,visit.battle));c=visitSave.campaign;
 order({type:'leaveSector',battleId:c.pendingBattle.id,survivors:visitSave.battle.units.filter(u=>u.side==='player'),sectorState:visitSave.battle});
 assert.equal(c.resources.treasury,treasury,'revisiting the battlefield cannot grant another victory reward');
 assert.deepEqual(owned(c),['buenos_aires','retiro']);assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
});
