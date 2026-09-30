import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {storeEquipment,resaleBreakdown,equipmentInventoryUsage} from '../game/equipment.js';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
const {default:Armory}=await import('../web/app/Armory.tsx');
const {default:MedicalCare,MedicalSupplyPurchase}=await import('../web/app/MedicalCare.tsx');
const noop=()=>{};

test('armory renders matched stock separately and itemizes the sale of an actual fitted assembly',()=>{
  const state=initialCampaign();
  storeEquipment(state,1811,{condition:81});
  storeEquipment(state,1811,{condition:73,fittingPattern:'india_socket',instanceId:'matched-render-1'});
  storeEquipment(state,1811,{condition:65,fittingPattern:'india_socket',instanceId:'matched-render-2'});
  storeEquipment(state,1800,{condition:60,instanceId:'host-render',fittings:{bayonet:{weapon:1811,fittingPattern:'india_socket',instanceId:'fixed-render',condition:40}}});
  const assembly=state.armoryItems.find(item=>item.instanceId==='host-render'),quote=resaleBreakdown(assembly);
  const markup=render(h(Armory,{state,dispatch:noop}));
  const articles=[...markup.matchAll(/<article[^>]*>([\s\S]*?)<\/article>/g)].map(match=>match[1]);
  const matched=articles.find(row=>row.includes('Comprar Bayoneta para Brown Bess India'));
  const generic=articles.find(row=>row.includes('Comprar Bayoneta de Cubo'));
  assert.match(matched,/2 en armería/);assert.match(generic,/1 en armería/);
  assert.match(markup,/Bayoneta fijada 40%/);
  const resale=articles.find(row=>row.includes('Desglose de venta'));
  for(const part of quote.items)assert.ok(resale.includes(`${part.name} · estado ${part.condition}% · ${part.price} pesos`));
  assert.ok(resale.includes(`Vender · ${quote.total} pesos`));
});

test('personnel shows finite medicine stock and the shared configured dressing price',()=>{
  const state=initialCampaign();state.merchants.retiro.supplies.medkits=4;state.merchants.retiro.restockHours=7;
  const op=rosterFor(state).find(op=>op.id===10);
  const draw=s=>render(h(MedicalCare,{state:s,sectorId:'retiro',dispatch:noop}));
  const buttons=html=>[...html.matchAll(/<button[^>]*>Comprar vendas · \d+ pesos<\/button>/g)].map(match=>match[0]);
  let markup=draw(state);assert.match(markup,/4\/40 botiquines disponibles/);assert.match(markup,/Repone 5 cada 24 horas/);assert.match(markup,/17 horas abastecidas/);
  assert.ok(buttons(markup).some(button=>button.includes('40 pesos')&&!button.includes('disabled')));
  const next=dispatchCampaign(state,{type:'purchaseMedicalSupplies',operativeId:10,quantity:4});
  assert.equal(next.lastError,null);assert.equal(next.merchants.retiro.supplies.medkits,0);assert.equal(next.operativeState[10].medkits,state.operativeState[10].medkits+4);assert.equal(next.resources.treasury,state.resources.treasury-40);
  assert.ok(buttons(draw(next)).every(button=>button.includes('disabled')));assert.match(draw(next),/no tiene suficientes vendas/);
  const packed=structuredClone(state);packed.operativeState[10].medkits=1;packed.operativeState[10].inventory??={};
  const free=12-equipmentInventoryUsage(packed,op).used;
  for(let index=0;index<free;index++)packed.operativeState[10].inventory[`filler-${index}`]={count:1,weight:0};
  assert.equal(equipmentInventoryUsage(packed,op).used,12);
  const supply=s=>render(h(MedicalSupplyPurchase,{s,op,blocked:false,pharmacy:true,dispatch:noop}));
  assert.ok(buttons(supply(packed)).some(button=>!button.includes('disabled')),'four dressings fit the existing stack');
  packed.merchants.retiro.supplies.medkits=5;assert.ok(buttons(supply(packed)).every(button=>button.includes('disabled')),'five dressings require another pocket');
  state.pendingBattle={id:'pending'};assert.ok(buttons(draw(state)).every(button=>button.includes('disabled')));
});


test('front reports require observers and never disclose the enemy crossing schedule',async()=>{
  const {default:EnemyEncounters}=await import('../web/app/EnemyEncounters.tsx');
  const {launchEnemyGroup,delayCrossingEnemyGroups}=await import('../game/enemy-groups.js');
  const s=initialCampaign(),g=launchEnemyGroup(s,'north','tucuman');s.hour=40;g.routeIndex=3;
  s.squads[0].location='tucuman';s.squads[0].journey={path:['tucuman','salta'],status:'ready',intent:'attack',returning:false,elapsed:12,legHours:12};delayCrossingEnemyGroups(s);
  const html=render(h(EnemyEncounters,{state:s,dispatch:noop}));assert.match(html,/Sin partes recientes/);assert.doesNotMatch(html,/Rutas opuestas|Llegada prevista|Salta/);
  s.sectors.tucuman.owner='patriot';s.sectors.tucuman.militia=[1,0,0];const observed=render(h(EnemyEncounters,{state:s,dispatch:noop}));assert.match(observed,/Salta/);assert.ok(observed.includes(`${g.units.length} realistas observados`));assert.doesNotMatch(observed,/Llegada prevista|Rutas opuestas/);
});

test('the journal identifies historical commands without publishing target or activity predictions',async()=>{
 const {default:CampaignOffice}=await import('../web/app/CampaignOffice.tsx');
 const s=initialCampaign();s.sectors.jujuy.owner='patriot';s.sectors.san_nicolas.owner='patriot';
 const html=render(h(CampaignOffice,{state:s,section:'journal',dispatch:noop}));
 assert.match(html,/Joaquín de la Pezuela/);assert.match(html,/Pío Tristán/);assert.match(html,/Jacinto de Romarate/);assert.match(html,/MANDO REALISTA · REFERENCIA/);assert.doesNotMatch(html,/MANDO REALISTA ACTIVO|MANDO CONTENIDO|Objetivo:/);
});
