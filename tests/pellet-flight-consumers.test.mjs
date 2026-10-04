import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {createBattle,actBattle,presentedActBattle,weaponFor,actionCosts,firearmFlightPreview,firearmVolleyPreview,firearmShotOptions,teamCanSee} from '../game/tactical.js';
import {shotLoadFlight,shotLoadForecast} from '../game/shot-load.js';
import {firearmBystanderRisk} from '../game/firearm-bystander-risk.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {battleFrameDuration,battleFrameFocus} from '../game/battle-playback.js';
import {absoluteBodyHeight} from '../game/sight-geometry.js';
import {projectileTrajectoryPoint} from '../game/projectile-trajectory.js';
import {secondaryPistolView} from '../game/paired-fire.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {targetPreview} from '../game/ja2-hud.js';
import {COMBAT_BALANCE} from '../game/combat-balance.js';

const tiles=(width,height)=>Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',cover:0,blocked:false,blocksSight:false}));
const field=(extra={},companions=[])=>createBattle([{id:'p',name:'Tirador',x:1,y:8,facing:2,weapon:1807,loaded:1,ammo:9,condition:100,marksmanship:100},...companions],{
 width:28,height:17,seed:45,tiles:tiles(28,17),weather:{rain:0,humidity:0},
 enemies:[{id:'e',x:4,y:8,weapon:1813,morale:100,patrol:false,overwatch:false}],npcs:[],...extra,
});
const actor=(s,id='p')=>s.units.find(u=>u.id===id);
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);
const saved=s=>validateBattleSnapshot(JSON.parse(JSON.stringify(s)));
const publicFlight=f=>({type:f.type,action:f.action,unitId:f.unitId,visibleIds:f.visibleIds,impacts:f.impacts,targetPoint:f.targetPoint,shotVisual:f.shotVisual,duration:battleFrameDuration(f),focus:battleFrameFocus(f)});
const shoot=(s,action={type:'fire',unitId:'p',targetId:'e',aim:4})=>{
 const before=structuredClone(s),ordinary=actBattle(s,action),shown=presentedActBattle(s,action);
 assert.equal(ordinary.lastError,null,ordinary.lastError);assert.deepEqual(shown.state,ordinary);assert.deepEqual(s,before);
 assert.deepEqual(actBattle(saved(s),action),ordinary);assert.deepEqual(saved(ordinary),ordinary);
 return {ordinary,shown};
};

test('known-person warnings include a falling tail, but exclude a prone person after every reachable ground path',()=>{
 const s=field({npcs:[{id:'n',name:'Compañero a la vista',x:14,y:11,hp:100,stance:'prone'}]}),u=actor(s),target=actor(s,'e'),before=structuredClone(s);
 assert.equal(teamCanSee(s,'player',s.npcs[0]),true);
 const flight=shotLoadFlight(s,u,target,weaponFor(u)),contact=flight.bodyImpacts.find(hit=>hit.victimKind==='npc'&&hit.victimId==='n');
 assert.ok(contact);assert.equal(contact.hitLocation,'legs');
 const ray=flight.pellets[contact.pelletIndex].flight;
 assert.ok(contact.fraction>ray.trajectoryModel.dropStart,'this person is contacted after gravity starts');
 const linear=ray.trajectoryModel.source.height+ray.trajectoryModel.rise*contact.fraction;
 assert.ok(linear>contact.impact.height);close(contact.impact.height,projectileTrajectoryPoint(ray.trajectoryModel,contact.fraction).height);
 const risk=firearmBystanderRisk(s,u,target);assert.ok(risk.direct.some(body=>body.id==='n'));
 assert.match(targetPreview(s,u,target,{mode:'fire'}).coverNote,/Personas en la trayectoria: Compañero a la vista/);
 assert.deepEqual(s,before,'warning and geometry read no RNG or inventory');

 const stopped=field({enemies:[{id:'e',x:12,y:8,weapon:1813,morale:100,patrol:false,overwatch:false}],npcs:[{id:'n',name:'Después del suelo',x:19,y:8,hp:100,stance:'prone'}]},[{id:'observer',x:20,y:9,facing:7,weapon:1813}]),end=actor(stopped,'e'),start=actor(stopped);
 const lower=shotLoadFlight(stopped,start,end,weaponFor(start),'legs');
 assert.ok(lower.pellets.some(p=>p.flight.terminal.termination==='ground'&&p.flight.terminal.fraction>p.flight.trajectoryModel.dropStart));
 assert.ok(lower.pellets.every(p=>!p.flight.bodyImpacts.some(hit=>hit.victimKind==='npc'&&hit.victimId==='n')));
 assert.equal(teamCanSee(stopped,'player',stopped.npcs[0]),true);
 assert.deepEqual(firearmBystanderRisk(stopped,start,end,'legs'),{direct:[],scatter:[]});
 assert.doesNotMatch(targetPreview(stopped,start,end,{mode:'fire',hitLocation:'legs'}).coverNote,/Después del suelo/);
});

test('weighted far forecasts value actual regions and AI avoids a known friendly reached beyond nominal range',()=>{
 const s=field({enemies:[{id:'e',x:19,y:8,stance:'crouched',weapon:1813,morale:100,patrol:false,overwatch:false}]}),u=actor(s),target=actor(s,'e'),before=structuredClone(s);
 const path=firearmFlightPreview(s,u,target,'head'),central=path.pellets[0].flight,contact=central.bodyImpacts.find(hit=>hit.victimId==='e');
 assert.ok(contact);assert.equal(contact.hitLocation,'torso');assert.ok(contact.fraction>central.trajectoryModel.dropStart);
 const straight=central.trajectoryModel.source.height+central.trajectoryModel.rise*contact.fraction;
 assert.ok(straight>absoluteBodyHeight(s,target,'torso')+.2,'the unchanged straight head aim would contact the head');
 assert.ok(contact.impact.height<absoluteBodyHeight(s,target,'torso')+.2);
 const prediction=firearmVolleyPreview(s,u,target,4,'head').shots[0],force=path.scatter.reduce((sum,outcome)=>sum+outcome.weight*outcome.flight.bodyImpacts.filter(hit=>hit.victimKind==='unit'&&hit.victimId===target.id).reduce((n,hit)=>n+hit.incomingImpact,0),0);
 // Each pellet has less force than any body resistance, so a real contact
 // stops it. The forecast therefore has no conditional passage approximation.
 const probability=path.scatter.reduce((sum,outcome)=>sum+(outcome.flight.bodyImpacts.some(hit=>hit.victimKind==='unit'&&hit.victimId===target.id)?outcome.weight:0),0);
 assert.ok(probability>0&&probability<1);assert.equal(prediction.chance,Math.round(probability*100));close(prediction.expectedForce,force);
 close(prediction.damageFactor,force/(probability*weaponFor(u).damage));assert.ok(prediction.expectedDamage>0);
 assert.equal(prediction.physicalHitLocation,undefined,'an aggregate load does not promise a single struck region');
 assert.deepEqual(s,before);

 // Declared injured target and finite armed enemy; no health or gear changes
 // occur while choosing the order. The ally lies in the new falling tail.
 const ai=createBattle([{id:'p',x:4,y:8,hp:30,weapon:1813}],{width:28,height:17,seed:45,tiles:tiles(28,17),weather:{rain:0,humidity:0},enemies:[
  {id:'e',x:1,y:8,facing:2,weapon:1807,loaded:1,ammo:9,condition:100,marksmanship:100,morale:100,patrol:false,overwatch:false},
  {id:'ally',x:14,y:11,stance:'prone',weapon:1813,morale:100,patrol:false,overwatch:false},
 ],npcs:[]}),unchanged=structuredClone(ai),shooter=actor(ai,'e'),victim=actor(ai);
 const options=firearmShotOptions(ai,shooter,victim,0),torso=options.find(option=>option.hitLocation==='torso'),head=options.find(option=>option.hitLocation==='head');
 assert.equal(torso.interveningFriendly,true);assert.ok(torso.expectedDamage>head.expectedDamage);assert.equal(head.interveningFriendly,undefined);
 assert.deepEqual(chooseEnemyAction(ai,shooter),{type:'fire',unitId:'e',targetId:'p',aim:0,hitLocation:'head'});
 const alone=structuredClone(ai);alone.units=alone.units.filter(unit=>unit.id!=='ally');
 assert.deepEqual(chooseEnemyAction(alone,actor(alone,'e')),{type:'fire',unitId:'e',targetId:'p',aim:0,hitLocation:'torso'});assert.deepEqual(ai,unchanged);
});

test('real concealed tail harm and private cover cannot move, retime or refocus the admitted public discharge',()=>{
 const secret={id:'secret',name:'Nombre privado',x:14,y:11,hp:100,stance:'prone',roomId:'unrevealed'},clear=field(),hidden=field({npcs:[secret]}),action={type:'fire',unitId:'p',targetId:'e',aim:4};
 const a=shoot(clear,action),b=shoot(hidden,action),first=r=>r.shown.frames.find(f=>f.type==='projectile');
 assert.equal(teamCanSee(hidden,'player',hidden.npcs[0]),true,'room knowledge is separate from geometric sight');
 assert.deepEqual(firearmVolleyPreview(hidden,actor(hidden),actor(hidden,'e'),4),firearmVolleyPreview(clear,actor(clear),actor(clear,'e'),4));
 assert.deepEqual(firearmBystanderRisk(hidden,actor(hidden),actor(hidden,'e')),firearmBystanderRisk(clear,actor(clear),actor(clear,'e')));
 assert.ok(b.ordinary.npcs[0].hp<secret.hp);assert.deepEqual(publicFlight(first(b)),publicFlight(first(a)));
 assert.equal(actor(b.ordinary).loaded,0);assert.equal(actor(b.ordinary).ammo,actor(hidden).ammo);assert.equal(actor(b.ordinary).condition,99);
 assert.equal(actor(b.ordinary).ap,actor(hidden).ap-actionCosts(hidden,actor(hidden),actor(hidden,'e')).fire-4*actionCosts(hidden,actor(hidden),actor(hidden,'e')).aim);
 assert.equal(b.ordinary.elapsedSeconds,6);assert.equal(b.ordinary.seed,a.ordinary.seed,'geometry adds no random draw for these nonpenetrating pellets');
 assert.doesNotMatch(b.ordinary.log.join(' '),/Nombre privado|secret/);
 for(const frame of b.shown.frames){assert.ok(!frame.impacts.some(hit=>hit.unitId==='secret'));assert.doesNotMatch(JSON.stringify({visual:frame.shotVisual,target:frame.targetPoint,impacts:frame.impacts}),/secret|trajectoryModel|trajectory/);}

 const {roomId,...knownBody}=secret;
 const known=field({npcs:[{...knownBody,id:'known',name:'Persona visible'}]}),screened=field({npcs:[{...knownBody,id:'known',name:'Persona visible'}],props:[{id:'private-screen',type:'barrels',x:13,y:11,roomId:'unrevealed',obstacleHeight:1,projectileResistance:1000,blocksSight:false,blocksMovement:false}]}),c=shoot(known,action),d=shoot(screened,action);
 assert.deepEqual(firearmVolleyPreview(screened,actor(screened),actor(screened,'e'),4),firearmVolleyPreview(known,actor(known),actor(known,'e'),4));
 assert.deepEqual(firearmBystanderRisk(screened,actor(screened),actor(screened,'e')),firearmBystanderRisk(known,actor(known),actor(known,'e')));
 assert.ok(c.ordinary.npcs[0].hp<known.npcs[0].hp);assert.equal(d.ordinary.npcs[0].hp,screened.npcs[0].hp,'private physical cover still stops the real tail');
 assert.deepEqual(publicFlight(first(d)),publicFlight(first(c)));assert.doesNotMatch(d.ordinary.log.join(' '),/private-screen|cobertura/);
 assert.ok(d.shown.frames.every(frame=>!frame.impacts.some(hit=>hit.unitId==='known')),'the display cannot invent a covered injury');
});

test('a mixed paired order keeps original mounted aim height after actual unhorsing while its second pellet tail falls',()=>{
 const s=createBattle([{id:'p',x:1,y:8,facing:2,weapon:1805,loaded:1,ammo:8,condition:100,marksmanship:100,offHand:{weapon:1808,count:1,weight:1.3,loaded:2,condition:100,ammunitionChoice:'ammoShot',instanceId:'finite-second'}}],{
  width:28,height:17,seed:127,tiles:tiles(28,17),weather:{rain:0,humidity:0},npcs:[],enemies:[{id:'e',x:9,y:8,mounted:true,patrol:false,overwatch:false,morale:100},{id:'reserve',x:26,y:15,patrol:false,overwatch:false}],
 }),action={type:'fire',unitId:'p',targetId:'e',aim:4,hitLocation:'legs'},height=absoluteBodyHeight(s,actor(s,'e'),'legs'),{ordinary,shown}=shoot(s,action),frames=shown.frames.filter(frame=>frame.type==='projectile'),second=frames[1];
 assert.equal(frames.length,2);assert.equal(frames[0].state.units.find(u=>u.id==='e').hp,100);assert.equal(actor(ordinary,'e').mounted,false);assert.equal(actor(ordinary,'e').knockedDown,true);
 assert.ok(actor(ordinary,'e').hp<100);assert.equal(actor(second.state,'e').hp,actor(ordinary,'e').hp);assert.equal(second.shotVisual.spread,true);close(second.shotVisual.impact.height,height);
 const view=secondaryPistolView(actor(second.state)),weapon=weaponFor(view),point={...actor(s,'e'),...second.shotVisual.impact};
 const frozen=shotLoadFlight(second.state,view,point,weapon,'legs',{destinationHeight:height}),retargeted=shotLoadFlight(second.state,view,point,weapon,'legs',{destinationHeight:absoluteBodyHeight(second.state,actor(second.state,'e'),'legs')});
 assert.ok(frozen.pellets.every(p=>p.flight.trajectoryModel));assert.equal(frozen.pellets[0].flight.terminal.termination,'range');assert.equal(retargeted.pellets[0].flight.terminal.termination,'ground','retargeting the second load to the fallen body would change its flight');
 assert.equal(actor(ordinary).loaded,0);assert.equal(actor(ordinary).offHand.loaded,1);assert.equal(actor(ordinary).ammo,actor(s).ammo);assert.equal(actor(ordinary).condition,99);assert.equal(actor(ordinary).offHand.condition,99);assert.equal(actor(ordinary).offHand.instanceId,'finite-second');
 assert.equal(ordinary.elapsedSeconds,6);assert.equal(actor(ordinary).ap,actor(s).ap-actionCosts(s,actor(s),actor(s,'e')).fire-4*actionCosts(s,actor(s),actor(s,'e')).aim);
 for(const frame of frames)assert.doesNotMatch(JSON.stringify(frame.shotVisual),/trajectoryModel|trajectory/);
});

test('maximum-map forecasts keep finite per-load tails and bounded transient samples without mutation or cache state',t=>{
 const s=field({width:128,height:128,tiles:tiles(128,128),enemies:[{id:'e',x:126,y:8,weapon:1813,morale:100,patrol:false,overwatch:false}]}),u=actor(s),target=actor(s,'e'),before=structuredClone(s),receipts=[];
 // These are admitted authored range bounds, supplied only to the pure model.
 // No live actor acquires a changed weapon or extra ammunition.
 for(const range of [1,42,100]){
  const start=performance.now(),weapon={...weaponFor(u),range},forecast=shotLoadForecast(s,u,target,weapon),flights=[forecast,...forecast.scatter.map(outcome=>outcome.flight)].flatMap(load=>load.pellets.map(p=>p.flight));
  assert.ok(flights.length<=82*9);let samples=0;
  for(const flight of flights){
   assert.ok(Math.hypot(flight.destination.x-u.x,flight.destination.y-u.y)<=range*COMBAT_BALANCE.shotLoadFlightRangeMultiplier+1e-9);
   assert.ok((flight.trajectory?.length??0)<=256,'three-range/map clipping bounds the inspection samples');samples+=flight.trajectory?.length??0;
   if(flight.trajectory?.length)assert.equal(flight.trajectory.at(-1).fraction,flight.terminal.fraction);
  }
  receipts.push({range,paths:flights.length,samples,milliseconds:Math.round(performance.now()-start)});
 }
 assert.deepEqual(s,before);assert.equal(s.pellets,undefined);assert.equal(s.trajectoryModel,undefined);t.diagnostic(JSON.stringify(receipts));
});
