import {weaponSpecification} from './weapon-definition.js';
import {authoredOperative} from './content-roster.js';
import {OPERATIVES} from './data.js';
export const MISSION_SCENES={yatasto:{id:'yatasto',name:'Conferencia de Yatasto',anchor:'tucuman'},san_lorenzo:{id:'san_lorenzo',name:'Combate de San Lorenzo',anchor:'san_nicolas'}};
export const YATASTO_NPCS=[{id:'yatasto-belgrano',name:'Manuel Belgrano',sector:'tucuman',mission:true,x:7,y:7,greeting:'Los partes de Vilcapugio y Ayohuma muestran el costo de insistir por el Alto Perú. Debemos estudiar cómo sostener al Ejército del Norte.'},{id:'yatasto-san-martin',name:'José de San Martín',sector:'tucuman',mission:true,x:10,y:7,greeting:'Escuchemos a Belgrano. La decisión debe partir de la situación real del ejército, no del deseo de avanzar.'}];
export function missionContacts(s){
 return YATASTO_NPCS.map(n=>{
  if(n.id!=='yatasto-san-martin'||!s.contentCampaign)return {...n};
  const op=authoredOperative(s,{id:57});
  return {...n,name:op.name,portraitId:op.portraitId,contentId:op.contentId,...(op.abilities===undefined?{}:{abilities:[...op.abilities]}),...(op.storyProfile?{storyProfile:op.storyProfile}:{}),...(op.spriteAppearance?{spriteAppearance:op.spriteAppearance}:{})};
 });
}
export function missionStatus(s,id){const scene=MISSION_SCENES[id];if(!scene)return null;const m=s.missions?.[id]??{};return {...scene,stage:m.completed?'completed':m.stage??'arrival',completed:Boolean(m.completed),objectives:id==='yatasto'?[{id:'reports',text:'Escuchar los partes de Belgrano.',done:Boolean(m.reports)},{id:'assessment',text:'Estudiar con San Martín la alternativa continental.',done:Boolean(m.assessment)},{id:'frontier',text:'Acordar el mando de Güemes y asegurar la ruta a Salta.',done:Boolean(m.frontier)}]:[{id:'victory',text:'Derrotar al destacamento realista.',done:Boolean(m.completed)},{id:'commander',text:'Mantener con vida al comandante aliado.',done:Boolean(m.completed)}]};}
export function talkMission(s,npcId,supplied){
 const m=s.missions.yatasto??={stage:'arrival',reports:false,assessment:false,frontier:false,completed:false};
 if(npcId==='yatasto-belgrano'){m.reports=true;m.stage='reports';return 'Belgrano: «Las derrotas de Vilcapugio y Ayohuma han desgastado al ejército. Entrego los partes y la situación de las tropas para preparar su reorganización». Los documentos quedan examinados.';}
 if(!m.reports)throw Error('Primero conversá con Belgrano y examiná los partes del Ejército del Norte.');
 if(!m.assessment){m.assessment=true;m.stage='assessment';return 'San Martín: «Una nueva ofensiva directa hacia el Alto Perú consumiría nuestras fuerzas. Debemos sostener esta frontera y preparar desde Cuyo una vía continental». Falta acordar la defensa con Güemes.';}
 if(!s.flags.northPact||!supplied)throw Error('La conferencia necesita el pacto con Güemes y una ruta patriota abastecida hasta Salta.');
 m.frontier=true;m.stage='ready';return 'San Martín: «Güemes sostendrá el norte con sus gauchos. Con la frontera atendida, concentremos la preparación en Cuyo». La conferencia está lista para cerrarse.';
}
export function sanLorenzoAlly(s){const retained=s.missionAllies?.san_lorenzo;if(retained)return {...structuredClone(retained),id:57};const officer=authoredOperative(s,structuredClone(OPERATIVES.find(o=>o.id===57))),gear={weapon:s.loadouts?.[57]?.weapon??1803,...(s.operativeState[57]?.weaponMetadata?{weaponMetadata:s.operativeState[57].weaponMetadata}:{})},capacity=weaponSpecification(gear)?.capacity??0;return {...officer,...gear,id:57,missionAlly:true,name:`${officer.name} · Comandante aliado`,blade:1809,mounted:true,horse:true,canMount:true,mount:{id:'mission-san-martin',stamina:100,condition:100},loaded:Math.min(10,capacity),ammo:capacity?Math.max(0,10-capacity):0,priming:10,flints:1,rations:1,torches:0,medkits:0,boleadoras:0,inventory:{}};}
export function validateMissions(s){
 if(!s.missions||typeof s.missions!=='object'||Array.isArray(s.missions))return false;
 return Object.entries(s.missions).every(([id,m])=>MISSION_SCENES[id]&&m&&typeof m==='object'&&['arrival','reports','assessment','ready','completed','failed'].includes(m.stage)&&['reports','assessment','frontier','completed'].every(k=>m[k]===undefined||typeof m[k]==='boolean')&&(!m.frontier||m.assessment&&m.reports)&&(!m.assessment||m.reports));
}
