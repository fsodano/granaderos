import {deploymentCost,rosterFor} from '../game/campaign.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {freshCoastalRoute} from './fresh-coastal-fixture.mjs';
import {order,saved,visit,leave} from './local-contract-fixture.mjs';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {repairMaterialPoints} from '../game/repair-materials.js';
import {collectRouteItems,repairRouteFirearms} from './finite-route-equipment.mjs';
import {sectorInventorySites} from '../game/sector-inventory.js';
import {advanceCampaignHours} from './campaign-wait-fixture.mjs';
import {FINITE_SECTOR_CACHES} from '../game/finite-sector-caches.js';
import {paidCasualty} from './paid-casualty-fixture.mjs';

for(const kind of ['created','hired'])test(`funded ${kind} force wins the coastal opening with real losses, paid replacements and saved replay`,async t=>{
 const {campaign,notes}=freshCoastalRoute(kind);
 assert.equal(Boolean(campaign.officer),kind==='created');
 assert.deepEqual(notes.filter(n=>n.sector).map(n=>n.sector),['buenos_aires','san_nicolas','san_lorenzo']);
 assert.ok(notes.every(n=>n.funds>=0));
 if(kind==='hired'){
  const care=notes.find(note=>note.stage==='paid-clinic-recovery'&&note.clinic==='buenos_aires');assert.ok(care);
  const opening=notes.find(note=>note.sector==='buenos_aires'),survivors=opening.units.filter(unit=>unit.hp>0).map(unit=>Number(unit.id));
  assert.deepEqual(care.field,survivors,'every actual opening survivor retains field membership for clinic access');
  assert.deepEqual(care.caregiverIds,care.field.length===6?[112]:[]);assert.deepEqual(care.hires,[112]);assert.equal(care.hireCost,1050);
  for(const id of opening.deaths)assert.ok(!care.field.includes(id),'clinic care cannot replace or restore an actual casualty');
  assert.equal(care.arrivals[0].travelHours,6);assert.equal(care.arrivals[0].dueAt-care.arrivals[0].departedAt,6);assert.equal(care.arrivals[0].dueSecond,care.arrivals[0].departedSecond);
  assert.ok(care.hours>0&&care.hours<=48,'actual wounds receive bounded paid medical work');
  assert.equal(care.initialDressings+care.dressingsFound-care.remainingDressings,care.hours);
  assert.equal(care.dressingsBought,0);assert.equal(care.dressingCost,0);assert.equal(care.workshopCost,0);
 }
 if(kind==='created')await t.test('an actual finite toolkit reaches a surviving qualified carrier and funds saved repair after native wound care',()=>{
  const before=structuredClone(campaign),roster=rosterFor(campaign);let s=saved({campaign}).campaign;
  const candidates=roster.filter(o=>s.squad.includes(o.id)&&o.mechanical>=20&&s.operativeState[o.id].alive&&s.operativeState[o.id].hp>=15&&!s.operativeState[o.id].bleeding&&!s.operativeState[o.id].asleep&&s.operativeState[o.id].energy>10&&s.operativeState[o.id].condition>0&&s.operativeState[o.id].condition<100).sort((a,b)=>b.mechanical-a.mechanical);
  const owned=candidates.flatMap(o=>Object.values(s.operativeState[o.id].inventory??{}).filter(item=>item.kind==='repair-kit'&&item.instanceId&&item.repairPoints>0).map(kit=>({mechanic:o,sourceKit:kit}))),sources=candidates.flatMap(mechanic=>sectorInventorySites(s,s.location).flatMap(site=>sectorInventoryModel(s,site.id,roster,mechanic.id).entries.filter(row=>row.reachable&&JSON.parse(row.expected).kind==='repair-kit'&&JSON.parse(row.expected).instanceId&&JSON.parse(row.expected).repairPoints>0).map(row=>({mechanic,sourceKit:JSON.parse(row.expected),row,site:site.id}))));
  const source=owned[0]??sources[0];assert.ok(source,'a qualified survivor must admit one real finite toolkit');const {mechanic,sourceKit}=source,instanceId=sourceKit.instanceId;
  if(!owned.length){const clock={hour:s.hour,second:s.secondOfHour},found=collectRouteItems(s,mechanic.id,{kind:'repair-kit',instanceId},1);s=found.campaign;assert.equal(found.collected,1);assert.deepEqual({hour:s.hour,second:s.secondOfHour},clock,'known toolkit collection spends no time before critical wound care');}
  const owners=roster.filter(o=>s.operativeState[o.id].alive&&Object.values(s.operativeState[o.id].inventory??{}).some(item=>item.instanceId===instanceId));assert.deepEqual(owners.map(o=>o.id),[mechanic.id]);const kit=Object.values(s.operativeState[mechanic.id].inventory).find(item=>item.instanceId===instanceId);
  assert.equal(kit.repairPoints,sourceKit.repairPoints);assert.ok(kit.repairPoints>0&&kit.repairPoints<=100);assert.equal(kit.count,1);
  const native=visit(s).battle.units.find(unit=>unit.id===String(mechanic.id));assert.ok(native.hp>0);assert.equal(native.condition,s.operativeState[mechanic.id].condition);assert.equal(repairMaterialPoints(native),kit.repairPoints);
  const origin=instanceId.split(':')[1];assert.ok(FINITE_SECTOR_CACHES[origin]);assert.equal(s.sectorStates[origin].props.find(prop=>prop.id===FINITE_SECTOR_CACHES[origin].chest).contents.some(item=>item.instanceId===instanceId),false);
  const exposed=s=>sectorInventorySites(s,s.location).flatMap(site=>sectorInventoryModel(s,site.id,rosterFor(s),mechanic.id).entries).filter(row=>JSON.parse(row.expected).instanceId===instanceId);
  assert.deepEqual(exposed(s),[],'historical deployments and emptied corpses cannot expose a second toolkit');
  const patients=s.squad.filter(id=>s.operativeState[id].bleeding>0);assert.ok(patients.length>0,'actual bleeding must receive native finite care before repair time');
  const doctors=roster.filter(op=>s.squad.includes(op.id)&&op.medical>=20&&s.operativeState[op.id].hp>=15&&!s.operativeState[op.id].bleeding&&!s.operativeState[op.id].asleep&&s.operativeState[op.id].energy>10).sort((a,b)=>s.operativeState[b.id].medkits-s.operativeState[a.id].medkits||b.medical-a.medical).slice(0,patients.length);assert.equal(doctors.length,patients.length);
  const dressingStock=s.squad.reduce((sum,id)=>sum+s.operativeState[id].medkits,0);
  let collectedDressings=0;
  // Treat only witnessed native wounds. Share a carried dressing only when
  // another actual caregiver needs one; no wound or medicine is fabricated.
  for(const doctor of doctors){
   if(!s.operativeState[doctor.id].medkits){
    const donor=roster.find(op=>s.squad.includes(op.id)&&s.operativeState[op.id].hp>=15&&!s.operativeState[op.id].bleeding&&!s.operativeState[op.id].asleep&&s.operativeState[op.id].energy>10&&s.operativeState[op.id].medkits>Number(doctors.some(doctor=>doctor.id===op.id)));
    if(donor){
     s=order(s,{type:'sectorInventory',sector:s.location,operativeId:donor.id,direction:'drop',item:'medkits',count:1});
     const row=sectorInventoryModel(s,s.location,rosterFor(s),doctor.id).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');assert.ok(row);
     s=order(s,{type:'sectorInventory',sector:s.location,operativeId:doctor.id,direction:'take',sourceKey:row.key,expected:row.expected,count:1});
    }else{
     // The completed battle retains real finite medical loot. Collection must
     // spend no strategic time before the critical patient's bleeding stops.
     const clock={hour:s.hour,second:s.secondOfHour},found=collectRouteItems(s,doctor.id,{item:'medkits'},1);s=found.campaign;assert.equal(found.collected,1);collectedDressings+=found.collected;
     assert.deepEqual({hour:s.hour,second:s.secondOfHour},clock);
    }
   }
   s=order(s,{type:'assignCare',id:doctor.id,assignment:'doctor'});
  }
  for(const id of patients)s=order(s,{type:'assignCare',id,assignment:'patient'});
  const wounds=patients.map(id=>({id,hp:s.operativeState[id].hp}));s=advanceCampaignHours(s,1);
  for(const {id,hp}of wounds){assert.equal(s.operativeState[id].hp,hp);assert.equal(s.operativeState[id].bleeding,0);}
  assert.equal(dressingStock+collectedDressings-s.squad.reduce((sum,id)=>sum+s.operativeState[id].medkits,0),patients.length);
  for(const doctor of doctors)s=order(s,{type:'assignCare',id:doctor.id,assignment:'active'});
  assert.deepEqual(saved({campaign:s}).campaign,s);
  const condition=s.operativeState[mechanic.id].condition;s=repairRouteFirearms(s,[mechanic.id]);
  assert.equal(s.operativeState[mechanic.id].condition,100);assert.equal(kit.repairPoints-repairMaterialPoints(s.operativeState[mechanic.id]),100-condition);
  assert.equal(Object.values(s.operativeState[mechanic.id].inventory).find(item=>item.kind==='repair-kit').instanceId,instanceId);
  assert.equal(s.resources.treasury,campaign.resources.treasury);assert.equal(s.hour,campaign.hour+2);assert.equal(s.secondOfHour,campaign.secondOfHour);
  assert.deepEqual(exposed(s),[]);const repaired=structuredClone(s);assert.throws(()=>collectRouteItems(s,mechanic.id,{kind:'repair-kit',instanceId},1),/finite local equipment/);assert.deepEqual(s,repaired,'the same retained owner identity cannot be collected again');
  for(const [id,r]of Object.entries(before.operativeState))if(!r.alive)assert.equal(s.operativeState[id].alive,false);
  assert.deepEqual(saved({campaign:s}).campaign,s);assert.deepEqual(campaign,before);
 });
});

test('a witnessed paid casualty transfers its physically acquired finite toolkit once and funds saved repair',()=>{
 // The fixture declares 110's starting wound. The existing seed and native
 // policy kill paid 120; his toolkit was picked from Retiro before combat.
 const {campaign,id}=paidCasualty(8,{toolkit:true}),before=structuredClone(campaign),instanceId='cache:retiro:repair-kit';
 assert.equal(id,120);assert.equal(campaign.operativeState[id].alive,false);assert.ok(campaign.contracts[id].paid>0);
 const body=campaign.sectorStates.buenos_aires.units.find(unit=>unit.id===String(id)),kit=Object.values(body.inventory).find(item=>item.instanceId===instanceId);assert.equal(body.hp,0);assert.equal(body.knownToPlayer,true);assert.equal(kit.repairPoints,100);
 assert.equal(campaign.sectorStates.retiro.props.find(prop=>prop.id===FINITE_SECTOR_CACHES.retiro.chest).contents.some(item=>item.instanceId===instanceId),false);
 const mechanic=rosterFor(campaign).filter(op=>campaign.squad.includes(op.id)&&op.mechanical>=20&&campaign.operativeState[op.id].hp>=15&&!campaign.operativeState[op.id].bleeding&&!campaign.operativeState[op.id].asleep&&campaign.operativeState[op.id].energy>10&&campaign.operativeState[op.id].condition<100).sort((a,b)=>b.mechanical-a.mechanical)[0];assert.ok(mechanic);
 assert.equal(sectorInventoryModel(campaign,'buenos_aires',rosterFor(campaign),mechanic.id).entries.filter(row=>row.reachable&&JSON.parse(row.expected).instanceId===instanceId).length,1);
 const found=collectRouteItems(campaign,mechanic.id,{kind:'repair-kit',instanceId},1);let s=found.campaign;assert.equal(found.collected,1);assert.deepEqual(campaign,before);
 assert.equal(repairMaterialPoints(s.operativeState[mechanic.id]),100);assert.equal(repairMaterialPoints(s.sectorStates.buenos_aires.units.find(unit=>unit.id===String(id))),0);
 assert.equal(s.resources.treasury,campaign.resources.treasury);assert.equal(s.hour,campaign.hour);assert.equal(s.secondOfHour,campaign.secondOfHour);
 const transferred=structuredClone(s);assert.throws(()=>collectRouteItems(s,mechanic.id,{kind:'repair-kit',instanceId},1),/finite local equipment/);assert.deepEqual(s,transferred,'an emptied native corpse cannot supply the toolkit twice');
 const condition=s.operativeState[mechanic.id].condition;s=repairRouteFirearms(s,[mechanic.id]);
 assert.equal(s.operativeState[mechanic.id].condition,100);assert.equal(100-repairMaterialPoints(s.operativeState[mechanic.id]),100-condition);assert.equal(Object.values(s.operativeState[mechanic.id].inventory).find(item=>item.kind==='repair-kit').instanceId,instanceId);
 for(const [fallen,r]of Object.entries(before.operativeState))if(!r.alive)assert.equal(s.operativeState[fallen].alive,false);
 assert.deepEqual(saved({campaign:s}).campaign,s);
 const cash=s.resources.treasury,cost=deploymentCost(s),p=visit(s);assert.equal(new Set(p.battle.units.map(unit=>unit.id)).size,p.battle.units.length);
 assert.equal(p.battle.units.find(unit=>unit.id===String(id)).hp,0);assert.equal(repairMaterialPoints(p.battle.units.find(unit=>unit.id===String(id))),0);
 assert.equal(repairMaterialPoints(p.battle.units.find(unit=>unit.id===String(mechanic.id))),repairMaterialPoints(s.operativeState[mechanic.id]));
 const returned=saved({campaign:leave(p)}).campaign;assert.equal(returned.resources.treasury,cash-cost);assert.equal(returned.operativeState[id].alive,false);assert.equal(repairMaterialPoints(returned.operativeState[mechanic.id]),repairMaterialPoints(s.operativeState[mechanic.id]));assert.deepEqual(saved({campaign:returned}).campaign,returned);
 assert.deepEqual(campaign,before);
});

test('a fresh free officer and local recruits complete the opening without bulletin hires, preserving native health and finite recovery',t=>{
 const {campaign:s,notes}=freshCoastalRoute('local');
 assert.deepEqual(notes.filter(n=>n.sector).map(n=>n.sector),['buenos_aires','san_nicolas','san_lorenzo']);assert.ok(notes.every(n=>n.funds>=0));
 assert.deepEqual(notes[0].squad,[1000,3]);assert.equal(notes[0].funds,3200);
 const care=notes.find(n=>n.stage==='local-recovery'),opening=notes.find(n=>n.sector==='buenos_aires'),roster=rosterFor(s);
 assert.equal(care.hours>0,opening.units.some(unit=>unit.hp>0&&unit.hp<roster.find(op=>String(op.id)===unit.id).maxHp),'actual opening wounds determine paid medical work');
 assert.equal(care.initialDressings+care.dressingsFound-care.remainingDressings,care.hours);assert.equal(care.dressingsBought,0);assert.equal(care.dressingCost,0);assert.equal(care.weaponCost,0);assert.equal(care.workshopCost,0);assert.ok(care.repairPointsSpent>0);
 const woundedCare=notes.find(n=>n.stage==='local-final-recovery'&&n.hours>0)??care;assert.ok(woundedCare.hours>0,'actual opening wounds must receive finite paid-time care');assert.equal(woundedCare.dressingsBought,0);assert.equal(woundedCare.dressingCost,0);
 // Current combat determines who survives. Preserve every actual casualty and
 // finite recovery record instead of forcing an old number of deaths or hours.
 const fallen=[...new Set(notes.filter(n=>n.sector).flatMap(n=>n.deaths))];
 for(const id of fallen){assert.equal(s.operativeState[id].alive,false);assert.equal(s.operativeState[id].hp,0);assert.ok(!s.squad.includes(id));}
 assert.ok(s.squad.length>0);assert.ok(s.missionAllies.san_lorenzo.hp>0);
 const cohort=[1000,3,4,10],field=s.sectorStates.san_lorenzo.units;
 for(const id of cohort){const native=field.find(u=>u.id===String(id))??Object.values(s.sectorStates).flatMap(scene=>scene.units).find(unit=>unit.id===String(id)&&unit.hp===0);assert.ok(native,'each recruit retains the native record at the final battle or actual death sector');assert.equal(s.operativeState[id].alive,native.hp>0);assert.equal(s.operativeState[id].hp,native.hp);}
 const finalCare=notes.find(n=>n.stage==='local-final-recovery');assert.ok(finalCare);assert.equal(finalCare.dressingCost,finalCare.dressingsBought*10);assert.equal(finalCare.weaponCost,0);
 const continued=saved({campaign:order(s,{type:'wait',hours:1})}).campaign,money=continued.resources.treasury,cost=deploymentCost(continued),p=visit(continued);
 assert.deepEqual(p.battle.units.filter(u=>u.side==='player'&&u.hp>0&&!u.missionAlly).map(u=>u.id).sort(),continued.squad.map(String).sort());assert.equal(new Set(p.battle.units.map(u=>u.id)).size,p.battle.units.length,'revisit must not duplicate a living soldier or a body');
 for(const id of fallen)assert.ok(!p.battle.units.some(u=>u.id===String(id)&&u.hp>0));
 const returned=saved({campaign:leave(p)}).campaign;
 assert.equal(returned.resources.treasury,money-cost);assert.deepEqual(returned.squad,continued.squad);
 for(const id of continued.squad){assert.equal(returned.operativeState[id].hp,continued.operativeState[id].hp);assert.equal(returned.operativeState[id].ammo,continued.operativeState[id].ammo);assert.equal(returned.operativeState[id].carriedLoaded,continued.operativeState[id].carriedLoaded);assert.equal(returned.operativeState[id].medkits,continued.operativeState[id].medkits);assert.deepEqual(returned.operativeState[id].inventory,continued.operativeState[id].inventory);}
 assert.deepEqual(returned.ammunitionStores,continued.ammunitionStores);assert.deepEqual(returned.sectorStates.buenos_aires.props.find(prop=>prop.id==='buenos_aires:building:chest:10:4').contents,continued.sectorStates.buenos_aires.props.find(prop=>prop.id==='buenos_aires:building:chest:10:4').contents,'the finite capital cache must stay depleted after revisit');
 for(const id of fallen)assert.equal(returned.operativeState[id].alive,false);
 assert.equal(returned.completed,false);assert.equal(returned.defeated,false);
 t.diagnostic(JSON.stringify({care,opening:{hour:s.hour,second:s.secondOfHour,funds:s.resources.treasury},continuation:{hour:returned.hour,funds:returned.resources.treasury,squad:returned.squad},battles:notes.filter(n=>n.sector).map(({sector,actions,turns,deaths})=>({sector,actions,turns,deaths}))}));
});
