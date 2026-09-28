import {foundryFor,foundryLocationName} from './campaign-foundry.js';
import {campaignStory} from './campaign-story.js';
import {CAMPAIGN_SECTORS,PHASES} from './data.js';
import {arrivalFacilityOptions} from './arrival-sites.js';

export const HEADQUARTERS_OPTIONS=Object.freeze(CAMPAIGN_SECTORS.filter(s=>arrivalFacilityOptions(s.id).includes('barracks')));
export const headquartersFor=state=>state?.contentCampaign?.package.headquarters??'retiro';
export const headquartersName=state=>headquartersFor(state)==='retiro'?'Retiro':CAMPAIGN_SECTORS.find(s=>s.id===headquartersFor(state))?.name;
export function validateHeadquarters(value){
 return value===undefined||typeof value==='string'&&HEADQUARTERS_OPTIONS.some(s=>s.id===value)?[]:['Cuartel general: elegí una localidad con acceso terrestre compatible, no un paso ni una celda de agua.'];
}
export function campaignChapters(state){
 if(campaignStory(state))return campaignStory(state).chapters;
 const foundry=foundryFor(state),customFoundry=state?.contentCampaign?.package.foundry!==undefined;
 return PHASES.map((p,i)=>i===0&&headquartersFor(state)!=='retiro'?{...p,name:`I · Formación en ${headquartersName(state)}`,objective:`Creá tu granadero o recibí a tu primer contratado en ${headquartersName(state)}.`}:i===3&&customFoundry?{...p,name:`IV · Preparativos de ${foundry.name}`,objective:`Organizá ${foundry.name} en ${foundryLocationName(state)}, financiá el ejército con ${foundry.fundingCost} pesos, comprá tres cañones, controlá y fortificá Mendoza y los pasos de Cuyo, y acordá el paso con los pehuenches.`}:i===4&&customFoundry?{...p,name:`V · ${foundry.armyName}`}:p);
}
export const hasWorkshop= (state,id)=>[headquartersFor(state),'retiro','cordoba','mendoza'].includes(id)||Boolean(state.flags.foundry&&id===foundryFor(state).sector);
