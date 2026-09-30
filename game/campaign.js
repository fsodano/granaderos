import {isSectorSupplied} from './sector-income.js';
import {AMMUNITION_FAMILIES} from './ammunition-families.js';
import {changeMerchantCash} from './equipment-merchants.js';
import {equipmentKey} from './equipment-catalog.js';
import {unloadOwnedCampaignAmmunition,selectCampaignAmmunitionLoad,migrateAmmunitionCustody,validateAmmunitionCustody,restockAmmunitionShops,prepareCampaignAmmunition,retainReturnedAmmunition,moveCampaignAmmunition,unloadCampaignWeapon,carriedAmmunition,ammoResourceKey,initialAmmunitionStock,migrateCampaignAmmunition,syncCampaignAmmunition,validateCampaignAmmunition,syncCarriedAmmunition} from './campaign-ammunition.js';
import {removeIgnitionSupplies,validateStoredAmmo} from './ammo-types.js';
import {personalPockets,pocketChangeReason,POCKET_FULL} from './personal-pockets.js';
import {sellArtillery,repurchaseArtillery,validateArtilleryMerchants} from './artillery-trading.js';
import {dispatchArtilleryTransport,deliverArtilleryTransfers,validateArtilleryTransport,queueArtilleryTransport,deliverTransportedArtillery} from './artillery-transport.js';
import {validateCampaignArtilleryProfiles,artillerySaveReplacer,restoreArtilleryReferences} from './artillery-definitions.js';
import {artillerySupplyQuote} from './artillery-supply.js';
import {migrateArtilleryState,prepareSectorArtillery,validateArtilleryReport,settleSectorArtillery,validateCampaignArtillery,ownedArtilleryCount,validateArtilleryDeployment,supplyStationedArtillery} from './campaign-artillery.js';
import {validateCampaignPatrol} from './militia-patrol-rules.js';
import {redistributeMilitia} from './militia-distribution.js';
import {validMilitiaArrival} from './militia-arrival.js';
import {validMilitiaExperience} from './militia-experience.js';
import {workshopServiceQuote} from './workshop-service.js';
import {CARE_ASSIGNMENTS,careAssignmentBusy,assignMedicalCare,advanceMedicalCare,advanceMilitaryWounds,validateMedicalCare,medicalSupplyQuote,MEDICAL_KIT_PRICE,migrateMedicalCare,returnMedicalCare} from './medical-care.js';
import {enforceHistoricalLoss} from './historical-loss.js';
import {previousDeploymentScene,withoutPreviousCasualties} from './military-remains.js';
import {completedTacticalVictory} from './battle-outcome.js';
import {foundryFor} from './campaign-foundry.js';
import {campaignRole,campaignRoleActive,foundryReason} from './campaign-roles.js';
import {campaignStory,campaignChapterIndex,advanceCampaignStory,validateCampaignProgress} from './campaign-story.js';
import {importRulesFor,importOrderReason} from './campaign-imports.js';
import {headquartersFor,headquartersName,campaignChapters} from './campaign-headquarters.js';
import {campaignRules} from './campaign-rules.js';
import {synchronizeDialogueMovements,validateDialogueMovements} from './dialogue-movement.js';
import {updateContentQuests,nextContentQuestDeadline} from './content-quests.js';
import {dialogueForNPC,chooseDialogue,validateSavedDialogues} from './content-dialogue.js';
import {advanceUnloadedCivilians,nextUnloadedCivilianDeath,migrateResidentWounds,resumeCivilianServiceReturns,hasPendingCivilians,acknowledgeCivilians,transferCivilian,validateCampaignCivilians,migrateCampaignCivilians,migrateCampaignCivilianSupplies} from './campaign-civilians.js';
import {synchronizeCampaignPresence,nextCampaignPresenceChange,validateCampaignPresence,acknowledgeSuccessionDeaths} from './campaign-presence.js';
import {isContractOperative,gainsExperience,characterForOperative,isWorldCharacter} from './content-character-ids.js';
import {campaignPlace,worldCell,locationId,validWorldLocation,worldOwner,cellTravelPlan,cellTravelReason,cellStepHours,adjacentCells} from './world-cells.js';
import {compactCellScene,expandCellScene,cellSceneSaveReplacer} from './cell-scene-storage.js';
import {validateForceWeapon} from './content-force-equipment.js';
import {weaponSaveReplacer,weaponSpecification,validateWeaponCarrier,validateWeaponReferences,setWeaponDefinition,weaponRecord} from './weapon-definition.js';
import {usesAuthoredEquipment,addArmoryStock,equipArmoryItem,validateArmoryItems} from './armory-items.js';
import {hiringArrivalReason,hiringArrivalOptions,pendingHire,hireArrivalOrder,advanceHireArrivals,redirectHire,cancelHireArrival,validateHireArrivals} from './hiring-arrivals.js';
import {attachCampaignContent,validateCampaignContent} from './campaign-content.js';
import {MISSION_SCENES,YATASTO_NPCS,missionContacts,missionStatus,talkMission,sanLorenzoAlly,validateMissions} from './missions.js';
import {refreshEnemyIntelligence,recordEnemyPresence} from './enemy-intelligence.js';
import {tradeArtillery} from './artillery-trade.js';
import {exchangeMerchantEquipment} from './merchant-exchange.js';
import {enterSector} from './world.js';
import {settlePrisonerEscapes} from './prisoner-escape-return.js';
import {settleDetentionReturn} from './campaign-detention.js';
import {advanceDetentionCare} from './detention-care.js';
import {detentionManifest} from './detention.js';
import {restoredCaptiveContract} from './prisoner-custody.js';
import {escortArrival} from './quest-escort.js';
import {missionAssaultManifest} from './mission-assault.js';
import {ammunitionSource} from './ammunition.js';
import {purchaseGrenades,clearCarriedLoading,setCarriedLoading,isImportedEquipment,deliverEquipmentShipments,validEquipmentShipments,EQUIPMENT_CATALOG,refillCost,firearmRepairCost,deployedArtillery,migrateEquipment,validateStoredFittingFields,advanceMerchants,merchantStatus,addEquipment,storeEquipment,takeEquipment,storedEquipmentMetadata,resaleBreakdown,returnEquipment,validateEquipment,equipmentInventoryUsage,allocateEquipmentAmmo,equipmentCatalogItem,equipmentLabel,medicalSupplyStock,ammunitionStock,AMMUNITION_PRICE,AMMUNITION_MERCHANT_CAP,validateEquipmentOwnership,USED_EQUIPMENT_LIMIT,usedEquipmentOffers,artillerySelectionReason,equipmentCatalog} from './equipment.js';
import {regionalConditions,validateRegionalWeather} from './regional-weather.js';
import {issueInitialOutfit} from './outfits.js';
import {hasAuthoredDialogue,dialogueOptions,dialogueReason,ambientReply} from './npc-dialogue.js';
import {validatePocketOrder} from './inventory-pockets.js';
import {recordLogisticsNotice,validateLogisticsNotice,migrateLogisticsAttention,collectLogisticsAttention,reconcileLogisticsAttention} from './logistics-attention.js';
import {moveSectorItem} from './sector-inventory.js';
import {handLayout} from './hand-layout.js';
import {initialContractAttention,migrateContractAttention,reconcileContractAttention,collectContractAttention,validateContractAttention} from './contract-attention.js';
import {totalSectorIncome} from './sector-income.js';
import {queueSquadTravel,cancelSquadTravel,resumeSquadTravel,advanceSquadTravel,validateSquadTravel,readyAssaultSquads,arriveForAssault,validateAssaultDeployment} from './squad-travel.js';
import {gainFatigue,needsCollapseRecovery} from './fatigue.js';
import {advanceMarchFatigue,tooTiredToMarch} from './march-fatigue.js';
import {assertSaveSize} from './save-limits.js';
import {dailyIncome,artilleryCount,collectSectorCash} from './economy.js';
import {speechFor} from './characters.js';
import {prepareGarrison,returnGarrison,validGarrisons,reserveMilitiaTrainees,returnMilitiaTrainees,validMilitiaTrainees,advanceMilitiaWounds} from './garrison.js';
import {tradeQuote,applyPolicy,dailyPolitics,validatePolitics,policyStatus} from './politics.js';
import {questForNPC,validateQuests,validateQuestFailures,validateQuestGifts,NPC_QUESTS} from './quests.js';
import {recordCityLoyalty,validCityLoyaltyEvents} from './cities.js';
import {contractQuote,contractStatus,migrateContracts} from './contracts.js';
import {validateTraining,TRAINABLE_SKILLS} from './skill-training.js';
import {militiaCourse,militiaAssignment,MILITIA_COHORT,MILITIA_LIMIT,militiaEligibility} from './militia.js';
import {ENCOUNTERS,encounterDefinitions,canRecruitEncounter,encounterForOperative,encountersFor,encounterRequirements,encounterHireTerms} from './encounters.js';
import {initialHorseState,migrateHorseState,applyHorseAction,mountForOperative} from './horses.js';
import {fieldCapable,canSee} from './tactical.js';
import {prepareDeploymentExits,planDeploymentReturn,recordStrategicArrival,migrateDeploymentReturns,validateDeploymentReturnState} from './deployment-return.js';
import {validateSectorExits} from './tactical-exits.js';
import {WORK_ASSIGNMENTS,TOOLKIT_PRICE,TOOLKIT_POINTS,migrateAssignments,assignWork,advanceAssignments,validateAssignments,militiaAssignmentIssue} from './assignments.js';
import {assignmentStates,migrateAssignmentAttention,validateAssignmentAttention,collectAssignmentAttention,reconcileAssignmentAttention,militiaCompletionAttention,militiaCancellationAttention,sleepAttention} from './assignment-attention.js';
import {migrateMorale,deploymentMorale,returnMorale,recordPayMorale,recordCasualtyMorale,recordBattleMorale,advanceMorale,validateMorale} from './morale.js';
import {migrateEnemyGroups,launchEnemyGroup,advanceEnemyGroups,delayCrossingEnemyGroups,haltEnemyGroupsAt,queueEnemyEncounter,localDefenderIds,localDefenderCount,retreatDestinations,occupyingGroups,recordEnemyGroupResult,validateEnemyGroups} from './enemy-groups.js';
import {setSleep,prepareSleep,finishSleepHour,SLEEP_ISSUE_TEXT} from './sleep.js';
import {autoResolve} from './auto-resolve.js';
import {canCreateSquad,vacantSquad,canReassignOperative,migrateSquads,activeSquad,operativeLocation,operativeInTransit,travelingOperatives,synchronizeSquad,validateSectorSnapshot,validatePersonalInventory} from './squads.js';
import {FITTING_RULES_VERSION} from './weapon-fittings.js';
import {hasWorkshop} from './campaign-headquarters.js';
import {TRANSPORT_NETWORKS} from './transport-network.js';
import {ROYALIST_COMMANDS,NORTHERN_AXIS,coastalRevenue,royalistIntel,mentorDispatch,oppositionFor,campaignEnemyCount} from './narrative.js';
import {rosterFor as baseRosterFor,CIVIC_RECRUITS,civicStatus as baseCivicStatus,createOfficerRecord} from './recruitment.js';
import {OPERATIVES,WEAPONS,CAMPAIGN_SECTORS,FACTIONS,PHASES,RESOURCE_NAMES} from './data.js';
export {MISSION_SCENES,missionStatus} from './missions.js';
export {dailyIncome,incomeSources,incomeSummary} from './economy.js';
export {tradeQuote,policyStatus} from './politics.js';
export {questForNPC,NPC_QUESTS} from './quests.js';
export {contractQuote,contractStatus,CONTRACT_TERMS} from './contracts.js';
export {militiaCourse,militiaAssignment} from './militia.js';
export {ENCOUNTERS,encountersFor} from './encounters.js';
export {activeSquad,operativeLocation} from './squads.js';
export {TRANSPORT_OPTIONS,transferOptions,inventoryAt,cargoWeight} from './logistics.js';
export {EQUIPMENT_CATALOG,armoryInventory,refillCost,firearmRepairCost} from './equipment.js';
export {ROYALIST_COMMANDS,royalistIntel,mentorDispatch} from './narrative.js';
export {CIVIC_RECRUITS} from './recruitment.js';
export function civicStatus(s,id,local=false){return baseCivicStatus(s,id);}
export {OPERATIVES, WEAPONS, CAMPAIGN_SECTORS, FACTIONS, PHASES, RESOURCE_NAMES};
export function rosterFor(s){return baseRosterFor(s).map(o=>{const record=s.operativeState?.[o.id]??{};return {...o,...(s.loadouts?.[o.id]??{}),...(record.ammunitionChoice!==undefined?{ammunitionChoice:record.ammunitionChoice}:{}),...(record.weaponMetadata?{weaponMetadata:record.weaponMetadata}:{}),...(record.bladeMetadata?{bladeMetadata:record.bladeMetadata}:{}),...Object.fromEntries(TRAINABLE_SKILLS.map(skill=>[skill,Math.min(100,(o[skill]??0)+(record.trainedStats?.[skill]??0))])),strength:Math.max(o.strength,Math.min(100,record.strength??o.strength))};});}
export function deploymentCost(s){return prepareCampaignAmmunition(s,rosterFor(s),s.squad,{supplied:isSupplied(s,s.location)}).cost;}
function deploymentOperative(s,id){
  const op=rosterFor(s).find(o=>o.id===id);
  // Stored strength is a legacy floor. New XP can raise the current value
  // above that floor; persistent wounds and supplies still use the record.
  return {...clone(op),...clone(s.operativeState[id]),strength:op.strength};
}
function returnMount(s,id,report){if(!report.mount)return;const horse=s.horseState?.horses.find(h=>h.id===report.mount.id&&h.assignedTo===id&&!h.returned);requireThat(horse,'La montura no pertenece al combatiente.');for(const field of ['stamina','condition']){requireThat(Number.isFinite(report.mount[field])&&report.mount[field]>=0&&report.mount[field]<=100,'El estado de la montura es inválido.');horse[field]=report.mount[field];}}
function returnTraining(s,id,report){validateTraining(report);for(const field of ['trainedStats','skillPractice'])if(report[field]!==undefined)s.operativeState[id][field]=clone(report[field]);}
function removeFromService(s,id){
  s.operativeState[id].assignment='active';s.operativeState[id].asleep=false;s.operativeState[id].sleepCollapsed=false;s.operativeState[id].recoveryHours=0;
  const location=operativeLocation(s,id);s.operativeState[id].location=location;s.recruited=s.recruited.filter(x=>x!==id);s.squad=s.squad.filter(x=>x!==id);for(const squad of s.squads){squad.members=squad.members.filter(x=>x!==id);if(!squad.members.length)delete squad.journey;}
  for(const horse of s.horseState.horses)if(horse.assignedTo===id)horse.assignedTo=null;
  for(const course of s.militiaTraining.filter(t=>t.trainerId===id)){returnMilitiaTrainees(s,course);}s.militiaTraining=s.militiaTraining.filter(t=>t.trainerId!==id);delete s.contracts[id];
}
function signContract(s,op,term){
  requireThat(!s.operativeState[op.id]?.captured,'El combatiente está prisionero; primero liberá su sector.');const quote=contractQuote(s,op,term??'day');requireThat(quote.available,quote.reason);pay(s,{treasury:quote.price});s.contracts[op.id]={kind:quote.permanent?'patriot':'paid',term:term??'day',started:s.hour,expiresAt:quote.expiresAt,paid:quote.price};
  const contact=encounterDefinitions(s).find(n=>n.operativeId===op.id);if(contact)transferCivilian(s,contact);
}
function receiveHire(s,arrival,joinSquad=true){
  const id=arrival.operativeId,op=rosterFor(s).find(o=>o.id===id);
  s.contracts[id]={kind:arrival.permanent?'patriot':'paid',term:arrival.term,started:s.hour,expiresAt:arrival.permanent?null:s.hour+arrival.serviceHours,paid:arrival.paid};
  s.recruited.push(id);issueInitialOutfit(s,id);Object.assign(s.operativeState[id],{location:arrival.destination,arrival:null,residentSector:null,residentScene:null});
  if(joinSquad&&!s.pendingBattle&&s.location===arrival.destination&&s.squad.length<6)s.squad.push(id);
  note(s,`${op.name} llega a ${sector(arrival.destination).name} y comienza su servicio.`);
  if(s.contentCampaign){const line=speechFor(op,'hired');if(line?.trim())note(s,`${op.name}: «${line}»`);}
}
function receiveDueHires(s,joinSquad=true){advanceHireArrivals(s,arrival=>receiveHire(s,arrival,joinSquad));}
const clone = value => JSON.parse(JSON.stringify(value));
const clamp = value => Math.max(-100,Math.min(100,value));
export function campaignDate(s){const day=Math.floor(s.hour/24);return {year:1812+Math.floor((2+Math.floor(day/30))/12),month:(2+Math.floor(day/30))%12+1,day:day%30+1,hour:s.hour%24};}
const sector = id => CAMPAIGN_SECTORS.find(s=>s.id===id);
const random = s => {s.seed=(Math.imul(1664525,s.seed)+1013904223)>>>0;return s.seed/4294967296;};
const note = (s,text) => {s.log.unshift({hour:s.hour,text});s.log=s.log.slice(0,80);};
const requireThat = (test,message) => {if(!test)throw Error(message);};
const pay = (s,cost) => {for(const [key,value] of Object.entries(cost))requireThat(s.resources[key]>=value,`Faltan recursos: ${RESOURCE_NAMES[key]??key} (${value}).`);for(const [key,value] of Object.entries(cost))s.resources[key]-=value;};
const add = (s,values) => {for(const [key,value] of Object.entries(values))s.resources[key]=(s.resources[key]??0)+value;};
const standing = (s,id,value) => {if(id!=='royalists')s.reputation[id]=clamp(s.reputation[id]+value);};

function initializeCampaignSystems(s){
 const roster=rosterFor(s);
 s.horseState??={...initialHorseState(),hour:s.hour};
 migrateMedicalCare(s,roster);migrateAssignments(s,roster);migrateMorale(s,roster);
 migrateAmmunitionCustody(s);migrateEquipment(s);migrateArtilleryState(s);
 migrateEnemyGroups(s);migrateDeploymentReturns(s);migrateAssignmentAttention(s);migrateContractAttention(s);migrateLogisticsAttention(s);
 migrateCampaignAmmunition(s,roster);
 return s;
}
export function initialCampaign(seed=1812,content=null){
  const state={artilleryVersion:1,artilleryCustodyVersion:1,nextArtilleryId:1,civilianState:{version:2,people:{}},hiringArrivals:[],equipmentShipments:[],missions:{},sceneStates:{},missionAllies:{},garrisons:{},nextMilitiaId:20000,quests:{},cityLoyaltyEvents:[],contracts:{},militiaTraining:[],foundMoney:[],economyVersion:2,version:1,seed:seed>>>0,hour:0,phase:0,location:'retiro',activeSquadId:'squad-1',squads:[{id:'squad-1',name:'Primera escuadra',members:[],location:'retiro'}],sectorStates:{},resources:{treasury:3200},reputation:{directory:35,gauchos:0,pardos:10,foreign:20,indigenous:0,royalists:-100},sectors:Object.fromEntries(CAMPAIGN_SECTORS.map(x=>[x.id,{owner:x.id==='retiro'?'patriot':'royalist',loyalty:x.id==='retiro'?65:25,militia:[0,0,0],damageUntil:0,fort:0}])),artillerySelection:[],armory:{},loadouts:{},lastConversation:null,conversations:{},officer:null,recruited:[],squad:[],operativeState:Object.fromEntries([...OPERATIVES,...CIVIC_RECRUITS].map(o=>[o.id,{hp:o.maxHp,fatigue:0,alive:true,xp:0,rations:2,torches:2,condition:100}])),flags:{armyFunded:false,academy:false,sanLorenzo:false,northPact:false,partisanSupply:false,foundry:false,parliament:false,emancipation:false,commission:false,mentoring:false},routes:{posta:false,flotilla:false,carts:false,mules:false},blockade:false,pendingBattle:null,completed:false,defeated:false,log:[{hour:0,text:'Retiro, 1812. Solo el cuartel está bajo tu control. Contratá combatientes, creá tu granadero o combiná ambas opciones para partir.'}],lastError:null};
  if(content!==null)attachCampaignContent(state,content);
  initializeCampaignSystems(state);return state;
}
export const isSupplied=isSectorSupplied;
export function recruitmentStatus(s,id,local=false){
  if(s.recruited.includes(id))return {available:false,reason:'Ya se encuentra en tus filas.'};
  if(!s.operativeState[id]?.alive)return {available:false,reason:'Ha caído en combate.'};
  if(s.operativeState[id]?.captured)return {available:false,reason:'Está prisionero. Liberá el sector donde está detenido.'};
  const character=characterForOperative(s,id);
  if(character&&isWorldCharacter(character)){
    const reason=!character.encounter.recruitable?'Este habitante no es un recluta.':s.operativeState[id].captured?'Este habitante está cautivo.':!local?'Buscá a este habitante en el mapa y hablá con él o ella.':null;
    return {available:!reason,reason:reason??'Disponible para incorporarse.'};
  }
  const conditions={
    3:[true,''],4:[true,''],10:[true,''],
    0:[s.flags.northPact,'Acuerda la defensa autónoma del norte.'],
    1:[s.flags.partisanSupply,'Entrega 50 mosquetes a las partidas del norte.'],
    2:[s.sectors.mendoza.owner==='patriot','Libera Mendoza.'],
    5:[s.reputation.foreign>=30&&!s.blockade,'Asegura el comercio y eleva a 30 el prestigio entre los extranjeros.'],
    6:[s.flags.sanLorenzo,'Vence en San Lorenzo.'],
    7:[s.flags.emancipation&&s.reputation.pardos>=30,'Proclama la emancipación y eleva a 30 el apoyo de Pardos y Morenos.'],
    8:[s.flags.northPact,'Acuerda la defensa autónoma del norte.'],
    9:[s.sectors.cordoba.owner==='patriot'&&s.reputation.gauchos>=10,'Libera Córdoba y respeta a las milicias provinciales.'],
    11:[s.sectors.cordoba.owner==='patriot','Libera Córdoba.'],
    57:[s.phase>=4,`Completa los preparativos de ${foundryFor(s).name}.`],
  };
  if(!local&&encounterForOperative(id))return {available:false,reason:`Buscá a ${encounterForOperative(id).name} en su localidad y hablá con él o ella.`};
  const [available,reason]=conditions[id]??[false,'No está disponible.'];return {available,reason:available?'Disponible para incorporarse.':reason};
}
export function campaignObjectives(s){
  const index=campaignChapterIndex(s);return campaignChapters(s).map((p,i)=>({...p,complete:campaignStory(s)?i<s.campaignProgress.completed.length:i<s.phase||(i===4&&s.completed),active:i===index&&!s.completed&&!s.defeated}));
}
export function availableActions(s){
  return {recruits:rosterFor(s).filter(o=>o.id!==1000&&!isContractOperative(s,o)).map(o=>({...o,...recruitmentStatus(s,o.id)})),destinations:CAMPAIGN_SECTORS.filter(x=>x.id!==s.location),phase:campaignChapters(s)[campaignChapterIndex(s)]};
}
function hasReadyCombatant(s){return s.recruited.some(id=>s.operativeState[id]?.alive&&s.operativeState[id].hp>0&&!s.operativeState[id].captured);}
function endingSpeech(s){for(const op of rosterFor(s).filter(o=>s.recruited.includes(o.id)&&s.operativeState[o.id]?.alive)){const line=speechFor(op,'ending');if(line?.trim())note(s,`${op.name}: «${line}»`);}}
function progress(s){
  if(s.completed)return;
  if(campaignStory(s)){
    updateContentQuests(s);
    if(s.sectors[headquartersFor(s)].owner!=='patriot')s.defeated=true;
    advanceCampaignStory(s);if(s.completed)endingSpeech(s);return;
  }
  enforceHistoricalLoss(s);
  if(s.defeated)return;
  if(s.phase===0&&(s.flags.academy||hasReadyCombatant(s))){s.flags.academy=true;s.phase=1;note(s,'El destacamento está listo para partir. Llegan noticias de un desembarco realista junto a San Lorenzo.');}
  if(s.phase===1&&s.flags.sanLorenzo){s.phase=2;standing(s,'directory',15);note(s,'Victoria en San Lorenzo. San Martín marcha al norte para estudiar la situación del Ejército del Norte.');}
  if(s.phase===2&&s.missions?.yatasto?.completed&&s.sectors.tucuman.owner==='patriot'&&s.flags.northPact&&isSupplied(s,'salta')){s.phase=3;s.flags.mentoring=true;note(s,'En Yatasto, San Martín confía el norte a Güemes. El esfuerzo principal se traslada a Cuyo.');}
  if(s.phase===3&&s.flags.foundry&&s.flags.parliament&&s.flags.armyFunded&&ownedArtilleryCount(s)>=3&&['mendoza','uspallata','los_patos'].every(id=>s.sectors[id].owner==='patriot'&&s.sectors[id].fort>=1)){
    s.phase=4;note(s,`${foundryFor(s).name} alcanza plena capacidad. Tres mil infantes, artillería y pasos seguros: San Martín puede incorporarse al ejército.`);
  }
  if(!s.completed&&s.phase===4&&s.recruited.includes(57)&&Object.values(s.sectors).every(x=>x.owner==='patriot')&&!s.blockade&&!s.pendingBattle&&!s.pendingEncounter&&!s.enemyGroups.some(g=>['marching','waiting','engaged','stationed'].includes(g.status))){s.completed=true;note(s,`¡Campaña concluida! Las provincias están libres y el ${foundryFor(s).armyName} queda preparado para la liberación continental.`);endingSpeech(s);}
  if(s.sectors[headquartersFor(s)].owner!=='patriot'){s.defeated=true;note(s,`El cuartel de ${headquartersName(s)} ha caído. El ejército debe reorganizarse desde una nueva campaña.`);}
}
function raid(s,theater,forcedTarget=null){
  const targets=CAMPAIGN_SECTORS.filter(x=>x.theater===theater&&s.sectors[x.id].owner==='patriot'&&x.id!==headquartersFor(s));
  const priorities=theater==='north'?NORTHERN_AXIS:theater==='coast'?['san_nicolas','santa_fe','ensenada','buenos_aires']:['cordoba'];
  targets.sort((a,b)=>theater==='coast'?b.income-a.income:priorities.indexOf(a.id)-priorities.indexOf(b.id));
  const target=forcedTarget?sector(forcedTarget):targets.find(x=>theater!=='interior'||s.sectors[x.id].loyalty<50);if(!target||s.sectors[target.id].owner!=='patriot')return;
  launchEnemyGroup(s,theater,target.id);
}
function loseSectorToGroup(s,group){
  const region=s.sectors[group.target];region.damageUntil=s.hour+24*14;recordCityLoyalty(s,{sectorId:group.target,kind:'defeat',eventId:group.id});
  if(group.theater==='coast'){s.blockade=true;note(s,`La flotilla realista establece un bloqueo en ${sector(group.target).name}. Las aduanas reducen sus ingresos.`);}
  else {if(group.theater==='interior'){const silver=Math.min(150,s.resources.treasury);s.resources.treasury-=silver;note(s,`Las partidas saquean ${silver} pesos y cortan los convoyes de Cuyo.`);}region.owner='royalist';region.militia=[0,0,0];delete s.garrisons[group.target];note(s,`Los realistas ocupan ${sector(group.target).name} y cortan la ruta de abastecimiento.`);}
  region.militia=[0,0,0];delete s.garrisons[group.target];group.status='stationed';group.resolvedAt=s.hour;recordEnemyPresence(s,group);
}
function addDefenseHistory(s,group,outcome,casualties,text,extra={}){s.encounterHistory.unshift({groupId:group.id,sector:group.target,hour:s.hour,outcome,casualties,text,...extra});s.encounterHistory=s.encounterHistory.slice(0,40);}
function settleEnemyEncounters(s,options={}){
  if(s.pendingBattle||s.pendingEncounter)return;
  for(const group of s.enemyGroups.filter(g=>g.status==='waiting').sort((a,b)=>a.arrivalAt-b.arrivalAt)){
    if(s.sectors[group.target].owner!=='patriot'&&!localDefenderCount(s,group.target,{exclude:options.traveling??[]})){group.status='stationed';group.resolvedAt=s.hour;continue;}
    if(!localDefenderCount(s,group.target,{exclude:options.traveling??[]})){loseSectorToGroup(s,group);addDefenseHistory(s,group,'defeat',[],`${sector(group.target).name} no tenía defensores presentes.`);continue;}
    queueEnemyEncounter(s);note(s,`¡Contacto en ${sector(group.target).name}! Elegí defensa táctica, resolución automática o retirada.`);break;
  }
}
function meetEnemyGroups(s,at){
  // A battle already in progress owns its enemy roster until its report returns.
  if(s.pendingBattle?.sector===at)return;
  haltEnemyGroupsAt(s,at);
  for(const group of occupyingGroups(s,at)){group.status='waiting';group.resolvedAt=null;}
}
function relocateDefenders(s,ids,destination,moralePenalty=5){
  for(const id of ids){recordStrategicArrival(s,[id],operativeLocation(s,id),destination);const r=s.operativeState[id];r.location=destination;r.assignment='active';r.asleep=false;r.recoveryHours=0;r.energy=Math.max(0,r.energy-10);gainFatigue(r,8);r.morale=Math.max(0,r.morale-moralePenalty);}
  for(const squad of s.squads)if(squad.members.some(id=>ids.includes(id))){delete squad.journey;squad.location=destination;if(squad.id===s.activeSquadId)s.location=destination;}
  for(const horse of s.horseState.horses)if(ids.includes(horse.assignedTo))horse.location=destination;
}
// An empty roster is recoverable through paid recruitment, as at campaign start.
function reorganizeAfterLoss(s,previous){
 if(s.defeated||s.pendingBattle||s.pendingEncounter||s.sectors[headquartersFor(s)].owner!=='patriot'||s.recruited.some(id=>s.operativeState[id]?.alive))return;
 const loss=previous.pendingBattle&&!s.pendingBattle||Object.entries(previous.operativeState).some(([id,r])=>r.alive&&(!s.operativeState[id]?.alive||!r.captured&&s.operativeState[id]?.captured));
 if(!loss)return;
 // Move the empty command only. Prisoners, casualties and property stay put.
 s.squad=[];const command=activeSquad(s);command.members=[];delete command.journey;s.location=headquartersFor(s);command.location=s.location;
 note(s,Object.values(s.operativeState).some(r=>r.alive&&r.captured)?`Quedan combatientes prisioneros. El cuartel de ${headquartersName(s)} puede contratar una fuerza de rescate.`:`No quedan combatientes en servicio. Podés contratar otra escuadra en ${headquartersName(s)}.`);
}
function captureOperatives(s,ids,at,ammunition={}){
  for(const id of ids){const r=s.operativeState[id],contract=clone(s.contracts[id]);removeFromService(s,id);Object.assign(r,{captureSequence:(r.captureSequence??0)+1,captured:true,capturedSector:at,capturedAt:s.hour,capturedContract:contract,capturedAmmunition:clone(ammunition[id]??{loaded:0,ammo:0}),location:at});}
  if(ids.length)note(s,`${ids.map(id=>rosterFor(s).find(o=>o.id===id).nickname).join(', ')} quedan prisioneros en ${sector(at).name}.`);
}
function releaseCaptives(s,at){
  for(const h of s.horseState.horses)if(h.custody?.kind==='field'&&h.location===at){h.custody=null;h.assignedTo=null;}
  for(const op of rosterFor(s)){
    const r=s.operativeState[op.id];if(!r.captured||r.capturedSector!==at)continue;
    const held=r.capturedAmmunition??{loaded:0,ammo:0};
    setCarriedLoading(r,{weapon:op.weapon,...held,weaponDropped:r.weaponDropped});r.capturedAmmunition={loaded:0,ammo:0};
    for(const h of s.horseState.horses)if(h.custody?.kind==='captured'&&h.custody.operativeId===op.id){h.custody=null;h.assignedTo=null;}
    const contract=restoredCaptiveContract(r,s.hour);
    Object.assign(r,{asleep:false,captured:false,capturedSector:null,capturedAt:null,capturedContract:null,location:at,arrival:null,residentSector:at,residentScene:null,assignment:r.hp<r.maxHp||r.bleeding?'patient':'rest'});
    if(!contract){r.assignment='active';note(s,`${op.name} queda libre en ${sector(at).name}. Su contrato había terminado y puede volver a contratarse.`);continue;}
    s.contracts[op.id]=contract;s.recruited.push(op.id);if(s.location===at&&s.squad.length<6)s.squad.push(op.id);note(s,`${op.name} vuelve al servicio tras la liberación de ${sector(at).name}. Conserva sus heridas y equipo.`);
  }
}
function prepareDefense(s,group,{excludeMercs=false}={}){
  const at=group.target,def=sector(at),ids=excludeMercs?[]:localDefenderIds(s,at),allocated={};
  for(const q of s.squads)if(q.members.some(id=>ids.includes(id)))delete q.journey;
  for(const id of ids){s.operativeState[id].assignment='active';s.operativeState[id].asleep=false;s.operativeState[id].recoveryHours=0;}Object.assign(allocated,prepareCampaignAmmunition(s,rosterFor(s),ids,{at,supplied:isSupplied(s,at),commit:true}).allocation);
  const request={id:`defense-${group.id}-${s.hour}`,sector:at,origin:s.location,name:`Defensa de ${def.name}`,biome:def.biome,theater:def.theater,seed:group.seed,hour:s.hour,secondOfHour:s.secondOfHour??0,defenseGroupId:group.id,defenseFort:s.sectors[at].owner==='patriot'?s.sectors[at].fort:0,issuedCartridges:Object.values(allocated).reduce((sum,u)=>sum+u.loaded+u.ammo,0),wasRoyalist:s.sectors[at].owner==='royalist',difficulty:1,npcs:encountersFor(s,at),detainedPrisoners:detentionManifest(s,rosterFor(s),at),squad:ids.map(id=>({...deploymentOperative(s,id),...deploymentMorale(s,id),...allocated[id],...(mountForOperative(s.horseState,id)??{horse:false,canMount:false})})),enemies:clone(group.units),garrison:prepareGarrison(s,at),artillery:[],...regionalConditions(at,s.hour),enemyCommand:group.command,enemyCommander:ROYALIST_COMMANDS.find(c=>c.id===group.command).commander};
  group.status='engaged';s.pendingEncounter=null;s.pendingBattle=prepareDeploymentExits(s,prepareSectorArtillery(s,request));return request;
}
function finishDefense(s,request,outcome,snapshot,plan){
  const group=recordEnemyGroupResult(s,request.defenseGroupId,snapshot,outcome),ids=request.squad.map(u=>Number(u.id)),casualties=ids.filter(id=>!s.operativeState[id].alive);const captured=plan.entries.filter(e=>e.kind==='captured').map(e=>Number(e.unitId));
  if(outcome==='victory'){if(!s.enemyGroups.some(g=>g.target===group.target&&['waiting','engaged','stationed'].includes(g.status))){if(request.wasRoyalist)s.sectors[group.target].owner='patriot';releaseCaptives(s,group.target);}recordCityLoyalty(s,{sectorId:group.target,kind:'defense',eventId:group.id});if(group.theater==='coast'&&!s.enemyGroups.some(g=>g.theater==='coast'&&['waiting','engaged','stationed'].includes(g.status)))s.blockade=false;note(s,`La defensa de ${sector(group.target).name} rechaza a ${group.initialStrength} realistas.`);}
  else loseSectorToGroup(s,group);
  for(const squad of s.squads)squad.members=squad.members.filter(id=>s.operativeState[id].alive&&!s.operativeState[id].captured);s.squad=s.squad.filter(id=>s.operativeState[id].alive&&!s.operativeState[id].captured);
  const militiaCasualties=(request.garrison??[]).filter(u=>snapshot.units.find(v=>String(v.id)===String(u.id))?.hp<=0).map(u=>u.id),militiaDispersed=outcome==='victory'?0:(request.garrison?.length??0)-militiaCasualties.length;const text=`${sector(group.target).name}: ${outcome==='victory'?'defensa victoriosa':outcome==='retreat'?'retirada':'defensa derrotada'}. ${casualties.length} granaderos y ${militiaCasualties.length} milicianos caídos; ${captured.length} prisioneros${militiaDispersed?`; ${militiaDispersed} milicianos dispersos`:''}.`;addDefenseHistory(s,group,outcome,casualties,text,{captured,militiaCasualties,militiaDispersed,dispositions:clone(plan.entries)});note(s,text);s.sectorStates[group.target]=clone(snapshot);s.pendingBattle=null;
}
function applyTacticalTime(s,request,elapsed){
 const previous=request.syncedSeconds??0;requireThat(Number.isSafeInteger(elapsed)&&elapsed>=previous&&elapsed-previous<=864000,'El tiempo táctico es inválido.');
 for(let remaining=elapsed-previous;remaining>0;){const step=Math.min(remaining,3600-(s.secondOfHour??0));remaining-=step;s.secondOfHour=(s.secondOfHour??0)+step;if(s.secondOfHour===3600){s.secondOfHour=0;tick(s,1,{stopOnDefeat:false,civilianSeconds:step});}else advanceOffscreenTime(s,step);}
 request.syncedSeconds=elapsed;
}
// Receipt counts are acknowledgement markers, never a second item inventory.
// Check only the small NPC receipt lists on ordinary clock synchronizations.
function validateAcknowledgedNpcGiftReceipts(campaign,npcs,sectorId){
 for(const quest of NPC_QUESTS){
  const acknowledged=campaign.conversations?.[quest.npcId]?.giftCount??0;
  if(!quest.carried||quest.sector!==sectorId||!acknowledged)continue;
  const npc=npcs.find(n=>n?.id===quest.npcId);
  requireThat(npc,'Falta el interlocutor que recibió los objetos del encargo.');
  requireThat(validateQuestGifts(npc).length>=acknowledged,'El parte perdió objetos que el interlocutor ya recibió.');
 }
}
export function hasPendingNpcGiftProgress(campaign,battle){
 const npcs=battle.npcs??[];requireThat(Array.isArray(npcs)&&npcs.length<=2000,'Los interlocutores del despliegue son inválidos.');
 validateAcknowledgedNpcGiftReceipts(campaign,npcs,campaign.pendingBattle?.sector);
 let changed=false;
 for(const npc of npcs){
  const quest=questForNPC(campaign,npc?.id);
  if(npc?.questGifts===undefined&&!quest?.carried)continue;
  const count=validateQuestGifts(npc).length,acknowledged=campaign.conversations?.[npc.id]?.giftCount??0;
  requireThat(count>=acknowledged,'El parte perdió objetos que el interlocutor ya recibió.');
  if(count>acknowledged||count>0&&count===quest?.carried?.count&&!['completed','failed'].includes(quest.status)&&quest.conditionMet)changed=true;
 }
 return changed;
}
function validatedInteractionSnapshot(s,raw){
 const snapshot=validateSectorSnapshot(raw),request=s.pendingBattle;
 requireThat(snapshot.battleId===request.id&&snapshot.sectorId===request.sector&&(snapshot.sceneId??null)===(request.sceneId??null),'La entrega no corresponde al despliegue pendiente.');
 const ids=request.squad.map(u=>String(u.id)),allowed=new Set([...ids,...(request.garrison??[]).map(u=>String(u.id)),...(request.missionAllies??[]).map(u=>String(u.id))]);
 const previous=request.sceneId?s.sceneStates[request.sceneId]:s.sectorStates[request.sector],corpses=new Set([...(previous?.units??[]).filter(u=>u.side==='player'&&u.hp<=0).map(u=>u.id),...(request.remains??[]).map(r=>String(r.unitId))]);
 const players=snapshot.units.filter(u=>u.side==='player');
 requireThat(allowed.size>0&&ids.every(id=>players.some(u=>u.id===id))&&players.every(u=>allowed.has(u.id)||u.hp<=0&&corpses.has(u.id)),'La entrega no corresponde a la escuadra desplegada.');
 requireThat(request.squad.every(u=>s.recruited.includes(Number(u.id))),'La escuadra de la entrega no pertenece a la campaña.');
 let retainedRoster=false;
 for(const local of snapshot.npcs){
  if(!(local.questGifts?.length))continue;
  const npc=encounterDefinitions(s).find(n=>n.id===local.id);
  // Combat requests may omit the civilian roster. Only an existing, same-scene
  // nonrecruitable gift owner can supply that missing authorization.
  const old=previous?.npcs?.find(n=>n.id===local.id);
  const retained=request.npcs===undefined&&npc?.operativeId===undefined&&local.operativeId===undefined&&old?.operativeId===undefined&&previous?.sectorId===request.sector&&(previous.sceneId??null)===(request.sceneId??null)&&old&&validateQuestGifts(old).length>0;
  requireThat(npc&&(request.npcs?.some(n=>n.id===npc.id)||retained),'El receptor no pertenece al sector del despliegue.');
  if(retained)retainedRoster=true;
 }
 // Convert the old omitted-roster defense format once, from the validated
 // retained scene rather than from the submitted receipt or current location.
 if(retainedRoster)request.npcs=clone(previous.npcs.filter(n=>n.detention===undefined));
 validateAcknowledgedNpcGiftReceipts(s,snapshot.npcs,request.sector);
 hasPendingCivilians(s,snapshot);
 return snapshot;
}
function acknowledgeNpcGifts(s,snapshot){
 for(const local of snapshot.npcs){
  const quest=questForNPC(s,local.id);if(!quest?.carried)continue;
  const count=validateQuestGifts(local).length,previous=s.conversations?.[local.id],acknowledged=previous?.giftCount??0;
  requireThat(count>=acknowledged,'El parte perdió objetos que el interlocutor ya recibió.');
  const complete=count===quest.carried.count&&!['completed','failed'].includes(quest.status)&&quest.conditionMet;
  if(count===acknowledged&&!complete)continue;
  if(!count)continue;
  const npc=encounterDefinitions(s).find(n=>n.id===local.id);
  if(quest.status==='unoffered')s.quests[quest.id]={status:'offered',offeredAt:s.hour,completedAt:null};
  let text=`Recibimos ${count} de ${quest.carried.count} ${quest.carried.label.toLowerCase()}. Todavía faltan objetos para completar el encargo.`,outcome='questProgress';
  if(complete){
   s.quests[quest.id]={...s.quests[quest.id],status:'completed',completedAt:s.hour};
   recordCityLoyalty(s,{sectorId:quest.sector,kind:'quest',eventId:`npc-${quest.id}`});
   note(s,`Encargo cumplido: ${quest.title}. La ciudad reconoce el servicio.`);text=quest.delivery;outcome='questCompleted';
  }else if(count===quest.carried.count){text=quest.status==='completed'?quest.delivery:'Recibimos todos los objetos. Falta asegurar las localidades del encargo.';}
  s.conversations??={};s.conversations[npc.id]={met:true,lastApproach:'gift',hour:s.hour,text,giftCount:count};
  s.lastConversation={npcId:npc.id,speaker:npc.name,text,outcome,giftCount:count,operativeId:npc.operativeId??null,options:dialogueOptions(npc,questForNPC(s,npc.id)).map(([id])=>id)};
 }
}
function resolveDefenseAutomatically(s,request){
  const result=autoResolve(request,s.sectorStates[request.sector]??null);applyTacticalTime(s,request,result.battle.elapsedSeconds??0);result.battle.syncedSeconds=request.syncedSeconds;result.battle.savedHour=s.hour;result.battle.savedSecond=s.secondOfHour;
  if(result.outcome===null){request.resumeSnapshot=clone(result.battle);note(s,'La resolución automática continúa pendiente. Retomá el combate y ayudá a quienes aún no pudieron salir.');return;}
  const next=dispatchCampaign(s,{type:'battleResult',battleId:request.id,outcome:result.outcome,survivors:result.battle.units.filter(u=>u.side==='player'),sectorState:result.battle});requireThat(!next.lastError,next.lastError);Object.assign(s,next);
}
function completeDeploymentReport(s,request,action){
  requireThat(action.sectorState&&Array.isArray(action.survivors),'El despliegue necesita un estado táctico completo y un parte de todos los combatientes.');
  const raw=action.sectorState,snapshot=validateSectorSnapshot(raw),ids=request.squad.map(u=>String(u.id));
  requireThat(snapshot.battleId===request.id&&snapshot.sectorId===request.sector&&(snapshot.sceneId??null)===(request.sceneId??null),'El estado táctico no corresponde al despliegue y sector pendientes.');
  validateAcknowledgedNpcGiftReceipts(s,snapshot.npcs,request.sector);
  hasPendingCivilians(s,snapshot);
  const previous=request.sceneId?s.sceneStates[request.sceneId]:s.sectorStates[request.sector];
  const auxiliary=[...(request.garrison??[]),...(request.missionAllies??[])].map(u=>String(u.id)),known=new Set([...ids,...auxiliary]),corpses=[...(previous?.units??[]).filter(u=>u.side==='player'&&u.hp<=0),...(request.remains??[]).map(r=>r.unit)].map(u=>String(u.id)),received=action.survivors.map(u=>u&&String(u.id));
  requireThat(action.survivors.every(u=>u&&typeof u==='object'&&!Array.isArray(u))&&new Set(received).size===received.length&&received.every(id=>known.has(id)||corpses.includes(id))&&ids.every(id=>received.includes(id)),'El parte debe incluir exactamente a todos los combatientes desplegados, vivos o caídos.');
  const players=snapshot.units.filter(u=>u.side==='player');
  requireThat([...ids,...auxiliary,...(request.remains??[]).map(r=>r.unitId)].every(id=>players.some(u=>u.id===id))&&players.every(u=>known.has(u.id)||(u.hp<=0&&corpses.includes(u.id))),'El estado táctico contiene una escuadra incompleta o ajena al despliegue.');
  const source=!request.exploration&&!request.defenseGroupId&&!request.occupationGroupIds?.length&&previous&&!previous.sectorCleared?previous.units.filter(u=>u.side==='enemy'&&!u.departure):request.enemies??[],enemyIds=new Set(source.map(u=>String(u.id))),enemies=snapshot.units.filter(u=>u.side==='enemy');
  const oldEnemyBodies=(previous?.units??[]).filter(u=>u.side==='enemy'&&u.hp<=0&&!u.departure);
  requireThat([...enemyIds].every(id=>enemies.some(u=>u.id===id))&&enemies.every(u=>enemyIds.has(u.id)||u.hp<=0&&oldEnemyBodies.some(old=>old.id===u.id||u.originalUnitId===old.id&&u.id.startsWith(`corpse:${previous.battleId??request.sector}:${old.id}`))),'El estado táctico no incluye a todos los enemigos del despliegue.');
  const required=['hp','maxHp','weapon','condition','jammed','loaded','ammo','inventory','bleeding','bandaged','energy','medkits','fatigue','rations','torches','boleadoras','activeSlot'];
  if(request.fittingRulesVersion===FITTING_RULES_VERSION){requireThat(raw.fittingRulesVersion===FITTING_RULES_VERSION,'El parte no contiene la versión de accesorios del despliegue.');required.push('weaponFittings','weaponFittingPattern','bladeFittingPattern');}
  for(const id of known){const unit=raw.units.find(u=>u.side==='player'&&String(u.id)===id);requireThat(unit&&required.every(key=>Object.hasOwn(unit,key)&&unit[key]!==undefined),'El equipo y la salud del combatiente están incompletos.');}
  const commander=snapshot.units.find(u=>Number(u.id)===57&&u.missionAlly),missionFailed=request.missionId==='san_lorenzo'&&commander?.hp<=0,able=side=>snapshot.units.some(u=>u.side===side&&fieldCapable(u));
  requireThat(request.exploration||missionFailed||(action.outcome==='victory'?completedTacticalVictory(snapshot):action.outcome==='retreat'?snapshot.status==='retreat'&&!able('player')&&snapshot.units.some(u=>u.side==='player'&&u.departure):snapshot.status===action.outcome&&!able('player')),'El resultado no corresponde al desenlace táctico.');
  validateArtilleryReport(request,snapshot);
  return {snapshot,reports:ids.map(id=>players.find(u=>u.id===id))};
}
function applyReturnedOperative(s,request,report){
  const id=Number(report.id);returnMount(s,id,report);returnTraining(s,id,report);const op=rosterFor(s).find(o=>o.id===id);returnEquipment(s,id,report);returnMedicalCare(s,id,report,op);returnMorale(s,id,report,request.squad.find(u=>Number(u.id)===id));
  for(const [field,max]of Object.entries({energy:100,weight:1000,strength:100,strengthTraining:10000,rations:100000,torches:100000,condition:100,fatigue:100,boleadoras:100000}))if(report[field]!==undefined){requireThat(Number.isFinite(report[field])&&report[field]>=0&&report[field]<=max,'El estado del combatiente es inválido.');s.operativeState[id][field]=report[field];}
  if(s.operativeState[id].sleepCollapsed&&!needsCollapseRecovery(s.operativeState[id]))s.operativeState[id].sleepCollapsed=false;
  s.operativeState[id].inventory=clone(validatePersonalInventory(report.inventory));
  validatePocketOrder(report.pocketOrder);if(report.pocketOrder===undefined)delete s.operativeState[id].pocketOrder;else s.operativeState[id].pocketOrder=clone(report.pocketOrder);
}
function commitDeploymentReturn(s,request,snapshot,plan){
  applyTacticalTime(s,request,snapshot.elapsedSeconds??0);snapshot.syncedSeconds=request.syncedSeconds;snapshot.savedHour=s.hour;snapshot.savedSecond=s.secondOfHour;
  acknowledgeCivilians(s,snapshot);acknowledgeNpcGifts(s,snapshot);acknowledgeSuccessionDeaths(s,snapshot);
  for(const entry of plan.entries){const id=Number(entry.unitId),unit=snapshot.units.find(u=>u.side==='player'&&u.id===entry.unitId);applyReturnedOperative(s,request,unit);const r=s.operativeState[id];r.location=entry.sector;
    clearCarriedLoading(r);const loading=plan.ammunition.carried[id];if(loading)setCarriedLoading(r,{weapon:unit.weapon,...loading});syncCarriedAmmunition(r,unit.weapon);
    if(['dead','dispersed'].includes(entry.kind)&&r.activeItem==='ammo'){delete r.activeItem;r.activeSlot='unarmed';}
    r.arrival=entry.kind==='departed'?{battleId:request.id,fromSector:request.sector,fromScene:request.sceneId??null,exitId:entry.departure.exitId,entryEdge:entry.departure.entryEdge,entryAnchor:clone(entry.departure.entryAnchor)}:null;
    r.residentSector=entry.kind==='resident'?request.sector:null;r.residentScene=entry.kind==='resident'?(request.sceneId??null):null;
  }
  requireThat(Object.values(plan.ammunition.creditedAmmunition??{}).every(count=>count===0),'El parte intenta crear una reserva global de munición.');
  if(request.exploration)recordCasualtyMorale(s,plan.entries.filter(e=>e.kind==='dead').map(e=>Number(e.unitId)),request.squad.map(u=>Number(u.id)));else recordBattleMorale(s,request,plan.outcome,snapshot);
  const captured=plan.entries.filter(e=>e.kind==='captured').map(e=>Number(e.unitId));captureOperatives(s,captured,plan.sourceSector,plan.ammunition.custody);
  s.squads=clone(plan.squadChanges.squads);const selected=s.squads.find(q=>q.id===s.activeSquadId);s.squad=[...selected.members];s.location=selected.location;
  for(const change of plan.horseChanges)Object.assign(s.horseState.horses.find(h=>h.id===change.id),clone(change));
  for(const h of s.horseState.horses)if(h.custody?.kind==='field'&&s.sectors[h.location]?.owner==='patriot'&&!occupyingGroups(s,h.location).length&&plan.outcome!=='defeat')h.custody=null;
  settlePrisonerEscapes(s,request,snapshot,rosterFor(s));
  returnGarrison(s,request,snapshot,plan.auxiliary);
  settleSectorArtillery(snapshot,plan.outcome);
  snapshot.returnLedger={battleId:request.id,entries:clone([...plan.entries,...plan.auxiliary]),creditedCartridges:plan.ammunition.creditedCartridges,creditedAmmunition:clone(plan.ammunition.creditedAmmunition)};
  const delivered=new Set((request.remains??[]).map(r=>`${r.battleId}:${r.unitId}`));s.sectorRemains[plan.sourceSector]=(s.sectorRemains[plan.sourceSector]??[]).filter(r=>!delivered.has(`${r.battleId}:${r.unitId}`));
  for(const e of [...plan.entries,...plan.auxiliary].filter(e=>e.kind==='dead'&&e.departure)){
    const unit=clone(snapshot.units.find(u=>u.id===e.unitId));delete unit.entryEdge;delete unit.entryAnchor;delete unit.entryReason;s.sectorRemains[e.sector]??=[];s.sectorRemains[e.sector].push({battleId:request.id,unitId:e.unitId,unit,entryEdge:e.departure.entryEdge,entryAnchor:clone(e.departure.entryAnchor)});
  }
  if(request.sceneId)s.sceneStates[request.sceneId]=clone(snapshot);else s.sectorStates[request.sector]=clone(snapshot);
}
function deployed(s,id){return s.pendingBattle?.squad?.some(u=>Number(u.id)===Number(id));}
function advanceCampaignHorses(s){
 const held=s.horseState.horses.filter(h=>deployed(s,h.assignedTo)||operativeInTransit(s,h.assignedTo));
 s.horseState=applyHorseAction(s.horseState,{type:'advance',hour:s.hour});
 for(const h of held){const next=s.horseState.horses.find(v=>v.id===h.id);Object.assign(next,{stamina:h.stamina,condition:Math.min(h.condition,next.condition),assignedTo:h.assignedTo,returned:Boolean(h.returned)});}
}
function releaseDeferred(s){if(s.pendingBattle)return;if(s.horseState.horses.some(h=>h.hired&&!h.returned&&h.hireUntil<=s.hour))advanceCampaignHorses(s);for(const id of [...s.recruited])if(s.contracts?.[id]?.departurePending&&!operativeInTransit(s,id)){removeFromService(s,id);note(s,'Un voluntario cumple su contrato y deja el destacamento.');}const raids=s.deferredRaids??[];s.deferredRaids=[];for(const r of raids)launchEnemyGroup(s,r.theater,r.target,{immediate:true});settleEnemyEncounters(s);}
function assignmentContext(s,options={}){
  const unsafe=s.recruited.filter(id=>s.enemyGroups.some(g=>['waiting','engaged','stationed'].includes(g.status)&&g.target===operativeLocation(s,id)));
  return {...options,isSupplied,unsafe,traveling:[...(options.traveling??[]),...travelingOperatives(s),...unsafe]};
}
function pauseForAssignments(s,hours,advancedHours,extraEvents=[]){
  const events=collectAssignmentAttention(s,assignmentStates(s,rosterFor(s),assignmentContext(s)),extraEvents);
  if(!events.length)return false;
  s.assignmentAttention.notice={hour:s.hour,requestedHours:hours,advancedHours,events};
  note(s,`El avance se detuvo tras ${advancedHours} de ${hours} horas: hay novedades en las asignaciones.`);
  return true;
}
function pauseForContracts(s,hours,advancedHours,extra=[]){
  const events=collectContractAttention(s,extra);
  if(!events.length)return false;
  s.contractAttention.notice={hour:s.hour,requestedHours:hours,advancedHours,events};
  note(s,`El avance se detuvo tras ${advancedHours} de ${hours} horas: hay contratos por revisar.`);
  return true;
}
function pauseForLogistics(s,hours,advancedHours,completed=[]){
  const events=[...completed,...collectLogisticsAttention(s,{isSupplied})];
  if(!recordLogisticsNotice(s,hours,advancedHours,events))return false;
  note(s,`El avance se detuvo tras ${advancedHours} de ${hours} horas: hay novedades en producción y entregas.`);
  return true;
}
function recordSleepEvents(s,events){
  return events.map(event=>{note(s,`${rosterFor(s).find(op=>op.id===event.id).nickname}: ${SLEEP_ISSUE_TEXT[event.code]}`);return sleepAttention(s,event);});
}
// The caller has set the interval endpoint. Resolve deaths and quest deadlines
// inside that interval at their real timestamps, then restore the endpoint for
// ordinary hourly work. A large checkpoint and several short ones agree.
function advanceOffscreenTime(s,seconds){
 const end=s.hour*3600+(s.secondOfHour??0);let at=end-seconds;
 const setTime=t=>{s.hour=Math.floor(t/3600);s.secondOfHour=t%3600;};
 setTime(at);
 while(at<end){
  const next=Math.min(end,at+nextUnloadedCivilianDeath(s),nextContentQuestDeadline(s),nextCampaignPresenceChange(s));
  requireThat(Number.isSafeInteger(next)&&next>at,'El intervalo de los habitantes no es válido.');
  setTime(next);advanceUnloadedCivilians(s,next-at);at=next;
  if(at<end){synchronizeCampaignPresence(s);updateContentQuests(s);progress(s);}
 }
}
function tick(s,hours,options={}){
  const {joinArrivals=true,stopOnDefeat=true,civilianSeconds=3600}=options;
  requireThat(Number.isInteger(hours)&&hours>=1&&hours<=240,'El avance debe ser de 1 a 240 horas.');
  const sleepEvents=recordSleepEvents(s,prepareSleep(s,rosterFor(s),assignmentContext(s,options)));
  if(options.pauseOnAssignments){
    // A second explicit wait acknowledges the notice. The reported task markers
    // prevent an unchanged shortage from trapping the clock at the same hour.
    s.assignmentAttention.notice=null;s.travelNotice=null;s.contractAttention.notice=null;s.logisticsNotice=null;
    const assignmentPause=pauseForAssignments(s,hours,0,sleepEvents),contractPause=pauseForContracts(s,hours,0),logisticsPause=pauseForLogistics(s,hours,0);
    if(assignmentPause||contractPause||logisticsPause)return;
  }
  for(let i=0;i<hours;i++){
    const assignmentEvents=[],contractEvents=[],logisticsEvents=[],militiaWorked=[];
    s.hour++;restockAmmunitionShops(s,isSupplied);advanceOffscreenTime(s,civilianSeconds);for(const id of [...s.recruited]){const contract=s.contracts?.[id];if(contract?.expiresAt!==null&&contract?.expiresAt!==undefined&&contract.expiresAt<=s.hour){if(s.operativeState[id]?.alive&&!s.operativeState[id].captured)contractEvents.push({operativeId:id,expiresAt:contract.expiresAt,code:'expired'});if(deployed(s,id)||operativeInTransit(s,id)){contract.departurePending=true;continue;}const name=rosterFor(s).find(o=>o.id===id)?.name??'Un combatiente';removeFromService(s,id);note(s,`${name} concluye su contrato y deja el destacamento. Su hoja de servicio queda disponible.`);}}advanceCampaignHorses(s);
    for(const course of [...(s.militiaTraining??[])]){
      if(s.sectors[course.sector].owner!=='patriot'){s.militiaTraining=s.militiaTraining.filter(t=>t!==course);assignmentEvents.push(militiaCancellationAttention(course));note(s,'La ocupación enemiga dispersa un curso de milicias.');continue;}
      if(militiaAssignmentIssue(s,course,{isSupplied}))continue;
      const trainer=s.operativeState[course.trainerId];if(trainer){trainer.energy=Math.max(0,trainer.energy-3);gainFatigue(trainer,2);militiaWorked.push(course.trainerId);}
      course.remaining--;if(course.remaining<=0){if(course.rank>0)returnMilitiaTrainees(s,course,true);else s.sectors[course.sector].militia[0]+=course.count;s.militiaTraining=s.militiaTraining.filter(t=>t!==course);assignmentEvents.push(militiaCompletionAttention(course));note(s,`Tres milicianos completan su instrucción en ${sector(course.sector).name}.`);}
    }
    advanceMarchFatigue(s,rosterFor(s).map(op=>({...op,...(mountForOperative(s.horseState,op.id)??{})})),options);
    for(const message of advanceDetentionCare(s,rosterFor(s)))note(s,message);
    const careOptions=assignmentContext(s,options);advanceMedicalCare(s,rosterFor(s),careOptions);const deaths=advanceMilitaryWounds(s,rosterFor(s));for(const death of advanceMilitiaWounds(s))note(s,`${death.name} fallece por sus heridas en ${sector(death.sector).name}.`);advanceAssignments(s,rosterFor(s),careOptions);recordCasualtyMorale(s,deaths);advanceMorale(s,rosterFor(s),careOptions);
    for(const id of deaths){
      s.operativeState[id].location=operativeLocation(s,id);
      for(const squad of s.squads)squad.members=squad.members.filter(member=>member!==id);
      s.squad=s.squad.filter(member=>member!==id);
      for(const horse of s.horseState.horses)if(horse.assignedTo===id)horse.assignedTo=null;
      for(const course of s.militiaTraining.filter(t=>t.trainerId===id))returnMilitiaTrainees(s,course);
      s.militiaTraining=s.militiaTraining.filter(t=>t.trainerId!==id);
      note(s,`${rosterFor(s).find(o=>o.id===id).name} fallece por sus heridas.`);
    }
    if(s.hour%24===0){
      dailyPolitics(s);
      const income=dailyIncome(s);
      // Pay using the current loyalty, then improve next day's cooperation.
      for(const def of CAMPAIGN_SECTORS){const region=s.sectors[def.id];if(region.owner==='patriot'&&isSupplied(s,def.id))region.loyalty=Math.min(100,region.loyalty+1);}
      add(s,{treasury:income});
      note(s,`Las estancias y aduanas aportaron ${income} pesos a la tesorería.`);
    }
    if(s.hour%720===0){const ids=s.recruited.filter(id=>s.operativeState[id].alive&&s.contracts?.[id]?.kind==='legacy'),payroll=ids.reduce((sum,id)=>sum+rosterFor(s).find(o=>o.id===id).monthlyPay,0);if(payroll>0){if(s.resources.treasury>=payroll){s.resources.treasury-=payroll;recordPayMorale(s,ids,true);standing(s,'foreign',5);note(s,`Se abonaron ${payroll} pesos en estipendios mensuales.`);}else{recordPayMorale(s,ids,false);standing(s,'foreign',-20);standing(s,'directory',-10);note(s,'La tesorería no pudo abonar los sueldos. Los voluntarios reclaman el pago.');}}}
    if(!s.completed&&s.hour%120===0)raid(s,'north');
    if(!s.completed&&s.hour%168===0&&coastalRevenue(s)>=500)raid(s,'coast');
    if(!s.completed&&s.hour%144===0)raid(s,'interior');
    assignmentEvents.push(...recordSleepEvents(s,finishSleepHour(s,rosterFor(s),{...assignmentContext(s,options),working:militiaWorked})));
    delayCrossingEnemyGroups(s,{elapsedHour:1,travelLeg:options.traveling?.length?options.travelLeg:null});
    const travelAttention=advanceSquadTravel(s,rosterFor(s),{note,onArrival:q=>meetEnemyGroups(s,q.location),releaseAtArrival:q=>{for(const id of [...q.members])if(s.contracts[id]?.departurePending){removeFromService(s,id);note(s,'Un voluntario cumple su contrato y deja la escuadra al llegar.');}}});
    advanceEnemyGroups(s);
    for(const q of s.squads)if(q.journey?.status==='moving'&&q.journey.elapsed===0&&s.enemyGroups.some(g=>g.target===q.location&&['waiting','engaged','stationed'].includes(g.status))){q.journey.status='paused';q.journey.reason='contact';}
    settleEnemyEncounters(s,options);refreshEnemyIntelligence(s,options);
    // Occupation and blockade are resolved before delivery.
    logisticsEvents.push(...deliverEquipmentShipments(s),...deliverArtilleryTransfers(s));advanceMerchants(s,isSupplied);
    receiveDueHires(s,joinArrivals);synchronizeSquad(s);synchronizeCampaignPresence(s);synchronizeDialogueMovements(s);progress(s);
    assignmentEvents.push(...recordSleepEvents(s,prepareSleep(s,rosterFor(s),assignmentContext(s,options))));
    // Finish every hourly subsystem before stopping an explicit wait. Travel
    // and tactical synchronization must process their complete durations.
    const assignmentPause=options.pauseOnAssignments&&pauseForAssignments(s,hours,i+1,assignmentEvents);
    const contractPause=options.pauseOnAssignments&&pauseForContracts(s,hours,i+1,contractEvents);
    const logisticsPause=options.pauseOnAssignments&&pauseForLogistics(s,hours,i+1,logisticsEvents);
    if(!options.pauseOnAssignments)reconcileLogisticsAttention(s,{isSupplied});
    if(stopOnDefeat&&s.defeated||s.completed&&s.squads.some(q=>q.journey)||s.pendingEncounter&&!s.pendingBattle&&!options.traveling||assignmentPause||contractPause||logisticsPause||options.pauseOnAssignments&&travelAttention)break;
  }
}
function travelPath(s,from,to){
  const queue=[[from]],seen=new Set([from]);while(queue.length){const path=queue.shift(),last=path.at(-1);if(last===to)return path;for(const id of sector(last).neighbors)if(!seen.has(id)&&s.sectors[id].owner==='patriot'){seen.add(id);queue.push([...path,id]);}}return null;
}
function prepareAttack(s,at,origin,ids,assaultSquads=null){
 if(at!=='san_lorenzo')haltEnemyGroupsAt(s,at,'stationed');
 const san=at==='san_lorenzo',def=san?{id:at,name:'Combate de San Lorenzo',biome:'river',theater:'coast'}:sector(at);
  const allocated={},sources=assaultSquads??[{origin,members:ids}];
  for(const group of sources)Object.assign(allocated,prepareCampaignAmmunition(s,rosterFor(s),group.members,{at:group.origin,supplied:isSupplied(s,group.origin),commit:true}).allocation);

        s.pendingBattle={id:`${at}-${s.hour}-${s.seed}`,origin,sector:at,hour:s.hour,secondOfHour:s.secondOfHour??0,name:def.name,biome:def.biome,theater:def.theater,seed:Math.floor(random(s)*4294967296),issuedCartridges:Object.values(allocated).reduce((sum,u)=>sum+u.loaded+u.ammo,0),wasRoyalist:!san&&s.sectors[at].owner==='royalist',npcs:encountersFor(s,at),detainedPrisoners:detentionManifest(s,rosterFor(s),at),squad:ids.map(id=>({...deploymentOperative(s,id),...deploymentMorale(s,id),...allocated[id],...(mountForOperative(s.horseState,id)??{horse:false,canMount:false})})),difficulty:san?2:Math.min(4,1+Math.floor(s.hour/240)+(def.theater==='north'?1:0)),...regionalConditions(at,s.hour),cannons:artilleryCount(s)};s.pendingBattle.artillery=deployedArtillery({...s,location:origin});Object.assign(s.pendingBattle,oppositionFor({...s.pendingBattle,...(san?(assaultSquads?{squad:s.pendingBattle.squad.slice(0,6)}:{}):{enemyCount:campaignEnemyCount(s)})},s));const occupying=san?[]:occupyingGroups(s,at);if(occupying.length){s.pendingBattle.occupationGroupIds=occupying.map(g=>g.id);s.pendingBattle.enemies=occupying.flatMap(g=>clone(g.units));}if(san){recordStrategicArrival(s,ids,origin,at);s.pendingBattle.missionId='san_lorenzo';s.pendingBattle.missionAllies=[sanLorenzoAlly(s)];}s.pendingBattle.garrison=prepareGarrison(s,at);s.pendingBattle.garrisonLootSources=(s.sectorStates[at]?.units??[]).filter(u=>u.militia&&u.hp<=0).map(ammunitionSource);note(s,`El destacamento se despliega para ${def.name}. Mando enemigo: ${s.pendingBattle.enemyCommander}.`);
  if(assaultSquads)s.pendingBattle.assaultSquads=clone(assaultSquads);
}
export function dispatchCampaign(previous,action){
  const s=migrateSquads(clone(previous));s.lastError=null;s.militiaTraining??=[];s.missions??={};s.sceneStates??={};s.missionAllies??={};s.quests??={};migrateContracts(s);
  try{
    initializeCampaignSystems(s);
    requireThat(action&&typeof action.type==='string','La orden no es válida.');
    if(action.sectorState){validateCampaignPatrol(s,action.sectorState);validateCampaignArtilleryProfiles(s,action.sectorState);validateArtilleryReport(s.pendingBattle,action.sectorState);}
    requireThat(!s.defeated||s.pendingBattle&&['syncTacticalTime','leaveSector','battleResult'].includes(action.type),'La campaña ha terminado. Inicia otra campaña para continuar.');
    requireThat(!s.completed||['syncTacticalTime','wait','setSleep','assignCare','assignWork','purchaseToolkits','purchaseMedicalSupplies','purchaseAmmunition','purchaseGrenades','horseAction','travel','cancelTravel','resumeTravel','beginAssault','visitSector','leaveSector','talkNPC','createSquad','selectSquad','squad','equip','resupply','repairWeapon','purchaseEquipment','purchaseUsedEquipment','sellEquipment','exchangeEquipment','sellArtillery','purchaseUsedArtillery','ammunition','unloadAmmunition','selectAmmunitionLoad','configureArtillery','repurchaseArtillery','resupplyArtillery','redirectHire','cancelHireArrival','sectorInventory','supplyArtillery','transportArtillery','transport','militia','cancelMilitia','transferMilitia','distributeMilitia','renewContract','dismiss'].includes(action.type),'La campaña está ganada. Puedes recorrer las provincias y atender a tus escuadras y estancias.');
    requireThat(!s.pendingEncounter||['respondToEncounter','selectSquad'].includes(action.type),'Hay un encuentro pendiente. Elegí cómo responder antes de continuar.');
    requireThat(!s.pendingBattle||['battleResult','leaveSector','talkNPC','finishMission','syncTacticalTime'].includes(action.type),'Hay una batalla pendiente. Resuélvela antes de dar nuevas órdenes.');
    if(['travel','attack','visitSector','visitMission'].includes(action.type))requireThat(!s.squad.some(id=>militiaAssignment(s,id)),'Un instructor de la escuadra está asignado a las milicias. Cancelá su curso o dejalo en una escuadra de guarnición.');
    if(['travel','attack','visitSector','visitMission'].includes(action.type))requireThat(s.squad.every(id=>s.operativeState[id].assignment==='active'),'Hay combatientes en atención o descanso. Devolvelos al servicio o dejalos en otra escuadra antes de marchar.');
    if(['travel','attack','visitSector','visitMission'].includes(action.type)){
      requireThat(!s.squad.some(id=>s.operativeState[id].asleep&&needsCollapseRecovery(s.operativeState[id])),'La escuadra necesita descansar: hay combatientes que todavía no pueden despertar.');
      requireThat(s.squad.every(id=>!s.operativeState[id].asleep),'Hay combatientes durmiendo. Despertalos o dejalos en otra escuadra antes de marchar.');
    }
    if(['travel','attack','visitSector','visitMission'].includes(action.type))requireThat(!activeSquad(s).journey,'Terminá o cancelá la ruta antes de entrar en un sector.');
    const targetId=Number(action.operativeId??action.trainerId??(action.type==='dismiss'?action.id:NaN));
    if(Number.isFinite(targetId))requireThat(!operativeInTransit(s,targetId),'El combatiente está en camino. Esperá su llegada.');
    if(['squad','recruitCivic','createOfficer'].includes(action.type))requireThat(!activeSquad(s).journey,'Esperá la llegada o cancelá la ruta antes de reorganizar la escuadra.');
    switch(action.type){
      case 'sectorInventory':note(s,moveSectorItem(s,action,rosterFor(s)));break;
      case 'respondToEncounter':{
        const encounter=s.pendingEncounter,group=s.enemyGroups.find(g=>g.id===action.groupId);requireThat(encounter&&group&&encounter.groupId===group.id&&group.status==='waiting','El encuentro ya no está pendiente.');requireThat(['tactical','auto','retreat'].includes(action.choice),'La respuesta al encuentro es inválida.');
        if(action.choice==='retreat'){
          const ids=localDefenderIds(s,group.target),exits=retreatDestinations(s,group.target);requireThat(ids.length&&exits.includes(action.destination),'No hay una ruta de retirada disponible para los granaderos.');relocateDefenders(s,ids,action.destination);s.pendingEncounter=null;
          if(s.sectors[group.target].militia.some(n=>n>0))resolveDefenseAutomatically(s,prepareDefense(s,group,{excludeMercs:true}));
          else {loseSectorToGroup(s,group);addDefenseHistory(s,group,'retreat',[],`Los granaderos abandonan ${sector(group.target).name} y llegan a ${sector(action.destination).name}.`);note(s,s.encounterHistory[0].text);}
        }else {const request=prepareDefense(s,group);if(action.choice==='auto')resolveDefenseAutomatically(s,request);else note(s,`La defensa de ${sector(group.target).name} espera órdenes en el sector táctico.`);}break;
      }
      case 'setSleep':{
        const op=rosterFor(s).find(o=>o.id===Number(action.operativeId));requireThat(op,'El combatiente no existe.');setSleep(s,op.id,action.asleep);note(s,`${op.name}: ${action.asleep?'se acuesta; conserva su asignación':'se despierta'}.`);break;
      }
      case 'assignWork':{
        const roster=rosterFor(s),op=roster.find(o=>o.id===Number(action.operativeId));requireThat(op,'El combatiente no existe.');assignWork(s,op,action,roster);note(s,`${op.name}: ${WORK_ASSIGNMENTS[action.assignment].toLowerCase()}.`);break;
      }
      case 'purchaseToolkits':{
        const id=Number(action.operativeId),quantity=action.quantity??1,record=s.operativeState[id];
        requireThat(s.recruited.includes(id)&&record.alive&&operativeLocation(s,id)===s.location,'El combatiente debe estar presente en esta localidad.');
        requireThat(hasWorkshop(s,s.location)&&worldOwner(s,s.location)==='patriot'&&isSupplied(s,s.location),'Las herramientas se compran en una maestranza propia y abastecida.');
        requireThat(Number.isInteger(quantity)&&quantity>=1&&quantity<=20&&record.toolkitPoints+quantity*TOOLKIT_POINTS<=100000,'Elegí entre 1 y 20 juegos de herramientas.');pay(s,{treasury:TOOLKIT_PRICE*quantity});record.toolkitPoints+=TOOLKIT_POINTS*quantity;note(s,`La maestranza entrega ${TOOLKIT_POINTS*quantity} puntos de herramientas.`);break;
      }
      case 'purchaseAmmunition':{
        const op=rosterFor(s).find(o=>o.id===Number(action.operativeId)),family=action.family??Object.values(AMMUNITION_FAMILIES).find(f=>f.type===action.ammoType)?.id,quantity=action.quantity??1;
        const quote=moveCampaignAmmunition(s,op,family,quantity,'buy',isSupplied(s,s.location));note(s,`${op.name} compra ${quantity} cartuchos por ${quote.cost} pesos.`);break;
      }
      case 'purchaseGrenades':{
        requireThat(action.grenadeType==='arsenal','El tipo de granada no está disponible.');
        const op=rosterFor(s).find(o=>o.id===Number(action.operativeId));note(s,purchaseGrenades(s,op,isSupplied,action.quantity??1));break;
      }
      // Compatibility with older clients: readiness is automatic and has no funding cost.
      case 'horseAction':{
        const order=action.order;requireThat(order&&['acquire','hire','feed','assign','unassign','breed'].includes(order.type),'La orden de caballada es inválida.');
        requireThat(s.sectors[s.location]?.owner==='patriot','La caballada requiere una localidad segura.');
        if(order.name!==undefined)requireThat(typeof order.name==='string'&&order.name.trim().length>0&&order.name.length<=30&&!/[<>]/.test(order.name),'El nombre de la montura es inválido.');
        if(order.horseId)requireThat(s.horseState?.horses.some(h=>h.id===order.horseId&&h.location===s.location),'La montura está en otra localidad.');
        if(order.type==='assign')requireThat(s.recruited.includes(order.operativeId)&&s.operativeState[order.operativeId].alive&&operativeLocation(s,order.operativeId)===s.location,'El jinete debe estar presente en la localidad.');
        requireThat(!operativeInTransit(s,order.operativeId)&&!s.horseState.horses.some(h=>[order.horseId,order.sireId].includes(h.id)&&operativeInTransit(s,h.assignedTo)),'La montura o su jinete están en camino.');
        const horses=applyHorseAction(s.horseState,{...order,location:s.location,funds:s.resources.treasury});requireThat(!horses.lastError,horses.lastError);pay(s,{treasury:horses.cost??0});s.horseState=horses;note(s,horses.log[0]??'La orden de caballada quedó cumplida.');break;
      }
      case 'unloadAmmunition':{unloadOwnedCampaignAmmunition(s,rosterFor(s).find(o=>o.id===action.operativeId));break;}
      case 'selectAmmunitionLoad':{selectCampaignAmmunitionLoad(s,rosterFor(s).find(o=>o.id===action.operativeId),action.family);break;}
      case 'ammunition':{
        const op=rosterFor(s).find(o=>o.id===Number(action.operativeId));
        const quote=moveCampaignAmmunition(s,op,action.family,action.quantity,action.direction,isSupplied(s,s.location));
        note(s,`${op.name}: ${action.quantity} cartuchos ${action.direction==='buy'?`comprados por ${quote.cost} pesos`:action.direction==='store'?'guardados en el sector':'retirados del sector'}.`);break;
      }
      case 'syncTacticalTime':{
        requireThat(s.pendingBattle&&s.pendingBattle.id===action.battleId,'El reloj no corresponde al despliegue.');
        const elapsed=action.elapsedSeconds,previous=s.pendingBattle.syncedSeconds??0;
        requireThat(Number.isSafeInteger(elapsed)&&elapsed>=previous&&elapsed-previous<=864000,'El tiempo táctico es inválido.');
        const snapshot=action.sectorState===undefined?null:validatedInteractionSnapshot(s,action.sectorState);
        if(snapshot)requireThat(snapshot.elapsedSeconds===elapsed,'El parte y el reloj no coinciden.');
        // Split at real hour boundaries. Off-screen wounds advance for the
        // exact delta; the loaded scene has already consumed its own time.
        for(let remaining=elapsed-previous;remaining>0;){
          const step=Math.min(remaining,3600-(s.secondOfHour??0));remaining-=step;
          s.secondOfHour=(s.secondOfHour??0)+step;
          if(s.secondOfHour===3600){s.secondOfHour=0;tick(s,1,{stopOnDefeat:false,civilianSeconds:step});}
          else advanceOffscreenTime(s,step);
        }
        // A death is confirmed at this tactical checkpoint, after its time has elapsed.
        if(snapshot){acknowledgeCivilians(s,snapshot);acknowledgeNpcGifts(s,snapshot);acknowledgeSuccessionDeaths(s,snapshot);if(campaignStory(s))advanceCampaignStory(s,snapshot);}
        s.pendingBattle.syncedSeconds=elapsed;delete s.pendingBattle.resumeSnapshot;break;
      }
      case 'repurchaseArtillery':{const quote=repurchaseArtillery(s,action.artilleryId,isSupplied(s,s.location));note(s,`Se recupera la pieza del taller por ${quote.price} pesos. Queda en el depósito local con su munición.`);break;}
      case 'purchaseUsedArtillery':{const quote=tradeArtillery(s,action,isSupplied);note(s,`Se recupera la pieza del taller por ${quote.price} pesos. Queda en el depósito local con su munición.`);break;}
      case 'resupplyArtillery':{
        const quote=artillerySupplyQuote(s,action.sector,action.artilleryId,isSupplied(s,s.location));requireThat(quote.available,quote.reason);pay(s,{treasury:quote.cost});const gun=s.sectorStates[action.sector].artillery.find(g=>g.id===action.artilleryId);gun.ammo++;note(s,`Se compra una munición de artillería por ${quote.cost} pesos. Queda en reserva junto a la pieza.`);break;
      }
      case 'wait':tick(s,action.hours??24,{pauseOnAssignments:true});break;
      case 'assignCare':{const op=rosterFor(s).find(o=>o.id===Number(action.operativeId??action.id));requireThat(op,'El combatiente no existe.');assignMedicalCare(s,op,action.assignment);note(s,`${op.name}: ${CARE_ASSIGNMENTS[action.assignment]}.`);break;}

      case 'purchaseMedicalSupplies':{
        const op=rosterFor(s).find(o=>o.id===Number(action.operativeId??action.id)),quantity=action.quantity===undefined?1:action.quantity,quote=medicalSupplyQuote(s,op,quantity,isSupplied(s,s.location));requireThat(quote.available,quote.reason);
        requireThat(quantity<=medicalSupplyStock(s),'La maestranza no tiene suficientes vendas.');pay(s,{treasury:quote.cost});s.operativeState[op.id].medkits=(s.operativeState[op.id].medkits??2)+quantity;s.merchants[s.location].supplies.medkits-=quantity;changeMerchantCash(s,s.location,quote.cost);note(s,`${op.name} compra ${quantity} vendas por ${quote.cost} pesos.`);break;
      }
      case 'academy':requireThat(s.flags.academy||hasReadyCombatant(s),'Contratá un combatiente o creá tu granadero para comenzar.');break;
      case 'purchaseEquipment':{
        const item=equipmentCatalogItem(action.item,s),quantity=action.quantity??1;
        requireThat(item&&Number.isInteger(quantity)&&quantity>0&&quantity<=100,'El pedido de armamento es inválido.');
        const market=merchantStatus(s,item,isSupplied);requireThat(market.available,market.reason);requireThat(quantity<=market.stock,'El comerciante no tiene suficientes existencias.');
        const merchant=s.merchants[market.sector];
        if(isImportedEquipment(item)){s.equipmentShipments??=[];requireThat(s.equipmentShipments.length<1000,'Hay demasiados pedidos pendientes.');pay(s,{treasury:tradeQuote(s,item.price)*quantity});merchant.stock[item.item]-=quantity;const rules=importRulesFor(s),delay=rules.minHours+Math.floor(random(s)*(rules.maxHours-rules.minHours+1));s.equipmentShipments.push({item:item.item,quantity,due:s.hour+delay});note(s,`Pedido de ${quantity} × ${item.name}: arribo en ${delay} horas, sujeto al bloqueo.`);break;}
        pay(s,{treasury:item.price*quantity});addEquipment(s,item.stockKey??item.item,quantity);merchant.stock[item.stockKey??item.item]-=quantity;merchant.cash=Math.min(1000000000,merchant.cash+item.price*quantity);
        note(s,`La sala de armas entrega ${quantity} × ${item.name}.`);break;
      }
      case 'sellEquipment':{
        const instance=s.armoryItems.find(item=>item.id===action.instanceId);requireThat(instance,'Ese ejemplar ya no está disponible en la armería.');
        const market=merchantStatus(s,null,isSupplied);requireThat(market.available,market.reason);
        const quote=resaleBreakdown(instance,s.location);requireThat(!quote.reason,quote.reason);const price=quote.total;requireThat(price>0,'El comerciante no compra armas sin valor de servicio.');const merchant=s.merchants[s.location];requireThat(merchant.cash>=price,'El comerciante no tiene fondos suficientes; su caja se repone con el tiempo.');
        requireThat((merchant.usedItems?.length??0)<USED_EQUIPMENT_LIMIT,'El comerciante no puede guardar más armas usadas.');
        merchant.usedItems??=[];merchant.usedItems.push(takeEquipment(s,instance.item,instance.id));merchant.cash-=price;s.resources.treasury+=price;note(s,`Se vende ${equipmentLabel(instance)}, estado ${instance.condition}%, por ${price} pesos.`);break;
      }
      case 'purchaseUsedEquipment':{
        requireThat(action.sector===s.location,'Debes estar en la maestranza que ofrece ese ejemplar.');
        const offer=usedEquipmentOffers(s,isSupplied).find(offer=>offer.instance.id===action.instanceId);
        requireThat(offer,'Ese ejemplar ya no está disponible en el comercio.');requireThat(offer.available,offer.reason);
        const merchant=s.merchants[s.location],index=merchant.usedItems.findIndex(item=>item.id===action.instanceId);
        pay(s,{treasury:offer.quote.total});const [instance]=merchant.usedItems.splice(index,1);
        s.armoryItems.push(instance);const key=equipmentKey(instance);s.armory[key]=(s.armory[key]??0)+1;
        merchant.cash=Math.min(1000000000,merchant.cash+offer.quote.total);
        note(s,`Se compra ${equipmentLabel(instance)} usado, estado ${instance.condition}%, por ${offer.quote.total} pesos.`);break;
      }
      case 'sellArtillery':{const q=tradeArtillery(s,action,isSupplied);note(s,`El taller compra la pieza por ${q.price} pesos y conserva su munición.`);break;}
      case 'exchangeEquipment':{const plan=exchangeMerchantEquipment(s,action,isSupplied);note(s,`Intercambio completado: ${plan.sales} pesos entregados en equipo, ${plan.purchases} pesos recibidos en equipo. ${plan.net>0?`Se pagan ${plan.net}`:plan.net<0?`Se cobran ${-plan.net}`:'Saldo de 0'} pesos.`);break;}
      case 'transportArtillery':{const q=queueArtilleryTransport(s,action);note(s,`La pieza parte hacia ${sector(q.to).name}. Envío: ${q.cost} pesos. Llegada prevista en ${q.hours} horas si la ruta sigue abierta.`);break;}
      case 'supplyArtillery':{const delivered=supplyStationedArtillery(s,action,isSupplied);note(s,`La pieza recibe ${delivered.count} municiones de reserva. Debe cargarse en el campo.`);break;}
      case 'configureArtillery':{
        const types=action.types,reason=artillerySelectionReason(s,types);requireThat(!reason,reason);
        s.artillerySelection=[...types];s.artillerySelectionExplicit=true;note(s,types.length?'La batería prepara las piezas elegidas para la próxima operación.':'La próxima operación saldrá sin piezas de artillería.');break;
      }
      case 'equip':{
        const op=rosterFor(s).find(o=>o.id===Number(action.operativeId));requireThat(op&&s.recruited.includes(op.id)&&s.operativeState[op.id].alive,'El combatiente no está disponible.');
        requireThat(operativeLocation(s,op.id)===s.location,'El combatiente debe estar presente para recibir el arma.');
        const item=equipArmoryItem(s,op,action);note(s,`${op.name} recibe ${equipmentLabel(item)}.`);break;
      }
      case 'resupply':case 'repairWeapon':{
        const id=Number(action.operativeId),op=rosterFor(s).find(o=>o.id===id),record=s.operativeState[id],quote=workshopServiceQuote(s,op,action.type,isSupplied(s,s.location));
        requireThat(quote.available,quote.reason);const cost=quote.cost;pay(s,{treasury:cost});
        if(action.type==='resupply'){record.rations=Math.max(2,record.rations??2);record.torches=Math.max(2,record.torches??2);record.medkits=Math.max(2,record.medkits??2);note(s,`${op.name} recibe vendas, antorchas y raciones por ${cost} pesos.`);}else{record.condition=100;note(s,`La maestranza repara el arma de ${op.name} por ${cost} pesos.`);}break;
      }
      case 'createOfficer':{
        requireThat(!s.officer,'El Cabildo ya ha designado a tu oficial.');requireThat(s.sectors[headquartersFor(s)].owner==='patriot',`El cuartel de ${headquartersName(s)} está ocupado.`);
        const op=createOfficerRecord(action.name,action.answers,action.profile);const creationCost=action.profile?.version===2?0:300;pay(s,{treasury:creationCost});s.officer={name:op.name,answers:clone(action.answers),...(action.profile?{profile:clone(action.profile)}:{})};s.contracts[op.id]={kind:'patriot',term:'month',started:s.hour,expiresAt:null,paid:creationCost};s.operativeState[op.id]={hp:op.maxHp,fatigue:0,alive:true,xp:0,rations:2,torches:2,condition:100};s.recruited.push(op.id);issueInitialOutfit(s,op.id);s.operativeState[op.id].location=s.location;if(s.squad.length<6)s.squad.push(op.id);note(s,`${op.name} aprueba el examen y recibe su comisión de oficial.`);break;
      }
      case 'recruitCivic':{
        const id=Number(action.id),status=civicStatus(s,id);requireThat(status.available,status.reason);
        const options=hiringArrivalOptions(s),destination=action.destination??(options.some(o=>o.id===s.location)?s.location:options[0]?.id);
        const reason=hiringArrivalReason(s,destination);requireThat(!reason,reason);
        const op=rosterFor(s).find(o=>o.id===id),term=action.term??'day',quote=contractQuote(s,op,term);
        requireThat(quote.available,quote.reason);pay(s,{treasury:quote.price});
        const arrival=hireArrivalOrder(s,op,term,quote,destination);
        if(arrival.travelHours){s.hiringArrivals??=[];s.hiringArrivals.push(arrival);note(s,`${op.name} viaja a ${sector(destination).name}. Llegada prevista en ${arrival.travelHours} horas; el contrato empieza al llegar.`);}
        else receiveHire(s,arrival);
        break;
      }
      case 'redirectHire':redirectHire(s,action.id,action.destination);note(s,'Se cambia el destino de llegada. El viaje comienza de nuevo, sin otro pago.');break;
      case 'cancelHireArrival':cancelHireArrival(s,action.id);note(s,'Se cancela la llegada y se devuelve el anticipo.');break;
      case 'recruit':throw Error('Los oficiales históricos se incorporan mediante encuentros personales.');
      case 'renewContract':{
        const id=Number(action.id),op=rosterFor(s).find(o=>o.id===id),current=s.contracts[id];requireThat(op&&s.recruited.includes(id)&&current,'El combatiente no tiene un contrato activo.');requireThat(action.expectedExpiresAt===undefined||action.expectedExpiresAt===current.expiresAt,'El contrato cambió. Revisá la nueva fecha antes de renovar.');requireThat(current.kind!=='patriot','Este oficial sirve por la causa y no necesita renovación.');const quote=contractQuote(s,op,action.term??'day');requireThat(quote.available,quote.reason);pay(s,{treasury:quote.price});s.contracts[id]={kind:'paid',term:action.term??'day',started:s.hour,expiresAt:quote.expiresAt,paid:quote.price};recordPayMorale(s,[id],true);note(s,`${op.name} renueva su servicio por ${quote.hours/24} días.`);break;
      }
      case 'dismiss':{const id=Number(action.id);requireThat(s.recruited.includes(id),'El combatiente no está contratado.');requireThat(id!==1000,'Tu oficial dirige la campaña y no puede ser despedido.');removeFromService(s,id);note(s,'El combatiente deja el servicio sin devolución del anticipo.');break;}
      case 'createSquad':case 'squad':{
        const creating=action.type==='createSquad',at=creating?(action.sector??s.location):s.location,ids=action.ids;
        requireThat(validWorldLocation(at),'El sector de formación no existe.');
        requireThat(Array.isArray(ids)&&ids.length>0&&ids.length<=6&&new Set(ids).size===ids.length&&ids.every(id=>canReassignOperative(s,id)),'Seleccioná entre uno y seis combatientes disponibles, sin una ruta pendiente.');
        requireThat(ids.every(id=>operativeLocation(s,id)===at),'Los combatientes deben reunirse en el mismo sector antes de cambiar de escuadra.');
        if(creating){requireThat(canCreateSquad(s),'El ejército ya tiene ocho escuadras ocupadas.');requireThat(typeof action.name==='string'&&action.name.trim().length>=2&&action.name.trim().length<=30&&!/[<>]/.test(action.name),'Escribí un nombre de escuadra de entre 2 y 30 caracteres.');}
        // Leave all other members at their actual location before selecting the
        // newly formed squad. Other squads and their routes stay in place.
        if(!creating)for(const id of s.squad)if(!ids.includes(id))s.operativeState[id].location=s.location;
        for(const squad of s.squads)if(squad.id!==s.activeSquadId||creating){squad.members=squad.members.filter(id=>!ids.includes(id));if(!squad.members.length)delete squad.journey;}
        if(creating){const id=`squad-${Math.max(0,...s.squads.map(q=>Number(q.id.split('-')[1])))+1}`;if(s.squads.length>=8){const vacant=vacantSquad(s);s.squads=s.squads.filter(q=>q!==vacant);}s.squads.push({id,name:action.name.trim(),members:[...ids],location:at});s.activeSquadId=id;s.location=at;}
        s.squad=[...ids];break;
      }
      case 'selectSquad':{const squad=s.squads.find(q=>q.id===action.id);requireThat(squad,'La escuadra no existe.');s.activeSquadId=squad.id;s.squad=[...squad.members];s.location=squad.location;break;}
      case 'talkNPC':{
        requireThat(s.pendingBattle,'Primero entrá al sector.');const snapshot=validateSectorSnapshot(action.sectorState),npc=(s.pendingBattle.sceneId==='yatasto'?missionContacts(s):encountersFor(s,s.pendingBattle.sector)).find(n=>n.id===action.npcId&&n.sector===s.pendingBattle.sector),id=Number(action.unitId),actor=rosterFor(s).find(o=>o.id===id),unit=snapshot.units.find(u=>u.side==='player'&&Number(u.id)===id),local=snapshot.npcs?.find(n=>n.id===action.npcId);
        acknowledgeCivilians(s,snapshot);requireThat(npc&&actor&&unit&&local&&(local.hp??100)>0&&!local.unconscious&&s.squad.includes(id)&&unit.hp>0&&!unit.unconscious,'El interlocutor no está disponible en este sector.');requireThat(snapshot.mode==='exploration'||snapshot.status==='victory'||snapshot.sectorCleared,'Terminá el combate antes de conversar.');requireThat(Number.isInteger(local.x)&&Number.isInteger(local.y)&&Math.abs(unit.x-local.x)+Math.abs(unit.y-local.y)<=1,'Acercá al combatiente al interlocutor para hablar.');
        requireThat(['repeat','friendly','direct','recruit','quest','mission','dialogue','escortFollow','escortWait'].includes(action.approach),'La forma de dirigirse al interlocutor es inválida.');
        const unavailable=dialogueReason(snapshot,unit,{...npc,...local},{visible:canSee(snapshot,unit,local)});requireThat(!unavailable,unavailable);
        const quest=questForNPC(s,npc.id),authored=hasAuthoredDialogue(npc);
        requireThat(action.approach==='dialogue'?Boolean(dialogueForNPC(s,npc)):authored?dialogueOptions(npc,quest).some(([option])=>option===action.approach):action.approach==='friendly','Este interlocutor no ofrece esa conversación.');
        let text=(authored?npc.greeting:ambientReply(local,s.conversations?.[npc.id]?1:0))+(quest&&!['completed','failed'].includes(quest.status)?` ${quest.offer}`:''),outcome='conversation',dialogue=null;
        if(action.approach==='repeat'){text=s.conversations?.[npc.id]?.text??npc.greeting;outcome='repeated';}
        if(action.approach==='dialogue'){dialogue=chooseDialogue(s,npc,action.dialogueChoice,action.dialogueNode,snapshot);text=dialogue.text;outcome='dialogue';if(dialogue.effect?.applied){if(dialogue.effect.amount)note(s,`${npc.name}: ${dialogue.effect.amount>0?'entrega':'recibe'} ${Math.abs(dialogue.effect.amount)} pesos.`);if(dialogue.effect.movement)note(s,dialogue.effect.movement.destination==='routine'?`${npc.name} termina el encuentro con ${dialogue.effect.movement.name}.`:`${npc.name} llama a ${dialogue.effect.movement.name} para un encuentro en este sector.`);if(dialogue.effect.quest)note(s,`Encargo «${dialogue.effect.quest.title}»: ${dialogue.effect.quest.status==='active'?'en curso':dialogue.effect.quest.status==='completed'?'completado':'fallido'}.`);}}
        if(action.approach==='direct'){
          const hireTerms=encounterHireTerms(s,npc),gate=recruitmentStatus(s,npc.operativeId,true);
          const reason=encounterRequirements(s,npc,actor)||(!gate.available?gate.reason:null);
          const service=hireTerms.length?`Puedo incorporarme por contrato: ${hireTerms.map(q=>`${q.name.toLowerCase()}, ${q.price} pesos`).join('; ')}.`:'Puedo incorporarme sin paga.';
          text=!canRecruitEncounter(npc)?npc.greeting:reason??`Estoy dispuesto a servir. ${service}`;
        }
        if(action.approach==='mission'){requireThat(s.pendingBattle.sceneId==='yatasto','No hay una conferencia pendiente.');text=talkMission(s,npc.id,isSupplied(s,'salta'));outcome='mission';}
        if(['escortFollow','escortWait'].includes(action.approach)){
          requireThat(quest?.escort&&quest.status==='offered','No hay una escolta pendiente.');
          s.quests[quest.id].escortOrder={leaderId:unit.id,waiting:action.approach==='escortWait'};
          text=action.approach==='escortWait'?'Esperaré aquí. Volvé a hablarme cuando podamos seguir.':`Seguiré a ${unit.name} hasta la salida occidental hacia Humahuaca.`;outcome='escortOrder';
        }
        if(action.approach==='quest'){
          requireThat(quest,'Este interlocutor no tiene un encargo pendiente.');requireThat(!['completed','failed'].includes(quest.status),'El encargo ya terminó.');
          if(quest.status==='unoffered'){s.quests[quest.id]={status:'offered',offeredAt:s.hour,completedAt:null,...(quest.escort?{escortOrder:{leaderId:unit.id,waiting:false}}:{})};text=quest.offer;outcome='questOffered';}
          else{
            requireThat(!quest.carried,'Los objetos del encargo se registran cuando el interlocutor los recibe.');requireThat(quest.conditionMet,'Primero asegurá las localidades indicadas en el encargo.');
            const arrival=quest.escort?escortArrival(quest,s.quests[quest.id],snapshot,local,unit):null;
            if(quest.cost)pay(s,quest.cost);if(quest.reward)add(s,{treasury:quest.reward});
            s.quests[quest.id]={...s.quests[quest.id],status:'completed',completedAt:s.hour,...(arrival?{arrival}:{})};recordCityLoyalty(s,{sectorId:quest.sector,kind:'quest',eventId:`npc-${quest.id}`});text=quest.delivery;outcome='questCompleted';note(s,`Encargo cumplido: ${quest.title}.${quest.reward?` Pago recibido: ${quest.reward} pesos.`:' La ciudad reconoce el servicio.'}`);
          }
        }
        if(action.approach==='recruit'){
          requireThat(canRecruitEncounter(npc),'Este habitante no es un recluta.');requireThat(!s.recruited.includes(npc.operativeId),'Este combatiente ya se incorporó.');const reason=encounterRequirements(s,npc,actor);requireThat(!reason,reason);
          const gate=recruitmentStatus(s,npc.operativeId,true);requireThat(gate.available,gate.reason);const op=rosterFor(s).find(o=>o.id===npc.operativeId);signContract(s,op,action.term);s.recruited.push(op.id);transferCivilian(s,local);Object.assign(s.operativeState[op.id],{location:s.location,arrival:null,residentSector:s.pendingBattle.sector,residentScene:s.pendingBattle.sceneId??null});if(s.squad.length<6){s.squad.push(op.id);s.pendingBattle.squad.push({...clone(op),...carriedAmmunition(op,clone(s.operativeState[op.id]))});}const line=s.contentCampaign?speechFor(op,'hired'):'Acepto servir junto a ustedes.';text=`${line?.trim()?line+' ':''}${op.name} se incorpora a la fuerza patriota.`;outcome='recruited';note(s,text);
        }
        s.conversations??={};s.conversations[npc.id]={...s.conversations[npc.id],...(dialogue?{dialogueNode:dialogue.node}:{}),met:true,lastApproach:action.approach,hour:s.hour,text,sector:s.pendingBattle.sector};s.lastConversation={npcId:npc.id,speaker:npc.name,text,outcome,...(dialogue?{dialogueNode:dialogue.node,...(dialogue.effect?{dialogueEffect:dialogue.effect}:{})}:{}),operativeId:npc.operativeId??null,options:[...(dialogueForNPC(s,npc)?['dialogue']:[]),...dialogueOptions(npc,questForNPC(s,npc.id)).map(([option])=>option).filter(option=>option!=='recruit'||canRecruitEncounter(npc)&&!s.recruited.includes(npc.operativeId))]};break;
      }
      case 'visitMission':{
        requireThat(!campaignStory(s),'Esta campaña utiliza sus propios objetivos.');requireThat(action.mission==='yatasto','La escena solicitada no existe.');requireThat(s.location==='tucuman'&&s.phase>=2,'Viajá a Tucumán después de San Lorenzo para acudir a Yatasto.');requireThat(!s.missions.yatasto?.completed,'La conferencia de Yatasto ya concluyó.');
        const entered=dispatchCampaign(s,{type:'visitSector'});requireThat(!entered.lastError,entered.lastError);Object.assign(s,entered);Object.assign(s.pendingBattle,{sceneId:'yatasto',missionId:'yatasto',name:MISSION_SCENES.yatasto.name,npcs:missionContacts(s),garrison:[],artillery:[]});delete s.pendingBattle.exits;prepareDeploymentExits(s,s.pendingBattle);break;
      }
      case 'finishMission':{
        requireThat(s.pendingBattle?.sceneId==='yatasto'&&s.pendingBattle.id===action.battleId,'No hay una conferencia de Yatasto abierta.');requireThat(s.missions.yatasto?.frontier,'Completá los partes, el análisis y el acuerdo de frontera antes de cerrar la conferencia.');
        const result=dispatchCampaign(s,{...action,type:'leaveSector'});requireThat(!result.lastError,result.lastError);Object.assign(s,result);s.missions.yatasto.completed=true;s.missions.yatasto.stage='completed';note(s,'La conferencia de Yatasto concluye. Belgrano entrega el mando y la preparación continental se orienta hacia Cuyo.');break;
      }
      case 'visitSector':{
        requireThat(!occupyingGroups(s,action.sector??s.location).length,'Hay tropas realistas en el sector. Prepará un contraataque.');
        const at=locationId(action.sector??s.location);requireThat(at===s.location,'La escuadra debe viajar al sector antes de entrar.');requireThat(validWorldLocation(at)&&worldOwner(s,at)!=='royalist','El sector está ocupado; prepará un ataque.');requireThat(s.squad.length>0,'La escuadra no tiene combatientes.');const def=campaignPlace(at),{allocation:allocated,issued}=prepareCampaignAmmunition(s,rosterFor(s),s.squad,{at,supplied:isSupplied(s,at),commit:true});
        s.pendingBattle={id:`visit-${at}-${s.hour}-${s.seed}`,sector:at,hour:s.hour,secondOfHour:s.secondOfHour??0,name:def.name,biome:def.biome,theater:def.theater,seed:s.seed,exploration:true,night:s.hour%24<6||s.hour%24>=20,issuedCartridges:issued,ammunitionSources:(s.sectorStates[at]?.units??[]).filter(u=>u.side==='enemy').map(ammunitionSource),wasRoyalist:false,npcs:encountersFor(s,at),detainedPrisoners:detentionManifest(s,rosterFor(s),at),squad:s.squad.map(id=>({...deploymentOperative(s,id),...deploymentMorale(s,id),...allocated[id],...(mountForOperative(s.horseState,id)??{horse:false,canMount:false})})),enemies:[],artillery:[],...regionalConditions(at,s.hour)};s.pendingBattle.garrison=prepareGarrison(s,at);s.pendingBattle.garrisonLootSources=(s.sectorStates[at]?.units??[]).filter(u=>u.militia&&u.hp<=0).map(ammunitionSource);note(s,`La escuadra entra en ${def.name} para reconocer el lugar y hablar con sus habitantes.`);break;
      }
      case 'leaveSector':{
        requireThat(s.pendingBattle?.exploration&&action.battleId===s.pendingBattle.id,'La visita no corresponde al sector abierto.');const visit=s.pendingBattle,{snapshot}=completeDeploymentReport(s,visit,action),outcome=snapshot.status==='retreat'?'retreat':snapshot.status==='defeat'?'defeat':'visit',plan=planDeploymentReturn(s,visit,snapshot,outcome);
        commitDeploymentReturn(s,visit,snapshot,plan);
        s.pendingBattle=null;note(s,'La escuadra vuelve a la carta de operaciones.');break;
      }
      case 'cancelTravel':{const q=s.squads.find(q=>q.id===(action.squadId??s.activeSquadId));cancelSquadTravel(q,action.choice);note(s,`${q.name}: se modifica la ruta de marcha.`);break;}
      case 'resumeTravel':{const q=s.squads.find(q=>q.id===(action.squadId??s.activeSquadId));resumeSquadTravel(s,q);note(s,`${q.name}: retoma la marcha.`);break;}
      case 'travel':{
        if(action.queue===true){const q=activeSquad(s);queueSquadTravel(s,q,{...action,intent:'travel'});note(s,`${q.name}: ruta ordenada hacia ${sector(action.sector).name}. Avanzá el reloj para marchar.`);break;}

        requireThat(!s.squad.some(id=>tooTiredToMarch(s.operativeState[id])),'La escuadra necesita descansar antes de marchar.');
        requireThat(s.squad.length>0,'No hay combatientes en esta escuadra.');
        const destination=locationId(action.sector);requireThat(destination,'El destino no existe.');action={...action,sector:destination};
        if(destination!==s.location)prepareCampaignAmmunition(s,rosterFor(s),s.squad,{supplied:isSupplied(s,s.location),commit:true});
        if(!sector(s.location)||!sector(destination)){
          requireThat((action.mode??'march')==='march','Las postas, carretas y flotillas necesitan una ruta entre localidades. Para esta celda, elegí marcha a pie.');
          const plan=cellTravelPlan(s,destination);requireThat(!plan.reason,plan.reason);requireThat(plan.path.length>1,'La escuadra ya está en esa celda.');
          for(const next of plan.path.slice(1)){
            const reason=cellTravelReason(s,next);if(reason){note(s,`La marcha se detiene: ${reason}`);break;}
            // Consume each leg before changing position. Contract departures
            // remain at the last reached cell; arriving hires never join en route.
            for(let hour=0;hour<cellStepHours(next)&&s.squad.length&&!s.defeated;hour++)tick(s,1,{joinArrivals:false,traveling:[...s.squad],mountain:worldCell(next).biome==='mountain',travelLeg:[s.location,next]});
            if(!s.squad.length||s.defeated){note(s,'La marcha se interrumpe antes de alcanzar la siguiente celda.');break;}
            const blocked=cellTravelReason(s,next);if(blocked){note(s,`La marcha se detiene: ${blocked}`);break;}
            s.location=next;synchronizeSquad(s);
          }
          note(s,`La escuadra queda en ${campaignPlace(s.location).name}.`);break;
        }
        const q=activeSquad(s);queueSquadTravel(s,q,{...action,intent:'travel'});
        for(let hours=0;hours<240&&q.journey?.status==='moving'&&!s.defeated&&!s.pendingEncounter;hours++)tick(s,1,{joinArrivals:false});
        note(s,`La escuadra queda en ${campaignPlace(s.location).name}.`);break;
      }
      case 'transport':{const network=TRANSPORT_NETWORKS.find(n=>n.id===action.mode);requireThat(network,'Transporte desconocido.');requireThat(!s.routes[action.mode],'Ese transporte ya está organizado.');pay(s,{treasury:network.cost});s.routes[action.mode]=true;note(s,'La nueva red de transporte queda disponible.');break;}
      case 'fundArmy':{const f=foundryFor(s);requireThat(s.flags.foundry,`Primero organizá ${f.name}.`);requireThat(!s.flags.armyFunded,'El ejército ya está financiado.');pay(s,{treasury:f.fundingCost});s.flags.armyFunded=true;note(s,`Se abonan ${f.fundingCost} pesos para instruir y equipar al ${f.armyName}.`);break;}
      case 'foundry':{const reason=foundryReason(s);requireThat(!reason,reason);const f=foundryFor(s);requireThat(!s.flags.foundry,`${f.name} ya está organizado.`);pay(s,{treasury:f.setupCost});s.flags.foundry=true;note(s,`${campaignRole(s,'foundryEngineer').name} organiza ${f.name}.`);break;}
      case 'policy':{applyPolicy(s,action.kind);break;}
      case 'diplomacy':{
        const kind=action.kind;
        if(kind==='northPact'){requireThat(s.sectors.salta.owner==='patriot','Libera Salta para reunir su Cabildo.');requireThat(!s.flags.northPact,'El pacto del norte ya está firmado.');pay(s,{treasury:300});s.flags.northPact=true;standing(s,'gauchos',45);note(s,'Güemes acepta custodiar el norte con respeto a la autonomía provincial.');}
        else if(kind==='partisanSupply'){requireThat(s.sectors.tucuman.owner==='patriot','Abre una ruta hacia las partidas del norte.');requireThat(!s.flags.partisanSupply,'Las partidas ya recibieron su entrega.');pay(s,{treasury:250});s.flags.partisanSupply=true;standing(s,'gauchos',20);note(s,'Las partidas reciben cincuenta mosquetes. Azurduy ofrece su colaboración.');}
        else if(kind==='parliament'){requireThat(s.sectors.mendoza.owner==='patriot','El parlamento debe prepararse desde Cuyo.');requireThat(!s.flags.parliament,'Los pasos ya cuentan con un acuerdo.');pay(s,{treasury:200});s.flags.parliament=true;standing(s,'indigenous',60);note(s,'El parlamento acuerda el tránsito y respeta la autonomía pehuenche.');}
        else if(kind==='emancipation'){requireThat(!s.flags.emancipation,'El decreto ya fue proclamado.');pay(s,{treasury:150});s.flags.emancipation=true;standing(s,'pardos',30);standing(s,'directory',5);note(s,'El Cabildo proclama la libertad y garantiza la protección de las familias emancipadas.');}
        else if(kind==='commission'){requireThat(s.flags.emancipation,'Primero garantiza la emancipación.');requireThat(!s.flags.commission,'Las comisiones ya fueron otorgadas.');pay(s,{treasury:100});s.flags.commission=true;standing(s,'pardos',20);note(s,'Los batallones de Pardos y Morenos reciben comisiones de oficiales.');}
        else if(kind==='gift'){pay(s,{treasury:80});standing(s,'indigenous',15);note(s,'Una comitiva entrega presentes y renueva los acuerdos de frontera.');}
        else if(kind==='requisition'){requireThat(sector(s.location),'La contribución se solicita en el sector principal de una localidad.');requireThat(policyStatus(s).requisitionReady,'Las estancias necesitan catorce días para recuperarse.');s.politics??={};s.politics.requisitionAfter=s.hour+336;add(s,{treasury:200});standing(s,'gauchos',-20);standing(s,'directory',-10);s.sectors[s.location].loyalty=Math.max(0,s.sectors[s.location].loyalty-20);note(s,'La requisa abastece al ejército, pero provoca rechazo en la población.');}
        else if(kind==='autonomy'){pay(s,{treasury:80});standing(s,'gauchos',15);standing(s,'directory',-3);note(s,'El ejército reconoce las autoridades provinciales.');}
        else throw Error('No existe esa propuesta diplomática.');break;
      }
      case 'transferMilitia':case 'distributeMilitia':note(s,redistributeMilitia(s,action));break;
      case 'militia':{
        const at=action.sector??s.location,rank=Number(action.rank??0),trainerId=Number(action.trainerId),trainer=rosterFor(s).find(o=>o.id===trainerId);
        requireThat(s.sectors[at]?.owner==='patriot'&&isSupplied(s,at),'La instrucción necesita un sector propio y abastecido.');requireThat([0,1].includes(rank),'Los veteranos ascienden por experiencia de combate, no por instrucción.');const eligibility=militiaEligibility(s,at);requireThat(eligibility.eligible,eligibility.reason);
        requireThat(trainer&&s.recruited.includes(trainerId)&&s.operativeState[trainerId]?.alive&&operativeLocation(s,trainerId)===at,'Elegí un instructor contratado y presente en el sector.');
        requireThat(trainer.leadership>=30,'El instructor necesita al menos 30 de liderazgo.');requireThat(!careAssignmentBusy(s.operativeState[trainerId]?.assignment),'Poné al combatiente en servicio antes de asignarlo a las milicias.');requireThat(!militiaAssignment(s,trainerId),'El instructor ya dirige otro curso.');requireThat(!s.militiaTraining.some(t=>t.sector===at),'Ya hay un curso activo en ese sector.');
        const region=s.sectors[at];requireThat(rank===0||region.militia[rank-1]>=MILITIA_COHORT,'La promoción necesita tres milicianos del grado anterior.');requireThat(rank>0||region.militia.reduce((a,b)=>a+b,0)+MILITIA_COHORT<=MILITIA_LIMIT,'La guarnición admite hasta sesenta milicianos.');
        const course=militiaCourse(trainer,rank);pay(s,course.cost);const trainees=rank>0?reserveMilitiaTrainees(s,at,rank,course.count):undefined;if(rank>0)region.militia[rank-1]-=course.count;
        s.militiaTraining.push({...(trainees?{trainees}:{}),sector:at,rank,trainerId,count:course.count,remaining:course.hours,duration:course.hours,started:s.hour});note(s,`${trainer.name} inicia un curso de milicias de ${course.hours} horas en ${sector(at).name}.`);break;
      }
      case 'cancelMilitia':{
        const course=s.militiaTraining.find(t=>t.sector===action.sector);requireThat(course,'No hay un curso activo en ese sector.');returnMilitiaTrainees(s,course);s.militiaTraining=s.militiaTraining.filter(t=>t!==course);note(s,'Se suspende el curso. Los soldados regresan a su grado anterior; los suministros de instrucción ya se consumieron.');break;
      }
      case 'fortify':{const at=action.sector??s.location;requireThat(s.sectors[at]?.owner==='patriot','Solo puedes fortificar sectores propios.');requireThat(s.sectors[at].fort<3,'El sector ya tiene la máxima fortificación.');pay(s,{treasury:150});s.sectors[at].fort++;note(s,`Se refuerzan las defensas de ${sector(at).name}.`);break;}
      case 'beginAssault':{
        const at=action.sector,groups=readyAssaultSquads(s,at),origin=groups[0].location,manifest=arriveForAssault(s,groups,at),ids=manifest.flatMap(q=>q.members);haltEnemyGroupsAt(s,at,'stationed');
        if(s.sectors[at].owner==='patriot'&&!occupyingGroups(s,at).length&&!(s.blockade&&sector(at).theater==='coast')){for(const id of ids)if(s.contracts[id]?.departurePending)removeFromService(s,id);note(s,`Las escuadras entran en ${sector(at).name}; el sector ya está libre.`);break;}
        prepareAttack(s,at,origin,ids,manifest);break;
      }
      case 'attack':{
        const at=action.sector??'san_lorenzo',san=at==='san_lorenzo',def=san?{id:at,name:'Combate de San Lorenzo',biome:'river',theater:'coast'}:sector(at);
        requireThat(at===s.location||!s.squad.some(id=>tooTiredToMarch(s.operativeState[id])),'La escuadra necesita descansar antes de atacar.');
        requireThat(def,'No existe ese campo de batalla.');requireThat(san?s.location==='san_nicolas':(s.location===at||def.neighbors.includes(s.location)),'La escuadra debe marchar a un sector vecino antes de atacar.');requireThat(!(['uspallata','los_patos'].includes(at)&&campaignDate(s).month>=6&&campaignDate(s).month<=8),'La nieve invernal ha cerrado los pasos.');requireThat(s.squad.some(id=>s.operativeState[id].alive&&s.operativeState[id].hp>0),'No hay combatientes disponibles.');
        if(san)requireThat(!campaignStory(s),'Esta campaña utiliza sus propios objetivos.');
        if(san)requireThat(s.phase>=1&&!s.flags.sanLorenzo&&s.sectors.san_nicolas.owner==='patriot','Organiza Retiro y libera San Nicolás antes de combatir en San Lorenzo.');
        else {requireThat(s.sectors[at].owner==='royalist'||(s.blockade&&def.theater==='coast'),'El sector ya está bajo control patriota.');requireThat(def.neighbors.some(id=>s.sectors[id].owner==='patriot'&&isSupplied(s,id)),'Debes abrir una ruta hasta el frente.');}
        if(action.queue===true&&!san&&s.location!==at){queueSquadTravel(s,activeSquad(s),{...action,intent:'attack'});note(s,`La escuadra prepara su avance al límite de ${def.name}.`);break;}
        const origin=s.location;
        if(!san&&s.location!==at){
          // Immediate orders advance the same journey used by queued squads.
          // Transport eligibility, remounts, fatigue and interruptions must agree.
          const squad=activeSquad(s);
          queueSquadTravel(s,squad,{...action,sector:at,intent:'attack'});
          tick(s,squad.journey.legHours);
          if(s.completed||s.defeated){delete squad.journey;note(s,'El despliegue se cancela: la campaña ha terminado.');break;}
          if(squad.journey?.status!=='ready'){
            note(s,'El avance sigue pendiente. Resolvé los avisos de la marcha antes de atacar.');break;
          }
          arriveForAssault(s,[squad],at);synchronizeSquad(s);haltEnemyGroupsAt(s,at,'stationed');
          if(s.pendingEncounter){note(s,'El avance se detiene al llegar: hay una defensa pendiente.');break;}
        }
        requireThat(action.squadIds===undefined||san,'La selección de apoyo corresponde a San Lorenzo.');
        const manifest=action.squadIds===undefined?null:missionAssaultManifest(s,action.squadIds);
        prepareAttack(s,at,origin,manifest?manifest.flatMap(q=>q.members):s.squad,manifest);break;
      }
      case 'battleResult':{
        requireThat(s.pendingBattle&&!s.pendingBattle.exploration,'No hay batalla de conquista pendiente.');requireThat(action.battleId===s.pendingBattle.id,'El resultado no corresponde a la batalla pendiente.');requireThat(['victory','defeat','retreat'].includes(action.outcome),'Resultado de batalla inválido.');const request=s.pendingBattle;
        const {snapshot:battleSnapshot}=completeDeploymentReport(s,request,action);if(request.missionId==='san_lorenzo'){requireThat(battleSnapshot,'San Lorenzo necesita un parte táctico completo.');const commander=battleSnapshot.units.find(u=>Number(u.id)===57&&u.missionAlly);requireThat(commander,'Falta el comandante aliado en el parte.');s.missionAllies.san_lorenzo=clone(commander);if(action.outcome==='victory'&&commander.hp>0)requireThat(completedTacticalVictory(battleSnapshot),'La victoria exige derrotar a los realistas y conservar con vida al comandante.');if(commander.hp<=0){action={...action,outcome:'defeat'};s.defeated=true;s.missions.san_lorenzo={stage:'failed',completed:false};note(s,'San Martín ha caído en San Lorenzo. La misión y la campaña concluyen con una derrota.');}else if(action.outcome==='victory')s.missions.san_lorenzo={stage:'completed',completed:true};}const plan=planDeploymentReturn(s,request,battleSnapshot,action.outcome);commitDeploymentReturn(s,request,battleSnapshot,plan);
        for(const id of request.squad.map(u=>Number(u.id)))if(gainsExperience(s,rosterFor(s).find(o=>o.id===id))&&s.operativeState[id].alive){
          const before=rosterFor(s).find(o=>o.id===id),xp=action.outcome==='victory'?60:action.outcome==='defeat'?20:10;
          s.operativeState[id].xp=(s.operativeState[id].xp??0)+xp;const after=rosterFor(s).find(o=>o.id===id);
          if(after.level>before.level){const growth=after.maxHp-before.maxHp;s.operativeState[id].maxHp+=growth;if(s.operativeState[id].hp===before.maxHp)s.operativeState[id].hp+=growth;note(s,`${after.name} mejora su instrucción tras el combate: grado${after.level}.`);}
        }
        if(request.defenseGroupId){finishDefense(s,request,action.outcome,battleSnapshot,plan);break;}
        for(const groupId of request.occupationGroupIds??[])recordEnemyGroupResult(s,groupId,battleSnapshot,action.outcome);
        if(action.outcome==='victory'){
          recordCityLoyalty(s,{sectorId:request.sector==='san_lorenzo'?'san_nicolas':request.sector,kind:'victory',eventId:request.id});if(request.sector==='san_lorenzo')s.flags.sanLorenzo=true;
          else {const region=s.sectors[request.sector];region.owner='patriot';region.damageUntil=0;releaseCaptives(s,request.sector);}
          if(request.theater==='coast'&&!s.enemyGroups.some(g=>g.theater==='coast'&&['waiting','engaged','stationed'].includes(g.status)))s.blockade=false;if(request.wasRoyalist||request.sector==='san_lorenzo')add(s,{treasury:250});standing(s,'directory',5);standing(s,'gauchos',request.theater==='north'?10:2);note(s,`Victoria en ${request.name}. Se recuperan armas y fondos realistas.`);
        }else{standing(s,'directory',-5);note(s,`El destacamento se retira de ${request.name}.`);}
        s.sectorStates[request.sector]=clone(compactCellScene(battleSnapshot));collectSectorCash(s,battleSnapshot);
        s.pendingBattle=null;s.squad=s.squad.filter(id=>s.operativeState[id].alive);
        if(!s.squad.length){
          // Select an existing local column without copying its members into the
          // empty command. Only unassigned reserves may fill that empty squad.
          const local=s.squads.find(q=>q.id!==s.activeSquadId&&q.location===s.location&&!q.journey&&q.members.some(id=>s.recruited.includes(id)&&s.operativeState[id]?.alive&&!s.operativeState[id]?.captured));
          if(local){s.activeSquadId=local.id;s.squad=[...local.members];}
          else{const assigned=new Set(s.squads.flatMap(q=>q.members));s.squad=s.recruited.filter(id=>!assigned.has(id)&&s.operativeState[id].alive&&!s.operativeState[id].captured&&operativeLocation(s,id)===s.location).slice(0,6);}
        }break;
      }
      default:throw Error('Orden desconocida.');
    }
    if(previous.pendingBattle&&!s.pendingBattle)settleDetentionReturn(s,previous.pendingBattle);
    reorganizeAfterLoss(s,previous);
    delayCrossingEnemyGroups(s);
    if(s.pendingBattle&&!previous.pendingBattle)prepareSectorArtillery(s,s.pendingBattle);
    if(s.pendingBattle&&!s.pendingBattle.exits)prepareDeploymentExits(s,s.pendingBattle);
    // Check real arrival geometry before committing soldiers, ammunition or guns.
    if(['attack','beginAssault'].includes(action.type)&&s.pendingBattle&&!previous.pendingBattle)enterSector(s.pendingBattle,s.sectorStates[s.pendingBattle.sector],{placement:true});
    if(s.pendingBattle&&s.pendingBattle.id!==previous.pendingBattle?.id)prepareSectorArtillery(s,s.pendingBattle);
    if(s.pendingBattle&&s.pendingBattle.id!==previous.pendingBattle?.id&&s.contentCampaign?.package.militiaPatrol!==undefined)s.pendingBattle.militiaPatrol=clone(s.contentCampaign.package.militiaPatrol);
    if(s.pendingBattle&&s.pendingBattle.id!==previous.pendingBattle?.id&&s.contentCampaign?.package.artilleryProfiles!==undefined)s.pendingBattle.artilleryDefinitions=clone(s.contentCampaign.package.artilleryProfiles);
    updateContentQuests(s);releaseDeferred(s);receiveDueHires(s);synchronizeSquad(s);synchronizeCampaignPresence(s);synchronizeDialogueMovements(s);progress(s);
    for(const [flag,at] of Object.entries({academy:headquartersFor(s),foundry:foundryFor(s).sector,northPact:'salta',partisanSupply:'tucuman',parliament:'mendoza',emancipation:'buenos_aires',commission:'buenos_aires'}))if(s.flags[flag]&&!previous.flags[flag])recordCityLoyalty(s,{sectorId:at,kind:'quest',eventId:`quest-${flag}`});
    if(['purchaseMedicalSupplies','resupply','equip'].includes(action.type)){
     const oldRoster=rosterFor(previous);
     for(const op of rosterFor(s)){
      const before=carriedAmmunition(oldRoster.find(o=>o.id===op.id),previous.operativeState[op.id]),after=carriedAmmunition(op,s.operativeState[op.id]);
      requireThat(!pocketChangeReason(before,after),POCKET_FULL);
     }
    }
    if(s.pendingBattle&&s.pendingBattle.id!==previous.pendingBattle?.id)for(const unit of s.pendingBattle.squad){
     const before=carriedAmmunition(rosterFor(previous).find(o=>o.id===unit.id),previous.operativeState[unit.id]);requireThat(!pocketChangeReason(before,unit),`${unit.name}: ${POCKET_FULL}`);
    }
    initializeCampaignSystems(s);syncCampaignAmmunition(s,rosterFor(s));validateCampaignAmmunition(s,rosterFor(s));validateDeploymentReturnState(s);validateEquipmentOwnership(s,rosterFor(s));if(Object.keys(s.assignmentAttention.reported).length)reconcileAssignmentAttention(s,assignmentStates(s,rosterFor(s),assignmentContext(s)));reconcileContractAttention(s);reconcileLogisticsAttention(s,{isSupplied});refreshEnemyIntelligence(s);return removeIgnitionSupplies(s);
  }catch(error){const rejected=clone(previous);rejected.lastError=error.message;return rejected;}
}
export function serializeCampaign(s){return JSON.stringify(s,cellSceneSaveReplacer(artillerySaveReplacer(s,weaponSaveReplacer(s))));}
export function restoreCampaign(text){
  assertSaveSize(text);
  return restoreCampaignValue(JSON.parse(text));
}
export function restoreCampaignValue(s){
  validateCampaignContent(s);restoreArtilleryReferences(s,s);const base=initialCampaign();
  const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  requireThat(object(s)&&s.version===1&&integer(s.hour,0,24*365*100)&&integer(s.phase,0,4)&&integer(s.seed,0,4294967295)&&validWorldLocation(s.location),'El archivo de campaña no es compatible.');
  requireThat(!['production','shipments','depots','convoys'].some(key=>key in s),'Esta partida contiene sistemas retirados. Iniciá una campaña nueva.');
  requireThat(s.economyVersion===2,'Esta partida usa la economía anterior. Iniciá una campaña nueva.');
  validateStoredFittingFields(s);validateStoredAmmo(s);migrateAmmunitionCustody(s);
  requireThat(Array.isArray(s.foundMoney)&&new Set(s.foundMoney).size===s.foundMoney.length&&s.foundMoney.every(id=>sector(id)),'El registro de fondos es inválido.');
  s.equipmentShipments??=[];requireThat(validEquipmentShipments(s),'Los pedidos de armas guardados son inválidos.');
  requireThat(object(s.resources)&&Object.keys(base.resources).every(k=>integer(s.resources[k],0,1e9)),'La tesorería del archivo es inválida.');
  requireThat(object(s.reputation)&&Object.keys(base.reputation).every(k=>integer(s.reputation[k],-100,100))&&s.reputation.royalists===-100,'Las relaciones del archivo son inválidas.');
  requireThat(object(s.sectors)&&Object.keys(s.sectors).length===13&&CAMPAIGN_SECTORS.every(d=>{const r=s.sectors[d.id];return object(r)&&['patriot','royalist'].includes(r.owner)&&integer(r.loyalty,0,100)&&integer(r.fort,0,3)&&integer(r.damageUntil,0,1e9)&&Array.isArray(r.militia)&&r.militia.length===3&&r.militia.every(x=>integer(x,0,100000));}),'El mapa del archivo es inválido.');
  s.militiaTraining??=[];
  requireThat(Array.isArray(s.militiaTraining)&&s.militiaTraining.length<=13&&new Set(s.militiaTraining.map(t=>t?.sector)).size===s.militiaTraining.length&&new Set(s.militiaTraining.map(t=>t?.trainerId)).size===s.militiaTraining.length&&s.militiaTraining.every(t=>object(t)&&sector(t.sector)&&integer(t.rank,0,2)&&Number.isInteger(t.trainerId)&&baseRosterFor(s).some(o=>o.id===t.trainerId)&&s.recruited?.includes(t.trainerId)&&t.count===3&&integer(t.duration,1,96)&&integer(t.remaining,1,t.duration)&&integer(t.started,0,s.hour)),'Los cursos de milicias guardados son inválidos.');
  // Version1 migration: old saves did not contain civic volunteers or a custom officer.
  if(s.officer===undefined)s.officer=null;
  requireThat(s.officer===null||(object(s.officer)&&typeof s.officer.name==='string'&&object(s.officer.answers)),'El examen guardado es inválido.');
  if(s.officer)createOfficerRecord(s.officer.name,s.officer.answers,s.officer.profile);
  requireThat(object(s.operativeState),'Las hojas de servicio son inválidas.');
  for(const op of s.contentCampaign?[]:CIVIC_RECRUITS)s.operativeState[op.id]??={hp:op.maxHp,fatigue:0,alive:true,xp:0,rations:2,torches:2,condition:100};
  for(const op of Object.values(s.operativeState)){requireThat(object(op),'Las hojas de servicio son inválidas.');if(op.missionSuppliesVersion!==undefined)requireThat(op.missionSuppliesVersion===1,'La versión de suministros del aliado no es válida.');validateTraining(op);validatePocketOrder(op.pocketOrder);for(const k of ['medkits','bleeding'])if(op[k]!==undefined)requireThat(Number.isInteger(op[k]),'Los suministros y heridas guardados son inválidos.');op.xp??=0;if(op.inventory!==undefined)validatePersonalInventory(op.inventory);for(const [field,limit]of Object.entries({energy:100,bleeding:10,medkits:1000000,weight:1000,strength:100,strengthTraining:10000,boleadoras:100000})){if(op[field]!==undefined)requireThat(Number.isFinite(op[field])&&op[field]>=0&&op[field]<=limit,'El estado físico guardado es inválido.');}for(const [field,baseline] of Object.entries({rations:2,torches:2,condition:100})){op[field]??=baseline;requireThat(integer(op[field],0,field==='condition'?100:100000),'Los suministros guardados son inválidos.');}requireThat(integer(op.xp,0,1e7),'La experiencia guardada es inválida.');}
  for(const op of rosterFor(s)){const unit={...op,...s.operativeState[op.id]};validateWeaponCarrier(unit);personalPockets(unit);requireThat(unit.activeSlot===undefined||['primary','blade','medical','unarmed','tool','supply','item'].includes(unit.activeSlot),'La mano guardada no es válida.');}
  s.missions??={};s.sceneStates??={};s.missionAllies??={};requireThat(validateMissions(s)&&object(s.sceneStates)&&Object.entries(s.sceneStates).every(([id,b])=>id==='yatasto'&&b.sceneId===id&&validateSectorSnapshot(b))&&object(s.missionAllies)&&Object.entries(s.missionAllies).every(([id,u])=>id==='san_lorenzo'&&object(u)&&u.missionAlly===true&&Number(u.id)===57&&typeof u.name==='string'&&Number.isInteger(u.weapon)&&(u.weapon===0||u.weapon>=1800&&u.weapon<=1813)&&(u.blade===undefined||u.blade===0||Number.isInteger(u.blade)&&u.blade>=1809&&u.blade<=1813)&&Number.isInteger(u.ammo)&&u.ammo>=0&&u.ammo<=100000&&Number.isInteger(u.loaded)&&u.loaded>=0&&u.loaded<=(weaponSpecification(u)?.capacity??0)&&Number.isFinite(u.hp)&&u.hp>=0&&u.hp<=100),'Las escenas guardadas son inválidas.');
  s.garrisons??={};s.nextMilitiaId??=20000;requireThat(validGarrisons(s),'Las guarniciones guardadas son inválidas.');
  requireThat(s.militiaTraining.every(course=>validMilitiaTrainees(s,course)),'Los milicianos en instrucción son inválidos.');
  const traineeIds=s.militiaTraining.flatMap(course=>(course.trainees??[]).map(u=>u.id));requireThat(new Set(traineeIds).size===traineeIds.length,'Los milicianos en instrucción son inválidos.');
  s.quests??={};requireThat(validateQuests(s.quests,s.hour),'Los encargos guardados son inválidos.');
  s.lastConversation??=null;s.conversations??={};
  requireThat(object(s.conversations)&&Object.entries(s.conversations).every(([id,c])=>[...encounterDefinitions(s),...YATASTO_NPCS].some(n=>n.id===id)&&object(c)&&c.met===true&&['repeat','friendly','direct','recruit','quest','mission','dialogue','gift','escortFollow','escortWait'].includes(c.lastApproach)&&integer(c.hour,0,s.hour)&&(c.text===undefined||typeof c.text==='string'&&c.text.length>0&&c.text.length<2000)&&(c.giftCount===undefined?c.lastApproach!=='gift':NPC_QUESTS.some(q=>q.npcId===id&&q.carried&&integer(c.giftCount,0,q.carried.count)))&&(c.sector===undefined||validWorldLocation(c.sector)||c.sector==='san_lorenzo')),'Las conversaciones guardadas son inválidas.');
  requireThat(s.lastConversation===null||(object(s.lastConversation)&&[...encounterDefinitions(s),...YATASTO_NPCS].some(n=>n.id===s.lastConversation.npcId)&&typeof s.lastConversation.text==='string'&&s.lastConversation.text.length<2000&&typeof s.lastConversation.speaker==='string'&&s.lastConversation.speaker.length<=100&&Array.isArray(s.lastConversation.options)&&s.lastConversation.options.every(o=>['repeat','friendly','direct','recruit','quest','mission','dialogue','escortFollow','escortWait'].includes(o))&&(s.lastConversation.giftCount===undefined||NPC_QUESTS.some(q=>q.npcId===s.lastConversation.npcId&&q.carried&&integer(s.lastConversation.giftCount,1,q.carried.count)&&s.lastConversation.giftCount===s.conversations[q.npcId]?.giftCount))),'El diálogo guardado es inválido.');
  validateSavedDialogues(s,encounterDefinitions(s));
  for(const quest of NPC_QUESTS)if(quest.carried&&quest.sector!==s.pendingBattle?.sector&&(s.conversations[quest.npcId]?.giftCount??0)>0)validateAcknowledgedNpcGiftReceipts(s,s.sectorStates[quest.sector]?.npcs??[],quest.sector);
  s.armory??={};s.loadouts??={};s.artillerySelection??=[];requireThat(s.artillerySelectionExplicit===undefined||typeof s.artillerySelectionExplicit==='boolean','La elección de batería guardada es inválida.');requireThat(Array.isArray(s.artillerySelection)&&s.artillerySelection.length<=3&&s.artillerySelection.every(t=>['bronze4','field8','swivel'].includes(t)||typeof t==='string'&&t.startsWith('depot:')&&t.length>6&&t.length<=166),'La batería guardada es inválida.');
  requireThat(object(s.armory)&&Object.entries(s.armory).every(([key,v])=>[...equipmentCatalog(s),...EQUIPMENT_CATALOG].some(o=>String(o.stockKey??o.item)===key)&&integer(v,0,100000)),'La armería guardada es inválida.');validateArmoryItems(s);
  requireThat(object(s.loadouts)&&Object.entries(s.loadouts).every(([id,slots])=>baseRosterFor(s).some(o=>o.id===Number(id))&&object(slots)&&Object.entries(slots).every(([slot,v])=>['weapon','blade'].includes(slot)&&(v===0||integer(v,slot==='blade'?1809:1800,1813)))),'Los equipos guardados son inválidos.');
  s.cityLoyaltyEvents??=[];requireThat(validCityLoyaltyEvents(s.cityLoyaltyEvents),'El registro de lealtad es inválido.');
  migrateContracts(s);requireThat(object(s.contracts)&&Object.entries(s.contracts).every(([id,c])=>s.recruited.includes(Number(id))&&object(c)&&(c.departurePending===undefined||typeof c.departurePending==='boolean')&&['paid','patriot','legacy'].includes(c.kind)&&['day','week','month'].includes(c.term)&&integer(c.started,0,s.hour)&&(c.expiresAt===null?c.kind!=='paid':integer(c.expiresAt,c.departurePending&&(deployed(s,Number(id))||operativeInTransit(s,Number(id)))?0:s.hour+1,1e9))&&integer(c.paid,0,1e9))&&s.recruited.every(id=>s.contracts[id]),'Los contratos guardados son inválidos.');
  for(const id of s.recruited){const c=characterForOperative(s,id);if(!c||!isWorldCharacter(c))continue;const contract=s.contracts[id];requireThat(c.service==='contract'?contract.kind==='paid'&&contract.expiresAt!==null:contract.kind==='patriot'&&contract.expiresAt===null&&contract.paid===0,'El contrato del habitante no coincide con su servicio.');}
  const ids=rosterFor(s).map(o=>o.id),validIds=values=>Array.isArray(values)&&new Set(values).size===values.length&&values.every(id=>ids.includes(id));
  requireThat(validIds(s.recruited)&&validIds(s.squad)&&s.squad.length<=6&&s.squad.every(id=>s.recruited.includes(id)),'El destacamento del archivo es inválido.');
  requireThat(s.recruited.every(id=>characterForOperative(s,id)?.encounter?.recruitable!==false),'Un habitante no reclutable no puede estar en la escuadra.');
  requireThat(object(s.operativeState)&&rosterFor(s).every(o=>{const r=s.operativeState[o.id];return object(r)&&integer(r.hp,0,o.maxHp)&&integer(r.fatigue,0,100)&&typeof r.alive==='boolean'&&r.alive===(r.hp>0)&&(r.location===undefined||validWorldLocation(r.location));}),'Las hojas de servicio son inválidas.');
  // Older authored saves retained the initial ceiling after gaining a level.
  for(const op of rosterFor(s))if(s.operativeState[op.id].maxHp!==undefined){
    requireThat(integer(s.operativeState[op.id].maxHp,1,op.maxHp),'La salud máxima guardada es inválida.');
    s.operativeState[op.id].maxHp=op.maxHp;
  }
  validateHireArrivals(s,rosterFor(s));
  requireThat(object(s.flags)&&Object.keys(base.flags).every(k=>typeof s.flags[k]==='boolean')&&object(s.routes)&&Object.keys(base.routes).every(k=>typeof s.routes[k]==='boolean'),'Los acuerdos del archivo son inválidos.');
  validateCampaignProgress(s);
  validateMedicalCare(s,rosterFor(s));for(const o of rosterFor(s)){const r=s.operativeState[o.id];if(r.bandaged!==undefined)requireThat(Number.isFinite(r.bandaged)&&r.bandaged>=0&&r.bandaged<=o.maxHp-r.hp,'Las heridas vendadas guardadas son inválidas.');}
  requireThat(['blockade','completed','defeated'].every(k=>typeof s[k]==='boolean')&&Array.isArray(s.log)&&s.log.length<=80&&s.log.every(p=>object(p)&&integer(p.hour,0,1e9)&&typeof p.text==='string'&&p.text.length<=1000),'El registro del archivo es inválido.');
  if(s.pendingBattle!==null){const b=s.pendingBattle;requireThat((!b.sceneId||(b.sceneId==='yatasto'&&b.sector==='tucuman'&&b.exploration===true))&&(!b.missionAllies||(b.sector==='san_lorenzo'&&Array.isArray(b.missionAllies)&&b.missionAllies.length===1&&Number(b.missionAllies[0].id)===57&&b.missionAllies[0].missionAlly===true)),'La escena pendiente es inválida.');requireThat(object(b)&&typeof b.id==='string'&&b.id.length<100&&(validWorldLocation(b.sector)||b.sector==='san_lorenzo')&&integer(b.seed,0,4294967295)&&Array.isArray(b.squad)&&b.squad.length<=(b.defenseGroupId?rosterFor(s).length:b.assaultSquads?48:6)&&new Set(b.squad.map(o=>o.id)).size===b.squad.length&&b.squad.every(o=>object(o)&&(b.defenseGroupId||b.assaultSquads?s.recruited.includes(o.id)&&operativeLocation(s,o.id)===(b.missionId==='san_lorenzo'?'san_nicolas':b.sector):s.squad.includes(o.id))&&integer(o.loaded,0,weaponSpecification(o)?.capacity??0)&&integer(o.ammo,0,1000000)&&integer(o.hp,1,100)),'La batalla guardada es inválida.');if(!sector(b.sector)&&b.sector!=='san_lorenzo')requireThat(b.exploration===true&&b.sector===s.location,'La visita guardada no corresponde a la celda actual.');if(b.origin!==undefined)requireThat(validWorldLocation(b.origin),'El origen del despliegue es inválido.');}

  for(const unit of [...(s.pendingBattle?.squad??[]),...(s.pendingBattle?.missionAllies??[]),...Object.values(s.missionAllies??{})])validateWeaponCarrier(unit);
  for(const unit of [...(s.pendingBattle?.enemies??[]),...(s.pendingBattle?.garrison??[])]){validateForceWeapon(unit);requireThat(validMilitiaArrival(unit,s.pendingBattle.sector),'La llegada de la milicia es inválida.');requireThat(validMilitiaExperience(unit),'La experiencia de la tropa guardada es inválida.');}
  if(s.pendingBattle){
    const request=s.pendingBattle;
    requireThat((request.hour===undefined||integer(request.hour,0,s.hour))&&(request.secondOfHour===undefined||integer(request.secondOfHour,0,3599)),'La hora inicial del despliegue es inválida.');
    validateRegionalWeather(request);
  }
  if(s.pendingBattle)for(const unit of s.pendingBattle.squad){requireThat(unit.preserveLoading===undefined||typeof unit.preserveLoading==='boolean','El estado de carga del despliegue es inválido.');const op=rosterFor(s).find(o=>o.id===Number(unit.id)),maxHp=unit.maxHp??op.maxHp;requireThat(integer(maxHp,1,op.maxHp)&&unit.hp<=maxHp,'La salud del despliegue guardado es inválida.');for(const [field,limit] of Object.entries({bleeding:100,bandaged:maxHp-unit.hp,energy:100}))if(unit[field]!==undefined)requireThat(Number.isFinite(unit[field])&&unit[field]>=0&&unit[field]<=limit,'Las heridas del despliegue guardado son inválidas.');if(unit.medkits!==undefined)requireThat(integer(unit.medkits,0,100000),'Los botiquines del despliegue guardado son inválidos.');}
  s.horseState??={...initialHorseState(),hour:s.hour};
  requireThat(object(s.horseState)&&s.horseState.version===1&&integer(s.horseState.hour,0,s.hour)&&integer(s.horseState.nextId,1,100000)&&Array.isArray(s.horseState.horses)&&s.horseState.horses.length<=10000&&new Set(s.horseState.horses.map(h=>h?.id)).size===s.horseState.horses.length&&Array.isArray(s.horseState.log)&&s.horseState.log.length<=40&&s.horseState.log.every(t=>typeof t==='string'&&t.length<1000),'La caballada guardada es inválida.');
  requireThat(s.horseState.horses.every(h=>object(h)&&typeof h.id==='string'&&typeof h.name==='string'&&h.name.length<=60&&['mare','stallion'].includes(h.sex)&&validWorldLocation(h.location)&&integer(h.bornAt,-1000000,s.hour)&&typeof h.hired==='boolean'&&(h.returned===undefined||typeof h.returned==='boolean')&&(h.pregnantUntil===null||integer(h.pregnantUntil,0,1e9))&&(h.hireUntil===null||integer(h.hireUntil,0,1e9))&&Number.isFinite(h.stamina)&&h.stamina>=0&&h.stamina<=100&&Number.isFinite(h.condition)&&h.condition>=0&&h.condition<=100&&integer(h.feed,0,100000)&&(h.assignedTo===null||s.recruited.includes(h.assignedTo))),'Los caballos guardados son inválidos.');
  const mounts=s.horseState.horses.filter(h=>!h.returned&&h.assignedTo!==null).map(h=>h.assignedTo);requireThat(new Set(mounts).size===mounts.length,'Un jinete no puede tener dos monturas asignadas.');
  migrateSquads(s);validateSquadTravel(s);validateAssaultDeployment(s);
  requireThat(Array.isArray(s.squads)&&s.squads.length>0&&s.squads.length<=8&&new Set(s.squads.map(q=>q.id)).size===s.squads.length&&s.squads.every(q=>object(q)&&typeof q.id==='string'&&/^squad-[1-9][0-9]*$/.test(q.id)&&typeof q.name==='string'&&q.name.length<=30&&validWorldLocation(q.location)&&validIds(q.members)&&q.members.length<=6&&q.members.every(id=>s.recruited.includes(id))),'Las escuadras guardadas son inválidas.');
  const assigned=s.squads.flatMap(q=>q.members);requireThat(new Set(assigned).size===assigned.length,'Un combatiente no puede pertenecer a dos escuadras.');const selected=s.squads.find(q=>q.id===s.activeSquadId);requireThat(selected&&selected.location===s.location&&JSON.stringify(selected.members)===JSON.stringify(s.squad),'La escuadra activa del archivo es inválida.');
  requireThat(object(s.sectorStates)&&Object.entries(s.sectorStates).every(([id,snapshot])=>(validWorldLocation(id)||id==='san_lorenzo')&&validateSectorSnapshot(expandCellScene(snapshot))&&(sector(id)||id==='san_lorenzo'||snapshot.sectorId===id&&snapshot.sourceMapId===id)),'Los sectores guardados son inválidos.');
  validateAmmunitionCustody(s,rosterFor(s));
  migrateArtilleryState(s);validateArtilleryTransport(s);validateArtilleryMerchants(s);validateCampaignArtillery(s);
  for(const scene of [s.pendingBattle,...Object.values(s.sectorStates),...Object.values(s.sceneStates)]){validateCampaignPatrol(s,scene);validateCampaignArtilleryProfiles(s,scene);}
  for(const [id,snapshot]of Object.entries(s.sectorStates))s.sectorStates[id]=compactCellScene(snapshot);
  requireThat(!s.pendingBattle||s.pendingBattle.syncedSeconds===undefined||(Number.isSafeInteger(s.pendingBattle.syncedSeconds)&&s.pendingBattle.syncedSeconds>=0),'El reloj del despliegue es inválido.');requireThat(Number.isInteger(s.secondOfHour??0)&&(s.secondOfHour??0)>=0&&(s.secondOfHour??0)<3600,'El reloj guardado es inválido.');requireThat(s.deferredRaids===undefined||(Array.isArray(s.deferredRaids)&&s.deferredRaids.length<=1000&&s.deferredRaids.every(r=>object(r)&&['north','coast','interior'].includes(r.theater)&&sector(r.target))),'Las incursiones pendientes son inválidas.');initializeCampaignSystems(s);validatePolitics(s);validateAssignments(s,rosterFor(s));validateAssignmentAttention(s,rosterFor(s));validateLogisticsNotice(s);if(s.pendingBattle)validateArtilleryDeployment(s.pendingBattle);validateContractAttention(s,rosterFor(s));validateMorale(s,rosterFor(s));validateEquipment(s,rosterFor(s));validateEnemyGroups(s,rosterFor(s));validateCampaignAmmunition(s,rosterFor(s));validateDeploymentReturnState(s);requireThat(s.economyVersion===2&&Object.keys(s.resources).length===1,'La economía guardada es inválida.');if(migrateCampaignCivilians(s))synchronizeCampaignPresence(s);migrateCampaignCivilianSupplies(s);validateCampaignCivilians(s);validateQuestFailures(s);if(resumeCivilianServiceReturns(s))validateCampaignCivilians(s);validateCampaignPresence(s);if(migrateResidentWounds(s))validateCampaignCivilians(s);validateDialogueMovements(s,encounterDefinitions(s));enforceHistoricalLoss(s);s.lastError=null;return removeIgnitionSupplies(s);
}
