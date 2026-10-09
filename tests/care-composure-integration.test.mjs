import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {contractQuote} from '../game/contracts.js';
import {createBattle,actBattle,endTurn,presentedActBattle,presentedEndTurn,medicalUsePreview,getCareComposureResult,shotChance,canSee,weaponFor} from '../game/tactical.js';
import {fieldPractice} from '../game/skill-training.js';
import {ammoCount} from '../game/ammo-types.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {travelLegHours} from '../game/squad-travel.js';

const actor=(battle,id)=>battle.units.find(unit=>unit.id===String(id));
const saved=pair=>decodeSave(encodeSave(pair.campaign,pair.battle??null));
const stamp=campaign=>campaign.hour*3600+(campaign.secondOfHour??0);
const order=(campaign,action)=>{const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,next.lastError);return next;};

function paidArena({oldPinned=false}={}){
 const content=defaultContentPackage();
 // This declared clinical experiment pins the original pre-kinetic Brown Bess
 // balance before campaign creation. The separate kinetic acceptance tests the
 // fresh default energy profile; no executed health, gear or RNG is reset here.
 const clinicalGun=content.weapons.find(weapon=>weapon.template===1800);
 delete clinicalGun.projectileEnergy;delete clinicalGun.projectileAirDrag;
 for(const load of clinicalGun.alternativeLoads??[]){delete load.projectileEnergy;delete load.projectileAirDrag;}
 // Labelled compatibility control: an older pinned package omits the ability
 // before campaign creation. It receives no later catalogue backfill.
 if(oldPinned)delete content.characters.find(character=>character.id==='person-130').abilities;
 let campaign=initialCampaign(42,content);const quotes=[];
 for(const id of [130,110]){
  const quote=contractQuote(campaign,rosterFor(campaign).find(character=>character.id===id),'week');
  assert.equal(quote.available,true);quotes.push({id,price:quote.price});
  campaign=order(campaign,{type:'recruitCivic',id,term:'week'});
 }
 assert.deepEqual(quotes,[{id:130,price:252},{id:110,price:420}]);
 assert.equal(campaign.resources.treasury,2528);
 assert.ok([130,110].every(id=>!campaign.recruited.includes(id)),'both real paid arrivals are still pending');
 campaign=order(campaign,{type:'wait',hours:6});
 assert.ok([130,110].every(id=>campaign.recruited.includes(id)));
 // Keep this declared clinical contact in daylight through an actual paid wait.
 campaign=order(campaign,{type:'wait',hours:18-campaign.hour-travelLegHours('retiro','buenos_aires')});
 campaign=order(campaign,{type:'attack',sector:'buenos_aires'});
 const request=campaign.pendingBattle,width=48,height=16;
 // Prepared hostile care arena, not an earned opening victory. Geometry,
 // passive enemy posts, the initial stone screen and seed42 are fixed before
 // official save admission. Native force, health, skills and finite kit stay,
 // with the pre-admission Brown Bess profile exception stated above.
 const battle=createBattle(request.squad.map(unit=>({...unit,x:1,y:unit.id===130?3:5,facing:2})),{
  ...request,width,height,seed:42,props:[],
  tiles:Array.from({length:width*height},(_,i)=>{
   const x=i%width,y=Math.floor(i/width);
   return x===7&&y===2?{x,y,type:'wall',material:'stone',blocked:true,blocksSight:true,cover:100}:{x,y,type:'grass',blocked:false,cover:0};
  }),
  enemies:request.enemies.map((unit,i)=>({...unit,x:i===0?14:i===1?11:46,y:i===0?3:i===1?5:12+i,patrol:false,overwatch:false})),
  npcs:request.npcs.map((npc,i)=>({...npc,x:40+i,y:15})),
 });
 if(request.finiteArtilleryArsenal)battle.finiteArtilleryArsenal=structuredClone(request.finiteArtilleryArsenal);
 const pair=saved({campaign,battle});
 const pinnedGun=pair.campaign.contentCampaign.package.weapons.find(weapon=>weapon.template===1800);
 assert.equal(Object.hasOwn(pinnedGun,'projectileEnergy'),false);assert.equal(Object.hasOwn(pinnedGun,'projectileAirDrag'),false);
 assert.ok((pinnedGun.alternativeLoads??[]).every(load=>!Object.hasOwn(load,'projectileEnergy')&&!Object.hasOwn(load,'projectileAirDrag')));
 assert.equal(weaponFor(actor(pair.battle,110)).projectileEnergy,undefined,'the official saved clinical load retains its explicit legacy profile');
 assert.equal(actor(pair.battle,130).hp,67);assert.equal(actor(pair.battle,110).hp,85);
 for(const id of [130,110]){
  const unit=actor(pair.battle,id);assert.equal(unit.loaded+ammoCount(unit),10);assert.equal(unit.medkits,2);
  assert.equal(unit.condition,100);assert.equal(unit.shock,0);assert.equal(unit.bleeding,0);
 }
 assert.equal(pair.battle.units.filter(unit=>unit.side==='enemy').length,request.enemies.length);
 for(const unit of pair.battle.units.filter(unit=>unit.side==='enemy'))assert.equal(unit.hp,request.enemies.find(enemy=>String(enemy.id)===unit.id).hp??100);
 return {pair,quotes,oldPinned};
}

function step(pair,event,history){
 const source=structuredClone(pair),before=pair.battle;
 const ordinary=event.type==='enemyTurn'?endTurn(before):actBattle(before,event);
 const presented=event.type==='enemyTurn'?presentedEndTurn(before):presentedActBattle(before,event);
 assert.equal(ordinary.lastError,null,ordinary.lastError);assert.deepEqual(presented.state,ordinary);
 assert.deepEqual(pair,source,'ordinary execution and presentation preserve their admitted source');
 const receipt=getCareComposureResult(before,ordinary),next=syncBattleTime(pair.campaign,ordinary);
 assert.equal(next.error,null,next.error);history?.push(structuredClone(event));
 return {pair:saved(next),receipt};
}

const injuryOrders=[
 {type:'move',unitId:'130',x:4,y:3},
 {type:'fire',unitId:'130',targetId:'enemy-1',aim:4},
 {type:'fire',unitId:'110',targetId:'enemy-1',aim:4},
 {type:'enemyTurn'},
 {type:'move',unitId:'110',x:5,y:3},
 {type:'enemyTurn'},
 {type:'move',unitId:'110',x:5,y:2},
 {type:'move',unitId:'130',x:6,y:3},
 {type:'reload',unitId:'130'},
 {type:'fire',unitId:'130',targetId:'enemy-0',aim:4},
 {type:'enemyTurn'},
];

function treatAndWithdraw(start){
 let pair=saved(start);const history=[];
 for(const event of injuryOrders)pair=step(pair,event,history).pair;
 const wounded=structuredClone(pair),doctor=actor(pair.battle,130),patient=actor(pair.battle,110);
 assert.equal(doctor.hp,30);assert.equal(patient.hp,36);
 assert.equal(doctor.bleeding,3);assert.equal(patient.bleeding,3);assert.equal(doctor.shock,2.125);
 assert.equal(actor(pair.battle,'enemy-1').hp,0,'the counterattack causes a real hostile casualty');
 assert.ok(pair.battle.units.filter(unit=>unit.side==='player').every(unit=>unit.hp>0));
 pair=step(pair,{type:'weapon',unitId:'130',slot:'medical'},history).pair;
 const before=structuredClone(pair),plan=medicalUsePreview(pair.battle,actor(pair.battle,130),actor(pair.battle,110));
 assert.equal(canSee(pair.battle,actor(pair.battle,130),actor(pair.battle,110)),true);
 assert.equal(plan.allowed,true,plan.reason);assert.equal(plan.cost,20);assert.equal(plan.treatment.dressingsUsed,1);
 const expectedPractice=structuredClone(actor(before.battle,130));fieldPractice(expectedPractice,'medical',3);
 const treated=step(pair,{type:'heal',unitId:'130',targetId:'110'},history);pair=treated.pair;
 const after=actor(pair.battle,130),helped=actor(pair.battle,110);
 assert.equal(after.ap,actor(before.battle,130).ap-plan.cost);assert.equal(after.medkits,1);
 assert.equal(after.hp,doctor.hp);assert.equal(helped.hp,patient.hp);assert.equal(helped.bleeding,0);
 assert.equal(helped.bandaged,plan.treatment.bandagedAfter);assert.equal(after.medical,expectedPractice.medical);
 assert.deepEqual(after.skillPractice,expectedPractice.skillPractice);assert.equal(after.practiceSeed,expectedPractice.practiceSeed);
 assert.equal(pair.battle.seed,before.battle.seed);assert.equal(pair.battle.elapsedSeconds,before.battle.elapsedSeconds);
 assert.equal(after.loaded,actor(before.battle,130).loaded);assert.equal(ammoCount(after),ammoCount(actor(before.battle,130)));
 assert.equal(after.condition,actor(before.battle,130).condition);assert.equal(pair.campaign.resources.treasury,2528);
 const authored=after.abilities?.includes('care_composure')===true;
 assert.equal(after.shock,doctor.shock-(authored?2:0));
 assert.deepEqual(treated.receipt,authored?{unitId:'130',targetId:'110',targetKind:'unit',relief:2}:null);
 assert.equal(getCareComposureResult(before.battle,pair.battle),null,'an official saved clone cannot repeat the transient care receipt');
 const repeat=actBattle(pair.battle,{type:'heal',unitId:'130',targetId:'110'});
 assert.ok(repeat.lastError,'a fully bandaged patient cannot pay for another stroke');
 assert.deepEqual(repeat.units,pair.battle.units);assert.equal(repeat.seed,pair.battle.seed);
 assert.equal(repeat.elapsedSeconds,pair.battle.elapsedSeconds);assert.equal(getCareComposureResult(pair.battle,repeat),null);
 pair=step(pair,{type:'weapon',unitId:'130',slot:'primary'},history).pair;
 const chance=shotChance(pair.battle,actor(pair.battle,130),actor(pair.battle,'enemy-0'),1);
 // This is the observed next-shot forecast. The finite pistol is empty and
 // still needs a paid reload; a forecast is not an additional discharge.
 assert.equal(actor(pair.battle,130).loaded,0);
 const careReceipt={beforeShock:doctor.shock,afterShock:after.shock,pa:plan.cost,seed:pair.battle.seed,practice:after.skillPractice,practiceSeed:after.practiceSeed,chance};
 pair=step(pair,{type:'weapon',unitId:'110',slot:'medical'},history).pair;
 const reciprocalBefore=structuredClone(pair),reciprocal=medicalUsePreview(pair.battle,actor(pair.battle,110),actor(pair.battle,130));
 assert.equal(reciprocal.allowed,true,reciprocal.reason);assert.equal(reciprocal.cost,25);
 const reciprocated=step(pair,{type:'heal',unitId:'110',targetId:'130'},history);pair=reciprocated.pair;
 assert.equal(reciprocated.receipt,null);assert.equal(actor(pair.battle,110).medkits,1);
 assert.equal(actor(pair.battle,110).shock,actor(reciprocalBefore.battle,110).shock);
 assert.equal(actor(pair.battle,130).hp,30);assert.equal(actor(pair.battle,130).bleeding,0);
 for(const event of [{type:'move',unitId:'130',x:6,y:0},{type:'move',unitId:'110',x:5,y:0}])pair=step(pair,event,history).pair;
 const exit=pair.battle.exits.find(value=>value.destination==='retiro');assert.ok(exit);
 const beforeExit=structuredClone(pair);
 pair=step(pair,{type:'exit',unitIds:['130','110'],exitId:exit.id},history).pair;
 assert.equal(pair.battle.status,'retreat');
 for(const id of [130,110]){assert.ok(actor(pair.battle,id).departure);assert.equal(actor(pair.battle,id).ap,actor(beforeExit.battle,id).ap-8);}
 let replay=saved(start);for(const event of history)replay=step(replay,event).pair;
 assert.deepEqual(replay,pair,'every real hostile turn, shot, care stroke and exit replays through official saves');
 return {pair,history,wounded,beforeCare:before,careReceipt};
}

const equipment=unit=>({hp:unit.hp,bleeding:unit.bleeding,bandaged:unit.bandaged,loaded:unit.loaded,ammo:ammoCount(unit),condition:unit.condition,inventory:unit.inventory,medkits:unit.medkits,medical:unit.medical,skillPractice:unit.skillPractice,practiceSeed:unit.practiceSeed});

function settleAndReenter(execution){
 const final=execution.pair.battle,request=execution.pair.campaign.pendingBattle;
 const report={type:'battleResult',battleId:request.id,outcome:final.status,sectorState:final,survivors:final.units.filter(unit=>unit.side==='player')};
 let campaign=saved({campaign:order(execution.pair.campaign,report)}).campaign;
 assert.equal(campaign.location,'retiro');assert.equal(campaign.resources.treasury,2528);
 assert.deepEqual(campaign.contracts,execution.pair.campaign.contracts);
 for(const enemy of final.units.filter(unit=>unit.side==='enemy'))assert.equal(campaign.sectorStates.buenos_aires.units.find(unit=>unit.id===enemy.id).hp,enemy.hp);
 assert.ok([130,110].every(id=>campaign.operativeState[id].alive));
 const stale=dispatchCampaign(campaign,report);assert.ok(stale.lastError);
 assert.deepEqual({...stale,lastError:null},campaign,'a stale settlement cannot repeat care or alter returned custody');
 const snapshots=[];
 for(let visit=0;visit<2;visit++){
  campaign=order(campaign,{type:'visitSector'});
  const pair=saved({campaign,battle:enterSector(campaign.pendingBattle,campaign.sectorStates.retiro)});
  for(const id of [130,110]){
   const returned=actor(pair.battle,id);assert.deepEqual(equipment(returned),equipment(actor(final,id)));
   assert.equal(returned.shock,0,'normal return to the new friendly sector keeps the existing transient-shock rule');
   assert.equal(getCareComposureResult(final,pair.battle),null);
   assert.equal(pair.campaign.operativeState[id].shock,undefined);
  }
  snapshots.push(pair);
  campaign=saved({campaign:order(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(unit=>unit.side==='player')})}).campaign;
 }
 assert.equal(campaign.resources.treasury,2528);assert.deepEqual(campaign.contracts,execution.pair.campaign.contracts);
 assert.deepEqual(snapshots[1].battle.units.filter(unit=>unit.side==='player').map(equipment),snapshots[0].battle.units.filter(unit=>unit.side==='player').map(equipment));
 return campaign;
}

test('paid Cejas steadies after real hostile wounds and finite external care, with neutral old-pinned replay and physical return',t=>{
 const current=paidArena(),legacy=paidArena({oldPinned:true});
 assert.ok(actor(current.pair.battle,130).abilities.includes('care_composure'));
 assert.equal(actor(legacy.pair.battle,130).abilities,undefined);
 const actual=treatAndWithdraw(current.pair),control=treatAndWithdraw(legacy.pair);
 assert.equal(actual.careReceipt.chance,5);assert.equal(control.careReceipt.chance,1,'the actual care shock change affects the observed aiming forecast after the shorter road march');
 assert.deepEqual(actual.careReceipt.practice,control.careReceipt.practice);assert.equal(actual.careReceipt.practiceSeed,control.careReceipt.practiceSeed);
 assert.equal(actual.pair.battle.seed,control.pair.battle.seed);assert.equal(actual.pair.battle.elapsedSeconds,control.pair.battle.elapsedSeconds);
 for(const unit of actual.pair.battle.units)assert.deepEqual(equipment(unit),equipment(actor(control.pair.battle,unit.id)),'authored composure does not create HP, ammunition, kit, training or equipment');
 const returned=settleAndReenter(actual);settleAndReenter(control);
 const final=actual.pair.battle,doctor=actor(final,130),patient=actor(final,110);
 assert.equal(doctor.loaded+ammoCount(doctor),8);assert.equal(patient.loaded+ammoCount(patient),9);
 assert.equal(doctor.condition,98);assert.equal(patient.condition,99);
 assert.equal(stamp(actual.pair.campaign)-stamp(current.pair.campaign),final.elapsedSeconds-current.pair.battle.elapsedSeconds);
 t.diagnostic(JSON.stringify({fixture:'Prepared48×16 hostile BA arena with declared initial stone screen7,2, native four-enemy force and representative seed42; real hires/arrivals/travel; no opening victory. Two earlier open-lane probes failed before care.',quotes:current.quotes,treasury:returned.resources.treasury,arrivalHour:6,assaultHour:current.pair.campaign.hour,orders:actual.history.length,actionSeconds:final.elapsedSeconds,care:actual.careReceipt,neutralCare:control.careReceipt,reciprocalCarePA:25,health:[{id:130,hp:doctor.hp,bleeding:doctor.bleeding},{id:110,hp:patient.hp,bleeding:patient.bleeding}],rounds:[{id:130,before:10,after:doctor.loaded+ammoCount(doctor)},{id:110,before:10,after:patient.loaded+ammoCount(patient)}],dressings:[{id:130,before:2,after:doctor.medkits},{id:110,before:2,after:patient.medkits}],conditions:[doctor.condition,patient.condition],enemyDeaths:final.units.filter(unit=>unit.side==='enemy'&&unit.hp===0).map(unit=>unit.id),playerDeaths:final.units.filter(unit=>unit.side==='player'&&unit.hp===0).map(unit=>unit.id),returnSector:returned.location,seed:final.seed}));
});
