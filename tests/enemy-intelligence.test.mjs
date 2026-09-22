import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {launchEnemyGroup,recordEnemyGroupResult} from '../game/enemy-groups.js';
import {enemyIntelligenceReports,refreshEnemyIntelligence} from '../game/enemy-intelligence.js';
import {playerKnownCampaign} from '../game/player-known-state.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const save=s=>{const n=restoreCampaign(serializeCampaign(s));assert.deepEqual(n,s);return n;};
function frontier(){let s=initialCampaign();s.sectors.tucuman.owner='patriot';s.sectors.tucuman.militia=[1,0,0];launchEnemyGroup(s,'north','tucuman');return order(s,{type:'wait',hours:36});}
test('off-map dispatch is hidden from both reports and campaign announcements',()=>{
 let s=initialCampaign();s.sectors.jujuy.owner='patriot';s=order(s,{type:'wait',hours:120});assert.ok(s.enemyGroups.length);
 assert.deepEqual(enemyIntelligenceReports(s),[]);assert.deepEqual(playerKnownCampaign(s).enemyReports,[]);
 assert.ok(!s.log.some(l=>/realistas en marcha|Llegada prevista|Pezuela ordena/.test(l.text)));save(s);
});
test('nearby militia observe a real moving group; saved reports retain the last observation after scouts leave',()=>{
 let s=frontier(),r=enemyIntelligenceReports(s)[0];assert.equal(s.hour,36);assert.equal(r.sector,'salta');assert.equal(r.strength,3);assert.equal(r.source,'militia');assert.equal(r.stale,false);save(s);
 s.sectors.tucuman.militia=[0,0,0];s=order(s,{type:'wait',hours:1});r=enemyIntelligenceReports(s)[0];assert.equal(r.ageHours,1);assert.equal(r.stale,true);assert.equal(r.observedAt,36);
 const view=playerKnownCampaign(s).enemyReports;
 s.enemyGroups[0].units[0].hp=0;s.enemyGroups[0].arrivalAt+=20;s.enemyGroups[0].nextArrivalAt+=20;
 assert.deepEqual(playerKnownCampaign(s).enemyReports,view,'unobserved casualties and schedule changes cannot update reports');save(s);
 s.enemyIntelligence.reports[s.enemyGroups[0].id].privateFutureField='SECRET';assert.deepEqual(playerKnownCampaign(s).enemyReports,view);
 for(const forbidden of ['units','route','target','destination','remaining','seed','initialStrength','nextArrivalAt','crossingAt'])assert.ok(!(forbidden in r));
});
test('sleeping, critical, captured, dead and traveling soldiers cannot supply current scouting',()=>{
 const base=initialCampaign();launchEnemyGroup(base,'coast','retiro',{immediate:true});assert.equal(enemyIntelligenceReports(base)[0].strength,3);
 for(const patch of [{asleep:true},{hp:14},{captured:true},{alive:false},{unconscious:true}]){
  const s=structuredClone(base);for(const id of s.recruited)Object.assign(s.operativeState[id],patch);assert.deepEqual(enemyIntelligenceReports(s),[]);
 }
 const deployed=structuredClone(base);deployed.pendingBattle={defenseGroupId:deployed.enemyGroups[0].id,squad:deployed.recruited.map(id=>({id}))};assert.equal(enemyIntelligenceReports(deployed)[0].source,'contact');assert.equal(enemyIntelligenceReports(deployed)[0].strength,null);
 const s=structuredClone(base);s.squads[0].journey={status:'moving'};assert.deepEqual(enemyIntelligenceReports(s),[]);
 s.sectors.retiro.militia=[1,0,0];s.garrisons.retiro=[{id:20000,militiaRank:0,hp:10}];assert.deepEqual(enemyIntelligenceReports(s),[]);s.garrisons.retiro[0].hp=100;assert.equal(enemyIntelligenceReports(s)[0].source,'militia');
 s.pendingBattle={sector:'retiro',defenseGroupId:s.enemyGroups[0].id,garrison:[{id:20000}],squad:[]};assert.equal(enemyIntelligenceReports(s)[0].source,'contact');assert.equal(enemyIntelligenceReports(s)[0].strength,null);
 delete s.pendingBattle;s.sectors.retiro.militia=[2,0,0];s.garrisons.retiro[0].hp=10;assert.equal(enemyIntelligenceReports(s)[0].source,'militia','a new count-only cohort can scout without healing the existing wounded militia');
});
test('stationed forces reveal presence rather than their protected count; pending contact remains visible',()=>{
 const s=initialCampaign(),g=launchEnemyGroup(s,'coast','retiro',{immediate:true});g.status='stationed';g.resolvedAt=0;
 assert.equal(enemyIntelligenceReports(s)[0].strength,null);
 for(const id of s.recruited)s.operativeState[id].asleep=true;
 assert.deepEqual(enemyIntelligenceReports(s),[]);g.status='waiting';g.resolvedAt=null;s.pendingEncounter={groupId:g.id,sector:g.target,arrivedAt:0};
 const r=enemyIntelligenceReports(s)[0];assert.equal(r.source,'contact');assert.equal(r.strength,null);assert.equal(r.stale,false);
});
test('an undefended occupied town sends a presence report without a troop count or enemy schedule',()=>{
 let s=initialCampaign();launchEnemyGroup(s,'coast','buenos_aires');s=order(s,{type:'wait',hours:8});
 assert.equal(s.blockade,true);const r=enemyIntelligenceReports(s)[0];assert.equal(r.sector,'buenos_aires');assert.equal(r.source,'occupation');assert.equal(r.strength,null);save(s);
});
test('direct travel cannot keep scouting the departure sector during the march',()=>{
 let s=initialCampaign();const g=launchEnemyGroup(s,'coast','retiro');s=order(s,{type:'travel',sector:'buenos_aires'});
 assert.equal(s.hour,12);assert.equal(s.location,'buenos_aires');const r=enemyIntelligenceReports(s).find(r=>r.id===g.id);
 assert.equal(r.source,'occupation');assert.equal(r.observedAt,8);assert.equal(r.ageHours,4);assert.equal(r.strength,null);assert.equal(r.stale,true);save(s);
});
test('expired reports do not track an unseen force; returning scouts can verify an empty last position',()=>{
 let s=frontier();s.sectors.tucuman.militia=[0,0,0];s.hour+=73;assert.deepEqual(enemyIntelligenceReports(s),[]);refreshEnemyIntelligence(s);assert.deepEqual(s.enemyIntelligence.reports,{});
 s=frontier();s.enemyGroups[0].routeIndex=4;s.enemyGroups[0].status='waiting';s.sectors.tucuman.militia=[0,0,0];refreshEnemyIntelligence(s);assert.equal(enemyIntelligenceReports(s)[0].sector,'salta');
 s.sectors.salta.owner='patriot';s.sectors.salta.militia=[1,0,0];refreshEnemyIntelligence(s);assert.equal(enemyIntelligenceReports(s)[0].sector,'tucuman');assert.equal(enemyIntelligenceReports(s)[0].stale,false);
 s.enemyGroups[0].status='defeated';refreshEnemyIntelligence(s);assert.deepEqual(enemyIntelligenceReports(s),[]);
});
test('old saves gain no invented reports and malformed report payloads fail validation',()=>{
 const s=frontier();delete s.enemyIntelligence;const loaded=restoreCampaign(serializeCampaign(s));assert.deepEqual(loaded.enemyIntelligence,{version:1,reports:{}});
 const base=frontier(),key=base.enemyGroups[0].id;
 for(const mutate of [r=>r.observedAt=base.hour+1,r=>r.strength=31,r=>r.sector='secret',r=>r.units=[],r=>r.source='omniscient',r=>r.status='defeated']){const bad=structuredClone(base);mutate(bad.enemyIntelligence.reports[key]);assert.throws(()=>restoreCampaign(serializeCampaign(bad)),/exploración/);}
 for(const value of [null,[],{version:2,reports:{}},{version:1,reports:[]}]){const bad=structuredClone(base);bad.enemyIntelligence=value;assert.throws(()=>restoreCampaign(serializeCampaign(bad)),/exploración/);}
});
test('known victory clears the saved report and read-only projections never change campaign data',()=>{
 const s=frontier(),g=s.enemyGroups[0];g.status='stationed';g.resolvedAt=s.hour;
 const before=structuredClone(s);enemyIntelligenceReports(s);playerKnownCampaign(s);assert.deepEqual(s,before);
 recordEnemyGroupResult(s,g.id,{units:g.units.map(u=>({...u,side:'enemy',hp:0}))},'victory');assert.equal(s.enemyIntelligence.reports[g.id],undefined);
});
