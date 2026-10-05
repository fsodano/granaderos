import assert from 'node:assert/strict';
import {sectorDeploymentAction,sectorDeploymentModel} from '../game/sector-deployment.js';
import {actBattle} from '../game/tactical.js';
import {recoveryBronzeContactController} from './recovery-paid-battery-driver.mjs';

// This paid column has eight real arrivals and two bronze guns. Place its
// support close to the battery, using only owned positions and legal entry
// cells. The existing contact policy keeps a usable crew crouched together.
export function createdLosPatosBattery({report=()=>{}}={}){
 function deploy(start){
  let battle=start;const model=sectorDeploymentModel(start);assert.ok(model);
  const guns=start.artillery.filter(g=>g.side==='player'&&!g.stationed);
  assert.equal(guns.length,2);assert.ok(guns.every(g=>g.type==='bronze4'));
  assert.equal(model.units.length,8);
  const issued=model.units.map(row=>start.units.find(u=>u.id===row.id));
  const capable=u=>u?.side==='player'&&u.hp>=15&&(u.energy??100)>0&&!u.bleeding&&!u.unconscious&&!u.asleep&&!u.knockedDown&&!u.entangled&&!u.routed&&!u.departure&&!u.fled&&!u.surrendered&&!u.captured&&!u.bound&&!u.detained;
  assert.ok(issued.every(capable),'all eight actual arrivals must be stable and capable');
  // A finite dressing donor sits between two distinct physicians. Keep issued order
  // for the recipients and screen; no fallen role receives a new identity.
  const candidates=[...issued].sort((a,b)=>(b.medkits??0)-(a.medkits??0)||issued.indexOf(a)-issued.indexOf(b));
  const role=candidates.flatMap(donor=>{
   const doctors=issued.filter(u=>u.id!==donor.id&&u.medical>=60);
   return doctors.flatMap((first,i)=>doctors.slice(i+1).map(second=>{
    const pair=[first,second],needed=pair.reduce((sum,u)=>sum+Math.max(0,5-(u.medkits??0)),0);
    return {donor,doctors:pair,needed};
   }));
  }).find(({donor,needed})=>(donor.medkits??0)>=needed);
  assert.ok(role,'two actual physicians and a distinct finite dressing donor must cover the issued deficits');
  const {donor,doctors}=role,other=issued.filter(u=>u!==donor&&!doctors.includes(u));
  const center=Math.floor(guns.reduce((sum,g)=>sum+g.y,0)/guns.length),occupied=new Set();
  // Keep the donor between the two actual doctors before any advance, and
  // retain the other infantry close enough to screen the translated crew.
  const rows=[[donor.id,3],[doctors[0].id,2],[doctors[1].id,4],...other.map((u,i)=>[u.id,[1,0,-1,-2,5][i]])];
  assert.equal(model.units.length,rows.length);
  const order=action=>{
   battle=action.type==='transferSupply'?actBattle(battle,action):sectorDeploymentAction(battle,action);
   assert.equal(battle.lastError,null,battle.lastError);report({event:'createdLosPatosDeploymentOrder',action:structuredClone(action)});
  };
  for(const [id,offset]of rows){
   const row=model.units.find(u=>u.id===id);assert.ok(row);assert.equal(row.edge,'E');
   const desired={x:start.width-1,y:center+offset};
   const point=model.entryCells[row.edge].filter(p=>!occupied.has(`${p.x},${p.y}`))
    .sort((a,b)=>Math.hypot(a.x-desired.x,a.y-desired.y)-Math.hypot(b.x-desired.x,b.y-desired.y)||a.y-b.y)[0];assert.ok(point);
   order({type:'placeDeployment',unitIds:[id],x:point.x,y:point.y});occupied.add(`${point.x},${point.y}`);
  }
  order({type:'confirmDeployment'});
  assert.deepEqual(battle.artillery,guns);
  const stock=battle.units.filter(u=>u.side==='player').reduce((sum,u)=>sum+(u.medkits??0),0);
  const donorBefore=battle.units.find(u=>u.id===donor.id).medkits??0;let transferred=0;
  for(const recipient of doctors){
   const targetId=recipient.id,doctor=battle.units.find(u=>u.id===targetId),before=doctor.medkits??0,count=Math.max(0,5-before);
   assert.ok(doctor.medical>=60);assert.notEqual(donor.id,targetId);
   if(count)order({type:'transferSupply',unitId:donor.id,targetId,item:'medkits',count});
   assert.equal(battle.units.find(u=>u.id===targetId).medkits,before+count);transferred+=count;
  }
  assert.equal(battle.units.find(u=>u.id===donor.id).medkits??0,donorBefore-transferred);
  assert.equal(battle.units.filter(u=>u.side==='player').reduce((sum,u)=>sum+(u.medkits??0),0),stock);
  assert.deepEqual(battle.artillery,guns);
  report({event:'createdLosPatosDressingRoles',donorId:donor.id,doctorIds:doctors.map(u=>u.id),transferred,stock});
  return battle;
 }
 return {deploy,controller:recoveryBronzeContactController({holdCommand:false})};
}
