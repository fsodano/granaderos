import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,getReachable,stanceCost,teamCanSee,medicalUsePreview} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {unitAmmunitionByType} from '../game/physical-ammunition.js';
import {sameCell} from '../game/tactical-space.js';
import {losPatosFlankOrder} from './los-patos-flank-driver.mjs';
import {tucumanCombatOrder} from './tucuman-driver.mjs';
import {usefulRouteFiringPosture} from './route-infantry-progress.mjs';

const member=(battle,id)=>battle.units.find(unit=>unit.id===id);
// Fresh declarations precede the Native factory. No campaign checkpoint,
// patched AP, assigned outcome or failed-state execution is used here.
function arena({day=false,care=false,waypoint=false,hiddenX=null}={}){
 const width=waypoint?40:20,height=waypoint?32:16;
 const tiles=Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',cover:0,blocked:false}));
 const scout={id:'scout',name:'Scout',x:waypoint?26:4,y:waypoint?16:day?8:14,stance:waypoint?'standing':'crouched',facing:0,weapon:1801,blade:0,loaded:1,ammo:11,marksmanship:waypoint?0:60,morale:47,medical:care?98:0,medkits:care?2:0,activeSlot:care?'medical':'primary',energy:100};
 const squad=[{id:'spotter',name:'Spotter',x:8,y:3,stance:'crouched',facing:0,weapon:1800,blade:0,loaded:1,ammo:3,marksmanship:77,morale:47,medical:0,medkits:0},scout];
 if(care)squad.push({id:'patient',name:'Patient',x:4,y:9,weapon:0,blade:0,loaded:0,ammo:0,hp:8,maxHp:100,bleeding:2,bandaged:90,medical:0,medkits:0});
 const enemies=[{id:'seen',name:'Seen',x:day?8:7,y:day?8:1,weapon:0,blade:0,loaded:0,ammo:0,hp:100,maxHp:100,patrol:false,overwatch:false}];
 if(hiddenX!==null)enemies.push({id:'hidden',name:'Hidden',x:hiddenX,y:15,weapon:0,blade:0,loaded:0,ammo:0,hp:100,maxHp:100,patrol:false,overwatch:false});
 const battle=createBattle(squad,{id:'declared-flank-progress',sector:'declared-flank-progress',width,height,tiles,hour:day?12:0,seed:45,exploration:false,enemies});
 return validateBattleSnapshot(JSON.parse(JSON.stringify(battle)));
}
function replay(start,orders){
 let direct=structuredClone(start),shown=structuredClone(start),stored=validateBattleSnapshot(JSON.parse(JSON.stringify(start)));
 for(const action of orders){
  direct=actBattle(direct,action);assert.equal(direct.lastError,null,JSON.stringify(action));
  shown=presentedActBattle(shown,JSON.parse(JSON.stringify(action))).state;assert.deepEqual(shown,direct);
  stored=validateBattleSnapshot(JSON.parse(JSON.stringify(actBattle(stored,JSON.parse(JSON.stringify(action))))));assert.deepEqual(stored,direct);
 }
 return direct;
}
function finite(start,end){
 for(const unit of start.units){const next=member(end,unit.id);for(const key of ['hp','maxHp','bleeding','medkits','inventory','weapon','blade','condition'])assert.deepEqual(next[key],unit[key]);assert.deepEqual(unitAmmunitionByType(next),unitAmmunitionByType(unit));}
 for(const key of ['tiles','props','artillery','seed'])assert.deepEqual(end[key],start[key]);
}

test('a flank pays to stand and advance instead of cycling through useless firing postures',()=>{
 const start=arena(),before=structuredClone(start),scout=member(start,'scout'),normal=tucumanCombatOrder(start,scout);
 assert.equal(teamCanSee(start,'player',member(start,'seen')),true);assert.deepEqual(normal,{type:'stance',unitId:scout.id,stance:'prone'});assert.equal(usefulRouteFiringPosture(start,scout,normal),false);
 const first=losPatosFlankOrder(start,scout);assert.deepEqual(first,{type:'stance',unitId:scout.id,stance:'standing'});
 const raised=replay(start,[first]);assert.equal(member(raised,scout.id).ap,scout.ap-stanceCost(scout,'standing'));finite(start,raised);
 const next=losPatosFlankOrder(raised,member(raised,scout.id));assert.equal(next?.type,'move');
 const quote=getReachable(raised,member(raised,scout.id)).find(point=>sameCell(point,next));assert.ok(quote&&quote.cost>0&&quote.cost<=Math.min(40,member(raised,scout.id).ap-20));
 const end=replay(raised,[next]);assert.equal(member(end,scout.id).ap,member(raised,scout.id).ap-quote.cost);assert.ok(member(end,scout.id).energy<member(raised,scout.id).energy);assert.deepEqual(replay(start,[first,next]),end);finite(start,end);assert.deepEqual(start,before);
});

test('an actual useful finite rifle shot stays ahead of a flank bound',()=>{
 const start=arena({day:true}),before=structuredClone(start),scout=member(start,'scout'),normal=tucumanCombatOrder(start,scout);assert.equal(normal?.type,'fire');assert.deepEqual(losPatosFlankOrder(start,scout),normal);
 const end=replay(start,[normal]);assert.equal(member(end,scout.id).loaded,scout.loaded-1);assert.ok(member(end,scout.id).ap<scout.ap);assert.deepEqual(start,before);
});

test('actual adjacent finite aid stays ahead of a flank bound',()=>{
 const start=arena({day:true,care:true}),before=structuredClone(start),scout=member(start,'scout'),patient=member(start,'patient'),quote=medicalUsePreview(start,scout,patient);assert.equal(quote.allowed,true);
 const action=losPatosFlankOrder(start,scout);assert.deepEqual(action,{type:'useItem',unitId:scout.id,targetId:patient.id});
 const end=replay(start,[action]);assert.equal(member(end,scout.id).ap,scout.ap-quote.cost);assert.equal(member(end,scout.id).medkits,scout.medkits-quote.treatment.dressingsUsed);assert.equal(member(end,patient.id).hp,quote.treatment.hpAfter);assert.deepEqual(start,before);
});

test('reaching the scouting waypoint does not hold a loaded flank away from an actual distant shared contact',()=>{
 const start=arena({waypoint:true}),before=structuredClone(start),scout=member(start,'scout');assert.equal(teamCanSee(start,'player',member(start,'seen')),true);
 const action=losPatosFlankOrder(start,scout);assert.equal(action?.type,'move',JSON.stringify({action,normal:tucumanCombatOrder(start,scout),useful:usefulRouteFiringPosture(start,scout,tucumanCombatOrder(start,scout))}));
 const quote=getReachable(start,scout).find(point=>sameCell(point,action));assert.ok(quote&&quote.cost>0&&quote.cost<=Math.min(40,scout.ap-20));
 const end=replay(start,[action]);assert.equal(member(end,scout.id).ap,scout.ap-quote.cost);finite(start,end);
 const contact=member(start,'seen'),distance=unit=>Math.hypot(unit.x-contact.x,unit.y-contact.y);assert.ok(distance(member(end,scout.id))<distance(scout));
 const next=losPatosFlankOrder(end,member(end,scout.id));assert.equal(next?.type,'move','the next bound keeps approaching the same actual contact');
 const continued=replay(end,[next]);assert.ok(distance(member(continued,scout.id))<distance(member(end,scout.id)),'leaving the waypoint must not send the next bound back to it');finite(start,continued);assert.deepEqual(replay(start,[action,next]),continued);assert.deepEqual(start,before);
});

test('unseen enemy positions do not change the admitted flank approach',()=>{
 const a=arena({hiddenX:18}),b=arena({hiddenX:19}),beforeA=structuredClone(a),beforeB=structuredClone(b);
 for(const start of [a,b])assert.equal(teamCanSee(start,'player',member(start,'hidden')),false);
 assert.deepEqual(losPatosFlankOrder(a,member(a,'scout')),losPatosFlankOrder(b,member(b,'scout')));assert.deepEqual(a,beforeA);assert.deepEqual(b,beforeB);
});
