import {scriptedBattleReport} from './scripted-battle-report.mjs';
import {attendYatasto} from './mission-helpers.mjs';
import {marchToFront,restForMarch,meetLocalRecruit,completeTestTravel} from './campaign-test-helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchCampaign as dispatch,isSupplied,recruitmentStatus,restoreCampaign,serializeCampaign,OPERATIVES,CAMPAIGN_SECTORS,PHASES} from '../game/campaign.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
const order=(s,action)=>{const next=action.type==='travel'?completeTestTravel(s,action):meetLocalRecruit(s,action)??dispatch(marchToFront(s,action),action);assert.equal(next.lastError,null,`${action.type} ${action.sector??''} from ${s.location} at ${s.hour}: ${next.lastError}`);return action.type==='diplomacy'&&action.kind==='northPact'&&next.phase===2?attendYatasto(next):next;};
// Progression-only fixtures settle declared battles; these are not combat playthroughs.
const capture=(s,id)=>{
 const target=id==='san_lorenzo'?'san_nicolas':id,queue=[[s.location]],seen=new Set([s.location]);let path;
 while(queue.length){const current=queue.shift();if(current.at(-1)===target){path=current;break;}for(const next of CAMPAIGN_SECTORS.find(d=>d.id===current.at(-1)).neighbors)if(!seen.has(next)){seen.add(next);queue.push([...current,next]);}}
 assert.ok(path,`A map route to ${id} must exist`);
 for(const next of path.slice(1,id==='san_lorenzo'?undefined:-1)){
  if(s.sectors[next].owner==='royalist'||s.enemyGroups.some(g=>g.target===next&&g.status==='stationed'))s=capture(s,next);
  else s=order(s,{type:'travel',sector:next});
 }
 s=order(s,{type:'attack',sector:id});assert.ok(s.pendingBattle,`The ${id} deployment must finish its actual approach`);s=order(s,scriptedBattleReport(s));
 return s;
};
test('historical geography, roster and phase definitions preserve requested scope',()=>{
 assert.equal(CAMPAIGN_SECTORS.length,13);assert.equal(new Set(CAMPAIGN_SECTORS.map(s=>s.grid)).size,13);assert.equal(new Set(CAMPAIGN_SECTORS.map(s=>s.theater)).size,4);assert.equal(OPERATIVES.length,13);assert.equal(PHASES.length,5);
 assert.equal(OPERATIVES.find(o=>o.id===0).weeklyPay,0);assert.equal(OPERATIVES.find(o=>o.id===2).weeklyPay,400);assert.equal(OPERATIVES.find(o=>o.id===10).medical,98);
});
test('legacy academy order is immutable, free and idempotent',()=>{
 const s=initialCampaign();const text=JSON.stringify(s);const n=order(s,{type:'academy'});assert.equal(JSON.stringify(s),text);assert.equal(n.phase,1);assert.equal(n.resources.treasury,3200);
 const bad=dispatch(n,{type:'academy'});assert.equal(bad.lastError,null);delete bad.lastError;const comparison={...n};delete comparison.lastError;assert.deepEqual(bad,comparison);
});
test('five-phase campaign cannot unlock San Martín early',()=>{
 let s=initialCampaign();assert.equal(recruitmentStatus(s,57).available,false);s=order(s,{type:'academy'});assert.ok(dispatch(s,{type:'attack',sector:'san_lorenzo'}).lastError);
 s=capture(s,'san_nicolas');s=capture(s,'san_lorenzo');assert.equal(s.phase,2);
 s=capture(s,'cordoba');s=capture(s,'tucuman');s=capture(s,'salta');s=order(s,{type:'diplomacy',kind:'northPact'});assert.equal(s.phase,3);assert.equal(recruitmentStatus(s,0,true).available,true);assert.equal(recruitmentStatus(s,57).available,false);
 s=capture(s,'mendoza');s=order(s,{type:'recruit',id:2});s=order(s,{type:'foundry'});assert.equal(s.phase,3);
});
test('captured crossroads cut the Camino Real; traversal respects control',()=>{
 const s=initialCampaign();for(const id of ['cordoba','tucuman','salta'])s.sectors[id].owner='patriot';assert.equal(isSupplied(s,'salta'),true);s.sectors.cordoba.owner='royalist';assert.equal(isSupplied(s,'salta'),false);assert.ok(dispatch(s,{type:'travel',sector:'salta'}).lastError);
});
test('unguarded and defeated provinces fall while unresolved militia combat remains active',()=>{
 let s=initialCampaign();s.sectors.jujuy.owner='patriot';s=order(s,{type:'wait',hours:144});assert.equal(s.sectors.jujuy.owner,'royalist');
 // The current territorial tier launches eleven attackers. Twelve authored
 // veterans lose the actual fight; preserve that defeat and its permanent loss.
 s=initialCampaign();s.sectors.jujuy.owner='patriot';s.sectors.jujuy.militia=[0,0,12];s=order(s,{type:'wait',hours:144});
 const attackingForce=s.enemyGroups.find(g=>g.id===s.pendingEncounter.groupId).units.length;
 s=order(s,{type:'respondToEncounter',groupId:s.pendingEncounter.groupId,choice:'auto'});
 assert.equal(s.enemyGroups[0].status,'stationed');assert.equal(s.sectors.jujuy.owner,'royalist');
 assert.equal(s.sectorStates.jujuy.status,'defeat');assert.deepEqual(s.sectors.jujuy.militia,[0,0,0]);
 assert.ok(s.sectorStates.jujuy.units.some(u=>u.militia&&u.hp===0));
 // This subsystem fixture starts with a larger existing garrison. It tests
 // real combat settlement; the campaign route must pay for its own training.
 const defenders=16;
 s=initialCampaign();s.sectors.jujuy.owner='patriot';s.sectors.jujuy.militia=[0,0,defenders];s=order(s,{type:'wait',hours:144});
 assert.equal(s.enemyGroups.find(g=>g.id===s.pendingEncounter.groupId).units.length,attackingForce,'the reinforced defense faces the same enemy force');
 assert.equal(s.pendingEncounter.sector,'jujuy');s=order(s,{type:'respondToEncounter',groupId:s.pendingEncounter.groupId,choice:'auto'});
 assert.equal(s.enemyGroups[0].status,'engaged');assert.equal(s.sectors.jujuy.owner,'patriot');
 const b=s.pendingBattle.resumeSnapshot;assert.equal(b.status,'active');assert.equal(b.battleId,s.pendingBattle.id);assert.equal(b.savedHour,s.hour);assert.equal(b.savedSecond,s.secondOfHour);
 const militia=b.units.filter(u=>u.militia);assert.equal(militia.length,defenders);assert.ok(militia.some(u=>u.hp<=0));
 assert.ok(militia.reduce((n,u)=>n+u.loaded+u.ammo,0)<defenders*6);assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);
});
test('battle result IDs prevent stale victories and preserve casualties',()=>{
 let s=order(initialCampaign(),{type:'attack',sector:'san_nicolas'});assert.ok(dispatch(s,{type:'battleResult',battleId:'wrong',outcome:'victory',survivors:[]}).lastError);
 s=order(s,scriptedBattleReport(s,{units:[{id:3,hp:40},{id:4,hp:0},{id:10,hp:60}]}));assert.equal(s.operativeState[4].alive,false);assert.deepEqual(s.squad,[3,10]);assert.equal(s.sectors.san_nicolas.owner,'patriot');
});
test('Plumerillo requires army funding, artillery, fortifications and parliament',()=>{
 let s=initialCampaign();s.phase=3;s.flags.foundry=true;s.flags.parliament=true;s.flags.armyFunded=false;s.armory.bronze4=3;
 for(const id of ['mendoza','uspallata','los_patos']){s.sectors[id].owner='patriot';s.sectors[id].fort=1;}
 s=order(s,{type:'wait',hours:1});assert.equal(s.phase,3);s.flags.armyFunded=true;s=order(s,{type:'wait',hours:1});assert.equal(s.phase,4);assert.equal(recruitmentStatus(s,57,true).available,true);
 for(const id of ['cordoba','san_nicolas','tucuman'])s.sectors[id].owner='patriot';s=order(s,{type:'recruit',id:57});assert.equal(s.completed,false);for(const id of Object.keys(s.sectors))s.sectors[id].owner='patriot';s=order(s,{type:'wait',hours:1});assert.equal(s.completed,true);
});
test('save reload is deterministic and invalid version rejected',()=>{
 const s=order(initialCampaign(17),{type:'purchaseEquipment',item:1802});assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);assert.deepEqual(dispatch(s,{type:'wait',hours:96}),dispatch(restoreCampaign(serializeCampaign(s)),{type:'wait',hours:96}));assert.throws(()=>restoreCampaign('{"version":99}'));
});

test('departure purchases physical rounds once and rejects a return that creates cartridges',()=>{
 let s=initialCampaign();const departure=s.resources.treasury;s=order(s,{type:'travel',sector:'buenos_aires'});const cash=s.resources.treasury;s=order(s,{type:'attack',sector:'san_nicolas'});const issued=s.pendingBattle.issuedCartridges;assert.equal(s.resources.treasury,cash+320-issued);assert.ok(issued>0);assert.equal(cash,departure);
 const before=s.resources.treasury,forged=dispatch(s,{type:'battleResult',battleId:s.pendingBattle.id,outcome:'retreat',survivors:s.pendingBattle.squad.map(o=>({id:String(o.id),hp:o.hp,loaded:100,ammo:100}))});assert.ok(forged.lastError);assert.equal(forged.resources.treasury,before);
 s=order(s,scriptedBattleReport(s,{outcome:'retreat'}));assert.equal(s.resources.treasury,before);assert.equal(s.squad.reduce((n,id)=>n+(s.operativeState[id].ammo??0)+(s.operativeState[id].carriedLoaded??0),0),issued);
 s.resources.treasury=0;assert.equal(dispatch(s,{type:'visitSector'}).lastError,null,'owned rounds need no second purchase');
});
test('monthly stipend is charged at30 days, no weekly deduction',()=>{
 let s=initialCampaign();
 s=order(s,{type:'wait',hours:168});assert.ok(!s.log.some(x=>x.text.includes('estipendios mensuales')));
 s=order(s,{type:'wait',hours:240});s=order(s,{type:'wait',hours:240});s=order(s,{type:'wait',hours:72});assert.ok(s.log.some(x=>x.text.includes('estipendios mensuales')));
});
test('untrusted saves reject malformed resources, sectors, squads and pending battle',()=>{
 for(const alter of [s=>s.resources.powder=-1,s=>s.sectors.salta.militia=[-2,0,0],s=>s.squad=[3,999],s=>s.operativeState[3].hp=10000,s=>s.pendingBattle={id:'invalid'},s=>s.resources.treasury=-1]){const s=initialCampaign();alter(s);assert.throws(()=>restoreCampaign(JSON.stringify(s)));}
});
test('scripted combat settlements advance historical progression through money-only reducer orders',()=>{
 let s=order(initialCampaign(),{type:'academy'});
 for(const id of ['san_nicolas','san_lorenzo','cordoba','tucuman','salta'])s=capture(s,id);
 s=order(s,{type:'diplomacy',kind:'northPact'});
 for(const id of ['santa_fe','jujuy','humahuaca','mendoza','uspallata','los_patos'])s=capture(s,id);
 s=order(s,{type:'travel',sector:'mendoza'});s=order(s,{type:'recruit',id:2});s=order(s,{type:'foundry'});
 for(const id of ['mendoza','uspallata','los_patos','san_nicolas','jujuy'])s=order(s,{type:'fortify',sector:id});
 for(const id of ['san_nicolas','jujuy','jujuy']){if(s.sectors[id].owner==='royalist')s=capture(s,id);s=order(s,{type:'travel',sector:id});s=order(s,{type:'militia',sector:id,rank:0,trainerId:4});s=order(s,{type:'wait',hours:s.militiaTraining[0].remaining});}s=order(s,{type:'travel',sector:'mendoza'});
 s=order(s,{type:'diplomacy',kind:'parliament'});
 while(s.resources.treasury<5100)s=order(s,{type:'wait',hours:24});
 s=order(s,{type:'fundArmy'});s=order(s,{type:'purchaseEquipment',item:'bronze4',quantity:3});
 assert.equal(s.flags.armyFunded,true);assert.equal(s.phase,4);for(const def of CAMPAIGN_SECTORS)if(s.sectors[def.id].owner==='royalist')s=capture(s,def.id);
 for(let i=0;i<2;i++)s=order(s,{type:'fortify',sector:'humahuaca'});s=order(s,{type:'travel',sector:'jujuy'});for(let i=0;i<3;i++){s=order(s,{type:'militia',sector:'jujuy',rank:0,trainerId:4});s=order(s,{type:'wait',hours:s.militiaTraining[0].remaining});}
 s=order(s,{type:'recruit',id:57});for(const def of CAMPAIGN_SECTORS)if(s.sectors[def.id].owner==='royalist')s=capture(s,def.id);if(s.blockade)s=capture(s,'san_nicolas');assert.equal(s.completed,true);assert.ok(s.hour<24*150,`Preparation took ${s.hour/24} days`);
});

test('southern winter closes Andean passes while northern gorge remains operational',()=>{
 let s=initialCampaign();s.hour=2160; // June1, after the March start.
 s.sectors.cordoba.owner='patriot';s.sectors.mendoza.owner='patriot';s.sectors.tucuman.owner='patriot';s.sectors.salta.owner='patriot';s.sectors.jujuy.owner='patriot';
 assert.ok(dispatch(s,{type:'attack',sector:'uspallata'}).lastError);assert.equal(dispatch(marchToFront(s,{type:'attack',sector:'humahuaca'}),{type:'attack',sector:'humahuaca'}).lastError,null);
});
