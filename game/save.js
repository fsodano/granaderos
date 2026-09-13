import {validateSectorDeployment} from './sector-deployment.js';
import {validateBattleSnapshot} from './validate-battle.js';
import {restoreCampaign,rosterFor,hasPendingNpcGiftProgress} from './campaign.js';
import {assertSaveSize} from './save-limits.js';
import {validateEquipmentOwnership} from './equipment.js';
import {FITTING_RULES_VERSION} from './weapon-fittings.js';
export const SAVE_KEY='granaderos.campaign.v1';
export function encodeSave(campaign,battle=null){return assertSaveSize(JSON.stringify({format:'granaderos',schema:1,savedAt:new Date().toISOString(),campaign,battle}));}
export function decodeSave(text){
  assertSaveSize(text);
  let value;try{value=JSON.parse(text);}catch{throw Error('El archivo no contiene una partida válida.');}
  if(value?.format!=='granaderos'||value.schema!==1)throw Error('Esta versión de la partida no es compatible.');
  const campaign=restoreCampaign(JSON.stringify(value.campaign));const b=value.battle;
  if(Boolean(campaign.pendingBattle)!==Boolean(b))throw Error('La batalla guardada no coincide con la campaña.');
  if(b&&value.campaign.fittingRulesVersion===FITTING_RULES_VERSION&&b.fittingRulesVersion!==FITTING_RULES_VERSION)throw Error('Las reglas de accesorios no corresponden al despliegue guardado.');
  let battle=b?validateBattleSnapshot(b):null;if(battle){battle.startSeconds??=campaign.hour*3600+(campaign.secondOfHour??0);battle.elapsedSeconds??=0;battle.syncedSeconds??=0;}
  if(battle&&((battle.sceneId??null)!==(campaign.pendingBattle.sceneId??null)||(battle.syncedSeconds??0)!==(campaign.pendingBattle.syncedSeconds??0)||(battle.elapsedSeconds??0)!==(battle.syncedSeconds??0)))throw Error('El reloj táctico guardado no coincide con la campaña.');
  if(battle&&campaign.pendingBattle.hour!==undefined&&battle.startSeconds!==campaign.pendingBattle.hour*3600+(campaign.pendingBattle.secondOfHour??0))throw Error('La hora inicial del combate no coincide con el despliegue.');
  if(battle&&battle.battleId!=null&&battle.battleId!==campaign.pendingBattle.id)throw Error('El reloj pertenece a otro despliegue.');
  if(battle&&(battle.sectorId!==campaign.pendingBattle.sector||!campaign.pendingBattle.squad.every(u=>battle.units.some(t=>t.side==='player'&&String(t.id)===String(u.id)))))throw Error('El destacamento guardado no corresponde al sector.');
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
  if(battle)hasPendingNpcGiftProgress(campaign,battle);
  validateEquipmentOwnership(campaign,rosterFor(campaign),battle);
  return {campaign,battle};
}
