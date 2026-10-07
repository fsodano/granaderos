import assert from 'node:assert/strict';
import {register} from 'node:module';import test from 'node:test';
register('./tactical-render-loader.mjs',import.meta.url);
const {presentActors}=await import('../web/lib/three/presentation.ts');
const {createRendererSandboxBattle}=await import('../web/app/renderer-sandbox/fixtures.js');
const {presentedActBattle,actBattle}=await import('../game/tactical.js');
const wrap=value=>Math.atan2(Math.sin(value),Math.cos(value));
function views(state,frame,entries){return presentActors(state,entries??state.units.filter(unit=>['sabre','target-sabre'].includes(unit.id)).map(actor=>({key:`unit:${actor.id}`,kind:'unit',actor})),{},new Set(),{frame,now:0});}
function phase(result,type){return {...result.frames.find(frame=>frame.type===type),sequenceId:'1:1',actionId:1,index:type==='prepare'?0:1,startedAt:type==='prepare'?0:420,durationMs:type==='prepare'?420:650,actionStartedAt:0,actionDurationMs:1970};}

test('paid preparation admits only a bounded current target bearing, independent of defender facing',()=>{
 for(const [dx,dz]of [[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]])for(let facing=0;facing<8;facing++)for(let defenderFacing=0;defenderFacing<8;defenderFacing++){
  const state=createRendererSandboxBattle('combat'),actor=state.units.find(unit=>unit.id==='sabre'),target=state.units.find(unit=>unit.id==='target-sabre');actor.facing=facing;target.x=actor.x+dx;target.y=actor.y+dz;target.facing=defenderFacing;const before=JSON.stringify(state),order={type:'melee',unitId:actor.id,targetId:target.id},result=presentedActBattle(state,order);assert.equal(result.state.lastError,null);assert.deepEqual(result.state,actBattle(state,order));const prepare=phase(result,'prepare'),contact=phase(result,'contact'),initial=views(state).find(visual=>visual.id===actor.id),shown=views(prepare.state,prepare).find(visual=>visual.id===actor.id),impactFacing=views(contact.state,contact).find(visual=>visual.id===actor.id).yaw,delta=wrap(impactFacing-initial.yaw),turn=shown.cue.contactTurn;
  assert.equal(JSON.stringify(state),before);assert.ok(shown.cue.contactTarget);assert.ok(Math.abs(wrap(Math.atan2(dx,dz)-impactFacing))<1e-10,'The actual paid contact heading equals the current admitted cell bearing');assert.equal(shown.yaw,initial.yaw,'The authoritative prepare facing remains simulation data');
  if(Math.abs(delta)>1e-7&&Math.abs(delta)<=Math.PI/4+1e-7){assert.ok(turn);assert.equal(turn.fromYaw,initial.yaw);assert.ok(Math.abs(wrap(turn.toYaw-impactFacing))<1e-10);}else assert.equal(turn,undefined,'A missing turn or larger unsupported turn receives no fabricated field');assert.equal(views(contact.state,contact).find(visual=>visual.id===actor.id).cue.contactTurn,undefined,'Contact does not reconstruct previous facing from future frames');
 }
});

test('missing, ambiguous, wrong-cell and unperformed target records cannot supply a preparation turn',()=>{
 const state=createRendererSandboxBattle('combat'),target=state.units.find(unit=>unit.id==='target-sabre');target.y++;const result=presentedActBattle(state,{type:'melee',unitId:'sabre',targetId:target.id}),frame=phase(result,'prepare'),entries=frame.state.units.filter(unit=>['sabre','target-sabre'].includes(unit.id)).map(actor=>({key:`unit:${actor.id}`,kind:'unit',actor})),current=entries.find(entry=>entry.actor.id===target.id),source=entries.find(entry=>entry.actor.id==='sabre');
 for(const [name,admitted,change]of [['missing',[source],{}],['ambiguous',[source,current,current],{}],['wrong target cell',entries,{targetPoint:{...frame.targetPoint,x:frame.targetPoint.x+1}}],['wrong target identity',entries,{targetPoint:{...frame.targetPoint,id:'other'}}],['unperformed',entries,{performed:false}]]){
  const shown=views(frame.state,{...frame,...change},admitted).find(visual=>visual.id==='sabre');assert.equal(shown?.cue?.contactTurn,undefined,name);assert.equal(shown?.cue?.contactTarget,undefined,name);
 }
 const point=presentedActBattle(state,{type:'meleePoint',unitId:'sabre',x:7,y:9}),pointFrame=phase(point,'prepare');assert.equal(views(pointFrame.state,pointFrame).find(visual=>visual.id==='sabre').cue.contactTurn,undefined,'A paid empty-cell swing cannot inspect another body');
});
