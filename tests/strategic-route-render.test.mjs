import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {worldCell} from '../game/world-cells.js';
import {initialCampaign as freshCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
const {default:Campaign}=await import('../web/app/Campaign.tsx');
const {default:StrategicMap}=await import('../web/app/StrategicMap.tsx');
const {default:StrategicRoster}=await import('../web/app/StrategicRoster.tsx');
const noop=()=>{};
test('fresh command screen has an empty squad, recruitment access and a visible clock',()=>{
 const html=render(h(Campaign,{state:freshCampaign(),dispatch:noop,onBattle:noop,onOpenDesk:noop}));
 assert.match(html,/0 soldados/);assert.match(html,/Crear o contratar/);assert.match(html,/Tiempo a avanzar/);assert.match(html,/Sin combatientes/);assert.doesNotMatch(html,/data-squad-route/);
});
test('resumed routes appear on the map, in the destination column and beside the clock',()=>{
 let s=dispatchCampaign(initialCampaign(),{type:'travel',sector:'ensenada',queue:true});s=dispatchCampaign(s,{type:'wait',hours:5});assert.equal(s.lastError,null);
 const html=render(h(Campaign,{state:s,dispatch:noop,onBattle:noop,onOpenDesk:noop}));assert.match(html,/data-squad-route="squad-1"/);assert.ok(html.includes(`${worldCell('ensenada').grid}<small>19 h`));assert.match(html,/Regresar · 5 h/);assert.match(html,/Seleccionar Primera escuadra/);
});
test('map draft is a separate path and has no dispatch side effects',()=>{
 const s=initialCampaign(),before=structuredClone(s),actions=[];
 const html=render(h(StrategicMap,{state:s,selected:'ensenada',onSelect:noop,dispatch:a=>actions.push(a),onSquad:noop,plotting:true,previewPath:['retiro','buenos_aires','ensenada']}));
 assert.match(html,/data-route-preview="true"/);assert.doesNotMatch(html,/data-squad-route/);assert.deepEqual(actions,[]);assert.deepEqual(s,before);
});
test('roster squad buttons select command, while names open their own dossier',()=>{
 const s=initialCampaign(),squads=[],dossiers=[],tree=StrategicRoster({state:s,roster:rosterFor(s),onSquad:id=>squads.push(id),onDossier:id=>dossiers.push(id),onOpenDesk:noop,onManage:noop});
 const nodes=[];function walk(v){if(Array.isArray(v)){v.forEach(walk);return;}if(!v||typeof v!=='object')return;nodes.push(v);walk(v.props?.children);}walk(tree);
 const buttons=nodes.filter(v=>v.type==='button');buttons.find(v=>v.props['aria-pressed']===true).props.onClick();assert.deepEqual(squads,[s.activeSquadId]);assert.deepEqual(dossiers,[]);
 const name=buttons.find(v=>Array.isArray(v.props.children)&&v.props.children.includes('Cabral'));name.props.onClick();assert.deepEqual(dossiers,[3]);assert.deepEqual(squads,[s.activeSquadId]);
});
