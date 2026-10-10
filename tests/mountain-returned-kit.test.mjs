import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {collectReturnedMountainKit} from './fresh-mountain-route.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
const save=c=>decodeSave(encodeSave(c)).campaign;
const step=(c,action)=>{const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,next.lastError);return next;};
const fixtureUrl=new URL('./fixtures/mountain-returned-kit-earned-630.campaign.json.gz',import.meta.url);
function earned(){
 const provenance=JSON.parse(readFileSync(new URL('./fixtures/mountain-returned-kit-earned-630.provenance.json',import.meta.url)));
 const compressed=readFileSync(fixtureUrl);assert.equal(sha(compressed),provenance.fixtureGzipSha256);
 const raw=gunzipSync(compressed);assert.equal(sha(raw),provenance.rawCampaignSha256);
 const c=JSON.parse(raw);assert.equal(c.location,'mendoza');assert.deepEqual([c.hour,c.secondOfHour],[630,2766]);
 assert.equal(c.resources.treasury,70443);assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);
 assert.deepEqual(Object.entries(c.operativeState).filter(([,r])=>!r.alive).map(([id])=>Number(id)),provenance.deadIds);
 assert.deepEqual(save(c),c,'the raw native capture must validate and roundtrip as an official campaign save');
 return {c,provenance};
}
const quantities=c=>Object.fromEntries(Object.entries(c.operativeState).map(([id,r])=>[id,{alive:r.alive,captured:r.captured,hp:r.hp,bleeding:r.bleeding,medkits:r.medkits,ammo:r.ammo,carriedAmmo:r.carriedAmmo,carriedLoaded:r.carriedLoaded,inventory:r.inventory,headwear:r.headwear,outfit:r.outfit,legwear:r.legwear}]));

// This is the actual full942 stock prefix. The encounter recruits already have
// native empty body slots; it is not a fixture that removes issued clothing.
test('native empty permanent encounter slots retain exact earned gear and deaths',()=>{
 const {c,provenance}=earned(),before=structuredClone(c),events=[];
 for(const id of provenance.emptyEncounterIds){
  const op=rosterFor(c).find(op=>op.id===id);assert.equal(op.recruitmentSource,'encounter');
  assert.equal(c.contracts[id].kind,'patriot');assert.equal(c.contracts[id].expiresAt,null);
  for(const slot of ['headwear','outfit','legwear'])assert.equal(c.operativeState[id][slot],null);
 }
 const model=sectorInventoryModel(c,'mendoza',rosterFor(c),1);assert.equal(model.reason,null);assert.equal(model.carriedReason,null);
 assert.ok(![...model.entries,...model.carried].some(row=>row.expected&&JSON.parse(row.expected).kind==='outfit'),'no physical hat is hidden by the source filter');
 const after=collectReturnedMountainKit(c,provenance.ids,{report:event=>events.push(event)});
 assert.deepEqual(after,before,'keeping native empty slots issues no item, order, money, healing, contract or casualty change');
 assert.deepEqual(events,[]);assert.deepEqual(save(after),after);
});

test('paid missing headwear recovers the same real hat with one finite debit and official replay',()=>{
 const {c:initial}=earned(),id=116,hat=structuredClone(initial.operativeState[id].headwear),beforeQuantities=quantities(initial),events=[];
 assert.equal(initial.contracts[id].kind,'paid');assert.equal(hat.outfit,'hat');assert.equal(hat.count,1);
 // Only this ordinary drop changes the earned input. It moves the paid actor's
 // real issued hat to a known local source and does not create a garment.
 const drop={type:'sectorInventory',sector:'mendoza',operativeId:id,direction:'drop',item:'headwear',count:1};
 const dropped=step(initial,drop);assert.equal(dropped.operativeState[id].headwear,null);
 const model=sectorInventoryModel(dropped,'mendoza',rosterFor(dropped),id);
 const source=model.entries.find(row=>row.reachable&&JSON.parse(row.expected).outfit==='hat');assert.ok(source);assert.equal(source.count,1);
 const {item,...record}=JSON.parse(source.expected);assert.deepEqual(record,hat);
 const after=collectReturnedMountainKit(dropped,[id],{report:event=>events.push(event)});
 assert.deepEqual(after.operativeState[id].headwear,hat,'the paid empty slot must still recover physical kit');
 assert.equal(sectorInventoryModel(after,'mendoza',rosterFor(after),id).entries.find(row=>row.key===source.key)?.count??0,0);
 assert.deepEqual(quantities(after),beforeQuantities,'the drop/take/equip sequence preserves every physical quantity and true death');
 assert.deepEqual(after.resources,initial.resources);assert.deepEqual(after.contracts,initial.contracts);
 assert.deepEqual([after.hour,after.secondOfHour],[initial.hour,initial.secondOfHour]);
 assert.deepEqual(after.artilleryDepots,initial.artilleryDepots);assert.deepEqual(after.artilleryTransfers,initial.artilleryTransfers);
 const recovered=events.filter(event=>event.event==='mountainReturnedKit');assert.equal(recovered.length,1);
 assert.deepEqual({sourceKey:recovered[0].sourceKey,sourceCount:recovered[0].sourceCount,remaining:recovered[0].remaining,record:recovered[0].record},{sourceKey:source.key,sourceCount:1,remaining:0,record:hat});
 const tape=[drop,...events.filter(event=>event.event==='freshRouteOrder'||event.event==='freshRouteRenewal').map(event=>event.action)];
 assert.equal(tape.length,3,'only native drop, take and equip are needed');
 let replay=step(save(initial),tape[0]);replay=save(replay);
 for(const action of tape.slice(1))replay=step(replay,action);
 assert.deepEqual(replay,after);assert.deepEqual(save(after),after);
});
