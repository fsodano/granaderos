import {restoreCampaign} from './campaign.js';
export const SAVE_KEY='granaderos.campaign.v1';
export function encodeSave(campaign,battle=null){return JSON.stringify({format:'granaderos',schema:1,savedAt:new Date().toISOString(),campaign,battle});}
export function decodeSave(text){
  if(typeof text!=='string'||text.length>5000000)throw Error('El archivo de campaña es demasiado grande.');
  let value;try{value=JSON.parse(text);}catch{throw Error('El archivo no contiene una partida válida.');}
  if(value?.format!=='granaderos'||value.schema!==1)throw Error('Esta versión de la partida no es compatible.');
  const campaign=restoreCampaign(JSON.stringify(value.campaign));const b=value.battle;
  if(Boolean(campaign.pendingBattle)!==Boolean(b))throw Error('La batalla guardada no coincide con la campaña.');
  if(b){
    const finite=n=>typeof n==='number'&&Number.isFinite(n);
    if(!Number.isInteger(b.width)||b.width<4||b.width>64||!Number.isInteger(b.height)||b.height<4||b.height>64||!Array.isArray(b.tiles)||b.tiles.length!==b.width*b.height||!Array.isArray(b.units)||b.units.length>120||!Array.isArray(b.smoke)||!Array.isArray(b.log)||!['active','victory','defeat'].includes(b.status)||!Number.isInteger(b.seed)||!Number.isInteger(b.turn)||b.turn<1||!b.weather||!finite(b.weather.rain)||!finite(b.weather.humidity))throw Error('Los datos de la batalla están dañados.');
    const coords=t=>Number.isInteger(t.x)&&Number.isInteger(t.y)&&t.x>=0&&t.x<b.width&&t.y>=0&&t.y<b.height;
    if(b.tiles.some(t=>!t||!coords(t))||new Set(b.tiles.map(t=>`${t.x},${t.y}`)).size!==b.tiles.length||b.units.some(u=>!u||!coords(u)||!finite(u.hp)||u.hp<0||!finite(u.maxHp)||u.maxHp<=0||u.hp>u.maxHp||!finite(u.ap)||u.ap<0||u.ap>100||!['player','enemy'].includes(u.side)||typeof u.name!=='string'||!finite(u.loaded)||!finite(u.ammo)||u.ammo<0||u.loaded<0)||new Set(b.units.map(u=>String(u.id))).size!==b.units.length)throw Error('Las posiciones o los combatientes de la partida no son válidos.');
    if(b.sectorId!==campaign.pendingBattle.sector||!campaign.pendingBattle.squad.every(u=>b.units.some(t=>t.side==='player'&&String(t.id)===String(u.id))))throw Error('El destacamento guardado no corresponde a la batalla.');
  }
  return {campaign,battle:b};
}
