export { formatAP } from '../action-points.js';
export {
  ACTOR_ACTION_CAPABILITIES,
  resolveActorAction,
  selectActorClipVariant,
} from '../actor-action-contract.ts';
export { aimedBodyPart, rightClickAim, targetHitFrame } from '../aim-cursor.js';
export {
  AMMO_KEYS,
  AMMO_TYPES,
  ammoTypeFor,
  ammunitionChoiceReason,
  ammunitionForWeapon,
  ammunitionLoadsFor,
} from '../ammo-types.js';
export { artilleryProfile } from '../artillery-definitions.ts';
export { depotSelection, localArtilleryDepot } from '../artillery-depots.ts';
export { artillerySupplyQuote } from '../artillery-supply.js';
export { artilleryTradingRules } from '../artillery-trading-rules.js';
export {
  artilleryBuyingRate,
  artilleryMerchant,
  artilleryRepurchaseQuote,
  artillerySaleOffers,
  artillerySaleQuote,
} from '../artillery-trading.js';
export {
  artilleryStorageQuote,
  artilleryTransferDelay,
  artilleryTransportQuote,
} from '../artillery-transport.js';
export { assignmentAttentionText, publicAssignmentNotice } from '../assignment-attention.js';
export {
  repairEquipmentQueue,
  STUDY_SKILLS,
  WORK_ASSIGNMENTS,
  workAssignmentReason,
  workStatus,
} from '../assignments.js';
export { autoBandageBattle, autoBandageStatus } from '../auto-bandage.js';
export { battleFromRequest, prepareCampaignBattle } from '../battle-handoff.js';
export { runBattleJob } from '../battle-job.ts';
export {
  BATTLE_PLAYBACK,
  battleFrameDuration,
  battleFrameFocus,
  battleFramePose,
  firearmFlightDuration,
} from '../battle-playback.js';
export { buildingAppearance } from '../building-appearance.ts';
export {
  entranceFrame,
  getBuildingProfile,
  getBuildingRenderProfile,
} from '../building-profile.ts';
export { BUILDING_OPENINGS, BUILDING_VERTICAL_SCALE } from '../building-scale.js';
export { BUILDING_FOOTPRINTS, BUILDING_TYPES, buildingStyle } from '../building-types.ts';
export { buildTerrace, placeBuilding } from '../buildings.js';
export {
  AMMUNITION_ORDER_LIMIT,
  ammunitionOrderQuote,
  carriedAmmunition,
  hasAmmunitionMarket,
} from '../campaign-ammunition.js';
export { stationedArtillery } from '../campaign-artillery.js';
export { isContentImageReference } from '../campaign-assets.js';
export {
  campaignCities,
  campaignDefinitions,
  campaignPresentation,
  campaignSectors,
  campaignWorld,
} from '../campaign-definition.js';
export { campaignFactionName } from '../campaign-faction-presentation.js';
export { foundryFor, foundryLocationName } from '../campaign-foundry.js';
export { campaignChapters, hasWorkshop } from '../campaign-headquarters.js';
export {
  importDelayReason,
  importOrderReason,
  importPortName,
  importRulesFor,
} from '../campaign-imports.js';
export {
  campaignRelativePath,
  compileCampaignPackage,
  validateCampaignManifest,
  validateCampaignRegistry,
} from '../campaign-library.js';
export { campaignOfficerCreation } from '../campaign-officer-creation.ts';
export {
  campaignCharacterPortrait,
  campaignCharacterPortraits,
  NEUTRAL_CHARACTER_PORTRAIT,
} from '../campaign-portraits.js';
export { campaignRole, foundryReason } from '../campaign-roles.js';
export { cartridgePrice } from '../campaign-rules.js';
export { scenarioIdFor } from '../campaign-scenario.js';
export { campaignChapterIndex, campaignStory } from '../campaign-story.js';
export {
  CAMPAIGN_SECTORS,
  campaignObjectives,
  candidateAdmission,
  dispatchCampaign,
  isSupplied,
  militiaAssignment,
  militiaCourse,
  questForNPC,
  restoreCampaignValue,
  rosterFor,
} from '../campaign.js';
export { withCharacterSpeech } from '../character-events.js';
export { characterPortrait } from '../character-portraits.js';
export { MIN_OFFICER_HEALTH, validateOfficerCreationHealth } from '../character-profile.ts';
export { ATTRIBUTE_LABELS, characterAbilityDescriptions, characterProfile } from '../characters.js';
export { getCityStatus } from '../cities.js';
export { ladderGeometry, referenceClimbFraction, sampleLadderClimb } from '../climb-geometry.ts';
export { publicCombatJournal } from '../combat-journal.js';
export { COMPANION_GRIEF_MORALE } from '../companion-grief.js';
export { compileMap } from '../compile-map.js';
export { isContractOperative } from '../content-character-ids.ts';
export { dialogueForNPC } from '../content-dialogue.js';
export {
  campaignLaunchSearch,
  campaignStorageCandidates,
  campaignStorageKey,
  CONTENT_LAUNCH_KEY,
} from '../content-launch.ts';
export { contentQuestJournal, QUEST_STATE_LABELS } from '../content-quests.js';
export { startingTerritoryDescription } from '../content-territory.js';
export { contextActionCursorModel } from '../context-action-cursor.ts';
export { publicContractNotice } from '../contract-attention.js';
export {
  contractExpiresSeconds,
  contractQuote,
  contractRenewalQuote,
  contractStatus,
  contractTermsFor,
} from '../contracts.js';
export { OPERATIVES } from '../data.js';
export { incomeSources } from '../economy.js';
export { enclosedRoomFearStatus } from '../enclosed-room-fear.js';
export { encounterDefinitions, encounterHireTerms } from '../encounters.js';
export { localDefenderIds, retreatDestinations } from '../enemy-groups.js';
export { enemyIntelligenceReports, INTELLIGENCE_LIFETIME } from '../enemy-intelligence.ts';
export { equipmentAttachmentHost } from '../equipment-cursor.js';
export {
  armoryInventory,
  armoryOptions,
  artilleryDeploymentChoices,
  artillerySelectionReason,
  equipmentCatalog,
  equipmentInventoryUsage,
  equipmentLabel,
  grenadeOffer,
  isImportedEquipment,
  merchantStatus,
  resaleBreakdown,
  USED_EQUIPMENT_LIMIT,
  usedEquipmentOffers,
} from '../equipment.js';
export { maximumEnergy } from '../fatigue.js';
export { FIELD_DRESSINGS_AP, fieldDressingsSource } from '../field-dressings.js';
export { finiteArsenalHint } from '../finite-artillery-arsenals.js';
export { militiaPromotionStatus, militiaWoundLoss } from '../garrison.js';
export { heldGrenade } from '../grenade-throw.js';
export { makeGrenadeStack } from '../grenades.ts';
export { handLayout, handsRequired } from '../hand-layout.ts';
export {
  recruitmentClaimCancellationReason,
  recruitmentSiteReason,
  recruitmentSites,
  pendingRecruitmentClaim,
} from '../recruitment-claims.js';
export { historicalLossReason } from '../historical-loss.js';
export { MATURITY_HOURS, mountForOperative } from '../horses.js';
export {
  pointerItemIntent,
  pointerMovementIntent,
  TACTICAL_KEYS,
  tacticalShortcut,
} from '../hotkeys.ts';
export { inspectEquipmentItem } from '../item-inspection.ts';
export {
  aimedCursorMode,
  aimOptions,
  attackCursorMode,
  backpackEquipAction,
  beneficiaryDeliveryNotice,
  campaignReturnModel,
  cellOccupant,
  chancePercent,
  civilianMedicalInputAction,
  equipmentSlots,
  exitModel,
  facingLabel,
  fieldState,
  firearmLoadingProgress,
  firearmMaintenanceAction,
  grenadeTargetingMode,
  grenadeThrowInputAction,
  groundLootPiles,
  groupSelectionMode,
  handSlots,
  heardNoiseModel,
  heldSupplyAction,
  interruptHover,
  inventoryHandlingModel,
  inventoryModel,
  isGroupGround,
  isMovementGround,
  knifeThrowInputAction,
  levelFor,
  lootBatchSelectionModel,
  meleePointInputAction,
  meleePointTargetingMode,
  movementAction,
  movementGroupModel,
  nearbyEnvironmentModel,
  nearbyLootOptions,
  orderAction,
  orderDescriptors,
  pickupSelection,
  pickupTargetAction,
  pointFireInputAction,
  resolvedOrderType,
  retainedAttackCursor,
  rosterCell,
  rosterCells,
  slotAction,
  stanceLabel,
  STANCES,
  tacticalInputAction,
  targetingHelp,
  targetItemAction,
  targetPreview,
  toggleMovementGroup,
  turnModel,
  unitCanAct,
  visibleHover,
} from '../ja2-hud.ts';
export { logisticsEventText, publicLogisticsNotice } from '../logistics-attention.js';
export { transportOptionsFor } from '../logistics.js';
export { BUILDING_TEMPLATES } from '../map-templates.js';
export { buildSectorMap } from '../maps.js';
export {
  ALL_ASSIGNMENTS,
  CARE_ASSIGNMENTS,
  careAssignmentBusy,
  careAssignmentReason,
  careStatus,
} from '../medical-care.js';
export { merchantExchangeOffers, merchantExchangePreview } from '../merchant-exchange.js';
export { merchantProfile } from '../merchant-preferences.ts';
export { removedSectorCharacters } from '../military-remains.js';
export {
  militiaDistributionPreview,
  militiaDistributionStatus,
  militiaTransferPreview,
} from '../militia-distribution.js';
export { militiaProgression } from '../militia-progression-rules.js';
export { MILITIA_COHORT, MILITIA_LIMIT, MILITIA_NAMES, militiaEligibility } from '../militia.js';
export { missionStatus } from '../missions.js';
export { lowMoraleRenewalStatus } from '../morale-renewal.js';
export { moraleStatus } from '../morale.js';
export { nervousIsolationStatus } from '../nervous-isolation.js';
export { NPC_ACTIVITY_LABELS } from '../npc-ai.js';
export {
  ambientReply,
  dialogueApproach,
  dialogueAvailability,
  dialogueOptions,
  dialogueReason,
  hasAuthoredDialogue,
} from '../npc-dialogue.ts';
export { BODY_SLOTS, OUTFITS, wornOutfit } from '../outfits.ts';
export { playerKnownBattle, playerKnownError, playerKnownState } from '../player-known-state.ts';
export { tradeQuote } from '../politics.js';
export { prisonerStatus } from '../prisoner-custody.js';
export { projectileEnergyJ } from '../projectile-energy.js';
export { propBlocksAt, propCells, propSize } from '../props.js';
export { questWithdrawalText } from '../quest-withdrawal.js';
export { questBeneficiaryResolutionText, questJournal, questResolutionText } from '../quests.js';
export {
  createOfficerRecord,
  defaultProfile,
  PORTRAIT_GENDERS,
  PORTRAIT_ROLES,
  PORTRAIT_SKIN_TONES,
  PROFILE_ATTRIBUTES,
  PROFILE_POINTS,
} from '../recruitment.ts';
export { regionalLandscape, terrainMaterial } from '../regional-terrain.js';
export {
  campaignSeason,
  regionalClimate,
  regionalWeatherAt,
  regionalWeatherLabel,
} from '../regional-weather.js';
export { repairMaterialPoints } from '../repair-materials.js';
export { roomDecorProfile, roomDressings } from '../room-dressing.js';
export { rosterHands } from '../roster-hands.ts';
export { MAX_SAVE_BYTES } from '../save-limits.js';
export { encodeSave } from '../save.ts';
export {
  actorInteriorReadable,
  corpseBloodShape,
  foregroundOccludesActor,
} from '../scene-readability.js';
export { createSceneTerrainCache } from '../scene-terrain.js';
export { sceneWallEdges } from '../scene-wall-edges.js';
export { sectorDeploymentModel } from '../sector-deployment.js';
export {
  knownCampaignSectorEquipment,
  sectorInventoryModel,
  sectorInventorySites,
  sectorPickupReason,
} from '../sector-inventory.js';
export {
  guaranteeDepartureReason,
  guaranteeRecord,
  pendingGuaranteeRefunds,
  serviceGuaranteeRefund,
} from '../service-guarantees.js';
export { serviceObjectionReason } from '../service-objections.js';
export {
  PREFERRED_COMPANION_MORALE,
  preferredCompanions,
  serviceRelationships,
} from '../service-relationships.js';
export { absoluteBodyHeight, relativeBodyHeight } from '../sight-geometry.js';
export { TRAINING_LABELS, trainingProgress } from '../skill-training.js';
export { applySkinPalette } from '../skin-palette.js';
export { sleepRecovery } from '../sleep-needs.js';
export { sleepOrderReason } from '../sleep.js';
export { SPRITE_APPEARANCES, spriteAppearance } from '../sprite-appearances.ts';
export { spriteEquipment } from '../sprite-equipment.js';
export { spriteOrderPose } from '../sprite-order-pose.js';
export { spriteMovementFrame, spriteRender, spriteViewport } from '../sprite-render.js';
export { SPRITE_SKIN_MASKS } from '../sprite-skin-masks.js';
export { SKIN_PALETTES, spriteSkinTone } from '../sprite-skin.js';
export { spriteAnimationFrame, spriteCondition } from '../sprite-state.js';
export {
  hasPendingArrivalDecision,
  pendingArrivalDecisions,
  squadHasHorses,
  squadTravelStatus,
} from '../squad-travel.js';
export {
  activeSquad,
  operativeInTransit,
  operativeLocation,
  squadReorganizationReason,
} from '../squads.js';
export { STRATEGIC_CLOCK_SPEEDS } from '../strategic-clock.ts';
export {
  MAP_MODES,
  MAP_TILE_SIZE,
  mapTileBounds,
  mapTileOutline,
  mapTilesForSector,
  project,
  sectorIncome,
  sectorPosition,
} from '../strategic-map.js';
export {
  strategicPresenceLabel,
  strategicSectorPresence,
  strategicTravelPresence,
} from '../strategic-presence.ts';
export { previewStrategicRoute } from '../strategic-route.js';
export {
  strategicNewSquadAssignment,
  strategicSquadAssignments,
  strategicSquadLabel,
} from '../strategic-squad-assignments.js';
export { studyForecast } from '../study-training.js';
export { directionTo } from '../tactical-awareness.js';
export { tacticalCamera } from '../tactical-camera.js';
export { contextualBanter, tacticalFeedback } from '../tactical-feedback.js';
export { tacticalGridLabel } from '../tactical-grid.js';
export {
  equipmentEndpoint,
  equipmentFingerprint,
  inventoryUsage,
  itemDescriptor,
} from '../tactical-inventory.js';
export { tacticalMinimapLabel } from '../tactical-minimap-label.js';
export {
  accessStepsFrom,
  sameCell,
  sameSurface,
  spaceKey,
  surfaceAt,
  surfaceHeight,
  surfacesAtLevel,
  tacticalLevel,
} from '../tactical-space.js';
export { buildingInViewport, pointInViewport, tacticalViewport } from '../tactical-viewport.js';
export { isInteriorVisible } from '../tactical-visibility.ts';
export {
  actBattle,
  actionCosts,
  AP_CARRY_LIMIT,
  approachCompleted,
  artilleryCosts,
  artilleryCrewPlan,
  artilleryReloadPreview,
  BLADES,
  canSee,
  climbPreview,
  containerLootPreview,
  contextualAttack,
  createBattle,
  endTurn,
  environmentTargetAt,
  equipLootPreview,
  equipmentAttachmentPreview,
  equipmentCursorPreview,
  equipmentUnloadPreview,
  fieldDressingsPreview,
  getCareComposureResult,
  getGrenadeThrowVisual,
  getKnifeThrowVisual,
  getMeleeAttackResult,
  getNpcGiftResult,
  getReachable,
  hasFirearm,
  ignitionRisk,
  interruptAvailable,
  inventoryMapPreview,
  lootPreview,
  lootSearchPreview,
  mainItemPreview,
  planReadyMainHand,
  presentedActBattle,
  presentedEndTurn,
  prisonerReleasePreview,
  shotChance,
  stanceCost,
  swapHandsPreview,
  teamCanSee,
  tileIllumination,
  visibleEnemies,
  visibleRooms,
  visibleTiles,
  weaponFor,
  WEAPONS,
} from '../tactical.js';
export { canChooseShotLocation } from '../targeted-combat.js';
export { syncBattleTime, withCampaignTimeBoundary } from '../time.js';
export { incomeSummary, townIncomeSources } from '../town-income-query.ts';
export { TRANSPORT_NETWORKS } from '../transport-network.js';
export { validateBattleSnapshot } from '../validate-battle.js';
export {
  wallEdgeCells,
  wallEdgeCenter,
  wallEdgeEndpoints,
  wallEdgeId,
  wallEdgesBetween,
  wallMovementBlocked,
} from '../wall-geometry.js';
export { weaponSpecification } from '../weapon-definition.ts';
export { fittingLabel, fixedBayonetFor } from '../weapon-fittings.js';
export { workshopServiceQuote } from '../workshop-service.js';
export { campaignPlace, worldCell, worldContext, worldOwner } from '../world-cells.ts';
