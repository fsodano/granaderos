import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {validateContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {careAssignmentIssue} from '../game/medical-care.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {createBattle,actBattle,presentedActBattle,artilleryCrewPlan} from '../game/tactical.js';
import {sameCell} from '../game/tactical-space.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {discoverRouteCache} from './finite-route-equipment.mjs';
import {stageRouteRoofDefenders} from './route-roof-defenders.mjs';
import {prepareNorthernHospitalFortification} from './northern-hospital-fortification.mjs';
import {prepareCordobaMedicalRear,restageCordobaMedicalRear} from './cordoba-medical-rear-guard.mjs';
import {refreshCordobaClinicReadiness,cordobaClinicGroundCrew,cordobaClinicDefenseOrder,cordobaClinicDonationCount,collectCordobaClinicDressings} from './cordoba-clinic-combat-readiness.mjs';
import {recoverFreshCordobaSurvivors} from './fresh-campaign-route.mjs';

const sector='cordoba',clock=c=>c.hour*3600+(c.secondOfHour??0),order=(c,a)=>{const next=dispatchCampaign(c,a);assert.equal(next.lastError,null,JSON.stringify(a)+': '+next.lastError);return next;};
const saved=c=>{const restored=decodeSave(encodeSave(c)).campaign;assert.deepEqual(restored,c);return restored;};

// Every actor, wound, skill, finite cache and canonical gun is declared before
// compilation and the factory. Knowledge, paid service, fortification, roof
// posts and a dropped primary are earned only with accepted ordinary orders.
function setup({kits=3,reserveMedical=90,crewMedical=0,clinicalCrew=false,nearExpiry=false,raid=false,drop=true,discover=true,relief=false,reliefPay=300,cacheContents=[]}={}){
 const d=scaffoldDocuments('cordoba-clinic-combat-readiness');
 for(const key of ['content','world','maps'])d[key]=JSON.parse(JSON.stringify(d[key]).replaceAll('watch-post',sector));
 const base=d.content.characters[0];d.content.rules.startingTreasury=20000;d.content.rules.deploymentCartridges=12;
 d.content.startingTerritory[sector].owner='patriot';d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];
 d.world.expansion.buildingTargets={camp:0,[sector]:0};d.world.arrivalFacilities[sector]=['barracks'];d.content.arrivalSites.push({sector,facilities:['barracks']});
 d.content.weapons.push({id:'clinic-rifle',template:1800,name:'Fusil de la reserva',damage:40,fireAP:25,aimAP:5,reloadAP:40,range:20,readyAP:5,weight:4,price:100,art:base.portrait});
 d.content.characters=Array.from({length:relief?7:6},(_,i)=>({...structuredClone(base),id:'clinic-'+i,name:'Persona '+i,nickname:'Persona '+i,monthlyPay:i===6?reliefPay:300,arrivalHours:0,weapon:'clinic-rifle',
  attributes:{...base.attributes,maxHp:70,marksmanship:35+i*5,medical:i===0?94:i===1?reserveMedical:i===6?20:[2,3].includes(i)?clinicalCrew?70:crewMedical:0},
  startingSupplies:{rations:0,torches:0,medkits:i===0?kits:i===6?2:0,boleadoras:0},startingCondition:{hp:i===4?50:70,bleeding:0,bandaged:i===4?20:0,energy:100,fatigue:0}}));
 d.maps[sector].props=[{id:'clinic-arsenal-chest',type:'chest',x:5,y:12,footprint:{width:1,height:1},blocksMovement:true}];
 d.world.physical.caches[sector]={chest:'clinic-arsenal-chest',contents:structuredClone(cacheContents)};
 d.world.physical.arsenals[sector]={version:1,sector,chest:'clinic-arsenal-chest',pieces:[{id:'arsenal:clinic:1',type:'bronze4',side:'player',loaded:true,ammo:2}]};
 d.maps[sector].upperSurfaces=Array.from({length:24},(_,i)=>({id:'clinic-roof-'+i,x:8+i%6,y:5+Math.floor(i/6),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:25}));
 d.maps[sector].climbLinks=[{id:'clinic-access',kind:'climb',from:{x:8,y:9,tacticalLevel:0},to:{x:8,y:8,tacticalLevel:1}}];
 d.world.enemyStrategy={version:1,theaters:{frontier:{legHours:1,reserve:raid?3:0,raidEveryHours:raid?1:240,axis:[sector]}}};
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);let c=initialCampaign(42,content);
 const ids=rosterFor(c).map(op=>op.id),hires=[];
 for(const id of ids.slice(0,6)){const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury;c=order(c,{type:'recruitCivic',id,term:'day',destination:id===ids[5]?'camp':sector});assert.equal(c.resources.treasury,cash-quote.total);hires.push({id,quote});}
 c=order(c,{type:'createSquad',ids:ids.slice(0,5),sector,name:'Clínica y guardia'});if(discover){c=discoverRouteCache(c,ids[0]);assert.equal(c.sectorStates[sector].artillery.length,1);}
 c=prepareNorthernHospitalFortification(c,{sector}).campaign;c=stageRouteRoofDefenders(c,ids.slice(0,4));
 for(const id of ids.slice(0,4))c=order(c,{type:'assignCare',operativeId:id,assignment:'rest'});c=order(c,{type:'assignCare',operativeId:ids[4],assignment:'rest'});
 if(drop)c=order(c,{type:'sectorInventory',sector,operativeId:ids[2],direction:'drop',item:'primary'});
 c=order(c,{type:'createSquad',ids:[ids[5]],sector:'camp',name:'Servicio exterior'});const selected=c.activeSquadId;
 if(nearExpiry){const target=Math.min(...ids.map(id=>contractExpiresSeconds(c.contracts[id])))-10;for(let n=0;clock(c)<target&&n<32;n++)c=order(c,{type:'advanceStrategicTime',seconds:Math.min(3600,target-clock(c))});assert.equal(clock(c),target);}
 if(raid){for(let n=0;!c.enemyGroups.some(g=>g.status==='marching'&&g.target===sector)&&n<3;n++)c=order(c,{type:'wait',hours:1});const threat=c.enemyGroups.find(g=>g.status==='marching'&&g.target===sector);assert.ok(threat);const target=threat.arrivalAt*3600-2;for(let n=0;clock(c)<target&&n<12;n++)c=order(c,{type:'advanceStrategicTime',seconds:Math.min(3600,target-clock(c))});assert.equal(clock(c),target);assert.equal(c.pendingEncounter,null);}
 assert.deepEqual(d,declaration);return {campaign:saved(c),ids,hires,selected};
}
const run=(c,ids,options={})=>refreshCordobaClinicReadiness(c,ids[0],{deadlineSeconds:clock(c)+3600,...options});
const totalKits=c=>c.recruited.reduce((sum,id)=>sum+c.operativeState[id].medkits,0)+(c.sectorStates[sector].groundItems??[]).filter(row=>row.type==='medkits').reduce((sum,row)=>sum+row.count,0);

// This independent safe clinic declares every person, wound and finite issue
// before the factory. Twelve paid locals avoid the route's reinforcement path.
function recoveryRestSetup(){
 const d=JSON.parse(JSON.stringify(scaffoldDocuments('cordoba-selected-patient-rest')).replaceAll('watch-post',sector));
 const base=d.content.characters[0];d.content.rules.startingTreasury=20000;d.content.startingTerritory[sector].owner='patriot';
 d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];d.world.expansion.buildingTargets={camp:0,[sector]:0};
 d.world.arrivalFacilities[sector]=['barracks'];d.content.arrivalSites.push({sector,facilities:['barracks']});
 d.content.characters=Array.from({length:12},(_,i)=>({...structuredClone(base),id:'rest-clinic-'+i,name:'Persona '+i,nickname:'Persona '+i,monthlyPay:300,arrivalHours:0,weapon:null,
  attributes:{...base.attributes,maxHp:80,medical:i===0?94:i===1?90:0},
  startingSupplies:{rations:0,torches:0,boleadoras:0,medkits:i===0||i===1?1:i===4?15:0},
  startingCondition:{hp:i===2?16:i===3?68:80,bleeding:0,bandaged:0,energy:100,fatigue:0}}));
 d.maps[sector].upperSurfaces=Array.from({length:24},(_,i)=>({id:'rest-roof-'+i,x:8+i%6,y:5+Math.floor(i/6),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:25}));
 d.maps[sector].climbLinks=[{id:'rest-access',kind:'climb',from:{x:8,y:9,tacticalLevel:0},to:{x:8,y:8,tacticalLevel:1}}];
 d.world.enemyStrategy={version:1,theaters:{frontier:{legHours:1,reserve:0,raidEveryHours:240,axis:[sector]}}};
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);let c=initialCampaign(42,content);
 const ids=rosterFor(c).map(op=>op.id),hires=[];
 for(const id of ids){const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'week'),cash=c.resources.treasury;c=order(c,{type:'recruitCivic',id,term:'week',destination:sector});assert.equal(c.resources.treasury,cash-quote.total);hires.push({id,quote});}
 for(let i=0;i<ids.length;i+=6)c=order(c,{type:'createSquad',ids:ids.slice(i,i+6),sector,name:'Recuperación local'});
 assert.equal(c.recruited.length,12);assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);assert.deepEqual(d,declaration);
 return {campaign:saved(c),ids,hires};
}

test('one finite physician treats one patient while another stable wound earns six uninterrupted hours of real rest',()=>{
 const {campaign:start,ids}=recoveryRestSetup(),before=structuredClone(start),events=[];
 const initialKits=start.recruited.reduce((sum,id)=>sum+start.operativeState[id].medkits,0);assert.equal(initialKits,17);
 const c=recoverFreshCordobaSurvivors(start,{report:event=>events.push(event)}),ticks=events.filter(event=>event.event==='cordobaRecoveryCareHour'&&event.to-event.from===3600);
 assert.ok(ticks.length>=6);const sixth=ticks[5].records,treated=sixth.find(r=>r.id===ids[2]),rested=sixth.find(r=>r.id===ids[3]);
 assert.ok(treated.hp>start.operativeState[ids[2]].hp);assert.equal(rested.hp,start.operativeState[ids[3]].hp+1);assert.equal(rested.assignment,'rest');assert.equal(rested.recoveryHours,0);
 for(const tick of ticks){assert.ok(tick.records.filter(r=>r.assignment==='patient').length<=1);assert.equal(tick.records.find(r=>r.id===ids[1]).medkits,1);}
 assert.ok(ticks.some(tick=>tick.records.find(r=>r.id===ids[0]).medkits>1),'Actual finite collection must refill the initially one-kit physician.');
 assert.ok(c.operativeState[ids[4]].medkits<15,'The local donor must pay the real finite handover.');
 const spent=[ids[0],ids[4]].reduce((sum,id)=>sum+start.operativeState[id].medkits-c.operativeState[id].medkits,0);
 assert.ok(spent>0&&spent<=16);assert.equal(totalKits(c),initialKits-spent);assert.equal(c.operativeState[ids[1]].medkits,1);
 for(const id of ids){assert.equal(c.operativeState[id].alive,true);assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);assert.equal(c.operativeState[id].bleeding,0);}
 assert.equal(c.resources.treasury,start.resources.treasury-450);assert.deepEqual(c.contracts,start.contracts);assert.deepEqual(start,before);saved(c);
});

test('paid roof guards recover their actual dropped primary, reserve one owned dressing and walk to a complete finite cannon without changing other clinic posts',()=>{
 const {campaign:start,ids,selected}=setup(),before=structuredClone(start),gun=structuredClone(start.sectorStates[sector].artillery[0]);
 const source=sectorInventoryModel(start,sector,rosterFor(start),ids[2]).entries.find(row=>row.reachable&&JSON.parse(row.expected).weapon);assert.ok(source);
 const r=run(start,ids),c=r.campaign;assert.equal(r.receipt.supplied,true);assert.equal(r.receipt.doctorId,ids[1]);assert.equal(c.operativeState[ids[1]].medkits,1);assert.equal(c.operativeState[ids[0]].medkits,2);assert.equal(totalKits(c),totalKits(start));
 assert.equal(c.operativeState[ids[2]].weaponDropped,false);assert.deepEqual(r.receipt.primaries,[ids[2]]);assert.ok(!sectorInventoryModel(c,sector,rosterFor(c),ids[2]).entries.some(row=>row.key===source.key&&row.count>0));
 assert.deepEqual(r.receipt.crewIds,ids.slice(2,4));assert.deepEqual(cordobaClinicGroundCrew(c),ids.slice(2,4));assert.equal(new Set(r.receipt.positions.map(p=>JSON.stringify([p.x,p.y,p.tacticalLevel??0]))).size,2);
 assert.ok(r.receipt.orders.some(row=>row.action.type==='climb'));assert.ok(r.receipt.orders.some(row=>row.action.type==='move'));for(const p of r.receipt.positions){assert.equal(p.tacticalLevel??0,0);assert.ok(!sameCell(p,gun));assert.ok(Math.hypot(p.x-gun.x,p.y-gun.y)<=1.5);}
 assert.deepEqual(c.sectorStates[sector].artillery,[gun]);assert.equal(c.sectors[sector].fort,3);assert.deepEqual(c.squads,start.squads);assert.equal(c.activeSquadId,selected);assert.equal(c.resources.treasury,start.resources.treasury);assert.deepEqual(c.contracts,start.contracts);
 for(const id of ids.filter(id=>![ids[2],ids[3]].includes(id)))assert.deepEqual(c.operativeState[id].residentPosition,start.operativeState[id].residentPosition);
 assert.ok(clock(c)>clock(start)&&clock(c)<=r.receipt.until);assert.deepEqual(start,before);assert.deepEqual(run(saved(start),ids),r);saved(c);
 const staged=restageCordobaMedicalRear(c,{deadlineSeconds:clock(c)+3600,preserveGroundCrew:true});for(const id of r.receipt.crewIds){assert.ok(!staged.receipt.ids.includes(id));assert.deepEqual(staged.campaign.operativeState[id].residentPosition,c.operativeState[id].residentPosition,'Opted-in restaging must keep the real complete ground crew.');}assert.deepEqual(staged.campaign.sectorStates[sector].artillery,c.sectorStates[sector].artillery);saved(staged.campaign);
});

test('the actual clinical donation rule preserves the last rear dressing while two real treatment hours debit only the treating physician',()=>{
 const s=setup(),r=run(s.campaign,s.ids);let c=r.campaign;const [doctor,reserve,,,patient]=s.ids,startKits=totalKits(c),startHP=c.operativeState[patient].hp;
 assert.equal(cordobaClinicDonationCount(c,reserve,reserve),0);assert.equal(cordobaClinicDonationCount(c,doctor,reserve),2);
 c=order(c,{type:'assignCare',operativeId:patient,assignment:'patient'});c=order(c,{type:'assignCare',operativeId:doctor,assignment:'doctor'});
 const began=clock(c);for(let n=0;n<2;n++)c=order(c,{type:'wait',hours:1});assert.equal(clock(c)-began,7200);assert.equal(totalKits(c),startKits-2);assert.equal(c.operativeState[reserve].medkits,1);assert.ok(c.operativeState[patient].hp>startHP);assert.equal(c.operativeState[doctor].medkits,0);saved(c);
});

test('an empty known reserve reports a real shortage and local discovery returns its accepted prefix without a hidden source or refill',()=>{
 const s=setup({kits:0,drop:false,discover:false}),before=structuredClone(s.campaign),r=run(s.campaign,s.ids);assert.equal(r.receipt.supplied,false);assert.equal(r.receipt.reason,'finite-reserve-empty');assert.deepEqual(r.receipt.orders,[]);assert.equal(r.campaign,s.campaign);assert.deepEqual(r.campaign,before);assert.equal(r.campaign.sectorStates[sector].props.find(p=>p.id==='clinic-arsenal-chest').open,false);
 const local=collectCordobaClinicDressings(r.campaign,s.ids[0],2);assert.equal(local.supplied,false);assert.equal(local.collected,0);assert.equal(local.source,null);assert.ok(clock(local.campaign)>clock(r.campaign));assert.equal(local.campaign.sectorStates[sector].props.find(p=>p.id==='clinic-arsenal-chest').open,true);assert.equal(totalKits(local.campaign),0);assert.deepEqual(s.campaign,before);saved(local.campaign);
});

test('a missing complete nonclinical crew leaves the real gun unchanged instead of borrowing a physician or patient',()=>{
 const s=setup({clinicalCrew:true}),r=run(s.campaign,s.ids);assert.equal(r.receipt.supplied,true);assert.equal(r.receipt.reason,'no-complete-ground-crew');assert.deepEqual(r.receipt.crewIds,[]);assert.deepEqual(r.campaign.sectorStates[sector].artillery,s.campaign.sectorStates[sector].artillery);assert.ok(r.receipt.orders.every(row=>row.action.type==='sectorInventory'));assert.deepEqual(cordobaClinicGroundCrew(r.campaign),[]);saved(r.campaign);
});

test('the recovery cannon policy spends the real loaded shot and retains Native friendly-fire and physician-crew exclusions',()=>{
 for(const variant of ['finite-shot','bystander','physician-helper']){
  const players=[{id:'crew-1',x:2,y:2,medical:0,weapon:1813,ammo:0,morale:100},{id:'crew-2',x:3,y:2,medical:variant==='physician-helper'?90:0,weapon:1813,ammo:0,morale:100}];
  const enemies=[{id:'observed-raider',x:11,y:3,weapon:1813,ammo:0,hp:100,maxHp:100,morale:100,patrol:false}],npcs=variant==='bystander'?[{id:'bystander',name:'Habitante',hp:100,x:9,y:3}]:[];
  const tiles=Array.from({length:480},(_,i)=>({x:i%40,y:Math.floor(i/40),type:'grass',blocked:false,cover:0})),declaration={width:40,height:12,hour:12,seed:45,tiles,enemies,npcs,artillery:[{id:'declared-cannon',type:'bronze4',side:'player',x:3,y:3,loaded:true,ammo:2}]};
  const battle=createBattle(players,declaration),before=structuredClone(battle),u=battle.units.find(unit=>unit.id==='crew-1'),action=cordobaClinicDefenseOrder(battle,u);
  if(variant!=='finite-shot'){assert.ok(!['artillery','artilleryPivot','artilleryReload'].includes(action?.type));assert.deepEqual(battle,before);continue;}
  assert.ok(['artillery','artilleryPivot'].includes(action?.type));assert.equal(artilleryCrewPlan(battle,u,battle.artillery[0],1,true).reason,null);
  let next=actBattle(battle,action);assert.equal(next.lastError,null);if(action.type==='artilleryPivot'){const shot=cordobaClinicDefenseOrder(next,next.units.find(unit=>unit.id===u.id));assert.equal(shot.type,'artillery');next=actBattle(next,shot);assert.equal(next.lastError,null);}
  assert.equal(next.artillery[0].loaded,false);assert.equal(next.artillery[0].ammo,2);assert.ok(next.units.find(unit=>unit.id==='observed-raider').hp<100);assert.ok(next.units.filter(unit=>unit.side==='player').every(unit=>unit.hp===before.units.find(old=>old.id===unit.id).hp));assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(next))),next);assert.deepEqual(presentedActBattle(battle,action).state,actBattle(battle,action));
 }
});

test('actual service quotes cover the bounded visit, while an exhausted original deadline retains only its accepted prefix',()=>{
 const s=setup({nearExpiry:true}),r=run(s.campaign,s.ids);assert.ok(r.receipt.renewals.length);assert.equal(r.campaign.resources.treasury,s.campaign.resources.treasury-r.receipt.renewals.reduce((sum,row)=>sum+row.quote.price,0));for(const id of s.ids)assert.ok(contractExpiresSeconds(r.campaign.contracts[id])>r.receipt.until);saved(r.campaign);
 const limited=setup();let failure;try{run(limited.campaign,limited.ids,{deadlineSeconds:clock(limited.campaign)});}catch(error){failure=error;}assert.match(failure?.message??'',/deadline/);assert.ok(failure.campaign);assert.ok(failure.cordobaClinicReadiness);JSON.stringify({campaign:failure.campaign,battle:failure.battle,receipt:failure.cordobaClinicReadiness});
});

test('a real three-person raid released during paid crew staging stops with its actual encounter and accepted orders',()=>{
 const s=setup({raid:true}),before=structuredClone(s.campaign);let failure;try{run(s.campaign,s.ids);}catch(error){failure=error;}
 assert.match(failure?.message??'',/encounter|contact/);assert.ok(failure.campaign);assert.ok(failure.cordobaClinicReadiness.orders.length);assert.ok(failure.campaign.pendingEncounter||failure.battle?.mode==='combat');assert.deepEqual(s.campaign,before);JSON.stringify({message:failure.message,campaign:failure.campaign,battle:failure.battle,receipt:failure.cordobaClinicReadiness});
});

test('the actual Native minimum admits a distinct finite reserve physician who can pay for a real care hour',()=>{
 const s=setup({reserveMedical:20}),start=s.campaign,before=structuredClone(start),result=run(start,s.ids);let c=result.campaign;
 const [treating,reserve,,,patient]=s.ids,op=rosterFor(c).find(op=>op.id===reserve);
 assert.equal(op.medical,20);assert.equal(result.receipt.doctorId,reserve);assert.equal(result.receipt.supplied,true);assert.equal(careAssignmentIssue(c,op,'doctor'),null);
 assert.equal(c.operativeState[reserve].medkits,1);assert.equal(c.operativeState[treating].medkits,2);assert.equal(totalKits(c),totalKits(start));
 assert.ok(!result.receipt.crewIds.includes(reserve));assert.deepEqual(result.receipt.crewIds,s.ids.slice(2,4));
 const began=clock(c),hp=c.operativeState[patient].hp,kits=totalKits(c),cash=c.resources.treasury;
 c=order(c,{type:'assignCare',operativeId:patient,assignment:'patient'});c=order(c,{type:'assignCare',operativeId:reserve,assignment:'doctor'});c=order(c,{type:'wait',hours:1});
 assert.equal(clock(c)-began,3600);assert.equal(c.operativeState[reserve].medkits,0);assert.equal(totalKits(c),kits-1);assert.ok(c.operativeState[patient].hp>hp);assert.equal(c.resources.treasury,cash);
 assert.deepEqual(start,before);saved(c);assert.deepEqual(run(saved(before),s.ids),result);
});

test('a declared reserve below the Native minimum remains unavailable without changing the actual clinic',()=>{
 const s=setup({reserveMedical:19,drop:false}),before=structuredClone(s.campaign),result=run(s.campaign,s.ids);
 assert.equal(result.receipt.supplied,false);assert.equal(result.receipt.doctorId,null);assert.equal(result.receipt.reason,'no-fit-reserve-physician');assert.deepEqual(result.receipt.orders,[]);
 assert.equal(result.campaign,s.campaign);assert.deepEqual(s.campaign,before);
});

test('an existing complete cannon crew cannot also supply the distinct reserve physician',()=>{
 const s=setup({crewMedical:20}),prepared=run(s.campaign,s.ids);assert.deepEqual(prepared.receipt.crewIds,s.ids.slice(2,4));
 const start=order(prepared.campaign,{type:'assignCare',operativeId:s.ids[1],assignment:'doctor'}),before=structuredClone(start);
 assert.deepEqual(cordobaClinicGroundCrew(start),s.ids.slice(2,4));
 const result=run(start,s.ids);assert.equal(result.receipt.supplied,false);assert.equal(result.receipt.doctorId,null);assert.equal(result.receipt.reason,'no-fit-reserve-physician');
 assert.deepEqual(result.receipt.orders,[]);assert.equal(result.campaign,start);assert.deepEqual(start,before);
});

// The reserve's last kit is spent by real Native care. A subsequent readiness
// request starts from that successful current state, never from a failed save.
function spentReserve(options={}){
 const s=setup({kits:2,reserveMedical:20,drop:false,...options}),prepared=run(s.campaign,s.ids);let c=prepared.campaign;
 const reserve=prepared.receipt.doctorId,treating=s.ids[0],patient=s.ids[4],hp=c.operativeState[patient].hp,kits=allKits(c),began=clock(c);
 assert.equal(prepared.receipt.supplied,true);assert.equal(c.operativeState[reserve].medkits,1);assert.equal(c.operativeState[treating].medkits,1);
 c=order(c,{type:'assignCare',operativeId:patient,assignment:'patient'});
 for(const id of [reserve,treating]){
  c=order(c,{type:'assignCare',operativeId:id,assignment:'doctor'});c=order(c,{type:'wait',hours:1});assert.equal(c.operativeState[id].medkits,0);c=order(c,{type:'assignCare',operativeId:id,assignment:'rest'});
 }
 assert.equal(clock(c)-began,7200);assert.equal(allKits(c),kits-2);assert.equal(c.operativeState[reserve].medkits,0);assert.equal(c.operativeState[treating].medkits,0);assert.ok(c.operativeState[patient].hp>hp&&c.operativeState[patient].hp<c.operativeState[patient].maxHp);
 return {...s,campaign:c,reserve};
}
const allKits=c=>Object.values(c.operativeState).reduce((sum,r)=>sum+r.medkits,0)+(c.sectorStates[sector].groundItems??[]).filter(row=>row.type==='medkits').reduce((sum,row)=>sum+row.count,0);

test('a spent emergency reserve is refreshed from actual local finite stock during rest-only care without a fake treating physician',()=>{
 const s=setup({kits:3,reserveMedical:20,drop:false}),prepared=run(s.campaign,s.ids);let c=prepared.campaign;
 const reserve=prepared.receipt.doctorId,patient=s.ids[4];c=order(c,{type:'assignCare',operativeId:patient,assignment:'patient'});c=order(c,{type:'assignCare',operativeId:reserve,assignment:'doctor'});c=order(c,{type:'wait',hours:1});assert.equal(c.operativeState[reserve].medkits,0);
 c=order(c,{type:'assignCare',operativeId:reserve,assignment:'rest'});c=order(c,{type:'assignCare',operativeId:patient,assignment:'rest'});
 const start=c,before=structuredClone(start),kits=allKits(start),result=refreshCordobaClinicReadiness(start,null,{deadlineSeconds:clock(start)+3600});
 assert.equal(result.receipt.treatingId,null);assert.equal(result.receipt.supplied,true);assert.equal(result.receipt.doctorId,s.ids[0]);assert.equal(result.campaign.operativeState[result.receipt.doctorId].medkits,2);
 assert.equal(allKits(result.campaign),kits);assert.deepEqual(result.receipt.hires,[]);assert.equal(clock(result.campaign),clock(start));assert.deepEqual(start,before);saved(result.campaign);
});

test('a depleted reserve is replaced once by an actually unused immediate paid physician with finite issued kit custody',()=>{
 const s=spentReserve({relief:true}),start=s.campaign,id=s.ids[6],before=structuredClone(start),quote=contractQuote(start,rosterFor(start).find(op=>op.id===id),'day'),kits=allKits(start),used=new Set();
 assert.equal(start.recruited.includes(id),false);assert.equal(start.operativeState[id].medkits,2);assert.equal(start.operativeState[s.reserve].medkits,0);
 const result=refreshCordobaClinicReadiness(start,null,{deadlineSeconds:clock(start)+3600,allowPaidRelief:true,usedReliefIds:used}),c=result.campaign;
 assert.equal(result.receipt.supplied,true);assert.equal(result.receipt.doctorId,id);assert.deepEqual(result.receipt.hires.map(h=>h.id),[id]);assert.equal(used.has(id),true);
 assert.equal(c.resources.treasury,start.resources.treasury-quote.total);assert.equal(clock(c),clock(start));assert.equal(c.operativeState[id].location,sector);assert.equal(c.operativeState[id].medkits,2);assert.equal(allKits(c),kits);
 assert.equal(c.contracts[id].started*3600+(c.contracts[id].startedSecond??0),clock(start));assert.equal(contractExpiresSeconds(c.contracts[id]),clock(start)+quote.hours*3600);assert.equal(c.hiringArrivals.some(a=>a.operativeId===id),false);
 assert.equal(cordobaClinicDonationCount(c,id,id),1);assert.deepEqual(c.sectorStates[sector].artillery,start.sectorStates[sector].artillery);for(const old of start.recruited){assert.equal(c.operativeState[old].alive,start.operativeState[old].alive);assert.equal(c.operativeState[old].hp,start.operativeState[old].hp);}
 const again=refreshCordobaClinicReadiness(saved(c),null,{deadlineSeconds:clock(c)+3600,allowPaidRelief:true,usedReliefIds:used});assert.deepEqual(again.receipt.hires,[]);assert.equal(again.campaign.resources.treasury,c.resources.treasury);assert.equal(allKits(again.campaign),kits);assert.deepEqual(start,before);saved(again.campaign);
});

test('an exhausted reserve and unaffordable unused relief report finite shortage without a refill, elapsed hour or new service',()=>{
 const s=spentReserve({relief:true,reliefPay:1000000}),start=s.campaign,id=s.ids[6],before=structuredClone(start),used=new Set();assert.ok(contractQuote(start,rosterFor(start).find(op=>op.id===id),'day').total>start.resources.treasury);
 const result=refreshCordobaClinicReadiness(start,null,{deadlineSeconds:clock(start)+3600,allowPaidRelief:true,usedReliefIds:used});
 assert.equal(result.receipt.supplied,false);assert.equal(result.receipt.reason,'finite-reserve-empty');assert.deepEqual(result.receipt.hires,[]);assert.deepEqual(result.receipt.orders,[]);assert.equal(used.size,0);assert.equal(result.campaign,start);assert.deepEqual(start,before);saved(result.campaign);
});

test('an absent treating identity is rejected while a real local doctor remains assigned, retaining only raw error evidence',()=>{
 const s=setup({drop:false}),prepared=run(s.campaign,s.ids),start=order(prepared.campaign,{type:'assignCare',operativeId:s.ids[0],assignment:'doctor'});let failure;
 try{refreshCordobaClinicReadiness(start,null,{deadlineSeconds:clock(start)+3600});}catch(error){failure=error;}
 assert.match(failure?.message??'',/no current local treatment/);assert.equal(failure.campaign,start);assert.deepEqual(failure.cordobaClinicReadiness.orders,[]);JSON.stringify({campaign:failure.campaign,receipt:failure.cordobaClinicReadiness});
});

test('a callback failure after the paid reserve replacement retains that exact accepted prefix and original error identity',()=>{
 const s=spentReserve({relief:true}),start=s.campaign,id=s.ids[6],quote=contractQuote(start,rosterFor(start).find(op=>op.id===id),'day'),original=Error('stop after the actual reserve receipt'),used=new Set();let failure;
 try{refreshCordobaClinicReadiness(start,null,{deadlineSeconds:clock(start)+3600,allowPaidRelief:true,usedReliefIds:used,report:()=>{throw original;}});}catch(error){failure=error;}
 assert.equal(failure,original);assert.equal(used.has(id),true);assert.equal(failure.campaign.recruited.includes(id),true);assert.equal(failure.campaign.resources.treasury,start.resources.treasury-quote.total);assert.equal(failure.campaign.operativeState[id].medkits,2);assert.equal(failure.campaign.hour,start.hour);assert.equal(failure.campaign.secondOfHour,start.secondOfHour);assert.deepEqual(failure.cordobaClinicReadiness.hires.map(h=>h.id),[id]);JSON.stringify({campaign:failure.campaign,receipt:failure.cordobaClinicReadiness});
});


test('one finite container dressing debits once while its reused key retains the unrelated next stack and the complete clinic replay',()=>{
 const dressing={item:'medkits',count:1,weight:.2},repair={item:'inventory:clinic-repair-kit',kind:'repair-kit',name:'Herramientas de la clínica',count:1,weight:2,repairPoints:73,instanceId:'clinic-reserve-repair'};
 const s=setup({kits:0,drop:false,cacheContents:[dressing,repair]}),start=s.campaign,before=structuredClone(start),model=sectorInventoryModel(start,sector,rosterFor(start),s.ids[1]),modelBefore=structuredClone(model),source=model.entries.find(row=>JSON.parse(row.expected).item==='medkits');
 const chest=c=>c.sectorStates[sector].props.find(p=>p.id==='clinic-arsenal-chest');
 assert.ok(chest(start).knownToPlayer&&chest(start).open);assert.ok(source?.reachable);assert.equal(source.count,1);assert.deepEqual(JSON.parse(source.expected),dressing);assert.deepEqual(chest(start).contents,[dressing,repair]);
 const result=run(start,s.ids),c=result.campaign,current=sectorInventoryModel(c,sector,rosterFor(c),s.ids[1]),reused=current.entries.find(row=>row.key===source.key);
 assert.equal(result.receipt.supplied,true);assert.equal(result.receipt.doctorId,s.ids[1]);assert.equal(c.operativeState[s.ids[1]].medkits,1);assert.deepEqual(result.receipt.transfers,[{recipient:s.ids[1],site:sector,sourceKey:source.key,count:1}]);
 assert.ok(reused);assert.deepEqual(JSON.parse(reused.expected),repair);assert.deepEqual(chest(c).contents,[repair]);assert.equal(current.entries.some(row=>JSON.parse(row.expected).item==='medkits'),false);
 for(const id of s.ids){assert.equal(c.operativeState[id].hp,start.operativeState[id].hp);assert.equal(c.operativeState[id].alive,start.operativeState[id].alive);if(id!==s.ids[1])assert.equal(c.operativeState[id].medkits,start.operativeState[id].medkits);}
 assert.deepEqual(c.sectorStates[sector].artillery,start.sectorStates[sector].artillery);assert.equal(c.resources.treasury,start.resources.treasury);assert.deepEqual(c.contracts,start.contracts);assert.deepEqual(c.squads,start.squads);assert.ok(clock(c)>clock(start)&&clock(c)<=result.receipt.until);
 assert.deepEqual(model,modelBefore);assert.deepEqual(start,before);saved(c);assert.deepEqual(run(saved(start),s.ids),result);
});

// Independent current-supply controls. Every wound, physician, issued dressing
// and delayed arrival is declared before compilation and the campaign factory.
function currentRecoverySupplySetup({delayed=false}={}){
 const d=JSON.parse(JSON.stringify(scaffoldDocuments('cordoba-current-clinical-supply')).replaceAll('watch-post',sector));
 const base=d.content.characters[0];d.content.rules.startingTreasury=20000;d.content.startingTerritory[sector].owner='patriot';
 d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];d.world.expansion.buildingTargets={camp:0,[sector]:0};
 d.world.arrivalFacilities[sector]=['barracks'];d.content.arrivalSites.push({sector,facilities:['barracks']});
 d.content.characters=Array.from({length:delayed?14:13},(_,i)=>({...structuredClone(base),id:'current-clinic-'+i,name:'Persona '+i,nickname:'Persona '+i,monthlyPay:300,arrivalHours:i===13?8:0,weapon:null,
  attributes:{...base.attributes,maxHp:80,medical:i===0?94:i===1?90:0},
  startingSupplies:{rations:0,torches:0,boleadoras:0,medkits:i===1?1:delayed?(i===13?2:0):i===0?1:i===4?22:0},
  startingCondition:{hp:i===2?16:i===3?17:80,bleeding:0,bandaged:0,energy:100,fatigue:0}}));
 d.maps[sector].upperSurfaces=Array.from({length:24},(_,i)=>({id:'current-roof-'+i,x:8+i%6,y:5+Math.floor(i/6),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:25}));
 d.maps[sector].climbLinks=[{id:'current-access',kind:'climb',from:{x:8,y:9,tacticalLevel:0},to:{x:8,y:8,tacticalLevel:1}}];
 d.world.enemyStrategy={version:1,theaters:{frontier:{legHours:1,reserve:0,raidEveryHours:240,axis:[sector]}}};
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);let c=initialCampaign(42,content);
 const ids=rosterFor(c).map(op=>op.id),hires=[];
 for(const id of ids.slice(0,13)){const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'week'),cash=c.resources.treasury;c=order(c,{type:'recruitCivic',id,term:'week',destination:sector});assert.equal(c.resources.treasury,cash-quote.total);hires.push({id,quote});}
 for(let i=0;i<13;i+=6)c=order(c,{type:'createSquad',ids:ids.slice(i,Math.min(i+6,13)),sector,name:'Recuperación clínica actual'});
 let arrival=null;
 if(delayed){const id=ids[13],quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'week'),cash=c.resources.treasury;c=order(c,{type:'recruitCivic',id,term:'week',destination:sector});assert.equal(c.resources.treasury,cash-quote.total);arrival=structuredClone(c.hiringArrivals.find(row=>row.operativeId===id));assert.ok(arrival);assert.equal(arrival.travelHours,8);assert.equal(c.recruited.includes(id),false);hires.push({id,quote});}
 assert.equal(c.recruited.length,13);assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);assert.deepEqual(d,declaration);
 return {campaign:saved(c),ids,hires,arrival};
}

test('balanced stable wounds keep one supplied patient course while the other earns uninterrupted Native rest',()=>{
 const {campaign:start,ids}=currentRecoverySupplySetup(),before=structuredClone(start),events=[];
 const c=recoverFreshCordobaSurvivors(start,{report:event=>events.push(event)}),ticks=events.filter(event=>event.event==='cordobaRecoveryCareHour'&&event.to-event.from===3600);
 assert.ok(ticks.length>=6);
 for(const tick of ticks.slice(0,6)){assert.equal(tick.records.find(r=>r.id===ids[2]).assignment,'patient');assert.equal(tick.records.find(r=>r.id===ids[3]).assignment,'rest');assert.equal(tick.records.find(r=>r.id===ids[1]).medkits,1);}
 const sixth=ticks[5].records;assert.ok(sixth.find(r=>r.id===ids[2]).hp>start.operativeState[ids[3]].hp);assert.equal(sixth.find(r=>r.id===ids[3]).hp,start.operativeState[ids[3]].hp+1);assert.equal(sixth.find(r=>r.id===ids[3]).recoveryHours,0);
 const initial=ids.reduce((sum,id)=>sum+start.operativeState[id].medkits,0),remaining=ids.reduce((sum,id)=>sum+c.operativeState[id].medkits,0);let carried=initial,spent=0;
 for(const tick of events.filter(event=>event.event==='cordobaRecoveryCareHour')){const next=tick.records.reduce((sum,r)=>sum+r.medkits,0),debit=carried-next;assert.ok(debit===0||debit===1,'One actual physician spends at most one dressing per care interval.');spent+=debit;carried=next;}
 assert.ok(spent>0);assert.equal(remaining,initial-spent);assert.equal(c.operativeState[ids[1]].medkits,1);assert.equal(c.recruited.length,13);assert.equal(c.resources.treasury,start.resources.treasury-450);assert.deepEqual(c.contracts,start.contracts);
 for(const id of ids){assert.equal(c.operativeState[id].alive,true);assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);assert.equal(c.operativeState[id].bleeding,0);}
 assert.deepEqual(start,before);saved(c);assert.deepEqual(recoverFreshCordobaSurvivors(saved(start)),c);
});

test('an actual paid delayed arrival makes two finite dressings usable after the clinic has entered rest-only care',()=>{
 const {campaign:start,ids,arrival}=currentRecoverySupplySetup({delayed:true}),before=structuredClone(start),events=[],due=arrival.dueAt*3600+(arrival.dueSecond??0);
 assert.equal(start.operativeState[ids[0]].medkits,0);assert.equal(start.operativeState[ids[1]].medkits,1);assert.equal(start.operativeState[ids[13]].medkits,2);
 const c=recoverFreshCordobaSurvivors(start,{report:event=>events.push(event)}),empty=events.find(event=>event.event==='finiteMedicalStockExhausted'&&event.site===sector),resumed=events.find(event=>event.event==='finiteMedicalCareResumed'&&event.site===sector);
 assert.ok(empty);assert.ok(empty.hour*3600<due);assert.ok(resumed);assert.ok(resumed.hour*3600+resumed.second>=due);assert.equal(c.hiringArrivals.length,0);assert.equal(c.recruited.filter(id=>id===ids[13]).length,1);
 assert.equal(c.contracts[ids[13]].kind,'paid');assert.ok(contractExpiresSeconds(c.contracts[ids[13]])>clock(c));assert.equal(c.operativeState[ids[13]].medkits,0);assert.equal(c.operativeState[ids[1]].medkits,1);
 assert.equal(ids.reduce((sum,id)=>sum+c.operativeState[id].medkits,0),ids.reduce((sum,id)=>sum+start.operativeState[id].medkits,0)-2,'Exactly the real arriving issue is spent; the last rear dressing remains reserved.');
 const ticks=events.filter(event=>event.event==='cordobaRecoveryCareHour');assert.ok(ticks.some(tick=>tick.records.some(r=>r.assignment==='patient')));assert.equal(c.recruited.length,14);assert.ok(clock(c)-clock(start)<(96+64*6)*3600);assert.ok(c.resources.treasury>=0);assert.equal(c.pendingEncounter,null);assert.equal(c.pendingBattle,null);
 for(const id of ids){assert.equal(c.operativeState[id].alive,true);assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);assert.equal(c.operativeState[id].bleeding,0);}
 assert.deepEqual(start,before);saved(c);assert.deepEqual(recoverFreshCordobaSurvivors(saved(start)),c);
});

// Independent first-defence declarations. All thirteen paid locals, the
// stable wound, finite chest and optional actual gun exist before the factory.
// Nothing from the historical retreat is loaded, patched or replayed.
function firstClinicDefenseSetup({crew=false,raid=false}={}){
 const d=JSON.parse(JSON.stringify(scaffoldDocuments('cordoba-first-clinic-defense')).replaceAll('watch-post',sector)),base=d.content.characters[0];
 d.content.rules.startingTreasury=20000;d.content.rules.deploymentCartridges=12;d.content.startingTerritory[sector].owner='patriot';
 d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];d.world.expansion.buildingTargets={camp:0,[sector]:0};d.world.arrivalFacilities[sector]=['barracks'];d.content.arrivalSites.push({sector,facilities:['barracks']});
 d.content.weapons.push({id:'first-clinic-rifle',template:1800,name:'Fusil de la guardia',damage:40,fireAP:25,aimAP:5,reloadAP:40,range:20,readyAP:5,weight:4,price:100,art:base.portrait});
 d.content.characters=Array.from({length:13},(_,i)=>({...structuredClone(base),id:'first-clinic-'+String(i).padStart(2,'0'),name:'Persona '+i,nickname:'Persona '+i,monthlyPay:30,arrivalHours:0,weapon:'first-clinic-rifle',
  attributes:{...base.attributes,maxHp:80,medical:i===0?94:i===1?90:0},startingSupplies:{rations:0,torches:0,boleadoras:0,medkits:i===0&&crew?2:i===1?1:0},
  startingCondition:{hp:i===2?(raid?15:40):80,bleeding:0,bandaged:0,energy:100,fatigue:0}}));
 d.maps[sector].props=[{id:'first-clinic-chest',type:'chest',x:5,y:12,footprint:{width:1,height:1},blocksMovement:true}];
 d.world.physical.caches[sector]={chest:'first-clinic-chest',contents:[{item:'medkits',count:12,weight:.2},{item:'inventory:first-clinic-repair',kind:'repair-kit',name:'Herramientas de la guardia',count:1,weight:2,repairPoints:73,instanceId:'first-clinic-repair'}]};
 if(crew)d.world.physical.arsenals[sector]={version:1,sector,chest:'first-clinic-chest',pieces:[{id:'arsenal:first-clinic:1',type:'bronze4',side:'player',loaded:true,ammo:2}]};
 d.maps[sector].upperSurfaces=Array.from({length:24},(_,i)=>({id:'first-clinic-roof-'+i,x:8+i%6,y:5+Math.floor(i/6),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:25}));
 d.maps[sector].climbLinks=[{id:'first-clinic-access',kind:'climb',from:{x:8,y:9,tacticalLevel:0},to:{x:8,y:8,tacticalLevel:1}}];
 d.world.enemyStrategy={version:1,theaters:{frontier:{legHours:1,reserve:raid?3:0,raidEveryHours:raid?4:240,axis:[sector]}}};
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);let c=initialCampaign(42,content);const ids=rosterFor(c).map(op=>op.id),hires=[];
 for(const id of ids){const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'week'),cash=c.resources.treasury;c=order(c,{type:'recruitCivic',id,term:'week',destination:sector});assert.equal(c.resources.treasury,cash-quote.total);hires.push({id,quote});}
 for(let i=0;i<ids.length;i+=6)c=order(c,{type:'createSquad',ids:ids.slice(i,i+6),sector,name:'Guardia y clínica'});
 assert.equal(c.recruited.length,13);assert.equal(c.pendingEncounter,null);assert.equal(c.pendingBattle,null);assert.deepEqual(d,declaration);return {campaign:saved(c),ids,hires,stock:structuredClone(d.world.physical.caches[sector].contents)};
}

test('the first real clinic raid follows paid staging of the original ground rear before collection or any care wait',()=>{
 const s=firstClinicDefenseSetup({raid:true}),start=s.campaign,before=structuredClone(start),events=[];
 assert.equal(start.operativeState[s.ids[0]].medkits,0);assert.equal(start.operativeState[s.ids[1]].medkits,1);assert.ok(!sectorInventoryModel(start,sector,rosterFor(start),s.ids[0]).entries.some(row=>row.reachable&&JSON.parse(row.expected).item==='medkits'));
 const c=recoverFreshCordobaSurvivors(start,{report:event=>events.push(event)}),ready=events.findIndex(e=>e.event==='cordobaMedicalRearReady'),stage=events.findIndex(e=>e.event==='cordobaMedicalRearRestaged'),collection=events.findIndex(e=>e.event==='careCollectionCheckpoint'),raid=events.findIndex(e=>e.event==='recoveryCounterattack');
 assert.ok(ready>=0&&stage>ready&&collection>stage&&raid>collection,'The first actual rear is staged before collection can release its first raid.');assert.ok(events.findIndex(e=>e.event==='cordobaRecoveryCareHour')>stage);
 const receipt=events[stage].receipt,prepared=events[ready],input=events[collection].campaign,defense=events[raid].campaign;
 assert.ok(receipt.restored);assert.ok(receipt.ids.length>0);assert.ok(receipt.orders.some(row=>row.action.type==='climb'));assert.ok(receipt.endSeconds>receipt.startSeconds&&receipt.endSeconds<=receipt.until&&receipt.until<=receipt.deadlineSeconds);
 const originalGround=prepared.positions.filter(row=>(row.position?.tacticalLevel??0)===0).map(row=>row.id);assert.ok(originalGround.length>0);for(const id of originalGround)assert.ok(receipt.ids.includes(id));
 for(const id of s.ids){assert.ok(input.operativeState[id].residentPosition?.tacticalLevel>0);assert.ok(defense.operativeState[id].residentPosition?.tacticalLevel>0);assert.equal(c.operativeState[id].alive,true);assert.equal(c.operativeState[id].captured,false);assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);assert.equal(c.operativeState[id].bleeding,0);}
 assert.equal(new Set(s.ids.map(id=>JSON.stringify(input.operativeState[id].residentPosition))).size,13);assert.equal(defense.pendingEncounter.sector,sector);assert.equal(defense.sectors[sector].fort,3);assert.equal(events.filter(e=>e.event==='recoveryCounterattack').length,1);assert.ok(events.some(e=>e.event==='battleFinished'&&e.sector===sector&&e.status==='victory'));
 const chest=input.sectorStates[sector].props.find(p=>p.id==='first-clinic-chest'),firstTick=events.find(e=>e.event==='cordobaRecoveryCareHour');assert.ok(chest&&!chest.open);assert.deepEqual(chest.contents,s.stock);assert.equal(input.operativeState[s.ids[1]].medkits,1);assert.equal(firstTick.to-firstTick.from,3600);assert.equal(firstTick.records.reduce((sum,r)=>sum+r.medkits,0),12,'Twelve actual cache dressings plus the rear reserve, less one real care stroke.');assert.ok(firstTick.records.find(r=>r.id===s.ids[2]).hp>start.operativeState[s.ids[2]].hp);assert.deepEqual(c.sectorStates[sector].props.find(p=>p.id==='first-clinic-chest').contents,[s.stock[1]]);
 const reserveRest=events.map((event,index)=>({event,index})).filter(row=>row.event.event==='cordobaRecoveryReserveRest');assert.ok(reserveRest.length>0,'The sole fit supplied defender must remain reserved while stable patients earn real rest.');let actualRestHours=0;
 for(const {event:rest,index}of reserveRest){const tick=events.slice(index+1).find(t=>t.event==='cordobaRecoveryCareHour'),reserve=rest.records.find(r=>r.id===rest.reserveId);assert.ok(tick&&tick.from===rest.from&&[0,3600].includes(tick.to-tick.from));actualRestHours+=(tick.to-tick.from)/3600;assert.ok(reserve.medkits>0&&reserve.hp>=15&&!reserve.bleeding&&!reserve.asleep&&reserve.energy>10);for(const id of rest.patients)assert.equal(rest.records.find(r=>r.id===id).assignment,'rest');assert.ok(rest.records.every(r=>r.assignment!=='patient'));assert.equal(tick.records.reduce((sum,r)=>sum+r.medkits,0),rest.records.reduce((sum,r)=>sum+r.medkits,0),'No untreated rest wait or zero-time notice may debit finite dressings.');assert.equal(tick.records.find(r=>r.id===rest.reserveId).medkits,reserve.medkits);}
 assert.ok(actualRestHours>=6,'Only real paid hours count toward the stable reserve-rest interval.');const lastRest=reserveRest.at(-1),restTick=events.slice(lastRest.index+1).find(t=>t.event==='cordobaRecoveryCareHour'),laterCare=events.slice(lastRest.index+1).find(t=>t.event==='cordobaRecoveryCareHour'&&t.from>=restTick.to&&t.to-t.from===3600&&t.records.some(r=>r.assignment==='patient'));assert.ok(laterCare,'An actual second physician must resume real care after the reserve-rest interval.');assert.ok(laterCare.records.reduce((sum,r)=>sum+r.medkits,0)<restTick.records.reduce((sum,r)=>sum+r.medkits,0),'Later actual treatment spends a real dressing.');
 assert.ok(c.resources.treasury>=0);assert.ok(clock(c)<=receipt.deadlineSeconds);assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);assert.deepEqual(c.recruited,start.recruited);
 assert.deepEqual(start,before);saved(c);assert.deepEqual(recoverFreshCordobaSurvivors(saved(start)),c);
});

test('first-rear staging preserves the finite gun crew, reserved physician post and care duties and refuses an exhausted original deadline',()=>{
 const prepare=()=>{
  const s=firstClinicDefenseSetup({crew:true});let c=discoverRouteCache(s.campaign,s.ids[0]);c=prepareNorthernHospitalFortification(c,{sector}).campaign;
  c=stageRouteRoofDefenders(c,[s.ids[1]]);c=order(c,{type:'assignCare',operativeId:s.ids[2],assignment:'patient'});c=order(c,{type:'assignCare',operativeId:s.ids[0],assignment:'doctor'});
  const deadline=clock(c)+96*3600,ready=refreshCordobaClinicReadiness(c,s.ids[0],{deadlineSeconds:deadline});assert.equal(ready.receipt.supplied,true);assert.equal(ready.receipt.crewIds.length,2);c=ready.campaign;
  const prepared=prepareCordobaMedicalRear(c,s.ids[0]);assert.deepEqual(prepared.receipt.newIds,[]);assert.deepEqual(prepared.receipt.relief,[]);return {...s,campaign:prepared.campaign,deadline,crewIds:ready.receipt.crewIds,reserve:s.ids[1]};
 };
 const s=prepare(),start=s.campaign,before=structuredClone(start),r=restageCordobaMedicalRear(start,{deadlineSeconds:s.deadline,preserveGroundCrew:true}),c=r.campaign;
 assert.ok(r.receipt.restored);assert.ok(r.receipt.orders.some(row=>row.action.type==='climb'));assert.ok(clock(c)>clock(start)&&clock(c)<=r.receipt.until&&clock(c)<=s.deadline);assert.deepEqual(cordobaClinicGroundCrew(c),s.crewIds);
 for(const id of s.crewIds){assert.ok(!r.receipt.ids.includes(id));assert.deepEqual(c.operativeState[id].residentPosition,start.operativeState[id].residentPosition);}
 assert.ok(!r.receipt.ids.includes(s.reserve));assert.deepEqual(c.operativeState[s.reserve].residentPosition,start.operativeState[s.reserve].residentPosition);assert.equal(c.operativeState[s.reserve].medkits,1);assert.equal(c.operativeState[s.ids[0]].assignment,'doctor');assert.equal(c.operativeState[s.ids[2]].assignment,'patient');
 for(const id of s.ids){for(const key of ['alive','captured','hp','bleeding','bandaged','medkits','inventory','carriedLoaded','assignment'])assert.deepEqual(c.operativeState[id][key],start.operativeState[id][key],id+' '+key);if(!s.crewIds.includes(id))assert.ok(c.operativeState[id].residentPosition.tacticalLevel>0);}
 assert.deepEqual(c.sectorStates[sector].artillery,start.sectorStates[sector].artillery);assert.deepEqual(c.sectorStates[sector].props,start.sectorStates[sector].props);assert.deepEqual(c.squads,start.squads);assert.equal(c.activeSquadId,start.activeSquadId);assert.deepEqual(c.squad,start.squad);assert.deepEqual(c.contracts,start.contracts);assert.equal(c.resources.treasury,start.resources.treasury);assert.deepEqual(start,before);saved(c);assert.deepEqual(restageCordobaMedicalRear(saved(start),{deadlineSeconds:s.deadline,preserveGroundCrew:true}),r);
 const exhausted=prepare(),input=exhausted.campaign,original=structuredClone(input);let failure;try{restageCordobaMedicalRear(input,{deadlineSeconds:clock(input),preserveGroundCrew:true});}catch(error){failure=error;}
 assert.match(failure?.message??'',/deadline/);assert.equal(failure.campaign,input);assert.equal(failure.battle,null);assert.equal(failure.cordobaMedicalRearRestaging.restored,false);assert.deepEqual(failure.cordobaMedicalRearRestaging.orders,[]);assert.deepEqual(input,original);JSON.stringify({campaign:failure.campaign,receipt:failure.cordobaMedicalRearRestaging});
});

import {operativeIdForCharacter} from '../game/content-character-ids.js';
import {buildBuilding} from '../game/buildings.js';
import {prepareCampaignBattle} from '../game/battle-handoff.js';
import {getReachable,lookPreview,artilleryContact,artilleryCosts} from '../game/tactical.js';
import {spacePoint} from '../game/tactical-space.js';
import {syncBattleTime} from '../game/time.js';

function displacedCrewSetup(){
 const d=scaffoldDocuments('cordoba-current-crew-posts');for(const key of ['content','world','maps'])d[key]=JSON.parse(JSON.stringify(d[key]).replaceAll('watch-post',sector));
 const base=d.content.characters[0],names=['post-gunner-one','post-gunner-two','post-physician'];
 d.content.characters=names.map((id,index)=>({...structuredClone(base),id,name:'Guardia '+index,nickname:'Guardia '+index,monthlyPay:30,arrivalHours:0,
  attributes:{...base.attributes,maxHp:80,medical:index===2?90:0,marksmanship:10+index*10},startingCondition:{hp:80,bleeding:0,bandaged:0,energy:100,fatigue:0},startingSupplies:{medkits:index===2?1:0,rations:2,torches:0,boleadoras:0}}));
 const neighbor={...structuredClone(base),id:'neighbor-e',name:'Vecina',nickname:'Vecina',recruitmentSource:'encounter',service:'permanent',monthlyPay:0,weapon:null,
  encounter:{recruitable:false,greeting:'Mi puesto está en esta casa.',requiredLeadership:0,requiredLiberated:0,requiredSector:null}};delete neighbor.arrivalHours;d.content.characters.push(neighbor);
 d.content.placements=[{id:'neighbor-location',character:neighbor.id,mode:'fixed',sectors:[sector],moveChance:100,afterDeath:null,delayMin:0,delayMax:0}];
 d.content.rules.startingTreasury=1000;d.content.rules.deploymentCartridges=0;d.content.startingTerritory[sector]={owner:'patriot',loyalty:65};
 d.content.arrivalSites.push({sector,facilities:['barracks']});d.world.arrivalFacilities[sector]=['barracks'];d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];
 d.world.expansion.rural=[];d.world.expansion.buildingTargets[sector]=1;d.world.enemyStrategy={version:1,theaters:{frontier:{legHours:1,reserve:3,raidEveryHours:4,axis:[sector]}}};
 // A normal open three by three house keeps every fallback cell reachable.
 // At the starting night, this fixed NPC's ordinary home cycle selects5,7.
 // No destination, AI state, position or condition is patched after factory.
 const home=buildBuilding({id:'post-neighbor-home',x:4,y:5,width:3,height:3,roof:'tile',material:'adobe'}).building;home.walls=[];
 const chestId='post-arsenal',gunId='arsenal:current-post:1',map=d.maps[sector];map.buildings=[home];map.upperSurfaces=[];map.climbLinks=[];map.props=[{id:chestId,type:'chest',x:4,y:9,footprint:{width:1,height:1},blocksMovement:true}];
 d.world.physical.caches[sector]={chest:chestId,contents:[]};d.world.physical.arsenals[sector]={version:1,sector,chest:chestId,pieces:[{id:gunId,type:'bronze4',side:'player',loaded:true,ammo:2}]};
 const declared=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);let c=initialCampaign(42,content),battle=null;
 const ids=names.map(name=>operativeIdForCharacter(content,name)),crew=ids.slice(0,2),npc=b=>b.npcs.find(row=>row.contentId===neighbor.id),body=(b,id)=>b.units.find(row=>row.id===String(id));
 const issue=action=>{c=order(c,action);};
 const enter=()=>{issue({type:'visitSector'});const pair=prepareCampaignBattle(c);assert.equal(pair.error,null);({campaign:c,battle}=decodeSave(encodeSave(pair.campaign,pair.battle)));assert.equal(battle.mode,'exploration');};
 const step=action=>{const before=structuredClone(battle),next=actBattle(battle,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);assert.deepEqual(battle,before);const pair=syncBattleTime(c,next);assert.equal(pair.error,null);({campaign:c,battle}=decodeSave(encodeSave(pair.campaign,pair.battle)));};
 const move=(id,point)=>{const quote=getReachable(battle,body(battle,id),{stopAt:cell=>sameCell(cell,point)})[0];assert.ok(quote?.cost>0);step({type:'move',unitId:String(id),...spacePoint(point)});assert.ok(sameCell(body(battle,id),point));};
 const exit=()=>{issue({type:'leaveSector',battleId:c.pendingBattle.id,sectorState:battle,survivors:battle.units.filter(unit=>unit.side==='player')});battle=null;c=saved(c);};
 for(const id of ids){const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'week'),cash=c.resources.treasury;assert.equal(quote.available,true,quote.reason);assert.ok(quote.total>0);issue({type:'recruitCivic',id,term:'week',destination:sector});assert.equal(cash-c.resources.treasury,quote.total);}
 for(const members of [crew,ids.slice(2)])issue({type:'createSquad',name:'Puesto actual',ids:members,sector});
 const crewHome=c.squads.find(q=>q.members.includes(crew[0])).id,physicianHome=c.squads.find(q=>q.members.includes(ids[2])).id;
 issue({type:'selectSquad',id:crewHome});enter();const building=battle.buildings.find(row=>row.id===home.id),first={x:building.x,y:building.y+2,tacticalLevel:0},second={x:building.x+1,y:building.y+2,tacticalLevel:0};
 move(crew[0],first);move(crew[1],{x:building.x+1,y:building.y+4,tacticalLevel:0});
 const chest=battle.props.find(row=>row.id===chestId),look={type:'look',unitId:String(crew[1]),...spacePoint(chest)};assert.equal(lookPreview(battle,body(battle,crew[1]),look).valid,true);step(look);step({type:'useItem',unitId:String(crew[1]),environment:{kind:'container',id:chestId,verb:'open'}});step({type:'useItem',unitId:String(crew[1]),environment:{kind:'container',id:chestId,verb:'close'}});
 const gun=battle.artillery.find(row=>row.id===gunId);assert.ok(gun);assert.ok(sameCell(gun,{x:building.x,y:building.y+3,tacticalLevel:0}));move(crew[1],second);
 for(const id of crew)assert.equal(artilleryContact(battle,body(battle,id),gun),true);assert.equal(artilleryCrewPlan(battle,body(battle,crew[0]),gun,artilleryCosts(battle,body(battle,crew[0]),gun).fire).reason,null);
 const originalGun=structuredClone(gun),posts=crew.map(id=>({id,...spacePoint(body(battle,id))}));assert.ok(sameCell(npc(battle),{x:building.x-1,y:building.y+2,tacticalLevel:0}));exit();
 issue({type:'selectSquad',id:physicianHome});enter();assert.deepEqual(battle.units.filter(row=>row.side==='player').map(row=>row.id),[String(ids[2])]);
 move(ids[2],{x:building.x-2,y:building.y+5,tacticalLevel:0});for(let tick=0;!sameCell(npc(battle),second)&&tick<3;tick++)step({type:'ambient'});
 assert.ok(sameCell(npc(battle),second),'The normal current scene admits the civilian to the unissued old crew point.');assert.equal(npc(battle).ai.activity,'home');exit();
 for(const point of posts)assert.ok(sameCell(c.operativeState[point.id].residentPosition,point),'The saved coordinates alone do not prove current contact.');assert.deepEqual(cordobaClinicGroundCrew(c),crew);assert.deepEqual(d,declared);
 return {campaign:c,ids,crew,crewHome,physicianHome,posts,gun:originalGun,occupied:second,chestId};
}

test('a completed other-home discovery revalidates the same displaced crew through paid current positions before waiting and real defense entry',()=>{
 const fixture=displacedCrewSetup(),start=fixture.campaign,before=structuredClone(start),deadline=clock(start)+3600,initialKits=allKits(start),homes=structuredClone(start.squads);let final,discovered;
 const execute=input=>collectCordobaClinicDressings(input,fixture.ids[2],1,{finalizeGroundCrew:state=>{
  discovered=state;assert.equal(state.pendingEncounter,null);assert.equal(state.pendingBattle,null);assert.equal(state.sectorStates[sector].props.find(row=>row.id===fixture.chestId).open,true);
  const stale=refreshCordobaClinicReadiness(state,null,{deadlineSeconds:deadline});assert.equal(stale.receipt.reason,'existing-ground-crew');assert.deepEqual(stale.receipt.orders,[]);assert.equal(stale.campaign,state);
  final=refreshCordobaClinicReadiness(state,null,{deadlineSeconds:deadline,revalidateGroundCrew:true});return final.campaign;
 }});
 const result=execute(start),c=result.campaign,receipt=final.receipt;assert.equal(result.supplied,false);assert.equal(result.source,null);assert.equal(result.collected,0);assert.equal(receipt.supplied,true);assert.deepEqual(receipt.crewIds,fixture.crew);assert.equal(receipt.gunId,fixture.gun.id);assert.ok(receipt.entryCrew.reason);assert.ok(receipt.entryCrew.npcs.some(row=>sameCell(row,fixture.occupied)));assert.ok(receipt.entryCrew.positions.some(row=>!sameCell(row,fixture.posts.find(post=>post.id===row.id))));const displaced=receipt.entryCrew.positions.find(row=>row.id===fixture.crew[1]);assert.ok(sameCell(displaced,{x:fixture.occupied.x,y:fixture.occupied.y-1,tacticalLevel:0}));assert.ok(Math.hypot(displaced.x-fixture.gun.x,displaced.y-fixture.gun.y)>1.5,'The actual admitted fallback loses cannon contact, rather than only changing coordinates.');
 assert.ok(receipt.orders.some(row=>row.kind==='battle'&&row.action.type==='move'));assert.ok(clock(c)>clock(discovered)&&clock(c)<=deadline);assert.equal(c.resources.treasury,start.resources.treasury);assert.equal(allKits(c),initialKits);assert.deepEqual(c.squads,homes);assert.equal(c.activeSquadId,start.activeSquadId);assert.deepEqual(c.contracts,start.contracts);assert.deepEqual(c.sectorStates[sector].artillery,[fixture.gun]);
 for(const id of fixture.ids){assert.equal(c.operativeState[id].hp,start.operativeState[id].hp);assert.equal(c.operativeState[id].bleeding,0);assert.equal(c.operativeState[id].assignment,start.operativeState[id].assignment);assert.equal(c.operativeState[id].medkits,start.operativeState[id].medkits);}
 const repeated=execute(saved(start));assert.deepEqual(repeated,result);saved(c);assert.deepEqual(start,before);
 const again=refreshCordobaClinicReadiness(c,null,{deadlineSeconds:deadline,revalidateGroundCrew:true});assert.equal(again.receipt.entryCrew.reason,null);assert.ok(!again.receipt.orders.some(row=>row.kind==='battle'));assert.equal(clock(again.campaign),clock(c));assert.deepEqual(again.receipt.positions,receipt.positions);
 let state=again.campaign;const npcBefore=structuredClone(state.sectorStates[sector].npcs);for(let attempt=0;!state.pendingEncounter&&attempt<8;attempt++)state=order(state,{type:'wait',hours:1});assert.equal(state.pendingEncounter?.sector,sector);assert.deepEqual(state.sectorStates[sector].npcs,npcBefore);
 state=order(state,{type:'respondToEncounter',groupId:state.pendingEncounter.groupId,choice:'tactical'});const pair=prepareCampaignBattle(state);assert.equal(pair.error,null);const actual=decodeSave(encodeSave(pair.campaign,pair.battle)),gun=actual.battle.artillery.find(row=>row.id===fixture.gun.id),actor=actual.battle.units.find(row=>row.id===String(fixture.crew[0]));
 const crewPlan=artilleryCrewPlan(actual.battle,actor,gun,artilleryCosts(actual.battle,actor,gun).fire);assert.equal(crewPlan.reason,null);assert.deepEqual(new Set(crewPlan.crew),new Set(fixture.crew.map(String)));for(const point of receipt.positions)assert.ok(sameCell(actual.battle.units.find(row=>row.id===String(point.id)),point));for(const key of ['id','type','side','loaded','ammo','x','y'])assert.deepEqual(gun[key],fixture.gun[key]);assert.equal(actual.battle.units.filter(row=>row.side==='player').length,3);
});

test('current crew finalization stops before a paid movement beyond its original deadline or a visit after an actual pending raid',()=>{
 for(const pending of [false,true]){
  const fixture=displacedCrewSetup();let start=fixture.campaign;if(pending){for(let n=0;!start.pendingEncounter&&n<8;n++)start=order(start,{type:'wait',hours:1});assert.ok(start.pendingEncounter);}
  const before=structuredClone(start);let failure;try{refreshCordobaClinicReadiness(start,null,{deadlineSeconds:clock(start)+(pending?3600:0),revalidateGroundCrew:true});}catch(error){failure=error;}
  assert.ok(failure);assert.match(failure.message,pending?/actual encounter/i:/deadline/i);assert.ok(failure.campaign);assert.equal(clock(failure.campaign),clock(start));assert.equal(failure.campaign.resources.treasury,start.resources.treasury);assert.ok(!failure.cordobaClinicReadiness.orders.some(row=>row.kind==='battle'));if(pending)assert.deepEqual(failure.cordobaClinicReadiness.orders,[]);else assert.ok(failure.cordobaClinicReadiness.entryCrew.reason);
  JSON.stringify({campaign:failure.campaign,battle:failure.battle,receipt:failure.cordobaClinicReadiness});assert.deepEqual(start,before);
 }
});

import {environmentPreview} from '../game/tactical.js';
import {coordinatedHospitalBattery} from './coordinated-hospital-battery.mjs';
import {publicRouteView} from './route-infantry-progress.mjs';

// These independent controls do not ask a resident to choose a particular
// destination. The old23 prefix already proves ordinary other-home displacement.
// Every wall, finite gun, blocking footprint, condition and paid person exists
// before compilation. The crew then earns discovery, exterior posts and the
// closed door through real Native orders before a fresh current-entry check.
function outsideClosedCrewSetup({blockedFirst=false}={}){
 const d=JSON.parse(JSON.stringify(scaffoldDocuments('cordoba-outside-closed-crew')).replaceAll('watch-post',sector)),base=d.content.characters[0],names=['door-gunner-one','door-gunner-two','door-physician'];
 d.content.characters=names.map((id,index)=>({...structuredClone(base),id,name:'Guardia '+index,nickname:'Guardia '+index,monthlyPay:30,arrivalHours:0,
  attributes:{...base.attributes,maxHp:80,medical:index===2?90:0,marksmanship:10+index*10},startingCondition:{hp:80,bleeding:0,bandaged:0,energy:100,fatigue:0},startingSupplies:{medkits:index===2?1:0,rations:2,torches:0,boleadoras:0}}));
 d.content.placements=[];d.content.rules.startingTreasury=1000;d.content.rules.deploymentCartridges=0;d.content.startingTerritory[sector]={...d.content.startingTerritory[sector],owner:'patriot',loyalty:65};d.content.arrivalSites.push({sector,facilities:['barracks']});d.world.arrivalFacilities[sector]=['barracks'];
 d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];d.world.expansion.rural=[];d.world.expansion.buildingTargets[sector]=1;
 d.world.enemyStrategy={version:1,theaters:{frontier:{legHours:1,reserve:3,raidEveryHours:4,axis:[sector]}}};
 const doorId='closed-crew-south',home=buildBuilding({id:'closed-crew-house',x:4,y:5,width:5,height:4,doors:[{doorId,x:6,y:9,axis:'x',open:false,locked:false}],roof:'tile',material:'adobe'}).building;
 const chestId='closed-crew-arsenal',map=d.maps[sector];map.buildings=[home];map.upperSurfaces=[];map.climbLinks=[];map.props=[{id:chestId,type:'chest',x:6,y:6,footprint:{width:1,height:1},blocksMovement:true}];
 if(blockedFirst)map.props.push({id:'closed-crew-east-block',type:'barrels',x:7,y:5,footprint:{width:1,height:2},blocksMovement:true});
 d.world.physical.caches[sector]={chest:chestId,contents:[]};d.world.physical.arsenals[sector]={version:1,sector,chest:chestId,pieces:[1,2].map(index=>({id:'arsenal:closed-crew:'+index,type:'bronze4',side:'player',loaded:true,ammo:2}))};
 const declared=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);let c=initialCampaign(42,content),battle=null;
 const ids=names.map(name=>operativeIdForCharacter(content,name)),crew=ids.slice(0,2),body=id=>battle.units.find(unit=>unit.id===String(id)),leaf=()=>battle.wallEdges.find(edge=>edge.doorId===doorId),paid=[];
 const issue=action=>{c=order(c,action);};
 const enter=()=>{issue({type:'visitSector'});const pair=prepareCampaignBattle(c);assert.equal(pair.error,null);({campaign:c,battle}=decodeSave(encodeSave(pair.campaign,pair.battle)));assert.equal(battle.mode,'exploration');assert.deepEqual(battle.npcs,[]);};
 const step=action=>{const before=structuredClone(battle),next=actBattle(battle,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);assert.deepEqual(battle,before);assert.deepEqual(presentedActBattle(battle,action).state,next);const pair=syncBattleTime(c,next);assert.equal(pair.error,null);({campaign:c,battle}=decodeSave(encodeSave(pair.campaign,pair.battle)));assert.equal(battle.mode,'exploration');assert.equal(c.pendingEncounter,null);};
 const move=(id,point)=>{if(sameCell(body(id),point))return;const quote=getReachable(battle,body(id),{stopAt:cell=>sameCell(cell,point)})[0];assert.ok(quote?.cost>0);step({type:'move',unitId:String(id),...spacePoint(point)});assert.ok(sameCell(body(id),point));};
 const look=(id,point)=>{const quote=lookPreview(battle,body(id),point);if(quote.valid&&quote.pa>0)step({type:'look',unitId:String(id),...spacePoint(point)});};
 for(const id of ids){const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'week'),cash=c.resources.treasury;assert.equal(quote.available,true,quote.reason);assert.ok(quote.total>0);issue({type:'recruitCivic',id,term:'week',destination:sector});assert.equal(cash-c.resources.treasury,quote.total);paid.push({id,quote});}
 for(const members of [crew,ids.slice(2)])issue({type:'createSquad',name:'Casa y cañones',ids:members,sector});const crewHome=c.squads.find(q=>q.members.includes(crew[0])).id,physicianHome=c.squads.find(q=>q.members.includes(ids[2])).id;
 issue({type:'selectSquad',id:crewHome});enter();const building=battle.buildings.find(row=>row.id===home.id),shift={x:building.x-home.x,y:building.y-home.y},point=(x,y)=>({x:x+shift.x,y:y+shift.y,tacticalLevel:0});
 move(crew[0],point(3,8));move(crew[1],point(6,9));look(crew[1],point(6,8));if(!leaf().open){assert.equal(environmentPreview(battle,body(crew[1]),{kind:'door',id:doorId},'open').valid,true);step({type:'door',unitId:String(crew[1]),doorId,open:true});}
 move(crew[1],point(6,7));const chest=battle.props.find(row=>row.id===chestId);look(crew[1],chest);step({type:'useItem',unitId:String(crew[1]),environment:{kind:'container',id:chestId,verb:'open'}});step({type:'useItem',unitId:String(crew[1]),environment:{kind:'container',id:chestId,verb:'close'}});
 const guns=structuredClone(battle.artillery);assert.equal(guns.length,2);assert.ok(sameCell(guns[0],point(6,5)));assert.ok(sameCell(guns[1],point(5,6)));
 const actor=body(crew[1]),view=publicRouteView(battle,actor),reachable=getReachable(view,actor),contacts=(gun,exclusive=false)=>reachable.filter(cell=>!sameCell(cell,gun)&&artilleryContact(view,{...actor,...spacePoint(cell)},gun)&&(!exclusive||guns.filter(other=>other.id!==gun.id).every(other=>!artilleryContact(view,{...actor,...spacePoint(cell)},other)))).map(spacePoint).sort((a,b)=>a.y-b.y||a.x-b.x);
 assert.deepEqual(new Set(view.artillery.map(gun=>gun.id)),new Set(guns.map(gun=>gun.id)));const contactProof={first:contacts(guns[0]),secondExclusive:contacts(guns[1],true)};
 if(blockedFirst){assert.deepEqual(contactProof.first,[point(5,5)]);assert.ok(contactProof.secondExclusive.some(cell=>sameCell(cell,point(4,5))));assert.ok(contactProof.secondExclusive.some(cell=>sameCell(cell,point(4,6))));}else{assert.ok(contactProof.first.some(cell=>sameCell(cell,point(5,5))));assert.ok(contactProof.first.some(cell=>sameCell(cell,point(7,5))));}
 move(crew[0],point(5,9));move(crew[1],point(6,9));look(crew[1],point(6,8));assert.equal(environmentPreview(battle,body(crew[1]),{kind:'door',id:doorId},'close').valid,true);step({type:'door',unitId:String(crew[1]),doorId,open:false});assert.equal(leaf().open,false);
 const posts=crew.map(id=>({id,...spacePoint(body(id))}));assert.ok(posts.every(post=>post.y===building.y+building.height));assert.ok(crew.every(id=>!artilleryContact(battle,body(id),guns[0])));
 issue({type:'leaveSector',battleId:c.pendingBattle.id,sectorState:battle,survivors:battle.units.filter(unit=>unit.side==='player')});battle=null;c=saved(c);
 assert.equal(c.pendingEncounter,null);assert.equal(c.pendingBattle,null);assert.deepEqual(c.sectorStates[sector].artillery,guns);assert.equal(c.sectorStates[sector].wallEdges.find(edge=>edge.doorId===doorId).open,false);assert.deepEqual(cordobaClinicGroundCrew(c),[]);for(const post of posts)assert.ok(sameCell(c.operativeState[post.id].residentPosition,post));assert.deepEqual(d,declared);
 return {campaign:c,ids,crew,crewHome,physicianHome,posts,doorId,guns,contactProof,paid,blockedFirst};
}

function proveClosedCrewRestoration(fixture){
 const start=fixture.campaign,before=structuredClone(start),homes=structuredClone(start.squads),stock=allKits(start),deadline=clock(start)+3600,result=refreshCordobaClinicReadiness(start,null,{deadlineSeconds:deadline,revalidateGroundCrew:true}),c=result.campaign,r=result.receipt,index=fixture.blockedFirst?1:0;
 assert.ok(r.entryCrew.reason);assert.deepEqual(r.entryCrew.npcs,[]);assert.deepEqual(r.crewIds,fixture.crew);assert.equal(r.gunId,fixture.guns[index].id);if(fixture.blockedFirst)assert.equal(r.originalGunId,fixture.guns[0].id);else assert.equal(r.originalGunId,undefined);
 assert.ok(r.orders.some(row=>row.kind==='battle'&&row.action.type==='door'&&row.action.doorId===fixture.doorId&&row.action.open===true));assert.ok(r.orders.some(row=>row.kind==='battle'&&row.action.type==='move'));for(const id of fixture.crew)assert.ok(r.orders.filter(row=>row.kind==='battle'&&row.action.unitId===String(id)&&['move','climb'].includes(row.action.type)).length<=64);assert.ok(r.orders.length<=600);assert.ok(clock(c)>clock(start)&&clock(c)<=deadline);
 assert.deepEqual(c.sectorStates[sector].artillery,fixture.guns);assert.deepEqual(c.squads,homes);assert.equal(c.activeSquadId,start.activeSquadId);assert.deepEqual(c.contracts,start.contracts);assert.equal(c.resources.treasury,start.resources.treasury);assert.equal(allKits(c),stock);for(const id of fixture.ids)for(const key of ['alive','captured','hp','bleeding','bandaged','medkits','assignment','inventory','carriedLoaded'])assert.deepEqual(c.operativeState[id][key],start.operativeState[id][key]);assert.deepEqual(start,before);
 saved(c);assert.deepEqual(refreshCordobaClinicReadiness(saved(start),null,{deadlineSeconds:deadline,revalidateGroundCrew:true}),result);const again=refreshCordobaClinicReadiness(c,null,{deadlineSeconds:deadline,revalidateGroundCrew:true});assert.equal(again.receipt.entryCrew.reason,null);assert.equal(again.receipt.gunId,r.gunId);assert.ok(!again.receipt.orders.some(row=>row.kind==='battle'));assert.equal(clock(again.campaign),clock(c));assert.deepEqual(again.receipt.positions,r.positions);
 let state=again.campaign;for(let attempt=0;!state.pendingEncounter&&attempt<8;attempt++)state=order(state,{type:'wait',hours:1});assert.equal(state.pendingEncounter?.sector,sector);state=order(state,{type:'respondToEncounter',groupId:state.pendingEncounter.groupId,choice:'tactical'});
 const actual=prepareCampaignBattle(state);assert.equal(actual.error,null);const gun=actual.battle.artillery.find(piece=>piece.id===r.gunId),first=actual.battle.artillery.find(piece=>piece.id===fixture.guns[0].id),actor=actual.battle.units.find(unit=>unit.id===String(fixture.crew[0])),plan=artilleryCrewPlan(actual.battle,actor,gun,artilleryCosts(actual.battle,actor,gun).fire);
 assert.equal(plan.reason,null);assert.deepEqual(new Set(plan.crew),new Set(fixture.crew.map(String)));for(const id of fixture.crew){const unit=actual.battle.units.find(unit=>unit.id===String(id));assert.equal(artilleryContact(actual.battle,unit,gun),true);if(fixture.blockedFirst)assert.equal(artilleryContact(actual.battle,unit,first),false);}const roles=coordinatedHospitalBattery(actual.battle).roles;assert.deepEqual(new Set(roles.crews.find(crew=>crew.gunId===gun.id).ids),new Set(fixture.crew.map(String)));if(fixture.blockedFirst)assert.deepEqual(roles.crews.find(crew=>crew.gunId===first.id).ids,[]);
 assert.equal(actual.battle.artillery.length,fixture.guns.length);for(const original of fixture.guns){const current=actual.battle.artillery.find(piece=>piece.id===original.id);assert.deepEqual(Object.fromEntries(Object.keys(original).map(key=>[key,current[key]])),original);}return result;
}

test('outside paid crew opens the current closed public house and earns complete contact with its first finite cannon',()=>{
 const fixture=outsideClosedCrewSetup();assert.ok(fixture.contactProof.first.length>=2);proveClosedCrewRestoration(fixture);
});

test('one actual first-gun contact makes the same crew use two exclusive reachable posts at the existing second finite cannon',()=>{
 const fixture=outsideClosedCrewSetup({blockedFirst:true});assert.equal(fixture.contactProof.first.length,1);assert.ok(fixture.contactProof.secondExclusive.length>=2);proveClosedCrewRestoration(fixture);
});

test('outside closed-house crew stops at its original absolute deadline and never continues the refused preparation',()=>{
 const fixture=outsideClosedCrewSetup(),start=fixture.campaign,before=structuredClone(start),deadline=clock(start)+8;let failure;
 try{refreshCordobaClinicReadiness(start,null,{deadlineSeconds:deadline,revalidateGroundCrew:true});}catch(error){failure=error;}
 assert.ok(failure);assert.match(failure.message,/deadline/);const r=failure.cordobaClinicReadiness;assert.ok(r.entryCrew.reason);assert.ok(r.orders.some(row=>row.kind==='battle'));assert.ok(clock(failure.campaign)<=deadline);assert.ok(r.orders.length<=600);assert.deepEqual(failure.battle.artillery,fixture.guns.map(gun=>({...gun,stationed:true})));assert.equal(failure.campaign.resources.treasury,start.resources.treasury);for(const id of fixture.ids)for(const key of ['alive','captured','hp','bleeding','bandaged','medkits','assignment','inventory','carriedLoaded'])assert.deepEqual(failure.campaign.operativeState[id][key],key==='carriedLoaded'&&fixture.crew.includes(id)?0:start.operativeState[id][key],'operative '+id+' field '+key);JSON.stringify({campaign:failure.campaign,battle:failure.battle,receipt:r});assert.deepEqual(start,before);
 // Only raw actual accepted-prefix records follow the refusal. No game query,
 // codec, replay or continuation is performed on the returned error state.
});


test('a real cannon crew notice is acknowledged before repeating paid clinic preparation and all finite patients recover',()=>{
 const s=firstClinicDefenseSetup({crew:true}),start=s.campaign,before=structuredClone(start),events=[];
 const declaredKits=s.stock.filter(row=>row.item==='medkits').reduce((sum,row)=>sum+row.count,0)+start.recruited.reduce((sum,id)=>sum+start.operativeState[id].medkits,0);
 assert.equal(declaredKits,15);assert.equal(start.operativeState[s.ids[2]].hp,40);assert.equal(start.operativeState[s.ids[2]].bandaged,0);
 const c=recoverFreshCordobaSurvivors(start,{report:event=>events.push(event)}),ticks=events.filter(event=>event.event==='cordobaRecoveryCareHour'),notice=ticks.findIndex(tick=>tick.to===tick.from);
 assert.ok(notice>=0,'Actual assignment attention must interrupt an ordinary care wait.');
 const resumed=ticks.slice(notice+1,notice+4).find(tick=>tick.to>tick.from);assert.ok(resumed,'The next explicit waits must acknowledge the notice and pay actual care time.');
 assert.equal(resumed.from,ticks[notice].from);assert.equal(resumed.to-resumed.from,3600);
 const chest=c.sectorStates[sector].props.find(prop=>prop.id==='first-clinic-chest'),remaining=totalKits(c)+(c.sectorStates[sector].groundItems??[]).filter(row=>row.type==='item'&&row.item==='medkits').reduce((sum,row)=>sum+row.count,0)+(chest.contents??[]).filter(row=>row.item==='medkits').reduce((sum,row)=>sum+row.count,0);
 assert.ok(remaining<declaredKits&&remaining>=1,'Real treatment spends finite dressings and retains the rear reserve.');
 assert.equal(c.operativeState[s.ids[1]].medkits,1);assert.deepEqual(c.recruited,start.recruited);assert.deepEqual(c.contracts,start.contracts);
 for(const id of s.ids){assert.equal(c.operativeState[id].alive,true);assert.equal(c.operativeState[id].captured,false);assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);assert.equal(c.operativeState[id].bleeding,0);}
 assert.ok(clock(c)>clock(start)&&clock(c)<=clock(start)+(96+40*6)*3600);assert.equal(c.resources.treasury,start.resources.treasury-450);assert.equal(c.pendingEncounter,null);assert.equal(c.pendingBattle,null);
 assert.deepEqual(start,before);saved(c);assert.deepEqual(recoverFreshCordobaSurvivors(saved(start)),c);
});
