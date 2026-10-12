import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {FINITE_ARTILLERY_ARSENALS} from '../game/finite-artillery-arsenals.js';
import {storedArtilleryRecord} from '../game/artillery-transport.js';
import {prepareCreatedCuyoArsenalAssault,recoverCreatedCuyoMountainArtillery} from './created-cuyo-artillery.mjs';

test('the earned loose route rests four actual veterans and pays eight reinforcements before its twelve-person arsenal assault',t=>{
 const name='earned-loose-funded-before-mountain-arsenal',fixture=suffix=>readFileSync(new URL(`./fixtures/${name}.${suffix}`,import.meta.url));
 const meta=JSON.parse(fixture('provenance.json')),compressed=fixture('campaign.json.gz'),raw=gunzipSync(compressed),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
 assert.equal(sha(raw),meta.rawSha256);assert.equal(sha(compressed),meta.gzipSha256);assert.equal(raw.length,meta.rawBytes);
 const start=JSON.parse(raw),before=structuredClone(start),events=[];
 assert.deepEqual([start.hour,start.secondOfHour],meta.clock);assert.equal(start.resources.treasury,meta.treasury);
 assert.deepEqual(start.squad,[2,126,133,1,8]);assert.equal(start.flags.armyFunded,true);assert.equal(start.location,'mendoza');
 assert.equal(start.operativeState[1].morale,0);assert.equal(start.operativeState[8].morale,0);
 assert.equal(start.operativeState[133].weaponDropped,true);assert.equal(start.operativeState[133].weapon,undefined);
 // The physician takes the first compatible gun before this veteran. Keep
 // each actual source's own condition and metadata through the full allocation.
 const source=sectorInventoryModel(start,'mendoza',rosterFor(start),133).entries.find(row=>row.key==='drop:6');assert.ok(source?.reachable);assert.equal(source.count,1);
 const physicianSource=sectorInventoryModel(start,'mendoza',rosterFor(start),8).entries.find(row=>row.key==='drop:5');assert.ok(physicianSource?.reachable);assert.equal(physicianSource.count,1);
 const recovered=JSON.parse(source.expected);assert.equal(recovered.weapon,1801);assert.equal(recovered.loaded,1);
 const result=prepareCreatedCuyoArsenalAssault(start,{report:event=>{const{campaign,battle,...record}=event;events.push(record);}});
 const ready=result.campaign,preparation=events.find(event=>event.event==='createdCuyoArsenalAssaultReady');
 assert.deepEqual(preparation.field,[1,8,126,133,128,105,106,145,147,109,132,135]);assert.equal(new Set(preparation.field).size,12);
 assert.deepEqual(preparation.reinforcements,[128,105,106,145,147,109,132,135]);assert.deepEqual(preparation.doctors,[8,135]);
 assert.equal(ready.pendingBattle.squad.length,12);assert.deepEqual(ready.pendingBattle.artillery,[]);
 assert.ok(preparation.field.every(id=>!ready.operativeState[id].weaponDropped),'All twelve actual soldiers hold a physical primary, including the veteran who returned with a dropped weapon.');
 const armed=ready.pendingBattle.squad.find(op=>Number(op.id)===133);assert.equal(armed.weapon,1801);assert.equal(armed.loaded,1);assert.equal(armed.condition,recovered.condition);assert.equal(Boolean(armed.jammed),recovered.jammed);assert.deepEqual(armed.weaponMetadata.contentWeapon,recovered.contentWeapon);
 const physician=ready.pendingBattle.squad.find(op=>Number(op.id)===8);assert.equal(physician.condition,JSON.parse(physicianSource.expected).condition);assert.deepEqual(physician.weaponMetadata.contentWeapon,JSON.parse(physicianSource.expected).contentWeapon);
 assert.ok(events.some(event=>event.event==='finitePrimaryRecovered'&&event.operativeId===133&&event.weapon===1801));
 assert.equal(ready.sectorStates.mendoza.droppedWeapons[source.key.split(':')[1]].taken,true,'The exact known physical source is fully consumed once.');
 assert.equal(ready.sectorStates.mendoza.droppedWeapons[physicianSource.key.split(':')[1]].taken,true,'The earlier physician allocation consumes its separate finite source.');
 assert.ok(ready.hour>=start.hour+300,'Zero-morale permanent veterans earn the required readiness through the real rest clock.');
 for(const id of [1,8])assert.ok(ready.operativeState[id].morale>=50);
 for(const id of preparation.reinforcements){assert.equal(ready.contracts[id].kind,'paid');assert.equal(ready.contracts[id].term,'day');assert.ok(ready.contracts[id].paid>0);}
 for(const id of preparation.doctors)assert.equal(ready.operativeState[id].medkits,8);
 assert.deepEqual(ready.artilleryDepots,start.artilleryDepots,'Existing gun identities, charges and custody remain unchanged.');
 assert.equal(ready.sectors.ensenada.owner,'royalist');assert.equal(ready.artilleryArsenalRecoveries.ensenada,undefined);
 assert.equal(ready.operativeState[2].location,'mendoza');assert.equal(ready.operativeState[2].alive,true);assert.ok(!result.field.includes(2));
 for(const id of start.squad)assert.equal(ready.operativeState[id].alive,true);
 for(const[id,record]of Object.entries(start.operativeState))if(!record.alive){assert.equal(ready.operativeState[id].alive,false);assert.equal(ready.operativeState[id].deathMinute,record.deathMinute);}
 const battle=enterSector(ready.pendingBattle,ready.sectorStates.ensenada),restored=decodeSave(encodeSave(ready,battle));
 assert.deepEqual(restored.campaign,ready);assert.deepEqual(restored.battle,battle);assert.deepEqual(start,before);
 t.diagnostic(JSON.stringify({scope:'Actual loose funded input, paid rest, recruitment, finite kit and pending assault only; native survival, arsenal return and ending remain separate.',inputSha256:meta.rawSha256,field:preparation.field,paidReinforcements:preparation.reinforcements,doctors:preparation.doctors,assaultClock:[ready.hour,ready.secondOfHour],treasury:ready.resources.treasury}));
});

test('the earned loose route rests four actual veterans, hires eight paid reinforcements and returns the finite arsenal',t=>{
 const name='earned-loose-funded-before-mountain-arsenal',fixture=suffix=>readFileSync(new URL(`./fixtures/${name}.${suffix}`,import.meta.url));
 const meta=JSON.parse(fixture('provenance.json')),compressed=fixture('campaign.json.gz'),raw=gunzipSync(compressed),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
 assert.equal(sha(raw),meta.rawSha256);assert.equal(sha(compressed),meta.gzipSha256);assert.equal(raw.length,meta.rawBytes);
 const start=JSON.parse(raw),before=structuredClone(start),events=[],checkpoints=new Map();
 assert.deepEqual([start.hour,start.secondOfHour],meta.clock);assert.equal(start.resources.treasury,meta.treasury);
 assert.deepEqual(start.squad,[2,126,133,1,8]);assert.equal(start.flags.armyFunded,true);assert.equal(start.location,'mendoza');
 assert.equal(start.operativeState[1].morale,0);assert.equal(start.operativeState[8].morale,0);
 const result=recoverCreatedCuyoMountainArtillery(start,{report:event=>{const{campaign,battle,...record}=event;events.push(record);},onCheckpoint:(stage,campaign)=>{
  const battle=campaign.pendingBattle?enterSector(campaign.pendingBattle,campaign.sectorStates[campaign.pendingBattle.sector]):undefined;
  const restored=decodeSave(encodeSave(campaign,battle));assert.deepEqual(restored.campaign,campaign);if(battle)assert.deepEqual(restored.battle,battle);checkpoints.set(stage,campaign);
 }});
 const end=result.campaign,ready=checkpoints.get('arsenal-assault'),victory=checkpoints.get('arsenal-victory'),preparation=events.find(event=>event.event==='createdCuyoArsenalAssaultReady');
 assert.deepEqual(preparation.field,[1,8,126,133,128,105,106,145,147,109,132,135]);assert.equal(new Set(preparation.field).size,12);
 assert.deepEqual(preparation.reinforcements,[128,105,106,145,147,109,132,135]);assert.deepEqual(preparation.doctors,[8,135]);
 assert.equal(ready.pendingBattle.squad.length,12);assert.deepEqual(ready.pendingBattle.artillery,[]);
 assert.ok(ready.hour>=start.hour+300,'Zero-morale permanent veterans earn the required readiness through the real rest clock.');
 for(const id of [1,8])assert.ok(ready.operativeState[id].morale>=50);
 for(const id of preparation.reinforcements){assert.equal(ready.contracts[id].kind,'paid');assert.equal(ready.contracts[id].term,'day');assert.ok(ready.contracts[id].paid>0);}
 for(const id of preparation.doctors)assert.equal(ready.operativeState[id].medkits,8);
 const battle=events.find(event=>event.event==='battleFinished');assert.equal(battle.sector,'ensenada');assert.equal(battle.status,'victory');assert.ok(battle.actions>0&&battle.elapsedSeconds>0);
 const losses=preparation.field.filter(id=>!victory.operativeState[id].alive);
 assert.equal(end.location,'mendoza');assert.equal(end.pendingBattle,null);assert.equal(end.pendingEncounter,null);assert.equal(end.defeated,false);
 assert.deepEqual(end.squad,start.squad);assert.equal(end.activeSquadId,start.activeSquadId);
 for(const id of start.squad){assert.equal(end.operativeState[id].alive,true);assert.equal(end.operativeState[id].location,'mendoza');}
 for(const id of preparation.field.filter(id=>!losses.includes(id))){assert.equal(end.operativeState[id].alive,true);assert.equal(end.operativeState[id].location,'mendoza');assert.equal(end.operativeState[id].bleeding,0);assert.ok(end.operativeState[id].hp>=15);}
 for(const id of preparation.reinforcements)assert.ok(!end.recruited.includes(id),'Actual temporary survivors end their paid service after returning.');
 for(const[sector,guns]of Object.entries(start.artilleryDepots))for(const gun of guns)assert.deepEqual(end.artilleryDepots[sector].find(piece=>piece.id===gun.id),gun);
 for(const gun of FINITE_ARTILLERY_ARSENALS.ensenada.pieces)assert.deepEqual(storedArtilleryRecord(end.artilleryDepots.mendoza.find(piece=>piece.id===gun.id)),gun);
 assert.deepEqual(result.selections,FINITE_ARTILLERY_ARSENALS.ensenada.pieces.map(gun=>'depot:'+gun.id));
 for(const[id,record]of Object.entries(start.operativeState))if(!record.alive){assert.equal(end.operativeState[id].alive,false);assert.equal(end.operativeState[id].deathMinute,record.deathMinute);}
 assert.deepEqual(start,before);assert.deepEqual(decodeSave(encodeSave(end)).campaign,end);
 t.diagnostic(JSON.stringify({scope:'Actual loose funded input, native arsenal battle, finite aid, physical return and cannon delivery; later mountain and ending remain separate.',inputSha256:meta.rawSha256,field:preparation.field,paidReinforcements:preparation.reinforcements,losses,battle:{turns:battle.turns,actions:battle.actions},return:[end.hour,end.secondOfHour],treasury:end.resources.treasury}));
});
