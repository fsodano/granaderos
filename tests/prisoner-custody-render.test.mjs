import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign} from '../game/campaign.js';
const {default:EnemyEncounters}=await import('../web/app/EnemyEncounters.tsx');
test('prisoner panel distinguishes paused, expired and permanent service without offering remote equipment access',()=>{
 for(const expiresAt of [24,18,null]){
  const s=initialCampaign();s.hour=72;Object.assign(s.operativeState[112],{captured:true,capturedSector:'tucuman',capturedAt:18,hp:11,maxHp:64,capturedContract:{expiresAt}});
  const html=render(h(EnemyEncounters,{state:s,dispatch(){}}));assert.match(html,/11\/64 salud/);assert.match(html,/54.*h en cautiverio/);assert.match(html,/equipo capturado no está disponible/);assert.match(html,/Estado crítico/);
  assert.match(html,expiresAt===null?/Servicio sin vencimiento/:expiresAt===18?/Requiere una nueva contratación/:/quedan 6 h de servicio/);
 }
});
