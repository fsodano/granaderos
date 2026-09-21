import {assertCustodyCare} from './custody-care-evidence.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {rosterFor} from '../game/campaign.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,isSupplied,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {deployedArtillery} from '../game/equipment.js';
import {prepareSectorArtillery,validateArtilleryDeployment,validateArtilleryReport,settleSectorArtillery,ownedArtilleryCount,artillerySupplyPreview} from '../game/campaign-artillery.js';
import {createBattle,actBattle,endTurn,getReachable,artilleryReloadPreview,artilleryCrewPlan,artilleryCosts,interruptAvailable} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {buildSectorMap} from '../game/maps.js';
import {automaticOrder} from '../game/autonomous-orders.js';import {sameSurface,tacticalLevel} from '../game/tactical-space.js';
import {fight} from './opening-driver.mjs';
import {encodeSave,decodeSave} from '../game/save.js';import {syncBattleTime} from '../game/time.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const act=(s,a)=>{const n=actBattle(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
function issued({reinforced=true}={}){let c=order(initialCampaign(45),{type:'purchaseEquipment',item:'swivel'});
 // Pay for a complete squad under the current map and contract prices.
 if(reinforced){const cash=c.resources.treasury;for(const id of [123,115,110])c=order(c,{type:'recruitCivic',id,term:'week'});assert.equal(cash-c.resources.treasury,371);assert.ok(c.resources.treasury>=0);}
 // Draw actual clothing before the march; assault no longer grants protection from pooled stock.
 for(const operativeId of c.squad.filter(id=>!c.operativeState[id].outfit)){c=order(c,{type:'sectorInventory',sector:'retiro',operativeId,direction:'issueOutfit'});const row=sectorInventoryModel(c,'retiro',rosterFor(c),operativeId).carried.find(row=>row.equip?.some(e=>e.slot==='outfit'));c=order(c,{type:'sectorInventory',sector:'retiro',operativeId,direction:'equip',inventoryKey:row.inventoryKey,expected:row.expected,slot:'outfit'});}
 c=order(c,{type:'travel',sector:'buenos_aires'});return order(c,{type:'attack',sector:'san_nicolas'});}
function won(){let c=issued();
 // Coordinate one ordinary order per soldier per pass. Spending a scout's
 // entire turn first separates him from fire support and medical aid.
 const r=fight(c.pendingBattle,null,{controller:automaticOrder});assert.equal(r.battle.status,'victory');assert.ok(r.actions>0);const pair=syncBattleTime(c,r.battle);assert.equal(pair.error,null);const saved=decodeSave(encodeSave(pair.campaign,pair.battle));c=order(saved.campaign,{type:'battleResult',battleId:c.pendingBattle.id,outcome:r.battle.status,sectorState:saved.battle,survivors:saved.battle.units.filter(u=>u.side==='player')});for(const u of r.battle.units.filter(u=>u.side==='player')){assert.equal(c.operativeState[u.id].alive,u.hp>0);assert.equal(c.operativeState[u.id].hp,u.hp);}return c;}
function returnVisit(c,b){const pair=syncBattleTime(c,b);assert.equal(pair.error,null);return order(pair.campaign,{type:'leaveSector',battleId:c.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});}
const save=c=>restoreCampaign(serializeCampaign(c));
const flat=()=>Array.from({length:240},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',blocked:false,cover:0}));

test('paid artillery is issued once, leaves stock and survives a real victory without duplicate guns',()=>{
 const c=issued();assert.equal(c.resources.cannons,0);assert.equal(c.armory.swivel,0);assert.equal(c.pendingBattle.artillery.length,1);assert.match(c.pendingBattle.artillery[0].id,/:piece-0$/);assert.deepEqual(deployedArtillery(c),[]);validateArtilleryDeployment(c.pendingBattle);
 const after=won(),guns=after.sectorStates.san_nicolas.artillery;assert.equal(guns.length,1);assert.equal(guns[0].type,'swivel');assert.equal(ownedArtilleryCount(after),1);assert.equal(after.resources.cannons,0);assert.deepEqual(save(after).sectorStates.san_nicolas.artillery,guns);
});
test('firing in a safe sector leaves the same empty gun at the same full-size map position across repeated real reports',()=>{
 let c=won();c=order(c,{type:'visitSector'});let b=enterSector(c.pendingBattle,c.sectorStates.san_nicolas);const gun=b.artillery[0],id=gun.id;
 // Battle casualties determine the available crew. The first roster entry
 // can be unconscious; choose an actual survivor with a legal approach.
 const approach=b.units.filter(u=>u.side==='player'&&!u.militia).flatMap(u=>getReachable(b,u).filter(p=>{const actor={...u,x:p.x,y:p.y,tacticalLevel:tacticalLevel(p)};return sameSurface(p,gun)&&!artilleryCrewPlan(b,actor,gun,artilleryCosts(b,actor,gun).fire).reason;}).map(step=>({u,step}))).sort((a,b)=>a.step.cost-b.step.cost||a.u.id.localeCompare(b.u.id))[0];
 assert.ok(approach,'a surviving soldier must reach a valid gun crew position');const {u,step}=approach,elapsed=b.elapsedSeconds;assert.ok(step.path.length);assert.equal(b.mode,'exploration');
 b=act(b,{type:'move',unitId:u.id,x:step.x,y:step.y,tacticalLevel:tacticalLevel(step)});
 const crew=b.units.find(v=>v.id===u.id);assert.equal(crew.ap,u.ap);assert.ok(crew.energy<u.energy);assert.ok(b.elapsedSeconds>elapsed);assert.equal(artilleryCrewPlan(b,crew,b.artillery[0],artilleryCosts(b,crew,b.artillery[0]).fire).reason,null);
 b=act(b,{type:'artillery',unitId:u.id,artilleryId:id,x:gun.x+2,y:gun.y,mode:'solid'});assert.equal(b.artillery[0].loaded,false);assert.equal(b.artillery[0].ammo,6);c=returnVisit(c,b);
 for(let i=0;i<3;i++){
  c=order(save(c),{type:'visitSector'});b=enterSector(c.pendingBattle,c.sectorStates.san_nicolas);assert.equal(b.artillery.length,1);assert.equal(b.artillery[0].id,id);assert.equal(b.artillery[0].loaded,false);assert.equal(b.artillery[0].ammo,6);assert.equal(b.artillery[0].x,gun.x);assert.equal(b.artillery[0].y,gun.y);c=returnVisit(c,b);assert.equal(c.resources.cannons,0);
 }
});
test('paid partial work survives a stationed request and resumes at its remaining cost',()=>{
 const c=order(initialCampaign(45),{type:'purchaseEquipment',item:'swivel'});const request={id:'controlled',sector:'retiro',origin:'retiro',artillery:deployedArtillery(c)};prepareSectorArtillery(c,request);
 let b=createBattle([{id:20,x:1,y:2,hp:20,maxHp:100,bandaged:80,energy:30,fatigue:90}],{...request,width:24,height:10,tiles:flat(),artillery:request.artillery.map(g=>({...g,x:2,y:2})),enemies:[{id:'guard',x:22,y:8,patrol:false,overwatch:false}]});
 b=act(b,{type:'artillery',unitId:'20',artilleryId:b.artillery[0].id,x:6,y:2});b=act(b,{type:'artilleryReload',unitId:'20',artilleryId:b.artillery[0].id});assert.ok(b.artillery[0].reloadProgress>0);assert.equal(b.artillery[0].ammo,6);validateArtilleryReport(request,b);
 c.sectorStates.retiro=structuredClone(b);const revisit={id:'revisit',sector:'retiro',exploration:true,squad:[{id:20,x:1,y:2}],enemies:[],artillery:[]};prepareSectorArtillery(c,revisit);const next=enterSector(revisit,b);assert.equal(next.artillery[0].reloadProgress,b.artillery[0].reloadProgress);assert.equal(next.artillery[0].id,b.artillery[0].id);
 const leader={...next.units[0],x:next.artillery[0].x-1,y:next.artillery[0].y};next.units[0]=leader;const p=artilleryReloadPreview(next,leader,next.artillery[0]);assert.equal(p.totalPA,33);const done=act(next,{type:'artilleryReload',unitId:'20',artilleryId:next.artillery[0].id});assert.equal(done.artillery[0].ammo,5);assert.equal(done.artillery[0].loaded,true);
});
test('reports reject disappearing, duplicated, swapped or refilled cannons',()=>{
 const c=issued(),request=c.pendingBattle,b=enterSector(request);for(const change of [s=>s.artillery=[],s=>s.artillery.push(structuredClone(s.artillery[0])),s=>s.artillery[0].id='forged',s=>s.artillery[0].type='field8',s=>s.artillery[0].side='enemy',s=>s.artillery[0].ammo++]){const next=structuredClone(b);change(next);assert.throws(()=>validateArtilleryReport(request,next));}
});
test('retreat leaves guns to the occupying enemy and victory recaptures their exact load',()=>{
 const b={artillery:[{id:'g',type:'swivel',side:'player',x:2,y:2,loaded:false,ammo:2,reloadProgress:.4}],units:[{side:'enemy',hp:30}]};settleSectorArtillery(b,'retreat');assert.equal(b.artillery[0].side,'enemy');assert.equal(b.artillery[0].reloadProgress,.4);settleSectorArtillery(b,'victory');assert.equal(b.artillery[0].side,'player');assert.equal(b.artillery[0].ammo,2);assert.equal(b.artillery[0].loaded,false);
 const c=initialCampaign();c.sectorStates.retiro=structuredClone(b);c.sectors.retiro.owner='royalist';const r={id:'retake',sector:'retiro',origin:'buenos_aires',artillery:[]};prepareSectorArtillery(c,r);assert.equal(r.artillery[0].side,'enemy');assert.equal(ownedArtilleryCount(c),0);
});
test('reentering with another purchased cannon retains the original without overlapping or replacing it',()=>{
 let c=won();c=order(c,{type:'travel',sector:'retiro'});c=order(c,{type:'purchaseEquipment',item:'bronze4'});const r={id:'reinforce',sector:'san_nicolas',origin:'retiro',artillery:deployedArtillery(c),squad:[],enemies:[],exploration:true};prepareSectorArtillery(c,r);const old=c.sectorStates.san_nicolas.artillery[0],next=enterSector(r,c.sectorStates.san_nicolas);assert.equal(next.artillery.length,2);assert.equal(new Set(next.artillery.map(g=>g.id)).size,2);assert.equal(next.artillery.find(g=>g.id===old.id).x,old.x);assert.equal(new Set(next.artillery.map(g=>`${g.x},${g.y}`)).size,2);assert.equal(c.resources.cannons,0);
});
test('typed stock cannot turn a stale battery selection into another free model',()=>{
 const c=initialCampaign();c.resources.cannons=1;c.armory={bronze4:1};c.artillerySelection=['field8'];assert.deepEqual(deployedArtillery(c),[]);c.artillerySelection=[];assert.equal(deployedArtillery(c)[0].type,'bronze4');
 c.resources.cannons=1;c.armory={field8:1};c.depots.retiro={cannons:1};c.artillerySelection=['bronze4','field8'];const r={id:'mixed',sector:'san_nicolas',origin:'retiro',artillery:deployedArtillery(c)};prepareSectorArtillery(c,r);assert.equal(r.artillery.length,2);assert.equal(c.resources.cannons,0);assert.equal(c.depots.retiro.cannons,0);assert.equal(c.armory.field8,0);
});
test('resupply consumes finite powder and iron without loading or erasing existing work',()=>{
 let c=won();const g=c.sectorStates.san_nicolas.artillery[0];g.loaded=false;g.reloadProgress=.3;g.ammo=0;const before={powder:c.resources.powder,iron:c.resources.scrapIron};const p=artillerySupplyPreview(c,'san_nicolas',g.id,2,isSupplied);assert.equal(p.valid,true);
 c=order(c,p.action);const gun=c.sectorStates.san_nicolas.artillery[0];assert.equal(gun.ammo,2);assert.equal(gun.loaded,false);assert.equal(gun.reloadProgress,.3);assert.equal(c.resources.powder,before.powder-2);assert.equal(c.resources.scrapIron,before.iron-2);assert.equal(save(c).sectorStates.san_nicolas.artillery[0].ammo,2);
});
test('remote, occupied, empty-stock and invalid resupply orders fail without changing stock or guns',()=>{
 const base=won(),id=base.sectorStates.san_nicolas.artillery[0].id;for(const patch of [s=>s.location='retiro',s=>s.sectors.san_nicolas.owner='royalist',s=>s.resources.powder=0,s=>s.resources.scrapIron=0,s=>s.squad=[]]){const c=structuredClone(base);patch(c);const n=dispatchCampaign(c,{type:'supplyArtillery',sector:'san_nicolas',gunId:id,count:1});assert.ok(n.lastError);assert.deepEqual(n.resources,c.resources);assert.deepEqual(n.sectorStates,c.sectorStates);}
 for(const count of [0,-1,1.5,1001,'2',NaN]){const n=dispatchCampaign(base,{type:'supplyArtillery',sector:'san_nicolas',gunId:id,count});assert.ok(n.lastError);assert.deepEqual(n.resources,base.resources);}
});
test('full active campaign saves keep stationed identifiers, coordinates and ammunition',()=>{
 let c=won();c=order(c,{type:'visitSector'});const b=enterSector(c.pendingBattle,c.sectorStates.san_nicolas),pair=syncBattleTime(c,b);assert.equal(pair.error,null);const saved=decodeSave(encodeSave(pair.campaign,pair.battle));assert.deepEqual(saved.battle.artillery,b.artillery);assert.deepEqual(saved.campaign.pendingBattle.artillery,c.pendingBattle.artillery);
});
test('saved deployment registries reject duplicate identities and corrupted loading fractions',()=>{
 const c=issued();for(const change of [r=>r.artillery.push({...r.artillery[0]}),r=>r.artillery[0].reloadProgress=1,r=>r.artilleryDeployment.issued=['missing'],r=>r.artilleryDeployment.site='elsewhere']){const next=structuredClone(c);change(next.pendingBattle);assert.throws(()=>save(next));}
});

// Advance to the known central road in legal short bounds, then hold fire. Enemy
// patrols and daylight contact determine the ambush; wounds come only from
// normal enemy turns. No soldier is assigned a predetermined casualty state.
function advanceAndHold(request){
 let battle=enterSector(request);const orders=[],rally=buildSectorMap(request).artillery[0];
 for(let window=0;window<100&&battle.status==='active';window++){
  if(battle.phase!=='interrupt')for(const id of battle.units.filter(u=>u.side==='player').map(u=>u.id)){
   const unit=battle.units.find(u=>u.id===id),gun=rally;
   if(!interruptAvailable(battle,unit)||unit.ap<3||Math.hypot(unit.x-gun.x,unit.y-gun.y)<=2)continue;
   const route=getReachable({...battle,mode:'exploration'},unit).filter(p=>Math.hypot(p.x-gun.x,p.y-gun.y)<=1.5).sort((a,b)=>a.cost-b.cost)[0];
   if(!route)continue;
   const reachable=getReachable(battle,unit);
   const step=[...route.path].reverse().map(p=>reachable.find(r=>r.x===p.x&&r.y===p.y)).find(p=>p?.path.length&&p.cost<=32);
   if(step){const action={type:'move',unitId:id,x:step.x,y:step.y};battle=act(battle,action);orders.push(action);}
  }
  if(battle.status==='active'){battle=endTurn(battle);assert.equal(battle.lastError,null);orders.push({type:'endTurn'});}
 }
 return {battle,orders,outcome:battle.status};
}

test('a defeated squad can hire a rescue force and recover its actual prisoners and stationed gun',()=>{
 const c=issued({reinforced:false}),request=structuredClone(c.pendingBattle),issuedGun=structuredClone(request.artillery[0]);
 const initial=enterSector(request),result=advanceAndHold(request);assert.equal(result.outcome,'defeat',JSON.stringify({orders:result.orders.length,units:result.battle.units.filter(u=>u.side==='player').map(u=>({id:u.id,x:u.x,y:u.y,hp:u.hp})),rally:buildSectorMap(request).artillery[0]}));
 assert.ok(result.orders.some(o=>o.type==='move'));assert.ok(result.orders.some(o=>o.type==='endTurn'));
 assert.ok(result.battle.units.some(u=>u.side==='enemy'&&u.hp>=15));
 const playerUnits=result.battle.units.filter(u=>u.side==='player'),dead=playerUnits.filter(u=>u.hp<=0),captured=playerUnits.filter(u=>u.hp>0);
 assert.ok(dead.length>0);assert.ok(captured.length>0);
 for(const u of playerUnits){const before=initial.units.find(v=>v.id===u.id);assert.ok(u.hp<before.hp);assert.equal(u.loaded+u.ammo,before.loaded+before.ammo);}
 assert.ok(result.battle.units.filter(u=>u.side==='enemy').reduce((n,u)=>n+u.loaded+u.ammo,0)<initial.units.filter(u=>u.side==='enemy').reduce((n,u)=>n+u.loaded+u.ammo,0));
 const pair=syncBattleTime(c,result.battle);assert.equal(pair.error,null);const saved=decodeSave(encodeSave(pair.campaign,pair.battle));
 const lost=order(saved.campaign,{type:'battleResult',battleId:request.id,outcome:result.outcome,sectorState:saved.battle,survivors:saved.battle.units.filter(u=>u.side==='player')});
 const gun=lost.sectorStates.san_nicolas.artillery.find(g=>g.id===issuedGun.id);assert.ok(gun);assert.equal(gun.side,'enemy');
 for(const key of ['id','type','x','y','loaded','ammo'])assert.equal(gun[key],result.battle.artillery[0][key]);
 assert.equal(ownedArtilleryCount(lost),0);assert.equal(lost.resources.cannons,0);assert.equal(lost.armory.swivel,0);
 for(const u of result.battle.units.filter(u=>u.side==='player'))assert.equal(lost.operativeState[u.id].alive,u.hp>0);
 let restored=decodeSave(encodeSave(lost)).campaign;assert.deepEqual(restored.sectorStates.san_nicolas.artillery,[gun]);
 assert.equal(restored.defeated,false);assert.equal(restored.location,'retiro');assert.deepEqual(restored.squad,[]);
 for(const u of dead)assert.equal(restored.operativeState[u.id].alive,false);
 for(const {id} of captured){assert.equal(restored.operativeState[id].captured,true);assert.equal(restored.operativeState[id].location,'san_nicolas');}
 const custodyStart=structuredClone(restored),captives=structuredClone(restored.operativeState),cash=restored.resources.treasury;
 for(const id of [123,115,110])restored=order(restored,{type:'recruitCivic',id,term:'week'});
 assert.equal(cash-restored.resources.treasury,371);
 restored=order(restored,{type:'travel',sector:'buenos_aires'});restored=order(restored,{type:'attack',sector:'san_nicolas'});
 assert.deepEqual(restored.pendingBattle.artillery,[{...gun,stationed:true}]);validateArtilleryDeployment(restored.pendingBattle);
 const heldBeforeRescue=structuredClone(restored.operativeState);
 for(const {id} of captured)assertCustodyCare(custodyStart,restored,Number(id));
 assert.ok(Object.values(restored.detentionRecords??{}).some(entry=>entry.care?.length));
 const rescueEntry=enterSector(restored.pendingBattle,restored.sectorStates.san_nicolas);
 // Coordinate one order per rescuer per pass, as in the original paid
 // assault. Their real enemies can now stabilize critical comrades too.
 const rescue=fight(restored.pendingBattle,restored.sectorStates.san_nicolas,{controller:automaticOrder});
 assert.equal(rescue.battle.status,'victory');
 assert.ok(rescue.actions>0);assert.ok(rescue.battle.turn<=80);assert.ok(rescue.battle.elapsedSeconds>0);
 assert.ok(rescue.battle.units.filter(u=>u.side==='player').reduce((n,u)=>n+u.loaded+u.ammo,0)<rescueEntry.units.filter(u=>u.side==='player').reduce((n,u)=>n+u.loaded+u.ammo,0));
 assert.ok(rescue.battle.units.some(u=>u.side==='enemy'&&u.hp===0&&rescueEntry.units.find(v=>v.id===u.id)?.hp>0));
 const cleared=act(rescue.battle,{type:'explore'});
 assert.equal(cleared.status,'active');assert.equal(cleared.mode,'exploration');assert.equal(cleared.sectorCleared,true);
 assert.equal(cleared.elapsedSeconds,rescue.battle.elapsedSeconds);assert.deepEqual(cleared.artillery,rescue.battle.artillery);
 const clock=syncBattleTime(restored,cleared);assert.equal(clock.error,null);const resumed=decodeSave(encodeSave(clock.campaign,clock.battle));
 restored=order(resumed.campaign,{type:'battleResult',battleId:resumed.campaign.pendingBattle.id,outcome:rescue.battle.status,sectorState:resumed.battle,survivors:resumed.battle.units.filter(u=>u.side==='player')});
 restored=decodeSave(encodeSave(restored)).campaign;
 assert.equal(restored.defeated,false);assert.equal(restored.sectors.san_nicolas.owner,'patriot');
 for(const u of dead){assert.equal(restored.operativeState[u.id].alive,false);assert.equal(restored.operativeState[u.id].hp,0);}
 for(const {id:rawId} of captured){const id=Number(rawId),u=restored.operativeState[id];assert.equal(u.captured,false);assert.equal(u.hp,heldBeforeRescue[id].hp);assert.equal(u.assignment,'patient');assert.equal(u.location,'san_nicolas');assert.ok(restored.recruited.includes(id));assert.deepEqual(u.outfit,captives[id].outfit);assert.ok(restored.contracts[id]);}
 assert.deepEqual(restored.sectorStates.san_nicolas.artillery,[{...gun,side:'player'}]);assert.equal(ownedArtilleryCount(restored),1);assert.equal(restored.resources.cannons,0);assert.equal(restored.armory.swivel,0);
});
