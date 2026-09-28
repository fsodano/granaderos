import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_IMPORT_RULES,IMPORT_PORTS,importRulesFor,importDelayReason} from '../game/campaign-imports.js';
import {defaultStartingTerritory} from '../game/content-territory.js';
import {defaultContentPackage,validateContentPackage,parseContentPackage,encodeContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {contentWeaponOf} from '../game/weapon-definition.js';
import {enterSector} from '../game/world.js';
import {encodeSave,decodeSave} from '../game/save.js';
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

test('actual purchases pin a seeded deadline, pay once and deliver usable authored weapon instances at the chosen port',()=>{
 const d=content(),initial=initialCampaign(8,d);let s=order(initial,purchase);assert.equal(s.resources.treasury,3200-246);assert.equal(s.armoryItems.length,0);const due=s.equipmentShipments[0].due;assert.ok(due>=3&&due<=7);assert.equal(order(initial,purchase).equipmentShipments[0].due,due);s=save(s).campaign;assert.equal(s.equipmentShipments[0].due,due);s=order(s,{type:'wait',hours:due-1});assert.equal(s.armoryItems.length,0);s=order(s,{type:'wait',hours:1});assert.equal(s.armory['fusil-de-pedido'],2);assert.equal(s.armoryItems.length,2);assert.equal(s.equipmentShipments.length,0);assert.equal(s.resources.treasury,3200-246);assert.ok(s.log.some(e=>e.text.includes('Arriban a Buenos Aires')));assert.ok(s.armoryItems.every(w=>w.contentWeapon.id==='fusil-de-pedido'&&w.loaded===0&&w.condition===100));
 s=order(save(s).campaign,{type:'wait',hours:1});assert.equal(s.armoryItems.length,2);s=order(s,{type:'recruitCivic',id:110,term:'week'});s=order(s,{type:'equip',operativeId:110,slot:'weapon',itemId:'fusil-de-pedido',instanceId:s.armoryItems[0].id});s=order(s,{type:'visitSector'});const b=enterSector(s.pendingBattle);assert.equal(contentWeaponOf(b.units.find(u=>u.id==='110')).id,'fusil-de-pedido');assert.ok(save(s,b));
});

test('blockade and loss of the configured port delay delivery without rerolling, charging twice or duplicating stock',()=>{
 const d=content({port:'san_nicolas',minHours:2,maxHours:2});d.startingTerritory.san_nicolas.owner='patriot';let s=order(initialCampaign(8,d),purchase);assert.equal(s.equipmentShipments[0].due,2);const funds=s.resources.treasury;
 // Prepared political changes isolate reception and saved overdue deliveries.
 s.sectors.san_nicolas.owner='royalist';s=order(s,{type:'wait',hours:2});assert.match(importDelayReason(s),/ocupación/);assert.equal(s.armoryItems.length,0);s=save(s).campaign;assert.equal(s.equipmentShipments[0].due,2);
 s.sectors.san_nicolas.owner='patriot';s.blockade=true;s=order(s,{type:'wait',hours:1});assert.match(importDelayReason(s),/bloqueo/);assert.equal(s.armoryItems.length,0);s=save(s).campaign;s.blockade=false;s=order(s,{type:'wait',hours:1});assert.equal(s.armoryItems.length,2);assert.equal(s.resources.treasury,funds);assert.equal(s.equipmentShipments.length,0);assert.equal(s.sectors.ensenada.owner,'royalist');s=order(save(s).campaign,{type:'wait',hours:1});assert.equal(s.armoryItems.length,2);
});

test('disabled, occupied or hostile-trade orders reject without payment while local equipment and already carried imports remain usable',()=>{
 for(const kind of ['disabled','occupied','hostile']){const d=content({port:kind==='disabled'?null:kind==='occupied'?'ensenada':'buenos_aires'});let s=initialCampaign(8,d);if(kind==='hostile')s.reputation.foreign=-1;const rejected=dispatchCampaign(s,purchase);assert.ok(rejected.lastError);assert.equal(rejected.resources.treasury,3200);assert.deepEqual(rejected.equipmentShipments,[]);s=order(s,{type:'purchaseEquipment',item:'firearm-1801'});assert.equal(s.armoryItems.length,1);assert.ok(save(s));}
 const d=content({port:null});d.characters.find(c=>c.id==='person-110').weapon='firearm-1802';let s=order(initialCampaign(8,d),{type:'recruitCivic',id:110,term:'week'});s=order(s,{type:'visitSector'});const b=enterSector(s.pendingBattle);assert.equal(contentWeaponOf(b.units[0]).id,'firearm-1802');assert.ok(save(s,b));
 const disabled=initialCampaign(8,d);disabled.equipmentShipments=[{item:'fusil-de-pedido',quantity:1,due:5}];assert.throws(()=>save(disabled),/pedidos de armas/);
});

test('active import rules survive draft edits and saved content changes are rejected',()=>{
 const d=content(),s=order(initialCampaign(8,d),purchase),due=s.equipmentShipments[0].due;d.imports.port='ensenada';d.imports.minHours=1;const restored=save(s).campaign;assert.equal(restored.contentCampaign.package.imports.port,'buenos_aires');assert.equal(restored.equipmentShipments[0].due,due);const altered=structuredClone(s);altered.contentCampaign.package.imports.port='santa_fe';assert.throws(()=>save(altered),/identidad/);
});
