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
 if(headquartersFor(state)==='retiro')return PHASES;
 const name=headquartersName(state);
 return PHASES.map((p,i)=>i===0?{...p,name:`I · Formación en ${name}`,objective:`Creá tu granadero o recibí a tu primer contratado en ${name}.`}:p);
}
export const hasWorkshop= (state,id)=>[headquartersFor(state),'retiro','cordoba','mendoza'].includes(id);
