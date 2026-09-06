import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign} from '../game/campaign.js';import {enterSector} from '../game/world.js';import {actBattle,endTurn,getReachable} from '../game/tactical.js';import {syncBattleTime} from '../game/time.js';import {encodeSave,decodeSave} from '../game/save.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const visit=s=>{s=order(s,{type:'visitSector'});return {campaign:s,battle:enterSector({...s.pendingBattle,hour:s.hour,secondOfHour:s.secondOfHour??0})};};
test('actual exploration actions carry fractional time, dawn and synchronized save exactly once',()=>{
 let s=initialCampaign();s.hour=5;s.secondOfHour=3598;let pair=visit(s);const u=pair.battle.units[0],p=getReachable(pair.battle,u).find(p=>p.path.length===1);
 pair=syncBattleTime(pair.campaign,actBattle(pair.battle,{type:'move',unitId:u.id,x:p.x,y:p.y}));assert.equal(pair.error,null);assert.equal(pair.campaign.hour,6);assert.equal(pair.campaign.secondOfHour,1);assert.equal(pair.battle.night,false);
 const saved=decodeSave(encodeSave(pair.campaign,pair.battle)),again=syncBattleTime(saved.campaign,saved.battle);assert.deepEqual(again.campaign,saved.campaign);
 const invalid=actBattle(pair.battle,{type:'move',unitId:u.id,x:-1,y:-1});assert.equal(invalid.elapsedSeconds,pair.battle.elapsedSeconds);
});
test('midnight keeps deployed contracts and wounds until report while remote contracts expire',()=>{
 let s=initialCampaign();s=order(s,{type:'recruitCivic',id:100,term:'day'});s=order(s,{type:'recruitCivic',id:101,term:'day'});s=order(s,{type:'squad',ids:[3,4,10,100]});s=order(s,{type:'wait',hours:23});s.secondOfHour=3590;s.operativeState[100].hp=30;
 let pair=visit(s);pair=syncBattleTime(pair.campaign,endTurn(pair.battle));assert.equal(pair.error,null);assert.equal(pair.campaign.hour,24);assert.ok(pair.campaign.recruited.includes(100));assert.ok(!pair.campaign.recruited.includes(101));assert.equal(pair.campaign.operativeState[100].hp,30);assert.equal(pair.campaign.contracts[100].departurePending,true);assert.doesNotThrow(()=>decodeSave(encodeSave(pair.campaign,pair.battle)));
 const result=order(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});assert.ok(!result.recruited.includes(100));assert.equal(result.pendingBattle,null);
});
test('combat first action charges one round and end-turn does not double charge',()=>{
 let s=order(initialCampaign(),{type:'travel',sector:'buenos_aires'});s=order(s,{type:'attack',sector:'san_nicolas'});let b=enterSector({...s.pendingBattle,hour:s.hour});const u=b.units[0];b=actBattle(b,{type:'stance',unitId:u.id,stance:'prone'});assert.equal(b.elapsedSeconds,6);b=endTurn(b);assert.equal(b.elapsedSeconds,6);b=endTurn(b);assert.equal(b.elapsedSeconds,12);
});
test('occupied-sector raid waits until the deployed report is reconciled',()=>{
 let s=initialCampaign();s.hour=143;s.secondOfHour=3590;s.location='cordoba';s.squads[0].location='cordoba';s.sectors.cordoba.owner='patriot';s.sectors.cordoba.loyalty=10;
 let pair=visit(s);pair=syncBattleTime(pair.campaign,endTurn(pair.battle));assert.equal(pair.error,null);assert.ok(pair.campaign.deferredRaids.some(r=>r.target==='cordoba'));assert.equal(pair.campaign.sectors.cordoba.owner,'patriot');
 const result=order(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});assert.deepEqual(result.deferredRaids,[]);
});
test('torch lifetime uses elapsed seconds through resting and strategic re-entry',()=>{
 let pair=visit(initialCampaign());const u=pair.battle.units[0];pair=syncBattleTime(pair.campaign,actBattle(pair.battle,{type:'throwTorch',unitId:u.id,x:u.x+1,y:u.y}));assert.equal(pair.error,null);const torch=pair.battle.lights.find(l=>l.type==='torch');assert.ok(torch);const remaining=torch.remainingSeconds;
 pair=syncBattleTime(pair.campaign,endTurn(pair.battle));assert.equal(pair.battle.lights.find(l=>l.id===torch.id).remainingSeconds,remaining-600);
 let s=order(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});s=order(s,{type:'wait',hours:1});s=order(s,{type:'visitSector'});const b=enterSector({...s.pendingBattle,hour:s.hour,secondOfHour:s.secondOfHour},s.sectorStates.retiro);assert.equal(b.lights.find(l=>l.id===torch.id)?.remainingSeconds,remaining-4200);
});
test('mounted troops cross midnight without a separate horse simulation',()=>{
 let s=order(initialCampaign(),{type:'wait',hours:23});s.secondOfHour=3590;
 let pair=visit(s);pair.battle=actBattle(pair.battle,{type:'mount',unitId:3});assert.equal(pair.battle.lastError,null);
 pair=syncBattleTime(pair.campaign,endTurn(pair.battle));assert.equal(pair.error,null);assert.equal(pair.battle.units.find(u=>u.id==='3').mounted,true);assert.equal(pair.campaign.horseState,undefined);
});
test('stale clocks and mismatched deployment IDs cannot advance or load another battle',()=>{
 const pair=visit(initialCampaign());const advanced=syncBattleTime(pair.campaign,endTurn(pair.battle));assert.equal(advanced.error,null);assert.ok(syncBattleTime(advanced.campaign,pair.battle).error);assert.ok(syncBattleTime(pair.campaign,{...pair.battle,battleId:'other'}).error);
 const raw=JSON.parse(encodeSave(advanced.campaign,advanced.battle));raw.battle.syncedSeconds--;assert.throws(()=>decodeSave(JSON.stringify(raw)));
});
