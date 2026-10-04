import {assertTradeRejected} from './commerce-gear-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeOutfit,hasPoncho} from '../game/outfits.js';
import {createBattle,actBattle,carriedWeight,maxActionPoints} from '../game/tactical.js';
import {inventoryUsage,transferItemQuantity} from '../game/tactical-inventory.js';
import {inventoryModel,nearbyLootOptions} from '../game/ja2-hud.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {validatePersonalInventory} from '../game/squads.js';
import {syncBattleTime} from '../game/time.js';
import {playerKnownBattle,playerKnownCampaign} from '../game/player-known-state.js';
const garment=(id='coat',condition=63)=>({...makeOutfit('poncho',condition),instanceId:id});
const field=(unit={},options={})=>createBattle([{id:'p',name:'Vigía',x:2,y:2,weapon:1805,loaded:1,ammo:8,...unit}],{width:20,height:8,seed:127,tiles:Array.from({length:160},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',cover:0,blocked:false})),enemies:[{id:'e',x:5,y:2,patrol:false,overwatch:false},{id:'reserve',x:18,y:6,patrol:false,overwatch:false}],...options});
const order=(b,a)=>{const n=actBattle(b,{unitId:'p',...a});assert.equal(n.lastError,null,n.lastError);return n;};
const step=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const reject=(b,a)=>{const n=actBattle(b,{unitId:'p',...a});assert.ok(n.lastError);assert.deepEqual(n.units,b.units);assert.equal(n.seed,b.seed);assert.equal(n.elapsedSeconds,b.elapsedSeconds);};
const keyFor=(unit,id)=>Object.entries(unit.inventory).find(([,r])=>r.instanceId===id)?.[0];
function campaign(){return step(initialCampaign(8),{type:'createOfficer',name:'Testigo',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});}
function visit(c){c=step(c,{type:'visitSector'});return {c,b:enterSector(c.pendingBattle,c.sectorStates.retiro)};}
function leave(c,b){c=syncBattleTime(c,b).campaign;return step(c,{type:'leaveSector',battleId:c.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});}

test('the common outfit slot is separate from hands; stowing and wearing conserve condition, identity, weight and exact AP',()=>{
 let b=field({outfit:garment(),inventory:{}}),u=b.units[0],weight=carriedWeight(u),pockets=inventoryUsage(u).used;
 const hands={weapon:u.weapon,blade:u.blade,activeSlot:u.activeSlot,loaded:u.loaded,ammo:u.ammo};
 b=order(b,{type:'equipLoot',slot:'outfit',inventoryKey:null});u=b.units[0];assert.equal(u.outfit,null);assert.equal(u.ap,92);assert.equal(carriedWeight(u),weight);assert.equal(inventoryUsage(u).used,pockets+1);
 const key=keyFor(u,'coat');assert.ok(key);assert.equal(inventoryUsage(u).slots.find(s=>s.entry?.item===`inventory:${key}`).size,'large');
 assert.equal(inventoryUsage(u).items.find(i=>i.item===`inventory:${key}`).slotSize,2);
 b=order(b,{type:'equipLoot',slot:'outfit',inventoryKey:key});u=b.units[0];assert.deepEqual(u.outfit,garment());assert.equal(u.ap,84);assert.equal(carriedWeight(u),weight);assert.equal(inventoryUsage(u).used,pockets);for(const [k,v] of Object.entries(hands))assert.equal(u[k],v);assert.doesNotThrow(()=>validateBattleSnapshot(b));
});
test('outfit exchange works with full pockets by using the vacated large slot; impossible stows and wrong slots are atomic',()=>{
 const clothes=Object.fromEntries(['a','b','c','d'].map(id=>[id,garment(id)]));const b=field({ammo:0,priming:0,flints:0,rations:0,torches:0,boleadoras:0,medkits:0,blade:0,outfit:garment('worn'),inventory:clothes});
 reject(b,{type:'equipLoot',slot:'outfit',inventoryKey:null});reject(b,{type:'equipLoot',slot:'primary',inventoryKey:'a'});
 const n=order(b,{type:'equipLoot',slot:'outfit',inventoryKey:'a'});assert.equal(n.units[0].outfit.instanceId,'a');assert.ok(keyFor(n.units[0],'worn'));assert.equal(inventoryUsage(n.units[0]).overloaded,false);
 const tired=structuredClone(b);tired.units[0].ap=7;reject(tired,{type:'equipLoot',slot:'outfit',inventoryKey:'a'});
});
test('exploration clothing changes take time without AP and climate protection follows the worn garment',()=>{
 let b=field({outfit:garment()},{exploration:true,enemies:[],weather:{rain:true,humidity:.8}});const ap=b.units[0].ap,limit=maxActionPoints(b,b.units[0]);b=order(b,{type:'equipLoot',slot:'outfit',inventoryKey:null});assert.equal(b.units[0].ap,ap);assert.ok(b.elapsedSeconds>0);assert.ok(maxActionPoints(b,b.units[0])<limit);assert.equal(hasPoncho(b.units[0]),false);
 const broken=field({outfit:garment('ruined',0)});assert.equal(hasPoncho(broken.units[0]),false);
});
test('worn clothing can be passed, dropped and recovered once with no second owner',()=>{
 const source=field({outfit:garment()}).units[0];const transfer=transferItemQuantity(source,{id:'q',weapon:0,inventory:{}},'outfit');assert.equal(transfer.source.outfit,null);assert.ok(keyFor(transfer.target,'coat'));
 let b=field({outfit:garment()});b=order(b,{type:'drop',item:'outfit'});assert.equal(b.units[0].outfit,null);const row=nearbyLootOptions(b,b.units[0]).find(r=>r.instanceId==='coat');assert.equal(row.label,'Poncho de lana');b=order(b,row.action);assert.ok(keyFor(b.units[0],'coat'));assert.equal(b.groundItems[0].count,0);assert.doesNotThrow(()=>validateBattleSnapshot(b));
 const body=field({outfit:null},{enemies:[{id:'corpse',x:3,y:2,hp:0,outfit:garment('body')},{id:'reserve',x:18,y:6,patrol:false}]});const loot=nearbyLootOptions(body,body.units[0]).find(r=>r.item==='outfit');assert.ok(loot);const n=order(body,loot.action);assert.equal(n.units.find(u=>u.id==='corpse').outfit,null);assert.ok(keyFor(n.units[0],'body'));
});
test('outfit validation rejects invented garments, mixed weapon records, invalid condition and duplicate identities',()=>{
 for(const extra of [{outfit:'constructor'},{outfit:'invented'},{weight:0},{count:2},{condition:101},{condition:-1},{loaded:0},{weapon:1800},{itemType:'tool'},{instanceId:'__proto__'}]){const b=field();b.units[0].outfit={...garment(),...extra};assert.throws(()=>validateBattleSnapshot(b));}
 const b=field({outfit:garment()});b.units[0].inventory={clone:garment()};assert.throws(()=>validateBattleSnapshot(b));assert.throws(()=>validatePersonalInventory({fake:{...garment(),fittings:{}}}));
});
test('recruits bring their own clothing while closed reserve trade preserves funds and future stock',()=>{
 let c=campaign();assert.equal(c.operativeState[1000].outfit.outfit,'poncho');c=step(c,{type:'recruitCivic',id:110,term:'day'});assert.equal(c.operativeState[110].outfit.outfit,'poncho');
 const stock=c.merchants.retiro.supplies.ponchos,money=c.resources.treasury;c=assertTradeRejected(c,{type:'sectorInventory',sector:'retiro',operativeId:1000,direction:'issueOutfit'});assert.equal(c.resources.treasury,money);assert.equal(c.merchants.retiro.supplies.ponchos,stock);assert.ok(!Object.values(c.operativeState[1000].inventory).some(record=>record.kind==='outfit'));assert.deepEqual(decodeSave(encodeSave(c)).campaign,{...c,lastError:null});
});
test('an outfit returns, saves, stows on the map and redeploys without another stock issue',()=>{
 let c=campaign();c.operativeState[1000].outfit=garment('personal',47);let v=visit(c);c=v.c;let b=v.b;assert.deepEqual(b.units.find(u=>u.id==='1000').outfit,garment('personal',47));c=leave(c,b);let m=sectorInventoryModel(c,'retiro',rosterFor(c),1000);let row=m.carried.find(r=>r.item==='outfit');assert.ok(row.equip[0].valid);
 c=step(c,{type:'sectorInventory',sector:'retiro',operativeId:1000,direction:'equip',slot:'outfit',inventoryKey:null,expected:row.expected});assert.equal(c.operativeState[1000].outfit,null);c=decodeSave(encodeSave(c,null)).campaign;
 m=sectorInventoryModel(c,'retiro',rosterFor(c),1000);row=m.carried.find(r=>r.inventoryKey===keyFor(c.operativeState[1000],'personal'));c=step(c,{type:'sectorInventory',sector:'retiro',operativeId:1000,direction:'equip',slot:'outfit',inventoryKey:row.inventoryKey,expected:row.expected});
 v=visit(c);assert.deepEqual(v.b.units.find(u=>u.id==='1000').outfit,garment('personal',47));assert.equal(v.c.merchants.retiro.supplies.ponchos,6);assert.deepEqual(decodeSave(encodeSave(v.c,v.b)).battle,v.b);
});
test('sector ground transfers retire historical clothing identities before a new owner equips the item',()=>{
 let c=campaign();c=step(c,{type:'recruitCivic',id:110,term:'day'});c.operativeState[1000].outfit=garment('transfer');let v=visit(c);c=leave(v.c,v.b);
 c=step(c,{type:'sectorInventory',sector:'retiro',operativeId:1000,direction:'drop',item:'outfit'});let m=sectorInventoryModel(c,'retiro',rosterFor(c),110),row=m.entries.find(r=>JSON.parse(r.expected).instanceId==='transfer');assert.ok(row.reachable);
 c=step(c,{type:'sectorInventory',sector:'retiro',operativeId:110,direction:'take',sourceKey:row.key,expected:row.expected});m=sectorInventoryModel(c,'retiro',rosterFor(c),110);row=m.carried.find(r=>r.inventoryKey===keyFor(c.operativeState[110],'transfer'));
 c=step(c,{type:'sectorInventory',sector:'retiro',operativeId:110,direction:'equip',slot:'outfit',inventoryKey:row.inventoryKey,expected:row.expected});assert.equal(c.operativeState[1000].outfit,null);assert.equal(c.operativeState[110].outfit.instanceId,'transfer');assert.doesNotThrow(()=>decodeSave(encodeSave(c,null)));v=visit(c);assert.equal(v.b.units.find(u=>u.id==='1000').outfit,null);assert.equal(v.b.units.find(u=>u.id==='110').outfit.instanceId,'transfer');
});
test('the public view describes owned clothing but does not reveal its internal identity or an enemy inventory',()=>{
 const b=field({outfit:garment('secret-id')});const view=playerKnownBattle(b),text=JSON.stringify(view);assert.ok(text.includes('poncho'));assert.ok(!text.includes('secret-id'));assert.deepEqual(inventoryModel(b,b.units[0]).outfit.label,'Poncho de lana');
 const c=campaign();c.operativeState[1000].outfit=garment('private-id');const known=playerKnownCampaign(c);assert.equal(known.operatives.find(u=>u.id===1000).outfit.condition,63);assert.ok(!JSON.stringify(known).includes('private-id'));
});

test('six finite discovered ponchos are collected once while every recruit retains personal clothing',()=>{
 let c=campaign();for(const id of [110,114,115,123,107,116])c=step(c,{type:'recruitCivic',id,term:'day'});
 let v=visit(c);c=leave(v.c,v.b);const money=c.resources.treasury,stock=c.merchants.retiro.supplies.ponchos;
 // Declared finite discovered property isolates normal sector collection.
 c.sectorStates.retiro.groundItems.push({...makeOutfit('poncho'),item:'inventory:outfit',id:'finite-reserve-ponchos',type:'item',count:6,x:c.sectorStates.retiro.units.find(unit=>unit.side==='player').x,y:c.sectorStates.retiro.units.find(unit=>unit.side==='player').y,knownToPlayer:true});
 for(const id of c.squad){const row=sectorInventoryModel(c,'retiro',rosterFor(c),id).entries.find(row=>row.key==='ground:finite-reserve-ponchos');assert.ok(row);c=step(c,{type:'sectorInventory',sector:'retiro',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count:1});}
 assert.equal(c.resources.treasury,money);assert.equal(c.merchants.retiro.supplies.ponchos,stock);assert.equal(c.recruited.filter(id=>c.operativeState[id].outfit).length,7);assert.equal(c.sectorStates.retiro.groundItems.find(item=>item.id==='finite-reserve-ponchos').count,0);
 const refused=dispatchCampaign(c,{type:'sectorInventory',sector:'retiro',operativeId:116,direction:'issueOutfit'});assert.match(refused.lastError,/comercio de equipo/);assert.deepEqual({...refused,lastError:null},c);
 v=visit(c);for(const u of v.b.units.filter(u=>u.side==='player'))assert.deepEqual(u.outfit,c.operativeState[u.id].outfit);assert.deepEqual(decodeSave(encodeSave(v.c,v.b)).battle,v.b);
});

test('wearing one garment from an equivalent stack consumes only one and keeps the spare in a large pocket',()=>{
 let b=field({outfit:null,inventory:{clothes:{...makeOutfit(),count:2}}});b=order(b,{type:'equipLoot',inventoryKey:'clothes',slot:'outfit'});assert.equal(b.units[0].inventory.clothes.count,1);assert.equal(b.units[0].outfit.count,1);assert.equal(inventoryUsage(b.units[0]).items.find(i=>i.item==='inventory:clothes').condition,100);
 b=order(b,{type:'equipLoot',inventoryKey:null,slot:'outfit'});assert.equal(b.units[0].outfit,null);assert.equal(Object.values(b.units[0].inventory).filter(r=>r.kind==='outfit').reduce((sum,r)=>sum+r.count,0),2);assert.equal(inventoryUsage(b.units[0]).slots.filter(s=>s.entry?.kind==='outfit').length,2);
});
