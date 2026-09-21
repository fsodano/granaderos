import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign} from '../game/campaign.js';
import {scriptedBattleReport} from './scripted-battle-report.mjs';
import {encodeSave,decodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {artilleryTransportPreview} from '../game/artillery-transport.js';
import {ownedArtilleryCount} from '../game/campaign-artillery.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const save=s=>decodeSave(encodeSave(s)).campaign;
function stationed(){
 let s=order(initialCampaign(45),{type:'purchaseEquipment',item:'swivel'});
 s=order(s,{type:'transport',mode:'carts'});
 s=order(s,{type:'travel',sector:'buenos_aires'});s=order(s,{type:'attack',sector:'san_nicolas'});
 // Scripted settlement isolates custody and transport, not combat balance.
 const report=scriptedBattleReport(s);Object.assign(report.sectorState.artillery[0],{loaded:false,ammo:2,reloadProgress:.4});
 s=order(s,report);return save(s);
}
const action=s=>({type:'transportArtillery',sector:'san_nicolas',gunId:s.sectorStates.san_nicolas.artillery[0].id,destination:'buenos_aires',mode:'carts'});
test('a paid deployed gun travels, saves and redeploys with exact identity and unfinished loading',()=>{
 let s=stationed();const gun=structuredClone(s.sectorStates.san_nicolas.artillery[0]),before=structuredClone(s.resources),a=action(s),plan=artilleryTransportPreview(s,a);
 assert.equal(plan.valid,true);assert.equal(plan.hours,18);assert.equal(plan.weight,504);const count=ownedArtilleryCount(s);
 s=order(s,a);assert.equal(s.sectorStates.san_nicolas.artillery.length,0);assert.deepEqual(s.resources,before);assert.equal(s.convoys.length,1);assert.equal(ownedArtilleryCount(s),count);s=save(s);
 const rejected=dispatchCampaign(s,a);assert.ok(rejected.lastError);assert.deepEqual({...rejected,lastError:s.lastError},s);
 for(let h=0;h<24&&s.convoys.length;h++)s=order(s,{type:'wait',hours:1});assert.equal(s.convoys.length,0);s=save(s);
 const stored=s.artilleryStores.buenos_aires[0];assert.deepEqual(stored,{id:gun.id,type:gun.type,side:'player',loaded:false,ammo:2,reloadProgress:.4});assert.equal(s.depots.buenos_aires.cannons??0,0);assert.equal(ownedArtilleryCount(s),count);
 s=order(s,{type:'travel',sector:'buenos_aires'});s=order(s,{type:'configureArtillery',types:['swivel']});
 s.sectors.ensenada.owner='royalist'; // Controlled occupation isolates deployment custody.
 s=order(s,{type:'attack',sector:'ensenada'});assert.equal(s.artilleryStores.buenos_aires.length,0);
 assert.deepEqual(s.pendingBattle.artillery,[stored]);
 const battle=enterSector(s.pendingBattle,s.sectorStates.ensenada),pair=decodeSave(encodeSave(s,battle));
 assert.equal(pair.battle.artillery[0].id,gun.id);assert.equal(pair.battle.artillery[0].ammo,2);assert.equal(pair.battle.artillery[0].loaded,false);assert.equal(pair.battle.artillery[0].reloadProgress,.4);
 assert.equal(pair.campaign.resources.cannons,before.cannons);
 const duplicate=structuredClone(pair);duplicate.campaign.artilleryStores.buenos_aires=[stored];assert.throws(()=>decodeSave(encodeSave(duplicate.campaign,duplicate.battle)),/duplicada/);
});
test('a cut convoy route retains the exact gun until ownership is restored',()=>{
 let s=stationed();s=order(s,action(s));const payload=structuredClone(s.convoys[0].artillery);s.sectors.buenos_aires.owner='royalist';
 for(let h=0;h<18;h++)s=order(s,{type:'wait',hours:1});assert.equal(s.convoys.length,1);assert.deepEqual(s.convoys[0].artillery,payload);assert.equal(s.artilleryStores,undefined);s=save(s);
 s.sectors.buenos_aires.owner='patriot';s=order(s,{type:'wait',hours:1});assert.equal(s.convoys.length,0);assert.deepEqual(s.artilleryStores.buenos_aires,payload);
});
test('crew, capacity, transport and duplicate-identity checks reject invalid recovery',()=>{
 const s=stationed(),a=action(s);
 for(const patch of [{destination:'san_nicolas'},{mode:'posta'},{destination:'humahuaca'},{gunId:'missing'}])assert.equal(artilleryTransportPreview(s,{...a,...patch}).valid,false);
 const incapacitated=structuredClone(s);for(const id of incapacitated.squad)incapacitated.operativeState[id].hp=10;assert.match(artilleryTransportPreview(incapacitated,a).reason,/artilleros/);
 const heavy=structuredClone(s);heavy.sectorStates.san_nicolas.artillery[0].ammo=300;assert.match(artilleryTransportPreview(heavy,a).reason,/capacidad/);
 const queued=order(s,a);queued.artilleryStores={retiro:structuredClone(queued.convoys[0].artillery)};assert.throws(()=>save(queued),/duplicada/);
});
test('hostile presence, active encounters and overweight saved convoys cannot bypass loading rules',()=>{
 const s=stationed(),a=action(s),hostile=structuredClone(s);const enemy=hostile.sectorStates.san_nicolas.units.find(u=>u.side==='enemy');Object.assign(enemy,{hp:100,energy:100,unconscious:false,routed:false,surrendered:false,departure:null});assert.match(artilleryTransportPreview(hostile,a).reason,/Asegurá/);
 assert.equal(artilleryTransportPreview({...s,pendingEncounter:{groupId:'pending'}},a).valid,false);
 const queued=order(s,a);queued.convoys[0].artillery[0].ammo=1000;assert.throws(()=>save(queued),/capacidad/);
 const loaded=order(s,a);loaded.convoys[0].artillery[0].loaded=true;assert.throws(()=>save(loaded),/recarga|carga/i);
});
