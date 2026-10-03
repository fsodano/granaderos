import {OPERATIVES} from './data.js';
import {CIVIC_RECRUITS} from './civic-recruits.js';

const originals=[...OPERATIVES,...CIVIC_RECRUITS];
const legacyIds=new Map(originals.map(o=>[`person-${o.id}`,o.id]));
const indexes=new WeakMap();
export function legacyOperativeId(id){return legacyIds.get(id);}
export function isContractCharacter(definition){
 const id=legacyOperativeId(definition.id);
 return id===undefined?definition.recruitmentSource==='contract':id>=100;
}
export function isWorldCharacter(definition){return legacyOperativeId(definition.id)===undefined&&definition.recruitmentSource==='encounter';}
export function isHistoricalCharacter(definition){const id=legacyOperativeId(definition.id);return id!==undefined&&id<100;}
function indexFor(content){
 const previous=indexes.get(content),characters=content.characters;
 // Campaign copies lose Object.freeze. Reuse their index while membership and
 // IDs match, including mutable editor/save snapshots. Definitions stay live
 // by reference; replacements, reordering and in-place ID edits rebuild it.
 if(previous&&previous.members.length===characters.length&&previous.members.every((member,i)=>member.definition===characters[i]&&member.id===characters[i].id))return previous.index;
 // The package is immutable during a campaign. Order in the editor cannot move
 // an identity into a historical slot, the player officer (1000), or militia.
 let next=2000;
 const entries=[...characters].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0).map(c=>[c,legacyOperativeId(c.id)??next++]);
 const index={byCharacter:new Map(entries.map(([c,id])=>[c.id,id])),byOperative:new Map(entries.map(([c,id])=>[id,c]))};
 indexes.set(content,{members:characters.map(definition=>({definition,id:definition.id})),index});
 return index;
}
export function operativeIdForCharacter(content,id){return indexFor(content).byCharacter.get(id);}
export function characterForOperative(state,id){return state.contentCampaign?indexFor(state.contentCampaign.package).byOperative.get(Number(id)):undefined;}
export function isContractOperative(state,operative){
 const definition=characterForOperative(state,operative.id);
 return definition?isContractCharacter(definition):CIVIC_RECRUITS.some(o=>o.id===operative.id)&&!state.contentCampaign;
}
export function gainsExperience(state,operative){return operative.id===1000||(isContractOperative(state,operative)||characterForOperative(state,operative.id)?.recruitmentSource==='encounter')&&operative.progression!=='fixed';}

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
