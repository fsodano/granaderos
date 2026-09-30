import {validatePrisonerEscape} from './prisoner-escape.js';
import {validatePrisonerRelease} from './prisoner-release.js';
import {captureSequence,detentionId} from './capture-identity.js';
import {CAMPAIGN_SECTORS} from './data.js';
import {seedCivilianHealth,validateCivilianHealth} from './civilian-health.js';
import {propBlocksAt} from './props.js';
import {spaceKey,tacticalLevel} from './tactical-space.js';

// Prison scenes receive identities and wounds, never another copy of the
// weapons, ammunition or inventory already held in campaign custody.
export function detentionManifest(campaign,roster,sector){
 return roster.flatMap(op=>{
  const r=campaign.operativeState[op.id];
  if(!r?.captured||!r.alive||r.capturedSector!==sector)return [];
  const retained=campaign.detentionRecords?.[detentionId(op.id,r)]?.npc;
  if(retained)return [structuredClone(retained)];
  return [seedCivilianHealth({id:detentionId(op.id,r),name:op.name,portraitId:op.portraitId??op.id,
   detention:{operativeId:op.id,capturedAt:r.capturedAt,sector,freed:false,...(captureSequence(r)>1?{captureSequence:captureSequence(r)}:{})}}, {...r,maxHp:r.maxHp??op.maxHp})];
 }).concat(Object.values(campaign.detentionRecords??{}).filter(entry=>entry.npc.hp===0&&entry.npc.detention.sector===sector).map(entry=>structuredClone(entry.npc)));
}
export function validateDetainedPrisoner(npc){
 validatePrisonerEscape(npc);
 if(npc.detention===undefined){if(npc.detentionRelease!==undefined||npc.detentionOrders!==undefined)throw Error('La liberación no tiene prisionero.');return;}
 const d=npc.detention;
 if(!d||typeof d!=='object'||Array.isArray(d)||Object.keys(d).length!==(d.captureSequence===undefined?4:5)||(d.captureSequence!==undefined&&(!Number.isInteger(d.captureSequence)||d.captureSequence<2||d.captureSequence>1e9))||!Number.isInteger(d.operativeId)||d.operativeId<0||!Number.isInteger(d.capturedAt)||d.capturedAt<0||!CAMPAIGN_SECTORS.some(s=>s.id===d.sector)||typeof d.freed!=='boolean'||npc.id!==detentionId(d.operativeId,d))throw Error('La identidad del prisionero es inválida.');
 validateCivilianHealth(npc);validatePrisonerRelease(npc);
 if(['weapon','blade','ammo','loaded','inventory','medkits','rations','priming','flints','equipmentCursor','questGifts'].some(key=>npc[key]!==undefined))throw Error('El prisionero no puede duplicar el equipo en custodia.');
}
export function placeDetainedPrisoners(battle,manifest){
 const result=structuredClone(battle),occupied=new Set([...result.units.filter(u=>u.hp>0&&!u.departure),...result.npcs].map(spaceKey));
 const enemies=result.units.filter(u=>u.side==='enemy'&&u.hp>0&&!u.departure);
 const candidates=result.tiles.filter(t=>!t.blocked&&t.x>0&&t.y>0&&t.x<result.width-1&&t.y<result.height-1&&tacticalLevel(t)===0&&!occupied.has(spaceKey(t))&&!propBlocksAt(result,t.x,t.y));
 const guardDistance=t=>enemies.length?Math.min(...enemies.map(u=>Math.abs(u.x-t.x)+Math.abs(u.y-t.y))):Math.abs(t.x-result.width/2)+Math.abs(t.y-result.height/2);
 candidates.sort((a,b)=>Number(Boolean(b.roomId))-Number(Boolean(a.roomId))||guardDistance(a)-guardDistance(b)||a.y-b.y||a.x-b.x);
 const ids=new Set(result.npcs.map(n=>n.id));
 for(const prisoner of manifest){
  validateDetainedPrisoner(prisoner);
  if(!prisoner.detention||prisoner.detention.freed&&prisoner.hp>0||ids.has(prisoner.id))throw Error('El despliegue de prisioneros está duplicado o no corresponde al cautiverio.');
  const retained=candidates.findIndex(t=>t.x===prisoner.x&&t.y===prisoner.y);
  const point=candidates.splice(retained>=0?retained:0,1)[0];if(!point)throw Error('No queda espacio para situar a los prisioneros.');
  ids.add(prisoner.id);result.npcs.push({...structuredClone(prisoner),x:point.x,y:point.y,tacticalLevel:0,stance:prisoner.hp===0||prisoner.unconscious?'prone':'standing',movementMode:prisoner.hp===0||prisoner.unconscious?'prone':'walk'});
 }
 return result;
}
