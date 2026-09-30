import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';import {dispatchCampaign} from '../game/campaign.js';
const {default:Armory}=await import('../web/app/Armory.tsx');
const {default:Exchange}=await import('../web/app/MerchantExchange.tsx');
function field(){let s=dispatchCampaign(initialCampaign(),{type:'purchaseEquipment',item:1803});s.sectors.cordoba.owner='patriot';s=dispatchCampaign(s,{type:'travel',sector:'cordoba'});assert.equal(s.lastError,null);return s;}
test('the armory exposes the local buying profile and actual cavalry resale price',()=>{
 const s=field(),html=render(h(Armory,{state:s,dispatch:()=>{}}));assert.match(html,/Preferencias del comerciante/);assert.match(html,/Talleres de Caroya/);assert.match(html,/50%/);assert.match(html,/Vender · 90 pesos/);
});
test('a rejected weapon has an explicit explanation and disabled direct and exchange controls',()=>{
 const s=field();s.armoryItems[0].condition=20;const html=render(h(Armory,{state:s,dispatch:()=>{}}));assert.match(html,/menos de 25%/);assert.match(html,/disabled="">No acepta esta arma/);
 const exchange=render(h(Exchange,{state:s,dispatch:()=>{}}));assert.match(exchange,/menos de 25%/);assert.match(exchange,/disabled="">Agregar entrega/);
});
