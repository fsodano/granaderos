import { domainRefusalMessage } from './infrastructure/shared/domain-refusal-message.js';
import { FormSquadUseCase } from './application/personnel/form-squad/form-squad.use-case.ts';
import { CampaignFormSquadRepository } from './infrastructure/personnel/campaign-form-squad.repository.js';
import { ServiceContract } from './domain/personnel/service-contract.ts';
import { GameTime, TimeUnits } from './domain/shared/game-time.ts';
import { Money } from './domain/finance/money.ts';
import { DomainIdentityMap } from './infrastructure/persistence/domain-identity-map.ts';
import { CanonicalPersonnelMapper } from './infrastructure/persistence/canonical-personnel-mapper.ts';
import { RenewServiceContractUseCase } from './application/personnel/renew-service-contract/renew-service-contract.use-case.ts';
import { CampaignRenewServiceContractRepository } from './infrastructure/personnel/campaign-renew-service-contract.repository.js';
import { admitSectorReinforcements } from './battle-handoff.js';
import { addAmmoCounts } from './campaign-ammunition.js';
import { isCharacterDeployed as deployed } from './infrastructure/session/campaign-session-access.js';
import { restoreGameSession } from './infrastructure/session/campaign-game-session-mapper.js';
import { CampaignSectorSessionCoordinator } from './infrastructure/session/campaign-sector-session-coordinator.js';
import { CampaignResumeSectorSessionRepository } from './infrastructure/session/campaign-resume-sector-session.repository.js';
import { ResumeSectorSessionUseCase } from './application/sector-sessions/resume-sector-session/resume-sector-session.use-case.ts';
import { RecruitmentService } from './domain/personnel/recruitment-service.ts';
import { RecruitmentAssignment } from './domain/personnel/force-roster.ts';
import {
  CampaignRecruitmentMapper,
  RecruitmentEquipmentSource,
} from './infrastructure/personnel/campaign-recruitment-mapper.js';
import { GameUnitOfWork } from './infrastructure/persistence/game-unit-of-work.ts';
import { RecruitCombatantUseCase } from './application/personnel/recruit-combatant/recruit-combatant.use-case.ts';
import { CampaignRecruitCombatantRepository } from './infrastructure/personnel/campaign-recruit-combatant.repository.js';
import { CampaignCharacterEquipmentMapper } from './infrastructure/personnel/campaign-character-equipment-mapper.js';
import { CampaignCharacterAbilitiesMapper } from './infrastructure/personnel/campaign-character-abilities-mapper.js';
import {
  fundServiceGuarantee,
  settleServiceGuarantee,
  forfeitDeadServiceGuarantees,
  validateServiceGuarantees,
  guaranteeDepartureReason,
  creditPendingGuaranteeRefunds,
} from './service-guarantees.js';
import {
  treasuryIncomeReason,
  awardVictoryFunds,
  creditPendingVictoryFunds,
  validatePendingVictoryFunds,
} from './treasury-rewards.js';
import { withdrawQuest, validateQuestWithdrawalReceipts } from './quest-withdrawal.js';
import {
  initializeTownIncome,
  activateTownIncome,
  validateTownIncome,
  collectTownIncome,
  townIncomeSourceForNPC,
} from './town-income.js';
import {
  validateRepairReserve,
  validateRepairReserveContext,
  retainRepairReserves,
} from './repair-materials.js';
import { recordFiniteArsenalRecovery } from './finite-artillery-arsenals.js';
import {
  campaignPackageSaveReplacer,
  restoreCampaignPackageReference,
} from './campaign-package-storage.js';
import { migrateLegacySkillLearning } from './recruitment.js';
import { receiveCorrespondence, validateCorrespondence } from './correspondence.js';
import {
  receiveCompanionLossCorrespondence,
  deliverPendingCompanionLossCorrespondence,
  validatePendingCompanionLoss,
  cancelPendingCompanionLoss,
  renewPendingCompanionLossService,
} from './companion-loss.js';
import { isSectorSupplied } from './sector-income.js';
import { AMMUNITION_FAMILIES } from './ammunition-families.js';
import { changeMerchantCash } from './equipment-merchants.js';
import { equipmentKey } from './equipment-catalog.js';
import {
  migrateServiceEquipmentReturns,
  validateServiceEquipmentReturns,
  returnServiceEquipment,
} from './service-equipment-return.js';
import { serviceEquipmentReturnReason } from './service-equipment-notice.js';
import {
  unloadOwnedCampaignAmmunition,
  selectCampaignAmmunitionLoad,
  migrateAmmunitionCustody,
  validateAmmunitionCustody,
  prepareCampaignAmmunition,
  issueStartingCartridges,
  migrateStartingCartridges,
  retainReturnedAmmunition,
  moveCampaignAmmunition,
  unloadCampaignWeapon,
  carriedAmmunition,
  ammoResourceKey,
  initialAmmunitionStock,
  migrateCampaignAmmunition,
  syncCampaignAmmunition,
  validateCampaignAmmunition,
  syncCarriedAmmunition,
} from './campaign-ammunition.js';
import { removeIgnitionSupplies, validateStoredAmmo } from './ammo-types.js';
import { personalPockets, pocketChangeReason, POCKET_FULL } from './personal-pockets.js';
import {
  sellArtillery,
  repurchaseArtillery,
  validateArtilleryMerchants,
} from './artillery-trading.js';
import {
  dispatchArtilleryTransport,
  deliverArtilleryTransfers,
  validateArtilleryTransport,
  queueArtilleryTransport,
  deliverTransportedArtillery,
  storeStationedArtillery,
} from './artillery-transport.js';
import {
  validateCampaignArtilleryProfiles,
  artillerySaveReplacer,
  restoreArtilleryReferences,
} from './artillery-definitions.js';
import { artillerySupplyQuote } from './artillery-supply.js';
import {
  migrateArtilleryState,
  prepareSectorArtillery,
  validateArtilleryReport,
  settleSectorArtillery,
  validateCampaignArtillery,
  ownedArtilleryCount,
  validateArtilleryDeployment,
  supplyStationedArtillery,
} from './campaign-artillery.js';
import { validateCampaignPatrol } from './militia-patrol-rules.js';
import { redistributeMilitia } from './militia-distribution.js';
import { validMilitiaArrival } from './militia-arrival.js';
import { validMilitiaExperience } from './militia-experience.js';
import { workshopServiceQuote } from './workshop-service.js';
import {
  CARE_ASSIGNMENTS,
  careAssignmentBusy,
  assignMedicalCare,
  advanceMedicalCare,
  advanceMilitaryWounds,
  validateMedicalCare,
  medicalSupplyQuote,
  MEDICAL_KIT_PRICE,
  migrateMedicalCare,
  returnMedicalCare,
} from './medical-care.js';
import {
  previousDeploymentScene,
  withoutPreviousCasualties,
  retainedMilitaryBodies,
  advanceCampaignWorld,
  removedSectorCharacters,
} from './military-remains.js';
import { firstAidPlan } from './first-aid.js';
import { CRITICAL_HEALTH } from './actor-condition.js';
import { completedTacticalVictory } from './battle-outcome.js';
import { foundryFor } from './campaign-foundry.js';
import { campaignRole, campaignRoleActive, foundryReason } from './campaign-roles.js';
import {
  campaignStory,
  advanceCampaignStory,
  campaignChapterIndex,
  validateCampaignProgress,
} from './campaign-story.js';
import { importRulesFor, importOrderReason } from './campaign-imports.js';
import { headquartersFor, headquartersName, campaignChapters } from './campaign-headquarters.js';
import { campaignRules } from './campaign-rules.js';
import { synchronizeDialogueMovements, validateDialogueMovements } from './dialogue-movement.js';
import { updateContentQuests, nextContentQuestDeadline } from './content-quests.js';
import {
  initializeCampaignEvents,
  advanceCampaignEvents,
  nextCampaignEventTime,
  validateCampaignEventState,
} from './campaign-events.js';
import { dialogueForNPC, chooseDialogue, validateSavedDialogues } from './content-dialogue.js';
import {
  advanceUnloadedCivilians,
  nextUnloadedCivilianDeath,
  migrateResidentWounds,
  resumeCivilianServiceReturns,
  hasPendingCivilians,
  acknowledgeCivilians,
  transferCivilian,
  validateCampaignCivilians,
  migrateCampaignCivilians,
  migrateCampaignCivilianSupplies,
} from './campaign-civilians.js';
import {
  synchronizeCampaignPresence,
  nextCampaignPresenceChange,
  validateCampaignPresence,
  acknowledgeSuccessionDeaths,
} from './campaign-presence.js';
import {
  isContractOperative,
  gainsExperience,
  characterForOperative,
  isWorldCharacter,
} from './content-character-ids.js';
import { validateAbilityReferences } from './content-character-abilities.js';
import {
  campaignPlace,
  worldCell,
  locationId,
  validWorldLocation,
  worldOwner,
  adjacentCells,
} from './world-cells.js';
import { compactCellScene, expandCellScene, cellSceneSaveReplacer } from './cell-scene-storage.js';
import { validateCampaignSceneDefinitions } from './campaign-scene-definitions.js';
import { validateForceWeapon } from './content-force-equipment.js';
import {
  weaponSaveReplacer,
  weaponSpecification,
  validateWeaponCarrier,
  validateWeaponReferences,
  setWeaponDefinition,
  weaponRecord,
} from './weapon-definition.js';
import {
  usesAuthoredEquipment,
  addArmoryStock,
  equipArmoryItem,
  validateArmoryItems,
} from './armory-items.js';
import {
  hiringArrivalReason,
  hiringArrivalOptions,
  pendingHire,
  hireArrivalOrder,
  advanceHireArrivals,
  nextHireArrivalSeconds,
  redirectHire,
  cancelHireArrival,
  validateHireArrivals,
} from './hiring-arrivals.js';
import { attachCampaignContent, validateCampaignContent } from './campaign-content.js';
import {
  scenarioFor,
  missionScenesFor,
  sceneAnchorFor,
  isCampaignScene,
  enemyCommandsFor,
  enemyGroupLegHoursFor,
} from './campaign-scenario.js';
import { campaignSectors } from './campaign-definition.js';
import { resolveContent } from './content-package.js';
import { canonicalContent } from './content-identity.js';
import { refreshEnemyIntelligence, recordEnemyPresence } from './enemy-intelligence.js';
import { tradeArtillery } from './artillery-trade.js';
import { exchangeMerchantEquipment } from './merchant-exchange.js';
import { enterSector } from './world.js';
import { settlePrisonerEscapes } from './prisoner-escape-return.js';
import { settleDetentionReturn } from './campaign-detention.js';
import { advanceDetentionCare } from './detention-care.js';
import { detentionManifest } from './detention.js';
import { restoredCaptiveContract } from './prisoner-custody.js';
import { escortArrival } from './quest-escort.js';
import { missionAssaultManifest } from './mission-assault.js';
import { ammunitionSource } from './ammunition.js';
import {
  purchaseGrenades,
  clearCarriedLoading,
  setCarriedLoading,
  isImportedEquipment,
  deliverEquipmentShipments,
  validEquipmentShipments,
  EQUIPMENT_CATALOG,
  refillCost,
  firearmRepairCost,
  deployedArtillery,
  migrateEquipment,
  validateStoredFittingFields,
  merchantStatus,
  addEquipment,
  storeEquipment,
  takeEquipment,
  storedEquipmentMetadata,
  resaleBreakdown,
  returnEquipment,
  validateEquipment,
  equipmentInventoryUsage,
  allocateEquipmentAmmo,
  equipmentCatalogItem,
  equipmentLabel,
  medicalSupplyStock,
  ammunitionStock,
  AMMUNITION_PRICE,
  AMMUNITION_MERCHANT_CAP,
  validateEquipmentOwnership,
  USED_EQUIPMENT_LIMIT,
  usedEquipmentOffers,
  artillerySelectionReason,
  equipmentCatalog,
} from './equipment.js';
import {
  regionalConditions,
  validateRegionalWeather,
  validateCampaignWeather,
} from './regional-weather.js';
import { issueInitialOutfit } from './outfits.js';
import {
  hasAuthoredDialogue,
  dialogueOptions,
  dialogueReason,
  ambientReply,
  contextualThreatReply,
} from './npc-dialogue.js';
import { validatePocketOrder } from './inventory-pockets.js';
import {
  recordLogisticsNotice,
  validateLogisticsNotice,
  migrateLogisticsAttention,
  collectLogisticsAttention,
  reconcileLogisticsAttention,
} from './logistics-attention.js';
import { moveSectorItem } from './sector-inventory.js';
import { handLayout } from './hand-layout.js';
import {
  initialContractAttention,
  migrateContractAttention,
  reconcileContractAttention,
  collectContractAttention,
  nextContractWarningSeconds,
  validateContractAttention,
} from './contract-attention.js';
import { totalSectorIncome } from './sector-income.js';
import {
  assaultNeighbor,
  queueSquadTravel,
  cancelSquadTravel,
  resumeSquadTravel,
  advanceSquadTravel,
  nextSquadTravelBoundarySeconds,
  validateSquadTravel,
  readyAssaultSquads,
  arriveForAssault,
  validateAssaultDeployment,
  hasPendingArrivalDecision,
  authorizeFightOnArrival,
  withdrawOnArrival,
  redirectJourney,
} from './squad-travel.js';
import { gainFatigue, needsCollapseRecovery } from './fatigue.js';
import { advanceMarchFatigue, tooTiredToMarch } from './march-fatigue.js';
import { assertSaveSize } from './save-limits.js';
import { dailyIncome, artilleryCount, collectSectorCash } from './economy.js';
import { speechFor } from './characters.js';
import {
  prepareGarrison,
  returnGarrison,
  validGarrisons,
  reserveMilitiaTrainees,
  returnMilitiaTrainees,
  validMilitiaTrainees,
  advanceMilitiaWounds,
} from './garrison.js';
import { tradeQuote, policyStatus } from './politics.js';
import {
  questForNPC,
  validateQuests,
  validateQuestFailures,
  validateQuestGifts,
  questsFor,
  NPC_QUESTS,
  questGiftProgressPending,
  questDeliveryText,
  questResolutionReward,
  questResolutionText,
  questBeneficiaryResolutionText,
  failQuestsForDeadContact,
} from './quests.js';
import {
  questContactIds,
  questBeneficiaryForNPC,
  validateQuestBeneficiaryContext,
  retainQuestBeneficiaries,
} from './quest-beneficiaries.js';
import { recordCityLoyalty, validCityLoyaltyEvents } from './cities.js';
import {
  contractQuote,
  contractRenewalQuote,
  contractStatus,
  migrateContracts,
  contractExpiresSeconds,
  contractStartedFields,
} from './contracts.js';
import { validateTraining } from './skill-training.js';
import {
  militiaCourse,
  militiaAssignment,
  MILITIA_COHORT,
  MILITIA_LIMIT,
  militiaEligibility,
} from './militia.js';
import {
  ENCOUNTERS,
  encounterDefinitions,
  canRecruitEncounter,
  encounterForOperative,
  encountersFor,
  encounterRequirements,
  encounterHireTerms,
} from './encounters.js';
import {
  initialHorseState,
  migrateHorseState,
  applyHorseAction,
  mountForOperative,
} from './horses.js';
import { fieldCapable, canSee } from './tactical.js';
import {
  prepareDeploymentExits,
  planDeploymentReturn,
  recordStrategicArrival,
  migrateDeploymentReturns,
  validateDeploymentReturnState,
} from './deployment-return.js';
import { validateSectorExits } from './tactical-exits.js';
import {
  WORK_ASSIGNMENTS,
  TOOLKIT_PRICE,
  TOOLKIT_POINTS,
  migrateAssignments,
  assignWork,
  advanceAssignments,
  validateAssignments,
  militiaAssignmentIssue,
} from './assignments.js';
import {
  assignmentStates,
  migrateAssignmentAttention,
  validateAssignmentAttention,
  collectAssignmentAttention,
  reconcileAssignmentAttention,
  militiaCompletionAttention,
  militiaCancellationAttention,
  sleepAttention,
} from './assignment-attention.js';
import {
  migrateMorale,
  deploymentMorale,
  returnMorale,
  payMoraleRewardEligible,
  recordPayMorale,
  recordCasualtyMorale,
  recordBattleMorale,
  advanceMorale,
  validateMorale,
} from './morale.js';
import {
  migrateEnemyGroups,
  launchEnemyGroup,
  advanceEnemyGroups,
  delayCrossingEnemyGroups,
  haltEnemyGroupsAt,
  queueEnemyEncounter,
  localDefenderIds,
  localDefenderCount,
  retreatDestinations,
  occupyingGroups,
  recordEnemyGroupResult,
  validateEnemyGroups,
} from './enemy-groups.js';
import { setSleep, prepareSleep, finishSleepHour, SLEEP_ISSUE_TEXT } from './sleep.js';
import { autoResolve } from './auto-resolve.js';
import {
  canCreateSquad,
  vacantSquad,
  canReassignOperative,
  migrateSquads,
  activeSquad,
  squadReorganizationReason,
  operativeLocation,
  operativeInTransit,
  travelingOperatives,
  synchronizeSquad,
  validateSectorSnapshot,
  validatePersonalInventory,
} from './squads.js';
import { FITTING_RULES_VERSION } from './weapon-fittings.js';
import { hasWorkshop } from './campaign-headquarters.js';
import { TRANSPORT_NETWORKS } from './transport-network.js';
import { oppositionFor, campaignEnemyCount } from './narrative.js';
import {
  rosterFor as baseRosterFor,
  CIVIC_RECRUITS,
  civicStatus as baseCivicStatus,
  createOfficerRecord,
} from './recruitment.js';
import { campaignOfficerCreation, officerStartingFitting } from './campaign-officer-creation.js';
import { validateOfficerCreationHealth } from './character-profile.js';
import { OPERATIVES, WEAPONS, CAMPAIGN_SECTORS, FACTIONS, PHASES, RESOURCE_NAMES } from './data.js';
export { MISSION_SCENES, missionStatus } from './missions.js';
export { dailyIncome, incomeSources, incomeSummary } from './economy.js';
export { tradeQuote, policyStatus } from './politics.js';
import {
  validateQuestContext,
  validateQuestDefinitions,
  freshDefaultErrands,
} from './quest-definitions.js';
import {
  validateCampaignCompanionGrief,
  validateCompanionGriefContext,
  retainCompanionGrief,
  returnCompanionGrief,
} from './companion-grief.js';
import {
  validateCampaignServiceObjections,
  validateServiceObjectionContext,
  retainServiceObjections,
  returnServiceObjection,
  hasPendingServiceObjections,
  receiveServiceObjectionCorrespondence,
} from './service-objections.js';
import {
  freshDefaultRoadsideDiscoveries,
  validateRoadsideDiscoveries,
  validateRoadsideDiscoveryContext,
} from './roadside-discoveries.js';
export { questForNPC, NPC_QUESTS } from './quests.js';
export {
  contractQuote,
  contractRenewalQuote,
  contractStatus,
  CONTRACT_TERMS,
} from './contracts.js';
export { militiaCourse, militiaAssignment } from './militia.js';
export { ENCOUNTERS, encountersFor } from './encounters.js';
export { activeSquad, operativeLocation } from './squads.js';
export { TRANSPORT_OPTIONS, transferOptions, inventoryAt, cargoWeight } from './logistics.js';
export { EQUIPMENT_CATALOG, armoryInventory, refillCost, firearmRepairCost } from './equipment.js';
export { ROYALIST_COMMANDS, royalistIntel, mentorDispatch } from './narrative.js';
export { CIVIC_RECRUITS } from './recruitment.js';
export function civicStatus(s, id, local = false) {
  return baseCivicStatus(s, id);
}
export { OPERATIVES, WEAPONS, CAMPAIGN_SECTORS, FACTIONS, PHASES, RESOURCE_NAMES };
export function rosterFor(s) {
  const equipment = new CampaignCharacterEquipmentMapper(s);
  const abilities = new CampaignCharacterAbilitiesMapper(s);
  return baseRosterFor(s).map((o) => {
    const record = s.operativeState?.[o.id] ?? {},
      op = {
        ...equipment.project(o),
        ...abilities.read(o).toSnapshot().ratings,
        maxHp: Math.min(100, o.maxHp + (record.trainedStats?.maxHp ?? 0)),
      };
    return op;
  });
}
export function deploymentCost(s) {
  return prepareCampaignAmmunition(s, rosterFor(s), s.squad, {
    supplied: isSupplied(s, s.location),
  }).cost;
}
function deploymentOperative(s, id) {
  const op = rosterFor(s).find((o) => o.id === id);
  // Stored strength is a legacy floor. New XP can raise the current value
  // above that floor; persistent wounds and supplies still use the record.
  const record = clone(s.operativeState[id]);
  delete record.strategicIsolation;
  delete record.pendingCompanionLoss;
  delete record.companionLossConfirmation;
  return { ...clone(op), ...record, strength: op.strength };
}
function returnMount(s, id, report) {
  if (!report.mount) return;
  const horse = s.horseState?.horses.find(
    (h) => h.id === report.mount.id && h.assignedTo === id && !h.returned,
  );
  requireThat(horse, 'La montura no pertenece al combatiente.');
  for (const field of ['stamina', 'condition']) {
    requireThat(
      Number.isFinite(report.mount[field]) &&
        report.mount[field] >= 0 &&
        report.mount[field] <= 100,
      'El estado de la montura es inválido.',
    );
    horse[field] = report.mount[field];
  }
}
function returnTraining(s, id, report) {
  validateTraining(report);
  for (const field of ['trainedStats', 'skillPractice', 'practiceSeed'])
    if (report[field] !== undefined) s.operativeState[id][field] = clone(report[field]);
}
function removeFromService(s, id) {
  const personnel = new CanonicalPersonnelMapper(s, new DomainIdentityMap());
  const character = personnel.restoreCharacter(rosterFor(s).find((person) => person.id === id));
  if (character.service) character.endService();
  personnel.roster.release(String(id));
  personnel.apply(s);
  cancelPendingCompanionLoss(s, id);
  s.operativeState[id].assignment = 'active';
  s.operativeState[id].asleep = false;
  s.operativeState[id].sleepCollapsed = false;
  s.operativeState[id].recoveryHours = 0;
  const location = operativeLocation(s, id);
  s.operativeState[id].location = location;
  for (const squad of s.squads) {
    squad.members = squad.members.filter((x) => x !== id);
    if (!squad.members.length) delete squad.journey;
  }
  for (const horse of s.horseState.horses) if (horse.assignedTo === id) horse.assignedTo = null;
  for (const course of s.militiaTraining.filter((t) => t.trainerId === id)) {
    returnMilitiaTrainees(s, course);
  }
  s.militiaTraining = s.militiaTraining.filter((t) => t.trainerId !== id);
  delete s.contracts[id];
}
function endOperativeService(s, id, fullCredit = false) {
  const op = rosterFor(s).find((o) => o.id === id),
    settlement = settleServiceGuarantee(s, s.contracts[id], op, 'departed', fullCredit);
  const returned = returnServiceEquipment(s, id, rosterFor(s));
  removeFromService(s, id);
  if (settlement)
    note(
      s,
      settlement.creditedRefund < settlement.refund
        ? `${op.name}: garantía liquidada, ${settlement.creditedRefund} pesos abonados y ${settlement.refund - settlement.creditedRefund} pendientes de ${settlement.amount}. La paga no se devuelve.`
        : `${op.name}: garantía liquidada, ${settlement.refund} de ${settlement.amount} pesos devueltos. La paga no se devuelve.`,
    );
  if (returned)
    note(
      s,
      `El equipo queda en ${missionScenesFor(s)[returned.siteId]?.name ?? campaignPlace(returned.sectorId, s).name}, disponible para un combatiente presente.${returned.fallback ? ' Recogé todo el equipo antes de volver a contratar a esta persona.' : ''}`,
    );
}
function endExpiredService(s, id) {
  const name = rosterFor(s).find((o) => o.id === id)?.name ?? 'Un combatiente',
    alive = s.operativeState[id].alive;
  endOperativeService(s, id);
  const text = alive
    ? `${name} concluye su contrato y deja el destacamento.`
    : `Vence el contrato de ${name}, que murió en servicio.`;
  note(s, `${text} Su hoja de servicio queda disponible.`);
}
function receiveHire(s, arrival, joinSquad = true) {
  const id = arrival.operativeId,
    op = rosterFor(s).find((o) => o.id === id);
  const returnReason = serviceEquipmentReturnReason(s, id);
  requireThat(!returnReason, returnReason);
  const personnel = new CanonicalPersonnelMapper(s, new DomainIdentityMap());
  const character = personnel.restoreCharacter(op);
  const contract = ServiceContract.start(
    String(id),
    arrival.term,
    GameTime.fromCampaignClock(s.hour, s.secondOfHour ?? 0),
    arrival.permanent ? null : arrival.serviceHours * TimeUnits.secondsPerHour,
    Money.pesos(arrival.paid),
  );
  character.beginService(contract, arrival.destination);
  personnel.roster.admit(character.id, arrival.destination, joinSquad && !s.pendingBattle);
  personnel.apply(s);
  if (arrival.guaranteeId) s.contracts[id].guaranteeId = arrival.guaranteeId;
  issueStartingCartridges(s, op);
  issueInitialOutfit(s, id);
  Object.assign(s.operativeState[id], {
    location: arrival.destination,
    arrival: null,
    residentSector: null,
    residentScene: null,
  });
  delete s.operativeState[id].residentPosition;
  note(s, `${op.name} llega a ${sector(arrival.destination, s).name} y comienza su servicio.`);
  receiveCorrespondence(s, {
    id: `arrival-${id}-${s.hour}`,
    sender: `Cuartel de ${sector(arrival.destination, s).name}`,
    subject: `Llegada de ${op.nickname}`,
    text: `${op.name} llegó y comenzó su servicio. ${arrival.permanent ? 'Su servicio es permanente.' : `El contrato cubre ${arrival.serviceHours / 24} ${arrival.serviceHours === 24 ? 'día' : 'días'}.`}`,
  });
  if (s.contentCampaign) {
    const line = speechFor(op, 'hired');
    if (line?.trim()) note(s, `${op.name}: «${line}»`);
  }
}
function receiveDueHires(s, joinSquad = true) {
  const availableSites = hiringArrivalOptions(s);
  for (const booking of [...(s.hiringArrivals ?? [])]) {
    const destination =
      availableSites.find((site) => site.id === booking.destination)?.id ??
      availableSites.find((site) => site.id === s.location)?.id ??
      availableSites[0]?.id;
    if (!destination) continue;
    const record = s.operativeState[booking.operativeId];
    if (
      !record?.alive ||
      record.captured ||
      record.serviceEquipmentReturn ||
      s.recruited.includes(booking.operativeId) ||
      s.contracts[booking.operativeId]
    )
      continue;
    receiveHire(s, { ...booking, destination }, joinSquad);
    s.hiringArrivals = s.hiringArrivals.filter((candidate) => candidate !== booking);
  }
  s.recruitmentVersion = 2;
}
function expireDueContracts(s) {
  const events = [],
    now = s.hour * 3600 + (s.secondOfHour ?? 0);
  for (const id of [...s.recruited]) {
    const contract = s.contracts?.[id],
      expiry = contractExpiresSeconds(contract);
    if (expiry === null || expiry > now) continue;
    cancelPendingCompanionLoss(s, id);
    if (s.operativeState[id]?.alive && !s.operativeState[id].captured)
      events.push({
        operativeId: id,
        expiresAt: contract.expiresAt,
        ...(contract.expiresSecond ? { expiresSecond: contract.expiresSecond } : {}),
        code: 'expired',
      });
    if (deployed(s, id) || operativeInTransit(s, id)) {
      contract.departurePending = true;
      continue;
    }
    endExpiredService(s, id);
  }
  return events;
}
export function nextContractExpirySeconds(s) {
  const now = s.hour * 3600 + (s.secondOfHour ?? 0),
    due = Object.values(s.contracts ?? {})
      .map(contractExpiresSeconds)
      .filter((value) => value !== null && value > now);
  return due.length ? Math.min(...due) - now : null;
}
const clone = (value) => {
  const definitions = value?.contentCampaign?.package;
  if (!definitions || !Object.isFrozen(definitions)) return JSON.parse(JSON.stringify(value));
  // Campaign definitions are immutable. Copy only the mutable campaign state,
  // including a new wrapper, and reuse its pinned package on each clock tick.
  const source = { ...value, contentCampaign: { ...value.contentCampaign } };
  delete source.contentCampaign.package;
  const pinnedRequest = value.pendingBattle?.campaignPackage === definitions;
  if (pinnedRequest) {
    source.pendingBattle = { ...value.pendingBattle };
    delete source.pendingBattle.campaignPackage;
  }
  const result = JSON.parse(JSON.stringify(source));
  result.contentCampaign.package = definitions;
  if (pinnedRequest) result.pendingBattle.campaignPackage = definitions;
  return result;
};
const clamp = (value) => Math.max(-100, Math.min(100, value));
export function campaignDate(s) {
  return scenarioFor(s).calendar(s);
}
const sector = (id, state) => campaignSectors(state).find((s) => s.id === id);
const random = (s) => {
  s.seed = (Math.imul(1664525, s.seed) + 1013904223) >>> 0;
  return s.seed / 4294967296;
};
const note = (s, text) => {
  s.log.unshift({
    hour: s.hour,
    ...(s.secondOfHour ? { secondOfHour: s.secondOfHour } : {}),
    text,
  });
  s.log = s.log.slice(0, 80);
};
const requireThat = (test, message) => {
  if (!test) throw Error(message);
};
const pay = (s, cost) => {
  for (const [key, value] of Object.entries(cost))
    requireThat(
      s.resources[key] >= value,
      `Faltan recursos: ${RESOURCE_NAMES[key] ?? key} (${value}).`,
    );
  for (const [key, value] of Object.entries(cost)) s.resources[key] -= value;
};
const add = (s, values) => {
  for (const [key, value] of Object.entries(values))
    s.resources[key] = (s.resources[key] ?? 0) + value;
};
const standing = (s, id, value) => {
  if (Object.hasOwn(s.reputation, id)) s.reputation[id] = clamp(s.reputation[id] + value);
};
const scenarioContext = (s) => ({
  requireThat,
  pay,
  add,
  standing,
  note,
  isSupplied,
  hasReadyCombatant,
  endingSpeech,
  ownedArtilleryCount,
  launchEnemyGroup,
  dispatchCampaign,
  prepareDeploymentExits,
  recordStrategicArrival,
  recordCityLoyalty,
  campaignDate,
  updateContentQuests,
  sector: (id) => sector(id, s),
});

function initializeCampaignSystems(s) {
  migrateLegacySkillLearning(s);
  const roster = rosterFor(s);
  migrateStartingCartridges(s);
  migrateServiceEquipmentReturns(s);
  s.horseState ??= { ...initialHorseState(), hour: s.hour };
  migrateMedicalCare(s, roster);
  migrateAssignments(s, roster);
  migrateMorale(s, roster);
  migrateAmmunitionCustody(s);
  migrateEquipment(s);
  migrateArtilleryState(s);
  migrateEnemyGroups(s);
  migrateDeploymentReturns(s);
  migrateAssignmentAttention(s);
  migrateContractAttention(s);
  migrateLogisticsAttention(s);
  migrateCampaignAmmunition(s, roster);
  initializeTownIncome(s);
  return s;
}
export function initialCampaign(seed = 1812, content = null) {
  const definitions = content === null ? null : resolveContent(content),
    state = scenarioFor(definitions).initialState(seed, definitions);
  // Set the authored clock before residents, timed events and service initialize.
  // Restore never reapplies this new-campaign setting to an existing save.
  if (definitions?.rules?.startingHour !== undefined) {
    state.hour = definitions.rules.startingHour;
    for (const entry of state.log) entry.hour = state.hour;
  }
  if (definitions !== null) attachCampaignContent(state, definitions);
  else {
    state.errandDefinitions = freshDefaultErrands();
    state.roadsideDiscoveryDefinitions = freshDefaultRoadsideDiscoveries();
  }
  state.gameRevision = 0;
  state.recruitmentVersion = 2;
  initializeCampaignSystems(state);
  if (initializeCampaignEvents(state)) progress(state);
  return state;
}
export const isSupplied = isSectorSupplied;
export function recruitmentStatus(s, id, local = false) {
  if (s.recruited.includes(id))
    return { available: false, reason: 'Ya se encuentra en tus filas.' };
  if (!s.operativeState[id]?.alive) return { available: false, reason: 'Ha caído en combate.' };
  if (s.operativeState[id]?.captured)
    return { available: false, reason: 'Está prisionero. Liberá el sector donde está detenido.' };
  const returnReason = serviceEquipmentReturnReason(s, id);
  if (returnReason) return { available: false, reason: returnReason };
  const character = characterForOperative(s, id);
  if (character && isWorldCharacter(character)) {
    const reason = !character.encounter.recruitable
      ? 'Este habitante no es un recluta.'
      : s.operativeState[id].captured
        ? 'Este habitante está cautivo.'
        : !local
          ? 'Buscá a este habitante en el mapa y hablá con él o ella.'
          : null;
    return { available: !reason, reason: reason ?? 'Disponible para incorporarse.' };
  }

  if (!local && encounterForOperative(id))
    return {
      available: false,
      reason: `Buscá a ${encounterForOperative(id).name} en su localidad y hablá con él o ella.`,
    };
  return scenarioFor(s).recruitmentGate(s, id);
}
export function campaignObjectives(s) {
  const index = campaignChapterIndex(s);
  return campaignChapters(s).map((p, i) => ({
    ...p,
    complete: campaignStory(s)
      ? i < s.campaignProgress.completed.length
      : i < s.phase || (i === campaignChapters(s).length - 1 && s.completed),
    active: i === index && !s.completed && !s.defeated,
  }));
}
export function availableActions(s) {
  return {
    recruits: rosterFor(s)
      .filter((o) => o.id !== 1000 && !isContractOperative(s, o))
      .map((o) => ({ ...o, ...recruitmentStatus(s, o.id) })),
    destinations: campaignSectors(s).filter((x) => x.id !== s.location),
    phase: campaignChapters(s)[campaignChapterIndex(s)],
  };
}
function hasReadyCombatant(s) {
  return s.recruited.some(
    (id) =>
      s.operativeState[id]?.alive && s.operativeState[id].hp > 0 && !s.operativeState[id].captured,
  );
}
function endingSpeech(s) {
  for (const op of rosterFor(s).filter(
    (o) => s.recruited.includes(o.id) && s.operativeState[o.id]?.alive,
  )) {
    const line = speechFor(op, 'ending');
    if (line?.trim()) note(s, `${op.name}: «${line}»`);
  }
}
function progress(s) {
  if (!s.completed) scenarioFor(s).progress(s, scenarioContext(s));
}
function raid(s, theater, forcedTarget = null) {
  return scenarioFor(s).raid(s, theater, forcedTarget, scenarioContext(s));
}
function loseSectorToGroup(s, group) {
  const region = s.sectors[group.target];
  region.damageUntil = s.hour + 24 * 14;
  recordCityLoyalty(s, { sectorId: group.target, kind: 'defeat', eventId: group.id });
  scenarioFor(s).occupySector(s, group, scenarioContext(s));
  region.militia = [0, 0, 0];
  delete s.garrisons[group.target];
  group.status = 'stationed';
  group.resolvedAt = s.hour;
  recordEnemyPresence(s, group);
}
function addDefenseHistory(s, group, outcome, casualties, text, extra = {}) {
  s.encounterHistory.unshift({
    groupId: group.id,
    sector: group.target,
    hour: s.hour,
    outcome,
    casualties,
    text,
    ...extra,
  });
  s.encounterHistory = s.encounterHistory.slice(0, 40);
}
function settleEnemyEncounters(s, options = {}) {
  if (s.pendingBattle || s.pendingEncounter) return;
  for (const group of s.enemyGroups
    .filter((g) => g.status === 'waiting')
    .sort((a, b) => a.arrivalAt - b.arrivalAt)) {
    if (
      s.sectors[group.target].owner !== 'patriot' &&
      !localDefenderCount(s, group.target, { exclude: options.traveling ?? [] })
    ) {
      group.status = 'stationed';
      group.resolvedAt = s.hour;
      continue;
    }
    if (!localDefenderCount(s, group.target, { exclude: options.traveling ?? [] })) {
      loseSectorToGroup(s, group);
      addDefenseHistory(
        s,
        group,
        'defeat',
        [],
        `${sector(group.target, s).name} no tenía defensores presentes.`,
      );
      continue;
    }
    queueEnemyEncounter(s);
    note(
      s,
      `¡Contacto en ${sector(group.target, s).name}! Elegí defensa táctica, resolución automática o retirada.`,
    );
    break;
  }
}
function meetEnemyGroups(s, at) {
  // A battle already in progress owns its enemy roster until its report returns.
  if (s.pendingBattle?.sector === at) return;
  haltEnemyGroupsAt(s, at);
  for (const group of occupyingGroups(s, at)) {
    group.status = 'waiting';
    group.resolvedAt = null;
  }
}
function relocateDefenders(s, ids, destination, moralePenalty = 5) {
  for (const id of ids) {
    recordStrategicArrival(s, [id], operativeLocation(s, id), destination);
    const r = s.operativeState[id];
    r.location = destination;
    r.assignment = 'active';
    r.asleep = false;
    r.recoveryHours = 0;
    r.energy = Math.max(0, r.energy - 10);
    gainFatigue(r, 8);
    r.morale = Math.max(0, r.morale - moralePenalty);
  }
  for (const squad of s.squads)
    if (squad.members.some((id) => ids.includes(id))) {
      delete squad.journey;
      squad.location = destination;
      if (squad.id === s.activeSquadId) s.location = destination;
    }
  for (const horse of s.horseState.horses)
    if (ids.includes(horse.assignedTo)) horse.location = destination;
}
// An empty roster is recoverable through paid recruitment, as at campaign start.
function reorganizeAfterLoss(s, previous) {
  if (
    s.defeated ||
    s.pendingBattle ||
    s.pendingEncounter ||
    s.sectors[headquartersFor(s)].owner !== 'patriot' ||
    s.recruited.some((id) => s.operativeState[id]?.alive)
  )
    return;
  const loss =
    (previous.pendingBattle && !s.pendingBattle) ||
    Object.entries(previous.operativeState).some(
      ([id, r]) =>
        r.alive &&
        (!s.operativeState[id]?.alive || (!r.captured && s.operativeState[id]?.captured)),
    );
  if (!loss) return;
  // Move the empty command only. Prisoners, casualties and property stay put.
  s.squad = [];
  const command = activeSquad(s);
  command.members = [];
  delete command.journey;
  s.location = headquartersFor(s);
  command.location = s.location;
  note(
    s,
    Object.values(s.operativeState).some((r) => r.alive && r.captured)
      ? `Quedan combatientes prisioneros. El cuartel de ${headquartersName(s)} puede contratar una fuerza de rescate.`
      : `No quedan combatientes en servicio. Podés contratar otra escuadra en ${headquartersName(s)}.`,
  );
}
function captureOperatives(s, ids, at, ammunition = {}) {
  for (const id of ids) {
    const r = s.operativeState[id],
      contract = clone(s.contracts[id]);
    removeFromService(s, id);
    Object.assign(r, {
      captureSequence: (r.captureSequence ?? 0) + 1,
      captured: true,
      capturedSector: at,
      capturedAt: s.hour,
      capturedAtSecond: s.secondOfHour ?? 0,
      capturedContract: contract,
      capturedAmmunition: clone(ammunition[id] ?? { loaded: 0, ammo: 0 }),
      location: at,
    });
  }
  if (ids.length)
    note(
      s,
      `${ids.map((id) => rosterFor(s).find((o) => o.id === id).nickname).join(', ')} quedan prisioneros en ${sector(at, s).name}.`,
    );
}
function releaseCaptives(s, at) {
  for (const h of s.horseState.horses)
    if (h.custody?.kind === 'field' && h.location === at) {
      h.custody = null;
      h.assignedTo = null;
    }
  for (const op of rosterFor(s)) {
    const r = s.operativeState[op.id];
    if (!r.captured || r.capturedSector !== at) continue;
    const held = r.capturedAmmunition ?? { loaded: 0, ammo: 0 };
    setCarriedLoading(r, { weapon: op.weapon, ...held, weaponDropped: r.weaponDropped });
    r.capturedAmmunition = { loaded: 0, ammo: 0 };
    for (const h of s.horseState.horses)
      if (h.custody?.kind === 'captured' && h.custody.operativeId === op.id) {
        h.custody = null;
        h.assignedTo = null;
      }
    const contract = restoredCaptiveContract(r, s.hour, s.secondOfHour ?? 0);
    if (!contract) settleServiceGuarantee(s, r.capturedContract, op);
    Object.assign(r, {
      asleep: false,
      captured: false,
      capturedSector: null,
      capturedAt: null,
      capturedAtSecond: null,
      capturedContract: null,
      location: at,
      arrival: null,
      residentSector: at,
      residentScene: null,
      assignment: r.hp < r.maxHp || r.bleeding ? 'patient' : 'rest',
    });
    delete r.residentPosition;
    if (!contract) {
      r.assignment = 'active';
      note(
        s,
        `${op.name} queda libre en ${sector(at, s).name}. Su contrato había terminado y puede volver a contratarse.`,
      );
      continue;
    }
    s.contracts[op.id] = contract;
    s.recruited.push(op.id);
    if (s.location === at && s.squad.length < 6) s.squad.push(op.id);
    note(
      s,
      `${op.name} vuelve al servicio tras la liberación de ${sector(at, s).name}. Conserva sus heridas y equipo.`,
    );
  }
}
function prepareDefense(s, group, { excludeMercs = false } = {}) {
  const at = group.target,
    def = sector(at, s),
    ids = excludeMercs ? [] : localDefenderIds(s, at),
    allocated = {};
  for (const q of s.squads) if (q.members.some((id) => ids.includes(id))) delete q.journey;
  for (const id of ids) {
    s.operativeState[id].assignment = 'active';
    s.operativeState[id].asleep = false;
    s.operativeState[id].recoveryHours = 0;
  }
  Object.assign(
    allocated,
    prepareCampaignAmmunition(s, rosterFor(s), ids, {
      at,
      supplied: isSupplied(s, at),
      commit: true,
    }).allocation,
  );
  const request = {
    ...(s.contentCampaign ? { campaignPackage: s.contentCampaign.package } : {}),
    id: `defense-${group.id}-${s.hour}`,
    sector: at,
    origin: s.location,
    name: `Defensa de ${def.name}`,
    biome: def.biome,
    theater: def.theater,
    seed: group.seed,
    hour: s.hour,
    secondOfHour: s.secondOfHour ?? 0,
    defenseGroupId: group.id,
    defenseFort: s.sectors[at].owner === 'patriot' ? s.sectors[at].fort : 0,
    issuedCartridges: Object.values(allocated).reduce((sum, u) => sum + u.loaded + u.ammo, 0),
    wasRoyalist: s.sectors[at].owner === 'royalist',
    difficulty: 1,
    npcs: encountersFor(s, at),
    detainedPrisoners: detentionManifest(s, rosterFor(s), at),
    squad: ids.map((id) => ({
      ...deploymentOperative(s, id),
      ...deploymentMorale(s, id, ids),
      ...allocated[id],
      ...(mountForOperative(s.horseState, id) ?? { horse: false, canMount: false }),
    })),
    enemies: clone(group.units),
    garrison: prepareGarrison(s, at),
    artillery: !excludeMercs && ids.length && at === s.location ? deployedArtillery(s) : [],
    ...regionalConditions(at, s.hour, s),
    enemyCommand: group.command,
    enemyCommander:
      enemyCommandsFor(s).find((c) => c.id === group.command)?.commander ?? 'Mando adversario',
  };
  group.status = 'engaged';
  s.pendingEncounter = null;
  s.pendingBattle = prepareDeploymentExits(s, prepareSectorArtillery(s, request));
  return request;
}
function finishDefense(s, request, outcome, snapshot, plan) {
  const group = recordEnemyGroupResult(s, request.defenseGroupId, snapshot, outcome),
    ids = request.squad.map((u) => Number(u.id)),
    casualties = ids.filter((id) => !s.operativeState[id].alive);
  const captured = plan.entries.filter((e) => e.kind === 'captured').map((e) => Number(e.unitId));
  if (outcome === 'victory') {
    if (
      !s.enemyGroups.some(
        (g) => g.target === group.target && ['waiting', 'engaged', 'stationed'].includes(g.status),
      )
    ) {
      if (request.wasRoyalist) s.sectors[group.target].owner = 'patriot';
      releaseCaptives(s, group.target);
    }
    recordCityLoyalty(s, { sectorId: group.target, kind: 'defense', eventId: group.id });
    scenarioFor(s).clearVictoryBlockade(s, group);
    note(
      s,
      `La defensa de ${sector(group.target, s).name} rechaza a ${group.initialStrength} ${scenarioFor(s).enemyName}.`,
    );
  } else loseSectorToGroup(s, group);
  for (const squad of s.squads)
    squad.members = squad.members.filter(
      (id) => s.operativeState[id].alive && !s.operativeState[id].captured,
    );
  s.squad = s.squad.filter((id) => s.operativeState[id].alive && !s.operativeState[id].captured);
  const militiaCasualties = (request.garrison ?? [])
      .filter(
        (u) =>
          deploymentCharacters(snapshot, request).find((v) => String(v.id) === String(u.id))?.hp <=
          0,
      )
      .map((u) => u.id),
    militiaDispersed =
      outcome === 'victory' ? 0 : (request.garrison?.length ?? 0) - militiaCasualties.length;
  const text = `${sector(group.target, s).name}: ${outcome === 'victory' ? 'defensa victoriosa' : outcome === 'retreat' ? 'retirada' : 'defensa derrotada'}. ${casualties.length} granaderos y ${militiaCasualties.length} milicianos caídos; ${captured.length} prisioneros${militiaDispersed ? `; ${militiaDispersed} milicianos dispersos` : ''}.`;
  addDefenseHistory(s, group, outcome, casualties, text, {
    captured,
    militiaCasualties,
    militiaDispersed,
    dispositions: clone(plan.entries),
  });
  note(s, text);
  s.sectorStates[group.target] = clone(snapshot);
  s.pendingBattle = null;
}
function applyTacticalTime(s, request, elapsed) {
  const previous = request.syncedSeconds ?? 0;
  requireThat(
    Number.isSafeInteger(elapsed) && elapsed >= previous && elapsed - previous <= 864000,
    'El tiempo táctico es inválido.',
  );
  for (let remaining = elapsed - previous; remaining > 0;) {
    const step = Math.min(
      remaining,
      3600 - (s.secondOfHour ?? 0),
      nextSquadTravelBoundarySeconds(s) ?? Infinity,
    );
    remaining -= step;
    s.secondOfHour = (s.secondOfHour ?? 0) + step;
    if (s.secondOfHour === 3600) {
      s.secondOfHour = 0;
      advanceCampaignHour(s, { stopOnDefeat: false, civilianSeconds: step, travelSeconds: step });
    } else advanceFractionalSystems(s, step);
  }
  request.syncedSeconds = elapsed;
}
// Receipt counts are acknowledgement markers, never a second item inventory.
// Check only the small NPC receipt lists on ordinary clock synchronizations.
function validateAcknowledgedNpcGiftReceipts(campaign, npcs, sectorId) {
  for (const quest of questsFor(campaign))
    for (const npcId of questContactIds(quest)) {
      const acknowledged = campaign.conversations?.[npcId]?.giftCount ?? 0,
        at = questBeneficiaryForNPC(quest, npcId)?.sector ?? quest.sector;
      if (!quest.carried || at !== sectorId || !acknowledged) continue;
      const npc = npcs.find((n) => n?.id === npcId);
      requireThat(npc, 'Falta el interlocutor que recibió los objetos del encargo.');
      requireThat(
        validateQuestGifts(npc, campaign).length >= acknowledged,
        'El parte perdió objetos que el interlocutor ya recibió.',
      );
    }
}
export function hasPendingNpcGiftProgress(campaign, battle) {
  validateQuestContext(campaign, battle);
  validateRoadsideDiscoveryContext(campaign, battle);
  validateQuestBeneficiaryContext(campaign, battle);
  if (campaign.pendingBattle && Array.isArray(battle.units))
    validateCompanionGriefContext(campaign, battle, rosterFor(campaign));
  if (campaign.pendingBattle && Array.isArray(battle.units))
    validateServiceObjectionContext(campaign, battle, rosterFor(campaign));
  const npcs = battle.npcs ?? [];
  requireThat(
    Array.isArray(npcs) && npcs.length <= 2000,
    'Los interlocutores del despliegue son inválidos.',
  );
  validateAcknowledgedNpcGiftReceipts(campaign, npcs, campaign.pendingBattle?.sector);
  let changed = false;
  for (const npc of npcs) {
    const quest = questForNPC(campaign, npc?.id);
    if (npc?.questGifts === undefined && !quest?.carried) continue;
    const count = validateQuestGifts(npc, campaign).length,
      acknowledged = campaign.conversations?.[npc.id]?.giftCount ?? 0;
    requireThat(count >= acknowledged, 'El parte perdió objetos que el interlocutor ya recibió.');
    if (questGiftProgressPending(quest, count, acknowledged)) changed = true;
  }
  return changed;
}
function deploymentCharacters(snapshot, request) {
  const issued = new Set(
    [
      ...(request.squad ?? []),
      ...(request.garrison ?? []),
      ...(request.missionAllies ?? []),
      ...(request.enemies ?? []),
    ].map((character) => String(character.id)),
  );
  return [
    ...snapshot.units,
    ...removedSectorCharacters(snapshot).filter((character) => issued.has(String(character.id))),
  ];
}
function validatedInteractionSnapshot(s, raw) {
  const snapshot = validateSectorSnapshot(raw, s),
    request = s.pendingBattle;
  validateCampaignSceneDefinitions(s, snapshot);
  validateQuestContext(s, snapshot);
  validateRoadsideDiscoveryContext(s, snapshot);
  validateQuestBeneficiaryContext(s, snapshot);
  validateCompanionGriefContext(s, snapshot, rosterFor(s));
  validateRepairReserveContext(request, snapshot);
  validateAbilityReferences(s, snapshot);
  validateServiceObjectionContext(s, snapshot, rosterFor(s));
  requireThat(
    snapshot.battleId === request.id &&
      snapshot.sectorId === request.sector &&
      (snapshot.sceneId ?? null) === (request.sceneId ?? null),
    'La entrega no corresponde al despliegue pendiente.',
  );
  const ids = request.squad.map((u) => String(u.id)),
    allowed = new Set([
      ...ids,
      ...(request.garrison ?? []).map((u) => String(u.id)),
      ...(request.missionAllies ?? []).map((u) => String(u.id)),
    ]);
  const previous = request.sceneId
      ? s.sceneStates[request.sceneId]
      : s.sectorStates[request.sector],
    corpses = new Set([
      ...(previous?.units ?? []).filter((u) => u.side === 'player' && u.hp <= 0).map((u) => u.id),
      ...(request.remains ?? []).map((r) => String(r.unitId)),
    ]);
  const players = deploymentCharacters(snapshot, request).filter((u) => u.side === 'player');
  requireThat(
    allowed.size > 0 &&
      ids.every((id) => players.some((u) => u.id === id)) &&
      players.every((u) => allowed.has(u.id) || (u.hp <= 0 && corpses.has(u.id))),
    'La entrega no corresponde a la escuadra desplegada.',
  );
  requireThat(
    request.squad.every((u) => s.recruited.includes(Number(u.id))),
    'La escuadra de la entrega no pertenece a la campaña.',
  );
  let retainedRoster = false;
  for (const local of snapshot.npcs) {
    if (!local.questGifts?.length) continue;
    const npc = encounterDefinitions(s).find((n) => n.id === local.id);
    // Combat requests may omit the civilian roster. Only an existing, same-scene
    // nonrecruitable gift owner can supply that missing authorization.
    const old = previous?.npcs?.find((n) => n.id === local.id);
    const retained =
      request.npcs === undefined &&
      npc &&
      !canRecruitEncounter(npc) &&
      local.operativeId === npc.operativeId &&
      old?.operativeId === npc.operativeId &&
      previous?.sectorId === request.sector &&
      (previous.sceneId ?? null) === (request.sceneId ?? null) &&
      old &&
      validateQuestGifts(old, s).length > 0;
    requireThat(
      npc && (request.npcs?.some((n) => n.id === npc.id) || retained),
      'El receptor no pertenece al sector del despliegue.',
    );
    if (retained) retainedRoster = true;
  }
  // Convert the old omitted-roster defense format once, from the validated
  // retained scene rather than from the submitted receipt or current location.
  if (retainedRoster) request.npcs = clone(previous.npcs.filter((n) => n.detention === undefined));
  validateAcknowledgedNpcGiftReceipts(s, snapshot.npcs, request.sector);
  hasPendingCivilians(s, snapshot);
  retainRepairReserves(request, snapshot);
  return snapshot;
}
function rewardQuest(s, quest, resolution = null) {
  const branch = quest.beneficiaries?.find((b) => b.id === s.quests[quest.id]?.beneficiaryId);
  const reward = branch
    ? branch.reward
    : resolution === null
      ? typeof quest.reward === 'object'
        ? quest.reward
        : { treasury: quest.reward ?? 0, loyalty: s.contentCampaign?.package.errands === undefined }
      : questResolutionReward(quest, resolution, s);
  requireThat(
    s.resources.treasury + reward.treasury <= 1e9,
    'La recompensa supera el límite de tesorería.',
  );
  s.resources.treasury += reward.treasury;
  if (reward.loyalty)
    recordCityLoyalty(s, {
      sectorId: branch?.sector ?? quest.sector,
      kind: 'quest',
      eventId: `npc-${quest.id}`,
    });
}
function acknowledgeNpcGifts(s, snapshot) {
  retainQuestBeneficiaries(s, s.pendingBattle, snapshot);
  for (const local of snapshot.npcs) {
    let quest = questForNPC(s, local.id);
    if (!quest?.carried) continue;
    const count = validateQuestGifts(local, s).length,
      previous = s.conversations?.[local.id],
      acknowledged = previous?.giftCount ?? 0;
    requireThat(count >= acknowledged, 'El parte perdió objetos que el interlocutor ya recibió.');
    const complete =
      !quest.rewardChoice &&
      !quest.beneficiaries &&
      count === quest.carried.count &&
      !['completed', 'failed', 'withdrawn'].includes(quest.status) &&
      quest.conditionMet;
    if (!questGiftProgressPending(quest, count, acknowledged)) continue;
    if (!count) continue;
    const npc = encounterDefinitions(s).find((n) => n.id === local.id);
    if (quest.status === 'unoffered')
      s.quests[quest.id] = { status: 'offered', offeredAt: s.hour, completedAt: null };
    // Gifts can arrive at the first checkpoint together with the recipient's
    // recorded death. A new pending choice must fail there, before any reward.
    if ((quest.rewardChoice || quest.beneficiaries) && (local.hp ?? 100) <= 0) {
      for (const text of failQuestsForDeadContact(
        s,
        snapshot.sectorId,
        snapshot.sceneId ?? null,
        local.id,
      ))
        note(s, text);
      quest = questForNPC(s, local.id);
    }
    let text = `Recibimos ${count} de ${quest.carried.count} ${quest.carried.label.toLowerCase()}. Todavía faltan objetos para completar el encargo.`,
      outcome = 'questProgress';
    if (complete) {
      s.quests[quest.id] = { ...s.quests[quest.id], status: 'completed', completedAt: s.hour };
      rewardQuest(s, quest);
      note(s, `Encargo cumplido: ${quest.title}. La ciudad reconoce el servicio.`);
      text = quest.delivery;
      outcome = 'questCompleted';
    } else if (count === quest.carried.count) {
      text = quest.status === 'completed' ? quest.delivery : questDeliveryText(quest, count, s);
    }
    s.conversations ??= {};
    s.conversations[npc.id] = {
      ...s.conversations[npc.id],
      met: true,
      lastApproach: 'gift',
      hour: s.hour,
      secondOfHour: s.secondOfHour ?? 0,
      text,
      giftCount: count,
    };
    s.lastConversation = {
      npcId: npc.id,
      speaker: npc.name,
      text,
      outcome,
      giftCount: count,
      operativeId: npc.operativeId ?? null,
      options: dialogueOptions(npc, questForNPC(s, npc.id)).map(([id]) => id),
    };
  }
}
function resolveDefenseAutomatically(s, request) {
  const result = autoResolve(request, s.sectorStates[request.sector] ?? null);
  applyTacticalTime(s, request, result.battle.elapsedSeconds ?? 0);
  result.battle.syncedSeconds = request.syncedSeconds;
  result.battle.savedHour = s.hour;
  result.battle.savedSecond = s.secondOfHour;
  if (result.outcome === null) {
    validateCompanionGriefContext(s, result.battle, rosterFor(s), request);
    validateServiceObjectionContext(s, result.battle, rosterFor(s), request);
    retainCompanionGrief(request, result.battle);
    retainServiceObjections(request, result.battle);
    acknowledgeNpcGifts(s, result.battle);
    request.resumeSnapshot = clone(result.battle);
    note(
      s,
      'La resolución automática continúa pendiente. Retomá el combate y ayudá a quienes aún no pudieron salir.',
    );
    return;
  }
  const next = dispatchCampaign(s, {
    type: 'battleResult',
    battleId: request.id,
    outcome: result.outcome,
    survivors: result.battle.units.filter((u) => u.side === 'player'),
    sectorState: result.battle,
  });
  requireThat(!next.lastError, next.lastError);
  Object.assign(s, next);
}
function completeDeploymentReport(s, request, action) {
  requireThat(
    action.sectorState && Array.isArray(action.survivors),
    'El despliegue necesita un estado táctico completo y un parte de todos los combatientes.',
  );
  validateQuestContext(s, action.sectorState);
  validateQuestBeneficiaryContext(s, action.sectorState, { request });
  validateRoadsideDiscoveryContext(s, action.sectorState);
  const raw = action.sectorState,
    snapshot = validateSectorSnapshot(raw, s),
    ids = request.squad.map((u) => String(u.id));
  validateCampaignSceneDefinitions(s, snapshot);
  validateRepairReserveContext(request, snapshot);
  validateAbilityReferences(s, snapshot);
  validateCompanionGriefContext(s, snapshot, rosterFor(s), request);
  validateServiceObjectionContext(s, snapshot, rosterFor(s), request);
  requireThat(
    snapshot.battleId === request.id &&
      snapshot.sectorId === request.sector &&
      (snapshot.sceneId ?? null) === (request.sceneId ?? null),
    'El estado táctico no corresponde al despliegue y sector pendientes.',
  );
  requireThat(
    worldCell(request.sector, s)?.anchor !== false || snapshot.sourceMapId === request.sector,
    'El parte no corresponde a la celda del despliegue.',
  );
  validateAcknowledgedNpcGiftReceipts(s, snapshot.npcs, request.sector);
  hasPendingCivilians(s, snapshot);
  const previous = request.sceneId
    ? s.sceneStates[request.sceneId]
    : s.sectorStates[request.sector];
  const auxiliary = [...(request.garrison ?? []), ...(request.missionAllies ?? [])].map((u) =>
      String(u.id),
    ),
    known = new Set([...ids, ...auxiliary]),
    corpses = [
      ...(previous?.units ?? []).filter((u) => u.side === 'player' && u.hp <= 0),
      ...(request.remains ?? []).map((r) => r.unit),
    ].map((u) => String(u.id)),
    received = action.survivors.map((u) => u && String(u.id));
  requireThat(
    action.survivors.every((u) => u && typeof u === 'object' && !Array.isArray(u)) &&
      new Set(received).size === received.length &&
      received.every((id) => known.has(id) || corpses.includes(id)) &&
      ids.every((id) => received.includes(id)),
    'El parte debe incluir exactamente a todos los combatientes desplegados, vivos o caídos.',
  );
  const players = deploymentCharacters(snapshot, request).filter((u) => u.side === 'player');
  requireThat(
    [...ids, ...auxiliary, ...(request.remains ?? []).map((r) => r.unitId)].every((id) =>
      players.some((u) => u.id === id),
    ) && players.every((u) => known.has(u.id) || (u.hp <= 0 && corpses.includes(u.id))),
    'El estado táctico contiene una escuadra incompleta o ajena al despliegue.',
  );
  const source =
      !request.exploration &&
      !request.defenseGroupId &&
      !request.occupationGroupIds?.length &&
      previous &&
      !previous.sectorCleared
        ? previous.units.filter((u) => u.side === 'enemy' && !u.departure)
        : (request.enemies ?? []),
    enemyIds = new Set(source.map((u) => String(u.id))),
    enemies = deploymentCharacters(snapshot, request).filter((u) => u.side === 'enemy');
  // Re-entry also retains incapacitated enemies from a cleared sector. Use
  // the same identities as placement, including collisions with a new force.
  const retained = retainedMilitaryBodies(
    previous,
    [...request.squad, ...(request.garrison ?? []), ...(request.missionAllies ?? []), ...source],
    request.sector,
  ).filter((u) => u.side === 'enemy' && !u.departure);
  // Retained living casualties can receive the same finite critical first aid
  // as the new garrison. An identity collision never grants a second issue or
  // revives a dead body. Bound all restored HP by the actual enemy dressing
  // debit, including care supplied by a different soldier.
  const enemyIssue = [
    ...new Map([...source, ...retained].map((unit) => [String(unit.id), unit])).values(),
  ];
  const healers = enemyIssue.filter(
    (old) =>
      (old.hp ?? old.health ?? old.stats?.health ?? 100) >= CRITICAL_HEALTH &&
      (old.energy ?? 100) > 0 &&
      !old.unconscious &&
      !old.departure &&
      !old.routed &&
      !old.surrendered &&
      (old.medical ?? old.stats?.medical ?? 30) > 0 &&
      (old.medkits ?? 2) > (enemies.find((unit) => unit.id === String(old.id))?.medkits ?? 0),
  );
  const dressingDebit = healers.reduce(
    (sum, old) =>
      sum + (old.medkits ?? 2) - (enemies.find((unit) => unit.id === String(old.id))?.medkits ?? 0),
    0,
  );
  let criticalDressings = 0;
  const authorizedRetained = (unit) => {
    const old = retained.find((old) => old.id === unit.id);
    if (!old) return false;
    if (unit.originalUnitId !== old.originalUnitId || unit.maxHp !== old.maxHp) return false;
    if (unit.hp <= old.hp) return true;
    if (!(old.hp > 0 && unit.hp <= CRITICAL_HEALTH && old.hp < CRITICAL_HEALTH)) return false;
    const capacity = Math.max(
      0,
      ...healers.map(
        (healer) =>
          firstAidPlan(
            {
              ...healer,
              medical: healer.medical ?? healer.stats?.medical ?? 30,
              dexterity: healer.dexterity ?? healer.stats?.dexterity ?? 75,
              experienceLevel:
                healer.experienceLevel ??
                healer.stats?.experienceLevel ??
                Math.min(10, 4 + Math.floor((healer.xp ?? 0) / 100)),
              medkits: 1,
            },
            { ...old, hp: 1, bleeding: 0, bandaged: 0 },
          ).hpGain,
      ),
    );
    if (!capacity) return false;
    criticalDressings += Math.ceil((unit.hp - old.hp) / capacity);
    return true;
  };
  requireThat(
    [...enemyIds].every((id) => enemies.some((u) => u.id === id)) &&
      retained.every((old) => {
        const unit = enemies.find((u) => u.id === old.id);
        return unit && authorizedRetained(unit);
      }) &&
      enemies.every((u) => enemyIds.has(u.id) || retained.some((old) => old.id === u.id)) &&
      (!criticalDressings || criticalDressings <= dressingDebit),
    'El estado táctico no incluye a todos los enemigos del despliegue.',
  );
  const required = [
    'hp',
    'maxHp',
    'weapon',
    'condition',
    'jammed',
    'loaded',
    'ammo',
    'inventory',
    'bleeding',
    'bandaged',
    'energy',
    'medkits',
    'fatigue',
    'rations',
    'torches',
    'boleadoras',
    'activeSlot',
  ];
  if (request.fittingRulesVersion === FITTING_RULES_VERSION) {
    requireThat(
      raw.fittingRulesVersion === FITTING_RULES_VERSION,
      'El parte no contiene la versión de accesorios del despliegue.',
    );
    required.push('weaponFittings', 'weaponFittingPattern', 'bladeFittingPattern');
  }
  for (const id of known) {
    const unit = deploymentCharacters(raw, request).find(
      (u) => u.side === 'player' && String(u.id) === id,
    );
    requireThat(
      unit && required.every((key) => Object.hasOwn(unit, key) && unit[key] !== undefined),
      'El equipo y la salud del combatiente están incompletos.',
    );
  }
  const missionFailed = scenarioFor(s).missionFailed(request, snapshot),
    able = (side) => snapshot.units.some((u) => u.side === side && fieldCapable(u));
  requireThat(
    request.exploration ||
      missionFailed ||
      (action.outcome === 'victory'
        ? completedTacticalVictory(snapshot)
        : action.outcome === 'retreat'
          ? snapshot.status === 'retreat' &&
            !able('player') &&
            snapshot.units.some((u) => u.side === 'player' && u.departure)
          : snapshot.status === action.outcome && !able('player')),
    'El resultado no corresponde al desenlace táctico.',
  );
  validateArtilleryReport(request, snapshot);
  return { snapshot, reports: ids.map((id) => players.find((u) => u.id === id)) };
}
function applyReturnedOperative(s, request, report) {
  const id = Number(report.id);
  returnMount(s, id, report);
  returnTraining(s, id, report);
  const op = rosterFor(s).find((o) => o.id === id);
  returnEquipment(s, id, report);
  returnMedicalCare(s, id, report, op);
  returnMorale(
    s,
    id,
    report,
    request.squad.find((u) => Number(u.id) === id),
  );
  returnCompanionGrief(s, id, report);
  returnServiceObjection(s, id, report);
  s.operativeState[id].toolkitPoints = validateRepairReserve(report);
  for (const [field, max] of Object.entries({
    energy: 100,
    weight: 1000,
    strength: 100,
    strengthTraining: 10000,
    rations: 100000,
    torches: 100000,
    condition: 100,
    fatigue: 100,
    boleadoras: 100000,
  }))
    if (report[field] !== undefined) {
      requireThat(
        Number.isFinite(report[field]) && report[field] >= 0 && report[field] <= max,
        'El estado del combatiente es inválido.',
      );
      s.operativeState[id][field] = report[field];
    }
  if (s.operativeState[id].sleepCollapsed && !needsCollapseRecovery(s.operativeState[id]))
    s.operativeState[id].sleepCollapsed = false;
  s.operativeState[id].inventory = clone(validatePersonalInventory(report.inventory));
  validatePocketOrder(report.pocketOrder);
  if (report.pocketOrder === undefined) delete s.operativeState[id].pocketOrder;
  else s.operativeState[id].pocketOrder = clone(report.pocketOrder);
}
function commitDeploymentReturn(s, request, snapshot, plan) {
  applyTacticalTime(s, request, snapshot.elapsedSeconds ?? 0);
  snapshot.syncedSeconds = request.syncedSeconds;
  snapshot.savedHour = s.hour;
  snapshot.savedSecond = s.secondOfHour;
  // An older save may still carry another squad's last real position only in
  // the shared scene. Preserve that point before the new squad replaces it.
  const priorScene = request.sceneId
      ? s.sceneStates[request.sceneId]
      : s.sectorStates[request.sector],
    issued = new Set(plan.entries.map((e) => e.unitId));
  for (const unit of priorScene?.units ?? []) {
    const r = s.operativeState[Number(unit.id)];
    if (
      unit.side === 'player' &&
      unit.hp > 0 &&
      !unit.departure &&
      !issued.has(unit.id) &&
      r?.alive &&
      r.residentPosition === undefined &&
      r.residentSector === request.sector &&
      (r.residentScene ?? null) === (request.sceneId ?? null)
    )
      r.residentPosition = {
        x: unit.x,
        y: unit.y,
        ...(unit.tacticalLevel === undefined ? {} : { tacticalLevel: unit.tacticalLevel }),
      };
  }
  retainQuestBeneficiaries(s, request, snapshot);
  acknowledgeCivilians(s, snapshot);
  acknowledgeNpcGifts(s, snapshot);
  acknowledgeSuccessionDeaths(s, snapshot);
  for (const entry of plan.entries) {
    const id = Number(entry.unitId),
      unit = deploymentCharacters(snapshot, request).find(
        (u) => u.side === 'player' && u.id === entry.unitId,
      );
    applyReturnedOperative(s, request, unit);
    const r = s.operativeState[id];
    r.location = entry.sector;
    clearCarriedLoading(r);
    const loading = plan.ammunition.carried[id];
    if (loading) setCarriedLoading(r, { weapon: unit.weapon, ...loading });
    syncCarriedAmmunition(r, unit.weapon);
    if (['dead', 'dispersed'].includes(entry.kind) && r.activeItem === 'ammo') {
      delete r.activeItem;
      r.activeSlot = 'unarmed';
    }
    r.arrival =
      entry.kind === 'departed'
        ? {
            battleId: request.id,
            fromSector: request.sector,
            fromScene: request.sceneId ?? null,
            exitId: entry.departure.exitId,
            entryEdge: entry.departure.entryEdge,
            entryAnchor: clone(entry.departure.entryAnchor),
          }
        : null;
    r.residentSector = entry.kind === 'resident' ? request.sector : null;
    r.residentScene = entry.kind === 'resident' ? (request.sceneId ?? null) : null;
    // Other local squads replace the scene's issued units when they return.
    // Keep only this person's actual position; current campaign gear remains
    // authoritative and is never copied from an absent scene participant.
    if (entry.kind === 'resident')
      r.residentPosition = {
        x: unit.x,
        y: unit.y,
        ...(unit.tacticalLevel === undefined ? {} : { tacticalLevel: unit.tacticalLevel }),
      };
    else delete r.residentPosition;
  }
  requireThat(
    Object.values(plan.ammunition.creditedAmmunition ?? {}).every((count) => count === 0),
    'El parte intenta crear una reserva global de munición.',
  );
  if (request.exploration)
    recordCasualtyMorale(
      s,
      plan.entries.filter((e) => e.kind === 'dead').map((e) => Number(e.unitId)),
      request.squad.map((u) => Number(u.id)),
    );
  else recordBattleMorale(s, request, plan.outcome, snapshot);
  const captured = plan.entries.filter((e) => e.kind === 'captured').map((e) => Number(e.unitId));
  captureOperatives(s, captured, plan.sourceSector, plan.ammunition.custody);
  for (const entry of plan.entries)
    receiveServiceObjectionCorrespondence(
      s,
      rosterFor(s).find((operative) => operative.id === Number(entry.unitId)),
    );
  receiveCompanionLossCorrespondence(
    s,
    rosterFor(s),
    plan.entries.filter((e) => e.kind === 'dead').map((e) => Number(e.unitId)),
    { settledIds: plan.entries.map((e) => Number(e.unitId)), battleId: request.id },
  );
  s.squads = clone(plan.squadChanges.squads);
  const selected = s.squads.find((q) => q.id === s.activeSquadId);
  s.squad = [...selected.members];
  s.location = selected.location;
  for (const change of plan.horseChanges)
    Object.assign(
      s.horseState.horses.find((h) => h.id === change.id),
      clone(change),
    );
  for (const h of s.horseState.horses)
    if (
      h.custody?.kind === 'field' &&
      s.sectors[h.location]?.owner === 'patriot' &&
      !occupyingGroups(s, h.location).length &&
      plan.outcome !== 'defeat'
    )
      h.custody = null;
  settlePrisonerEscapes(s, request, snapshot, rosterFor(s));
  returnGarrison(s, request, snapshot, plan.auxiliary);
  settleSectorArtillery(snapshot, plan.outcome);
  recordFiniteArsenalRecovery(s, request, snapshot);
  snapshot.returnLedger = {
    battleId: request.id,
    entries: clone([...plan.entries, ...plan.auxiliary]),
    creditedCartridges: plan.ammunition.creditedCartridges,
    creditedAmmunition: clone(plan.ammunition.creditedAmmunition),
  };
  // A new report cannot invent or erase an earlier accepted unpaid reward.
  delete snapshot.pendingVictoryFunds;
  const funds = s.sectorStates[request.sector]?.pendingVictoryFunds;
  if (!request.sceneId && funds) snapshot.pendingVictoryFunds = clone(funds);
  if (!request.sceneId) collectSectorCash(s, snapshot);
  const delivered = new Set((request.remains ?? []).map((r) => `${r.battleId}:${r.unitId}`));
  s.sectorRemains[plan.sourceSector] = (s.sectorRemains[plan.sourceSector] ?? []).filter(
    (r) => !delivered.has(`${r.battleId}:${r.unitId}`),
  );
  for (const e of [...plan.entries, ...plan.auxiliary].filter(
    (e) => e.kind === 'dead' && e.departure,
  )) {
    const unit = clone(snapshot.units.find((u) => u.id === e.unitId));
    delete unit.entryEdge;
    delete unit.entryAnchor;
    delete unit.entryReason;
    s.sectorRemains[e.sector] ??= [];
    s.sectorRemains[e.sector].push({
      battleId: request.id,
      unitId: e.unitId,
      unit,
      entryEdge: e.departure.entryEdge,
      entryAnchor: clone(e.departure.entryAnchor),
    });
  }
  if (request.sceneId) s.sceneStates[request.sceneId] = clone(snapshot);
  else s.sectorStates[request.sector] = clone(snapshot);
}
function advanceCampaignHorses(s) {
  const held = s.horseState.horses.filter(
    (h) => deployed(s, h.assignedTo) || operativeInTransit(s, h.assignedTo),
  );
  s.horseState = applyHorseAction(s.horseState, { type: 'advance', hour: s.hour });
  for (const h of held) {
    const next = s.horseState.horses.find((v) => v.id === h.id);
    Object.assign(next, {
      stamina: h.stamina,
      condition: Math.min(h.condition, next.condition),
      assignedTo: h.assignedTo,
      returned: Boolean(h.returned),
    });
  }
}
function releaseDeferred(s) {
  if (s.pendingBattle) return;
  if (s.horseState.horses.some((h) => h.hired && !h.returned && h.hireUntil <= s.hour))
    advanceCampaignHorses(s);
  for (const id of [...s.recruited])
    if (s.contracts?.[id]?.departurePending && !operativeInTransit(s, id)) endExpiredService(s, id);
  const raids = s.deferredRaids ?? [];
  s.deferredRaids = [];
  for (const r of raids) launchEnemyGroup(s, r.theater, r.target, { immediate: true });
  settleEnemyEncounters(s);
}
function assignmentContext(s, options = {}) {
  const unsafe = s.recruited.filter((id) =>
    s.enemyGroups.some(
      (g) =>
        ['waiting', 'engaged', 'stationed'].includes(g.status) &&
        g.target === operativeLocation(s, id),
    ),
  );
  return {
    ...options,
    isSupplied,
    unsafe,
    traveling: [...(options.traveling ?? []), ...travelingOperatives(s), ...unsafe],
  };
}
function pauseForAssignments(s, hours, advancedHours, extraEvents = []) {
  const events = collectAssignmentAttention(
    s,
    assignmentStates(s, rosterFor(s), assignmentContext(s)),
    extraEvents,
  );
  if (!events.length) return false;
  s.assignmentAttention.notice = { hour: s.hour, requestedHours: hours, advancedHours, events };
  note(
    s,
    `El avance se detuvo tras ${advancedHours} de ${hours} horas: hay novedades en las asignaciones.`,
  );
  return true;
}
function pauseForContracts(s, hours, advancedHours, extra = []) {
  const events = collectContractAttention(s, extra);
  if (!events.length) return false;
  s.contractAttention.notice = {
    hour: s.hour,
    ...(s.secondOfHour ? { secondOfHour: s.secondOfHour } : {}),
    requestedHours: hours,
    advancedHours,
    events,
  };
  note(
    s,
    `El avance se detuvo tras ${advancedHours} de ${hours} horas: hay contratos por revisar.`,
  );
  return true;
}
function pauseForLogistics(s, hours, advancedHours, completed = []) {
  const events = [...completed, ...collectLogisticsAttention(s, { isSupplied })];
  if (!recordLogisticsNotice(s, hours, advancedHours, events)) return false;
  note(
    s,
    `El avance se detuvo tras ${advancedHours} de ${hours} horas: hay novedades en producción y entregas.`,
  );
  return true;
}
function recordSleepEvents(s, events) {
  return events.map((event) => {
    note(
      s,
      `${rosterFor(s).find((op) => op.id === event.id).nickname}: ${SLEEP_ISSUE_TEXT[event.code]}`,
    );
    return sleepAttention(s, event);
  });
}
// The caller has set the interval endpoint. Resolve deaths and quest deadlines
// inside that interval at their real timestamps, then restore the endpoint for
// ordinary hourly work. A large checkpoint and several short ones agree.
function advanceOffscreenTime(s, seconds) {
  const end = s.hour * 3600 + (s.secondOfHour ?? 0),
    contractEvents = [];
  let at = end - seconds;
  const setTime = (t) => {
    s.hour = Math.floor(t / 3600);
    s.secondOfHour = t % 3600;
  };
  setTime(at);
  while (at < end) {
    const midnight = (Math.floor(at / 86400) + 1) * 86400;
    const next = Math.min(
      end,
      midnight,
      at + nextUnloadedCivilianDeath(s),
      nextContentQuestDeadline(s),
      nextCampaignPresenceChange(s),
      nextCampaignEventTime(s),
      at + (nextHireArrivalSeconds(s) ?? Infinity),
      at + (nextContractExpirySeconds(s) ?? Infinity),
    );
    requireThat(
      Number.isSafeInteger(next) && next > at,
      'El intervalo de los habitantes no es válido.',
    );
    setTime(next);
    advanceUnloadedCivilians(s, next - at);
    advanceCampaignWorld(s);
    at = next;
    if (at === midnight) {
      const payment = collectTownIncome(s);
      if (payment.amount)
        note(s, `Los puertos acordados aportaron ${payment.amount} pesos a la tesorería.`);
    }
    // Delivery at a whole-hour endpoint follows raids in tick. A deadline
    // inside the interval must be resolved now, including a whole-hour deadline
    // crossed by an explicit wait that retains its fractional starting second.
    if (s.secondOfHour || at < end) {
      contractEvents.push(...expireDueContracts(s));
      receiveDueHires(s);
      synchronizeSquad(s);
    }
    advanceCampaignEvents(s, scenarioContext(s));
    if (at < end) {
      synchronizeCampaignPresence(s);
      updateContentQuests(s);
      progress(s);
    }
  }
  return contractEvents;
}
function advanceQueuedTravel(s, seconds, stopAtEveryArrival = false) {
  return advanceSquadTravel(s, rosterFor(s), {
    seconds,
    note,
    stopAtEveryArrival,
    onArrival: (q) => meetEnemyGroups(s, q.location),
    releaseAtArrival: (q) => {
      for (const id of [...q.members])
        if (s.contracts[id]?.departurePending) endExpiredService(s, id);
    },
  });
}
function advanceFractionalSystems(s, seconds, continuousClock = false) {
  const expired = [...advanceOffscreenTime(s, seconds), ...expireDueContracts(s)];
  receiveDueHires(s);
  synchronizeSquad(s);
  advanceQueuedTravel(s, seconds, continuousClock);
  settleEnemyEncounters(s);
  refreshEnemyIntelligence(s);
  synchronizeSquad(s);
  synchronizeCampaignPresence(s);
  synchronizeDialogueMovements(s);
  progress(s);
  return expired;
}
function advanceCampaignHour(s, options) {
  const { joinArrivals = true, stopOnDefeat = true, civilianSeconds = 3600 } = options;
  const assignmentEvents = [],
    contractEvents = [],
    logisticsEvents = [],
    militiaWorked = [];
  s.hour++;
  contractEvents.push(...advanceOffscreenTime(s, civilianSeconds), ...expireDueContracts(s));
  advanceCampaignHorses(s);
  for (const course of [...(s.militiaTraining ?? [])]) {
    if (s.sectors[course.sector].owner !== 'patriot') {
      s.militiaTraining = s.militiaTraining.filter((t) => t !== course);
      assignmentEvents.push(militiaCancellationAttention(course));
      note(s, 'La ocupación enemiga dispersa un curso de milicias.');
      continue;
    }
    if (militiaAssignmentIssue(s, course, { isSupplied })) continue;
    const trainer = s.operativeState[course.trainerId];
    if (trainer) {
      trainer.energy = Math.max(0, trainer.energy - 3);
      gainFatigue(trainer, 2);
      militiaWorked.push(course.trainerId);
    }
    course.remaining--;
    if (course.remaining <= 0) {
      if (course.rank > 0) returnMilitiaTrainees(s, course, true);
      else s.sectors[course.sector].militia[0] += course.count;
      s.militiaTraining = s.militiaTraining.filter((t) => t !== course);
      assignmentEvents.push(militiaCompletionAttention(course));
      note(s, `Tres milicianos completan su instrucción en ${sector(course.sector, s).name}.`);
    }
  }
  advanceMarchFatigue(
    s,
    rosterFor(s).map((op) => ({ ...op, ...(mountForOperative(s.horseState, op.id) ?? {}) })),
    options,
  );
  for (const message of advanceDetentionCare(s, rosterFor(s))) note(s, message);
  const careOptions = assignmentContext(s, options);
  advanceMedicalCare(s, rosterFor(s), careOptions);
  const deaths = advanceMilitaryWounds(s, rosterFor(s));
  for (const death of advanceMilitiaWounds(s))
    note(s, `${death.name} fallece por sus heridas en ${sector(death.sector, s).name}.`);
  advanceAssignments(s, rosterFor(s), careOptions);
  recordCasualtyMorale(s, deaths);
  receiveCompanionLossCorrespondence(s, rosterFor(s), deaths);
  for (const message of advanceMorale(s, rosterFor(s), {
    ...careOptions,
    strategicTraveling: options.traveling ?? [],
  }))
    note(s, message);
  for (const id of deaths) {
    s.operativeState[id].location = operativeLocation(s, id);
    for (const squad of s.squads) squad.members = squad.members.filter((member) => member !== id);
    s.squad = s.squad.filter((member) => member !== id);
    for (const horse of s.horseState.horses) if (horse.assignedTo === id) horse.assignedTo = null;
    for (const course of s.militiaTraining.filter((t) => t.trainerId === id))
      returnMilitiaTrainees(s, course);
    s.militiaTraining = s.militiaTraining.filter((t) => t.trainerId !== id);
    note(s, `${rosterFor(s).find((o) => o.id === id).name} fallece por sus heridas.`);
  }
  if (s.hour % 24 === 0) {
    scenarioFor(s).dailyEvents(s);
    for (const def of campaignSectors(s)) {
      const region = s.sectors[def.id];
      if (region.owner === 'patriot') region.loyalty = Math.min(100, region.loyalty + 1);
    }
  }
  if (s.hour % 720 === 0) {
    const ids = s.recruited.filter(
        (id) => s.operativeState[id].alive && s.contracts?.[id]?.kind === 'legacy',
      ),
      payroll = ids.reduce((sum, id) => sum + rosterFor(s).find((o) => o.id === id).monthlyPay, 0);
    if (payroll > 0) {
      if (s.resources.treasury >= payroll) {
        s.resources.treasury -= payroll;
        recordPayMorale(s, ids, true);
        scenarioFor(s).payroll(s, true, scenarioContext(s));
        note(s, `Se abonaron ${payroll} pesos en estipendios mensuales.`);
      } else {
        recordPayMorale(s, ids, false);
        scenarioFor(s).payroll(s, false, scenarioContext(s));
        note(s, 'La tesorería no pudo abonar los sueldos. Los voluntarios reclaman el pago.');
      }
    }
  }
  scenarioFor(s).hourlyEvents(s, scenarioContext(s));
  assignmentEvents.push(
    ...recordSleepEvents(
      s,
      finishSleepHour(s, rosterFor(s), {
        ...assignmentContext(s, options),
        working: militiaWorked,
      }),
    ),
  );
  delayCrossingEnemyGroups(s, {
    elapsedHour: (options.travelSeconds ?? 3600) / 3600,
    travelLeg: options.traveling?.length ? options.travelLeg : null,
  });
  const travelAttention = advanceQueuedTravel(
    s,
    options.travelSeconds ?? 3600,
    Boolean(options.continuousClock),
  );
  advanceEnemyGroups(s);
  for (const q of s.squads)
    if (
      q.journey?.status === 'moving' &&
      q.journey.elapsed === 0 &&
      !q.journey.elapsedSecond &&
      s.enemyGroups.some(
        (g) => g.target === q.location && ['waiting', 'engaged', 'stationed'].includes(g.status),
      )
    ) {
      q.journey.status = 'paused';
      q.journey.reason = 'contact';
    }
  settleEnemyEncounters(s, options);
  refreshEnemyIntelligence(s, options);
  // Occupation and blockade are resolved before delivery.
  logisticsEvents.push(...deliverEquipmentShipments(s), ...deliverArtilleryTransfers(s));
  receiveDueHires(s, joinArrivals);
  synchronizeSquad(s);
  synchronizeCampaignPresence(s);
  synchronizeDialogueMovements(s);
  progress(s);
  assignmentEvents.push(
    ...recordSleepEvents(s, prepareSleep(s, rosterFor(s), assignmentContext(s, options))),
  );
  deliverPendingCompanionLossCorrespondence(s, rosterFor(s));
  // Finish every hourly subsystem before stopping an explicit wait. Travel
  // and tactical synchronization must process their complete durations.
  const assignmentPause =
    options.pauseOnAssignments &&
    pauseForAssignments(
      s,
      options.requestedHours ?? 1,
      options.advancedHours ?? 1,
      assignmentEvents,
    );
  const contractPause =
    options.pauseOnAssignments &&
    pauseForContracts(s, options.requestedHours ?? 1, options.advancedHours ?? 1, contractEvents);
  const logisticsPause =
    options.pauseOnAssignments &&
    pauseForLogistics(s, options.requestedHours ?? 1, options.advancedHours ?? 1, logisticsEvents);
  if (!options.pauseOnAssignments) reconcileLogisticsAttention(s, { isSupplied });
  return (
    hasPendingArrivalDecision(s) ||
    (stopOnDefeat && s.defeated) ||
    (s.completed && s.squads.some((squad) => squad.journey)) ||
    (s.pendingEncounter && !s.pendingBattle && !options.traveling) ||
    assignmentPause ||
    contractPause ||
    logisticsPause ||
    (options.pauseOnAssignments && travelAttention)
  );
}

function advanceCampaignSeconds(s, requestedSeconds, options = {}) {
  const startedAt = s.hour * 3600 + (s.secondOfHour ?? 0);
  let remaining = requestedSeconds;
  while (remaining > 0 && !hasPendingArrivalDecision(s)) {
    const now = s.hour * 3600 + (s.secondOfHour ?? 0);
    const seconds = Math.min(
      remaining,
      3600 - (s.secondOfHour ?? 0),
      nextSquadTravelBoundarySeconds(s) ?? Infinity,
      nextHireArrivalSeconds(s) ?? Infinity,
      nextContractExpirySeconds(s) ?? Infinity,
      nextContentQuestDeadline(s) - now,
    );
    requireThat(
      Number.isSafeInteger(seconds) && seconds > 0,
      'El intervalo de campaña no es válido.',
    );
    remaining -= seconds;
    s.secondOfHour = (s.secondOfHour ?? 0) + seconds;
    let interrupted = false;
    if (s.secondOfHour === 3600) {
      s.secondOfHour = 0;
      interrupted = advanceCampaignHour(s, {
        ...options,
        civilianSeconds: seconds,
        travelSeconds: seconds,
        advancedHours: (requestedSeconds - remaining) / 3600,
      });
    } else {
      const expired = advanceFractionalSystems(s, seconds, Boolean(options.continuousClock));
      if (options.pauseOnAssignments) {
        interrupted = pauseForContracts(
          s,
          options.requestedHours ?? 1,
          (requestedSeconds - remaining) / 3600,
          expired,
        );
      }
    }
    if (interrupted || hasPendingArrivalDecision(s)) break;
  }
  return s.hour * 3600 + (s.secondOfHour ?? 0) - startedAt;
}

function tick(s, hours, options = {}) {
  requireThat(
    Number.isInteger(hours) && hours >= 1 && hours <= 240,
    'El avance debe ser de 1 a 240 horas.',
  );
  if (hasPendingArrivalDecision(s)) return;
  const sleepEvents = recordSleepEvents(
    s,
    prepareSleep(s, rosterFor(s), assignmentContext(s, options)),
  );
  if (options.pauseOnAssignments && !options.skipInitialAttention) {
    s.assignmentAttention.notice = null;
    s.travelNotice = null;
    s.contractAttention.notice = null;
    s.logisticsNotice = null;
    const assignmentPause = pauseForAssignments(s, hours, 0, sleepEvents);
    const contractPause = pauseForContracts(s, hours, 0);
    const logisticsPause = pauseForLogistics(s, hours, 0);
    if (assignmentPause || contractPause || logisticsPause) return;
  }
  advanceCampaignSeconds(s, hours * 3600, { ...options, requestedHours: hours });
}

function travelPath(s, from, to) {
  const queue = [[from]],
    seen = new Set([from]);
  while (queue.length) {
    const path = queue.shift(),
      last = path.at(-1);
    if (last === to) return path;
    for (const id of sector(last, s).neighbors)
      if (!seen.has(id) && s.sectors[id].owner === 'patriot') {
        seen.add(id);
        queue.push([...path, id]);
      }
  }
  return null;
}
function prepareAttack(s, at, origin, ids, assaultSquads = null) {
  const def = scenarioFor(s).attackDefinition(s, at, scenarioContext(s)),
    mission = Boolean(def.mission);
  if (!mission) haltEnemyGroupsAt(s, at, 'stationed');
  const allocated = {},
    sources = assaultSquads ?? [{ origin, members: ids }];
  for (const group of sources)
    Object.assign(
      allocated,
      prepareCampaignAmmunition(s, rosterFor(s), group.members, {
        at: group.origin,
        supplied: isSupplied(s, group.origin),
        commit: true,
      }).allocation,
    );

  s.pendingBattle = {
    ...(s.contentCampaign ? { campaignPackage: s.contentCampaign.package } : {}),
    id: `${at}-${s.hour}-${s.seed}`,
    origin,
    sector: at,
    hour: s.hour,
    secondOfHour: s.secondOfHour ?? 0,
    name: def.name,
    biome: def.biome,
    theater: def.theater,
    seed: Math.floor(random(s) * 4294967296),
    issuedCartridges: Object.values(allocated).reduce((sum, u) => sum + u.loaded + u.ammo, 0),
    wasRoyalist: !mission && s.sectors[at].owner === 'royalist',
    npcs: encountersFor(s, at),
    detainedPrisoners: detentionManifest(s, rosterFor(s), at),
    squad: ids.map((id) => ({
      ...deploymentOperative(s, id),
      ...deploymentMorale(s, id, ids),
      ...allocated[id],
      ...(mountForOperative(s.horseState, id) ?? { horse: false, canMount: false }),
    })),
    difficulty: scenarioFor(s).attackDifficulty(s, def),
    ...regionalConditions(at, s.hour, s),
    cannons: artilleryCount(s),
  };
  s.pendingBattle.artillery = deployedArtillery({ ...s, location: origin });
  Object.assign(
    s.pendingBattle,
    oppositionFor(
      {
        ...s.pendingBattle,
        ...(mission
          ? assaultSquads
            ? { squad: s.pendingBattle.squad.slice(0, 6) }
            : {}
          : { enemyCount: campaignEnemyCount(s) }),
      },
      s,
    ),
  );
  const occupying = mission ? [] : occupyingGroups(s, at);
  if (occupying.length) {
    s.pendingBattle.occupationGroupIds = occupying.map((g) => g.id);
    s.pendingBattle.enemies = occupying.flatMap((g) => clone(g.units));
  }
  scenarioFor(s).prepareAttack(s, s.pendingBattle, ids, origin, scenarioContext(s));
  s.pendingBattle.garrison = prepareGarrison(s, at);
  s.pendingBattle.garrisonLootSources = (s.sectorStates[at]?.units ?? [])
    .filter((u) => u.militia && u.hp <= 0)
    .map(ammunitionSource);
  note(
    s,
    `El destacamento se despliega para ${def.name}. Mando enemigo: ${s.pendingBattle.enemyCommander}.`,
  );
  if (assaultSquads) s.pendingBattle.assaultSquads = clone(assaultSquads);
}
export function dispatchCampaign(previous, action) {
  const transaction = new GameUnitOfWork(previous, clone);
  const s = migrateSquads(transaction.draft);
  s.lastError = null;
  s.militiaTraining ??= [];
  s.missions ??= {};
  s.sceneStates ??= {};
  s.missionAllies ??= {};
  s.quests ??= {};
  migrateContracts(s);
  try {
    initializeCampaignSystems(s);
    validateCampaignEventState(s);
    forfeitDeadServiceGuarantees(s, rosterFor(s));
    validateServiceGuarantees(s, rosterFor(s));
    validatePendingVictoryFunds(s);
    requireThat(action && typeof action.type === 'string', 'La orden no es válida.');
    requireThat(
      action.expectedRevision === undefined ||
        action.expectedRevision === (previous.gameRevision ?? 0),
      'La partida cambió. Revisá la orden antes de repetirla.',
    );
    validateCampaignServiceObjections(s, rosterFor(s));
    validatePendingCompanionLoss(s, rosterFor(s));
    if (s.pendingBattle)
      validateQuestBeneficiaryContext(s, s.pendingBattle, { request: null, issued: true });
    if (s.pendingBattle?.resumeSnapshot) {
      validateRepairReserveContext(s.pendingBattle, s.pendingBattle.resumeSnapshot);
      validateAbilityReferences(s, s.pendingBattle.resumeSnapshot);
      validateQuestBeneficiaryContext(s, s.pendingBattle.resumeSnapshot);
      validateServiceObjectionContext(s, s.pendingBattle.resumeSnapshot, rosterFor(s));
    }
    const tradeOrders = [
      'purchaseToolkits',
      'purchaseAmmunition',
      'purchaseGrenades',
      'purchaseMedicalSupplies',
      'purchaseEquipment',
      'purchaseUsedEquipment',
      'sellEquipment',
      'exchangeEquipment',
      'sellArtillery',
      'purchaseUsedArtillery',
      'repurchaseArtillery',
      'resupplyArtillery',
      'supplyArtillery',
      'resupply',
      'repairWeapon',
    ];
    requireThat(
      !tradeOrders.includes(action.type) &&
        !(action.type === 'ammunition' && action.direction === 'buy') &&
        !(action.type === 'sectorInventory' && action.direction === 'issueOutfit') &&
        !(
          action.type === 'horseAction' &&
          ['acquire', 'hire', 'feed', 'breed'].includes(action.order?.type)
        ),
      'El comercio de equipo no está disponible. Buscá objetos en los sectores y usá los que llevás.',
    );
    requireThat(
      !hasPendingArrivalDecision(s) ||
        ['fightOnArrival', 'withdrawOnArrival', 'beginAssault', 'selectSquad'].includes(
          action.type,
        ) ||
        (action.type === 'syncTacticalTime' &&
          action.elapsedSeconds === (s.pendingBattle?.syncedSeconds ?? 0)),
      'La campaña está en pausa. Elegí combatir o retirarte al llegar.',
    );
    if (action.sectorState) {
      validateCampaignPatrol(s, action.sectorState);
      validateCampaignArtilleryProfiles(s, action.sectorState);
      validateArtilleryReport(s.pendingBattle, action.sectorState);
    }
    requireThat(
      !s.defeated ||
        (s.pendingBattle &&
          ['syncTacticalTime', 'leaveSector', 'battleResult'].includes(action.type)),
      'La campaña ha terminado. Inicia otra campaña para continuar.',
    );
    requireThat(
      !s.completed ||
        [
          'syncTacticalTime',
          'wait',
          'advanceStrategicTime',
          'assignToSquad',
          'setSleep',
          'assignCare',
          'assignWork',
          'purchaseToolkits',
          'purchaseMedicalSupplies',
          'purchaseAmmunition',
          'purchaseGrenades',
          'horseAction',
          'travel',
          'cancelTravel',
          'resumeTravel',
          'beginAssault',
          'fightOnArrival',
          'withdrawOnArrival',
          'redirectJourney',
          'resumeSectorSession',
          'visitSector',
          'leaveSector',
          'talkNPC',
          'createSquad',
          'selectSquad',
          'squad',
          'equip',
          'resupply',
          'repairWeapon',
          'purchaseEquipment',
          'purchaseUsedEquipment',
          'sellEquipment',
          'exchangeEquipment',
          'sellArtillery',
          'purchaseUsedArtillery',
          'ammunition',
          'unloadAmmunition',
          'selectAmmunitionLoad',
          'configureArtillery',
          'repurchaseArtillery',
          'resupplyArtillery',
          'redirectHire',
          'cancelHireArrival',
          'sectorInventory',
          'supplyArtillery',
          'storeArtillery',
          'transportArtillery',
          'transport',
          'militia',
          'cancelMilitia',
          'transferMilitia',
          'distributeMilitia',
          'renewContract',
          'dismiss',
        ].includes(action.type),
      'La campaña está ganada. Puedes recorrer las provincias y atender a tus escuadras y estancias.',
    );
    requireThat(
      !s.pendingEncounter || ['respondToEncounter', 'selectSquad'].includes(action.type),
      'Hay un encuentro pendiente. Elegí cómo responder antes de continuar.',
    );
    requireThat(
      !s.pendingBattle ||
        [
          'battleResult',
          'leaveSector',
          'talkNPC',
          'finishMission',
          'syncTacticalTime',
          'fightOnArrival',
          'withdrawOnArrival',
          'resumeSectorSession',
        ].includes(action.type),
      'Hay una batalla pendiente. Resuélvela antes de dar nuevas órdenes.',
    );
    if (['travel', 'attack', 'visitSector', 'visitMission'].includes(action.type))
      requireThat(
        !s.squad.some((id) => militiaAssignment(s, id)),
        'Un instructor de la escuadra está asignado a las milicias. Cancelá su curso o dejalo en una escuadra de guarnición.',
      );
    if (['travel', 'attack', 'visitSector', 'visitMission'].includes(action.type))
      requireThat(
        s.squad.every((id) => s.operativeState[id].assignment === 'active'),
        'Hay combatientes en atención o descanso. Devolvelos al servicio o dejalos en otra escuadra antes de marchar.',
      );
    if (['travel', 'attack', 'visitSector', 'visitMission'].includes(action.type)) {
      requireThat(
        !s.squad.some(
          (id) => s.operativeState[id].asleep && needsCollapseRecovery(s.operativeState[id]),
        ),
        'La escuadra necesita descansar: hay combatientes que todavía no pueden despertar.',
      );
      requireThat(
        s.squad.every((id) => !s.operativeState[id].asleep),
        'Hay combatientes durmiendo. Despertalos o dejalos en otra escuadra antes de marchar.',
      );
    }
    if (['travel', 'attack', 'visitSector', 'visitMission'].includes(action.type))
      requireThat(
        !activeSquad(s).journey,
        'Terminá o cancelá la ruta antes de entrar en un sector.',
      );
    const targetId = Number(
      action.operativeId ?? action.trainerId ?? (action.type === 'dismiss' ? action.id : NaN),
    );
    if (Number.isFinite(targetId))
      requireThat(
        !operativeInTransit(s, targetId),
        'El combatiente está en camino. Esperá su llegada.',
      );
    if (['squad', 'recruitCombatant', 'recruitCivic', 'createOfficer'].includes(action.type)) {
      const reason = squadReorganizationReason(s);
      requireThat(!reason, reason);
    }
    switch (action.type) {
      case 'sectorInventory':
        note(s, moveSectorItem(s, action, rosterFor(s)));
        break;
      case 'respondToEncounter': {
        const encounter = s.pendingEncounter,
          group = s.enemyGroups.find((g) => g.id === action.groupId);
        requireThat(
          encounter && group && encounter.groupId === group.id && group.status === 'waiting',
          'El encuentro ya no está pendiente.',
        );
        requireThat(
          ['tactical', 'auto', 'retreat'].includes(action.choice),
          'La respuesta al encuentro es inválida.',
        );
        if (action.choice === 'retreat') {
          const ids = localDefenderIds(s, group.target),
            exits = retreatDestinations(s, group.target);
          requireThat(
            ids.length && exits.includes(action.destination),
            'No hay una ruta de retirada disponible para los granaderos.',
          );
          relocateDefenders(s, ids, action.destination);
          s.pendingEncounter = null;
          if (s.sectors[group.target].militia.some((n) => n > 0))
            resolveDefenseAutomatically(s, prepareDefense(s, group, { excludeMercs: true }));
          else {
            loseSectorToGroup(s, group);
            addDefenseHistory(
              s,
              group,
              'retreat',
              [],
              `Los granaderos abandonan ${sector(group.target, s).name} y llegan a ${sector(action.destination, s).name}.`,
            );
            note(s, s.encounterHistory[0].text);
          }
        } else {
          const request = prepareDefense(s, group);
          if (action.choice === 'auto') resolveDefenseAutomatically(s, request);
          else
            note(
              s,
              `La defensa de ${sector(group.target, s).name} espera órdenes en el sector táctico.`,
            );
        }
        break;
      }
      case 'setSleep': {
        const op = rosterFor(s).find((o) => o.id === Number(action.operativeId));
        requireThat(op, 'El combatiente no existe.');
        setSleep(s, op.id, action.asleep);
        note(
          s,
          `${op.name}: ${action.asleep ? 'se acuesta; conserva su asignación' : 'se despierta'}.`,
        );
        break;
      }
      case 'assignWork': {
        const roster = rosterFor(s),
          op = roster.find((o) => o.id === Number(action.operativeId));
        requireThat(op, 'El combatiente no existe.');
        assignWork(s, op, action, roster);
        note(s, `${op.name}: ${WORK_ASSIGNMENTS[action.assignment].toLowerCase()}.`);
        break;
      }
      case 'purchaseToolkits': {
        const id = Number(action.operativeId),
          quantity = action.quantity ?? 1,
          record = s.operativeState[id];
        requireThat(
          s.recruited.includes(id) && record.alive && operativeLocation(s, id) === s.location,
          'El combatiente debe estar presente en esta localidad.',
        );
        requireThat(
          hasWorkshop(s, s.location) &&
            worldOwner(s, s.location) === 'patriot' &&
            isSupplied(s, s.location),
          'Las herramientas se compran en una maestranza propia y abastecida.',
        );
        requireThat(
          Number.isInteger(quantity) &&
            quantity >= 1 &&
            quantity <= 20 &&
            record.toolkitPoints + quantity * TOOLKIT_POINTS <= 100000,
          'Elegí entre 1 y 20 juegos de herramientas.',
        );
        pay(s, { treasury: TOOLKIT_PRICE * quantity });
        record.toolkitPoints += TOOLKIT_POINTS * quantity;
        note(s, `La maestranza entrega ${TOOLKIT_POINTS * quantity} puntos de herramientas.`);
        break;
      }
      case 'purchaseAmmunition': {
        const op = rosterFor(s).find((o) => o.id === Number(action.operativeId)),
          family =
            action.family ??
            Object.values(AMMUNITION_FAMILIES).find((f) => f.type === action.ammoType)?.id,
          quantity = action.quantity ?? 1;
        const quote = moveCampaignAmmunition(
          s,
          op,
          family,
          quantity,
          'buy',
          isSupplied(s, s.location),
        );
        note(s, `${op.name} compra ${quantity} cartuchos por ${quote.cost} pesos.`);
        break;
      }
      case 'purchaseGrenades': {
        requireThat(action.grenadeType === 'arsenal', 'El tipo de granada no está disponible.');
        const op = rosterFor(s).find((o) => o.id === Number(action.operativeId));
        note(s, purchaseGrenades(s, op, isSupplied, action.quantity ?? 1));
        break;
      }
      // Compatibility with older clients: readiness is automatic and has no funding cost.
      case 'horseAction': {
        const order = action.order;
        requireThat(
          order && ['acquire', 'hire', 'feed', 'assign', 'unassign', 'breed'].includes(order.type),
          'La orden de caballada es inválida.',
        );
        requireThat(
          s.sectors[s.location]?.owner === 'patriot',
          'La caballada requiere una localidad segura.',
        );
        if (order.name !== undefined)
          requireThat(
            typeof order.name === 'string' &&
              order.name.trim().length > 0 &&
              order.name.length <= 30 &&
              !/[<>]/.test(order.name),
            'El nombre de la montura es inválido.',
          );
        if (order.horseId)
          requireThat(
            s.horseState?.horses.some((h) => h.id === order.horseId && h.location === s.location),
            'La montura está en otra localidad.',
          );
        if (order.type === 'assign')
          requireThat(
            s.recruited.includes(order.operativeId) &&
              s.operativeState[order.operativeId].alive &&
              operativeLocation(s, order.operativeId) === s.location,
            'El jinete debe estar presente en la localidad.',
          );
        requireThat(
          !operativeInTransit(s, order.operativeId) &&
            !s.horseState.horses.some(
              (h) =>
                [order.horseId, order.sireId].includes(h.id) && operativeInTransit(s, h.assignedTo),
            ),
          'La montura o su jinete están en camino.',
        );
        const horses = applyHorseAction(s.horseState, {
          ...order,
          location: s.location,
          funds: s.resources.treasury,
        });
        requireThat(!horses.lastError, horses.lastError);
        pay(s, { treasury: horses.cost ?? 0 });
        s.horseState = horses;
        note(s, horses.log[0] ?? 'La orden de caballada quedó cumplida.');
        break;
      }
      case 'unloadAmmunition': {
        unloadOwnedCampaignAmmunition(
          s,
          rosterFor(s).find((o) => o.id === action.operativeId),
        );
        break;
      }
      case 'selectAmmunitionLoad': {
        selectCampaignAmmunitionLoad(
          s,
          rosterFor(s).find((o) => o.id === action.operativeId),
          action.family,
        );
        break;
      }
      case 'ammunition': {
        const op = rosterFor(s).find((o) => o.id === Number(action.operativeId));
        const quote = moveCampaignAmmunition(
          s,
          op,
          action.family,
          action.quantity,
          action.direction,
          isSupplied(s, s.location),
        );
        note(
          s,
          `${op.name}: ${action.quantity} cartuchos ${action.direction === 'buy' ? `comprados por ${quote.cost} pesos` : action.direction === 'store' ? 'guardados en el sector' : 'retirados del sector'}.`,
        );
        break;
      }
      case 'syncTacticalTime': {
        requireThat(
          s.pendingBattle && s.pendingBattle.id === action.battleId,
          'El reloj no corresponde al despliegue.',
        );
        const elapsed = action.elapsedSeconds,
          previous = s.pendingBattle.syncedSeconds ?? 0;
        requireThat(
          Number.isSafeInteger(elapsed) && elapsed >= previous && elapsed - previous <= 864000,
          'El tiempo táctico es inválido.',
        );
        const snapshot =
          action.sectorState === undefined
            ? null
            : validatedInteractionSnapshot(s, action.sectorState);
        if (snapshot)
          requireThat(snapshot.elapsedSeconds === elapsed, 'El parte y el reloj no coinciden.');
        const griefProgress = snapshot ?? s.pendingBattle.resumeSnapshot;
        if (griefProgress) retainRepairReserves(s.pendingBattle, griefProgress);
        if (griefProgress && !snapshot)
          validateCompanionGriefContext(s, griefProgress, rosterFor(s));
        if (griefProgress) validateServiceObjectionContext(s, griefProgress, rosterFor(s));
        if (!snapshot && griefProgress)
          requireThat(
            !hasPendingServiceObjections(s, griefProgress),
            'La objeción necesita un parte táctico completo antes de avanzar el reloj.',
          );
        if (!snapshot && s.pendingBattle.resumeSnapshot) {
          const resume = s.pendingBattle.resumeSnapshot,
            physicalDelivery = questsFor(s).some(
              (q) =>
                q.beneficiaries &&
                questContactIds(q).some(
                  (id) => (resume.npcs?.find((n) => n.id === id)?.questGifts?.length ?? 0) > 0,
                ),
            );
          requireThat(
            !physicalDelivery && !hasPendingNpcGiftProgress(s, resume),
            'Las entregas recibidas necesitan un parte táctico completo antes de avanzar el reloj.',
          );
        }
        // Split at real hour boundaries. Off-screen wounds advance for the
        // exact delta; the loaded scene has already consumed its own time.
        for (let remaining = elapsed - previous; remaining > 0;) {
          requireThat(
            !hasPendingArrivalDecision(s),
            'La acción debe detenerse en la decisión de llegada.',
          );
          const step = Math.min(
            remaining,
            3600 - (s.secondOfHour ?? 0),
            nextSquadTravelBoundarySeconds(s) ?? Infinity,
          );
          remaining -= step;
          s.secondOfHour = (s.secondOfHour ?? 0) + step;
          if (s.secondOfHour === 3600) {
            s.secondOfHour = 0;
            advanceCampaignHour(s, {
              stopOnDefeat: false,
              civilianSeconds: step,
              travelSeconds: step,
            });
          } else advanceFractionalSystems(s, step);
        }
        // A death is confirmed at this tactical checkpoint, after its time has elapsed.
        if (snapshot) {
          retainQuestBeneficiaries(s, s.pendingBattle, snapshot);
          acknowledgeCivilians(s, snapshot);
          acknowledgeNpcGifts(s, snapshot);
          acknowledgeSuccessionDeaths(s, snapshot);
          if (campaignStory(s)) advanceCampaignStory(s, snapshot);
        }
        if (griefProgress) retainCompanionGrief(s.pendingBattle, griefProgress);
        if (snapshot) retainServiceObjections(s.pendingBattle, snapshot);
        s.pendingBattle.syncedSeconds = elapsed;
        delete s.pendingBattle.resumeSnapshot;
        break;
      }
      case 'repurchaseArtillery': {
        const quote = repurchaseArtillery(s, action.artilleryId, isSupplied(s, s.location));
        note(
          s,
          `Se recupera la pieza del taller por ${quote.price} pesos. Queda en el depósito local con su munición.`,
        );
        break;
      }
      case 'purchaseUsedArtillery': {
        const quote = tradeArtillery(s, action, isSupplied);
        note(
          s,
          `Se recupera la pieza del taller por ${quote.price} pesos. Queda en el depósito local con su munición.`,
        );
        break;
      }
      case 'resupplyArtillery': {
        const quote = artillerySupplyQuote(
          s,
          action.sector,
          action.artilleryId,
          isSupplied(s, s.location),
        );
        requireThat(quote.available, quote.reason);
        pay(s, { treasury: quote.cost });
        const gun = s.sectorStates[action.sector].artillery.find(
          (g) => g.id === action.artilleryId,
        );
        gun.ammo++;
        note(
          s,
          `Se compra una munición de artillería por ${quote.cost} pesos. Queda en reserva junto a la pieza.`,
        );
        break;
      }
      case 'advanceStrategicTime': {
        requireThat(
          Number.isSafeInteger(action.seconds) && action.seconds >= 1 && action.seconds <= 3600,
          'La velocidad del reloj es inválida.',
        );
        s.assignmentAttention.notice = null;
        s.travelNotice = null;
        s.contractAttention.notice = null;
        s.logisticsNotice = null;
        const sleepEvents = recordSleepEvents(
          s,
          prepareSleep(s, rosterFor(s), assignmentContext(s)),
        );
        const assignmentPause = pauseForAssignments(s, 1, 0, sleepEvents),
          contractPause = pauseForContracts(s, 1, 0),
          logisticsPause = pauseForLogistics(s, 1, 0);
        if (assignmentPause || contractPause || logisticsPause) break;
        const before = s.hour * 3600 + (s.secondOfHour ?? 0);
        const arrivalsBefore = s.hiringArrivals?.length ?? 0;
        const wasCompleted = Boolean(s.completed);
        const questEventsBefore = s.contentQuestEvents?.length ?? 0;
        const stats = JSON.stringify(
          s.recruited.map((id) => s.operativeState[id].trainedStats ?? {}),
        );
        for (let remaining = action.seconds; remaining > 0;) {
          const now = s.hour * 3600 + (s.secondOfHour ?? 0);
          const step = Math.min(
            remaining,
            3600 - (s.secondOfHour ?? 0),
            nextHireArrivalSeconds(s) ?? Infinity,
            nextContractExpirySeconds(s) ?? Infinity,
            nextContractWarningSeconds(s) ?? Infinity,
            nextContentQuestDeadline(s) - now,
            nextSquadTravelBoundarySeconds(s) ?? Infinity,
          );
          remaining -= step;
          s.secondOfHour = (s.secondOfHour ?? 0) + step;
          if (s.secondOfHour === 3600) {
            s.secondOfHour = 0;
            advanceCampaignHour(s, {
              pauseOnAssignments: true,
              skipInitialAttention: true,
              continuousClock: true,
              civilianSeconds: step,
              travelSeconds: step,
            });
          } else {
            const expired = advanceFractionalSystems(s, step, true);
            pauseForContracts(s, 1, 0, expired);
          }
          synchronizeCampaignPresence(s);
          updateContentQuests(s);
          progress(s);
          const gained =
            JSON.stringify(s.recruited.map((id) => s.operativeState[id].trainedStats ?? {})) !==
            stats;
          if (
            hasPendingArrivalDecision(s) ||
            s.pendingEncounter ||
            s.pendingBattle ||
            s.defeated ||
            (s.completed && !wasCompleted) ||
            s.assignmentAttention.notice ||
            s.contractAttention.notice ||
            s.logisticsNotice ||
            s.travelNotice ||
            gained ||
            (s.hiringArrivals?.length ?? 0) < arrivalsBefore ||
            (s.contentQuestEvents?.length ?? 0) > questEventsBefore
          )
            break;
        }
        requireThat(
          s.hour * 3600 + (s.secondOfHour ?? 0) >= before,
          'El reloj no puede retroceder.',
        );
        break;
      }
      case 'wait':
        tick(s, action.hours ?? 24, { pauseOnAssignments: true });
        break;
      case 'assignCare': {
        const op = rosterFor(s).find((o) => o.id === Number(action.operativeId ?? action.id));
        requireThat(op, 'El combatiente no existe.');
        assignMedicalCare(s, op, action.assignment);
        note(s, `${op.name}: ${CARE_ASSIGNMENTS[action.assignment]}.`);
        break;
      }

      case 'purchaseMedicalSupplies': {
        const op = rosterFor(s).find((o) => o.id === Number(action.operativeId ?? action.id)),
          quantity = action.quantity === undefined ? 1 : action.quantity,
          quote = medicalSupplyQuote(s, op, quantity, isSupplied(s, s.location));
        requireThat(quote.available, quote.reason);
        requireThat(
          quantity <= medicalSupplyStock(s),
          'La maestranza no tiene suficientes vendas.',
        );
        pay(s, { treasury: quote.cost });
        s.operativeState[op.id].medkits = (s.operativeState[op.id].medkits ?? 2) + quantity;
        s.merchants[s.location].supplies.medkits -= quantity;
        changeMerchantCash(s, s.location, quote.cost);
        note(s, `${op.name} compra ${quantity} vendas por ${quote.cost} pesos.`);
        break;
      }
      case 'academy':
        scenarioFor(s).dispatchAction(s, action, scenarioContext(s));
        break;
      case 'purchaseEquipment': {
        const item = equipmentCatalogItem(action.item, s),
          quantity = action.quantity ?? 1;
        requireThat(
          item && Number.isInteger(quantity) && quantity > 0 && quantity <= 100,
          'El pedido de armamento es inválido.',
        );
        const market = merchantStatus(s, item, isSupplied);
        requireThat(market.available, market.reason);
        requireThat(quantity <= market.stock, 'El comerciante no tiene suficientes existencias.');
        const merchant = s.merchants[market.sector];
        if (isImportedEquipment(item)) {
          s.equipmentShipments ??= [];
          requireThat(s.equipmentShipments.length < 1000, 'Hay demasiados pedidos pendientes.');
          pay(s, { treasury: tradeQuote(s, item.price) * quantity });
          merchant.stock[item.item] -= quantity;
          const rules = importRulesFor(s),
            delay = rules.minHours + Math.floor(random(s) * (rules.maxHours - rules.minHours + 1));
          s.equipmentShipments.push({ item: item.item, quantity, due: s.hour + delay });
          note(
            s,
            `Pedido de ${quantity} × ${item.name}: arribo en ${delay} horas, sujeto al bloqueo.`,
          );
          break;
        }
        pay(s, { treasury: item.price * quantity });
        addEquipment(s, item.stockKey ?? item.item, quantity);
        merchant.stock[item.stockKey ?? item.item] -= quantity;
        merchant.cash = Math.min(1000000000, merchant.cash + item.price * quantity);
        note(s, `La sala de armas entrega ${quantity} × ${item.name}.`);
        break;
      }
      case 'sellEquipment': {
        const instance = s.armoryItems.find((item) => item.id === action.instanceId);
        requireThat(instance, 'Ese ejemplar ya no está disponible en la armería.');
        const market = merchantStatus(s, null, isSupplied);
        requireThat(market.available, market.reason);
        const quote = resaleBreakdown(instance, s.location, s);
        requireThat(!quote.reason, quote.reason);
        const price = quote.total;
        requireThat(price > 0, 'El comerciante no compra armas sin valor de servicio.');
        const merchant = s.merchants[s.location];
        requireThat(
          merchant.cash >= price,
          'El comerciante no tiene fondos suficientes; su caja se repone con el tiempo.',
        );
        requireThat(
          (merchant.usedItems?.length ?? 0) < USED_EQUIPMENT_LIMIT,
          'El comerciante no puede guardar más armas usadas.',
        );
        merchant.usedItems ??= [];
        merchant.usedItems.push(takeEquipment(s, equipmentKey(instance), instance.id));
        merchant.cash -= price;
        s.resources.treasury += price;
        note(
          s,
          `Se vende ${equipmentLabel(instance)}, estado ${instance.condition}%, por ${price} pesos.`,
        );
        break;
      }
      case 'purchaseUsedEquipment': {
        requireThat(
          action.sector === s.location,
          'Debes estar en la maestranza que ofrece ese ejemplar.',
        );
        const offer = usedEquipmentOffers(s, isSupplied).find(
          (offer) => offer.instance.id === action.instanceId,
        );
        requireThat(offer, 'Ese ejemplar ya no está disponible en el comercio.');
        requireThat(offer.available, offer.reason);
        const merchant = s.merchants[s.location],
          index = merchant.usedItems.findIndex((item) => item.id === action.instanceId);
        pay(s, { treasury: offer.quote.total });
        const [instance] = merchant.usedItems.splice(index, 1);
        s.armoryItems.push(instance);
        const key = equipmentKey(instance);
        s.armory[key] = (s.armory[key] ?? 0) + 1;
        merchant.cash = Math.min(1000000000, merchant.cash + offer.quote.total);
        note(
          s,
          `Se compra ${equipmentLabel(instance)} usado, estado ${instance.condition}%, por ${offer.quote.total} pesos.`,
        );
        break;
      }
      case 'sellArtillery': {
        const q = tradeArtillery(s, action, isSupplied);
        note(s, `El taller compra la pieza por ${q.price} pesos y conserva su munición.`);
        break;
      }
      case 'exchangeEquipment': {
        const plan = exchangeMerchantEquipment(s, action, isSupplied);
        note(
          s,
          `Intercambio completado: ${plan.sales} pesos entregados en equipo, ${plan.purchases} pesos recibidos en equipo. ${plan.net > 0 ? `Se pagan ${plan.net}` : plan.net < 0 ? `Se cobran ${-plan.net}` : 'Saldo de 0'} pesos.`,
        );
        break;
      }
      case 'storeArtillery': {
        const q = storeStationedArtillery(s, action);
        note(
          s,
          `La pieza queda guardada en el depósito de ${sector(q.from, s).name} con su carga y munición restante.`,
        );
        break;
      }
      case 'transportArtillery': {
        const q = queueArtilleryTransport(s, action);
        note(
          s,
          `La pieza parte hacia ${sector(q.to, s).name}. Envío: ${q.cost} pesos. Llegada prevista en ${q.hours} horas si la ruta sigue abierta.`,
        );
        break;
      }
      case 'supplyArtillery': {
        const delivered = supplyStationedArtillery(s, action, isSupplied);
        note(
          s,
          `La pieza recibe ${delivered.count} municiones de reserva. Debe cargarse en el campo.`,
        );
        break;
      }
      case 'configureArtillery': {
        const types = action.types,
          reason = artillerySelectionReason(s, types);
        requireThat(!reason, reason);
        s.artillerySelection = [...types];
        s.artillerySelectionExplicit = true;
        note(
          s,
          types.length
            ? 'La batería prepara las piezas elegidas para la próxima operación.'
            : 'La próxima operación saldrá sin piezas de artillería.',
        );
        break;
      }
      case 'equip': {
        const op = rosterFor(s).find((o) => o.id === Number(action.operativeId));
        requireThat(
          op && s.recruited.includes(op.id) && s.operativeState[op.id].alive,
          'El combatiente no está disponible.',
        );
        requireThat(
          operativeLocation(s, op.id) === s.location,
          'El combatiente debe estar presente para recibir el arma.',
        );
        const item = equipArmoryItem(s, op, action);
        note(s, `${op.name} recibe ${equipmentLabel(item)}.`);
        break;
      }
      case 'resupply':
      case 'repairWeapon': {
        const id = Number(action.operativeId),
          op = rosterFor(s).find((o) => o.id === id),
          record = s.operativeState[id],
          quote = workshopServiceQuote(s, op, action.type, isSupplied(s, s.location));
        requireThat(quote.available, quote.reason);
        const cost = quote.cost;
        pay(s, { treasury: cost });
        if (action.type === 'resupply') {
          record.rations = Math.max(2, record.rations ?? 2);
          record.torches = Math.max(2, record.torches ?? 2);
          record.medkits = Math.max(2, record.medkits ?? 2);
          note(s, `${op.name} recibe vendas, antorchas y raciones por ${cost} pesos.`);
        } else {
          record.condition = 100;
          note(s, `La maestranza repara el arma de ${op.name} por ${cost} pesos.`);
        }
        break;
      }
      case 'createOfficer': {
        requireThat(!s.officer, 'El Cabildo ya ha designado a tu oficial.');
        requireThat(
          s.sectors[headquartersFor(s)].owner === 'patriot',
          `El cuartel de ${headquartersName(s)} está ocupado.`,
        );
        const op = createOfficerRecord(action.name, action.answers, action.profile, s);
        validateOfficerCreationHealth(action.profile);
        const creationCost = action.profile?.version === 2 ? 0 : 300;
        pay(s, { treasury: creationCost });
        s.officer = {
          name: op.name,
          answers: clone(action.answers),
          ...(action.profile ? { profile: clone(action.profile) } : {}),
        };
        s.contracts[op.id] = {
          kind: 'patriot',
          term: 'month',
          started: s.hour,
          expiresAt: null,
          paid: creationCost,
        };
        s.operativeState[op.id] = {
          hp: op.maxHp,
          fatigue: 0,
          alive: true,
          xp: 0,
          rations: 2,
          torches: 2,
          condition: 100,
          startingCartridgesIssued: false,
        };
        const fittingPattern = officerStartingFitting(action.profile, s);
        if (fittingPattern)
          Object.assign(s.operativeState[op.id], {
            bladeFittingPattern: fittingPattern,
            bladeInstanceId: `equipment-${s.nextEquipmentInstanceId++}`,
          });
        s.recruited.push(op.id);
        issueStartingCartridges(s, op);
        issueInitialOutfit(s, op.id);
        s.operativeState[op.id].location = s.location;
        if (s.squad.length < 6) s.squad.push(op.id);
        note(s, `${op.name} ${campaignOfficerCreation(s).commission.statusText}`);
        break;
      }
      case 'recruitCombatant':
      case 'recruitCivic': {
        const request = {
          characterId: String(action.characterId ?? action.id),
          term: action.term ?? 'day',
          locationId: action.locationId ?? action.destination,
        };
        const repository = new CampaignRecruitCombatantRepository(transaction);
        const result = new RecruitCombatantUseCase(repository).execute(request);
        const combatant = rosterFor(s).find((person) => String(person.id) === result.characterId);
        const destination = sector(result.locationId, s);
        note(s, `${combatant.name} se incorpora al servicio en ${destination.name}.`);
        receiveCorrespondence(s, {
          id: `recruitment-${result.characterId}-${s.hour}-${s.secondOfHour ?? 0}`,
          sender: `Cuartel de ${destination.name}`,
          subject: `Reclutamiento de ${combatant.nickname}`,
          text: `${combatant.name} está disponible en ${destination.name}. Su servicio comienza ahora.`,
        });
        if (s.contentCampaign) {
          const line = speechFor(combatant, 'hired');
          if (line?.trim()) note(s, `${combatant.name}: «${line}»`);
        }
        break;
      }
      case 'redirectHire':
        redirectHire(s, action.id, action.destination);
        note(s, 'Se cambia el destino de incorporación. El pago ya está registrado.');
        break;
      case 'cancelHireArrival':
        requireThat(
          action.expectedGuaranteeId === undefined ||
            pendingHire(s, action.id)?.guaranteeId === action.expectedGuaranteeId,
          'La llegada cambió. Revisá el contrato antes de cancelar.',
        );
        cancelHireArrival(s, action.id);
        note(s, 'Se cancela la llegada y se devuelve el anticipo.');
        break;
      case 'recruit':
        throw Error('Los combatientes locales se incorporan mediante encuentros personales.');
      case 'renewContract': {
        const id = Number(action.id),
          op = rosterFor(s).find((o) => o.id === id),
          current = s.contracts[id];
        requireThat(
          op && s.recruited.includes(id) && current,
          'El combatiente no tiene un contrato activo.',
        );
        requireThat(
          action.expectedGuaranteeId === undefined ||
            current.guaranteeId === action.expectedGuaranteeId,
          'El contrato cambió. Revisá la garantía antes de renovar.',
        );
        requireThat(
          action.expectedExpiresAt === undefined || action.expectedExpiresAt === current.expiresAt,
          'El contrato cambió. Revisá la nueva fecha antes de renovar.',
        );
        requireThat(
          action.expectedExpiresSecond === undefined ||
            action.expectedExpiresSecond === (current.expiresSecond ?? 0),
          'El contrato cambió. Revisá la nueva fecha antes de renovar.',
        );
        requireThat(
          current.kind !== 'patriot',
          'Este oficial sirve por la causa y no necesita renovación.',
        );
        const quote = contractRenewalQuote(s, op, action.term ?? 'day');
        requireThat(quote.available, quote.reason);
        new RenewServiceContractUseCase(
          new CampaignRenewServiceContractRepository(transaction),
        ).execute({
          characterId: String(id),
          term: action.term ?? 'day',
          ...(action.expectedExpiresAt !== undefined
            ? {
                expectedExpiresAtSeconds:
                  action.expectedExpiresAt === null
                    ? null
                    : action.expectedExpiresAt * 3600 +
                      (action.expectedExpiresSecond ?? current.expiresSecond ?? 0),
              }
            : {}),
          expectedGuaranteeId: action.expectedGuaranteeId,
        });
        renewPendingCompanionLossService(s, id);
        // Scenario rewards use the saved pay clock to cap repeated renewals.
        if (op.foreign && quote.price > 0 && payMoraleRewardEligible(s, id))
          scenarioFor(s).paidService(s, scenarioContext(s));
        recordPayMorale(s, [id], true);
        note(
          s,
          `${op.name} renueva su servicio por ${quote.hours / 24} ${quote.hours === 24 ? 'día' : 'días'}.`,
        );
        break;
      }
      case 'dismiss': {
        const id = Number(action.id);
        requireThat(
          action.expectedGuaranteeId === undefined ||
            s.contracts[id]?.guaranteeId === action.expectedGuaranteeId,
          'El contrato cambió. Revisá la garantía antes de finalizar.',
        );
        requireThat(s.recruited.includes(id), 'El combatiente no está contratado.');
        requireThat(id !== 1000, 'Tu oficial dirige la campaña y no puede ser despedido.');
        const op = rosterFor(s).find((o) => o.id === id),
          refundReason = guaranteeDepartureReason(s, s.contracts[id], op);
        requireThat(!refundReason, refundReason);
        const funded = Boolean(s.contracts[id]?.guaranteeId);
        endOperativeService(s, id, true);
        note(
          s,
          funded
            ? 'El combatiente deja el servicio. La paga no se devuelve; la garantía conserva su recibo de liquidación.'
            : 'El combatiente deja el servicio sin devolución del anticipo.',
        );
        break;
      }
      case 'createSquad':
      case 'squad':
      case 'assignToSquad': {
        const creating = action.type === 'createSquad';
        const targetSquad =
          action.type === 'assignToSquad'
            ? s.squads.find((squad) => squad.id === action.squadId)
            : activeSquad(s);
        requireThat(creating || targetSquad, 'La escuadra no existe.');
        const locationId = creating ? (action.sector ?? s.location) : targetSquad.location;
        requireThat(validWorldLocation(locationId, s), 'El sector de formación no existe.');
        const memberIds =
          action.type === 'assignToSquad'
            ? [
                ...targetSquad.members.filter((id) => id !== Number(action.operativeId)),
                Number(action.operativeId),
              ]
            : action.ids;
        requireThat(Array.isArray(memberIds), 'Seleccioná los combatientes de la escuadra.');
        new FormSquadUseCase(new CampaignFormSquadRepository(transaction)).execute({
          characterIds: memberIds.map(String),
          ...(creating ? { name: action.name, locationId } : { squadId: targetSquad.id }),
        });
        if (action.returnToService === true) {
          for (const id of action.type === 'assignToSquad'
            ? [Number(action.operativeId)]
            : memberIds) {
            assignMedicalCare(
              s,
              rosterFor(s).find((character) => character.id === id),
              'active',
            );
          }
        }
        break;
      }
      case 'selectSquad': {
        const squad = s.squads.find((q) => q.id === action.id);
        requireThat(squad, 'La escuadra no existe.');
        s.activeSquadId = squad.id;
        s.squad = [...squad.members];
        s.location = squad.location;
        break;
      }
      case 'talkNPC': {
        if (action.approach === 'questWithdraw')
          requireThat(
            questForNPC(s, action.npcId)?.withdrawalChoice,
            'Registrá la entrega parcial antes de retirar el compromiso.',
          );
        validateQuestContext(s, action.sectorState);
        validateRoadsideDiscoveryContext(s, action.sectorState);
        requireThat(s.pendingBattle, 'Primero entrá al sector.');
        const snapshot = validatedInteractionSnapshot(s, action.sectorState),
          npc = (
            scenarioFor(s).conversationContacts(s, s.pendingBattle) ??
            encountersFor(s, s.pendingBattle.sector)
          ).find((n) => n.id === action.npcId && n.sector === s.pendingBattle.sector),
          id = Number(action.unitId),
          actor = rosterFor(s).find((o) => o.id === id),
          unit = snapshot.units.find((u) => u.side === 'player' && Number(u.id) === id),
          local = snapshot.npcs?.find((n) => n.id === action.npcId);
        retainQuestBeneficiaries(s, s.pendingBattle, snapshot);
        retainServiceObjections(s.pendingBattle, snapshot);
        acknowledgeCivilians(s, snapshot);
        acknowledgeNpcGifts(s, snapshot);
        requireThat(
          npc &&
            actor &&
            unit &&
            local &&
            (local.hp ?? 100) > 0 &&
            !local.unconscious &&
            s.squad.includes(id) &&
            unit.hp > 0 &&
            !unit.unconscious,
          'El interlocutor no está disponible en este sector.',
        );
        requireThat(
          snapshot.mode === 'exploration' ||
            snapshot.status === 'victory' ||
            snapshot.sectorCleared,
          'Terminá el combate antes de conversar.',
        );
        requireThat(
          Number.isInteger(local.x) &&
            Number.isInteger(local.y) &&
            Math.abs(unit.x - local.x) + Math.abs(unit.y - local.y) <= 1,
          'Acercá al combatiente al interlocutor para hablar.',
        );
        requireThat(
          [
            'repeat',
            'friendly',
            'direct',
            'threaten',
            'recruit',
            'quest',
            'questWithdraw',
            'mission',
            'dialogue',
            'escortFollow',
            'escortWait',
          ].includes(action.approach),
          'La forma de dirigirse al interlocutor es inválida.',
        );
        const unavailable = dialogueReason(
          snapshot,
          unit,
          { ...npc, ...local },
          { visible: canSee(snapshot, unit, local) },
        );
        requireThat(!unavailable, unavailable);
        const quest = questForNPC(s, npc.id),
          authored = hasAuthoredDialogue(npc) || Boolean(quest);
        requireThat(
          action.questWithdrawal === undefined || action.approach === 'questWithdraw',
          'La orden de retiro no corresponde a esta conversación.',
        );
        requireThat(
          action.questResolution === undefined ||
            (action.approach === 'quest' &&
              quest?.rewardChoice &&
              ['cash', 'civic'].includes(action.questResolution)),
          'La elección de recompensa no es válida para esta conversación.',
        );
        requireThat(
          action.approach === 'dialogue'
            ? Boolean(dialogueForNPC(s, npc))
            : authored
              ? dialogueOptions(npc, quest).some(([option]) => option === action.approach)
              : action.approach === 'friendly',
          'Este interlocutor no ofrece esa conversación.',
        );
        let text =
            (authored ? npc.greeting : ambientReply(local, s.conversations?.[npc.id] ? 1 : 0)) +
            (quest && !['completed', 'failed', 'withdrawn'].includes(quest.status)
              ? ` ${quest.offer}`
              : ''),
          outcome = 'conversation',
          dialogue = null;
        if (action.approach === 'threaten') text = contextualThreatReply(npc, quest);
        if (action.approach === 'repeat') {
          text = s.conversations?.[npc.id]?.text ?? npc.greeting;
          outcome = 'repeated';
        }
        if (action.approach === 'dialogue') {
          dialogue = chooseDialogue(s, npc, action.dialogueChoice, action.dialogueNode, snapshot);
          text = dialogue.text;
          outcome = 'dialogue';
          if (dialogue.effect?.applied) {
            if (dialogue.effect.amount)
              note(
                s,
                `${npc.name}: ${dialogue.effect.amount > 0 ? 'entrega' : 'recibe'} ${Math.abs(dialogue.effect.amount)} pesos.`,
              );
            if (dialogue.effect.movement)
              note(
                s,
                dialogue.effect.movement.destination === 'routine'
                  ? `${npc.name} termina el encuentro con ${dialogue.effect.movement.name}.`
                  : `${npc.name} llama a ${dialogue.effect.movement.name} para un encuentro en este sector.`,
              );
            if (dialogue.effect.quest)
              note(
                s,
                `Encargo «${dialogue.effect.quest.title}»: ${dialogue.effect.quest.status === 'active' ? 'en curso' : dialogue.effect.quest.status === 'completed' ? 'completado' : 'fallido'}.`,
              );
          }
        }
        if (action.approach === 'direct') {
          const hireTerms = encounterHireTerms(s, npc),
            availableTerms = hireTerms.filter((q) => q.available),
            gate = recruitmentStatus(s, npc.operativeId, true);
          const serviceReason = hireTerms.length
            ? availableTerms.length
              ? null
              : hireTerms[0].reason
            : canRecruitEncounter(npc)
              ? contractQuote(
                  s,
                  rosterFor(s).find((op) => op.id === npc.operativeId),
                ).reason
              : null;
          const reason =
            encounterRequirements(s, npc, actor) ||
            (!gate.available ? gate.reason : null) ||
            serviceReason;
          const service = hireTerms.length
            ? `Puedo incorporarme por contrato: ${availableTerms.map((q) => `${q.name.toLowerCase()}, ${q.guarantee ? `${q.total} pesos (paga ${q.price} + garantía ${q.guarantee})` : `${q.price} pesos`}`).join('; ')}.`
            : 'Puedo incorporarme sin paga.';
          text = !canRecruitEncounter(npc) ? npc.greeting : (reason ?? `Quiero servir. ${service}`);
        }
        if (action.approach === 'mission') {
          text = scenarioFor(s).missionConversation(s, npc.id, scenarioContext(s));
          outcome = 'mission';
        }
        if (['escortFollow', 'escortWait'].includes(action.approach)) {
          requireThat(quest?.escort && quest.status === 'offered', 'No hay una escolta pendiente.');
          s.quests[quest.id].escortOrder = {
            leaderId: unit.id,
            waiting: action.approach === 'escortWait',
          };
          text =
            action.approach === 'escortWait'
              ? 'Esperaré aquí. Volvé a hablarme cuando podamos seguir.'
              : `Seguiré a ${unit.name} hasta la salida hacia ${sector(quest.escort.destination, s).name}.`;
          outcome = 'escortOrder';
        }
        if (action.approach === 'questWithdraw') {
          requireThat(quest, 'Este interlocutor no tiene un encargo pendiente.');
          text = withdrawQuest(s, quest, local, unit, action.questWithdrawal);
          outcome = 'questWithdrawn';
          note(s, `Compromiso retirado: ${quest.title}. ${text}`);
        }
        if (action.approach === 'quest') {
          requireThat(quest, 'Este interlocutor no tiene un encargo pendiente.');
          requireThat(
            !['completed', 'failed', 'withdrawn'].includes(quest.status),
            'El encargo ya terminó.',
          );
          if (quest.status === 'unoffered') {
            requireThat(
              action.questResolution === undefined,
              'Entregá los objetos del encargo antes de elegir la recompensa.',
            );
            s.quests[quest.id] = {
              status: 'offered',
              offeredAt: s.hour,
              completedAt: null,
              ...(quest.escort ? { escortOrder: { leaderId: unit.id, waiting: false } } : {}),
            };
            text = quest.offer;
            outcome = 'questOffered';
          } else if (quest.beneficiaries) {
            const delivery = snapshot.npcs.find((n) => n.id === npc.id);
            requireThat(
              quest.resolutionReady &&
                quest.beneficiaryId === quest.beneficiary.id &&
                validateQuestGifts(delivery, s).length === quest.carried.count,
              'Primero completá la entrega en el destino elegido y asegurá su localidad.',
            );
            rewardQuest(s, quest);
            s.quests[quest.id] = {
              ...s.quests[quest.id],
              status: 'completed',
              completedAt: s.hour,
            };
            text = questBeneficiaryResolutionText(quest, s);
            outcome = 'questCompleted';
            note(s, `Encargo cumplido: ${quest.title}. ${text}`);
          } else if (quest.rewardChoice) {
            requireThat(
              ['cash', 'civic'].includes(action.questResolution),
              'Elegí el reintegro o el reconocimiento de la ciudad.',
            );
            const delivery = validatedInteractionSnapshot(s, snapshot).npcs.find(
              (n) => n.id === npc.id,
            );
            requireThat(
              quest.resolutionReady &&
                validateQuestGifts(delivery, s).length === quest.carried.count,
              'Primero entregá todos los objetos y completá las condiciones del encargo.',
            );
            rewardQuest(s, quest, action.questResolution);
            s.quests[quest.id] = {
              ...s.quests[quest.id],
              status: 'completed',
              completedAt: s.hour,
              questResolution: action.questResolution,
            };
            text = questResolutionText(quest, action.questResolution, s);
            outcome = 'questCompleted';
            note(s, `Encargo cumplido: ${quest.title}. ${text}`);
          } else {
            requireThat(
              !quest.carried,
              'Los objetos del encargo se registran cuando el interlocutor los recibe.',
            );
            requireThat(
              quest.conditionMet,
              'Primero asegurá las localidades y completá los encargos previos indicados.',
            );
            const arrival = quest.escort
              ? escortArrival(quest, s.quests[quest.id], snapshot, local, unit, s)
              : null;
            if (quest.cost) pay(s, quest.cost);
            rewardQuest(s, quest);
            s.quests[quest.id] = {
              ...s.quests[quest.id],
              status: 'completed',
              completedAt: s.hour,
              ...(arrival ? { arrival } : {}),
            };
            text = quest.delivery;
            outcome = 'questCompleted';
            note(
              s,
              `Encargo cumplido: ${quest.title}.${typeof quest.reward === 'number' ? ` Pago recibido: ${quest.reward} pesos.` : ''}`,
            );
          }
        }
        if (action.approach === 'recruit') {
          requireThat(canRecruitEncounter(npc), 'Este habitante no es un recluta.');
          requireThat(!s.recruited.includes(npc.operativeId), 'Este combatiente ya se incorporó.');
          const reason = encounterRequirements(s, npc, actor);
          requireThat(!reason, reason);
          const eligibility = recruitmentStatus(s, npc.operativeId, true);
          requireThat(eligibility.available, eligibility.reason);
          const candidate = rosterFor(s).find((person) => person.id === npc.operativeId);
          const recruitmentMapper = new CampaignRecruitmentMapper(transaction);
          const recruitmentContext = recruitmentMapper.restore(candidate, action.term ?? 'day', [
            s.location,
          ]);
          const recruitment = new RecruitmentService().recruit(recruitmentContext, s.location);
          recruitmentMapper.apply(
            candidate,
            recruitmentContext,
            recruitment,
            RecruitmentEquipmentSource.ResidentInventory,
          );
          transferCivilian(s, local);
          Object.assign(s.operativeState[candidate.id], {
            residentSector: s.pendingBattle.sector,
            residentScene: s.pendingBattle.sceneId ?? null,
          });
          if (recruitment.assignment === RecruitmentAssignment.Squad) {
            const participant = deploymentOperative(s, candidate.id);
            s.pendingBattle.squad.push(
              carriedAmmunition(participant, clone(s.operativeState[candidate.id])),
            );
          }
          const line = s.contentCampaign
            ? speechFor(candidate, 'hired')
            : 'Acepto servir junto a ustedes.';
          text = `${line?.trim() ? line + ' ' : ''}${candidate.name} se incorpora a la fuerza patriota.`;
          outcome = 'recruited';
          note(s, text);
        }
        s.conversations ??= {};
        s.conversations[npc.id] = {
          ...s.conversations[npc.id],
          ...(dialogue ? { dialogueNode: dialogue.node } : {}),
          met: true,
          lastApproach: action.approach,
          hour: s.hour,
          secondOfHour: s.secondOfHour ?? 0,
          text,
          sector: s.pendingBattle.sector,
        };
        if (townIncomeSourceForNPC(npc.id, s) && ['friendly', 'direct'].includes(action.approach)) {
          const agreement = activateTownIncome(s, {
            npcId: npc.id,
            sectorId: s.pendingBattle.sector,
            approach: action.approach,
          });
          text = agreement.applied
            ? `La localidad está asegurada. El puerto entregará ${agreement.dailyAmount} pesos cada día, a medianoche.`
            : agreement.code === 'already-active'
              ? 'El acuerdo está registrado. El puerto paga cada medianoche mientras la localidad esté bajo tu control.'
              : agreement.reason;
          s.conversations[npc.id].text = text;
          if (agreement.applied) {
            outcome = 'incomeActivated';
            note(s, `${npc.name}: acuerdo de ingresos del puerto registrado.`);
          }
        }
        s.lastConversation = {
          npcId: npc.id,
          speaker: npc.name,
          text,
          outcome,
          ...(dialogue
            ? {
                dialogueNode: dialogue.node,
                ...(dialogue.effect ? { dialogueEffect: dialogue.effect } : {}),
              }
            : {}),
          operativeId: npc.operativeId ?? null,
          options: [
            ...(dialogueForNPC(s, npc) ? ['dialogue'] : []),
            ...dialogueOptions(npc, questForNPC(s, npc.id))
              .map(([option]) => option)
              .filter(
                (option) =>
                  option !== 'recruit' ||
                  (canRecruitEncounter(npc) && !s.recruited.includes(npc.operativeId)),
              ),
          ],
        };
        break;
      }
      case 'visitMission':
      case 'finishMission':
        scenarioFor(s).dispatchAction(s, action, scenarioContext(s));
        break;
      case 'visitSector': {
        requireThat(
          !occupyingGroups(s, action.sector ?? s.location).length,
          `Hay tropas ${scenarioFor(s).enemyName} en el sector. Prepará un contraataque.`,
        );
        const at = locationId(action.sector ?? s.location, s);
        requireThat(at === s.location, 'La escuadra debe viajar al sector antes de entrar.');
        requireThat(
          validWorldLocation(at, s) && worldOwner(s, at) !== 'royalist',
          'El sector está ocupado; prepará un ataque.',
        );
        requireThat(s.squad.length > 0, 'La escuadra no tiene combatientes.');
        const def = campaignPlace(at, s),
          { allocation: allocated, issued } = prepareCampaignAmmunition(s, rosterFor(s), s.squad, {
            at,
            supplied: isSupplied(s, at),
            commit: true,
          });
        s.pendingBattle = {
          ...(s.contentCampaign ? { campaignPackage: s.contentCampaign.package } : {}),
          id: `visit-${at}-${s.hour}-${s.seed}`,
          sector: at,
          hour: s.hour,
          secondOfHour: s.secondOfHour ?? 0,
          name: def.name,
          biome: def.biome,
          theater: def.theater,
          seed: s.seed,
          exploration: true,
          night: s.hour % 24 < 6 || s.hour % 24 >= 20,
          issuedCartridges: issued,
          ammunitionSources: (s.sectorStates[at]?.units ?? [])
            .filter((u) => u.side === 'enemy')
            .map(ammunitionSource),
          wasRoyalist: false,
          npcs: encountersFor(s, at),
          detainedPrisoners: detentionManifest(s, rosterFor(s), at),
          squad: s.squad.map((id) => ({
            ...deploymentOperative(s, id),
            ...deploymentMorale(s, id, s.squad),
            ...allocated[id],
            ...(mountForOperative(s.horseState, id) ?? { horse: false, canMount: false }),
          })),
          enemies: [],
          artillery: [],
          ...regionalConditions(at, s.hour, s),
        };
        s.pendingBattle.garrison = prepareGarrison(s, at);
        s.pendingBattle.garrisonLootSources = (s.sectorStates[at]?.units ?? [])
          .filter((u) => u.militia && u.hp <= 0)
          .map(ammunitionSource);
        note(
          s,
          `La escuadra entra en ${def.name} para reconocer el lugar y hablar con sus habitantes.`,
        );
        break;
      }
      case 'leaveSector': {
        requireThat(
          s.pendingBattle?.exploration && action.battleId === s.pendingBattle.id,
          'La visita no corresponde al sector abierto.',
        );
        const visit = s.pendingBattle,
          { snapshot } = completeDeploymentReport(s, visit, action),
          outcome =
            snapshot.status === 'retreat'
              ? 'retreat'
              : snapshot.status === 'defeat'
                ? 'defeat'
                : 'visit',
          plan = planDeploymentReturn(s, visit, snapshot, outcome);
        commitDeploymentReturn(s, visit, snapshot, plan);
        s.pendingBattle = null;
        note(s, 'La escuadra vuelve a la carta de operaciones.');
        break;
      }
      case 'resumeSectorSession': {
        const snapshot = s.pendingBattle
          ? validatedInteractionSnapshot(s, action.sectorState)
          : null;
        const repository = new CampaignResumeSectorSessionRepository(transaction, snapshot);
        new ResumeSectorSessionUseCase(repository).execute({
          sectorSessionId: action.sectorSessionId,
        });
        note(s, `La escuadra retoma la visita de ${s.pendingBattle.name}.`);
        break;
      }
      case 'withdrawOnArrival': {
        withdrawOnArrival(s, action);
        note(s, 'La escuadra inicia la retirada. Podés cambiar el destino de inmediato.');
        break;
      }
      case 'redirectJourney': {
        redirectJourney(s, action);
        note(s, 'La escuadra cambia de destino desde su posición actual.');
        break;
      }
      case 'cancelTravel': {
        const q = s.squads.find((q) => q.id === (action.squadId ?? s.activeSquadId));
        cancelSquadTravel(q, action.choice);
        note(s, `${q.name}: se modifica la ruta de marcha.`);
        break;
      }
      case 'resumeTravel': {
        const q = s.squads.find((q) => q.id === (action.squadId ?? s.activeSquadId));
        resumeSquadTravel(s, q);
        note(s, `${q.name}: retoma la marcha.`);
        break;
      }
      case 'travel': {
        if (action.queue === true) {
          const q = activeSquad(s);
          queueSquadTravel(s, q, { ...action, intent: 'travel' });
          note(
            s,
            `${q.name}: ruta ordenada hacia ${campaignPlace(action.sector, s).name}. Avanzá el reloj para marchar.`,
          );
          break;
        }

        requireThat(
          !s.squad.some((id) => tooTiredToMarch(s.operativeState[id])),
          'La escuadra necesita descansar antes de marchar.',
        );
        requireThat(s.squad.length > 0, 'No hay combatientes en esta escuadra.');
        const destination = locationId(action.sector, s);
        requireThat(destination, 'El destino no existe.');
        action = { ...action, sector: destination };
        if (destination !== s.location)
          prepareCampaignAmmunition(s, rosterFor(s), s.squad, {
            supplied: isSupplied(s, s.location),
            commit: true,
          });
        const q = activeSquad(s);
        queueSquadTravel(s, q, { ...action, intent: 'travel' });
        for (
          let hours = 0;
          hours < 240 && q.journey?.status === 'moving' && !s.defeated && !s.pendingEncounter;
          hours++
        )
          tick(s, 1, { joinArrivals: false });
        note(s, `La escuadra queda en ${campaignPlace(s.location, s).name}.`);
        break;
      }
      case 'transport': {
        const network = TRANSPORT_NETWORKS.find((n) => n.id === action.mode);
        requireThat(network, 'Transporte desconocido.');
        requireThat(!s.routes[action.mode], 'Ese transporte ya está organizado.');
        pay(s, { treasury: network.cost });
        s.routes[action.mode] = true;
        note(s, 'La nueva red de transporte queda disponible.');
        break;
      }
      case 'fundArmy': {
        const f = foundryFor(s);
        requireThat(s.flags.foundry, `Primero organizá ${f.name}.`);
        requireThat(!s.flags.armyFunded, 'El ejército ya está financiado.');
        pay(s, { treasury: f.fundingCost });
        s.flags.armyFunded = true;
        note(s, `Se abonan ${f.fundingCost} pesos para instruir y equipar al ${f.armyName}.`);
        break;
      }
      case 'foundry': {
        const reason = foundryReason(s);
        requireThat(!reason, reason);
        const f = foundryFor(s);
        requireThat(!s.flags.foundry, `${f.name} ya está organizado.`);
        pay(s, { treasury: f.setupCost });
        s.flags.foundry = true;
        note(s, `${campaignRole(s, 'foundryEngineer').name} organiza ${f.name}.`);
        break;
      }
      case 'policy':
      case 'diplomacy':
        scenarioFor(s).dispatchAction(s, action, scenarioContext(s));
        break;
      case 'transferMilitia':
      case 'distributeMilitia':
        note(s, redistributeMilitia(s, action));
        break;
      case 'militia': {
        const at = action.sector ?? s.location,
          rank = Number(action.rank ?? 0),
          trainerId = Number(action.trainerId),
          trainer = rosterFor(s).find((o) => o.id === trainerId);
        requireThat(
          s.sectors[at]?.owner === 'patriot',
          'La instrucción necesita un sector propio.',
        );
        requireThat(
          [0, 1].includes(rank),
          'Los veteranos ascienden por experiencia de combate, no por instrucción.',
        );
        const eligibility = militiaEligibility(s, at);
        requireThat(eligibility.eligible, eligibility.reason);
        requireThat(
          trainer &&
            s.recruited.includes(trainerId) &&
            s.operativeState[trainerId]?.alive &&
            operativeLocation(s, trainerId) === at,
          'Elegí un instructor contratado y presente en el sector.',
        );
        requireThat(trainer.leadership >= 30, 'El instructor necesita al menos 30 de liderazgo.');
        requireThat(
          !careAssignmentBusy(s.operativeState[trainerId]?.assignment),
          'Poné al combatiente en servicio antes de asignarlo a las milicias.',
        );
        requireThat(!militiaAssignment(s, trainerId), 'El instructor ya dirige otro curso.');
        requireThat(
          !s.militiaTraining.some((t) => t.sector === at),
          'Ya hay un curso activo en ese sector.',
        );
        const region = s.sectors[at];
        requireThat(
          rank === 0 || region.militia[rank - 1] >= MILITIA_COHORT,
          'La promoción necesita tres milicianos del grado anterior.',
        );
        requireThat(
          rank > 0 || region.militia.reduce((a, b) => a + b, 0) + MILITIA_COHORT <= MILITIA_LIMIT,
          'La guarnición admite hasta sesenta milicianos.',
        );
        const course = militiaCourse(trainer, rank);
        pay(s, course.cost);
        const trainees = rank > 0 ? reserveMilitiaTrainees(s, at, rank, course.count) : undefined;
        if (rank > 0) region.militia[rank - 1] -= course.count;
        s.militiaTraining.push({
          ...(trainees ? { trainees } : {}),
          sector: at,
          rank,
          trainerId,
          count: course.count,
          remaining: course.hours,
          duration: course.hours,
          started: s.hour,
        });
        note(
          s,
          `${trainer.name} inicia un curso de milicias de ${course.hours} horas en ${sector(at, s).name}.`,
        );
        break;
      }
      case 'cancelMilitia': {
        const course = s.militiaTraining.find((t) => t.sector === action.sector);
        requireThat(course, 'No hay un curso activo en ese sector.');
        returnMilitiaTrainees(s, course);
        s.militiaTraining = s.militiaTraining.filter((t) => t !== course);
        note(
          s,
          'Se suspende el curso. Los soldados regresan a su grado anterior; los suministros de instrucción ya se consumieron.',
        );
        break;
      }
      case 'fortify': {
        const at = action.sector ?? s.location;
        requireThat(s.sectors[at]?.owner === 'patriot', 'Solo puedes fortificar sectores propios.');
        requireThat(s.sectors[at].fort < 3, 'El sector ya tiene la máxima fortificación.');
        pay(s, { treasury: 150 });
        s.sectors[at].fort++;
        note(s, `Se refuerzan las defensas de ${sector(at, s).name}.`);
        break;
      }
      case 'fightOnArrival':
      case 'beginAssault': {
        const groups =
          action.type === 'fightOnArrival'
            ? authorizeFightOnArrival(s, action)
            : readyAssaultSquads(s, action.sector);
        const at = groups[0].journey.path[1];
        const origin = groups[0].location;
        const manifest = arriveForAssault(s, groups, at);
        const ids = manifest.flatMap((group) => group.members);
        haltEnemyGroupsAt(s, at, 'stationed');
        if (
          s.sectors[at].owner === 'patriot' &&
          !occupyingGroups(s, at).length &&
          !scenarioFor(s).blockaded(s, sector(at, s))
        ) {
          for (const id of ids) if (s.contracts[id]?.departurePending) endOperativeService(s, id);
          note(s, `Las escuadras entran en ${sector(at, s).name}; el sector ya está libre.`);
          break;
        }
        const coordinator = new CampaignSectorSessionCoordinator(s);
        const sameActiveSector = s.pendingBattle?.sector === at && !s.pendingBattle.sceneId;
        const suspendedTarget = s.suspendedSectorSessions?.find(
          (record) => record.request.sector === at && !record.request.sceneId,
        );
        let existingSnapshot = sameActiveSector
          ? validatedInteractionSnapshot(s, action.sectorState)
          : null;
        if (s.pendingBattle && !sameActiveSector) {
          coordinator.suspendActive(validatedInteractionSnapshot(s, action.sectorState));
        }
        if (suspendedTarget) {
          coordinator.resume(suspendedTarget.request.id);
          existingSnapshot = s.pendingBattle.resumeSnapshot;
        }
        if (existingSnapshot) {
          const existingRequest = s.pendingBattle;
          const incoming = {
            sector: at,
            origin,
            squad: manifest.flatMap((group) => {
              const allocated = prepareCampaignAmmunition(s, rosterFor(s), group.members, {
                at: group.origin,
                supplied: isSupplied(s, group.origin),
                commit: true,
              }).allocation;
              return group.members.map((id) => ({
                ...deploymentOperative(s, id),
                ...deploymentMorale(s, id, group.members),
                ...allocated[id],
                ...(mountForOperative(s.horseState, id) ?? { horse: false, canMount: false }),
              }));
            }),
            assaultSquads: manifest,
            enemies: [],
          };
          prepareDeploymentExits(s, incoming);
          const reinforced = admitSectorReinforcements(existingSnapshot, incoming);
          existingRequest.squad.push(...incoming.squad);
          existingRequest.assaultSquads = [...(existingRequest.assaultSquads ?? []), ...manifest];
          existingRequest.issuedAmmunition ??= {};
          addAmmoCounts(existingRequest.issuedAmmunition, incoming.issuedAmmunition);
          existingRequest.issuedCartridges += incoming.issuedCartridges;
          existingRequest.storedCartridges =
            (existingRequest.storedCartridges ?? 0) + incoming.storedCartridges;
          existingRequest.resumeSnapshot = reinforced;
          note(s, `Los refuerzos se incorporan a la visita de ${existingRequest.name}.`);
        } else {
          s.activeSquadId = groups[0].id;
          s.squad = [...groups[0].members];
          s.location = at;
          prepareAttack(s, at, origin, ids, manifest);
        }
        restoreGameSession(s);
        break;
      }
      case 'attack': {
        const at = action.sector ?? scenarioFor(s).defaultAttackSector,
          def = scenarioFor(s).attackDefinition(s, at, scenarioContext(s)),
          mission = Boolean(def?.mission);
        requireThat(
          at === s.location || !s.squad.some((id) => tooTiredToMarch(s.operativeState[id])),
          'La escuadra necesita descansar antes de atacar.',
        );
        requireThat(def, 'No existe ese campo de batalla.');
        requireThat(
          mission
            ? s.location === def.anchor
            : s.location === at || assaultNeighbor(s.location, at, s),
          'La escuadra debe marchar a un sector vecino antes de atacar.',
        );
        scenarioFor(s).admitAttack(s, at, def, scenarioContext(s));
        requireThat(
          s.squad.some((id) => s.operativeState[id].alive && s.operativeState[id].hp > 0),
          'No hay combatientes disponibles.',
        );
        if (!mission) {
          requireThat(
            s.sectors[at].owner === 'royalist' || scenarioFor(s).blockaded(s, def),
            'El sector ya está bajo control patriota.',
          );
          requireThat(
            def.neighbors.some((id) => s.sectors[id].owner === 'patriot' && isSupplied(s, id)),
            'Debes abrir una ruta hasta el frente.',
          );
        }
        if (action.queue === true && !mission && s.location !== at) {
          queueSquadTravel(s, activeSquad(s), { ...action, intent: 'attack' });
          note(s, `La escuadra prepara su avance al límite de ${def.name}.`);
          break;
        }
        const origin = s.location;
        if (!mission && s.location !== at) {
          // Immediate orders advance the same journey used by queued squads.
          // Transport eligibility, remounts, fatigue and interruptions must agree.
          const squad = activeSquad(s);
          queueSquadTravel(s, squad, { ...action, sector: at, intent: 'attack' });
          tick(s, squad.journey.legHours);
          if (s.completed || s.defeated) {
            delete squad.journey;
            note(s, 'El despliegue se cancela: la campaña ha terminado.');
            break;
          }
          if (squad.journey?.status !== 'ready') {
            note(s, 'El avance sigue pendiente. Resolvé los avisos de la marcha antes de atacar.');
            break;
          }
          note(s, 'La escuadra llegó al límite. Elegí combatir o retirarte.');
          break;
        }
        requireThat(
          action.squadIds === undefined || mission,
          'La selección de apoyo corresponde a una misión.',
        );
        const manifest =
          action.squadIds === undefined ? null : missionAssaultManifest(s, action.squadIds);
        prepareAttack(
          s,
          at,
          origin,
          manifest ? manifest.flatMap((q) => q.members) : s.squad,
          manifest,
        );
        break;
      }
      case 'battleResult': {
        requireThat(
          s.pendingBattle && !s.pendingBattle.exploration,
          'No hay batalla de conquista pendiente.',
        );
        requireThat(
          action.battleId === s.pendingBattle.id,
          'El resultado no corresponde a la batalla pendiente.',
        );
        requireThat(
          ['victory', 'defeat', 'retreat'].includes(action.outcome),
          'Resultado de batalla inválido.',
        );
        const request = s.pendingBattle;
        const { snapshot: battleSnapshot } = completeDeploymentReport(s, request, action);
        action = scenarioFor(s).settleMissionResult(
          s,
          request,
          battleSnapshot,
          action,
          scenarioContext(s),
        );
        const plan = planDeploymentReturn(s, request, battleSnapshot, action.outcome);
        commitDeploymentReturn(s, request, battleSnapshot, plan);
        for (const id of request.squad.map((u) => Number(u.id)))
          if (
            gainsExperience(
              s,
              rosterFor(s).find((o) => o.id === id),
            ) &&
            s.operativeState[id].alive
          ) {
            const before = rosterFor(s).find((o) => o.id === id),
              xp = action.outcome === 'victory' ? 60 : action.outcome === 'defeat' ? 20 : 10;
            s.operativeState[id].xp = (s.operativeState[id].xp ?? 0) + xp;
            const after = rosterFor(s).find((o) => o.id === id);
            if (after.level > before.level) {
              const growth = after.maxHp - before.maxHp;
              s.operativeState[id].maxHp += growth;
              if (s.operativeState[id].hp === before.maxHp) s.operativeState[id].hp += growth;
              note(s, `${after.name} mejora su instrucción tras el combate: grado${after.level}.`);
            }
          }
        if (request.defenseGroupId) {
          finishDefense(s, request, action.outcome, battleSnapshot, plan);
          break;
        }
        for (const groupId of request.occupationGroupIds ?? [])
          recordEnemyGroupResult(s, groupId, battleSnapshot, action.outcome);
        if (action.outcome === 'victory') {
          recordCityLoyalty(s, {
            sectorId: sceneAnchorFor(s, request.sector),
            kind: 'victory',
            eventId: request.id,
          });
          if (!isCampaignScene(s, request.sector)) {
            const region = s.sectors[request.sector];
            region.owner = 'patriot';
            region.damageUntil = 0;
            releaseCaptives(s, request.sector);
          }
          scenarioFor(s).clearVictoryBlockade(s, request);
          if (request.wasRoyalist || isCampaignScene(s, request.sector))
            awardVictoryFunds(s, request, battleSnapshot);
          scenarioFor(s).battleOutcome(s, request, 'victory', scenarioContext(s));
          note(s, scenarioFor(s).victoryText(request));
        } else {
          scenarioFor(s).battleOutcome(s, request, action.outcome, scenarioContext(s));
          note(s, `El destacamento se retira de ${request.name}.`);
        }
        s.sectorStates[request.sector] = clone(compactCellScene(battleSnapshot, s));
        s.pendingBattle = null;
        s.squad = s.squad.filter((id) => s.operativeState[id].alive);
        if (!s.squad.length) {
          // Select an existing local column without copying its members into the
          // empty command. Only unassigned reserves may fill that empty squad.
          const local = s.squads.find(
            (q) =>
              q.id !== s.activeSquadId &&
              q.location === s.location &&
              !q.journey &&
              q.members.some(
                (id) =>
                  s.recruited.includes(id) &&
                  s.operativeState[id]?.alive &&
                  !s.operativeState[id]?.captured,
              ),
          );
          if (local) {
            s.activeSquadId = local.id;
            s.squad = [...local.members];
          } else {
            const assigned = new Set(s.squads.flatMap((q) => q.members));
            s.squad = s.recruited
              .filter(
                (id) =>
                  !assigned.has(id) &&
                  s.operativeState[id].alive &&
                  !s.operativeState[id].captured &&
                  operativeLocation(s, id) === s.location,
              )
              .slice(0, 6);
          }
        }
        break;
      }
      default:
        throw Error('Orden desconocida.');
    }
    if (previous.pendingBattle && !s.pendingBattle)
      settleDetentionReturn(s, previous.pendingBattle);
    reorganizeAfterLoss(s, previous);
    delayCrossingEnemyGroups(s);
    if (s.pendingBattle && !previous.pendingBattle) prepareSectorArtillery(s, s.pendingBattle);
    if (s.pendingBattle && !s.pendingBattle.exits) prepareDeploymentExits(s, s.pendingBattle);
    // Check real arrival geometry before committing soldiers, ammunition or guns.
    if (
      ['attack', 'beginAssault', 'fightOnArrival'].includes(action.type) &&
      s.pendingBattle &&
      s.pendingBattle.id !== previous.pendingBattle?.id
    )
      enterSector(
        { ...s.pendingBattle, campaignPackage: s.contentCampaign?.package },
        s.sectorStates[s.pendingBattle.sector],
        { placement: true },
      );
    if (s.pendingBattle && s.pendingBattle.id !== previous.pendingBattle?.id)
      prepareSectorArtillery(s, s.pendingBattle);
    if (
      s.pendingBattle &&
      s.pendingBattle.id !== previous.pendingBattle?.id &&
      s.contentCampaign?.package.militiaPatrol !== undefined
    )
      s.pendingBattle.militiaPatrol = clone(s.contentCampaign.package.militiaPatrol);
    if (
      s.pendingBattle &&
      s.pendingBattle.id !== previous.pendingBattle?.id &&
      s.contentCampaign?.package.artilleryProfiles !== undefined
    )
      s.pendingBattle.artilleryDefinitions = clone(s.contentCampaign.package.artilleryProfiles);
    updateContentQuests(s);
    releaseDeferred(s);
    receiveDueHires(s);
    synchronizeSquad(s);
    synchronizeCampaignPresence(s);
    synchronizeDialogueMovements(s);
    progress(s);
    deliverPendingCompanionLossCorrespondence(s, rosterFor(s));
    validatePendingCompanionLoss(s, rosterFor(s));
    scenarioFor(s).changedFlags(s, previous, scenarioContext(s));
    if (['purchaseMedicalSupplies', 'resupply', 'equip'].includes(action.type)) {
      const oldRoster = rosterFor(previous);
      for (const op of rosterFor(s)) {
        const before = carriedAmmunition(
            oldRoster.find((o) => o.id === op.id),
            previous.operativeState[op.id],
          ),
          after = carriedAmmunition(op, s.operativeState[op.id]);
        requireThat(!pocketChangeReason(before, after), POCKET_FULL);
      }
    }
    if (s.pendingBattle && s.pendingBattle.id !== previous.pendingBattle?.id)
      for (const unit of s.pendingBattle.squad) {
        const before = carriedAmmunition(
          rosterFor(previous).find((o) => o.id === unit.id),
          previous.operativeState[unit.id],
        );
        requireThat(!pocketChangeReason(before, unit), `${unit.name}: ${POCKET_FULL}`);
      }
    forfeitDeadServiceGuarantees(s, rosterFor(s));
    for (const credit of creditPendingGuaranteeRefunds(s))
      note(
        s,
        `Garantía ${credit.id}: se abonan ${credit.amount} pesos pendientes; quedan ${credit.pendingRefund} pesos por devolver.`,
      );
    validateServiceGuarantees(s, rosterFor(s));
    for (const credit of creditPendingVictoryFunds(s))
      if (previous.pendingVictoryRewards?.some((e) => e.battleId === credit.battleId))
        note(
          s,
          `Fondos de victoria: se abonan ${credit.amount} pesos pendientes; quedan ${credit.pending} pesos por recibir.`,
        );
    validatePendingVictoryFunds(s);
    initializeCampaignSystems(s);
    validateServiceEquipmentReturns(s, rosterFor(s));
    syncCampaignAmmunition(s, rosterFor(s));
    validateCampaignAmmunition(s, rosterFor(s));
    validateCampaignWeather(s);
    validateDeploymentReturnState(s);
    validateEquipmentOwnership(s, rosterFor(s));
    if (Object.keys(s.assignmentAttention.reported).length)
      reconcileAssignmentAttention(s, assignmentStates(s, rosterFor(s), assignmentContext(s)));
    reconcileContractAttention(s);
    reconcileLogisticsAttention(s, { isSupplied });
    refreshEnemyIntelligence(s);
    removeIgnitionSupplies(s);
    restoreGameSession(s);
    return transaction.commit();
  } catch (error) {
    transaction.abort();
    const rejected = clone(previous);
    rejected.lastError = domainRefusalMessage(error);
    return rejected;
  }
}
export function serializeCampaign(s) {
  return JSON.stringify(
    s,
    campaignPackageSaveReplacer(
      s,
      cellSceneSaveReplacer(artillerySaveReplacer(s, weaponSaveReplacer(s)), s),
    ),
  );
}
export function restoreCampaign(text) {
  assertSaveSize(text);
  return restoreCampaignValue(JSON.parse(text));
}
export function restoreCampaignValue(s) {
  requireThat(
    s.gameRevision === undefined || (Number.isSafeInteger(s.gameRevision) && s.gameRevision >= 0),
    'La revisión de la partida no es válida.',
  );
  s.gameRevision ??= 0;
  validateCampaignContent(s);
  restoreCampaignPackageReference(s, s.pendingBattle);
  if (s.pendingBattle?.campaignPackage !== undefined) {
    requireThat(
      s.contentCampaign &&
        canonicalContent(s.pendingBattle.campaignPackage) ===
          canonicalContent(s.contentCampaign.package),
      'El contenido del despliegue no coincide con la campaña guardada.',
    );
    s.pendingBattle.campaignPackage = s.contentCampaign.package;
  }
  for (const scene of [
    ...Object.values(s.sectorStates ?? {}),
    ...Object.values(s.sceneStates ?? {}),
    s.pendingBattle?.resumeSnapshot,
  ])
    validateCampaignSceneDefinitions(s, scene);
  restoreArtilleryReferences(s, s);
  const base = initialCampaign(s.seed, s.contentCampaign?.package ?? null);
  validateCorrespondence(s);
  const integer = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
  const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  requireThat(
    object(s) &&
      s.version === 1 &&
      integer(s.hour, 0, 24 * 365 * 100) &&
      integer(s.phase, 0, 1000000) &&
      integer(s.seed, 0, 4294967295) &&
      validWorldLocation(s.location, s),
    'El archivo de campaña no es compatible.',
  );
  requireThat(
    s.errandDefinitions === undefined ||
      validateQuestDefinitions(s.errandDefinitions, s).length === 0,
    'Los encargos guardados son inválidos.',
  );
  requireThat(
    validateRoadsideDiscoveries(s.roadsideDiscoveryDefinitions).length === 0,
    'Los hallazgos de camino guardados son inválidos.',
  );
  requireThat(
    !['production', 'shipments', 'depots', 'convoys'].some((key) => key in s),
    'Esta partida contiene sistemas retirados. Iniciá una campaña nueva.',
  );
  requireThat(
    s.economyVersion === 2,
    'Esta partida usa la economía anterior. Iniciá una campaña nueva.',
  );
  validateStoredFittingFields(s);
  validateStoredAmmo(s);
  migrateAmmunitionCustody(s);
  requireThat(
    Array.isArray(s.foundMoney) &&
      new Set(s.foundMoney).size === s.foundMoney.length &&
      s.foundMoney.every((id) => sector(id, s)),
    'El registro de fondos es inválido.',
  );
  s.equipmentShipments ??= [];
  requireThat(validEquipmentShipments(s), 'Los pedidos de armas guardados son inválidos.');
  requireThat(
    object(s.resources) &&
      Object.keys(base.resources).every((k) => integer(s.resources[k], 0, 1e9)),
    'La tesorería del archivo es inválida.',
  );
  requireThat(
    object(s.reputation) &&
      Object.keys(base.reputation).every((k) => integer(s.reputation[k], -100, 100)) &&
      scenarioFor(s).validateReputation(s),
    'Las relaciones del archivo son inválidas.',
  );
  requireThat(
    object(s.sectors) &&
      Object.keys(s.sectors).length === campaignSectors(s).length &&
      campaignSectors(s).every((d) => {
        const r = s.sectors[d.id];
        return (
          object(r) &&
          ['patriot', 'royalist'].includes(r.owner) &&
          integer(r.loyalty, 0, 100) &&
          integer(r.fort, 0, 3) &&
          integer(r.damageUntil, 0, 1e9) &&
          Array.isArray(r.militia) &&
          r.militia.length === 3 &&
          r.militia.every((x) => integer(x, 0, 100000))
        );
      }),
    'El mapa del archivo es inválido.',
  );
  s.militiaTraining ??= [];
  requireThat(
    Array.isArray(s.militiaTraining) &&
      s.militiaTraining.length <= campaignSectors(s).length &&
      new Set(s.militiaTraining.map((t) => t?.sector)).size === s.militiaTraining.length &&
      new Set(s.militiaTraining.map((t) => t?.trainerId)).size === s.militiaTraining.length &&
      s.militiaTraining.every(
        (t) =>
          object(t) &&
          sector(t.sector, s) &&
          integer(t.rank, 0, 2) &&
          Number.isInteger(t.trainerId) &&
          baseRosterFor(s).some((o) => o.id === t.trainerId) &&
          s.recruited?.includes(t.trainerId) &&
          t.count === 3 &&
          integer(t.duration, 1, 96) &&
          integer(t.remaining, 1, t.duration) &&
          integer(t.started, 0, s.hour),
      ),
    'Los cursos de milicias guardados son inválidos.',
  );
  // Version1 migration: old saves did not contain civic volunteers or a custom officer.
  if (s.officer === undefined) s.officer = null;
  requireThat(
    s.officer === null ||
      (object(s.officer) && typeof s.officer.name === 'string' && object(s.officer.answers)),
    'El examen guardado es inválido.',
  );
  if (s.officer) createOfficerRecord(s.officer.name, s.officer.answers, s.officer.profile, s);
  requireThat(object(s.operativeState), 'Las hojas de servicio son inválidas.');
  for (const op of s.contentCampaign ? [] : CIVIC_RECRUITS)
    s.operativeState[op.id] ??= {
      hp: op.maxHp,
      fatigue: 0,
      alive: true,
      xp: 0,
      rations: 2,
      torches: 2,
      condition: 100,
    };
  for (const op of Object.values(s.operativeState)) {
    requireThat(object(op), 'Las hojas de servicio son inválidas.');
    if (op.missionSuppliesVersion !== undefined)
      requireThat(
        op.missionSuppliesVersion === 1,
        'La versión de suministros del aliado no es válida.',
      );
    validateTraining(op);
    validatePocketOrder(op.pocketOrder);
    for (const k of ['medkits', 'bleeding'])
      if (op[k] !== undefined)
        requireThat(Number.isInteger(op[k]), 'Los suministros y heridas guardados son inválidos.');
    op.xp ??= 0;
    if (op.inventory !== undefined) validatePersonalInventory(op.inventory);
    for (const [field, limit] of Object.entries({
      energy: 100,
      bleeding: 10,
      medkits: 1000000,
      weight: 1000,
      strength: 100,
      strengthTraining: 10000,
      boleadoras: 100000,
    })) {
      if (op[field] !== undefined)
        requireThat(
          Number.isFinite(op[field]) && op[field] >= 0 && op[field] <= limit,
          'El estado físico guardado es inválido.',
        );
    }
    for (const [field, baseline] of Object.entries({ rations: 2, torches: 2, condition: 100 })) {
      op[field] ??= baseline;
      requireThat(
        integer(op[field], 0, field === 'condition' ? 100 : 100000),
        'Los suministros guardados son inválidos.',
      );
    }
    requireThat(integer(op.xp, 0, 1e7), 'La experiencia guardada es inválida.');
  }
  for (const op of rosterFor(s)) {
    const unit = { ...op, ...s.operativeState[op.id] };
    validateWeaponCarrier(unit);
    personalPockets(unit);
    requireThat(
      unit.activeSlot === undefined ||
        ['primary', 'blade', 'medical', 'unarmed', 'tool', 'supply', 'item'].includes(
          unit.activeSlot,
        ),
      'La mano guardada no es válida.',
    );
  }
  s.missions ??= {};
  s.sceneStates ??= {};
  s.missionAllies ??= {};
  const validatedScenes = new Map();
  requireThat(
    scenarioFor(s).validateStoredScenes(s, {
      validateSectorSnapshot: (snapshot) => {
        const restored = validateSectorSnapshot(expandCellScene(snapshot, s), s);
        validatedScenes.set(snapshot, restored);
        return restored;
      },
    }),
    'Las escenas guardadas son inválidas.',
  );
  for (const [id, snapshot] of Object.entries(s.sceneStates))
    s.sceneStates[id] =
      validatedScenes.get(snapshot) ?? validateSectorSnapshot(expandCellScene(snapshot, s), s);
  s.garrisons ??= {};
  s.nextMilitiaId ??= 20000;
  requireThat(validGarrisons(s), 'Las guarniciones guardadas son inválidas.');
  requireThat(
    s.militiaTraining.every((course) => validMilitiaTrainees(s, course)),
    'Los milicianos en instrucción son inválidos.',
  );
  const traineeIds = s.militiaTraining.flatMap((course) =>
    (course.trainees ?? []).map((u) => u.id),
  );
  requireThat(
    new Set(traineeIds).size === traineeIds.length,
    'Los milicianos en instrucción son inválidos.',
  );
  for (const snapshot of [
    s.pendingBattle,
    s.pendingBattle?.resumeSnapshot,
    ...Object.values(s.sectorStates ?? {}),
    ...Object.values(s.sceneStates ?? {}),
  ].filter(Boolean)) {
    validateQuestContext(s, snapshot);
    validateRoadsideDiscoveryContext(s, snapshot);
  }
  s.quests ??= {};
  requireThat(validateQuests(s.quests, s.hour, s), 'Los encargos guardados son inválidos.');
  if (s.pendingBattle)
    validateQuestBeneficiaryContext(s, s.pendingBattle, { request: null, issued: true });
  if (s.pendingBattle?.resumeSnapshot) {
    s.pendingBattle.resumeSnapshot = validateSectorSnapshot(
      expandCellScene(s.pendingBattle.resumeSnapshot, s),
      s,
    );
    validateRepairReserveContext(s.pendingBattle, s.pendingBattle.resumeSnapshot);
    validateQuestBeneficiaryContext(s, s.pendingBattle.resumeSnapshot);
    retainRepairReserves(s.pendingBattle, s.pendingBattle.resumeSnapshot);
  }
  for (const snapshot of [
    ...Object.values(s.sectorStates ?? {}),
    ...Object.values(s.sceneStates ?? {}),
  ])
    validateQuestBeneficiaryContext(s, snapshot, { request: null, retained: true });
  s.lastConversation ??= null;
  s.conversations ??= {};
  requireThat(
    object(s.conversations) &&
      Object.entries(s.conversations).every(
        ([id, c]) =>
          [...encounterDefinitions(s), ...scenarioFor(s).missionNPCs].some((n) => n.id === id) &&
          object(c) &&
          c.met === true &&
          [
            'repeat',
            'friendly',
            'direct',
            'threaten',
            'recruit',
            'quest',
            'questWithdraw',
            'mission',
            'dialogue',
            'gift',
            'escortFollow',
            'escortWait',
          ].includes(c.lastApproach) &&
          integer(c.hour, 0, s.hour) &&
          (c.secondOfHour === undefined ||
            (integer(c.secondOfHour, 0, 3599) &&
              c.hour * 3600 + c.secondOfHour <= s.hour * 3600 + (s.secondOfHour ?? 0))) &&
          (c.text === undefined ||
            (typeof c.text === 'string' && c.text.length > 0 && c.text.length < 2000)) &&
          (c.giftCount === undefined
            ? c.lastApproach !== 'gift'
            : questsFor(s).some(
                (q) =>
                  questContactIds(q).includes(id) &&
                  q.carried &&
                  integer(c.giftCount, 0, q.carried.count),
              )) &&
          (c.sector === undefined ||
            validWorldLocation(c.sector, s) ||
            isCampaignScene(s, c.sector)),
      ),
    'Las conversaciones guardadas son inválidas.',
  );
  requireThat(
    s.lastConversation === null ||
      (object(s.lastConversation) &&
        [...encounterDefinitions(s), ...scenarioFor(s).missionNPCs].some(
          (n) => n.id === s.lastConversation.npcId,
        ) &&
        typeof s.lastConversation.text === 'string' &&
        s.lastConversation.text.length < 2000 &&
        typeof s.lastConversation.speaker === 'string' &&
        s.lastConversation.speaker.length <= 100 &&
        Array.isArray(s.lastConversation.options) &&
        s.lastConversation.options.every((o) =>
          [
            'repeat',
            'friendly',
            'direct',
            'threaten',
            'recruit',
            'quest',
            'questWithdraw',
            'mission',
            'dialogue',
            'escortFollow',
            'escortWait',
          ].includes(o),
        ) &&
        (s.lastConversation.giftCount === undefined ||
          questsFor(s).some(
            (q) =>
              questContactIds(q).includes(s.lastConversation.npcId) &&
              q.carried &&
              integer(s.lastConversation.giftCount, 1, q.carried.count) &&
              s.lastConversation.giftCount === s.conversations[s.lastConversation.npcId]?.giftCount,
          ))),
    'El diálogo guardado es inválido.',
  );
  validateCampaignEventState(s);
  validateSavedDialogues(s, encounterDefinitions(s));
  validateTownIncome(s);
  for (const quest of questsFor(s))
    for (const npcId of questContactIds(quest)) {
      const at = questBeneficiaryForNPC(quest, npcId)?.sector ?? quest.sector;
      if (
        quest.carried &&
        at !== s.pendingBattle?.sector &&
        (s.conversations[npcId]?.giftCount ?? 0) > 0
      )
        validateAcknowledgedNpcGiftReceipts(s, s.sectorStates[at]?.npcs ?? [], at);
    }
  s.armory ??= {};
  s.loadouts ??= {};
  s.artillerySelection ??= [];
  requireThat(
    s.artillerySelectionExplicit === undefined || typeof s.artillerySelectionExplicit === 'boolean',
    'La elección de batería guardada es inválida.',
  );
  requireThat(
    Array.isArray(s.artillerySelection) &&
      s.artillerySelection.length <= 3 &&
      s.artillerySelection.every(
        (t) =>
          ['bronze4', 'field8', 'swivel'].includes(t) ||
          (typeof t === 'string' && t.startsWith('depot:') && t.length > 6 && t.length <= 166),
      ),
    'La batería guardada es inválida.',
  );
  requireThat(
    object(s.armory) &&
      Object.entries(s.armory).every(
        ([key, v]) =>
          [...equipmentCatalog(s), ...EQUIPMENT_CATALOG].some(
            (o) => String(o.stockKey ?? o.item) === key,
          ) && integer(v, 0, 100000),
      ),
    'La armería guardada es inválida.',
  );
  validateArmoryItems(s);
  requireThat(
    object(s.loadouts) &&
      Object.entries(s.loadouts).every(
        ([id, slots]) =>
          baseRosterFor(s).some((o) => o.id === Number(id)) &&
          object(slots) &&
          Object.entries(slots).every(
            ([slot, v]) =>
              ['weapon', 'blade'].includes(slot) &&
              (v === 0 || integer(v, slot === 'blade' ? 1809 : 1800, 1813)),
          ),
      ),
    'Los equipos guardados son inválidos.',
  );
  s.cityLoyaltyEvents ??= [];
  requireThat(
    validCityLoyaltyEvents(s.cityLoyaltyEvents, s),
    'El registro de lealtad es inválido.',
  );
  validateQuestWithdrawalReceipts(s, rosterFor(s));
  for (const quest of questsFor(s))
    if (quest.rewardChoice && s.quests[quest.id]?.status === 'completed') {
      const resolution = s.quests[quest.id].questResolution,
        event = s.cityLoyaltyEvents.find(
          (e) => e.kind === 'quest' && e.eventId === `npc-${quest.id}`,
        );
      requireThat(
        s.conversations[quest.npcId]?.giftCount === quest.carried.count &&
          (resolution === 'civic'
            ? event?.sectorId === quest.sector && event.hour === s.quests[quest.id].completedAt
            : !event),
        'La resolución del encargo no coincide con la entrega y su recompensa.',
      );
    }
  for (const quest of questsFor(s))
    if (quest.beneficiaries) {
      const record = s.quests[quest.id],
        selected = quest.beneficiaries.find((b) => b.id === record?.beneficiaryId),
        event = s.cityLoyaltyEvents.find(
          (e) => e.kind === 'quest' && e.eventId === `npc-${quest.id}`,
        );
      if (selected)
        requireThat(
          (s.conversations[selected.npcId]?.giftCount ?? 0) > 0,
          'El destino elegido no tiene una entrega reconocida.',
        );
      for (const branch of quest.beneficiaries)
        if (branch !== selected)
          requireThat(
            (s.conversations[branch.npcId]?.giftCount ?? 0) === 0,
            'El encargo entregó objetos a dos destinatarios.',
          );
      if (record?.status === 'completed')
        requireThat(
          selected &&
            s.conversations[selected.npcId]?.giftCount === quest.carried.count &&
            (selected.reward.loyalty
              ? event?.sectorId === selected.sector && event.hour === record.completedAt
              : !event),
          'La resolución del encargo no coincide con el destinatario y su recompensa.',
        );
      else requireThat(!event, 'El encargo pendiente o fallido no admite una recompensa.');
    }
  migrateContracts(s);
  requireThat(
    object(s.contracts) &&
      Object.entries(s.contracts).every(
        ([id, c]) =>
          s.recruited.includes(Number(id)) &&
          object(c) &&
          (c.departurePending === undefined || typeof c.departurePending === 'boolean') &&
          ['paid', 'patriot', 'legacy'].includes(c.kind) &&
          ['day', 'week', 'fortnight', 'month'].includes(c.term) &&
          integer(c.started, 0, s.hour) &&
          (c.startedSecond === undefined || integer(c.startedSecond, 0, 3599)) &&
          (c.expiresSecond === undefined || integer(c.expiresSecond, 0, 3599)) &&
          c.started * 3600 + (c.startedSecond ?? 0) <= s.hour * 3600 + (s.secondOfHour ?? 0) &&
          (c.expiresAt === null
            ? c.kind !== 'paid' && c.expiresSecond === undefined
            : integer(c.expiresAt, 0, 1e9) &&
              ((c.departurePending &&
                (deployed(s, Number(id)) || operativeInTransit(s, Number(id)))) ||
                contractExpiresSeconds(c) > s.hour * 3600 + (s.secondOfHour ?? 0))) &&
          integer(c.paid, 0, 1e9),
      ) &&
      s.recruited.every((id) => s.contracts[id]),
    'Los contratos guardados son inválidos.',
  );
  for (const id of s.recruited) {
    const c = characterForOperative(s, id);
    if (!c || !isWorldCharacter(c)) continue;
    const contract = s.contracts[id];
    requireThat(
      c.service === 'contract'
        ? contract.kind === 'paid' && contract.expiresAt !== null
        : contract.kind === 'patriot' && contract.expiresAt === null && contract.paid === 0,
      'El contrato del habitante no coincide con su servicio.',
    );
  }
  const ids = rosterFor(s).map((o) => o.id),
    validIds = (values) =>
      Array.isArray(values) &&
      new Set(values).size === values.length &&
      values.every((id) => ids.includes(id));
  requireThat(
    validIds(s.recruited) &&
      validIds(s.squad) &&
      s.squad.length <= 6 &&
      s.squad.every((id) => s.recruited.includes(id)),
    'El destacamento del archivo es inválido.',
  );
  requireThat(
    s.recruited.every((id) => characterForOperative(s, id)?.encounter?.recruitable !== false),
    'Un habitante no reclutable no puede estar en la escuadra.',
  );
  requireThat(
    object(s.operativeState) &&
      rosterFor(s).every((o) => {
        const r = s.operativeState[o.id];
        return (
          object(r) &&
          integer(r.hp, 0, o.maxHp) &&
          integer(r.fatigue, 0, 100) &&
          typeof r.alive === 'boolean' &&
          r.alive === r.hp > 0 &&
          (r.location === undefined || validWorldLocation(r.location, s))
        );
      }),
    'Las hojas de servicio son inválidas.',
  );
  // Older authored saves retained the initial ceiling after gaining a level.
  for (const op of rosterFor(s))
    if (s.operativeState[op.id].maxHp !== undefined) {
      requireThat(
        integer(s.operativeState[op.id].maxHp, 1, op.maxHp),
        'La salud máxima guardada es inválida.',
      );
      s.operativeState[op.id].maxHp = op.maxHp;
    }
  validateHireArrivals(s, rosterFor(s));
  validateServiceGuarantees(s, rosterFor(s));
  validatePendingVictoryFunds(s);
  requireThat(
    object(s.flags) &&
      Object.keys(base.flags).every((k) => typeof s.flags[k] === 'boolean') &&
      object(s.routes) &&
      Object.keys(base.routes).every((k) => typeof s.routes[k] === 'boolean'),
    'Los acuerdos del archivo son inválidos.',
  );
  requireThat(s.phase <= scenarioFor(s).maxPhase, 'El avance guardado de la campaña no es válido.');
  validateCampaignProgress(s);
  validateMedicalCare(s, rosterFor(s));
  for (const o of rosterFor(s)) {
    const r = s.operativeState[o.id];
    if (r.bandaged !== undefined)
      requireThat(
        Number.isFinite(r.bandaged) && r.bandaged >= 0 && r.bandaged <= o.maxHp - r.hp,
        'Las heridas vendadas guardadas son inválidas.',
      );
  }
  requireThat(
    ['blockade', 'completed', 'defeated'].every((k) => typeof s[k] === 'boolean') &&
      Array.isArray(s.log) &&
      s.log.length <= 80 &&
      s.log.every(
        (p) =>
          object(p) &&
          integer(p.hour, 0, 1e9) &&
          (p.secondOfHour === undefined || integer(p.secondOfHour, 0, 3599)) &&
          typeof p.text === 'string' &&
          p.text.length <= 1000,
      ),
    'El registro del archivo es inválido.',
  );
  if (s.pendingBattle !== null) {
    const b = s.pendingBattle;
    requireThat(scenarioFor(s).validatePendingScene(s, b), 'La escena pendiente es inválida.');
    requireThat(
      object(b) &&
        typeof b.id === 'string' &&
        b.id.length < 100 &&
        (validWorldLocation(b.sector, s) || isCampaignScene(s, b.sector)) &&
        integer(b.seed, 0, 4294967295) &&
        Array.isArray(b.squad) &&
        b.squad.length <= (b.defenseGroupId ? rosterFor(s).length : b.assaultSquads ? 48 : 6) &&
        new Set(b.squad.map((o) => o.id)).size === b.squad.length &&
        b.squad.every(
          (o) =>
            object(o) &&
            (b.defenseGroupId || b.assaultSquads
              ? s.recruited.includes(o.id) &&
                operativeLocation(s, o.id) === sceneAnchorFor(s, b.sector)
              : s.squad.includes(o.id)) &&
            integer(o.loaded, 0, weaponSpecification(o)?.capacity ?? 0) &&
            integer(o.ammo, 0, 1000000) &&
            integer(o.hp, 1, 100),
        ),
      'La batalla guardada es inválida.',
    );
    if (!sector(b.sector, s) && !isCampaignScene(s, b.sector))
      requireThat(
        b.exploration === true && b.sector === s.location,
        'La visita guardada no corresponde a la celda actual.',
      );
    if (b.origin !== undefined)
      requireThat(validWorldLocation(b.origin, s), 'El origen del despliegue es inválido.');
  }

  for (const unit of [
    ...(s.pendingBattle?.squad ?? []),
    ...(s.pendingBattle?.missionAllies ?? []),
    ...Object.values(s.missionAllies ?? {}),
  ])
    validateWeaponCarrier(unit);
  for (const unit of [...(s.pendingBattle?.enemies ?? []), ...(s.pendingBattle?.garrison ?? [])]) {
    validateForceWeapon(unit);
    requireThat(
      validMilitiaArrival(unit, s.pendingBattle.sector, s),
      'La llegada de la milicia es inválida.',
    );
    requireThat(validMilitiaExperience(unit), 'La experiencia de la tropa guardada es inválida.');
  }
  if (s.pendingBattle) {
    const request = s.pendingBattle;
    requireThat(
      (request.hour === undefined || integer(request.hour, 0, s.hour)) &&
        (request.secondOfHour === undefined || integer(request.secondOfHour, 0, 3599)),
      'La hora inicial del despliegue es inválida.',
    );
    validateRegionalWeather(request, s);
  }
  if (s.pendingBattle)
    for (const unit of s.pendingBattle.squad) {
      requireThat(
        unit.preserveLoading === undefined || typeof unit.preserveLoading === 'boolean',
        'El estado de carga del despliegue es inválido.',
      );
      const op = rosterFor(s).find((o) => o.id === Number(unit.id)),
        maxHp = unit.maxHp ?? op.maxHp;
      requireThat(
        integer(maxHp, 1, op.maxHp) && unit.hp <= maxHp,
        'La salud del despliegue guardado es inválida.',
      );
      for (const [field, limit] of Object.entries({
        bleeding: 100,
        bandaged: maxHp - unit.hp,
        energy: 100,
      }))
        if (unit[field] !== undefined)
          requireThat(
            Number.isFinite(unit[field]) && unit[field] >= 0 && unit[field] <= limit,
            'Las heridas del despliegue guardado son inválidas.',
          );
      if (unit.medkits !== undefined)
        requireThat(
          integer(unit.medkits, 0, 100000),
          'Los botiquines del despliegue guardado son inválidos.',
        );
    }
  s.horseState ??= { ...initialHorseState(), hour: s.hour };
  requireThat(
    object(s.horseState) &&
      s.horseState.version === 1 &&
      integer(s.horseState.hour, 0, s.hour) &&
      integer(s.horseState.nextId, 1, 100000) &&
      Array.isArray(s.horseState.horses) &&
      s.horseState.horses.length <= 10000 &&
      new Set(s.horseState.horses.map((h) => h?.id)).size === s.horseState.horses.length &&
      Array.isArray(s.horseState.log) &&
      s.horseState.log.length <= 40 &&
      s.horseState.log.every((t) => typeof t === 'string' && t.length < 1000),
    'La caballada guardada es inválida.',
  );
  requireThat(
    s.horseState.horses.every(
      (h) =>
        object(h) &&
        typeof h.id === 'string' &&
        typeof h.name === 'string' &&
        h.name.length <= 60 &&
        ['mare', 'stallion'].includes(h.sex) &&
        validWorldLocation(h.location, s) &&
        integer(h.bornAt, -1000000, s.hour) &&
        typeof h.hired === 'boolean' &&
        (h.returned === undefined || typeof h.returned === 'boolean') &&
        (h.pregnantUntil === null || integer(h.pregnantUntil, 0, 1e9)) &&
        (h.hireUntil === null || integer(h.hireUntil, 0, 1e9)) &&
        Number.isFinite(h.stamina) &&
        h.stamina >= 0 &&
        h.stamina <= 100 &&
        Number.isFinite(h.condition) &&
        h.condition >= 0 &&
        h.condition <= 100 &&
        integer(h.feed, 0, 100000) &&
        (h.assignedTo === null || s.recruited.includes(h.assignedTo)),
    ),
    'Los caballos guardados son inválidos.',
  );
  const mounts = s.horseState.horses
    .filter((h) => !h.returned && h.assignedTo !== null)
    .map((h) => h.assignedTo);
  requireThat(
    new Set(mounts).size === mounts.length,
    'Un jinete no puede tener dos monturas asignadas.',
  );
  migrateSquads(s);
  validateSquadTravel(s);
  validateAssaultDeployment(s);
  requireThat(
    Array.isArray(s.squads) &&
      s.squads.length > 0 &&
      s.squads.length <= 8 &&
      new Set(s.squads.map((q) => q.id)).size === s.squads.length &&
      s.squads.every(
        (q) =>
          object(q) &&
          typeof q.id === 'string' &&
          /^squad-[1-9][0-9]*$/.test(q.id) &&
          typeof q.name === 'string' &&
          q.name.length <= 30 &&
          validWorldLocation(q.location, s) &&
          validIds(q.members) &&
          q.members.length <= 6 &&
          q.members.every((id) => s.recruited.includes(id)),
      ),
    'Las escuadras guardadas son inválidas.',
  );
  const assigned = s.squads.flatMap((q) => q.members);
  requireThat(
    new Set(assigned).size === assigned.length,
    'Un combatiente no puede pertenecer a dos escuadras.',
  );
  const selected = s.squads.find((q) => q.id === s.activeSquadId);
  requireThat(
    selected &&
      selected.location === s.location &&
      JSON.stringify(selected.members) === JSON.stringify(s.squad),
    'La escuadra activa del archivo es inválida.',
  );
  requireThat(object(s.sectorStates), 'Los sectores guardados son inválidos.');
  for (const [id, snapshot] of Object.entries(s.sectorStates)) {
    requireThat(
      validWorldLocation(id, s) || isCampaignScene(s, id),
      'Los sectores guardados son inválidos.',
    );
    const restored = validateSectorSnapshot(expandCellScene(snapshot, s), s);
    requireThat(
      sector(id, s) ||
        isCampaignScene(s, id) ||
        (restored.sectorId === id && restored.sourceMapId === id),
      'Los sectores guardados son inválidos.',
    );
    s.sectorStates[id] = restored;
  }
  validateAmmunitionCustody(s, rosterFor(s));
  migrateArtilleryState(s);
  validateArtilleryTransport(s);
  validateArtilleryMerchants(s);
  validateCampaignArtillery(s);
  for (const scene of [
    s.pendingBattle,
    ...Object.values(s.sectorStates),
    ...Object.values(s.sceneStates),
  ]) {
    validateCampaignPatrol(s, scene);
    validateCampaignArtilleryProfiles(s, scene);
  }
  for (const [id, snapshot] of Object.entries(s.sectorStates))
    s.sectorStates[id] = compactCellScene(snapshot, s);
  requireThat(
    !s.pendingBattle ||
      s.pendingBattle.syncedSeconds === undefined ||
      (Number.isSafeInteger(s.pendingBattle.syncedSeconds) && s.pendingBattle.syncedSeconds >= 0),
    'El reloj del despliegue es inválido.',
  );
  requireThat(
    Number.isInteger(s.secondOfHour ?? 0) &&
      (s.secondOfHour ?? 0) >= 0 &&
      (s.secondOfHour ?? 0) < 3600,
    'El reloj guardado es inválido.',
  );
  requireThat(
    s.deferredRaids === undefined ||
      (Array.isArray(s.deferredRaids) &&
        s.deferredRaids.length <= 1000 &&
        s.deferredRaids.every(
          (r) =>
            object(r) && Object.hasOwn(enemyGroupLegHoursFor(s), r.theater) && sector(r.target, s),
        )),
    'Las incursiones pendientes son inválidas.',
  );
  initializeCampaignSystems(s);
  validateServiceEquipmentReturns(s, rosterFor(s));
  scenarioFor(s).validateDailyState(s);
  validateAssignments(s, rosterFor(s));
  validateAssignmentAttention(s, rosterFor(s));
  validateLogisticsNotice(s);
  if (s.pendingBattle) validateArtilleryDeployment(s.pendingBattle);
  validateContractAttention(s, rosterFor(s));
  validateMorale(s, rosterFor(s));
  validateCampaignCompanionGrief(s, rosterFor(s));
  if (s.pendingBattle?.resumeSnapshot)
    validateCompanionGriefContext(s, s.pendingBattle.resumeSnapshot, rosterFor(s));
  validateEquipment(s, rosterFor(s));
  validateEnemyGroups(s, rosterFor(s));
  validateCampaignAmmunition(s, rosterFor(s));
  validateCampaignWeather(s);
  validateDeploymentReturnState(s);
  requireThat(
    s.economyVersion === 2 && Object.keys(s.resources).length === 1,
    'La economía guardada es inválida.',
  );
  if (migrateCampaignCivilians(s)) synchronizeCampaignPresence(s);
  migrateCampaignCivilianSupplies(s);
  validateCampaignCivilians(s);
  validateQuestFailures(s);
  if (resumeCivilianServiceReturns(s)) validateCampaignCivilians(s);
  validateCampaignPresence(s);
  if (migrateResidentWounds(s)) validateCampaignCivilians(s);
  validateDialogueMovements(s, encounterDefinitions(s));
  validateCampaignServiceObjections(s, rosterFor(s));
  if (s.pendingBattle?.resumeSnapshot)
    validateServiceObjectionContext(s, s.pendingBattle.resumeSnapshot, rosterFor(s));
  scenarioFor(s).validateHistoricalState(s);
  validatePendingCompanionLoss(s, rosterFor(s));
  requireThat(
    s.recruitmentVersion === undefined || s.recruitmentVersion === 2,
    'La versión de reclutamiento no es compatible.',
  );
  receiveDueHires(s);
  synchronizeSquad(s);
  synchronizeCampaignPresence(s);
  validateCampaignPresence(s);
  syncCampaignAmmunition(s, rosterFor(s));
  validateCampaignAmmunition(s, rosterFor(s));
  validateHireArrivals(s, rosterFor(s));
  validateServiceGuarantees(s, rosterFor(s));
  s.lastError = null;
  return removeIgnitionSupplies(s);
}
