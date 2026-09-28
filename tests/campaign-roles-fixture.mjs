import {defaultContentPackage} from '../game/content-package.js';
import {defaultCampaignStory} from '../game/campaign-story.js';
export function rolePackage(){
 const d=defaultContentPackage(),base=d.characters.find(c=>c.id==='person-110');d.characters=[{...structuredClone(base),id:'vanguard',name:'Lucía de la Guardia',nickname:'Lucía',arrivalHours:0},{...structuredClone(base),id:'engineer',name:'Elena del Taller',nickname:'Elena',arrivalHours:6}];d.placements=[];d.includeOriginalResidents=false;d.campaignStory=defaultCampaignStory();d.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];d.rules.startingTreasury=10000;d.startingTerritory.mendoza.owner='patriot';d.startingTerritory.buenos_aires.owner='patriot';d.campaignRoles={foundryEngineer:'engineer',marchCommander:'engineer'};return d;
}
