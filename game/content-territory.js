import {CAMPAIGN_SECTORS} from './data.js';

export const defaultStartingTerritory=()=>Object.fromEntries(CAMPAIGN_SECTORS.map(s=>[s.id,{owner:s.id==='retiro'?'patriot':'royalist',loyalty:s.id==='retiro'?65:25}]));
export const startingTerritoryFor=state=>state?.contentCampaign?.package.startingTerritory??defaultStartingTerritory();
export function validateStartingTerritory(value){
 if(value===undefined)return [];
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==CAMPAIGN_SECTORS.length||!CAMPAIGN_SECTORS.every(s=>Object.hasOwn(value,s.id)))return ['Territorio inicial: configurá las trece localidades del mapa.'];
 const errors=[];
 for(const sector of CAMPAIGN_SECTORS){
  const r=value[sector.id];
  if(!r||typeof r!=='object'||Array.isArray(r)||Object.keys(r).length!==2||!Object.hasOwn(r,'owner')||!Object.hasOwn(r,'loyalty')||!['patriot','royalist'].includes(r.owner)||!Number.isInteger(r.loyalty)||r.loyalty<0||r.loyalty>100)errors.push(`Territorio inicial de ${sector.name}: elegí control patriota o realista y lealtad entera entre 0 y 100.`);
 }
 if(value.retiro?.owner!=='patriot')errors.push('Retiro debe comenzar bajo control patriota: es el cuartel y origen de abastecimiento de esta campaña.');
 return errors;
}
export function startingTerritoryDescription(state){
 const territory=startingTerritoryFor(state),names=CAMPAIGN_SECTORS.filter(s=>territory[s.id].owner==='patriot').map(s=>s.name);
 return names.length===1?'Empezás con Retiro como único sector controlado.':`Control inicial: ${names.join('; ')}.`;
}
export function applyStartingTerritory(state){
 const territory=startingTerritoryFor(state);
 for(const sector of CAMPAIGN_SECTORS)Object.assign(state.sectors[sector.id],territory[sector.id]);
 // No capture, quest, force issue or reward occurs when composing a new campaign.
 if(CAMPAIGN_SECTORS.some(s=>s.id!=='retiro'&&territory[s.id].owner==='patriot'))state.log[0].text=`Retiro, 1812. ${startingTerritoryDescription(state)} Contratá combatientes, creá tu granadero o combiná ambas opciones para partir.`;
}
