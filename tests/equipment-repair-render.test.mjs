import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
const {default:MedicalCare}=await import('../web/app/MedicalCare.tsx');
const draw=state=>render(h(MedicalCare,{state,sectorId:'retiro',dispatch:()=>{}}));

test('new personnel controls default to carried equipment and show the actual damaged tool queue',()=>{
  const state=initialCampaign();state.operativeState[10].inventory={pliers:{itemType:'tool',toolKey:'pliers',condition:61,count:1,weight:.4}};
  const before=structuredClone(state),markup=draw(state);
  assert.match(markup,/value="equipment" selected="">Todo el equipo llevado/);
  assert.match(markup,/Orden de reparación de Paroissien/);assert.match(markup,/Alicates · 61%/);
  assert.match(markup,/Secundaria → principal y bayoneta → mochila/);assert.deepEqual(state,before);
});

test('legacy gun-only assignments retain their saved scope instead of silently expanding their work',()=>{
  const state=initialCampaign();Object.assign(state.operativeState[10],{assignment:'repair',repairTargetId:4,repairWeaponId:1808,toolkitPoints:100});state.operativeState[4].condition=80;
  assert.match(draw(state),/value="primary" selected="">Solo el arma principal actual/);
});
