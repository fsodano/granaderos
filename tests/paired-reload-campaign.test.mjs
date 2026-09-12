import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {defaultProfile} from '../game/character-profile.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {equipmentFingerprint,inventoryUsage} from '../game/tactical-inventory.js';
import {actBattle} from '../game/tactical.js';import {pairedPistol} from '../game/paired-fire.js';
import {enterSector} from '../game/world.js';import {syncBattleTime} from '../game/time.js';import {encodeSave,decodeSave} from '../game/save.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const actor=b=>b.units.find(u=>u.id==='1000');
const personal=s=>sectorInventoryModel(s,'retiro',rosterFor(s),1000).personal;
function arrange(s,type,sourceId,destinationId){const u=personal(s);return order(s,{type:'sectorInventory',sector:'retiro',operativeId:1000,direction:'arrange',kind:'cursor',cursorAction:type,sourceId,destinationId,expectedSource:equipmentFingerprint(u,type==='pickupEquipment'?sourceId:'cursor'),...(destinationId?{expectedDestination:equipmentFingerprint(u,destinationId)}:{})});}

test('a bought spare loads through one R order without swapping hands and preserves finite charges through campaign return',()=>{
 let c=order(initialCampaign(8),{type:'createOfficer',name:'Elena Testigo',answers:{origin:'estancia',doctrine:'cavalry_commander',crisis:'rescue',specialty:'ambidextrous',temperament:'steady'},profile:{...defaultProfile(),classId:'artesano'}});
 assert.deepEqual(c.recruited,[1000]);const cash=c.resources.treasury,stock=c.merchants.retiro.stock[1808];
 c=order(c,{type:'purchaseEquipment',item:1808});assert.equal(c.resources.treasury,cash-220);assert.equal(c.merchants.retiro.stock[1808],stock-1);
 c=order(c,{type:'equip',operativeId:1000,itemId:1808,slot:'weapon',instanceId:c.armoryItems.find(i=>i.item===1808).id});
 c=arrange(c,'pickupEquipment','hand:right');c=arrange(c,'placeEquipment',undefined,'large-4');
 c=order(c,{type:'equip',operativeId:1000,itemId:1805,slot:'weapon',instanceId:c.armoryItems.find(i=>i.item===1805).id});
 const p=personal(c),slot=inventoryUsage(p).slots.find(s=>s.entry?.weapon===1808||s.entry?.value?.weapon===1808||s.entry?.item?.startsWith('inventory:')&&p.inventory[s.entry.item.slice(10)]?.weapon===1808);assert.ok(slot);
 c=arrange(c,'pickupEquipment',slot.id);c=arrange(c,'placeEquipment',undefined,'hand:left');c=decodeSave(encodeSave(c)).campaign;
 assert.equal(personal(c).weapon,1805);assert.equal(personal(c).offHand.weapon,1808);
 c=order(c,{type:'visitSector'});let b=enterSector(c.pendingBattle);const act=a=>{b=actBattle(b,{unitId:'1000',...a});assert.equal(b.lastError,null,b.lastError);};
 const missing=3-actor(b).loaded-actor(b).offHand.loaded,reserve=actor(b).ammo,primaryId=actor(b).weaponInstanceId,secondId=actor(b).offHand.instanceId,ap=actor(b).ap;
 assert.ok(missing>0);act({type:'reload'});assert.equal(actor(b).loaded,1);assert.equal(actor(b).offHand.loaded,2);assert.equal(actor(b).ammo,reserve-missing);assert.equal(actor(b).ap,ap);assert.equal(actor(b).weapon,1805);assert.equal(actor(b).weaponInstanceId,primaryId);assert.equal(actor(b).offHand.instanceId,secondId);
 {const loadedSync=syncBattleTime(c,b);assert.equal(loadedSync.error,null);({campaign:c,battle:b}=decodeSave(encodeSave(loadedSync.campaign,loadedSync.battle)));}
 assert.ok(pairedPistol(actor(b)));const before={primary:actor(b).loaded,other:actor(b).offHand.loaded,reserve:actor(b).ammo,condition:actor(b).condition,otherCondition:actor(b).offHand.condition};
 // An ordinary clear-sector location shot, at the actor's own supported row.
 const u=actor(b),point=b.tiles.find(t=>t.y===u.y&&Math.abs(t.x-u.x)>=2&&!t.blocked);assert.ok(point);
 act({type:'firePoint',x:point.x,y:point.y});const fired=structuredClone(actor(b));
 assert.equal(fired.loaded,before.primary-(fired.jammed?0:1));assert.equal(fired.offHand.loaded,before.other-(fired.offHand.jammed?0:1));assert.equal(fired.ammo,before.reserve);assert.ok(fired.loaded<before.primary||fired.offHand.loaded<before.other);
 let sync=syncBattleTime(c,b);assert.equal(sync.error,null);c=sync.campaign;b=sync.battle;({campaign:c,battle:b}=decodeSave(encodeSave(c,b)));
 c=order(c,{type:'leaveSector',battleId:c.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});c=decodeSave(encodeSave(c)).campaign;
 c=order(c,{type:'visitSector'});b=enterSector(c.pendingBattle,c.sectorStates.retiro);const returned=actor(b);
 for(const key of ['loaded','condition','jammed','offHand'])assert.deepEqual(returned[key],fired[key],key);
 assert.ok(returned.traits.includes('ambidextrous'));assert.equal(c.merchants.retiro.stock[1808],stock-1);assert.doesNotThrow(()=>decodeSave(encodeSave(c,b)));
});
