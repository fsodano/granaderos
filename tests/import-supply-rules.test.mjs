import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_IMPORT_RULES,IMPORT_PORTS,importRulesFor,importDelayReason} from '../game/campaign-imports.js';
import {defaultStartingTerritory} from '../game/content-territory.js';
import {defaultContentPackage,validateContentPackage,parseContentPackage,encodeContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {contentWeaponOf} from '../game/weapon-definition.js';
import {enterSector} from '../game/world.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {withStoredGear,assertTradeRejected} from './commerce-gear-fixture.mjs';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,`${a.type}: ${n.lastError}`);return n;};
const save=(s,b=null)=>decodeSave(encodeSave(s,b));
function content(imports={}){const d=defaultContentPackage();d.headquarters='buenos_aires';d.startingTerritory=defaultStartingTerritory(d.headquarters);d.imports={port:'buenos_aires',minHours:3,maxHours:7,...imports};d.characters.find(c=>c.id==='person-110').arrivalHours=0;d.weapons.push({...d.weapons.find(w=>w.id==='firearm-1802'),id:'fusil-de-pedido',name:'Fusil del encargo',price:123});return d;}
const purchase={type:'purchaseEquipment',item:'fusil-de-pedido',quantity:2};

test('import rules validate four plausible ports, disabled orders, bounded times and older defaults',()=>{
 const d=content();assert.deepEqual(parseContentPackage(encodeContentPackage(d)),d);assert.equal(IMPORT_PORTS.length,4);for(const port of [...IMPORT_PORTS.map(s=>s.id),null]){const x=content({port});assert.deepEqual(validateContentPackage(x),[]);assert.ok(initialCampaign(8,x));}
 for(const imports of [null,[],{}, {...d.imports,extra:1}, {...d.imports,port:'mendoza'}, {...d.imports,port:'retiro'}, {...d.imports,port:'cell-27-28'}, ...[0,721,2.5,'4',null].map(minHours=>({...d.imports,minHours})), {...d.imports,maxHours:721}, {...d.imports,maxHours:1}, {...d.imports,maxHours:4.5}]){const invalid=content();invalid.imports=imports;assert.ok(validateContentPackage(invalid).length);assert.throws(()=>initialCampaign(8,invalid));}
 for(const n of [1,720])assert.deepEqual(validateContentPackage(content({minHours:n,maxHours:n})),[]);
 const old=content();delete old.imports;assert.deepEqual(importRulesFor(initialCampaign(8,old)),DEFAULT_IMPORT_RULES);assert.deepEqual(importRulesFor(initialCampaign()),DEFAULT_IMPORT_RULES);
});

test('current import orders reject without payment, stock consumption, random advance or a new deadline',()=>{
 const state=initialCampaign(8,content());assertTradeRejected(state,purchase);assert.deepEqual(state.equipmentShipments,[]);assert.deepEqual(save(state).campaign,state);
});

test('already-paid legacy cargo retains its deadline through port loss and blockade and delivers once when access returns',()=>{
 const d=content({port:'san_nicolas',minHours:2,maxHours:2});d.startingTerritory.san_nicolas.owner='patriot';let state=initialCampaign(8,d);state.equipmentShipments=[{item:'fusil-de-pedido',quantity:2,due:2}];const cash=state.resources.treasury,pending=structuredClone(state.equipmentShipments);
 state.sectors.san_nicolas.owner='royalist';state=order(state,{type:'wait',hours:2});assert.match(importDelayReason(state),/ocupación/);assert.deepEqual(save(state).campaign.equipmentShipments,pending);
 state.sectors.san_nicolas.owner='patriot';state.blockade=true;state=order(state,{type:'wait',hours:1});assert.match(importDelayReason(state),/bloqueo/);state=save(state).campaign;state.blockade=false;state=order(state,{type:'wait',hours:1});
 assert.deepEqual(state.equipmentShipments,[]);assert.equal(state.armoryItems.length,2);assert.equal(state.resources.treasury,cash);const items=structuredClone(state.armoryItems);state=order(save(state).campaign,{type:'wait',hours:24});assert.deepEqual(state.armoryItems,items);assertTradeRejected(state,purchase);
});

test('imports always reject while finite already-owned authored rifles remain usable through actual equipping and deployment',()=>{
 for(const kind of ['disabled','occupied','hostile']){const d=content({port:kind==='disabled'?null:kind==='occupied'?'ensenada':'buenos_aires'});let state=initialCampaign(8,d);if(kind==='hostile')state.reputation.foreign=-1;assertTradeRejected(state,purchase);assertTradeRejected(state,{type:'purchaseEquipment',item:'firearm-1801'});assert.deepEqual(save(state).campaign,state);}
 let state=order(initialCampaign(8,content({port:null})),{type:'recruitCivic',id:110,term:'week'});state=withStoredGear(state,'fusil-de-pedido');const instance=state.armoryItems[0];state=order(state,{type:'equip',operativeId:110,slot:'weapon',itemId:'fusil-de-pedido',instanceId:instance.id});state=order(state,{type:'visitSector'});const battle=enterSector(state.pendingBattle);assert.equal(contentWeaponOf(battle.units[0]).id,'fusil-de-pedido');assert.ok(save(state,battle));
 const disabled=initialCampaign(8,content({port:null}));disabled.equipmentShipments=[{item:'fusil-de-pedido',quantity:1,due:5}];assert.throws(()=>save(disabled),/pedidos de armas/);
});

test('retained import configuration and finite equipment survive draft edits while saved content tampering is rejected',()=>{
 const d=content(),state=withStoredGear(initialCampaign(8,d),'fusil-de-pedido');d.imports.port='ensenada';d.imports.minHours=1;const restored=save(state).campaign;assert.equal(restored.contentCampaign.package.imports.port,'buenos_aires');assert.deepEqual(restored.armoryItems,state.armoryItems);const altered=structuredClone(state);altered.contentCampaign.package.imports.port='santa_fe';assert.throws(()=>save(altered),/identidad/);
});

test('a real naval raid blocks finite already-paid cargo and later access delivers it only once',()=>{
 const d=defaultContentPackage();d.imports={port:'buenos_aires',minHours:176,maxHours:176};for(const id of ['buenos_aires','ensenada','san_nicolas','santa_fe'])d.startingTerritory[id]={owner:'patriot',loyalty:65};let state=initialCampaign(8,d);state.equipmentShipments=[{item:'firearm-1802',quantity:1,due:176}];
 while(state.hour<176){const hour=state.hour;state=order(state,{type:'wait',hours:176-state.hour});assert.ok(state.hour>hour);}assert.equal(state.blockade,true);const pending=structuredClone(state.equipmentShipments),money=state.resources.treasury;state=save(state).campaign;state=order(state,{type:'wait',hours:2});assert.deepEqual(state.equipmentShipments,pending);assert.deepEqual(state.armoryItems,[]);assert.equal(state.resources.treasury,money);
 // Declared blockade clearance isolates the existing paid delivery; no naval victory is claimed.
 state.blockade=false;state=order(state,{type:'wait',hours:1});assert.equal(state.armoryItems.length,1);assert.deepEqual(state.equipmentShipments,[]);const items=structuredClone(state.armoryItems);state=order(save(state).campaign,{type:'wait',hours:1});assert.deepEqual(state.armoryItems,items);assert.equal(state.resources.treasury,money);assertTradeRejected(state,{type:'purchaseEquipment',item:'firearm-1802'});
});
