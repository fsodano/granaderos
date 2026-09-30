import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
const {default:Desk}=await import('../web/app/Desk.tsx');
const draw=state=>render(h(Desk,{state,dispatch(){},onClose(){}}));
test('the empty desk presents custom creation as optional and hiring as an independent start',()=>{
 const html=draw(initialCampaign(8));assert.match(html,/0 granaderos/);assert.match(html,/Retiro como único sector controlado/);assert.match(html,/Creá tu granadero · Opcional/);assert.match(html,/No necesitás crear un personaje propio/);assert.match(html,/>Examinar candidatos<\/button>/);assert.doesNotMatch(html,/La campaña empieza con tu nombre/);
});
test('a hired-only desk counts the paid soldier while keeping custom creation available',()=>{
 const s=dispatchCampaign(initialCampaign(8),{type:'recruitCivic',id:110,term:'day'});assert.equal(s.lastError,null);assert.equal(s.officer,null);const html=draw(s);assert.match(html,/1 granadero/);assert.match(html,/>Crear mi granadero<\/button>/);assert.doesNotMatch(html,/Tu hoja de servicio está firmada/);
});
test('the desk explains a one-person start and never asks for regiment funding',()=>{
 for(const state of [initialCampaign(8),dispatchCampaign(initialCampaign(8),{type:'recruitCivic',id:110,term:'day'})]){
  const html=draw(state);assert.match(html,/Con una sola persona ya podés partir/);assert.doesNotMatch(html,/Fundar el regimiento|300 pesos|20 caballos, 40 mosquetes/);
 }
});
