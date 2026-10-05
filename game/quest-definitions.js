import {cityForSector} from './cities.js';
import {CAMPAIGN_SECTORS} from './data.js';
import {SUPPLY_ITEMS} from './tactical-inventory.js';
import {OUTFITS} from './outfits.js';
import {sectorExits} from './tactical-exits.js';
import {canonicalContent} from './content-identity.js';
import {ENCOUNTERS} from './encounters.js';
import {legacyOperativeId,isWorldCharacter} from './content-character-ids.js';
import {contentCellIds} from './content-map.js';
import {NPC_QUESTS} from './quests.js';
import {questContactIds} from './quest-beneficiaries.js';

export const QUEST_RESOURCES = ['treasury'];
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const identifier = v => typeof v === 'string' && /^[a-z][a-z0-9_-]{0,99}$/.test(v) && !['constructor','prototype'].includes(v);
const text = (v,max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const integer = (v,min,max) => Number.isSafeInteger(v) && v >= min && v <= max;
const sector = id => CAMPAIGN_SECTORS.some(s=>s.id===id);
export function validateQuestDefinitions(quests) {
  if (!Array.isArray(quests) || quests.length > 200) return ['Encargos: se necesita una lista de hasta 200 encargos.'];
  const errors = [], ids = new Set(), contacts = new Set();
  const check = (ok,id,message) => {if(!ok)errors.push(`Encargo ${id}: ${message}`);};
  for (const q of quests) {
    if (!object(q)) {errors.push('Encargos: registro inválido.');continue;}
    check(identifier(q.id)&&!ids.has(q.id),q.id,'identificador inválido o repetido.');ids.add(q.id);
    check(identifier(q.npcId),q.id,'contacto inválido.');
    check(Object.keys(q).every(k=>['id','npcId','sector','title','offer','delivery','cost','requiredSectors','carried','escort','requires','reward','rewardChoice','beneficiaries','withdrawal'].includes(k)),q.id,'campo desconocido.');
    check(sector(q.sector),q.id,'localidad inexistente.');
    check(text(q.title,120)&&text(q.offer,800)&&text(q.delivery,800),q.id,'revisá el título y los textos (120 y 800 caracteres).');
    check(object(q.cost)&&Object.entries(q.cost).every(([k,v])=>QUEST_RESOURCES.includes(k)&&integer(v,1,10000)),q.id,'recursos de entrega inválidos.');
    check(Array.isArray(q.requiredSectors)&&q.requiredSectors.every(sector)&&new Set(q.requiredSectors).size===q.requiredSectors.length,q.id,'localidades requeridas inválidas.');
    check(q.requires===undefined||Array.isArray(q.requires)&&q.requires.every(identifier)&&new Set(q.requires).size===q.requires.length,q.id,'encargos previos inválidos.');
    check(q.reward===undefined||object(q.reward)&&Object.keys(q.reward).length===2&&integer(q.reward.treasury,0,10000)&&typeof q.reward.loyalty==='boolean',q.id,'recompensa inválida.');
    check(!q.reward?.loyalty||cityForSector(q.sector),q.id,'esa localidad no registra lealtad; desactivá esa recompensa.');
    if(q.rewardChoice!==undefined){
      check(object(q.rewardChoice)&&Object.keys(q.rewardChoice).length===1&&Object.hasOwn(q.rewardChoice,'reimbursement')&&integer(q.rewardChoice.reimbursement,1,10000),q.id,'el reintegro necesita un importe entero de 1 a 10000 pesos.');
      check(Boolean(q.carried)&&!q.escort&&Boolean(cityForSector(q.sector)),q.id,'la elección de recompensa necesita una entrega física en una ciudad.');
      check(q.reward===undefined||q.reward?.treasury===0&&q.reward?.loyalty===false,q.id,'la elección de recompensa no admite una recompensa automática.');
    }
    if(q.withdrawal!==undefined){
      check(object(q.withdrawal)&&Object.keys(q.withdrawal).length===1&&integer(q.withdrawal.supportCost,1,20),q.id,'el retiro necesita un costo entero de apoyo local de 1 a 20.');
      check(Boolean(q.carried)&&integer(q.carried.count,2,100)&&!q.escort&&(q.beneficiaries?Array.isArray(q.beneficiaries)&&q.beneficiaries.every(b=>object(b)&&cityForSector(b.sector)):Boolean(cityForSector(q.sector))),q.id,'el retiro necesita una entrega física de al menos dos objetos con destinatarios en ciudades.');
    }
    if(q.beneficiaries!==undefined){
      check(Array.isArray(q.beneficiaries)&&q.beneficiaries.length===2&&[...q.beneficiaries].every(object),q.id,'elegí exactamente dos destinatarios distintos.');
      if(Array.isArray(q.beneficiaries)&&[...q.beneficiaries].every(object)){
        const branches=new Set(),recipients=new Set();
        for(const b of q.beneficiaries){
          check(Object.keys(b).length===5&&['id','npcId','sector','delivery','reward'].every(k=>Object.hasOwn(b,k))&&identifier(b.id)&&!branches.has(b.id)&&identifier(b.npcId)&&!recipients.has(b.npcId)&&sector(b.sector)&&text(b.delivery,800)&&object(b.reward)&&Object.keys(b.reward).length===2&&integer(b.reward.treasury,0,10000)&&typeof b.reward.loyalty==='boolean'&&(!b.reward.loyalty||cityForSector(b.sector)),q.id,'destinatario o recompensa inválidos.');
          branches.add(b.id);recipients.add(b.npcId);
        }
        check(q.beneficiaries.some(b=>b.npcId===q.npcId&&b.sector===q.sector),q.id,'el contacto principal debe ser uno de los destinatarios en su localidad.');
      }
      check(Boolean(q.carried)&&q.escort===undefined&&q.rewardChoice===undefined&&(q.reward===undefined||q.reward?.treasury===0&&q.reward?.loyalty===false),q.id,'los destinatarios necesitan una entrega física sin otra recompensa o escolta.');
    }
    const contactIds=q.beneficiaries===undefined?[q.npcId]:Array.isArray(q.beneficiaries)?q.beneficiaries.filter(object).map(b=>b.npcId):[];
    for(const id of contactIds){check(!contacts.has(id),q.id,'elegí un contacto distinto para cada encargo.');contacts.add(id);}
    if(q.carried!==undefined){
      const c=q.carried;
      check(object(c)&&Object.keys(c).length===4&&text(c.label,80)&&text(c.instruction,800)&&integer(c.count,1,100)&&
        (Object.hasOwn(SUPPLY_ITEMS,c.item)&&c.item!=='ammo'&&c.outfit===undefined||Object.hasOwn(OUTFITS,c.outfit)&&c.item===undefined),q.id,'objeto de entrega inválido.');
    }
    if(q.escort!==undefined){
      const e=q.escort;
      check(object(e)&&Object.keys(e).length===2&&sector(e.destination)&&sectorExits(q.sector).some(exit=>exit.destination===e.destination&&exit.edge===e.edge),q.id,'la escolta necesita una salida existente.');
    }
    check(!(q.carried&&q.escort)&&(!(q.carried||q.escort)||object(q.cost)&&Object.keys(q.cost).length===0),q.id,'usá una sola forma de entrega.');
  }
  if(errors.length)return errors;
  for(const q of quests)for(const id of q.requires??[])check(ids.has(id),q.id,'el encargo previo no existe.');
  const visiting=new Set(),done=new Set(),byId=new Map(quests.map(q=>[q.id,q]));
  function visit(id){if(visiting.has(id))return false;if(done.has(id))return true;visiting.add(id);for(const dep of byId.get(id)?.requires??[])if(!visit(dep))return false;visiting.delete(id);done.add(id);return true;}
  check(quests.every(q=>visit(q.id)),'secuencia','hay un ciclo entre encargos previos.');
  return errors;
}

// A tactical copy must match the campaign's pinned definition. A save or an
// interaction cannot replace a cost, recipient or reward through its report.
export function validateQuestContext(campaign,battle) {
  const definitions=campaign.contentCampaign?.package.errands??campaign.errandDefinitions;
  if(!battle||canonicalContent(battle.errandDefinitions)!==canonicalContent(definitions))throw Error('Los encargos del despliegue no coinciden con la campaña.');
}

// An omitted errands collection retains the historical tasks. Authored dialogue
// quests keep their separate state and can coexist with physical deliveries.
export function defaultErrands(){return structuredClone(NPC_QUESTS).map(q=>({...q,cost:q.cost??{},reward:typeof q.reward==='number'?{treasury:q.reward,loyalty:true}:{treasury:0,loyalty:true}}));}
// Fictional local errand text and reward amounts are game tuning. Only fresh
// campaigns pin these definitions; omitted legacy collections stay unchanged.
export function freshDefaultErrands(){
 return defaultErrands().map(q=>q.id==='retiro-uniformes'?{...q,title:'Abrigo para el cuartel o el puerto',withdrawal:{supportCost:4},reward:{treasury:0,loyalty:false},
  beneficiaries:[{id:'cuartel',npcId:'local-retiro',sector:'retiro',delivery:'Recibimos los dos ponchos. Los reclutas del cuartel tendrán abrigo.',reward:{treasury:0,loyalty:true}},
   {id:'puerto',npcId:'local-ensenada',sector:'ensenada',delivery:'Recibimos los dos ponchos. La guardia del puerto tendrá abrigo.',reward:{treasury:0,loyalty:true}}],
  offer:'Traé dos ponchos de lana en buen estado. Podés entregarlos al sargento de Retiro para los nuevos reclutas o al capataz de Ensenada para la guardia del puerto. La localidad elegida gana 8 puntos de apoyo. La primera entrega fija el destino; no podrás cambiarlo. Entregá ambos allí y hablá con el destinatario para confirmar.',
  delivery:'Recibimos los dos ponchos.'}:q);
}
export function errandContacts(content){
 const characters=Array.isArray(content.characters)?content.characters:[],placements=Array.isArray(content.placements)?content.placements:[];
 const contacts=ENCOUNTERS.filter(n=>n.operativeId===undefined?content.includeOriginalResidents!==false:characters.some(c=>c&&legacyOperativeId(c.id)===n.operativeId)&&n.operativeId<100).map(n=>({id:n.id,name:n.operativeId===undefined?n.name:characters.find(c=>c&&legacyOperativeId(c.id)===n.operativeId)?.name??n.name,sector:n.sector,fixedSector:n.operativeId===undefined?n.sector:null,canRecruit:n.operativeId!==undefined,characterId:n.operativeId===undefined?undefined:`person-${n.operativeId}`}));
 for(const c of characters.filter(c=>c&&isWorldCharacter(c))){
  const p=placements.find(p=>p?.character===c.id);if(!p)continue;
  const locality=CAMPAIGN_SECTORS.find(s=>contentCellIds([s.id])[0]===contentCellIds(Array.isArray(p.sectors)?p.sectors:[])[0])?.id??null;
  contacts.push({id:`authored-${c.id}`,name:c.name,sector:locality,fixedSector:p.mode==='fixed'&&p.sectors?.length===1?locality:null,canRecruit:c.encounter?.recruitable!==false,characterId:c.id});
 }
 return contacts;
}
export function validateErrandContacts(content){
 if(content.errands===undefined)return [];
 const contacts=errandContacts(content),errors=[];
 for(const q of content.errands)for(const npcId of questContactIds(q)){
  const at=q.beneficiaries?.find(b=>b.npcId===npcId)?.sector??q.sector;
  const c=contacts.find(c=>c.id===npcId);
  if(!c){errors.push(`Encargo ${q.id}: el contacto no existe o no aparece en el mapa.`);continue;}
  if(!q.carried&&!q.escort)continue;
  if(c.canRecruit)errors.push(`Encargo ${q.id}: la entrega física o escolta necesita un contacto que no se incorpore a la escuadra.`);
  const p=c.characterId&&content.placements.find(p=>p?.character===c.characterId);
  if(c.characterId?!(p?.mode==='fixed'&&p.sectors?.length===1&&contentCellIds(p.sectors)[0]===contentCellIds([at])[0]):c.sector!==at)errors.push(`Encargo ${q.id}: la entrega física o escolta necesita un contacto fijo en esa localidad.`);
 }
 return errors;
}
