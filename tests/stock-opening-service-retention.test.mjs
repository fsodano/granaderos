import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {defaultProfile} from '../game/character-profile.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {hireArrivalOrder,hireArrivalDueSeconds} from '../game/hiring-arrivals.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {advanceCampaignHours} from './campaign-wait-fixture.mjs';
import {retainStockOpeningService} from './stock-port-opening.mjs';

const ids=[123,115,114,131,120],clock=s=>s.hour*3600+(s.secondOfHour??0),save=s=>decodeSave(encodeSave(s)).campaign;
const order=(s,action)=>{const next=dispatchCampaign(s,action);assert.equal(next.lastError,null,JSON.stringify(action)+next.lastError);return next;};
function paidOpening({delay=0,second=0}={}){
 const content=defaultContentPackage();for(const id of ids)content.characters.find(character=>character.id===`person-${id}`).arrivalHours=delay;
 let state=initialCampaign(1812,content);
 const profile={...defaultProfile(),classId:'soldado',attributes:{maxHp:85,agility:75,dexterity:75,strength:55,leadership:35,wisdom:35,marksmanship:85,mechanical:35,explosives:35,medical:35}};
 state=order(state,{type:'createOfficer',name:'Oficial de la apertura',profile,answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally',specialty:'teacher',temperament:'steady'}});
 if(second)state=order(state,{type:'advanceStrategicTime',seconds:second});
 const receipts=[],treasury=state.resources.treasury;
 for(const id of ids){
  const quote=contractQuote(state,rosterFor(state).find(op=>op.id===id),'day'),arrival=hireArrivalOrder(state,rosterFor(state).find(op=>op.id===id),'day',quote,'retiro'),before=state.resources.treasury;
  state=order(state,{type:'recruitCivic',id,term:'day',destination:'retiro'});assert.equal(state.resources.treasury,before-quote.total);receipts.push({id,quote,arrival,debited:before-state.resources.treasury});
 }
 state=save(advanceCampaignHours(state,23));assert.equal(state.resources.treasury,treasury-receipts.reduce((sum,receipt)=>sum+receipt.debited,0));
 return {campaign:state,receipts,treasury};
}

for(const options of [{delay:0,second:0},{delay:0,second:121},{delay:6,second:121}])test(`opening service survives the first midnight with actual paid terms (delay ${options.delay}, second ${options.second})`,()=>{
 const {campaign:start,receipts}=paidOpening(options),original=structuredClone(start),until=clock(start)+3600;
 assert.equal(start.resources.treasury,3200-receipts.reduce((sum,receipt)=>sum+receipt.debited,0));
 for(const receipt of receipts){const contract=start.contracts[receipt.id],due=hireArrivalDueSeconds(receipt.arrival);assert.equal(contract.kind,'paid');assert.equal(contract.term,'day');assert.equal(contract.paid,receipt.quote.price);assert.equal(contract.started*3600+(contract.startedSecond??0),due);assert.equal(contractExpiresSeconds(contract),due+receipt.quote.hours*3600);}
 const result=retainStockOpeningService(start,ids,until),retained=result.campaign;
 assert.deepEqual(start,original);assert.equal(result.renewals.length,options.delay?0:5);
 assert.equal(retained.resources.treasury,start.resources.treasury-result.renewals.reduce((sum,receipt)=>sum+receipt.debited,0));
 for(const receipt of result.renewals){assert.equal(receipt.action.type,'renewContract');assert.equal(receipt.action.term,'day');assert.equal(receipt.debited,receipt.quote.price);assert.ok(receipt.debited>0);assert.equal(receipt.treasury,receipt.treasuryBefore-receipt.debited);assert.equal(receipt.expirySeconds,receipt.previousExpirySeconds+receipt.quote.hours*3600);}
 for(const id of ids){
  for(const key of ['hp','maxHp','bleeding','bandaged','alive','captured','location','medkits','ammo','carriedLoaded','inventory','outfit','condition'])assert.deepEqual(retained.operativeState[id][key],start.operativeState[id][key],'Renewal cannot heal, resupply, move or replace a person.');
  assert.ok(contractExpiresSeconds(retained.contracts[id])>until);
 }
 assert.deepEqual(retained.loadouts,start.loadouts);assert.deepEqual(retained.ammunitionStores,start.ammunitionStores);assert.deepEqual(retained.squad,start.squad);
 let replay=start;
 for(const [index,receipt]of result.renewals.entries()){replay=order(replay,receipt.action);if(index===Math.floor(result.renewals.length/2))replay=save(replay);}
 assert.deepEqual(save(replay),save(retained),'The exact paid renewal tape survives a midpoint save.');
 const arrived=save(advanceCampaignHours(retained,1));assert.equal(clock(arrived),until);assert.equal(arrived.resources.treasury,retained.resources.treasury,'Retiro has no agreed port payment to mask the renewal cost.');
 assert.deepEqual(arrived.squad,[1000,...ids]);for(const id of ids){assert.equal(arrived.recruited.filter(value=>value===id).length,1);assert.equal(arrived.operativeState[id].alive,true);assert.ok(contractExpiresSeconds(arrived.contracts[id])>clock(arrived));}
 const repeated=retainStockOpeningService(arrived,ids,clock(arrived));assert.deepEqual(repeated.renewals,[]);assert.deepEqual(repeated.campaign,arrived,'No second payment is due for the same retained interval.');
});

test('opening service retention cannot silently restore naturally expired hires',()=>{
 const {campaign}=paidOpening(),expired=save(advanceCampaignHours(campaign,2)),before=structuredClone(expired);
 assert.deepEqual(expired.squad,[1000]);assert.ok(ids.every(id=>!expired.recruited.includes(id)&&expired.contracts[id]===undefined));
 assert.throws(()=>retainStockOpeningService(expired,ids,clock(expired)+3600),/must still serve before renewal/);assert.deepEqual(expired,before);
});
