import test from 'node:test';
import assert from 'node:assert/strict';
import {receiveCompanionLossCorrespondence} from '../game/companion-loss.js';
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

test('dismissed, captive, surrendered, dead or incapacitated speakers cannot send the reaction',()=>{
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
 }
});

test('unknown still-deployed health is excluded until the caller explicitly confirms that speaker as settled',()=>{
 const f=fixture();f.state.pendingBattle={id:'admission-fixture',squad:[{id:'107',hp:1}]};const before=structuredClone(f.state);
 assert.deepEqual(receive(f),[]);assert.deepEqual(f.state,before);
 assert.deepEqual(receive(f,[116],{settledIds:['107']}),[]);assert.deepEqual(f.state,before);
 assert.deepEqual(receive(f,[116],{settledIds:[116]}),[]);assert.deepEqual(f.state,before);
 assert.deepEqual(receive(f,[116],{settledIds:[107,116]}),['companion-loss:107:116']);
 assert.deepEqual(f.state.pendingBattle,before.pendingBattle);
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
