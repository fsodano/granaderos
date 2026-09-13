import {AMMUNITION_TYPES,ammunitionByType,totalReserveAmmunition,addAmmunition} from '../game/ammunition-types.js';
import {syncCarriedAmmunition} from '../game/campaign-ammunition.js';
import {initializeUnitAmmunition} from '../game/tactical-ammunition.js';
import {stockAmmo} from './ammunition-balance.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {createBattle,actBattle,carriedWeight} from '../game/tactical.js';
import {equipmentFingerprint,inventoryUsage,extractItemQuantity,applyItemQuantity} from '../game/tactical-inventory.js';
import {sectorInventoryModel,knownSectorEquipment} from '../game/sector-inventory.js';
import {planEquipmentPickup,planEquipmentCursorReturn} from '../game/equipment-cursor.js';
import {validateEquipmentOwnership} from '../game/equipment.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {playerKnownBattle,playerKnownCampaign} from '../game/player-known-state.js';
import {planReturnAmmunition,storedWeaponAmmunition} from '../game/ammunition.js';
import {prepareDeploymentExits} from '../game/deployment-return.js';

const order=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null,next.lastError);return next;};
const act=(b,a)=>{const next=actBattle(b,a);assert.equal(next.lastError,null,next.lastError);return next;};
const fresh=()=>order(initialCampaign(8),{type:'recruitCivic',id:110,term:'week'});
const personal=(s,id=110)=>sectorInventoryModel(s,'retiro',rosterFor(s),id).personal;
const actor=b=>b.units.find(u=>u.id==='110');
const pocket=(u,item)=>inventoryUsage(u).slots.find(p=>p.entry?.item===item).id;
function cursorAction(u,type,options={}){return {type,unitId:u.id,expectedSource:equipmentFingerprint(u,type==='pickupEquipment'||type==='dragEquipment'?options.sourceId:'cursor'),...(options.destinationId?{expectedDestination:equipmentFingerprint(u,options.destinationId)}:{}),...options};}
function arrange(s,type,options={},id=110){const u=personal(s,id);return order(s,{...cursorAction(u,type,options),type:'sectorInventory',sector:'retiro',operativeId:id,direction:'arrange',kind:'cursor',cursorAction:type});}
const save=s=>decodeSave(encodeSave(s)).campaign;
function visit(s){s=order(s,{type:'visitSector'});const r=s.pendingBattle;return {s,b:createBattle(r.squad.map((u,i)=>({...u,x:2,y:2+i})),{...r,width:12,height:10,tiles:Array.from({length:120},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',cover:0,blocked:false})),enemies:[],props:[],npcs:[]})};}
const leave=(s,b)=>order(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});
const reject=(s,a)=>{const before=structuredClone(s),next=dispatchCampaign(s,a);assert.ok(next.lastError);assert.deepEqual(s,before);assert.deepEqual({...next,lastError:null},{...s,lastError:null});};
const cartridges=s=>stockAmmo(s)+Object.values(s.operativeState).filter(r=>r.alive&&!r.captured).reduce((sum,r)=>sum+(r.carriedAmmo??0)+storedWeaponAmmunition([r]),0);

test('a paid recruit physically picks a finite stack; free campaign save and cancellation restore it once',()=>{
 let s=fresh();const before=structuredClone(s),u=personal(s),sourceId=pocket(u,'medkits'),weight=carriedWeight(u);
 s=arrange(s,'pickupEquipment',{sourceId,count:1});assert.equal(s.operativeState[110].medkits,1);assert.equal(s.operativeState[110].equipmentCursor.stack.count,1);assert.equal(s.operativeState[110].equipmentCursor.sourceId,sourceId);assert.equal(carriedWeight(personal(s)),weight);
 assert.equal(playerKnownCampaign(s).operatives.find(u=>u.id===110).equipmentCursor.stack.count,1);
 s=arrange(save(s),'returnEquipmentCursor');assert.equal(s.operativeState[110].equipmentCursor,undefined);assert.equal(s.operativeState[110].medkits,2);
 for(const key of ['resources','hour','secondOfHour','seed','sectorStates'])assert.deepEqual(s[key],before[key],key);
 assert.deepEqual(save(s),s);
});

test('a loaded gun cursor survives live save, report, campaign save and reentry; placement removes the old campaign cursor',()=>{
 let {s,b}=visit(fresh());const u=actor(b),before=structuredClone(u),weight=carriedWeight(u);
 b=act(b,cursorAction(u,'pickupEquipment',{sourceId:'hand:right'}));assert.equal(actor(b).weaponDropped,true);assert.equal(actor(b).equipmentCursor.stack.loaded,before.loaded);assert.ok(Math.abs(carriedWeight(actor(b))-weight)<1e-9);
 const live=decodeSave(encodeSave(s,b));assert.deepEqual(actor(live.battle).equipmentCursor,actor(b).equipmentCursor);assert.equal(playerKnownBattle(b).units.find(u=>u.id==='110').equipmentCursor.stack.weapon,before.weapon);
 s=leave(live.campaign,live.battle);assert.deepEqual(s.operativeState[110].equipmentCursor,actor(b).equipmentCursor);assert.equal(s.operativeState[110].carriedLoaded,undefined);
 s=order(save(s),{type:'visitSector'});b=enterSector(s.pendingBattle,s.sectorStates.retiro);assert.equal(actor(b).equipmentCursor.stack.loaded,before.loaded);assert.equal(actor(b).weaponDropped,true);
 b=act(b,cursorAction(actor(b),'placeEquipment',{destinationId:'hand:right'}));assert.equal(actor(b).equipmentCursor,undefined);assert.equal(actor(b).loaded,before.loaded);
 assert.doesNotThrow(()=>decodeSave(encodeSave(s,b)));s=leave(s,b);assert.equal(s.operativeState[110].equipmentCursor,undefined);assert.equal(s.operativeState[110].carriedLoaded,before.loaded);save(s);
});

test('cursor cartridges remain finite through two reports and return to personal inventory only after placement',()=>{
 const total=cartridges(fresh());let {s,b}=visit(fresh());const u=actor(b);
 b=act(b,cursorAction(u,'pickupEquipment',{sourceId:pocket(u,'inventory:ammo:musket_75'),count:5}));s=leave(s,b);assert.equal(cartridges(s),total);assert.equal(s.operativeState[110].equipmentCursor.stack.count,5);
 s=order(save(s),{type:'visitSector'});assert.equal(s.pendingBattle.storedCartridges,5);b=enterSector(s.pendingBattle,s.sectorStates.retiro);
 b=act(b,cursorAction(actor(b),'returnEquipmentCursor'));assert.equal(actor(b).equipmentCursor,undefined);s=leave(s,b);assert.equal(cartridges(s),total);assert.equal(s.operativeState[110].equipmentCursor,undefined);save(s);
});

function displacedBulky(s){
 // Finite capacity fixture: each authored crate is a distinct, carried object.
 const r=s.operativeState[110];r.flints=1;r.inventory=Object.fromEntries(Array.from({length:4},(_,i)=>[`crate${i}`,{name:`Cajón ${i}`,count:1,weight:4,instanceId:`crate-${i}`} ]));
 const sourceId=pocket(personal(s),'flints');s=arrange(s,'pickupEquipment',{sourceId});s=arrange(s,'placeEquipment',{destinationId:'large-1'});
 assert.equal(s.operativeState[110].equipmentCursor.stack.instanceId,'crate-0');assert.equal(planEquipmentCursorReturn(personal(s)).dropped.instanceId,'crate-0');return s;
}
test('a displaced bulky item returns to actual cleared ground once when its original small pocket cannot hold it',()=>{
 let pair=visit(fresh()),s=displacedBulky(leave(pair.s,pair.b));const before=structuredClone(s),position=s.sectorStates.retiro.units.find(u=>u.id==='110'),payload=s.operativeState[110].equipmentCursor.stack;
 s=arrange(s,'returnEquipmentCursor');const ground=s.sectorStates.retiro.groundItems.find(g=>g.instanceId===payload.instanceId);assert.ok(ground);assert.equal(ground.x,position.x);assert.equal(ground.y,position.y);assert.equal(ground.count,1);assert.equal(ground.knownToPlayer,true);assert.equal(s.operativeState[110].equipmentCursor,undefined);
 assert.equal(s.sectorStates.retiro.units.find(u=>u.id==='110').equipmentCursor,undefined);for(const key of ['resources','hour','secondOfHour','seed'])assert.deepEqual(s[key],before[key]);
 assert.equal(knownSectorEquipment(s.sectorStates.retiro).filter(g=>g.key===`ground:${ground.id}`).length,1);save(s);
});

test('missing or full ground storage rejects cancellation atomically and keeps the displaced item',()=>{
 for(const full of [false,true]){
  let s=fresh();if(full){const p=visit(s);s=leave(p.s,p.b);}s=displacedBulky(s);
  if(full)s.sectorStates.retiro.groundItems=Array.from({length:2000},(_,i)=>({id:`full-${i}`,type:'item',item:'flints',count:1,weight:.05,x:1,y:1,knownToPlayer:true}));
  const action={...cursorAction(personal(s),'returnEquipmentCursor'),type:'sectorInventory',sector:'retiro',operativeId:110,direction:'arrange',kind:'cursor',cursorAction:'returnEquipmentCursor'};
  reject(s,action);assert.equal(s.operativeState[110].equipmentCursor.stack.instanceId,'crate-0');
 }
});

test('save admission rejects malformed cursor payloads and identities duplicated with other finite owners',()=>{
 let s=fresh();s.operativeState[110].weaponInstanceId='owned-rifle';s=arrange(s,'pickupEquipment',{sourceId:'hand:right'});
 for(const change of [r=>r.equipmentCursor=null,r=>r.equipmentCursor.sourceId='missing',r=>r.equipmentCursor.stack.count=2,r=>r.equipmentCursor.stack.loaded=2,r=>r.equipmentCursor.stack.item='cursor',r=>r.inventory.duplicate={...r.equipmentCursor.stack}]){
  const bad=structuredClone(s);change(bad.operativeState[110]);assert.throws(()=>restoreCampaign(serializeCampaign(bad)),String(change));
 }
 const duplicate=structuredClone(s);duplicate.armoryItems.push({id:'armory-1',item:1800,condition:100,jammed:false,instanceId:'owned-rifle'});duplicate.armory[1800]=1;duplicate.nextArmoryItemId=2;assert.throws(()=>validateEquipmentOwnership(duplicate,rosterFor(duplicate)),/identidad/);
 const pair=visit(s),bad=structuredClone(pair.b);bad.groundItems.push({...actor(bad).equipmentCursor.stack,id:'duplicate',type:'item',x:1,y:1,knownToPlayer:true});assert.throws(()=>validateBattleSnapshot(bad),/identidad/);assert.throws(()=>decodeSave(encodeSave(pair.s,bad)),/identidad/);
});

test('only the current tactical cursor is exposed; hidden enemy custody and item identities remain private',()=>{
 let {s,b}=visit(fresh());actor(b).weaponInstanceId='private-rifle';b=act(b,cursorAction(actor(b),'pickupEquipment',{sourceId:'hand:right'}));
 const publicUnit=playerKnownBattle(b).units.find(u=>u.id==='110');assert.equal(publicUnit.equipmentCursor.stack.instanceId,undefined);assert.equal(publicUnit.equipmentCursor.stack.weapon,1800);
 const unknown=createBattle([{id:'p',x:1,y:1}],{width:12,height:10,tiles:b.tiles,exploration:true,enemies:[{id:'hidden',x:10,y:8,weapon:1800}]});const enemy=unknown.units[1];Object.assign(enemy,planEquipmentPickup(enemy,{sourceId:'hand:right',expectedSource:equipmentFingerprint(enemy,'hand:right')}).unit);
 assert.ok(!JSON.stringify(playerKnownBattle(unknown)).includes('equipmentCursor'));
});

test('unavailable body cursor remains lootable and its rounds receive one finite recovery allowance',()=>{
 let {s,b}=visit(fresh());const u=actor(b),picked=planEquipmentPickup(u,{sourceId:pocket(u,'inventory:ammo:musket_75'),expectedSource:equipmentFingerprint(u,pocket(u,'inventory:ammo:musket_75')),count:5}).unit;
 const body={...picked,id:'fallen',hp:0,unconscious:true,knownToPlayer:true};b.units.push(body);const row=knownSectorEquipment(b).find(r=>r.key===JSON.stringify(['body','fallen','cursor']));assert.equal(row.count,5);
 const request=structuredClone(s.pendingBattle);request.id='next';prepareDeploymentExits({...s,sectorStates:{retiro:b}},request);assert.equal(request.casualtyLootSources.find(u=>u.id==='fallen').ammunitionByType.musket_75,10);
 const extraction=extractItemQuantity(body,'cursor',5);Object.assign(body,extraction.unit);delete body.equipmentCursor;
 const receiver=applyItemQuantity(u,extraction.stack);b.units[0]=receiver;const plan=planReturnAmmunition(request,b,[{unitId:'110',kind:'resident'}]);assert.equal(plan.creditedCartridges,0);assert.deepEqual(plan.retainedAmmunition,{musket_75:15});
});

test('two hands holding two ordinary cartridges retain both after a deployment report',()=>{
 let {s,b}=visit(fresh());const original=cartridges(fresh());
 for(const destinationId of ['hand:right','hand:left']){const u=actor(b);b=act(b,cursorAction(u,'pickupEquipment',{sourceId:pocket(u,'inventory:ammo:musket_75'),count:1}));b=act(b,cursorAction(actor(b),'placeEquipment',{destinationId}));if(actor(b).equipmentCursor)b=act(b,cursorAction(actor(b),'returnEquipmentCursor'));}
 s=leave(s,b);assert.equal(s.operativeState[110].carriedAmmo,9);assert.equal(s.operativeState[110].activeItem,'inventory:ammo:musket_75');assert.equal(s.operativeState[110].leftHandItem,'inventory:ammo:musket_75');assert.equal(cartridges(s),original);save(s);
});

test('an identified fitted rifle keeps its separate bayonet, wear and unfinished reload while cursor-owned',()=>{
 let s=fresh();Object.assign(s.operativeState[110],{carriedAmmo:3,carriedLoaded:0,carriedReloadProgress:.5,condition:61,weaponInstanceId:'cursor-rifle',weaponFittings:{bayonet:{weapon:1811,fittingPattern:'india_socket',condition:73,instanceId:'cursor-bayonet'}}});
 addAmmunition(s.operativeState[110],'musket_75',3);syncCarriedAmmunition(s.operativeState[110],1800);
 const before=structuredClone(s.operativeState[110]),weight=carriedWeight(personal(s));s=arrange(s,'pickupEquipment',{sourceId:'hand:right'});const cursor=s.operativeState[110].equipmentCursor;
 assert.equal(cursor.stack.instanceId,'cursor-rifle');assert.equal(cursor.stack.fittings.bayonet.instanceId,'cursor-bayonet');assert.equal(cursor.stack.reloadProgress,.5);assert.equal(carriedWeight(personal(s)),weight);
 const duplicate=structuredClone(s);duplicate.operativeState[110].inventory.copy={weapon:1811,count:1,weight:.5,loaded:0,condition:73,instanceId:'cursor-bayonet',fittingPattern:'india_socket'};assert.throws(()=>decodeSave(encodeSave(duplicate)),/identidad/);
 s=arrange(save(s),'placeEquipment',{destinationId:'hand:right'});for(const key of ['carriedAmmo','carriedLoaded','carriedReloadProgress','condition','weaponInstanceId','weaponFittings'])assert.deepEqual(s.operativeState[110][key],before[key],key);save(s);
});

test('a dismissed cursor owner retains property without duplicating it on a later paid contract',()=>{
 let s=fresh();s.operativeState[110].weaponInstanceId='departed-rifle';s=arrange(s,'pickupEquipment',{sourceId:'hand:right'});const payload=structuredClone(s.operativeState[110].equipmentCursor);
 s=order(s,{type:'dismiss',id:110});assert.ok(!s.recruited.includes(110));s=save(s);assert.deepEqual(s.operativeState[110].equipmentCursor,payload);
 const before=s.resources.treasury;s=order(s,{type:'recruitCivic',id:110,term:'week'});assert.ok(s.resources.treasury<before);assert.deepEqual(s.operativeState[110].equipmentCursor,payload);s=arrange(s,'returnEquipmentCursor');assert.equal(s.operativeState[110].equipmentCursor,undefined);assert.equal(s.operativeState[110].weaponInstanceId,'departed-rifle');save(s);
});

test('a known fallen soldier cursor can be collected through the strategic pool after its real return report',()=>{
 let s=order(fresh(),{type:'recruitCivic',id:111,term:'week'});s.operativeState[110].weaponInstanceId='fallen-cursor-rifle';let b;({s,b}=visit(s));
 b=act(b,cursorAction(actor(b),'pickupEquipment',{sourceId:'hand:right'}));
 // A casualty snapshot exercises return custody without selecting a combat RNG outcome.
 Object.assign(actor(b),{hp:0,unconscious:false,bandaged:0,knownToPlayer:true});validateBattleSnapshot(b);s=leave(s,b);assert.equal(s.operativeState[110].alive,false);
 const row=sectorInventoryModel(s,'retiro',rosterFor(s),111).entries.find(r=>r.key===JSON.stringify(['body','110','cursor']));assert.ok(row?.reachable);assert.equal(JSON.parse(row.expected).instanceId,'fallen-cursor-rifle');
 s=order(s,{type:'sectorInventory',sector:'retiro',operativeId:111,direction:'take',sourceKey:row.key,expected:row.expected,count:1});assert.equal(s.sectorStates.retiro.units.find(u=>u.id==='110').equipmentCursor,undefined);assert.ok(Object.values(s.operativeState[111].inventory).some(item=>item.instanceId==='fallen-cursor-rifle'));
 s=save(s);assert.doesNotThrow(()=>validateEquipmentOwnership(s,rosterFor(s)));
 reject(s,{type:'sectorInventory',sector:'retiro',operativeId:111,direction:'take',sourceKey:row.key,expected:row.expected,count:1});
});

test('admitted weapon extensions survive pocket, cursor, hand, save, report and deployment without entering public private fields',()=>{
 let s=fresh();s.operativeState[110].inventory={heirloom:{weapon:1805,count:1,weight:2.2,condition:54,loaded:1,jammed:true,name:'Pistola heredada',proof:{mark:'private-proof'}}};
 const sourceId=pocket(personal(s),'inventory:heirloom');s=arrange(s,'pickupEquipment',{sourceId});s=arrange(s,'placeEquipment',{destinationId:'hand:right'});s=arrange(s,'returnEquipmentCursor');
 assert.equal(s.operativeState[110].weaponMetadata.name,'Pistola heredada');assert.deepEqual(s.operativeState[110].weaponMetadata.proof,{mark:'private-proof'});
 const publicRecord=playerKnownCampaign(s).operatives.find(u=>u.id===110);assert.equal(publicRecord.weaponMetadata.name,'Pistola heredada');assert.equal(publicRecord.weaponMetadata.proof,undefined);
 let b;({s,b}=visit(save(s)));assert.equal(actor(b).weaponMetadata.weight,2.2);const before=structuredClone(actor(b).weaponMetadata);
 b=act(b,cursorAction(actor(b),'pickupEquipment',{sourceId:'hand:right'}));assert.equal(actor(b).weaponMetadata,undefined);assert.equal(actor(b).equipmentCursor.stack.name,'Pistola heredada');assert.deepEqual(actor(b).equipmentCursor.stack.proof,{mark:'private-proof'});
 const restored=decodeSave(encodeSave(s,b));b=act(restored.battle,cursorAction(actor(restored.battle),'returnEquipmentCursor'));s=leave(restored.campaign,b);assert.deepEqual(s.operativeState[110].weaponMetadata,before);save(s);
 const bad=structuredClone(s);bad.operativeState[110].weaponMetadata.loaded=1;assert.throws(()=>save(bad));
});


test('campaign and tactical saves reject explicit null hand metadata or weight while missing fields remain valid',()=>{
 const base=fresh(),pair=visit(base);
 assert.doesNotThrow(()=>save(base));assert.doesNotThrow(()=>decodeSave(encodeSave(pair.s,pair.b)));
 for(const key of ['weaponMetadata','bladeMetadata'])for(const value of [null,{weight:null}]){
  const badCampaign=structuredClone(base);badCampaign.operativeState[110][key]=value;
  assert.throws(()=>save(badCampaign),`${key} ${JSON.stringify(value)} in campaign`);
  const badBattle=structuredClone(pair.b);actor(badBattle)[key]=value;
  assert.throws(()=>validateBattleSnapshot(badBattle),`${key} ${JSON.stringify(value)} in tactical admission`);
  assert.throws(()=>decodeSave(encodeSave(pair.s,badBattle)),`${key} ${JSON.stringify(value)} in live save`);
 }
});
