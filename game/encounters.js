import {CAMPAIGN_SECTORS,OPERATIVES} from './data.js';
import {CIVIC_RECRUITS} from './recruitment.js';
const local=[
 {id:'beltran',operativeId:2,sector:'mendoza',requiredLeadership:60,requiredLiberated:5,requiredSector:'mendoza',greeting:'La independencia necesita fraguas tanto como sables. Mostrame que podés sostener a los hombres y abastecer los talleres.'},
 {id:'paz',operativeId:11,sector:'cordoba',requiredLeadership:50,requiredLiberated:4,requiredSector:'cordoba',greeting:'Una buena posición vale más que una marcha precipitada. Quiero conocer a quien conducirá esta fuerza.'},
 {id:'brown',operativeId:5,sector:'ensenada',requiredLeadership:65,requiredLiberated:3,requiredSector:'ensenada',greeting:'El río también es un campo de batalla. Necesitamos crédito, tripulaciones y un mando que cumpla su palabra.'},
 {id:'macacha',operativeId:8,sector:'salta',requiredLeadership:60,requiredLiberated:5,requiredSector:'salta',greeting:'Las noticias viajan por manos que merecen confianza. Mi colaboración depende del acuerdo con los defensores de Salta.'},
 {id:'sosa',operativeId:100,sector:'buenos_aires',requiredLeadership:30,requiredLiberated:3,requiredSector:'buenos_aires',greeting:'Sé cuidar caballos y usar el facón. Si el Cabildo responde por ustedes, estoy dispuesto a aprender el oficio de soldado.'},
];
const civilians={retiro:['Sargento del cuartel','La instrucción continúa en el patio. Revisá las provisiones de cada hombre antes de marchar.'],san_nicolas:['Maestra de posta','Los desembarcos amenazan las comunicaciones. Quien custodie este paso mantendrá abierto el camino del río.'],santa_fe:['Consignatario del puerto','El comercio trae recursos, pero también atrae a los corsarios. Una guarnición firme protege la recaudación.'],uspallata:['Guía de la cordillera','No suban sin ponchos ni animales de carga. En invierno la nieve decide qué caminos quedan abiertos.'],los_patos:['Enlace pehuenche','Los pasos se abren con acuerdos y respeto. La palabra empeñada aquí debe valer también en el campamento.'],tucuman:['Oficial de la Ciudadela','El norte puede resistir si el Camino Real permanece abierto. Ninguna fortaleza se sostiene sin abastecimiento.'],jujuy:['Arriero de la posta','Las recuas traen provisiones desde Salta. Si cae la Quebrada, habrá que defender cada tramo del camino.'],humahuaca:['Vigía de la quebrada','Desde estas alturas vemos las columnas que bajan del Alto Perú. Avisaremos antes de que alcancen Jujuy.'],san_lorenzo:['Fraile de San Carlos','El convento ofrece abrigo. Afuera, las barrancas dominan el camino que sube desde el río.']};
export const ENCOUNTERS=[...local.map(n=>({...n,name:[...OPERATIVES,...CIVIC_RECRUITS].find(o=>o.id===n.operativeId).name,x:3,y:7})),...Object.entries(civilians).map(([sector,[name,greeting]])=>({id:`local-${sector}`,sector,name,greeting,x:3,y:7,requiredLeadership:0,requiredLiberated:0,requiredSector:sector}))];
export function encounterForOperative(id){return ENCOUNTERS.find(n=>n.operativeId===Number(id));}
export function encountersFor(s,sector){return ENCOUNTERS.filter(n=>n.sector===sector&&(n.operativeId===undefined||!s.recruited.includes(n.operativeId))).map(n=>({...n}));}
export function encounterRequirements(s,npc,actor){
 const liberated=Object.values(s.sectors).filter(r=>r.owner==='patriot').length;
 if(actor.leadership<npc.requiredLeadership)return `Necesitás un interlocutor con al menos ${npc.requiredLeadership} puntos de liderazgo.`;
 if(liberated<npc.requiredLiberated)return `Primero asegurá al menos ${npc.requiredLiberated} sectores patriotas.`;
 if(s.sectors[npc.requiredSector]?.owner!=='patriot')return 'Primero liberá esta localidad.';
 return null;
}
