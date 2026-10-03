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
    check(identifier(q.npcId)&&!contacts.has(q.npcId),q.id,'elegí un contacto distinto para cada encargo.');contacts.add(q.npcId);
    check(Object.keys(q).every(k=>['id','npcId','sector','title','offer','delivery','cost','requiredSectors','carried','escort','requires','reward'].includes(k)),q.id,'campo desconocido.');
    check(sector(q.sector),q.id,'localidad inexistente.');
    check(text(q.title,120)&&text(q.offer,800)&&text(q.delivery,800),q.id,'revisá el título y los textos (120 y 800 caracteres).');
    check(object(q.cost)&&Object.entries(q.cost).every(([k,v])=>QUEST_RESOURCES.includes(k)&&integer(v,1,10000)),q.id,'recursos de entrega inválidos.');
    check(Array.isArray(q.requiredSectors)&&q.requiredSectors.every(sector)&&new Set(q.requiredSectors).size===q.requiredSectors.length,q.id,'localidades requeridas inválidas.');
    check(q.requires===undefined||Array.isArray(q.requires)&&q.requires.every(identifier)&&new Set(q.requires).size===q.requires.length,q.id,'encargos previos inválidos.');
    check(q.reward===undefined||object(q.reward)&&Object.keys(q.reward).length===2&&integer(q.reward.treasury,0,10000)&&typeof q.reward.loyalty==='boolean',q.id,'recompensa inválida.');
    check(!q.reward?.loyalty||cityForSector(q.sector),q.id,'esa localidad no registra lealtad; desactivá esa recompensa.');
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
  const definitions=campaign.contentCampaign?.package.errands;
  if(!battle||canonicalContent(battle.errandDefinitions)!==canonicalContent(definitions))throw Error('Los encargos del despliegue no coinciden con la campaña.');
}

// An omitted errands collection retains the historical tasks. Authored dialogue
// quests keep their separate state and can coexist with physical deliveries.
export function defaultErrands(){return structuredClone(NPC_QUESTS).map(q=>({...q,cost:q.cost??{},reward:typeof q.reward==='number'?{treasury:q.reward,loyalty:true}:{treasury:0,loyalty:true}}));}
export function errandContacts(content){
 const characters=Array.isArray(content.characters)?content.characters:[],placements=Array.isArray(content.placements)?content.placements:[];
 const contacts=ENCOUNTERS.filter(n=>n.operativeId===undefined?content.includeOriginalResidents!==false:characters.some(c=>c&&legacyOperativeId(c.id)===n.operativeId)&&n.operativeId<100).map(n=>({id:n.id,name:characters.find(c=>c&&legacyOperativeId(c.id)===n.operativeId)?.name??n.name,sector:n.sector,fixedSector:n.operativeId===undefined?n.sector:null,canRecruit:n.operativeId!==undefined,characterId:n.operativeId===undefined?undefined:`person-${n.operativeId}`}));
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
 for(const q of content.errands){
  const c=contacts.find(c=>c.id===q.npcId);
  if(!c){errors.push(`Encargo ${q.id}: el contacto no existe o no aparece en el mapa.`);continue;}
  if(!q.carried&&!q.escort)continue;
  if(c.canRecruit)errors.push(`Encargo ${q.id}: la entrega física o escolta necesita un contacto que no se incorpore a la escuadra.`);
  const p=c.characterId&&content.placements.find(p=>p?.character===c.characterId);
  if(c.characterId?!(p?.mode==='fixed'&&p.sectors?.length===1&&contentCellIds(p.sectors)[0]===contentCellIds([q.sector])[0]):c.sector!==q.sector)errors.push(`Encargo ${q.id}: la entrega física o escolta necesita un contacto fijo en esa localidad.`);
 }
 return errors;
}
