import {OPERATIVES} from './data.js';
import {CIVIC_RECRUITS} from './civic-recruits.js';

const originals=[...OPERATIVES,...CIVIC_RECRUITS];
const indexes=new WeakMap();
export function legacyOperativeId(id){return originals.find(o=>`person-${o.id}`===id)?.id;}
export function isContractCharacter(definition){
 const id=legacyOperativeId(definition.id);
 return id===undefined?definition.recruitmentSource==='contract':id>=100;
}
function indexFor(content){
 if(indexes.has(content))return indexes.get(content);
 // The package is immutable during a campaign. Order in the editor cannot move
 // an identity into a historical slot, the player officer (1000), or militia.
 let next=2000;
 const entries=[...content.characters].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0).map(c=>[c,legacyOperativeId(c.id)??next++]);
 const index={byCharacter:new Map(entries.map(([c,id])=>[c.id,id])),byOperative:new Map(entries.map(([c,id])=>[id,c]))};
 if(Object.isFrozen(content))indexes.set(content,index);
 return index;
}
export function operativeIdForCharacter(content,id){return indexFor(content).byCharacter.get(id);}
export function characterForOperative(state,id){return state.contentCampaign?indexFor(state.contentCampaign.package).byOperative.get(Number(id)):undefined;}
export function isContractOperative(state,operative){
 const definition=characterForOperative(state,operative.id);
 return definition?isContractCharacter(definition):CIVIC_RECRUITS.some(o=>o.id===operative.id)&&!state.contentCampaign;
}
export function gainsExperience(state,operative){return operative.id===1000||isContractOperative(state,operative)&&operative.progression!=='fixed';}

// All deployed and retained actor copies that must agree with pinned definitions.
export function campaignActors(value){
 const actors=scene=>[...(Array.isArray(scene?.units)?scene.units:[]),...(Array.isArray(scene?.npcs)?scene.npcs:[])];
 const pending=value.pendingBattle;
 return [...actors(value),...(pending?.squad??[]),...(pending?.missionAllies??[]),...(pending?.npcs??[]),
  ...Object.values(value.missionAllies??{}),...Object.values(value.sectorStates??{}).flatMap(actors),...Object.values(value.sceneStates??{}).flatMap(actors)];
}
export function characterForActor(state,actor){
 if(!state.contentCampaign)return undefined;
 const reference=actor.operativeId??(Number.isFinite(Number(actor.id))?Number(actor.id):operativeIdForCharacter(state.contentCampaign.package,actor.contentId));
 return characterForOperative(state,reference);
}
