import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {storeEquipment,resaleBreakdown} from '../game/equipment.js';
import {rosterFor} from '../game/campaign.js';
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

test('personnel keeps carried care and repair work without medical or toolkit purchases',()=>{
  const state=initialCampaign();state.operativeState[10].medkits=4;state.operativeState[10].toolkitPoints=37;state.operativeState[10].inventory.tools={kind:'repair-kit',count:1,weight:2,repairPoints:17};
  const before=structuredClone(state),op=rosterFor(state).find(op=>op.id===10);
  const markup=render(h(MedicalCare,{state,sectorId:'retiro',dispatch:noop}));
  assert.match(markup,/4 vendas llevadas/);assert.match(markup,/54 puntos de herramientas llevadas/);
  assert.ok(markup.includes(`Asignación de ${op.nickname}`));assert.match(markup,/<option value="doctor"/);assert.match(markup,/<option value="patient"/);assert.match(markup,/<option value="repair"/);
  assert.ok(markup.includes(`Equipo para reparar de ${op.nickname}`));assert.ok(markup.includes(`Alcance de reparación de ${op.nickname}`));
  assert.doesNotMatch(markup,/Comprar|disponibles en la maestranza|botiquines disponibles|Repone|horas abastecidas/);
  assert.match(render(h(MedicalSupplyPurchase,{s:state,op})),/4 vendas llevadas/);
  assert.deepEqual(state,before);
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
