import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote} from '../game/contracts.js';
import {createBattle,actBattle,presentedActBattle,pointFirePreview,weaponFor,firearmFlightPreview,teamCanSee} from '../game/tactical.js';
import {projectileFlight} from '../game/projectile-cover.js';
import {COMBAT_BALANCE} from '../game/combat-balance.js';
import {ammoCount} from '../game/ammo-types.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';

const actor=(battle,id='107')=>battle.units.find(unit=>unit.id===id);
const enemy=battle=>battle.units.find(unit=>unit.side==='enemy');
const saved=pair=>decodeSave(encodeSave(pair.campaign,pair.battle??null));
const order=(state,action)=>{const next=dispatchCampaign(state,action);assert.equal(next.lastError,null,next.lastError);return next;};
const stamp=campaign=>campaign.hour*3600+(campaign.secondOfHour??0);
const point={x:10,y:5,tacticalLevel:0,stance:'standing'};

function paidAssault(){
 let campaign=initialCampaign(45);const initialCash=campaign.resources.treasury,quotes=[];
 for(const id of [107,110]){
  const quote=contractQuote(campaign,rosterFor(campaign).find(unit=>unit.id===id),'week');
  assert.ok(quote.available&&quote.price>0);quotes.push({id,price:quote.price});
  campaign=order(campaign,{type:'recruitCivic',id,term:'week'});
 }
 campaign=order(campaign,{type:'wait',hours:6});
 for(const {id,price} of quotes){assert.ok(campaign.recruited.includes(id));assert.equal(campaign.contracts[id].paid,price);}
 campaign=order(campaign,{type:'attack',sector:'buenos_aires'});
 assert.equal(campaign.resources.treasury,initialCash-quotes.reduce((sum,quote)=>sum+quote.price,0));
 return {campaign,quotes};
}

// Declared flat firing arena, not a fresh campaign victory or a balance proof.
// Geometry, passive hostile posts, dry weather and representative seed 8 are
// fixed before official save admission. The actual paid hires and issued
// hostile force keep their health, skills, contracts and finite equipment.
function arena(campaign){
 const request=campaign.pendingBattle,width=32,height=16;
 const tiles=Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,blocksSight:false,cover:0}));
 const wallEdges=[{id:'native-stone',x:7,y:5,axis:'x',type:'wall',material:'stone',blocked:true,blocksSight:true,cover:100}];
 const battle=createBattle(request.squad.map(unit=>({...unit,x:unit.id===107?1:13,y:unit.id===107?3:5,facing:unit.id===107?2:6})),{
  ...request,width,height,seed:8,weather:{rain:0,humidity:0},tiles,wallEdges,props:[],
  enemies:request.enemies.map((unit,i)=>({...unit,x:i?28:12,y:i?10+i:4,patrol:false,overwatch:false})),
  npcs:request.npcs.map((npc,i)=>({...npc,x:31-i,y:15})),
 });
 if(request.finiteArtilleryArsenal)battle.finiteArtilleryArsenal=structuredClone(request.finiteArtilleryArsenal);
 return saved({campaign:structuredClone(campaign),battle});
}

function issue(pair,action,history){
 const before=structuredClone(pair),ordinary=actBattle(pair.battle,action),presented=presentedActBattle(pair.battle,action);
 assert.equal(ordinary.lastError,null,ordinary.lastError);assert.deepEqual(presented.state,ordinary);
 assert.deepEqual(pair,before,'execution, presentation and saves may not mutate their submitted source');
 const next=syncBattleTime(pair.campaign,ordinary);assert.equal(next.error,null,next.error);
 history?.push(structuredClone(action));return saved(next);
}

test('one paid native ball reflects from an exposed stone face, injures its observed later body and retains finite custody through saved replay and return',t=>{
 const preparation=paidAssault(),start=arena(preparation.campaign),before=structuredClone(start);
 const shooter=actor(start.battle),target=enemy(start.battle),weapon=weaponFor(shooter);
 const cash=start.campaign.resources.treasury,contracts=structuredClone(start.campaign.contracts);
 const initialRounds=shooter.loaded+ammoCount(shooter),observer=actor(start.battle,'110');
 assert.equal(weapon.id,1805);assert.equal(weapon.loadPattern,'single');assert.equal(initialRounds,10);
 assert.equal(teamCanSee(start.battle,'player',target),true);
 assert.ok(start.battle.units.every(unit=>unit.x!==point.x||unit.y!==point.y),'the requested point has no intended body');
 assert.ok(start.battle.npcs.every(npc=>npc.x!==point.x||npc.y!==point.y));

 const forecast=firearmFlightPreview(start.battle,shooter,point),flight=projectileFlight(start.battle,shooter,point,weapon);
 const bounce=flight.ricochets?.[0],contact=flight.bodyImpacts.find(hit=>hit.victimKind==='unit'&&hit.victimId===target.id);
 assert.ok(bounce,'the real selected single-ball load reaches one exposed stone face');
 assert.equal(flight.ricochets.length,1);assert.deepEqual(bounce.normal,{x:0,y:-1,height:0});
 assert.ok(Math.abs(bounce.impact.x-7.48)<1e-10);assert.ok(Math.abs(bounce.impact.y-4.44)<1e-10);
 assert.equal(bounce.remainingImpact,bounce.incomingImpact*COMBAT_BALANCE.firearmRicochetForceRetention);
 assert.ok(bounce.remainingImpact<bounce.incomingImpact);
 assert.ok(contact&&contact.segmentIndex===1,'the same physical ball reaches the observed body after its turn');
 assert.equal(flight.segments.length,2);assert.deepEqual(flight.segments[1].source,bounce.impact);
 assert.equal(flight.segments[0].fromDistance,0);assert.equal(flight.segments[1].fromDistance,flight.segments[0].toDistance);
 assert.ok(flight.segments.at(-1).toDistance<=weapon.range*COMBAT_BALANCE.firearmFlightRangeMultiplier+1e-10,'the reflection spends the original finite range');
 assert.ok(forecast.bodyImpacts.some(hit=>hit.victimKind==='unit'&&hit.victimId===target.id),'the public forecast uses the same observed path');
 const ordinaryCover={...start.battle,wallEdges:start.battle.wallEdges.map(edge=>({...edge,material:'adobe'}))};
 const straight=projectileFlight(ordinaryCover,shooter,point,weapon);
 assert.ok(!straight.ricochets?.length);assert.ok(!straight.bodyImpacts.some(hit=>hit.victimId===target.id&&hit.victimKind==='unit'),'ordinary penetrable material does not invent a reflected body contact');
 assert.deepEqual(start,before,'forecast and geometry spend no RNG, time, money or equipment');

 const action={type:'firePoint',unitId:'107',x:point.x,y:point.y,tacticalLevel:0,aim:4};
 const preview=pointFirePreview(start.battle,shooter,point,action.aim);assert.equal(preview.valid,true,preview.reason);
 const shown=presentedActBattle(start.battle,action),history=[];
 let pair=issue(start,action,history),fired=actor(pair.battle),injured=enemy(pair.battle);
 assert.ok(injured.hp<target.hp,'the ordinary resolved shot actually injures the later body');
 assert.equal(fired.ap,shooter.ap-preview.pa);assert.equal(fired.loaded,0);assert.equal(ammoCount(fired),ammoCount(shooter));
 assert.equal(fired.condition,shooter.condition-1);assert.equal(fired.energy,shooter.energy);
 assert.equal(pair.battle.elapsedSeconds-start.battle.elapsedSeconds,6);assert.equal(stamp(pair.campaign)-stamp(start.campaign),6);
 assert.equal(pair.battle.smoke.length-start.battle.smoke.length,1,'a reflected ball does not discharge powder again');
 const projectiles=shown.frames.filter(frame=>frame.type==='projectile');assert.equal(projectiles.length,2);
 const [firstLeg,secondLeg]=projectiles.map(frame=>frame.shotVisual);
 assert.deepEqual(firstLeg.impact,bounce.impact,'the resolved ordinary shot reaches the declared exposed face');
 assert.equal(firstLeg.outcome,'cover');assert.equal(firstLeg.material,'stone');
 assert.deepEqual(secondLeg.source,firstLeg.impact);assert.deepEqual(secondLeg.impact,contact.impact);
 assert.equal(secondLeg.discharge,false);assert.equal(projectiles.filter(frame=>frame.shotVisual.discharge!==false).length,1,'both admitted legs share one discharge');
 for(const frame of projectiles){
  assert.equal(frame.state.units.find(unit=>unit.id===target.id).hp,target.hp,'both observed legs precede the actual paid injury');
  for(const key of ['segments','ricochets','trajectoryModel','sourceId'])assert.equal(key in frame.shotVisual,false,'public effects do not expose raw physical geometry or object identities');
 }
 assert.equal(shown.frames.flatMap(frame=>frame.impacts).filter(hit=>hit.unitId===target.id&&hit.victimKind!=='npc').reduce((sum,hit)=>sum+hit.damage,0),target.hp-injured.hp);
 assert.equal(pair.campaign.resources.treasury,cash);assert.deepEqual(pair.campaign.contracts,contracts);
 assert.notEqual(pair.battle.seed,start.battle.seed);
 const shotReceipt={health:injured.hp,region:injured.lastHitLocation,pa:shooter.ap-fired.ap,seconds:pair.battle.elapsedSeconds-start.battle.elapsedSeconds,seed:pair.battle.seed};

 pair=issue(pair,{type:'move',unitId:'107',x:1,y:0},history);
 pair=issue(pair,{type:'move',unitId:'110',x:13,y:0},history);
 const north=pair.battle.exits.find(exit=>exit.destination==='retiro');assert.ok(north);
 pair=issue(pair,{type:'exit',unitIds:['107','110'],exitId:north.id},history);assert.equal(pair.battle.status,'retreat');
 for(const id of ['107','110'])assert.ok(actor(pair.battle,id).departure);
 let replay=saved(start);for(const nextAction of history)replay=issue(replay,nextAction);
 assert.deepEqual(replay,pair,'every actual paid order replays through the complete official save');
 const final=structuredClone(pair.battle),request=pair.campaign.pendingBattle;
 let campaign=order(pair.campaign,{type:'battleResult',battleId:request.id,outcome:final.status,sectorState:final,survivors:final.units.filter(unit=>unit.side==='player')});
 campaign=saved({campaign}).campaign;assert.equal(campaign.location,'retiro');assert.equal(campaign.resources.treasury,cash);assert.deepEqual(campaign.contracts,contracts);
 for(const hostile of final.units.filter(unit=>unit.side==='enemy'))assert.equal(campaign.sectorStates.buenos_aires.units.find(unit=>unit.id===hostile.id).hp,hostile.hp);
 const fallen=final.units.filter(unit=>unit.side==='player'&&unit.hp===0).map(unit=>Number(unit.id));
 assert.deepEqual(request.squad.filter(unit=>!campaign.operativeState[unit.id].alive).map(unit=>unit.id),fallen,'actual battle deaths persist as service deaths');
 campaign=order(campaign,{type:'visitSector'});const returned=saved({campaign,battle:enterSector(campaign.pendingBattle,campaign.sectorStates.retiro)});
 for(const unit of final.units.filter(unit=>unit.side==='player')){
  const actual=actor(returned.battle,unit.id);assert.equal(actual.hp,unit.hp);assert.equal(actual.bleeding,unit.bleeding);
  assert.equal(actual.loaded,unit.loaded);assert.equal(ammoCount(actual),ammoCount(unit));assert.equal(actual.condition,unit.condition);
  assert.deepEqual(actual.inventory,unit.inventory);
 }
 assert.equal(actor(returned.battle).loaded+ammoCount(actor(returned.battle)),initialRounds-1);
 assert.equal(actor(returned.battle,'110').loaded+ammoCount(actor(returned.battle,'110')),observer.loaded+ammoCount(observer));
 for(const key of ['segments','ricochets','trajectoryModel','trajectory','shotVisual'])assert.equal(key in returned.battle,false,'transient flight data does not become saved equipment or a new action');
 t.diagnostic(JSON.stringify({fixture:'Declared flat32×16 BA firing arena; genuine paid hires/native kit; representative seed8; no earned opening victory',quotes:preparation.quotes,treasury:cash,requestedPoint:point,bounce:{point:bounce.impact,normal:bounce.normal,incoming:bounce.incomingImpact,remaining:bounce.remainingImpact,distance:bounce.distance},contact:{point:contact.impact,distance:contact.distance,region:contact.hitLocation},rangeBudget:weapon.range*COMBAT_BALANCE.firearmFlightRangeMultiplier,shot:shotReceipt,orders:history.length,totalActionSeconds:final.elapsedSeconds-start.battle.elapsedSeconds,rounds:[initialRounds,actor(returned.battle).loaded+ammoCount(actor(returned.battle))],condition:[shooter.condition,actor(returned.battle).condition],health:final.units.filter(unit=>unit.side==='player').map(unit=>({id:unit.id,hp:unit.hp,bleeding:unit.bleeding})),fallen}));
});
