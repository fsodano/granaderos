import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,meleePointPreview,getMeleeAttackResult,canSee,movementStepCost} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {targetPreview} from '../game/ja2-hud.js';

const floor=()=>Array.from({length:240},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',blocked:false,cover:0}));
function field(actor={},sector={}){
 const s=createBattle([{id:'p',name:'Granadero',x:2,y:3,facing:2,weapon:1805,weaponMode:'melee',activeSlot:'primary',loaded:0,ammo:0,jammed:true,priming:0,flints:0,condition:73,strength:100,dexterity:100,agility:100,wisdom:100,experienceLevel:10,...actor}],{
  width:24,height:10,tiles:floor(),seed:45,enemies:[{id:'reserve',x:22,y:8,patrol:false,overwatch:false}],...sector,
 });
 for(const u of s.units)u.ap=u.id==='p'?(actor.ap??100):0;return s;
}
const unit=(s,id='p')=>s.units.find(u=>u.id===id);
const equipment=u=>Object.fromEntries(['loaded','ammo','ammunition','jammed','priming','flints','reloadProgress','condition','weaponFittings','skillPractice'].map(k=>[k,u[k]]));
const plan=(s,point)=>meleePointPreview(s,unit(s),point);
function swing(s,point){const before=structuredClone(s),n=actBattle(s,{type:'meleePoint',unitId:'p',...point});assert.equal(n.lastError,null,n.lastError);assert.deepEqual(s,before);assert.doesNotThrow(()=>validateBattleSnapshot(n));return n;}
function reject(s,point){const before=structuredClone(s),n=actBattle(s,{type:'meleePoint',unitId:'p',...point});assert.ok(n.lastError);const {log:oldLog,lastError:oldError,...oldState}=s,{log:newLog,lastError:newError,...newState}=n;assert.deepEqual(newState,oldState,'refusal cannot move, stand, spend time or use equipment');assert.deepEqual(s,before);assert.equal(getMeleeAttackResult(s,n,'p'),false);return n;}

for(const [name,patch]of [
 ['empty jammed pistol',{}],
 ['loaded jammed pistol',{loaded:1,ammo:7,priming:50}],
 ['empty usable pistol with reserve',{jammed:false,ammo:7,priming:50}],
 ['fixed bayonet',{weapon:1800,weaponFittings:{bayonet:{weapon:1811,fittingPattern:'india_socket',condition:80,instanceId:'point-socket'}}}],
])test(`${name} swings at an adjacent empty cell with the real strike cost and no ammunition use`,()=>{
 const s=field(patch),point={x:3,y:3},p=plan(s,point),before=structuredClone(s);
 assert.equal(p.valid,true);assert.equal(p.type,'meleePoint');assert.equal(p.movePa,0);assert.equal(p.stancePa,0);assert.equal(p.strikePa,16);assert.equal(p.pa,16);assert.deepEqual(p.path,[]);assert.deepEqual(s,before);
 const n=swing(s,point);assert.equal(unit(n).ap,84);assert.equal(unit(n).energy,unit(s).energy);assert.equal(n.elapsedSeconds,6);assert.equal(n.seed,s.seed);assert.deepEqual(equipment(unit(n)),equipment(unit(s)));assert.deepEqual(n.smoke,s.smoke);assert.deepEqual(n.units.slice(1),s.units.slice(1));assert.equal(getMeleeAttackResult(s,n,'p'),true);assert.equal(getMeleeAttackResult(n,n,'p'),false);assert.equal(getMeleeAttackResult(s,n,'reserve'),false);
 assert.deepEqual(swing(validateBattleSnapshot(JSON.parse(JSON.stringify(s))),point),n,'saved battles keep the same legal swing and costs');
});

test('a distant empty cell reserves the exact crawl, stand and strike budget and matches ordinary preparation',()=>{
 const s=field({stance:'prone',movementMode:'prone'}),point={x:6,y:3},p=plan(s,point);assert.equal(p.valid,true);assert.ok(p.movePa>0);assert.equal(p.stancePa,6);assert.equal(p.strikePa,16);assert.equal(p.pa,p.movePa+22);assert.ok(p.path.length);
 let previous=unit(s),cost=0;for(const step of p.path){cost+=movementStepCost(s,unit(s),previous,step);previous=step;}assert.equal(cost,p.movePa);
 const short=structuredClone(s);unit(short).ap=p.pa-1;assert.equal(plan(short,point).valid,false);reject(short,point);
 const exact=structuredClone(s);unit(exact).ap=p.pa;const n=swing(exact,point),moved=actBattle(exact,{type:'move',unitId:'p',...p.destination}),manual=swing(moved,point);
 assert.deepEqual(n,manual);assert.equal(unit(n).ap,0);assert.equal(unit(n).stance,'standing');assert.equal(unit(n).movementMode,'walk');assert.deepEqual([unit(n).x,unit(n).y],[p.destination.x,p.destination.y]);assert.ok(unit(n).energy<unit(s).energy);assert.equal(getMeleeAttackResult(exact,n,'p'),true);assert.deepEqual(equipment(unit(n)),equipment(unit(exact)));
});

test('exploration approach, standing and swing spend time without spending or restoring combat AP',()=>{
 const s=field({stance:'prone',movementMode:'prone',ap:7},{exploration:true,enemies:[]}),point={x:6,y:3},p=plan(s,point),n=swing(s,point);
 const moved=actBattle(s,{type:'move',unitId:'p',...p.destination}),standing=actBattle(moved,{type:'stance',unitId:'p',stance:'standing'}),manual=swing(standing,point);
 assert.deepEqual(n,manual);assert.equal(n.mode,'exploration');assert.equal(unit(n).ap,7);assert.ok(n.elapsedSeconds>moved.elapsedSeconds);assert.equal(getMeleeAttackResult(s,n,'p'),true);assert.deepEqual(equipment(unit(n)),equipment(unit(s)));assert.equal(n.seed,s.seed);
});

test('invalid coordinates, unavailable actors and impossible routes refuse atomically',()=>{
 for(const point of [{x:-1,y:3},{x:24,y:3},{x:3.5,y:3},{x:'3',y:3},{x:3,y:NaN},{x:2,y:3},{x:3,y:3,tacticalLevel:1},{x:3,y:3,targetId:'reserve'},{x:3,y:3,targetKind:'npc'}])reject(field({stance:'prone',movementMode:'prone'}),point);
 for(const patch of [{ap:15},{energy:0,unconscious:true},{knockedDown:true},{activeSlot:'medical'},{activeSlot:'supply',activeSupply:'rations'},{routed:true},{surrendered:true}])reject(field(patch),{x:3,y:3});
 const blocked=field({stance:'prone',movementMode:'prone'});for(const t of blocked.tiles.filter(t=>t.x===4))Object.assign(t,{type:'wall',blocked:true,blocksSight:true});assert.equal(plan(blocked,{x:7,y:3}).valid,false);reject(blocked,{x:7,y:3});reject(blocked,{x:4,y:3});
});

test('location previews reveal no unseen occupant and a deliberate swing does not auto-lock onto a person',()=>{
 const s=field({facing:6},{enemies:[{id:'hidden',name:'Hidden sentry',x:6,y:3,facing:2,patrol:false,overwatch:false}]}),empty=structuredClone(s);unit(empty,'hidden').x=22;unit(empty,'hidden').y=8;const point={x:6,y:3};
 assert.equal(canSee(s,unit(s),unit(s,'hidden')),false);assert.deepEqual(plan(s,point),plan(empty,point));assert.equal(plan(s,point).valid,true);
 const card=targetPreview(s,unit(s),point,{mode:'useItem'});assert.deepEqual(card,targetPreview(empty,unit(empty),point,{mode:'useItem'}));assert.equal(card.attackType,'meleePoint');assert.equal(card.chance,undefined);assert.equal(card.hitLocation,undefined);assert.ok(!JSON.stringify(card).includes('Hidden sentry'));
 const n=swing(s,point);assert.equal(unit(n,'hidden').hp,unit(s,'hidden').hp);assert.equal(unit(n).ap,100-plan(s,point).pa);assert.equal(n.seed,s.seed);assert.equal(getMeleeAttackResult(s,n,'p'),true);assert.deepEqual(equipment(unit(n)),equipment(unit(s)));
});

test('a hidden approach blocker preserves the visible plan and cancels before the swing',()=>{
 const s=field({facing:6},{enemies:[{id:'hidden',x:5,y:3,facing:2,patrol:false,overwatch:false}]}),empty=structuredClone(s);unit(empty,'hidden').x=22;unit(empty,'hidden').y=8;const point={x:6,y:3},p=plan(s,point);
 assert.equal(canSee(s,unit(s),unit(s,'hidden')),false);assert.deepEqual(p,plan(empty,point));assert.equal(p.valid,true);
 const n=swing(s,point);assert.equal(unit(n).x,4);assert.equal(unit(n).y,3);assert.ok(unit(n).ap<100);assert.ok(unit(n).ap>100-p.pa);assert.equal(getMeleeAttackResult(s,n,'p'),false);assert.equal(unit(n,'hidden').hp,unit(s,'hidden').hp);assert.deepEqual(equipment(unit(n)),equipment(unit(s)));
});

test('an enemy reaction on approach pays only completed movement and cancels the swing',()=>{
 const s=field({agility:30,experienceLevel:1},{enemies:[{id:'e',x:5,y:5,facing:0,weapon:1806,marksmanship:70,agility:100,experienceLevel:10,patrol:false}]}),point={x:6,y:3};unit(s,'e').ap=6;const p=plan(s,point),n=swing(s,point);
 assert.equal(p.valid,true);assert.equal(unit(n,'e').reactionTurn,s.turn);assert.ok(unit(n).x>2);assert.ok(unit(n).ap<100);assert.ok(unit(n).ap>100-p.pa);assert.equal(getMeleeAttackResult(s,n,'p'),false);assert.deepEqual(equipment(unit(n)),equipment(unit(s)));assert.equal(n.elapsedSeconds,6);
});

test('new combat contact during an exploration approach cancels the queued swing',()=>{
 const s=field({facing:6},{exploration:true,enemies:[{id:'e',x:7,y:3,facing:2,patrol:false,overwatch:false}]}),point={x:6,y:3};assert.equal(s.mode,'exploration');const n=swing(s,point);
 assert.equal(n.mode,'combat');assert.equal(unit(n).x,3);assert.equal(n.elapsedSeconds,3);assert.equal(getMeleeAttackResult(s,n,'p'),false);assert.deepEqual(equipment(unit(n)),equipment(unit(s)));assert.equal(unit(n,'e').hp,unit(s,'e').hp);
});

test('a new contact during paid prone preparation cancels before the strike',()=>{
 const s=field({stance:'prone',movementMode:'prone',ap:0},{enemies:[{id:'e',x:4,y:3,patrol:false,overwatch:false}]});s.mode='exploration';const point={x:3,y:3},n=swing(s,point),stood=actBattle(s,{type:'stance',unitId:'p',stance:'standing'});
 assert.equal(n.mode,'combat');assert.equal(unit(n).stance,'standing');assert.equal(unit(n).ap,unit(stood).ap);assert.equal(n.elapsedSeconds,stood.elapsedSeconds);assert.equal(getMeleeAttackResult(s,n,'p'),false);assert.deepEqual(equipment(unit(n)),equipment(unit(s)));assert.equal(unit(n,'e').hp,unit(s,'e').hp);
});

test('a swing on an authored roof uses the real climb route and cannot strike from the ground',()=>{
 const upperSurfaces=Array.from({length:12},(_,i)=>({id:`roof:${i}`,x:4+i%4,y:4+Math.floor(i/4),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:0}));
 const s=field({x:2,y:4},{upperSurfaces,climbLinks:[{id:'roof-access',kind:'climb',from:{x:3,y:4,tacticalLevel:0},to:{x:4,y:4,tacticalLevel:1}}]}),point={x:7,y:4,tacticalLevel:1},p=plan(s,point);
 assert.equal(p.valid,true);assert.ok(p.path.some(step=>step.kind==='climb'));assert.equal(p.destination.tacticalLevel,1);assert.equal(meleePointPreview(s,unit(s),point,{approach:false}).valid,false);
 const n=swing(s,point);assert.equal(unit(n).tacticalLevel,1);assert.equal(unit(n).ap,unit(s).ap-p.pa);assert.equal(getMeleeAttackResult(s,n,'p'),true);assert.deepEqual(equipment(unit(n)),equipment(unit(s)));assert.equal(n.seed,s.seed);
});

test('a completed swing keeps its transient marker through dawn contact and enemy initiative only',()=>{
 const s=createBattle([{id:'p',x:2,y:3,facing:6,weapon:1805,weaponMode:'melee',loaded:1,jammed:true}],{width:18,height:9,seed:45,hour:5,secondOfHour:3599,exploration:true,tiles:Array.from({length:162},(_,i)=>({x:i%18,y:Math.floor(i/18),type:'grass',blocked:false,cover:0})),enemies:[{id:'e',x:10,y:3,facing:6,weapon:1809,strength:0,agility:0,experienceLevel:1,patrol:false,overwatch:false}]});
 assert.equal(s.mode,'exploration');assert.equal(canSee(s,unit(s),unit(s,'e')),false);assert.equal(canSee(s,unit(s,'e'),unit(s)),false);
 const n=swing(s,{x:1,y:3});assert.equal(n.mode,'combat');assert.equal(n.phase,'interrupt');assert.ok(n.log.some(line=>line.includes('toma la iniciativa')));assert.equal(getMeleeAttackResult(s,n,'p'),true,'the actual strike remains visible after first-contact resolution clones the battle');
 const saved=validateBattleSnapshot(JSON.parse(JSON.stringify(n)));assert.equal(getMeleeAttackResult(n,saved,'p'),false,'transient animation markers are not saved as a second attack');
 const next=actBattle(n,{type:'look',unitId:'p',x:2,y:4});assert.equal(next.lastError,null);assert.equal(getMeleeAttackResult(n,next,'p'),false,'a later ordinary action cannot replay the old swing');
});
