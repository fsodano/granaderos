import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {createBattle,actBattle,presentedActBattle,presentedEndTurn,endTurn,teamCanSee} from '../game/tactical.js';
import {captureBattlePresentation,recordBattleFrame} from '../game/battle-presentation.js';
import {battleFrameDuration,battleFrameFocus,firearmFlightDuration} from '../game/battle-playback.js';
import {absoluteBodyHeight} from '../game/sight-geometry.js';
import {projectileFlight} from '../game/projectile-cover.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {mountBattlefield} from './mounted-battlefield.mjs';
const {default:Battlefield}=await import('../web/app/Battlefield.tsx');
const {default:TacticalScene}=await import('../web/app/TacticalScene.tsx');
const {default:FirearmShotEffect}=await import('../web/app/FirearmShotEffect.tsx');
const nodes=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(nodes):[n,...nodes(n.props?.children)];
const project=(x,y)=>({x:300+(x-y)*26,y:70+(x+y)*14});
const field=(patch={},extra={})=>createBattle([{id:'p',name:'Tirador',x:1,y:3,facing:2,weapon:1801,marksmanship:100,ammo:2,condition:100,...patch}],{width:28,height:8,seed:45,tiles:Array.from({length:224},(_,i)=>({x:i%28,y:Math.floor(i/28),type:'grass',cover:0,blocked:false})),enemies:[{id:'e',name:'Objetivo',x:7,y:3,morale:100,patrol:false,overwatch:false}],...extra});
const order={type:'fire',unitId:'p',targetId:'e',aim:2};
const actor=(s,id)=>s.units.find(u=>u.id===id);
const shot=r=>r.frames.find(f=>f.type==='projectile');

for(const hit of [true,false])test(`real visible ${hit?'hit':'miss'} has a paid flight before its consequence and preserves the reducer result`,()=>{
 const s=field({weapon:hit?1801:1805,marksmanship:hit?100:1}),before=structuredClone(s),action={...order,aim:hit?2:0},r=presentedActBattle(s,action),flight=shot(r),impact=r.frames.find(f=>f.type==='impact');
 assert.deepEqual(r.state,actBattle(s,action));assert.deepEqual(s,before);
 assert.ok(flight);assert.equal(actor(flight.state,'p').loaded,0);assert.equal(actor(flight.state,'p').ap,actor(r.state,'p').ap);
 assert.equal(actor(flight.state,'e').hp,100);assert.deepEqual(flight.impacts,[]);
 assert.equal(flight.shotVisual.outcome,hit?'hit':'miss');
 assert.ok(Math.abs(flight.shotVisual.impact.x-(hit?6.5:17))<1e-10);assert.equal(flight.shotVisual.impact.y,3);
 assert.equal(impact.impacts.length,hit?1:0);assert.equal(actor(impact.state,'e').hp,actor(r.state,'e').hp);
 assert.equal(battleFrameDuration(flight),firearmFlightDuration(flight.shotVisual));assert.equal(battleFrameDuration(impact),hit?900:600);
 assert.equal(r.state.elapsedSeconds,6);assert.ok(battleFrameDuration(r.frames[0])+battleFrameDuration(flight)+battleFrameDuration(impact)>=1340);
 assert.ok(Math.abs(battleFrameFocus(flight).x-(hit?3.75:9))<1e-10);assert.equal(battleFrameFocus(flight).y,3);
 assert.ok(r.frames.at(-1).shotComplete);assert.equal(battleFrameDuration(r.frames.at(-1)),0);
 assert.equal(r.state.shotVisual,undefined);assert.equal(JSON.stringify(r.state).includes('projectileMinimum'),false);
 assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(r.state))),r.state);
});

test('stopped cover uses the actual ray entry and material rather than a target-centre hit',()=>{
 const s=field(),cover=s.tiles.find(t=>t.x===4&&t.y===3);Object.assign(cover,{type:'wall',blocked:true,blocksSight:false,material:'stone',obstacleHeight:2});
 const raw=projectileFlight(s,actor(s,'p'),actor(s,'e'),{damage:58}),r=presentedActBattle(s,order),visual=shot(r).shotVisual;
 assert.deepEqual(r.state,actBattle(s,order));assert.equal(visual.outcome,'cover');assert.equal(visual.material,'stone');
 assert.equal(visual.impact.x,1+6*raw.obstacles[0].fraction);assert.equal(visual.impact.x,3.5);assert.equal(visual.impact.y,3);
 assert.equal(visual.impact.height,1.4+(1.1-1.4)*raw.obstacles[0].fraction);assert.equal(actor(r.state,'e').hp,100);
 const markup=render(h('svg',null,h(FirearmShotEffect,{state:s,visual,stage:'impact',project})));assert.match(markup,/data-impact-material="stone"/);assert.match(markup,/data-firearm-impact="cover"/);
});

test('a scattered elevated shot retains the physical aim height even when the scattered cell has no roof',()=>{
 const upperSurfaces=Array.from({length:7},(_,i)=>({id:`roof-${i}`,x:i+1,y:3,tacticalLevel:1,elevation:3,kind:'roof',type:'floor',blocked:false,cover:0}));
 const s=field({marksmanship:1,tacticalLevel:1},{upperSurfaces});actor(s,'e').tacticalLevel=1;
 const r=presentedActBattle(s,{...order,aim:0}),visual=shot(r)?.shotVisual;
 assert.equal(r.state.lastError,null);assert.deepEqual(r.state,actBattle(s,{...order,aim:0}));assert.ok(visual);
 assert.equal(visual.source.height,absoluteBodyHeight(s,actor(s,'p'),'muzzle'));
 // Cell8 has no supporting upper surface. The admitted part of the real ray
 // still slopes toward the original4.1m aim, without inventing a roof there.
 const fraction=(visual.impact.x-1)/7;
 assert.equal(visual.impact.height,4.4+(4.1-4.4)*fraction);assert.equal(s.upperSurfaces.some(p=>p.x===8),false);
 assert.ok(visual.impact.x<8);
});

test('a concealed interception cannot add a shooter, victim identifier, hidden endpoint or impact effect',()=>{
 const s=field({marksmanship:0},{seed:3});s.units.push({...structuredClone(actor(s,'e')),id:'hidden',name:'Secreto',x:8,y:4});
 Object.assign(s.tiles.find(t=>t.x===5&&t.y===4),{type:'wall',blocked:true,blocksSight:true,material:'wood'});
 const empty=structuredClone(s);empty.units.pop();assert.equal(teamCanSee(s,'player',actor(s,'hidden')),false);
 const action={...order,aim:0},r=presentedActBattle(s,action),clean=presentedActBattle(empty,action);
 assert.deepEqual(r.state,actBattle(s,action));assert.ok(actor(r.state,'hidden').hp<100);
 assert.deepEqual(shot(r).shotVisual,shot(clean).shotVisual);
 for(const frame of r.frames){assert.ok(!frame.visibleIds.includes('hidden'));assert.ok(!frame.impacts.some(i=>i.unitId==='hidden'));assert.ok(!JSON.stringify(frame.shotVisual??{}).includes('Secreto'));assert.equal(frame.shotVisual?.victimId,undefined);}
 const hiddenShot=captureBattlePresentation(s,()=>{const n=structuredClone(s);recordBattleFrame(n,{type:'projectile',unitId:'hidden',action:'fire',shotVisual:{source:{x:8,y:4,height:1.4},impact:{x:1,y:3,height:1.1}}});actor(n,'p').hp-=5;recordBattleFrame(n,{type:'impact',unitId:'hidden',action:'fire'});return n;},(s,u)=>teamCanSee(s,'player',u));
 assert.equal(hiddenShot.frames.length,1);assert.equal(hiddenShot.frames[0].unitId,null);assert.equal(hiddenShot.frames[0].shotVisual,undefined);
});

test('visible enemy firearms use the same staged sequence and retain the actual enemy turn',()=>{
 const s=field();actor(s,'p').ap=0;const r=presentedEndTurn(s);
 assert.deepEqual(r.state,endTurn(s));assert.ok(r.frames.some(f=>f.unitId==='e'&&f.type==='projectile'&&f.shotVisual));
 for(const frame of r.frames.filter(f=>f.shotVisual))assert.ok(frame.shotVisual.visible);
});

test('a hidden civilian sharing a visible soldier ID never inherits that soldier admission or hit coordinates',()=>{
 const s=field({weapon:1800,stance:'prone',movementMode:'prone'},{enemies:[{id:'e',x:15,y:3,stance:'prone',movementMode:'prone',patrol:false,overwatch:false,morale:100}],npcs:[{id:'e',name:'Civil oculto',x:12,y:3,stance:'prone',hp:100}]});
 Object.assign(s.tiles.find(p=>p.x===12&&p.y===3),{type:'forest',cover:100,concealment:100});
 assert.equal(teamCanSee(s,'player',s.units[1]),true);assert.equal(teamCanSee(s,'player',s.npcs[0]),false);
 assert.equal(teamCanSee(s,'player',{x:12,y:3}),true,'visible terrain does not admit the hidden civilian body');
 const action={...order,aim:4},r=presentedActBattle(s,action);
 assert.deepEqual(r.state,actBattle(s,action));assert.ok(r.state.npcs[0].hp<100);assert.equal(r.state.units[1].hp,100);
 for(const frame of r.frames){assert.deepEqual(frame.impacts,[]);assert.ok(!frame.targetPoint||frame.targetPoint.x!==12);assert.ok(!frame.shotVisual||frame.shotVisual.outcome!=='hit');}
 // When that exact civilian is visible, its own collection supplies one
 // reaction; the same-ID soldier is not substituted in preparation or damage.
 Object.assign(s.tiles.find(p=>p.x===12&&p.y===3),{type:'grass',cover:0,concealment:0});
 const publicAction={...action,targetKind:'npc'},visible=presentedActBattle(s,publicAction);
 assert.deepEqual(visible.state,actBattle(s,publicAction));assert.equal(visible.frames[0].targetPoint.x,12);
 const impacts=visible.frames.flatMap(f=>f.impacts);assert.equal(impacts.length,1);assert.equal(impacts[0].victimKind,'npc');assert.equal(impacts[0].x,12);assert.equal(impacts[0].damage,100-visible.state.npcs[0].hp);
});

test('each paired pistol presents its own real charge while pellets do not invent individual flight paths',()=>{
 const paired=field({weapon:1805,condition:100,offHand:{count:1,weapon:1808,weight:1.3,loaded:2,condition:100,jammed:false}},{seed:127}),r=presentedActBattle(paired,order);
 assert.deepEqual(r.state,actBattle(paired,order));assert.equal(r.frames.filter(f=>f.type==='projectile').length,2);
 assert.equal(actor(r.state,'p').loaded,0);assert.equal(actor(r.state,'p').offHand.loaded,1);
 const cone=field({weapon:1807}),pellets=presentedActBattle(cone,order),visual=shot(pellets).shotVisual;
 assert.deepEqual(pellets.state,actBattle(cone,order));assert.equal(visual.spread,true);assert.equal(visual.outcome,'pellets');
 const markup=render(h('svg',null,h(FirearmShotEffect,{state:cone,visual,stage:'projectile',project})));assert.match(markup,/data-firearm-discharge/);assert.doesNotMatch(markup,/animateMotion|data-firearm-impact|data-firearm-flight/);
});

test('the projectile is a finite muted moving speck and a bare miss creates no dust or surface strike',()=>{
 const s=field({weapon:1805,marksmanship:1}),visual=shot(presentedActBattle(s,{...order,aim:0})).shotVisual;
 const draw=(stage,v=visual)=>render(h('svg',null,h(FirearmShotEffect,{state:s,visual:v,stage,project}))),flight=draw('projectile'),miss=draw('impact');
 assert.match(flight,/data-muzzle-flash/);assert.match(flight,/animateMotion/);assert.ok(flight.includes(`dur="${firearmFlightDuration(visual)/1000}s"`));assert.doesNotMatch(flight,/filter=|linearGradient|polyline|stroke-dasharray|#00ff|NaN|Infinity/);
 assert.match(miss,/data-firearm-impact="miss"/);assert.doesNotMatch(miss,/attributeName="rx"|animateTransform|data-impact-material/);
 assert.doesNotMatch(draw('projectile',{...visual,visible:false}),/data-firearm/);assert.doesNotMatch(draw('projectile',{...visual,impact:{x:NaN,y:3,height:1}}),/data-firearm/);
 assert.equal(firearmFlightDuration({...visual,impact:{...visual.impact,x:100}}),650);
});

for(const hit of [true,false])test(`mounted ${hit?'hit':'near miss'} holds input through travel and impact before its single commit`,async t=>{
 const s=field({weapon:hit?1801:1805,marksmanship:hit?100:1}),action={...order,aim:hit?2:0},expected=presentedActBattle(s,action),commits=[];
 const mounted=await mountBattlefield(t,Battlefield,{battle:s,onChange:next=>{commits.push(next);return next;},onFinish(){}},{virtualTimers:true});
 const strip=()=>nodes(mounted.tree()).find(n=>n.props?.onOrder&&n.props?.onEndTurn);
 await mounted.act(async()=>strip().props.onOrder(action));let sawFlight=false,sawImpact=false;
 for(const frame of expected.frames){
  assert.deepEqual(commits,[]);assert.equal(strip().props.busy,true);
  const effect=nodes(mounted.tree()).find(n=>n.type===FirearmShotEffect),scene=nodes(mounted.tree()).find(n=>n.type===TacticalScene);
  if(frame.type==='projectile'){sawFlight=true;assert.ok(effect);assert.equal(effect.props.stage,'projectile');assert.equal(actor(scene.props.state,'e').hp,100);await mounted.act(async()=>strip().props.onOrder(action));assert.deepEqual(commits,[]);}
  if(frame.type==='impact'){sawImpact=true;assert.ok(effect);assert.equal(effect.props.visual.outcome,hit?'hit':'miss');assert.equal(actor(scene.props.state,'e').hp,actor(expected.state,'e').hp);}
  const delay=await mounted.nextDelay();assert.equal(delay,battleFrameDuration(frame));
 }
 assert.ok(sawFlight&&sawImpact);assert.deepEqual(commits,[expected.state]);assert.equal(strip().props.busy,false);assert.equal(nodes(mounted.tree()).some(n=>n.type===FirearmShotEffect),false);
});

test('reduced motion uses static finite cues with no SVG motion animation',async t=>{
 const s=field(),visual=shot(presentedActBattle(s,order)).shotVisual;
 const mounted=await mountBattlefield(t,Battlefield,{battle:s,onChange(){},onFinish(){}},{virtualTimers:true});
 window.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
 for(const stage of ['projectile','impact']){const markup=render(h('svg',null,h(FirearmShotEffect,{state:s,visual,stage,project})));assert.match(markup,/data-firearm-reduced-motion/);assert.doesNotMatch(markup,/animate|animateMotion|animateTransform/);}
 assert.equal(nodes(mounted.tree()).some(n=>n.type===FirearmShotEffect),false);
});

test('a mounted missed shot travels beyond the aim cell before its real downstream injury and single commit',async t=>{
 const s=field({marksmanship:1});s.units.push({...structuredClone(s.units[0]),id:'friend',name:'Compañero',x:9,y:3});
 const action={...order,aim:0},expected=presentedActBattle(s,action),flight=shot(expected),impact=expected.frames.find(f=>f.type==='impact'),commits=[];
 assert.deepEqual(expected.state,actBattle(s,action));assert.equal(actor(expected.state,'e').hp,100);assert.ok(actor(expected.state,'friend').hp<100);
 assert.ok(Math.abs(flight.shotVisual.impact.x-8.5)<1e-10);assert.equal(flight.shotVisual.outcome,'hit');assert.equal(actor(flight.state,'friend').hp,100);assert.deepEqual(flight.impacts,[]);
 assert.deepEqual(impact.impacts.map(i=>i.unitId),['friend']);assert.equal(impact.impacts[0].damage,100-actor(expected.state,'friend').hp);
 const mounted=await mountBattlefield(t,Battlefield,{battle:s,onChange:next=>{commits.push(next);return next;},onFinish(){}},{virtualTimers:true});
 const strip=()=>nodes(mounted.tree()).find(n=>n.props?.onOrder&&n.props?.onEndTurn);await mounted.act(async()=>strip().props.onOrder(action));
 for(const frame of expected.frames){
  assert.equal(strip().props.busy,true);assert.deepEqual(commits,[]);
  const scene=nodes(mounted.tree()).find(n=>n.type===TacticalScene),effect=nodes(mounted.tree()).find(n=>n.type===FirearmShotEffect);
  if(frame.type==='projectile'){assert.equal(effect.props.stage,'projectile');assert.equal(actor(scene.props.state,'friend').hp,100);await mounted.act(async()=>strip().props.onOrder(action));assert.deepEqual(commits,[]);}
  if(frame.type==='impact'){assert.equal(effect.props.stage,'impact');assert.equal(actor(scene.props.state,'friend').hp,actor(expected.state,'friend').hp);}
  assert.equal(await mounted.nextDelay(),battleFrameDuration(frame));
 }
 assert.deepEqual(commits,[expected.state]);assert.equal(strip().props.busy,false);assert.equal(actor(expected.state,'p').loaded,0);assert.equal(expected.state.elapsedSeconds,6);
});
