import {synchronizeCampaignPresence} from '../game/campaign-presence.js';
import {defaultContentPackage} from '../game/content-package.js';
import {initialCampaign} from '../game/campaign.js';
import {order,saved} from './local-contract-fixture.mjs';
import {stageFiniteDressings} from './care-supply-source.mjs';
export const DOCTOR=112,PATIENT=110,OTHER_DOCTOR=137,OTHER_PATIENT=123;
export function preparedCare({term='week',twoPairs=false,careRules,doctorMedical=80,doctorWisdom,medicalKits=4,storedDressings=0}={}){
 const d=defaultContentPackage();if(careRules!==undefined)d.careRules=careRules;d.rules.startingTreasury=10000;d.startingTerritory.buenos_aires={owner:'patriot',loyalty:65};d.startingTerritory.ensenada={owner:'patriot',loyalty:65};
 for(const c of d.characters.filter(c=>[DOCTOR,PATIENT,OTHER_DOCTOR,OTHER_PATIENT].some(id=>c.id===`person-${id}`))){c.arrivalHours=0;c.attributes.medical=c.id===`person-${DOCTOR}`?doctorMedical:c.id===`person-${OTHER_DOCTOR}`?60:0;if(c.id===`person-${DOCTOR}`&&doctorWisdom!==undefined)c.attributes.wisdom=doctorWisdom;c.startingSupplies={rations:2,torches:2,medkits:medicalKits,boleadoras:1};}
 let s=initialCampaign(42,d);for(const id of twoPairs?[DOCTOR,PATIENT,OTHER_DOCTOR,OTHER_PATIENT]:[DOCTOR,PATIENT])s=order(s,{type:'recruitCivic',id,term:id===DOCTOR?term:'week'});
 // Declared prepared wounds isolate strategic care; this is not a combat route.
 for(const id of twoPairs?[PATIENT,OTHER_PATIENT]:[PATIENT]){s.operativeState[id].hp-=30;s.operativeState[id].bleeding=id===PATIENT?3:0;}
 synchronizeCampaignPresence(s);if(storedDressings)s=stageFiniteDressings(s,DOCTOR,storedDressings);return saved({campaign:s}).campaign;
}
export function assignedCare(options){let s=preparedCare(options);s=order(s,{type:'assignCare',id:DOCTOR,assignment:'doctor'});s=order(s,{type:'assignCare',id:PATIENT,assignment:'patient'});return s;}
