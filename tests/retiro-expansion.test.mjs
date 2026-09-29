import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,contractQuote,rosterFor,isSupplied,deploymentCost} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {fight} from './coastal-route-driver.mjs';
import {encodeSave,decodeSave} from '../game/save.js';
import {syncBattleTime} from '../game/time.js';
import {enterSector} from '../game/world.js';
const owned=s=>Object.entries(s.sectors).filter(([,r])=>r.owner==='patriot').map(([id])=>id).sort();
for(const authored of [false,true])test(`Retiro-only hired squad earns Buenos Aires with real losses and saved return (${authored?'authored':'stock'})`,()=>{
 let s=initialCampaign(8,authored?defaultContentPackage():null);
 const order=a=>{s=dispatchCampaign(s,a);assert.equal(s.lastError,null,`${a.type}: ${s.lastError}`);};
 assert.deepEqual(owned(s),['retiro']);
 const ids=[128,142,123,115,131,110],price=ids.reduce((n,id)=>n+contractQuote(s,rosterFor(s).find(o=>o.id===id),'day').price,0);
 for(const id of ids)order({type:'recruitCivic',id,term:'day'});
 if(authored){assert.equal(s.phase,0);assert.deepEqual(s.recruited,[]);order({type:'wait',hours:6});}
 assert.equal(s.resources.treasury,3200-price);assert.equal(s.officer,null);assert.equal(s.phase,1);assert.deepEqual(s.squad,ids);
 order({type:'attack',sector:'buenos_aires'});const request=structuredClone(s.pendingBattle);
 assert.deepEqual(owned(s),['retiro']);assert.equal(request.enemies.length,6);assert.equal(s.resources.treasury,3200-price-request.issuedCartridges);
 const {battle,actions}=fight(request);assert.equal(battle.status,'victory');assert.ok(actions>ids.length);assert.ok(battle.turn>1);
 const players=battle.units.filter(u=>u.side==='player'),dead=players.filter(u=>u.hp<=0),survivors=players.filter(u=>u.hp>0);
 assert.ok(dead.length>0);assert.ok(survivors.length>0);assert.ok(players.reduce((n,u)=>n+u.loaded+u.ammo,0)<request.issuedCartridges);
 const synced=syncBattleTime(s,battle);assert.equal(synced.error,null);const saved=decodeSave(encodeSave(synced.campaign,synced.battle));assert.deepEqual(saved.battle,synced.battle);s=saved.campaign;
 order({type:'battleResult',battleId:request.id,outcome:saved.battle.status,sectorState:saved.battle,survivors:saved.battle.units.filter(u=>u.side==='player')});
 assert.deepEqual(owned(s),['buenos_aires','retiro']);assert.equal(isSupplied(s,'buenos_aires'),true);assert.equal(s.sectors.ensenada.owner,'royalist');
 for(const u of dead){assert.equal(s.operativeState[u.id].alive,false);assert.equal(s.operativeState[u.id].hp,0);assert.ok(!s.squad.includes(Number(u.id)));}
 for(const u of survivors){assert.equal(s.operativeState[u.id].hp,u.hp);assert.equal(s.operativeState[u.id].condition,u.condition);}
 const beforeSave=structuredClone(s);s=decodeSave(encodeSave(s)).campaign;assert.deepEqual(s,beforeSave);const cash=s.resources.treasury,shortfall=deploymentCost(s);
 order({type:'visitSector'});const revisited=enterSector(s.pendingBattle,s.sectorStates.buenos_aires);assert.equal(revisited.mode,'exploration');assert.equal(revisited.sectorCleared,true);
 for(const u of survivors)assert.equal(revisited.units.find(v=>v.id===u.id).hp,u.hp);
 for(const u of dead)assert.ok(!revisited.units.some(v=>v.id===u.id&&v.hp>0));
 const pair=decodeSave(encodeSave(s,revisited));s=pair.campaign;order({type:'leaveSector',battleId:s.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});
 assert.equal(s.resources.treasury,cash-shortfall,'peaceful reentry pays only its shortfall and preserves the owned rounds');assert.equal(s.squad.reduce((n,id)=>n+s.operativeState[id].ammo+s.operativeState[id].carriedLoaded,0),survivors.length*10);assert.deepEqual(owned(s),['buenos_aires','retiro']);assert.equal(s.officer,null);assert.deepEqual(decodeSave(encodeSave(s)).campaign,s);
});
