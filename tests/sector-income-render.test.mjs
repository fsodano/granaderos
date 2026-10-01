import {secureArea} from './secured-area-fixture.mjs';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign,dispatchCampaign,CAMPAIGN_SECTORS} from '../game/campaign.js';
const {default:SectorIncome,SectorIncomeTable}=await import('../web/app/SectorIncome.tsx');

test('sector panel shows loyalty, the economic base, actual contribution and all disruptions',()=>{
 const state=secureArea(initialCampaign());state.blockade=true;state.sectors.ensenada.damageUntil=24;
 const html=render(h(SectorIncome,{state,definition:CAMPAIGN_SECTORS.find(d=>d.id==='ensenada')}));
 for(const text of ['6 pesos','base 160','Lealtad local: 65%','Daños: conserva el 25%','Bloqueo: conserva el 25%','medianoche'])assert.ok(html.includes(text),text);
});
test('map income table lists every economic source once and matches the daily payment',()=>{
 const state=secureArea(initialCampaign());state.hour=23;const paid=dispatchCampaign(state,{type:'wait',hours:1});
 const html=render(h(SectorIncomeTable,{state,onSelect(){}}));
 assert.equal((html.match(/<tbody>.*?<\/tbody>/)?.[0].match(/<tr>/g)||[]).length,CAMPAIGN_SECTORS.length);
 assert.ok(html.includes(`<td>${paid.resources.treasury-state.resources.treasury}</td><td>Antes de gastos</td>`));assert.match(html,/Lealtad local/);assert.match(html,/Ocupación realista/);assert.match(html,/>Retiro<\/button>/);assert.match(html,/>Buenos Aires<\/button>/);
});
