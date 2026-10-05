import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor,contractQuote} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {createBattle,actBattle,presentedActBattle,weaponFor,getReachable,lookPreview,containerLootPreview,firearmFlightPreview,firearmVolleyPreview,actionCosts} from '../game/tactical.js';
import {firearmBystanderRisk} from '../game/firearm-bystander-risk.js';
import {projectileLaunchImpact} from '../game/projectile-energy.js';
import {ammoCount} from '../game/ammo-types.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {battleFrameDuration,battleFrameFocus} from '../game/battle-playback.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const saved=p=>decodeSave(encodeSave(p.campaign,p.battle??null));
const actor=(b,id='110')=>b.units.find(u=>u.id===id);
function issue(pair,action,history){
 const before=structuredClone(pair),normal=actBattle(pair.battle,action),shown=presentedActBattle(pair.battle,action);assert.equal(normal.lastError,null,normal.lastError);assert.deepEqual(shown.state,normal);assert.deepEqual(pair,before);
 const synced=syncBattleTime(pair.campaign,normal);assert.equal(synced.error,null,synced.error);history?.push(action);return {pair:saved(synced),shown};
}
function prepared({omitted=false,airOmitted=false,hidden=false}={}){
 const content=defaultContentPackage();if(omitted){const gun=content.weapons.find(w=>w.template===1800);delete gun.projectileEnergy;delete gun.projectileAirDrag;for(const load of gun.alternativeLoads){delete load.projectileEnergy;delete load.projectileAirDrag;}}
 if(airOmitted){const gun=content.weapons.find(w=>w.template===1800);delete gun.projectileAirDrag;for(const load of gun.alternativeLoads)delete load.projectileAirDrag;}
 let campaign=initialCampaign(8,content),quotes=[];for(const id of [110,107]){const quote=contractQuote(campaign,rosterFor(campaign).find(u=>u.id===id),'week');assert.ok(quote.available);quotes.push({id,price:quote.price});campaign=order(campaign,{type:'recruitCivic',id,term:'week'});}
 assert.equal(campaign.resources.treasury,3200-quotes.reduce((n,q)=>n+q.price,0));campaign=order(campaign,{type:'wait',hours:6});assert.ok(campaign.recruited.includes(110)&&campaign.recruited.includes(107));
 campaign=order(campaign,{type:'visitSector'});let pair=saved({campaign,battle:enterSector(campaign.pendingBattle)}),initial=saved(pair),history=[];
 const chest=()=>pair.battle.props.find(p=>p.id==='retiro:armory-cache'),distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);assert.ok(chest());
 for(let i=0;distance(actor(pair.battle),chest())>1&&i<40;i++){
  const point=getReachable(pair.battle,actor(pair.battle)).filter(p=>distance(p,chest())===1).sort((a,b)=>a.cost-b.cost)[0];assert.ok(point);pair=issue(pair,{type:'move',unitId:'110',x:point.x,y:point.y},history).pair;
 }
 assert.ok(distance(actor(pair.battle),chest())<=1);if(lookPreview(pair.battle,actor(pair.battle),chest()).valid)pair=issue(pair,{type:'look',unitId:'110',x:chest().x,y:chest().y},history).pair;
 pair=issue(pair,{type:'useItem',unitId:'110',environment:{kind:'container',id:chest().id,verb:'open'}},history).pair;
 const index=chest().contents.findIndex(s=>s.ammoType==='shot_16'),beforeStock=chest().contents[index].count,preview=containerLootPreview(pair.battle,actor(pair.battle),{kind:'container',id:chest().id},index,2);assert.equal(preview.valid,true);
 pair=issue(pair,preview.action,history).pair;assert.equal(chest().contents.find(s=>s.ammoType==='shot_16').count,beforeStock-2);assert.equal(ammoCount(actor(pair.battle),'ammoShot'),2);
 let replay=initial;for(const action of history)replay=issue(replay,action).pair;assert.deepEqual(replay,pair,'the finite physical acquisition has full ordinary/presented official saved replay');
 campaign=order(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});campaign=saved({campaign}).campaign;
 campaign=order(campaign,{type:'attack',sector:'buenos_aires'});const request=campaign.pendingBattle,width=32,height=16;
 // Declared dry, passive-post arena before its first admitted save. The paid
 // request supplies all HP, equipment, contracts and force; no later grants.
 const battle=createBattle(request.squad.map(u=>({...u,x:u.id===110?1:6,y:u.id===110?3:4,facing:2})),{...request,width,height,seed:8,weather:{rain:0,humidity:0},
  tiles:Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,blocksSight:false,cover:0})),
  props:[{id:'known-screen',type:'hay',x:3,y:3,obstacleHeight:2,projectileResistance:8,blocksMovement:false,blocksSight:false},...(hidden?[{id:'private-screen',type:'hay',x:4,y:3,roomId:'unrevealed',obstacleHeight:2,projectileResistance:8,blocksMovement:false,blocksSight:false}]:[])],
  enemies:request.enemies.map((u,i)=>({...u,x:i?28:7,y:i?10+i:3,patrol:false,overwatch:false})),npcs:request.npcs.map((u,i)=>({...u,x:31-i,y:15}))});
 if(request.finiteArtilleryArsenal)battle.finiteArtilleryArsenal=structuredClone(request.finiteArtilleryArsenal);
 return {pair:saved({campaign,battle}),quotes,acquisitionOrders:history.length};
}
function returned(start,pair,history){
 for(const id of ['110','107'])pair=issue(pair,{type:'move',unitId:id,x:actor(pair.battle,id).x,y:0},history).pair;
 const exit=pair.battle.exits.find(e=>e.destination==='retiro');assert.ok(exit);pair=issue(pair,{type:'exit',unitIds:['110','107'],exitId:exit.id},history).pair;assert.equal(pair.battle.status,'retreat');
 let replay=saved(start);for(const action of history)replay=issue(replay,action).pair;assert.deepEqual(replay,pair);
 const final=pair.battle;let campaign=order(pair.campaign,{type:'battleResult',battleId:pair.campaign.pendingBattle.id,outcome:'retreat',sectorState:final,survivors:final.units.filter(u=>u.side==='player')});campaign=saved({campaign}).campaign;
 assert.equal(campaign.resources.treasury,start.campaign.resources.treasury);assert.deepEqual(campaign.contracts,start.campaign.contracts);for(const enemy of final.units.filter(u=>u.side==='enemy'))assert.equal(campaign.sectorStates.buenos_aires.units.find(u=>u.id===enemy.id).hp,enemy.hp);
 campaign=order(campaign,{type:'visitSector'});const reentry=saved({campaign,battle:enterSector(campaign.pendingBattle,campaign.sectorStates.retiro)});
 for(const unit of final.units.filter(u=>u.side==='player')){const live=actor(reentry.battle,unit.id);for(const key of ['hp','bleeding','condition','loaded'])assert.equal(live[key],unit[key]);assert.deepEqual(live.inventory,unit.inventory);assert.deepEqual(live.weaponMetadata,unit.weaponMetadata);assert.equal(ammoCount(live),ammoCount(unit));}
 return {final,reentry};
}

test('paid native ball and finite selected shot profiles affect real injury and survive official replay, physical return and neutral old pins',t=>{
 const fresh=prepared(),old=prepared({omitted:true}),withoutAir=prepared({airOmitted:true}),privateScene=prepared({hidden:true}),start=fresh.pair,unit=actor(start.battle),target=start.battle.units.find(u=>u.side==='enemy'),weapon=weaponFor(unit),history=[];
 assert.equal(weapon.id,1800);assert.deepEqual(weapon.projectileEnergy,{model:'kinetic-energy-v1',massGrams:32,muzzleVelocityMps:265});assert.equal(Object.hasOwn(weaponFor(actor(old.pair.battle)),'projectileEnergy'),false);
 assert.deepEqual(weapon.projectileAirDrag,{model:'range-energy-retention-v1',retentionAtRange:.8});assert.equal(Object.hasOwn(weaponFor(actor(withoutAir.pair.battle)),'projectileAirDrag'),false);
 const path=firearmFlightPreview(start.battle,unit,target),hit=path.bodyImpacts.find(h=>h.victimId===target.id),legacyPath=firearmFlightPreview(old.pair.battle,actor(old.pair.battle),old.pair.battle.units.find(u=>u.id===target.id)),airOmittedPath=firearmFlightPreview(withoutAir.pair.battle,actor(withoutAir.pair.battle),withoutAir.pair.battle.units.find(u=>u.id===target.id));
 const arc=Math.hypot(1,.3/6),expected=(projectileLaunchImpact(weapon)*.8**(1.5*arc/weapon.range)-8*arc)*.8**(3*arc/weapon.range);
 assert.ok(hit);assert.ok(Math.abs(hit.incomingImpact-expected)<1e-9);assert.ok(hit.incomingImpact<airOmittedPath.bodyImpacts[0].incomingImpact);assert.ok(hit.incomingImpact<legacyPath.bodyImpacts[0].incomingImpact);
 assert.deepEqual(path.obstacles.filter(o=>o.sourceId==='prop:known-screen'),airOmittedPath.obstacles.filter(o=>o.sourceId==='prop:known-screen'),'air decay does not charge the occupied hay interval a second time');
 const action={type:'fire',unitId:'110',targetId:target.id,aim:4,hitLocation:'torso'},fired=issue(start,action,history),oldFired=issue(old.pair,action),airOmittedFired=issue(withoutAir.pair,action),privateFired=issue(privateScene.pair,action);let pair=fired.pair;
 const injured=pair.battle.units.find(u=>u.id===target.id),oldInjured=oldFired.pair.battle.units.find(u=>u.id===target.id);assert.ok(injured.hp<target.hp);assert.ok(injured.hp>oldInjured.hp);assert.equal(actor(pair.battle).loaded,0);assert.equal(actor(pair.battle).condition,unit.condition-1);assert.equal(ammoCount(actor(pair.battle),'ammoMusket'),ammoCount(unit,'ammoMusket'));
 assert.ok(injured.hp>airOmittedFired.pair.battle.units.find(u=>u.id===target.id).hp,'the same paid shot has a real injury consequence from free-flight energy loss');
 const cost=actionCosts(start.battle,unit,target);assert.equal(actor(pair.battle).ap,unit.ap-cost.fire-4*cost.aim);assert.equal(pair.battle.elapsedSeconds-start.battle.elapsedSeconds,6);
 for(const control of [oldFired,airOmittedFired]){for(const key of ['ap','loaded','condition','hp','bleeding','medkits'])assert.equal(actor(control.pair.battle)[key],actor(pair.battle)[key]);assert.equal(control.pair.battle.elapsedSeconds,pair.battle.elapsedSeconds);assert.deepEqual(actor(control.pair.battle).inventory,actor(pair.battle).inventory);}
 const injuryIndex=fired.shown.frames.findIndex(f=>f.impacts.some(hit=>hit.unitId===target.id&&hit.damage>0)),tailIndex=fired.shown.frames.findIndex(f=>f.type==='projectile'&&f.shotVisual?.discharge===false);assert.ok(injuryIndex>=0);if(tailIndex>=0)assert.ok(injuryIndex<tailIndex,'the real observed injury is admitted at contact before the projected tail');
 const publicFlights=shown=>shown.frames.filter(f=>f.type==='projectile').map(f=>({type:f.type,action:f.action,unitId:f.unitId,visibleIds:f.visibleIds,impacts:f.impacts,targetPoint:f.targetPoint,shotVisual:f.shotVisual,duration:battleFrameDuration(f),focus:battleFrameFocus(f)}));
 assert.deepEqual(firearmVolleyPreview(privateScene.pair.battle,actor(privateScene.pair.battle),privateScene.pair.battle.units.find(u=>u.id===target.id),4),firearmVolleyPreview(start.battle,unit,target,4));assert.deepEqual(publicFlights(privateFired.shown),publicFlights(fired.shown));assert.doesNotMatch(JSON.stringify(publicFlights(privateFired.shown)),/private-screen|projectileEnergy|trajectoryModel|incomingImpact|sourceId/);assert.ok(privateFired.pair.battle.units.find(u=>u.id===target.id).hp>injured.hp);assert.deepEqual(issue(saved(privateScene.pair),action).pair,privateFired.pair);
 const result=returned(start,pair,history),oldResult=returned(old.pair,oldFired.pair,[action]),airOmittedResult=returned(withoutAir.pair,airOmittedFired.pair,[action]);assert.equal(Object.hasOwn(weaponFor(actor(oldResult.reentry.battle)),'projectileEnergy'),false);assert.equal(Object.hasOwn(weaponFor(actor(oldResult.reentry.battle)),'projectileAirDrag'),false);assert.equal(Object.hasOwn(weaponFor(actor(airOmittedResult.reentry.battle)),'projectileAirDrag'),false);
 const returnedStart=saved(result.reentry),loadHistory=[];pair=issue(returnedStart,{type:'selectAmmunitionLoad',unitId:'110',family:'ammoShot'},loadHistory).pair;assert.deepEqual(weaponFor(actor(pair.battle)).projectileEnergy,{model:'kinetic-energy-v1',massGrams:16,muzzleVelocityMps:265});
 assert.deepEqual(weaponFor(actor(pair.battle)).projectileAirDrag,{model:'range-energy-retention-v1',retentionAtRange:.65});
 const reserve=ammoCount(actor(pair.battle),'ammoShot');pair=issue(pair,{type:'reload',unitId:'110'},loadHistory).pair;assert.equal(ammoCount(actor(pair.battle),'ammoShot'),reserve-1);assert.equal(actor(pair.battle).loaded,1);
 const safePoint=getReachable(pair.battle,actor(pair.battle)).filter(p=>Math.hypot(p.x-actor(pair.battle).x,p.y-actor(pair.battle).y)>=2).find(p=>{const risk=firearmBystanderRisk(pair.battle,actor(pair.battle),{...p,stance:'standing'});return !risk.direct.length&&!risk.scatter.length;});assert.ok(safePoint,'the current public forecast offers a safe ground-fire direction');
 for(let attempts=0;actor(pair.battle).loaded>0&&attempts<3;attempts++){
  pair=issue(pair,{type:'firePoint',unitId:'110',x:safePoint.x,y:safePoint.y,aim:0},loadHistory).pair;
  if(actor(pair.battle).jammed){assert.equal(actor(pair.battle).loaded,1,'an actual ignition failure retains the finite charge');pair=issue(pair,{type:'reprime',unitId:'110'},loadHistory).pair;}
 }
 assert.equal(actor(pair.battle).loaded,0);assert.equal(ammoCount(actor(pair.battle),'ammoShot'),1);assert.equal(actor(pair.battle).condition,unit.condition-2);
 let loadReplay=returnedStart;for(const a of loadHistory)loadReplay=issue(loadReplay,a).pair;assert.deepEqual(loadReplay,pair);
 let campaign=order(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});campaign=order(saved({campaign}).campaign,{type:'visitSector'});const finalEntry=saved({campaign,battle:enterSector(campaign.pendingBattle,campaign.sectorStates.retiro)});
 assert.equal(actor(finalEntry.battle).ammunitionChoice,'ammoShot');assert.deepEqual(weaponFor(actor(finalEntry.battle)).projectileEnergy,{model:'kinetic-energy-v1',massGrams:16,muzzleVelocityMps:265});assert.equal(actor(finalEntry.battle).condition,unit.condition-2);assert.equal(ammoCount(actor(finalEntry.battle),'ammoShot'),1);assert.deepEqual(actor(finalEntry.battle).inventory,actor(pair.battle).inventory);
 assert.deepEqual(weaponFor(actor(finalEntry.battle)).projectileAirDrag,{model:'range-energy-retention-v1',retentionAtRange:.65});
 t.diagnostic(JSON.stringify({scope:'declared arena, no campaign victory claim; both omission controls pinned before creation',quotes:fresh.quotes,acquisitionOrders:fresh.acquisitionOrders,orders:history.length+loadHistory.length,treasury:finalEntry.campaign.resources.treasury,contract:start.campaign.contracts[110],force:{native:hit.incomingImpact,airOmitted:airOmittedPath.bodyImpacts[0].incomingImpact,energyOmitted:legacyPath.bodyImpacts[0].incomingImpact},hp:{native:injured.hp,airOmitted:airOmittedFired.pair.battle.units.find(u=>u.id===target.id).hp,energyOmitted:oldInjured.hp},condition:[unit.condition,actor(finalEntry.battle).condition],remainingShot:ammoCount(actor(finalEntry.battle),'ammoShot'),remainingMusket:ammoCount(actor(finalEntry.battle),'ammoMusket'),seed:result.final.seed,elapsed:result.final.elapsedSeconds}));
});
