import {defaultContentPackage} from '../game/content-package.js';
import {initialCampaign} from '../game/campaign.js';
import {order,saved} from './local-contract-fixture.mjs';
export const REMOTE=110,LOCAL=112;
export function separatedWorkshop(){
 const d=defaultContentPackage();d.rules.startingTreasury=10000;d.startingTerritory.buenos_aires={owner:'patriot',loyalty:65};
 for(const id of [REMOTE,LOCAL]){const c=d.characters.find(c=>c.id===`person-${id}`);c.arrivalHours=0;c.startingSupplies={priming:0,flints:0,rations:0,torches:0,medkits:0,boleadoras:0};}
 let s=initialCampaign(8,d);for(const id of [REMOTE,LOCAL])s=order(s,{type:'recruitCivic',id,term:'month'});
 // Prepared wear isolates workshop eligibility; no claim of tactical wear here.
 for(const id of [REMOTE,LOCAL])s.operativeState[id].condition=40;
 s=order(s,{type:'createSquad',name:'Avanzada',ids:[REMOTE]});s=order(s,{type:'travel',sector:'buenos_aires'});s=order(s,{type:'selectSquad',id:'squad-1'});
 return saved({campaign:s}).campaign;
}
export function returnToWorkshop(s){s=order(s,{type:'selectSquad',id:s.squads.find(q=>q.members.includes(REMOTE)).id});return order(s,{type:'travel',sector:'retiro'});}
