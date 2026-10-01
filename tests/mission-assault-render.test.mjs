import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
const {default:MissionAssault}=await import('../web/app/MissionAssault.tsx');
test('mission selection explains unavailable support and never preselects a second squad',()=>{
 let s=initialCampaign();for(const id of [100,101])s=dispatchCampaign(s,{type:'recruitCivic',id,term:'week'});
 s.location='san_nicolas';s.squads[0].location='san_nicolas';s.squads[0].members=[100];s.squad=[100];
 s.squads.push({id:'squad-2',name:'Apoyo',members:[101],location:'san_nicolas'});
 for(const id of [100,101])s.operativeState[id].location='san_nicolas';s.operativeState[101].assignment='rest';
 const html=render(h(MissionAssault,{state:s,dispatch(){}}));
 assert.match(html,/Fuerza para San Lorenzo/);assert.match(html,/otra asignación/);assert.match(html,/1 combatientes seleccionados/);
 assert.equal((html.match(/checked=""/g)??[]).length,1);assert.match(html,/Escuadra activa/);
});
test('remote selected squads cannot launch the mission through the desk',()=>{
 const html=render(h(MissionAssault,{state:initialCampaign(),dispatch(){}}));
 assert.match(html,/Seleccioná una escuadra en San Nicolás/);assert.match(html,/<button[^>]*disabled=""[^>]*>Marchar a San Lorenzo/);
});
