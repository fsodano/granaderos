import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {previewStrategicRoute} from '../game/strategic-route.js';
import {worldCell,WORLD_CELLS} from '../game/world-cells.js';
import {addEquipment,equipmentCatalog} from '../game/equipment.js';
import {artilleryProfile} from '../game/artillery-definitions.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {localPackage,A,order} from './local-contract-fixture.mjs';
const {default:Campaign}=await import('../web/app/Campaign.tsx');
const {default:StrategicMap}=await import('../web/app/StrategicMap.tsx');
const {default:Armory}=await import('../web/app/Armory.tsx');
const {default:Logistics}=await import('../web/app/Logistics.tsx');
const noop=()=>{};
const doc=html=>new JSDOM(html).window.document;
function hired(){return order(initialCampaign(42,localPackage()),{type:'recruitCivic',id:110,term:'month'});}

test('the shared strategic screen renders a squad in an arbitrary land cell and keeps every map cell selectable',()=>{
 let s=hired(),before=structuredClone(s),plan=previewStrategicRoute(s,s.activeSquadId,A);
 assert.equal(plan.valid,true);assert.equal(plan.action.queue,true);assert.deepEqual(plan.path,['retiro',A]);assert.ok(plan.hours>0);assert.deepEqual(s,before);
 assert.match(previewStrategicRoute(s,s.activeSquadId,A,'posta').reason,/marcha a pie/);
 s=order(s,plan.action);assert.equal(s.location,'retiro');assert.equal(s.hour,0);assert.ok(s.squads.find(q=>q.id===s.activeSquadId).journey);
 for(let hour=0;hour<plan.hours;hour++)s=order(s,{type:'advanceStrategicTime',seconds:3600});
 assert.equal(s.location,A);assert.equal(s.hour,plan.hours);
 assert.ok(s.travelNotice,'arrival interrupts the clock');s=order(s,{type:'advanceStrategicTime',seconds:1});
 s=decodeSave(encodeSave(s)).campaign;
 const screen=doc(render(h(Campaign,{state:s,dispatch:noop,onBattle:noop,onOpenDesk:noop})));
 assert.equal(screen.querySelectorAll('[data-map-cell]').length,WORLD_CELLS.length);
 assert.equal(screen.querySelector(`[data-map-cell="${A}"]`).getAttribute('aria-pressed'),'true');
 assert.equal(screen.querySelector('.strategy-orders'),null,'sector orders are requested explicitly');
 assert.equal(screen.querySelector('[role="dialog"]'),null);
 assert.equal(screen.querySelector('.atlas-readout'),null);
 assert.ok(screen.querySelector(`[data-map-cell="${A}"]`).getAttribute('aria-label').includes(worldCell(A).grid));
 assert.equal(screen.querySelector(`[data-sector-presence="${A}"]`).querySelectorAll('[data-presence-dot="player"]').length,1);
 assert.ok(screen.querySelector('.merc-map-table').textContent.includes(worldCell(A).grid));
 const back=previewStrategicRoute(s,s.activeSquadId,'retiro');assert.equal(back.valid,true);s=order(s,back.action);assert.equal(s.location,A);
 for(let hour=0;hour<back.hours;hour++)s=order(s,{type:'advanceStrategicTime',seconds:3600});
 assert.equal(s.location,'retiro');
});

test('rural map selection and preview use the same cells as the campaign rules',()=>{
 const s=hired(),plan=previewStrategicRoute(s,s.activeSquadId,A),before=structuredClone(s);
 const screen=doc(render(h(StrategicMap,{state:s,selected:A,onSelect:noop,dispatch:noop,plotting:true,previewPath:plan.path,onSquad:noop})));
 const points=plan.path.map(id=>{const c=worldCell(id);return `${c.x+9},${c.y+9}`;}).join(' ');
 assert.equal(screen.querySelector('[data-route-preview]').getAttribute('points'),points);
 assert.deepEqual(s,before);
 const water=WORLD_CELLS.find(c=>!c.land);assert.equal(previewStrategicRoute(s,s.activeSquadId,water.location).valid,false);
});

test('the armory retains authored names and images together with exact stored assemblies and finite stock',()=>{
 const d=localPackage(),w=d.weapons.find(w=>w.template===1801);w.name='Fusil de prueba';w.art='/art/weapon-1801.png';
 let s=order(initialCampaign(42,d),{type:'recruitCivic',id:110,term:'month'});addEquipment(s,w.id,1);
 const spec=equipmentCatalog(s).find(item=>item.item===w.id),row=s.armoryItems.find(row=>row.itemMetadata?.contentWeapon?.id===w.id);assert.ok(row);row.condition=61;
 const before=structuredClone(s),screen=doc(render(h(Armory,{state:s,dispatch:noop})));
 assert.ok([...screen.querySelectorAll('img')].some(img=>img.alt===spec.name&&img.getAttribute('src')===spec.art));
 assert.ok(screen.querySelector(`option[value="${row.id}"]`).textContent.includes('61%'));
 assert.ok(screen.querySelector('[aria-label="Munición y depósito"]'));
 assert.ok(screen.querySelector('[aria-label="Familia de munición"]')||screen.querySelector('#campaign-ammunition-family'));
 assert.equal(screen.querySelectorAll('#campaign-ammunition-family option').length,4);
 assert.ok(screen.querySelector('.merchant-status').textContent.includes('Caja del comerciante'));
 assert.deepEqual(s,before);
});

test('the transport screen reads the canonical shipment and charges only the shared network price',()=>{
 const s=hired(),treasury=s.resources.treasury,next=order(s,{type:'transport',mode:'carts'});
 assert.equal(next.resources.treasury,treasury-180);assert.deepEqual(Object.keys(next.resources),['treasury']);
 const gun={id:'test-shipment',type:'bronze4',side:'player',loaded:true,ammo:6,reloadProgress:0,facing:0};
 // Explicit presentation fixture; real custody/transfer admission has its own integration tests.
 next.artilleryTransfers=[{id:gun.id,from:'retiro',to:'buenos_aires',mode:'carts',path:['retiro','buenos_aires'],departedAt:next.hour,dueAt:next.hour+18,gun}];
 const before=structuredClone(next),screen=doc(render(h(Logistics,{state:next,dispatch:noop})));
 assert.ok(screen.body.textContent.includes(artilleryProfile(next,gun).name));assert.ok(screen.body.textContent.includes('7 disparos'));assert.ok(screen.body.textContent.includes('ocupación corta'));
 assert.equal(screen.querySelector('#cargo-resource'),null);assert.deepEqual(next,before);
});
