import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,supplyTransferPreview} from '../game/tactical.js';
import {beginSectorDeployment,validateSectorDeployment,sectorDeploymentModel} from '../game/sector-deployment.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {createdLosPatosBattery} from '../tests/created-los-patos-battery.mjs';

// Declared finite subsystem arena. This is not a paid campaign, battle win,
// earned mountain deployment, or a proof of campaign encode/decode admission.
// All roles, stocks, gear, geometry and seed are fixed before first admission.
const grid=(width,height)=>Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'stone',blocked:false,cover:0}));
function initial(ids,medical,kits){
 const squad=ids.map((id,i)=>({id:String(id),name:`Issued ${id}`,x:23,y:2+i,hp:80,maxHp:80,energy:85,morale:80,medical:medical[i],medkits:kits[i],weapon:1801,condition:90,loaded:1,ammo:9,entryReason:'arrival',entryEdge:'E',entryAnchor:{x:19,y:8}}));
 const b=createBattle(squad,{id:'declared-los-patos-deployment',width:24,height:24,tiles:grid(24,24),seed:42,exploration:true,deferContact:true,enemies:[{id:'enemy',name:'Declared enemy',x:1,y:20,weapon:1805,loaded:1,ammo:3,patrol:false,overwatch:false}],artillery:[{id:'finite-bronze-a',type:'bronze4',side:'player',x:22,y:10,loaded:true,ammo:6},{id:'finite-bronze-b',type:'bronze4',side:'player',x:22,y:11,loaded:true,ammo:6}]});
 assert.equal(beginSectorDeployment(b,{squad}),true);
 return validateBattleSnapshot(JSON.parse(JSON.stringify(b)));
}
const cases=[
 {name:'declared-feasible-later-prefilled-doctor-pair',ids:[301,302,303,304,305,306,307,308],medical:[20,70,70,70,20,20,20,20],kits:[1,0,5,4,0,0,0,0],donor:'301',doctors:['303','304'],transferred:1},
 {name:'declared-original-role-cohort',ids:[11,7,124,138,102,133,116,122],medical:[30,35,26,26,20,20,70,85],kits:[0,10,0,2,0,0,0,0],donor:'7',doctors:['116','122'],transferred:10},
 {name:'declared-different-live-cohort-with-existing-doctor-stocks',ids:[126,112,140,103,104,111,130,135],medical:[20,94,30,30,30,30,86,93],kits:[0,7,0,0,0,0,2,1],donor:'112',doctors:['130','135'],transferred:7},
 {name:'declared-existing-overfloor-doctor-stock',ids:[201,202,203,204,205,206,207,208],medical:[20,20,70,85,20,20,20,20],kits:[2,0,6,3,0,0,0,0],donor:'201',doctors:['203','204'],transferred:2},
];
for(const scenario of cases)test(scenario.name,t=>{
 const start=initial(scenario.ids,scenario.medical,scenario.kits),before=structuredClone(start),events=[];
 const helper=createdLosPatosBattery({report:event=>events.push(event)});
 const result=helper.deploy(start);assert.deepEqual(start,before);
 const roles=events.find(e=>e.event==='createdLosPatosDressingRoles');
 assert.equal(roles.donorId,scenario.donor);assert.deepEqual(roles.doctorIds,scenario.doctors);assert.equal(roles.transferred,scenario.transferred);
 const actions=events.filter(e=>e.event==='createdLosPatosDeploymentOrder').map(e=>e.action);
 assert.equal(actions.filter(a=>a.type==='placeDeployment').length,8);assert.equal(actions.filter(a=>a.type==='confirmDeployment').length,1);
 assert.ok(actions.filter(a=>a.type==='transferSupply').every(a=>a.unitId!==a.targetId&&a.count>0));
 let ordinary=structuredClone(start),presented=structuredClone(start),restored=validateBattleSnapshot(JSON.parse(JSON.stringify(start))),paidOrderPA=0;
 for(const action of actions){
  if(action.type==='transferSupply'){const preview=supplyTransferPreview(ordinary,ordinary.units.find(u=>u.id===action.unitId),ordinary.units.find(u=>u.id===action.targetId),action.item,action.count);assert.equal(preview.valid,true,preview.reason);assert.equal(preview.pa,4);paidOrderPA+=preview.pa;}
  ordinary=actBattle(ordinary,action);assert.equal(ordinary.lastError,null,ordinary.lastError);
  const step=presentedActBattle(presented,action);presented=step.state;assert.deepEqual(presented,ordinary);
  restored=actBattle(restored,action);assert.equal(restored.lastError,null,restored.lastError);
  restored=validateBattleSnapshot(JSON.parse(JSON.stringify(restored)));
  assert.deepEqual(restored,ordinary);
 }
 assert.deepEqual(result,ordinary);assert.deepEqual(presented,ordinary);
 const final=validateBattleSnapshot(JSON.parse(JSON.stringify(result)));assert.deepEqual(final,result);
 assert.equal(result.seed,start.seed);assert.deepEqual(result.artillery,start.artillery);
 const transfers=actions.filter(a=>a.type==='transferSupply');
 assert.equal(result.elapsedSeconds-start.elapsedSeconds,transfers.length);
 for(const u of start.units){const after=result.units.find(v=>v.id===u.id);for(const key of ['hp','bleeding','energy','loaded','ammo','condition','inventory'])assert.deepEqual(after[key],u[key]);}
 const donorStart=start.units.find(u=>u.id===roles.donorId),donorEnd=result.units.find(u=>u.id===roles.donorId);
 assert.equal(paidOrderPA,4*transfers.length);assert.equal(donorStart.ap,donorEnd.ap); // Exploration restores the turn allowance after each paid one-second order.
 for(const id of roles.doctorIds){const a=start.units.find(u=>u.id===id),b=result.units.find(u=>u.id===id);assert.equal(b.medkits,Math.max(5,a.medkits));assert.equal(a.ap,b.ap);}
 // First actual controller proposal for each arbitrary live role must remain
 // an ordinary admitted order; this does not execute a mountain battle.
 let proposals=0;
 for(const u of result.units.filter(u=>u.side==='player')){const action=helper.controller(result,u);if(action){assert.equal(actBattle(result,action).lastError,null,JSON.stringify(action));proposals++;}}
 const rejected=structuredClone(start);for(const u of rejected.units.filter(u=>u.side==='player'&&u.id!==scenario.doctors[0]))u.medical=59;
 // Case two has a third physician donor, but still no distinct supplied donor
 // that can fund the missing doctor's deficit; reject instead of inventing kit.
 assert.throws(()=>helper.deploy(rejected),/physicians/);assert.deepEqual(start,before);
 t.diagnostic(JSON.stringify({scenario:scenario.name,declaredFixture:true,sourceSeed:start.seed,donor:roles.donorId,doctors:roles.doctorIds,totalDressings:roles.stock,transferred:roles.transferred,orders:actions.length,transferOrders:transfers.length,paidOrderPA,netAP:donorStart.ap-donorEnd.ap,elapsedSeconds:result.elapsedSeconds-start.elapsedSeconds,gunCharges:start.artillery.map(g=>Number(g.loaded)+g.ammo),controllerProposals:proposals,ordinaryPresentedSavedReplayEqual:true}));
});
