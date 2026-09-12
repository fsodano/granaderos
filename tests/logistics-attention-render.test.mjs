import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
const {default:LogisticsAttention}=await import('../web/app/LogisticsAttention.tsx');
const {default:Campaign}=await import('../web/app/Campaign.tsx');
const completed=()=>dispatchCampaign(dispatchCampaign(initialCampaign(),{type:'produce',recipe:'cartridges'}),{type:'wait',hours:24});
test('the operations map shows the delivered quantity and exact stopped duration beside the clock',()=>{
 const html=render(h(Campaign,{state:completed(),dispatch:()=>{},onBattle:()=>{},onOpenDesk:()=>{}}));
 assert.match(html,/aria-label="Tiempo a avanzar"/);assert.match(html,/aria-label="Producción y entregas completadas"/);assert.match(html,/12 de 24 horas solicitadas/);assert.match(html,/60 cartuchos/);assert.match(html,/Retiro/);assert.match(html,/aria-live="polite"/);assert.match(html,/Ya se completó la producción o entrega/);
});
test('receipts distinguish a local depot, general reserve and the armory, and escape task names',()=>{
 const s=completed();s.logisticsNotice.events=[{kind:'convoy',sector:'retiro',goods:{muskets:10}},{kind:'convoy',sector:'reserve',goods:{powder:5}},{kind:'equipment',sector:'ensenada',item:1802,quantity:2},{kind:'shipment',sector:'ensenada',goods:{textiles:7}},{kind:'production',sector:'cordoba',name:'<script>unsafe</script>',goods:{cartridges:60}}];
 const html=render(h(LogisticsAttention,{state:s}));assert.match(html,/Retiro: el convoy entregó 10 mosquetes/);assert.match(html,/la reserva de Buenos Aires/);assert.match(html,/sala de armas/);assert.match(html,/7 textiles/);assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);
});
test('acknowledged notices disappear on the next explicit wait without an extra delivery control',()=>{
 const s=dispatchCampaign(completed(),{type:'wait',hours:1});assert.equal(render(h(LogisticsAttention,{state:s})), '');
 assert.doesNotMatch(render(h(LogisticsAttention,{state:completed()})),/<button/);
});
