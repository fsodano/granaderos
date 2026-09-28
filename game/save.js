import {validateArtilleryReport} from './campaign-artillery.js';
import {validateCampaignPatrol} from './militia-patrol-rules.js';
import {validateMovementScene} from './dialogue-movement.js';
import {validateCivilianScene,migrateActiveCivilians} from './campaign-civilians.js';
import {validatePresenceScene,synchronizeCampaignPresence,validateActiveSuccessionDeaths} from './campaign-presence.js';
import {validateAbilityReferences} from './content-character-abilities.js';
import {validatePresentationReferences} from './content-character-presentation.js';
import {validateWeaponReferences,weaponSaveReplacer,restoreWeaponReferences} from './weapon-definition.js';
import {validateBattleSnapshot} from './validate-battle.js';
import {restoreCampaign} from './campaign.js';
import {worldCell} from './world-cells.js';
import {expandCellScene,cellSceneSaveReplacer} from './cell-scene-storage.js';
export const SAVE_KEY='granaderos.campaign.v1';
export function encodeSave(campaign,battle=null){return JSON.stringify({format:'granaderos',schema:1,savedAt:new Date().toISOString(),campaign,battle},cellSceneSaveReplacer(weaponSaveReplacer(campaign)));}
export function decodeSave(text){
  if(typeof text!=='string'||text.length>5000000)throw Error('El archivo de campaña es demasiado grande.');
  let value;try{value=JSON.parse(text);}catch{throw Error('El archivo no contiene una partida válida.');}
  if(value?.format!=='granaderos'||value.schema!==1)throw Error('Esta versión de la partida no es compatible.');
  const legacyCivilians=value.campaign.civilianState===undefined;
  const campaign=restoreCampaign(JSON.stringify(value.campaign));const b=expandCellScene(value.battle);
  if(Boolean(campaign.pendingBattle)!==Boolean(b))throw Error('La batalla guardada no coincide con la campaña.');
  if(b)restoreWeaponReferences(campaign,b);
  let battle=b?validateBattleSnapshot(b):null;if(battle){battle.startSeconds??=campaign.hour*3600+(campaign.secondOfHour??0);battle.elapsedSeconds??=0;battle.syncedSeconds??=0;}
  if(battle&&((battle.sceneId??null)!==(campaign.pendingBattle.sceneId??null)||(battle.syncedSeconds??0)!==(campaign.pendingBattle.syncedSeconds??0)||(battle.elapsedSeconds??0)!==(battle.syncedSeconds??0)))throw Error('El reloj táctico guardado no coincide con la campaña.');
  if(battle&&battle.battleId&&battle.battleId!==campaign.pendingBattle.id)throw Error('El reloj pertenece a otro despliegue.');
  if(battle&&(battle.sectorId!==campaign.pendingBattle.sector||!campaign.pendingBattle.squad.every(u=>battle.units.some(t=>t.side==='player'&&String(t.id)===String(u.id)))))throw Error('El destacamento guardado no corresponde al sector.');
  if(battle&&worldCell(battle.sectorId)?.anchor===false&&battle.sourceMapId!==battle.sectorId)throw Error('La escena guardada no corresponde a la celda.');
  if(battle){validateArtilleryReport(campaign.pendingBattle,battle);validateCampaignPatrol(campaign,battle);migrateActiveCivilians(campaign,battle,{legacy:legacyCivilians});if(legacyCivilians)synchronizeCampaignPresence(campaign);validateCivilianScene(campaign,battle,{active:true});validatePresenceScene(campaign,battle);validateMovementScene(campaign,battle);validateActiveSuccessionDeaths(campaign,battle);validateWeaponReferences(campaign,battle);validatePresentationReferences(campaign,battle);validateAbilityReferences(campaign,battle);}
  return {campaign,battle};
}
