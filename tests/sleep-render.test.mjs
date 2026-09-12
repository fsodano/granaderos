import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
const {default:MedicalCare}=await import('../web/app/MedicalCare.tsx');
const draw=state=>render(h(MedicalCare,{state,sectorId:'retiro',dispatch:()=>{}}));
test('personnel offers independent sleep and wake controls with the preserved assignment',()=>{
 const s=initialCampaign();Object.assign(s.operativeState[3],{assignment:'practice',trainingSkill:'mechanical',energy:40,asleep:true});
 const html=draw(s);assert.match(html,/aria-label="Despertar: Cabral"/);assert.match(html,/value="practice"[^>]* selected=""/);assert.match(html,/Durmiendo/);assert.match(html,/retoma su tarea al recuperarse/);
 assert.match(html,/aria-label="Dormir: Dorrego" disabled="" title="No está cansado/);
});
test('pending contact disables sleep controls until the encounter is resolved',()=>{
 const s=initialCampaign();s.operativeState[3].energy=40;s.pendingEncounter={groupId:'contact'};assert.match(draw(s),/aria-label="Dormir: Cabral" disabled=""/);
});

test('collapsed personnel show the recovery requirement and cannot use the wake button',()=>{
 const s=initialCampaign();Object.assign(s.operativeState[3],{fatigue:80,energy:20,asleep:true,sleepCollapsed:true});let html=draw(s);assert.match(html,/aria-label="Despertar: Cabral" disabled="" title="El agotamiento impide despertar/);assert.match(html,/no puede despertar hasta recuperar 60/);
 Object.assign(s.operativeState[3],{fatigue:40,energy:60,sleepCollapsed:false});html=draw(s);assert.match(html,/aria-label="Despertar: Cabral" title=/);assert.doesNotMatch(html,/no puede despertar hasta recuperar 60/);
});

test('personnel shows the individual wound-adjusted rate and its source before ordering sleep',()=>{
 const s=initialCampaign();Object.assign(s.operativeState[3],{hp:23,bandaged:73,energy:40,fatigue:40,asleep:true});const html=draw(s);
 assert.match(html,/Necesidad de sueño: 12 h de referencia · base 8 \+ 4 por heridas/);assert.match(html,/Descanso: \+8 energía\/h · −5 fatiga\/h/);assert.match(html,/Durmiendo · \+8 energía\/h · −5 fatiga\/h/);
});
