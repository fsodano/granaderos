import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h,act} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {mountCampaign} from './mounted-live-campaign-fixture.mjs';
import {initialCampaign} from '../game/campaign.js';
import {decodeSave} from '../game/save.js';
import {campaignStorageKey} from '../game/content-launch.js';
import {TRANSPORT_NETWORKS} from '../game/transport-network.js';
const {default:Desk}=await import('../web/app/Desk.tsx');

test('the current campaign page opens transport purchases and saves each network exactly once',async t=>{
 const m=await mountCampaign(t);
 await m.click('Nueva campaña');await m.click('Omitir introducción');await m.click('Transportes');
 const saved=()=>decodeSave(m.dom.window.localStorage.getItem(campaignStorageKey(null,m.dom.window.location.search))).campaign;
 const card=name=>[...m.document.querySelectorAll('.logistics-routes article')].find(node=>node.querySelector('h3')?.textContent===name);
 const click=async button=>act(async()=>button.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));
 assert.equal(m.document.querySelector('[aria-label="Carpetas del escritorio"] [aria-current="page"]').textContent,'Transportes');
 const start=saved();assert.deepEqual(start.routes,{posta:false,flotilla:false,carts:false,mules:false});
 let cash=start.resources.treasury;
 for(const network of TRANSPORT_NETWORKS){
  const row=card(network.name);assert.ok(row);assert.ok(row.textContent.includes(`${network.cost} pesos`));
  const button=row.querySelector('button');assert.equal(button.disabled,false);await click(button);
  cash-=network.cost;assert.equal(saved().resources.treasury,cash);assert.equal(saved().routes[network.id],true);
  assert.equal(button.disabled,true);assert.match(button.textContent,/Red organizada/);
  const purchased=saved();await click(button);assert.deepEqual(saved(),purchased,'a second click cannot pay twice');
 }
 await m.click('Carta de operaciones');await m.click('Escritorio');await m.click('Transportes');
 assert.ok([...m.document.querySelectorAll('.logistics-routes button')].every(button=>button.disabled));
 assert.equal(saved().resources.treasury,start.resources.treasury-TRANSPORT_NETWORKS.reduce((sum,network)=>sum+network.cost,0));
 assert.equal(saved().hour,start.hour,'buying a network must not advance campaign time');
 assert.match(m.document.querySelector('.logistics-section').textContent,/Sector → Preparativos del sector → Artillería/);
});

test('the desk transport folder keeps existing purchase availability guards',()=>{
 const fresh=initialCampaign();
 const cases=[
  {name:'insufficient funds',state:{...fresh,resources:{...fresh.resources,treasury:0}}},
  {name:'an active tactical sector',state:{...fresh,pendingBattle:{}}},
  {name:'an unresolved encounter',state:{...fresh,pendingEncounter:{}}},
  {name:'defeat',state:{...fresh,defeated:true}},
  {name:'already purchased networks',state:{...fresh,routes:Object.fromEntries(TRANSPORT_NETWORKS.map(network=>[network.id,true]))}},
 ];
 for(const {name,state}of cases){
  const before=structuredClone(state),dom=new JSDOM(render(h(Desk,{state,initialTab:'transport',onClose(){},dispatch(){assert.fail('rendering must not purchase');}})));
  try{const buttons=[...dom.window.document.querySelectorAll('.logistics-routes button')];assert.equal(buttons.length,TRANSPORT_NETWORKS.length,name);assert.ok(buttons.every(button=>button.disabled),name);assert.deepEqual(state,before,name);}finally{dom.window.close();}
 }
});
