import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {validateContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {DEFAULT_CONTRACT_RULES} from '../game/contract-rules.js';
import {contractQuote,contractRenewalQuote,contractExpiresSeconds} from '../game/contracts.js';
import {hiringTravelHours,pendingHire,hireArrivalDueSeconds} from '../game/hiring-arrivals.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {northernReliefFitLocal,northernReliefReplacements,retainNorthernReliefSupport,hireNorthernReliefReplacement} from './northern-relief-service.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0),sector='tucuman',candidate=100,replacement=122;
const saved=c=>{const next=decodeSave(encodeSave(c)).campaign;assert.deepEqual(next,c);return next;};
const order=(c,action)=>{const before=structuredClone(c),next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);assert.deepEqual(c,before);return next;};

// All identities, initial wounds, linen, prices, arrival timing and the short
// test-only week are declared before compilation and the campaign factory.
// No initial morale is injected. Three actual batches of three paid wound
// deaths earn54 points of loss; actual rest then earns the service threshold.
function documents({weekDays=2,healthyCount=6,refusal=false,treasury=20000,delay=0,arrivalOnly=false,blocked=false}={}){
 const d=scaffoldDocuments('northern-relief-service');
 for(const key of ['content','world','maps'])d[key]=JSON.parse(JSON.stringify(d[key]).replaceAll('"camp"','"tucuman"').replaceAll('camp:','tucuman:'));
 // Legacy numeric slots exercise this named route's100..999 public catalogue.
 // Authored chapters keep the runtime generic; no stock cast is inherited.
 d.manifest.scenario='granaderos-historical-v1';d.content.includeOriginalResidents=false;
 d.content.rules.startingTreasury=treasury;d.content.rules.deploymentCartridges=0;
 d.content.contractRules={...DEFAULT_CONTRACT_RULES,days:{day:1,week:weekDays,month:30}};
 d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];
 if(blocked){d.content.headquarters='watch-post';d.world.defaultHeadquarters='watch-post';d.content.startingTerritory['watch-post'].owner='patriot';d.content.startingTerritory.tucuman.owner='royalist';d.world.arrivalFacilities['watch-post']=['barracks'];d.content.arrivalSites.push({sector:'watch-post',facilities:['barracks']});}
 const base=d.content.characters[0],critical=Array.from({length:9},(_,i)=>101+i),healthy=Array.from({length:healthyCount},(_,i)=>130+i),ids=arrivalOnly?[replacement]:[candidate,...critical,...healthy,replacement];
 d.content.characters=ids.map(id=>({...structuredClone(base),id:`person-${id}`,name:`Servicio ${id}`,nickname:`Servicio ${id}`,monthlyPay:id===candidate?200:30,arrivalHours:id===replacement?delay:0,weapon:null,
  abilities:id===candidate&&refusal?['low_morale_refusal']:[],attributes:{...base.attributes,medical:0},
  startingSupplies:{medkits:0,rations:0,torches:0,boleadoras:0},
  startingCondition:{hp:critical.includes(id)?1:70,bleeding:critical.includes(id)?1:0,bandaged:0,energy:100,fatigue:0}}));
 return {d,critical,healthy};
}

function setup(options={}){
 const {d,critical,healthy}=documents(options),declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);
 assert.deepEqual(validateContentPackage(content),[]);let c=initialCampaign(8,content),waitRequests=0;const actions=[],payments=[];
 const act=action=>{const before=c;c=order(c,action);actions.push(structuredClone(action));if(action.type==='recruitCivic')payments.push({id:action.id,debited:before.resources.treasury-c.resources.treasury});};
 const advanceTo=end=>{
  while(clock(c)<end&&waitRequests<32){assert.equal(c.pendingEncounter,null);assert.equal(c.pendingBattle,null);waitRequests++;act({type:'wait',hours:Math.min(24,Math.ceil((end-clock(c))/3600))});assert.equal(c.pendingEncounter,null);}
  assert.equal(clock(c),end,'The fresh setup must earn every requested hour inside32 Native wait requests.');
 };
 const hire=(id,term)=>{const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),term),cash=c.resources.treasury;assert.equal(quote.available,true,quote.reason);act({type:'recruitCivic',id,term,destination:sector});assert.equal(c.resources.treasury,cash-quote.total);assert.equal(c.contracts[id].paid,quote.price);};
 act({type:'advanceStrategicTime',seconds:17});
 if(options.arrivalOnly){assert.deepEqual(d,declaration);return {campaign:saved(c),declaration,actions,payments,advanceTo,get current(){return c;}};}
 hire(candidate,'week');act({type:'assignCare',operativeId:candidate,assignment:'rest'});
 assert.equal(c.operativeState[candidate].morale,80);
 for(let batch=0;batch<3;batch++){
  const group=critical.slice(batch*3,batch*3+3);
  for(const id of critical.slice(batch*3)){assert.equal(c.operativeState[id].alive,true);assert.equal(c.operativeState[id].hp,1,'Unrecruited authored wounds do not run before actual service.');}
  for(const id of group)hire(id,'day');
  act({type:'createSquad',ids:[candidate,...group],sector,name:'Guardia y heridos declarados'});
  const before=clock(c);advanceTo(before+3600);
  for(const id of group){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].hp,0);}
  assert.equal(c.operativeState[candidate].morale,80-(batch+1)*18);assert.equal(c.operativeState[candidate].hp,70);assert.equal(c.operativeState[candidate].bleeding,0);
 }
 advanceTo(clock(c)+12*3600);
 assert.ok(c.operativeState[candidate].morale>=28&&c.operativeState[candidate].morale<30,'Only actual death and rest transitions earn the low-morale boundary.');
 for(const id of healthy)hire(id,'week');
 for(let i=0;i<healthy.length;i+=6)act({type:'createSquad',ids:healthy.slice(i,i+6),sector,name:'Apoyo real'});
 assert.deepEqual(d,declaration);assert.equal(c.resources.treasury,(options.treasury??20000)-payments.reduce((sum,row)=>sum+row.debited,0));
 return {campaign:saved(c),critical,healthy,actions,payments,advanceTo,get current(){return c;}};
}

test('earned low-morale support buys one needed service extension and joins the actual eight-person field with exact saved replay',()=>{
 const s=setup(),start=s.campaign,before=structuredClone(start),contract=start.contracts[candidate],quote=contractRenewalQuote(start,rosterFor(start).find(op=>op.id===candidate),'day');
 assert.equal(northernReliefFitLocal(start).length,6);assert.deepEqual(northernReliefReplacements(start).map(op=>op.id),[replacement]);
 assert.ok(contractExpiresSeconds(contract)>clock(start));assert.ok(contractExpiresSeconds(contract)<clock(start)+36*3600);assert.equal(quote.available,true);assert.equal(quote.price,40);
 const result=retainNorthernReliefSupport(start);assert.deepEqual(result.retained,[candidate]);assert.equal(result.renewals.length,1);
 let c=result.campaign;assert.equal(clock(c),clock(start));assert.equal(c.resources.treasury,start.resources.treasury-quote.price);assert.equal(contractExpiresSeconds(c.contracts[candidate]),contractExpiresSeconds(contract)+86400);
 assert.equal(c.operativeState[candidate].morale,start.operativeState[candidate].morale+2);assert.ok(northernReliefFitLocal(c).includes(candidate));
 for(const id of start.recruited)for(const key of ['hp','maxHp','bleeding','alive','captured','location','medkits','inventory','condition','assignment'])assert.deepEqual(c.operativeState[id][key],start.operativeState[id][key]);
 for(const id of s.critical){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].hp,0);}
 assert.deepEqual(c.squads,start.squads);assert.deepEqual(c.squad,start.squad);assert.deepEqual(c.loadouts,start.loadouts);saved(c);
 const repeated=retainNorthernReliefSupport(c);assert.strictEqual(repeated.campaign,c);assert.deepEqual(repeated.renewals,[]);
 c=hireNorthernReliefReplacement(c,replacement);assert.equal(northernReliefFitLocal(c).length,8);assert.ok(northernReliefFitLocal(c).includes(candidate));
 let replay=start;for(const row of result.renewals)replay=order(replay,row.action);replay=saved(replay);replay=order(replay,{type:'recruitCivic',id:replacement,term:'week',destination:sector});assert.deepEqual(saved(replay),saved(c));
 const field=northernReliefFitLocal(c);for(let i=0;i<field.length;i+=6)c=order(c,{type:'createSquad',ids:field.slice(i,i+6),sector,name:'Columna de prueba'});
 assert.ok(c.squads.some(q=>q.members.includes(candidate)));assert.equal(new Set(c.squads.flatMap(q=>q.members).filter(id=>field.includes(id))).size,8);saved(c);assert.deepEqual(start,before);
});

test('an already sufficient real field never pays to improve unused support morale',()=>{
 const {campaign:start}=setup({healthyCount:8}),before=structuredClone(start),result=retainNorthernReliefSupport(start);
 assert.equal(northernReliefFitLocal(start).length,8);assert.strictEqual(result.campaign,start);assert.deepEqual(result.renewals,[]);assert.deepEqual(start,before);
});

test('a current term already covering the existing36-hour preparation cannot be renewed for morale',()=>{
 const {campaign:start}=setup({weekDays:3}),before=structuredClone(start);assert.ok(contractExpiresSeconds(start.contracts[candidate])>=clock(start)+36*3600);
 const result=retainNorthernReliefSupport(start);assert.strictEqual(result.campaign,start);assert.deepEqual(result.retained,[]);assert.deepEqual(start,before);
});

test('an authored Native low-morale renewal refusal stays terminal and receives no payment or restored service',()=>{
 const {campaign:start}=setup({refusal:true}),before=structuredClone(start),quote=contractRenewalQuote(start,rosterFor(start).find(op=>op.id===candidate),'day');assert.equal(quote.available,false);assert.match(quote.reason,/moral personal menor/);
 const result=retainNorthernReliefSupport(start);assert.strictEqual(result.campaign,start);assert.deepEqual(result.renewals,[]);
 const refused=dispatchCampaign(start,{type:'renewContract',id:candidate,term:'day',expectedExpiresAt:start.contracts[candidate].expiresAt,expectedExpiresSecond:start.contracts[candidate].expiresSecond??0});
 assert.match(refused.lastError,/moral personal menor/);assert.deepEqual(start,before);
 // The actual refused result is inspected only as plain data. It is not
 // adopted, queried, saved, replayed or used as a subsequent order input.
});

test('the real treasury cannot be bypassed to retain an otherwise eligible survivor',()=>{
 const {campaign:start}=setup({treasury:206}),before=structuredClone(start);assert.equal(start.resources.treasury,0);
 const result=retainNorthernReliefSupport(start);assert.strictEqual(result.campaign,start);assert.deepEqual(result.renewals,[]);assert.deepEqual(start,before);
});

test('immediate and delayed authored bookings retain their actual fees, arrival receipts and exact service start',()=>{
 for(const delay of [0,6]){
  const s=setup({arrivalOnly:true,delay}),start=s.campaign,before=structuredClone(start),quote=contractQuote(start,rosterFor(start).find(op=>op.id===replacement),'week');
  assert.equal(hiringTravelHours(start,replacement),delay);let c=hireNorthernReliefReplacement(start,replacement);assert.equal(c.resources.treasury,start.resources.treasury-quote.total);
  if(delay){
   const arrival=pendingHire(c,replacement);assert.equal(c.recruited.includes(replacement),false);assert.equal(arrival.travelHours,delay);assert.equal(hireArrivalDueSeconds(arrival),clock(start)+delay*3600);c=saved(c);
   for(let n=0;!c.recruited.includes(replacement)&&n<8;n++)c=order(c,{type:'wait',hours:1});
  }
  assert.equal(c.recruited.filter(id=>id===replacement).length,1);assert.equal(c.operativeState[replacement].location,sector);assert.equal(c.operativeState[replacement].hp,c.operativeState[replacement].maxHp);
  assert.equal(c.contracts[replacement].started*3600+(c.contracts[replacement].startedSecond??0),clock(start)+delay*3600);assert.equal(contractExpiresSeconds(c.contracts[replacement]),clock(start)+delay*3600+quote.hours*3600);
  assert.equal(c.resources.treasury,start.resources.treasury-quote.total);saved(c);assert.deepEqual(start,before);
 }
});

test('a genuinely uncontrolled arrival refuses through Native admission without adopting its failed result',()=>{
 const {campaign:start}=setup({arrivalOnly:true,blocked:true}),before=structuredClone(start);
 assert.throws(()=>hireNorthernReliefReplacement(start,replacement),/destino de llegada debe estar bajo tu control/);assert.deepEqual(start,before);
 // No failed result or attached campaign is used after this terminal refusal.
});

test('naturally expired service is never rehired or restored by the retention policy',()=>{
 const s=setup();s.advanceTo(49*3600+17);const start=saved(s.current),before=structuredClone(start);
 assert.equal(start.recruited.includes(candidate),false);assert.equal(start.contracts[candidate],undefined);assert.equal(start.operativeState[candidate].alive,true);
 const result=retainNorthernReliefSupport(start);assert.strictEqual(result.campaign,start);assert.deepEqual(result.renewals,[]);assert.deepEqual(start,before);
});

test('a real paid practice assignment cannot be borrowed as free retained field support',()=>{
 const s=setup(),start=saved(order(s.campaign,{type:'assignWork',operativeId:candidate,assignment:'practice',skill:'marksmanship'})),before=structuredClone(start);
 assert.equal(start.operativeState[candidate].assignment,'practice');assert.ok(start.operativeState[candidate].morale>=28&&start.operativeState[candidate].morale<30);
 const result=retainNorthernReliefSupport(start);assert.strictEqual(result.campaign,start);assert.deepEqual(result.renewals,[]);assert.deepEqual(start,before);
});

test('a callback error after the real service payment keeps the exact accepted prefix and original error identity',()=>{
 const {campaign:start}=setup(),before=structuredClone(start),contract=start.contracts[candidate],action={type:'renewContract',id:candidate,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0};
 const quote=contractRenewalQuote(start,rosterFor(start).find(op=>op.id===candidate),'day'),expected=order(start,action),failure=new Error('Declared callback failure');let caught;
 try{retainNorthernReliefSupport(start,{report:()=>{throw failure;}});}catch(error){caught=error;}
 assert.strictEqual(caught,failure);assert.deepEqual(caught.campaign,expected);assert.equal(caught.campaign.resources.treasury,start.resources.treasury-quote.price);
 assert.equal(caught.campaign.contracts[candidate].expiresAt,expected.contracts[candidate].expiresAt);assert.equal(caught.campaign.operativeState[candidate].morale,expected.operativeState[candidate].morale);
 assert.equal(caught.northernReliefService.renewals.length,1);assert.deepEqual(caught.northernReliefService.renewals[0].action,action);assert.equal(caught.northernReliefService.current,null);assert.deepEqual(start,before);
 // Read the already accepted prefix only as plain data. The thrown result is
 // not adopted, queried, saved, replayed or continued after this callback error.
});
