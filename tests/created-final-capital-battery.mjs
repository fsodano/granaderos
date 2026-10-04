import assert from 'node:assert/strict';
import {finiteBatteryDriver} from './finite-battery-driver.mjs';
import {actBattle,getReachable,teamCanSee,stanceCost,lookPreview,artilleryContact,artilleryCrewPlan,supplyTransferPreview,supplyUsePreview,tileIllumination} from '../game/tactical.js';
import {playerKnownBattle} from '../game/player-known-state.js';
import {sectorDeploymentModel,sectorDeploymentAction} from '../game/sector-deployment.js';
import {stableCrewController} from './stable-crew-driver.mjs';
import {tucumanCombatOrder} from './tucuman-driver.mjs';
import {teamArtilleryOrder} from './team-artillery-driver.mjs';
import {northernCombatOrder} from './northern-route.mjs';

// Five real final arrivals keep their finite owned guns and ordinary action
// costs. Public reconnaissance follows current known paths and owned records.
// The existing three-person final driver remains a separate default.
function finalCapitalEntryDeployment(initial){
 const guns=initial.artillery.filter(g=>g.side==='player'&&!g.stationed);
 assert.equal(guns.length,3);assert.ok(guns.every(g=>g.type==='swivel'));
 const assigned=new Map(['57','135','145'].map((id,i)=>[id,guns[i].id]));
function deploy(start){
 let battle=start;const model=sectorDeploymentModel(start),occupied=new Set();assert.ok(model);
 for(const id of ['57','135','145']){
  const unit=model.units.find(u=>u.id===id),gun=battle.artillery.find(g=>g.id===assigned.get(id));assert.ok(unit&&gun);
  const desired={x:gun.x+(id==='135'?-1:id==='145'?1:0),y:gun.y-Number(id==='57')};
  const point=model.entryCells[unit.edge].filter(p=>!occupied.has(`${p.x},${p.y}`)).sort((a,b)=>Math.hypot(a.x-desired.x,a.y-desired.y)-Math.hypot(b.x-desired.x,b.y-desired.y)||a.y-b.y||a.x-b.x)[0];assert.ok(point);
  battle=sectorDeploymentAction(battle,{type:'placeDeployment',unitIds:[id],x:point.x,y:point.y});assert.equal(battle.lastError,null);occupied.add(`${point.x},${point.y}`);
 }
 battle=sectorDeploymentAction(battle,{type:'confirmDeployment'});assert.equal(battle.lastError,null);return battle;
}
 return {deploy};
}


const kits=u=>Object.fromEntries(['hp','maxHp','bleeding','bandaged','weapon','weaponDefinition','weaponMetadata','condition','loaded','ammo','ammunitionVersion','ammunition','ammunitionCounts','reloadProgress','inventory','weaponInstanceId','weaponFittings','weaponFittingPattern','blade','bladeCondition','bladeDefinition','bladeMetadata','bladeInstanceId','bladeFittings','bladeFittingPattern','headwear','outfit','legwear','offHand','equipmentCursor','medkits','rations','torches','boleadoras','toolkitPoints','morale'].filter(k=>Object.hasOwn(u,k)).map(k=>[k,structuredClone(u[k])]));
function createdStoredCapitalBattery(initial,{arrivalIds,report=()=>{}}){
 assert.equal(arrivalIds.length,3);assert.ok(arrivalIds.every(id=>initial.artillery.some(g=>g.id===id&&g.type==='swivel'&&g.loaded&&g.ammo===6)));
 const owned=playerKnownBattle(initial).artillery,stored=owned.filter(g=>g.side==='player'&&g.type==='bronze4'&&g.loaded&&g.ammo>0).sort((a,b)=>b.ammo-a.ammo||a.id.localeCompare(b.id))[0];assert.ok(stored);assert.equal(stored.ammo,3);
 const lightId=arrivalIds[2],old=finalCapitalEntryDeployment(initial),preparations=[];
 function deploy(start){
  let b=old.deploy(start);const before=structuredClone(b),orders=[];
  const act=a=>{const n=actBattle(b,a);assert.equal(n.lastError,null,JSON.stringify(a)+' '+n.lastError);orders.push(a);b=n;};
  for(const id of ['57','135']){const u=b.units.find(u=>u.id===id),gun=b.artillery.find(g=>g.id===stored.id),known=playerKnownBattle(b),point=getReachable(known,u).filter(p=>p.cost>0&&(p.tacticalLevel??0)===0&&artilleryContact(b,{...u,...p},gun)&&known.tiles.some(t=>t.x===p.x&&t.y===p.y&&(t.tacticalLevel??0)===0)).sort((a,z)=>a.cost-z.cost||a.y-z.y||a.x-z.x)[0];assert.ok(point);assert.ok(point.path.every(p=>known.tiles.some(t=>t.x===p.x&&t.y===p.y&&!t.blocked&&(t.tacticalLevel??0)===(p.tacticalLevel??0))));act({type:'move',unitId:id,x:point.x,y:point.y,tacticalLevel:0});}
  for(let step=0;step<3;step++){const gun=b.artillery.find(g=>g.id===lightId),point={x:gun.x,y:gun.y+1};assert.ok(playerKnownBattle(b).tiles.some(t=>t.x===point.x&&t.y===point.y&&!t.blocked));act({type:'artilleryMove',unitId:'145',artilleryId:lightId,...point});}
  // The actual five-person issued light starts one column west of the old
  // three-person placement. Pay for one east step to clear gun22's lane.
  {const gun=b.artillery.find(g=>g.id===lightId),point={x:gun.x+1,y:gun.y};assert.ok(playerKnownBattle(b).tiles.some(t=>t.x===point.x&&t.y===point.y&&!t.blocked));act({type:'artilleryMove',unitId:'145',artilleryId:lightId,...point});}
  assert.equal(b.mode,'exploration');assert.ok(b.elapsedSeconds>before.elapsedSeconds);
  for(const g of before.artillery){const current=b.artillery.find(v=>v.id===g.id);if(g.id!==lightId)assert.deepEqual(current,g);else{const omit=g=>Object.fromEntries(Object.entries(g).filter(([k])=>!['x','y'].includes(k)));assert.deepEqual(omit(current),omit(g));}}
  for(const u of before.units.filter(u=>['57','135','145'].includes(u.id))){const now=b.units.find(v=>v.id===u.id);assert.deepEqual(kits(now),kits(u));assert.ok(now.ap<=u.ap);assert.ok(now.energy<=u.energy);}
  const command=b.units.find(u=>u.id==='57');assert.ok(b.units.filter(u=>['135','145'].includes(u.id)).every(u=>Math.hypot(u.x-command.x,u.y-command.y)<=6));
  const bronze=b.artillery.find(g=>g.id===stored.id),light=b.artillery.find(g=>g.id===lightId),heavyPlan=artilleryCrewPlan(b,command,bronze,0),lightPlan=artilleryCrewPlan(b,b.units.find(u=>u.id==='145'),light,0);assert.equal(heavyPlan.reason,null);assert.deepEqual([...heavyPlan.crew].sort(),['135','57']);assert.equal(lightPlan.reason,null);assert.deepEqual(lightPlan.crew,['145']);
  const receipt={orders,seconds:b.elapsedSeconds-before.elapsedSeconds,bronze:structuredClone(bronze),light:structuredClone(light),plans:{heavy:heavyPlan,light:lightPlan},units:b.units.filter(u=>['57','135','145'].includes(u.id)).map(u=>({id:u.id,x:u.x,y:u.y,hp:u.hp,ap:u.ap,energy:u.energy}))};if(preparations.length)assert.deepEqual(receipt,preparations[0]);preparations.push(receipt);report({event:'fivePaidOwnedGunPreparation',...receipt});return b;
 }
 return {deploy};
}


function placeActualRearSinglePosts(start,arrivalIds,{report=()=>{}}={}){
 let b=start;const before=structuredClone(b),orders=[];const act=a=>{const n=actBattle(b,a);assert.equal(n.lastError,null,JSON.stringify(a)+' '+n.lastError);orders.push(a);b=n;assert.equal(b.mode,'exploration');};
 for(const [id,gunId]of [['57',arrivalIds[0]],['135',arrivalIds[1]]]){
  let u=b.units.find(u=>u.id===id),g=b.artillery.find(g=>g.id===gunId);assert.equal(g.type,'swivel');const look={type:'look',unitId:id,x:g.x,y:g.y},quote=lookPreview(b,u,look);if(quote.valid&&quote.facing!==u.facing)act(look);
  const known=playerKnownBattle(b);u=known.units.find(u=>u.id===id);const desired={x:g.x+(id==='57'?-1:1),y:g.y},point=getReachable(known,u).find(p=>p.x===desired.x&&p.y===desired.y&&(p.tacticalLevel??0)===0);assert.ok(point);assert.ok(point.path.every(p=>known.tiles.some(t=>t.x===p.x&&t.y===p.y&&!t.blocked)));assert.ok(artilleryContact(b,{...b.units.find(u=>u.id===id),...desired},g));act({type:'move',unitId:id,...desired,tacticalLevel:0});
  const original=before.units.find(u=>u.id===id),southLook={type:'look',unitId:id,x:original.x,y:original.y},southQuote=lookPreview(b,b.units.find(u=>u.id===id),southLook);if(southQuote.valid&&southQuote.facing!==b.units.find(u=>u.id===id).facing)act(southLook);
  if(id==='57'){g=b.artillery.find(g=>g.id===gunId);const destination={x:g.x+1,y:g.y};assert.ok(playerKnownBattle(b).tiles.some(t=>t.x===destination.x&&t.y===destination.y&&!t.blocked),JSON.stringify({id,destination,actor:b.units.filter(u=>u.id===id).map(u=>({x:u.x,y:u.y,facing:u.facing})),orders}));act({type:'artilleryMove',unitId:id,artilleryId:gunId,...destination});}
  const drag=(x,y)=>{const point={x,y};assert.ok(playerKnownBattle(b).tiles.some(t=>t.x===x&&t.y===y&&!t.blocked),JSON.stringify({id,point,orders}));act({type:'artilleryMove',unitId:id,artilleryId:gunId,...point});};
  const side=(x,y)=>{const known=playerKnownBattle(b),unit=known.units.find(u=>u.id===id),point=getReachable(known,unit).find(p=>p.x===x&&p.y===y&&(p.tacticalLevel??0)===0);assert.ok(point,JSON.stringify({id,x,y,orders}));assert.ok(point.path.every(p=>known.tiles.some(t=>t.x===p.x&&t.y===p.y&&!t.blocked)));act({type:'move',unitId:id,x,y,tacticalLevel:0});};
  if(id==='57'){for(let step=0;step<4;step++){g=b.artillery.find(g=>g.id===gunId);drag(g.x,g.y+1);}}
  else{
   drag(30,1);drag(31,1);drag(31,2);drag(31,3);drag(31,4);side(31,3);
   const bronze=b.artillery.find(g=>g.id==='piece-12'),look={type:'look',unitId:id,x:bronze.x,y:bronze.y},quote=lookPreview(b,b.units.find(u=>u.id===id),look);if(quote.valid&&quote.facing!==b.units.find(u=>u.id===id).facing)act(look);
   drag(31,5);drag(31,6);drag(31,7);side(32,7);drag(32,7);side(31,7);
  }
  g=b.artillery.find(g=>g.id===gunId);assert.equal(g.y,id==='57'?5:7);const plan=artilleryCrewPlan(b,b.units.find(u=>u.id===id),g,0);assert.equal(plan.reason,null);assert.deepEqual(plan.crew,[id]);
 }
 for(const old of before.artillery){const now=b.artillery.find(g=>g.id===old.id);const omit=g=>Object.fromEntries(Object.entries(g).filter(([key])=>!['x','y'].includes(key)));if(arrivalIds.slice(0,2).includes(old.id))assert.deepEqual(omit(now),omit(old));else assert.deepEqual(now,old);}
 for(const old of before.units.filter(u=>['57','135','145'].includes(u.id))){const now=b.units.find(u=>u.id===old.id);for(const k of ['hp','bleeding','loaded','ammo','weapon','weaponDefinition','weaponMetadata','weaponInstanceId','condition','weaponFittings','weaponFittingPattern','reloadProgress','ammunitionVersion','ammunitionCounts','inventory','blade','bladeDefinition','bladeInstanceId','bladeCondition','bladeFittings','bladeFittingPattern','headwear','outfit','legwear','medkits','rations','torches','toolkitPoints','morale'])assert.deepEqual(now[k],old[k]);assert.ok(now.ap<=old.ap);assert.ok(now.energy<=old.energy);}
 const bronze=b.artillery.find(g=>g.id==='piece-12'),crew=artilleryCrewPlan(b,b.units.find(u=>u.id==='57'),bronze,0);assert.equal(crew.reason,null);assert.deepEqual([...crew.crew].sort(),['135','57']);report({event:'paidIndependentRearPosts',orders,seconds:b.elapsedSeconds-before.elapsedSeconds,crew,units:b.units.filter(u=>['57','135','145'].includes(u.id)).map(u=>({id:u.id,x:u.x,y:u.y,hp:u.hp,ap:u.ap,energy:u.energy})),guns:b.artillery});return b;
}


function createdForwardLitCapitalBattery(initial,{arrivalIds,report=()=>{},prepareSupport=b=>b}){
 const base=createdStoredCapitalBattery(initial,{arrivalIds,report}),stable=stableCrewController(),preparations=[];
 function deploy(start){let b=prepareSupport(placeActualRearSinglePosts(base.deploy(start),arrivalIds,{report}));const before=structuredClone(b),orders=[];const act=a=>{const n=actBattle(b,a);assert.equal(n.lastError,null,JSON.stringify(a));orders.push(a);b=n;};
  const knownMove=(id,x,y)=>{const known=playerKnownBattle(b),u=known.units.find(u=>u.id===id),p=getReachable(known,u).find(p=>p.x===x&&p.y===y&&(p.tacticalLevel??0)===0);assert.ok(p);assert.ok(p.path.every(c=>known.tiles.some(t=>t.x===c.x&&t.y===c.y&&!t.blocked)));act({type:'move',unitId:id,x,y,tacticalLevel:0});};
  assert.equal(b.units.find(u=>u.id==='57').torches,2);assert.equal(b.units.find(u=>u.id==='145').torches,0);
  knownMove('145',33,4);const give=supplyTransferPreview(b,b.units.find(u=>u.id==='57'),b.units.find(u=>u.id==='145'),'torches',1);assert.equal(give.valid,true,give.reason);act({type:'transferSupply',unitId:'57',targetId:'145',item:'torches',count:1});assert.equal(b.units.find(u=>u.id==='57').torches,1);assert.equal(b.units.find(u=>u.id==='145').torches,1);
  const throwTorch=(id,point)=>{const u=b.units.find(u=>u.id===id),prepared={...u,activeSlot:'supply',activeSupply:'torches',ap:Math.max(0,u.ap-8)},quote=supplyUsePreview(b,prepared,point,'torches');assert.equal(quote.allowed,true,quote.reason);act({type:'weapon',unitId:id,slot:'supply',supplyKey:'torches'});const preview=supplyUsePreview(b,b.units.find(u=>u.id===id),point,'torches');assert.equal(preview.allowed,true,preview.reason);act({type:'useItem',unitId:id,...point});act({type:'weapon',unitId:id,slot:'primary'});};
  knownMove('145',35,9);assert.ok(playerKnownBattle(b).tiles.some(t=>t.x===32&&t.y===13&&!t.blocked));throwTorch('57',{x:32,y:13});if(b.units.find(u=>u.id==='145').x===35&&b.units.find(u=>u.id==='145').y===9)knownMove('145',35,10);
  const known=playerKnownBattle(b),forward=known.tiles.filter(t=>t.y>b.units.find(u=>u.id==='145').y&&!t.blocked&&(t.tacticalLevel??0)===0).sort((a,z)=>z.y-a.y||Math.abs(a.x-35)-Math.abs(z.x-35)||a.x-z.x)[0];assert.ok(forward);assert.deepEqual({x:forward.x,y:forward.y},{x:34,y:16},'the exact public forward frontier is preserved');throwTorch('145',{x:forward.x,y:forward.y});
  assert.equal(b.units.find(u=>u.id==='57').torches,0);assert.equal(b.units.find(u=>u.id==='145').torches,0);assert.deepEqual(b.artillery,before.artillery);for(const id of ['57','135','145']){const u=before.units.find(u=>u.id===id),n=b.units.find(u=>u.id===id);for(const k of ['hp','ammo','loaded','inventory','medkits','rations','bleeding','headwear','outfit','legwear'])assert.deepEqual(n[k],u[k]);if(id!=='145')for(const k of ['x','y'])assert.equal(n[k],u[k]);}
  const scout=b.units.find(u=>u.id==='145');assert.ok(tileIllumination(b,scout.x,scout.y)<.25,'the scout stays outside the thrown lights');
  const receipt={orders,seconds:b.elapsedSeconds-before.elapsedSeconds,mode:b.mode,phase:b.phase,units:b.units.filter(u=>['57','135','145'].includes(u.id)).map(u=>({id:u.id,x:u.x,y:u.y,hp:u.hp,ap:u.ap,energy:u.energy,morale:u.morale,torches:u.torches})),lights:playerKnownBattle(b).lights};if(preparations.length)assert.deepEqual(receipt,preparations[0]);preparations.push(receipt);report({event:'finiteForwardSightPreparation',...receipt});return b;
 }
 const controller=(b,u)=>{
  const known=playerKnownBattle(b),targets=b.units.filter(v=>v.side!==u.side&&v.hp>=15&&!v.routed&&!v.unconscious&&!v.surrendered&&!v.departure&&teamCanSee(b,u.side,v)),normal=tucumanCombatOrder(b,u);
  if(u.knockedDown||u.entangled||normal?.slot==='medical'||normal?.type==='useItem'&&u.activeSlot==='medical')return normal;
  if(u.id==='145'&&u.torches>0){const heard=known.contacts.find(c=>c.observerId===u.id&&c.kind==='heard');if(heard){const point={x:heard.x,y:heard.y},prepared={...u,activeSlot:'supply',activeSupply:'torches',ap:Math.max(0,u.ap-((u.activeSlot==='supply'&&u.activeSupply==='torches')?0:4))},quote=supplyUsePreview(b,prepared,point,'torches');if(quote.allowed){if(u.activeSlot!=='supply'||u.activeSupply!=='torches')return {type:'weapon',unitId:u.id,slot:'supply',supplyKey:'torches'};return {type:'useItem',unitId:u.id,...point};}}}
  if(normal?.type==='useItem')return normal;
  if(['57','135'].includes(u.id)){
   const own=b.artillery.find(g=>g.id===arrivalIds[u.id==='57'?0:1]),gun=b.artillery.find(g=>g.id==='piece-12');
   for(const selected of (gun.loaded?[gun,own]:own.loaded?[own,gun]:[gun,own]))if((selected.loaded||selected.ammo>0)&&artilleryContact(b,u,selected)){const action=teamArtilleryOrder({...b,artillery:[selected]},u,targets);if(action)return action;}
   const a=stable(b,u);if(a&&!['move','climb','charge','artilleryMove','exit'].includes(a.type))return a;
   return u.stance==='standing'&&u.ap>=stanceCost(u,'crouched')?{type:'stance',unitId:u.id,stance:'crouched'}:null;
  }
  if(normal?.type==='stance'&&normal.stance==='standing'&&b.mode==='exploration'&&u.stance==='crouched')return null;
  if(normal&&normal.type!=='move'&&normal.type!=='climb'&&normal.type!=='artilleryMove'&&normal.type!=='charge'&&normal.type!=='exit')return normal;
  const command=known.units.find(v=>v.id==='57');
  // Reconnaissance stops at the admitted lateral post. Never use a hidden path.
  if(normal?.type==='move'){
   const unit=known.units.find(v=>v.id===u.id),point=getReachable(known,unit).find(p=>p.x===normal.x&&p.y===normal.y&&(p.tacticalLevel??0)===(normal.tacticalLevel??0));
   if(point&&point.path.every(p=>known.tiles.some(t=>t.x===p.x&&t.y===p.y&&(t.tacticalLevel??0)===(p.tacticalLevel??0)&&!t.blocked))&&normal.x===35&&normal.y===10)return normal;
  }
  if(!targets.length){const contact=known.contacts.find(c=>c.observerId===u.id&&c.kind==='heard');if(contact){const look={type:'look',unitId:u.id,x:contact.x,y:contact.y},quote=lookPreview(b,u,look);if(quote.valid&&quote.facing!==u.facing)return look;}}
  return u.stance==='standing'&&u.ap>=stanceCost(u,'crouched')?{type:'stance',unitId:u.id,stance:'crouched'}:null;
 };
 return {deploy,controller};
}


const preserved=['hp','maxHp','bleeding','bandaged','weapon','weaponDefinition','weaponMetadata','weaponInstanceId','condition','weaponFittings','weaponFittingPattern','loaded','ammo','reloadProgress','ammunitionVersion','ammunitionCounts','inventory','blade','bladeDefinition','bladeInstanceId','bladeCondition','bladeFittings','bladeFittingPattern','headwear','outfit','legwear','medkits','rations','torches','toolkitPoints','morale'];
function createCapitalSupportBattery(initial,{arrivalIds,report=()=>{}}){
 assert.deepEqual(initial.units.filter(u=>u.side==='player'&&!u.militia&&u.hp>=15&&!u.unconscious&&!u.departure).map(u=>Number(u.id)).sort((a,b)=>a-b),[7,57,135,142,145]);
 const receipts=[],visitedPositions=new Map(['7','142'].map(id=>[id,new Set()]));
 function prepareSupport(start){
  let b=start;const before=structuredClone(b),orders=[];
  // Reuse every valid rear-gun, finite light and hand order from the reviewed
  // three-person policy. The actual two extra rifles then cover that crew.
  for(const [id,x,y]of [['7',31,8],['142',34,7]]){
   const known=playerKnownBattle(b),u=known.units.find(u=>u.id===id),p=getReachable(known,u).find(p=>p.x===x&&p.y===y&&(p.tacticalLevel??0)===0);
   assert.ok(p,`actual support ${id} must reach its known rear post`);assert.ok(p.path.every(c=>known.tiles.some(t=>t.x===c.x&&t.y===c.y&&!t.blocked&&(t.tacticalLevel??0)===(c.tacticalLevel??0))));
   const a={type:'move',unitId:id,x,y,tacticalLevel:0},next=actBattle(b,a);assert.equal(next.lastError,null);orders.push(a);b=next;
  }
  assert.deepEqual(b.artillery,before.artillery);
  for(const old of before.units.filter(u=>u.side==='player')){const now=b.units.find(u=>u.id===old.id);for(const k of preserved)assert.deepEqual(now[k],old[k]);assert.ok(now.ap<=old.ap);assert.ok(now.energy<=old.energy);if(!['7','142'].includes(old.id)){assert.equal(now.x,old.x);assert.equal(now.y,old.y);}}
  const command=b.units.find(u=>u.id==='57');for(const id of ['7','142'])assert.ok(Math.hypot(b.units.find(u=>u.id===id).x-command.x,b.units.find(u=>u.id===id).y-command.y)<=6);
  const bronze=b.artillery.find(g=>g.id==='piece-12'),crew=artilleryCrewPlan(b,command,bronze,0);assert.equal(crew.reason,null);assert.deepEqual([...crew.crew].sort(),['135','57']);
  const receipt={orders,seconds:b.elapsedSeconds-before.elapsedSeconds,mode:b.mode,phase:b.phase,units:b.units.filter(u=>u.side==='player').map(u=>({id:u.id,x:u.x,y:u.y,hp:u.hp,ap:u.ap,energy:u.energy,medkits:u.medkits,morale:u.morale})),crew};if(receipts.length)assert.deepEqual(receipt,receipts[0]);receipts.push(receipt);report({event:'actualFivePersonRearSupport',...receipt});return b;
 }
 const core=createdForwardLitCapitalBattery(initial,{arrivalIds,report,prepareSupport});
 function deploy(start){
  for(const visited of visitedPositions.values())visited.clear();
  const model=sectorDeploymentModel(start);assert.ok(model);let placed=start;
  // Reserve two lawful north-entry cells away from the three issued pieces.
  for(const id of ['7','142']){
   const unit=model.units.find(u=>u.id===id),current=sectorDeploymentModel(placed);
   const desiredX=id==='7'?38:39,points=current.entryCells[unit.edge].filter(p=>p.y<=1&&p.x>=36).sort((a,b)=>Math.abs(a.x-desiredX)-Math.abs(b.x-desiredX)||a.y-b.y||a.x-b.x);
   const point=points.find(p=>!placed.units.some(u=>u.side==='player'&&u.id!==id&&u.deploymentPlaced&&u.x===p.x&&u.y===p.y));assert.ok(point);
   placed=sectorDeploymentAction(placed,{type:'placeDeployment',unitIds:[id],x:point.x,y:point.y});assert.equal(placed.lastError,null);
  }
  return core.deploy(placed);
 }
 const normalController=(b,u)=>['7','142'].includes(u.id)?normalCapitalSupportOrder(b,u):core.controller(b,u);
 const controller=(b,u)=>knownCapitalQuadrantOrder(b,u,normalController(b,u),visitedPositions);
 return {deploy,controller};
}

function normalCapitalSupportOrder(b,u){
  const normal=northernCombatOrder(b,u);if(!normal)return null;
  if(normal.type==='stance'&&normal.stance==='standing'&&b.mode==='exploration'&&u.stance==='crouched')return null;
  if(!['move','climb','charge','artilleryMove','exit'].includes(normal.type))return normal;
  if(normal.type==='move'){
   const known=playerKnownBattle(b),unit=known.units.find(v=>v.id===u.id),command=known.units.find(v=>v.id==='57'),point=getReachable(known,unit).find(p=>p.x===normal.x&&p.y===normal.y&&(p.tacticalLevel??0)===(normal.tacticalLevel??0));
   if(point&&point.y<=command.y+3&&Math.hypot(point.x-command.x,point.y-command.y)<=6&&point.path.every(p=>known.tiles.some(t=>t.x===p.x&&t.y===p.y&&(t.tacticalLevel??0)===(p.tacticalLevel??0)&&!t.blocked)))return normal;
  }
  return u.stance==='standing'&&u.ap>=stanceCost(u,'crouched')?{type:'stance',unitId:u.id,stance:'crouched'}:null;
}

function knownCapitalQuadrantOrder(b,u,normal,visitedPositions){
  for(const [id,visited]of visitedPositions){const own=b.units.find(v=>v.id===id);if(own)visited.add(`${own.x},${own.y},${own.tacticalLevel??0}`);}
  const quiet=['7','142'].includes(u.id)&&b.mode==='exploration'&&b.turn>=8&&!b.units.some(v=>v.side==='enemy'&&v.hp>=15&&!v.routed&&!v.surrendered&&!v.unconscious&&!v.departure&&teamCanSee(b,u.side,v));
  const known=playerKnownBattle(b),staleLook=normal?.type==='look'&&known.units.some(v=>v.side==='enemy'&&v.hp<=0&&v.x===normal.x&&v.y===normal.y);
  if(!quiet||normal&&!staleLook)return normal;
  const unit=known.units.find(v=>v.id===u.id),other=known.units.find(v=>v.id===(u.id==='7'?'142':'7')&&v.hp>=15&&!v.routed&&!v.unconscious&&!v.departure);
  const corners=[[.25,.25],[.75,.25],[.75,.75],[.25,.75]],goals=corners.map(([x,y])=>({x:Math.floor(b.width*x),y:Math.floor(b.height*y)}));
  let index=Math.floor((b.turn-8)/2)%goals.length;
  for(let count=0;count<goals.length;count++){const goal=goals[index];if(![...visitedPositions.values()].some(visited=>visited.has(`${goal.x},${goal.y},0`)))break;index=(index+1)%goals.length;}
  const goal=goals[index],distance=p=>Math.hypot(p.x-goal.x,p.y-goal.y);
  // Repeated looks at a known dead contact face away from the search road.
  // In quiet exploration only, pay for the current public quadrant heading.
  const look={type:'look',unitId:u.id,...goal},quote=lookPreview(b,u,goal);
  if(quote.valid&&quote.facing!==u.facing)return look;
  const oldSpread=other?Math.hypot(unit.x-other.x,unit.y-other.y):0;
  const visited=visitedPositions.get(u.id),cells=new Set(known.tiles.map(t=>`${t.x},${t.y},${t.tacticalLevel??0}`));
  const legalPath=(p,actor)=>p.cost>0&&p.cost<=Math.min(30,actor.ap-20)&&(p.tacticalLevel??0)===(actor.tacticalLevel??0)&&p.path.every(c=>known.tiles.some(t=>t.x===c.x&&t.y===c.y&&!t.blocked&&(t.tacticalLevel??0)===(c.tacticalLevel??0)));
  const reachable=getReachable(known,unit).filter(p=>legalPath(p,u)&&(!other||Math.hypot(p.x-other.x,p.y-other.y)<=Math.max(4,oldSpread)));
  const candidates=reachable.filter(p=>!visited.has(`${p.x},${p.y},${p.tacticalLevel??0}`));
  let point=candidates.filter(p=>distance(p)<distance(unit)).sort((a,z)=>distance(a)-distance(z)||a.cost-z.cost)[0];
  // A closed or unseen forward cell can require a known lateral road. Visit
  // a new visible frontier post instead of waiting or reversing the last step.
  if(!point){
   const dx=Math.sign(goal.x-unit.x),dy=Math.sign(goal.y-unit.y);
   const frontier=p=>{const x=p.x+dx,y=p.y+dy;return x>=0&&y>=0&&x<b.width&&y<b.height&&!cells.has(`${x},${y},${p.tacticalLevel??0}`);};
   point=candidates.filter(frontier).sort((a,z)=>distance(a)-distance(z)||a.cost-z.cost)[0];
  }
  // A scout can need a known visited step toward its partner to unlock the
  // partner's new forward road without increasing their actual pair spread.
  if(!point&&other){
   const otherVisited=visitedPositions.get(other.id);
   const blockedProgress=getReachable(known,other).filter(p=>legalPath(p,other)&&!otherVisited.has(`${p.x},${p.y},${p.tacticalLevel??0}`)&&distance(p)<distance(other)&&Math.hypot(p.x-unit.x,p.y-unit.y)>Math.max(4,oldSpread));
   point=reachable.filter(p=>Math.hypot(p.x-other.x,p.y-other.y)<oldSpread&&blockedProgress.some(next=>Math.hypot(next.x-p.x,next.y-p.y)<=Math.max(4,oldSpread))).sort((a,z)=>distance(a)-distance(z)||a.cost-z.cost)[0];
  }
  if(!point)return null;
  return {type:'move',unitId:u.id,x:point.x,y:point.y,tacticalLevel:point.tacticalLevel??0};
}


function lastLivingCapitalScoutOrder(b,u,normal,started){
 if(u.id!=='57'||!['7','142','145'].every(id=>b.units.find(v=>v.id===id).hp<=0))return {action:normal,started};
 if(!started&&normal)return {action:normal,started};
 const personal=tucumanCombatOrder(b,u),contact=b.units.some(v=>v.side==='enemy'&&v.hp>=15&&!v.routed&&!v.surrendered&&!v.unconscious&&!v.departure&&teamCanSee(b,u.side,v));
 if(normal&&(!['move','climb','charge','artilleryMove','exit','stance','look'].includes(normal.type)||b.mode!=='exploration'))return {action:normal,started:true};
 if(personal&&!['move','climb','charge','artilleryMove','exit','stance','look'].includes(personal.type))return {action:personal,started:true};
 if(b.mode!=='exploration'||contact)return {action:personal&&!['move','climb','charge','artilleryMove','exit'].includes(personal.type)?personal:null,started:true};
 const known=playerKnownBattle(b),unit=known.units.find(v=>v.id===u.id),bodies=known.units.filter(v=>['7','142'].includes(v.id)&&v.side===u.side&&v.hp<=0).sort((a,z)=>Math.hypot(a.x-u.x,a.y-u.y)-Math.hypot(z.x-u.x,z.y-u.y));assert.equal(bodies.length,2);const goal=bodies[0];
 if(u.movementMode!=='run')return {action:u.ap>=stanceCost(u,'standing')?{type:'movement',unitId:u.id,movement:'run'}:null,started:true};
 const look={type:'look',unitId:u.id,x:goal.x,y:goal.y},quote=lookPreview(b,u,look);if(quote.valid&&quote.facing!==u.facing)return {action:look,started:true};
 const distance=p=>Math.hypot(p.x-goal.x,p.y-goal.y),points=getReachable(known,unit).filter(p=>p.cost>0&&p.cost<=80&&(p.tacticalLevel??0)===0&&distance(p)<distance(unit)&&p.path.every(c=>known.tiles.some(t=>t.x===c.x&&t.y===c.y&&!t.blocked&&(t.tacticalLevel??0)===(c.tacticalLevel??0)))).sort((a,z)=>distance(a)-distance(z)||a.cost-z.cost);const point=points[0];
 return {action:point?{type:'move',unitId:u.id,x:point.x,y:point.y,tacticalLevel:0}:null,started:true};
}
export function createdFiveSupportCapitalBattery(initial,options){
 if(options.arrivalIds.some(id=>initial.artillery.find(gun=>gun.id===id)?.type!=='swivel'))return finiteBatteryDriver(initial,{gunIds:options.arrivalIds,report:options.report});
 const base=createCapitalSupportBattery(initial,options);let started=false;return {deploy:b=>{started=false;return base.deploy(b);},controller:(b,u)=>{const result=lastLivingCapitalScoutOrder(b,u,base.controller(b,u),started);started=result.started;return result.action;}};
}
