import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {componentTree} from './component-tree.mjs';
import {buildSectorMap} from '../game/maps.js';
import {buildTerrace} from '../game/buildings.js';
import {OPERATIVES} from '../game/data.js';
import {createBattle,canSee,visibleRooms} from '../game/tactical.js';
import {playerKnownBattle} from '../game/player-known-state.js';
import {propBlocksAt} from '../game/props.js';
const {default:Scene}=await import('../web/app/TacticalScene.tsx');
const {buildBuildingObjects}=await import('../web/app/TacticalBuildings.tsx');
const project=(x,y)=>({x:1000+(x-y)*26,y:65+(x+y)*14}),noop=()=>{};
const nodes=node=>!node||typeof node!=='object'?[]:[node,...(Array.isArray(node)?node:Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(nodes)];
function fixture({above=false,teammate=false,compactLayout=false}={}){
 const map=buildSectorMap({sector:'tucuman',compactLayout,squad:[OPERATIVES[0]],enemies:[],exploration:true}),building=map.buildings[0];
 Object.assign(map,buildTerrace(building));
 const ground=map.tiles.find(tile=>tile.roomId===building.rooms[0].id&&!tile.blocked&&!propBlocksAt(map,tile.x,tile.y));
 Object.assign(map.squad[0],{id:'observer',x:ground.x,y:ground.y,...(above?{tacticalLevel:1}:{})});
 if(teammate)map.squad.push({...map.squad[0],id:'roof-scout',tacticalLevel:1});
 const point={x:ground.x+1,y:ground.y,tacticalLevel:1};
 map.enemies=[{id:'roof-guard',name:'Guardia oculto de azotea',x:ground.x,y:ground.y+1,tacticalLevel:1,patrol:false}];
 const state=createBattle(map.squad,map);state.props.push({id:'roof-chest',type:'chest',...point,open:false,locked:true,contents:[]});
 state.lights=[{...point,type:'torch',radius:3,intensity:1}];state.smoke=[{...point,radius:.1}];
 return {state,building,point};
}
function sceneProps(state,cursorLevel){
 const players=state.units.filter(u=>u.side==='player'),units=state.units.filter(u=>u.side==='player'||players.some(p=>canSee(state,p,u)));
 return {state,cursorLevel,selected:'observer',unit:players[0],players,units,positions:{},poses:{},directions:{},hover:null,mode:'move',aim:0,reachable:[],showSight:false,sight:new Set(),revealed:new Set([...(state.revealedRooms??[]),...visibleRooms(state)]),project,onTile:noop,onHover:noop,onTalk:noop,onCannon:noop,cannonId:''};
}
function scene(state,level){return nodes(componentTree(Scene,sceneProps(state,level)));}
test('a real house ceiling hides unseen roof controls, chest art, light, smoke and guard hit targets',()=>{
 for(const compactLayout of [true,false]){
  const {state,building,point}=fixture({compactLayout}),props=sceneProps(state,1),before=structuredClone(state);
  assert.equal(canSee(state,state.units[0],point),false);assert.equal(playerKnownBattle(state).upperSurfaces.length,0);
  for(const level of [0,1]){
   const all=scene(state,level);assert.ok(!all.some(node=>node.props?.['data-surface-id']));assert.ok(!all.some(node=>node.props?.['data-unit-id']==='roof-guard'));
   assert.ok(!all.some(node=>node.props?.['data-prop-id']==='roof-chest'));
   assert.ok(!all.some(node=>node.props?.source?.type==='torch'&&node.props?.point),'hidden roof lights must not reach the renderer');
   assert.ok(!all.some(node=>node.type==='ellipse'&&node.props.fill==='url(#smokefill)'));
   assert.ok(!all.some(node=>String(node.props?.['aria-label']).includes('Guardia oculto')));
  }
  const upper=componentTree(Scene,props),roof=nodes(upper).find(node=>node.props?.['data-roof-room']===building.rooms[0].id);
  assert.ok(roof,'static roof geography remains present without exposed controls');
  const original=buildBuildingObjects({state,revealed:props.revealed,cursorLevel:1,project,light:()=>1}).find(object=>object.key===`architecture-roof-${building.rooms[0].id}`);
  assert.equal(render(h('svg',null,roof)),render(h('svg',null,original.node)),'the detailed roof art is unchanged');
  assert.deepEqual(state,before);
 }
});
test('roof observers and a roof teammate reveal current contents while ground selection keeps shared knowledge',()=>{
 for(const options of [{above:true},{teammate:true}]){
  const {state,point}=fixture(options),view=playerKnownBattle(state);assert.ok(view.props.some(prop=>prop.id==='roof-chest'));
  assert.ok(view.units.some(unit=>unit.id==='roof-guard'));assert.ok(view.upperSurfaces.length>0);
  for(const level of [0,1]){
   const all=scene(state,level);assert.ok(all.some(node=>node.props?.['data-prop-id']==='roof-chest'));
   assert.ok(all.some(node=>node.props?.source?.type==='torch'&&node.props?.point),'the visible roof light reaches the shared light renderer');assert.ok(all.some(node=>node.type==='ellipse'&&node.props.fill==='url(#smokefill)'));
   const guard=all.find(node=>node.props?.['data-unit-id']==='roof-guard'),hit=nodes(guard).find(node=>node.props?.['data-person-hit-target']);assert.ok(hit);assert.equal(hit.props.pointerEvents,level===1?'all':'none');assert.equal(hit.props.tabIndex,level===1?0:-1);
   const buttons=all.filter(node=>node.props?.['data-surface-id']).map(node=>node.props['data-surface-id']);
   assert.deepEqual(buttons.sort(),level===1?view.upperSurfaces.map(surface=>surface.id).sort():[]);
  }
  if(options.teammate){assert.equal(canSee(state,state.units[0],point),false);assert.equal(canSee(state,state.units[1],point),true);}
 }
});
test('losing current rooftop sight removes controls and dynamics but retains the building silhouette',()=>{
 const {state,building}=fixture({teammate:true});assert.ok(scene(state,1).some(node=>node.props?.['data-prop-id']==='roof-chest'));
 state.units=state.units.filter(unit=>unit.id!=='roof-scout');
 const all=scene(state,1);assert.ok(!all.some(node=>node.props?.['data-prop-id']==='roof-chest'||node.props?.['data-surface-id']));
 assert.ok(all.some(node=>node.props?.['data-roof-room']===building.rooms[0].id));
});
