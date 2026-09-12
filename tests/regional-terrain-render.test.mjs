import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {buildSectorMap} from '../game/maps.js';
import {createBattle} from '../game/tactical.js';
import {pointInViewport} from '../game/tactical-viewport.js';
const {default:Scene}=await import('../web/app/TacticalScene.tsx');
const project=(x,y)=>({x:x*26,y:y*14});
const appearance=(sector,viewport)=>{
 const map=buildSectorMap({sector,squad:[],enemies:[],exploration:true});
 const state=createBattle([],map);
 const html=render(h('svg',null,h(Scene,{state,players:[],units:[],positions:{},poses:{},directions:{},reachable:[],sight:new Set(),revealed:new Set(),project,viewport})));
 return {state,html};
};

test('regional scrub and rocky ground use scenery assets within the visible terrain only',()=>{
 const viewport={x:520,y:476,width:208,height:98};
 for(const sector of ['cordoba','mendoza','tucuman']){
  const {state,html}=appearance(sector,viewport);
  const visible=state.tiles.filter(t=>pointInViewport(viewport,project(t.x,t.y),110));
  assert.equal((html.match(/role="button"/g)??[]).length,visible.length,'culled terrain remains the hit-test surface');
  assert.ok(visible.length<state.tiles.length/5);
  if(sector==='cordoba')assert.match(html,/scenery-shrub-v1.webp/);
  if(sector==='mendoza'){assert.match(html,/scenery-rocks-v1.webp/);assert.match(html,/fill="url\(#terrain-dirt\)"/);}
  if(sector==='tucuman'){assert.match(html,/scenery-(tree|poplar)-v1.webp/);assert.match(html,/fill="url\(#terrain-green-grass\)"/);}
  // No decoration or texture image can bring back thousands of offscreen cells.
  assert.ok((html.match(/<image /g)??[]).length<visible.length*2+100);
 }
});
