import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createBattle} from '../game/tactical.js';
import {beginSectorDeployment} from '../game/sector-deployment.js';
import {mountBattlefield} from './mounted-battlefield.mjs';
const {default:Battlefield}=await import('../web/app/Battlefield.tsx');
const {default:JA2Strip}=await import('../web/app/JA2Strip.tsx');
const {default:AimCursor}=await import('../web/app/AimCursor.tsx');
const {default:TacticalSceneControls}=await import('../web/app/TacticalSceneControls.tsx');
const nodes=node=>!node||typeof node!=='object'?[]:[node,...(Array.isArray(node)?node:Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(nodes)];

test('ordinary exploration immediately centers its selected off-center actor at default zoom without changing the battle',async t=>{
 const battle=createBattle([{id:'p',name:'Observador',x:4,y:4,weapon:1800,loaded:1}],{width:64,height:48,enemies:[],exploration:true}),before=structuredClone(battle),changes=[];
 assert.equal(battle.deployment,undefined);assert.equal(battle.deploymentComplete,undefined);
 const mounted=await mountBattlefield(t,Battlefield,{battle,onChange:state=>{changes.push(state);return state;},onFinish(){}});
 const tree=nodes(mounted.tree()),strip=tree.find(node=>node.type===JA2Strip),scene=tree.find(node=>node.type===TacticalSceneControls),{cameraRect,selected,zoom}=strip.props;
 const actor=battle.units.find(unit=>unit.id===selected),point=scene.props.project(actor.x,actor.y);
 assert.equal(zoom,2);assert.equal(selected,'p');
 assert.equal(cameraRect.x+cameraRect.width/2,point.x);assert.equal(cameraRect.y+cameraRect.height/2,point.y);
 assert.ok(point.x>=cameraRect.x&&point.x<=cameraRect.x+cameraRect.width&&point.y>=cameraRect.y&&point.y<=cameraRect.y+cameraRect.height,'The selected actor is visible before any camera input.');
 assert.deepEqual(changes,[]);assert.deepEqual(battle,before);
});

test('active arrival deployment retains its map overview instead of centering the off-center actor',async t=>{
 const squad=[{id:'p',name:'Recién llegado',x:0,y:4,weapon:1800,loaded:1,entryReason:'arrival',entryEdge:'W',entryAnchor:{x:0,y:4}}];
 const battle=createBattle(squad,{width:64,height:48,enemies:[],exploration:true,deferContact:true});
 assert.equal(beginSectorDeployment(battle,{squad}),true);
 const before=structuredClone(battle),changes=[];
 const mounted=await mountBattlefield(t,Battlefield,{battle,onChange:state=>{changes.push(state);return state;},onFinish(){}});
 const tree=nodes(mounted.tree()),strip=tree.find(node=>node.type===JA2Strip),{cameraRect,vw,vh,zoom}=strip.props;
 assert.equal(zoom,2);assert.equal(cameraRect.x+cameraRect.width/2,vw/2);assert.equal(cameraRect.y+cameraRect.height/2,vh/2);
 assert.deepEqual(changes,[]);assert.deepEqual(battle,before);
});

test('camera translation retains viewport dimensions and pointer world coordinates through pan and zoom',async t=>{
 const battle=createBattle([{id:'p',name:'Observador',x:24,y:20,weapon:1800,loaded:1}],{width:64,height:48,enemies:[],exploration:true});
 const mounted=await mountBattlefield(t,Battlefield,{battle,onChange:state=>state,onFinish(){}});
 const get=type=>nodes(mounted.tree()).find(node=>node.type===type),field=()=>nodes(mounted.tree()).find(node=>node.props?.className?.startsWith('tactical-field'));
 await mounted.act(async()=>document.body.dispatchEvent(new window.KeyboardEvent('keydown',{key:'f',bubbles:true})));
 for(const zoom of [2,1,3]){
  while(get(JA2Strip).props.zoom!==zoom)await mounted.act(async()=>get(JA2Strip).props.onZoom(zoom-get(JA2Strip).props.zoom));
  const before=field().props.viewBox;
  await mounted.act(async()=>get(JA2Strip).props.onCameraPan(90,65));
  assert.equal(field().props.viewBox,before,'panning must not relayout the root SVG viewport');
  const {cameraRect}=get(JA2Strip).props,[x,y,width,height]=before.split(' ').map(Number);
  assert.equal(x,0);assert.equal(y,0);assert.equal(width,cameraRect.width);assert.equal(height,cameraRect.height);
  const camera=nodes(mounted.tree()).find(node=>node.props?.['data-scene-camera']);
  assert.equal(camera.props.transform,`translate(${-cameraRect.x} ${-cameraRect.y})`);
  const inverse={},svg={getScreenCTM:()=>({inverse:()=>inverse}),createSVGPoint:()=>({x:0,y:0,matrixTransform(matrix){assert.equal(matrix,inverse);return {x:(this.x-40)/zoom,y:(this.y-60)/zoom};}})};
  await mounted.act(async()=>field().props.onMouseMoveCapture({currentTarget:svg,clientX:180,clientY:200}));
  assert.deepEqual(get(AimCursor).props.point,{x:cameraRect.x+140/zoom,y:cameraRect.y+140/zoom});
  await mounted.act(async()=>field().props.onFocusCapture({currentTarget:svg,target:{getBoundingClientRect:()=>({left:100,top:120,width:20,height:40})}}));
  assert.deepEqual(get(AimCursor).props.point,{x:cameraRect.x+70/zoom,y:cameraRect.y+80/zoom});
 }
 await mounted.act(async()=>document.body.dispatchEvent(new window.KeyboardEvent('keydown',{key:'g',bubbles:true})));
 await mounted.act(async()=>get(TacticalSceneControls).props.onTile({x:25,y:20}));
 const job=mounted.jobs().find(message=>message.job.kind==='movement-step').job;
 assert.equal(job.action.type,'move');assert.equal(job.action.x,25);assert.equal(job.action.y,20);
});
