import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {resolveStockNorthernReliefEncounter} from './northern-relief-defense.mjs';
import {prepareNorthernOfficerRelief} from './fresh-northern-command.mjs';
import {admitEarnedArtilleryMarkers} from './earned-artillery-admission-fixture.mjs';
import {recordRouteStrategicEvidence} from './route-strategic-failure-evidence.mjs';

const provenance=JSON.parse(readFileSync(new URL('./fixtures/earned-stock-northern-clinic.provenance.json',import.meta.url)));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function earned(kind){
 const meta=provenance.sources[kind],compressed=readFileSync(new URL('./fixtures/'+meta.file,import.meta.url)),raw=gunzipSync(compressed);
 assert.equal(sha(raw),meta.rawSha256);assert.equal(sha(compressed),meta.gzipSha256);assert.equal(raw.length,meta.rawBytes);
 const input=JSON.parse(raw),admitted=admitEarnedArtilleryMarkers(input,{sectors:['retiro','buenos_aires','san_nicolas','san_lorenzo','cordoba','tucuman'],label:`stock northern clinic ${kind}`});
 assert.deepEqual([input.hour,input.secondOfHour],meta.clock);assert.equal(input.resources.treasury,meta.treasury);
 return admitted;
}
const retainedDeaths=(before,after)=>{for(const [id,record]of Object.entries(before.operativeState))if(!record.alive)assert.equal(after.operativeState[id].alive,false,`Earlier death ${id} remains final.`);};

// The immutable earlier input/provenance keeps its dated20/407 oracle.
// Current source63658 witness3554a1b5 records the ordinary direct20/411
// victory with the same wounds, four losses, medicine, cash and573 seconds.
// The whole preparation has its separately bound NPC routine history below;
// its current49/274/472 victory loses134/110 and keeps both named patients.

test('the earned seed-8 Tucumán care raid keeps its physicians, real losses, finite dressings and exact saved native replay',t=>{
 const start=earned('counterattack'),before=structuredClone(start),events=[];
 const result=resolveStockNorthernReliefEncounter(start,{physicianIds:[1,146],report:event=>events.push(event)}),c=result.campaign,summary=result.summary;
 recordRouteStrategicEvidence({helper:'earnedStockNorthernClinicNative',stage:'route-checkpoint',campaign:start,returnedCampaign:c,context:{scope:'Actual existing resolver output before unchanged historical assertions. Its native orders, replay and settlement are already completed; no additional orders or synchronization.',request:events.find(event=>event.event==='northernReliefDefenseInput')?.campaign.pendingBattle,previous:start.sectorStates.tucuman,result,events}});
 assert.deepEqual(start,before);assert.deepEqual([c.hour,c.secondOfHour],[768,2162]);assert.equal(c.resources.treasury,223505);
 assert.deepEqual(summary.losses,[134,101,122,130]);assert.deepEqual([summary.turns,summary.actions,summary.elapsedSeconds],[20,411,573]);assert.equal(summary.orders.length,459);assert.equal(summary.orders.filter(action=>action.type==='endTurn').length,48);assert.equal(summary.exactSavedReplay,true);
 for(const id of summary.losses){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].hp,0);}
 retainedDeaths(start,c);
 for(const id of [1,146]){assert.equal(c.operativeState[id].alive,true);assert.equal(c.operativeState[id].hp,start.operativeState[id].hp);assert.equal(c.operativeState[id].bleeding,0);assert.equal(c.operativeState[id].medkits,start.operativeState[id].medkits);assert.equal(c.operativeState[id].assignment,'doctor');}
 assert.equal(c.operativeState[108].hp,64);assert.equal(c.operativeState[116].hp,24);assert.equal(c.operativeState[116].bleeding,0);
 const native=events.find(event=>event.event==='northernReliefDefenseInput').battle,after=c.sectorStates.tucuman,medical=summary.orders.filter(action=>action.type==='useItem');
 assert.deepEqual(medical.map(action=>[action.unitId,action.targetId]),[['110','101'],['121','122'],['117','116']]);
 const dressingStock=battle=>battle.units.filter(unit=>unit.side==='player').reduce((sum,unit)=>sum+(unit.medkits??0),0);
 assert.equal(dressingStock(native),30);assert.equal(dressingStock(after),27);assert.equal(dressingStock(native)-dressingStock(after),medical.length);
 // The selected local depot gun is issued once when the clinic is defended.
 // No artillery order spends its charge or reserve; both physical guns remain
 // in the settled scene, including their exact native placement and facing.
 // Settlement removes the temporary stationed marker from inherited pieces.
 const issued=start.artilleryDepots.tucuman;
 assert.deepEqual(start.artillerySelection,issued.map(gun=>'depot:'+gun.id));assert.equal(start.artillerySelectionExplicit,true);
 assert.deepEqual(c.artilleryDepots,{...start.artilleryDepots,tucuman:[]});
 assert.equal(native.artillery.find(gun=>gun.id==='arsenal:cordoba:1').stationed,true);
 assert.deepEqual(after.artillery,native.artillery.map(({stationed,...gun})=>gun));
 const physical=gun=>({id:gun.id,type:gun.type,side:gun.side,loaded:gun.loaded,ammo:gun.ammo});
 assert.deepEqual(after.artillery.map(physical).sort((a,b)=>a.id.localeCompare(b.id)),[...start.sectorStates.tucuman.artillery,...issued].map(physical).sort((a,b)=>a.id.localeCompare(b.id)));
 assert.equal(new Set(after.artillery.map(gun=>gun.id)).size,after.artillery.length);
 assert.equal(summary.orders.some(action=>action.type.startsWith('artillery')),false);
 for(const id of start.recruited.filter(id=>start.operativeState[id].alive&&!summary.losses.includes(id)))assert.deepEqual(c.contracts[id],start.contracts[id]);
 assert.equal(c.activeSquadId,start.activeSquadId);assert.deepEqual(c.squad,start.squad);assert.equal(c.pendingEncounter,null);assert.equal(c.pendingBattle,null);assert.equal(c.sectors.tucuman.owner,'patriot');assert.equal(c.defeated,false);
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 t.diagnostic(JSON.stringify({scope:provenance.scope,datedNativeActions:407,nativeTurns:20,nativeActions:411,seconds:573,actualDeaths:summary.losses,dressingsUsed:medical.length,physicians:[1,146],officialMidpointReplay:true}));
});

test('the same earned pre-relief route handles its exact raid and heals surviving support with finite stock before the real Salta assault',t=>{
 const start=earned('beforeRelief'),counterattack=earned('counterattack'),before=structuredClone(start),events=[];
 const ready=prepareNorthernOfficerRelief(start,{routeKind:'stock',report:event=>{
  events.push(event);
  if(['northernReliefEncounter','northernReliefDefenseInput','northernReliefDefenseComplete'].includes(event.event))recordRouteStrategicEvidence({helper:'earnedStockNorthernClinicPreparation',stage:'route-checkpoint',campaign:event.campaign??start,context:{scope:'Actual existing preparation report only; no native result or settlement is inferred from an input report.',event}});
 }});
 recordRouteStrategicEvidence({helper:'earnedStockNorthernClinicPrepared',stage:'route-checkpoint',campaign:start,returnedCampaign:ready,context:{scope:'Actual completed preparation before unchanged historical assertions; prior native events are retained exactly.',events}});
 const interrupted=events.find(event=>event.event==='northernReliefEncounter');assert.ok(interrupted);
 // Exact source6fc passive inputs differ only in this NPC routine history:
 // the dated counterattack input remains immutable, while the whole current
 // paid preparation retains its separately witnessed native visit history.
 const currentNpcs=interrupted.campaign.sectorStates.tucuman.npcs;
 assert.equal(sha(Buffer.from(JSON.stringify(counterattack.sectorStates.tucuman.npcs))),'8041b32541f67bafe8765a7fa2eeab29701577f8f37eb7bd7f6e4a5af5f196a6');
 assert.equal(sha(Buffer.from(JSON.stringify(currentNpcs))),'ed8c627b84ea1e7fb2cbba1b05494c7996e2910f775a96ee607e03bcac751e6a');
 assert.deepEqual(interrupted.campaign,{...counterattack,sectorStates:{...counterattack.sectorStates,tucuman:{...counterattack.sectorStates.tucuman,npcs:currentNpcs}}});assert.deepEqual(interrupted.physicianIds,[1,146]);
 const defense=events.find(event=>event.event==='northernReliefDefenseComplete');assert.ok(defense);assert.deepEqual(defense.losses,[134,110]);assert.deepEqual([defense.turns,defense.actions,defense.elapsedSeconds],[49,274,472]);assert.equal(defense.orders.length,347);assert.equal(defense.orders.filter(action=>action.type==='endTurn').length,73);assert.deepEqual(defense.aid.steps,[]);assert.deepEqual(defense.aid.untreated,[]);assert.equal(defense.exactSavedReplay,true);
 assert.deepEqual([defense.campaign.hour,defense.campaign.secondOfHour,defense.campaign.resources.treasury],[768,2061,223505]);
 const native=events.find(event=>event.event==='northernReliefDefenseInput').battle,after=defense.campaign.sectorStates.tucuman;
 assert.deepEqual(after.artillery,native.artillery.map(({stationed,...gun})=>gun));assert.equal(defense.orders.some(action=>action.type.startsWith('artillery')),false);
 const linen=battle=>battle.units.filter(unit=>unit.side==='player').reduce((sum,unit)=>sum+(unit.medkits??0),0);assert.equal(linen(native),30);assert.equal(linen(after),30);assert.equal(defense.orders.filter(action=>action.type==='useItem').length,0);
 for(const id of defense.losses)assert.equal(ready.operativeState[id].alive,false);retainedDeaths(start,ready);
 for(const id of [108,116]){assert.equal(ready.operativeState[id].alive,true);assert.equal(ready.operativeState[id].hp,ready.operativeState[id].maxHp);assert.equal(ready.operativeState[id].bleeding,0);}
 for(const id of [1,146]){assert.equal(ready.operativeState[id].alive,true);assert.ok(ready.operativeState[id].hp>=15);assert.equal(ready.operativeState[id].bleeding,0);}
 assert.equal(ready.pendingEncounter,null);assert.equal(ready.pendingBattle.sector,'salta');assert.ok(ready.pendingBattle.squad.length>=8,'The original minimum fit force remains required.');assert.equal(ready.defeated,false);assert.equal(ready.completed,false);
 const field=ready.pendingBattle.squad.map(unit=>unit.id);assert.deepEqual(field,[9,11,1,108,117,121,125,101,116,122,130]);assert.deepEqual([ready.hour,ready.secondOfHour,ready.resources.treasury],[782,2397,223004]);for(const id of field){assert.ok(ready.recruited.includes(id));assert.ok(ready.operativeState[id].alive&&ready.operativeState[id].hp>=15&&!ready.operativeState[id].bleeding);}
 const battle=enterSector(ready.pendingBattle,ready.sectorStates.salta);assert.deepEqual(decodeSave(encodeSave(ready,battle)),{campaign:ready,battle});assert.deepEqual(start,before);
 t.diagnostic(JSON.stringify({scope:provenance.scope,raid:[defense.campaign.hour,defense.campaign.secondOfHour],ready:[ready.hour,ready.secondOfHour],treasury:ready.resources.treasury,field,actualDeaths:defense.losses,patients:[108,116].map(id=>({id,hp:ready.operativeState[id].hp,maxHp:ready.operativeState[id].maxHp})),physicianDressings:[1,146].map(id=>({id,medkits:ready.operativeState[id].medkits}))}));
});
