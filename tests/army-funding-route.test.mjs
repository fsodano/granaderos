import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {order,saved} from './local-contract-fixture.mjs';
import {withStoredGear} from './commerce-gear-fixture.mjs';
import {artilleryCount,dailyIncome} from '../game/economy.js';
import {foundryFor} from '../game/campaign-foundry.js';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {prepareGarrison} from '../game/garrison.js';
import {militiaCourse} from '../game/militia.js';
import {TRANSPORT_NETWORKS} from '../game/transport-network.js';

// Existing savings, province, service and finite equipment isolate preparation.
// This scenario does not prove a route from a fresh campaign or any battle.
function preparedProvince(){
 let s=initialCampaign(42);s.resources.treasury=20000;s.phase=3;s.flags.foundry=true;s.location='mendoza';
 s.recruited=[3,4,10,2,7];s.squad=[...s.recruited];s.squads[0].members=[...s.squad];s.squads[0].location='mendoza';
 for(const id of s.recruited){s.operativeState[id].location='mendoza';s.contracts[id]={kind:'legacy',term:'month',started:0,expiresAt:null,paid:0};}
 for(const id of ['cordoba','mendoza'])Object.assign(s.sectors[id],{owner:'patriot',loyalty:65});
 s=withStoredGear(s,'bronze4',3);
 // Three already equipped civic defenders own their six cartridges each.
 s.sectors.cordoba.militia=[3,0,0];prepareGarrison(s,'cordoba');
 return saved({campaign:s}).campaign;
}
const gearReceipt=unit=>({id:unit.id,weapon:unit.weapon,blade:unit.blade,loaded:unit.loaded,ammo:unit.ammo,inventory:unit.inventory});

test('prepared army funding preserves three owned cannons and pays for local militia promotion and fortification',()=>{
 const start=preparedProvince(),before=structuredClone(start),defenders=start.garrisons.cordoba.map(gearReceipt),initialTreasury=start.resources.treasury;
 assert.equal(artilleryCount(start),3);assert.equal(dailyIncome(start),0);
 assert.equal(defenders.reduce((sum,unit)=>sum+unit.loaded+unit.ammo,0),18);
 const posta=TRANSPORT_NETWORKS.find(network=>network.id==='posta');
 let s=order(start,{type:'transport',mode:'posta'});
 assert.deepEqual(start,before,'Public preparation must not mutate its input.');
 assert.equal(s.resources.treasury,initialTreasury-posta.cost);
 const outwardTreasury=s.resources.treasury;s=order(s,{type:'travel',sector:'cordoba',mode:'posta'});
 assert.equal(s.resources.treasury,outwardTreasury-10,'The single outbound posta leg pays for its remounts.');
 assert.equal(s.operativeState[7].location,'cordoba');
 const trainer=rosterFor(s).find(unit=>unit.id===7),course=militiaCourse(trainer,1),trainingTreasury=s.resources.treasury;
 s=order(s,{type:'militia',sector:'cordoba',trainerId:7,rank:1});
 assert.equal(s.resources.treasury,trainingTreasury-course.cost.treasury);
 assert.deepEqual(s.militiaTraining[0].trainees.map(gearReceipt),defenders);
 const courseStart=s.hour;
 for(let i=0;i<96&&s.militiaTraining.length;i++){
  assert.equal(s.pendingEncounter,null);
  s=order(s,{type:'wait',hours:1});
 }
 assert.equal(s.militiaTraining.length,0);assert.ok(s.hour>=courseStart+course.hours);
 assert.deepEqual(s.sectors.cordoba.militia,[0,3,0]);
 assert.deepEqual(s.garrisons.cordoba.map(gearReceipt),defenders,'Promotion preserves the actual soldiers and their finite weapons and cartridges.');
 for(let level=1;level<=3;level++){
  const cash=s.resources.treasury;s=order(s,{type:'fortify',sector:'cordoba'});
  assert.equal(s.resources.treasury,cash-150);assert.equal(s.sectors.cordoba.fort,level);
 }
 const fortified=structuredClone(s),rejected=dispatchCampaign(s,{type:'fortify',sector:'cordoba'});
 assert.match(rejected.lastError,/máxima fortificación/);assert.deepEqual({...rejected,lastError:null},fortified);
 s=order(s,{type:'createSquad',name:'Mando de Mendoza',ids:s.squad.filter(id=>id!==7),sector:'cordoba'});
 const returnTreasury=s.resources.treasury;s=order(s,{type:'travel',sector:'mendoza',mode:'posta'});
 assert.equal(s.resources.treasury,returnTreasury-10,'The single return leg pays for its remounts.');
 const fundingTreasury=s.resources.treasury,fundingCost=foundryFor(s).fundingCost;
 assert.equal(s.flags.armyFunded,false);s=order(s,{type:'fundArmy'});
 assert.equal(s.resources.treasury,fundingTreasury-fundingCost);assert.equal(s.flags.armyFunded,true);
 assert.equal(s.resources.treasury,initialTreasury-posta.cost-20-course.cost.treasury-450-fundingCost);
 assert.equal(artilleryCount(s),3);assert.deepEqual(s.armory,before.armory);
 assert.equal(s.operativeState[7].location,'cordoba');assert.equal(s.completed,false);
 assert.deepEqual(saved({campaign:s}).campaign,s);
 const funded=structuredClone(s),duplicate=dispatchCampaign(s,{type:'fundArmy'});
 assert.match(duplicate.lastError,/ya está financiado/);assert.deepEqual({...duplicate,lastError:null},funded);
});
