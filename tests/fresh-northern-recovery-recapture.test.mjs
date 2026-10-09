import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {artilleryProfile} from '../game/artillery-definitions.js';
import {reuniteFreshNorthernSquad,prepareFreshSaltaAssault} from './fresh-northern-recovery.mjs';

test('the earned lost-Córdoba return uses finite joined recapture, recorded saved replay, casualty care and physical cannon custody',()=>{
 // This is an unchanged earned save from the native full recovery prefix.
 // The companion metadata records its source and capture provenance.
 const raw=gunzipSync(readFileSync(new URL('./fixtures/northern-reunite-lost-cordoba.save.json.gz',import.meta.url)));
 const metadata=JSON.parse(readFileSync(new URL('./fixtures/northern-reunite-lost-cordoba.provenance.json',import.meta.url)));
 assert.equal(createHash('sha256').update(raw).digest('hex'),metadata.sha256);
 const start=decodeSave(raw.toString()).campaign,before=structuredClone(start),events=[];
 assert.equal(start.hour,306);assert.equal(start.secondOfHour,2959);assert.equal(start.location,'buenos_aires');assert.deepEqual(start.squad,[121,112,1000,10,4]);
 assert.equal(start.sectors.cordoba.owner,'royalist');assert.equal(start.enemyGroups.find(g=>g.id==='enemy-group-3').status,'stationed');
 const c=reuniteFreshNorthernSquad(start,{report:event=>events.push(event)});assert.deepEqual(start,before);
 const rested=events.find(e=>e.event==='northernReturnRested').campaign;
 assert.equal(rested.hour,316);assert.equal(rested.secondOfHour,2959);assert.equal(rested.resources.treasury,97698);assert.deepEqual(rested.squad,[10,4,121,112,1000]);
 const rejected=dispatchCampaign(rested,{type:'travel',sector:'cordoba'});
 assert.equal(rejected.lastError,metadata.rejectedReturn.error);assert.deepEqual({...rejected,lastError:null},rested,'the original route refusal must remain atomic');
 const cartridges=events.filter(e=>e.action?.type==='sectorInventory'&&e.family==='ammoPistol');
 assert.equal(cartridges.reduce((sum,e)=>sum+e.quantity,0),20);assert.deepEqual(cartridges.map(e=>[e.action.operativeId,e.quantity,e.sourceKind]),[[10,10,'body'],[4,10,'container']]);
 const shipment=events.find(e=>e.event==='routeBatteryShipment');assert.equal(shipment.id,'arsenal:buenos_aires:1');assert.equal(shipment.from,'buenos_aires');assert.equal(shipment.to,'san_nicolas');assert.equal(shipment.record.loaded,true);assert.equal(shipment.record.ammo,6);
 const ready=events.find(e=>e.event==='northernReturnRecaptureReady').campaign;
 assert.deepEqual(ready.pendingBattle.squad.map(u=>u.id),[10,4,121,112,1000,123,119,103]);assert.deepEqual(ready.pendingBattle.occupationGroupIds,['enemy-group-3']);
 const gun=ready.pendingBattle.artillery.find(g=>g.id===shipment.id);assert.equal(gun.loaded,true);assert.equal(gun.ammo,6);assert.equal(artilleryProfile(ready,gun).crew,2);
 const recaptured=events.find(e=>e.event==='northernReturnRecaptured');assert.equal(recaptured.status,'victory');assert.equal(recaptured.exactSavedReplay,true);assert.ok(recaptured.actions>0&&recaptured.orders>recaptured.actions);
 const actualDeaths=recaptured.units.filter(u=>u.side==='player'&&u.hp<=0&&before.operativeState[Number(u.id)]?.alive).map(u=>Number(u.id));assert.ok(actualDeaths.length>0);
 for(const id of actualDeaths)assert.equal(c.operativeState[id].alive,false,'native recapture losses stay permanent');
 const care=events.find(e=>e.event==='northernRoadRecovered');assert.equal(recaptured.campaign.operativeState[1000].hp,23);assert.equal(care.campaign.operativeState[1000].hp,78);
 const dressings=care.careEvents.filter(e=>e.action?.type==='sectorInventory'&&e.action.direction==='take'&&JSON.parse(e.action.expected).item==='medkits');
 assert.equal(dressings.reduce((sum,e)=>sum+e.action.count,0),8);assert.equal(recaptured.campaign.operativeState[10].medkits,2);assert.equal(care.campaign.operativeState[10].medkits,0);
 for(const event of dressings){const source=JSON.parse(event.action.sourceKey);assert.equal(source[0],'body');assert.ok(recaptured.campaign.sectorStates.cordoba.units.some(u=>u.id===source[1]&&u.hp===0));}
 assert.equal(c.location,'tucuman');assert.equal(c.sectors.cordoba.owner,'patriot');assert.ok(c.squad.includes(1));assert.ok(c.recruited.includes(9)&&c.recruited.includes(11));
 for(const id of c.recruited.filter(id=>c.operativeState[id].alive)){assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);assert.equal(c.operativeState[id].bleeding,0);assert.equal(c.operativeState[id].location,'tucuman');}
 for(const [id,r]of Object.entries(before.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
 const captured=recaptured.campaign.sectorStates.cordoba.artillery.find(g=>g.id==='arsenal:cordoba:2'),delivered=c.artilleryDepots.tucuman.find(g=>g.id===captured.id);
 assert.equal(captured.side,'player');for(const key of ['id','type','side','loaded','ammo'])assert.deepEqual(delivered[key],captured[key]);
 const spent=c.sectorStates.cordoba.artillery.find(g=>g.id===shipment.id);assert.equal(spent.loaded,false);assert.equal(spent.ammo,0);
 assert.equal(c.enemyGroups.find(g=>g.id==='enemy-group-3').status,'defeated');assert.equal(c.enemyGroups.find(g=>g.id==='enemy-group-4').status,'marching','the next real northern raid remains unresolved campaign state');
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 // Preparation selects that exact physically delivered two-person bronze gun.
 // It does not require an absent swivel or create another cannon or cartridge.
 const prepared=prepareFreshSaltaAssault(c);assert.equal(prepared.pendingBattle.sector,'salta');
 const deployed=prepared.pendingBattle.artillery.find(g=>g.side==='player');assert.equal(deployed.id,delivered.id);assert.equal(deployed.type,'bronze4');assert.equal(deployed.loaded,delivered.loaded);assert.equal(deployed.ammo,delivered.ammo);
 for(const id of actualDeaths)assert.equal(prepared.operativeState[id].alive,false);
 const battle=enterSector(prepared.pendingBattle,prepared.sectorStates.salta);assert.deepEqual(decodeSave(encodeSave(prepared,battle)),{campaign:prepared,battle});
});
