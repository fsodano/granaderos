import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign,CAMPAIGN_SECTORS} from '../game/campaign.js';
import {TOWN_INCOME_SOURCES,initializeTownIncome,activateTownIncome,townIncomeSources} from '../game/town-income.js';
const {default:SectorIncome,SectorIncomeTable}=await import('../web/app/SectorIncome.tsx');
const definition=id=>CAMPAIGN_SECTORS.find(d=>d.id===id);
function controlled(){const s=initialCampaign();for(const source of TOWN_INCOME_SOURCES)for(const id of source.requiredSectors)s.sectors[id].owner='patriot';initializeTownIncome(s);return s;}
function active(){const s=controlled();for(const source of TOWN_INCOME_SOURCES){const {npcId,sectorId}=source.representative;s.conversations[npcId]={met:true,hour:s.hour,secondOfHour:s.secondOfHour??0,sector:sectorId,lastApproach:'friendly'};assert.equal(activateTownIncome(s,{npcId,sectorId,approach:'friendly'}).applied,true);}return s;}

test('controlled ports show the physical conversation requirement without an activation control',()=>{
 const state=controlled(),before=structuredClone(state),html=render(h(SectorIncome,{state,definition:definition('buenos_aires')}));
 assert.match(html,/0 pesos por día/);assert.match(html,/8\.000 pesos/);assert.match(html,/Administrador del puerto/);assert.match(html,/entrá al sector y hablá/);assert.match(html,/amable o directa/);assert.match(html,/medianoche/);
 assert.doesNotMatch(html,/<button|Más lealtad|Daños|Bloqueo|abastecimiento/);assert.deepEqual(state,before);
 state.sectors.retiro.owner='royalist';const occupied=render(h(SectorIncome,{state,definition:definition('buenos_aires')}));assert.match(occupied,/Falta controlar:[^<]*Retiro/);
 const rural=render(h(SectorIncome,{state,definition:definition('cordoba')}));assert.match(rural,/no genera ingresos diarios/);
});
test('the map counts each flat port agreement once and suspends it on loss of required control',()=>{
 const state=active();state.blockade=true;state.sectors.ensenada.damageUntil=24;for(const sector of Object.values(state.sectors))sector.loyalty=0;
 const sources=townIncomeSources(state),html=render(h(SectorIncomeTable,{state,onSelect(){}}));
 assert.equal((html.match(/<tbody>.*?<\/tbody>/)?.[0].match(/<tr>/g)||[]).length,3);
 for(const source of sources){assert.ok(html.includes(source.source));assert.ok(html.includes(source.representative.name));assert.ok(html.includes(`<td>${source.base}</td><td>${source.daily}</td>`));}
 assert.match(html,/<td>17000<\/td><td>Cobro a medianoche/);assert.doesNotMatch(html,/Lealtad local|Daños|Bloqueo|reducciones|>Retiro<\/button>/);
 const shared=render(h(SectorIncome,{state,definition:definition('retiro')}));assert.match(shared,/comparte el acuerdo de Buenos Aires/);assert.match(shared,/no genera otro cobro/);
 state.sectors.retiro.owner='royalist';const suspended=render(h(SectorIncomeTable,{state,onSelect(){}}));assert.match(suspended,/Suspendida: falta control total/);assert.match(suspended,/<td>9000<\/td><td>Cobro a medianoche/);
});
