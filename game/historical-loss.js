import {campaignStory} from './campaign-story.js';
import {campaignRole} from './campaign-roles.js';
import {foundryFor} from './campaign-foundry.js';
import {OPERATIVES} from './data.js';

// Original chapters have mandatory identities. Authored chapters define their
// own failure conditions, and completed projects no longer need their organizer.
export function historicalRequiredActors(s){
 if(s.completed||campaignStory(s))return [];
 const commander=s.contentCampaign?.package.characters.find(c=>c.id==='person-57')??OPERATIVES.find(o=>o.id===57);
 const actors=[{id:57,reason:`${commander.nickname||commander.name} ha muerto. La campaña histórica no puede continuar sin su comandante.`}];
 const engineer=campaignRole(s,'foundryEngineer');
 if(!s.flags.foundry&&engineer&&engineer.id!==57)actors.push({id:engineer.id,reason:`${engineer.name} ha muerto antes de organizar ${foundryFor(s).name}. La campaña histórica no puede continuar sin su responsable de fundición.`});
 return actors;
}
export function historicalLossReason(s){
 return historicalRequiredActors(s).find(({id})=>s.operativeState[id]?.alive===false&&s.operativeState[id].hp===0)?.reason??null;
}
export function enforceHistoricalLoss(s){
 const reason=historicalLossReason(s);if(!reason||s.defeated)return;
 s.defeated=true;s.log.unshift({hour:s.hour,text:reason});s.log=s.log.slice(0,80);
}
