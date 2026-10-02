import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchCampaign} from '../game/campaign.js';
import {getReachable} from '../game/tactical.js';
import {civilianIncidents} from '../game/civilian-harm.js';
import {encountersFor} from '../game/encounters.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {order,saved,localId,hireLocal,visit,localNPC,tactical,A} from './local-contract-fixture.mjs';
import {woundedService} from './civilian-service-fixture.mjs';
import {serviceReturnSources} from '../game/service-equipment-return.js';
const ledger=s=>s.civilianState.people[`person-${localId(s)}`];
const returnedTorches=(s,id)=>serviceReturnSources(s,s.operativeState[id].location).filter(row=>row.operativeId===id&&row.stack?.item==='torches').reduce((n,row)=>n+row.stack.count,0);


test('dismissal returns the actual military wound and spent supplies before any new civilian encounter',()=>{
 let s=woundedService(),id=localId(s),actual=structuredClone(s.operativeState[id]);s=order(s,{type:'dismiss',id});
 assert.equal(ledger(s).inService,undefined);assert.equal(ledger(s).health.hp,actual.hp);assert.equal(ledger(s).health.bleeding,actual.bleeding);assert.equal(ledger(s).sector,A);
 assert.equal(ledger(s).health.bleedSource.side,'unknown');assert.equal(s.operativeState[id].torches,0);assert.equal(encountersFor(s,A).find(n=>n.operativeId===id).civilianSupplies.torches,0);assert.equal(returnedTorches(s,id),actual.torches);
 s=saved({campaign:s}).campaign;const at=s.hour*3600+(s.secondOfHour??0),expectedMinute=Math.floor((at+Math.ceil(actual.hp/actual.bleeding)*6)/60);
 s=order(s,{type:'wait',hours:1});assert.equal(s.operativeState[id].alive,false);assert.equal(s.operativeState[id].deathMinute,expectedMinute);assert.equal(ledger(s).health.hp,0);assert.equal(civilianIncidents(ledger(s).health).at(-1).side,'unknown');assert.ok(saved({campaign:s}));
});

test('the service record remains authoritative while still hired and expiry resumes the civilian wound once',()=>{
 let s=woundedService(),id=localId(s);const end=s.contracts[id].expiresAt;assert.ok(end>s.hour);
 for(let n=0;s.hour<end&&n<5;n++)s=order(s,{type:'wait',hours:end-s.hour});assert.ok(!s.recruited.includes(id));assert.equal(ledger(s).inService,undefined);assert.equal(ledger(s).health.hp,s.operativeState[id].hp);assert.ok(ledger(s).health.hp>0);assert.equal(ledger(s).health.bleeding,s.operativeState[id].bleeding);
 const remaining=s.operativeState[id].torches;s=saved({campaign:s}).campaign;s=order(s,{type:'wait',hours:1});assert.equal(ledger(s).health.hp,0);assert.equal(s.operativeState[id].torches,remaining);assert.equal(civilianIncidents(ledger(s).health).filter(e=>e.kind==='death').length,1);assert.ok(saved({campaign:s}));
});

test('an older departed service bit resumes current health without healing or creating another stock allocation',()=>{
 let serving=woundedService(),id=localId(serving),s=order(serving,{type:'dismiss',id});
 const wire=JSON.parse(encodeSave(s));wire.campaign.civilianState.people[`person-${id}`]=structuredClone(ledger(serving));
 const migrated=decodeSave(JSON.stringify(wire)).campaign;assert.equal(ledger(migrated).inService,undefined);assert.equal(ledger(migrated).health.hp,s.operativeState[id].hp);assert.equal(migrated.operativeState[id].torches,s.operativeState[id].torches);assert.ok(saved({campaign:migrated}));
 const extra=structuredClone(wire);extra.campaign.civilianState.people[`person-${id}`].unexpected=true;assert.throws(()=>decodeSave(JSON.stringify(extra)));
 const invalid=structuredClone(wire),old=invalid.campaign.civilianState.people[`person-${id}`].health;old.hp=0;old.unconscious=false;old.bleeding=0;delete old.bleedSource;old.civilianWoundVersion=1;old.civilianHarm={version:1,incidents:[{sequence:1,kind:'death',attackerId:null,side:'unknown',militia:false,intentional:false,hpBefore:1,hpAfter:0}]};
 assert.throws(()=>decodeSave(JSON.stringify(invalid)),/muerto/);
});


test('paid strategic care survives dismissal and rehire without restoring the older civilian wounds or supplies',()=>{
 let s=woundedService({medical:80}),id=localId(s),injury=s.operativeState[id].hp,torches=s.operativeState[id].torches;
 s=order(s,{type:'assignCare',id:110,assignment:'doctor'});s=order(s,{type:'assignCare',id,assignment:'patient'});const dressings=s.operativeState[110].medkits;
 s=order(s,{type:'wait',hours:2});const healed=s.operativeState[id].hp;assert.ok(healed>injury);assert.equal(s.operativeState[id].bleeding,0);assert.equal(s.operativeState[110].medkits,dressings-2);
 s=order(s,{type:'dismiss',id});assert.equal(ledger(s).health.hp,healed);assert.equal(ledger(s).health.bleeding,0);assert.equal(ledger(s).health.civilianWoundSeconds,undefined);
 s=order(saved({campaign:s}).campaign,{type:'wait',hours:24});assert.equal(ledger(s).health.hp,healed);s=order(s,{type:'assignCare',id:110,assignment:'active'});s=order(s,{type:'travel',sector:A});let p=visit(s);
 const target=localNPC(p.battle),u=p.battle.units.find(u=>Number(u.id)===110),spot=getReachable(p.battle,u.id).find(t=>Math.abs(t.x-target.x)+Math.abs(t.y-target.y)===1);assert.ok(spot);if(spot.cost)p=tactical(p,{type:'move',x:spot.x,y:spot.y});
 assert.ok(p.campaign.operativeState[id].arrival,'the previous retreat still has a service entry receipt');assert.equal(returnedTorches(p.campaign,id),torches);p=hireLocal(p,'week');assert.equal(p.campaign.operativeState[id].arrival,null);assert.equal(p.campaign.operativeState[id].residentSector,A);assert.equal(p.battle.units.find(u=>Number(u.id)===id).hp,healed);assert.equal(p.battle.units.find(u=>Number(u.id)===id).torches,0);assert.equal(ledger(p.campaign).inService,true);assert.ok(saved(p));
});

test('a real local-service casualty stays a military body after dismissal and never becomes a living resident',()=>{
 let s=woundedService({casualty:true}),id=localId(s);assert.equal(s.operativeState[id].alive,false);const receipt=structuredClone(ledger(s));
 s=order(s,{type:'dismiss',id});assert.deepEqual(ledger(s),receipt);assert.equal(encountersFor(s,A).some(n=>n.operativeId===id),false);
 assert.equal(s.sectorStates.buenos_aires.units.find(u=>Number(u.id)===id).hp,0);s=saved({campaign:s}).campaign;s=order(s,{type:'wait',hours:24});assert.equal(s.operativeState[id].alive,false);assert.equal(encountersFor(s,A).some(n=>n.operativeId===id),false);assert.ok(saved({campaign:s}));
});
