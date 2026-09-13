import {setTestAmmunition} from './typed-ammunition-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {launchEnemyGroup,enemyGroupStatus,delayCrossingEnemyGroups,advanceEnemyGroups} from '../game/enemy-groups.js';
import {playerKnownCampaign} from '../game/player-known-state.js';
import {enterSector} from '../game/world.js';
import {actBattle} from '../game/tactical.js';
import {autoResolve} from '../game/auto-resolve.js';
import {scriptedBattleReport} from './scripted-battle-report.mjs';
const order=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null,`${a.type}: ${next.lastError}`);return next;};
const wait=(s,hours)=>order(s,{type:'wait',hours});
const roundtrip=s=>{const loaded=restoreCampaign(serializeCampaign(s));assert.deepEqual(loaded,s);return loaded;};
const attack=s=>order(s,{type:'attack',sector:'salta',queue:true});
// Established northern front. The enemy reaches Salta through its actual route;
// all player movement, contact, deployment and return use campaign orders.
function front(hour=40){
 let s=initialCampaign();for(const at of ['cordoba','tucuman'])s.sectors[at].owner='patriot';
 s.location='tucuman';s.squads[0].location='tucuman';for(const id of s.squad)s.operativeState[id].location='tucuman';
 const group=launchEnemyGroup(s,'north','tucuman');group.units[0].hp=63;group.units[0].bandaged=37;setTestAmmunition(group.units[0],1);group.units[0].condition=42;
 s=wait(s,hour);assert.equal(s.hour,hour);assert.equal(s.enemyGroups[0].routeIndex,3);return roundtrip(s);
}
test('opposing routes delay the actual army, save its ETA, and meet at the attack destination',()=>{
 let s=attack(front()),g=s.enemyGroups[0];assert.equal(g.nextArrivalAt,53);assert.equal(g.arrivalAt,53);assert.equal(enemyGroupStatus(s,g).crossingAt,'salta');
 const view=playerKnownCampaign(s).enemyReports[0];assert.equal(view.crossingAt,'salta');assert.equal(view.remaining,13);assert.equal(view.units,undefined);assert.equal(view.route,undefined);
 s=wait(roundtrip(s),24);assert.equal(s.hour,52);assert.equal(s.pendingEncounter,null);assert.equal(s.squads[0].journey.status,'ready');assert.equal(s.enemyGroups[0].status,'marching');assert.equal(s.sectors.tucuman.owner,'patriot');
 const enemy=structuredClone(s.enemyGroups[0].units);s=order(roundtrip(s),{type:'beginAssault',sector:'salta'});assert.deepEqual(s.pendingBattle.occupationGroupIds,['enemy-group-1']);assert.deepEqual(s.pendingBattle.enemies,enemy);assert.equal(s.enemyGroups[0].target,'salta');assert.deepEqual(s.enemyGroups[0].route,['humahuaca','jujuy','salta']);roundtrip(s);
 const b=enterSector(s.pendingBattle),u=b.units.find(u=>u.id==='enemy-group-1-0');assert.equal(u.hp,63);assert.equal(u.bandaged,37);assert.equal(u.ammo,1);assert.equal(u.condition,42);assert.equal(b.units.filter(u=>u.side==='enemy').length,enemy.length);
});
test('ready columns hold the crossing while the player waits and can withdraw through a real exit',()=>{
 let s=wait(attack(front()),12);s=wait(s,4);assert.equal(s.hour,56);assert.equal(s.enemyGroups[0].nextArrivalAt,57);assert.equal(s.enemyGroups[0].status,'marching');roundtrip(s);
 s=order(s,{type:'beginAssault',sector:'salta'});let b=enterSector(s.pendingBattle);const exit=b.exits.find(e=>e.destination==='tucuman');b=actBattle(b,{type:'exit',unitIds:s.squad.map(String),exitId:exit.id});assert.equal(b.lastError,null);assert.equal(b.status,'retreat');
 s=order(s,{type:'battleResult',battleId:s.pendingBattle.id,outcome:'retreat',sectorState:b,survivors:b.units.filter(u=>u.side==='player')});assert.equal(s.location,'tucuman');assert.equal(s.enemyGroups[0].status,'stationed');assert.equal(s.enemyGroups[0].target,'salta');roundtrip(s);
 s=wait(s,20);assert.equal(s.enemyGroups[0].status,'stationed');assert.equal(s.enemyGroups[0].target,'salta');assert.equal(s.sectors.tucuman.owner,'patriot');
});
test('reversal cancels the interception without teleporting either force or restoring the enemy clock',()=>{
 let s=wait(attack(front()),3);s=order(s,{type:'cancelTravel',choice:'return'});assert.equal(enemyGroupStatus(s,s.enemyGroups[0]).crossingAt,null);assert.equal(s.enemyGroups[0].nextArrivalAt,53);s=wait(roundtrip(s),24);assert.equal(s.hour,46);assert.equal(s.location,'tucuman');assert.equal(s.squads[0].journey,undefined);assert.equal(s.enemyGroups[0].status,'marching');
 s=wait(s,24);assert.equal(s.hour,53);assert.equal(s.pendingEncounter.sector,'tucuman');assert.equal(s.pendingEncounter.groupId,'enemy-group-1');roundtrip(s);
});
test('a return to a newly occupied origin triggers contact and preserves the actual combat outcome',()=>{
 let s=wait(attack(front()),12);s=order(s,{type:'cancelTravel',choice:'return'});s=wait(s,24);assert.equal(s.hour,64);assert.equal(s.location,'tucuman');assert.equal(s.sectors.tucuman.owner,'royalist');assert.equal(s.pendingEncounter.sector,'tucuman');roundtrip(s);
 s=order(s,{type:'respondToEncounter',groupId:'enemy-group-1',choice:'tactical'});assert.equal(s.pendingBattle.wasRoyalist,true);assert.equal(s.pendingBattle.defenseFort,0);roundtrip(s);
 const result=autoResolve(s.pendingBattle);assert.ok(result.actions>0);assert.equal(result.timedOut,false);assert.equal(result.outcome,'victory');const b=result.battle;assert.ok(b.units.some(u=>u.hp<u.maxHp),'the new approach still resolves actual combat wounds');
 s=order(s,{type:'battleResult',battleId:s.pendingBattle.id,outcome:b.status,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});assert.equal(s.pendingBattle,null);assert.equal(s.enemyGroups[0].status,b.status==='victory'?'defeated':'stationed');assert.equal(s.sectors.tucuman.owner,b.status==='victory'?'patriot':'royalist');roundtrip(s);
});
test('a remote ordinary route intercepts troops at a controlled destination and stops further stages',()=>{
 let s=front();s=order(s,{type:'createSquad',name:'Enlace',ids:[3]});s=order(s,{type:'selectSquad',id:'squad-1'});s.sectors.salta.owner='patriot';s.sectors.jujuy.owner='patriot';
 // The remote squad receives the route, then another squad is selected.
 s=order(s,{type:'selectSquad',id:'squad-2'});s=order(s,{type:'travel',sector:'jujuy',queue:true});s=order(s,{type:'selectSquad',id:'squad-1'});s=wait(s,24);assert.equal(s.hour,52);assert.equal(s.location,'tucuman');assert.equal(s.pendingEncounter.sector,'salta');assert.equal(s.squads[1].location,'salta');assert.equal(s.squads[1].journey.status,'paused');assert.equal(s.squads[1].journey.reason,'contact');roundtrip(s);
 s=order(s,{type:'respondToEncounter',groupId:'enemy-group-1',choice:'tactical'});assert.deepEqual(s.pendingBattle.squad.map(u=>u.id),[3]);assert.equal(s.location,'tucuman');assert.equal(s.pendingBattle.enemies[0].hp,63);roundtrip(s);
});
test('direct travel and attack orders cannot bypass a crossing by using the blocking API',()=>{
 let s=order(front(),{type:'attack',sector:'salta'});assert.equal(s.hour,52);assert.deepEqual(s.pendingBattle.occupationGroupIds,['enemy-group-1']);assert.equal(s.pendingBattle.enemies[0].hp,63);roundtrip(s);
 s=front();s.sectors.salta.owner='patriot';s=order(s,{type:'travel',sector:'salta'});assert.equal(s.hour,52);assert.equal(s.pendingEncounter.sector,'salta');assert.equal(s.enemyGroups[0].target,'salta');roundtrip(s);
});
test('a crossing is caught when the enemy starts its next leg while the squad is already approaching',()=>{
 let s=initialCampaign();for(const at of ['cordoba','tucuman','salta'])s.sectors[at].owner='patriot';s.location='salta';s.squads[0].location='salta';for(const id of s.squad)s.operativeState[id].location='salta';launchEnemyGroup(s,'north','tucuman');s=wait(s,20);s=order(s,{type:'attack',sector:'jujuy',queue:true});assert.equal(s.enemyGroups[0].nextArrivalAt,24);
 s=wait(s,24);assert.equal(s.hour,38);assert.equal(s.squads[0].journey.status,'ready');assert.equal(s.enemyGroups[0].nextArrivalAt,39);s=order(s,{type:'beginAssault',sector:'jujuy'});assert.deepEqual(s.pendingBattle.occupationGroupIds,['enemy-group-1']);assert.equal(s.pendingBattle.enemies[0].id,'enemy-group-1-0');roundtrip(s);
});
test('off-map incursions, paused routes, and travel away from the army do not create false crossings',()=>{
 const s=initialCampaign(),g=launchEnemyGroup(s,'coast','retiro');delayCrossingEnemyGroups(s);assert.equal(g.arrivalAt,8);s.hour=8;advanceEnemyGroups(s);assert.equal(g.status,'waiting');
 let n=front();n=order(n,{type:'travel',sector:'cordoba',queue:true});assert.equal(n.enemyGroups[0].nextArrivalAt,48);assert.equal(enemyGroupStatus(n,n.enemyGroups[0]).crossingAt,null);
 n=front();n.sectors.salta.owner='patriot';n=order(n,{type:'travel',sector:'salta',queue:true});n.squads[0].journey.status='paused';n.squads[0].journey.reason='exhausted';const due=n.enemyGroups[0].nextArrivalAt;n.hour=due;delayCrossingEnemyGroups(n);advanceEnemyGroups(n);assert.equal(n.enemyGroups[0].status,'waiting');assert.equal(n.enemyGroups[0].target,'tucuman');
});


test('a returning squad can recover its occupied origin without using enemy fortifications',()=>{
 let s=front();s.sectors.tucuman.fort=3;s=wait(attack(s),12);s=order(s,{type:'cancelTravel',choice:'return'});s=wait(s,24);s=order(s,{type:'respondToEncounter',groupId:'enemy-group-1',choice:'tactical'});assert.equal(s.pendingBattle.defenseFort,0);roundtrip(s);
 for(const change of [b=>b.wasRoyalist=false,b=>b.defenseFort=3]){const bad=structuredClone(s);change(bad.pendingBattle);assert.throws(()=>restoreCampaign(serializeCampaign(bad)));}
 // Explicit strategic-ledger fixture. The actual battle outcome is tested above.
 s=order(s,scriptedBattleReport(s));assert.equal(s.sectors.tucuman.owner,'patriot');assert.equal(s.enemyGroups[0].status,'defeated');roundtrip(s);
});
test('cancelling the first column leaves the crossing held for another approaching squad',()=>{
 let s=front();s.routes.posta=true;s=order(s,{type:'createSquad',name:'Columna lenta',ids:[3]});s=attack(s);s=order(s,{type:'selectSquad',id:'squad-1'});s=order(s,{type:'attack',sector:'salta',queue:true,mode:'posta'});s=wait(s,24);assert.equal(s.hour,44);assert.equal(s.squads[0].journey.status,'ready');s=order(s,{type:'cancelTravel',choice:'return'});s=wait(roundtrip(s),24);assert.equal(s.hour,48);assert.equal(s.enemyGroups[0].status,'marching');assert.equal(s.pendingEncounter,null);assert.equal(enemyGroupStatus(s,s.enemyGroups[0]).crossingAt,'salta');
 s=wait(s,24);assert.equal(s.hour,52);s=order(s,{type:'beginAssault',sector:'salta'});assert.deepEqual(s.pendingBattle.squad.map(u=>u.id),[3]);assert.deepEqual(s.pendingBattle.occupationGroupIds,['enemy-group-1']);assert.equal(s.location,'tucuman');roundtrip(s);
});

test('equal-time and faster arrivals both intercept the same army without advancing its departure',()=>{
 for(const [start,mode,arrival,due] of [[36,'march',48,49],[40,'posta',44,48]]){
  let s=front(start);s.routes.posta=true;s=order(s,{type:'attack',sector:'salta',queue:true,mode});assert.equal(s.enemyGroups[0].nextArrivalAt,due);s=wait(s,24);assert.equal(s.hour,arrival);assert.equal(s.enemyGroups[0].nextArrivalAt,due);s=order(roundtrip(s),{type:'beginAssault',sector:'salta'});assert.deepEqual(s.pendingBattle.occupationGroupIds,['enemy-group-1']);assert.equal(s.pendingBattle.enemies[0].hp,63);roundtrip(s);
 }
});
