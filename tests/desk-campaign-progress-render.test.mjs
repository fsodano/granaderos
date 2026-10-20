import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h,act} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {defaultCampaignStory} from '../game/campaign-story.js';
import {encodeSave,decodeSave} from '../game/save.js';
const {default:Desk}=await import('../web/app/Desk.tsx');
const draw=state=>render(h(Desk,{state,dispatch(){assert.fail('viewing the desk must not dispatch');},onClose(){}}));
const opening=/Reuní tu primera escuadra|Empezás con .* como único sector controlado|Tu hoja de servicio está firmada|<strong>Reuní tu escuadra/;

test('the day-seven desk reports the current force and territory while retaining the Yatasto briefing',()=>{
 const s=initialCampaign(8),ids=rosterFor(s).slice(0,17).map(o=>o.id);s.hour=153;s.phase=2;s.flags.sanLorenzo=true;s.recruited=ids;
 for(const [index,id]of ids.entries())Object.assign(s.operativeState[id],{alive:index<7,hp:index<7?100:0});
 for(const id of ['buenos_aires','san_nicolas','ensenada','santa_fe','cordoba'])s.sectors[id].owner='patriot';
 const before=structuredClone(s),html=draw(s);
 assert.match(html,/DÍA 7/);assert.match(html,/La campaña está en marcha/);assert.match(html,/Control actual: 6 de \d+ sectores/);
 assert.match(html,/7 combatientes en servicio · 10 caídos/);assert.match(html,/Personal y contratos/);assert.match(html,/class="desk-checklist desk-progress"/);assert.match(html,/Visitar la posta de Yatasto/);assert.match(html,/Conferencia de Yatasto/);
 assert.doesNotMatch(html,opening);assert.deepEqual(s,before);
 // Losing all active people cannot reset the campaign's instructions.
 for(const id of ids)Object.assign(s.operativeState[id],{alive:false,hp:0});
 const empty=draw(s);assert.match(empty,/0 combatientes en servicio · 17 caídos/);assert.doesNotMatch(empty,opening);
});

test('first service replaces the guide and the same overview survives save reload',()=>{
 const s=dispatchCampaign(initialCampaign(8),{type:'recruitCivic',id:110,term:'week'});assert.equal(s.lastError,null);
 for(const state of [s,decodeSave(encodeSave(s)).campaign]){
  const html=draw(state);assert.match(html,/La campaña está en marcha/);assert.match(html,/1 combatiente en servicio · 0 caídos/);assert.doesNotMatch(html,opening);
  assert.match(html,/Crear mi personaje/);assert.match(html,/Con una sola persona ya podés partir/);
 }
});

test('an empty later roster keeps a current overview in a chapterless campaign',()=>{
 const d=defaultContentPackage();Object.assign(d,{scenario:'generic-v1',includeOriginalResidents:false,campaignStory:null,errands:[],roadsideDiscoveries:[],placements:[],quests:[],campaignRoles:{foundryEngineer:null,marchCommander:null}});
 d.characters=d.characters.filter(c=>c.id==='person-110');Object.assign(d.characters[0],{traits:[],abilities:[],recruitmentSource:'contract',service:'contract',progression:'experience'});delete d.foundry;
 let s=initialCampaign(8,d);s=dispatchCampaign(s,{type:'recruitCivic',id:rosterFor(s)[0].id,term:'day'});assert.equal(s.lastError,null);assert.equal(s.phase,0);
 // The first wait stops at the contract warning, two hours before expiry.
 s=dispatchCampaign(s,{type:'wait',hours:24});assert.equal(s.lastError,null);
 s=dispatchCampaign(s,{type:'wait',hours:2});assert.equal(s.lastError,null);assert.equal(s.recruited.length,0);assert.equal(s.officer,null);assert.equal(s.completed,false);
 const html=draw(decodeSave(encodeSave(s)).campaign);assert.match(html,/La campaña está en marcha/);assert.match(html,/0 combatientes en servicio/);assert.doesNotMatch(html,opening);
});

test('fallen service members stay counted after contract expiry without counting never-hired deaths',()=>{
 let s=dispatchCampaign(initialCampaign(8),{type:'recruitCivic',id:110,term:'day'});assert.equal(s.lastError,null);
 Object.assign(s.operativeState[110],{alive:false,hp:0});
 // A candidate or resident who never served is not a casualty of this force.
 Object.assign(s.operativeState[114],{alive:false,hp:0});
 assert.match(draw(s),/0 combatientes en servicio · 1 caído/);
 s=dispatchCampaign(s,{type:'wait',hours:24});assert.equal(s.lastError,null);assert.ok(!s.recruited.includes(110));
 for(const state of [s,decodeSave(encodeSave(s)).campaign]){const html=draw(state);assert.match(html,/0 combatientes en servicio · 1 caído/);assert.doesNotMatch(html,opening);}
});

test('authored introductions stay at the start and later objectives and endings replace them',()=>{
 const d=defaultContentPackage();d.includeOriginalResidents=true;d.campaignStory={...defaultCampaignStory(),introduction:'Protegé la correspondencia.',victory:'El correo está a salvo.',defeat:'Se perdió el correo.'};
 d.campaignStory.chapters=[{id:'first',name:'Primer tramo',objective:'Llegá al segundo día.',conditions:[{type:'day',min:2,max:null}]},{id:'second',name:'Segundo tramo',objective:'Llegá al tercer día.',conditions:[{type:'day',min:3,max:null}]}];
 const fresh=initialCampaign(8,d);assert.match(draw(fresh),/Protegé la correspondencia/);
 // Waiting before any recruitment or chapter completion is still preparation.
 const waiting=dispatchCampaign(fresh,{type:'wait',hours:1});assert.match(draw(waiting),/Protegé la correspondencia/);
 const next=dispatchCampaign(fresh,{type:'wait',hours:24}),nextHtml=draw(next);assert.equal(next.phase,0);assert.match(nextHtml,/Segundo tramo/);assert.match(nextHtml,/La campaña está en marcha/);assert.doesNotMatch(nextHtml,/Protegé la correspondencia/);
 const finished=dispatchCampaign(next,{type:'wait',hours:24}),finishedHtml=draw(finished);assert.equal(finished.completed,true);assert.match(finishedHtml,/Campaña concluida/);assert.match(finishedHtml,/El correo está a salvo/);assert.doesNotMatch(finishedHtml,/Llegá al tercer día|Protegé la correspondencia/);
 const lost=structuredClone(fresh);lost.sectors.retiro.owner='royalist';const failed=dispatchCampaign(lost,{type:'wait',hours:1});assert.equal(failed.defeated,true);const failedHtml=draw(failed);assert.match(failedHtml,/Campaña terminada/);assert.match(failedHtml,/Se perdió el correo/);assert.doesNotMatch(failedHtml,/Protegé la correspondencia/);
});

test('the current overview still opens recruitment, optional character creation, and the map',async t=>{
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://granaderos.test',pretendToBeVisual:true});
 const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,IS_REACT_ACT_ENVIRONMENT:true},previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 const {createRoot}=await import('../web/node_modules/react-dom/client.js'),root=createRoot(dom.window.document.getElementById('root'));let closed=0;
 t.after(async()=>{try{await act(async()=>root.unmount());}finally{dom.window.close();for(const [key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}});
 const state=dispatchCampaign(initialCampaign(8),{type:'recruitCivic',id:110,term:'week'}),before=structuredClone(state);
 await act(async()=>root.render(h(Desk,{state,dispatch(){assert.fail('navigation must not dispatch');},onClose(){closed++;}})));
 const click=async text=>{const button=[...dom.window.document.querySelectorAll('button')].find(b=>b.textContent===text);assert.ok(button,text);await act(async()=>button.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));};
 const selected=()=>dom.window.document.querySelector('[aria-label="Carpetas del escritorio"] [aria-current="page"]').textContent;
 await click('Examinar candidatos');assert.equal(selected(),'Contrataciones');
 await click('Resumen');await click('Crear mi personaje');assert.equal(selected(),'Tu personaje');
 await click('Resumen');await click('Abrir la carta');assert.equal(closed,1);assert.deepEqual(state,before);
});
