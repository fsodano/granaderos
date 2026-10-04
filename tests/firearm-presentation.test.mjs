import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {createBattle,actBattle,presentedActBattle,presentedEndTurn,endTurn,teamCanSee,weaponFor} from '../game/tactical.js';
import {captureBattlePresentation,recordBattleFrame} from '../game/battle-presentation.js';
import {battleFrameDuration,battleFrameFocus,firearmFlightDuration} from '../game/battle-playback.js';
import {absoluteBodyHeight} from '../game/sight-geometry.js';
import {projectileFlight} from '../game/projectile-cover.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {mountBattlefield} from './mounted-battlefield.mjs';
const {default:TacticalThreeScene}=await import('../web/app/TacticalThreeScene.tsx');
const {default:Battlefield}=await import('../web/app/Battlefield.tsx');
const {default:TacticalSceneControls}=await import('../web/app/TacticalSceneControls.tsx');
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

test('stopped cover uses the exact interior ray point and material rather than a target-centre hit',()=>{
 const s=field(),cover=s.tiles.find(t=>t.x===4&&t.y===3);Object.assign(cover,{type:'wall',blocked:true,blocksSight:false,material:'stone',obstacleHeight:2});
 const shooter=actor(s,'p'),target=actor(s,'e'),weapon=weaponFor(shooter),muzzle=absoluteBodyHeight(s,shooter,'muzzle'),aimHeight=absoluteBodyHeight(s,target,'torso'),slope=(aimHeight-muzzle)/(target.x-shooter.x);
 // Stone spends 120 force per crossed 3D unit. The real configured ball enters
 // at 3.5 and exhausts its force inside the wall, before reaching the target.
 const stopX=3.5+weapon.damage/(120*Math.hypot(1,slope)),stopHeight=muzzle+(stopX-shooter.x)*slope;
 const raw=projectileFlight(s,shooter,target,weapon),r=presentedActBattle(s,order),visual=shot(r).shotVisual;
 assert.deepEqual(r.state,actBattle(s,order));assert.equal(visual.outcome,'cover');assert.equal(visual.material,'stone');
 assert.ok(stopX>3.5&&stopX<4.5);assert.ok(Math.abs(visual.impact.x-stopX)<1e-10);assert.equal(visual.impact.y,3);
 assert.ok(Math.abs(visual.impact.height-stopHeight)<1e-10);assert.deepEqual(visual.impact,raw.terminal.impact);assert.equal(actor(r.state,'e').hp,100);
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
 assert.deepEqual(r.state,actBattle(s,action));assert.ok(r.state.npcs[0].hp<100);assert.ok(r.state.units[1].hp<100);
 const knownInjuries=r.frames.flatMap(frame=>frame.impacts);assert.deepEqual(knownInjuries.map(i=>[i.unitId,i.victimKind??'unit']),[['e','unit']]);assert.equal(knownInjuries[0].damage,100-r.state.units[1].hp);
 for(const frame of r.frames){assert.ok(!frame.targetPoint||frame.targetPoint.x!==12);if(frame.shotVisual){assert.notEqual(frame.shotVisual.source.x,11.5);assert.notEqual(frame.shotVisual.impact.x,11.5);}}
 // When that exact civilian is visible, its own collection supplies one
 // reaction; the same-ID soldier is not substituted in preparation or damage.
 Object.assign(s.tiles.find(p=>p.x===12&&p.y===3),{type:'grass',cover:0,concealment:0});
 const publicAction={...action,targetKind:'npc'},visible=presentedActBattle(s,publicAction);
 assert.deepEqual(visible.state,actBattle(s,publicAction));assert.equal(visible.frames[0].targetPoint.x,12);
 const impacts=visible.frames.flatMap(f=>f.impacts),civilian=impacts.filter(i=>i.victimKind==='npc');assert.equal(civilian.length,1);assert.equal(civilian[0].x,12);assert.equal(civilian[0].damage,100-visible.state.npcs[0].hp);
 const soldier=impacts.filter(i=>i.victimKind!=='npc');assert.equal(soldier.length,visible.state.units[1].hp<100?1:0);if(soldier.length)assert.equal(soldier[0].damage,100-visible.state.units[1].hp);
});

test('each paired pistol presents its own real charge while pellets do not invent individual flight paths',()=>{
 const paired=field({weapon:1805,condition:100,offHand:{count:1,weapon:1808,weight:1.3,loaded:2,condition:100,jammed:false}},{seed:127}),r=presentedActBattle(paired,order);
 assert.deepEqual(r.state,actBattle(paired,order));assert.equal(r.frames.filter(f=>f.type==='projectile').length,2);
 assert.equal(actor(r.state,'p').loaded,0);assert.equal(actor(r.state,'p').offHand.loaded,1);
 const cone=field({weapon:1807}),pellets=presentedActBattle(cone,order),visual=shot(pellets).shotVisual;
 assert.deepEqual(pellets.state,actBattle(cone,order));assert.equal(visual.spread,true);assert.equal(visual.outcome,'pellets');
 const markup=render(h('svg',null,h(FirearmShotEffect,{state:cone,visual,stage:'projectile',project})));assert.match(markup,/data-firearm-discharge/);assert.doesNotMatch(markup,/animateMotion|data-firearm-impact|data-firearm-flight/);
});

for(const mountedTarget of [false,true])test(`mounted paired leg shots keep the admitted aim after the first ${mountedTarget?'unhorses':'knocks down'} the target`,async t=>{
 // This is the existing seed127 paired-pistol case. The standing leg ray can
 // still touch the fallen body; the mounted leg ray passes above it instead.
 const s=createBattle([{id:'p',name:'Tirador',x:2,y:2,facing:2,weapon:1805,loaded:1,ammo:8,condition:81,weaponInstanceId:'first',marksmanship:100,
  offHand:{count:1,weapon:1808,weight:1.3,loaded:2,condition:100,jammed:false,instanceId:'second',name:'De familia'}}],
  {width:20,height:8,seed:127,tiles:Array.from({length:160},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',cover:0,blocked:false})),
   enemies:[{id:'e',x:5,y:2,mounted:mountedTarget,patrol:false,overwatch:false},{id:'reserve',x:18,y:6,patrol:false,overwatch:false}]});
 for(const u of s.units.filter(u=>u.side==='enemy'))u.ap=0;
 const before=structuredClone(s),action={type:'fire',unitId:'p',targetId:'e',aim:4,hitLocation:'legs'},expected=presentedActBattle(s,action),commits=[];
 const flights=expected.frames.filter(f=>f.type==='projectile'),impacts=expected.frames.filter(f=>f.type==='impact');
 const sourceHeight=absoluteBodyHeight(s,actor(s,'p'),'muzzle'),aimHeight=absoluteBodyHeight(s,actor(s,'e'),'legs'),slope=(aimHeight-sourceHeight)/3;
 assert.deepEqual(expected.state,actBattle(s,action));assert.deepEqual(s,before);
 assert.deepEqual(actBattle(validateBattleSnapshot(JSON.parse(JSON.stringify(s))),action),expected.state);
 assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(expected.state))),expected.state);
 assert.equal(flights.length,2);assert.equal(impacts.length,2);
 for(const frame of flights){const v=frame.shotVisual;assert.notEqual(v.discharge,false);assert.deepEqual(v.source,{x:2,y:2,tacticalLevel:0,height:sourceHeight});
  assert.ok(Math.abs((v.impact.height-sourceHeight)/(v.impact.x-2)-slope)<1e-12,'each gun follows the same originally admitted aim');assert.equal(v.impact.y,2);assert.deepEqual(frame.impacts,[]);}
 assert.equal(actor(flights[0].state,'e').hp,100);assert.equal(actor(impacts[0].state,'e').hp,70);
 assert.equal(actor(impacts[0].state,'e').stance,'prone');assert.equal(actor(impacts[0].state,'e').mounted,false);assert.equal(actor(flights[1].state,'e').hp,70);
 assert.deepEqual(impacts.flatMap(f=>f.impacts).map(i=>[i.unitId,i.damage]),mountedTarget?[['e',30]]:[['e',30],['e',22]]);
 assert.equal(actor(expected.state,'e').hp,mountedTarget?70:48);
 assert.ok(Math.abs(flights[1].shotVisual.impact.x-(mountedTarget?16:5))<1e-12);assert.equal(flights[1].shotVisual.outcome,mountedTarget?'cover':'hit');
 if(mountedTarget){assert.equal(flights[1].shotVisual.material,'earth');assert.equal(flights[1].shotVisual.impact.height,0);assert.deepEqual(impacts[1].impacts,[]);}
 assert.equal(teamCanSee(s,'player',actor(s,'reserve')),false);
 assert.deepEqual(actor(expected.state,'reserve'),{...actor(s,'reserve'),lastHeardNoise:{x:2,y:2,turn:1,kind:'fire',uncertainty:3}});
 for(const frame of expected.frames){assert.ok(!frame.visibleIds.includes('reserve'));assert.ok(!frame.impacts.some(i=>i.unitId==='reserve'));assert.ok(!frame.targetPoint||frame.targetPoint.x!==18);assert.equal(frame.shotVisual?.victimId,undefined);}
 const shooter=actor(expected.state,'p');assert.equal(shooter.ap,80);assert.equal(shooter.energy,100);assert.equal(shooter.loaded,0);assert.equal(shooter.offHand.loaded,1);assert.equal(shooter.ammo,8);
 assert.equal(shooter.condition,80);assert.equal(shooter.offHand.condition,99);assert.equal(expected.state.smoke.length,2);assert.equal(expected.state.elapsedSeconds,6);assert.equal(expected.state.seed,mountedTarget?366914888:4258295815);
 assert.equal(expected.state.preparedIntent,undefined);assert.equal(expected.state.shotVisual,undefined);
 const mounted=await mountBattlefield(t,Battlefield,{battle:s,onChange:next=>{commits.push(next);return next;},onFinish(){}},{virtualTimers:true});
 window.matchMedia=()=>({matches:mountedTarget,addEventListener(){},removeEventListener(){}});
 const strip=()=>nodes(mounted.tree()).find(n=>n.props?.onOrder&&n.props?.onEndTurn);await mounted.act(async()=>strip().props.onOrder(action));
 let discharges=0;
 for(const frame of expected.frames){
  assert.equal(strip().props.busy,true);assert.deepEqual(commits,[]);
  const scene=nodes(mounted.tree()).find(n=>n.type===TacticalSceneControls),effect=nodes(mounted.tree()).find(n=>n.type===TacticalThreeScene)?.props.effects.find(effect=>effect.kind==='firearm');assert.deepEqual(scene.props.state.units,frame.state.units);
  if(frame.shotVisual){assert.ok(effect);assert.deepEqual(effect.visual,frame.shotVisual);assert.equal(effect.stage,frame.type);
   assert.equal(effect.durationSeconds,battleFrameDuration(frame)/1000);assert.ok(Number.isFinite(effect.startedAtSeconds));
   assert.equal(effect.visual.source.height,frame.shotVisual.source.height);
   if(frame.type==='projectile')discharges++;
  }
  await mounted.act(async()=>strip().props.onOrder(action));assert.deepEqual(commits,[]);
  assert.equal(await mounted.nextDelay(),battleFrameDuration(frame));
 }
 assert.equal(discharges,2);assert.deepEqual(commits,[expected.state]);assert.equal(strip().props.busy,false);assert.equal(nodes(mounted.tree()).find(n=>n.type===TacticalThreeScene).props.effects.some(effect=>effect.kind==='firearm'),false);assert.deepEqual(s,before);
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
  const effect=nodes(mounted.tree()).find(n=>n.type===TacticalThreeScene)?.props.effects.find(effect=>effect.kind==='firearm'),scene=nodes(mounted.tree()).find(n=>n.type===TacticalSceneControls);
  if(frame.type==='projectile'){sawFlight=true;assert.ok(effect);assert.equal(effect.stage,'projectile');assert.equal(actor(scene.props.state,'e').hp,100);await mounted.act(async()=>strip().props.onOrder(action));assert.deepEqual(commits,[]);}
  if(frame.type==='impact'){sawImpact=true;assert.ok(effect);assert.equal(effect.visual.outcome,hit?'hit':'miss');assert.equal(actor(scene.props.state,'e').hp,actor(expected.state,'e').hp);}
  const delay=await mounted.nextDelay();assert.equal(delay,battleFrameDuration(frame));
 }
 assert.ok(sawFlight&&sawImpact);assert.deepEqual(commits,[expected.state]);assert.equal(strip().props.busy,false);assert.equal(nodes(mounted.tree()).find(n=>n.type===TacticalThreeScene).props.effects.some(effect=>effect.kind==='firearm'),false);
});

test('reduced motion uses static finite cues with no SVG motion animation',async t=>{
 const s=field(),visual=shot(presentedActBattle(s,order)).shotVisual;
 const mounted=await mountBattlefield(t,Battlefield,{battle:s,onChange(){},onFinish(){}},{virtualTimers:true});
 window.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
 for(const stage of ['projectile','impact']){const markup=render(h('svg',null,h(FirearmShotEffect,{state:s,visual,stage,project})));assert.match(markup,/data-firearm-reduced-motion/);assert.doesNotMatch(markup,/animate|animateMotion|animateTransform/);}
 assert.equal(nodes(mounted.tree()).find(n=>n.type===TacticalThreeScene).props.effects.some(effect=>effect.kind==='firearm'),false);
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
  const scene=nodes(mounted.tree()).find(n=>n.type===TacticalSceneControls),effect=nodes(mounted.tree()).find(n=>n.type===TacticalThreeScene)?.props.effects.find(effect=>effect.kind==='firearm');
  if(frame.type==='projectile'){assert.equal(effect.stage,'projectile');assert.equal(actor(scene.props.state,'friend').hp,actor(frame.state,'friend').hp);await mounted.act(async()=>strip().props.onOrder(action));assert.deepEqual(commits,[]);}
  if(frame.type==='impact'){assert.equal(effect.stage,'impact');assert.equal(actor(scene.props.state,'friend').hp,actor(expected.state,'friend').hp);}
  assert.equal(await mounted.nextDelay(),battleFrameDuration(frame));
 }
 assert.deepEqual(commits,[expected.state]);assert.equal(strip().props.busy,false);assert.equal(actor(expected.state,'p').loaded,0);assert.equal(expected.state.elapsedSeconds,6);
});
