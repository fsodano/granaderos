import {completeQueuedAssault,stageAssaultDeparture} from './assault-fixture.mjs';
import assert from 'node:assert/strict';
import {rosterFor} from '../game/campaign.js';
import {contractQuote} from '../game/contracts.js';
import {pendingHire} from '../game/hiring-arrivals.js';
import {advanceCampaignHours} from './campaign-wait-fixture.mjs';
import {equipOpeningRifles} from './opening-equipment.mjs';
import {order,sync,visit,leave} from './local-contract-fixture.mjs';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {supplyRouteAmmunition} from './route-ammunition.mjs';

// Hire a second squad at the controlled reception site, recover actual weapons,
// buy its missing cartridges, then wait for both real journeys before attacking.
export function prepareNorthernSupport(start,sector,{maxWeeklyPrice=Infinity,preferMarksmanship=false}={}){
 let s=start;
 const field=s.activeSquadId,ids=rosterFor(s).filter(o=>o.id>=100&&s.operativeState[o.id].alive&&!s.recruited.includes(o.id)&&contractQuote(s,o,'week').price<=maxWeeklyPrice)
  .sort((a,b)=>(preferMarksmanship?b.marksmanship-a.marksmanship:0)||contractQuote(s,a,'week').price-contractQuote(s,b,'week').price||a.id-b.id).slice(0,6).map(o=>o.id);
 assert.equal(ids.length,6,'six living replacements must remain available');
 const cost=ids.reduce((sum,id)=>sum+contractQuote(s,rosterFor(s).find(o=>o.id===id),'week').price,0),funds=s.resources.treasury;
 for(const id of ids)s=order(s,{type:'recruitCivic',id,term:'week',destination:s.location});
 assert.equal(s.resources.treasury,funds-cost);
 for(const id of ids)assert.equal(s.recruited.includes(id),true,'Recruitment grants immediate control');
 const wait=Math.max(0,...ids.map(id=>(pendingHire(s,id)?.dueAt??s.hour)-s.hour));
 s=advanceCampaignHours(s,wait);assert.ok(ids.every(id=>s.recruited.includes(id)&&s.operativeState[id].location===s.location));
 s=order(s,{type:'createSquad',ids,name:`Apoyo de ${sector}`,sector:s.location});
 const support=s.activeSquadId,p=visit(s),rearmed=equipOpeningRifles(p.battle,ids);
 s=leave(sync({campaign:p.campaign,battle:rearmed.battle}));s=supplyRouteAmmunition(s,ids).campaign;
 for(const id of [field,support]){s=order(s,{type:'selectSquad',id});s=finishReloadsBeforeMarch(s);s=order(s,{type:'attack',sector,queue:true});}
 s=completeQueuedAssault(s,[field,support],sector);assert.equal(s.pendingBattle.squad.length,start.squad.length+ids.length);
 return {campaign:s,ids,cost};
}
