import {marchToFront,meetLocalRecruit} from './campaign-test-helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign as dispatch,isSupplied,recruitmentStatus,restoreCampaign,serializeCampaign,OPERATIVES,CAMPAIGN_SECTORS,PHASES,RECIPES} from '../game/campaign.js';
const order=(s,action)=>{const next=meetLocalRecruit(s,action)??dispatch(marchToFront(s,action),action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;};
const capture=(s,id)=>{s=order(s,{type:'attack',sector:id});return order(s,{type:'battleResult',battleId:s.pendingBattle.id,outcome:'victory',survivors:s.pendingBattle.squad.map(o=>({id:o.id,hp:o.hp}))});};
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
 let s=initialCampaign();s.sectors.jujuy.owner='patriot';s=order(s,{type:'wait',hours:120});assert.equal(s.sectors.jujuy.owner,'royalist');
 s=initialCampaign();s.sectors.jujuy.owner='patriot';s.sectors.jujuy.militia=[0,0,5];s=order(s,{type:'wait',hours:120});assert.equal(s.sectors.jujuy.owner,'patriot');
});
test('battle result IDs prevent stale victories and preserve casualties',()=>{
 let s=order(initialCampaign(),{type:'attack',sector:'san_nicolas'});assert.ok(dispatch(s,{type:'battleResult',battleId:'wrong',outcome:'victory',survivors:[]}).lastError);
 s=order(s,{type:'battleResult',battleId:s.pendingBattle.id,outcome:'victory',survivors:[{id:3,hp:40},{id:10,hp:60}]});assert.equal(s.operativeState[4].alive,false);assert.deepEqual(s.squad,[3,10]);assert.equal(s.sectors.san_nicolas.owner,'patriot');
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
 s=order(s,{type:'battleResult',battleId:s.pendingBattle.id,outcome:'retreat',survivors:s.pendingBattle.squad.map(o=>({id:String(o.id),hp:o.hp,loaded:100,ammo:100}))});assert.equal(s.resources.cartridges,2);
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
test('full campaign reaches liberation through reducer orders and timed production',()=>{
 let s=order(initialCampaign(),{type:'academy'});
 for(const id of ['san_nicolas','san_lorenzo','cordoba','tucuman','salta'])s=capture(s,id);
 s=order(s,{type:'diplomacy',kind:'northPact'});
 for(const id of ['santa_fe','jujuy','humahuaca','mendoza','uspallata','los_patos'])s=capture(s,id);
 s=order(s,{type:'travel',sector:'mendoza'});s=order(s,{type:'recruit',id:2});s=order(s,{type:'foundry'});
 for(const id of ['mendoza','uspallata','los_patos','san_nicolas','jujuy'])s=order(s,{type:'fortify',sector:id});
 for(const id of ['san_nicolas','jujuy','jujuy']){if(s.sectors[id].owner==='royalist')s=capture(s,id);s=order(s,{type:'travel',sector:id});s=order(s,{type:'militia',sector:id,rank:0,trainerId:4});s=order(s,{type:'wait',hours:s.militiaTraining[0].remaining});}s=order(s,{type:'travel',sector:'mendoza'});
 s=order(s,{type:'produce',recipe:'sabres',sector:'cordoba'});s=order(s,{type:'wait',hours:24});
 s=order(s,{type:'diplomacy',kind:'parliament'});
 // Manufacture actual supplies. Daily provincial output funds the full preparation.
 const make=(recipe)=>{s=order(s,{type:'produce',recipe,sector:'mendoza'});s=order(s,{type:'wait',hours:RECIPES[recipe].hours});};
 for(let i=0;i<3;i++){while(s.resources.copper<15)s=order(s,{type:'wait',hours:24});make('cannon');}
 for(let i=0;i<15;i++){
   while(s.resources.muskets<200)make('muskets');
   if(s.resources.textiles<40){s=order(s,{type:'contraband',offer:'supplies'});s=order(s,{type:'wait',hours:120});}
   make('uniforms');make('infantry');
   // Repulse strategically scheduled raids and repair the supply corridor when needed.
   for(const id of ['san_nicolas','jujuy','salta','tucuman'])if(s.sectors[id].owner==='royalist')s=capture(s,id);
   if(s.blockade)s=capture(s,'san_nicolas');
 }
 assert.equal(s.resources.infantry,3000);assert.equal(s.phase,4);for(const def of CAMPAIGN_SECTORS)if(s.sectors[def.id].owner==='royalist')s=capture(s,def.id);
 for(let i=0;i<2;i++)s=order(s,{type:'fortify',sector:'humahuaca'});s=order(s,{type:'travel',sector:'humahuaca'});for(let i=0;i<3;i++){s=order(s,{type:'militia',sector:'humahuaca',rank:0,trainerId:4});s=order(s,{type:'wait',hours:s.militiaTraining[0].remaining});}
 s=order(s,{type:'recruit',id:57});for(const def of CAMPAIGN_SECTORS)if(s.sectors[def.id].owner==='royalist')s=capture(s,def.id);if(s.blockade)s=capture(s,'san_nicolas');assert.equal(s.completed,true);assert.ok(s.hour<24*150,`Preparation took ${s.hour/24} days`);
});

test('southern winter closes Andean passes while northern gorge remains operational',()=>{
 let s=initialCampaign();s.hour=2160; // June1, after the March start.
 s.sectors.cordoba.owner='patriot';s.sectors.mendoza.owner='patriot';s.sectors.tucuman.owner='patriot';s.sectors.salta.owner='patriot';s.sectors.jujuy.owner='patriot';
 assert.ok(dispatch(s,{type:'attack',sector:'uspallata'}).lastError);assert.equal(dispatch(marchToFront(s,{type:'attack',sector:'humahuaca'}),{type:'attack',sector:'humahuaca'}).lastError,null);
});
