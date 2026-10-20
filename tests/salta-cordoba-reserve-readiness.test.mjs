import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {DEFAULT_WORLD} from '../campaigns/default.js';
import {operativeIdForCharacter} from '../game/content-character-ids.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {actBattle,presentedActBattle,presentedEndTurn,artilleryContact} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {dispatchCampaignSandbox} from '../game/campaign-editor-sandbox.js';
import {syncBattleTime} from '../game/time.js';
import {doctorRate} from '../game/medical-care.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {discoverRouteCache} from './finite-route-equipment.mjs';
import {replayPairedRouteOrders} from './paired-route-battle.mjs';
import {stageRouteRoofDefenders} from './route-roof-defenders.mjs';
import {prepareSaltaCordobaReserveReadiness,prepareSaltaRearClinicBatch,quoteSaltaRearFunding,saltaCordobaReserveEncounterExecutor} from './salta-cordoba-reserve-readiness.mjs';
import {prepareSaltaClinicSupply} from './salta-clinic-supply.mjs';

const key=(c,id)=>operativeIdForCharacter(c.contentCampaign.package,'person-'+id);
const clock=c=>c.hour*3600+(c.secondOfHour??0),order=(c,a)=>{const n=dispatchCampaign(c,a);assert.equal(n.lastError,null,JSON.stringify(a)+': '+n.lastError);return n;};
const saved=c=>{const n=decodeSave(encodeSave(c)).campaign;assert.deepEqual(n,c);return n;};
function setup({cash=200000,nearExpiry=false,roof=true,raid=false,ammo=200,workingDoctor=false}={}){
 const d=defaultContentPackage();d.headquarters='cordoba';d.scenario='generic-v1';d.includeOriginalResidents=false;d.world=structuredClone(DEFAULT_WORLD);d.rules.startingTreasury=cash;d.errands=[];d.quests=[];d.roadsideDiscoveries=[];d.campaignRoles={foundryEngineer:null,marchCommander:null};d.characters=d.characters.filter(op=>!/^person-(?:[0-8]|10|57)$/.test(op.id));d.placements=d.placements.filter(p=>['person-9','person-11'].includes(p.character));d.rules.deploymentCartridges=1;d.startingTerritory.tucuman.owner='patriot';d.startingTerritory.cordoba.owner='patriot';d.startingTerritory.retiro.owner='patriot';d.campaignStory={introduction:'Guardia de la posta.',victory:'Listo.',defeat:'Fin.',chapters:[{id:'later',name:'Más adelante',objective:'Continuar.',conditions:[{type:'day',min:100,max:null}]}],failureConditions:[]};
 // The raid control begins ten seconds before hour two of a midnight schedule.
 d.rules.startingHour=0;
 const theater=d.world.sectors.find(s=>s.id==='tucuman').theater;d.world.enemyStrategy={version:1,theaters:{[theater]:{legHours:1,reserve:3,raidEveryHours:raid?1:240,axis:['tucuman']}}};
 for(const op of d.characters){if(op.service==='contract')op.arrivalHours=0;op.startingSupplies={rations:0,torches:0,medkits:0,boleadoras:0};}
 for(const id of [100,101,103,105,108,110,113,114,115,116,117,118,119,120,123,125,128,131,134,135,136,138,140,142,144,145,146,147]){const op=d.characters.find(p=>p.id==='person-'+id);if(op)op.startingSupplies.medkits=2;}
 const medic=d.characters.find(p=>p.id==='person-107');medic.attributes={...medic.attributes,medical:88,leadership:70};medic.monthlyPay=420;
 const patient=d.characters.find(p=>p.id==='person-112');patient.attributes={...patient.attributes,maxHp:66,medical:94};patient.startingCondition={hp:20,bleeding:0,bandaged:46,energy:100,fatigue:0};patient.startingSupplies.medkits=2;
 if(workingDoctor){const op=d.characters.find(p=>p.id==='person-140');op.attributes={...op.attributes,medical:80};}
 const physician=d.characters.find(p=>p.id==='person-130');physician.attributes={...physician.attributes,medical:65};
 for(const [id,name]of [[9,'Oficial de la posta'],[11,'Oficial del parque']]){const op=d.characters.find(p=>p.id==='person-'+id);Object.assign(op,{recruitmentSource:'encounter',service:'permanent',progression:'experience',traits:[],monthlyPay:0,encounter:{recruitable:true,greeting:'Sirvo en esta posta.',requiredLeadership:50,requiredLiberated:0,requiredSector:'cordoba'}});delete op.arrivalHours;op.startingSupplies.medkits=2;d.placements=d.placements.filter(p=>p.character!==op.id);d.placements.push({id:'local-officer-'+id,character:op.id,mode:'fixed',sectors:['cordoba'],moveChance:100,afterDeath:null,delayMin:0,delayMax:0});}
 d.world.physical.caches.cordoba.contents=[{item:'inventory:ammo:musket_75',kind:'ammunition',ammoType:'musket_75',name:'Cartuchos',count:Math.max(1,ammo),weight:.04},{item:'inventory:ammo:rifle_62',kind:'ammunition',ammoType:'rifle_62',name:'Cartuchos de rifle',count:Math.max(1,ammo),weight:.04},{item:'inventory:ammo:pistol_69',kind:'ammunition',ammoType:'pistol_69',name:'Cartuchos de pistola',count:Math.max(1,ammo),weight:.04}];
 d.world.physical.arsenals.cordoba={version:1,sector:'cordoba',chest:d.world.physical.caches.cordoba.chest,pieces:[{id:'arsenal:declared-cordoba:1',type:'bronze4',side:'player',loaded:true,ammo:2}]};
 d.world.physical.caches.cordoba.contents.push({item:'inventory:ammo:shot_16',kind:'ammunition',ammoType:'shot_16',name:'Cargas de perdigones',count:Math.max(1,ammo),weight:.04});assert.deepEqual(validateContentPackage(d),[]);const declaration=structuredClone(d);let c=initialCampaign(42,d);
 c=order(c,{type:'recruitCivic',id:key(c,102),term:nearExpiry?'day':'week',destination:'cordoba'});c=order(c,{type:'createSquad',sector:'cordoba',ids:[key(c,102)],name:'Reserva existente'});c=discoverRouteCache(c,key(c,102));if(roof)c=stageRouteRoofDefenders(c,[key(c,102)]);if(workingDoctor){c=order(c,{type:'recruitCivic',id:key(c,140),term:'week',destination:'cordoba'});c=order(c,{type:'squad',ids:[key(c,102),key(c,140)]});c=order(c,{type:'visitSector'});const home=enterSector(c.pendingBattle,c.sectorStates.cordoba);c=order(c,{type:'leaveSector',battleId:c.pendingBattle.id,sectorState:home,survivors:home.units.filter(u=>u.side==='player')});c=order(c,{type:'assignCare',operativeId:key(c,140),assignment:'doctor'});}
 for(const id of [112,130])c=order(c,{type:'recruitCivic',id:key(c,id),term:'week',destination:'tucuman'});c=order(c,{type:'createSquad',sector:'tucuman',ids:[key(c,112),key(c,130)],name:'Clínica existente'});c=order(c,{type:'visitSector'});const clinic=enterSector(c.pendingBattle,c.sectorStates.tucuman);c=order(c,{type:'leaveSector',battleId:c.pendingBattle.id,sectorState:clinic,survivors:clinic.units.filter(u=>u.side==='player')});
 for(const id of [121,124,126,127,129,132]){c=order(c,{type:'recruitCivic',id:key(c,id),term:'week',destination:'retiro'});c=order(c,{type:'createSquad',sector:'retiro',ids:[key(c,id)],name:'Columna '+id});}
 assert.equal(c.squads.filter(q=>q.members.length).length,8);const selected=c.activeSquadId;
 if(nearExpiry||raid){const until=nearExpiry?clock(c)+23*3600:2*3600-10;for(let n=0;clock(c)<until&&n<30;n++)c=order(c,{type:'advanceStrategicTime',seconds:Math.min(3600,until-clock(c))});assert.equal(clock(c),until);}
 assert.deepEqual(d,declaration);return {campaign:saved(c),selected};
}
const run=(c,options={})=>prepareSaltaCordobaReserveReadiness(c,{deadlineSeconds:clock(c)+72*3600,...options});
function replay(start,result){let c=structuredClone(start),b=null,shown=null,stored=null;for(const row of result.receipt.orders){if(row.kind==='campaign'){if(row.action.type==='leaveSector')assert.deepEqual(row.action.sectorState,b);c=order(c,row.action);if(row.action.type==='visitSector'){b=enterSector(c.pendingBattle,c.sectorStates[c.pendingBattle.sector]);shown=structuredClone(b);stored=validateBattleSnapshot(JSON.parse(JSON.stringify(b)));}if(row.action.type==='leaveSector')b=null;}else if(row.kind==='sandbox'){const next=dispatchCampaignSandbox({version:1,history:[],campaign:c,battle:b},row.action);assert.equal(next.lastError,null);c=next.campaign;b=next.battle;shown=structuredClone(b);stored=validateBattleSnapshot(JSON.parse(JSON.stringify(b)));const pair=decodeSave(encodeSave(c,b));assert.deepEqual(pair,{campaign:c,battle:b});c=pair.campaign;b=pair.battle;}else{b=actBattle(b,row.action);assert.equal(b.lastError,null);shown=presentedActBattle(shown,JSON.parse(JSON.stringify(row.action))).state;stored=validateBattleSnapshot(JSON.parse(JSON.stringify(actBattle(stored,JSON.parse(JSON.stringify(row.action))))));assert.deepEqual(shown,b);assert.deepEqual(stored,b);const direct=syncBattleTime(c,b),visible=syncBattleTime(c,shown),decoded=syncBattleTime(c,stored);assert.equal(direct.error,null);assert.deepEqual(visible,direct);assert.deepEqual(decoded,direct);c=direct.campaign;b=direct.battle;shown=visible.battle;stored=decoded.battle;}}assert.deepEqual(saved(c),result.campaign);}

test('eight occupied groups admit a real one-squad rear, actual local officer meetings, finite charged crew and paid roof cover while local clinic care is active',()=>{
 const {campaign:start,selected}=setup(),before=structuredClone(start),result=run(start),c=result.campaign,r=result.receipt;
 assert.equal(c.squads.filter(q=>q.members.length).length,8);assert.equal(r.ids.length,6);assert.equal(r.meetings.length,2);assert.equal(r.hires.length,3);assert.ok(r.orders.every(row=>row.action?.type!=='createSquad'));assert.equal(c.activeSquadId,selected);assert.deepEqual(c.squad,start.squad);assert.equal(c.location,start.location);assert.equal(c.operativeState[key(c,130)].assignment,'doctor');assert.equal(c.operativeState[key(c,112)].assignment,'patient');assert.ok(c.operativeState[key(c,112)].hp>=start.operativeState[key(start,112)].hp);assert.deepEqual(c.operativeState[key(c,102)].residentPosition,start.operativeState[key(start,102)].residentPosition);
 const firstTime=r.orders.findIndex(row=>row.kind==='battle');assert.ok(firstTime>=0);for(const id of [key(c,112),key(c,130)])assert.ok(r.orders.slice(0,firstTime).some(row=>row.action?.type==='assignCare'&&row.action.operativeId===id));
 assert.equal(c.resources.treasury,start.resources.treasury-r.hires.reduce((n,row)=>n+row.quote.total,0)-r.renewals.reduce((n,row)=>n+row.quote.price,0));for(const row of r.hires){assert.equal(c.contracts[row.id].paid,row.quote.price);assert.ok(c.recruited.includes(row.id));assert.equal(c.operativeState[row.id].location,'cordoba');}assert.ok(r.funding.every(q=>q.available&&q.clinicCost>=0&&q.fieldCost>0));
 const gun=r.prepared.artillery.find(g=>g.side==='player');assert.ok(gun.loaded);assert.equal(gun.ammo,2);assert.equal(r.crewIds.length,2);for(const id of r.crewIds)assert.equal(artilleryContact(r.prepared,r.prepared.units.find(u=>u.id===String(id)),gun),true);assert.equal(c.operativeState[r.physicianId].medkits,2);assert.ok(!r.crewIds.includes(r.physicianId));assert.ok(clock(c)>clock(start));assert.ok(clock(c)<=r.deadlineSeconds);assert.deepEqual(start,before);replay(start,result);assert.deepEqual(run(saved(start)),result);
});

test('a ground rear and its old exact-second duty use actual finite ammunition and real paid renewal without another squad',()=>{
 const {campaign:start}=setup({nearExpiry:true,roof:false}),before=structuredClone(start),result=run(start),c=result.campaign;
 assert.ok(result.receipt.renewals.some(row=>row.id===key(start,102)));assert.ok(contractExpiresSeconds(c.contracts[key(c,102)])>clock(c));assert.equal(c.contracts[key(c,102)].guaranteeId,start.contracts[key(start,102)].guaranteeId);assert.ok(result.receipt.orders.some(row=>row.action?.type==='sectorInventory'&&row.action.direction==='take'));assert.deepEqual(start,before);replay(start,result);
});

test('the joint rear quote refuses a cash shortage before paid hiring and protects the later field and finite clinic roles',()=>{
 const {campaign:start}=setup({cash:65000}),before=structuredClone(start);let failure;try{run(start);}catch(error){failure=error;}
 assert.match(failure?.message??'',/treasury|quoted|finite paid clinic|twelve-person|current renewal/i);assert.equal(failure.saltaCordobaReadiness.hires.length,0);assert.ok(!failure.saltaCordobaReadiness.orders.some(row=>row.action?.type==='recruitCivic'));assert.equal(failure.campaign.resources.treasury,start.resources.treasury);assert.deepEqual(start,before);
});

test('a real absolute deadline refuses roof preparation without creating a second clinic allowance',()=>{
 const {campaign:start}=setup(),before=structuredClone(start),deadlineSeconds=clock(start)+10;let failure;try{run(start,{deadlineSeconds});}catch(error){failure=error;}
 assert.match(failure?.message??'',/retained hour|clinical deadline/);assert.ok(clock(failure.campaign)<=deadlineSeconds);assert.deepEqual(start,before);assert.ok(failure.campaign);assert.ok(failure.saltaCordobaReadiness.orders.length);
});

test('a real raid interrupts preparation with its actual accepted booking, pending encounter and paired partial state',()=>{
 const {campaign:start}=setup({raid:true,roof:false}),before=structuredClone(start);let failure;try{run(start);}catch(error){failure=error;}
 assert.ok(failure);assert.match(failure.message,/raid|encounter/i);assert.ok(failure.campaign.pendingEncounter);assert.deepEqual(start,before);const state=failure.saltaCordobaReadiness;assert.equal(failure.campaign.lastError,null);if(state.battle)assert.equal(failure.campaign.pendingBattle?.id,state.battle.battleId);else assert.equal(failure.campaign.pendingBattle,null);if('battle' in failure)assert.equal(failure.battle??null,state.battle??null);if(failure.pair){assert.equal(failure.pair.campaign,failure.campaign);assert.equal(failure.pair.battle,state.battle??null);}assert.ok(state.orders.some(row=>row.action?.type==='recruitCivic'));
});


test('the quoted local batch preserves the Córdoba doctor and supplies actual wounds inside eight groups before the older courier can legitimately no-op',()=>{
 const {campaign:start}=setup(),rear=run(start),before=structuredClone(rear.campaign),deadlineSeconds=rear.receipt.deadlineSeconds,result=prepareSaltaRearClinicBatch(rear.campaign,{rearIds:rear.receipt.ids,deadlineSeconds}),c=result.campaign,r=result.receipt,doctor=key(c,130);
 assert.equal(r.doctorId,doctor);assert.ok(r.hires.length>0);assert.ok(r.hires.every(row=>r.funding.clinicOffers.some(offer=>offer.id===row.id)));assert.equal(c.squads.filter(q=>q.members.length).length,8);assert.equal(c.activeSquadId,before.activeSquadId);assert.deepEqual(c.squad,before.squad);for(const id of rear.receipt.ids){assert.equal(c.operativeState[id].location,'cordoba');assert.deepEqual(c.operativeState[id].residentPosition,before.operativeState[id].residentPosition);assert.equal(c.operativeState[id].medkits,before.operativeState[id].medkits);}
 const remaining=r.patients.reduce((n,id)=>n+Math.max(Number(c.operativeState[id].bleeding>0),Math.ceil((c.operativeState[id].maxHp-c.operativeState[id].hp)/doctorRate(rosterFor(c).find(op=>op.id===doctor),c))),0);assert.ok(c.operativeState[doctor].medkits>=Math.max(2,remaining));assert.ok(c.operativeState[doctor].medkits<=r.target);for(const row of r.hires)assert.ok(c.operativeState[row.id].medkits>=1,'Each new supplied serving donor retains its final dressing.');assert.equal(c.operativeState[key(c,112)].medkits,1);assert.equal(c.operativeState[doctor].assignment,'doctor');assert.equal(c.operativeState[key(c,112)].assignment,'patient');assert.ok(clock(c)<=deadlineSeconds);assert.ok(r.care.every(row=>row.from>=clock(before)&&row.to<=deadlineSeconds));
 const old=prepareSaltaClinicSupply(c,{deadlineSeconds,protectedRearIds:rear.receipt.ids});assert.equal(old.receipt.needed,false);assert.deepEqual(old.campaign,c);assert.deepEqual(rear.campaign,before);
 const rows=[...r.actions.map(row=>({...row,kind:row.tactical?'battle':'campaign'})),...r.orders.map(row=>({...row,kind:'campaign'}))];replay(before,{campaign:c,receipt:{orders:rows}});assert.deepEqual(prepareSaltaRearClinicBatch(saved(before),{rearIds:rear.receipt.ids,deadlineSeconds}),result);
});

test('an existing working Córdoba doctor remains outside every free-guard recomputation and keeps its last finite dressing',()=>{
 const {campaign:start}=setup({workingDoctor:true}),before=structuredClone(start),id=key(start,140),result=run(start),c=result.campaign;
 assert.ok(start.operativeState[id].residentPosition);assert.equal(start.operativeState[id].residentPosition.tacticalLevel??0,0);assert.ok(!result.receipt.ids.includes(id));assert.ok(!result.receipt.crewIds.includes(id));assert.deepEqual(c.operativeState[id].residentPosition,start.operativeState[id].residentPosition);assert.ok(!result.receipt.orders.some(row=>row.kind==='battle'&&row.action.unitId===String(id)));assert.equal(c.operativeState[id].assignment,'doctor');assert.equal(c.operativeState[id].location,'cordoba');assert.ok(c.operativeState[id].medkits>=1);assert.ok(!result.receipt.orders.some(row=>row.action?.type==='assignCare'&&row.action.operativeId===id));assert.deepEqual(start,before);assert.deepEqual(saved(c),c);
});


test('the joint current quote preserves the later Salta policy residual250 at its exact cash boundary',()=>{
 const {campaign:base}=setup(),before=structuredClone(base),options=c=>({rearIds:[key(c,102)],paidOffers:[{op:rosterFor(c).find(op=>op.id===key(c,107)),quote:contractQuote(c,rosterFor(c).find(op=>op.id===key(c,107)),'week')}],deadlineSeconds:clock(c)+72*3600}),quoted=quoteSaltaRearFunding(base,options(base));
 assert.equal(quoted.available,true);assert.equal(quoted.fieldReserve,250);assert.equal(quoted.fixedCost,quoted.rearCost+quoted.clinicCost+quoted.fieldCost+250);assert.deepEqual(base,before);
 const prefixCost=200000-base.resources.treasury,{campaign:short}=setup({cash:prefixCost+quoted.totalCost-1}),shortBefore=structuredClone(short),refused=quoteSaltaRearFunding(short,options(short));assert.equal(refused.available,false);assert.equal(refused.shortfall,1);assert.deepEqual(short,shortBefore);
 const {campaign:exact}=setup({cash:prefixCost+quoted.totalCost}),exactBefore=structuredClone(exact),accepted=quoteSaltaRearFunding(exact,options(exact));assert.equal(accepted.available,true);assert.equal(accepted.shortfall,0);assert.equal(accepted.totalCost,exact.resources.treasury);assert.deepEqual(exact,exactBefore);
});

function cordobaRaid(){
 const d=scaffoldDocuments('declared-cordoba-paired-reserve');for(const name of ['content','world','maps'])d[name]=JSON.parse(JSON.stringify(d[name]).replaceAll('watch-post','cordoba'));
 const base=d.content.characters[0],rifle=defaultContentPackage().weapons.find(w=>w.template===1800);d.content.rules.startingTreasury=10000;d.content.rules.deploymentCartridges=8;d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];d.content.startingTerritory.cordoba.owner='patriot';d.world.arrivalFacilities.cordoba=['barracks'];d.content.arrivalSites.push({sector:'cordoba',facilities:['barracks']});d.world.enemyStrategy={version:1,theaters:{frontier:{legHours:1,reserve:3,raidEveryHours:6,axis:['cordoba']}}};d.world.expansion.buildingTargets.cordoba=0;
 d.maps.cordoba.upperSurfaces=Array.from({length:20},(_,i)=>({id:'cordoba-roof-'+i,x:8+i%4,y:4+Math.floor(i/4),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:20}));d.maps.cordoba.climbLinks=[{id:'cordoba-access',kind:'climb',from:{x:8,y:9,tacticalLevel:0},to:{x:8,y:8,tacticalLevel:1}}];d.content.weapons.push({...structuredClone(rifle),id:'cordoba-rifle',art:base.portrait});d.content.characters=Array.from({length:6},(_,i)=>({...structuredClone(base),id:'rear-'+i,name:'Reserva '+i,nickname:'Reserva '+i,monthlyPay:300,arrivalHours:0,weapon:'cordoba-rifle',attributes:{...base.attributes,marksmanship:i===0?45:95,medical:i===0?95:0},startingSupplies:{rations:0,torches:0,medkits:i===0?3:0,boleadoras:0}}));
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);let c=initialCampaign(42,content);const ids=rosterFor(c).map(op=>op.id);for(const id of ids){const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'week'),cash=c.resources.treasury;c=order(c,{type:'recruitCivic',id,term:'week',destination:'cordoba'});assert.equal(cash-c.resources.treasury,quote.total);}c=order(c,{type:'createSquad',sector:'cordoba',ids,name:'Reserva admitida'});c=stageRouteRoofDefenders(c,ids);for(let n=0;!c.pendingEncounter&&n<10;n++)c=order(c,{type:'wait',hours:1});assert.equal(c.pendingEncounter?.sector,'cordoba');c=order(c,{type:'respondToEncounter',groupId:c.pendingEncounter.groupId,choice:'tactical'});const battle=enterSector(c.pendingBattle,c.sectorStates.cordoba);assert.deepEqual(decodeSave(encodeSave(c,battle)),{campaign:c,battle});assert.deepEqual(d,declaration);return c;
}

test('only an actually prepared Córdoba response admits fresh hospital roles and one synchronized Native pair per execution and official replay',()=>{
 const start=cordobaRaid(),before=structuredClone(start),request=start.pendingBattle,previous=start.sectorStates.cordoba,explicit=()=>null;
 assert.equal(saltaCordobaReserveEncounterExecutor(start,'cordoba'),undefined);assert.equal(saltaCordobaReserveEncounterExecutor(start,'cordoba',{ready:true,encounterController:explicit}),undefined);assert.equal(saltaCordobaReserveEncounterExecutor(start,'tucuman',{ready:true}),undefined);
 const execute=saltaCordobaReserveEncounterExecutor(start,'cordoba',{ready:true});assert.equal(typeof execute,'function');const result=execute(request,previous,{}),again=execute(request,previous,{});assert.equal(result.battle.status,'victory');assert.ok(result.orders.some(a=>a.type==='fire'));assert.equal(result.battle,result.pair.battle);assert.equal(result.battle.elapsedSeconds,result.battle.syncedSeconds);assert.deepEqual(again,result);assert.deepEqual(replayPairedRouteOrders(start,request,previous,result.orders),result.pair);
 let pair=syncBattleTime(start,enterSector(request,previous));assert.equal(pair.error,null);for(const action of result.orders){const shown=action.type==='endTurn'?presentedEndTurn(pair.battle).state:presentedActBattle(pair.battle,action).state,battle=validateBattleSnapshot(JSON.parse(JSON.stringify(shown)));pair=syncBattleTime(pair.campaign,battle);assert.equal(pair.error,null);}assert.deepEqual({campaign:pair.campaign,battle:pair.battle},result.pair);assert.deepEqual(decodeSave(encodeSave(result.pair.campaign,result.pair.battle)),result.pair);assert.deepEqual(start,before);
});
