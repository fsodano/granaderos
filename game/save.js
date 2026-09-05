import {validateBattleSnapshot} from './validate-battle.js';
import {restoreCampaign} from './campaign.js';
export const SAVE_KEY='granaderos.campaign.v1';
export function encodeSave(campaign,battle=null){return JSON.stringify({format:'granaderos',schema:1,savedAt:new Date().toISOString(),campaign,battle});}
export function decodeSave(text){
  if(typeof text!=='string'||text.length>5000000)throw Error('El archivo de campaña es demasiado grande.');
  let value;try{value=JSON.parse(text);}catch{throw Error('El archivo no contiene una partida válida.');}
  if(value?.format!=='granaderos'||value.schema!==1)throw Error('Esta versión de la partida no es compatible.');
  const campaign=restoreCampaign(JSON.stringify(value.campaign));const b=value.battle;
  if(Boolean(campaign.pendingBattle)!==Boolean(b))throw Error('La batalla guardada no coincide con la campaña.');
  let battle=b?validateBattleSnapshot(b):null;
  if(battle&&(battle.sectorId!==campaign.pendingBattle.sector||!campaign.pendingBattle.squad.every(u=>battle.units.some(t=>t.side==='player'&&String(t.id)===String(u.id)))))throw Error('El destacamento guardado no corresponde al sector.');
  return {campaign,battle};
}
