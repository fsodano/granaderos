import assert from 'node:assert/strict';
import {actBattle,artilleryContact,artilleryCrewPlan,artilleryCosts} from '../game/tactical.js';
import {sectorDeploymentAction,sectorDeploymentModel} from '../game/sector-deployment.js';
export function deployCapitalLane(start,{report=()=>{}}={}){
 let b=start;const model=sectorDeploymentModel(b);assert.ok(model);assert.equal(model.units.length,6);
 for(const row of model.units){const u=b.units.find(u=>u.id===row.id);b=sectorDeploymentAction(b,{type:'placeDeployment',unitIds:[u.id],x:u.x,y:u.y});assert.equal(b.lastError,null);}
 b=sectorDeploymentAction(b,{type:'confirmDeployment'});assert.equal(b.lastError,null);
 const before=structuredClone(b),ids=['11','7','5','6','142','147'];
 assert.deepEqual(b.units.filter(u=>ids.includes(u.id)&&u.hp>=15).map(u=>u.id).sort(),[...ids].sort());
 assert.equal(b.artillery.filter(g=>g.side==='player').length,3);
 const gun=(x,y)=>b.artillery.find(g=>g.side==='player'&&g.x===x&&g.y===y);
 const front=gun(33,1),middle=gun(32,1),rear=gun(31,1);assert.ok(front&&middle&&rear);
 const actions=[];
 const order=action=>{
  assert.ok(actions.length<12);const prev=b,old=prev.units.find(u=>u.id===action.unitId),g=prev.artillery.find(g=>g.id===action.artilleryId),crew=g?artilleryCrewPlan(prev,old,g,artilleryCosts(prev,old,g).move).crew:[];
  const next=actBattle(prev,action);assert.equal(next.lastError,null,JSON.stringify(action)+' '+next.lastError);b=next;
  actions.push({action,crew,seconds:b.elapsedSeconds-prev.elapsedSeconds,actors:ids.map(id=>{const a=prev.units.find(u=>u.id===id),v=b.units.find(u=>u.id===id);return{id,from:{x:a.x,y:a.y,ap:a.ap,energy:a.energy},to:{x:v.x,y:v.y,ap:v.ap,energy:v.energy}};}).filter(v=>JSON.stringify(v.from)!==JSON.stringify(v.to))});
 };
 order({type:'move',unitId:'142',x:33,y:1,tacticalLevel:0});
 for(let n=0;n<2;n++){const g=b.artillery.find(g=>g.id===front.id);order({type:'artilleryMove',unitId:'5',artilleryId:g.id,x:g.x+1,y:g.y});}
 for(let n=0;n<3;n++){const g=b.artillery.find(g=>g.id===front.id);order({type:'artilleryMove',unitId:'5',artilleryId:g.id,x:g.x,y:g.y+1});}
 order({type:'move',unitId:'7',x:32,y:0,tacticalLevel:0});
 for(let n=0;n<3;n++){const g=b.artillery.find(g=>g.id===middle.id);order({type:'artilleryMove',unitId:'142',artilleryId:g.id,x:g.x,y:g.y+1});}
 order({type:'move',unitId:'6',x:31,y:0,tacticalLevel:0});
 order({type:'move',unitId:'147',x:32,y:0,tacticalLevel:0});
 const physical=['hp','maxHp','bleeding','ammo','loaded','ammunition','ammunitionVersion','medkits','weapon','weaponInstanceId','weaponMetadata','condition','weaponFittings','weaponFittingPattern','blade','bladeInstanceId','bladeMetadata','bladeCondition','bladeFittingPattern','inventory','headwear','outfit','legwear'];
 for(const u of b.units){const old=before.units.find(v=>v.id===u.id);for(const key of physical)assert.deepEqual(u[key],old[key],u.id+' '+key);}
 for(const g of b.artillery){const old=before.artillery.find(v=>v.id===g.id),strip=({x,y,...rest})=>rest;assert.deepEqual(strip(g),strip(old),'complete finite gun metadata retained');}
 const own=b.artillery.filter(g=>g.side==='player');
 for(const u of b.units.filter(u=>ids.includes(u.id)))assert.equal(own.filter(g=>artilleryContact(b,u,g)).length,1,'each real crew member contacts exactly one gun');
 assert.ok(b.elapsedSeconds>before.elapsedSeconds);
 report({event:'capitalLanePrepared',actions,elapsedSeconds:b.elapsedSeconds-before.elapsedSeconds,guns:own.map(g=>({id:g.id,x:g.x,y:g.y,contacts:b.units.filter(u=>ids.includes(u.id)&&artilleryContact(b,u,g)).map(u=>u.id)})),units:b.units.filter(u=>ids.includes(u.id)).map(u=>({id:u.id,x:u.x,y:u.y,hp:u.hp,energy:u.energy,ap:u.ap}))});
 return b;
}
