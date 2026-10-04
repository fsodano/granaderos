import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {createBattle,actBattle,presentedActBattle,presentedEndTurn,endTurn,teamCanSee,actionCosts,weaponFor} from '../game/tactical.js';
import {COMBAT_BALANCE} from '../game/combat-balance.js';
import {absoluteBodyHeight} from '../game/sight-geometry.js';
import {battleFrameDuration,battleFrameFocus,battleFramePose} from '../game/battle-playback.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {mountBattlefield} from './mounted-battlefield.mjs';
const {default:Battlefield}=await import('../web/app/Battlefield.tsx');
const {default:TacticalScene}=await import('../web/app/TacticalScene.tsx');
const {default:FirearmShotEffect}=await import('../web/app/FirearmShotEffect.tsx');
const nodes=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(nodes):[n,...nodes(n.props?.children)];
const project=(x,y)=>({x:300+(x-y)*26,y:70+(x+y)*14});
const unit=(s,id)=>s.units.find(u=>u.id===id);
const action={type:'fire',unitId:'p',targetId:'a',aim:4};
// An explicit arena with one finite loaded musket and two loose cartridges.
// Every injury and penetration below comes from the ordinary shot reducer.
const field=(extra={})=>createBattle([{id:'p',name:'Tirador',x:1,y:3,facing:2,weapon:1801,marksmanship:100,ammo:2,condition:100}],{width:24,height:8,seed:9,tiles:Array.from({length:192},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',cover:0,blocked:false,blocksSight:false})),enemies:[{id:'a',name:'Primero',x:7,y:3,patrol:false,overwatch:false,morale:100},{id:'b',name:'Segundo',x:9,y:3,patrol:false,overwatch:false,morale:100}],...extra});
const visuals=r=>r.frames.filter(frame=>frame.shotVisual);
const flights=r=>r.frames.filter(frame=>frame.type==='projectile'&&frame.shotVisual);
const losses=r=>r.frames.flatMap(frame=>frame.impacts);
const draw=(s,frame)=>render(h('svg',null,h(FirearmShotEffect,{state:s,visual:frame.shotVisual,stage:frame.type,project})));

test('one real musket ball presents its two ordered injuries without changing resources, randomness or the saved result',()=>{
 const s=field(),before=structuredClone(s),r=presentedActBattle(s,action),cost=actionCosts(s,unit(s,'p'),unit(s,'a'));
 assert.deepEqual(r.state,actBattle(s,action));assert.deepEqual(s,before);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(r.state))),r.state);
 assert.deepEqual(r.frames.map(f=>f.type),['prepare','projectile','impact','projectile','impact','result']);
 assert.deepEqual(losses(r).map(i=>i.unitId),['a','b']);assert.ok(unit(r.state,'a').hp<100);assert.ok(unit(r.state,'b').hp<100);
 for(const [index,id]of ['a','b'].entries()){
  const flight=flights(r)[index],impact=r.frames.filter(f=>f.type==='impact')[index];
  assert.equal(unit(flight.state,id).hp,100);assert.equal(unit(impact.state,id).hp,unit(r.state,id).hp);
  assert.deepEqual(impact.impacts.map(i=>i.unitId),[id]);assert.equal(impact.impacts[0].damage,100-unit(r.state,id).hp);
 }
 assert.equal(unit(flights(r)[1].state,'a').hp,unit(r.state,'a').hp);
 assert.deepEqual(flights(r)[1].shotVisual.source,flights(r)[0].shotVisual.impact);
 assert.equal(flights(r)[1].shotVisual.discharge,false);assert.equal(battleFramePose(flights(r)[1]),'idle');
 assert.equal(flights(r).map(f=>draw(s,f)).join('').match(/data-muzzle-flash/g)?.length,1);
 assert.equal(unit(r.state,'p').loaded,0);assert.equal(unit(r.state,'p').ammo,unit(s,'p').ammo);assert.equal(unit(r.state,'p').ap,unit(s,'p').ap-cost.fire-action.aim*cost.aim);
 assert.equal(r.state.smoke.length,1);assert.equal(r.state.elapsedSeconds,6);assert.ok(r.frames.at(-1).shotComplete);
 assert.equal(r.state.bodyImpacts,undefined);assert.equal(r.state.shotVisual,undefined);
});

test('the same ball reaches a real stone wall after its first injury and never strikes the person behind it',()=>{
 const s=field();Object.assign(s.tiles.find(t=>t.x===8&&t.y===3),{type:'wall',blocked:true,blocksSight:false,material:'stone',obstacleHeight:2});
 const shooter=unit(s,'p'),target=unit(s,'a'),muzzle=absoluteBodyHeight(s,shooter,'muzzle'),slope=(absoluteBodyHeight(s,target,'torso')-muzzle)/(target.x-shooter.x);
 // Passing the first torso spends 30 configured force before the remaining
 // ball reaches stone at 7.5. Its actual stop lies within that wall.
 const remaining=weaponFor(shooter).damage-COMBAT_BALANCE.firearmBodyResistance.torso,stopX=7.5+remaining/(120*Math.hypot(1,slope));
 const r=presentedActBattle(s,action);assert.deepEqual(r.state,actBattle(s,action));assert.deepEqual(losses(r).map(i=>i.unitId),['a']);assert.equal(unit(r.state,'b').hp,100);
 const last=r.frames.filter(f=>f.type==='impact').at(-1);assert.equal(last.shotVisual.outcome,'cover');assert.equal(last.shotVisual.material,'stone');assert.deepEqual(last.impacts,[]);
 assert.ok(stopX>7.5&&stopX<8.5);assert.ok(Math.abs(last.shotVisual.impact.x-stopX)<1e-10);assert.ok(Math.abs(last.shotVisual.impact.height-(muzzle+(stopX-shooter.x)*slope))<1e-10);assert.deepEqual(flights(r)[1].shotVisual.source,flights(r)[0].shotVisual.impact);
 assert.match(draw(s,last),/data-impact-material="stone"/);assert.doesNotMatch(draw(s,flights(r)[1]),/data-muzzle-flash/);
});

test('an unseen intermediate person changes real force but cannot become a segment endpoint, origin, injury or camera target',()=>{
 const s=field({enemies:[{id:'a',x:7,y:3,patrol:false,overwatch:false,morale:100},{id:'b',x:15,y:3,patrol:false,overwatch:false,morale:100}],npcs:[{id:'hidden',name:'Persona secreta',x:12,y:3,stance:'crouched',movementMode:'crouch',hp:100}]});
 Object.assign(s.tiles.find(t=>t.x===12&&t.y===3),{concealment:100});assert.equal(teamCanSee(s,'player',s.npcs[0]),false);assert.equal(teamCanSee(s,'player',unit(s,'b')),true);
 const r=presentedActBattle(s,action);assert.deepEqual(r.state,actBattle(s,action));assert.ok(r.state.npcs[0].hp<100);assert.equal(unit(r.state,'b').hp,100);assert.deepEqual(losses(r).map(i=>i.unitId),['a']);
 assert.equal(flights(r).length,2);assert.deepEqual(flights(r)[1].shotVisual.source,flights(r)[0].shotVisual.impact);assert.equal(flights(r)[1].shotVisual.outcome,null);
 for(const frame of r.frames){
  assert.ok(!frame.impacts.some(i=>i.victimKind==='npc'));assert.ok(!frame.targetPoint||frame.targetPoint.x!==12);
  if(frame.shotVisual){assert.notEqual(frame.shotVisual.source.x,11.5);assert.notEqual(frame.shotVisual.impact.x,11.5);assert.ok(!JSON.stringify(frame.shotVisual).includes('secreta'));}
  const focus=battleFrameFocus(frame);if(focus)assert.notEqual(focus.x,12);
 }
 assert.equal(r.frames.filter(f=>f.shotVisual?.outcome==='hit').length,2,'only the real first known injury receives a body cue');
});

test('the existing known-wall fallback survives a concealed same-ID civilian interception',()=>{
 const s=createBattle([{id:'p',x:1,y:3,facing:2,weapon:1800,marksmanship:100,stance:'prone',movementMode:'prone'}],{width:28,height:8,seed:45,tiles:Array.from({length:224},(_,i)=>({x:i%28,y:Math.floor(i/28),type:'grass',cover:0,blocked:false,blocksSight:false})),enemies:[{id:'a',x:15,y:3,stance:'prone',movementMode:'prone',patrol:false,overwatch:false,morale:100}],npcs:[{id:'a',name:'Civil oculto',x:12,y:3,stance:'prone',hp:100}]});
 Object.assign(s.tiles.find(t=>t.x===12&&t.y===3),{type:'forest',cover:100,concealment:100});Object.assign(s.tiles.find(t=>t.x===13&&t.y===3),{type:'wall',blocked:true,blocksSight:false,material:'stone',obstacleHeight:2});
 const clean=structuredClone(s);clean.npcs=[];assert.equal(teamCanSee(s,'player',s.npcs[0]),false);
 const r=presentedActBattle(s,action),empty=presentedActBattle(clean,action);assert.deepEqual(r.state,actBattle(s,action));assert.ok(r.state.npcs[0].hp<100);
 assert.deepEqual(visuals(r).map(f=>f.shotVisual),visuals(empty).map(f=>f.shotVisual));assert.ok(visuals(r).every(f=>f.shotVisual.material==='stone'));assert.deepEqual(losses(r),[]);
});

test('observed same-ID soldier and civilian impacts remain distinct and occur in physical order',()=>{
 const s=field({enemies:[{id:'a',x:7,y:3,patrol:false,overwatch:false,morale:100}],npcs:[{id:'a',name:'Vecino visible',x:9,y:3,hp:100}]}),r=presentedActBattle(s,action);
 assert.deepEqual(r.state,actBattle(s,action));assert.deepEqual(losses(r).map(i=>[i.unitId,i.victimKind??'unit']),[['a','unit'],['a','npc']]);
 assert.equal(losses(r)[0].damage,100-unit(r.state,'a').hp);assert.equal(losses(r)[1].damage,100-r.state.npcs[0].hp);
 assert.equal(r.frames.filter(f=>f.type==='impact')[0].state.npcs[0].hp,100);assert.equal(flights(r)[1].shotVisual.discharge,false);
});

test('the existing bodyguard interception presents only the real guard injury and does not repeat it downstream',()=>{
 const s=field({enemies:[{id:'a',x:7,y:3,abilities:['protected_commander'],patrol:false,overwatch:false,morale:100},{id:'b',x:8,y:3,abilities:['bodyguard'],patrol:false,overwatch:false,morale:100}]}),r=presentedActBattle(s,action);
 assert.deepEqual(r.state,actBattle(s,action));assert.equal(unit(r.state,'a').hp,100);assert.ok(unit(r.state,'b').hp<100);
 assert.deepEqual(losses(r).map(i=>i.unitId),['b']);assert.equal(losses(r)[0].damage,100-unit(r.state,'b').hp);
 assert.equal(r.frames.filter(f=>f.type==='impact'&&f.shotVisual?.outcome==='hit').length,0,'the original commander and the repeated guard intersection get no invented body cue');
 assert.equal(flights(r).map(f=>draw(s,f)).join('').match(/data-muzzle-flash/g)?.length,1);
});

test('a real unseen enemy volley admits sequential known injuries without a hidden shooter, muzzle, ray or camera position',()=>{
 const s=createBattle([{id:'a',name:'Primero propio',x:2,y:3,facing:2,weapon:1801,marksmanship:70},{id:'b',name:'Segundo propio',x:1,y:3,facing:2,weapon:1801,marksmanship:70}],{width:24,height:8,seed:3,tiles:Array.from({length:192},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',cover:0,blocked:false,blocksSight:false})),enemies:[{id:'hidden',name:'Atacante secreto',x:13,y:3,facing:6,stance:'crouched',movementMode:'crouch',weapon:1801,marksmanship:100,patrol:false,overwatch:false,morale:100}]});
 Object.assign(s.tiles.find(t=>t.x===13&&t.y===3),{concealment:100});unit(s,'a').ap=unit(s,'b').ap=0;assert.equal(teamCanSee(s,'player',unit(s,'hidden')),false);
 const before=structuredClone(s),r=presentedEndTurn(s);assert.deepEqual(r.state,endTurn(s));assert.deepEqual(s,before);assert.deepEqual(losses(r).map(i=>i.unitId),['a','b']);
 for(const [index,id]of ['a','b'].entries()){
  const impact=r.frames.find(f=>f.impacts.some(i=>i.unitId===id));assert.equal(losses(r)[index].damage,unit(s,id).hp-unit(impact.state,id).hp);
  assert.ok(unit(r.state,id).hp<=unit(impact.state,id).hp,'ordinary end-of-round bleeding remains part of the authoritative result');
 }
 for(const frame of r.frames){assert.equal(frame.unitId,null);assert.equal(frame.shotVisual,undefined);const focus=battleFrameFocus(frame);if(focus)assert.ok(focus.x<=2);}
});

test('a rejected unseen-target shot cannot begin penetration playback or consume a resource',async t=>{
 const s=field();unit(s,'a').x=23;assert.equal(teamCanSee(s,'player',unit(s,'a')),false);const expected=actBattle(s,action),r=presentedActBattle(s,action),commits=[];
 assert.ok(expected.lastError);assert.deepEqual(r.state,expected);assert.equal(flights(r).length,0);assert.deepEqual(losses(r),[]);
 const mounted=await mountBattlefield(t,Battlefield,{battle:s,onChange:next=>{commits.push(next);return next;},onFinish(){}},{virtualTimers:true});
 const strip=()=>nodes(mounted.tree()).find(n=>n.props?.onOrder&&n.props?.onEndTurn);await mounted.act(async()=>strip().props.onOrder(action));
 assert.deepEqual(commits,[expected]);assert.equal(strip().props.busy,false);assert.equal(nodes(mounted.tree()).some(n=>n.type===FirearmShotEffect),false);
 assert.equal(unit(expected,'p').loaded,unit(s,'p').loaded);assert.equal(unit(expected,'p').ammo,unit(s,'p').ammo);assert.equal(unit(expected,'p').ap,unit(s,'p').ap);assert.equal(expected.elapsedSeconds,s.elapsedSeconds);
});

for(const reduced of [false,true])test(`mounted penetration holds all input and commits once${reduced?' with reduced motion':''}`,async t=>{
 const s=field(),expected=presentedActBattle(s,action),commits=[];
 const mounted=await mountBattlefield(t,Battlefield,{battle:s,onChange:next=>{commits.push(next);return next;},onFinish(){}},{virtualTimers:true});
 window.matchMedia=()=>({matches:reduced,addEventListener(){},removeEventListener(){}});
 const strip=()=>nodes(mounted.tree()).find(n=>n.props?.onOrder&&n.props?.onEndTurn);await mounted.act(async()=>strip().props.onOrder(action));
 let flashCount=0,seen=[];
 for(const frame of expected.frames){
  assert.equal(strip().props.busy,true);assert.deepEqual(commits,[]);const scene=nodes(mounted.tree()).find(n=>n.type===TacticalScene),effect=nodes(mounted.tree()).find(n=>n.type===FirearmShotEffect);
  assert.deepEqual(scene.props.state.units,frame.state.units);
  if(frame.shotVisual){assert.ok(effect);assert.deepEqual(effect.props.visual,frame.shotVisual);const markup=draw(s,frame);if(reduced)assert.doesNotMatch(markup,/animate|animateMotion|animateTransform/);if(frame.type==='projectile'&&frame.shotVisual.discharge!==false)flashCount++;}
  if(frame.impacts.length)seen.push(...frame.impacts.map(i=>i.unitId));
  await mounted.act(async()=>strip().props.onOrder(action));assert.deepEqual(commits,[]);
  assert.equal(await mounted.nextDelay(),battleFrameDuration(frame));
 }
 assert.equal(flashCount,1);assert.deepEqual(seen,['a','b']);assert.deepEqual(commits,[expected.state]);assert.equal(strip().props.busy,false);
 assert.equal(nodes(mounted.tree()).some(n=>n.type===FirearmShotEffect),false);
});
