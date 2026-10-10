import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {actBattle} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {northernOfficerSaltaOrder} from './fresh-northern-fixture.mjs';
import {mountainBatteryOrder} from './mountain-battery-driver.mjs';

const gunId='arsenal:cordoba:2',actorId='11';
const expectedMove={type:'move',unitId:actorId,x:41,y:36,tacticalLevel:0};
const sha=value=>createHash('sha256').update(value).digest('hex');
function earnedPair(){
 const compressed=readFileSync(new URL('./fixtures/northern-officer-spent-gun-earned-prefix.save.json.gz',import.meta.url));
 const provenance=JSON.parse(readFileSync(new URL('./fixtures/northern-officer-spent-gun-earned-prefix.provenance.json',import.meta.url)));
 assert.equal(sha(compressed),provenance.fixtureGzipSha256);
 const raw=gunzipSync(compressed);assert.equal(sha(raw),provenance.officialSaveRawSha256);
 const pair=decodeSave(raw.toString('utf8')),actor=pair.battle.units.find(unit=>unit.id===actorId),gun=pair.battle.artillery.find(piece=>piece.id===gunId);
 assert.equal(pair.battle.status,'active');assert.equal(pair.battle.phase,'interrupt');assert.equal(pair.battle.turn,11);
 assert.deepEqual([actor.x,actor.y,actor.tacticalLevel??0],[42,40,0]);
 assert.equal(actor.stance,'standing');assert.equal(actor.hp,78);assert.equal(actor.ap,66);assert.equal(actor.energy,96);
 assert.equal(actor.loaded,1);assert.equal(actor.ammo,7);assert.equal(gun.loaded,false);assert.equal(gun.ammo,0);
 const tapeCompressed=readFileSync(new URL('./fixtures/northern-officer-spent-gun-canonical-prefix.orders.json.gz',import.meta.url));
 assert.equal(sha(tapeCompressed),provenance.canonicalPrefixTapeGzipSha256);
 const tapeRaw=gunzipSync(tapeCompressed);assert.equal(sha(tapeRaw),provenance.canonicalPrefixTapeRawSha256);
 const tape=JSON.parse(tapeRaw);assert.equal(tape.length,334);assert.deepEqual(tape.at(-1),{type:'stance',unitId:actorId,stance:'standing'});
 return pair;
}
function official(pair){return decodeSave(encodeSave(pair.campaign,pair.battle));}
function nativeMove(pair){
 const battle=actBattle(pair.battle,expectedMove);assert.equal(battle.lastError,null,'the earned delegated move must remain a legal native order');
 const synced=syncBattleTime(pair.campaign,battle);assert.equal(synced.error,null);
 const result={campaign:synced.campaign,battle:synced.battle};assert.deepEqual(official(result),result);return result;
}

// This is the genuine standing officer state inside the retained exhausted-gun
// alternation. It tests the ordinary delegated action rather than a synthetic
// charge predicate or a new battle outcome.
test('spent Salta gun leaves the standing officer to his legal infantry move',()=>{
 const pair=earnedPair(),before=structuredClone(pair),actor=pair.battle.units.find(unit=>unit.id===actorId);
 const delegated=mountainBatteryOrder(pair.battle,actor,{leaderId:'9',helperId:'11',artilleryId:gunId,keepCrewTogether:true,screenDistance:3});
 assert.deepEqual(delegated,expectedMove);
 assert.deepEqual(northernOfficerSaltaOrder(pair.battle,actor,gunId),expectedMove);
 assert.deepEqual(pair,before,'pure selectors must leave the earned pair unchanged');
});

test('the exact earned infantry move pays native cost and replays through the paired save',()=>{
 const pair=earnedPair(),before=structuredClone(pair),after=nativeMove(pair),actor=after.battle.units.find(unit=>unit.id===actorId);
 assert.deepEqual(pair,before,'native admission must not mutate the input pair');
 assert.deepEqual([actor.x,actor.y,actor.tacticalLevel??0],[41,36,0]);assert.equal(actor.stance,'standing');
 assert.equal(actor.ap,30);assert.equal(actor.energy,91);
 assert.equal(after.battle.elapsedSeconds,153,'this move pays AP within the same tactical turn');
 assert.equal(after.battle.syncedSeconds,153);assert.equal(after.campaign.pendingBattle.syncedSeconds,153);
 assert.deepEqual(after.battle.artillery,before.battle.artillery,'the exhausted finite cannon keeps its exact stock and position');
 const quantities=unit=>({id:unit.id,hp:unit.hp,bleeding:unit.bleeding,loaded:unit.loaded,ammo:unit.ammo,inventory:unit.inventory});
 assert.deepEqual(after.battle.units.map(quantities),before.battle.units.map(quantities),'movement does not grant health or firearm quantities');
 const replay=nativeMove(official(before));assert.deepEqual(replay,after,'the same one order must have the same result after the official paired save');
 assert.equal(after.battle.status,'active','this bounded regression makes no full battle victory claim');
});
