import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor,contractQuote,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {contractRenewalQuote} from '../game/contracts.js';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {guaranteeRecord,serviceGuaranteeRefund,validateServiceGuarantees,forfeitDeadServiceGuarantees} from '../game/service-guarantees.js';
import {synchronizeCampaignPresence} from '../game/campaign-presence.js';
import {advanceCampaignHours} from './campaign-wait-fixture.mjs';
import {enterSector} from '../game/world.js';
import {advanceBattleClock,syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {localPackage,readyLocal,hireLocal,localId,localNPC,talk,leave} from './local-contract-fixture.mjs';
import {encounterHireTerms} from '../game/encounters.js';
import {restoredCaptiveContract} from '../game/prisoner-custody.js';
const id=110;
const op=s=>rosterFor(s).find(o=>o.id===id);
const order=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null,`${a.type}: ${next.lastError}`);return next;};
const saved=s=>restoreCampaign(serializeCampaign(s));
function content(amount=101,arrivalHours=0){const d=defaultContentPackage();Object.assign(d.characters.find(c=>c.id===`person-${id}`),{serviceGuarantee:amount,arrivalHours});return d;}
const fresh=(amount=101,arrival=0)=>initialCampaign(42,content(amount,arrival));
const hired=()=>order(fresh(),{type:'recruitCivic',id,term:'day'});
const entry=s=>guaranteeRecord(s,s.contracts[id]??s.hiringArrivals.find(a=>a.operativeId===id));

test('an authored finite offer quotes salary, funded guarantee and payable total without changing salary',()=>{
 const s=fresh(),q=contractQuote(s,op(s)),before=structuredClone(s);assert.equal(q.price,60);assert.equal(q.guarantee,101);assert.equal(q.total,161);assert.deepEqual(s,before);
 const n=order(s,{type:'recruitCivic',id});assert.equal(n.resources.treasury,3200-161);assert.equal(n.contracts[id].paid,60);assert.equal(entry(n).amount,101);assert.equal(saved(n).contracts[id].guaranteeId,'guarantee-1');assert.deepEqual(Object.keys(n.resources),['treasury']);
 const poor=fresh();poor.resources.treasury=160;const rejected=dispatchCampaign(poor,{type:'recruitCivic',id});assert.match(rejected.lastError,/161/);assert.deepEqual({...rejected,lastError:null},poor);assert.equal(rejected.serviceGuarantees,undefined);
});

test('legacy and zero-configured hire, renewal, cancellation and departure allocate no ledger',()=>{
 for(const s of [initialCampaign(42),fresh(0),initialCampaign(42,defaultContentPackage())]){
  const q=contractQuote(s,op(s));assert.equal(q.guarantee,0);assert.equal(q.total,q.price);
  let n=order(s,{type:'recruitCivic',id});assert.equal(n.serviceGuarantees,undefined);
  if(n.hiringArrivals.length){n=order(n,{type:'cancelHireArrival',id});assert.equal(n.resources.treasury,s.resources.treasury);}
  else {n=order(n,{type:'renewContract',id});const cash=n.resources.treasury;n=order(n,{type:'dismiss',id});assert.equal(n.resources.treasury,cash);}
  assert.equal(n.serviceGuarantees,undefined);assert.ok(saved(n));
 }
});

test('safe departures use current integral health and effective maximum; salary is never refunded',()=>{
 for(const ratio of [1,.5,.01]){
  let s=hired();s.operativeState[id].hp=Math.max(1,Math.floor(op(s).maxHp*ratio));s.operativeState[id].bandaged=0;
  synchronizeCampaignPresence(s);
  const hp=s.operativeState[id].hp,maxHp=op(s).maxHp,refund=Math.floor(101*hp/maxHp),cash=s.resources.treasury;
  assert.equal(serviceGuaranteeRefund(s,s.contracts[id],op(s)),refund);s=order(saved(s),{type:'dismiss',id});const terminal=s.serviceGuarantees.entries['guarantee-1'];assert.equal(s.resources.treasury,cash+refund);assert.equal(terminal.state,'departed');assert.deepEqual([terminal.hp,terminal.maxHp,terminal.refund],[hp,maxHp,refund]);assert.ok(saved(s));
  const twice=dispatchCampaign(s,{type:'dismiss',id});assert.ok(twice.lastError);assert.equal(twice.resources.treasury,s.resources.treasury);
 }
 let s=hired();s.operativeState[id].xp=100;s.operativeState[id].maxHp=85;s.operativeState[id].hp=85;s.operativeState[id].bandaged=0;
 assert.equal(op(s).maxHp,87);synchronizeCampaignPresence(s);s=saved(s);assert.equal(s.operativeState[id].maxHp,87);const cash=s.resources.treasury;s=order(s,{type:'dismiss',id});assert.equal(s.resources.treasury,cash+Math.floor(101*85/87));assert.equal(s.serviceGuarantees.entries['guarantee-1'].maxHp,87);
});

test('healing before departure increases the actual refund without adding a second funded charge',()=>{
 let s=hired();const r=s.operativeState[id];r.hp=40;r.bandaged=0;const low=serviceGuaranteeRefund(s,s.contracts[id],op(s));r.hp=op(s).maxHp;assert.ok(serviceGuaranteeRefund(s,s.contracts[id],op(s))>low);const cash=s.resources.treasury;s=order(saved(s),{type:'dismiss',id});assert.equal(s.resources.treasury,cash+101);
});

test('renewal retains funded identity and pays only the new salary, including saved fractional dates',()=>{
 let s=hired();s=order(s,{type:'advanceStrategicTime',seconds:17});const ref=s.contracts[id].guaranteeId,q=contractRenewalQuote(s,op(s),'week'),cash=s.resources.treasury;
 assert.equal(q.guarantee,0);assert.equal(q.total,q.price);assert.equal(q.heldGuarantee,101);
 s=order(saved(s),{type:'renewContract',id,term:'week',expectedGuaranteeId:ref});assert.equal(s.contracts[id].guaranteeId,ref);assert.equal(s.resources.treasury,cash-q.price);assert.equal(s.serviceGuarantees.nextId,2);assert.ok(saved(s));
});

test('pending arrival carries liability across redirect/save and cancellation refunds both charges once',()=>{
 let s=order(fresh(101,6),{type:'recruitCivic',id});const ref=s.hiringArrivals[0].guaranteeId;assert.equal(s.contracts[id],undefined);assert.equal(entry(s).state,'held');assert.equal(s.resources.treasury,3039);
 s.sectors.buenos_aires.owner='patriot';s=order(saved(s),{type:'redirectHire',id,destination:'buenos_aires'});assert.equal(s.hiringArrivals[0].guaranteeId,ref);assert.equal(s.resources.treasury,3039);
 s=order(saved(s),{type:'cancelHireArrival',id,expectedGuaranteeId:ref});assert.equal(s.resources.treasury,3200);assert.equal(s.serviceGuarantees.entries[ref].state,'cancelled');assert.equal(s.serviceGuarantees.entries[ref].refund,101);assert.ok(saved(s));
 const twice=dispatchCampaign(s,{type:'cancelHireArrival',id,expectedGuaranteeId:ref});assert.ok(twice.lastError);assert.equal(twice.resources.treasury,3200);
 s=order(s,{type:'recruitCivic',id});assert.equal(s.hiringArrivals[0].guaranteeId,'guarantee-2');const stale=dispatchCampaign(s,{type:'cancelHireArrival',id,expectedGuaranteeId:ref});assert.ok(stale.lastError);assert.deepEqual({...stale,lastError:null},s);
});

test('arrival begins service with its funded ID and expiry refunds only at actual departure',()=>{
 let s=order(fresh(101,6),{type:'recruitCivic',id});const cash=s.resources.treasury,ref=s.hiringArrivals[0].guaranteeId;s=advanceCampaignHours(saved(s),6);assert.equal(s.contracts[id].guaranteeId,ref);assert.equal(s.resources.treasury,cash);assert.equal(s.contracts[id].started,6);
 s=advanceCampaignHours(saved(s),24);assert.equal(s.contracts[id],undefined);assert.equal(s.resources.treasury,cash+101);assert.equal(s.serviceGuarantees.entries[ref].state,'departed');assert.ok(saved(s));
});

test('rehire retains terminal history and cannot reuse an old funded or UI identity',()=>{
 let s=hired(),first=s.contracts[id].guaranteeId;s=order(s,{type:'dismiss',id,expectedGuaranteeId:first});s=order(saved(s),{type:'recruitCivic',id});assert.equal(s.contracts[id].guaranteeId,'guarantee-2');assert.equal(s.serviceGuarantees.entries[first].state,'departed');
 for(const type of ['dismiss','renewContract']){const n=dispatchCampaign(s,{type,id,expectedGuaranteeId:first});assert.ok(n.lastError);assert.deepEqual({...n,lastError:null},s);}
 assert.ok(saved(s));
});

test('confirmed death forfeits once but the existing dead service record survives until departure',()=>{
 let s=hired();const ref=s.contracts[id].guaranteeId,cash=s.resources.treasury;Object.assign(s.operativeState[id],{hp:0,alive:false,bleeding:0,bandaged:0});
 // The death acknowledgement is declared here; the separate paid battle
 // receipt exercises actual tactical harm and report admission.
 synchronizeCampaignPresence(s);forfeitDeadServiceGuarantees(s,rosterFor(s));assert.equal(entry(s).state,'forfeited');assert.equal(entry(s).refund,0);assert.equal(s.resources.treasury,cash);assert.ok(saved(s));
 const before=structuredClone(s);forfeitDeadServiceGuarantees(s,rosterFor(s));assert.deepEqual(s,before);s=order(s,{type:'dismiss',id});assert.equal(s.resources.treasury,cash);assert.equal(s.serviceGuarantees.entries[ref].state,'forfeited');assert.ok(saved(s));
});

test('capture retains the funded identity and paused service; release does not fund or refund again',()=>{
 const s=hired(),ref=s.contracts[id].guaranteeId,cash=s.resources.treasury,r=s.operativeState[id];r.capturedContract=structuredClone(s.contracts[id]);r.captured=true;r.capturedAt=1;r.capturedAtSecond=0;s.hour=1;delete s.contracts[id];s.recruited=[];s.squad=[];s.squads[0].members=[];
 validateServiceGuarantees(s,rosterFor(s));assert.equal(s.serviceGuarantees.entries[ref].state,'held');assert.equal(s.resources.treasury,cash);
 const restored=restoredCaptiveContract(r,100);assert.equal(restored.guaranteeId,ref);assert.equal(restored.expiresAt,123);assert.equal(s.resources.treasury,cash);
 s.hour=100;r.capturedContract=null;r.captured=false;s.contracts[id]=restored;s.recruited=[id];s.squad=[id];s.squads[0].members=[id];validateServiceGuarantees(s,rosterFor(s));assert.equal(s.serviceGuarantees.entries[ref].state,'held');
});

test('strict financial receipts reject orphan, duplicate, missing, wrong-owner, live terminal and arithmetic tampering',()=>{
 const s=hired(),ref=s.contracts[id].guaranteeId;
 for(const mutate of [n=>delete n.contracts[id].guaranteeId,n=>delete n.serviceGuarantees,n=>n.serviceGuarantees.extra=1,n=>n.serviceGuarantees.nextId++,n=>n.serviceGuarantees.entries[ref].amount++,n=>n.serviceGuarantees.entries[ref].operativeId=111,n=>n.serviceGuarantees.entries[ref].fundedSecond=3600,n=>n.serviceGuarantees.entries[ref].fundedAt=1,n=>n.serviceGuarantees.entries[ref].state='forfeited',n=>n.contracts[id].guaranteeId='guarantee-2',n=>n.operativeState[id].capturedContract=structuredClone(n.contracts[id])]){
  const n=structuredClone(s);mutate(n);const before=structuredClone(n);assert.throws(()=>saved(n));assert.deepEqual(n,before,'restore does not mutate source');
 }
 const departed=order(s,{type:'dismiss',id});
 for(const mutate of [n=>n.serviceGuarantees.entries[ref].refund++,n=>n.serviceGuarantees.entries[ref].hp=0,n=>n.serviceGuarantees.entries[ref].settledAt=1,n=>n.serviceGuarantees.entries[ref].maxHp=999,n=>n.contracts[id]={...s.contracts[id]}]){const n=structuredClone(departed);mutate(n);assert.throws(()=>saved(n));}
});

test('authored guarantees reject invalid amounts and permanent or historical liabilities',()=>{
 for(const amount of [-1,1.5,1000001,null,'101']){const d=content(amount);assert.ok(validateContentPackage(d).some(e=>e.includes('serviceGuarantee')));assert.throws(()=>initialCampaign(42,d));}
 const d=content();d.characters.find(c=>c.id==='person-3').serviceGuarantee=101;assert.ok(validateContentPackage(d).some(e=>e.includes('serviceGuarantee')));
});


test('existing manual transit rejection retains liability, cancelled travel returns before expiry settlement',()=>{
 let s=hired();s.sectors.buenos_aires.owner='patriot';s.sectors.ensenada.owner='patriot';s=order(s,{type:'travel',sector:'ensenada',queue:true});const ref=s.contracts[id].guaranteeId,cash=s.resources.treasury;
 const rejected=dispatchCampaign(s,{type:'dismiss',id,expectedGuaranteeId:ref});assert.match(rejected.lastError,/camino/);assert.deepEqual({...rejected,lastError:null},s);
 s=order(s,{type:'cancelTravel',choice:'stop'});assert.equal(s.contracts[id].guaranteeId,ref);assert.equal(entry(s).state,'held');assert.equal(s.resources.treasury,cash);assert.ok(saved(s));
 s=order(s,{type:'dismiss',id,expectedGuaranteeId:ref});assert.equal(s.resources.treasury,cash+101);
});

test('an actual expired deployment retains escrow until the admitted saved sector return',()=>{
 let s=hired();s=order(s,{type:'visitSector'});let battle=enterSector(s.pendingBattle);const ref=s.contracts[id].guaranteeId,cash=s.resources.treasury;
 advanceBattleClock(battle,24*3600);const pair=syncBattleTime(s,battle);assert.equal(pair.error,null);s=pair.campaign;battle=pair.battle;assert.equal(s.contracts[id].departurePending,true);assert.equal(entry(s).state,'held');assert.equal(s.resources.treasury,cash);
 const rejected=dispatchCampaign(s,{type:'dismiss',id});assert.match(rejected.lastError,/batalla/);assert.equal(rejected.resources.treasury,cash);
 const loaded=decodeSave(encodeSave(s,battle));s=order(loaded.campaign,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:loaded.battle,survivors:loaded.battle.units.filter(u=>u.side==='player')});
 assert.equal(s.contracts[id],undefined);assert.equal(s.serviceGuarantees.entries[ref].state,'departed');assert.equal(s.resources.treasury,cash+101);assert.ok(saved(s));
});

test('normal paid local conversation quotes the complete price and transfers the same funded service in place',()=>{
 const d=localPackage();d.characters.find(c=>c.id==='alma-contract').serviceGuarantee=101;
 let p=readyLocal(undefined,d),local=localId(p.campaign),cash=p.campaign.resources.treasury;
 const offers=encounterHireTerms(p.campaign,localNPC(p.battle));assert.equal(offers[0].price,60);assert.equal(offers[0].guarantee,101);assert.equal(offers[0].total,161);
 const direct=order(p.campaign,talk(p,'day','direct'));assert.match(direct.lastConversation.text,/161 pesos \(paga 60 \+ garantía 101\)/);assert.equal(direct.resources.treasury,cash);
 p=hireLocal(p);assert.equal(p.campaign.resources.treasury,cash-161);assert.equal(p.campaign.contracts[local].paid,60);assert.equal(guaranteeRecord(p.campaign,p.campaign.contracts[local]).amount,101);assert.equal(p.campaign.hiringArrivals.length,0);
 const left=leave(p);const before=left.resources.treasury,s=order(left,{type:'dismiss',id:local,expectedGuaranteeId:left.contracts[local].guaranteeId});assert.equal(s.resources.treasury,before+101);assert.ok(saved(s));
});
