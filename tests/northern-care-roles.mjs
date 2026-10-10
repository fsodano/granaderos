import assert from 'node:assert/strict';
import {rosterFor} from '../game/campaign.js';
import {careAssignmentIssue} from '../game/medical-care.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';

// A selected doctor who needs care must be a patient of another real doctor.
// Restore the pair in order; stable other patients can rest during this rotation.
export function northernCareRolePlan(campaign,doctors,patients){
 const roster=rosterFor(campaign),op=id=>roster.find(candidate=>candidate.id===id),record=id=>campaign.operativeState[id];
 const present=id=>!careAssignmentIssue(campaign,op(id),'patient');
 const needsCare=id=>record(id).hp<record(id).maxHp||record(id).bleeding>0;
 const fit=id=>{const issue=careAssignmentIssue(campaign,op(id),'doctor');return !issue||issue.code==='no_medkits';};
 const selected=doctors.filter(present),patientIds=patients.filter(present);
 const target=selected.find(id=>needsCare(id)&&selected.some(other=>other!==id&&fit(other)&&record(other).location===record(id).location));
 const treating=target===undefined?null:selected.filter(id=>id!==target&&fit(id)&&record(id).location===record(target).location).sort((a,b)=>Number(record(b).medkits>0)-Number(record(a).medkits>0))[0];
 const roles=new Map(patientIds.map(id=>[id,target!==undefined&&id!==target&&!record(id).bleeding?'rest':'patient']));
 for(const id of selected)roles.set(id,needsCare(id)?'patient':fit(id)&&record(id).medkits>0?'doctor':'rest');
 if(target!==undefined){for(const id of selected)roles.set(id,id===target?'patient':id===treating&&record(id).medkits>0?'doctor':'rest');}
 const donor=treating!==null&&record(treating).medkits===0?selected.find(id=>id!==treating&&record(id).medkits>0&&record(id).location===record(treating).location):undefined;
 return {target:target??null,treating,transfer:donor===undefined?null:{from:donor,to:treating,sector:record(treating).location},roles:[...roles].map(([operativeId,assignment])=>({type:'assignCare',operativeId,assignment}))};
}

export function assignNorthernCareRoles(start,doctors,patients,order){
 let campaign=start,plan=northernCareRolePlan(campaign,doctors,patients);
 assert.equal(campaign.pendingEncounter,null,'resolve the actual encounter before changing care roles');
 assert.equal(campaign.pendingBattle,null,'resolve the actual battle before changing care roles');
 const model=id=>sectorInventoryModel(campaign,plan.transfer.sector,rosterFor(campaign),id);
 if(plan.transfer){
  const {from,to,sector}=plan.transfer,before=doctors.reduce((sum,id)=>sum+campaign.operativeState[id].medkits,0),source=model(from),destination=model(to);
  assert.equal(source.operativeId,from);assert.equal(destination.operativeId,to);assert.equal(source.reason,null);assert.equal(destination.reason,null);
  const known=new Set(destination.entries.map(row=>row.key));
  campaign=order({type:'sectorInventory',sector,operativeId:from,direction:'drop',item:'medkits',count:1});
  const row=model(to).entries.find(row=>!known.has(row.key)&&row.reachable&&JSON.parse(row.expected).item==='medkits');
  assert.ok(row,'the receiving doctor must have a native path to the actual dropped dressing');
  campaign=order({type:'sectorInventory',sector,operativeId:to,direction:'take',sourceKey:row.key,expected:row.expected,count:1});
  assert.equal(doctors.reduce((sum,id)=>sum+campaign.operativeState[id].medkits,0),before,'doctor rotation must conserve the actual dressing pool');
  plan=northernCareRolePlan(campaign,doctors,patients);
 }
 for(const action of plan.roles)if(campaign.operativeState[action.operativeId].assignment!==action.assignment)campaign=order(action);
 return campaign;
}
