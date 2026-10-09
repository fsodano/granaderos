import {launchEnemyGroup,GROUP_LEG_HOURS} from '../game/enemy-groups.js';
import {secureArea} from './controlled-area-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {encountersFor} from '../game/encounters.js';
import {hiringArrivalOptions,hiringArrivalReason} from '../game/hiring-arrivals.js';
import {filterMercenaries} from '../game/mercenary-catalogue.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {advanceBattleClock,syncBattleTime} from '../game/time.js';
const order=(s,action)=>{const next=dispatchCampaign(s,action);assert.equal(next.lastError,null,next.lastError);return next;};
const hire={type:'recruitCivic',id:110,term:'day',destination:'retiro'};
const saved=s=>decodeSave(encodeSave(s)).campaign;

test('hiring rejects uncontrolled, open-water and unsupported destinations without charging',()=>{
 const s=initialCampaign(42);
 for(const destination of ['salta','cell-25-29','river','uspallata','los_patos']){
  const next=dispatchCampaign(s,{...hire,destination});assert.ok(next.lastError);assert.deepEqual({...next,lastError:null},s);
 }
 assert.deepEqual(new Set(hiringArrivalOptions(s).map(o=>o.id)),new Set(['retiro']));
 secureArea(s,'buenos_aires','ensenada');s.blockade=true;assert.ok(hiringArrivalReason(s,'ensenada'));assert.equal(hiringArrivalReason(s,'buenos_aires'),null);
 s.enemyGroups=[{target:'retiro',status:'stationed'}];assert.ok(hiringArrivalReason(s,'retiro'));
});
test('a controlled port receives legacy hires at that port instead of teleporting them to the active squad',()=>{
 let s=order(secureArea(initialCampaign(42),'ensenada'),{...hire,destination:'ensenada'});
 assert.ok(s.recruited.includes(110));assert.equal(s.squad.includes(110),false);assert.equal(s.operativeState[110].location,'ensenada');
 s=saved(s);assert.equal(s.operativeState[110].location,'ensenada');assert.equal(s.contracts[110].started,0);
});
test('a pending hire remains off-map across saves and pays once with service starting on arrival',()=>{
 let s=initialCampaign(42,defaultContentPackage());const money=s.resources.treasury;
 s=order(s,hire);const paid=money-s.resources.treasury;assert.ok(paid>0);
 assert.equal(s.hiringArrivals[0].dueAt,6);assert.equal(s.contracts[110],undefined);assert.equal(s.recruited.includes(110),false);
 for(const sector of Object.keys(s.sectors))assert.equal(encountersFor(s,sector).some(n=>n.operativeId===110),false);
 assert.equal(filterMercenaries(rosterFor(s),s,{availability:'available'}).some(o=>o.id===110),false);
 assert.ok(filterMercenaries(rosterFor(s),s,{availability:'pending'}).some(o=>o.id===110));
 const twice=dispatchCampaign(s,hire);assert.ok(twice.lastError);assert.equal(twice.resources.treasury,s.resources.treasury);
 s=order(saved(s),{type:'wait',hours:5});assert.equal(s.recruited.includes(110),false);
 s=order(s,{type:'wait',hours:1});assert.ok(s.recruited.includes(110));assert.ok(s.squad.includes(110));assert.equal(s.hiringArrivals.length,0);
 assert.equal(s.contracts[110].started,6);assert.equal(s.contracts[110].expiresAt,30);assert.equal(s.resources.treasury,money-paid);
 s=saved(s);assert.equal(s.contracts[110].paid,paid);assert.equal(s.recruited.filter(id=>id===110).length,1);
});
test('lost control holds arrivals and a saved redirect restarts travel without another payment',()=>{
 let s=order(secureArea(initialCampaign(42,defaultContentPackage()),'ensenada','buenos_aires'),{...hire,destination:'ensenada'});const money=s.resources.treasury;
 s.sectors.ensenada.owner='royalist';s=order(s,{type:'wait',hours:6});assert.equal(s.recruited.includes(110),false);assert.equal(s.contracts[110],undefined);
 const invalid=dispatchCampaign(s,{type:'redirectHire',id:110,destination:'river'});assert.ok(invalid.lastError);assert.deepEqual(invalid.hiringArrivals,s.hiringArrivals);
 s=order(saved(s),{type:'redirectHire',id:110,destination:'retiro'});assert.equal(s.hiringArrivals[0].dueAt,12);assert.equal(s.resources.treasury,money);
 s=order(saved(s),{type:'wait',hours:6});assert.equal(s.operativeState[110].location,'retiro');assert.equal(s.contracts[110].started,12);assert.equal(s.resources.treasury,money);
});
test('naval blockade holds a water-only arrival until a safe land destination is chosen',()=>{
 let s=order(secureArea(initialCampaign(42,defaultContentPackage()),'ensenada','buenos_aires'),{...hire,destination:'ensenada'});
 s.blockade=true;s=order(s,{type:'wait',hours:6});assert.equal(s.recruited.includes(110),false);
 s=order(saved(s),{type:'redirectHire',id:110,destination:'buenos_aires'});
 s=order(s,{type:'wait',hours:6});assert.equal(s.operativeState[110].location,'buenos_aires');assert.equal(s.squad.includes(110),false);assert.equal(s.contracts[110].started,12);
});
test('a naval force arriving in the same hour is resolved before a hire is admitted',()=>{
 const d=defaultContentPackage();d.characters.find(c=>c.id==='person-110').arrivalHours=GROUP_LEG_HOURS.coast;
 const initial=secureArea(initialCampaign(42,d),'ensenada','buenos_aires');
 // Declare a launched force, then advance its real route and the paid hire
 // together. A newly launched weekly raid is still offshore at that hour.
 const group=launchEnemyGroup(initial,'coast','ensenada');assert.ok(group);
 let s=order(saved(initial),{...hire,destination:'ensenada'});assert.equal(s.hiringArrivals[0].dueAt,group.arrivalAt);
 s=order(s,{type:'wait',hours:group.arrivalAt-s.hour});assert.equal(s.blockade,true);assert.equal(s.recruited.includes(110),false);assert.equal(s.hiringArrivals.length,1);assert.equal(s.enemyGroups.find(g=>g.id===group.id).status,'stationed');
 assert.ok(saved(s));
});
test('cancelling refunds exactly once and never creates a contract',()=>{
 let s=initialCampaign(42,defaultContentPackage());const money=s.resources.treasury;
 s=order(s,hire);s=order(saved(s),{type:'cancelHireArrival',id:110});assert.equal(s.resources.treasury,money);assert.equal(s.hiringArrivals.length,0);assert.equal(s.contracts[110],undefined);
 const again=dispatchCampaign(s,{type:'cancelHireArrival',id:110});assert.ok(again.lastError);assert.equal(again.resources.treasury,money);
 s=order(s,hire);assert.equal(s.hiringArrivals.length,1);
});
test('invalid saved receipts cannot change refunds, terms, identities or arrival timing',()=>{
 const s=order(initialCampaign(42,defaultContentPackage()),hire);
 for(const mutate of [a=>a.dueAt++,a=>a.destination='river',a=>a.serviceHours=1,a=>a.paid++,a=>a.permanent=true,a=>a.travelHours++,a=>a.operativeId=3,a=>a.term='constructor',a=>a.departedAt=-1,a=>a.extra=true]){
  const copy=structuredClone(s);mutate(copy.hiringArrivals[0]);assert.throws(()=>saved(copy),/llegadas/);
 }
 const duplicate=structuredClone(s);duplicate.hiringArrivals.push({...s.hiringArrivals[0]});assert.throws(()=>saved(duplicate),/llegadas/);
 const dead=structuredClone(s);dead.operativeState[110].alive=false;dead.operativeState[110].hp=0;assert.throws(()=>saved(dead),/llegadas/);
 const captive=structuredClone(s);captive.operativeState[110].captured=true;assert.throws(()=>saved(captive),/llegadas/);
});
test('a loaded destination holds the hire through tactical time and save, then accepts on departure',()=>{
 const d=defaultContentPackage();d.characters.find(c=>c.id==='person-100').arrivalHours=0;
 let s=order(initialCampaign(42,d),{type:'recruitCivic',id:100,term:'week'});s=order(s,hire);s=order(s,{type:'visitSector'});
 let battle=enterSector(s.pendingBattle);advanceBattleClock(battle,6*3600);
 const pair=syncBattleTime(s,battle);assert.equal(pair.error,null);assert.equal(pair.campaign.recruited.includes(110),false);assert.equal(pair.battle.units.some(u=>u.id==='110'),false);
 const loaded=decodeSave(encodeSave(pair.campaign,pair.battle));
 s=order(loaded.campaign,{type:'leaveSector',battleId:loaded.campaign.pendingBattle.id,sectorState:loaded.battle,survivors:loaded.battle.units.filter(u=>u.side==='player')});
 assert.ok(s.recruited.includes(110));assert.equal(s.hiringArrivals.length,0);assert.equal(s.contracts[110].started,6);assert.equal(saved(s).contracts[110].expiresAt,30);
});
test('remote arrival during another deployment does not alter its squad or invalidate its save',()=>{
 const d=defaultContentPackage();d.characters.find(c=>c.id==='person-100').arrivalHours=0;
 let s=order(initialCampaign(42,d),{type:'recruitCivic',id:100,term:'week'});secureArea(s,'ensenada');s=order(s,{...hire,destination:'ensenada'});s=order(s,{type:'visitSector'});
 const battle=enterSector(s.pendingBattle);advanceBattleClock(battle,6*3600);const pair=syncBattleTime(s,battle);assert.equal(pair.error,null);
 assert.ok(pair.campaign.recruited.includes(110));assert.equal(pair.campaign.squad.includes(110),false);assert.equal(pair.campaign.operativeState[110].location,'ensenada');
 assert.ok(decodeSave(encodeSave(pair.campaign,pair.battle)));
});
test('authored sites reject inland ports and allow disabling reception; legacy packages keep immediate arrival',()=>{
 for(const arrivalSites of [[{sector:'mendoza',facilities:['port']}],[{sector:'river',facilities:['landing']}],[{sector:'uspallata',facilities:['post']}],[{sector:'retiro',facilities:['post','post']}],[{sector:'retiro',facilities:['post'],extra:true}]]){
  const d=defaultContentPackage();d.arrivalSites=arrivalSites;assert.ok(validateContentPackage(d).length);assert.throws(()=>initialCampaign(1,d));
 }
 const d=defaultContentPackage();d.arrivalSites=[];let s=initialCampaign(42,d);assert.deepEqual(hiringArrivalOptions(s),[]);assert.ok(dispatchCampaign(s,hire).lastError);
 delete d.arrivalSites;for(const c of d.characters)delete c.arrivalHours;
 s=order(saved(initialCampaign(42,d)),hire);assert.ok(s.recruited.includes(110));assert.equal(s.contracts[110].started,0);
});
test('each configured travel duration and published weekly or monthly term is respected, including elites',()=>{
 const d=defaultContentPackage(),elite=rosterFor(initialCampaign()).find(o=>o.tier==='elite');
 const c=d.characters.find(c=>c.id===`person-${elite.id}`);c.arrivalHours=2;c.monthlyPay=300;
 for(const [term,hours] of [['week',168],['month',720]]){
  let s=order(initialCampaign(42,d),{type:'recruitCivic',id:elite.id,term});s=order(s,{type:'wait',hours:2});
  assert.equal(s.contracts[elite.id].expiresAt,2+hours);assert.equal(saved(s).contracts[elite.id].started,2);
 }
 for(const invalid of [-1,169,1.5,null,'6']){c.arrivalHours=invalid;assert.ok(validateContentPackage(d).length);}
});


test('an arrival at the departure point does not join a squad already marching elsewhere',()=>{
 const d=defaultContentPackage();d.characters.find(c=>c.id==='person-100').arrivalHours=0;
 let s=order(initialCampaign(42,d),{type:'recruitCivic',id:100,term:'week'});s=order(s,hire);
 // The rural waypoint keeps the real march active when the six-hour hire arrives.
 secureArea(s,'buenos_aires');s=order(s,{type:'travel',sector:'buenos_aires',waypoints:['cell-23-29']});
 assert.equal(s.location,'buenos_aires');assert.equal(s.operativeState[110].location,'retiro');assert.equal(s.squad.includes(110),false);
 assert.equal(s.contracts[110].started,6);assert.equal(saved(s).operativeState[110].location,'retiro');
});
test('a new bulletin contract discards an earlier tactical entry route at a different destination',()=>{
 const d=defaultContentPackage();for(const id of [100,110])d.characters.find(c=>c.id===`person-${id}`).arrivalHours=0;
 let s=secureArea(initialCampaign(42,d),'buenos_aires');
 for(const id of [100,110])s=order(s,{type:'recruitCivic',id,term:'week'});
 s=order(s,{type:'travel',sector:'buenos_aires'});assert.equal(s.operativeState[110].arrival.toSector,'buenos_aires');
 s=order(s,{type:'dismiss',id:110});const cash=s.resources.treasury;
 s=order(saved(s),{type:'recruitCivic',id:110,term:'day',destination:'retiro'});
 assert.ok(s.resources.treasury<cash);assert.equal(s.operativeState[110].location,'retiro');assert.equal(s.operativeState[110].arrival,null);assert.equal(s.operativeState[110].residentSector,null);assert.ok(!s.squad.includes(110));assert.ok(saved(s));
});
