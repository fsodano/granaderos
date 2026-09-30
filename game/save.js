import {validateCampaignArtilleryProfiles,artillerySaveReplacer,restoreArtilleryReferences} from './artillery-definitions.js';
import {validateArtilleryReport} from './campaign-artillery.js';
import {validateCampaignPatrol} from './militia-patrol-rules.js';
import {validateMovementScene} from './dialogue-movement.js';
import {validateCivilianScene,migrateActiveCivilians} from './campaign-civilians.js';
import {validatePresenceScene,synchronizeCampaignPresence,validateActiveSuccessionDeaths} from './campaign-presence.js';
import {validateAbilityReferences} from './content-character-abilities.js';
import {validatePresentationReferences} from './content-character-presentation.js';
import {validateWeaponReferences,weaponSaveReplacer,restoreWeaponReferences} from './weapon-definition.js';
import {validateBattleSnapshot} from './validate-battle.js';
import {restoreCampaignValue,rosterFor,hasPendingNpcGiftProgress} from './campaign.js';
import {worldCell} from './world-cells.js';
import {expandCellScene,cellSceneSaveReplacer} from './cell-scene-storage.js';
import {compactSaveTerrain,expandSaveTerrain,MAX_EXPANDED_SAVE_BYTES} from './save-terrain.js';
import {validateQuestEscortOrders} from './quest-escort.js';
import {validateSectorDeployment} from './sector-deployment.js';
import {assertSaveSize,saveByteLength} from './save-limits.js';
import {validateEquipmentOwnership} from './equipment.js';
import {FITTING_RULES_VERSION} from './weapon-fittings.js';
export const SAVE_KEY='granaderos.campaign.v1';
export function encodeSave(campaign,battle=null){
 const replacer=cellSceneSaveReplacer(artillerySaveReplacer(campaign,weaponSaveReplacer(campaign)));
 const text=JSON.stringify({format:'granaderos',schema:1,savedAt:new Date().toISOString(),campaign,battle},replacer),bytes=saveByteLength(text);
 if(bytes<1_000_000)return assertSaveSize(text);
 if(bytes>MAX_EXPANDED_SAVE_BYTES)throw Error('La partida expandida supera el límite de 20 MB.');
 const value=JSON.parse(text);if(compactSaveTerrain(value))value.schema=2;
 return assertSaveSize(JSON.stringify(value));
}
export function decodeSave(text){
  assertSaveSize(text);
  let value;try{value=JSON.parse(text);}catch{throw Error('El archivo no contiene una partida válida.');}
  if(value?.format!=='granaderos'||![1,2].includes(value.schema))throw Error('Esta versión de la partida no es compatible.');
  if(value.schema===2)expandSaveTerrain(value);
  const legacyCivilians=value.campaign?.civilianState===undefined;
  const campaign=restoreCampaignValue(structuredClone(value.campaign));const b=expandCellScene(value.battle);
  if(Boolean(campaign.pendingBattle)!==Boolean(b))throw Error('La batalla guardada no coincide con la campaña.');
  if(b){restoreWeaponReferences(campaign,b);restoreArtilleryReferences(campaign,b);}
  if(b&&value.campaign.fittingRulesVersion===FITTING_RULES_VERSION&&b.fittingRulesVersion!==FITTING_RULES_VERSION)throw Error('Las reglas de accesorios no corresponden al despliegue guardado.');
  if(b&&value.campaign.ammunitionVersion!==undefined&&value.campaign.ammunitionVersion!==b.ammunitionVersion)throw Error('Las reglas de munición no corresponden al despliegue guardado.');
  let battle=b?validateBattleSnapshot(b):null;if(battle){battle.startSeconds??=campaign.hour*3600+(campaign.secondOfHour??0);battle.elapsedSeconds??=0;battle.syncedSeconds??=0;}
  if(battle&&((battle.sceneId??null)!==(campaign.pendingBattle.sceneId??null)||(battle.syncedSeconds??0)!==(campaign.pendingBattle.syncedSeconds??0)||(battle.elapsedSeconds??0)!==(battle.syncedSeconds??0)))throw Error('El reloj táctico guardado no coincide con la campaña.');
  if(battle&&campaign.pendingBattle.hour!==undefined&&battle.startSeconds!==campaign.pendingBattle.hour*3600+(campaign.pendingBattle.secondOfHour??0))throw Error('La hora inicial del combate no coincide con el despliegue.');
  if(battle&&battle.battleId!=null&&battle.battleId!==campaign.pendingBattle.id)throw Error('El reloj pertenece a otro despliegue.');
  if(battle&&(battle.sectorId!==campaign.pendingBattle.sector||!campaign.pendingBattle.squad.every(u=>battle.units.some(t=>t.side==='player'&&String(t.id)===String(u.id)))))throw Error('El destacamento guardado no corresponde al sector.');
  if(battle&&worldCell(battle.sectorId)?.anchor===false&&battle.sourceMapId!==battle.sectorId)throw Error('La escena guardada no corresponde a la celda.');
  if(battle){validateArtilleryReport(campaign.pendingBattle,battle);validateCampaignPatrol(campaign,battle);validateCampaignArtilleryProfiles(campaign,battle);migrateActiveCivilians(campaign,battle,{legacy:legacyCivilians});if(legacyCivilians)synchronizeCampaignPresence(campaign);validateCivilianScene(campaign,battle,{active:true});validatePresenceScene(campaign,battle);validateMovementScene(campaign,battle);validateActiveSuccessionDeaths(campaign,battle);validateWeaponReferences(campaign,battle);validatePresentationReferences(campaign,battle);validateAbilityReferences(campaign,battle);}
  // Older validated tactical saves did not carry a deployment identifier.
  // Bind them only after the sector and participant checks above succeed.
  if(battle&&battle.battleId==null)battle.battleId=campaign.pendingBattle.id;
  // Old saves gain authorized routes, never an inferred departure. The full
  // participant record remains present after a partial physical exit.
  if(battle&&b.exits===undefined){battle.exits=structuredClone(campaign.pendingBattle.exits);battle.exitRulesVersion=1;}
  if(battle&&JSON.stringify(battle.exits)!==JSON.stringify(campaign.pendingBattle.exits))throw Error('Las salidas guardadas no corresponden al despliegue.');
  if(battle)validateSectorDeployment(battle,campaign.pendingBattle);
  // A new receipt may still await its campaign reply. An acknowledged receipt
  // must remain physically present with its recipient in this deployment.
  if(battle)validateQuestEscortOrders(campaign,battle);
  if(battle)hasPendingNpcGiftProgress(campaign,battle);
  validateEquipmentOwnership(campaign,rosterFor(campaign),battle);
  return {campaign,battle};
}
