import test from 'node:test';
import assert from 'node:assert/strict';
import {beginFreshCampaign,recoverFreshCapital} from './fresh-campaign-route.mjs';
import {decodeSave,encodeSave} from '../game/save.js';

test('the fresh capital route pays for replacements and preserves fallen soldiers and displaced equipment',()=>{
 const events=[],report=event=>events.push(event);
 const opening=beginFreshCampaign({report}),before=structuredClone(opening.campaign);
 const recovered=recoverFreshCapital(opening.campaign,{report}),campaign=recovered.campaign;
 assert.deepEqual(opening.campaign,before,'recovery does not mutate its checkpoint');
 assert.equal(campaign.sectors.buenos_aires.owner,'patriot');
 assert.ok(opening.casualties.length>0);
 for(const id of opening.casualties)assert.equal(campaign.operativeState[id].alive,false);
 const recruits=[...recovered.field,...recovered.support];
 assert.equal(new Set(recruits).size,12);
 for(const id of recruits){
  assert.ok(campaign.operativeState[id].alive);
  assert.ok(campaign.contracts[id].paid>0);
  assert.ok(campaign.contracts[id].expiresAt>campaign.hour);
 }
 for(const id of recovered.field)assert.equal(campaign.operativeState[id].outfit?.outfit,'poncho','the advance squad wears recovered or retained clothing');
 assert.ok(campaign.resources.treasury>=0&&campaign.resources.treasury<before.resources.treasury);
 const salvage=events.find(event=>event.event==='freshEquipmentRecovery');
 assert.ok(salvage.transfers.length>0,'replacement recruits recover actual field weapons');
 for(const id of opening.casualties){
  const recovered=salvage.clothingRecoveries.some(row=>row.sourceKey===JSON.stringify(['body',String(id),'outfit']));
  const outfit=campaign.sectorStates.buenos_aires.units.find(unit=>unit.id===String(id)).outfit;
  assert.deepEqual(outfit,recovered?null:before.sectorStates.buenos_aires.units.find(unit=>unit.id===String(id)).outfit,'only a garment actually recovered from a body is removed');
 }
 for(const transfer of salvage.clothingRecoveries){
  const garment=JSON.parse(transfer.expected),worn=campaign.operativeState[transfer.receiverId].outfit;
  assert.equal(worn.outfit,garment.outfit);assert.equal(worn.condition,garment.condition);assert.equal(worn.count,1);
 }
 for(const transfer of salvage.clothingTransfers){
  assert.ok(recovered.support.includes(transfer.sourceId));assert.ok(recovered.field.includes(transfer.receiverId));
  assert.deepEqual(transfer.garment,before.operativeState[transfer.sourceId].outfit);
  assert.deepEqual(campaign.operativeState[transfer.receiverId].outfit,transfer.garment);
  assert.equal(campaign.operativeState[transfer.sourceId].outfit,null,'the support donor cannot retain a second copy');
 }
 assert.equal(Object.hasOwn(campaign.resources,'ponchos'),false,'clothing remains physical equipment, not a global resource');
 for(const transfer of salvage.transfers){
  const source=campaign.sectorStates.buenos_aires.units.find(unit=>unit.id===transfer.sourceId);
  assert.equal(source.hp,0);assert.equal(source.weaponDropped,true);assert.equal(source.loaded,0);
  if(transfer.outgoing){
   const items=transfer.leftOnGround?campaign.sectorStates.buenos_aires.groundItems:Object.values(campaign.operativeState[transfer.receiverId].inventory??{});
   assert.ok(items.some(item=>Object.entries(transfer.outgoing).every(([key,value])=>JSON.stringify(item[key])===JSON.stringify(value))),'the exact displaced weapon persists in its pack or on the ground');
  }
 }
 assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);
 assert.equal(campaign.completed,false,'this checkpoint is not full campaign completion');
});
