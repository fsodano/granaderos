import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchCampaign as dispatch,isSupplied,royalistIntel,mentorDispatch} from '../game/campaign.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {NORTHERN_AXIS,coastalRevenue} from '../game/narrative.js';
const wait=(s,hours)=>{const n=dispatch(s,{type:'wait',hours});assert.equal(n.lastError,null);return n;};
test('Tristán advances down the actual northern corridor under Pezuela orders',()=>{
 let s=initialCampaign();for(const id of NORTHERN_AXIS)s.sectors[id].owner='patriot';
 for(const id of NORTHERN_AXIS){s=wait(s,120-s.hour%120);const group=s.enemyGroups.at(-1);assert.equal(group.status,'marching');s=wait(s,group.arrivalAt-s.hour);assert.equal(s.sectors[id].owner,'royalist',id);assert.equal(group.command,'north');assert.ok(group.units.some(u=>u.name.includes('Tristán')));assert.ok(!s.log.some(e=>e.text.includes('Pezuela ordena')));}
});
test('a held border prevents the army from skipping to undefended southern provinces',()=>{
 let s=initialCampaign();for(const id of NORTHERN_AXIS)s.sectors[id].owner='patriot';s.sectors.humahuaca.fort=3;s.sectors.humahuaca.militia=[0,0,20];s=wait(s,240);assert.equal(s.hour,132);assert.equal(s.pendingEncounter.sector,'humahuaca');s=dispatch(s,{type:'respondToEncounter',groupId:s.pendingEncounter.groupId,choice:'auto'});assert.equal(s.lastError,null);assert.equal(s.enemyGroups[0].status,'defeated');
 for(const id of NORTHERN_AXIS)assert.equal(s.sectors[id].owner,'patriot');assert.equal(royalistIntel(s).find(c=>c.id==='north').target,undefined);
});
test('Romarate responds to actual customs revenue and suppresses that same economy',()=>{
 let quiet=wait(initialCampaign(),168);assert.equal(quiet.blockade,false);assert.ok(coastalRevenue(quiet)<500);
 let s=initialCampaign();s.sectors.san_nicolas.owner='patriot';assert.ok(coastalRevenue(s)>=500);const before=coastalRevenue(s);s=wait(s,176);assert.equal(s.blockade,true);assert.ok(coastalRevenue(s)<before);assert.ok(s.enemyGroups.some(g=>g.command==='naval'&&g.units.some(u=>u.name.includes('Romarate'))));assert.equal(royalistIntel(s).find(c=>c.id==='naval').active,undefined);
});
test('loyalist interior raids seize the supply junction and sack convoy stores',()=>{
 let s=initialCampaign();s.sectors.cordoba.owner='patriot';s.sectors.cordoba.loyalty=10;s.sectors.tucuman.owner='patriot';s.sectors.salta.owner='patriot';assert.equal(isSupplied(s,'salta'),true);const healthy={...s,sectors:JSON.parse(JSON.stringify(s.sectors))};healthy.sectors.cordoba.loyalty=70;
 s=wait(s,150);const control=wait(healthy,150);assert.equal(s.sectors.cordoba.owner,'royalist');assert.equal(isSupplied(s,'salta'),false);assert.equal(control.sectors.cordoba.owner,'patriot');assert.equal(control.resources.powder-s.resources.powder,20);assert.ok(s.log.some(e=>e.text.includes('convoyes de Cuyo')));
});
test('battle briefing and troop names identify the opposing command',()=>{
 const s=dispatch(dispatch(initialCampaign(),{type:'travel',sector:'buenos_aires'}),{type:'attack',sector:'san_nicolas'});assert.equal(s.lastError,null);assert.equal(s.pendingBattle.enemyCommand,'naval');assert.equal(s.pendingBattle.enemyCommander,'Jacinto de Romarate');assert.ok(s.pendingBattle.enemies.some(o=>o.name.includes('Romarate')));assert.ok(s.pendingBattle.enemies.every(o=>o.weapon>=1800&&o.weapon<=1808));
});
test('San Martín provides phase-specific strategic mentorship without premature deployment',()=>{
 const s=initialCampaign();assert.equal(mentorDispatch(s).deployable,false);assert.match(mentorDispatch(s).text,/Retiro/);s.phase=2;assert.match(mentorDispatch(s).text,/Yatasto/);s.phase=3;assert.match(mentorDispatch(s).text,/Güemes/);s.phase=4;assert.equal(mentorDispatch(s).deployable,true);
});

test('public command background retains historical doctrine but reveals no dispatch predictions',()=>{
 const before=initialCampaign(),after=structuredClone(before);after.hour=167;after.sectors.san_nicolas.owner='patriot';after.sectors.cordoba.owner='patriot';after.sectors.cordoba.loyalty=0;
 assert.deepEqual(royalistIntel(before),royalistIntel(after));
 for(const command of royalistIntel(after)){assert.ok(command.commander);assert.ok(command.objective);for(const key of ['target','active','nextActionHours'])assert.equal(command[key],undefined);}
});
