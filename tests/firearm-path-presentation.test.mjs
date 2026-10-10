import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {createBattle,actBattle,presentedActBattle,weaponFor} from '../game/tactical.js';
import {compileWeaponDefinition} from '../game/weapon-definition.js';
import {projectileFlight} from '../game/projectile-cover.js';
import {projectileTrajectory,projectileTrajectoryPoint} from '../game/projectile-trajectory.js';
import {captureBattlePresentation,recordBattleFrame} from '../game/battle-presentation.js';
const {default:FirearmShotEffect}=await import('../web/app/FirearmShotEffect.tsx');
const tiles=(width,height)=>Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,blocksSight:false,cover:0}));
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);
const capture=(raw,observe=()=>true)=>{
 const s={units:[{id:'p',side:'player',x:1,y:3,hp:100}],tiles:[]};
 return captureBattlePresentation(s,()=>{recordBattleFrame(s,{type:'projectile',unitId:'p',action:'fire',shotVisual:raw});return s;},observe).frames[0]?.shotVisual;
};

test('a resolved dropping firearm publishes the observed curve rather than its endpoint chord',()=>{
 const contentWeapon=compileWeaponDefinition({id:'short-path-pistol',name:'Pistola',template:1805,damage:42,fireAP:7,aimAP:3,reloadAP:32,range:2});
 const s=createBattle([{id:'p',x:1,y:3,facing:2,weapon:1805,loaded:1,condition:100,marksmanship:100,contentWeapon}],{width:28,height:8,seed:9,tiles:tiles(28,8),enemies:[{id:'e',x:15,y:3,patrol:false,overwatch:false,morale:100}]});
 const action={type:'fire',unitId:'p',targetId:'e',aim:4,hitLocation:'head'},result=presentedActBattle(s,action),visual=result.frames.find(frame=>frame.type==='projectile').shotVisual;
 const physical=projectileFlight(s,s.units[0],s.units[1],weaponFor(s.units[0]),'head'),model=physical.trajectoryModel;
 assert.deepEqual(result.state,actBattle(s,action));assert.ok(model.curvature>0);assert.equal(visual.outcome,'hit');
 assert.deepEqual(visual.points[0],visual.source);assert.deepEqual(visual.points.at(-1),visual.impact);assert.ok(visual.points.length>3&&visual.points.length<=256);
 for(const point of visual.points){const fraction=(point.x-model.source.x)/(model.destination.x-model.source.x),expected=projectileTrajectoryPoint(model,fraction,point.tacticalLevel);near(point.height,expected.height);assert.deepEqual(Object.keys(point).sort(),['height','tacticalLevel','x','y']);}
 const middle=visual.points[Math.floor(visual.points.length/2)],fraction=(middle.x-visual.source.x)/(visual.impact.x-visual.source.x),chord=visual.source.height+(visual.impact.height-visual.source.height)*fraction;
 assert.ok(Math.abs(middle.height-chord)>.1,'the published curve cannot become the straight endpoint chord');
 assert.doesNotMatch(JSON.stringify(visual),/trajectoryModel|victimId|SurfaceContact|sourceId/);
 const markup=render(h('svg',null,h(FirearmShotEffect,{state:s,visual,stage:'projectile',project:(x,y)=>({x,y})})));
 assert.equal((markup.match(/ L/g)??[]).length,visual.points.length-1,'SVG follows all admitted curve points');
});

test('visibility clipping excludes every hidden sample and removes the unobserved outcome',()=>{
 const source={x:1,y:3,height:1.4,tacticalLevel:0},destination={x:12,y:3,height:1.1,tacticalLevel:0},model=projectileTrajectory(source,destination,{range:2,dropIncrement:.02});
 const raw={source,destination,impact:projectileTrajectoryPoint(model,1),trajectoryModel:model,outcome:'cover',material:'stone',victimId:'private',victimObserved:false,privateGeometry:{secret:true}};
 const visual=capture(raw,(_state,point)=>point.id==='p'||point.x<7);
 assert.ok(visual.points.length>2);assert.ok(visual.points.every(point=>Math.round(point.x)<7));assert.deepEqual(visual.points.at(-1),visual.impact);assert.equal(visual.outcome,null);assert.equal(visual.material,undefined);
 assert.doesNotMatch(JSON.stringify(visual),/private|secret|trajectoryModel|victimId/);
 const clear={...raw};delete clear.victimId;clear.impact=destination;clear.trajectoryModel=projectileTrajectory(source,destination);
 const hidden={...clear,impact:{...projectileTrajectoryPoint(clear.trajectoryModel,.7)},victimId:'private',victimObserved:false};
 assert.deepEqual(capture(clear,(_state,point)=>point.id==='p'||point.x<7),capture(hidden,(_state,point)=>point.id==='p'||point.x<7),'private endpoint cannot shift the observed fixed sampling grid');
});

test('public flight paths have a finite size bound and retain their actual first and last points',()=>{
 const source={x:1,y:3,height:1.4,tacticalLevel:0},impact={x:100,y:3,height:1.1,tacticalLevel:0},trajectoryModel=projectileTrajectory(source,impact);
 const visual=capture({source,impact,trajectoryModel,outcome:'miss'});
 assert.equal(visual.points.length,256);assert.deepEqual(visual.points[0],source);assert.deepEqual(visual.points.at(-1),impact);
 const markup=render(h('svg',null,h(FirearmShotEffect,{state:{tiles:[]},visual:{...visual,points:[source,{...impact,height:NaN}]},stage:'projectile',project:(x,y)=>({x,y})})));
 assert.equal(markup,'<svg></svg>');
});

test('a continuation keeps the original curved leg without replaying its muzzle discharge',()=>{
 const model=projectileTrajectory({x:1,y:3,height:1.4,tacticalLevel:0},{x:18,y:3,height:1.1,tacticalLevel:0},{range:2,dropIncrement:.02});
 const source=projectileTrajectoryPoint(model,.4),impact=projectileTrajectoryPoint(model,.8),visual=capture({source,impact,trajectoryModel:model,outcome:'cover',material:'earth',discharge:false});
 assert.equal(visual.discharge,false);assert.deepEqual(visual.points[0],source);assert.deepEqual(visual.points.at(-1),impact);
 for(const point of visual.points){assert.ok(point.x>=source.x&&point.x<=impact.x);near(point.height,projectileTrajectoryPoint(model,(point.x-1)/17).height);}
});
