import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,actionCosts,artilleryCrewPlan,artilleryCosts,getReachable,hasLineOfSight,medicalUsePreview,stanceCost,teamCanSee} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {sameCell,sameSurface,spacePoint,surfaceAt} from '../game/tactical-space.js';
import {stockTucumanAcuteController} from './stock-tucuman-acute-medical.mjs';
import {coastalBatteryController} from './coastal-command-driver.mjs';
import {stabilizeCreatedCuyoBattleSurvivors} from './created-cuyo-route.mjs';
import {publicRouteView,usefulRouteFiringPosture} from './route-infantry-progress.mjs';

const member=(battle,id)=>battle.units.find(unit=>unit.id===id);

// All positions, health, finite stock, roles, cover and obstacles precede the
// Native constructor. These are portable policy controls, not an earned route
// or a post-failure continuation. No AP, time or outcome is patched afterward.
function arena({adjacent=false,hand='primary',kits=2,gun=false,blocked=false,cover=false,unsafe=false,exploration=false,late=false,hiddenX=18,hiddenWeapon=1800,doctor={}}={}){
 const width=20,height=16,people=[
  {id:'doctor',x:2,y:unsafe?2:4,medical:91,medkits:kits,activeSlot:hand,loaded:0,ammo:3,marksmanship:41,...doctor},
  {id:'patient',x:adjacent?3:8,y:unsafe?5:4,hp:late?1:8,bleeding:late?6:2,medical:0,medkits:0,weapon:0,blade:0,loaded:0,ammo:0},
  {id:'screen',x:unsafe?10:4,y:unsafe?5:8,medical:0,medkits:0,marksmanship:70,...(unsafe?{facing:0}:{})},
  ...(gun?[{id:'helper',x:3,y:5,medical:0,medkits:0,marksmanship:20}]:[]),
 ].map(person=>({name:person.id,hp:80,maxHp:80,agility:100,dexterity:90,strength:100,experienceLevel:4,energy:100,fatigue:0,morale:90,
  weapon:1800,blade:1813,loaded:1,ammo:3,medical:0,medkits:0,stance:'standing',movementMode:'walk',facing:2,overwatch:false,...person}));
 const tiles=Array.from({length:width*height},(_,i)=>{
  const x=i%width,y=Math.floor(i/width),wall=x===14||blocked&&x===5||unsafe&&x===5&&y<4;
  return {x,y,type:wall?'wall':'grass',blocked:wall,blocksSight:wall,cover:cover&&x===2&&y===4?40:0,...(wall?{material:'stone'}:{})};
 });
 const options={id:'declared-stock-tucuman-medical',sector:'tucuman',width,height,tiles,hour:12,seed:45,exploration,
  enemies:[{id:'unseen',name:'Reserva no vista',x:hiddenX,y:12,weapon:hiddenWeapon,loaded:1,ammo:3,hp:80,maxHp:80,patrol:false,overwatch:false},
   ...(unsafe?[{id:'contact',name:'Contacto conocido',x:10,y:2,weapon:1800,loaded:1,ammo:3,hp:80,maxHp:80,patrol:false,overwatch:false}]:[])],
  artillery:gun?[{id:'paid-gun',type:'bronze4',side:'player',x:3,y:4,loaded:true,ammo:2,facing:2}]:[],
 };
 const declaration=structuredClone({people,options}),battle=createBattle(people,options);assert.deepEqual({people,options},declaration);return battle;
}

function execute(start,orders){
 let direct=start,shown=start,stored=validateBattleSnapshot(JSON.parse(JSON.stringify(start)));
 for(const action of orders){
  direct=actBattle(direct,action);assert.equal(direct.lastError,null,JSON.stringify(action)+': '+direct.lastError);
  shown=presentedActBattle(shown,structuredClone(action)).state;assert.deepEqual(shown,direct);
  const raw=actBattle(stored,structuredClone(action));stored=validateBattleSnapshot(JSON.parse(JSON.stringify(raw)));assert.deepEqual(stored,direct);
 }
 return direct;
}

function treat(start){
 const controller=stockTucumanAcuteController(start,{physicianIds:['doctor']}),orders=[];let battle=start;
 for(let n=0;n<16&&(member(battle,'patient').hp<15||member(battle,'patient').bleeding);n++){
  const action=controller(battle,member(battle,'doctor'));assert.ok(action,'The declared current AP must admit actual finite aid.');
  assert.ok(['move','stance','weapon','useItem'].includes(action.type));
  if(action.type==='weapon')assert.equal(action.slot,'medical','Optional rifle restoration cannot precede the reachable acute patient.');
  if(action.type==='move'){
   const quote=getReachable(battle,member(battle,'doctor'),{stopAt:point=>sameCell(point,action)})[0];assert.ok(quote?.cost>0&&quote.cost<=20);assert.ok(quote.path.length<=3);
  }
  orders.push(action);battle=execute(battle,[action]);
 }
 assert.equal(member(battle,'patient').hp,15);assert.equal(member(battle,'patient').bleeding,0);
 assert.deepEqual(execute(start,orders),battle);return {battle,orders};
}

test('the actual paid combat approach and finite stroke precede optional rifle loading for a distant critical patient',()=>{
 const start=arena(),before=structuredClone(start),doctor=member(start,'doctor'),ordinary=coastalBatteryController(start,{sharedArtillerySight:true});
 assert.equal(ordinary(start,doctor)?.type,'reload');assert.equal(teamCanSee(start,'player',member(start,'unseen')),false);
 const {battle,orders}=treat(start);assert.equal(orders[0].type,'move');assert.ok(orders.some(action=>action.type==='useItem'));
 assert.equal(member(battle,'doctor').medkits,doctor.medkits-1);assert.ok(member(battle,'doctor').ap<doctor.ap);assert.ok(member(battle,'doctor').energy<doctor.energy);
 for(const key of ['weapon','weaponInstanceId','condition','loaded','ammo','inventory'])assert.deepEqual(member(battle,'doctor')[key],doctor[key]);
 assert.deepEqual(battle.artillery,start.artillery);assert.equal(battle.turn,start.turn);assert.ok(battle.elapsedSeconds>start.elapsedSeconds);assert.deepEqual(start,before);
});

test('a prepared medical hand keeps its actual finite care role before the ordinary rifle-restore order',()=>{
 const start=arena({hand:'medical'}),before=structuredClone(start),ordinary=coastalBatteryController(start,{sharedArtillerySight:true});
 assert.deepEqual(ordinary(start,member(start,'doctor')),{type:'weapon',unitId:'doctor',slot:'primary'});
 const {battle,orders}=treat(start);assert.equal(orders[0].type,'move');assert.equal(orders.some(action=>action.type==='weapon'),false);
 assert.equal(member(battle,'doctor').activeSlot,'medical');assert.equal(member(battle,'doctor').medkits,1);assert.deepEqual(start,before);
});

test('existing adjacent Native aid retains its exact order, AP, finite debit and patient result',()=>{
 const start=arena({adjacent:true,hand:'medical'}),before=structuredClone(start),doctor=member(start,'doctor'),patient=member(start,'patient'),quote=medicalUsePreview(start,doctor,patient);
 const ordinary=coastalBatteryController(start,{sharedArtillerySight:true})(start,doctor),action=stockTucumanAcuteController(start,{physicianIds:['doctor']})(start,doctor);
 assert.equal(quote.allowed,true);assert.deepEqual(action,ordinary);assert.deepEqual(action,{type:'useItem',unitId:'doctor',targetId:'patient'});
 const battle=execute(start,[action]);assert.equal(member(battle,'doctor').ap,doctor.ap-quote.cost);assert.equal(member(battle,'doctor').medkits,doctor.medkits-quote.treatment.dressingsUsed);
 assert.equal(member(battle,'patient').hp,quote.treatment.hpAfter);assert.equal(member(battle,'patient').bleeding,quote.treatment.bleedingAfter);assert.deepEqual(start,before);
});

test('a real required two-person gun crew and actors outside the explicit physician receipt keep the exact ordinary policy',()=>{
 const start=arena({gun:true}),before=structuredClone(start),doctor=member(start,'doctor'),gun=start.artillery[0],crew=artilleryCrewPlan(start,doctor,gun,artilleryCosts(start,doctor,gun).fire);
 assert.equal(crew.reason,null);assert.ok(crew.crew.includes(doctor.id));assert.equal(crew.crew.length,2);
 const ordinary=coastalBatteryController(start,{sharedArtillerySight:true}),controller=stockTucumanAcuteController(start,{physicianIds:['doctor']});
 for(const actor of start.units.filter(unit=>unit.side==='player'))assert.deepEqual(controller(start,actor),ordinary(start,actor));
 const other=arena(),unadmitted=stockTucumanAcuteController(other);assert.deepEqual(unadmitted(other,member(other,'doctor')),coastalBatteryController(other,{sharedArtillerySight:true})(other,member(other,'doctor')));
 assert.deepEqual(start,before);
});

test('empty stock, current clinical duty and an unfit physician cannot acquire the new distant-care role',()=>{
 for(const options of [{kits:0},{doctor:{assignment:'doctor'}},{doctor:{assignment:'patient'}},{doctor:{hp:14}},{doctor:{bleeding:1}},{doctor:{routed:true}},{doctor:{captured:true}},{doctor:{asleep:true}},{doctor:{energy:0}}]){
  const start=arena(options),before=structuredClone(start),doctor=member(start,'doctor');
  assert.deepEqual(stockTucumanAcuteController(start,{physicianIds:['doctor']})(start,doctor),coastalBatteryController(start,{sharedArtillerySight:true})(start,doctor));assert.deepEqual(start,before);
 }
});

test('blocked terrain, loss of current cover and new exposure to a team-known hostile do not justify a medical approach',()=>{
 for(const options of [{blocked:true},{cover:true},{unsafe:true}]){
  const start=arena(options),before=structuredClone(start),doctor=member(start,'doctor');
  if(options.unsafe){assert.equal(teamCanSee(start,'player',member(start,'contact')),true);assert.equal(hasLineOfSight(start,member(start,'contact'),doctor),false);}
  assert.deepEqual(stockTucumanAcuteController(start,{physicianIds:['doctor']})(start,doctor),coastalBatteryController(start,{sharedArtillerySight:true})(start,doctor));assert.deepEqual(start,before);
 }
});

test('the complete current approach, hand and stroke must fit AP already left after actual paid orders',()=>{
 const start=arena(),orders=[];let battle=start;
 for(let n=0;member(battle,'doctor').ap>28&&n<30;n++){const action={type:'weapon',unitId:'doctor',slot:n%2?'primary':'medical'};orders.push(action);battle=execute(battle,[action]);}
 const before=structuredClone(battle),doctor=member(battle,'doctor');assert.ok(doctor.ap<=28);assert.equal(doctor.ap,member(start,'doctor').ap-orders.length*actionCosts(start,member(start,'doctor')).weapon);
 const ordinary=coastalBatteryController(battle,{sharedArtillerySight:true})(battle,doctor),action=stockTucumanAcuteController(battle,{physicianIds:['doctor']})(battle,doctor);
 assert.deepEqual(action,ordinary);assert.ok(action?.type!=='useItem');assert.equal(member(battle,'doctor').medkits,2);assert.deepEqual(execute(start,orders),battle);assert.deepEqual(battle,before);
});

test('unseen hostile positions and weapons do not choose the public medical route',()=>{
 const first=arena(),second=arena({hiddenX:19,hiddenWeapon:1801}),before=structuredClone(first),otherBefore=structuredClone(second);
 assert.equal(teamCanSee(first,'player',member(first,'unseen')),false);assert.equal(teamCanSee(second,'player',member(second,'unseen')),false);
 const action=stockTucumanAcuteController(first,{physicianIds:['doctor']})(first,member(first,'doctor')),other=stockTucumanAcuteController(second,{physicianIds:['doctor']})(second,member(second,'doctor'));
 assert.equal(action?.type,'move');assert.deepEqual(action,other);execute(first,[action]);execute(second,[other]);assert.deepEqual(first,before);assert.deepEqual(second,otherBefore);
});

test('a fresh late exploration wound remains terminal under the unchanged full-survival field-aid guard',()=>{
 const start=arena({late:true,exploration:true}),before=structuredClone(start),doctor=member(start,'doctor'),ordinary=coastalBatteryController(start,{sharedArtillerySight:true});
 assert.deepEqual(stockTucumanAcuteController(start,{physicianIds:['doctor']})(start,doctor),ordinary(start,doctor));
 const orders=[];let caught;
 try{stabilizeCreatedCuyoBattleSurvivors({battle:start},{execute:(pair,action)=>{
  const battle=actBattle(pair.battle,action);assert.equal(battle.lastError,null);orders.push(structuredClone(action));return {battle};
 }});}catch(error){caught=error;}
 assert.ok(caught);assert.equal(caught.message,'Every actual living Cuyo patient must survive ordered finite field aid.');
 assert.ok(orders.some(action=>action.type==='useItem'));assert.deepEqual(start,before);
 // The refused/failed result is not queried, replayed, saved or continued.
});

// Independent declarations extend the existing coastal posture scene with a
// distant same-roof patient. They contain no route result or captured state.
function postureCareArena({useful=false}={}){
 const person=(id,x,y,extra={})=>({id,name:id,x,y,hp:100,maxHp:100,weapon:1805,blade:0,loaded:1,ammo:11,medical:0,medkits:0,marksmanship:0,condition:100,energy:100,fatigue:0,morale:90,agility:75,dexterity:75,strength:90,experienceLevel:4,stance:'standing',movementMode:'walk',facing:2,...extra});
 const width=28,height=16,people=[
  person('doctor',10,7,{tacticalLevel:1,medical:85,medkits:6,stance:'prone',movementMode:'prone',...(useful?{weapon:1801,marksmanship:95,stance:'standing',movementMode:'walk'}:{})}),
  person('patient',5,7,{tacticalLevel:1,weapon:0,loaded:0,ammo:0,hp:8,bleeding:2,bandaged:90}),
  person('observer',20,9,{weapon:0,loaded:0,ammo:0,facing:0}),
 ];
 const options={id:'declared-stock-care-posture-progress',sector:'tucuman',width,height,hour:12,seed:45,
  tiles:Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:i%width===25?'stone':'grass',blocked:i%width===25,blocksSight:i%width===25,cover:0})),
  upperSurfaces:Array.from({length:30},(_,i)=>({id:'care-roof-'+i,x:5+i%6,y:5+Math.floor(i/6),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:0})),
  climbLinks:[{id:'public-care-access',kind:'climb',from:{x:8,y:10,tacticalLevel:0},to:{x:8,y:9,tacticalLevel:1}}],
  artillery:[{id:'spent',type:'bronze4',side:'player',x:3,y:12,loaded:false,ammo:0}],
  enemies:[person('contact',useful?14:24,7,{side:'enemy',weapon:0,loaded:0,ammo:0,stance:useful?'standing':'prone',movementMode:useful?'walk':'prone',patrol:false,overwatch:false})],
 };
 const declaration=structuredClone({people,options}),battle=createBattle(people,options);
 assert.deepEqual({people,options},declaration);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(battle))),battle);return battle;
}

test('a real medical rise keeps paying its safe finite care route instead of lowering again, while useful firing posture stays first',()=>{
 const start=postureCareArena(),before=structuredClone(start),doctor=member(start,'doctor'),patient=member(start,'patient'),contact=member(start,'contact'),ordinary=coastalBatteryController(start,{sharedArtillerySight:true});
 assert.equal(teamCanSee(start,'player',contact),true);assert.ok(Math.hypot(doctor.x-patient.x,doctor.y-patient.y)>1.5);assert.equal(ordinary(start,doctor),null);
 const paid=stanceCost(doctor,'standing'),actor={...doctor,stance:'standing',movementMode:'walk',weaponReady:false,momentum:0,ap:doctor.ap-paid},view=publicRouteView(start,doctor),quoted={...view,units:view.units.map(unit=>unit.id===actor.id?actor:unit)},hand=actionCosts(quoted,actor).weapon;
 const routes=getReachable(quoted,actor).filter(point=>point.cost>0&&point.path.every(step=>sameSurface(doctor,step)&&surfaceAt(quoted,step).cover===surfaceAt(quoted,doctor).cover)&&medicalUsePreview(quoted,{...actor,...spacePoint(point),activeSlot:'medical',ap:actor.ap-point.cost-hand},patient).allowed);
 assert.ok(paid>0&&routes.length>0,'The fresh upright route, hand and actual stroke must fit the current paid AP.');
 for(const point of routes)for(const step of point.path){assert.ok(Math.hypot(step.x-contact.x,step.y-contact.y)>2.5);assert.ok(!hasLineOfSight(quoted,contact,{...actor,...spacePoint(step)})||hasLineOfSight(view,contact,doctor));}
 const controller=stockTucumanAcuteController(start,{physicianIds:['doctor']}),rise=controller(start,doctor);assert.deepEqual(rise,{type:'stance',unitId:doctor.id,stance:'standing'});
 const raised=execute(start,[rise]);assert.equal(member(raised,doctor.id).ap,doctor.ap-paid);assert.equal(member(raised,doctor.id).medkits,doctor.medkits);assert.deepEqual(start,before);
 const lowering=ordinary(raised,member(raised,doctor.id));assert.deepEqual(lowering,{type:'stance',unitId:doctor.id,stance:'crouched'});assert.equal(usefulRouteFiringPosture(raised,member(raised,doctor.id),lowering),false);
 const {battle,orders}=treat(raised);assert.equal(orders[0].type,'move');assert.equal(orders.some(action=>action.type==='stance'),false);assert.ok(orders.some(action=>action.type==='useItem'));assert.equal(member(battle,doctor.id).medkits,doctor.medkits-1);
 let paidReplay=raised;
 for(const action of orders){
  const u=member(paidReplay,doctor.id),q=action.type==='move'?getReachable(paidReplay,u,{stopAt:point=>sameCell(point,action)})[0]:action.type==='useItem'?medicalUsePreview(paidReplay,u,member(paidReplay,action.targetId)):null;
  if(action.type==='useItem')assert.equal(q.allowed,true);const cost=action.type==='weapon'?actionCosts(paidReplay,u).weapon:q.cost;assert.ok(cost>0);
  const next=execute(paidReplay,[action]);assert.equal(member(next,u.id).ap,u.ap-cost);assert.equal(member(next,u.id).medkits,u.medkits-(q?.treatment?.dressingsUsed??0));paidReplay=next;
 }
 assert.deepEqual(paidReplay,battle);
 for(const key of ['hp','bleeding','weapon','weaponInstanceId','condition','loaded','ammo','inventory'])assert.deepEqual(member(battle,doctor.id)[key],doctor[key]);
 assert.equal(battle.turn,start.turn);assert.deepEqual(battle.artillery,start.artillery);assert.deepEqual(execute(start,[rise,...orders]),battle);assert.deepEqual(start,before);
 const useful=postureCareArena({useful:true}),u=member(useful,'doctor'),base=coastalBatteryController(useful,{sharedArtillerySight:true})(useful,u),snapshot=structuredClone(useful);
 const usefulController=stockTucumanAcuteController(useful,{physicianIds:['doctor']});assert.equal(base?.type,'stance');assert.equal(usefulRouteFiringPosture(useful,u,base),true);assert.deepEqual(usefulController(useful,u),base);
 const posed=execute(useful,[base]),fire=usefulController(posed,member(posed,u.id));assert.equal(fire?.type,'fire');const fired=execute(posed,[fire]);assert.equal(member(fired,u.id).medkits,u.medkits);assert.ok(member(fired,u.id).loaded<u.loaded||member(fired,u.id).jammed);assert.deepEqual(execute(useful,[base,fire]),fired);assert.deepEqual(useful,snapshot);
});
