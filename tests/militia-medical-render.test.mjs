import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';import {prepareGarrison} from '../game/garrison.js';import {dispatchCampaign} from '../game/campaign.js';
const {default:MedicalCare}=await import('../web/app/MedicalCare.tsx');
function field(){const s=initialCampaign();s.sectors.retiro.militia=[3,0,0];prepareGarrison(s,'retiro');Object.assign(s.garrisons.retiro[0],{hp:20,bleeding:4,bandaged:0});return s;}
const draw=s=>render(h(MedicalCare,{state:s,sectorId:'retiro',dispatch:()=>{}}));
test('medical controls expose the militia assignment and recorded defender wounds',()=>{
 const text=draw(field());assert.match(text,/<option value="militia_doctor"[^>]*>Médico de milicias<\/option>/);assert.match(text,/Atención de las milicias/);assert.match(text,/Salud 20\/60/);assert.match(text,/Hemorragia 4/);assert.match(text,/Asigná a un combatiente presente/);
});
test('militia doctor status distinguishes working, unavailable supplies and deployed defenders',()=>{
 let s=dispatchCampaign(field(),{type:'assignCare',operativeId:10,assignment:'militia_doctor'});assert.equal(s.lastError,null);assert.match(draw(s),/Atención a cargo de/);
 s.operativeState[10].medkits=0;assert.match(draw(s),/Los médicos asignados no pueden trabajar/);
 for(const u of s.garrisons.retiro)Object.assign(u,{hp:u.maxHp,bleeding:0,bandaged:0});assert.match(draw(s),/Sin milicianos heridos disponibles en este sector/);assert.doesNotMatch(draw(s),/Atención detenida: El médico no tiene botiquines/);
 s.pendingBattle={sector:'retiro',squad:[]};assert.match(draw(s),/espera hasta el regreso del despliegue/);
});
