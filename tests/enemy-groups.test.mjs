import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {launchEnemyGroup,localDefenderIds,retreatDestinations} from '../game/enemy-groups.js';
import {enterSector} from '../game/world.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const arrive=(s,theater,sector)=>{launchEnemyGroup(s,theater,sector,{immediate:true});return order(s,{type:'wait',hours:1});};
const defend=s=>order(s,{type:'respondToEncounter',groupId:s.pendingEncounter.groupId,choice:'tactical'});
const report=(s,b,outcome)=>order(s,{type:'battleResult',battleId:s.pendingBattle.id,outcome,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});
const victory=b=>{for(const u of b.units.filter(u=>u.side==='enemy')){u.hp=0;u.bleeding=0;u.bandaged=0;}b.status='victory';b.sectorCleared=true;return b;};

test('scheduled northern troops travel a persistent route before reaching the frontier',()=>{
 let s=initialCampaign();s.sectors.jujuy.owner='patriot';s=order(s,{type:'wait',hours:120});const g=s.enemyGroups[0];assert.equal(s.sectors.jujuy.owner,'patriot');assert.deepEqual(g.route,['humahuaca','jujuy']);assert.equal(g.status,'marching');assert.equal(g.arrivalAt,144);assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);
 s=order(s,{type:'wait',hours:12});assert.equal(s.enemyGroups[0].routeIndex,1);s=order(s,{type:'wait',hours:12});assert.equal(s.sectors.jujuy.owner,'royalist');assert.equal(s.enemyGroups[0].status,'stationed');assert.equal(s.enemyGroups[0].units.length,3);
});
test('encounter pauses waiting and rejects unrelated orders without spending resources',()=>{
 let s=initialCampaign();launchEnemyGroup(s,'coast','retiro');s=order(s,{type:'wait',hours:100});assert.equal(s.hour,8);assert.equal(s.pendingEncounter.sector,'retiro');const before=serializeCampaign(s);const rejected=dispatchCampaign(s,{type:'purchaseMedicalSupplies',id:10,quantity:1});assert.match(rejected.lastError,/encuentro/);assert.deepEqual({...rejected,lastError:null},JSON.parse(before));assert.deepEqual(restoreCampaign(before),s);
});
test('travel completes its current leg and stops before further legs when a remote force arrives',()=>{
 let s=initialCampaign();s.sectors.cordoba.owner='patriot';s.sectors.cordoba.militia=[0,0,3];s.sectors.tucuman.owner='patriot';launchEnemyGroup(s,'interior','cordoba');s=order(s,{type:'travel',sector:'tucuman'});assert.equal(s.hour,12);assert.equal(s.location,'buenos_aires');assert.equal(s.pendingEncounter.sector,'cordoba');assert.equal(s.squads[0].location,s.location);
});
test('defense includes all local hired soldiers across squads and preserves a remote selected squad',()=>{
 let s=initialCampaign();for(const id of [100,101,102,103,104,106])s=order(s,{type:'recruitCivic',id,term:'day'});
 s=order(s,{type:'createSquad',name:'Retaguardia',ids:[106]});s=order(s,{type:'travel',sector:'buenos_aires'});
 // Eight hired combatants remain in Retiro while a ninth travels with the selected squad.
 s.location='buenos_aires';s.squads.find(q=>q.id==='squad-2').location=s.location;s=arrive(s,'coast','retiro');assert.equal(localDefenderIds(s,'retiro').length,8);s=defend(s);assert.equal(s.pendingBattle.squad.length,8);assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);const issued=s.pendingBattle.issuedCartridges;
 let b=enterSector(s.pendingBattle);const wounded=b.units.find(u=>Number(u.id)===100);wounded.hp-=20;wounded.bandaged=20;const before=s.resources.cartridges;s=report(s,victory(b),'victory');assert.equal(s.location,'buenos_aires');assert.equal(s.operativeState[100].hp,wounded.hp);assert.equal(s.enemyGroups[0].status,'defeated');assert.ok(s.resources.cartridges<=before+issued);assert.equal(s.squads.find(q=>q.id==='squad-1').location,'retiro');assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);
});
test('pre-combat retreat preserves troops and gear while coastal occupation remains attackable',()=>{
 let s=arrive(initialCampaign(),'coast','retiro');const ids=[...s.squad],hp=ids.map(id=>s.operativeState[id].hp),ammo=s.resources.cartridges;assert.ok(retreatDestinations(s,'retiro').includes('buenos_aires'));s=order(s,{type:'respondToEncounter',groupId:s.pendingEncounter.groupId,choice:'retreat',destination:'buenos_aires'});assert.equal(s.location,'buenos_aires');assert.equal(s.resources.cartridges,ammo);assert.deepEqual(ids.map(id=>s.operativeState[id].hp),hp);assert.equal(s.sectors.retiro.owner,'patriot');assert.equal(s.blockade,true);s.enemyGroups[0].units[0].hp=51;s.enemyGroups[0].units[0].bandaged=49;s.enemyGroups[0].units[0].ammo=1;
 s=order(s,{type:'attack',sector:'retiro'});assert.deepEqual(s.pendingBattle.occupationGroupIds,['enemy-group-1']);const b=enterSector(s.pendingBattle);assert.equal(b.units.find(u=>u.id==='enemy-group-1-0').hp,51);assert.equal(b.units.find(u=>u.id==='enemy-group-1-0').ammo,1);s=report(s,victory(b),'victory');assert.equal(s.blockade,false);assert.equal(s.enemyGroups[0].status,'defeated');assert.ok(dispatchCampaign(s,{type:'battleResult',battleId:b.battleId,outcome:'victory',sectorState:b,survivors:[]}).lastError);
});
test('survivors without an exit become prisoners and recapture restores their paused service',()=>{
 let s=initialCampaign();s=order(s,{type:'recruitCivic',id:100,term:'week'});s=order(s,{type:'squad',ids:[3,4,10]});s.operativeState[100].location='buenos_aires';s.location='humahuaca';s.squads[0].location=s.location;s.sectors.humahuaca.owner='patriot';s=arrive(s,'north','humahuaca');s=defend(s);let b=enterSector(s.pendingBattle);const injured=b.units.find(u=>Number(u.id)===3);injured.hp=30;injured.bandaged=injured.maxHp-30;for(const u of b.units.filter(u=>u.side==='player')){u.surrendered=true;u.ap=0;}b.status='defeat';s=report(s,b,'defeat');assert.equal(s.operativeState[3].captured,true);assert.equal(s.operativeState[3].hp,30);assert.equal(s.recruited.includes(3),false);assert.equal(s.defeated,false);assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);
 // A separate surviving force recaptures the held sector; its victory report releases captives.
 for(const id of ['cordoba','tucuman','salta','jujuy'])s.sectors[id].owner='patriot';s.location='jujuy';s.squad=[100];s.squads[0].members=[100];s.squads[0].location=s.location;s=order(s,{type:'attack',sector:'humahuaca'});b=enterSector(s.pendingBattle);s=report(s,victory(b),'victory');assert.equal(s.operativeState[3].captured,false);assert.equal(s.operativeState[3].hp,30);assert.equal(s.operativeState[3].assignment,'patient');assert.ok(s.recruited.includes(3));assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);
});
test('malformed group, encounter and capture saves are rejected; old saves migrate',()=>{
 const base=arrive(initialCampaign(),'coast','retiro');for(const alter of [s=>s.enemyGroups[0].units[0].ammo=-1,s=>s.enemyGroups[0].route=['salta'],s=>s.pendingEncounter.groupId='other',s=>s.operativeState[3].captured=true,s=>s.nextEnemyGroupId=1]){const s=structuredClone(base);alter(s);assert.throws(()=>restoreCampaign(serializeCampaign(s)));}
 const old=initialCampaign();delete old.enemyGroups;delete old.pendingEncounter;delete old.nextEnemyGroupId;delete old.encounterHistory;for(const r of Object.values(old.operativeState)){delete r.captured;delete r.capturedAt;delete r.capturedSector;delete r.capturedContract;}const loaded=restoreCampaign(serializeCampaign(old));assert.deepEqual(loaded.enemyGroups,[]);assert.equal(loaded.operativeState[3].captured,false);
});

test('automatic defense spends real militia equipment and stores the synchronized clock',()=>{
 let s=initialCampaign();s.sectors.jujuy.owner='patriot';s.sectors.jujuy.militia=[0,0,5];s=order(s,{type:'wait',hours:144});const before=s.resources.cartridges;s=order(s,{type:'respondToEncounter',groupId:s.pendingEncounter.groupId,choice:'auto'});const b=s.sectorStates.jujuy;assert.equal(s.enemyGroups[0].status,'defeated');assert.ok(s.resources.cartridges<before);const casualties=b.units.filter(u=>u.militia&&u.hp<=0).map(u=>Number(u.id));assert.equal(s.sectors.jujuy.militia[2],5-casualties.length);assert.deepEqual(s.encounterHistory[0].militiaCasualties,casualties);assert.ok(b.units.filter(u=>u.militia).reduce((n,u)=>n+u.loaded+u.ammo,0)<30);assert.ok(b.units.some(u=>u.militia&&u.condition<85));assert.equal(b.savedHour,s.hour);assert.equal(b.savedSecond,s.secondOfHour);assert.equal(b.syncedSeconds,b.elapsedSeconds);assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);
});
test('full defense snapshot controls wounds and gear despite conflicting supplied reports',()=>{
 let s=defend(arrive(initialCampaign(),'coast','retiro')),b=enterSector(s.pendingBattle);const fallen=b.units.find(u=>Number(u.id)===3);fallen.hp=0;fallen.bleeding=0;fallen.bandaged=0;fallen.loaded=0;fallen.ammo=0;const wounded=b.units.find(u=>Number(u.id)===4);wounded.hp=30;wounded.bandaged=wounded.maxHp-30;wounded.condition=21;wounded.loaded=0;wounded.ammo=0;const forged=b.units.filter(u=>u.side==='player').map(u=>({...u,hp:u.maxHp,condition:100,loaded:1,ammo:9}));s=order(s,{type:'battleResult',battleId:s.pendingBattle.id,outcome:'victory',sectorState:victory(b),survivors:forged});assert.equal(s.operativeState[3].alive,false);assert.equal(s.operativeState[4].hp,30);assert.equal(s.operativeState[4].condition,21);assert.ok(s.encounterHistory[0].casualties.includes(3));
});
