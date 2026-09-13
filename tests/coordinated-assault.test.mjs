import {AMMUNITION_RESOURCE_KEYS} from '../game/campaign-ammunition.js';
import {stockAmmo,stockAndCarriedAmmo} from './ammunition-balance.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,restoreCampaign,serializeCampaign,rosterFor} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {assaultGroups} from '../game/squad-travel.js';
import {operativeInTransit} from '../game/squads.js';
import {localDefenderIds} from '../game/enemy-groups.js';
import {entryFromSector,boundaryMatches} from '../game/tactical-exits.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {scriptedBattleReport} from './scripted-battle-report.mjs';
import {rosterCells} from '../game/ja2-hud.js';
import {actBattle} from '../game/tactical.js';
const order=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null,`${a.type}: ${next.lastError}`);return next;};
const queue=s=>order(s,{type:'attack',sector:'san_nicolas',queue:true});
const wait=(s,hours)=>order(s,{type:'wait',hours});
const roundtrip=s=>assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);
// Established-front fixture: two recruited squads in different adjacent sectors.
// Every approach, rendezvous, deployment and return uses production rules.
function front(count=12){
 let s=initialCampaign();const ids=[3,4,10,100,101,102,103,104,105,106,107,108].slice(0,count);s.recruited=ids;s.contracts=Object.fromEntries(ids.map(id=>[id,{kind:'legacy',term:'month',started:0,expiresAt:null,paid:0}]));
 s.squads=[{id:'squad-1',name:'Columna del sur',location:'buenos_aires',members:ids.slice(0,6)},{id:'squad-2',name:'Columna del oeste',location:'cordoba',members:ids.slice(6)}];s.squad=[...s.squads[0].members];s.location='buenos_aires';s.sectors.cordoba.owner='patriot';for(const q of s.squads)for(const id of q.members)s.operativeState[id].location=q.location;
 return order(s,{type:'selectSquad',id:'squad-1'});
}
function both(){let s=queue(front());s=order(s,{type:'selectSquad',id:'squad-2'});return queue(s);}
const begin=s=>order(s,{type:'beginAssault',sector:'san_nicolas'});
test('two queued attacks stage at the boundary and deploy twelve soldiers through their own edges',()=>{
 let s=both();assert.equal(s.hour,0);s=wait(s,24);assert.equal(s.hour,12);assert.equal(s.pendingBattle,null);assert.deepEqual(s.squads.map(q=>q.journey.status),['ready','ready']);assert.equal(assaultGroups(s)[0].ready.length,2);assert.ok(s.recruited.every(id=>operativeInTransit(s,id)));assert.deepEqual(localDefenderIds(s,'buenos_aires'),[]);roundtrip(s);
 s=begin(s);assert.equal(s.hour,12);assert.equal(s.pendingBattle.squad.length,12);assert.equal(s.pendingBattle.assaultSquads.length,2);assert.ok(s.squads.every(q=>q.members.length===6&&q.location==='san_nicolas'&&!q.journey));assert.equal(s.pendingBattle.enemies.length,6,'additional squads do not create matching reinforcements');roundtrip(s);
 const b=enterSector(s.pendingBattle);assert.equal(b.units.filter(u=>u.side==='player').length,12);assert.equal(rosterCells(b.units.filter(u=>u.side==='player'),'103',b).filter(c=>!c.empty).length,12);
 for(const q of s.pendingBattle.assaultSquads){const entry=entryFromSector(q.origin,'san_nicolas');for(const id of q.members){const u=b.units.find(u=>u.id===String(id));assert.equal(u.entryEdge,entry.entryEdge);assert.ok(boundaryMatches(b,u,entry.entryEdge));}}
 assert.equal(new Set(b.units.filter(u=>u.side==='player').map(u=>`${u.x},${u.y}`)).size,12);assert.equal(decodeSave(encodeSave(s,b)).battle.units.length,b.units.length);
});
test('the first arrival can wait without extra marching and then include the later squad',()=>{
 let s=queue(front());s=wait(s,4);s=order(s,{type:'selectSquad',id:'squad-2'});s=queue(s);s=wait(s,24);assert.equal(s.hour,12);let group=assaultGroups(s)[0];assert.equal(group.ready.length,1);assert.equal(group.incoming[0].remaining,4);const fatigue=s.operativeState[3].fatigue;roundtrip(s);
 s=wait(s,24);assert.equal(s.hour,16);assert.equal(s.operativeState[3].fatigue,fatigue);assert.equal(assaultGroups(s)[0].ready.length,2);s=begin(s);assert.equal(s.pendingBattle.squad.length,12);roundtrip(s);
});
test('a staged squad cannot teleport home, work, sleep, or defend its departure sector',()=>{
 let s=wait(queue(front()),12);for(const a of [{type:'setSleep',operativeId:3,asleep:true},{type:'assignCare',operativeId:3,assignment:'rest'},{type:'visitSector'},{type:'createSquad',name:'Atajo',ids:[3]},{type:'dismiss',id:3}])assert.ok(dispatchCampaign(s,a).lastError,a.type);
 s=order(s,{type:'cancelTravel',choice:'stop'});assert.equal(s.squads[0].journey.returning,true);assert.equal(s.squads[0].journey.elapsed,12);roundtrip(s);s=wait(s,6);assert.ok(operativeInTransit(s,3));s=wait(s,24);assert.equal(s.hour,24);assert.equal(s.location,'buenos_aires');assert.equal(s.squads[0].journey,undefined);assert.equal(s.operativeState[3].fatigue,48);
});
test('attacking now uses only ready squads; later squads return without joining a running battle',()=>{
 let s=queue(front());s=wait(s,4);s=order(s,{type:'selectSquad',id:'squad-2'});s=queue(s);s=wait(s,24);s=begin(s);assert.equal(s.pendingBattle.squad.length,6);assert.equal(s.activeSquadId,'squad-2');assert.equal(s.location,'cordoba');assert.equal(s.pendingBattle.assaultSquads[0].id,'squad-1');roundtrip(s);
 s=order(s,{type:'syncTacticalTime',battleId:s.pendingBattle.id,elapsedSeconds:8*3600});assert.equal(s.squads[1].journey,undefined);assert.equal(s.squads[1].location,'cordoba');assert.equal(s.pendingBattle.squad.length,6);roundtrip(s);
});
test('combined victory keeps squad membership, wounds and finite ammunition accounting',()=>{
 let s=both();for(const key of Object.values(AMMUNITION_RESOURCE_KEYS))s.resources[key]=0;s.depots.buenos_aires={ammo_pistol_54:10,ammo_pistol_50:10,ammo_shot_16:10};s.depots.cordoba={ammo_shot_16:10,ammo_rifle_62:10,ammo_pistol_69:10,ammo_carbine_65:10};s=begin(wait(s,12));assert.equal(s.pendingBattle.issuedCartridges,70);assert.ok(Object.values(s.depots.buenos_aires).every(n=>n===0));assert.ok(Object.values(s.depots.cordoba).every(n=>n===0));assert.equal(stockAmmo(s),0);
 const memberships=s.squads.map(q=>[...q.members]),report=scriptedBattleReport(s);s=order(s,report);assert.equal(s.pendingBattle,null);assert.equal(s.sectors.san_nicolas.owner,'patriot');assert.deepEqual(s.squads.map(q=>q.members),memberships);assert.ok(s.squads.every(q=>q.location==='san_nicolas'));roundtrip(s);
 assert.ok(dispatchCampaign(s,report).lastError,'the same report cannot credit equipment twice');
});
test('an actual tactical withdrawal returns both columns through separate exits',()=>{
 let s=begin(wait(both(),12)),b=enterSector(s.pendingBattle);assert.equal(b.phase,'player');
 for(const group of s.pendingBattle.assaultSquads){const exit=b.exits.find(e=>e.destination===group.origin);b=actBattle(b,{type:'exit',unitIds:group.members.map(String),exitId:exit.id});assert.equal(b.lastError,null,b.lastError);}
 assert.equal(b.status,'retreat');s=order(s,{type:'battleResult',battleId:s.pendingBattle.id,outcome:'retreat',sectorState:b,survivors:b.units.filter(u=>u.side==='player')});assert.deepEqual(s.squads.map(q=>q.location),['buenos_aires','cordoba']);assert.ok(s.squads.every(q=>q.members.length===6));roundtrip(s);
});
test('expired contracts remain with the staged deployment and leave after physical return',()=>{
 let s=front();s.contracts[3]={kind:'paid',term:'day',started:0,expiresAt:4,paid:100};s=wait(queue(s),12);assert.equal(s.hour,2);s=wait(s,12);assert.equal(s.hour,4);s=wait(s,12);assert.equal(s.contracts[3].departurePending,true);roundtrip(s);s=begin(s);assert.ok(s.pendingBattle.squad.some(u=>u.id===3));roundtrip(s);s=order(s,scriptedBattleReport(s));assert.equal(s.contracts[3],undefined);assert.equal(s.operativeState[3].location,'san_nicolas');assert.ok(!s.recruited.includes(3));roundtrip(s);
});
test('invalid assault saves and attempts to deploy before arrival are rejected',()=>{
 const moving=queue(front());assert.ok(dispatchCampaign(moving,{type:'beginAssault',sector:'san_nicolas'}).lastError);const ready=wait(moving,12);
 for(const alter of [j=>j.elapsed=11,j=>j.intent=undefined,j=>j.returning=true,j=>j.path.push('santa_fe')]){const bad=structuredClone(ready);alter(bad.squads[0].journey);assert.throws(()=>restoreCampaign(serializeCampaign(bad)));}
 const deployed=begin(wait(both(),12));for(const alter of [b=>b.assaultSquads.pop(),b=>b.assaultSquads[1].members[0]=3,b=>b.assaultSquads[0].origin='retiro',b=>delete b.assaultSquads,b=>b.squad.pop(),b=>b.squad[0].entryEdge='N']){const bad=structuredClone(deployed);alter(bad.pendingBattle);assert.throws(()=>restoreCampaign(serializeCampaign(bad)));}
});
test('a target liberated while columns wait is entered peacefully without paying for a battle',()=>{
 let s=wait(both(),12);s.sectors.san_nicolas.owner='patriot';const stock=structuredClone(s.resources);s=begin(s);assert.equal(s.pendingBattle,null);assert.deepEqual(s.resources,stock);assert.ok(s.squads.every(q=>q.location==='san_nicolas'&&!q.journey));roundtrip(s);
});

test('all eight six-person squads fit the real deployment and remain separate',()=>{
 let s=initialCampaign();const ids=rosterFor(s).filter(o=>s.operativeState[o.id]).slice(0,48).map(o=>o.id);assert.equal(ids.length,48);s.recruited=ids;s.contracts=Object.fromEntries(ids.map(id=>[id,{kind:'legacy',term:'month',started:0,expiresAt:null,paid:0}]));s.sectors.cordoba.owner='patriot';
 s.squads=Array.from({length:8},(_,i)=>({id:`squad-${i+1}`,name:`Columna ${i+1}`,location:i%2?'cordoba':'buenos_aires',members:ids.slice(i*6,i*6+6)}));s.location='buenos_aires';s.squad=[...s.squads[0].members];for(const q of s.squads)for(const id of q.members)s.operativeState[id].location=q.location;
 for(const q of s.squads){s=order(s,{type:'selectSquad',id:q.id});s=queue(s);}s=begin(wait(s,12));roundtrip(s);const b=enterSector(s.pendingBattle);assert.equal(b.units.filter(u=>u.side==='player').length,48);assert.equal(new Set(b.units.map(u=>`${u.x},${u.y}`)).size,b.units.length);assert.equal(decodeSave(encodeSave(s,b)).campaign.pendingBattle.squad.length,48);
});
test('insufficient attack supplies leave staged squads and the clock unchanged',()=>{
 const s=wait(both(),12);s.resources.powder=0;const before=serializeCampaign(s),next=dispatchCampaign(s,{type:'beginAssault',sector:'san_nicolas'});assert.ok(next.lastError);assert.equal(serializeCampaign(s),before);assert.deepEqual(next.squads,s.squads);assert.equal(next.hour,s.hour);assert.equal(next.pendingBattle,null);
});

test('travel orders cannot smuggle an assault intent past attack admission',()=>{
 const s=front(),next=dispatchCampaign(s,{type:'travel',queue:true,intent:'attack',sector:'san_nicolas'});assert.ok(next.lastError);assert.equal(next.pendingBattle,null);assert.ok(s.squads.every(q=>!q.journey));
});
test('a squad already in an occupied sector can fight without a second approach',()=>{
 let s=front();s.location='san_nicolas';s.squads[0].location='san_nicolas';for(const id of s.squad){s.operativeState[id].location='san_nicolas';s.operativeState[id].fatigue=96;s.operativeState[id].energy=10;}s=queue(s);assert.equal(s.hour,0);assert.ok(s.pendingBattle);roundtrip(s);
});


test('loss of the active column selects the existing surviving squad without duplicating its members',()=>{
 let s=begin(wait(both(),12));const active=s.activeSquadId,fallen=[...s.squads.find(q=>q.id===active).members],surviving=structuredClone(s.squads.find(q=>q.id!==active)),report=scriptedBattleReport(s);
 // This settlement fixture preserves every combatant and all finite equipment;
 // it declares the active column's deaths after the coordinated victory.
 for(const unit of report.sectorState.units.filter(u=>u.side==='player'&&fallen.includes(Number(u.id))))Object.assign(unit,{hp:0,bleeding:0,bandaged:0,unconscious:false,ap:0});
 report.survivors=report.sectorState.units.filter(u=>u.side==='player');s=order(s,report);
 assert.equal(s.activeSquadId,surviving.id);assert.deepEqual(s.squad,surviving.members);assert.deepEqual(s.squads.find(q=>q.id===surviving.id).members,surviving.members);assert.deepEqual(s.squads.find(q=>q.id===active).members,[]);
 const members=s.squads.flatMap(q=>q.members);assert.equal(new Set(members).size,members.length);assert.ok(fallen.every(id=>!s.operativeState[id].alive));roundtrip(s);
});
