import {applyStartingTerritory} from './content-territory.js';
import {campaignRules} from './campaign-rules.js';
import {validateAbilityReferences} from './content-character-abilities.js';
import {validatePresentationReferences} from './content-character-presentation.js';
import {isContractCharacter,isHistoricalCharacter,isWorldCharacter,operativeIdForCharacter} from './content-character-ids.js';
import {weaponMetadata,validateWeaponReferences,restoreWeaponReferences} from './weapon-definition.js';
import {contentIdentity,canonicalContent} from "./content-identity.js";
import { defaultContentPackage, resolveContent } from "./content-package.js";
import {contentCellIds} from "./content-map.js";
import {worldCell} from "./world-cells.js";
import {initializeCampaignPresence} from "./campaign-presence.js";
export function campaignContentReport(content) {
  const value = resolveContent(content),
    baseline = defaultContentPackage(),
    blocked = [],
    pending = [];
  const supported=new Set(['format','version','id','name','characters','weapons','placements','arrivalSites','oppositionEquipment','militiaEquipment','oppositionBlades','militiaBlades','quests','rules','startingTerritory','headquarters','imports']);
  const characterFields=new Set(['id','name','nickname','role','biography','portrait','monthlyPay','weapon','blade','attributes','arrivalHours','recruitmentSource','service','progression','traits','ridingSkill','personality','speech','spriteAppearance','abilities','encounter']);
  if(Object.keys(value).some(key=>!supported.has(key))||value.characters.some(c=>Object.keys(c).some(key=>!characterFields.has(key))))
    blocked.push('Este paquete incluye opciones de historia que esta versión todavía no puede aplicar.');
  if(value.characters.some(c=>!isContractCharacter(c)&&c.arrivalHours!==undefined))
    blocked.push("El tiempo de llegada se configura solo para los contratables del boletín.");
  if(value.characters.some(c=>isHistoricalCharacter(c)&&c.monthlyPay!==baseline.characters.find(b=>b.id===c.id)?.monthlyPay))
    blocked.push('Los personajes históricos conservan su servicio permanente; su paga todavía no se puede cambiar.');
  const ids=new Set(value.characters.map(c=>c.id));
  if(baseline.characters.some(c=>!isContractCharacter(c)&&!ids.has(c.id)))
    blocked.push('Los mandos históricos todavía cumplen funciones de campaña y no se pueden quitar.');
  if(value.characters.some(c=>isHistoricalCharacter(c)&&['recruitmentSource','service','progression','traits','ridingSkill'].some(key=>c[key]!==undefined)))
    blocked.push('El servicio, el progreso y las especialidades de los mandos históricos todavía conservan sus reglas originales.');
  if(value.characters.some(c=>isContractCharacter(c)&&(c.recruitmentSource==='encounter'||c.service==='permanent')))
    blocked.push('Los candidatos del boletín se incorporan por contrato. Para servicio permanente, creá un habitante.');
  const weaponFields=new Set(['id','template','name','damage','fireAP','aimAP','reloadAP','range','readyAP','capacity','weight','price','art','ap','reach']);
  if(value.weapons.some(w=>Object.keys(w).some(key=>!weaponFields.has(key))||(w.template<1809&&w.readyAP!==0)||(w.template>=1809&&['fireAP','aimAP','reloadAP','range','readyAP','capacity'].some(key=>Object.hasOwn(w,key)))||(w.template<1809&&['ap','reach'].some(key=>Object.hasOwn(w,key)))))
    blocked.push("Este paquete incluye manejo de armas que esta versión todavía no puede aplicar.");
  const placementFields=new Set(['id','character','mode','sectors','moveChance','afterDeath','delayMin','delayMax','selection','loadedGuard']);
  if(value.placements.some(p=>Object.keys(p).some(k=>!placementFields.has(k))))
    blocked.push('Este paquete incluye reglas de apariciones que todavía no se pueden aplicar.');
  if(value.placements.some(p=>isContractCharacter(value.characters.find(c=>c.id===p.character))))
    blocked.push('Los contratables del boletín no tienen apariciones: llegan después de contratarlos.');
  if(value.placements.some(p=>p.sectors.some(id=>!worldCell(id)?.land)))
    blocked.push('Las apariciones necesitan celdas terrestres. Las celdas de agua todavía no admiten encuentros.');
  if(value.placements.some(p=>p.afterDeath!==null&&!isWorldCharacter(value.characters.find(c=>c.id===p.character))))
    blocked.push('La aparición por muerte necesita un habitante nuevo; los mandos históricos conservan sus funciones de campaña.');
  pending.push(
    "Los requisitos de reclutamiento, las funciones de campaña y el servicio permanente de los personajes históricos conservan sus reglas originales.",
  );
  return { blocked, pending };
}
export function attachCampaignContent(state, content) {
  const definitions = resolveContent(content),
    report = campaignContentReport(definitions);
  if (report.blocked.length) throw Error(report.blocked.join("\n"));
  state.contentCampaign = { version: 2, adapter: "character-presence-v1", identity: contentIdentity(definitions), package: definitions };
  state.resources.treasury=campaignRules(state).startingTreasury;
  applyStartingTerritory(state);
  state.armoryItems=[];state.nextArmoryItemId=1;
  for (const c of definitions.characters) {
    const id=operativeIdForCharacter(definitions,c.id);
    const record=state.operativeState[id]??={hp:c.attributes.maxHp,fatigue:0,alive:true,xp:0,priming:50,flints:4,rations:2,torches:2,condition:100};
    const weapon=definitions.weapons.find(w=>w.id===c.weapon);
    state.loadouts[id]={...state.loadouts[id],weapon:weapon?.template??0};
    if(weapon)record.weaponMetadata=weaponMetadata(weapon);
    if(c.blade!==undefined){const blade=definitions.weapons.find(w=>w.id===c.blade);state.loadouts[id].blade=blade.template;record.bladeMetadata=weaponMetadata(blade);}
    record.hp = c.attributes.maxHp;
    record.maxHp = c.attributes.maxHp;
    record.bandaged = 0;
    // The saved legacy strength floor must use the authored starting attribute.
    if (record.strength !== undefined) record.strength = c.attributes.strength;
  }
  for(const id of Object.keys(state.operativeState))if(!definitions.characters.some(c=>operativeIdForCharacter(definitions,c.id)===Number(id)))delete state.operativeState[id];
  initializeCampaignPresence(state);
  return state;
}
export function validateCampaignContent(state) {
  if (state?.contentCampaign === undefined) {validateWeaponReferences(state,state);validatePresentationReferences(state);validateAbilityReferences(state);return;}
  const context = state.contentCampaign;
  if (!context || context.version !== 2 || !["character-sheets-v1","character-weapons-v2","character-presence-v1"].includes(context.adapter))
    throw Error("La versión del contenido de campaña no es compatible.");
  const definitions = resolveContent(context.package),
    report = campaignContentReport(definitions);
  if (report.blocked.length) throw Error(report.blocked.join("\n"));
  if(canonicalContent(context.identity)!==canonicalContent(contentIdentity(definitions)))throw Error("El contenido de campaña no coincide con su identidad guardada.");
  if(context.adapter!=='character-presence-v1'){
    if(definitions.characters.some(isWorldCharacter))throw Error('Los habitantes nuevos necesitan una campaña con presencia de personajes.');
    const locations=list=>list.map(p=>({...p,sectors:contentCellIds(p.sectors)}));
    if(canonicalContent(locations(definitions.placements))!==canonicalContent(locations(defaultContentPackage().placements)))
      throw Error('Las apariciones editadas necesitan una campaña nueva con presencia de personajes.');
  }
  restoreWeaponReferences(state,state);validateWeaponReferences(state,state);
  validatePresentationReferences(state);validateAbilityReferences(state);
  state.contentCampaign = { version: 2, adapter: context.adapter, identity: contentIdentity(definitions), package: definitions };
}
