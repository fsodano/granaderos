import {WEAPONS,BLADES,ARTILLERY} from './tactical.js';
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
    const bounded=(n,lo,hi)=>finite(n)&&n>=lo&&n<=hi;
    const validWeapon=w=>Number.isInteger(w)&&Boolean(WEAPONS[w]||BLADES[w]);
    if(b.units.some(u=>typeof u.id!=='string'||!validWeapon(u.weapon)||u.blade!==undefined&&!BLADES[u.blade]||!bounded(u.morale,0,100)||!bounded(u.condition,0,100)||!bounded(u.marksmanship,0,100)||!bounded(u.agility,0,100)||!bounded(u.strength,0,100)||!bounded(u.medical,0,100)||!bounded(u.bleeding,0,100)||!Number.isInteger(u.ammo)||!Number.isInteger(u.loaded)||u.loaded>(WEAPONS[u.weapon]?.capacity??0)||!['standing','prone'].includes(u.stance)||u.activeSlot!==undefined&&!['primary','blade'].includes(u.activeSlot)))throw Error('El armamento o los atributos de la partida están dañados.');
    if(b.units.some(u=>Object.entries({priming:100000,flints:100000,rations:100000,torches:100000,boleadoras:100000,fatigue:100}).some(([k,limit])=>u[k]!==undefined&&(!Number.isInteger(u[k])||!bounded(u[k],0,limit)))))throw Error('Los suministros de campaña están dañados.');
    if(b.tiles.some(t=>typeof t.blocked!=='boolean'||!bounded(t.cover,0,100)||!['wall','grass','road','water','stone','mud','forest','scrub'].includes(t.type))||b.smoke.some(v=>!v||!coords(v)||!bounded(v.radius,0,20)||!Number.isInteger(v.turns)||v.turns<1||v.turns>20)||b.log.some(line=>typeof line!=='string')||b.log.length>1000)throw Error('El terreno o el diario de combate están dañados.');
    if(b.artillery!==undefined&&(!Array.isArray(b.artillery)||b.artillery.some(g=>!g||!coords(g)||!ARTILLERY[g.type]||typeof g.id!=='string'||!['player','enemy'].includes(g.side)||typeof g.loaded!=='boolean'||!Number.isInteger(g.ammo)||g.ammo<0||g.facing!==undefined&&!finite(g.facing))))throw Error('Los datos de artillería están dañados.');
    if(b.units.some(u=>['knockedDown','weaponDropped','fled','braced'].some(k=>u[k]!==undefined&&typeof u[k]!=='boolean'))||b.droppedWeapons!==undefined&&(!Array.isArray(b.droppedWeapons)||b.droppedWeapons.some(d=>!d||!coords(d)||!validWeapon(d.weapon)||!bounded(d.condition,0,100))))throw Error('Los estados de combate guardados son inválidos.');
    if(b.decor!==undefined&&(!Array.isArray(b.decor)||b.decor.some(d=>!d||!coords(d)||!Number.isInteger(d.width)||!Number.isInteger(d.height)||d.width<1||d.height<1||d.x+d.width>b.width||d.y+d.height>b.height||typeof d.type!=='string')))throw Error('Los edificios de la partida están dañados.');
    if(b.sectorId!==campaign.pendingBattle.sector||!campaign.pendingBattle.squad.every(u=>b.units.some(t=>t.side==='player'&&String(t.id)===String(u.id))))throw Error('El destacamento guardado no corresponde a la batalla.');
  }
  return {campaign,battle:b};
}
