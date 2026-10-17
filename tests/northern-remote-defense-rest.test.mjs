import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {prepareNorthernRemoteDefenseRest} from './fresh-northern-recovery.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const order=(c,a)=>{const next=dispatchCampaign(c,a);assert.equal(next.lastError,null,JSON.stringify(a)+': '+next.lastError);return next;};
const save=c=>{const next=decodeSave(encodeSave(c)).campaign;assert.deepEqual(next,c);return next;};
// The two towns and every initial wound/supply are declared before admission.
// No failed route input, combat result or returned health is reconstructed.
function setup({acute=true,medical=90,lateDoctor=false}={}){
 const d=scaffoldDocuments('declared-remote-defense-rest'),base=d.content.characters[0];
 d.content.rules.startingTreasury=3000;d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];
 d.content.startingTerritory['watch-post'].owner='patriot';d.world.arrivalFacilities['watch-post']=['barracks'];d.content.arrivalSites.push({sector:'watch-post',facilities:['barracks']});
 const bodies=[{medical,medkits:6,hp:70},{medical:0,medkits:0,hp:acute?3:68,bleeding:acute?4:0},{medical:0,medkits:0,hp:acute?21:70,bleeding:acute?3:0},{medical:0,medkits:0,hp:70},{medical:0,medkits:0,hp:60}];
 d.content.characters=bodies.map((body,i)=>({...structuredClone(base),id:'guard-'+i,name:'Guardia '+i,nickname:'Guardia '+i,arrivalHours:0,monthlyPay:300,serviceGuarantee:31,
  attributes:{...base.attributes,medical:body.medical},startingSupplies:{rations:0,torches:0,medkits:body.medkits,boleadoras:0},
  startingCondition:{hp:body.hp,bleeding:body.bleeding??0,bandaged:body.bleeding?0:70-body.hp,energy:100,fatigue:0}}));
 const declared=structuredClone(d),definition=compileCampaignPackage(d.manifest,d);let c=initialCampaign(42,definition);const ids=rosterFor(c).map(op=>op.id),book=id=>{
  const person=rosterFor(c).find(op=>op.id===id),quote=contractQuote(c,person,'day'),cash=c.resources.treasury;
  c=order(c,{type:'recruitCivic',id,term:'day',destination:id===ids[4]?'camp':'watch-post'});assert.equal(c.resources.treasury,cash-quote.total);
 };
 book(ids[0]);
 if(lateDoctor){const until=clock(c)+23*3600;for(let attempt=0;clock(c)<until&&attempt<3;attempt++)c=order(c,{type:'wait',hours:Math.min(23,(until-clock(c))/3600)});assert.equal(clock(c),until);}
 for(const id of ids.slice(1))book(id);
 c=order(c,{type:'createSquad',ids:ids.slice(0,4),sector:'watch-post',name:'Reserva real'});
 c=order(c,{type:'createSquad',ids:[ids[4]],sector:'camp',name:'Hospital distante'});
 assert.deepEqual(d,declared);return {campaign:save(c),ids};
}
function replay(start,result){
 let c=start;for(const [index,action]of result.receipt.orders.entries()){c=order(c,action);if(index===Math.floor(result.receipt.orders.length/2))c=save(c);}
 assert.deepEqual(save(c),result.campaign);
}
const property=(c,id)=>Object.fromEntries(['alive','captured','location','residentPosition','inventory','primaryWeapon','bladeWeapon','ammoStock','carriedLoaded','carriedLoading','carriedJammed','weaponDropped'].map(key=>[key,c.operativeState[id][key]]));

test('new remote critical and bleeding guards receive finite local care before the distant clinic clock resumes',()=>{
 const {campaign:start,ids}=setup({lateDoctor:true}),before=structuredClone(start),events=[];
 const result=prepareNorthernRemoteDefenseRest(start,'watch-post',{report:event=>events.push(event)}),c=result.campaign;
 assert.deepEqual(result.receipt.patients,ids.slice(1,3));assert.ok(result.receipt.stabilization.ticks.length>0);
 const spent=start.operativeState[ids[0]].medkits-c.operativeState[ids[0]].medkits;
 assert.ok(spent>0&&spent<=6);assert.equal(spent,result.receipt.stabilization.ticks.reduce((sum,tick)=>sum+tick.dressingsSpent,0));
 for(const id of ids.slice(0,4)){const r=c.operativeState[id];assert.ok(r.alive&&r.hp>=15&&!r.bleeding);assert.equal(r.assignment,'rest');assert.ok(c.recruited.includes(id));assert.deepEqual(property(c,id),property(start,id));}
 assert.ok(c.operativeState[ids[1]].hp<c.operativeState[ids[1]].maxHp,'Acute stabilization is not a full-health grant.');
 assert.equal(c.operativeState[ids[4]].hp,start.operativeState[ids[4]].hp);assert.equal(c.operativeState[ids[4]].assignment,'active');assert.equal(c.location,start.location);assert.equal(c.activeSquadId,start.activeSquadId);
 const renewals=events.filter(event=>event.event==='northernHospitalRenewal');assert.ok(renewals.some(event=>event.action.id===ids[0]));
 assert.equal(c.resources.treasury,start.resources.treasury-renewals.reduce((sum,event)=>sum+event.cost,0));
 assert.ok(contractExpiresSeconds(c.contracts[ids[0]])>clock(c));assert.equal(c.contracts[ids[0]].guaranteeId,start.contracts[ids[0]].guaranteeId);
 assert.deepEqual(c.sectorStates,start.sectorStates);assert.deepEqual(start,before);replay(start,result);
});

test('a stable remote reserve is assigned real rest without a free health, energy, morale or clock change',()=>{
 const {campaign:start,ids}=setup({acute:false}),before=structuredClone(start),result=prepareNorthernRemoteDefenseRest(start,'watch-post'),c=result.campaign;
 assert.equal(result.receipt.stabilization,null);assert.equal(clock(c),clock(start));assert.equal(c.resources.treasury,start.resources.treasury);
 for(const id of ids.slice(0,4)){const r=c.operativeState[id],old=start.operativeState[id];assert.equal(r.assignment,'rest');for(const key of ['hp','bleeding','energy','fatigue','morale','medkits'])assert.equal(r[key],old[key]);}
 let rested=c;const waits=[],until=clock(c)+6*3600;
 for(let notice=0;clock(rested)<until&&notice<3;notice++){const action={type:'wait',hours:(until-clock(rested))/3600};waits.push(action);rested=order(rested,action);}
 assert.equal(clock(rested)-clock(c),6*3600);assert.equal(rested.operativeState[ids[1]].hp,c.operativeState[ids[1]].hp+1);
 assert.equal(rested.operativeState[ids[4]].hp,c.operativeState[ids[4]].hp,'The active distant patient is not silently healed.');
 for(const id of ids.slice(0,4))assert.deepEqual(property(rested,id),property(start,id));
 assert.deepEqual(start,before);replay(start,result);assert.deepEqual(waits.reduce(order,save(c)),save(rested));
});

test('acute guards without an actual stable local physician cannot be declared ready or advance a remote clock',()=>{
 const {campaign:start}=setup({medical:0}),before=structuredClone(start);
 assert.throws(()=>prepareNorthernRemoteDefenseRest(start,'watch-post'),/actual stable local physician/);assert.deepEqual(start,before);
});


// The existing retreat/exit protocol earns the morale deficit. Every body,
// weapon, finite cartridge, road exit and raid is declared before the factory.
import {validateContentPackage} from '../game/content-package.js';
import {enterSector} from '../game/world.js';
import {actBattle,presentedActBattle,getReachable,exitPreview} from '../game/tactical.js';
import {boundaryPassable} from '../game/tactical-exits.js';
import {spacePoint} from '../game/tactical-space.js';
import {syncBattleTime} from '../game/time.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {resolveRestingNorthernClinicDefense,resolveRescueStagingDefense} from './northern-route.mjs';
import {stageRouteRoofDefenders} from './route-roof-defenders.mjs';

function restingClinicRaid(){
 const d=scaffoldDocuments('declared-clinic-duty-return'),base=d.content.characters[0],world=d.world;
 // Keep the real camp headquarters and hostile retreat destination. Córdoba
 // is a separate owned locality, so the ordinary scheduled raid is lawful.
 const cell=world.cells.find(point=>point.col===17&&point.row===16),name='Córdoba';
 Object.assign(cell,{name,anchor:true,district:true,location:'cordoba',locality:'cordoba'});
 world.sectors.push({...structuredClone(world.sectors.find(sector=>sector.id==='watch-post')),id:'cordoba',name,grid:cell.grid,neighbors:['camp','watch-post']});
 for(const sector of world.sectors.slice(0,2))sector.neighbors.push('cordoba');
 world.places.cordoba={lon:17,lat:17,label:name};world.districts.cordoba=[{id:'cordoba:0',sectorId:'cordoba',col:cell.col,row:cell.row,name,x:cell.x,y:cell.y,urban:false}];
 world.arrivalFacilities.cordoba=['barracks'];world.ruralSectors.push('cordoba');world.landscapes.cordoba='settlement';world.expansion.rural.push('cordoba');
 d.maps.cordoba={...structuredClone(d.maps.camp),id:'cordoba',title:name};d.content.startingTerritory.cordoba={owner:'patriot',loyalty:65};d.content.arrivalSites.push({sector:'cordoba',facilities:['barracks']});
 // This clinic has the same supported public roof/slab declaration used by
 // existing paid staging controls. Both real climb routes remain accessible.
 d.maps.cordoba.upperSurfaces=Array.from({length:24},(_,i)=>({id:'clinic-duty-roof-'+i,x:8+i%6,y:5+Math.floor(i/6),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:30}));
 d.maps.cordoba.climbLinks=[{id:'clinic-duty-north-access',kind:'climb',from:{x:7,y:6,tacticalLevel:0},to:{x:8,y:6,tacticalLevel:1}},{id:'clinic-duty-west-access',kind:'climb',from:{x:7,y:8,tacticalLevel:0},to:{x:8,y:8,tacticalLevel:1}}];
 assert.equal(d.content.headquarters,'camp');assert.equal(world.defaultHeadquarters,'camp');assert.equal(d.content.startingTerritory.camp.owner,'patriot');assert.equal(d.content.startingTerritory['watch-post'].owner,'royalist');
 d.content.rules.startingTreasury=10000;d.content.rules.deploymentCartridges=12;d.content.rules.enemyCartridges=0;d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];
 d.world.expansion.buildingTargets={camp:0,cordoba:0,'watch-post':0};d.world.physical.caches={};
 d.world.exitLinks=[['cordoba','E',19,8,'watch-post','W',0,8]];
 d.world.deployment={'watch-post':{playerAnchors:[{x:0,y:6},{x:0,y:8},{x:0,y:10}],enemyAnchor:{x:16,y:8}}};
 d.world.enemyStrategy={version:1,theaters:{frontier:{legHours:1,reserve:3,raidEveryHours:48,axis:['cordoba']}}};
 assert.ok(!d.world.enemyStrategy.theaters.frontier.axis.includes(d.content.headquarters));
 d.content.weapons.push({id:'clinic-duty-musket',template:1800,name:'Mosquete del depósito',damage:58,fireAP:12,aimAP:6,reloadAP:45,range:18,readyAP:6,capacity:1,weight:4,price:240,art:base.portrait});
 d.content.characters=['rest-a','rest-b','active-guard'].map(name=>({...structuredClone(base),id:name,name,nickname:name,monthlyPay:30,arrivalHours:0,serviceGuarantee:0,weapon:'clinic-duty-musket',
  attributes:{...base.attributes,maxHp:80,agility:90,dexterity:90,strength:90,wisdom:90,marksmanship:100,medical:name==='active-guard'?1:0},
  startingSupplies:{rations:0,torches:0,boleadoras:0,medkits:name==='active-guard'?1:0},startingCondition:{hp:80,bleeding:0,bandaged:0,energy:100,fatigue:0}}));
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);let c=initialCampaign(45,content);const ids=rosterFor(c).map(op=>op.id);
 for(const id of ids){const q=contractQuote(c,rosterFor(c).find(op=>op.id===id),'month'),cash=c.resources.treasury;c=order(c,{type:'recruitCivic',id,term:'month',destination:'cordoba'});assert.equal(cash-c.resources.treasury,q.total);}
 c=order(c,{type:'createSquad',ids,sector:'cordoba',name:'Guardia del depósito'});assert.equal(c.location,'cordoba');assert.equal(c.sectors.camp.owner,'patriot');assert.equal(c.sectors.cordoba.owner,'patriot');assert.equal(c.sectors['watch-post'].owner,'royalist');
 for(let retreat=0;retreat<2;retreat++){
  const morale=Object.fromEntries(ids.map(id=>[id,c.operativeState[id].morale]));c=order(c,{type:'attack',sector:'watch-post'});assert.ok(c.pendingBattle);assert.equal(c.pendingEncounter,null);
  let campaign=c,battle=enterSector(c.pendingBattle,c.sectorStates['watch-post']);const act=action=>{
   const direct=actBattle(battle,action);assert.equal(direct.lastError,null,JSON.stringify(action));assert.deepEqual(presentedActBattle(battle,action).state,direct);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(direct))),direct);
   const synced=syncBattleTime(campaign,direct);assert.equal(synced.error,null);const pair=decodeSave(encodeSave(synced.campaign,synced.battle));assert.deepEqual(pair,{campaign:synced.campaign,battle:synced.battle});campaign=pair.campaign;battle=pair.battle;
  };
  const exit=battle.exits.find(exit=>exit.destination==='cordoba');assert.ok(exit);
  for(const id of ids){const actor=battle.units.find(unit=>unit.id===String(id));if(!boundaryPassable(battle,actor,exit.edge)){const goal=getReachable(battle,actor).filter(point=>boundaryPassable(battle,point,exit.edge)).sort((a,b)=>a.cost-b.cost)[0];assert.ok(goal);act({type:'move',unitId:actor.id,...spacePoint(goal)});}}
  const action={type:'exit',unitIds:ids.map(String),exitId:exit.id},quote=exitPreview(battle,action);assert.equal(quote.available,true,quote.reason);act(action);assert.equal(battle.status,'retreat');
  c=order(campaign,{type:'battleResult',battleId:campaign.pendingBattle.id,outcome:'retreat',sectorState:battle,survivors:battle.units.filter(unit=>unit.side==='player')});
  assert.equal(c.location,'cordoba');assert.equal(c.pendingBattle,null);for(const id of ids){assert.equal(c.operativeState[id].morale,morale[id]-5);assert.equal(c.operativeState[id].hp,80);assert.equal(c.operativeState[id].bleeding,0);assert.equal(c.operativeState[id].assignment,'active');}
  c=save(c);
 }
 assert.ok(ids.every(id=>c.operativeState[id].morale===70));
 // Real retreat arrivals are still on the ground. Pay the clinic's normal
 // peaceful roof preparation before waiting for the already scheduled raid.
 // This consumes the existing staging hour, not an extra wait or raid delay.
 const stageStart=c,stageBefore=structuredClone(c),staged=stageRouteRoofDefenders(c,ids,{bounded:{deadlineSeconds:clock(c)+3600}}),staging=staged.receipt;c=staged.campaign;
 assert.deepEqual(stageStart,stageBefore);assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);assert.deepEqual(staging.ids,ids);
 assert.ok(staging.steps>0&&staging.steps<=staging.maximumSteps&&staging.maximumSteps===64*ids.length);assert.ok(staging.orders.length<=staging.maximumOrders&&staging.maximumOrders<=600);
 assert.ok(staging.orders.some(row=>row.kind==='battle'&&row.action.type==='move'));assert.ok(staging.orders.some(row=>row.kind==='battle'&&row.action.type==='climb'));
 assert.ok(staging.endSeconds>staging.startSeconds&&staging.endSeconds<=staging.until&&staging.until===staging.startSeconds+3600);assert.equal(clock(c),staging.endSeconds);
 assert.equal(new Set(staging.positions.map(point=>`${point.tacticalLevel}:${point.x}:${point.y}`)).size,ids.length);
 for(const id of ids){const r=c.operativeState[id],post=staging.positions.find(point=>point.id===id),surface=c.sectorStates.cordoba.upperSurfaces.find(point=>point.x===post.x&&point.y===post.y&&point.tacticalLevel===post.tacticalLevel);
  assert.equal(r.residentSector,'cordoba');assert.equal(r.residentScene,null);assert.equal(post.tacticalLevel,1);assert.ok(surface&&!surface.blocked&&surface.kind==='roof'&&surface.cover===30);assert.deepEqual(r.residentPosition,spacePoint(post));
  for(const key of ['alive','hp','maxHp','bleeding','bandaged','morale','medkits','inventory','ammoStock','carriedAmmo','carriedLoaded','carriedLoading','condition','primaryWeapon','bladeWeapon'])assert.deepEqual(r[key],stageBefore.operativeState[id][key],id+' staging '+key);
  assert.ok(r.energy<=stageBefore.operativeState[id].energy);assert.equal(r.assignment,'active');
 }
 assert.ok(ids.some(id=>c.operativeState[id].energy<stageBefore.operativeState[id].energy));assert.equal(c.resources.treasury,stageBefore.resources.treasury);assert.deepEqual(c.contracts,stageBefore.contracts);assert.deepEqual(c.squads,stageBefore.squads);c=save(c);
 for(let attempt=0;!c.enemyGroups.some(group=>group.target==='cordoba'&&group.status==='marching')&&attempt<64;attempt++){assert.equal(c.pendingEncounter,null);c=order(c,{type:'wait',hours:1});}
 const group=c.enemyGroups.find(group=>group.target==='cordoba'&&group.status==='marching');assert.ok(group);assert.equal(group.initialStrength,3);
 for(const id of ids.slice(0,2))c=order(c,{type:'assignCare',operativeId:id,assignment:'rest'});
 for(let attempt=0;!c.pendingEncounter&&attempt<8;attempt++)c=order(c,{type:'wait',hours:1});assert.equal(c.pendingEncounter?.groupId,group.id);assert.equal(c.pendingEncounter.sector,'cordoba');
 for(const id of ids){assert.equal(c.operativeState[id].hp,80);assert.equal(c.operativeState[id].bleeding,0);assert.ok(c.operativeState[id].morale<80);}
 assert.deepEqual(d,declaration);return {campaign:save(c),ids};
}

test('an actual clinic defense restores only prior local rest after victory and pays later morale recovery without a grant',()=>{
 const {campaign:start,ids}=restingClinicRaid(),before=structuredClone(start),admitted=order(start,{type:'respondToEncounter',groupId:start.pendingEncounter.groupId,choice:'tactical'});
 assert.deepEqual(ids.map(id=>start.operativeState[id].assignment),['rest','rest','active']);assert.ok(ids.every(id=>admitted.operativeState[id].assignment==='active'));assert.ok(ids.every(id=>admitted.operativeState[id].recoveryHours===0));
 const result=resolveRestingNorthernClinicDefense(start),c=result.campaign,settled=result.settledCampaign;
 assert.equal(result.summary.status,'victory');assert.ok(result.summary.turns>=1&&result.summary.actions>0&&result.summary.elapsedSeconds>0);assert.equal(c.pendingEncounter,null);assert.equal(c.pendingBattle,null);assert.equal(c.sectors.cordoba.owner,'patriot');assert.deepEqual(result.restoredRestIds,ids.slice(0,2));
 // The active control has only one declared dressing and basic first aid.
 // Its ordinary combat controller must actually use it before settlement.
 assert.equal(start.operativeState[ids[2]].medkits,1);assert.equal(c.operativeState[ids[2]].medkits,0);assert.ok(c.operativeState[ids[2]].bandaged>0);
 const journal=c.sectorStates.cordoba.log,aidAt=journal.findIndex(line=>line==='active-guard venda a active-guard y detiene la hemorragia. La salud se recupera con descanso y atención médica.'),victoryAt=journal.findIndex(line=>line.startsWith('¡Victoria!'));
 assert.ok(aidAt>=0&&victoryAt>aidAt,'The actual Native self-bandage must precede the real victory and settlement.');assert.ok(c.operativeState[ids[2]].hp<start.operativeState[ids[2]].hp,'Finite noncritical first aid stops bleeding without restoring the actual lost health.');
 for(const id of ids.slice(0,2)){assert.equal(start.operativeState[id].medkits,0);assert.equal(c.operativeState[id].medkits,0);}
 assert.deepEqual(ids.map(id=>c.operativeState[id].assignment),['rest','rest','active']);assert.equal(clock(c),clock(settled));assert.equal(c.resources.treasury,settled.resources.treasury);assert.deepEqual(c.contracts,settled.contracts);assert.deepEqual(c.squads,settled.squads);assert.deepEqual(c.sectorStates,settled.sectorStates);
 for(const id of ids){for(const key of ['alive','captured','hp','maxHp','bleeding','bandaged','energy','fatigue','morale','moraleRestHours','location','residentPosition','medkits','inventory','ammo','carriedLoaded','condition','jammed'])assert.deepEqual(c.operativeState[id][key],settled.operativeState[id][key],id+' '+key);assert.ok(c.operativeState[id].alive&&c.operativeState[id].hp>=15&&!c.operativeState[id].bleeding);}
 assert.deepEqual(result.events,[{action:{type:'respondToEncounter',groupId:start.pendingEncounter.groupId,choice:'tactical'},hour:admitted.hour,second:admitted.secondOfHour??0,cost:0},...ids.slice(0,2).map(operativeId=>({action:{type:'assignCare',operativeId,assignment:'rest'},hour:settled.hour,second:settled.secondOfHour??0,cost:0}))]);
 const restOrders=result.events.filter(event=>event.action.type==='assignCare');assert.deepEqual(restOrders.map(event=>event.action),ids.slice(0,2).map(operativeId=>({type:'assignCare',operativeId,assignment:'rest'})));assert.deepEqual(restOrders.reduce((campaign,event)=>order(campaign,event.action),save(settled)),c);
 const morale=Object.fromEntries(ids.map(id=>[id,c.operativeState[id].morale]));assert.ok(ids.slice(0,2).every(id=>morale[id]<80&&c.operativeState[id].moraleRestHours===0));let rested=save(c);const waits=[],until=clock(c)+6*3600;
 for(let attempt=0;clock(rested)<until&&attempt<12;attempt++){const action={type:'wait',hours:(until-clock(rested))/3600};waits.push(action);rested=order(rested,action);}
 assert.equal(clock(rested),until);for(const id of ids.slice(0,2)){assert.equal(rested.operativeState[id].morale,morale[id]+1);assert.equal(rested.operativeState[id].assignment,'rest');assert.equal(rested.operativeState[id].moraleRestHours,0);}assert.equal(rested.operativeState[ids[2]].morale,morale[ids[2]]);assert.equal(rested.operativeState[ids[2]].assignment,'active');
 for(const id of ids)for(const key of ['alive','captured','hp','bleeding','medkits','inventory','ammo','carriedLoaded','condition'])assert.deepEqual(rested.operativeState[id][key],c.operativeState[id][key],id+' '+key);assert.equal(rested.resources.treasury,c.resources.treasury);assert.deepEqual(waits.reduce(order,save(c)),save(rested));
 assert.deepEqual(start,before);const repeated=restingClinicRaid();assert.deepEqual(repeated.campaign,start);assert.deepEqual(resolveRestingNorthernClinicDefense(repeated.campaign),result);save(rested);
});

// The same paid movement, retreats and scheduled raid are earned afresh. The
// actual staging resolver keeps its recon controller and excludes deploying
// members from the reserve's post-settlement duty restoration.
test('rescue staging restores a prior resting reserve outside the deploying care cohort and earns six-hour morale recovery',()=>{
 const {campaign:start,ids}=restingClinicRaid(),before=structuredClone(start),deploying=[ids[0],ids[2]],deployingBefore=[...deploying];
 assert.deepEqual(ids.map(id=>start.operativeState[id].assignment),['rest','rest','active']);
 const result=resolveRescueStagingDefense(start,{deploying}),c=result.campaign,settled=result.settledCampaign,reserve=ids[1],careMember=ids[0];
 assert.equal(result.groupId,start.pendingEncounter.groupId);assert.deepEqual(result.priorRestIds,ids.slice(0,2));assert.deepEqual(result.restoredRestIds,[reserve]);
 assert.equal(result.summary.status,'victory');assert.ok(result.summary.turns>=1&&result.summary.actions>0&&result.summary.elapsedSeconds>0);assert.equal(c.pendingEncounter,null);assert.equal(c.pendingBattle,null);assert.equal(c.sectors.cordoba.owner,'patriot');
 assert.ok(c.operativeState[reserve].alive&&c.operativeState[reserve].hp>=15&&!c.operativeState[reserve].bleeding);assert.ok(c.operativeState[careMember].alive);
 assert.ok(ids.every(id=>settled.operativeState[id].assignment==='active'));assert.deepEqual(ids.map(id=>c.operativeState[id].assignment),['active','rest','active']);
 assert.equal(clock(c),clock(settled));assert.equal(c.resources.treasury,settled.resources.treasury);assert.deepEqual(c.contracts,settled.contracts);assert.deepEqual(c.squads,settled.squads);assert.deepEqual(c.sectorStates,settled.sectorStates);
 for(const id of ids)for(const key of ['alive','captured','hp','maxHp','bleeding','bandaged','energy','fatigue','morale','moraleRestHours','location','residentPosition','medkits','inventory','ammo','carriedLoaded','condition','jammed'])assert.deepEqual(c.operativeState[id][key],settled.operativeState[id][key],id+' '+key);
 assert.deepEqual(result.events.map(row=>row.action),[{type:'respondToEncounter',groupId:start.pendingEncounter.groupId,choice:'tactical'},{type:'assignCare',operativeId:reserve,assignment:'rest'}]);
 const restOrders=result.events.filter(row=>row.action.type==='assignCare');assert.deepEqual(restOrders,[{action:{type:'assignCare',operativeId:reserve,assignment:'rest'},hour:settled.hour,second:settled.secondOfHour??0}]);
 assert.deepEqual(restOrders.reduce((campaign,row)=>order(campaign,row.action),save(settled)),c);
 const morale=c.operativeState[reserve].morale,careMorale=c.operativeState[careMember].morale;assert.ok(morale<80&&c.operativeState[reserve].energy>=60);assert.equal(c.operativeState[reserve].moraleRestHours,0);
 let rested=save(c);const waits=[],until=clock(c)+6*3600;
 for(let attempt=0;clock(rested)<until&&attempt<12;attempt++){const action={type:'wait',hours:(until-clock(rested))/3600};waits.push(action);rested=order(rested,action);}
 assert.equal(clock(rested),until);assert.equal(rested.operativeState[reserve].morale,morale+1);assert.equal(rested.operativeState[reserve].moraleRestHours,0);assert.equal(rested.operativeState[reserve].assignment,'rest');
 assert.equal(rested.operativeState[careMember].assignment,'active');assert.equal(rested.operativeState[careMember].morale,careMorale,'A deploying care member is not silently assigned reserve rest.');
 for(const key of ['alive','captured','hp','bleeding','medkits','inventory','ammo','carriedLoaded','condition'])assert.deepEqual(rested.operativeState[reserve][key],c.operativeState[reserve][key],key);assert.equal(rested.resources.treasury,c.resources.treasury);
 assert.deepEqual(waits.reduce(order,save(c)),save(rested));assert.deepEqual(start,before);assert.deepEqual(deploying,deployingBefore);
 const repeated=restingClinicRaid();assert.deepEqual(repeated.campaign,start);assert.deepEqual(resolveRescueStagingDefense(repeated.campaign,{deploying:[repeated.ids[0],repeated.ids[2]]}),result);save(rested);
});
