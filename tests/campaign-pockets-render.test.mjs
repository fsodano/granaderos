import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';import {sectorInventoryModel} from '../game/sector-inventory.js';import {equipmentFingerprint} from '../game/tactical-inventory.js';
const {default:SectorInventory}=await import('../web/app/SectorInventory.tsx');
const fresh=()=>dispatchCampaign(initialCampaign(8),{type:'recruitCivic',id:110,term:'week'});
const draw=s=>render(h(SectorInventory,{state:s,sectorId:'retiro',dispatch:()=>{}}));
test('campaign exposes the same twelve pockets and hand drag endpoints before a tactical visit',()=>{
 let s=fresh(),html=draw(s);assert.match(html,/Organizar equipo llevado/);assert.equal((html.match(/data-equipment-slot=/g)||[]).length,14);assert.match(html,/Segunda mano: Ocupada por el arma/);
 const u=sectorInventoryModel(s,'retiro',rosterFor(s),110).personal;
 s=dispatchCampaign(s,{type:'sectorInventory',sector:'retiro',operativeId:110,direction:'arrange',kind:'equipment',sourceId:'hand:right',destinationId:'large-4',expectedSource:equipmentFingerprint(u,'hand:right'),expectedDestination:equipmentFingerprint(u,'large-4')});assert.equal(s.lastError,null);
 html=draw(s);assert.match(html,/Mano principal: Vacía/);assert.match(html,/Bolsillo grande 4: Brown Bess modelo India · 1/);assert.match(html,/Primero reconocé y asegurá el sector/);
 assert.equal((html.match(/data-equipment-slot=/g)||[]).length,14);
});
test('sleeping soldiers retain visible contents but every drag endpoint is disabled',()=>{
 const s=fresh();s.operativeState[110].asleep=true;const html=draw(s),buttons=html.match(/<button[^>]*data-equipment-slot=[^>]*>/g)||[];
 assert.equal(buttons.length,14);assert.ok(buttons.every(button=>button.includes('disabled=""')));assert.match(html,/consciente, despierto y presente/);
});
