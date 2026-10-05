import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {OrthographicCamera,Vector3} from '../web/node_modules/three/build/three.module.js';
const {sectorProject,updateSectorCamera,TILE_METRES,actorYaw}=await import('../web/lib/three/projection.ts');
const {projectSurface,ELEVATION_PIXELS_PER_METRE}=await import('../web/lib/tactical-elevation.ts');
const {sampleMovementSegment,motionTransitions}=await import('../web/app/useUnitMotion.ts');

test('metric 3D camera aligns with map controls at every zoom, pan and surface height',()=>{
 for(const [width,height]of [[769,600],[1440,810],[390,700]])for(const zoom of [.7,1,2,4])for(const [x,y]of [[0,0],[150,80],[-100,290]]){
  const view={x,y,width:width/zoom,height:height/zoom,mapHeight:32},camera=new OrthographicCamera();updateSectorCamera(camera,view);
  const project=sectorProject(32);
  for(const point of [[0,0,0],[12,8,0],[4.3,21.7,3],[20,3,6.4],[4,4,.15]]){
   const [gx,gy,elevation]=point,v=new Vector3(gx*TILE_METRES,elevation,gy*TILE_METRES).project(camera),expected=project(gx,gy);
   assert.ok(Math.abs((v.x+1)*view.width/2-(expected.x-x))<1e-8);
   assert.ok(Math.abs((1-v.y)*view.height/2-(expected.y-y-elevation*ELEVATION_PIXELS_PER_METRE))<1e-8);
  }
 }
});
test('3D roof controls use actual metres without changing legacy editor projection',()=>{
 const state={width:1,height:1,tiles:[{x:0,y:0}],upperSurfaces:[{x:0,y:0,tacticalLevel:1,elevation:3,kind:'roof'}]};
 const point={x:0,y:0,tacticalLevel:1,renderedOffset:{x:.4,y:.4,height:10}};
 const metric=sectorProject(1),actual=projectSurface(state,metric,point);
 assert.deepEqual(actual,{x:54,y:65-3*ELEVATION_PIXELS_PER_METRE});
 const legacy=(x,y)=>metric(x,y);assert.notDeepEqual(projectSurface(state,legacy,point),actual);
});
test('actor heading retains the existing grid-to-screen compass',()=>{
 const forward=new Vector3(0,0,1).applyAxisAngle(new Vector3(0,1,0),actorYaw(3));assert.ok(forward.distanceTo(new Vector3(1,0,0))<1e-12);
 assert.equal(actorYaw(5),0);
});
test('soldiers and civilians with the same ID keep separate movement history',()=>{
 const unit={id:'same',x:1,y:1},npc={id:'same',x:5,y:5};
 const before={units:[unit],npcs:[npc]},after={units:[{...unit,x:2}],npcs:[{...npc,y:6}]};
 const transitions=motionTransitions(before,after,new Set(['unit:same','npc:same']),new Set(['unit:same','npc:same']));
 assert.equal(transitions.find(entry=>entry.key==='unit:same').old,unit);assert.equal(transitions.find(entry=>entry.key==='npc:same').old,npc);
 assert.equal(motionTransitions(before,after,undefined,new Set(['npc:same'])).length,1);
});
test('climb sampling retains the recorded access link and metric height',()=>{
 const point=sampleMovementSegment({x:1,y:1,renderedHeight:0},{x:1,y:2,tacticalLevel:1,renderedHeight:3,kind:'climb',linkId:'ladder'},.5);
 assert.equal(point.kind,'climb');assert.equal(point.linkId,'ladder');assert.equal(point.renderedHeight,1.5);assert.equal(point.climbDirection,1);
});
