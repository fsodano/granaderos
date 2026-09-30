import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {createBattle,actBattle,getReachable,canSee,visibleRooms,itemUsePreview} from '../game/tactical.js';
import {executeGroupMove} from '../game/group-movement.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {sameCell,tacticalLevel} from '../game/tactical-space.js';
import {tacticalViewport} from '../game/tactical-viewport.js';
const {movementRoute,sampleMovementSegment,motionDirection}=await import('../web/app/useUnitMotion.ts');
const {surfaceMotionPoint,projectSurface}=await import('../web/lib/tactical-elevation.ts');
const {default:Scene}=await import('../web/app/TacticalScene.tsx');
const noop=()=>{};
const openTiles=(width,height)=>Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0}));
const fullRange=(state,actor,preserveFacing=false)=>getReachable({...state,status:'active',mode:'exploration'},actor,preserveFacing?{movementIntent:'preserveFacing'}:{});
// Any legacy replanning would inspect the map. An executed route must be
// usable without reading it, and must retain the exact authored path nodes.
const noSearch=new Proxy({},{get(){throw new Error('animation replanned an executed route');}});
function assertRecordedRoute(before,after,id,expected){
 const old=before.units.find(unit=>unit.id===id),unit=after.units.find(unit=>unit.id===id);
 assert.deepEqual(unit.lastMovePath,expected);
 const route=movementRoute(noSearch,old,unit);
 assert.equal(route[0],old);assert.equal(route.length,expected.length+1);
 for(const [index,point]of unit.lastMovePath.entries())assert.equal(route[index+1],point);
 assert.ok(sameCell(route.at(-1),unit));
 assert.doesNotThrow(()=>validateBattleSnapshot(after));
}
function buenosAires(){
 let campaign=initialCampaign(8);
 for(const id of [128,142,123,115,131,110])campaign=dispatchCampaign(campaign,{type:'recruitCivic',id,term:'day'});
 campaign=dispatchCampaign(campaign,{type:'attack',sector:'buenos_aires'});
 return {...enterSector(campaign.pendingBattle),night:true};
}

test('animation destinations retain full-range paths around obstacles with either facing intent and fresh topology',()=>{
 const state=createBattle([{id:'walker',x:1,y:1}],{width:10,height:10,tiles:openTiles(10,10),exploration:true,enemies:[]});
 for(const tile of state.tiles)if(tile.x===3&&tile.y<6)Object.assign(tile,{type:'wall',blocked:true,blocksSight:true});
 const opened={...state,tiles:state.tiles.map(tile=>tile.x===3&&tile.y===2?{...tile,type:'door',blocked:false,blocksSight:false,open:true}:tile)};
 const target={x:5,y:2};
 assert.notDeepEqual(movementRoute(state,state.units[0],target),movementRoute(opened,opened.units[0],target));
 for(const snapshot of [state,opened,state])for(const preserveFacing of [false,true]){
  const actor=snapshot.units[0],before=structuredClone(snapshot);
  for(const destination of fullRange(snapshot,actor,preserveFacing)){
   const route=movementRoute(snapshot,actor,destination,false,preserveFacing);
   assert.deepEqual(route,[actor,...destination.path]);
   assert.equal(route[0],actor,'the starting actor retains its identity');
  }
  assert.deepEqual(snapshot,before,'animation queries do not change simulation state');
 }
});

test('animation routes distinguish stacked physical cells and retain recorded climb-node identity',()=>{
 const upperSurfaces=[1,2,3].map(x=>({id:`platform:${x}`,x,y:1,tacticalLevel:1,elevation:3,kind:'platform',type:'floor',blocked:false,cover:0}));
 const state=createBattle([{id:'walker',x:1,y:1},{id:'under',x:2,y:1}],{width:8,height:8,tiles:openTiles(8,8),upperSurfaces,climbLinks:[{id:'up',kind:'climb',from:{x:1,y:1,tacticalLevel:0},to:{x:1,y:1,tacticalLevel:1}}],exploration:true,enemies:[]});
 const actor=state.units[0],target={x:3,y:1,tacticalLevel:1},expected=fullRange(state,actor).find(point=>sameCell(point,target));
 const route=movementRoute(state,actor,target);
 assert.deepEqual(route,[actor,...expected.path]);
 assert.equal(route[1].kind,'climb');assert.equal(route[1].linkId,'up');
 assert.ok(route.slice(1).every(point=>tacticalLevel(point)===1));
 const climbed=actBattle(state,{type:'climb',unitId:actor.id,linkId:'up'});assert.equal(climbed.lastError,null);
 assertRecordedRoute(state,climbed,actor.id,expected.path.slice(0,1));
 const onRoof=actBattle(state,{type:'move',unitId:actor.id,...target});assert.equal(onRoof.lastError,null);
 assertRecordedRoute(state,onRoof,actor.id,expected.path);
 const down=fullRange(climbed,climbed.units[0]).find(point=>sameCell(point,{x:1,y:1}));
 assert.deepEqual(movementRoute(climbed,climbed.units[0],{x:1,y:1}),[climbed.units[0],...down.path]);
 const recorded={...target,lastMovePath:expected.path},reused=movementRoute(state,actor,recorded);
 for(const [i,point]of expected.path.entries())assert.equal(reused[i+1],point);
 assert.equal(reused[0],actor);
 const unsupported={x:6,y:6,tacticalLevel:1};
 assert.deepEqual(movementRoute(state,actor,unsupported),[actor,unsupported]);
 assert.equal(movementRoute(state,actor,unsupported)[1],unsupported,'cross-floor fallback retains authoritative destination identity');
});

test('executed player routes retain detours and facing intent and replace the previous order',()=>{
 for(const movementIntent of ['forward','preserveFacing']){
  const state=createBattle([{id:'walker',x:1,y:1}],{width:10,height:10,tiles:openTiles(10,10),exploration:true,enemies:[]});
  for(const tile of state.tiles)if(tile.x===3&&tile.y<6)tile.blocked=true;
  const actor=state.units[0],destination=getReachable(state,actor,{movementIntent}).find(point=>sameCell(point,{x:5,y:2}));
  const next=actBattle(state,{type:'move',unitId:actor.id,x:5,y:2,movementIntent});
  assert.equal(next.lastError,null);assertRecordedRoute(state,next,actor.id,destination.path);
  assert.equal(actor.lastMovePath,undefined,'the source snapshot remains unchanged');
  const back=getReachable(next,next.units[0],{movementIntent}).find(point=>sameCell(point,{x:5,y:3}));
  const returned=actBattle(next,{type:'move',unitId:actor.id,x:5,y:3,movementIntent});
  assertRecordedRoute(next,returned,actor.id,back.path);
  assert.equal(returned.units[0].lastMovePath.length,1,'the next order replaces the prior route');
 }
});

test('hidden occupancy and charge interrupts record only the steps actually reached',()=>{
 const state=createBattle([{id:'walker',x:5,y:2,facing:2}],{width:12,height:6,seed:45,tiles:openTiles(12,6),enemies:[{id:'hidden',x:1,y:2,overwatch:false,patrol:false}]});
 const blocked=actBattle(state,{type:'move',unitId:'walker',x:1,y:2});assert.equal(blocked.lastError,null);
 assertRecordedRoute(state,blocked,'walker',[{x:4,y:2},{x:3,y:2},{x:2,y:2}]);
 const charge=createBattle([{id:'walker',x:1,y:1,morale:100,weapon:1809}],{width:12,height:6,seed:45,tiles:openTiles(12,6),enemies:[{id:'guard',x:6,y:1,overwatch:true,weapon:1806}]});
 const interrupted=actBattle(charge,{type:'charge',unitId:'walker',targetId:'guard'});assert.equal(interrupted.lastError,null);
 assertRecordedRoute(charge,interrupted,'walker',[{x:2,y:1}]);
 assert.equal(interrupted.units[1].hp,charge.units[1].hp,'an interrupted charge does not strike its target');
 const clear=structuredClone(charge);clear.units[1].ap=0;clear.units[1].overwatch=false;
 const finished=actBattle(clear,{type:'charge',unitId:'walker',targetId:'guard'});assert.equal(finished.lastError,null);
 assertRecordedRoute(clear,finished,'walker',[{x:2,y:1},{x:3,y:1},{x:4,y:1},{x:5,y:1}]);
});

test('sequential group orders preserve each member executed route',()=>{
 const state=createBattle([{id:'a',x:1,y:2},{id:'b',x:1,y:3},{id:'c',x:2,y:3}],{width:16,height:10,tiles:openTiles(16,10),exploration:true,enemies:[]});
 const result=executeGroupMove(state,{unitIds:['a','b','c'],anchorId:'a',x:8,y:2});assert.equal(result.status,'completed');
 let replay=state;
 for(const action of result.orders){
  const next=actBattle(replay,action),executed=next.units.find(unit=>unit.id===action.unitId).lastMovePath;
  assertRecordedRoute(state,result.state,action.unitId,executed);replay=next;
 }
 assert.deepEqual(result.state,replay);
});

test('a completed approach and treatment retains the executed route through the second action',()=>{
 const state=createBattle([{id:'medic',x:2,y:2,activeSlot:'medical',medical:60,medkits:2},{id:'patient',x:6,y:2,hp:50,bleeding:4}],{width:16,height:10,seed:45,tiles:openTiles(16,10),enemies:[{id:'guard',x:14,y:8,patrol:false,overwatch:false}]});
 for(const tile of state.tiles)if(tile.x===10)Object.assign(tile,{type:'wall',blocked:true,blocksSight:true});
 const plan=itemUsePreview(state,state.units[0],state.units[1]);assert.equal(plan.valid,true);
 const next=actBattle(state,{type:'useItem',unitId:'medic',targetId:'patient'});assert.equal(next.lastError,null);
 assertRecordedRoute(state,next,'medic',plan.path);assert.equal(next.units[1].bleeding,0);
});

test('straight charges and movement into a previously occupied cell retain their terrain fallback',()=>{
 const state=createBattle([{id:'walker',x:1,y:1},{id:'previous-occupant',x:3,y:1}],{width:8,height:8,tiles:openTiles(8,8),exploration:true,enemies:[]});
 const actor=state.units[0],target={x:3,y:1};
 assert.equal(fullRange(state,actor).some(point=>sameCell(point,target)),false);
 const expected=[actor,{x:2,y:1,tacticalLevel:0},{x:3,y:1,tacticalLevel:0}];
 assert.deepEqual(movementRoute(state,actor,target),expected);
 assert.deepEqual(movementRoute(state,actor,target,true),expected);
 const recorded={...target,lastMovePath:expected.slice(1)};
 assert.equal(movementRoute(state,actor,recorded)[1],recorded.lastMovePath[0]);
});

test('full Buenos Aires ambient motion preserves reachable routes across ten actual state updates',()=>{
 let state=buenosAires(),compared=0,moving=0;
 assert.equal(state.tiles.length,3072);assert.equal(state.upperSurfaces.length,125);
 for(let tick=0;tick<10;tick++){
  const next=actBattle(state,{type:'ambient'}),oldActors=[...state.units,...state.npcs],before=structuredClone(state);
  for(const actor of [...next.units,...next.npcs]){
   const old=oldActors.find(person=>person.id===actor.id);if(!old||sameCell(old,actor))continue;
   moving++;const route=movementRoute(state,old,actor),destination=fullRange(state,old).find(point=>sameCell(point,actor));
   assert.equal(route[0],old);assert.ok(sameCell(route.at(-1),actor));
   if(destination){
    // Civilian routines record their actual cardinal steps. Named residents
    // now also have finite HP and a soldier-style reachable overlay; that
    // alternative path must not replace the authoritative movement record.
    const path=actor.lastMovePath?.length?actor.lastMovePath:destination.path;
    assert.deepEqual(route,[old,...path]);compared++;
   }
  }
  assert.deepEqual(state,before);state=next;
 }
 assert.ok(moving>=50);assert.ok(compared>=40,'the fixture exercises many real path searches');
});

test('a real seventeen-cell Buenos Aires walk retains every illustrated frame and camera viewport',()=>{
 const before=buenosAires(),actor=before.units[0],destination=fullRange(before,actor).filter(point=>point.path.length===17).sort((a,b)=>a.cost-b.cost)[0];
 const state=actBattle(before,{type:'move',unitId:actor.id,x:destination.x,y:destination.y,tacticalLevel:tacticalLevel(destination)});
 assert.equal(state.lastError,null);assert.ok(sameCell(state.units[0],destination));
 const expected=[actor,...destination.path].map(point=>surfaceMotionPoint(before,point,state));
 const actual=movementRoute(before,actor,state.units[0]).map(point=>surfaceMotionPoint(before,point,state));
 assert.deepEqual(actual,expected);
 const players=state.units.filter(unit=>unit.side==='player'),units=state.units.filter(unit=>unit.side==='player'||players.some(player=>canSee(state,player,unit)));
 const revealed=new Set([...(state.revealedRooms??[]),...visibleRooms(state)]),project=(x,y)=>({x:state.height*26+28+(x-y)*26,y:65+(x+y)*14});
 const views=new Set(),frames=new Set(),hidden=state.units.filter(unit=>!units.includes(unit));
 assert.ok(hidden.length>0,'unseen patrols stay out of the rendered roster');
 const frameHtml=(route,index,fraction)=>{
  const elapsedMs=(index+fraction)*240,position={...sampleMovementSegment(route[index],route[index+1],fraction),moving:true,direction:motionDirection(route[index],route[index+1]),frame:Math.floor(elapsedMs/100)%8,elapsedMs};
  const center=projectSurface(state,project,position),viewport=tacticalViewport({x:center.x-240,y:center.y-135,width:480,height:270});
  return {viewport,html:render(h('svg',null,h(Scene,{viewport,state,selected:actor.id,unit:state.units[0],players,units,positions:{[actor.id]:position},poses:{},directions:{},hover:null,mode:'move',aim:0,reachable:[],showSight:false,sight:new Set(),revealed,project,onTile:noop,onHover:noop,onTalk:noop,onCannon:noop,cannonId:''})))};
 };
 for(let index=0;index<17;index++)for(const fraction of [0,.5,1]){
  const oldFrame=frameHtml(expected,index,fraction),newFrame=frameHtml(actual,index,fraction);
  assert.deepEqual(newFrame,oldFrame);views.add(JSON.stringify(newFrame.viewport));frames.add(newFrame.html);
  assert.match(newFrame.html,/data-moving="true"/);assert.match(newFrame.html,/data-sprite-style="illustrated-pixel-art"/);
  assert.doesNotMatch(newFrame.html,/data-sprite-fallback=/);
  for(const enemy of hidden)assert.ok(!newFrame.html.includes(`data-unit-id="${enemy.id}"`));
 }
 assert.ok(views.size>5,'camera follow crosses quantized viewport bounds');
 assert.ok(frames.size>30,'the check compares changing actor positions and sprite frames');
});
