import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave} from '../game/save.js';
import {expandSaveTerrain} from '../game/save-terrain.js';

export function admittedKnownFriendlyFire(){
 const raw=gunzipSync(readFileSync(new URL('./fixtures/northern-known-friendly-fire.save.json.gz',import.meta.url)));
 const proof=JSON.parse(readFileSync(new URL('./fixtures/northern-known-friendly-fire.provenance.json',import.meta.url)));
 assert.equal(createHash('sha256').update(raw).digest('hex'),proof.sha256);
 const historical=expandSaveTerrain(JSON.parse(raw)),admitted=decodeSave(raw.toString());
 // This interrupted legacy save has an enemy on a captured cannon. Require
 // its one exact clearance and preserve every other expanded battle field.
 const expected=structuredClone(historical.battle),cleared=expected.units.find(actor=>actor.id==='enemy-3');
 assert.deepEqual([cleared.x,cleared.y],[34,14]);
 assert.ok(expected.artillery.some(gun=>gun.id==='arsenal:cordoba:1'&&gun.x===34&&gun.y===14));
 assert.equal(expected.artilleryOccupancyVersion,undefined);assert.equal(expected.wallEdges,undefined);
 cleared.y=13;expected.artilleryOccupancyVersion=1;expected.wallEdges=[];
 assert.deepEqual(admitted.battle,expected,'Admission may clear this one legacy cell and add the occupancy and empty-wall markers only.');
 return {historical,admitted,proof};
}
