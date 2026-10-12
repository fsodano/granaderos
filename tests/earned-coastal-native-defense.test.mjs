import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {fightNorthernSector} from './northern-route.mjs';
import {coastalBatteryController} from './coastal-command-driver.mjs';
import {withdrawCoastalCommandToRear} from './coastal-command-reserve.mjs';
import {rejoinCommandAfterExit} from './command-reserve-driver.mjs';
import {enterControlledPort} from './controlled-port-handover.mjs';
import {recruitFreshNavalCommand,recoverFreshPort} from './fresh-coastal-route.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
function fixture(){
 const stem='./fixtures/earned-paid-coastal-capital-defense',proof=JSON.parse(readFileSync(new URL(stem+'.provenance.json',import.meta.url))),gzip=readFileSync(new URL(stem+'.save.json.gz',import.meta.url)),raw=gunzipSync(gzip);
 assert.equal(sha(raw),proof.rawSha256);assert.equal(sha(gzip),proof.gzipSha256);assert.equal(raw.length,proof.rawBytes);
 return {campaign:decodeSave(raw.toString()).campaign,proof};
}
const saved=c=>decodeSave(encodeSave(c)).campaign;
const retainedDeaths=(start,end)=>{for(const[id,r]of Object.entries(start.operativeState))if(!r.alive){assert.equal(end.operativeState[id].alive,false);assert.equal(end.operativeState[id].deathMinute,r.deathMinute);}};
let native;
function nativeDefense(){
 if(native)return structuredClone(native);
 const {campaign:start,proof}=fixture(),before=structuredClone(start),request=start.pendingBattle,initial=enterSector(request,start.sectorStates.buenos_aires);
 assert.deepEqual([start.hour,start.secondOfHour,start.resources.treasury],[...proof.clock,proof.treasury]);
 assert.equal(request.defenseGroupId,proof.nativeDefenseGroupId);assert.equal(request.enemies.length,proof.nativeEnemies);assert.equal(request.defenseFort,proof.fort);
 assert.deepEqual(request.squad.map(u=>u.id).sort((a,b)=>a-b),proof.fieldIds.slice().sort((a,b)=>a-b));
 const result=fightNorthernSector(start,'buenos_aires',{deploy:withdrawCoastalCommandToRear(initial,57,'retiro'),controller:coastalBatteryController(initial,{sharedArtillerySight:true})});
 assert.deepEqual(start,before);native={...result,start,proof};return structuredClone(native);
}

test('the genuinely paid15-person capital guard wins its exact native defense and official replay while retaining all real losses',t=>{
 const {campaign:c,summary,start,proof}=nativeDefense(),expected=proof.nativeVictory;
 assert.equal(summary.status,'victory');assert.deepEqual([summary.turns,summary.actions,summary.elapsedSeconds],[expected.turns,expected.actions,expected.elapsedSeconds]);
 assert.deepEqual([c.hour,c.secondOfHour,c.resources.treasury],[...expected.clock,expected.treasury]);
 assert.deepEqual(proof.fieldIds.filter(id=>!c.operativeState[id].alive).sort((a,b)=>a-b),expected.losses.slice().sort((a,b)=>a-b));
 assert.equal(c.operativeState[57].alive,true);assert.equal(c.operativeState[57].hp,start.operativeState[57].hp);assert.equal(c.operativeState[57].location,'retiro');
 for(const id of proof.fieldIds.filter(id=>id!==57&&c.operativeState[id].alive)){assert.ok(c.operativeState[id].hp>=15);assert.equal(c.operativeState[id].location,'buenos_aires');}
 retainedDeaths(start,c);assert.equal(c.enemyGroups.find(g=>g.id===proof.nativeDefenseGroupId).status,'defeated');
 assert.equal(c.sectors.buenos_aires.owner,'patriot');assert.equal(c.blockade,false);assert.equal(c.defeated,false);assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);
 const charges=guns=>guns.reduce((sum,g)=>sum+g.ammo+Number(g.loaded),0);
 assert.equal(charges(start.pendingBattle.artillery)-charges(c.sectorStates.buenos_aires.artillery),1,'the actual victory spends only the one retained loaded cannon round');
 assert.deepEqual(c.sectorStates.buenos_aires.artillery.map(g=>g.id).sort(),start.pendingBattle.artillery.map(g=>g.id).sort());
 assert.deepEqual(saved(c),c);
 t.diagnostic(JSON.stringify({scope:'Earned paid native capital defense and exact saved replay only; complete ending/48h remain unproved',nativeGroup:proof.nativeDefenseGroupId,field:proof.fieldIds.length,turns:summary.turns,orders:summary.actions,seconds:summary.elapsedSeconds,deaths:expected.losses,commander:'retiro',clock:[c.hour,c.secondOfHour],treasury:c.resources.treasury}));
});

test('the actual capital survivors pay for command rejoin and controlled port arrival, then complete the physical naval meeting and finite coast care',t=>{
 const {campaign:won,start,proof}=nativeDefense();
 let c=rejoinCommandAfterExit(won,57,'buenos_aires');
 const survivors=proof.fieldIds.filter(id=>c.recruited.includes(id)&&c.operativeState[id].alive&&!c.operativeState[id].captured),port=enterControlledPort(c,{fieldIds:survivors});c=port.campaign;
 assert.deepEqual([c.hour,c.secondOfHour,c.resources.treasury],[...proof.controlledPortArrival.clock,proof.controlledPortArrival.treasury]);
 assert.equal(c.location,'ensenada');assert.equal(c.operativeState[57].location,'ensenada');assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);assert.equal(c.blockade,false);
 retainedDeaths(start,c);for(const id of proof.nativeVictory.losses)assert.equal(c.operativeState[id].alive,false);
 c=recruitFreshNavalCommand(c);assert.ok(c.recruited.includes(5)&&c.recruited.includes(6));
 assert.deepEqual([c.hour,c.secondOfHour,c.resources.treasury],[...proof.navalCommand.clock,proof.navalCommand.treasury]);
 c=recoverFreshPort(c);assert.deepEqual([c.hour,c.secondOfHour,c.resources.treasury],[...proof.coastalCare.clock,proof.coastalCare.treasury]);
 assert.equal(c.operativeState[57].alive,true);assert.equal(c.completed,false);assert.equal(c.defeated,false);retainedDeaths(start,c);
 for(const id of proof.nativeVictory.losses)assert.equal(c.operativeState[id].alive,false);assert.deepEqual(saved(c),c);
 t.diagnostic(JSON.stringify({scope:'Earned native defense through actual controlled-port arrival, physical naval meeting and finite care; river/full ending/48h remain open',survivors,portClock:proof.controlledPortArrival.clock,navalClock:proof.navalCommand.clock,careClock:[c.hour,c.secondOfHour],treasury:c.resources.treasury,priorDeathsRetained:true,officialSave:true}));
});
