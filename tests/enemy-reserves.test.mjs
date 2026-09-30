import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {launchEnemyGroup} from '../game/enemy-groups.js';
import {ENEMY_RESERVE_LIMITS} from '../game/enemy-reserves.js';
const roundtrip=s=>restoreCampaign(serializeCampaign(s));
test('scheduled attacks consume only the issuing command reserve and retain their troops across saves',()=>{
 let s=initialCampaign();s.sectors.jujuy.owner='patriot';
 s=dispatchCampaign(s,{type:'wait',hours:120});assert.equal(s.lastError,null);
 const g=s.enemyGroups.find(g=>g.theater==='north');assert.ok(g);
 assert.equal(s.enemyReserves.remaining.north,120-g.initialStrength);
 assert.equal(s.enemyReserves.remaining.coast,80);assert.equal(s.enemyReserves.remaining.interior,40);
 assert.deepEqual(roundtrip(s),s);
 const before=structuredClone(s.enemyReserves),next=s.nextEnemyGroupId;
 assert.equal(launchEnemyGroup(s,'north','salta'),null);assert.equal(s.nextEnemyGroupId,next);assert.deepEqual(s.enemyReserves,before);
});
test('a depleted command cannot spawn troops or reuse identities; a final viable group uses only remaining troops',()=>{
 const s=initialCampaign();s.hour=2400;s.enemyReserves.remaining.north=5;
 const g=launchEnemyGroup(s,'north','humahuaca',{immediate:true});assert.equal(g.initialStrength,5);assert.equal(g.units.length,5);assert.equal(s.enemyReserves.remaining.north,0);
 const next=s.nextEnemyGroupId,before=structuredClone(s);assert.equal(launchEnemyGroup(s,'north','humahuaca',{immediate:true}),null);assert.equal(s.nextEnemyGroupId,next);assert.deepEqual(s,before);
 for(const remaining of [1,2]){s.enemyReserves.remaining.north=remaining;assert.equal(launchEnemyGroup(s,'north','humahuaca',{immediate:true}),null);assert.equal(s.enemyReserves.remaining.north,remaining);}
 assert.ok(launchEnemyGroup(s,'coast','buenos_aires',{immediate:true}));
});
test('defeat, history trimming, reload and later time never replenish expended troops',()=>{
 let s=initialCampaign();for(const [id,sector] of Object.entries(s.sectors))sector.owner=id==='retiro'?'patriot':'royalist';s.enemyReserves.remaining.north=120;
 for(let i=0;i<30;i++){
  const g=launchEnemyGroup(s,'north','humahuaca',{immediate:true});assert.ok(g);g.status='defeated';g.resolvedAt=s.hour;for(const u of g.units)u.hp=0;
 }
 assert.equal(s.enemyReserves.remaining.north,0);
 for(let i=0;i<20;i++){const g=launchEnemyGroup(s,'coast','buenos_aires',{immediate:true});g.status='defeated';g.resolvedAt=s.hour;for(const u of g.units)u.hp=0;}
 assert.ok(!s.enemyGroups.some(g=>g.id==='enemy-group-1'));assert.equal(s.enemyGroups.length,49);s=roundtrip(s);assert.equal(s.enemyReserves.remaining.north,0);
 s.sectors.jujuy.owner='patriot';s=dispatchCampaign(s,{type:'wait',hours:120});assert.equal(s.lastError,null);assert.equal(s.enemyReserves.remaining.north,0);assert.ok(s.enemyGroups.every(g=>g.status==='defeated'));
});
test('legacy saves debit all retained groups once, including casualties, and preserve active groups',()=>{
 const s=initialCampaign(),g=launchEnemyGroup(s,'north','humahuaca',{immediate:true});g.status='defeated';g.resolvedAt=s.hour;for(const u of g.units)u.hp=0;
 launchEnemyGroup(s,'coast','buenos_aires');const expectedGroups=roundtrip(s).enemyGroups;delete s.enemyReserves;
 const loaded=roundtrip(s);assert.deepEqual(loaded.enemyReserves.remaining,{north:120-expectedGroups.find(g=>g.theater==='north').initialStrength,coast:80-expectedGroups.find(g=>g.theater==='coast').initialStrength,interior:40});assert.deepEqual(loaded.enemyGroups,expectedGroups);assert.deepEqual(roundtrip(loaded),loaded);
});
test('invalid saved reserves cannot silently reset the enemy budget',()=>{
 const s=initialCampaign();assert.deepEqual(s.enemyReserves.remaining,ENEMY_RESERVE_LIMITS);
 for(const reserve of [null,[],{version:2,remaining:{...ENEMY_RESERVE_LIMITS}},{version:1,remaining:{...ENEMY_RESERVE_LIMITS,north:-1}},{version:1,remaining:{...ENEMY_RESERVE_LIMITS,coast:81}},{version:1,remaining:{...ENEMY_RESERVE_LIMITS,interior:1.5}},{version:1,remaining:{north:120,coast:80}},{version:1,remaining:{...ENEMY_RESERVE_LIMITS,extra:0}}]){
  const bad=structuredClone(s);bad.enemyReserves=reserve;assert.throws(()=>roundtrip(bad),/reservas realistas/);
 }
});
