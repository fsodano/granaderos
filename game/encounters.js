import {contractQuote,CONTRACT_TERMS} from './contracts.js';
import {campaignCivilian,civilianDiedHere} from './campaign-civilians.js';
import {campaignPlace} from './world-cells.js';
import {legacyOperativeId,characterForOperative,isWorldCharacter,isContractOperative,operativeIdForCharacter} from './content-character-ids.js';
import {characterPresentInSector} from './campaign-presence.js';
import {authoredOperative} from './content-roster.js';
import {CAMPAIGN_SECTORS,OPERATIVES} from './data.js';
import {CIVIC_RECRUITS} from './recruitment.js';
const local=[
 {id:'cabral',operativeId:3,sector:'retiro',requiredLeadership:30,requiredLiberated:1,requiredSector:'retiro',greeting:'Estoy dispuesto a servir. Quiero conocer al oficial que marchará con nosotros.'},
 {id:'dorrego',operativeId:4,sector:'buenos_aires',requiredLeadership:40,requiredLiberated:1,requiredSector:'buenos_aires',greeting:'Hablemos de la campaña. La causa necesita hombres resueltos.'},
 {id:'bouchard',operativeId:6,sector:'ensenada',requiredLeadership:50,requiredLiberated:2,requiredSector:'ensenada',greeting:'La lucha también está en los puertos. Veamos si podemos servir juntos.'},
 {id:'barcala',operativeId:7,sector:'mendoza',requiredLeadership:45,requiredLiberated:3,requiredSector:'mendoza',greeting:'La disciplina exige dignidad. Quiero saber qué lugar tendrán mis hombres.'},
 {id:'quiroga',operativeId:9,sector:'cordoba',requiredLeadership:50,requiredLiberated:3,requiredSector:'cordoba',greeting:'Vengo de los pueblos del interior. Su autonomía también merece defensa.'},
 {id:'paroissien',operativeId:10,sector:'buenos_aires',requiredLeadership:35,requiredLiberated:1,requiredSector:'buenos_aires',greeting:'Puedo atender a los heridos. Antes debo conocer a quienes pondrán sus vidas en tus manos.'},
 {id:'san-martin',operativeId:57,sector:'mendoza',x:3,y:9,requiredLeadership:80,requiredLiberated:6,requiredSector:'mendoza',greeting:'La libertad requiere preparación. Cuando la fundición, la tropa y los pasos estén listos, asumiré el mando de la fuerza de campaña.'},
 {id:'guemes',operativeId:0,sector:'salta',x:3,y:5,requiredLeadership:65,requiredLiberated:4,requiredSector:'salta',greeting:'Defenderemos el norte si se respeta a sus pueblos. La alianza exige armas, caballos y autonomía para los gauchos.'},
 {id:'azurduy',operativeId:1,sector:'tucuman',x:3,y:5,requiredLeadership:60,requiredLiberated:4,requiredSector:'tucuman',greeting:'Las partidas resisten, pero faltan armas. Cuando lleguen los cincuenta mosquetes, podremos marchar juntos.'},
 {id:'beltran',operativeId:2,sector:'mendoza',requiredLeadership:60,requiredLiberated:5,requiredSector:'mendoza',greeting:'La independencia necesita fraguas tanto como sables. Mostrame que podés sostener a los hombres y abastecer los talleres.'},
 {id:'paz',operativeId:11,sector:'cordoba',requiredLeadership:50,requiredLiberated:4,requiredSector:'cordoba',greeting:'Una buena posición vale más que una marcha precipitada. Quiero conocer a quien conducirá esta fuerza.'},
 {id:'brown',operativeId:5,sector:'ensenada',requiredLeadership:65,requiredLiberated:3,requiredSector:'ensenada',greeting:'El río también es un campo de batalla. Necesitamos crédito, tripulaciones y un mando que cumpla su palabra.'},
 {id:'macacha',operativeId:8,sector:'salta',requiredLeadership:60,requiredLiberated:5,requiredSector:'salta',greeting:'Las noticias viajan por manos que merecen confianza. Mi colaboración depende del acuerdo con los defensores de Salta.'},
 {id:'sosa',operativeId:100,sector:'buenos_aires',requiredLeadership:30,requiredLiberated:1,requiredSector:'buenos_aires',greeting:'Sé cuidar caballos y usar el facón. Si el Cabildo responde por ustedes, estoy dispuesto a aprender el oficio de soldado.'},
];
const civilians={retiro:['Sargento del cuartel','La instrucción continúa en el patio. Revisá las provisiones de cada hombre antes de marchar.'],san_nicolas:['Maestra de posta','Los desembarcos amenazan las comunicaciones. Quien custodie este paso mantendrá abierto el camino del río.'],santa_fe:['Consignatario del puerto','El comercio trae recursos, pero también atrae a los corsarios. Una guarnición firme protege la recaudación.'],uspallata:['Guía de la cordillera','No suban sin ponchos ni animales de carga. En invierno la nieve decide qué caminos quedan abiertos.'],los_patos:['Enlace pehuenche','Los pasos se abren con acuerdos y respeto. La palabra empeñada aquí debe valer también en el campamento.'],tucuman:['Oficial de la Ciudadela','El norte puede resistir si el Camino Real permanece abierto. Ninguna fortaleza se sostiene sin abastecimiento.'],jujuy:['Arriero de la posta','Las recuas traen provisiones desde Salta. Si cae la Quebrada, habrá que defender cada tramo del camino.'],humahuaca:['Vigía de la quebrada','Desde estas alturas vemos las columnas que bajan del Alto Perú. Avisaremos antes de que alcancen Jujuy.'],san_lorenzo:['Fraile de San Carlos','El convento ofrece abrigo. Afuera, las barrancas dominan el camino que sube desde el río.']};
export const ENCOUNTERS=[...local.map(n=>({...n,name:[...OPERATIVES,...CIVIC_RECRUITS].find(o=>o.id===n.operativeId).name,x:n.x??3,y:n.y??7})),...Object.entries(civilians).map(([sector,[name,greeting]])=>({id:`local-${sector}`,sector,name,greeting,x:3,y:7,requiredLeadership:0,requiredLiberated:0,requiredSector:sector}))];
export const canRecruitEncounter=n=>n.operativeId!==undefined&&n.recruitable!==false;
export function encounterDefinitions(s){
 const content=s.contentCampaign?.package;
 const original=ENCOUNTERS.filter(n=>n.operativeId===undefined?content?.includeOriginalResidents!==false:!content||content.characters.some(c=>legacyOperativeId(c.id)===n.operativeId));
 return [...original,...(content?.characters??[]).filter(isWorldCharacter).map(c=>{
  const {dialogue,...encounter}=c.encounter;
  return {id:`authored-${c.id}`,contentId:c.id,operativeId:operativeIdForCharacter(content,c.id),name:c.name,sector:null,x:3,y:7,...encounter};
 })];
}
export function encounterForOperative(id){return ENCOUNTERS.find(n=>n.operativeId===Number(id));}
export function encountersFor(s,sector){
 return encounterDefinitions(s).filter(n=>{
  if(civilianDiedHere(s,n,sector))return true;
  if(s.civilianState?.people[`npc-${n.id}`]?.health.hp===0)return false;
  if(n.operativeId===undefined)return n.sector===sector;
  const character=characterForOperative(s,n.operativeId);
  if((s.contentCampaign&&!character)||isContractOperative(s,{id:n.operativeId})||s.recruited.includes(n.operativeId)||s.operativeState?.[n.operativeId]?.alive===false)return false;
  return s.contentPresence&&character?characterPresentInSector(s,character.id,sector):n.sector===sector;
 }).map(n=>{
  const op=n.operativeId===undefined?null:authoredOperative(s,{id:n.operativeId,name:n.name});
  const person=op?.contentId?s.contentPresence?.people[op.contentId]:null;
  return campaignCivilian(s,op?.contentId?{...n,sector,name:op.name,portraitId:op.portraitId,contentId:op.contentId,...(person?{presenceRevision:person.revision}:{}),...(op.abilities===undefined?{}:{abilities:[...op.abilities]}),...(op.storyProfile?{storyProfile:op.storyProfile}:{}),...(op.spriteAppearance?{spriteAppearance:op.spriteAppearance}:{})}:{...n});
 });
}
export function encounterRequirements(s,npc,actor){
 const liberated=new Set(CAMPAIGN_SECTORS.filter(d=>s.sectors[d.id].owner==='patriot').map(d=>d.id==='retiro'?'buenos_aires':d.id)).size;
 if(actor.leadership<npc.requiredLeadership)return `Necesitás un interlocutor con al menos ${npc.requiredLeadership} puntos de liderazgo.`;
 if(liberated<npc.requiredLiberated)return `Primero asegurá al menos ${npc.requiredLiberated} localidades patriotas.`;
 if(npc.requiredSector&&s.sectors[npc.requiredSector]?.owner!=='patriot')return `Primero liberá ${CAMPAIGN_SECTORS.find(d=>d.id===npc.requiredSector)?.name??'la localidad requerida'}.`;
 return null;
}

// The directory supplies fixed hints and last encounters, not live random rolls.
export function encounterContacts(s){
 return encounterDefinitions(s).filter(n=>canRecruitEncounter(n)&&!isContractOperative(s,{id:n.operativeId})&&!s.recruited.includes(n.operativeId)&&s.operativeState?.[n.operativeId]?.alive!==false).flatMap(n=>{
  const c=characterForOperative(s,n.operativeId),p=c&&s.contentCampaign.package.placements.find(p=>p.character===c.id);
  if(s.contentPresence&&(!p||p.afterDeath&&!s.contentPresence.people[c.id].appeared))return [];
  const met=s.conversations?.[n.id]?.sector;
  const place=met??(s.contentPresence?p?.mode==='fixed'?p.sectors[0]:null:n.sector);
  return [{...n,name:c?.name??n.name,locationLabel:place?`${met?'Último encuentro: ':''}${campaignPlace(place)?.name??place}`:'Ubicación por descubrir'}];
 });
}

// Local service terms do not turn a resident into a bulletin candidate.
export function encounterHireTerms(s,npc){
 const c=characterForOperative(s,npc.operativeId);
 if(!c||!isWorldCharacter(c)||c.service!=='contract'||!canRecruitEncounter(npc))return [];
 const op=authoredOperative(s,{id:npc.operativeId});
 return Object.entries(CONTRACT_TERMS).map(([term,period])=>{
  const q=contractQuote(s,op,term),funded=s.resources.treasury>=q.price;
  return {...q,name:period.name,available:q.available&&funded,reason:q.reason??(funded?null:`Necesitás ${q.price} pesos para este contrato.`)};
 });
}
