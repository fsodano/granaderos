import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {rosterFor} from '../game/campaign.js';
import {FINITE_ARTILLERY_ARSENALS} from '../game/finite-artillery-arsenals.js';
import {storedArtilleryRecord} from '../game/artillery-transport.js';
import {recoverCreatedCuyoMountainArtillery} from './created-cuyo-artillery.mjs';

test('the earned installed army selects actual physicians and returns paid arsenal recruits before their slower finite guns',t=>{
 const fixture=name=>readFileSync(new URL(`./fixtures/${name}`,import.meta.url));
 const name='earned-installed-funded-uspallata',meta=JSON.parse(fixture(`${name}.provenance.json`)),gzip=fixture(`${name}.save.json.gz`),raw=gunzipSync(gzip);
 const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
 assert.equal(sha(gzip),meta.gzipSha256);assert.equal(sha(raw),meta.rawSha256);assert.equal(raw.length,meta.rawBytes);
 const start=decodeSave(raw.toString()).campaign,before=structuredClone(start),events=[],checkpoints=new Map();
 const result=recoverCreatedCuyoMountainArtillery(start,{report:event=>{const {campaign,battle,...receipt}=event;events.push(receipt);},onCheckpoint:(stage,campaign)=>{
  const battle=campaign.pendingBattle?enterSector(campaign.pendingBattle,campaign.sectorStates[campaign.pendingBattle.sector]):undefined;
  const saved=decodeSave(encodeSave(campaign,battle));assert.deepEqual(saved.campaign,campaign);if(battle)assert.deepEqual(saved.battle,battle);
  checkpoints.set(stage,campaign);
 }});
 const end=result.campaign,ready=checkpoints.get('arsenal-assault'),victory=checkpoints.get('arsenal-victory'),preparation=events.find(event=>event.event==='createdCuyoArsenalAssaultReady');
 assert.equal(preparation.field.length,12);assert.equal(preparation.reinforcements.length,6);assert.deepEqual(preparation.doctors,[135,116]);
 assert.ok(preparation.doctors.every(id=>rosterFor(ready).find(op=>op.id===id).medical>=60&&ready.operativeState[id].medkits===8));
 assert.ok(ready.pendingBattle.squad.every(unit=>unit.morale>=50&&!unit.asleep));assert.deepEqual(ready.pendingBattle.artillery,[]);
 const battle=events.find(event=>event.event==='battleFinished');assert.equal(battle.status,'victory');assert.equal(battle.turns,11);assert.equal(battle.actions,408);
 const losses=preparation.field.filter(id=>!victory.operativeState[id].alive);assert.deepEqual(losses,[11]);
 assert.equal(victory.operativeState[135].hp,20);assert.equal(victory.operativeState[145].hp,15);assert.equal(victory.operativeState[147].hp,15);
 assert.equal(end.location,'mendoza');assert.equal(end.pendingEncounter,null);assert.equal(end.pendingBattle,null);assert.equal(end.defeated,false);assert.ok(end.resources.treasury>=0);
 assert.deepEqual(end.squad,start.squad);assert.equal(end.activeSquadId,start.activeSquadId);
 for(const id of start.squad){assert.equal(end.operativeState[id].alive,true);assert.equal(end.operativeState[id].location,'mendoza');}
 for(const id of preparation.field.filter(id=>!losses.includes(id))){assert.equal(end.operativeState[id].alive,true);assert.equal(end.operativeState[id].location,'mendoza');assert.equal(end.operativeState[id].bleeding,0);assert.ok(end.operativeState[id].hp>=15);}
 const ended=events.filter(event=>event.event==='createdCuyoArsenalServiceEnded');
 assert.deepEqual(ended.map(event=>event.id).sort((a,b)=>a-b),preparation.reinforcements.slice().sort((a,b)=>a-b));
 assert.ok(ended.every(event=>event.sector==='mendoza'&&event.hour<end.hour));
 for(const id of preparation.reinforcements){assert.ok(!end.recruited.includes(id));assert.equal(end.contracts[id],undefined);}
 for(const [sector,guns]of Object.entries(start.artilleryDepots))for(const gun of guns)assert.deepEqual(end.artilleryDepots[sector].find(piece=>piece.id===gun.id),gun);
 for(const gun of FINITE_ARTILLERY_ARSENALS.ensenada.pieces)assert.deepEqual(storedArtilleryRecord(end.artilleryDepots.mendoza.find(piece=>piece.id===gun.id)),gun);
 assert.deepEqual(result.selections,FINITE_ARTILLERY_ARSENALS.ensenada.pieces.map(gun=>'depot:'+gun.id));
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(end.operativeState[id].alive,false);
 assert.deepEqual(start,before);assert.deepEqual(decodeSave(encodeSave(end)).campaign,end);
 t.diagnostic(JSON.stringify({scope:'Earned installed funded checkpoint, native arsenal victory, finite care, actual return and gun delivery; fresh campaign and mountain ending remain separate.',inputSha256:meta.rawSha256,field:preparation.field,doctors:preparation.doctors,losses,battle:{turns:battle.turns,actions:battle.actions},serviceEnded:ended,return:[end.hour,end.secondOfHour],treasury:end.resources.treasury}));
});
