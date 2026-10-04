import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h,act} from '../web/node_modules/react/index.js';import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {initialCampaign} from '../game/campaign.js';import {defaultContentPackage} from '../game/content-package.js';
const {default:Desk}=await import('../web/app/Desk.tsx'),{default:StrategicMap}=await import('../web/app/StrategicMap.tsx'),{default:Campaign}=await import('../web/app/Campaign.tsx');
test('the actual desk and map present authored starting control and current saved control separately',async t=>{
 const d=defaultContentPackage();d.startingTerritory.mendoza={owner:'patriot',loyalty:91};const s=initialCampaign(8,d);
 const desk=render(h(Desk,{state:s,dispatch(){},onClose(){}}));assert.match(desk,/Control inicial:.*Mendoza/);assert.doesNotMatch(desk,/Retiro como único sector/);
 const draw=()=>new JSDOM(render(h(StrategicMap,{state:s,selected:'mendoza',onSelect(){},dispatch(){}})));
 let dom=draw();assert.match(dom.window.document.querySelector('[data-map-sector="mendoza"]').getAttribute('aria-label'),/patriota/);assert.equal(dom.window.document.querySelector('.atlas-readout'),null);dom.window.close();
 // Loyalty remains available in the requested Sector panel after removal of
 // the permanent readout. Exercise the actual map click and panel render.
 const ui=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://granaderos.test',pretendToBeVisual:true});
 const globals={window:ui.window,document:ui.window.document,navigator:ui.window.navigator,requestAnimationFrame:ui.window.requestAnimationFrame.bind(ui.window),cancelAnimationFrame:ui.window.cancelAnimationFrame.bind(ui.window),IS_REACT_ACT_ENVIRONMENT:true},previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const[key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 const {createRoot}=await import('../web/node_modules/react-dom/client.js'),root=createRoot(ui.window.document.getElementById('root'));
 t.after(async()=>{try{await act(async()=>root.unmount());}finally{ui.window.close();for(const[key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}});
 await act(async()=>root.render(h(Campaign,{state:s,dispatch(){},onOpenDesk(){},onBattle(){}})));
 assert.equal(ui.window.document.querySelector('[role="dialog"]'),null);
 await act(async()=>ui.window.document.querySelector('[data-map-sector="mendoza"]').dispatchEvent(new ui.window.MouseEvent('click',{bubbles:true})));
 assert.match(ui.window.document.querySelector('[role="dialog"] .city-summary').textContent,/91% lealtad/);
 // Later saved ownership, not the pinned starting choice, must drive the map.
 s.sectors.mendoza.owner='royalist';dom=draw();assert.match(dom.window.document.querySelector('[data-map-sector="mendoza"]').getAttribute('aria-label'),/realista/);dom.window.close();
});
