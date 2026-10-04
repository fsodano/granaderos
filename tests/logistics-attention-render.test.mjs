import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign} from '../game/campaign.js';
const {default:LogisticsAttention}=await import('../web/app/LogisticsAttention.tsx');
const {default:Campaign}=await import('../web/app/Campaign.tsx');

test('production and convoy receipts remain data without exposing their former controls',()=>{
 const state=initialCampaign();
 state.logisticsNotice={hour:12,requestedHours:24,advancedHours:12,events:[{kind:'convoy',sector:'retiro',goods:{treasury:10}},{kind:'production',sector:'cordoba',name:'Maestranza',goods:{treasury:60}}]};
 const before=structuredClone(state);
 assert.equal(render(h(LogisticsAttention,{state})), '');
 const html=render(h(Campaign,{state,dispatch:()=>{},onBattle:()=>{},onOpenDesk:()=>{}}));
 assert.match(html,/aria-label="Velocidad del tiempo"/);assert.match(html,/>▶ Iniciar<\/button>/);
 assert.doesNotMatch(html,/Producción y entregas|entrega pendiente|12 de 24 horas solicitadas|Retirá o vendé|Abastecimiento/);
 assert.deepEqual(state,before,'rendering does not discard receipts or deliver old cargo');
});

test('actual artillery and older paid cargo receipts explain clock pauses without trade or production controls',()=>{
 const state=initialCampaign();state.logisticsNotice={hour:12,requestedHours:24,advancedHours:12,events:[{kind:'convoy',sector:'retiro',goods:{treasury:10}},{kind:'artillery',sector:'cordoba',id:'transfer-1',quantity:1,state:'blocked',code:'route_cut'},{kind:'equipment',sector:'ensenada',item:1802,quantity:2,state:'blocked',code:'armory_full'}]};
 const before=structuredClone(state),html=render(h(Campaign,{state,dispatch:()=>{},onBattle:()=>{},onOpenDesk:()=>{}}));
 assert.match(html,/aria-label="Traslados pendientes"/);assert.match(html,/La pieza de artillería, entrega pendiente/);assert.match(html,/equipo ya pagado sigue en espera/);assert.match(html,/reanudá el reloj/);
 assert.doesNotMatch(html,/convoy entregó|Producción y entregas|Retirá o vendé|Abastecimiento|Comprar armas/);
 const notice=render(h(LogisticsAttention,{state}));assert.doesNotMatch(notice,/<button|<input|<select/);assert.deepEqual(state,before);
 state.logisticsNotice.events=[{kind:'artillery',sector:'cordoba',id:'transfer-1',quantity:1}];const completed=render(h(LogisticsAttention,{state}));assert.match(completed,/Traslados completados/);assert.match(completed,/llegó al depósito con su munición/);assert.doesNotMatch(completed,/<button/);
});
