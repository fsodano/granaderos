import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {secureArea} from './secured-area-fixture.mjs';
const {default:LogisticsAttention}=await import('../web/app/LogisticsAttention.tsx');
const {default:Campaign}=await import('../web/app/Campaign.tsx');
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null);return n;};
// The paid cargo is real; a prepared due time isolates the display boundary.
const queued=()=>{const s=order(secureArea(initialCampaign()),{type:'purchaseEquipment',item:1802});s.equipmentShipments[0].due=12;return s;};
const completed=()=>order(queued(),{type:'wait',hours:24});
test('the operations map shows the delivered quantity and exact stopped duration beside the clock',()=>{
 const html=render(h(Campaign,{state:completed(),dispatch:()=>{},onBattle:()=>{},onOpenDesk:()=>{}}));
 assert.match(html,/aria-label="Tiempo a avanzar"/);assert.match(html,/aria-label="Producción y entregas completadas"/);assert.match(html,/12 de 24 horas solicitadas/);assert.match(html,/llegaron 1/);assert.match(html,/Ensenada/);assert.match(html,/aria-live="polite"/);assert.match(html,/Ya se completó la producción o entrega/);
});
test('receipts distinguish a local depot, general reserve and the armory, and escape task names',()=>{
 // Prepared receipt variants test presentation and escaping, not new production.
 const s=completed();s.logisticsNotice.events=[{kind:'convoy',sector:'retiro',goods:{treasury:10}},{kind:'convoy',sector:'reserve',goods:{treasury:5}},{kind:'equipment',sector:'ensenada',item:1802,quantity:2},{kind:'shipment',sector:'ensenada',goods:{treasury:7}},{kind:'production',sector:'cordoba',name:'<script>unsafe</script>',goods:{treasury:60}}];
 const html=render(h(LogisticsAttention,{state:s}));assert.match(html,/Retiro: el convoy entregó 10 pesos de plata/);assert.match(html,/la reserva de Retiro/);assert.match(html,/sala de armas/);assert.match(html,/7 pesos de plata/);assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);
});
test('acknowledged notices disappear on the next explicit wait without an extra delivery control',()=>{
 const s=dispatchCampaign(completed(),{type:'wait',hours:1});assert.equal(render(h(LogisticsAttention,{state:s})), '');
 assert.doesNotMatch(render(h(LogisticsAttention,{state:completed()})),/<button/);
});
test('the operations map explains a blocked delivery without claiming arrival and permits ordinary continuation',()=>{
 let s=queued();s.equipmentShipments[0].due=0;s.sectors.ensenada.owner='royalist';s=order(s,{type:'wait',hours:24});
 const html=render(h(Campaign,{state:s,dispatch:()=>{},onBattle:()=>{},onOpenDesk:()=>{}}));
 assert.match(html,/aria-label="Producción y entregas pendientes"/);assert.match(html,/0 de 24 horas solicitadas/);assert.match(html,/entrega pendiente/);assert.match(html,/control realista/);assert.match(html,/Los pedidos pendientes siguen en espera/);assert.match(html,/mismo bloqueo no repetirá/);assert.doesNotMatch(html,/Ya se completó la producción o entrega/);
 const continued=dispatchCampaign(s,{type:'wait',hours:1});assert.equal(continued.hour,1);assert.equal(render(h(LogisticsAttention,{state:continued})), '');
});
test('mixed receipts show the completed quantity alongside the separate obstruction',()=>{
 const s=completed();s.logisticsNotice.events.push({kind:'equipment',sector:'ensenada',item:1802,quantity:2,state:'blocked',code:'armory_full'});
 const html=render(h(LogisticsAttention,{state:s}));assert.match(html,/llegaron 1/);assert.match(html,/no tiene espacio/);assert.match(html,/Retirá o vendé/);assert.doesNotMatch(html,/llegaron 2/);assert.match(html,/entrega pendiente/);
});
