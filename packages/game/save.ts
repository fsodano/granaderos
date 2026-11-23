import type { CampaignSnapshot } from './public/campaign-types.ts';
import type { BattleSnapshot } from './public/compatibility-types.ts';
import type { GameSnapshot, GameSnapshotContent } from './public/game-snapshot-types.ts';
import { isJsonObject, parseJsonObject } from '../campaign-format/json-value.ts';
import { validateSuspendedSectorSessions } from './infrastructure/session/validate-suspended-sector-sessions.js';
import {
  refreshResidentPositions,
  validateResidentPositionContext,
} from './infrastructure/world/campaign-resident-positions.js';
import {
  gameSaveMetadata,
  validateGameSaveMetadata,
} from './infrastructure/persistence/game-save-metadata.js';
import { removedSectorCharacters } from './military-remains.js';
import {
  validateCampaignArtilleryProfiles,
  artillerySaveReplacer,
  restoreArtilleryReferences,
} from './artillery-definitions.ts';
import { validateArtilleryReport } from './campaign-artillery.js';
import { validateCampaignPatrol } from './militia-patrol-rules.js';
import { validateMovementScene } from './dialogue-movement.js';
import { validateCivilianScene, migrateActiveCivilians } from './campaign-civilians.js';
import {
  validatePresenceScene,
  synchronizeCampaignPresence,
  validateActiveSuccessionDeaths,
} from './campaign-presence.js';
import { validateAbilityReferences } from './content-character-abilities.js';
import { restoreGenericCharacterReferences } from './content-character-abilities.js';
import { validatePresentationReferences } from './content-character-presentation.ts';
import {
  validateWeaponReferences,
  weaponSaveReplacer,
  restoreWeaponReferences,
} from './weapon-definition.ts';
import { validateBattleSnapshot } from './validate-battle.js';
import { restoreCampaignValue, rosterFor, hasPendingNpcGiftProgress } from './campaign.js';
import { worldCell } from './world-cells.ts';
import { validateRegionalWeather } from './regional-weather.js';
import { validateFiniteArsenalScene } from './finite-artillery-arsenals.js';
import { validateCampaignSceneDefinitions } from './campaign-scene-definitions.js';
import { expandCellScene, cellSceneSaveReplacer } from './cell-scene-storage.js';
import { compactSaveTerrain, expandSaveTerrain, MAX_EXPANDED_SAVE_BYTES } from './save-terrain.js';
import { validateQuestEscortOrders } from './quest-escort.js';
import { validateSectorDeployment } from './sector-deployment.js';
import { assertSaveSize, saveByteLength } from './save-limits.js';
import { validateEquipmentOwnership } from './equipment.js';
import { FITTING_RULES_VERSION } from './weapon-fittings.js';
import { validateCompanionGriefContext } from './companion-grief.js';
import { validateServiceObjectionContext } from './service-objections.js';
import { validateRoadsideDiscoveryContext } from './roadside-discoveries.js';
import { validateQuestBeneficiaryContext } from './quest-beneficiaries.js';
import { validateRepairReserveContext, retainRepairReserves } from './repair-materials.js';
import { campaignPackageSaveReplacer } from './campaign-package-storage.js';
export const SAVE_KEY = 'granaderos.campaign.v1';
export function encodeSave(
  campaign: CampaignSnapshot,
  battle: BattleSnapshot | null = null,
): string {
  const replacer = campaignPackageSaveReplacer(
    campaign,
    cellSceneSaveReplacer(artillerySaveReplacer(campaign, weaponSaveReplacer(campaign)), campaign),
  );
  const mapping = gameSaveMetadata(campaign);
  const snapshot: GameSnapshot = {
    format: 'granaderos',
    schema: 1,
    savedAt: new Date().toISOString(),
    ...(mapping === undefined ? {} : { mapping }),
    campaign,
    sectorSession: battle,
  };
  const text = JSON.stringify(snapshot, replacer),
    bytes = saveByteLength(text);
  if (bytes < 1_000_000) {
    return assertSaveSize(text);
  }
  if (bytes > MAX_EXPANDED_SAVE_BYTES) {
    throw Error('La partida expandida supera el límite de 20 MB.');
  }
  const value = parseJsonObject(text);
  if (compactSaveTerrain(value)) {
    value['schema'] = 2;
  }
  return assertSaveSize(JSON.stringify(value));
}
export function decodeSave(text: string): GameSnapshotContent {
  return decodeGameSave(text, true);
}
function decodeGameSave(text: string, validateOpenVisits: boolean): GameSnapshotContent {
  assertSaveSize(text);
  let value;
  try {
    value = parseJsonObject(text);
  } catch {
    throw Error('El archivo no contiene una partida válida.');
  }
  if (
    value['format'] !== 'granaderos' ||
    (value['schema'] !== 1 && value['schema'] !== 2) ||
    !isJsonObject(value['campaign'])
  ) {
    throw Error('Esta versión de la partida no es compatible.');
  }
  const savedCampaign = value['campaign'];
  // Saves written before the character table took its canonical name still
  // carry it under `operativeState`. Read that key once, then write only the
  // new one.
  if (savedCampaign['characters'] === undefined && savedCampaign['operativeState'] !== undefined) {
    savedCampaign['characters'] = savedCampaign['operativeState'];
  }
  delete savedCampaign['operativeState'];
  // Saves written before the serving list took its canonical name still carry
  // it under `recruited`. Read that key once, then write only the new one.
  if (savedCampaign['forceRoster'] === undefined && savedCampaign['recruited'] !== undefined) {
    savedCampaign['forceRoster'] = savedCampaign['recruited'];
  }
  delete savedCampaign['recruited'];
  // Saves written before the retained world maps took their canonical names
  // still carry them under `sectorStates` and `sceneStates`. Read those keys
  // once, then write only the new ones.
  if (
    savedCampaign['sectorSnapshots'] === undefined &&
    savedCampaign['sectorStates'] !== undefined
  ) {
    savedCampaign['sectorSnapshots'] = savedCampaign['sectorStates'];
  }
  delete savedCampaign['sectorStates'];
  if (savedCampaign['sceneSnapshots'] === undefined && savedCampaign['sceneStates'] !== undefined) {
    savedCampaign['sceneSnapshots'] = savedCampaign['sceneStates'];
  }
  delete savedCampaign['sceneStates'];
  validateGameSaveMetadata(value['mapping'], savedCampaign);
  // Saves written before the request took its canonical name still carry it
  // under `pendingBattle`. Read that key once, then write only the new one.
  if (
    savedCampaign['sectorEntryRequest'] === undefined &&
    savedCampaign['pendingBattle'] !== undefined
  ) {
    savedCampaign['sectorEntryRequest'] = savedCampaign['pendingBattle'];
  }
  delete savedCampaign['pendingBattle'];
  if (value['schema'] === 2) {
    expandSaveTerrain(value);
  }
  const legacyCivilians = value['campaign']['civilianState'] === undefined;
  const campaign = restoreCampaignValue(structuredClone(value['campaign']));
  const savedSectorView =
    value['sectorSession'] !== undefined ? value['sectorSession'] : value['battle'];
  const b = expandCellScene(savedSectorView, campaign);
  if (b !== null && b !== undefined && !isJsonObject(b)) {
    throw Error('La batalla guardada no es válida.');
  }
  if (Boolean(campaign.sectorEntryRequest) !== Boolean(b)) {
    throw Error('La batalla guardada no coincide con la campaña.');
  }
  if (b) {
    restoreWeaponReferences(campaign, b);
    restoreArtilleryReferences(campaign, b);
    restoreGenericCharacterReferences(campaign, b);
  }
  if (
    b &&
    value['campaign']['fittingRulesVersion'] === FITTING_RULES_VERSION &&
    b['fittingRulesVersion'] !== FITTING_RULES_VERSION
  ) {
    throw Error('Las reglas de accesorios no corresponden al despliegue guardado.');
  }
  if (
    b &&
    value['campaign']['ammunitionVersion'] !== undefined &&
    value['campaign']['ammunitionVersion'] !== b['ammunitionVersion']
  ) {
    throw Error('Las reglas de munición no corresponden al despliegue guardado.');
  }
  if (b && (b['exits'] === undefined) !== (b['exitRulesVersion'] === undefined)) {
    throw Error('Las reglas de salida guardadas están incompletas.');
  }
  if (b) {
    validateRegionalWeather(b, campaign);
  }
  // Retain the validated clone, including one-time legacy cannon clearance.
  // Never rebuild an active save: its paid AP, clock and gun custody persist.
  const battle = b ? validateBattleSnapshot(b, campaign) : null;
  const sectorEntryRequest = campaign.sectorEntryRequest;
  if (battle && !sectorEntryRequest) {
    throw Error('El despliegue guardado no corresponde al combate.');
  }
  if (battle) {
    validateResidentPositionContext(campaign, battle, { allowLegacyOmission: true });
    refreshResidentPositions(campaign, battle);
  }
  if (battle) {
    battle.startSeconds ??= campaign.hour * 3600 + (campaign.secondOfHour ?? 0);
    battle.elapsedSeconds ??= 0;
    battle.syncedSeconds ??= 0;
  }
  if (
    battle &&
    sectorEntryRequest &&
    ((battle.sceneId ?? null) !== (sectorEntryRequest.sceneId ?? null) ||
      (battle.syncedSeconds ?? 0) !== (sectorEntryRequest.syncedSeconds ?? 0) ||
      (battle.elapsedSeconds ?? 0) !== (battle.syncedSeconds ?? 0))
  ) {
    throw Error('El reloj táctico guardado no coincide con la campaña.');
  }
  if (
    battle &&
    sectorEntryRequest &&
    sectorEntryRequest.hour !== undefined &&
    battle.startSeconds !== sectorEntryRequest.hour * 3600 + (sectorEntryRequest.secondOfHour ?? 0)
  ) {
    throw Error('La hora inicial del combate no coincide con el despliegue.');
  }
  if (
    battle &&
    sectorEntryRequest &&
    battle.battleId != null &&
    battle.battleId !== sectorEntryRequest.id
  ) {
    throw Error('El reloj pertenece a otro despliegue.');
  }
  if (
    battle &&
    sectorEntryRequest &&
    (battle.sectorId !== sectorEntryRequest.sector ||
      !sectorEntryRequest.squad.every((u) =>
        [...battle.units, ...removedSectorCharacters(battle)].some(
          (t) => t.side === 'player' && String(t.id) === String(u.id),
        ),
      ))
  ) {
    throw Error('El destacamento guardado no corresponde al sector.');
  }
  if (
    battle &&
    sectorEntryRequest &&
    worldCell(battle.sectorId, campaign)?.anchor === false &&
    battle.sourceMapId !== battle.sectorId
  ) {
    throw Error('La escena guardada no corresponde a la celda.');
  }
  if (battle) {
    validateFiniteArsenalScene(battle, campaign);
  }
  if (battle) {
    validateCampaignSceneDefinitions(campaign, battle);
  }
  if (battle && sectorEntryRequest) {
    validateArtilleryReport(campaign.sectorEntryRequest, battle);
    validateCampaignPatrol(campaign, battle);
    validateCampaignArtilleryProfiles(campaign, battle);
    migrateActiveCivilians(campaign, battle, { legacy: legacyCivilians });
    if (legacyCivilians) {
      synchronizeCampaignPresence(campaign);
    }
    validateCivilianScene(campaign, battle, { active: true });
    validatePresenceScene(campaign, battle);
    validateMovementScene(campaign, battle);
    validateActiveSuccessionDeaths(campaign, battle);
    validateWeaponReferences(campaign, battle);
    validatePresentationReferences(campaign, battle);
    validateAbilityReferences(campaign, battle);
  }
  // Older validated tactical saves did not carry a deployment identifier.
  // Bind them only after the sector and participant checks above succeed.
  if (battle && sectorEntryRequest && battle.battleId == null) {
    battle.battleId = sectorEntryRequest.id;
  }
  // Old saves gain authorized routes, never an inferred departure. The full
  // participant record remains present after a partial physical exit.
  if (battle && sectorEntryRequest && isJsonObject(b) && b['exits'] === undefined) {
    if (!sectorEntryRequest.exits) {
      throw Error('El despliegue no tiene salidas guardadas.');
    }
    battle.exits = structuredClone(sectorEntryRequest.exits);
    battle.exitRulesVersion = 1;
  }
  if (
    battle &&
    sectorEntryRequest &&
    JSON.stringify(battle.exits) !== JSON.stringify(sectorEntryRequest.exits)
  ) {
    throw Error('Las salidas guardadas no corresponden al despliegue.');
  }
  if (battle) {
    validateSectorDeployment(battle, campaign.sectorEntryRequest);
  }
  if (battle) {
    validateRepairReserveContext(campaign.sectorEntryRequest, battle);
  }
  if (battle) {
    validateRoadsideDiscoveryContext(campaign, battle);
  }
  if (battle) {
    validateCompanionGriefContext(campaign, battle, rosterFor(campaign));
  }
  if (battle) {
    validateServiceObjectionContext(campaign, battle, rosterFor(campaign));
  }
  // A new receipt may still await its campaign reply. An acknowledged receipt
  // must remain physically present with its recipient in this deployment.
  if (battle) {
    validateQuestEscortOrders(campaign, battle);
  }
  if (battle) {
    validateQuestBeneficiaryContext(campaign, battle);
  }
  if (battle) {
    hasPendingNpcGiftProgress(campaign, battle);
  }
  validateEquipmentOwnership(campaign, rosterFor(campaign), battle);
  if (battle) {
    retainRepairReserves(campaign.sectorEntryRequest, battle);
  }
  if (validateOpenVisits) {
    validateSuspendedSectorSessions(
      campaign,
      battle,
      (view: CampaignSnapshot, snapshot: BattleSnapshot) =>
        decodeGameSave(encodeSave(view, snapshot), false),
    );
  }
  return { campaign, battle };
}
