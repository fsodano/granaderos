import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {actBattle} from '../game/tactical.js';
const {default:SectorInventory}=await import('../web/app/SectorInventory.tsx');
function ready(){let s=dispatchCampaign(initialCampaign(45),{type:'visitSector'});let b=enterSector(s.pendingBattle);b=actBattle(b,{type:'drop',unitId:'4',item:'medkits',count:2});assert.equal(b.lastError,null);s=dispatchCampaign(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});assert.equal(s.lastError,null);return s;}
const draw=s=>render(h(SectorInventory,{state:s,sectorId:'retiro',dispatch:()=>{}}));
test('sector equipment renders discovered quantities with labelled selection and pickup controls',()=>{
 const html=draw(ready());assert.match(html,/aria-label="Equipo del sector"/);assert.match(html,/aria-label="Combatiente para el equipo del sector"/);assert.match(html,/Vendas · 2/);assert.match(html,/aria-label="Recoger 1: cantidad de Vendas"/);assert.match(html,/min="1" max="2" step="1"/);assert.match(html,/aria-label="Recoger 1: Vendas"/);assert.match(html,/aria-label="Equipo llevado"/);assert.match(html,/aria-label="Dejar 1:/);
});
test('occupied or unscouted sectors explain why pickup is unavailable',()=>{
 const s=ready();s.sectors.retiro.owner='royalist';let html=draw(s);assert.match(html,/role="status"/);assert.match(html,/bajo control patriota/);assert.match(html,/<button[^>]*disabled=""[^>]*aria-label="Recoger 1: Vendas"/);
 html=draw(initialCampaign());assert.match(html,/Primero reconocé y asegurá el sector/);assert.match(html,/No hay equipo descubierto/);
});
