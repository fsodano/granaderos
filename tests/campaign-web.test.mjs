import {encounterForOperative} from '../game/encounters.js';
import {scriptedBattleReport} from './scripted-battle-report.mjs';
import {attendYatasto} from './mission-helpers.mjs';
import {enterSector} from '../game/world.js';
import {marchToFront,restForMarch,meetLocalRecruit} from './campaign-test-helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchCampaign as dispatch,isSupplied,recruitmentStatus,restoreCampaign,serializeCampaign,OPERATIVES,CAMPAIGN_SECTORS,PHASES,RECIPES} from '../game/campaign.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
function resolveFixtureContacts(s){for(let i=0;s.pendingEncounter&&i<30;i++){s=dispatch(s,{type:'respondToEncounter',groupId:s.pendingEncounter.groupId,choice:'tactical'});assert.equal(s.lastError,null);const b=enterSector(s.pendingBattle,s.sectorStates[s.pendingBattle.sector]);b.status='victory';b.sectorCleared=true;for(const enemy of b.units.filter(u=>u.side==='enemy'))enemy.hp=0;s=dispatch(s,{type:'battleResult',battleId:s.pendingBattle.id,outcome:'victory',sectorState:b,survivors:b.units.filter(u=>u.side==='player')});assert.equal(s.lastError,null);}return s;}
let scriptedGuards=false;
const order=(s,action)=>{
 if(scriptedGuards)s=resolveFixtureContacts(s);
 if(['travel','attack'].includes(action.type))s=restForMarch(s);
 if(scriptedGuards)s=resolveFixtureContacts(s);
 if(scriptedGuards&&action.type==='attack')for(let i=0;i<12;i++){const at=s.location;s=resolveFixtureContacts(marchToFront(s,action));if(s.location===at)break;}
 if(action.type==='recruit'){const encounter=encounterForOperative(action.id);if(encounter&&s.location!==encounter.sector)s=order(s,{type:'travel',sector:encounter.sector});}
 const end=action.type==='wait'?s.hour+(action.hours??24):0;
 let next=meetLocalRecruit(s,action)??dispatch(marchToFront(s,action),action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);
 if(scriptedGuards){next=resolveFixtureContacts(next);for(let i=0;i<120&&((action.type==='travel'&&next.location!==action.sector)||(action.type==='wait'&&next.hour<end));i++){next=dispatch(action.type==='travel'?restForMarch(next):next,action.type==='wait'?{...action,hours:Math.min(240,end-next.hour)}:action);assert.equal(next.lastError,null);next=resolveFixtureContacts(next);}}
 if(scriptedGuards&&action.type==='attack')for(let attempt=0;!next.pendingBattle&&attempt<12;attempt++){next=resolveFixtureContacts(next);next=dispatch(marchToFront(next,action),action);assert.equal(next.lastError,null);next=resolveFixtureContacts(next);}
 const result=action.type==='diplomacy'&&action.kind==='northPact'&&next.phase===2?attendYatasto(next):next;return scriptedGuards?resolveFixtureContacts(result):result;
};
const capture=(s,id)=>{if(s.resources.powder<3){s=order(s,{type:'produce',recipe:'powder',sector:'retiro'});s=order(s,{type:'wait',hours:12});}s=order(s,{type:'attack',sector:id});const snapshot=enterSector(s.pendingBattle,s.sectorStates[s.pendingBattle.sector]);snapshot.status='victory';snapshot.sectorCleared=true;for(const enemy of snapshot.units.filter(u=>u.side==='enemy'))enemy.hp=0;return order(s,{type:'battleResult',battleId:s.pendingBattle.id,outcome:'victory',sectorState:snapshot,survivors:snapshot.units.filter(u=>u.side==='player').map(o=>({...o,id:Number(o.id)}))});};
test('historical geography, roster and phase definitions preserve requested scope',()=>{
 assert.equal(CAMPAIGN_SECTORS.length,13);assert.equal(new Set(CAMPAIGN_SECTORS.map(s=>s.grid)).size,13);assert.equal(new Set(CAMPAIGN_SECTORS.map(s=>s.theater)).size,4);assert.equal(OPERATIVES.length,13);assert.equal(PHASES.length,5);
 assert.equal(OPERATIVES.find(o=>o.id===0).weeklyPay,0);assert.equal(OPERATIVES.find(o=>o.id===2).weeklyPay,400);assert.equal(OPERATIVES.find(o=>o.id===10).medical,98);
});
test('orders immutable; failed purchases roll back all effects',()=>{
 const s=initialCampaign();const text=JSON.stringify(s);const n=order(s,{type:'academy'});assert.equal(JSON.stringify(s),text);assert.equal(n.phase,1);assert.equal(n.resources.muskets,50);
 const bad=dispatch(n,{type:'academy'});assert.ok(bad.lastError);delete bad.lastError;const comparison={...n};delete comparison.lastError;assert.deepEqual(bad,comparison);
});
test('five-phase campaign cannot unlock San Martín early',()=>{
 let s=initialCampaign();assert.equal(recruitmentStatus(s,57).available,false);s=order(s,{type:'academy'});assert.ok(dispatch(s,{type:'attack',sector:'san_lorenzo'}).lastError);
 s=capture(s,'san_nicolas');s=capture(s,'san_lorenzo');assert.equal(s.phase,2);
 s=capture(s,'cordoba');s=capture(s,'tucuman');s=capture(s,'salta');s=order(s,{type:'diplomacy',kind:'northPact'});assert.equal(s.phase,3);assert.equal(recruitmentStatus(s,0,true).available,true);assert.equal(recruitmentStatus(s,57).available,false);
 s=capture(s,'mendoza');s=order(s,{type:'recruit',id:2});s=order(s,{type:'foundry'});assert.equal(s.phase,3);
});
test('production consumes inputs, takes time and waits when cut off',()=>{
 let s=order(initialCampaign(),{type:'produce',recipe:'muskets',sector:'retiro'});assert.equal(s.resources.muskets,90);assert.equal(s.production.length,1);
 s=order(s,{type:'wait',hours:23});assert.equal(s.resources.muskets,90);s=order(s,{type:'wait',hours:1});assert.equal(s.resources.muskets,140);assert.equal(s.production.length,0);
 s=order(s,{type:'produce',recipe:'muskets',sector:'retiro'});s.sectors.retiro.owner='royalist';s=order(s,{type:'wait',hours:24});assert.equal(s.production.length,1);
});
test('contraband delay is 72–120 hours and blockade holds delivery',()=>{
 let s=order(initialCampaign(19),{type:'contraband',offer:'arms'});const due=s.shipments[0].due;assert.ok(due>=72&&due<=120);s.blockade=true;s=order(s,{type:'wait',hours:due});assert.equal(s.shipments.length,1);assert.equal(s.resources.muskets,90);s.blockade=false;s=order(s,{type:'wait',hours:1});assert.equal(s.shipments.length,0);assert.equal(s.resources.muskets,140);
});
test('captured crossroads cut the Camino Real; traversal respects control',()=>{
 const s=initialCampaign();for(const id of ['cordoba','tucuman','salta'])s.sectors[id].owner='patriot';assert.equal(isSupplied(s,'salta'),true);s.sectors.cordoba.owner='royalist';assert.equal(isSupplied(s,'salta'),false);assert.ok(dispatch(s,{type:'travel',sector:'salta'}).lastError);
});
test('militia holds raids and vulnerable northern provinces fall',()=>{
 let s=initialCampaign();s.sectors.jujuy.owner='patriot';s=order(s,{type:'wait',hours:144});assert.equal(s.sectors.jujuy.owner,'royalist');
 s=initialCampaign();s.sectors.jujuy.owner='patriot';s.sectors.jujuy.militia=[0,0,5];s=order(s,{type:'wait',hours:144});assert.equal(s.pendingEncounter.sector,'jujuy');s=order(s,{type:'respondToEncounter',groupId:s.pendingEncounter.groupId,choice:'auto'});assert.equal(s.enemyGroups[0].status,'defeated');assert.equal(s.sectors.jujuy.owner,'patriot');assert.equal(s.sectors.jujuy.militia[2],s.sectorStates.jujuy.units.filter(u=>u.militia&&u.hp>0).length);assert.ok(s.sectorStates.jujuy.units.filter(u=>u.militia).reduce((n,u)=>n+u.loaded+u.ammo,0)<30);
});
test('battle result IDs prevent stale victories and preserve casualties',()=>{
 let s=order(initialCampaign(),{type:'attack',sector:'san_nicolas'});assert.ok(dispatch(s,{type:'battleResult',battleId:'wrong',outcome:'victory',survivors:[]}).lastError);
 s=order(s,scriptedBattleReport(s,{units:[{id:3,hp:40},{id:4,hp:0},{id:10,hp:60}]}));assert.equal(s.operativeState[4].alive,false);assert.deepEqual(s.squad,[3,10]);assert.equal(s.sectors.san_nicolas.owner,'patriot');
});
test('Plumerillo requires 3000 equipped infantry, artillery, fortifications and parliament',()=>{
 let s=initialCampaign();s.phase=3;s.flags.foundry=true;s.flags.parliament=true;s.resources.infantry=2999;s.resources.cannons=3;
 for(const id of ['mendoza','uspallata','los_patos']){s.sectors[id].owner='patriot';s.sectors[id].fort=1;}
 s=order(s,{type:'wait',hours:1});assert.equal(s.phase,3);s.resources.infantry=3000;s=order(s,{type:'wait',hours:1});assert.equal(s.phase,4);assert.equal(recruitmentStatus(s,57,true).available,true);
 for(const id of ['cordoba','san_nicolas','tucuman'])s.sectors[id].owner='patriot';s=order(s,{type:'recruit',id:57});assert.equal(s.completed,false);for(const id of Object.keys(s.sectors))s.sectors[id].owner='patriot';s=order(s,{type:'wait',hours:1});assert.equal(s.completed,true);
});
test('save reload is deterministic and invalid version rejected',()=>{
 const s=order(initialCampaign(17),{type:'contraband',offer:'supplies'});assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);assert.deepEqual(dispatch(s,{type:'wait',hours:96}),dispatch(restoreCampaign(serializeCampaign(s)),{type:'wait',hours:96}));assert.throws(()=>restoreCampaign('{"version":99}'));
});

test('ammunition is finite, tactical round returns are capped and string IDs accepted',()=>{
 let s=initialCampaign();s.resources.cartridges=2;s=order(s,{type:'attack',sector:'san_nicolas'});assert.equal(s.resources.cartridges,0);assert.equal(s.pendingBattle.squad.reduce((n,o)=>n+o.loaded+o.ammo,0),2);
 const report=scriptedBattleReport(s,{outcome:'retreat'});report.survivors=report.survivors.map(u=>({...u,loaded:100,ammo:100}));s=order(s,report);assert.equal(s.resources.cartridges,2);
 s.resources.cartridges=0;s=order(s,{type:'attack',sector:'san_nicolas'});assert.ok(s.pendingBattle.squad.every(o=>o.loaded===0&&o.ammo===0));
});
test('monthly stipend is charged at30 days, no weekly deduction',()=>{
 let s=initialCampaign();
 s=order(s,{type:'wait',hours:168});assert.ok(!s.log.some(x=>x.text.includes('estipendios mensuales')));
 s=order(s,{type:'wait',hours:240});s=order(s,{type:'wait',hours:240});s=order(s,{type:'wait',hours:72});assert.ok(s.log.some(x=>x.text.includes('estipendios mensuales')));
});
test('untrusted saves reject malformed resources, sectors, squads and pending battle',()=>{
 for(const alter of [s=>s.resources.powder=-1,s=>s.sectors.salta.militia=[-2,0,0],s=>s.squad=[3,999],s=>s.operativeState[3].hp=10000,s=>s.pendingBattle={id:'invalid'},s=>s.production=[{sector:'mendoza',due:10,name:'x',yield:{treasury:-100}}]]){const s=initialCampaign();alter(s);assert.throws(()=>restoreCampaign(JSON.stringify(s)));}
});
test('campaign phases and timed production reach liberation with an existing garrison and scripted combat reports',t=>{
 t.after(()=>{scriptedGuards=false;});scriptedGuards=true;let fixture=initialCampaign();for(const region of Object.values(fixture.sectors))region.militia=[0,0,3];
 let s=order(fixture,{type:'academy'});
 for(const id of ['san_nicolas','san_lorenzo','cordoba','tucuman','salta'])s=capture(s,id);
 s=order(s,{type:'diplomacy',kind:'northPact'});
 for(const id of ['santa_fe','jujuy','humahuaca','mendoza','uspallata','los_patos'])s=capture(s,id);
 s=order(s,{type:'travel',sector:'mendoza'});s=order(s,{type:'recruit',id:2});s=order(s,{type:'foundry'});
 for(const id of ['mendoza','uspallata','los_patos','san_nicolas','jujuy'])s=order(s,{type:'fortify',sector:id});
 for(const id of ['san_nicolas','jujuy','jujuy']){if(s.sectors[id].owner==='royalist')s=capture(s,id);s=order(s,{type:'travel',sector:id});s=order(s,{type:'militia',sector:id,rank:0,trainerId:4});for(let n=0;s.militiaTraining.length&&n<12;n++)s=order(s,{type:'wait',hours:s.militiaTraining[0].remaining+12});assert.equal(s.militiaTraining.length,0);for(const operativeId of s.squad.filter(id=>s.operativeState[id].asleep))s=order(s,{type:'setSleep',operativeId,asleep:false});}s=order(s,{type:'travel',sector:'mendoza'});
 s=order(s,{type:'produce',recipe:'sabres',sector:'cordoba'});s=order(s,{type:'wait',hours:24});
 s=order(s,{type:'diplomacy',kind:'parliament'});
 // Manufacture actual supplies. Daily provincial output funds the full preparation.
 const make=(recipe)=>{s=order(s,{type:'produce',recipe,sector:'mendoza'});s=order(s,{type:'wait',hours:RECIPES[recipe].hours});};
 for(let i=0;i<3;i++){while(s.resources.copper<15)s=order(s,{type:'wait',hours:24});make('cannon');}
 for(let i=0;i<15;i++){
   while(s.resources.muskets<200)make('muskets');
   if(s.resources.textiles<40){s=order(s,{type:'contraband',offer:'supplies'});s=order(s,{type:'wait',hours:120});}
   make('uniforms');if(s.resources.powder<10)make('powder');make('infantry');
   // Repulse strategically scheduled raids and repair the supply corridor when needed.
   for(const id of ['san_nicolas','jujuy','salta','tucuman'])if(s.sectors[id].owner==='royalist')s=capture(s,id);
   if(s.blockade)s=capture(s,'san_nicolas');
 }
 assert.equal(s.resources.infantry,3000);assert.equal(s.phase,4);for(const def of CAMPAIGN_SECTORS)if(s.sectors[def.id].owner==='royalist')s=capture(s,def.id);
 for(let i=0;i<2;i++)s=order(s,{type:'fortify',sector:'humahuaca'});s=order(s,{type:'travel',sector:'jujuy'});for(let i=0;i<3;i++){s=order(s,{type:'militia',sector:'jujuy',rank:0,trainerId:4});for(let n=0;s.militiaTraining.length&&n<12;n++)s=order(s,{type:'wait',hours:s.militiaTraining[0].remaining+12});assert.equal(s.militiaTraining.length,0);for(const operativeId of s.squad.filter(id=>s.operativeState[id].asleep))s=order(s,{type:'setSleep',operativeId,asleep:false});}
 s=order(s,{type:'recruit',id:57});for(const def of CAMPAIGN_SECTORS)if(s.sectors[def.id].owner==='royalist')s=capture(s,def.id);if(s.blockade)s=capture(s,'san_nicolas');for(let guard=0;!s.completed&&s.enemyGroups.some(g=>g.status==='marching')&&guard<20;guard++)s=order(s,{type:'wait',hours:24});scriptedGuards=false;assert.equal(s.completed,true);assert.ok(s.hour<24*150,`Preparation took ${s.hour/24} days`);
});

test('southern winter closes Andean passes while northern gorge remains operational',()=>{
 let s=initialCampaign();s.hour=2160; // June1, after the March start.
 s.sectors.cordoba.owner='patriot';s.sectors.mendoza.owner='patriot';s.sectors.tucuman.owner='patriot';s.sectors.salta.owner='patriot';s.sectors.jujuy.owner='patriot';
 assert.ok(dispatch(s,{type:'attack',sector:'uspallata'}).lastError);assert.equal(dispatch(marchToFront(s,{type:'attack',sector:'humahuaca'}),{type:'attack',sector:'humahuaca'}).lastError,null);
});
