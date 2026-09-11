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

test('personnel buys the last finite medicine stock with matching price, capacity and dispatch quantity',()=>{
  const state=initialCampaign();state.location='retiro';state.merchants.retiro.supplies.medkits=4;state.merchants.retiro.restockHours=7;
  for(const id of state.recruited)state.operativeState[id].location='retiro';
  const draw=()=>render(h(MedicalCare,{state,sectorId:'retiro',dispatch:noop}));
  let markup=draw();assert.match(markup,/4\/40 botiquines disponibles/);assert.match(markup,/Repone 5 cada 24 horas/);assert.match(markup,/17 horas abastecidas/);
  const purchaseButtons=html=>[...html.matchAll(/<button[^>]*>Comprar \d+ · \d+ pesos<\/button>/g)].map(match=>match[0]);
  assert.ok(purchaseButtons(markup).length>0);
  assert.ok(purchaseButtons(markup).some(button=>button.includes('Comprar 4 · 120 pesos')&&!button.includes('disabled')));
  const op=rosterFor(state).find(op=>op.id===10),actions=[];
  const control=MedicalSupplyPurchase({s:state,op,blocked:false,pharmacy:true,dispatch:action=>actions.push(action)});
  const button=control.props.children.find(child=>child.type==='button');assert.equal(button.props.disabled,false);button.props.onClick();
  assert.deepEqual(actions,[{type:'purchaseMedicalSupplies',operativeId:10,quantity:4}]);
  const next=dispatchCampaign(state,actions[0]);assert.equal(next.lastError,null);assert.equal(next.merchants.retiro.supplies.medkits,0);assert.equal(next.operativeState[10].medkits,state.operativeState[10].medkits+4);assert.equal(next.resources.treasury,state.resources.treasury-120);
  const empty=render(h(MedicalCare,{state:next,sectorId:'retiro',dispatch:noop}));assert.match(empty,/<button[^>]*disabled=""[^>]*>Botiquines agotados<\/button>/);assert.match(empty,/no tiene botiquines disponibles/);
  const packed=structuredClone(state);packed.operativeState[10].medkits=1;
  packed.operativeState[10].inventory??={};
  const free=12-equipmentInventoryUsage(packed,op).used;
  for(let index=0;index<free;index++)packed.operativeState[10].inventory[`filler-${index}`]={count:1,weight:0};
  assert.equal(equipmentInventoryUsage(packed,op).used,12);
  const packedControl=()=>MedicalSupplyPurchase({s:packed,op,blocked:false,pharmacy:true,dispatch:noop}).props.children.find(child=>child.type==='button');
  assert.equal(packedControl().props.disabled,false,'four kits fill the current stack without needing a new pocket');
  packed.merchants.retiro.supplies.medkits=5;assert.equal(packedControl().props.disabled,true,'five kits need another pocket and must be rejected');
  state.merchants.retiro.supplies.medkits=5;markup=draw();assert.ok(purchaseButtons(markup).some(button=>!button.includes('disabled')));
  state.pendingBattle={id:'pending'};for(const button of purchaseButtons(draw()))assert.match(button,/disabled=""/);
});


test('front reports identify a crossing sector without promising an arrival that a ready squad holds',async()=>{
  const {default:EnemyEncounters}=await import('../web/app/EnemyEncounters.tsx');
  const {launchEnemyGroup,delayCrossingEnemyGroups}=await import('../game/enemy-groups.js');
  const s=initialCampaign(),g=launchEnemyGroup(s,'north','tucuman');s.hour=40;g.routeIndex=3;
  s.squads[0].location='tucuman';s.squads[0].journey={path:['tucuman','salta'],status:'ready',intent:'attack',returning:false,elapsed:12,legHours:12};delayCrossingEnemyGroups(s);
  const html=render(h(EnemyEncounters,{state:s,dispatch:noop}));assert.match(html,/Rutas opuestas: el contacto será en Salta/);assert.doesNotMatch(html,/Llegada prevista/);
  s.squads[0].journey.returning=true;const returning=render(h(EnemyEncounters,{state:s,dispatch:noop}));assert.match(returning,/Llegada prevista/);assert.doesNotMatch(returning,/Rutas opuestas/);
});
