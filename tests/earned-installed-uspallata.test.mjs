import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {contractExpiresSeconds} from '../game/contracts.js';
import {prepareFreshUspallataAssault,recoverFreshUspallata} from './fresh-mountain-route.mjs';
import {fightNorthernSector} from './northern-route.mjs';
import {assignedMountainBatteryController} from './mountain-battery-driver.mjs';

const fixture=name=>readFileSync(new URL(`./fixtures/${name}`,import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

test('earned installed Uspallata uses ready roles, finite supplies and eight-person entry, then reuses actual care squad slots',t=>{
 const name='earned-installed-funded-uspallata',meta=JSON.parse(fixture(`${name}.provenance.json`));
 const compressed=fixture(`${name}.save.json.gz`),raw=gunzipSync(compressed);
 assert.equal(sha(compressed),meta.gzipSha256);assert.equal(sha(raw),meta.rawSha256);assert.equal(raw.length,meta.rawBytes);
 const start=decodeSave(raw.toString()).campaign,before=structuredClone(start),events=[];
 const report=event=>{const {campaign,battle,...receipt}=event;events.push(receipt);};
 assert.deepEqual([start.hour,start.secondOfHour],meta.clock);assert.equal(start.resources.treasury,meta.treasury);
 const ready=prepareFreshUspallataAssault(start,{report}),initial=enterSector(ready.pendingBattle,ready.sectorStates.uspallata);
 assert.deepEqual(start,before);assert.deepEqual(decodeSave(encodeSave(ready,initial)),{campaign:ready,battle:initial});
 const field=ready.pendingBattle.squad.map(unit=>unit.id);
 assert.equal(field.length,8);assert.equal(new Set(field).size,8);
 assert.ok(ready.squads.filter(q=>q.members.length).length<=8);
 assert.ok(ready.pendingBattle.squad.every(unit=>unit.morale>=50&&unit.energy>0));
 const realCourier=events.find(event=>event.event==='finiteMedicalCourier');
 assert.ok(realCourier);assert.equal(realCourier.mode,'posta');assert.ok(realCourier.quantity>0);
 assert.ok(initial.artillery.filter(gun=>gun.side==='player').every(gun=>gun.loaded||gun.ammo>0));
 const won=fightNorthernSector(ready,'uspallata',{controller:assignedMountainBatteryController(initial),report});
 assert.equal(won.summary.status,'victory');assert.equal(won.summary.turns,8);assert.equal(won.summary.actions,162);
 assert.equal(won.campaign.operativeState[2].hp,36);assert.equal(won.campaign.operativeState[2].alive,true);
 for(const id of field)assert.equal(won.campaign.operativeState[id].alive,true);
 assert.deepEqual(decodeSave(encodeSave(won.campaign)).campaign,won.campaign);
 const recovered=recoverFreshUspallata(won.campaign,{report});
 assert.equal(recovered.location,'mendoza');assert.equal(recovered.pendingBattle,null);assert.equal(recovered.pendingEncounter,null);
 assert.equal(recovered.sectors.uspallata.owner,'patriot');assert.ok(recovered.sectors.uspallata.fort>=1);
 assert.equal(recovered.phase,3);assert.equal(recovered.completed,false);assert.equal(recovered.defeated,false);
 for(const id of field){assert.equal(recovered.operativeState[id].alive,true);assert.equal(recovered.operativeState[id].location,'mendoza');assert.equal(recovered.operativeState[id].hp,recovered.operativeState[id].maxHp);assert.equal(recovered.operativeState[id].bleeding,0);}
 assert.ok(recovered.squads.filter(q=>q.members.length).length<=8);
 for(const [id,record]of Object.entries(before.operativeState))if(!record.alive)assert.equal(recovered.operativeState[id].alive,false);
 for(const id of start.recruited.filter(id=>start.operativeState[id].alive)){
  assert.equal(recovered.operativeState[id].alive,true);assert.ok(recovered.recruited.includes(id));
  const expiry=contractExpiresSeconds(recovered.contracts[id]);assert.ok(expiry===null||expiry>recovered.hour*3600+recovered.secondOfHour);
 }
 assert.deepEqual(decodeSave(encodeSave(recovered)).campaign,recovered);
 t.diagnostic(JSON.stringify({inputSha256:meta.rawSha256,field,victory:won.summary,return:[recovered.hour,recovered.secondOfHour],treasury:recovered.resources.treasury,scope:meta.scope}));
});
