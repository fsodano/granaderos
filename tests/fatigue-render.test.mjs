import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
const {default:MedicalCare}=await import('../web/app/MedicalCare.tsx');
const {default:Squads}=await import('../web/app/Squads.tsx');
test('personnel displays current and maximum energy and explains the fatigue limit',()=>{
 const state=initialCampaign();Object.assign(state.operativeState[3],{energy:45,fatigue:40});const html=render(h(MedicalCare,{state,sectorId:'retiro',dispatch:()=>{}}));assert.match(html,/45\/60/);assert.match(html,/La fatiga limita la energía máxima/);
});
test('squad orders show physical effort before marching and actual energy capacity',()=>{
 const state=initialCampaign();Object.assign(state.operativeState[3],{energy:45,fatigue:40});const html=render(h(Squads,{state,dispatch:()=>{}}));assert.match(html,/Terreno llano: 2–2 de fatiga por hora/);assert.match(html,/45\/60 · Fatiga 40/);assert.match(html,/El peso extra acelera el agotamiento a pie/);
});
