import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign} from '../game/campaign.js';
const {default:Panel}=await import('../web/app/MerchantExchange.tsx');
const {default:Armory}=await import('../web/app/Armory.tsx');
test('the armory contains a clearly labelled two-sided exchange with no immediate transaction',()=>{
 const s=dispatchCampaign(initialCampaign(),{type:'purchaseEquipment',item:1803}),before=structuredClone(s),html=render(h(Armory,{state:s,dispatch:()=>{throw Error('render must not trade');}}));
 assert.match(html,/Intercambiar equipo/);assert.match(html,/Equipo que entregás/);assert.match(html,/Equipo que recibís/);assert.match(html,/Nada cambia hasta confirmar/);assert.match(html,/disabled="">Confirmar intercambio/);assert.deepEqual(s,before);
});
test('a cash-poor trader can still propose goods, and import orders are excluded from local exchange',()=>{
 const s=dispatchCampaign(initialCampaign(),{type:'purchaseEquipment',item:1803});s.resources.treasury=0;s.merchants.retiro.cash=0;
 const html=render(h(Panel,{state:s,dispatch:()=>{}}));assert.match(html,/Agregar entrega/);assert.match(html,/Agregar compra/);assert.match(html,/buy:new:1804/);assert.doesNotMatch(html,/buy:new:1800|buy:new:1802/);
});
