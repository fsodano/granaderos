import test from 'node:test';
import assert from 'node:assert/strict';
import {CAMPAIGN_SECTORS} from '../game/data.js';
import {TOWN_INCOME_SOURCES,initializeTownIncome,townIncomeSources,dailyTownIncome,townIncomeActivationQuote,activateTownIncome,validateTownIncome,collectTownIncome} from '../game/town-income.js';
import {dailyIncome,incomeSources,incomeSummary} from '../game/economy.js';
import {sectorIncomeDetails,totalSectorIncome} from '../game/sector-income.js';
const fresh=()=>{
 const state={hour:0,secondOfHour:0,resources:{treasury:3200},sectors:Object.fromEntries(CAMPAIGN_SECTORS.map(sector=>[sector.id,{owner:sector.id==='retiro'?'patriot':'royalist',loyalty:65,damageUntil:0}])),conversations:{},contracts:{123:{paid:52}},armory:{swivel:1},inventory:{rifle:{count:1,loaded:1}},blockade:false};
 initializeTownIncome(state);return state;
};
const source=id=>TOWN_INCOME_SOURCES.find(row=>row.id===id);
const control=(state,id)=>{for(const sectorId of source(id).requiredSectors)state.sectors[sectorId].owner='patriot';};
const spoken=(state,id,approach='friendly')=>{
 const representative=source(id).representative;
 state.conversations[representative.npcId]={...state.conversations[representative.npcId],met:true,hour:state.hour,secondOfHour:state.secondOfHour,lastApproach:approach,sector:representative.sectorId,text:'El puerto recibe el parte.'};
 return {npcId:representative.npcId,sectorId:representative.sectorId,approach};
};
const active=(state,id)=>{control(state,id);assert.equal(activateTownIncome(state,spoken(state,id)).applied,true);};

test('a new campaign and every merely controlled locality earn zero without spoken activation',()=>{
 const state=fresh();assert.equal(dailyTownIncome(state),0);assert.deepEqual(state.townIncome.activations,{});
 for(const region of Object.values(state.sectors))region.owner='patriot';
 const before=structuredClone(state);assert.equal(dailyIncome(state),0);assert.equal(totalSectorIncome(state),0);
 assert.equal(incomeSources(state).length,3);assert.deepEqual(state,before);
 for(const id of ['uspallata','los_patos','humahuaca','cordoba','mendoza','tucuman','salta','jujuy','san_nicolas']){
  const details=sectorIncomeDetails(state,id);assert.equal(details.daily,0);assert.equal(details.eligible,false);
 }
});

test('Buenos Aires requires Plaza Mayor and Retiro before a fresh representative conversation can activate its port',()=>{
 const state=fresh();state.sectors.buenos_aires.owner='patriot';state.sectors.retiro.owner='royalist';
 assert.equal(activateTownIncome(state,spoken(state,'buenos_aires')).code,'uncontrolled');assert.deepEqual(state.townIncome.activations,{});
 state.hour=1;state.sectors.retiro.owner='patriot';assert.equal(dailyIncome(state),0);
 const stale={npcId:'local-buenos_aires',sectorId:'buenos_aires',approach:'friendly'};
 assert.equal(activateTownIncome(state,stale).code,'not-spoken');
 assert.equal(activateTownIncome(state,spoken(state,'buenos_aires')).applied,true);assert.equal(dailyIncome(state),8000);
 assert.equal(state.sectors.ensenada.owner,'royalist','Ensenada has its own port agreement');
});

test('only the mapped NPC, home sector and fresh nonthreatening spoken approach can activate a source',()=>{
 const state=fresh();control(state,'santa_fe');const before=structuredClone(state);
 assert.equal(activateTownIncome(state,{npcId:'local-santa_fe',sectorId:'santa_fe',approach:'friendly'}).code,'not-spoken');assert.deepEqual(state,before);
 assert.equal(activateTownIncome(state,{npcId:'brown',sectorId:'ensenada',approach:'friendly'}).code,'no-source');
 assert.equal(activateTownIncome(state,{npcId:'local-santa_fe',sectorId:'retiro',approach:'friendly'}).code,'wrong-sector');
 for(const approach of ['threaten','repeat','recruit','gift','quest'])assert.equal(activateTownIncome(state,spoken(state,'santa_fe',approach)).code,'approach');
 const conversation=spoken(state,'santa_fe');state.secondOfHour=1;assert.equal(activateTownIncome(state,conversation).code,'not-spoken');
 delete state.conversations['local-santa_fe'].secondOfHour;assert.equal(activateTownIncome(state,conversation).code,'not-spoken','a legacy met flag is not a new activation');
 assert.equal(activateTownIncome(state,spoken(state,'santa_fe','direct')).applied,true);assert.equal(dailyIncome(state),4000);
});

test('activated ports pay the flat tuned amounts without loyalty, damage, blockade or supply-route factors',()=>{
 const state=fresh();for(const id of ['buenos_aires','ensenada','santa_fe'])active(state,id);
 state.blockade=true;for(const region of Object.values(state.sectors)){region.loyalty=0;region.damageUntil=100;}
 const noRoute=()=>{throw Error('income cannot query a strategic supply route');},before=structuredClone(state);
 assert.equal(dailyIncome(state),17000);assert.equal(totalSectorIncome(state,noRoute),17000);
 assert.equal(sectorIncomeDetails(state,'ensenada',noRoute).daily,5000);assert.deepEqual(state,before);
 const rows=townIncomeSources(state);assert.deepEqual(rows.map(row=>row.income),[8000,5000,4000]);assert.ok(rows.every(row=>row.statusCode==='active'));
 assert.equal(sectorIncomeDetails(state,'buenos_aires').daily,8000);assert.equal(sectorIncomeDetails(state,'retiro').daily,0);
 assert.equal(sectorIncomeDetails(state,'retiro').townDaily,8000,'the shared agreement is described without a duplicate payment');
});

test('losing any required sector suspends a recorded agreement and real recapture restores it without a second activation',()=>{
 const state=fresh();active(state,'buenos_aires');const receipt=structuredClone(state.townIncome.activations.buenos_aires);
 for(const id of ['buenos_aires','retiro']){
  state.sectors[id].owner='royalist';assert.equal(dailyIncome(state),0);assert.equal(townIncomeSources(state)[0].statusCode,'uncontrolled');assert.doesNotThrow(()=>validateTownIncome(state));
  state.sectors[id].owner='patriot';assert.equal(dailyIncome(state),8000);assert.deepEqual(state.townIncome.activations.buenos_aires,receipt);
 }
 const before=structuredClone(state);assert.equal(activateTownIncome(state,spoken(state,'buenos_aires')).code,'already-active');assert.deepEqual(state.townIncome,before.townIncome);
});

test('subsequent conversations preserve the original exact activation receipt',()=>{
 const state=fresh();state.hour=4;state.secondOfHour=215;active(state,'santa_fe');const receipt=structuredClone(state.townIncome.activations.santa_fe);
 state.hour=5;state.secondOfHour=42;spoken(state,'santa_fe','threaten');
 assert.deepEqual(state.conversations['local-santa_fe'].incomeActivation,receipt);assert.doesNotThrow(()=>validateTownIncome(state));assert.equal(dailyIncome(state),4000);
});

test('legacy migration never infers activation or retroactive payment and preserves treasury, inventory and contracts',()=>{
 const state=fresh();delete state.townIncome;state.hour=72;for(const id of ['buenos_aires','ensenada','santa_fe']){control(state,id);spoken(state,id);}
 const preserved={resources:structuredClone(state.resources),contracts:structuredClone(state.contracts),inventory:structuredClone(state.inventory),armory:structuredClone(state.armory)};
 initializeTownIncome(state);assert.deepEqual(state.townIncome,{version:1,activations:{},lastPaidDay:3});assert.equal(dailyIncome(state),0);assert.equal(collectTownIncome(state).paid,false);
 for(const [key,value]of Object.entries(preserved))assert.deepEqual(state[key],value);assert.doesNotThrow(()=>validateTownIncome(state));
});

test('configurable daily amounts are saved game tuning and do not imply activation',()=>{
 const state=fresh();delete state.townIncome;initializeTownIncome(state,{dailyAmounts:{buenos_aires:9000,santa_fe:0}});assert.equal(dailyIncome(state),0);
 active(state,'buenos_aires');active(state,'ensenada');active(state,'santa_fe');assert.equal(dailyIncome(state),14000);
 assert.equal(townIncomeSources(state)[2].activated,true);assert.equal(townIncomeSources(state)[2].daily,0);
 assert.doesNotThrow(()=>validateTownIncome(JSON.parse(JSON.stringify(state))));
 for(const dailyAmounts of [{unknown:1},{buenos_aires:-1},{ensenada:.5},{santa_fe:1000001},[]])assert.throws(()=>initializeTownIncome({...fresh(),townIncome:undefined},{dailyAmounts}),/importes/);
});

test('validation rejects malformed, unsupported, future and unbacked activation receipts',()=>{
 const valid=fresh();valid.hour=23;valid.secondOfHour=3598;active(valid,'santa_fe');
 const corruptions=[
  s=>{s.townIncome=null;},s=>{delete s.townIncome;},s=>{s.townIncome.version=2;},s=>{s.townIncome.extra=true;},s=>{s.townIncome.activations=[];},
  s=>{s.townIncome.activations.humahuaca=structuredClone(s.townIncome.activations.santa_fe);},s=>{s.townIncome.activations.santa_fe=true;},
  s=>{s.townIncome.activations.santa_fe.npcId='local-retiro';},s=>{s.townIncome.activations.santa_fe.sectorId='retiro';},
  s=>{s.townIncome.activations.santa_fe.hour=24;},s=>{s.townIncome.activations.santa_fe.secondOfHour=3599;},s=>{s.townIncome.activations.santa_fe.secondOfHour=3600;},
  s=>{s.townIncome.activations.santa_fe.approach='threaten';},s=>{delete s.conversations['local-santa_fe'].incomeActivation;},
  s=>{s.conversations['local-santa_fe'].incomeActivation.hour=22;},s=>{delete s.townIncome.activations.santa_fe;},
  s=>{s.conversations['local-santa_fe'].secondOfHour=3597;},s=>{s.conversations['local-santa_fe'].secondOfHour=3599;},s=>{delete s.conversations['local-santa_fe'].secondOfHour;},
  s=>{s.townIncome.lastPaidDay=1;},s=>{s.townIncome.lastPaidDay=-1;},s=>{s.townIncome.dailyAmounts={santa_fe:Infinity};},
 ];
 for(const corrupt of corruptions){const state=structuredClone(valid);corrupt(state);assert.throws(()=>validateTownIncome(state));}
 assert.doesNotThrow(()=>validateTownIncome(valid));
 const orphan=structuredClone(valid);delete orphan.townIncome;const before=structuredClone(orphan);
 assert.throws(()=>initializeTownIncome(orphan),/acuerdo/);assert.deepEqual(orphan,before,'migration must reject the orphan before filling an empty ledger');
});

test('the exact midnight collects once and one-second save continuation cannot move or duplicate that payment',()=>{
 const state=fresh();state.hour=23;state.secondOfHour=3599;active(state,'santa_fe');const treasury=state.resources.treasury;
 assert.deepEqual(incomeSummary(state),{daily:4000,hoursUntilPayment:1/3600,secondsUntilPayment:1});assert.equal(collectTownIncome(state).paid,false);
 const restored=JSON.parse(JSON.stringify(state));state.hour=24;state.secondOfHour=0;restored.hour=24;restored.secondOfHour=0;
 assert.deepEqual(collectTownIncome(restored),collectTownIncome(state));assert.deepEqual(restored,state);assert.equal(state.resources.treasury,treasury+4000);
 const paid=JSON.parse(JSON.stringify(state));assert.equal(collectTownIncome(paid).paid,false);assert.equal(paid.resources.treasury,state.resources.treasury);
 paid.secondOfHour=1;assert.equal(collectTownIncome(paid).paid,false);paid.hour=48;paid.secondOfHour=0;assert.equal(collectTownIncome(paid).amount,4000);
 assert.equal(paid.resources.treasury,treasury+8000);assert.equal(incomeSummary(paid).secondsUntilPayment,86400);
});

test('a zero-income midnight is consumed and later activation cannot collect that same boundary',()=>{
 const state=fresh();state.hour=24;assert.deepEqual(collectTownIncome(state),{paid:true,day:1,hour:24,secondOfHour:0,amount:0,sources:[]});
 active(state,'ensenada');assert.equal(collectTownIncome(state).paid,false);assert.equal(state.resources.treasury,3200);
 state.hour=48;assert.equal(collectTownIncome(state).amount,5000);assert.equal(state.resources.treasury,8200);
});

test('payout uses control at the midnight boundary and cannot backfill a missed occupied day',()=>{
 const state=fresh();active(state,'santa_fe');state.hour=24;state.sectors.santa_fe.owner='royalist';assert.equal(collectTownIncome(state).amount,0);
 state.sectors.santa_fe.owner='patriot';assert.equal(collectTownIncome(state).paid,false);state.hour=48;assert.equal(collectTownIncome(state).amount,4000);
 state.hour=96;assert.equal(collectTownIncome(state).amount,4000,'a skipped boundary is not invented as a second catch-up payment');
});

test('payment overflow rejects without consuming the day or changing physical possessions',()=>{
 const state=fresh();active(state,'santa_fe');state.hour=24;state.resources.treasury=1_000_000_000;const before=structuredClone(state);
 assert.throws(()=>collectTownIncome(state),/tesorería/);assert.deepEqual(state,before);
});
