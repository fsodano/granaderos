import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {contractQuote} from '../game/contracts.js';
import {createBattle,actBattle,presentedActBattle} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {expandCellScene} from '../game/cell-scene-storage.js';
import {ammoCount} from '../game/ammo-types.js';
import {performFreshMountainFirstAid} from './fresh-mountain-route.mjs';
import {leave} from './local-contract-fixture.mjs';

const save=p=>decodeSave(encodeSave(p.campaign,p.battle??null));
const order=(c,a)=>{const next=dispatchCampaign(c,a);assert.equal(next.lastError,null,next.lastError);return next;};
const actor=(b,id)=>b.units.find(u=>u.id===String(id));
const clock=c=>c.hour*3600+(c.secondOfHour??0);

function declaredCareArena(blocked){
 let c=initialCampaign(42,defaultContentPackage());const prices=[];
 for(const id of [130,100]){
  const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'day');assert.ok(quote.available);
  prices.push({id,price:quote.price});c=order(c,{type:'recruitCivic',id,term:'day'});
 }
 c=order(c,{type:'wait',hours:6});assert.ok([130,100].every(id=>c.recruited.includes(id)));
 // Declared post-arrival clinical fixture, not earned wounds or a campaign win.
 // All kit, ammunition, cash, skills, terms and seed remain the actual paid ones.
 // The initial full-width wall is the interruption control's only geometry change.
 const prepared=structuredClone(c);
 Object.assign(prepared.operativeState[130],{hp:55,bleeding:2,bandaged:0});
 Object.assign(prepared.operativeState[100],{hp:12,bleeding:1,bandaged:0});
 c=order(prepared,{type:'visitSector'});const r=c.pendingBattle,width=24,height=12;
 const battle=createBattle(r.squad.map(u=>({...u,x:u.id===130?1:5,y:2,facing:2})),{
  ...r,width,height,exploration:true,deferContact:true,props:[],buildings:[],decor:[],
  tiles:Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),
   ...(blocked&&i%width===3?{type:'wall',material:'stone',blocked:true,blocksSight:true,cover:100}:{type:'grass',blocked:false,cover:0})})),
  npcs:r.npcs.map((n,i)=>({...n,x:20+i,y:10})),
 });
 if(r.finiteArtilleryArsenal)battle.finiteArtilleryArsenal=structuredClone(r.finiteArtilleryArsenal);
 const pair=save({campaign:c,battle});
 assert.equal(pair.campaign.resources.treasury,3200-prices.reduce((sum,row)=>sum+row.price,0));
 assert.equal(actor(pair.battle,130).medkits,2);assert.equal(actor(pair.battle,100).medkits,2);
 assert.equal(actor(pair.battle,130).loaded+ammoCount(actor(pair.battle,130)),10);
 return {pair,prices};
}

function replay(start,steps){
 let pair=save(start);
 for(const action of steps){
  const before=structuredClone(pair),next=actBattle(pair.battle,action);
  assert.equal(next.lastError,null,next.lastError);
  assert.deepEqual(presentedActBattle(pair.battle,action).state,next);
  assert.deepEqual(pair,before,'replay preserves the admitted source');
  const synced=syncBattleTime(pair.campaign,next);assert.equal(synced.error,null,synced.error);
  pair=save(synced);
 }
 return pair;
}

function unchangedFinite(start,after){
 assert.equal(after.campaign.resources.treasury,start.campaign.resources.treasury);
 assert.deepEqual(after.campaign.contracts,start.campaign.contracts);
 assert.equal(after.battle.seed,start.battle.seed);
 for(const id of [130,100]){
  const a=actor(after.battle,id),b=actor(start.battle,id);
  for(const key of ['loaded','ammo','condition','weapon','weaponInstanceId','weaponFittings','inventory','outfit','headwear','legwear'])assert.deepEqual(a[key],b[key],`${id} ${key}`);
 }
}

test('the shared mountain aid seam reports finite successful orders and admits their exact saved clock before ordinary departure',t=>{
 const {pair,prices}=declaredCareArena(false),before=structuredClone(pair),events=[];
 const campaign=performFreshMountainFirstAid(pair,{stage:'declared-success',report:event=>events.push(event)});
 assert.deepEqual(pair,before);
 const raw=events.find(e=>e.event==='freshMountainAidOrders'),checkpoint=events.find(e=>e.event==='freshMountainAidCheckpoint');
 assert.ok(raw&&checkpoint);assert.equal(events.indexOf(raw),0);assert.ok(raw.steps.length>0);
 assert.deepEqual(raw.steps,raw.attemptedSteps);assert.equal(raw.stoppedReason,null);assert.deepEqual(raw.untreated,[]);
 assert.equal(raw.rejectedStep,null);assert.equal(raw.clockSynchronized,false);assert.equal(checkpoint.clockSynchronized,true);
 const admitted=save(checkpoint),replayed=replay(pair,raw.steps);assert.deepEqual(replayed,admitted);
 unchangedFinite(pair,admitted);
 assert.equal(actor(admitted.battle,130).medkits,0);assert.equal(actor(admitted.battle,100).medkits,2);
 for(const id of [130,100]){assert.ok(actor(admitted.battle,id).hp>=15);assert.equal(actor(admitted.battle,id).bleeding,0);}
 assert.equal(actor(admitted.battle,130).hp,55,'noncritical first aid does not heal the doctor');
 assert.equal(campaign.pendingBattle,null);assert.deepEqual(save({campaign:leave(replayed)}).campaign,save({campaign}).campaign);
 assert.deepEqual(expandCellScene(campaign.sectorStates.retiro).tiles,admitted.battle.tiles);
 t.diagnostic(JSON.stringify({fixture:'paid native day hires, declared initial clinical wounds/flat arena before official admission; no campaign victory claim',prices,treasury:campaign.resources.treasury,acceptedOrders:raw.steps.length,seconds:clock(admitted.campaign)-clock(pair.campaign),doctorKits:[2,actor(admitted.battle,130).medkits],patientHp:[12,actor(admitted.battle,100).hp],departure:'ordinary leave',savedReplayEqual:true}));
});

test('a real paid self-treatment followed by a blocked patient reports the stopped pair and every accepted order before refusing departure',t=>{
 const {pair,prices}=declaredCareArena(true),before=structuredClone(pair),events=[];let stopped;
 assert.throws(()=>performFreshMountainFirstAid(pair,{stage:'declared-interruption',report:event=>events.push(event)}),error=>{stopped=error;return /camino abierto/.test(error.message);});
 assert.deepEqual(pair,before);
 const raw=events.find(e=>e.event==='freshMountainAidOrders'),checkpoint=events.find(e=>e.event==='freshMountainAidCheckpoint'),stop=events.find(e=>e.event==='freshRouteStopped');
 assert.ok(raw&&checkpoint&&stop);assert.ok(events.indexOf(raw)<events.indexOf(checkpoint)&&events.indexOf(checkpoint)<events.indexOf(stop));
 assert.ok(raw.steps.some(a=>a.type==='useItem'&&a.unitId==='130'&&a.targetId==='130'));
 assert.equal(raw.rejectedStep,null);assert.deepEqual(raw.steps,raw.attemptedSteps,'this physical blockage stops planning, so every attempted order was actually accepted');
 assert.equal(raw.steps.filter(a=>a.type==='useItem').length,1);
 assert.ok(raw.untreated.some(u=>u.id==='100'));assert.match(raw.stoppedReason,/camino abierto/);
 const admitted=save(checkpoint),replayed=replay(pair,raw.steps);assert.deepEqual(replayed,admitted);assert.deepEqual(stopped.pair,{campaign:checkpoint.campaign,battle:checkpoint.battle});
 assert.deepEqual(stopped.steps,raw.steps);assert.deepEqual(save(stop),admitted);assert.ok(admitted.campaign.pendingBattle,'an interrupted treatment cannot silently leave');
 unchangedFinite(pair,admitted);assert.equal(actor(admitted.battle,130).medkits,1);assert.equal(actor(admitted.battle,130).hp,55);assert.equal(actor(admitted.battle,130).bleeding,0);
 assert.equal(actor(admitted.battle,100).hp,12);assert.equal(actor(admitted.battle,100).bleeding,1);assert.equal(actor(admitted.battle,100).medkits,2);
 t.diagnostic(JSON.stringify({fixture:'same paid native force; declared wall before initial official admission blocks access to the critical patient',prices,treasury:admitted.campaign.resources.treasury,acceptedOrders:raw.steps.length,seconds:clock(admitted.campaign)-clock(pair.campaign),doctorKits:[2,actor(admitted.battle,130).medkits],untreated:raw.untreated,stoppedReason:raw.stoppedReason,pendingBattle:admitted.campaign.pendingBattle.id,savedReplayEqual:true}));
});
