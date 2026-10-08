import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,restoreCampaign,serializeCampaign,rosterFor} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {pendingGuaranteeRefunds,creditPendingGuaranteeRefunds} from '../game/service-guarantees.js';
const CAP=1000000000,id=110,save=s=>restoreCampaign(serializeCampaign(s));
const order=(s,a)=>{const before=serializeCampaign(s),n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);assert.equal(serializeCampaign(s),before,'source unchanged');assert.ok(save(n));return n;};
function fresh(amount=101,travel=0){const d=defaultContentPackage();Object.assign(d.characters.find(c=>c.id===`person-${id}`),{serviceGuarantee:amount,arrivalHours:travel});d.characters.find(c=>c.id==='person-100').arrivalHours=0;return initialCampaign(42,d);}
function hire(amount=101,travel=0,room=50){let s=order(fresh(amount,travel),{type:'recruitCivic',id,term:'day'});s.resources.treasury=CAP-room;return save(s);}
function reject(s,a,pattern=/tesorería/){const n=dispatchCampaign(s,a);assert.match(n.lastError,pattern);assert.deepEqual({...n,lastError:null},s);assert.ok(save(n));return n;}
function expire(s){for(let tries=0;s.contracts[id]&&tries<5;tries++)s=order(s,{type:'wait',hours:Math.max(1,24-s.hour)});assert.equal(s.contracts[id],undefined);return s;}

test('manual healthy dismissal rejects an over-cap refund atomically and accepts exact headroom',()=>{
 const s=hire();reject(s,{type:'dismiss',id,expectedGuaranteeId:'guarantee-1'});reject(s,{type:'dismiss',id,expectedGuaranteeId:'guarantee-99'},/garantía|contrato/);
 const n=order(hire(101,0,101),{type:'dismiss',id,expectedGuaranteeId:'guarantee-1'});assert.equal(n.resources.treasury,CAP);assert.equal(n.serviceGuarantees.entries['guarantee-1'].creditedRefund,101);assert.deepEqual(pendingGuaranteeRefunds(n),[]);
});

test('arrival cancellation guards the complete salary and guarantee before either credit or removal',()=>{
 for(const room of [50,160])reject(hire(101,6,room),{type:'cancelHireArrival',id,expectedGuaranteeId:'guarantee-1'});
 const n=order(hire(101,6,161),{type:'cancelHireArrival',id,expectedGuaranteeId:'guarantee-1'});assert.equal(n.resources.treasury,CAP);assert.equal(n.hiringArrivals.length,0);assert.equal(n.serviceGuarantees.entries['guarantee-1'].creditedRefund,101);reject(n,{type:'cancelHireArrival',id,expectedGuaranteeId:'guarantee-1'},/viaje|llegada/);
 for(const room of [1,59])reject(hire(0,6,room),{type:'cancelHireArrival',id});
 const legacy=order(hire(0,6,60),{type:'cancelHireArrival',id});assert.equal(legacy.resources.treasury,CAP);assert.equal(legacy.serviceGuarantees,undefined);
});

test('automatic expiry completes clock and service with exact full entitlement and saveable partial credit',()=>{
 const n=expire(hire());const receipt=n.serviceGuarantees.entries['guarantee-1'];assert.equal(n.hour,24);assert.equal(n.resources.treasury,CAP);assert.equal(n.recruited.includes(id),false);assert.equal(n.serviceGuarantees.version,2);assert.deepEqual([receipt.state,receipt.refund,receipt.creditedRefund],['departed',101,50]);assert.deepEqual(pendingGuaranteeRefunds(n),[{id:'guarantee-1',operativeId:id,refund:101,creditedRefund:50,pendingRefund:51}]);assert.match(n.log.map(e=>e.text??e).join(' '),/se abonan 50 pesos pendientes; quedan 51 pesos por devolver/);
 const snapshot=serializeCampaign(n);assert.equal(serializeCampaign(save(n)),snapshot,'restore never pays');assert.equal(serializeCampaign(n),snapshot);
});

test('only accepted spending pays owed remainder once, without changing locked health or refund',()=>{
 let n=expire(hire());const original=structuredClone(n.serviceGuarantees.entries['guarantee-1']);reject(n,{type:'renewContract',id:99999},/personaje|contrato|contratado/);
 n=order(save(n),{type:'recruitCivic',id:100,term:'day'});assert.equal(n.resources.treasury,CAP);assert.equal(n.serviceGuarantees.entries['guarantee-1'].creditedRefund,86);assert.equal(pendingGuaranteeRefunds(n)[0].pendingRefund,15);
 n=order(save(n),{type:'renewContract',id:100,term:'day'});assert.equal(n.resources.treasury,CAP-21);assert.equal(n.serviceGuarantees.entries['guarantee-1'].creditedRefund,101);assert.deepEqual(pendingGuaranteeRefunds(n),[]);const receipt=n.serviceGuarantees.entries['guarantee-1'];for(const k of ['refund','hp','maxHp','settledAt','settledSecond'])assert.equal(receipt[k],original[k]);
 const cash=n.resources.treasury;const again=order(save(n),{type:'dismiss',id:100});assert.equal(again.resources.treasury,cash);assert.deepEqual(again.serviceGuarantees.entries['guarantee-1'],receipt);
});

test('pending receipts use numeric incorporation order and each credit consumes actual headroom',()=>{
 const d=defaultContentPackage();for(const who of [110,111])Object.assign(d.characters.find(c=>c.id===`person-${who}`),{serviceGuarantee:101,arrivalHours:0});d.characters.find(c=>c.id==='person-100').arrivalHours=0;let n=initialCampaign(42,d);
 n=order(n,{type:'recruitCivic',id,term:'day'});n=order(n,{type:'recruitCivic',id:111,term:'day'});n.resources.treasury=CAP-50;n=save(n);n=expire(n);assert.equal(n.contracts[111],undefined);
 const ledger=n.serviceGuarantees;ledger.entries=Object.fromEntries(Object.entries(ledger.entries).reverse());n=save(n);assert.deepEqual(pendingGuaranteeRefunds(n).map(e=>e.id),['guarantee-1','guarantee-2']);
 n=order(n,{type:'recruitCivic',id:100,term:'week'});assert.equal(n.serviceGuarantees.entries['guarantee-1'].creditedRefund,101);assert.equal(n.serviceGuarantees.entries['guarantee-2'].creditedRefund,101);assert.equal(n.resources.treasury,CAP-100);assert.deepEqual(pendingGuaranteeRefunds(n),[]);
});

test('v2 terminal credit fields and clocks are required; held and forfeited accounting stays strict',()=>{
 const n=expire(hire()),ref='guarantee-1';
 for(const mutate of [s=>s.serviceGuarantees.version=1,s=>delete s.serviceGuarantees.entries[ref].creditedRefund,s=>delete s.serviceGuarantees.entries[ref].creditedAt,s=>delete s.serviceGuarantees.entries[ref].creditedSecond,s=>s.serviceGuarantees.entries[ref].creditedRefund=102,s=>s.serviceGuarantees.entries[ref].creditedRefund=-1,s=>s.serviceGuarantees.entries[ref].creditedAt=23,s=>s.serviceGuarantees.entries[ref].creditedSecond=3600,s=>s.serviceGuarantees.entries[ref].pendingRefund=51]){const bad=structuredClone(n);mutate(bad);const before=structuredClone(bad);assert.throws(()=>save(bad));assert.deepEqual(bad,before);}
 const held=hire();held.serviceGuarantees.entries[ref].creditedRefund=0;assert.throws(()=>save(held));
 const cancelled=order(hire(101,6,161),{type:'cancelHireArrival',id});cancelled.serviceGuarantees.entries[ref].creditedRefund=100;assert.throws(()=>save(cancelled));
 let dead=hire();Object.assign(dead.operativeState[id],{alive:false,hp:0,bleeding:0,bandaged:0});dead=order(dead,{type:'dismiss',id});assert.equal(dead.serviceGuarantees.entries[ref].refund,0);assert.equal(dead.serviceGuarantees.entries[ref].creditedRefund,0);assert.equal(dead.resources.treasury,CAP-50);assert.deepEqual(pendingGuaranteeRefunds(dead),[]);
});

test('genuine v1 terminal shape restores without payment and upgrades as fully credited only at next settlement',()=>{
 let n=order(hire(101,0,101),{type:'dismiss',id});
 // Declared legacy schema fixture: v1 settlement records predate credit fields;
 // their original refund was paid in full. No owed v2 record is downgraded.
 n.serviceGuarantees.version=1;for(const entry of Object.values(n.serviceGuarantees.entries))for(const key of ['creditedRefund','creditedAt','creditedSecond'])delete entry[key];n=save(n);assert.deepEqual(pendingGuaranteeRefunds(n),[]);const cash=n.resources.treasury,before=serializeCampaign(n);assert.equal(serializeCampaign(save(n)),before);
 n=order(n,{type:'recruitCivic',id});n=order(n,{type:'dismiss',id});assert.equal(n.resources.treasury,cash-60);assert.equal(n.serviceGuarantees.version,2);assert.equal(n.serviceGuarantees.entries['guarantee-1'].creditedRefund,101);assert.equal(n.serviceGuarantees.entries['guarantee-2'].creditedRefund,101);
});

test('zero/default guarantees do not allocate new credit accounting or refund salary at service end',()=>{
 let n=hire(0,0,0);const cash=n.resources.treasury;n=order(n,{type:'dismiss',id});assert.equal(n.resources.treasury,cash);assert.equal(n.serviceGuarantees,undefined);assert.deepEqual(pendingGuaranteeRefunds(n),[]);const clone=structuredClone(n);assert.deepEqual(creditPendingGuaranteeRefunds(n),[]);assert.deepEqual(n,clone);
});

test('actual deferred transit expiry holds until a saved admitted arrival, then records full owed refund',async()=>{
 const {advanceCampaignHours}=await import('./campaign-wait-fixture.mjs');let n=order(fresh(),{type:'recruitCivic',id});n.sectors.buenos_aires.owner='patriot';n.sectors.ensenada.owner='patriot';n=order(n,{type:'transport',mode:'posta'});n=advanceCampaignHours(n,21);n=order(save(n),{type:'travel',sector:'ensenada',mode:'posta',queue:true});n=advanceCampaignHours(n,3);assert.equal(n.hour,24);assert.equal(n.contracts[id].departurePending,true);assert.equal(n.serviceGuarantees.entries['guarantee-1'].state,'held');
 // Declared near-cap boundary only, after paid expiry while actually travelling.
 n.resources.treasury=CAP-50;n=save(n);reject(n,{type:'dismiss',id,expectedGuaranteeId:'guarantee-1'},/camino/);n=advanceCampaignHours(n,1);assert.equal(n.hour,25);assert.equal(n.contracts[id],undefined);assert.ok(n.travelNotice.events.some(e=>e.sector==='buenos_aires'));const entry=n.serviceGuarantees.entries['guarantee-1'];assert.equal(entry.refund,101);assert.equal(entry.creditedRefund,50);assert.equal(n.resources.treasury,CAP);assert.equal(pendingGuaranteeRefunds(n)[0].pendingRefund,51);assert.ok(save(n));
});

test('a saved expired tactical deployment settles automatically without blocking its actual safe return',async()=>{
 const {enterSector}=await import('../game/world.js'),{advanceBattleClock,syncBattleTime}=await import('../game/time.js'),{encodeSave,decodeSave}=await import('../game/save.js');let n=order(fresh(),{type:'recruitCivic',id});n=order(n,{type:'visitSector'});let battle=enterSector(n.pendingBattle);advanceBattleClock(battle,24*3600);const pair=syncBattleTime(n,battle);assert.equal(pair.error,null);n=pair.campaign;battle=pair.battle;assert.equal(n.contracts[id].departurePending,true);n.resources.treasury=CAP-50;const loaded=decodeSave(encodeSave(n,battle));n=order(loaded.campaign,{type:'leaveSector',battleId:n.pendingBattle.id,sectorState:loaded.battle,survivors:loaded.battle.units.filter(u=>u.side==='player')});assert.equal(n.contracts[id],undefined);assert.equal(n.resources.treasury,CAP);assert.deepEqual([n.serviceGuarantees.entries['guarantee-1'].refund,n.serviceGuarantees.entries['guarantee-1'].creditedRefund],[101,50]);assert.equal(pendingGuaranteeRefunds(n)[0].pendingRefund,51);assert.ok(save(n));
});

test('saved older debt keeps first claim on headroom when a later automatic expiry settles',async()=>{
 const {advanceCampaignHours}=await import('./campaign-wait-fixture.mjs'),d=defaultContentPackage();Object.assign(d.characters.find(c=>c.id==='person-110'),{serviceGuarantee:1000,arrivalHours:0});Object.assign(d.characters.find(c=>c.id==='person-111'),{serviceGuarantee:101,arrivalHours:0});let n=order(initialCampaign(42,d),{type:'recruitCivic',id});n.resources.treasury=CAP-50;n=expire(save(n));n=order(n,{type:'recruitCivic',id:111});assert.ok(n.serviceGuarantees.entries['guarantee-1'].creditedRefund<900);n=advanceCampaignHours(n,23);assert.equal(n.hour,47);
 // A valid saved headroom boundary: restore does not pay the older debt.
 n.resources.treasury=CAP-100;n=save(n);const oldCredit=n.serviceGuarantees.entries['guarantee-1'].creditedRefund;n=order(n,{type:'wait',hours:1});assert.equal(n.contracts[111],undefined);assert.equal(n.serviceGuarantees.entries['guarantee-1'].creditedRefund,oldCredit+100);assert.equal(n.serviceGuarantees.entries['guarantee-2'].creditedRefund,0);assert.equal(n.resources.treasury,CAP);assert.deepEqual(pendingGuaranteeRefunds(n).map(e=>e.id),['guarantee-1','guarantee-2']);assert.ok(save(n));
});

test('an admitted manual full refund stays full when older automatic debt also exists',()=>{
 const d=defaultContentPackage();Object.assign(d.characters.find(c=>c.id==='person-110'),{serviceGuarantee:1000,arrivalHours:0});Object.assign(d.characters.find(c=>c.id==='person-111'),{serviceGuarantee:101,arrivalHours:0});let n=order(initialCampaign(42,d),{type:'recruitCivic',id});n.resources.treasury=CAP-50;n=expire(save(n));n=order(n,{type:'recruitCivic',id:111});n.resources.treasury=CAP-151;n=save(n);const oldCredit=n.serviceGuarantees.entries['guarantee-1'].creditedRefund;n=order(n,{type:'dismiss',id:111,expectedGuaranteeId:'guarantee-2'});assert.equal(n.serviceGuarantees.entries['guarantee-2'].creditedRefund,101);assert.equal(n.serviceGuarantees.entries['guarantee-1'].creditedRefund,oldCredit+50);assert.equal(n.resources.treasury,CAP);assert.ok(save(n));
});

test('one actual paid posta step plus a separate expiry credits older debt before the new receipt',async()=>{
 const {advanceCampaignHours}=await import('./campaign-wait-fixture.mjs'),d=defaultContentPackage();Object.assign(d.characters.find(c=>c.id==='person-110'),{serviceGuarantee:1000,arrivalHours:0});Object.assign(d.characters.find(c=>c.id==='person-111'),{serviceGuarantee:101,arrivalHours:0});d.characters.find(c=>c.id==='person-100').arrivalHours=0;let n=order(initialCampaign(42,d),{type:'recruitCivic',id});n.resources.treasury=CAP-50;n=expire(save(n));n=order(n,{type:'recruitCivic',id:111});n=order(n,{type:'recruitCivic',id:100,term:'week'});n.sectors.buenos_aires.owner='patriot';n.sectors.ensenada.owner='patriot';n=order(n,{type:'transport',mode:'posta'});n=order(n,{type:'createSquad',name:'Posta',ids:[100]});n=advanceCampaignHours(n,23);assert.equal(n.hour,47);n=order(n,{type:'travel',sector:'ensenada',mode:'posta',queue:true});n=save(n);const before=structuredClone(n),oldCredit=n.serviceGuarantees.entries['guarantee-1'].creditedRefund;assert.equal(n.resources.treasury,CAP);assert.ok(oldCredit<990);n=order(n,{type:'wait',hours:1});assert.equal(n.hour,48);assert.equal(n.contracts[111],undefined);assert.equal(n.serviceGuarantees.entries['guarantee-1'].creditedRefund,oldCredit+10);assert.equal(n.serviceGuarantees.entries['guarantee-2'].creditedRefund,0);assert.equal(n.resources.treasury,CAP);assert.equal(n.contracts[100].guaranteeId,undefined);assert.equal(n.squads.find(q=>q.members.includes(100)).journey.elapsed,1);assert.equal(before.serviceGuarantees.entries['guarantee-2'].state,'held');assert.ok(save(n));
});
