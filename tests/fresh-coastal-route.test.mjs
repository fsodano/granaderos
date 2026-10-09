import {deploymentCost,rosterFor} from '../game/campaign.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {freshCoastalRoute} from './fresh-coastal-fixture.mjs';
import {order,saved,visit,leave} from './local-contract-fixture.mjs';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {repairMaterialPoints} from '../game/repair-materials.js';
import {collectRouteItems,repairRouteFirearms} from './finite-route-equipment.mjs';

for(const kind of ['created','hired'])test(`funded ${kind} force wins the coastal opening with real losses, paid replacements and saved replay`,async t=>{
 const {campaign,notes}=freshCoastalRoute(kind);
 assert.equal(Boolean(campaign.officer),kind==='created');
 assert.deepEqual(notes.slice(1).map(n=>n.sector),['buenos_aires','san_nicolas','san_lorenzo']);
 assert.ok(notes.every(n=>n.funds>=0));
 if(kind==='created')await t.test('the actual fallen soldier toolkit remains collectible from the San Lorenzo mission and funds finite saved repair',()=>{
  const before=structuredClone(campaign),roster=rosterFor(campaign);
  const mechanic=roster.filter(o=>campaign.squad.includes(o.id)&&o.mechanical>=20&&campaign.operativeState[o.id].hp>=15&&!campaign.operativeState[o.id].bleeding&&!campaign.operativeState[o.id].asleep&&campaign.operativeState[o.id].energy>10&&campaign.operativeState[o.id].condition<100).sort((a,b)=>b.mechanical-a.mechanical)[0];assert.ok(mechanic);
  const body=campaign.sectorStates.san_lorenzo.units.find(u=>u.side==='player'&&u.hp===0&&Object.values(u.inventory??{}).some(item=>item.kind==='repair-kit'&&item.instanceId==='cache:buenos_aires:repair-kit'));assert.ok(body);
  const kit=Object.values(body.inventory).find(item=>item.kind==='repair-kit'&&item.instanceId==='cache:buenos_aires:repair-kit');
  assert.equal(campaign.operativeState[body.id].alive,false);
  assert.equal(body.hp,0);assert.equal(body.knownToPlayer,true);assert.equal(kit.instanceId,'cache:buenos_aires:repair-kit');assert.ok(kit.repairPoints>0);
  assert.equal(sectorInventoryModel(campaign,'san_nicolas',roster,mechanic.id).entries.some(row=>JSON.parse(row.expected).kind==='repair-kit'),false);
  assert.ok(sectorInventoryModel(campaign,'san_lorenzo',roster,mechanic.id).entries.some(row=>row.reachable&&JSON.parse(row.expected).instanceId===kit.instanceId));
  const found=collectRouteItems(campaign,mechanic.id,{kind:'repair-kit',instanceId:kit.instanceId},1);let s=found.campaign;
  assert.deepEqual(campaign,before);assert.equal(found.collected,1);assert.equal(repairMaterialPoints(s.operativeState[mechanic.id]),kit.repairPoints);
  assert.equal(repairMaterialPoints(s.sectorStates.san_lorenzo.units.find(u=>u.id===body.id)),0);
  assert.equal(s.resources.treasury,campaign.resources.treasury);assert.equal(s.hour,campaign.hour);assert.equal(s.secondOfHour,campaign.secondOfHour);
  assert.deepEqual(saved({campaign:s}).campaign,s);
  const transferred=structuredClone(s);assert.throws(()=>collectRouteItems(s,mechanic.id,{kind:'repair-kit',instanceId:kit.instanceId},1),/finite local equipment/);assert.deepEqual(s,transferred,'the emptied body cannot supply the same toolkit twice');
  const condition=s.operativeState[mechanic.id].condition;assert.ok(condition<100);s=repairRouteFirearms(s,[mechanic.id]);
  assert.equal(s.operativeState[mechanic.id].condition,100);assert.equal(kit.repairPoints-repairMaterialPoints(s.operativeState[mechanic.id]),100-condition);
  assert.equal(Object.values(s.operativeState[mechanic.id].inventory).find(item=>item.kind==='repair-kit').instanceId,kit.instanceId);
  for(const [id,r]of Object.entries(before.operativeState))if(!r.alive)assert.equal(s.operativeState[id].alive,false);
  assert.deepEqual(saved({campaign:s}).campaign,s);assert.deepEqual(campaign,before);
 });
});

test('a fresh free officer and local recruits complete the opening without bulletin hires, preserving native health and finite recovery',t=>{
 const {campaign:s,notes}=freshCoastalRoute('local');
 assert.deepEqual(notes.filter(n=>n.sector).map(n=>n.sector),['buenos_aires','san_nicolas','san_lorenzo']);assert.ok(notes.every(n=>n.funds>=0));
 assert.deepEqual(notes[0].squad,[1000,3]);assert.equal(notes[0].funds,3200);
 const care=notes.find(n=>n.stage==='local-recovery');assert.equal(care.hours,0);assert.equal(care.dressingsFound,0);assert.equal(care.dressingsBought,0);assert.equal(care.dressingCost,0);assert.equal(care.weaponCost,0);assert.equal(care.workshopCost,0);assert.ok(care.repairPointsSpent>0);
 const woundedCare=notes.find(n=>n.stage==='local-final-recovery'&&n.hours>0);assert.ok(woundedCare,'the actual San Nicolás wounds must receive finite paid-time care');assert.equal(woundedCare.dressingsBought,0);assert.equal(woundedCare.dressingCost,0);
 // Current combat determines who survives. Preserve every actual casualty and
 // finite recovery record instead of forcing an old number of deaths or hours.
 const fallen=[...new Set(notes.filter(n=>n.sector).flatMap(n=>n.deaths))];
 for(const id of fallen){assert.equal(s.operativeState[id].alive,false);assert.equal(s.operativeState[id].hp,0);assert.ok(!s.squad.includes(id));}
 assert.ok(s.squad.length>0);assert.ok(s.missionAllies.san_lorenzo.hp>0);
 const cohort=[1000,3,4,10],field=s.sectorStates.san_lorenzo.units;
 for(const id of cohort){const native=field.find(u=>u.id===String(id));assert.ok(native);assert.equal(s.operativeState[id].alive,native.hp>0);assert.equal(s.operativeState[id].hp,native.hp);}
 const finalCare=notes.find(n=>n.stage==='local-final-recovery');assert.ok(finalCare);assert.equal(finalCare.dressingCost,finalCare.dressingsBought*10);assert.equal(finalCare.weaponCost,0);
 const continued=saved({campaign:order(s,{type:'wait',hours:1})}).campaign,money=continued.resources.treasury,cost=deploymentCost(continued),p=visit(continued);
 assert.deepEqual(p.battle.units.filter(u=>u.side==='player'&&!u.missionAlly).map(u=>u.id).sort(),continued.squad.map(String).sort());assert.equal(new Set(p.battle.units.map(u=>u.id)).size,p.battle.units.length,'revisit must not duplicate a living soldier or a body');
 for(const id of fallen)assert.ok(!p.battle.units.some(u=>u.id===String(id)&&u.hp>0));
 const returned=saved({campaign:leave(p)}).campaign;
 assert.equal(returned.resources.treasury,money-cost);assert.deepEqual(returned.squad,continued.squad);
 for(const id of continued.squad){assert.equal(returned.operativeState[id].hp,continued.operativeState[id].hp);assert.equal(returned.operativeState[id].ammo,continued.operativeState[id].ammo);assert.equal(returned.operativeState[id].carriedLoaded,continued.operativeState[id].carriedLoaded);assert.equal(returned.operativeState[id].medkits,continued.operativeState[id].medkits);assert.deepEqual(returned.operativeState[id].inventory,continued.operativeState[id].inventory);}
 assert.deepEqual(returned.ammunitionStores,continued.ammunitionStores);assert.deepEqual(returned.sectorStates.buenos_aires.props.find(prop=>prop.id==='buenos_aires:building:chest:10:4').contents,continued.sectorStates.buenos_aires.props.find(prop=>prop.id==='buenos_aires:building:chest:10:4').contents,'the finite capital cache must stay depleted after revisit');
 for(const id of fallen)assert.equal(returned.operativeState[id].alive,false);
 assert.equal(returned.completed,false);assert.equal(returned.defeated,false);
 t.diagnostic(JSON.stringify({care,opening:{hour:s.hour,second:s.secondOfHour,funds:s.resources.treasury},continuation:{hour:returned.hour,funds:returned.resources.treasury,squad:returned.squad},battles:notes.filter(n=>n.sector).map(({sector,actions,turns,deaths})=>({sector,actions,turns,deaths}))}));
});
