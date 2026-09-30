import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {advanceBattleClock} from '../game/time.js';
import {createBattle,actBattle} from '../game/tactical.js';
const {default:Scene}=await import('../web/app/TacticalScene.tsx');
const {default:Light}=await import('../web/app/TacticalLight.tsx');
const scene=s=>render(h('svg',null,h(Scene,{state:s,players:s.units,units:s.units,positions:{},poses:{},directions:{},reachable:[],sight:new Set(),revealed:new Set(),project:(x,y)=>({x:x*26,y:y*14})})));
test('shared battlefield displays the real thrown torch and keeps fixed lanterns distinct',()=>{
 const before=createBattle([{id:'p',x:1,y:1,torches:2}],{width:8,height:8,night:true,exploration:true,enemies:[],lights:[{type:'lantern',x:3,y:3}]});
 before.tiles.forEach(t=>{t.blocked=false;t.blocksSight=false;t.type='grass';});
 const held=actBattle(before,{type:'weapon',unitId:'p',slot:'supply',supplyKey:'torches'});
 const after=actBattle(held,{type:'throwTorch',unitId:'p',x:2,y:2});
 assert.equal(after.lastError,null);assert.equal(after.units[0].torches,1);
 const html=scene(after);
 assert.match(html,/data-light-source="lantern"/);assert.match(html,/data-light-source="torch"/);
 assert.equal((html.match(/data-light-glow="true"/g)||[]).length,2);
 const expired=structuredClone(after);
 advanceBattleClock(expired,8*600);
 assert.ok(!expired.lights.some(l=>l.type==='torch'));
 assert.doesNotMatch(scene(expired),/data-light-source="torch"/);
 assert.match(scene(expired),/data-light-source="lantern"/);
});
test('daylight sources retain their physical shape without the night glow or animation filters',()=>{
 for(const type of ['lantern','torch','campfire']){
  const html=render(h('svg',null,h(Light,{source:{type},point:{x:20,y:30},night:false})));
  assert.match(html,new RegExp(`data-light-source="${type}"`));assert.match(html,/data-light-flame="true"/);
  assert.doesNotMatch(html,/data-light-glow|<filter|<animate/);
 }
});

test('extinguished sources retain their hardware but emit no drawn flame or glow',()=>{
 for(const state of [{extinguished:true},{turns:0}])for(const type of ['lantern','torch','campfire']){
  const html=render(h('svg',null,h(Light,{source:{type,...state},point:{x:0,y:0},night:true})));
  assert.match(html,/data-light-source/);assert.doesNotMatch(html,/data-light-flame|data-light-glow/);
 }
});
