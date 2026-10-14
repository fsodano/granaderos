import {admitEarnedArtilleryMarkers} from './earned-artillery-admission-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {encodeSave,decodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {storedArtilleryRecord} from '../game/artillery-transport.js';
import {carriedAmmunition} from '../game/campaign-ammunition.js';
import {rosterFor} from '../game/campaign.js';
import {ammoTypeFor,ammoCount} from '../game/ammo-types.js';
import {contractExpiresSeconds} from '../game/contracts.js';
import {prepareNorthernOfficerRelief} from './fresh-northern-command.mjs';
import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {prepareRouteBattery} from './route-battery.mjs';
import {stockAmmunitionLedger} from './created-cuyo-route.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const gunCustody=(c,id)=>[
 ...Object.entries(c.artilleryDepots??{}).flatMap(([sector,guns])=>guns.filter(g=>g.id===id).map(g=>({source:'depot',sector,record:storedArtilleryRecord(g)}))),
 ...Object.entries(c.sectorStates??{}).flatMap(([sector,scene])=>(scene.artillery??[]).filter(g=>g.id===id).map(g=>({source:'field',sector,record:storedArtilleryRecord(g)}))),
 ...(c.artilleryTransfers??[]).filter(t=>t.gun.id===id).map(t=>({source:'transfer',sector:t.to,record:storedArtilleryRecord(t.gun)}))
];
function earned(){
 const stem='./fixtures/earned-loose-stock-salta-preparation',proof=JSON.parse(readFileSync(new URL(stem+'.provenance.json',import.meta.url))),packed=readFileSync(new URL(stem+'.campaign.json.gz',import.meta.url)),raw=gunzipSync(packed);
 assert.equal(sha(packed),proof.gzipSha256);assert.equal(sha(raw),proof.rawSha256);assert.equal(raw.length,proof.rawBytes);
 assert.equal(proof.prePreparationInputIndependentlyCaptured,true);
 const campaign=admitEarnedArtilleryMarkers(JSON.parse(raw),{sectors:['retiro','buenos_aires','san_nicolas','san_lorenzo','cordoba','tucuman'],label:'earned loose Salta preparation input'});assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);
 assert.deepEqual([campaign.hour,campaign.secondOfHour,campaign.resources.treasury],[681,982,194184]);
 assert.equal(campaign.pendingBattle,null);assert.equal(campaign.pendingEncounter,null);return {campaign,proof};
}

test('the earned loose Tucumán preparation input retains its real casualties and existing finite cannon',()=>{
 const {campaign:c,proof}=earned(),before=structuredClone(c);
 assert.equal(proof.sourceCommit,'d563210054afefa1e070a5448a84ad4104f5eafe');
 assert.equal(c.location,'tucuman');assert.equal(c.sectors.tucuman.owner,'patriot');
 assert.deepEqual(storedArtilleryRecord(c.sectorStates.cordoba.artillery.find(g=>g.id==='arsenal:cordoba:2')),{id:'arsenal:cordoba:2',type:'bronze4',side:'player',loaded:true,ammo:6});
 assert.deepEqual(Object.entries(c.operativeState).filter(([,r])=>!r.alive).map(([id])=>Number(id)),proof.priorDeaths);
 // Preserve the dated d563 preparation-only diagnostic (2026-10-13). It is
 // historical provenance, not a current native casualty or readiness oracle.
 assert.equal(proof.originalDiagnostic.nativeBattleExecuted,false);
 assert.deepEqual(proof.originalDiagnostic.originalField,[9,11,1,108,117,121,110,125]);
 assert.deepEqual(proof.originalDiagnostic.originalReadyClock,[792,2353]);
 for(const id of [9,11,1])assert.ok(!c.recruited.includes(id),'Officer participation must still be earned through the original contact route.');
 assert.deepEqual(c,before);
});

test('the complete earned stock officer preparation supplies real cartridges and keeps its charged gun for the Salta assault',t=>{
 const {campaign:start,proof}=earned(),before=structuredClone(start),events=[];
 const c=prepareNorthernOfficerRelief(start,{routeKind:'stock',report:e=>events.push(e)});
 assert.deepEqual(start,before);assert.equal(c.pendingBattle.sector,'salta');
 // Dated 2026-10-13 source7f witness: context0de2398614fe63ce / ready
 // campaign661680fedab3bb37 had twelve actors including110, native15/215/295
 // and782:2233/c222938. Preserve that history separately from current policy.
 // Source936 full-preparation witness: context95ff74d2cb0fa6ee / returned
 // campaigncd3d56109e80c8ea keeps the actual134/110 deaths and eleven survivors.
 assert.deepEqual(c.pendingBattle.squad.map(u=>u.id),[9,11,1,108,117,121,125,101,116,122,130]);
 assert.ok(c.pendingBattle.squad.length>=8,'The original minimum fit force remains required.');
 assert.deepEqual([c.hour,c.secondOfHour,c.resources.treasury],[782,2397,223004]);
 const defenses=events.filter(e=>e.event==='northernReliefDefenseComplete');assert.equal(defenses.length,1);const defense=defenses[0];
 assert.deepEqual([defense.status,defense.turns,defense.actions,defense.elapsedSeconds],['victory',49,274,472]);
 assert.deepEqual(defense.losses,[134,110]);assert.deepEqual(defense.physicianIds,[1,146]);assert.equal(defense.exactSavedReplay,true);
 assert.equal(defense.orders.length,347);assert.equal(defense.orders.filter(action=>action.type==='endTurn').length,73);
 assert.deepEqual(defense.aid.steps,[]);assert.equal(defense.orders.some(action=>action.type.startsWith('artillery')),false);
 assert.deepEqual([defense.campaign.hour,defense.campaign.secondOfHour,defense.campaign.resources.treasury],[768,2061,223505]);
 for(const [id,hp,kits]of [[1,88,3],[146,37,10]]){const doctor=defense.campaign.operativeState[id];assert.equal(doctor.alive,true);assert.equal(doctor.hp,hp);assert.equal(doctor.bleeding,0);assert.equal(doctor.medkits,kits);}
 for(const id of [134,110]){assert.equal(defense.campaign.operativeState[id].alive,false);assert.equal(defense.campaign.operativeState[id].hp,0);assert.equal(defense.campaign.operativeState[id].deathMinute,46114);assert.equal(defense.campaign.sectorStates.tucuman.units.find(unit=>unit.id===String(id)).hp,0);assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].deathMinute,46114);}
 for(const id of [101,116,122,130])assert.equal(defense.campaign.operativeState[id].alive,true,'Actual additional survivors must remain alive after native settlement.');
 for(const record of [{id:'arsenal:cordoba:1',type:'bronze4',side:'player',loaded:true,ammo:1,facing:-1.0516502125483738},{id:'arsenal:cordoba:2',type:'bronze4',side:'player',loaded:true,ammo:6}])assert.deepEqual(gunCustody(defense.campaign,record.id),[{source:'field',sector:'tucuman',record}],'Every original unfired piece has one physical owner after the actual defense.');
 assert.ok(c.pendingBattle.assaultSquads.every(q=>q.members.length<=6));
 assert.equal(c.pendingEncounter,null);assert.equal(c.defeated,false);assert.equal(c.completed,false);
 const delivered=events.filter(e=>e.event==='routeBatteryPrepared');assert.equal(delivered.length,2);
 assert.deepEqual(delivered[0].records,[{id:'arsenal:cordoba:2',type:'bronze4',side:'player',loaded:true,ammo:6}]);
 assert.deepEqual(delivered[1].records,delivered[0].records,'Recover the same unfired physical piece without adding or replacing any charge.');
 assert.deepEqual(c.pendingBattle.artillery.map(storedArtilleryRecord),delivered[1].records,'All seven actual cannon charges must reach the assault after ordinary local recovery.');
 const supplies=events.filter(e=>e.event==='northernReliefFieldAmmunition');assert.equal(supplies.length,2);
 for(const e of supplies){
  for(const state of [e.ammunitionStart,e.campaign]){const custody=gunCustody(state,'arsenal:cordoba:2');assert.equal(custody.length,1,'The actual piece has one field/depot/transfer owner.');assert.equal(custody[0].sector,'tucuman');assert.deepEqual(custody.map(g=>g.record),delivered[0].records,'A supplied quiet visit must preserve the same physical charges.');}
  assert.deepEqual(stockAmmunitionLedger(e.campaign),stockAmmunitionLedger(e.ammunitionStart),'Public pickup and any actual cache inspection cannot grant cartridges.');
  const restored=decodeSave(encodeSave(e.ammunitionStart)).campaign,replayed=supplyRouteAmmunition(restored,e.ids,{target:12});
  assert.deepEqual(replayed.campaign,e.campaign);assert.deepEqual(replayed.transactions,e.transactions,'The complete finite supply phase replays from its official save.');
  for(const id of e.ids){const u=carriedAmmunition(rosterFor(e.campaign).find(op=>op.id===id),e.campaign.operativeState[id]),family=ammoTypeFor({...u,activeSlot:'primary'});assert.ok(u.loaded+ammoCount(u,family)>=12);}
 }
 const recovery=events.filter(e=>e.event==='northernReliefAssaultBattery');assert.equal(recovery.length,1);
 assert.deepEqual(gunCustody(recovery[0].batteryRecoveryStart,'arsenal:cordoba:2'),[{source:'field',sector:'tucuman',record:delivered[0].records[0]}]);
 assert.deepEqual(gunCustody(recovery[0].campaign,'arsenal:cordoba:2'),[{source:'depot',sector:'tucuman',record:delivered[0].records[0]}]);
 assert.ok(events.some(e=>e.event==='routeBatteryStored'&&e.id==='arsenal:cordoba:2'),'A real public local storage order must recover the issued gun.');
 const restoredRecovery=decodeSave(encodeSave(recovery[0].batteryRecoveryStart)).campaign,late=prepareRouteBattery(restoredRecovery,['bronze4'],{destination:'tucuman',keepServing:restoredRecovery.recruited.filter(id=>restoredRecovery.operativeState[id].alive&&!restoredRecovery.operativeState[id].captured)});
 assert.deepEqual(late.campaign,recovery[0].campaign);assert.deepEqual(late.selections,recovery[0].selections,'The complete late physical recovery must replay from an official save.');
 assert.ok(supplies.flatMap(e=>e.transactions).some(row=>row.action.operativeId===11&&row.family==='ammoRifle'),'The actual Baker officer needs compatible rifle cartridges.');
 assert.ok(events.some(e=>e.event==='finishedReload'&&e.id===11),'The empty Baker must finish a real paid reload before marching.');
 for(const u of c.pendingBattle.squad){const family=ammoTypeFor({...u,activeSlot:'primary'});assert.equal(u.loaded,1);assert.ok(u.loaded+ammoCount(u,family)>=12);assert.equal(u.bleeding,0);assert.equal(u.hp,u.maxHp);}
 for(const id of proof.priorDeaths)assert.equal(c.operativeState[id].alive,false);
 for(const id of c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured)){const expiry=contractExpiresSeconds(c.contracts[id]);assert.ok(expiry===null||expiry>c.hour*3600+c.secondOfHour);}
 const b=enterSector(c.pendingBattle,c.sectorStates.salta);assert.deepEqual(decodeSave(encodeSave(c,b)),{campaign:c,battle:b});
 t.diagnostic(JSON.stringify({scope:'Complete earned loose681 paid preparation and official paired admission only; no Salta native victory, full prefix, ending or48h claim.',clock:[c.hour,c.secondOfHour],treasury:c.resources.treasury,field:c.pendingBattle.squad.map(u=>u.id),gun:c.pendingBattle.artillery.map(storedArtilleryRecord),cartridgesTaken:supplies.flatMap(e=>e.transactions).reduce((n,row)=>n+row.quantity,0)}));
});
