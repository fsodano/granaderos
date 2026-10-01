import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,restoreCampaign,serializeCampaign,rosterFor} from '../game/campaign.js';
import {createBattle,actBattle} from '../game/tactical.js';
import {storeEquipment,returnEquipment,validateEquipmentOwnership} from '../game/equipment.js';
import {refreshMilitaryCondition} from '../game/actor-condition.js';
import {sanLorenzoAlly} from '../game/missions.js';
const order=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null,next.lastError);return next;};
const act=(b,a)=>{const next=actBattle(b,a);assert.equal(next.lastError,null,next.lastError);return next;};

// The cleared combat fixture isolates ownership. Purchases, fitting, transfer,
// equipping, and the complete campaign report all use the production reducers.
function allyAssembly(){
 let s=order(initialCampaign(),{type:'purchaseEquipment',item:1800});s=order(s,{type:'wait',hours:s.equipmentShipments[0].due-s.hour});s=order(s,{type:'equip',operativeId:4,itemId:1800,slot:'weapon'});s=order(s,{type:'purchaseEquipment',item:'1811:india_socket'});const bayonet=s.armoryItems.find(i=>i.fittingPattern);s=order(s,{type:'equip',operativeId:4,itemId:'1811:india_socket',slot:'blade',instanceId:bayonet.id});
 s.phase=1;s.flags.academy=true;s.sectors.san_nicolas.owner='patriot';s=order(s,{type:'travel',sector:'san_nicolas'});s=order(s,{type:'attack',sector:'san_lorenzo'});const r=s.pendingBattle;
 let b=createBattle([...r.squad.map((u,i)=>({...u,x:2+i*2,y:2})),...r.missionAllies.map(u=>({...u,x:5,y:2}))],{...r,width:20,height:16,tiles:Array.from({length:320},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',blocked:false,cover:0})),props:[],npcs:r.npcs.map((npc,i)=>({...npc,x:16-i,y:12})),enemies:r.enemies.map((u,i)=>({...u,x:10+i,y:4,hp:0}))});
 b=act(b,{type:'explore'});b=act(b,{type:'fitBayonet',unitId:'4',item:'blade'});b=act(b,{type:'transfer',unitId:'4',targetId:'57',item:'primary',count:1});const inventoryKey=Object.keys(b.units.find(u=>u.id==='57').inventory).find(key=>b.units.find(u=>u.id==='57').inventory[key].fittings);b=act(b,{type:'equipLoot',unitId:'57',inventoryKey});
 s=order(s,{type:'battleResult',battleId:r.id,outcome:'victory',sectorState:b,survivors:b.units.filter(u=>u.side==='player')});assert.equal(s.missionAllies.san_lorenzo.weaponFittings.bayonet.instanceId,bayonet.instanceId);assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);return s;
}

for(const withField of [true,false])test(`mission ally equipment rejects another physical owner ${withField?'with its field journal':'without a field journal'}`,()=>{
 const s=allyAssembly();if(!withField)delete s.sectorStates.san_lorenzo;
 assert.doesNotThrow(()=>restoreCampaign(serializeCampaign(s)));
 storeEquipment(s,1800,{fittings:s.missionAllies.san_lorenzo.weaponFittings});
 assert.throws(()=>restoreCampaign(serializeCampaign(s)),/identidad.*duplicada/i);
});

test('a mission ally present only in the physical field still claims its equipment',()=>{
 const s=allyAssembly();const fitting=s.missionAllies.san_lorenzo.weaponFittings;delete s.missionAllies.san_lorenzo;assert.doesNotThrow(()=>restoreCampaign(serializeCampaign(s)));storeEquipment(s,1800,{fittings:fitting});assert.throws(()=>restoreCampaign(serializeCampaign(s)),/identidad.*duplicada/i);
});

test('an active battle supersedes the retained ally after a legal assembly transfer',()=>{
 const s=allyAssembly(),fitting=structuredClone(s.missionAllies.san_lorenzo.weaponFittings);let b=structuredClone(s.sectorStates.san_lorenzo);b=act(b,{type:'move',unitId:'3',x:4,y:3});b=act(b,{type:'transfer',unitId:'57',targetId:'3',item:'primary',count:1});const inventoryKey=Object.keys(b.units.find(u=>u.id==='3').inventory).find(key=>b.units.find(u=>u.id==='3').inventory[key].fittings);b=act(b,{type:'equipLoot',unitId:'3',inventoryKey});assert.deepEqual(b.units.find(u=>u.id==='57').weaponFittings,{});assert.deepEqual(s.missionAllies.san_lorenzo.weaponFittings,fitting);assert.equal(validateEquipmentOwnership(s,rosterFor(s),b),true);
 const duplicate=structuredClone(s);storeEquipment(duplicate,1800,{fittings:fitting});assert.throws(()=>validateEquipmentOwnership(duplicate,rosterFor(duplicate),b),/identidad.*duplicada/i);const malformed=structuredClone(s);malformed.missionAllies.san_lorenzo.weaponFittings.bayonet.loaded=1;assert.throws(()=>validateEquipmentOwnership(malformed,rosterFor(malformed),b),/bayoneta/i);
});

test('actual corpse loot supersedes a stale dead ally cache without duplicating the fitting on restore',()=>{
 const s=allyAssembly();let b=structuredClone(s.sectorStates.san_lorenzo),body=b.units.find(u=>u.id==='57');
 // Prepared dead-cache fixture: the corpse and its old report initially agree.
 // The subsequent approach and loot use paid tactical actions.
 Object.assign(body,{hp:0,ap:0,bleeding:0,bandaged:0,unconscious:false});refreshMilitaryCondition(body);b.returnLedger.entries.find(e=>e.unitId==='57').kind='dead';s.missionAllies.san_lorenzo=structuredClone(body);s.sectorStates.san_lorenzo=structuredClone(b);const fitting=structuredClone(body.weaponFittings);
 assert.doesNotThrow(()=>restoreCampaign(serializeCampaign(s)));b=act(b,{type:'move',unitId:'3',x:4,y:3});b=act(b,{type:'loot',unitId:'3',targetId:'57',item:'weapon',count:1});const inventoryKey=Object.keys(b.units.find(u=>u.id==='3').inventory).find(key=>b.units.find(u=>u.id==='3').inventory[key].fittings);b=act(b,{type:'equipLoot',unitId:'3',inventoryKey});assert.equal(validateEquipmentOwnership(s,rosterFor(s),b),true);
 // Exercise the same return helper while retaining the old dead mission cache.
 const receiver=b.units.find(u=>u.id==='3');returnEquipment(s,3,receiver);s.operativeState[3].inventory=structuredClone(receiver.inventory);s.sectorStates.san_lorenzo=structuredClone(b);assert.deepEqual(s.missionAllies.san_lorenzo.weaponFittings,fitting);assert.deepEqual(b.units.find(u=>u.id==='57').weaponFittings,{});assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);
 storeEquipment(s,1800,{fittings:fitting});assert.throws(()=>restoreCampaign(serializeCampaign(s)),/identidad.*duplicada/i);
});

test('actual mission ally hand drops remain empty in its saved cache and next unit reconstruction',()=>{
 let s=allyAssembly(),b=structuredClone(s.sectorStates.san_lorenzo);b=act(b,{type:'drop',unitId:'57',item:'blade',count:1});b=act(b,{type:'drop',unitId:'57',item:'primary',count:1});s.missionAllies.san_lorenzo=structuredClone(b.units.find(u=>u.id==='57'));s.sectorStates.san_lorenzo=structuredClone(b);s=restoreCampaign(serializeCampaign(s));assert.equal(s.missionAllies.san_lorenzo.blade,undefined);assert.equal(s.missionAllies.san_lorenzo.weaponDropped,true);assert.deepEqual(s.missionAllies.san_lorenzo.weaponFittings,{});const next=createBattle([sanLorenzoAlly(s)],{sector:'san_lorenzo',width:20,height:16,enemies:[]});assert.equal(next.units[0].blade,undefined);assert.equal(next.units[0].weaponDropped,true);assert.equal(next.units[0].loaded,0);assert.deepEqual(next.units[0].weaponFittings,{});
});
