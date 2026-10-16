import test from 'node:test';
import assert from 'node:assert/strict';
import {blankMap,validateMap} from '../game/map-schema.js';
import {compileMap} from '../game/compile-map.js';
import {createBattle,actBattle,presentedActBattle,actionCosts,getReachable,canSee,teamCanSee,hasLineOfSight,lookPreview,transferPreview,medicalUsePreview,artilleryCosts,artilleryCrewPlan,artilleryReloadPreview} from '../game/tactical.js';
import {choosePlayerSharedSightingInvestigation} from '../game/tactical-ai.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {sameCell} from '../game/tactical-space.js';
import {unitAmmunitionByType} from '../game/physical-ammunition.js';
import {openingControlWindow} from './opening-driver.mjs';
import {coastalBatteryController} from './coastal-command-driver.mjs';
import {mendozaInfantrySupportController} from './mendoza-infantry-support.mjs';

const member=(battle,id)=>battle.units.find(unit=>unit.id===id);
const person=(id,x,y,extra={})=>({id,name:id,x,y,hp:100,maxHp:100,energy:100,fatigue:0,morale:90,agility:75,dexterity:75,strength:90,experienceLevel:4,weapon:1805,blade:0,loaded:1,ammo:9,condition:100,marksmanship:1,medical:0,medkits:0,stance:'standing',movementMode:'walk',facing:2,patrol:false,overwatch:false,...extra});
const kits=battle=>battle.units.filter(unit=>unit.side==='player').reduce((sum,unit)=>sum+unit.medkits,0);
const ordinary=battle=>coastalBatteryController(battle,{sharedArtillerySight:true});

// Maps, bodies, wounds and finite stores are independent declarations before
// validation, compilation and Native construction. No route capture is read.
function scene(players,{id,width=32,height=12,blocked=()=>false,...options}){
 const map=blankMap({id,title:id,width,height});
 for(const tile of map.terrain)if(blocked(tile)){tile.type='stone';tile.blocked=true;tile.blocksSight=true;tile.cover=40;}
 const before=structuredClone({map,players,options});assert.deepEqual(validateMap(map).errors,[]);
 const compiled=compileMap(map),battle=createBattle(players,{...compiled,id,hour:12,seed:42,exploration:false,deferContact:true,...options});
 assert.equal(battle.sourceMapId,id);assert.deepEqual({map,players,options},before);
 assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(battle))),battle);return battle;
}
function step(battle,action){
 const next=actBattle(battle,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;
}
function replay(start,orders){let battle=start;for(const action of orders)battle=step(battle,action);return battle;}
function checked(start,action){
 const next=step(start,action);assert.deepEqual(presentedActBattle(start,structuredClone(action)).state,next);
 const restored=validateBattleSnapshot(JSON.parse(JSON.stringify(start)));
 assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(step(restored,structuredClone(action))))),next);return next;
}
function finiteHeld(before,after){
 for(const unit of before.units.filter(unit=>unit.side==='player')){
  const next=member(after,unit.id);assert.deepEqual(unitAmmunitionByType(next),unitAmmunitionByType(unit));
  for(const key of ['hp','maxHp','bleeding','bandaged','weapon','blade','condition','weaponDropped','medkits','inventory'])assert.deepEqual(next[key],unit[key],`${unit.id} ${key}`);
 }
 assert.deepEqual(after.artillery,before.artillery);
}
function supportArena({guard={},hiddenX=31,hiddenWeapon=1800,noContact=false}={}){
 return scene([
  person('guard',2,6,guard),person('observer',10,5,{medical:90,medkits:2,loaded:0,ammo:0,stance:'prone',movementMode:'prone'}),
  person('crew-a',26,2),person('crew-b',27,1),
 ],{id:'declared-mendoza-shared-support',
  blocked:tile=>tile.x===5&&tile.y>=2&&tile.y<=8||tile.x===24||tile.x>=25&&tile.x<=28&&tile.y<=3&&(tile.x===25||tile.x===28||tile.y===0||tile.y===3),
  enemies:[person('contact',noContact?30:18,6,{side:'enemy',weapon:1813,loaded:0,ammo:0}),person('unseen',hiddenX,11,{side:'enemy',weapon:hiddenWeapon,loaded:1,ammo:3})],
  artillery:[{id:'supplied',type:'bronze4',side:'player',x:27,y:2,loaded:true,ammo:2},{id:'spent',type:'bronze4',side:'player',x:29,y:9,loaded:false,ammo:0}],
 });
}
// Spend the other actors' AP through actual hand orders. The scheduler then
// tests a genuinely quiet ordinary squad pass, without assigning AP or hiding
// a payable cannon action. The observer keeps its actual facing and sight.
function afterOrdinaryWork(start){
 let battle=start;const orders=[];
 for(const id of ['observer','crew-a','crew-b']){
  for(let n=0;n<64&&member(battle,id).ap>=actionCosts(battle,member(battle,id)).weapon;n++){
   const unit=member(battle,id),cost=actionCosts(battle,unit).weapon;assert.ok(cost>0&&unit.ap>=cost);
   const action={type:'weapon',unitId:id,slot:(unit.activeSlot??'primary')==='primary'?'unarmed':'primary'},next=step(battle,action);
   assert.equal(member(next,id).ap,unit.ap-cost);orders.push(action);battle=next;
  }
  if(member(battle,id).ap>=3){
   const unit=member(battle,id),quote=[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]].map(([dx,dy])=>({x:unit.x+dx,y:unit.y+dy})).map(point=>({point,quote:lookPreview(battle,unit,point)})).find(row=>row.quote.valid&&row.quote.pa>0&&row.quote.pa<=unit.ap);
   assert.ok(quote);const action={type:'look',unitId:id,...quote.point},next=step(battle,action);assert.equal(member(next,id).ap,unit.ap-quote.quote.pa);orders.push(action);battle=next;
  }
  assert.ok(member(battle,id).ap<3);
 }
 return {battle,orders};
}

test('a compiled Mendoza scene pays one public support bound after the real ordinary squad pass holds',()=>{
 const declared=supportArena(),pre=afterOrdinaryWork(declared),start=pre.battle,before=structuredClone(start),guard=member(start,'guard'),target=member(start,'contact'),old=ordinary(start);
 assert.equal(canSee(start,guard,target),false);assert.equal(hasLineOfSight(start,guard,target),false);assert.equal(teamCanSee(start,'player',target),true);
 assert.equal(old(start,guard),null);const oldWindow=openingControlWindow(start,{controller:old});assert.deepEqual(oldWindow.orders,[]);assert.deepEqual(oldWindow.battle,start);
 const expected=choosePlayerSharedSightingInvestigation(start,guard,target);assert.equal(expected?.type,'move');
 const controller=mendozaInfantrySupportController(old),result=openingControlWindow(start,{controller,sharedFallback:controller.sharedFallback});
 assert.deepEqual(result.orders,[expected]);assert.deepEqual(result.sharedInvestigation,expected);assert.equal(result.actions,1);
 const route=getReachable(start,guard).find(point=>sameCell(point,expected));assert.ok(route&&route.cost>0&&route.cost<=24&&route.path.length<=3);
 const after=checked(start,expected),moved=member(after,guard.id);assert.deepEqual(result.battle,after);assert.equal(moved.ap,guard.ap-route.cost);assert.ok(moved.energy<guard.energy);assert.equal(moved.stance,guard.stance);
 finiteHeld(start,after);for(const id of ['observer','crew-a','crew-b'])assert.deepEqual(member(after,id),member(start,id));
 assert.deepEqual(replay(declared,[...pre.orders,expected]),after);assert.deepEqual(start,before);
});

function careArena({donorKits=3,doctorKits=0,far=false,contact=false,combat=false}={}){
 const x=far?7:3;
 return scene([person('donor',1,2,{medkits:donorKits}),person('relay',2,2),person('doctor',x,2,{medical:90,medkits:doctorKits,loaded:0,ammo:0}),person('patient',x,3,{hp:8,bleeding:2,weapon:0,loaded:0,ammo:0})],{
  id:'declared-mendoza-carried-linen',width:12,height:8,exploration:!combat,
  blocked:tile=>tile.x===8,enemies:[person('contact',contact?6:10,2,{side:'enemy',weapon:0,loaded:0,ammo:0})],
  artillery:[{id:'spent',type:'bronze4',side:'player',x:10,y:6,loaded:false,ammo:0}],
 });
}
test('actual precontact relay and ordinary finite care use the declared linen once',()=>{
 const start=careArena(),before=structuredClone(start),donor=member(start,'donor'),doctor=member(start,'doctor'),old=ordinary(start),controller=mendozaInfantrySupportController(old),quote=transferPreview(start,donor,doctor,'medkits',2);
 assert.equal(start.mode,'exploration');assert.equal(teamCanSee(start,'player',member(start,'contact')),false);assert.equal(quote.valid,true);assert.equal(quote.kind,'relay');
 const transfer=controller(start,donor);assert.deepEqual(transfer,{type:'transfer',unitId:donor.id,targetId:doctor.id,item:'medkits',count:2,transferKind:quote.kind,transferRoute:quote.route.map(unit=>unit.id)});
 let battle=checked(start,transfer);assert.equal(member(battle,donor.id).medkits,1);assert.equal(member(battle,doctor.id).medkits,2);assert.equal(kits(battle),kits(start));assert.ok(battle.elapsedSeconds>start.elapsedSeconds);
 assert.notEqual(controller(battle,member(battle,donor.id))?.type,'transfer','The same supplied physician cannot receive the parcel twice.');
 const orders=[transfer],equip=controller(battle,member(battle,doctor.id));assert.deepEqual(equip,{type:'weapon',unitId:doctor.id,slot:'medical'});battle=checked(battle,equip);orders.push(equip);
 const actor=member(battle,doctor.id),patient=member(battle,'patient'),aidQuote=medicalUsePreview(battle,actor,patient),aid=controller(battle,actor);assert.equal(aidQuote.allowed,true);assert.deepEqual(aid,{type:'useItem',unitId:doctor.id,targetId:patient.id});
 const end=checked(battle,aid);orders.push(aid);assert.equal(member(end,doctor.id).medkits,actor.medkits-aidQuote.treatment.dressingsUsed);assert.equal(member(end,patient.id).hp,aidQuote.treatment.hpAfter);assert.equal(member(end,patient.id).bleeding,aidQuote.treatment.bleedingAfter);assert.equal(kits(end),kits(start)-aidQuote.treatment.dressingsUsed);
 assert.deepEqual(end.artillery,start.artillery);assert.deepEqual(replay(start,orders),end);assert.deepEqual(start,before);
});

test('empty linen, an already supplied physician, combat, current contact and a disconnected parcel keep the ordinary policy',()=>{
 for(const options of [{donorKits:0},{doctorKits:2},{combat:true},{contact:true},{far:true}]){
  const start=careArena(options),before=structuredClone(start),unit=member(start,'donor'),old=ordinary(start);
  if(options.contact)assert.equal(teamCanSee(start,'player',member(start,'contact')),true);
  if(options.far){const quote=transferPreview(start,unit,member(start,'doctor'),'medkits',2);assert.ok(!quote.valid||quote.kind==='throw');}
  assert.deepEqual(mendozaInfantrySupportController(old)(start,unit),old(start,unit));assert.deepEqual(start,before);
 }
});

function gunArena(loaded){return scene([person('operator',4,5,{medical:85,medkits:2,marksmanship:70}),person('helper',5,6,{marksmanship:60})],{
 id:'declared-mendoza-gun-priority',width:20,height:16,enemies:[person('contact',12,5,{side:'enemy',weapon:0,loaded:0,ammo:0})],
 artillery:[{id:'supplied',type:'bronze4',side:'player',x:5,y:5,loaded,ammo:2,facing:0}],
});}
for(const loaded of [true,false])test(`actual ordinary cannon ${loaded?'fire':'loading'} retains priority and finite Native cost`,()=>{
 const start=gunArena(loaded),before=structuredClone(start),unit=member(start,'operator'),gun=start.artillery[0],old=ordinary(start),controller=mendozaInfantrySupportController(old),action=controller(start,unit);
 assert.deepEqual(action,old(start,unit));assert.equal(action?.type,loaded?'artillery':'artilleryReload');assert.equal(controller.sharedFallback(start,unit),null);
 const quote=loaded?{...artilleryCrewPlan(start,unit,gun,artilleryCosts(start,unit,gun).fire),pa:artilleryCosts(start,unit,gun).fire}:artilleryReloadPreview(start,unit,gun);assert.equal(quote.reason,null);
 const end=checked(start,action);for(const id of quote.crew){assert.equal(member(end,id).ap,member(start,id).ap-quote.pa);assert.equal(member(end,id).medkits,member(start,id).medkits);}
 assert.equal(end.artillery[0].ammo,gun.ammo-(loaded?0:quote.rounds));assert.equal(end.artillery[0].loaded,loaded?false:Boolean(quote.rounds));assert.ok(end.elapsedSeconds>start.elapsedSeconds);assert.deepEqual(start,before);
});

test('physicians, commander and wounded or empty infantry cannot take the new support bound',()=>{
 for(const fields of [{medical:65,medkits:2},{id:'57'},{hp:90,bandaged:10},{loaded:0}]){
  const start=supportArena({guard:fields}),before=structuredClone(start),unit=member(start,fields.id??'guard'),controller=mendozaInfantrySupportController(ordinary(start));
  if(fields.medical||fields.id)assert.equal(choosePlayerSharedSightingInvestigation(start,unit,member(start,'contact'))?.type,'move','The role guard must exclude a genuinely available public route.');
  assert.equal(controller.sharedFallback(start,unit),null);assert.deepEqual(start,before);
 }
});

test('unseen opposing positions and equipment cannot choose the public support bound or create a contact',()=>{
 const first=afterOrdinaryWork(supportArena()).battle,second=afterOrdinaryWork(supportArena({hiddenX:30,hiddenWeapon:1801})).battle,a=structuredClone(first),b=structuredClone(second);
 for(const battle of [first,second])assert.equal(teamCanSee(battle,'player',member(battle,'unseen')),false);
 const left=mendozaInfantrySupportController(ordinary(first)).sharedFallback(first,member(first,'guard')),right=mendozaInfantrySupportController(ordinary(second)).sharedFallback(second,member(second,'guard'));
 assert.equal(left?.type,'move');assert.deepEqual(left,right);checked(first,left);checked(second,right);assert.deepEqual(first,a);assert.deepEqual(second,b);
 const hidden=supportArena({noContact:true}),before=structuredClone(hidden);assert.equal(teamCanSee(hidden,'player',member(hidden,'contact')),false);
 assert.equal(mendozaInfantrySupportController(ordinary(hidden)).sharedFallback(hidden,member(hidden,'guard')),null);assert.deepEqual(hidden,before);
});
