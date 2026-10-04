import {prepareRecoveryCapitalRelief} from './recovery-capital-relief.mjs';
import {continuePaidSurvivorNorthernRoute} from './recovery-paid-northern-route.mjs';
import {sectorDeploymentModel,sectorDeploymentAction} from '../game/sector-deployment.js';
import {stableCrewController,heavyContactCrewController} from './stable-crew-driver.mjs';
import {enterSector} from '../game/world.js';
import {withdrawCommandToRear,rejoinCommandAfterExit} from './command-reserve-driver.mjs';
import {coastalSearchController} from './coastal-search-driver.mjs';
import {ownedArtilleryCount} from '../game/campaign-artillery.js';
import {storedArtilleryRecord} from '../game/artillery-transport.js';
import {coastalBatteryController,blockadeCommandOrder} from './coastal-command-driver.mjs';
import {mountainBatteryOrder,closeMountainBatteryOrder,mendozaBatteryOrder,assignedMountainBatteryController} from './mountain-battery-driver.mjs';
import {prepareFreshCoastalCommand,prepareFreshEnsenadaAssault,stabilizeFreshPortSurvivors,recruitFreshNavalCommand,recoverFreshPort,prepareFreshBlockadeAssault,prepareFreshSantaFeAssault} from './fresh-coastal-route.mjs';
import {prepareFreshUspallataAssault,recoverFreshUspallata,prepareFreshLosPatosAssault,completeFreshAndesPreparation} from './fresh-mountain-route.mjs';
import {prepareFreshCuyoDefense,prepareFreshMendozaAssault,startFreshFoundry,prepareFreshArmyFunding,completeFreshArmyFunding} from './fresh-cuyo-route.mjs';
import {recoverFreshNorthernDoctor,reuniteFreshNorthernSquad,prepareFreshSaltaAssault,finishFreshNorthernCampaign} from './fresh-northern-recovery.mjs';
import {tucumanCombatOrder} from './tucuman-driver.mjs';
import {recoveryMendozaOrder} from './recovery-mendoza-driver.mjs';
import {recoveryPortSearchController} from './recovery-port-battery-driver.mjs';
import {stagedBatteryController} from './staged-battery-driver.mjs';
import {cautiousCombatOrder} from './cautious-driver.mjs';
import {fight as fightWithCover} from './cuyo-route-driver.mjs';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote} from '../game/contracts.js';
import {sanLorenzoCombatOrder} from './san-lorenzo-driver.mjs';
import {fightNorthernSector,northernCombatOrder,prepareNorthernSquad} from './northern-route.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {beginFreshCampaign,recoverFreshCapital,prepareFreshNorthernAssault,prepareFreshSanLorenzo,prepareFreshMissionSupport,prepareFreshCordobaAssault,recoverFreshCordobaSurvivors,prepareFreshCordobaDefense,prepareFreshTucumanAssault} from './fresh-campaign-route.mjs';

test('a funded Retiro-only campaign retains paid recovery and real losses through coordinated San Nicolás, San Lorenzo, Córdoba, Tucumán and Salta victories through Yatasto, Mendoza funding and both mountain passes, Ensenada, naval recruitment, Santa Fe, Tucumán and Salta recapture, Jujuy and Humahuaca',()=>{
 const opening=beginFreshCampaign();
 assert.ok(opening.actions>0);assert.ok(opening.casualties.length>0);
 assert.equal(opening.campaign.officer,null);
 const original=structuredClone(opening.campaign),recovered=recoverFreshCapital(opening.campaign);
 assert.deepEqual(opening.campaign,original);
 assert.ok(recovered.campaign.hour>original.hour);
 assert.equal(recovered.campaign.squad.length,6);
 assert.deepEqual([...recovered.patients].sort((a,b)=>a-b),original.squad.filter(id=>{const unit=original.operativeState[id];return unit.alive&&unit.hp<unit.maxHp;}).sort((a,b)=>a-b),'recovery treats the actual wounded survivors, without inventing casualties');
 for(const id of recovered.patients)assert.equal(recovered.campaign.operativeState[id].hp,recovered.campaign.operativeState[id].maxHp);
 for(const id of opening.casualties)assert.equal(recovered.campaign.operativeState[id].alive,false);
 for(const id of recovered.field){assert.ok(recovered.campaign.operativeState[id].alive);assert.ok(recovered.campaign.contracts[id].expiresAt>recovered.campaign.hour);}
 assert.ok(recovered.campaign.resources.treasury>=0);
 assert.equal(recovered.campaign.flags.academy,true);
 assert.deepEqual(Object.keys(recovered.campaign.sectors).filter(id=>recovered.campaign.sectors[id].owner==='patriot').sort(),['buenos_aires','retiro']);
 assert.equal(recovered.campaign.completed,false);
 const deployed=prepareFreshNorthernAssault(recovered);
 const result=fightNorthernSector(deployed,'san_nicolas',{controller:northernCombatOrder});
 assert.equal(result.campaign.sectors.san_nicolas.owner,'patriot');
 for(const id of opening.casualties)assert.equal(result.campaign.operativeState[id].alive,false);
 assert.equal(result.campaign.completed,false);
 const preparationEvents=[],prior=structuredClone(result.campaign),prepared=prepareFreshSanLorenzo(result.campaign,{report:event=>preparationEvents.push(event)});
 assert.deepEqual(result.campaign,prior);
 assert.deepEqual(prepared.squad,[120,111,125,103,140,112]);
 const paid=prepared.squad.reduce((sum,id)=>sum+prepared.contracts[id].paid,0);
 assert.equal(prepared.resources.treasury,prior.resources.treasury-paid-preparationEvents.find(e=>e.event==='freshSanLorenzoPreparation').ammunitionCost);
 assert.ok(prepared.operativeState[112].medkits>prior.operativeState[112].medkits);
 for(const [id,record]of Object.entries(prior.operativeState))if(!record.alive)assert.equal(prepared.operativeState[id].alive,false);
 assert.equal(prepared.flags.sanLorenzo,false);
 assert.equal(prepared.pendingBattle,null);
 assert.equal(prepared.completed,false);
 const supportEvents=[],beforeSupport=structuredClone(prepared),supported=prepareFreshMissionSupport(prepared,{report:event=>supportEvents.push(event)});
 assert.deepEqual(prepared,beforeSupport,'support preparation does not mutate its checkpoint');
 const supportIds=supported.campaign.squads.find(squad=>squad.id===supported.squads[1]).members;
 assert.equal(supportIds.length,6);
 assert.ok(supportIds.every(id=>beforeSupport.recruited.includes(id)),'available paid veterans supply the support squad');
 assert.equal(supported.campaign.resources.treasury,beforeSupport.resources.treasury-supportEvents.reduce((sum,e)=>sum+(e.ammunitionCost??0),0),'active contracts are reused; only the actual cartridge shortage is purchased');
 for(const id of supportIds)assert.deepEqual(supported.campaign.contracts[id],beforeSupport.contracts[id]);
 const mission=dispatchCampaign(supported.campaign,{type:'attack',sector:'san_lorenzo',squadIds:supported.squads});
 assert.equal(mission.lastError,null);assert.equal(mission.pendingBattle.squad.length,12);
 const won=fightNorthernSector(mission,'san_lorenzo',{controller:sanLorenzoCombatOrder});
 assert.equal(won.campaign.flags.sanLorenzo,true);assert.equal(won.campaign.phase,2);
 assert.ok(won.campaign.missionAllies.san_lorenzo.hp>0);assert.equal(won.campaign.defeated,false);
 for(const [id,record]of Object.entries(prior.operativeState))if(!record.alive)assert.equal(won.campaign.operativeState[id].alive,false);
 assert.ok(won.campaign.resources.treasury>=0);assert.equal(won.campaign.completed,false);
 const north=prepareNorthernSquad(won.campaign);
 assert.ok(north.recovery.usedDressings>0);assert.ok(north.campaign.hour>won.campaign.hour);
 for(const id of north.recovery.doctors)if(won.campaign.recruited.includes(id))assert.equal(north.events.some(({action})=>action.type==='recruitCivic'&&action.id===id),false,'retain surviving doctor contracts');
 for(const id of north.recovery.patients)assert.equal(north.campaign.operativeState[id].hp,north.campaign.operativeState[id].maxHp);
 for(const id of [...north.recovery.doctors,...north.recovery.patients]){
  assert.ok(north.campaign.recruited.includes(id),'paid care participants remain under contract through departure');
  assert.ok(north.campaign.contracts[id].expiresAt>north.campaign.hour);
 }
 for(const trip of north.recovery.medicalTrips){assert.ok(trip.quantity>0&&trip.quantity<=20);assert.equal(trip.cost,trip.quantity*trip.unitPrice);assert.ok(trip.endHour>trip.startHour);}
 for(const [id,record]of Object.entries(won.campaign.operativeState))if(!record.alive)assert.equal(north.campaign.operativeState[id].alive,false);
 assert.ok(north.campaign.resources.treasury>=0);
 const cordoba=fightNorthernSector(prepareFreshCordobaAssault(north.campaign,north.recovery.doctors),'cordoba',{executeBattle:(request,previous)=>fightWithCover(request,previous,{scoutCostWeight:.01,avoidCivilians:true,fallbackOrders:true})});
 assert.equal(cordoba.campaign.sectors.cordoba.owner,'patriot');
 for(const [id,record]of Object.entries(north.campaign.operativeState))if(!record.alive)assert.equal(cordoba.campaign.operativeState[id].alive,false);
 assert.ok(cordoba.campaign.resources.treasury>=0);
 assert.equal(cordoba.campaign.completed,false);
 const careBattles=[],careEvents=[],beforeCare=structuredClone(cordoba.campaign);
 const healed=recoverFreshCordobaSurvivors(cordoba.campaign,{report:event=>{if(event.event==='battleFinished')careBattles.push(event);if(event.event==='cordobaCareFinished')careEvents.push(event);}});
 assert.deepEqual(cordoba.campaign,beforeCare);
 assert.equal(healed.location,cordoba.campaign.location,'local medical care does not require a retreat to Retiro');
 assert.ok(healed.hour>cordoba.campaign.hour);
 for(const id of cordoba.campaign.recruited.filter(id=>{const r=cordoba.campaign.operativeState[id];return r.alive&&r.hp<r.maxHp;})){
  if(healed.operativeState[id].alive){assert.equal(healed.operativeState[id].hp,healed.operativeState[id].maxHp);assert.equal(healed.operativeState[id].bleeding,0);}
  else assert.ok(careBattles.some(battle=>battle.units.some(unit=>unit.id===String(id)&&unit.side==='player'&&unit.hp<=0)),`patient ${id} can die only in the actual hospital defense`);
 }
 for(const [id,record]of Object.entries(cordoba.campaign.operativeState))if(!record.alive)assert.equal(healed.operativeState[id].alive,false);
 assert.ok(careEvents[0].doctors.length>0);
 for(const id of careEvents[0].doctors)assert.ok(healed.contracts[id].paid>0,'every physician works under an actual paid contract');
 for(const battle of careBattles){
  assert.equal(battle.status,'victory','care must resolve the real attack before strategic time resumes');
  for(const unit of battle.units.filter(unit=>unit.side==='player'&&unit.hp<=0))assert.equal(healed.operativeState[unit.id].alive,false,'defense casualties remain permanent after care');
 }
 assert.ok(healed.resources.treasury>=0);
 // The real counterattack can arrive during care at another location. Do
 // not wait for a second invasion after that same defense has already won.
 const defense=careBattles.length?{campaign:healed}:fightNorthernSector(prepareFreshCordobaDefense(healed),'cordoba',{controller:cautiousCombatOrder});
 assert.equal(defense.campaign.sectors.cordoba.owner,'patriot');
 assert.equal(defense.campaign.pendingEncounter,null);
 const beforeTucuman=structuredClone(defense.campaign),tucumanReady=prepareFreshTucumanAssault(defense.campaign,{artillerySupport:true});
 assert.deepEqual(defense.campaign,beforeTucuman);
 const survivors=beforeTucuman.recruited.filter(id=>beforeTucuman.operativeState[id].alive&&!beforeTucuman.operativeState[id].captured);
 for(const id of survivors){
  assert.ok(tucumanReady.recruited.includes(id),'surviving contracts must remain active during recovery');
  assert.ok(tucumanReady.operativeState[id].alive,'preparation must stabilize actual survivors');
  assert.ok(tucumanReady.pendingBattle.squad.some(unit=>unit.id===id),'every available survivor joins the coordinated assault');
 }
 for(const unit of tucumanReady.pendingBattle.squad){assert.equal(unit.hp,unit.maxHp);assert.equal(unit.bleeding,0);assert.ok(unit.loaded>0,'finish reloading before the march');assert.ok(unit.ammo>0,'carry compatible reserve ammunition');}
 for(const [id,record]of Object.entries(beforeTucuman.operativeState))if(!record.alive)assert.equal(tucumanReady.operativeState[id].alive,false);
 const tucuman=fightNorthernSector(tucumanReady,'tucuman',{controller:coastalBatteryController(enterSector(tucumanReady.pendingBattle,tucumanReady.sectorStates.tucuman),{sharedArtillerySight:true})});
 assert.equal(tucuman.campaign.sectors.tucuman.owner,'patriot');
 assert.ok(tucuman.campaign.resources.treasury>=0);
 assert.equal(tucuman.campaign.completed,false);
 const reliefBattles=[],relief=recoverFreshNorthernDoctor(tucuman.campaign,{report:event=>{if(event.event==='battleFinished')reliefBattles.push(event);}});
 for(const id of tucuman.campaign.recruited.filter(id=>{const r=tucuman.campaign.operativeState[id];return r.alive&&r.hp<r.maxHp;})){
  if(relief.operativeState[id].alive){assert.equal(relief.operativeState[id].hp,relief.operativeState[id].maxHp);assert.equal(relief.operativeState[id].bleeding,0);}
  else assert.ok(reliefBattles.some(battle=>battle.units.some(unit=>unit.id===String(id)&&unit.side==='player'&&unit.hp<=0)),'new deaths must come from the actual hospital defense');
 }
 for(const [id,r]of Object.entries(tucuman.campaign.operativeState))if(!r.alive)assert.equal(relief.operativeState[id].alive,false);
 assert.ok(relief.recruited.includes(10)&&relief.recruited.includes(4)&&relief.recruited.includes(1000));
 // This relief fixture uses the legacy questionnaire, which still costs 300.
 assert.equal(relief.contracts[1000].paid,300);
 assert.ok(relief.hour>tucuman.campaign.hour);
 const reunited=reuniteFreshNorthernSquad(relief);
 assert.equal(reunited.location,'tucuman');
 assert.ok(reunited.squad.includes(1));assert.ok(reunited.squad.every(id=>reunited.operativeState[id].alive));
 assert.equal(reunited.sectors.cordoba.owner,'patriot');
 for(const [id,r]of Object.entries(relief.operativeState))if(!r.alive)assert.equal(reunited.operativeState[id].alive,false);
 const saltaReady=prepareFreshSaltaAssault(reunited);
 const salta=fightNorthernSector(saltaReady,'salta',{controller:coastalBatteryController(enterSector(saltaReady.pendingBattle,saltaReady.sectorStates.salta),{sharedArtillerySight:true})});
 assert.equal(salta.campaign.sectors.salta.owner,'patriot');
 assert.equal(salta.campaign.completed,false);
 const handoverBattles=[],yatasto=finishFreshNorthernCampaign(salta.campaign,{report:event=>{if(event.event==='battleFinished')handoverBattles.push(event);}});
 assert.equal(yatasto.phase,3);assert.equal(yatasto.missions.yatasto.completed,true);
 for(const id of [1,0,8]){
  if(!salta.campaign.operativeState[id].alive){assert.equal(yatasto.operativeState[id].alive,false,'earlier battle deaths remain permanent');continue;}
  if(yatasto.operativeState[id].alive)assert.ok(yatasto.squad.includes(id));
  else assert.ok(handoverBattles.some(battle=>battle.units.some(unit=>unit.id===String(id)&&unit.side==='player'&&unit.hp<=0)),'new handover losses must come from actual combat');
 }
 assert.ok(yatasto.squad.every(id=>yatasto.operativeState[id].alive));assert.equal(yatasto.completed,false);
 const cuyoPreparation=[],stagedCuyo=prepareFreshCuyoDefense(yatasto,{report:event=>cuyoPreparation.push(event)});
 const paidDefender=cuyoPreparation.find(event=>event.event==='cuyoPaidDefender');assert.ok(paidDefender);
 assert.ok(paidDefender.price>0&&paidDefender.arrivalHour>yatasto.hour);
 assert.ok(paidDefender.contractExpiresAt>paidDefender.arrivalHour);
 const defended=stagedCuyo.pendingBattle?fightNorthernSector(stagedCuyo,'cordoba',{controller:tucumanCombatOrder}):{campaign:stagedCuyo};
 assert.equal(defended.campaign.sectors.cordoba.owner,'patriot');
 const saltaRetreat=defended.campaign.encounterHistory.some(event=>event.sector==='salta'&&event.outcome==='retreat'&&event.hour>=yatasto.hour);
 assert.equal(defended.campaign.sectors.salta.owner,saltaRetreat?'royalist':yatasto.sectors.salta.owner);
 // Preserve actual casualties; a changed approach must not require a named death.
 for(const [id,record]of Object.entries(yatasto.operativeState))if(!record.alive)assert.equal(defended.campaign.operativeState[id].alive,false);
 for(const id of stagedCuyo.squad)assert.equal(stagedCuyo.operativeState[id].hp,stagedCuyo.operativeState[id].maxHp);
 assert.equal(defended.campaign.completed,false);
 const mendozaPreparation=[],mendozaReady=prepareFreshMendozaAssault(defended.campaign,{report:event=>mendozaPreparation.push(event)});
 const reserveBattery=mendozaPreparation.find(event=>event.event==='mendozaReserveBattery');assert.ok(reserveBattery);
 assert.ok(reserveBattery.cost>0,'the reserve pays for its actual artillery');
 assert.ok(reserveBattery.field.length>0&&reserveBattery.support.length>0);
 for(const id of [...reserveBattery.field,...reserveBattery.support])assert.ok(defended.campaign.recruited.includes(id),'Mendoza uses the actual surviving reserves');
 assert.ok(mendozaReady.pendingBattle.squad.every(unit=>mendozaReady.operativeState[unit.id].alive));
 assert.ok(mendozaReady.pendingBattle.squad.every(unit=>mendozaReady.contracts[unit.id].expiresAt===null||mendozaReady.contracts[unit.id].expiresAt>mendozaReady.hour));
 const mendoza=fightNorthernSector(mendozaReady,'mendoza',{controller:recoveryMendozaOrder});
 assert.equal(mendoza.campaign.sectors.mendoza.owner,'patriot');
 let supportReleased=mendoza.campaign;
 const canRelease=supportReleased.squad.some(id=>id!==paidDefender.id&&supportReleased.operativeState[id].alive&&supportReleased.operativeState[id].hp>=15);
 if(supportReleased.recruited.includes(paidDefender.id)&&canRelease){
  const beforeRelease=supportReleased;
  supportReleased=dispatchCampaign(supportReleased,{type:'dismiss',id:paidDefender.id});
  assert.equal(supportReleased.lastError,null);
  assert.equal(supportReleased.resources.treasury,beforeRelease.resources.treasury);
  for(const key of ['hp','bleeding','bandaged','alive'])assert.equal(supportReleased.operativeState[paidDefender.id][key],beforeRelease.operativeState[paidDefender.id][key]);
  for(const id of beforeRelease.recruited.filter(id=>id!==paidDefender.id))assert.deepEqual(supportReleased.operativeState[id],beforeRelease.operativeState[id]);
  assert.equal(supportReleased.operativeState[paidDefender.id].alive,true);
  assert.equal(supportReleased.recruited.includes(paidDefender.id),false);
 }else if(!supportReleased.recruited.includes(paidDefender.id))assert.equal(supportReleased.operativeState[paidDefender.id].alive,false,'a missing specialist must be a permanent battle casualty');
 else assert.ok(supportReleased.operativeState[paidDefender.id].alive,'the sole field survivor stays in service until command can rejoin');
 const foundryEvents=[],foundry=startFreshFoundry(supportReleased,{report:event=>foundryEvents.push(event)});
 for(const receipt of foundryEvents.filter(event=>event.event==='foundrySpecialistReleased')){
  assert.ok(receipt.price>0&&receipt.hour>=mendoza.campaign.hour);
  assert.deepEqual(receipt.founders,[2,7]);
  for(const id of receipt.founders)assert.ok(foundry.recruited.includes(id)&&foundry.operativeState[id].alive);
  assert.ok(foundry.recruited.includes(receipt.leader)&&foundry.contracts[receipt.leader].expiresAt===null);
  assert.equal(foundry.recruited.includes(receipt.id),false);
  assert.equal(foundry.operativeState[receipt.id].alive,true);
 }
 assert.equal(foundry.flags.foundry,true);assert.equal(foundry.flags.emancipation,true);
 assert.ok(foundry.recruited.includes(2)&&foundry.recruited.includes(7));
 assert.equal(foundry.phase,3);assert.equal(foundry.completed,false);
 const initialArmy=prepareFreshArmyFunding(foundry);
 const army=completeFreshArmyFunding(initialArmy);
 for(const id of foundry.recruited.filter(id=>foundry.operativeState[id].alive&&foundry.operativeState[id].location==='mendoza')){
  if(army.operativeState[id].alive)assert.equal(army.operativeState[id].hp,army.operativeState[id].maxHp,'actual foundry survivors finish recovery');
 }
 for(const [id,record]of Object.entries(foundry.operativeState))if(!record.alive)assert.equal(army.operativeState[id].alive,false);
 const pieces=state=>[...Object.values(state.artilleryDepots??{}).flat(),...Object.values(state.sectorStates??{}).flatMap(scene=>scene.artillery??[])].filter(gun=>gun.side==='player');
 assert.equal(initialArmy.flags.armyFunded,false);assert.ok(ownedArtilleryCount(initialArmy)>=2);
 assert.equal(army.flags.armyFunded,true);assert.ok(ownedArtilleryCount(army)>=3);
 for(const gun of pieces(initialArmy))assert.deepEqual(storedArtilleryRecord(pieces(army).find(actual=>actual.id===gun.id)),storedArtilleryRecord(gun),'funding preserves each existing piece and its finite load');
 assert.equal(army.phase,3);assert.equal(army.completed,false);
 const passReady=prepareFreshUspallataAssault(army,{guns:3});
 const pass=fightNorthernSector(passReady,'uspallata',{controller:coastalBatteryController(enterSector(passReady.pendingBattle,passReady.sectorStates.uspallata),{sharedArtillerySight:true})});
 assert.equal(pass.campaign.sectors.uspallata.owner,'patriot');
 for(const [id,record]of Object.entries(army.operativeState))if(!record.alive)assert.equal(pass.campaign.operativeState[id].alive,false);
 const passRecovery=recoverFreshUspallata(pass.campaign);
 assert.equal(passRecovery.phase,3);assert.equal(passRecovery.completed,false);
 for(const [id,record]of Object.entries(pass.campaign.operativeState))if(!record.alive)assert.equal(passRecovery.operativeState[id].alive,false);
 for(const id of pass.campaign.recruited.filter(id=>pass.campaign.operativeState[id].alive&&pass.campaign.operativeState[id].location==='uspallata')){assert.equal(passRecovery.operativeState[id].alive,true);assert.equal(passRecovery.operativeState[id].hp,passRecovery.operativeState[id].maxHp);}
 const patosPreparation=[],beforePatos=structuredClone(passRecovery),patosReady=prepareFreshLosPatosAssault(passRecovery,{report:event=>patosPreparation.push(event)});
 assert.deepEqual(passRecovery,beforePatos,'mountain preparation does not mutate its input');
 const returnedKit=patosPreparation.filter(event=>event.event==='mountainReturnedKit');
 assert.ok(returnedKit.length>0,'rehired field replacements collect their finite local returned kit');
 for(const receipt of returnedKit){
  assert.equal(receipt.remaining,receipt.sourceCount-1,'each actual kit source is debited once');
  const unit=patosReady.pendingBattle.squad.find(op=>op.id===receipt.operativeId);
  assert.ok(unit);
  if(receipt.slot==='blade')assert.equal(unit.blade,receipt.record.weapon);
  else assert.deepEqual(patosReady.operativeState[receipt.operativeId][receipt.slot],receipt.record);
 }
 const daylight=patosPreparation.find(event=>event.event==='mountainDaylightStaging');
 assert.ok(daylight.hour>=daylight.arrivalHour&&daylight.hour-daylight.arrivalHour<24);
 assert.ok(patosReady.hour%24>=6&&patosReady.hour%24<=10);
 for(const id of daylight.field)assert.ok(patosReady.contracts[id].expiresAt===null||patosReady.contracts[id].expiresAt>patosReady.hour,'every arriving fighter remains in paid service');
 const patos=fightNorthernSector(patosReady,'los_patos',{controller:stagedBatteryController()});
 assert.equal(patos.campaign.sectors.los_patos.owner,'patriot');
 const andesEvents=[],beforeAndes=structuredClone(patos.campaign),andes=completeFreshAndesPreparation(patos.campaign,{report:event=>andesEvents.push(event)});
 assert.deepEqual(patos.campaign,beforeAndes);
 const handover=andesEvents.find(event=>event.event==='andesCommandHandover');assert.ok(handover);
 assert.ok(andes.recruited.includes(handover.envoy)&&andes.operativeState[handover.envoy].alive);
 for(const receipt of andesEvents.filter(event=>event.event==='andesPaidEnvoy')){
  assert.ok(receipt.price>0&&receipt.arrivalHour>=receipt.hiredHour);
  assert.ok(receipt.contractExpiresAt>receipt.arrivalHour);
  assert.equal(andes.operativeState[receipt.id].location,'mendoza');
 }
 for(const returned of handover.returned){assert.equal(returned.alive,true);assert.equal(andes.operativeState[returned.id].location,'mendoza');}
 // A victory can retain more soldiers than the next recruitment column fits.
 // Keep the overflow in a real local squad, leaving one place beside command.
 let coastalColumn=andes;
 const commandSquad=andes.activeSquadId,overflow=andes.squad.filter(id=>id!==57).slice(4);
 if(overflow.length){
  coastalColumn=dispatchCampaign(coastalColumn,{type:'createSquad',name:'Reserva de Mendoza',ids:overflow,sector:'mendoza'});
  assert.equal(coastalColumn.lastError,null);
  const reserve=coastalColumn.squads.find(q=>q.id===coastalColumn.activeSquadId);
  assert.deepEqual(reserve.members,overflow);assert.equal(reserve.location,'mendoza');
  coastalColumn=dispatchCampaign(coastalColumn,{type:'selectSquad',id:commandSquad});assert.equal(coastalColumn.lastError,null);
  assert.deepEqual(coastalColumn.operativeState,andes.operativeState,'forming the reserve does not move, heal or replace a survivor');
  assert.deepEqual(coastalColumn.loadouts,andes.loadouts);assert.deepEqual(coastalColumn.contracts,andes.contracts);
  assert.equal(coastalColumn.resources.treasury,andes.resources.treasury);assert.equal(coastalColumn.hour,andes.hour);assert.equal(coastalColumn.secondOfHour,andes.secondOfHour);
 }
 const coastal=prepareFreshCoastalCommand(coastalColumn);assert.equal(coastal.location,'retiro');assert.ok(coastal.squad.includes(3));
 const portReady=prepareFreshEnsenadaAssault(coastal);
 const portDeployment=withdrawCommandToRear(enterSector(portReady.pendingBattle,portReady.sectorStates.ensenada),57,'buenos_aires');
 const port=fightNorthernSector(portReady,'ensenada',{deploy:portDeployment,controller:recoveryPortSearchController(portDeployment(enterSector(portReady.pendingBattle,portReady.sectorStates.ensenada,{placement:true})))});
 assert.equal(port.campaign.sectors.ensenada.owner,'patriot');
 assert.equal(port.campaign.operativeState[57].location,'buenos_aires');
 const stabilizedPort=stabilizeFreshPortSurvivors(port.campaign);
 const navy=recruitFreshNavalCommand(rejoinCommandAfterExit(stabilizedPort,57,'ensenada'));assert.equal(navy.completed,false);
 const restedNavy=recoverFreshPort(navy);
 const portSurvivors=navy.recruited.filter(id=>navy.operativeState[id].alive&&['ensenada','buenos_aires'].includes(navy.operativeState[id].location));
 for(const id of portSurvivors){assert.ok(restedNavy.operativeState[id].alive);assert.equal(restedNavy.operativeState[id].bleeding,0);assert.equal(restedNavy.operativeState[id].hp,restedNavy.operativeState[id].maxHp);}
 let blockade={campaign:restedNavy};const blockadeCasualties=[];
 // A stationed naval force can block a city whose flag is still friendly.
 if(restedNavy.blockade||restedNavy.sectors.buenos_aires.owner!=='patriot'){
  const assembly=[],blockadeReady=prepareFreshBlockadeAssault(restedNavy,{prepareAffordableSupport:true,report:event=>assembly.push(event)});
  const support=assembly.find(event=>event.event==='earlyPaidReadiness');assert.ok(support);assert.equal(support.support.length,6);
  for(const id of support.support){const row=support.field.find(unit=>unit.id===id);assert.equal(row.quote,contractQuote(blockadeReady,rosterFor(blockadeReady).find(op=>op.id===id),'day').price);assert.ok(row.quote>0&&row.morale>=50);assert.equal(row.energy,100);assert.equal(row.fatigue,0);assert.ok(blockadeReady.contracts[id].expiresAt>blockadeReady.hour);}
  for(const receipt of assembly.filter(event=>event.event==='coastalSupportHired')){assert.ok(receipt.price>0);assert.equal(receipt.treasuryAfter,receipt.treasuryBefore-receipt.price,'each replacement pays its actual public hiring quote');}
  for(const receipt of assembly.filter(event=>event.event==='earlyFiniteClothing')){assert.equal(receipt.remaining,receipt.sourceCount-1);assert.deepEqual(blockadeReady.operativeState[receipt.operativeId][receipt.slot],receipt.record);}
  blockade=fightNorthernSector(blockadeReady,'buenos_aires',{controller:coastalBatteryController(enterSector(blockadeReady.pendingBattle,blockadeReady.sectorStates.buenos_aires),{sharedArtillerySight:true})});
  blockadeCasualties.push(...blockade.summary.units.filter(unit=>unit.side==='player'&&unit.hp<=0&&restedNavy.operativeState[unit.id]?.alive).map(unit=>Number(unit.id)));
  assert.ok(blockadeCasualties.length>0,'the actual blockade relief records permanent battle losses');
  for(const id of blockadeCasualties)assert.equal(blockade.campaign.operativeState[id].alive,false);
 }
 assert.equal(blockade.campaign.blockade,false);
 assert.equal(blockade.campaign.operativeState[57].alive,true);
 for(const [id,record]of Object.entries(restedNavy.operativeState))if(!record.alive)assert.equal(blockade.campaign.operativeState[id].alive,false);
 const santaFePreparation=[],santaFeReady=prepareFreshSantaFeAssault(blockade.campaign,{includeLightGun:true,report:event=>santaFePreparation.push(event)});
 const lightIssue=santaFePreparation.find(event=>event.event==='freshSantaFeLightIssued');assert.ok(lightIssue);assert.equal(lightIssue.after,lightIssue.before-1);
 // Keep the real two-person crews beside their purchased guns. Command
 // remains in the legal arrival lane while the five field soldiers advance.
 const deploySantaFe=start=>{
  let battle=start;const model=sectorDeploymentModel(battle),guns=battle.artillery.filter(g=>g.side==='player'&&!g.stationed),heavy=guns.filter(g=>g.type==='bronze4'),light=guns.find(g=>g.type==='swivel'),taken=new Set();
  assert.equal(heavy.length,2);assert.ok(light);
  const field=start.units.filter(unit=>unit.side==='player'&&unit.id!=='57'&&unit.hp>=15&&!unit.unconscious&&!unit.routed).sort((a,b)=>(b.strength+b.mechanical+b.explosives)-(a.strength+a.mechanical+a.explosives)||a.id.localeCompare(b.id));
  assert.equal(field.length,5,'the real five-person field column crews its purchased guns');
  const plan=[[field[0].id,heavy[0]],[field[1].id,heavy[0]],[field[2].id,heavy[1]],[field[3].id,heavy[1]],[field[4].id,light],['57',{x:0,y:heavy[0].y+4}]];
  for(const [id,gun]of plan){
   const unit=model.units.find(u=>u.id===id);assert.ok(unit);
   const point=model.entryCells[unit.edge].filter(p=>!taken.has(`${p.x},${p.y}`)).sort((a,b)=>Math.hypot(a.x-gun.x,a.y-gun.y)-Math.hypot(b.x-gun.x,b.y-gun.y)||a.y-b.y||a.x-b.x)[0];assert.ok(point);
   battle=sectorDeploymentAction(battle,{type:'placeDeployment',unitIds:[id],x:point.x,y:point.y});assert.equal(battle.lastError,null);taken.add(`${point.x},${point.y}`);
  }
  battle=sectorDeploymentAction(battle,{type:'confirmDeployment'});assert.equal(battle.lastError,null);return battle;
 };
 const santaFe=fightNorthernSector(santaFeReady,'santa_fe',{controller:heavyContactCrewController(),deploy:deploySantaFe,report:r=>console.log(JSON.stringify(r))});
 assert.equal(santaFe.campaign.sectors.santa_fe.owner,'patriot');assert.ok(santaFe.campaign.operativeState[57].alive);
 assert.equal(santaFe.campaign.completed,false);
 // The later naval occupation can block the road even while the city flag
 // remains friendly. Clear it with the real living rear guard and field crew.
 let returnStart=santaFe.campaign;
 if(returnStart.blockade){
  const relief=prepareRecoveryCapitalRelief(returnStart,{report:r=>console.log(JSON.stringify({event:r.event,hour:r.campaign?.hour,treasury:r.campaign?.resources.treasury}))});
  // Six paid soldiers use their actual arrival edges and three owned guns.
  // Choose from the public arrival cells without consulting enemy positions.
  const deployRelief=start=>{
   let battle=start;const model=sectorDeploymentModel(battle),taken=new Set();assert.ok(model);
   const guns=battle.artillery.filter(g=>g.side==='player'&&!g.stationed);
   assert.equal(model.units.length,6);assert.equal(guns.length,3);
   for(const [i,unit]of model.units.entries()){
    const gun=guns[Math.floor(i/2)],point=model.entryCells[unit.edge].filter(p=>!taken.has(`${p.x},${p.y}`)).sort((a,b)=>Math.hypot(a.x-gun.x,a.y-gun.y)-Math.hypot(b.x-gun.x,b.y-gun.y)||a.x-b.x||a.y-b.y)[0];assert.ok(point);
    battle=sectorDeploymentAction(battle,{type:'placeDeployment',unitIds:[unit.id],x:point.x,y:point.y});assert.equal(battle.lastError,null);taken.add(`${point.x},${point.y}`);
   }
   battle=sectorDeploymentAction(battle,{type:'confirmDeployment'});assert.equal(battle.lastError,null);return battle;
  };
  const deployedRelief=deployRelief(enterSector(relief.pendingBattle,relief.sectorStates.buenos_aires,{placement:true}));
  returnStart=fightNorthernSector(relief,'buenos_aires',{controller:coastalBatteryController(deployedRelief,{sharedArtillerySight:true}),deploy:deployRelief}).campaign;
 }
 assert.equal(returnStart.blockade,false);
 const {recaptured,returnedSalta,jujuy,humahuacaReady,humahuaca,deadline}=continuePaidSurvivorNorthernRoute(returnStart,{report:r=>console.log(JSON.stringify({event:r.event,hour:r.campaign?.hour,treasury:r.campaign?.resources.treasury}))});
 assert.equal(recaptured.campaign.sectors.tucuman.owner,'patriot');assert.equal(recaptured.campaign.defeated,false);
 assert.ok(recaptured.campaign.operativeState[57].alive);
 for(const [id,record]of Object.entries(santaFe.campaign.operativeState))if(!record.alive)assert.equal(recaptured.campaign.operativeState[id].alive,false);
 assert.equal(returnedSalta.campaign.sectors.salta.owner,'patriot');
 assert.equal(jujuy.campaign.sectors.jujuy.owner,'patriot');assert.equal(jujuy.campaign.operativeState[57].alive,true);
 for(const [id,record]of Object.entries(returnedSalta.campaign.operativeState))if(!record.alive)assert.equal(jujuy.campaign.operativeState[id].alive,false);
 assert.equal(jujuy.campaign.completed,false);
 assert.equal(humahuacaReady.operativeState[57].location,'cordoba');
 assert.equal(humahuacaReady.sectors.tucuman.owner,'patriot');assert.equal(humahuacaReady.sectors.salta.owner,'patriot');
 assert.deepEqual(humahuacaReady.pendingBattle.artillery.filter(gun=>!gun.stationed).map(gun=>gun.type),['field8','swivel']);
 for(const unit of humahuacaReady.pendingBattle.squad){assert.ok(jujuy.campaign.operativeState[unit.id].alive);assert.equal(unit.hp,unit.maxHp);assert.equal(unit.bleeding,0);}
 assert.ok(humahuaca.campaign.hour<=deadline,'the original prepaid deadline covers the complete northern continuation');
 assert.equal(humahuaca.campaign.sectors.humahuaca.owner,'patriot');
 assert.equal(humahuaca.campaign.operativeState[57].alive,true);
 for(const [id,record]of Object.entries(jujuy.campaign.operativeState))if(!record.alive)assert.equal(humahuaca.campaign.operativeState[id].alive,false);
 assert.equal(humahuaca.campaign.defeated,false);

 assert.equal(returnedSalta.campaign.defeated,false);assert.equal(returnedSalta.campaign.completed,false);
 assert.equal(returnedSalta.campaign.operativeState[57].alive,true);
 for(const id of blockadeCasualties)assert.equal(returnedSalta.campaign.operativeState[id].alive,false,'each actual blockade casualty remains dead');
 assert.ok(Object.values(returnedSalta.campaign.operativeState).filter(u=>!u.alive).length>=Object.values(recaptured.campaign.operativeState).filter(u=>!u.alive).length);
 for(const [id,record]of Object.entries(recaptured.campaign.operativeState))if(!record.alive)assert.equal(returnedSalta.campaign.operativeState[id].alive,false);
 for(const [id,record]of Object.entries(santaFe.campaign.operativeState))if(!record.alive)assert.equal(recaptured.campaign.operativeState[id].alive,false);
 for(const [id,record]of Object.entries(navy.operativeState))if(!record.alive)assert.equal(santaFe.campaign.operativeState[id].alive,false);
 for(const [id,record]of Object.entries(andes.operativeState))if(!record.alive)assert.equal(navy.operativeState[id].alive,false);
 assert.equal(andes.phase,4);assert.ok(andes.recruited.includes(57));assert.equal(andes.completed,false);
 assert.ok(['mendoza','uspallata','los_patos'].every(id=>andes.sectors[id].owner==='patriot'&&andes.sectors[id].fort>=1));
 for(const unit of patos.summary.units.filter(u=>u.side==='player'&&u.hp<=0))assert.equal(andes.operativeState[unit.id].alive,false,'actual mountain casualties remain dead');
 assert.ok(andes.squad.some(id=>andes.operativeState[id].alive&&id!==57),'a living envoy accompanies the recruited commander');
 for(const [id,record]of Object.entries(passRecovery.operativeState))if(!record.alive)assert.equal(andes.operativeState[id].alive,false);
 for(const [id,record]of Object.entries(army.operativeState))if(!record.alive)assert.equal(passRecovery.operativeState[id].alive,false);
 for(const [id,record]of Object.entries(foundry.operativeState))if(!record.alive)assert.equal(army.operativeState[id].alive,false);
 for(const [id,record]of Object.entries(defended.campaign.operativeState))if(!record.alive)assert.equal(foundry.operativeState[id].alive,false);
 for(const [id,record]of Object.entries(yatasto.operativeState))if(!record.alive)assert.equal(defended.campaign.operativeState[id].alive,false);
 for(const [id,record]of Object.entries(salta.campaign.operativeState))if(!record.alive)assert.equal(yatasto.operativeState[id].alive,false);
 for(const [id,record]of Object.entries(reunited.operativeState))if(!record.alive)assert.equal(salta.campaign.operativeState[id].alive,false);
 assert.equal(reunited.flags.partisanSupply,true);
 assert.deepEqual(Object.keys(reunited.resources),['treasury']);
 for(const id of reunited.squad)assert.equal(reunited.operativeState[id].location,'tucuman');
 for(const [id,record]of Object.entries(relief.operativeState))if(!record.alive)assert.equal(reunited.operativeState[id].alive,false);
 for(const [id,record]of Object.entries(tucuman.campaign.operativeState))if(!record.alive)assert.equal(relief.operativeState[id].alive,false);
 for(const [id,record]of Object.entries(defense.campaign.operativeState))if(!record.alive)assert.equal(tucuman.campaign.operativeState[id].alive,false);
 for(const [id,record]of Object.entries(healed.operativeState))if(!record.alive)assert.equal(defense.campaign.operativeState[id].alive,false);
 for(const [id,record]of Object.entries(cordoba.campaign.operativeState))if(!record.alive)assert.equal(healed.operativeState[id].alive,false);
});
