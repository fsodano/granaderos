import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,actionCosts,stanceCost,lookPreview,medicalUsePreview,firearmShotOptions,artilleryCosts,artilleryCrewPlan,teamCanSee,canSee,hasLineOfSight} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {unitAmmunitionByType} from '../game/physical-ammunition.js';
import {lowerWeapon} from '../game/weapon-readiness.js';
import {coastalBatteryController} from './coastal-command-driver.mjs';
import {tucumanCombatOrder} from './tucuman-driver.mjs';
import {knownRouteShotSafety} from './route-fire-safety.mjs';

const member=(b,id)=>b.units.find(u=>u.id===id);
const person=(id,x,y,extra={})=>({id,name:id,x,y,hp:100,maxHp:100,weapon:1805,blade:0,loaded:1,ammo:11,medical:0,medkits:0,marksmanship:0,condition:100,energy:100,fatigue:0,morale:90,agility:75,dexterity:75,strength:90,experienceLevel:4,stance:'standing',movementMode:'walk',facing:2,...extra});
// These independent declarations have an ordinary public roof access and a
// ground contact. They do not contain any campaign result or failed checkpoint.
function arena({useful=false,pistol=false,near=false,care=false,medical=85,kits=6,knockedDown=false,hidden=false,platformElevation=3}={}){
 const width=28,height=16,players=[person('doctor',10,7,{tacticalLevel:1,medical,medkits:kits,...(useful?{weapon:pistol?1805:1801,marksmanship:95}:{}),...(care?{activeSlot:'medical'}:{}),...(knockedDown?{knockedDown:true,stance:'prone',movementMode:'prone'}:{})}),person('observer',20,9,{weapon:0,loaded:0,ammo:0,facing:0})];
 if(care)players.push(person('patient',9,7,{tacticalLevel:1,weapon:0,loaded:0,ammo:0,hp:8,bleeding:2,bandaged:90}));
 const options={id:'declared-coastal-physician-posture',sector:'declared-coastal-physician-posture',width,height,hour:12,seed:45,
  tiles:Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0})),
  upperSurfaces:Array.from({length:30},(_,i)=>({id:`roof:${i}`,x:5+i%6,y:5+Math.floor(i/6),tacticalLevel:1,elevation:platformElevation,type:'floor',kind:'roof',blocked:false,cover:0})),
  climbLinks:[{id:'public-access',kind:'climb',from:{x:8,y:10,tacticalLevel:0},to:{x:8,y:9,tacticalLevel:1}}],
  artillery:[{id:'spent',type:'bronze4',side:'player',x:3,y:12,loaded:false,ammo:0}],
  enemies:[person('contact',near?12:useful?14:24,7,{side:'enemy',weapon:0,loaded:0,ammo:0,stance:useful?'standing':'prone',movementMode:useful?'walk':'prone',patrol:false,overwatch:false}),...(hidden?[person('hidden',27,15,{side:'enemy',weapon:1800,loaded:1,ammo:2,patrol:false,overwatch:false})]:[])],
 };
 for(const tile of options.tiles)if(tile.x===25){tile.type='stone';tile.blocked=true;tile.blocksSight=true;}
 const declaration=structuredClone({players,options}),battle=createBattle(players,options);
 assert.deepEqual({players,options},declaration);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(battle))),battle);return battle;
}
function replay(start,orders){
 let direct=structuredClone(start),shown=structuredClone(start),stored=validateBattleSnapshot(JSON.parse(JSON.stringify(start)));
 for(const action of orders){direct=actBattle(direct,action);assert.equal(direct.lastError,null,JSON.stringify(action));shown=presentedActBattle(shown,JSON.parse(JSON.stringify(action))).state;assert.deepEqual(shown,direct);stored=validateBattleSnapshot(JSON.parse(JSON.stringify(actBattle(stored,JSON.parse(JSON.stringify(action))))));assert.deepEqual(stored,direct);}
 return direct;
}
function held(start,end){for(const u of start.units.filter(u=>u.side==='player')){const v=member(end,u.id);assert.deepEqual(unitAmmunitionByType(v),unitAmmunitionByType(u));for(const key of ['weapon','blade','inventory','medkits','outfit','headwear','legwear','hp','bleeding'])assert.deepEqual(v[key],u[key]);}assert.deepEqual(end.artillery,start.artillery);}
function paidLooks(start){
 let battle=start,paid=0;const orders=[];
 for(const point of [{x:5,y:7,tacticalLevel:1},{x:20,y:7,tacticalLevel:0}]){const u=member(battle,'doctor'),q=lookPreview(battle,u,point);assert.equal(q.valid,true);assert.ok(q.pa>0);const action={type:'look',unitId:u.id,...point},next=replay(battle,[action]);assert.equal(member(next,u.id).ap,u.ap-q.pa);orders.push(action);paid+=q.pa;battle=next;}
 return {battle,orders,paid};
}
// This is the former no-working-crew leaf, not a second simulated battle or a
// saved policy state. All comparisons start from the same fresh declaration.
const former=(b,u)=>{assert.ok(b.artillery.every(g=>!g.loaded&&!g.ammo));return tucumanCombatOrder(b,u);};

test('a supplied roof physician stops the former paid posture cycle after real protective lowering',()=>{
 const declared=arena(),pre=paidLooks(declared),start=pre.battle,before=structuredClone(start);assert.equal(teamCanSee(start,'player',member(start,'contact')),true);assert.equal(member(start,'doctor').ap,member(declared,'doctor').ap-pre.paid);
 let old=start;const oldOrders=[];for(let i=0;i<6;i++){const u=member(old,'doctor'),action=former(old,u);assert.equal(action?.type,'stance');const next=replay(old,[action]);assert.equal(member(next,u.id).ap,u.ap-stanceCost(u,action.stance));oldOrders.push(action);old=next;}
 assert.deepEqual(oldOrders.map(a=>a.stance),['crouched','prone','standing','crouched','prone','standing']);assert.equal(member(old,'doctor').stance,'standing');assert.ok(member(old,'doctor').ap<member(start,'doctor').ap);held(start,old);
 const controller=coastalBatteryController(start,{sharedArtillerySight:true});let battle=start;const orders=[];
 for(let i=0;i<6;i++){const u=member(battle,'doctor'),action=controller(battle,u);if(!action)break;assert.equal(action.type,'stance');const next=replay(battle,[action]);assert.equal(member(next,u.id).ap,u.ap-stanceCost(u,action.stance));orders.push(action);battle=next;}
 assert.deepEqual(orders.map(a=>a.stance),['crouched','prone']);assert.equal(member(battle,'doctor').stance,'prone');assert.equal(controller(battle,member(battle,'doctor')),null);held(start,battle);assert.deepEqual(replay(declared,[...pre.orders,...orders]),battle);assert.deepEqual(start,before);
});

test('a useful paid lower posture still leads to a safe current finite firearm order',()=>{
 const declared=arena({useful:true}),pre=paidLooks(declared),start=pre.battle,before=structuredClone(start),u=member(start,'doctor'),controller=coastalBatteryController(start,{sharedArtillerySight:true}),posture=controller(start,u);assert.deepEqual(posture,{type:'stance',unitId:u.id,stance:'crouched'});
 const posed=replay(start,[posture]);assert.equal(member(posed,u.id).ap,u.ap-stanceCost(u,posture.stance));const actor=member(posed,u.id),action=controller(posed,actor);assert.equal(action?.type,'fire');const target=member(posed,action.targetId),option=firearmShotOptions(posed,actor,target,action.aim??0).find(o=>o.aim===(action.aim??0)&&o.hitLocation===(action.hitLocation??'torso'));assert.ok(option&&option.chance>=25&&option.damageFactor>0&&knownRouteShotSafety(posed,actor,target)(option));
 const end=replay(posed,[action]),cost=actionCosts(posed,actor,target);assert.equal(member(end,u.id).ap,actor.ap-cost.fire-(action.aim??0)*cost.aim);assert.ok(member(end,u.id).loaded<actor.loaded||member(end,u.id).jammed);assert.equal(member(end,u.id).medkits,actor.medkits);assert.deepEqual(end.artillery,start.artillery);assert.deepEqual(replay(declared,[...pre.orders,posture,action]),end);assert.deepEqual(start,before);
});

test('a payable rise that immediately admits useful actual fire remains available',()=>{
 const declared=arena({useful:true,pistol:true,near:true,platformElevation:1}),initial=member(declared,'doctor'),prone={type:'stance',unitId:initial.id,stance:'prone'};let battle=replay(declared,[prone]);const orders=[prone],west={type:'look',unitId:initial.id,x:5,y:7,tacticalLevel:1};battle=replay(battle,[west]);orders.push(west);
 const handCost=actionCosts(battle,member(battle,'doctor')).weapon,count=2*Math.floor((member(battle,'doctor').ap-22)/(2*handCost));assert.ok(count>0&&count%2===0);
 for(let i=0;i<count;i++){const action={type:'weapon',unitId:initial.id,slot:i%2?'primary':'medical'};battle=replay(battle,[action]);orders.push(action);}assert.equal(member(battle,'doctor').activeSlot,'primary');assert.equal(member(battle,'doctor').ap,22);
 const start=battle,before=structuredClone(start),controller=coastalBatteryController(start,{sharedArtillerySight:true}),u=member(start,'doctor'),contact=member(start,'contact'),currentCost=actionCosts(start,u,contact);
 // This fresh authored one-metre platform keeps the current prone eye ray
 // above its own slab. Quote the paid crouch without adopting that copy.
 const view=structuredClone(start),posed=member(view,u.id),goal=member(view,contact.id),paid=stanceCost(u,'crouched');posed.ap-=paid;posed.stance='crouched';posed.movementMode='crouch';posed.momentum=0;lowerWeapon(posed);
 const quotedCost=actionCosts(view,posed,goal),maxAim=Math.min(4,Math.floor((posed.ap-quotedCost.fire)/quotedCost.aim)),useful=firearmShotOptions(view,posed,goal,maxAim).find(o=>o.chance>=25&&o.damageFactor>0&&knownRouteShotSafety(view,posed,goal)(o)),facts={currentPersonalSight:canSee(start,u,contact),currentLOS:hasLineOfSight(start,u,contact),ap:u.ap,currentFireAP:currentCost.fire,stanceAP:paid,quotedRemainingAP:posed.ap,quotedFireAP:quotedCost.fire,useful};
 assert.equal(facts.currentPersonalSight,true,JSON.stringify(facts));assert.equal(facts.currentLOS,true,JSON.stringify(facts));assert.ok(currentCost.fire>u.ap,JSON.stringify(facts));assert.ok(paid>0&&quotedCost.fire<=posed.ap&&useful,JSON.stringify(facts));assert.deepEqual(start,before);
 const rise=controller(start,u);assert.equal(rise?.type,'stance',JSON.stringify(facts));assert.ok(['standing','crouched'].includes(rise.stance));const raised=replay(start,[rise]);assert.equal(member(raised,u.id).ap,u.ap-stanceCost(u,rise.stance));
 const action=controller(raised,member(raised,u.id));assert.equal(action?.type,'fire');const actor=member(raised,u.id),target=member(raised,action.targetId),cost=actionCosts(raised,actor,target),option=firearmShotOptions(raised,actor,target,action.aim??0).find(o=>o.aim===(action.aim??0)&&o.hitLocation===(action.hitLocation??'torso'));assert.ok(option&&option.chance>=25&&option.damageFactor>0&&knownRouteShotSafety(raised,actor,target)(option));
 const end=replay(raised,[action]);assert.equal(member(end,u.id).ap,actor.ap-cost.fire-(action.aim??0)*cost.aim);assert.ok(member(end,u.id).loaded<actor.loaded||member(end,u.id).jammed);assert.deepEqual(replay(declared,[...orders,rise,action]),end);assert.deepEqual(start,before);
});

test('real adjacent finite aid remains ahead of the posture guard',()=>{
 const start=arena({care:true}),before=structuredClone(start),u=member(start,'doctor'),patient=member(start,'patient'),q=medicalUsePreview(start,u,patient);assert.equal(q.allowed,true);const action=coastalBatteryController(start,{sharedArtillerySight:true})(start,u);assert.deepEqual(action,{type:'useItem',unitId:u.id,targetId:patient.id});
 const end=replay(start,[action]);assert.equal(member(end,u.id).ap,u.ap-q.cost);assert.equal(member(end,u.id).medkits,u.medkits-q.treatment.dressingsUsed);assert.equal(member(end,patient.id).hp,q.treatment.hpAfter);assert.equal(member(end,patient.id).bleeding,q.treatment.bleedingAfter);assert.deepEqual(end.artillery,start.artillery);assert.deepEqual(start,before);
});

test('a current charged cannon keeps its genuine medical-skilled crew and paid finite shot',()=>{
 const players=[person('doctor',4,5,{medical:85,medkits:6}),person('helper',5,6,{weapon:1800,marksmanship:60})],options={id:'declared-coastal-charged-priority',width:20,height:16,hour:12,seed:45,tiles:Array.from({length:320},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',blocked:false,cover:0})),artillery:[{id:'charged',type:'bronze4',side:'player',x:5,y:5,loaded:true,ammo:2,facing:0}],enemies:[person('contact',12,5,{side:'enemy',weapon:0,loaded:0,ammo:0,patrol:false,overwatch:false})]},declaration=structuredClone({players,options}),start=createBattle(players,options),before=structuredClone(start),u=member(start,'doctor'),gun=start.artillery[0],cost=artilleryCosts(start,u,gun).fire,crew=artilleryCrewPlan(start,u,gun,cost);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(start))),start);assert.equal(crew.reason,null);
 const action=coastalBatteryController(start,{sharedArtillerySight:true})(start,u);assert.equal(action?.type,'artillery');const end=replay(start,[action]);for(const id of crew.crew)assert.equal(member(end,id).ap,member(start,id).ap-cost);assert.equal(end.artillery[0].loaded,false);assert.equal(end.artillery[0].ammo,gun.ammo);assert.equal(member(end,u.id).medkits,6);assert.deepEqual({players,options},declaration);assert.deepEqual(start,before);
});

test('generic or unsupplied actors keep the former fallback and a knocked-down physician retains actual recovery',()=>{
 for(const settings of [{medical:20},{kits:0}]){const start=arena(settings),before=structuredClone(start),u=member(start,'doctor'),action=coastalBatteryController(start,{sharedArtillerySight:true})(start,u);assert.deepEqual(action,former(start,u));assert.equal(action?.type,'stance');replay(start,[action]);assert.deepEqual(start,before);}
 const start=arena({knockedDown:true}),before=structuredClone(start),u=member(start,'doctor'),action=coastalBatteryController(start,{sharedArtillerySight:true})(start,u);assert.deepEqual(action,{type:'stance',unitId:u.id,stance:'standing'});const end=replay(start,[action]);assert.equal(member(end,u.id).knockedDown,false);assert.equal(member(end,u.id).ap,u.ap-stanceCost(u,'standing'));held(start,end);assert.deepEqual(start,before);
});

test('unseen hostile equipment cannot decide whether the physician rises into another posture',()=>{
 const one=arena(),two=arena({hidden:true}),a=paidLooks(one).battle,b=paidLooks(two).battle,lower=[{type:'stance',unitId:'doctor',stance:'crouched'},{type:'stance',unitId:'doctor',stance:'prone'}],left=replay(a,lower),right=replay(b,lower);assert.equal(teamCanSee(right,'player',member(right,'hidden')),false);
 assert.equal(coastalBatteryController(left,{sharedArtillerySight:true})(left,member(left,'doctor')),null);assert.equal(coastalBatteryController(right,{sharedArtillerySight:true})(right,member(right,'doctor')),null);assert.deepEqual(member(left,'doctor'),member(right,'doctor'));
});
