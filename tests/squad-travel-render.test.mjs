import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {rolePackage} from './campaign-roles-fixture.mjs';
import {operativeIdForCharacter} from '../game/content-character-ids.js';
import {initialCampaign as freshCampaign} from '../game/campaign.js';
import {dispatchCampaign} from '../game/campaign.js';
const {default:TravelStatus}=await import('../web/app/TravelStatus.tsx');
const {default:Squads}=await import('../web/app/Squads.tsx');
const {default:MedicalCare}=await import('../web/app/MedicalCare.tsx');
const order=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null);return next;};
const draw=s=>render(h(TravelStatus,{state:s,dispatch:()=>{}}));
test('route controls show the next arrival and actual return duration',()=>{
 let s=order(initialCampaign(),{type:'travel',queue:true,sector:'ensenada'});assert.match(draw(s),/Cancelar ruta/);s=order(s,{type:'advanceStrategicTime',seconds:1800});const html=draw(s);assert.match(html,/30 min hasta Celda 28,30 · Buenos Aires/);assert.match(html,/Regresar · 30 min/);assert.match(html,/Detenerse en el próximo sector/);assert.match(html,/4 h 30 min de viaje restante/);
 s=order(s,{type:'cancelTravel',choice:'return'});assert.match(draw(s),/Regresa a/);assert.doesNotMatch(draw(s),/Regresar ·/);s=order(s,{type:'advanceStrategicTime',seconds:1800});assert.equal(s.location,'retiro');assert.equal(s.hour,1);assert.equal(s.secondOfHour,0);assert.match(draw(s),/llega a Buenos Aires · Fuerte y Retiro/);assert.match(draw(s),/role="status"/);assert.doesNotMatch(draw(s),/Regresar ·/);
});
test('travelers do not appear as staff available at the departure sector',()=>{
 const s=order(initialCampaign(),{type:'travel',queue:true,sector:'buenos_aires'});const html=render(h(MedicalCare,{state:s,sectorId:'retiro',dispatch:()=>{}}));assert.doesNotMatch(html,/Dormir: Cabral/);assert.doesNotMatch(html,/Equipo para reparar de Cabral/);
});

test('squad travel advice uses the authored commander benefit only after arrival',()=>{
 const d=rolePackage(),front=operativeIdForCharacter(d,'vanguard'),engineer=operativeIdForCharacter(d,'engineer');
 let s=order(freshCampaign(42,d),{type:'recruitCivic',id:front,term:'week'});s=order(s,{type:'recruitCivic',id:engineer,term:'day'});
 const advice=()=>render(h(Squads,{state:s,dispatch:()=>{}}));
 assert.match(advice(),/2–2 de fatiga por hora/);assert.doesNotMatch(advice(),/El responsable de marcha evita/);
 s=order(s,{type:'wait',hours:6});assert.match(advice(),/El responsable de marcha evita la fatiga de viaje/);assert.doesNotMatch(advice(),/El peso extra acelera/);
 s=order(s,{type:'dismiss',id:engineer});assert.match(advice(),/2–2 de fatiga por hora/);assert.doesNotMatch(advice(),/El responsable de marcha evita/);
});
