import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign} from '../game/campaign.js';
const {default:Recruitment}=await import('../web/app/Recruitment.tsx');

test('a blocked hiring card shows its recorded return site and repair pickup instructions',()=>{
 const s=initialCampaign();
 // Prepared display state; reducer-produced fallback and save compatibility
 // are covered by service-equipment-return.test.mjs.
 Object.assign(s.operativeState[110],{serviceEquipmentReturn:{id:'service-return-1',sectorId:'tucuman',siteId:'yatasto',entryEdge:'S',entryAnchor:{x:10,y:15}},toolkitPoints:1});
 const before=structuredClone(s),dom=new JSDOM(render(h(Recruitment,{state:s,dispatch(){assert.fail('Rendering cannot issue orders');}})));
 try{
  const card=dom.window.document.querySelector('[data-operative-id="110"]');
  assert.match(card.textContent,/Conferencia de Yatasto \(San Miguel de Tucumán · La Ciudadela\)/);
  assert.match(card.textContent,/En «Lugar», elegí «Conferencia de Yatasto»/);
  assert.match(card.textContent,/1 punto de «Materiales de reparación»/);
  assert.equal([...card.querySelectorAll('button')].find(button=>button.textContent.startsWith('Contratar')).disabled,true);
  assert.doesNotMatch(dom.window.document.querySelector('[data-operative-id="100"]').textContent,/equipo que dejó|Materiales de reparación/);
  assert.deepEqual(s,before);
 }finally{dom.window.close();}
});
