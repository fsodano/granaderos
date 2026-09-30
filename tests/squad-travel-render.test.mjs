import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign} from '../game/campaign.js';
const {default:TravelStatus}=await import('../web/app/TravelStatus.tsx');
const {default:MedicalCare}=await import('../web/app/MedicalCare.tsx');
const order=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null);return next;};
const draw=s=>render(h(TravelStatus,{state:s,dispatch:()=>{}}));
test('route controls show the next arrival and actual return duration',()=>{
 let s=order(initialCampaign(),{type:'travel',queue:true,sector:'ensenada'});assert.match(draw(s),/Cancelar ruta/);s=order(s,{type:'wait',hours:5});const html=draw(s);assert.match(html,/7 h hasta Buenos Aires/);assert.match(html,/Regresar · 5 h/);assert.match(html,/Detenerse en el próximo sector/);assert.match(html,/19 h de viaje restante/);
 s=order(s,{type:'cancelTravel',choice:'return'});assert.match(draw(s),/Regresa a/);assert.doesNotMatch(draw(s),/Regresar ·/);s=order(s,{type:'wait',hours:24});assert.match(draw(s),/llega a Buenos Aires · Fuerte y Retiro/);assert.match(draw(s),/role="status"/);assert.doesNotMatch(draw(s),/Regresar ·/);
});
test('travelers do not appear as staff available at the departure sector',()=>{
 const s=order(initialCampaign(),{type:'travel',queue:true,sector:'buenos_aires'});const html=render(h(MedicalCare,{state:s,sectorId:'retiro',dispatch:()=>{}}));assert.doesNotMatch(html,/Dormir: Cabral/);assert.doesNotMatch(html,/Equipo para reparar de Cabral/);
});
