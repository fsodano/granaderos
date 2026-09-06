import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
const {default:SpriteFigure}=await import('../web/app/SpriteFigure.tsx');
const {buildPropObjects}=await import('../web/app/TacticalProps.tsx');
const {buildBuildingObjects}=await import('../web/app/TacticalBuildings.tsx');
const {default:TacticalScene}=await import('../web/app/TacticalScene.tsx');
const {default:TacticalMinimap}=await import('../web/app/TacticalMinimap.tsx');
import {buildSectorMap,MAP_IDS} from '../game/maps.js';
import {createBattle} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {spriteLayout} from '../game/sprite-layouts.js';
import {tacticalCamera} from '../game/tactical-camera.js';
const project=(x,y)=>({x:200+(x-y)*26,y:65+(x+y)*14});
const state={tiles:[{x:2,y:2,roomId:'a'},{x:4,y:2,roomId:'b'}],buildings:[{id:'house',x:1,y:1,width:5,height:4,rooms:[{id:'a',cells:[{x:2,y:2}]},{id:'b',cells:[{x:4,y:2}]}]}],props:[{id:'a-table',type:'table',x:2,y:2,buildingId:'house'},{id:'b-bed',type:'bed',x:4,y:2,buildingId:'house'},{id:'untagged',type:'chest',x:4,y:2},{id:'outside',type:'barrels',x:0,y:0},{id:'invalid',type:'chest',x:9,y:9,buildingId:'missing'}]};
const props=revealed=>buildPropObjects({state,project,light:()=>.4,revealed:new Set(revealed)});
test('scene preserves distinct dead/unconscious states even with pending motion and firing',()=>{
 const s=createBattle([{id:'dead',x:1,y:1},{id:'faint',x:2,y:1}],{width:8,height:8,exploration:true,enemies:[]});
 Object.assign(s.units[0],{hp:0,unconscious:true,mounted:true});Object.assign(s.units[1],{hp:50,unconscious:true});
 const markup=render(h('svg',null,h(TacticalScene,{state:s,players:s.units,units:s.units,positions:{dead:{x:1,y:1,direction:2,frame:5,moving:true}},poses:{dead:'fire'},directions:{dead:7},reachable:[],sight:new Set(),revealed:new Set(),project})));
 assert.match(markup,/data-posture="dead"/);assert.match(markup,/data-posture="unconscious"/);
 assert.match(markup,/granadero-dead-idle-atlas/);assert.match(markup,/granadero-unconscious-breathe-atlas/);
 assert.ok(!markup.includes('cavalry-'));assert.ok(!markup.includes('prone-'));assert.ok(!markup.includes('data-moving="true"'));
});
test('native sprites preserve body scale and fixed ground anchors across every layout',()=>{
 for(const [unit,pose,name] of [
  [{},'idle','granadero-idle'],[{side:'enemy'},'fire','royalist-fire'],
  [{stance:'prone'},'idle','granadero-prone-unarmed-idle'],[{movementMode:'crouch'},'idle','granadero-crouch-idle'],
  [{mounted:true},'idle','cavalry-idle'],
 ]){
  const {cell,anchor}=spriteLayout(name);
  const markup=render(h(SpriteFigure,{unit,pose,position:{x:100.2,y:100.4},motion:{direction:3,moving:false,frame:0}}));
  assert.ok(markup.includes(`/art/pixel/${name}-atlas.png`));
  assert.ok(markup.includes(`x="${Math.round(100.2-anchor[0])}" y="${Math.round(100.4-anchor[1])}" width="${cell}" height="${cell}"`));
  assert.match(markup,/image-rendering:pixelated/);
 }
});
test('responsive tactical camera keeps integer pixel magnification and bounded panning',()=>{
 const world={width:996,height:659},focus={x:498,y:330};
 for(const viewport of [{width:375,height:430},{width:768,height:420},{width:1280,height:560}])for(const zoom of [1,2,3]){
  const camera=tacticalCamera(world,viewport,focus,{x:.3,y:.7},zoom);
  assert.equal(viewport.width/camera.width,zoom);assert.equal(viewport.height/camera.height,zoom);
  assert.ok(Number.isInteger(camera.x)&&Number.isInteger(camera.y));
  const min=tacticalCamera(world,viewport,focus,{x:-9999,y:-9999},zoom);assert.equal(min.x,0);assert.equal(min.y,0);
  const max=tacticalCamera(world,viewport,focus,{x:9999,y:9999},zoom);
  assert.equal(max.x,Math.round(Math.max(0,world.width-max.width)));assert.equal(max.y,Math.round(Math.max(0,world.height-max.height)));
 }
});
test('civilian selection uses idle columns and walk rows in all eight directions',()=>{
 for(let direction=0;direction<8;direction++)for(const moving of [false,true]){
  const markup=render(h(SpriteFigure,{appearance:'civilian',unit:{side:'enemy',mounted:true,stance:'prone'},pose:'fire',position:{x:100,y:100},motion:{direction,moving,frame:5}}));
  assert.ok(markup.includes(`/art/pixel/civilian-${moving?'walk':'idle'}-atlas.png`));
  assert.ok(markup.includes(`viewBox="${(moving?5:direction)*52} ${moving?direction*52:0} 52 52"`));
  assert.ok(!/royalist|granadero|cavalry/.test(markup));
 }
 assert.match(render(h(SpriteFigure,{unit:{side:'enemy'},position:{x:0,y:0},motion:{direction:2,moving:false,frame:0}})),/royalist-idle-atlas/);
});
test('props require their own room, including untagged and invalid membership',()=>{
 assert.deepEqual(props([]).map(p=>p.key),['prop-outside']);
 assert.deepEqual(props(['a']).map(p=>p.key),['prop-a-table','prop-outside']);
 assert.equal(props(['a','b']).length,4);
 const table=props(['a'])[0];assert.equal(table.depth,4.02);
 assert.match(render(table.node),/brightness\(0.4\)/);
 assert.match(render(table.node),/translate\(200 121\)/);
});
test('revealing one room retains the other roof and only cuts adjacent front walls',()=>{
 const tiles=[...state.tiles,{x:2,y:4,type:'wall',buildingId:'house'},{x:4,y:4,type:'wall',buildingId:'house'}];
 const s={...state,tiles,buildings:[{...state.buildings[0],rooms:[{id:'a',cells:[{x:2,y:3}]},{id:'b',cells:[{x:4,y:3}]}]}]};
 const objects=buildBuildingObjects({state:s,project,light:()=>.5,revealed:new Set(['a'])});
 assert.deepEqual(objects.filter(o=>o.key.includes('roof')).map(o=>o.key),['architecture-roof-b']);
 assert.match(render(objects.find(o=>o.key==='architecture-2-4-x').node),/data-cutaway="true"/);
 assert.match(render(objects.find(o=>o.key==='architecture-4-4-x').node),/data-cutaway="false"/);
});
test('authored furnishings reach battle state and survive sector re-entry',()=>{
 for(const sector of MAP_IDS){const map=buildSectorMap({sector,squad:[],enemies:[]});for(const prop of map.props){assert.ok(map.tiles.some(t=>t.x===prop.x&&t.y===prop.y&&!t.blocked&&t.roomId===prop.roomId));}
 const battle=enterSector({sector,squad:[],enemies:[],exploration:true});assert.deepEqual(battle.props,map.props);
 if(battle.props.length){battle.props.pop();assert.deepEqual(enterSector({sector,squad:[],enemies:[],exploration:true},battle).props,battle.props);}}
});
test('scene selects civilians and sorts NPCs at their animated ground position',()=>{
 const s=createBattle([{id:1,x:0,y:0},{id:2,x:1,y:2}],{width:8,height:8,exploration:true,enemies:[],npcs:[{id:'civilian',name:'Vecino',x:2,y:2}]});
 const node=h(TacticalScene,{state:s,players:s.units,units:s.units,positions:{civilian:{x:1,y:1,direction:2,frame:4,moving:true}},poses:{},directions:{},reachable:[],sight:new Set(),revealed:new Set(),project});
 const markup=render(h('svg',null,node));assert.match(markup,/civilian-walk-atlas/);assert.match(markup,/data-unit-id="civilian"/);assert.ok(markup.indexOf('data-unit-id="civilian"')<markup.indexOf('data-unit-id="2"'),'animated ground position sets draw order');assert.match(markup,/data-person-hit-target="true"/);
});
test('radar hides unknown room floors and unseen enemy dots',()=>{
 const s=createBattle([{id:1,x:0,y:0}],{width:8,height:8,night:true,enemies:[{id:'enemy',x:7,y:7}],buildings:state.buildings});
 s.tiles.find(t=>t.x===4&&t.y===2).roomId='b';
 const markup=render(h(TacticalMinimap,{state:s,units:s.units,selected:'1',project,width:500,height:300,camera:{x:50,y:40,width:200,height:100},onCenter:()=>{}}));
 assert.ok(!markup.includes('#d7755a'));assert.match(markup,/#685037/);assert.match(markup,/x="50" y="40" width="200" height="100"/);
});
