import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote} from '../game/contracts.js';
import {repairRate} from '../game/assignments.js';
import {repairEquipmentQueue} from '../game/equipment-repair.js';
import {repairMaterialPoints} from '../game/repair-materials.js';
import {actBattle,presentedActBattle} from '../game/tactical.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {syncBattleTime} from '../game/time.js';
import {visit} from './local-contract-fixture.mjs';
import {takeFiniteCache,leaveFiniteCache} from './finite-cache-driver.mjs';

const ID=110,CACHE='retiro:armory-cache';
const saved=campaign=>decodeSave(encodeSave(campaign)).campaign;
const order=(state,action)=>{const next=dispatchCampaign(state,action);assert.equal(next.lastError,null,next.lastError);return next;};
const worn=s=>s.operativeState[ID];
const cache=s=>s.sectorStates.retiro.props.find(prop=>prop.id===CACHE);
const ammo=r=>({loaded:r.carriedLoaded,total:r.carriedAmmo,inventory:Object.fromEntries(Object.entries(r.inventory).filter(([,item])=>item.kind==='ammunition'))});

function preparedRepair(){
 let campaign=initialCampaign(8);const quote=contractQuote(campaign,rosterFor(campaign).find(unit=>unit.id===ID),'week');
 campaign=order(campaign,{type:'recruitCivic',id:ID,term:'week'});
 assert.equal(campaign.resources.treasury,3200-quote.price);
 // Declared initial wear isolates garment repair. The two damaged garments
 // are this paid recruit's native clothing, not additional item grants. All
 // acquisition, packing, work and saved continuation below use public orders.
 worn(campaign).headwear={...worn(campaign).headwear,condition:96,instanceId:'prepared-native-hat'};
 worn(campaign).outfit={...worn(campaign).outfit,condition:93,instanceId:'prepared-native-poncho'};
 campaign=saved(campaign);
 let pair=takeFiniteCache(visit(campaign),ID,[{kind:'repair-kit',count:1},{outfit:'linen_shirt',count:1}]);
 const actor=pair.battle.units.find(unit=>unit.id===String(ID)),key=Object.keys(actor.inventory).find(key=>actor.inventory[key].outfit==='linen_shirt');
 const action={type:'equipLoot',unitId:String(ID),slot:'outfit',inventoryKey:key};
 const battle=actBattle(pair.battle,action);assert.equal(battle.lastError,null,battle.lastError);
 assert.deepEqual(presentedActBattle(pair.battle,action).state,battle);
 const synced=syncBattleTime(pair.campaign,battle);assert.equal(synced.error,null,synced.error);
 campaign=leaveFiniteCache({campaign:synced.campaign,battle:synced.battle});
 assert.equal(worn(campaign).outfit.instanceId,'cache:retiro:linen-shirt');assert.equal(worn(campaign).outfit.condition,100);
 assert.equal(repairMaterialPoints(worn(campaign)),100);assert.equal(worn(campaign).toolkitPoints,0);
 assert.ok(!cache(campaign).contents.some(item=>item.kind==='repair-kit'||item.outfit==='linen_shirt'));
 return {campaign,quote};
}

test('paid native clothing uses an acquired finite toolkit for hourly worn and packed repairs with exact saved continuation',t=>{
 const {campaign:prepared,quote}=preparedRepair(),record=worn(prepared),op=rosterFor(prepared).find(unit=>unit.id===ID),rate=repairRate(op),before=structuredClone(record),cash=prepared.resources.treasury;
 const queue=repairEquipmentQueue(record,op);assert.deepEqual(queue.map(item=>item.label),['Sombrero de fieltro','Poncho de lana']);
 assert.equal(queue[0].key,'headwear');assert.ok(queue[1].key.startsWith('inventory:'));
 let campaign=order(prepared,{type:'assignWork',operativeId:ID,assignment:'repair',targetId:ID,repairScope:'equipment'}),started=campaign.hour;
 campaign=order(campaign,{type:'wait',hours:1});
 const gained=(worn(campaign).headwear.condition-96)+Object.values(worn(campaign).inventory).filter(item=>item.instanceId==='prepared-native-poncho').reduce((sum,item)=>sum+item.condition-93,0);
 assert.equal(gained,Math.min(rate,11));assert.equal(repairMaterialPoints(worn(campaign)),100-gained);
 assert.equal(worn(campaign).hp,before.hp);assert.deepEqual(ammo(worn(campaign)),ammo(before));assert.equal(worn(campaign).condition,before.condition);assert.equal(campaign.resources.treasury,cash);
 const checkpoint=saved(campaign),continued=order(campaign,{type:'wait',hours:24}),replayed=order(checkpoint,{type:'wait',hours:24});
 assert.deepEqual(replayed,continued);campaign=saved(continued);
 assert.equal(campaign.hour-started,Math.ceil(11/rate));assert.deepEqual(repairEquipmentQueue(worn(campaign),rosterFor(campaign).find(unit=>unit.id===ID)),[]);
 assert.equal(repairMaterialPoints(worn(campaign)),89);assert.equal(worn(campaign).headwear.condition,100);assert.equal(worn(campaign).headwear.instanceId,'prepared-native-hat');
 const poncho=Object.values(worn(campaign).inventory).find(item=>item.instanceId==='prepared-native-poncho');assert.deepEqual(poncho,{...Object.values(before.inventory).find(item=>item.instanceId==='prepared-native-poncho'),condition:100});
 assert.deepEqual(worn(campaign).outfit,before.outfit);assert.equal(worn(campaign).hp,before.hp);assert.deepEqual(ammo(worn(campaign)),ammo(before));assert.equal(campaign.resources.treasury,cash);
 assert.equal(campaign.assignmentAttention.notice.events.some(event=>event.code==='repair_complete'),true);
 campaign=order(campaign,{type:'assignCare',id:ID,assignment:'active'});
 const reentered=visit(campaign),returned=reentered.battle.units.find(unit=>unit.id===String(ID));
 assert.equal(returned.outfit.instanceId,'cache:retiro:linen-shirt');assert.equal(returned.headwear.instanceId,'prepared-native-hat');assert.equal(returned.headwear.condition,100);
 assert.equal(repairMaterialPoints(returned),89);assert.ok(!reentered.battle.props.find(prop=>prop.id===CACHE).contents.some(item=>item.kind==='repair-kit'||item.outfit==='linen_shirt'));
 assert.equal(Object.values(returned.inventory).filter(item=>item.kind==='repair-kit').length,1);
 t.diagnostic(JSON.stringify({fixture:'prepared wear of native paid garments; acquired real cache shirt/toolkit',paidPrice:quote.price,treasury:cash,hourlyBudget:rate,workHours:campaign.hour-started,garmentConditionGain:11,toolkitPoints:[100,repairMaterialPoints(returned)],wornHat:returned.headwear.condition,packedPoncho:poncho.condition,shirtId:returned.outfit.instanceId,shirtCount:returned.outfit.count,ammo:ammo(worn(campaign)),hp:worn(campaign).hp}));
});

test('a saved older opened Retiro chest without the new shirt does not gain it on reentry',()=>{
 let campaign=order(initialCampaign(8),{type:'recruitCivic',id:ID,term:'week'}),opened=takeFiniteCache(visit(campaign),ID,[]);
 // Declared pre-shirt compatibility snapshot. This older opened chest never
 // contained the new garment; admission must retain its saved finite stock.
 const oldChest=opened.battle.props.find(prop=>prop.id===CACHE);
 oldChest.contents=oldChest.contents.filter(item=>item.outfit!=='linen_shirt');
 const old=leaveFiniteCache(decodeSave(encodeSave(opened.campaign,opened.battle)));
 assert.ok(!cache(old).contents.some(item=>item.outfit==='linen_shirt'));
 const contents=structuredClone(cache(old).contents),before=structuredClone(old.operativeState),pair=visit(old);
 assert.deepEqual(pair.battle.props.find(prop=>prop.id===CACHE).contents,contents);assert.deepEqual(pair.campaign.operativeState,before);
 assert.equal(pair.battle.props.find(prop=>prop.id===CACHE).contents.some(item=>item.outfit==='linen_shirt'),false);
});
