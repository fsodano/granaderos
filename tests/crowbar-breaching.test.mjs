import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,environmentTargetAt,environmentPreview,environmentUsePreview,movementStepCost,movementEnergy,canSee} from '../game/tactical.js';
import {TOOL_TYPES,environmentTargetSummary,environmentActionProfile} from '../game/environment-interactions.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

const tool=(extra={})=>({count:1,weight:TOOL_TYPES.crowbar.weight,itemType:'tool',toolKey:'crowbar',condition:100,...extra});
const ref={kind:'wall',id:'wall:6:3',x:6,y:3,axis:'y',tacticalLevel:0};
function field(actor={},options={}){
 const tiles=Array.from({length:160},(_,i)=>({x:i%16,y:Math.floor(i/16),type:'grass',blocked:false,cover:0}));
 const wallEdges=[{id:ref.id,x:6,y:3,axis:'y',type:'wall',material:'adobe',blocked:true,blocksSight:true,cover:40,obstacleHeight:2.5,projectileResistance:80}];
 const state=createBattle([{id:'p',x:5,y:3,facing:2,activeSlot:'tool',activeTool:'inventory:bar',inventory:{bar:tool()},...actor}],{
  width:16,height:10,tiles,wallEdges,seed:45,weather:{rain:0,humidity:0},enemies:[{id:'e',x:14,y:8,patrol:false,overwatch:false}],...options});
 state.units[0].ap=actor.ap??100;for(const enemy of state.units.filter(u=>u.side==='enemy'))enemy.ap=0;
 return state;
}
const use=(state,target=ref)=>actBattle(state,{type:'useItem',unitId:'p',environment:target});
const wall=state=>state.wallEdges.find(t=>t.id===ref.id);
function reject(state,action={type:'useItem',unitId:'p',environment:ref}){
 const after=actBattle(state,action);assert.ok(after.lastError);
 for(const key of ['units','tiles','wallEdges','props','seed','elapsedSeconds','groundItems','smoke','lights'])assert.deepEqual(after[key],state[key],key);
 return after;
}

test('adobe and wooden walls use a real held crowbar, exact ability AP, manual noise and saved rubble',()=>{
 for(const [material,abilities,cost] of [['adobe',[],45],['wood',['breaching'],25]]){
  const state=field({abilities},{enemies:[{id:'e',x:9,y:3,facing:2,patrol:false,overwatch:false}]});wall(state).material=material;const before=structuredClone(state);
  const target=environmentTargetAt(state,ref),preview=environmentPreview(state,state.units[0],ref);
  assert.equal(target.kind,'wall');assert.equal(target.id,ref.id);assert.equal(preview.valid,true);assert.equal(preview.verb,'breach');assert.equal(preview.pa,cost);assert.equal(preview.toolWear,3);assert.equal(preview.requiresRoll,false);
  assert.equal(environmentTargetSummary(state.units[0],target).label,material==='wood'?'Barricada de madera':'Pared de adobe');
  const action={type:'useItem',unitId:'p',environment:ref},after=actBattle(state,action);
  assert.deepEqual(presentedActBattle(state,action).state,after);assert.equal(after.lastError,null);assert.equal(after.units[0].ap,100-cost);assert.equal(after.units[0].inventory.bar.condition,97);
  assert.equal(after.seed,state.seed);assert.equal(after.elapsedSeconds,6);assert.equal(after.units[0].hp,state.units[0].hp);assert.equal(after.units[0].loaded,state.units[0].loaded);assert.deepEqual(after.units[0].ammunition,state.units[0].ammunition);
  assert.equal(wall(after).blocked,false);assert.equal(wall(after).blocksSight,false);assert.equal(wall(after).type,'rubble');assert.equal(wall(after).cover,15);assert.equal(wall(after).obstacleHeight,undefined);assert.equal(wall(after).projectileResistance,undefined);
  assert.equal(after.units[1].lastHeardNoise.kind,'melee');assert.deepEqual(after.smoke,state.smoke);
  const saved=validateBattleSnapshot(JSON.parse(JSON.stringify(after)));assert.deepEqual(saved,after);
  const walked=actBattle(saved,{type:'move',unitId:'p',x:6,y:3});assert.equal(walked.lastError,null);assert.equal(walked.units[0].x,6);
  assert.equal(environmentTargetAt(after,ref),null);reject(after);
  assert.deepEqual(state,before);
 }
});

test('the last usable crowbar is retained at zero condition, and only one selected stacked tool wears',()=>{
 const state=field({inventory:{bar:tool({count:3,condition:1})}}),after=use(state);
 assert.equal(after.lastError,null);assert.equal(after.units[0].inventory.bar.count,2);assert.equal(after.units[0].inventory.bar.condition,1);
 const selected=after.units[0].activeTool.slice(10);assert.notEqual(selected,'bar');assert.equal(after.units[0].inventory[selected].count,1);assert.equal(after.units[0].inventory[selected].condition,0);
 assert.equal(Object.values(after.units[0].inventory).filter(t=>t.toolKey==='crowbar').reduce((total,t)=>total+t.count,0),3);
 after.wallEdges=[...after.wallEdges,{id:'wall:6:4',x:6,y:4,axis:'y',type:'wall',material:'wood',blocked:true,blocksSight:true,cover:40}];
 const nextRef={kind:'wall',id:'wall:6:4',x:6,y:4,axis:'y',tacticalLevel:0};
 assert.equal(environmentPreview(after,after.units[0],nextRef).valid,false);reject(after,{type:'useItem',unitId:'p',environment:nextRef});
 assert.doesNotThrow(()=>validateBattleSnapshot(JSON.parse(JSON.stringify(after))));
});

test('a carried crowbar must be readied by a paid hand change before it can breach',()=>{
 const state=field({activeSlot:'primary',activeTool:undefined});reject(state);
 const held=actBattle(state,{type:'weapon',unitId:'p',slot:'tool',toolKey:'inventory:bar'});
 assert.equal(held.lastError,null);assert.equal(held.units[0].ap,96);assert.equal(held.units[0].activeTool,'inventory:bar');assert.equal(held.units[0].inventory.bar.condition,100);
 const after=use(held);assert.equal(after.lastError,null);assert.equal(after.units[0].ap,51);assert.equal(after.units[0].inventory.bar.condition,97);
 assert.equal(after.units[0].loaded,state.units[0].loaded);assert.deepEqual(after.units[0].ammunition,state.units[0].ammunition);assert.equal(after.seed,state.seed);assert.equal(after.elapsedSeconds,6);
});

test('bare hands, wrong or broken tools, unusable actors and insufficient AP reject before any effects',()=>{
 for(const patch of [{activeSlot:'unarmed'},{activeTool:'inventory:missing'},{inventory:{bar:tool({toolKey:'lockpick'})}},{inventory:{bar:tool({condition:0})}},{energy:0},{hp:14},{routed:true},{knockedDown:true},{entangled:true},{bound:true},{mounted:true},{ap:44}]){
  const state=field(patch);reject(state);reject(state,{type:'breach',unitId:'p',x:6,y:3});
 }
 const inventory=Object.fromEntries(Array.from({length:999},(_,i)=>[`spare-${i}`,tool()]));inventory.bar=tool({count:2});
 const full=field({inventory});assert.equal(environmentActionProfile(full.units[0],wall(full),'breach').valid,false);reject(full);
});

test('only explicit ground adobe or wood wall edges qualify; door, floor, roof and terrain remain intact',()=>{
 for(const patch of [{material:'stone'},{material:undefined},{material:'iron'},{type:'door',material:'adobe',doorId:'door'},{type:'floor',material:'wood'},{kind:'roof',material:'wood'},{type:'forest',material:'wood'},{type:'water',material:'wood'},{type:'cliff',material:'adobe'},{tacticalLevel:1}]){
  const state=field();Object.assign(wall(state),patch);reject(state,{type:'breach',unitId:'p',x:6,y:3});
  if(patch.type!=='door')assert.equal(environmentTargetAt(state,ref),null);
 }
 const upstairs=field({tacticalLevel:1},{upperSurfaces:[{id:'roof',x:5,y:3,tacticalLevel:1,elevation:3,kind:'roof',type:'floor',blocked:false,cover:0}]});reject(upstairs);
 reject(field(),{type:'useItem',unitId:'p',environment:{...ref,x:7}});
 reject(field(),{type:'useItem',unitId:'p',environment:{...ref,tacticalLevel:1}});
});

test('unseen wall material does not change public refusal, while an observed exterior wall omits private room metadata',()=>{
 const adobe=field({x:2,facing:6}),stone=structuredClone(adobe);wall(stone).material='stone';assert.equal(canSee(adobe,adobe.units[0],wall(adobe)),false);
 const left=environmentUsePreview(adobe,adobe.units[0],ref),right=environmentUsePreview(stone,stone.units[0],ref);assert.deepEqual(left,right);assert.deepEqual(use(adobe).lastError,use(stone).lastError);
 const absent=structuredClone(adobe);Object.assign(wall(absent),{type:'grass',blocked:false,blocksSight:false});assert.deepEqual(environmentUsePreview(absent,absent.units[0],ref),left);assert.equal(use(absent).lastError,use(adobe).lastError);
 const state=field();Object.assign(wall(state),{buildingId:'private-building',roomId:'private-room',contents:[{secret:true}]});
 assert.equal(canSee(state,state.units[0],wall(state)),true);assert.equal(environmentPreview(state,state.units[0],ref).valid,true);
 assert.deepEqual(environmentTargetSummary(state.units[0],environmentTargetAt(state,ref)),{id:ref.id,type:'wall',label:'Pared de adobe',material:'adobe',broken:false});
});

test('useItem pays the real approach and revalidates a breach exactly like separate movement and local use',()=>{
 const state=field({x:2}),preview=environmentUsePreview(state,state.units[0],ref);
 assert.equal(preview.valid,true);assert.equal(preview.actionPa,45);assert.ok(preview.movePa>0);assert.equal(preview.pa,preview.movePa+45);
 let from=state.units[0],sum=0;for(const cell of preview.path){sum+=movementStepCost(state,state.units[0],from,cell);from=cell;}assert.equal(sum,preview.movePa);
 const after=use(state),manual=actBattle(actBattle(state,{type:'move',unitId:'p',...preview.destination}),preview.action);
 assert.deepEqual(after,manual);assert.equal(after.units[0].ap,100-preview.pa);assert.equal(after.units[0].inventory.bar.condition,97);assert.equal(wall(after).blocked,false);
 const short=field({x:2,ap:preview.pa-1});assert.equal(environmentUsePreview(short,short.units[0],ref).valid,false);reject(short);
 const remote=actBattle(state,{type:'breach',unitId:'p',x:6,y:3});assert.ok(remote.lastError);assert.deepEqual(remote.units,state.units);
});

test('enemy reaction or exhaustion during approach stops before wall changes or tool wear',()=>{
 const ambush=field({x:2,agility:30,experienceLevel:1},{enemies:[{id:'e',x:5,y:5,facing:0,weapon:1806,marksmanship:70,agility:100,experienceLevel:10,patrol:false}]});ambush.units[1].ap=6;
 const interrupted=use(ambush);assert.equal(interrupted.lastError,null);assert.equal(interrupted.units[1].reactionTurn,1);assert.ok(interrupted.units[0].x>2);assert.equal(wall(interrupted).blocked,true);assert.equal(interrupted.units[0].inventory.bar.condition,100);
 const exhausted=field({x:2},{exploration:true,enemies:[]});exhausted.units[0].energy=2*movementEnergy(exhausted.units[0],{type:'grass'},true);const stopped=use(exhausted);
 assert.equal(stopped.units[0].unconscious,true);assert.ok(stopped.units[0].x>2);assert.equal(wall(stopped).blocked,true);assert.deepEqual(stopped.units[0].inventory,exhausted.units[0].inventory);
});
