import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {contractExpiresSeconds} from '../game/contracts.js';
import {baseMorale} from '../game/morale.js';
import {rosterFor} from '../game/campaign.js';
import {carriedAmmunition} from '../game/campaign-ammunition.js';
import {ammoCount} from '../game/ammo-types.js';
import {livingNorthernSupplyPlan,prepareLivingCreatedNorthernRequest} from './created-living-northern-supply.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
function earned(){const stem='./fixtures/earned-living-northern-care',proof=JSON.parse(readFileSync(new URL(stem+'.provenance.json',import.meta.url))),blob=readFileSync(new URL(stem+'.save.json.gz',import.meta.url)),raw=gunzipSync(blob);assert.equal(sha(blob),proof.gzipSha256);assert.equal(sha(raw),proof.rawSha256);assert.equal(raw.length,proof.rawBytes);assert.equal(JSON.parse(raw).savedAt,proof.savedAt);const c=decodeSave(raw.toString()).campaign;assert.equal(sha(JSON.stringify(c)),proof.campaignSha256);assert.deepEqual([c.hour,c.secondOfHour,c.resources.treasury],[...proof.clock,proof.treasury]);return{campaign:c,proof};}

test('the actual postcare northern quotation records the nine unproved dressings without counting unknown remains or occupied-capital stock',()=>{
 const{campaign:c,proof}=earned(),before=structuredClone(c),plan=livingNorthernSupplyPlan(c);assert.deepEqual(c,before);assert.deepEqual(plan.keepers,proof.keepers);assert.deepEqual(plan.field,proof.field);assert.deepEqual([plan.carriedDressings,plan.neededDressings,plan.knownDressings,plan.unprovedDressings],[36,34,25,9]);assert.equal(plan.dailyService,483);assert.equal(plan.requiredTreasury,36565);assert.ok(plan.sources.every(row=>row.sector!=='buenos_aires'));assert.equal(c.enemyGroups.find(g=>g.id==='enemy-group-7').status,'stationed');assert.equal(c.blockade,true);
});

test('the living northern supply planner retains the original sixteen-round ten-dressing and six-hundred-hour readiness bounds',()=>{
 const{campaign:c}=earned(),before=structuredClone(c);for(const options of[{rounds:15},{dressings:9},{maxRestHours:601},{logisticsHours:721}])assert.throws(()=>livingNorthernSupplyPlan(c,options));assert.deepEqual(c,before);assert.deepEqual(livingNorthernSupplyPlan(c).field,[2,10,101,117,102,107,122]);
});

test('the complete surviving field earns its finite full northern loads and a real two-column infantry request while the last coastal group and empty guns remain unresolved',t=>{
 const{campaign:start,proof}=earned(),before=structuredClone(start),events=[],c=prepareLivingCreatedNorthernRequest(start,{report:e=>events.push(e)}),request=events.find(e=>e.event==='livingNorthernRequestReady');assert.deepEqual(start,before);assert.ok(request);assert.deepEqual(request.field,proof.field);assert.deepEqual(request.keepers,proof.keepers);assert.equal(c.pendingBattle.sector,'tucuman');assert.equal(c.pendingBattle.squad.length,7);assert.deepEqual(c.pendingBattle.artillery,[]);assert.ok(c.pendingBattle.assaultSquads.every(q=>q.members.length<=6));assert.equal(c.operativeState[57].location,'cordoba');assert.equal(c.blockade,true);assert.deepEqual(c.enemyGroups.find(g=>g.id==='enemy-group-7'),start.enemyGroups.find(g=>g.id==='enemy-group-7'));
 for(const id of proof.keepers){const r=c.operativeState[id],expiry=contractExpiresSeconds(c.contracts[id]);assert.ok(c.recruited.includes(id)&&r.alive&&!r.captured);assert.equal(r.hp,r.maxHp);assert.equal(r.bleeding,0);assert.ok(expiry===null||expiry>c.hour*3600+c.secondOfHour);}
 for(const id of proof.field){const r=c.operativeState[id],op=rosterFor(c).find(op=>op.id===id),u=carriedAmmunition(op,r);assert.equal(r.energy,100);assert.equal(r.fatigue,0);assert.ok(r.morale>=baseMorale(op));assert.ok(r.medkits>=10&&u.loaded+ammoCount(u)>=16);assert.equal(r.activeSlot,'primary');}
 for(const[id,r]of Object.entries(start.operativeState))if(!r.alive){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].deathMinute,r.deathMinute);}assert.ok(events.some(e=>e.event==='visibleMedicalRemains'&&e.collected>0),'At least the unproved linen must be established by actual public inspection and finite pickup.');assert.ok(events.some(e=>e.event==='livingNorthernMedicalSource'));assert.ok(events.some(e=>e.event==='livingNorthernRenewal'));assert.ok(events.filter(e=>e.event==='routeBatteryDetour').every(e=>!e.waypoints.includes('buenos_aires')));
 const battle=enterSector(c.pendingBattle,c.sectorStates.tucuman),raw=encodeSave(c,battle);assert.deepEqual(decodeSave(raw),{campaign:c,battle});t.diagnostic(JSON.stringify({scope:'Complete actual finite supply/rest/paid two-column first northern request and official paired admission only; no native northern victory, final coast7, full fresh ending or48h claim',inputRawSha256:proof.rawSha256,field:proof.field,keepers:proof.keepers,preservedNativeDeaths:proof.preservedNativeDeaths,clock:[c.hour,c.secondOfHour],treasury:c.resources.treasury,groups:request.groups,blockade:c.blockade,officialPair:true}));
});
