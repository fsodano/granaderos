import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,actionCosts,meleePreview,itemUsePreview,getMeleeAttackResult,canSee,getReachable} from '../game/tactical.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

const empty={ammo:0,priming:0,flints:0,medkits:0,rations:0,boleadoras:0,torches:0};
const floor=()=>Array.from({length:240},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',blocked:false,cover:0}));
const socket=()=>({bayonet:{weapon:1811,fittingPattern:'india_socket',condition:80,instanceId:'prone-socket'}});
const profiles=[
 ['sabre',{weapon:1809},12],
 ['fists',{weapon:0,activeSlot:'unarmed'},12],
 ['buttstock',{weapon:1800,weaponMode:'melee',loaded:1,jammed:true,ammo:7,condition:73},16],
 ['fixed bayonet',{weapon:1800,weaponMode:'melee',loaded:1,jammed:true,ammo:7,condition:73,weaponFittings:socket()},16],
];
function field(player={},target={},sector={}){
 const s=createBattle([{...empty,id:'p',name:'Patriota',x:2,y:3,weapon:1809,loaded:0,stance:'prone',movementMode:'prone',facing:2,strength:100,dexterity:100,agility:100,wisdom:100,experienceLevel:10,...player}],{
  width:24,height:10,tiles:floor(),seed:45,enemies:[
   {...empty,id:'e',name:'Realista',x:3,y:3,weapon:0,loaded:0,activeSlot:'unarmed',patrol:false,overwatch:false,agility:0,dexterity:0,wisdom:0,experienceLevel:1,morale:100,...target},
   {...empty,id:'reserve',x:22,y:8,weapon:0,loaded:0,activeSlot:'unarmed',patrol:false,overwatch:false},
  ],...sector,
 });
 for(const u of s.units)u.ap=u.id==='p'?(player.ap??100):u.id===String(target.id??'e')?(target.ap??0):0;
 return s;
}
const unit=(s,id='p')=>s.units.find(u=>u.id===String(id));
function order(s,a){const before=structuredClone(s),n=actBattle(s,{unitId:'p',...a});assert.equal(n.lastError,null,JSON.stringify(a)+': '+n.lastError);assert.deepEqual(s,before,'orders preserve the input');assert.doesNotThrow(()=>validateBattleSnapshot(n));return n;}
function reject(s,a){const before=structuredClone(s),n=actBattle(s,{unitId:'p',...a});assert.ok(n.lastError,JSON.stringify(a));const {log:oldLog,lastError:oldError,...oldState}=s,{log:newLog,lastError:newError,...newState}=n;assert.deepEqual(newState,oldState,'rejection cannot move, stand, spend time or attack');assert.deepEqual(s,before);assert.equal(getMeleeAttackResult(s,n,'p'),false);return n;}

test('each prone melee profile pays for standing and its real strike in one combat round',()=>{
 for(const [name,patch,strike]of profiles){
  const s=field(patch),p=unit(s),e=unit(s,'e'),before=structuredClone(s),plan=meleePreview(s,p,e,{approach:false}),costs=actionCosts(s,p);
  assert.equal(costs.meleeStance,6,name);assert.equal(costs.meleeStrike,strike,name);assert.equal(costs.melee,strike+6,name);assert.equal(plan.valid,true,name);assert.equal(plan.pa,strike+6,name);assert.deepEqual(s,before);
  const n=order(s,{type:'melee',targetId:'e'}),actor=unit(n);
  assert.equal(actor.stance,'standing',name);assert.equal(actor.movementMode,'walk',name);assert.equal(actor.ap,p.ap-strike-6,name);assert.equal(actor.energy,p.energy,name);assert.ok(unit(n,'e').hp<e.hp,name);assert.equal(n.elapsedSeconds-s.elapsedSeconds,6,name);
  assert.equal(getMeleeAttackResult(s,n,'p'),true,name);assert.equal(getMeleeAttackResult(s,n,'e'),false,name);assert.equal(getMeleeAttackResult(n,n,'p'),false,name);
  for(const key of ['loaded','ammo','priming','flints','jammed'])assert.equal(actor[key],p[key],`${name}: ${key}`);
  assert.equal(actor.condition,p.condition-(name==='sabre'?1:0),`${name}: actual held weapon wear`);
  if(p.weaponFittings?.bayonet){assert.equal(actor.weaponFittings.bayonet.condition,p.weaponFittings.bayonet.condition-1);assert.equal(actor.weaponFittings.bayonet.instanceId,p.weaponFittings.bayonet.instanceId);}
  const saved=validateBattleSnapshot(JSON.parse(JSON.stringify(s)));assert.deepEqual(actBattle(saved,{type:'melee',unitId:'p',targetId:'e'}),n);
 }
});

test('exact stand-and-strike budget succeeds while one point short rejects both explicit and held-item orders atomically',()=>{
 for(const [name,patch,strike]of profiles)for(const type of ['melee','useItem']){
  const short=field({...patch,ap:strike+5}),p=unit(short),e=unit(short,'e');assert.equal(meleePreview(short,p,e,{approach:false}).valid,false,name);reject(short,{type,targetId:'e'});
  const s=field({...patch,ap:strike+6}),n=order(s,{type,targetId:'e'});assert.equal(unit(n).ap,0,name);assert.equal(unit(n).stance,'standing',name);assert.equal(getMeleeAttackResult(s,n,'p'),true,name);assert.ok(unit(n,'e').hp<unit(s,'e').hp,name);
 }
});

test('a contextual approach keeps the crawl route and reserves the full move, stand and strike budget before moving',()=>{
 const s=field({}, {x:6}),p=unit(s),plan=itemUsePreview(s,p,unit(s,'e'));assert.equal(plan.valid,true);assert.ok(plan.path.length>0);assert.ok(plan.movePa>0);assert.equal(plan.pa,plan.movePa+18);
 const route=getReachable({...s,mode:'exploration'},p).find(r=>r.x===plan.destination.x&&r.y===plan.destination.y);assert.ok(route);assert.equal(route.cost,plan.movePa,'the preview uses crawl costs');
 const short=structuredClone(s);unit(short).ap=plan.pa-1;assert.equal(itemUsePreview(short,unit(short),unit(short,'e')).valid,false);reject(short,{type:'useItem',targetId:'e'});
 const exact=structuredClone(s);unit(exact).ap=plan.pa;const n=order(exact,{type:'useItem',targetId:'e'});
 assert.equal(unit(n).ap,0);assert.equal(unit(n).stance,'standing');assert.equal(unit(n).movementMode,'walk');assert.deepEqual([unit(n).x,unit(n).y],[plan.destination.x,plan.destination.y]);assert.ok(unit(n).energy<unit(s).energy);assert.ok(unit(n,'e').hp<unit(s,'e').hp);assert.equal(getMeleeAttackResult(exact,n,'p'),true);assert.equal(n.elapsedSeconds,6);
 const moved=order(exact,{type:'move',...plan.destination});assert.equal(unit(moved).stance,'prone');assert.equal(unit(moved).ap,18);const manual=order(moved,{type:'melee',targetId:'e'});assert.deepEqual(n,manual,'automatic approach matches the same paid crawl and local attack');
});

test('invalid or unavailable targets reject before paying for a prone stance change',()=>{
 const s=field();for(const targetId of ['p','missing'])reject(s,{type:'melee',targetId});
 reject(field({}, {x:6}),{type:'melee',targetId:'e'});
 for(const patch of [{knockedDown:true},{unconscious:true,energy:0},{activeSlot:'medical',medkits:1},{activeSlot:'supply',activeSupply:'rations',rations:1}])reject(field(patch),{type:'melee',targetId:'e'});
 const paused=field();paused.phase='interrupt';paused.interrupt={unitIds:[]};reject(paused,{type:'melee',targetId:'e'});
});

test('a newly exposed prone attacker stops after its paid stand when the enemy fires a reaction',()=>{
 const tiles=floor(),wallEdges=[{id:'low-cover',x:3,y:3,axis:'y',type:'window',blocked:true,obstacleHeight:.8}];
 const s=field({weapon:1800,weaponMode:'melee',weaponFittings:socket(),loaded:1,ammo:7,stance:'prone',movementMode:'prone',agility:0,wisdom:0,experienceLevel:1},
  {x:4,weapon:1805,loaded:1,activeSlot:'primary',ammo:0,marksmanship:100,agility:100,wisdom:100,experienceLevel:10,overwatch:true,ap:100},
  {tiles,wallEdges,upperSurfaces:[{id:'roof-sight',x:20,y:3,tacticalLevel:1,type:'floor',kind:'roof',elevation:3,blocked:false,cover:0}]});
 s.units.push({...structuredClone(unit(s)),id:'spotter',x:4,y:2,stance:'standing',movementMode:'walk',weapon:0,weaponFittings:undefined,activeSlot:'unarmed',loaded:0,ap:0});
 unit(s,'e').ap=actionCosts(s,unit(s,'e'),unit(s)).fire;
 assert.equal(canSee(s,unit(s,'e'),unit(s)),false);assert.equal(canSee(s,unit(s,'spotter'),unit(s,'e')),true);assert.equal(meleePreview(s,unit(s),unit(s,'e'),{approach:false}).valid,true);
 const n=order(s,{type:'melee',targetId:'e'});assert.equal(unit(n).stance,'standing');assert.equal(unit(n,'e').loaded,0);assert.equal(unit(n,'e').ammo,0);assert.equal(unit(n,'e').reactionTurn,s.turn);assert.equal(unit(n,'e').ap,0);assert.ok(unit(n).hp<unit(s).hp);assert.equal(unit(n).ap,unit(s).ap-6);assert.equal(unit(n,'e').hp,unit(s,'e').hp);assert.deepEqual(unit(n).weaponFittings,unit(s).weaponFittings);assert.equal(unit(n).loaded,1);assert.equal(getMeleeAttackResult(s,n,'p'),false);assert.equal(n.elapsedSeconds,6);
});

test('new combat contact during an exploration stand spends no AP and cancels the pending melee strike',()=>{
 const s=field({ap:0});s.mode='exploration';const n=order(s,{type:'melee',targetId:'e'}),standing=order(s,{type:'stance',stance:'standing'});
 assert.equal(n.mode,'combat');assert.equal(unit(n).stance,'standing');assert.equal(unit(n).ap,unit(standing).ap,'first-contact AP is the ordinary new combat budget');assert.equal(unit(n,'e').hp,unit(s,'e').hp);assert.equal(getMeleeAttackResult(s,n,'p'),false);assert.equal(n.elapsedSeconds,standing.elapsedSeconds);assert.equal(n.elapsedSeconds,1);
});

test('an exploration stand and melee use time without spending or refilling AP when there is no active threat',()=>{
 const unconscious={...empty,id:'e',x:3,y:3,weapon:0,loaded:0,activeSlot:'unarmed',energy:0,unconscious:true,hp:100,patrol:false,overwatch:false};
 const s=field({ap:7},{},{enemies:[unconscious],exploration:true});assert.equal(s.mode,'exploration');
 const p=unit(s),plan=meleePreview(s,p,unit(s,'e'),{approach:false});assert.equal(plan.valid,true);
 const n=order(s,{type:'useItem',targetId:'e'});assert.equal(unit(n).stance,'standing');assert.equal(unit(n).ap,7);assert.equal(unit(n).energy,p.energy);assert.ok(unit(n,'e').hp<unit(s,'e').hp);assert.equal(n.elapsedSeconds-s.elapsedSeconds,2);assert.equal(getMeleeAttackResult(s,n,'p'),true);
 const manual=order(order(s,{type:'stance',stance:'standing'}),{type:'melee',targetId:'e'});assert.deepEqual(n,manual,'exploration keeps the time of the same two ordinary actions');
});

test('crouched and mounted melee retain their pose and pay only their established strike cost',()=>{
 for(const patch of [{stance:'crouched',movementMode:'crouch'},{stance:'standing',movementMode:'walk',mounted:true}]){
  const s=field(patch),p=unit(s),cost=actionCosts(s,p);assert.equal(cost.meleeStance,0);assert.equal(cost.melee,cost.meleeStrike);
  const n=order(s,{type:'melee',targetId:'e'});assert.equal(unit(n).stance,p.stance);assert.equal(unit(n).movementMode,p.movementMode);assert.equal(unit(n).mounted,p.mounted);assert.equal(unit(n).ap,p.ap-cost.melee);assert.equal(getMeleeAttackResult(s,n,'p'),true);assert.ok(unit(n,'e').hp<unit(s,'e').hp);
 }
});

test('a prone firearm still fires from prone and does not pay the melee standing cost',()=>{
 const s=field({weapon:1805,loaded:1,ammo:4,condition:100,weaponMode:'fire',marksmanship:100}),p=unit(s),cost=actionCosts(s,p,unit(s,'e')).fire;
 const n=order(s,{type:'fire',targetId:'e'});assert.equal(unit(n).stance,'prone');assert.equal(unit(n).movementMode,'prone');assert.equal(unit(n).ap,p.ap-cost);assert.equal(unit(n).loaded,0);assert.equal(unit(n).ammo,4);assert.equal(getMeleeAttackResult(s,n,'p'),false);assert.ok(unit(n,'e').hp<unit(s,'e').hp);
});

test('AI reserves the stand and strike cost and its actual enemy turn executes the same paid transition',()=>{
 const s=field({weapon:0,activeSlot:'unarmed',stance:'standing',movementMode:'walk',ap:0,agility:0,wisdom:0,experienceLevel:1},{weapon:1809,activeSlot:'primary',stance:'prone',movementMode:'prone',ap:18,agility:100,wisdom:100,experienceLevel:10});
 const e=unit(s,'e'),choice=chooseEnemyAction({...s,phase:'enemy'},e);assert.deepEqual(choice,{type:'melee',unitId:'e',targetId:'p'});const short=structuredClone(s);unit(short,'e').ap=17;assert.notEqual(chooseEnemyAction({...short,phase:'enemy'},unit(short,'e'))?.type,'melee');
 const before=structuredClone(s),n=endTurn(s);assert.equal(n.lastError,null);assert.equal(unit(n,'e').stance,'standing');assert.equal(unit(n,'e').movementMode,'walk');assert.equal(unit(n,'e').ap,0);assert.ok(unit(n).hp<unit(s).hp);assert.deepEqual(s,before);assert.doesNotThrow(()=>validateBattleSnapshot(n));assert.deepEqual(endTurn(validateBattleSnapshot(JSON.parse(JSON.stringify(s)))),n);
});

test('a prone facón or Cabral defender cannot make a free counterattack before standing',()=>{
 for(const target of [{weapon:1813,activeSlot:'primary'},{id:3,weapon:0,activeSlot:'unarmed'}]){
  const id=String(target.id??'e'),prone=field({stance:'standing',movementMode:'walk'},{...target,stance:'prone',movementMode:'prone',ap:100}),n=order(prone,{type:'melee',targetId:id});
  assert.equal(unit(n).hp,unit(prone).hp);assert.equal(unit(n,id).stance,'prone');assert.equal(unit(n,id).ap,unit(prone,id).ap);assert.equal(unit(n,id).counterTurn,unit(prone,id).counterTurn);assert.ok(unit(n,id).hp<unit(prone,id).hp);assert.ok(!n.log.some(line=>line.includes('contragolpe')));
  const upright=field({stance:'standing',movementMode:'walk'},{...target,ap:100}),counter=order(upright,{type:'melee',targetId:id});assert.ok(unit(counter).hp<unit(upright).hp);assert.equal(unit(counter,id).counterTurn,upright.turn);
 }
});

test('prone legacy charge and brace orders reject atomically and a prone bayonet cannot intercept a charge',()=>{
 reject(field({}, {x:7}),{type:'charge',targetId:'e'});
 reject(field({weapon:1800,weaponMode:'melee',weaponFittings:socket()}),{type:'brace'});
 const guard={x:7,weapon:1800,activeSlot:'primary',weaponMode:'melee',weaponFittings:socket(),braced:true,ap:100};
 const s=field({stance:'standing',movementMode:'walk'}, {...guard,stance:'prone',movementMode:'prone'});unit(s,'e').braced=true;const n=order(s,{type:'charge',targetId:'e'});assert.equal(unit(n).hp,unit(s).hp);assert.equal(unit(n,'e').braceTurn,unit(s,'e').braceTurn);assert.deepEqual(unit(n,'e').weaponFittings,unit(s,'e').weaponFittings);assert.ok(!n.log.some(line=>line.includes('recibe la carga')));
 const upright=field({stance:'standing',movementMode:'walk'},guard);unit(upright,'e').braced=true;const intercepted=order(upright,{type:'charge',targetId:'e'});assert.ok(unit(intercepted).hp<unit(upright).hp);assert.equal(unit(intercepted,'e').braceTurn,upright.turn);assert.equal(unit(intercepted,'e').weaponFittings.bayonet.condition,79);
});

test('a prone rifleman keeps a useful loaded shot instead of standing to hit a retreating opponent',()=>{
 const s=field({weapon:1800,weaponMode:'fire',loaded:1,ammo:8,marksmanship:100,condition:100},{hp:41,routed:true}),p=unit(s),before=structuredClone(s);
 const choice=chooseEnemyAction(s,p);assert.equal(choice.type,'fire');assert.deepEqual(s,before);
 const n=order(s,choice);assert.equal(unit(n).stance,'prone');assert.equal(unit(n).loaded,0);assert.equal(unit(n).ammo,8);assert.equal(getMeleeAttackResult(s,n,p.id),false);assert.ok(unit(n,'e').hp<41);
 const close=field({weapon:1800,weaponMode:'melee',loaded:1,ammo:8,marksmanship:100,condition:100},{hp:41,routed:true});assert.equal(chooseEnemyAction(close,unit(close)).type,'melee');
});
