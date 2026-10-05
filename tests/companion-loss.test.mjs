import test from 'node:test';
import assert from 'node:assert/strict';
import {receiveCompanionLossCorrespondence,deliverPendingCompanionLossCorrespondence,validatePendingCompanionLoss,cancelPendingCompanionLoss,renewPendingCompanionLossService} from '../game/companion-loss.js';
import {defaultContentPackage} from '../game/content-package.js';
import {authoredRoster} from '../game/content-roster.js';
import {OPERATIVES} from '../game/data.js';
import {CIVIC_RECRUITS} from '../game/civic-recruits.js';
import {validateCorrespondence} from '../game/correspondence.js';

// These are isolated helper-admission records, not an earned campaign death.
// The caller's validated battle return/hourly death proof has separate coverage.
const fixture=()=>{
 const state={hour:6,secondOfHour:17,seed:42,resources:{treasury:2192},recruited:[107,116],
  contentCampaign:{package:defaultContentPackage()},
  operativeState:{107:{alive:true,hp:72,energy:100,morale:80,medkits:2,inventory:{}},116:{alive:false,hp:0,energy:0,morale:80,medkits:2,inventory:{}}},
  contracts:{107:{kind:'paid',term:'week',started:0,expiresAt:168,paid:588},116:{kind:'paid',term:'week',started:0,expiresAt:168,paid:336}}};
 return {state,roster:authoredRoster(state,[...OPERATIVES,...CIVIC_RECRUITS])};
};
const receive=({state,roster},ids=[116],options)=>receiveCompanionLossCorrespondence(state,roster,ids,options);
function silent(change,ids=[116],options){
 const f=fixture();change(f);const before=structuredClone(f.state);
 assert.deepEqual(receive(f,ids,options),[]);assert.deepEqual(f.state,before);
}

test('one confirmed directed loss creates only the named written receipt with no other state change',()=>{
 const f=fixture(),before=structuredClone(f.state);assert.deepEqual(receive(f,[116,116]),['companion-loss:107:116']);
 assert.deepEqual(f.state.correspondence,[{id:'companion-loss:107:116',sender:'Inés Aguirre',subject:'Una pérdida en el destacamento',
  text:'Lamento la muerte de Petrona Lagos. Confiaba en su ayuda.',hour:6,received:true}]);
 const {correspondence,...unchanged}=f.state;assert.deepEqual(unchanged,before);assert.doesNotThrow(()=>validateCorrespondence(f.state));
});

test('only supplied numeric casualties with a present actually dead record can produce a letter',()=>{
 for(const ids of [[],[107],['116'],[null,false,NaN,Infinity,-1],undefined]){
  const f=fixture(),before=structuredClone(f.state);assert.deepEqual(receiveCompanionLossCorrespondence(f.state,f.roster,ids),[]);assert.deepEqual(f.state,before);
 }
 for(const change of [f=>delete f.state.operativeState[116],f=>{f.state.operativeState[116].alive=true;f.state.operativeState[116].hp=14;},
  f=>f.state.operativeState[116].hp=1,f=>f.state.operativeState[116].alive=true,
  f=>f.roster=f.roster.filter(op=>op.id!==116)])silent(change);
 silent(f=>f.state.operativeState[9999]={alive:false,hp:0},[9999]);
});

test('preferences are directed and absent or older pinned definitions remain neutral',()=>{
 const person=(f,id)=>f.state.contentCampaign.package.characters.find(c=>c.id===`person-${id}`);
 silent(f=>{person(f,107).preferredCompanions=[];person(f,116).preferredCompanions=[{character:'person-107',reason:'Preferencia ficticia inversa.'}];});
 silent(f=>delete person(f,107).preferredCompanions);
 silent(f=>{for(const c of f.state.contentCampaign.package.characters)delete c.preferredCompanions;},[116]);
 // A newer roster object must not add a preference to an older pinned package.
 const f=fixture();delete person(f,107).preferredCompanions;assert.equal(f.roster.find(o=>o.id===107).preferredCompanions.length,1);
 assert.deepEqual(receive(f),[]);assert.equal(f.state.correspondence,undefined);
});

test('permanently invalid speakers remain neutral and incapacity without a new death source cannot backfill',()=>{
 for(const change of [f=>f.state.recruited=[116],f=>delete f.state.contracts[107],
  f=>f.state.operativeState[107].captured=true,f=>f.state.operativeState[107].surrendered=true,
  f=>{f.state.operativeState[107].alive=false;f.state.operativeState[107].hp=0;},
  f=>f.state.operativeState[107].hp=14,f=>f.state.operativeState[107].energy=0,
  f=>f.state.operativeState[107].unconscious=true,f=>f.state.operativeState[107].asleep=true,
  f=>f.state.operativeState[107].sleepCollapsed=true])silent(change);
});

test('exact paid expiry excludes the speaker at its instant without ending or altering the contract',()=>{
 const f=fixture();f.state.contracts[107].expiresAt=6;f.state.contracts[107].expiresSecond=18;
 const contract=structuredClone(f.state.contracts[107]);assert.deepEqual(receive(f),['companion-loss:107:116']);assert.deepEqual(f.state.contracts[107],contract);
 for(const now of [18,19])silent(f=>{f.state.secondOfHour=now;f.state.contracts[107].expiresAt=6;f.state.contracts[107].expiresSecond=18;f.state.contracts[107].departurePending=true;});
 for(const change of [f=>f.state.contracts[107].expiresAt=null,f=>delete f.state.contracts[107].expiresAt,
  f=>f.state.contracts[107].started=7,f=>f.state.contracts[107].expiresSecond='18',f=>f.state.contracts[107].paid=-1,
  f=>f.state.contracts[107].term='unissued',f=>f.state.contracts[107].departurePending='true',
  f=>f.state.contracts[107].paid=1e9+1,f=>f.state.contracts[107].expiresAt=1e9+1])silent(change);
});

test('active permanent and legacy service can react without a fabricated wage or paid expiry',()=>{
 for(const kind of ['patriot','legacy']){
  const f=fixture();f.state.contracts[107]={kind,term:'month',started:0,expiresAt:null,paid:0};const before=structuredClone(f.state.contracts);
  assert.deepEqual(receive(f),['companion-loss:107:116']);assert.deepEqual(f.state.contracts,before);assert.equal(f.state.resources.treasury,2192);
  const deferred=deferredFixture(f=>{f.state.contracts[107]={kind,term:'month',started:0,expiresAt:null,paid:0};f.state.operativeState[107].asleep=true;});
  assert.deepEqual(deferred.state.operativeState[107].pendingCompanionLoss,[pendingReceipt(deferred)]);assert.doesNotThrow(()=>validatePendingCompanionLoss(deferred.state,deferred.roster));
  deferred.state.operativeState[107].asleep=false;assert.deepEqual(deliverPendingCompanionLossCorrespondence(deferred.state,deferred.roster),['companion-loss:107:116']);
  assert.equal(deferred.state.resources.treasury,2192);assert.deepEqual(deferred.state.contracts[107],before[107]);
 }
});

test('unknown still-deployed health without new death evidence stays neutral until the caller confirms settlement',()=>{
 const f=fixture();f.state.pendingBattle={id:'admission-fixture',squad:[{id:'107',hp:1}]};const before=structuredClone(f.state);
 assert.deepEqual(receive(f),[]);assert.deepEqual(f.state,before);
 assert.deepEqual(receive(f,[116],{settledIds:['107']}),[]);assert.deepEqual(f.state,before);
 assert.deepEqual(receive(f,[116],{settledIds:[116]}),[]);assert.deepEqual(f.state,before);
 assert.deepEqual(receive(f,[116],{settledIds:[107,116]}),['companion-loss:107:116']);
 assert.deepEqual(f.state.pendingBattle,before.pendingBattle);
});

const deferredFixture=(change=f=>{f.state.operativeState[107].asleep=true;})=>{
 const f=fixture();f.state.operativeState[116].deathMinute=f.state.hour*60+Math.floor(f.state.secondOfHour/60);change(f);
 assert.deepEqual(receive(f),[]);assert.doesNotThrow(()=>validatePendingCompanionLoss(f.state,f.roster));return f;
};
const pendingReceipt=f=>({companionId:116,hour:6,secondOfHour:17,serviceKind:f.state.contracts[107].kind,serviceStarted:0,serviceStartedSecond:0});

test('new confirmed loss survives each temporary writing barrier and delivers only after that barrier clears',()=>{
 const cases=[
  {block:r=>r.asleep=true,recover:r=>r.asleep=false},
  {block:r=>r.hp=14,recover:r=>r.hp=15},
  {block:r=>r.energy=0,recover:r=>r.energy=1},
  {block:r=>r.unconscious=true,recover:r=>r.unconscious=false},
  {block:r=>r.sleepCollapsed=true,recover:r=>r.sleepCollapsed=false}
 ];
 // These are declared pure-helper eligibility boundaries. Actual recovery,
 // finite costs and official campaign save/replay are tested in the paid route.
 for(const {block,recover}of cases){
  const f=deferredFixture(f=>block(f.state.operativeState[107]));
  assert.deepEqual(f.state.operativeState[107].pendingCompanionLoss,[pendingReceipt(f)]);
  assert.deepEqual(f.state.operativeState[116].companionLossConfirmation,{hour:6,secondOfHour:17,source:'bleeding'});
  const before=structuredClone(f.state);validatePendingCompanionLoss(f.state,f.roster);assert.deepEqual(f.state,before);
  assert.deepEqual(receive(f,[116,116]),[]);assert.deepEqual(f.state,before,'a repeated confirmation cannot replace the source or queue');
  assert.deepEqual(deliverPendingCompanionLossCorrespondence(f.state,f.roster),[]);assert.deepEqual(f.state,before);
  f.state=JSON.parse(JSON.stringify(f.state));recover(f.state.operativeState[107]);f.state.hour=7;
  const ready=structuredClone(f.state);assert.deepEqual(deliverPendingCompanionLossCorrespondence(f.state,f.roster),['companion-loss:107:116']);
  assert.equal(f.state.operativeState[107].pendingCompanionLoss,undefined);assert.equal(f.state.correspondence[0].hour,7);assert.equal(f.state.operativeState[107].morale,80);
  const expected=structuredClone(ready);delete expected.operativeState[107].pendingCompanionLoss;expected.correspondence=f.state.correspondence;
  assert.deepEqual(f.state,expected);assert.doesNotThrow(()=>validatePendingCompanionLoss(f.state,f.roster));
  const delivered=structuredClone(f.state);assert.deepEqual(deliverPendingCompanionLossCorrespondence(f.state,f.roster),[]);assert.deepEqual(receive(f),[]);assert.deepEqual(f.state,delivered);
 }
 const f=deferredFixture(f=>{f.state.pendingBattle={id:'issued-fixture',squad:[{id:107,hp:72}]};});
 const before=structuredClone(f.state);assert.deepEqual(deliverPendingCompanionLossCorrespondence(f.state,f.roster,{settledIds:['107']}),[]);assert.deepEqual(f.state,before);
 assert.deepEqual(deliverPendingCompanionLossCorrespondence(f.state,f.roster,{settledIds:[107]}),['companion-loss:107:116']);assert.deepEqual(f.state.pendingBattle,before.pendingBattle);
});

test('a deferred return requires the matching issued casualty and hourly death requires its exact new wound minute',()=>{
 for(const deathMinute of [undefined,359,361,'360'])silent(f=>{f.state.operativeState[107].asleep=true;f.state.operativeState[116].deathMinute=deathMinute;});
 const returned=()=>{const f=fixture();f.state.pendingBattle={id:'actual-return-fixture',squad:[{id:107,hp:72},{id:116,hp:32}]};f.state.operativeState[107].hp=14;return f;};
 for(const [battleId,modify]of [['other-return',()=>{}],['actual-return-fixture',f=>f.state.pendingBattle.squad[1].hp=0],['actual-return-fixture',f=>f.state.pendingBattle.squad.pop()]]){
  const f=returned();modify(f);const before=structuredClone(f.state);assert.deepEqual(receive(f,[116],{battleId}),[]);assert.deepEqual(f.state,before);
 }
 const f=returned();assert.deepEqual(receive(f,[116],{battleId:f.state.pendingBattle.id}),[]);
 assert.deepEqual(f.state.operativeState[107].pendingCompanionLoss,[pendingReceipt(f)]);
 assert.deepEqual(f.state.operativeState[116].companionLossConfirmation,{hour:6,secondOfHour:17,source:'return',battleId:'actual-return-fixture'});
 assert.doesNotThrow(()=>validatePendingCompanionLoss(f.state,f.roster));
});

test('pending validation is read-only and rejects forged preference, death, date, service and receipt shapes',()=>{
 const original=deferredFixture(),valid=structuredClone(original.state);validatePendingCompanionLoss(original.state,original.roster);assert.deepEqual(original.state,valid);
 const changes=[
  f=>f.state.operativeState[107].pendingCompanionLoss=[],
  f=>f.state.operativeState[107].pendingCompanionLoss={},
  f=>f.state.operativeState[107].pendingCompanionLoss.push({...pendingReceipt(f)}),
  f=>f.state.operativeState[107].pendingCompanionLoss=new Array(1),
  f=>{const rows=f.state.operativeState[107].pendingCompanionLoss;delete rows[0];rows.extra=pendingReceipt(f);},
  f=>f.state.operativeState[107].pendingCompanionLoss[0].companionId='116',
  f=>f.state.operativeState[107].pendingCompanionLoss[0].companionId=107,
  f=>f.state.operativeState[107].pendingCompanionLoss[0].companionId=9999,
  f=>f.state.operativeState[107].pendingCompanionLoss[0].hour=7,
  f=>f.state.operativeState[107].pendingCompanionLoss[0].secondOfHour=16,
  f=>f.state.operativeState[107].pendingCompanionLoss[0].secondOfHour=3600,
  f=>f.state.operativeState[107].pendingCompanionLoss[0].serviceKind='legacy',
  f=>f.state.operativeState[107].pendingCompanionLoss[0].serviceStarted=1,
  f=>f.state.operativeState[107].pendingCompanionLoss[0].serviceStartedSecond=18,
  f=>f.state.operativeState[107].pendingCompanionLoss[0].extra=true,
  f=>delete f.state.operativeState[116].companionLossConfirmation,
  f=>f.state.operativeState[116].companionLossConfirmation.source='unconfirmed',
  f=>f.state.operativeState[116].companionLossConfirmation.secondOfHour=18,
  f=>f.state.operativeState[116].companionLossConfirmation.extra=true,
  f=>f.state.operativeState[116].deathMinute=359,
  f=>{f.state.operativeState[116].alive=true;f.state.operativeState[116].hp=14;},
  f=>delete f.state.contentCampaign.package.characters.find(c=>c.id==='person-107').preferredCompanions,
  f=>f.state.recruited=[116],f=>f.state.operativeState[107].captured=true,
  f=>f.state.operativeState[107].surrendered=true,
  f=>f.state.contracts[107].expiresAt=6,
  f=>f.state.correspondence=[{id:'companion-loss:107:116'}]
 ];
 for(const change of changes){const f={state:structuredClone(valid),roster:original.roster};change(f);const before=structuredClone(f.state);assert.throws(()=>validatePendingCompanionLoss(f.state,f.roster),/aviso pendiente/);assert.deepEqual(f.state,before);}
});

test('renewal keeps a valid pending loss but expiry or service removal cannot revive it on rehire',()=>{
 const f=deferredFixture(),cash=f.state.resources.treasury;
 f.state.contracts[107]={kind:'paid',term:'day',started:6,startedSecond:17,expiresAt:174,expiresSecond:17,paid:84};
 assert.throws(()=>validatePendingCompanionLoss(f.state,f.roster),/aviso pendiente/);
 renewPendingCompanionLossService(f.state,107);assert.doesNotThrow(()=>validatePendingCompanionLoss(f.state,f.roster));
 assert.deepEqual(f.state.operativeState[107].pendingCompanionLoss,[{...pendingReceipt(f),serviceStarted:6,serviceStartedSecond:17}]);assert.equal(f.state.resources.treasury,cash);
 for(const reason of ['expiry','dismissal','capture']){
  const invalid=deferredFixture(),confirmation=structuredClone(invalid.state.operativeState[116].companionLossConfirmation);
  if(reason==='expiry'){invalid.state.hour=168;assert.deepEqual(deliverPendingCompanionLossCorrespondence(invalid.state,invalid.roster),[]);}
  else {if(reason==='dismissal')invalid.state.recruited=[116];else invalid.state.operativeState[107].captured=true;cancelPendingCompanionLoss(invalid.state,107);}
  assert.equal(invalid.state.operativeState[107].pendingCompanionLoss,undefined);
  invalid.state.recruited=[107,116];delete invalid.state.operativeState[107].captured;invalid.state.operativeState[107].asleep=false;
  invalid.state.contracts[107]={kind:'paid',term:'week',started:invalid.state.hour,startedSecond:17,expiresAt:invalid.state.hour+168,expiresSecond:17,paid:588};
  assert.deepEqual(deliverPendingCompanionLossCorrespondence(invalid.state,invalid.roster),[]);assert.equal(invalid.state.correspondence,undefined);assert.deepEqual(invalid.state.operativeState[116].companionLossConfirmation,confirmation);
  assert.doesNotThrow(()=>validatePendingCompanionLoss(invalid.state,invalid.roster));
 }
});

test('pinned authored names override later roster labels and the existing saved inbox deduplicates the loss',()=>{
 const f=fixture();f.state.contentCampaign.package.characters.find(c=>c.id==='person-107').name='Autora de campaña';
 f.state.contentCampaign.package.characters.find(c=>c.id==='person-116').name='Compañera de campaña';
 f.roster.find(o=>o.id===107).name='Etiqueta posterior';f.roster.find(o=>o.id===116).name='Otro nombre posterior';
 assert.deepEqual(receive(f),['companion-loss:107:116']);assert.equal(f.state.correspondence[0].sender,'Autora de campaña');
 assert.equal(f.state.correspondence[0].text,'Lamento la muerte de Compañera de campaña. Confiaba en su ayuda.');
 const restored={state:JSON.parse(JSON.stringify(f.state)),roster:f.roster},before=structuredClone(restored.state);
 assert.deepEqual(receive(restored),[]);assert.deepEqual(restored.state,before);assert.doesNotThrow(()=>validateCorrespondence(restored.state));
});
