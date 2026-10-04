import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h,act} from '../web/node_modules/react/index.js';import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {worldCell} from '../game/world-cells.js';
import {initialCampaign as freshCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
const {default:Campaign}=await import('../web/app/Campaign.tsx');
const {default:StrategicMap}=await import('../web/app/StrategicMap.tsx');
const {default:StrategicRoster}=await import('../web/app/StrategicRoster.tsx');
const noop=()=>{};
test('fresh command screen has an empty squad, recruitment access and a visible clock',()=>{
 const html=render(h(Campaign,{state:freshCampaign(),dispatch:noop,onBattle:noop,onOpenDesk:noop}));
 assert.match(html,/0 soldados/);assert.match(html,/Crear o contratar/);assert.match(html,/Velocidad del tiempo/);assert.match(html,/>▶ Iniciar<\/button>/);assert.match(html,/Creá tu oficial o contratá soldados/);assert.doesNotMatch(html,/data-squad-route/);
});
test('resumed routes stay visible on the map and roster while order panels start closed',()=>{
 let s=dispatchCampaign(initialCampaign(),{type:'travel',sector:'ensenada',queue:true});s=dispatchCampaign(s,{type:'wait',hours:5});assert.equal(s.lastError,null);
 const html=render(h(Campaign,{state:s,dispatch:noop,onBattle:noop,onOpenDesk:noop}));assert.match(html,/data-squad-route="squad-1"/);assert.ok(html.includes(`${worldCell('ensenada').grid}<small>19 h`));assert.doesNotMatch(html,/Regresar · 5 h/);assert.doesNotMatch(html,/role="dialog"/);assert.doesNotMatch(html,/class="strategy-orders"/);assert.match(html,/data-travel-presence="squad-1"/);assert.doesNotMatch(html,/atlas-squad-marker/);
});
test('map draft is a separate path and has no dispatch side effects',()=>{
 const s=initialCampaign(),before=structuredClone(s),actions=[];
 const html=render(h(StrategicMap,{state:s,selected:'ensenada',onSelect:noop,dispatch:a=>actions.push(a),onSquad:noop,plotting:true,previewPath:['retiro','buenos_aires','ensenada']}));
 assert.match(html,/data-route-preview="true"/);assert.doesNotMatch(html,/data-squad-route/);assert.deepEqual(actions,[]);assert.deepEqual(s,before);
});
test('plotting keeps travel presence dots from replacing a destination while marching troops remain selectable',async t=>{
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://granaderos.test'});
 const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,IS_REACT_ACT_ENVIRONMENT:true};
 const previous=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 for(const[k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v});
 const {createRoot}=await import('../web/node_modules/react-dom/client.js');
 const root=createRoot(dom.window.document.getElementById('root'));
 t.after(async()=>{try{await act(async()=>root.unmount());}finally{dom.window.close();for(const[k,d]of previous){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}}});
 const state=dispatchCampaign(initialCampaign(),{type:'travel',sector:'ensenada',queue:true}),before=structuredClone(state),squads=[],destinations=[],actions=[];assert.equal(state.lastError,null);
 const props={state,selected:state.location,onSelect:id=>destinations.push(id),dispatch:a=>actions.push(a),onSquad:id=>squads.push(id)};
 const fire=async(element,event)=>{assert.ok(element);await act(async()=>element.dispatchEvent(event));};
 const click=element=>fire(element,new dom.window.MouseEvent('click',{bubbles:true}));
 const key=(element,value)=>fire(element,new dom.window.KeyboardEvent('keydown',{key:value,bubbles:true}));
 const marker=()=>dom.window.document.querySelector('.atlas-travel-presence');
 await act(async()=>root.render(h(StrategicMap,props)));
 assert.equal(marker().getAttribute('role'),'button');assert.equal(marker().getAttribute('tabindex'),'0');assert.notEqual(marker().getAttribute('pointer-events'),'none');
 await click(marker());await key(marker(),'Enter');await key(marker(),' ');
 assert.deepEqual(squads,[state.activeSquadId,state.activeSquadId,state.activeSquadId]);assert.deepEqual(destinations,[]);
 await act(async()=>root.render(h(StrategicMap,{...props,plotting:true,previewPath:[state.location,'cell-27-27']})));
 assert.equal(marker().getAttribute('role'),'img');assert.equal(marker().getAttribute('tabindex'),'-1');assert.equal(marker().getAttribute('pointer-events'),'none');
 // Synthetic events bypass SVG hit testing, so the callback guard must also hold.
 await click(marker());await key(marker(),'Enter');await key(marker(),' ');
 assert.equal(squads.length,3);
 const origin=worldCell(state.location),destination=worldCell(`cell-${origin.col}-${origin.row-1}`);
 assert.ok(destination,'the destination cell remains selectable');
 await click(dom.window.document.querySelector(`[data-map-cell="${destination.id}"]`));
 assert.deepEqual(destinations,[destination.location]);assert.equal(squads.length,3);assert.deepEqual(actions,[]);assert.deepEqual(state,before);
});
test('the flat roster opens individual dossiers and routes without a permanent squad list',()=>{
 const s=initialCampaign(),destinations=[],dossiers=[],tree=StrategicRoster({state:s,roster:rosterFor(s),onDossier:id=>dossiers.push(id),onOpenDesk:noop,onAssignment:noop,onContract:noop,onDestination:id=>destinations.push(id),dispatch:noop});
 const nodes=[];function walk(v){if(Array.isArray(v)){v.forEach(walk);return;}if(!v||typeof v!=='object')return;nodes.push(v);walk(v.props?.children);}walk(tree);
 const buttons=nodes.filter(v=>v.type==='button');assert.ok(!nodes.some(v=>v.props?.className==='squad-map-table'));assert.equal(nodes.filter(v=>v.type==='table').length,1);
 const name=buttons.find(v=>v.props.title==='Juan Bautista Cabral');assert.ok(name);name.props.onClick();assert.deepEqual(dossiers,[3]);assert.deepEqual(destinations,[]);
 buttons.find(v=>v.props['aria-label']==='Destino: Cabral').props.onClick();assert.deepEqual(destinations,[s.activeSquadId]);assert.deepEqual(dossiers,[3]);
 assert.ok(!buttons.some(v=>v.props.onClick===noop&&v.props.children==='Organizar escuadras'));
});
