import test from 'node:test';
import assert from 'node:assert/strict';
import {elevationSightClear,obstacleVolumesAt,geometryCells,volumeRayCell} from '../game/sight-geometry.js';
import {projectilePath,projectileFlight} from '../game/projectile-cover.js';
import {knifeFlight} from '../game/knife-flight.js';
import {grenadeFlight,grenadeBlastExposure} from '../game/grenade-flight.js';
import {itemFlight} from '../game/item-flight.js';
import {applyStructureBlast,validateStructureDamage} from '../game/structure-blast.js';
import {environmentActionProfile,resolveEnvironmentInteraction} from '../game/environment-interactions.js';
import {wallEdgeCenter,wallEdgeBlocksMovement,WALL_THICKNESS} from '../game/wall-geometry.js';
import {captureBattlePresentation,recordBattleFrame} from '../game/battle-presentation.js';

const actor=(id,x,y=3,extra={})=>({id,x,y,hp:100,side:id==='a'?'player':'enemy',stance:'standing',...extra});
const field=(edges=[])=>({width:8,height:7,tiles:Array.from({length:56},(_,i)=>({x:i%8,y:Math.floor(i/8),type:'grass',blocked:false,cover:0})),units:[],props:[],wallEdges:edges});
const wall=(extra={})=>({id:'partition',x:2,y:3,axis:'y',type:'wall',material:'adobe',blocked:true,blocksSight:true,cover:40,...extra});
const point=edge=>({...edge,...wallEdgeCenter(edge),wallEdgeId:edge.id});

test('one edge blocks sight across its boundary while both floor cells and the near face remain available',()=>{
 const edge=wall(),s=field([edge]),a=actor('a',1),b=actor('b',2),before=structuredClone(s);
 assert.equal(elevationSightClear(s,a,b),false);assert.equal(elevationSightClear(s,b,a),false);
 assert.equal(elevationSightClear(s,a,actor('same-side',1,4)),true);
 assert.equal(elevationSightClear(s,a,point(edge)),true);assert.equal(elevationSightClear(s,b,point(edge)),true);
 assert.equal(elevationSightClear(s,a,{...point(edge),id:'other',wallEdgeId:'other'}),false);
 assert.equal(elevationSightClear(s,a,{...point(edge),x:2,hp:100,side:'enemy'}),false);
 assert.equal(elevationSightClear(s,a,{...point(edge),x:4}),false,'an edge ID cannot exempt a point behind the edge');
 assert.equal(s.tiles.find(t=>t.x===1&&t.y===3).blocked,false);assert.equal(s.tiles.find(t=>t.x===2&&t.y===3).blocked,false);
 assert.deepEqual(s,before);
});

test('edge clipping uses physical thickness once and never grants the flat muzzle-cell cover exemption',()=>{
 const edge=wall(),s=field([edge]),a=actor('a',1),b=actor('b',3);s.units=[a,b];
 const trace=projectilePath(s,a,b,{damage:1000});
 assert.equal(trace.blocked,false);assert.equal(trace.obstacles.length,1);assert.equal(trace.obstacles[0].sourceId,'edge:partition');
 const expected=80*WALL_THICKNESS*Math.hypot(1,.3/2);
 assert.ok(Math.abs(trace.obstacles[0].resistance-expected)<1e-9);
 edge.projectileResistance=1000;
 const stopped=projectileFlight(s,a,b,{damage:20});assert.equal(stopped.blocked,true);assert.equal(stopped.victimId,null);
 assert.equal(projectilePath(s,actor('a',1,2),actor('b',3,2),{damage:20}).blocked,false,'a nearby edge in another row cannot absorb force');
 const cells=geometryCells(a,b),volumes=cells.flatMap(cell=>obstacleVolumesAt(s,cell).map(volume=>({cell,volume}))).filter(({volume})=>volume.kind==='edge');
 assert.equal(volumes.length,2);assert.ok(volumes.every(({cell,volume})=>volumeRayCell(a,b,cell,volume)));
});

test('horizontal segments and their joined corners block actual crossings while paths beside them remain clear',()=>{
 const horizontal=wall({id:'north',x:2,y:2,axis:'x'}),vertical=wall({id:'west',x:2,y:2,axis:'y'}),s=field([horizontal,vertical]);
 for(const [a,b] of [[actor('a',2,1),actor('b',2,2)],[actor('a',1,1),actor('b',3,3)]]){
  assert.equal(elevationSightClear(s,a,b),false);assert.equal(elevationSightClear(s,b,a),false);
  assert.equal(knifeFlight(s,a,b).blocked,true);assert.equal(knifeFlight(s,b,a).blocked,true);
 }
 assert.equal(elevationSightClear(s,actor('a',2,2),actor('b',3,3)),true,'an inside corner floor can see farther into its room');
 assert.equal(elevationSightClear(s,actor('a',1,2),actor('b',1,0)),true,'a ray beyond the finite segment endpoint is clear');
 assert.equal(elevationSightClear(s,actor('a',1,1),actor('b',3,1)),true,'a parallel ray stays on the same side');
});

test('knives, grenades and ordinary item tosses hit an edge and keep recovery on the near floor',()=>{
 const edge=wall({obstacleHeight:6}),s=field([edge]),a=actor('a',1),b=actor('b',3);s.units=[a,b];
 const knife=knifeFlight(s,a,b),grenade=grenadeFlight(s,a,b),item=itemFlight(s,a,b);
 assert.equal(knife.blocked,true);assert.equal(knife.victimId,null);assert.deepEqual(knife.landing,{x:1,y:3,tacticalLevel:0});
 assert.equal(grenade.blocked,true);assert.deepEqual(grenade.landing,{x:1,y:3,tacticalLevel:0});
 assert.equal(item.blocked,true);assert.equal(item.landing,null);
 assert.ok(knife.impact.x<1.5);assert.ok(grenade.impact.x<1.5);assert.ok(item.path.at(-1).x<1.5);
 edge.obstacleHeight=.5;
 assert.equal(knifeFlight(s,a,b).blocked,false);assert.equal(grenadeFlight(s,a,b).blocked,false);assert.equal(itemFlight(s,a,b).valid,true);
});

test('open doors remove the shared edge volume and windows retain only their low sill',()=>{
 const edge=wall({type:'door',doorId:'entry',open:false,material:'wood'}),s=field([edge]),a=actor('a',1),b=actor('b',3);s.units=[a,b];
 assert.equal(elevationSightClear(s,a,b),false);assert.equal(knifeFlight(s,a,b).blocked,true);
 const opened=resolveEnvironmentInteraction({...a,ap:100},edge,{verb:'open'});Object.assign(edge,opened.target);
 assert.equal(edge.open,true);assert.equal(wallEdgeBlocksMovement(edge),false);
 assert.equal(elevationSightClear(s,a,b),true);assert.equal(knifeFlight(s,a,b).victimId,'b');assert.equal(itemFlight(s,a,b).valid,true);
 Object.assign(edge,{type:'window',open:undefined,blocked:true,blocksSight:false});
 assert.equal(elevationSightClear(s,a,b),true);assert.equal(elevationSightClear(s,{...a,stance:'prone'},{...b,stance:'prone'}),false);
});

test('edge blast damage uses one intact snapshot and opens the boundary for later actions',()=>{
 const edge=wall({material:'wood'}),s=field([edge]),a=actor('a',1),b=actor('b',2);s.props=[{id:'rear-table',type:'table',x:3,y:3}];
 assert.equal(grenadeBlastExposure(s,a,b,4).multiplier,0);
 const hits=applyStructureBlast(s,a,4,{strength:1000});
 assert.equal(hits.length,1);assert.equal(hits[0].kind,'edge');assert.equal(hits[0].id,'partition');assert.equal(hits[0].axis,'y');
 assert.equal(edge.destroyed,true);assert.equal(edge.x,2);assert.equal(edge.y,3);assert.equal(edge.axis,'y');assert.equal(wallEdgeBlocksMovement(edge),false);
 assert.equal(s.props[0].structureDamage,undefined,'the collapsing wall still shields the table during this blast');
 assert.equal(elevationSightClear(s,a,b),true);assert.ok(grenadeBlastExposure(s,a,b,4).multiplier>0);validateStructureDamage(edge,'edge');
 applyStructureBlast(s,a,4,{strength:1000});assert.equal(s.props[0].destroyed,true);
});

test('manual breach destroys only the edge record and preserves its identity and both floors',()=>{
 const edge=wall(),s=field([edge]),unit=actor('a',1,3,{activeSlot:'tool',activeTool:'inventory:bar',inventory:{bar:{itemType:'tool',toolKey:'crowbar',count:1,condition:80,weight:2.5}}}),before=structuredClone(s.tiles);
 const profile=environmentActionProfile(unit,edge,'breach');assert.equal(profile.valid,true);
 const result=resolveEnvironmentInteraction(unit,edge,{verb:'breach'});Object.assign(edge,result.target);
 assert.equal(edge.id,'partition');assert.equal(edge.axis,'y');assert.equal(edge.type,'rubble');assert.equal(edge.destroyed,true);assert.equal(wallEdgeBlocksMovement(edge),false);
 assert.equal(result.unit.inventory.bar.condition,77);assert.deepEqual(s.tiles,before);validateStructureDamage(edge,'edge');
});

test('elevated edges block their floor without creating a barrier downstairs or behind their segment',()=>{
 const edge=wall({tacticalLevel:1,elevation:3}),s=field([edge]);s.upperSurfaces=Array.from({length:4},(_,i)=>({id:`roof:${i+1}`,x:i+1,y:3,tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:0}));
 const a=actor('a',1),b=actor('b',3),upA={...a,tacticalLevel:1},upB={...b,tacticalLevel:1};
 assert.equal(elevationSightClear(s,a,b),true);assert.equal(elevationSightClear(s,upA,upB),false);
 assert.equal(projectilePath(s,a,b,{damage:20}).obstacles.length,0);assert.equal(knifeFlight(s,upA,upB).blocked,true);
 const outer=wall({id:'outer',x:8}),border=field([outer]);assert.equal(elevationSightClear(border,actor('a',7),point(outer)),true,'outer faces use their incident floor as height support');
});

test('thin stone reflection admits only a proved visible face and omits all private contact metadata',()=>{
 const edge=wall({id:'edge-stone',x:7,y:5,axis:'x',material:'stone'}),s=field([edge]);s.width=32;s.height=16;s.tiles=Array.from({length:512},(_,i)=>({x:i%32,y:Math.floor(i/32),type:'grass',blocked:false,cover:0}));
 const a=actor('a',1),aim={x:10,y:5};s.units=[a];
 const trace=projectileFlight(s,a,aim,{damage:20,range:10}),bounce=trace.ricochets[0];
 assert.equal(trace.ricochets.length,1);assert.equal(bounce.sourceId,'edge:edge-stone');assert.equal(bounce.normal.y,-1);
 const contact={sourceId:bounce.sourceId,point:{...bounce.impact},normal:{...bounce.normal}};
 const first={source:{x:7.3,y:4.4,height:1.19,tacticalLevel:0},impact:{...bounce.impact},outcome:'cover',material:'stone',impactSurfaceContact:contact};
 const second={source:{...bounce.impact},impact:{x:7.6,y:4.41,height:1.18,tacticalLevel:0},discharge:false,sourceSurfaceContact:contact};
 const observe=(state,p)=>p.id==='a'||p.x!==7||p.y!==4,exterior=(state,p)=>p.id==='edge-stone';
 const capture=(state,visual,faceObserver=exterior)=>captureBattlePresentation(state,()=>{const next=structuredClone(state);recordBattleFrame(next,{type:'projectile',action:'firePoint',unitId:'a',shotVisual:visual});return next;},observe,faceObserver);
 for(const visual of [first,second]){
  const result=capture(s,visual);assert.equal(result.frames.length,1);assert.deepEqual(result.frames[0].shotVisual.impact,visual.impact);
  assert.deepEqual(result.state,s);assert.doesNotMatch(JSON.stringify(result.frames[0].shotVisual),/sourceId|SurfaceContact|edge-stone/);
  const forged=structuredClone(visual);(forged.impactSurfaceContact??forged.sourceSurfaceContact).sourceId='edge:other';
  assert.ok(capture(s,forged).frames.every(frame=>!frame.shotVisual),'a different edge cannot prove this contact');
  assert.ok(capture(s,visual,()=>false).frames.every(frame=>!frame.shotVisual),'a concealed physical edge cannot admit its contact');
 }
 const privateEdge=wall({id:'private-edge',x:7,y:5,axis:'x',material:'stone',obstacleHeight:2}),hidden={...s,wallEdges:[edge,privateEdge]};
 assert.deepEqual(capture(hidden,first).frames.map(frame=>frame.shotVisual),capture(s,first).frames.map(frame=>frame.shotVisual),'private adjacent geometry cannot veto an observed edge contact');
});
