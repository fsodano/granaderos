import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {initialCampaign} from '../game/campaign.js';import {defaultContentPackage} from '../game/content-package.js';
const {default:Desk}=await import('../web/app/Desk.tsx'),{default:StrategicMap}=await import('../web/app/StrategicMap.tsx');
test('the actual desk and map present authored starting control and current saved control separately',()=>{
 const d=defaultContentPackage();d.startingTerritory.mendoza={owner:'patriot',loyalty:91};const s=initialCampaign(8,d);
 const desk=render(h(Desk,{state:s,dispatch(){},onClose(){}}));assert.match(desk,/Control inicial:.*Mendoza/);assert.doesNotMatch(desk,/Retiro como único sector/);
 const draw=()=>new JSDOM(render(h(StrategicMap,{state:s,selected:'mendoza',onSelect(){},dispatch(){}})));
 let dom=draw();assert.match(dom.window.document.querySelector('[data-map-sector="mendoza"]').getAttribute('aria-label'),/patriota/);assert.match(dom.window.document.body.textContent,/91%/);dom.window.close();
 // Later saved ownership, not the pinned starting choice, must drive the map.
 s.sectors.mendoza.owner='royalist';dom=draw();assert.match(dom.window.document.querySelector('[data-map-sector="mendoza"]').getAttribute('aria-label'),/realista/);dom.window.close();
});
