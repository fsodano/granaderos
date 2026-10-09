import {secureArea} from './secured-area-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {battleFromRequest} from '../game/battle-handoff.js';
import {autoResolve} from '../game/auto-resolve.js';
import {actBattle,getReachable} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const ready=()=>order(secureArea(initialCampaign(8)),{type:'createOfficer',name:'Vigía del Norte',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});
const expectedNight=seconds=>seconds%86400<21600||seconds%86400>=72000;

test('peaceful deployments retain the exact campaign hour and seconds across day boundaries',()=>{
 for(const hour of [0,5,6,19,20,29,48]){
  const base=ready();base.hour=hour;base.secondOfHour=17;
  const c=order(base,{type:'visitSector'}),r=c.pendingBattle,b=enterSector(r);
  assert.equal(r.hour,hour);assert.equal(r.secondOfHour,17);assert.equal(b.startSeconds,hour*3600+17);assert.equal(b.enteredHour,hour);
  assert.equal(b.night,expectedNight(b.startSeconds));assert.deepEqual(b,battleFromRequest(r,c));
  const saved=decodeSave(encodeSave(c,b));assert.deepEqual(saved.battle,b);assert.equal(saved.campaign.pendingBattle.hour,hour);
 }
});

test('an ordinary assault captures arrival time and direct, manual and automatic combat share that origin',()=>{
 let c=order(ready(),{type:'travel',sector:'buenos_aires'});c.secondOfHour=73;
 c=order(c,{type:'attack',sector:'san_nicolas'});const r=c.pendingBattle,b=enterSector(r);
 assert.equal(c.hour,14);assert.equal(r.hour,14);assert.equal(r.secondOfHour,73);assert.equal(b.night,false);assert.equal(b.startSeconds,50473);
 assert.deepEqual(b,battleFromRequest(r,c));
 assert.deepEqual(b,battleFromRequest(r,{...c,hour:999,secondOfHour:0}),'a deployment origin does not drift with the caller clock');
 const result=autoResolve(r,null,{maxRounds:1});assert.equal(result.battle.startSeconds,b.startSeconds);
 assert.equal(result.battle.night,expectedNight(b.startSeconds+result.battle.elapsedSeconds));
 const pair=syncBattleTime(c,result.battle);assert.equal(pair.error,null);
 assert.equal(pair.campaign.hour*3600+pair.campaign.secondOfHour,result.battle.startSeconds+result.battle.elapsedSeconds);
 assert.deepEqual(decodeSave(encodeSave(pair.campaign,pair.battle)).battle,pair.battle);
});

test('the unmodified visit request crosses dawn during a paid step and saves the same clock once',()=>{
 let c=ready();c.hour=5;c.secondOfHour=3598;c=order(c,{type:'visitSector'});
 const b=enterSector(c.pendingBattle),u=b.units[0],step=getReachable(b,u).find(p=>p.path.length===1&&Math.abs(p.x-u.x)+Math.abs(p.y-u.y)===1);
 assert.equal(b.night,true);assert.ok(step);
 const moved=actBattle(b,{type:'move',unitId:u.id,x:step.x,y:step.y});assert.equal(moved.lastError,null);assert.equal(moved.night,false);
 const pair=syncBattleTime(c,moved);assert.equal(pair.error,null);assert.equal(pair.campaign.hour,6);assert.equal(pair.campaign.secondOfHour,1);
 const saved=decodeSave(encodeSave(pair.campaign,pair.battle));assert.deepEqual(syncBattleTime(saved.campaign,saved.battle).campaign,saved.campaign);
});

test('saved deployments reject malformed start times and a battle rebased to a different hour',()=>{
 const c=order(ready(),{type:'visitSector'}),b=enterSector(c.pendingBattle),raw=JSON.parse(encodeSave(c,b));
 for(const [key,value] of [['hour',-1],['hour',.5],['hour',null],['secondOfHour',-1],['secondOfHour',3600],['secondOfHour',.5],['secondOfHour',null]]){
  const bad=structuredClone(raw);bad.campaign.pendingBattle[key]=value;assert.throws(()=>decodeSave(JSON.stringify(bad)),/hora inicial/);
 }
 const shifted=structuredClone(raw);shifted.battle.startSeconds+=3600;assert.throws(()=>decodeSave(JSON.stringify(shifted)),/hora inicial/);
 const shiftedRequest=structuredClone(raw);shiftedRequest.campaign.pendingBattle.hour++;assert.throws(()=>decodeSave(JSON.stringify(shiftedRequest)),/hora inicial/);
});
