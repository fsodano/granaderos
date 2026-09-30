import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign as createCampaign,dispatchCampaign,rosterFor,serializeCampaign,restoreCampaign} from '../game/campaign.js';
import {AMMUNITION_TYPES,ammunitionByType,availableAmmunition,totalReserveAmmunition,addAmmunition} from '../game/ammunition-types.js';
import {AMMUNITION_RESOURCE_KEYS,ammoResourceKey,unitAmmunitionByType,fieldAmmunitionByType,migrateBattleAmmunition,syncCarriedAmmunition} from '../game/campaign-ammunition.js';
import {prepareCampaignAmmunition,ammunitionShopCapacity} from '../game/campaign-ammunition.js';
import {AMMO_KEYS} from '../game/ammo-types.js';
import {DEFAULT_AMMUNITION_MARKET} from '../game/ammunition-market-rules.js';
import {defaultContentPackage} from '../game/content-package.js';
import {advanceCampaignHours} from './campaign-wait-fixture.mjs';
import {woundedGarrison} from './militia-care-fixture.mjs';
import {createBattle,actBattle} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {planReturnAmmunition} from '../game/ammunition.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {prepareGarrison} from '../game/garrison.js';

const content=()=>{const d=defaultContentPackage();d.rules.startingTreasury=9000;for(const id of [110,114])d.characters.find(c=>c.id===`person-${id}`).arrivalHours=0;return d;};
const initialCampaign=(seed=8,d=content())=>createCampaign(seed,d);
const purchase=(s,family,quantity,direction='buy')=>order(s,{type:'ammunition',operativeId:110,family,quantity,direction});
const stock=s=>structuredClone(s.ammunitionStores);
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,`${a.type}: ${n.lastError}`);return n;};
const save=s=>decodeSave(encodeSave(s)).campaign;
const hire=(s,id=110)=>order(s,{type:'recruitCivic',id,term:'week'});
const reject=(s,a)=>{const before=structuredClone(s),n=dispatchCampaign(s,a);assert.ok(n.lastError);assert.deepEqual(s,before);assert.deepEqual({...n,lastError:null},{...s,lastError:null});};
const leave=(s,b)=>{const synced=syncBattleTime(s,b);assert.equal(synced.error,null);return order(synced.campaign,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:synced.battle,survivors:synced.battle.units.filter(u=>u.side==='player')});};
const flat=s=>createBattle(s.pendingBattle.squad.map((u,i)=>({...u,x:2+i,y:2})),{...s.pendingBattle,width:12,height:10,tiles:Array.from({length:120},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0})),enemies:[],npcs:s.pendingBattle.npcs.map((npc,i)=>({...npc,x:10-i,y:8})),props:[]});

test('fresh campaigns keep treasury separate from finite merchant and personal ammunition',()=>{
 const s=initialCampaign();assert.deepEqual(Object.keys(s.resources),['treasury']);assert.deepEqual(s.ammunitionStores,{});assert.deepEqual(s.ammunitionShops,{});
 assert.deepEqual(AMMO_KEYS.map(key=>ammunitionShopCapacity(key,s,'retiro')),[180,60,180,120]);
 assert.ok(Object.values(s.operativeState).every(r=>r.ammunitionVersion===2&&r.carriedAmmo===0&&!Object.keys(ammunitionByType(r)).length));assert.equal(s.recruited.length,0);assert.deepEqual(save(s),s);
});

test('purchases debit exact funds and a finite merchant family; real supplied time replenishes it',()=>{
 let s=hire(initialCampaign());const cash=s.resources.treasury,clock=[s.hour,s.secondOfHour];
 s=purchase(s,'ammoRifle',60);assert.equal(s.resources.treasury,cash-60);assert.equal(s.ammunitionShops.retiro.stock.ammoRifle,0);assert.deepEqual(ammunitionByType(s.operativeState[110]),{rifle_62:60});assert.deepEqual([s.hour,s.secondOfHour],clock);assert.deepEqual(save(s),s);
 for(const patch of [{family:'ammoRifle',quantity:1},{family:'universal',quantity:1},{quantity:-1},{quantity:1.5},{quantity:61}])reject(s,{type:'ammunition',operativeId:110,family:'ammoPistol',quantity:1,direction:'buy',...patch});
 const poor={...s,resources:{treasury:0}};reject(poor,{type:'ammunition',operativeId:110,family:'ammoPistol',quantity:1,direction:'buy'});
 const pending=order(s,{type:'visitSector'});reject(pending,{type:'ammunition',operativeId:110,family:'ammoPistol',quantity:1,direction:'buy'});
 s=advanceCampaignHours(s,23);assert.equal(s.ammunitionShops.retiro.stock.ammoRifle,0);s=advanceCampaignHours(save(s),1);assert.equal(s.ammunitionShops.retiro.stock.ammoRifle,6);assert.equal(s.ammunitionShops.retiro.stock.ammoMusket,180);
});

test('retired material production cannot add ammunition or revive a global reserve',()=>{
 const s=hire(initialCampaign());for(const key of Object.values(AMMUNITION_RESOURCE_KEYS))reject(s,{type:'produce',recipe:key});
 for(const key of Object.values(AMMUNITION_RESOURCE_KEYS)){const old=structuredClone(s);old.resources[key]=1;assert.throws(()=>restoreCampaign(serializeCampaign(old)),/nueva campaña|economía|reserva/);}
 assert.deepEqual(Object.keys(s.resources),['treasury']);assert.deepEqual(save(s),s);
});

test('paid physical family stores remain at their own sector during saved travel',()=>{
 let s=hire(initialCampaign());s=purchase(s,'ammoPistol',7);s=purchase(s,'ammoRifle',3);const cash=s.resources.treasury;
 s=purchase(s,'ammoPistol',7,'store');s=purchase(s,'ammoRifle',3,'store');assert.deepEqual(stock(s),{retiro:{ammoPistol:7,ammoRifle:3}});assert.equal(s.resources.treasury,cash);
 s=order(save(s),{type:'travel',sector:'cell-27-27'});const stores=stock(s);reject(s,{type:'ammunition',operativeId:110,family:'ammoPistol',quantity:1,direction:'take'});assert.deepEqual(stock(s),stores);
 s=order(save(s),{type:'travel',sector:'retiro'});s=purchase(s,'ammoPistol',4,'take');assert.deepEqual(stock(s),{retiro:{ammoPistol:3,ammoRifle:3}});assert.equal(ammunitionByType(s.operativeState[110]).pistol_69,4);assert.deepEqual(save(s),s);
});

test('a paid hire retains typed rounds across deployment, report, weapon swap, reload and reentry',()=>{
 let s=order(hire(initialCampaign()),{type:'visitSector'}),b=flat(s);assert.deepEqual(unitAmmunitionByType(b.units.find(u=>u.id==='110')),{musket_75:10});assert.equal(s.ammunitionShops.retiro.stock.ammoMusket,170);
 ({campaign:s,battle:b}=decodeSave(encodeSave(s,b)));s=leave(s,b);assert.deepEqual(ammunitionByType(s.operativeState[110]),{musket_75:9});
 s=order(s,{type:'purchaseEquipment',item:'firearm-1805'});s=order(s,{type:'equip',operativeId:110,itemId:'firearm-1805',slot:'weapon'});const stored=s.armoryItems.find(i=>i.item===1800);assert.equal(stored.loaded,1);
 s=order(save(s),{type:'visitSector'});b=flat(s);const u=b.units.find(u=>u.id==='110');assert.equal(u.weapon,1805);assert.equal(u.loaded,0);assert.deepEqual(ammunitionByType(u),{musket_75:9,pistol_69:10});assert.equal(s.ammunitionShops.retiro.stock.ammoMusket,170);assert.equal(s.ammunitionShops.retiro.stock.ammoPistol,170);
 b=actBattle(b,{type:'reload',unitId:'110'});assert.equal(b.lastError,null);assert.equal(b.units[0].loaded,1);s=leave(s,b);const shops=structuredClone(s.ammunitionShops),cash=s.resources.treasury;s=order(save(s),{type:'visitSector'});assert.deepEqual(ammunitionByType(s.pendingBattle.squad[0]),{musket_75:9,pistol_69:9});assert.deepEqual(s.ammunitionShops,shops);assert.equal(s.resources.treasury,cash);assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);
});

test('finite in-sector transfers can retain more than ten compatible rounds through pending saves',()=>{
 let s=hire(hire(initialCampaign(8)),114);s=order(s,{type:'visitSector'});let b=flat(s);const totalBefore=b.units.filter(u=>u.side==='player').reduce((n,u)=>n+availableAmmunition(u),0);
 b=actBattle(b,{type:'transfer',unitId:'114',targetId:'110',item:'inventory:ammo:musket_75',count:4});assert.equal(b.lastError,null);assert.equal(availableAmmunition(b.units.find(u=>u.id==='110')),13);assert.equal(b.units.filter(u=>u.side==='player').reduce((n,u)=>n+availableAmmunition(u),0),totalBefore);
 s=leave(s,b);const stockBefore=s.ammunitionShops.retiro.stock.ammoMusket,cash=s.resources.treasury;s=order(save(s),{type:'visitSector'});assert.equal(s.pendingBattle.squad.find(u=>u.id===110).ammo,13);assert.equal(s.ammunitionShops.retiro.stock.ammoMusket,stockBefore-4,'only the donor buys its four missing rounds');assert.equal(s.resources.treasury,cash-4);assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);
});

test('initial issuance buys only matching finite supplier rounds and respects full pockets',()=>{
 const d=content();d.ammunitionMarket={defaults:structuredClone(DEFAULT_AMMUNITION_MARKET),locations:{}};d.ammunitionMarket.defaults.families.ammoMusket.initial=2;
 const s=hire(initialCampaign(8,d));s.ammunitionStores.retiro={ammoMusket:3,ammoPistol:7};const stores=stock(s),cash=s.resources.treasury,pistol=s.ammunitionShops.retiro.stock.ammoPistol;
 const issue=prepareCampaignAmmunition(s,rosterFor(s),[110],{supplied:true,commit:true});assert.equal(issue.cost,2);assert.deepEqual(unitAmmunitionByType({...rosterFor(s).find(o=>o.id===110),...issue.allocation[110]}),{musket_75:2});assert.equal(s.resources.treasury,cash-2);assert.equal(s.ammunitionShops.retiro.stock.ammoMusket,0);assert.equal(s.ammunitionShops.retiro.stock.ammoPistol,pistol);assert.deepEqual(stock(s),stores);
 const full=hire(initialCampaign());full.operativeState[110].inventory=Object.fromEntries(Array.from({length:12},(_,i)=>[`ballast${i}`,{count:1,weight:4}]));const before=full.resources.treasury,none=prepareCampaignAmmunition(full,rosterFor(full),[110],{supplied:true,commit:true});assert.equal(none.allocation[110].loaded,1);assert.equal(none.allocation[110].ammo,0);assert.equal(none.cost,1);assert.equal(full.resources.treasury,before-1);assert.equal(full.ammunitionShops.retiro.stock.ammoMusket,179);
});

test('paid militia retain the actual weapon family and never draw repeated merchant or personal issues',()=>{
 const {campaign:s}=woundedGarrison(),before=structuredClone(s.garrisons.retiro),shops=structuredClone(s.ammunitionShops),cash=s.resources.treasury,stores=stock(s);
 assert.equal(before.length,3);assert.deepEqual(before.map(unitAmmunitionByType),[{shot_16:6},{shot_16:6},{shot_16:6}]);
 for(let i=0;i<3;i++){const units=prepareGarrison(s,'retiro');assert.deepEqual(units,before);assert.deepEqual(s.ammunitionShops,shops);assert.deepEqual(stock(s),stores);assert.equal(s.resources.treasury,cash);assert.deepEqual(save(s),s);}
});

test('return receipts reject an equal-count type conversion and retain captive custody without stock credit',()=>{
 const original={id:110,side:'player',weapon:1800,loaded:1,ammunitionVersion:2,inventory:{}};addAmmunition(original,'musket_75',9);
 const request={squad:[original],fieldAmmunition:{},enemies:[]},unit={...structuredClone(original),id:'110'},snapshot={units:[unit],groundItems:[]};
 const entry={unitId:'110',kind:'captured'},plan=planReturnAmmunition(request,snapshot,[entry]);assert.equal(plan.creditedCartridges,0);assert.deepEqual(plan.creditedAmmunition,{});assert.deepEqual(plan.custody['110'],{loaded:1,ammo:9,preserveLoading:true});assert.deepEqual(plan.retainedAmmunition,{musket_75:10});
 unit.inventory={};addAmmunition(unit,'pistol_69',9);assert.throws(()=>planReturnAmmunition(request,snapshot,[entry]),/más munición de ese tipo/);
});

function unmarkCampaign(s){delete s.ammunitionVersion;for(const r of Object.values(s.operativeState)){delete r.ammunitionVersion;delete r.carriedAmmo;}for(const key of Object.values(AMMUNITION_RESOURCE_KEYS))if(key!=='cartridges')delete s.resources[key];for(const m of Object.values(s.merchants))delete m.ammunition;return s;}
test('legacy loose rounds migrate once to .75 while a different gun keeps its own loaded charge',()=>{
 const d=content();d.characters.find(c=>c.id==='person-110').weapon='firearm-1802';const old=unmarkCampaign(hire(initialCampaign(8,d)));Object.assign(old.operativeState[110],{carriedLoaded:1,carriedAmmo:8,carriedReloadProgress:undefined});
 const s=restoreCampaign(JSON.stringify(old));assert.deepEqual(ammunitionByType(s.operativeState[110]),{musket_75:7});assert.equal(s.operativeState[110].carriedLoaded,1);assert.equal(availableAmmunition({...s.operativeState[110],weapon:1802}),0);assert.equal(s.resources.cartridges,undefined);assert.deepEqual(stock(s),{});assert.match(s.log[0].text,/munición antigua/);assert.deepEqual(save(s),s);
 const twice=restoreCampaign(serializeCampaign(s));assert.deepEqual(twice,s);assert.equal(twice.log.filter(e=>/munición antigua/.test(e.text)).length,1);
});

test('legacy world stacks retain custom metadata and exhausted zero-count ground records',()=>{
 const b=createBattle([{id:'p',weapon:1802,ammo:0,inventory:{},x:1,y:1}],{width:4,height:4,exploration:true,enemies:[]});delete b.ammunitionVersion;delete b.units[0].ammunitionVersion;b.units[0].ammo=7;b.units[0].loaded=1;
 b.groundItems=[{id:'old-empty',type:'item',item:'ammo',name:'Lote retirado',count:0,weight:.04,x:1,y:1},{id:'old-lot',type:'item',item:'ammo',name:'Lote de San Carlos',proof:{seal:8},count:3,weight:.04,x:1,y:1}];
 const migrated=validateBattleSnapshot(b);assert.deepEqual(ammunitionByType(migrated.units[0]),{musket_75:7});assert.equal(migrated.units[0].loaded,1);assert.equal(migrated.units[0].ammo,0);assert.equal(migrated.groundItems[0].count,0);assert.equal(migrated.groundItems[1].name,'Lote de San Carlos');assert.deepEqual(migrated.groundItems[1].proof,{seal:8});assert.deepEqual(fieldAmmunitionByType(migrated),{musket_75:3});
 for(const patch of [{kind:'ammunition',ammoType:'pistol_69'},{ammoType:'pistol_69'},{weight:0}]){const bad=structuredClone(b);Object.assign(bad.groundItems[1],patch);assert.throws(()=>migrateBattleAmmunition(bad));}
});

test('canonical saves cannot restore loose scalar funding or omit a unit or source version',()=>{
 let s=order(hire(initialCampaign()),{type:'visitSector'});const b=enterSector(s.pendingBattle,s.sectorStates.retiro);
 for(const mutate of [bad=>delete bad.pendingBattle.squad[0].ammunitionVersion,bad=>delete bad.operativeState[110].ammunitionVersion,bad=>bad.pendingBattle.squad[0].ammo=900,bad=>bad.pendingBattle.fieldAmmunition={universal:1},bad=>delete bad.ammunitionStores,bad=>bad.resources.cartridges=1]){const bad=structuredClone(s);mutate(bad);assert.throws(()=>restoreCampaign(serializeCampaign(bad)));}
 const downgraded=structuredClone(s);delete downgraded.ammunitionVersion;delete downgraded.operativeState[110].ammunitionVersion;delete downgraded.operativeState[110].inventory;assert.throws(()=>restoreCampaign(serializeCampaign(downgraded)),/mezcla/);
 const bad=structuredClone(b);delete bad.units[0].ammunitionVersion;assert.throws(()=>validateBattleSnapshot(bad));const mixed=structuredClone(b);delete mixed.ammunitionVersion;assert.throws(()=>validateBattleSnapshot(mixed),/mezcla/);assert.deepEqual(decodeSave(encodeSave(s,b)).campaign,s);
});


test('a retained corpse consumes its own issue allowance and cannot also fund a survivor',()=>{
 const source=createBattle([{id:'p',weapon:1800,loaded:0,ammo:10},{id:'q',weapon:1800,loaded:0,ammo:10}],{enemies:[]});
 const request={squad:structuredClone(source.units),fieldAmmunition:{},enemies:[]},snapshot=structuredClone(source);snapshot.units[1].hp=0;
 const entries=[{unitId:'p',kind:'resident'},{unitId:'q',kind:'dead'}];assert.deepEqual(planReturnAmmunition(request,snapshot,entries).retainedAmmunition,{musket_75:20});
 addAmmunition(snapshot.units[0],'musket_75',10);assert.throws(()=>planReturnAmmunition(request,snapshot,entries),/más munición de ese tipo/);
});


test('ground and source growth cannot duplicate carried ammunition, including a different absent type',()=>{
 const source=createBattle([{id:'p',weapon:1800,loaded:0,ammo:10}],{enemies:[{id:'e',weapon:1801,loaded:1,ammo:3}]});
 const request={squad:[structuredClone(source.units[0])],fieldAmmunition:{},enemies:[structuredClone(source.units[1])]},entries=[{unitId:'p',kind:'resident'}];
 for(const type of ['musket_75','pistol_69']){const snapshot=structuredClone(source);snapshot.groundItems.push({item:`inventory:ammo:${type}`,kind:'ammunition',ammoType:type,name:AMMUNITION_TYPES[type].name,count:1,weight:.04});assert.throws(()=>planReturnAmmunition(request,snapshot,entries),/más munición de ese tipo/);}
 const snapshot=structuredClone(source);addAmmunition(snapshot.units[1],'pistol_69',1);assert.throws(()=>planReturnAmmunition(request,snapshot,entries),/más munición de ese tipo/);
});


test('a complete legacy active save migrates both receipts once and preserves loaded gun custody on return',()=>{
 const d=content();d.characters.find(c=>c.id==='person-110').weapon='firearm-1805';let s=order(hire(initialCampaign(8,d)),{type:'visitSector'}),b=flat(s);assert.equal(b.units[0].loaded,1);
 // This explicit prior-format fixture contains untyped scalar loose stock in
 // both historical request and live battle mirrors, never two physical grants.
 const untype=u=>{u.ammo=totalReserveAmmunition(u);u.inventory=Object.fromEntries(Object.entries(u.inventory??{}).filter(([,r])=>r.kind!=='ammunition'));delete u.ammunitionVersion;};
 unmarkCampaign(s);for(const r of Object.values(s.operativeState)){r.carriedAmmo=totalReserveAmmunition(r)+(r.carriedLoaded??0);untype(r);}delete s.pendingBattle.ammunitionVersion;delete s.pendingBattle.issuedAmmunition;delete s.pendingBattle.fieldAmmunition;for(const u of s.pendingBattle.squad)untype(u);delete b.ammunitionVersion;for(const u of b.units)untype(u);
 ({campaign:s,battle:b}=decodeSave(encodeSave(s,b)));assert.deepEqual(ammunitionByType(b.units[0]),{musket_75:9});assert.equal(b.units[0].loaded,1);assert.equal(b.units[0].ammo,0);assert.deepEqual(s.pendingBattle.issuedAmmunition,{musket_75:9,pistol_69:1});assert.deepEqual(decodeSave(encodeSave(s,b)).battle,b);
 const before=stock(s);s=leave(s,b);assert.deepEqual(stock(s),before);assert.deepEqual(ammunitionByType(s.operativeState[110]),{musket_75:9});assert.equal(s.operativeState[110].carriedLoaded,1);assert.deepEqual(save(s),s);
});


test('canonical ground, containers, NPC gifts, and personal stacks cannot restore the old universal alias',()=>{
 const original=createBattle([{id:'p',weapon:1800,ammo:0}],{width:4,height:4,exploration:true,enemies:[]}),old={item:'ammo',count:1,weight:.04};
 const injectors=[b=>b.groundItems=[{...old,id:'old',type:'item',x:1,y:1}],b=>b.props=[{id:'chest',contents:[{...old}]}],b=>b.tiles[0].contents=[{...old}],b=>b.npcs=[{id:'npc',contents:[{...old}]}],b=>b.npcs=[{id:'npc',questGifts:[{...old}]}],b=>b.units[0].inventory={bad:{...old}}];
 for(const inject of injectors){const b=structuredClone(original);inject(b);assert.throws(()=>migrateBattleAmmunition(b),/tipo explícito/);}
 const s=initialCampaign();s.operativeState[110].inventory={old};assert.throws(()=>restoreCampaign(serializeCampaign(s)));
 for(const inject of injectors.slice(0,5)){const b=structuredClone(original);delete b.ammunitionVersion;delete b.units[0].ammunitionVersion;inject(b);const migrated=migrateBattleAmmunition(b);assert.equal(migrated.ammunitionVersion,2);assert.ok(JSON.stringify(migrated).includes('inventory:ammo:musket_75'));}
});
