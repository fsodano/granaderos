import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor,serializeCampaign,restoreCampaign} from '../game/campaign.js';
import {AMMUNITION_TYPES,ammunitionByType,availableAmmunition,totalReserveAmmunition,addAmmunition} from '../game/ammunition-types.js';
import {AMMUNITION_RESOURCE_KEYS,ammoResourceKey,unitAmmunitionByType,fieldAmmunitionByType,migrateBattleAmmunition,syncCarriedAmmunition} from '../game/campaign-ammunition.js';
import {allocateEquipmentAmmo,advanceMerchants,AMMUNITION_PRICE,AMMUNITION_MERCHANT_CAP} from '../game/equipment.js';
import {RECIPES} from '../game/data.js';
import {createBattle,actBattle} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {planReturnAmmunition} from '../game/ammunition.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {prepareGarrison} from '../game/garrison.js';

const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,`${a.type}: ${n.lastError}`);return n;};
const save=s=>decodeSave(encodeSave(s)).campaign;
const stock=s=>Object.fromEntries(Object.entries(AMMUNITION_RESOURCE_KEYS).map(([type,key])=>[type,s.resources[key]]));
const hire=(s,id=110)=>order(s,{type:'recruitCivic',id,term:'week'});
const reject=(s,a)=>{const before=structuredClone(s),n=dispatchCampaign(s,a);assert.ok(n.lastError);assert.deepEqual(s,before);assert.deepEqual({...n,lastError:null},{...s,lastError:null});};
const leave=(s,b)=>{const synced=syncBattleTime(s,b);assert.equal(synced.error,null);return order(synced.campaign,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:synced.battle,survivors:synced.battle.units.filter(u=>u.side==='player')});};
const flat=s=>createBattle(s.pendingBattle.squad.map((u,i)=>({...u,x:2+i,y:2})),{...s.pendingBattle,width:12,height:10,tiles:Array.from({length:120},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0})),enemies:[],npcs:s.pendingBattle.npcs.map((npc,i)=>({...npc,x:10-i,y:8})),props:[]});

test('fresh stock is an explicit finite total of 300 prepared loads with no personal grant',()=>{
 const s=initialCampaign();assert.deepEqual(Object.values(stock(s)),[180,30,50,40]);assert.equal(Object.values(stock(s)).reduce((a,b)=>a+b),300);
 assert.ok(Object.values(s.operativeState).every(r=>r.ammunitionVersion===2&&r.carriedAmmo===0&&!Object.keys(ammunitionByType(r)).length));assert.equal(s.recruited.length,0);assert.deepEqual(save(s),s);
});

test('purchases debit exact funds and one finite merchant type without advancing time',()=>{
 let s=initialCampaign();const before=stock(s),cash=s.resources.treasury,clock=[s.hour,s.secondOfHour];
 s=order(s,{type:'purchaseAmmunition',ammoType:'rifle_62',quantity:AMMUNITION_MERCHANT_CAP});
 assert.equal(s.resources.treasury,cash-60*AMMUNITION_PRICE);assert.equal(s.merchants.retiro.ammunition.rifle_62,0);assert.deepEqual(stock(s),{...before,rifle_62:before.rifle_62+60});assert.deepEqual([s.hour,s.secondOfHour],clock);assert.deepEqual(save(s),s);
 for(const a of [{ammoType:'rifle_62',quantity:1},{ammoType:'universal',quantity:1},{ammoType:'pistol_69',quantity:-1},{ammoType:'pistol_69',quantity:1.5},{ammoType:'pistol_69',quantity:61}])reject(s,{type:'purchaseAmmunition',...a});
 const poor={...s,resources:{...s.resources,treasury:2}};reject(poor,{type:'purchaseAmmunition',ammoType:'pistol_69',quantity:1});
 const pending=order(hire(s),{type:'visitSector'});reject(pending,{type:'purchaseAmmunition',ammoType:'pistol_69',quantity:1});
 for(let hour=0;hour<23;hour++)advanceMerchants(s,()=>true);assert.equal(s.merchants.retiro.ammunition.rifle_62,0);advanceMerchants(s,()=>true);assert.equal(s.merchants.retiro.ammunition.rifle_62,6);assert.equal(s.merchants.retiro.ammunition.musket_75,180);
 s.sectors.retiro.owner='royalist';for(let hour=0;hour<48;hour++)advanceMerchants(s,()=>true);assert.equal(s.merchants.retiro.ammunition.rifle_62,6);
});

test('each production order pays materials and yields only its selected prepared load after saved work',()=>{
 for(const [type,key]of Object.entries(AMMUNITION_RESOURCE_KEYS)){
  let s=initialCampaign();const recipe=RECIPES[key],before=stock(s),cash=s.resources.treasury,powder=s.resources.powder,lead=s.resources.lead;
  assert.equal(recipe.ammoType,type);s=order(s,{type:'produce',recipe:key});assert.equal(s.resources.treasury,cash-30);assert.equal(s.resources.powder,powder-5);assert.equal(s.resources.lead,lead-3);assert.deepEqual(stock(s),before);
  const due=s.production[0].due;s=order(save(s),{type:'wait',hours:due-s.hour});assert.equal(s.production.length,0);assert.deepEqual(stock(s),{...before,[type]:before[type]+60});assert.deepEqual(save(s),s);
 }
});

test('typed contraband and convoy cargo preserve the paid type through saved delay and delivery',()=>{
 // A controlled logistics fixture makes the two port endpoints available;
 // all goods, funds, transport costs and subsequent deliveries remain finite.
 let s=initialCampaign();for(const id of ['buenos_aires','ensenada'])Object.assign(s.sectors[id],{owner:'patriot',loyalty:65});
 const before=stock(s),cash=s.resources.treasury;s=order(s,{type:'contraband',offer:'ammunition',ammoType:'pistol_69'});assert.ok(s.resources.treasury<cash);assert.deepEqual(s.shipments[0].goods,{ammo_pistol_69:100});assert.deepEqual(stock(s),before);
 const due=s.shipments[0].due;s=order(save(s),{type:'wait',hours:due-s.hour});assert.deepEqual(stock(s),{...before,pistol_69:before.pistol_69+100});assert.equal(s.shipments.length,0);
 s=order(s,{type:'transport',mode:'posta'});const reserves=stock(s);s=order(s,{type:'supplyTransfer',source:'reserve',destination:'retiro',mode:'posta',goods:{ammo_pistol_69:7,ammo_rifle_62:3}});
 assert.deepEqual(stock(s),{...reserves,pistol_69:reserves.pistol_69-7,rifle_62:reserves.rifle_62-3});assert.deepEqual(s.convoys[0].goods,{ammo_pistol_69:7,ammo_rifle_62:3});
 s=order(save(s),{type:'wait',hours:1});assert.equal(s.convoys.length,0);assert.equal(s.depots.retiro.ammo_pistol_69,7);assert.equal(s.depots.retiro.ammo_rifle_62,3);assert.deepEqual(save(s),s);
});

test('a paid hire retains typed rounds across real deployment, report, weapon swap, and reentry',()=>{
 let s=hire(initialCampaign(8));s=order(s,{type:'visitSector'});let b=enterSector(s.pendingBattle,s.sectorStates.retiro);
 assert.deepEqual(unitAmmunitionByType(b.units.find(u=>u.id==='110')),{musket_75:10});assert.equal(s.resources.cartridges,170);
 ({campaign:s,battle:b}=decodeSave(encodeSave(s,b)));s=leave(s,b);assert.equal(s.resources.cartridges,170);assert.deepEqual(ammunitionByType(s.operativeState[110]),{musket_75:9});
 s=order(s,{type:'purchaseEquipment',item:1805});s=order(s,{type:'equip',operativeId:110,itemId:1805,slot:'weapon'});assert.deepEqual(ammunitionByType(s.operativeState[110]),{musket_75:9});const stored=s.armoryItems.find(i=>i.item===1800);assert.equal(stored.loaded,1);
 s=order(save(s),{type:'visitSector'});b=enterSector(s.pendingBattle,s.sectorStates.retiro);let u=b.units.find(u=>u.id==='110');assert.equal(u.weapon,1805);assert.equal(u.loaded,1,'first issuance loads the purchased gun from finite matching stock');assert.deepEqual(ammunitionByType(u),{musket_75:9,pistol_69:9});assert.equal(u.ammo,9);assert.equal(s.resources.cartridges,170);assert.equal(s.resources.ammo_pistol_69,40);
 s=leave(s,b);assert.equal(s.resources.cartridges,170);assert.equal(s.resources.ammo_pistol_69,40);s=order(save(s),{type:'visitSector'});assert.deepEqual(ammunitionByType(s.pendingBattle.squad[0]),{musket_75:9,pistol_69:9});assert.equal(s.resources.ammo_pistol_69,40);assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);
});

test('finite in-sector transfers can retain more than ten compatible rounds through pending saves',()=>{
 let s=hire(hire(initialCampaign(8)),114);s=order(s,{type:'visitSector'});let b=flat(s);const totalBefore=b.units.filter(u=>u.side==='player').reduce((n,u)=>n+availableAmmunition(u),0);
 b=actBattle(b,{type:'transfer',unitId:'114',targetId:'110',item:'inventory:ammo:musket_75',count:4});assert.equal(b.lastError,null);assert.equal(availableAmmunition(b.units.find(u=>u.id==='110')),13);assert.equal(b.units.filter(u=>u.side==='player').reduce((n,u)=>n+availableAmmunition(u),0),totalBefore);
 s=leave(s,b);const stockBefore=s.resources.cartridges;s=order(save(s),{type:'visitSector'});assert.equal(s.pendingBattle.squad.find(u=>u.id===110).ammo,13);assert.equal(s.resources.cartridges,stockBefore-4,'only the donor receives its four missing rounds');assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);
});

test('issuance uses only matching finite depot and shared stock and respects a full pack',()=>{
 const s=hire(initialCampaign()),op=rosterFor(s).find(o=>o.id===110);s.depots.retiro={cartridges:3,ammo_pistol_69:7};s.resources.cartridges=2;const pistol=s.resources.ammo_pistol_69;
 const issued=allocateEquipmentAmmo(s,op,'retiro');assert.deepEqual(unitAmmunitionByType({...op,...issued}),{musket_75:5});assert.equal(s.depots.retiro.cartridges,0);assert.equal(s.resources.cartridges,0);assert.equal(s.resources.ammo_pistol_69,pistol);assert.equal(s.depots.retiro.ammo_pistol_69,7);
 const full=hire(initialCampaign());full.operativeState[110].inventory=Object.fromEntries(Array.from({length:12},(_,i)=>[`ballast${i}`,{count:1,weight:4}]));const before=stock(full),none=allocateEquipmentAmmo(full,rosterFor(full).find(o=>o.id===110));assert.deepEqual(unitAmmunitionByType({...op,...none}),{musket_75:1});assert.deepEqual(ammunitionByType(none),{});assert.deepEqual(stock(full),{...before,musket_75:before.musket_75-1});
});

test('militia draws and releases only the ammunition of its actual weapon',()=>{
 const s=initialCampaign(),before=stock(s);s.sectors.retiro.militia=[1,1,0];const units=prepareGarrison(s,'retiro');assert.deepEqual(units.map(unitAmmunitionByType),[{shot_16:6},{musket_75:6}]);assert.deepEqual(stock(s),{...before,shot_16:before.shot_16-6,musket_75:before.musket_75-6});
 s.sectors.retiro.militia=[0,0,0];prepareGarrison(s,'retiro');assert.deepEqual(stock(s),before);
});

test('return receipts reject an equal-count type conversion and retain captive custody without stock credit',()=>{
 const original={id:110,side:'player',weapon:1800,loaded:1,ammunitionVersion:2,inventory:{}};addAmmunition(original,'musket_75',9);
 const request={squad:[original],fieldAmmunition:{},enemies:[]},unit={...structuredClone(original),id:'110'},snapshot={units:[unit],groundItems:[]};
 const entry={unitId:'110',kind:'captured'},plan=planReturnAmmunition(request,snapshot,[entry]);assert.equal(plan.creditedCartridges,0);assert.deepEqual(plan.creditedAmmunition,{});assert.deepEqual(plan.custody['110'],{loaded:1,ammo:9,preserveLoading:true});assert.deepEqual(plan.retainedAmmunition,{musket_75:10});
 unit.inventory={};addAmmunition(unit,'pistol_69',9);assert.throws(()=>planReturnAmmunition(request,snapshot,[entry]),/más munición de ese tipo/);
});

function unmarkCampaign(s){delete s.ammunitionVersion;for(const r of Object.values(s.operativeState)){delete r.ammunitionVersion;delete r.carriedAmmo;}for(const key of Object.values(AMMUNITION_RESOURCE_KEYS))if(key!=='cartridges')delete s.resources[key];for(const m of Object.values(s.merchants))delete m.ammunition;return s;}
test('legacy loose rounds migrate once to .75 while a different gun keeps its own loaded charge',()=>{
 const old=unmarkCampaign(hire(initialCampaign()));old.loadouts[110]={weapon:1802};Object.assign(old.operativeState[110],{carriedLoaded:1,carriedAmmo:8,carriedReloadProgress:undefined});
 const s=restoreCampaign(JSON.stringify(old));assert.deepEqual(ammunitionByType(s.operativeState[110]),{musket_75:7});assert.equal(s.operativeState[110].carriedLoaded,1);assert.equal(availableAmmunition({...s.operativeState[110],weapon:1802}),0);assert.equal(s.resources.cartridges,180);assert.ok(Object.entries(stock(s)).filter(([t])=>t!=='musket_75').every(([,n])=>n===0));assert.match(s.log[0].text,/munición antigua/);assert.deepEqual(save(s),s);
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
 for(const mutate of [bad=>delete bad.pendingBattle.squad[0].ammunitionVersion,bad=>delete bad.operativeState[110].ammunitionVersion,bad=>bad.pendingBattle.squad[0].ammo=900,bad=>bad.pendingBattle.fieldAmmunition={universal:1},bad=>delete bad.merchants.retiro.ammunition]){const bad=structuredClone(s);mutate(bad);assert.throws(()=>restoreCampaign(serializeCampaign(bad)));}
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
 let s=order(hire(initialCampaign(8)),{type:'purchaseEquipment',item:1805});s=order(s,{type:'equip',operativeId:110,slot:'weapon',itemId:1805});s=order(s,{type:'visitSector'});let b=enterSector(s.pendingBattle,s.sectorStates.retiro);
 // This explicit prior-format fixture contains untyped scalar loose stock in
 // both historical request and live battle mirrors, never two physical grants.
 const untype=u=>{u.ammo=totalReserveAmmunition(u);u.inventory=Object.fromEntries(Object.entries(u.inventory??{}).filter(([,r])=>r.kind!=='ammunition'));delete u.ammunitionVersion;};
 unmarkCampaign(s);delete s.pendingBattle.ammunitionVersion;delete s.pendingBattle.issuedAmmunition;delete s.pendingBattle.fieldAmmunition;for(const u of s.pendingBattle.squad)untype(u);delete b.ammunitionVersion;for(const u of b.units)untype(u);
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
