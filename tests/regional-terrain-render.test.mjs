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

test('regional scenery is grouped for caching while terrain controls remain viewport-only',()=>{
 const viewport={x:520,y:476,width:208,height:98};
 for(const sector of ['cordoba','mendoza','tucuman']){
  const {state,html}=appearance(sector,viewport);
  const visible=state.tiles.filter(t=>pointInViewport(viewport,project(t.x,t.y),110));
  assert.equal((html.match(/role="button"/g)??[]).length,visible.length,'culled terrain remains the hit-test surface');
  assert.ok(visible.length<state.tiles.length/5);
  if(sector==='cordoba')assert.match(html,/scenery-shrub-v1.webp/);
  if(sector==='mendoza'){assert.match(html,/scenery-rocks-v1.webp/);assert.match(html,/fill="url\(#terrain-dirt\)"/);}
  if(sector==='tucuman'){assert.match(html,/scenery-(tree|poplar)-v1.webp/);assert.match(html,/fill="url\(#terrain-green-grass\)"/);}
  // Static scenery is prepared once per world-depth layer, rather than rebuilt
  // at every camera boundary. Only the visible terrain remains interactive.
  const layers=(html.match(/data-static-layer="vector"/g)??[]).length;
  assert.ok(layers>0&&layers<(state.width+state.height)*4+10);
 }
});

test('forest transparency follows living soldiers and returns to opaque after they leave',()=>{
 const state=createBattle([{id:'walker',x:2,y:2}],{width:12,height:8,exploration:true,enemies:[]});
 for(const tile of state.tiles)Object.assign(tile,{type:'grass',blocked:false});
 for(const point of [{x:2,y:2},{x:8,y:2}])state.tiles.find(t=>t.x===point.x&&t.y===point.y).type='forest';
 const trees=()=>{
  const html=render(h('svg',null,h(Scene,{state,players:state.units,units:state.units,positions:{},poses:{},directions:{},reachable:[],sight:new Set(),revealed:new Set(),project})));
  return [...html.matchAll(/<image\b[^>]*scenery-(?:tree|poplar|shrub)-v1.webp[^>]*>/g)].map(([tag])=>tag).filter(tag=>/opacity="(?:1|0.48)"/.test(tag));
 };
 assert.equal(trees().filter(tag=>tag.includes('opacity="0.48"')).length,1);
 Object.assign(state.units[0],{x:8,y:2});
 const moved=trees();assert.equal(moved.filter(tag=>tag.includes('opacity="0.48"')).length,1);
 assert.match(moved[0],/opacity="1"/);assert.match(moved[1],/opacity="0.48"/);
 state.units[0].hp=0;
 assert.ok(trees().every(tag=>tag.includes('opacity="1"')));
});
