import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {validateContentPackage,defaultContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {enterSector} from '../game/world.js';
import {actBattle,presentedActBattle,getReachable,climbPreview,lookPreview} from '../game/tactical.js';
import {sameCell,sameSurface,spacePoint} from '../game/tactical-space.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {carriedAmmunition} from '../game/campaign-ammunition.js';
import {fieldAmmunitionByType,unitAmmunitionByType} from '../game/physical-ammunition.js';
import {takeFiniteCache} from './finite-cache-driver.mjs';
import {stageRouteRoofDefenders} from './route-roof-defenders.mjs';
import {prepareCordobaMedicalRear,restageCordobaMedicalRear} from './cordoba-medical-rear-guard.mjs';

const sector='cordoba',clinic='tucuman',clock=c=>c.hour*3600+(c.secondOfHour??0),body=(b,id)=>b.units.find(u=>u.id===String(id));
const order=(c,a)=>{const n=dispatchCampaign(c,a);assert.equal(n.lastError,null,JSON.stringify(a)+': '+n.lastError);return n;};
const saved=pair=>{const n=decodeSave(encodeSave(pair.campaign,pair.battle??null));assert.deepEqual(n,{campaign:pair.campaign,battle:pair.battle??null});return n;};
function step(pair,action){
 const b=actBattle(pair.battle,action);assert.equal(b.lastError,null,JSON.stringify(action)+': '+b.lastError);
 assert.deepEqual(presentedActBattle(pair.battle,action).state,b);assert.deepEqual(actBattle(validateBattleSnapshot(JSON.parse(JSON.stringify(pair.battle))),action),b);
 const n=syncBattleTime(pair.campaign,b);assert.equal(n.error,null);return saved(n);
}
function move(pair,id,destination){
 for(let n=0;!sameCell(body(pair.battle,id),destination)&&n<64;n++){
  const u=body(pair.battle,id),next=getReachable(pair.battle,u,{stopAt:p=>sameCell(p,destination)})[0]?.path[0];assert.ok(next);
  if(!sameSurface(u,next)){const q=climbPreview(pair.battle,u,{linkId:next.linkId});assert.equal(q.valid,true,q.reason);pair=step(pair,{type:'climb',unitId:String(id),linkId:next.linkId});}
  else pair=step(pair,{type:'move',unitId:String(id),...spacePoint(next)});
 }
 assert.ok(sameCell(body(pair.battle,id),destination));return pair;
}
const leave=pair=>order(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});

// Each body, gun, finite cartridge, wound, trap and roof is declared and
// validated before the campaign factory. Ground posts and the corpse are then
// earned with paid Native visits, walking, climbing and a real lethal trap.
function setup({ground=true,nearExpiry=false,raid=false,blocked=false,acute=false,treasury=20000}={}){
 const d=scaffoldDocuments('cordoba-medical-rear-restaging');
 for(const key of ['content','world','maps'])d[key]=JSON.parse(JSON.stringify(d[key]).replaceAll('watch-post',sector).replaceAll('"camp"','"tucuman"').replaceAll('camp:', 'tucuman:'));
 const base=d.content.characters[0];d.content.rules.startingTreasury=treasury;d.content.rules.deploymentCartridges=12;d.content.startingTerritory[sector].owner='patriot';
 d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];d.world.expansion.buildingTargets={[clinic]:0,[sector]:0};d.world.arrivalFacilities[sector]=['barracks'];d.content.arrivalSites.push({sector,facilities:['barracks']});
 d.content.weapons.push({id:'rear-rifle',template:1800,name:'Fusil de la guardia',damage:40,fireAP:25,aimAP:5,reloadAP:40,range:20,readyAP:5,weight:4,price:100,art:base.portrait});
 d.content.characters=Array.from({length:13},(_,i)=>({...structuredClone(base),id:'rear-'+String(i).padStart(2,'0'),name:'Persona '+i,nickname:'Persona '+i,monthlyPay:30,arrivalHours:0,weapon:'rear-rifle',
  attributes:{...base.attributes,maxHp:70,medical:i===7?90:0},startingSupplies:{rations:0,torches:0,medkits:i===7?4:0,boleadoras:0},
  startingCondition:{hp:i===8?40:acute&&i===0?14:70,bleeding:0,bandaged:i===8?30:acute&&i===0?56:0,energy:100,fatigue:0}}));
 d.maps[sector].props=[{id:'earned-casualty',type:'chest',x:4,y:12,footprint:{width:1,height:1},blocksMovement:true}];
 d.maps[sector].upperSurfaces=Array.from({length:24},(_,i)=>({id:'rear-roof-'+i,x:8+i%6,y:5+Math.floor(i/6),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked,cover:25}));
 d.maps[sector].climbLinks=blocked?[]:[{id:'rear-access',kind:'climb',from:{x:8,y:9,tacticalLevel:0},to:{x:8,y:8,tacticalLevel:1}}];
 d.world.physical.environment[sector]={doors:[],containers:[{selector:{type:'chest',id:'earned-casualty'},configuration:{type:'chest',open:false,locked:false,contents:[],trap:{type:'injury',difficulty:100,armed:true,damage:100,breathLoss:0,discoveredBy:[]}}}]};
 d.world.enemyStrategy={version:1,theaters:{frontier:{legHours:1,reserve:raid?3:0,raidEveryHours:raid?1:240,axis:[sector]}}};
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);let c=initialCampaign(42,content);
 const all=rosterFor(c).map(op=>op.id),guards=all.slice(0,6),fallen=all[6],doctor=all[7],patient=all[8],field=all.slice(9),hires=[];
 for(const id of all){const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury;c=order(c,{type:'recruitCivic',id,term:'day',destination:guards.includes(id)||id===fallen?sector:clinic});assert.equal(c.resources.treasury,cash-quote.total);hires.push({id,quote});}
 const clinicHome=c.activeSquadId;
 c=order(c,{type:'createSquad',sector,ids:[fallen],name:'Reconocimiento local'});const home=c.activeSquadId;c=order(c,{type:'visitSector'});let pair=saved({campaign:c,battle:enterSector(c.pendingBattle,c.sectorStates[sector])});
 const chest=pair.battle.props.find(p=>p.id==='earned-casualty'),adjacent=getReachable(pair.battle,body(pair.battle,fallen)).filter(p=>Math.abs(p.x-chest.x)+Math.abs(p.y-chest.y)===1).sort((a,b)=>a.cost-b.cost)[0];assert.ok(adjacent);pair=move(pair,fallen,adjacent);
 if(lookPreview(pair.battle,body(pair.battle,fallen),chest).valid)pair=step(pair,{type:'look',unitId:String(fallen),...spacePoint(chest)});
 pair=step(pair,{type:'useItem',unitId:String(fallen),environment:{kind:'container',id:chest.id,verb:'open'}});assert.equal(body(pair.battle,fallen).hp,0);c=leave(pair);assert.equal(c.operativeState[fallen].alive,false);
 c=order(c,{type:'selectSquad',id:home});c=order(c,{type:'squad',ids:guards.slice(0,2)});
 for(const ids of [guards.slice(2,4),guards.slice(4)])c=order(c,{type:'createSquad',sector,ids,name:'Grupo local'});
 c=order(c,{type:'selectSquad',id:clinicHome});c=order(c,{type:'squad',ids:[doctor,patient]});const selected=c.activeSquadId;
 for(const id of field)c=order(c,{type:'createSquad',sector:clinic,ids:[id],name:'Servicio exterior'});
 assert.equal(c.squads.filter(q=>q.members.length).length,8);
 if(!blocked){
  c=stageRouteRoofDefenders(c,guards.filter(id=>!(acute&&id===guards[0])));
  if(ground)for(const q of c.squads.filter(q=>q.location===sector&&q.members.length)){
   c=order(c,{type:'selectSquad',id:q.id});c=order(c,{type:'visitSector'});pair=saved({campaign:c,battle:enterSector(c.pendingBattle,c.sectorStates[sector])});
   for(const id of q.members.filter(id=>!(acute&&id===guards[0]))){pair=step(pair,{type:'movement',unitId:String(id),movement:'walk'});const target=getReachable(pair.battle,body(pair.battle,id)).filter(p=>(p.tacticalLevel??0)===0&&p.cost>0&&!pair.battle.climbLinks.some(link=>sameCell(p,link.from)||sameCell(p,link.to))).sort((a,b)=>a.cost-b.cost||a.y-b.y||a.x-b.x)[0];assert.ok(target);pair=move(pair,id,target);}
   c=leave(pair);
  }
 }
 for(const id of guards.filter(id=>!(acute&&id===guards[0])))c=order(c,{type:'assignCare',operativeId:id,assignment:'rest'});
 if(nearExpiry){const target=Math.min(...all.filter(id=>id!==fallen).map(id=>contractExpiresSeconds(c.contracts[id])))-1800;for(let n=0;clock(c)<target&&n<32;n++)c=order(c,{type:'advanceStrategicTime',seconds:Math.min(3600,target-clock(c))});assert.equal(clock(c),target);}
 if(raid){
  for(let n=0;!c.enemyGroups.some(g=>g.status==='marching'&&g.target===sector)&&n<3;n++)c=order(c,{type:'wait',hours:1});const group=c.enemyGroups.find(g=>g.status==='marching'&&g.target===sector);assert.ok(group);
  const target=group.arrivalAt*3600-2;for(let n=0;clock(c)<target&&n<12;n++)c=order(c,{type:'advanceStrategicTime',seconds:Math.min(3600,target-clock(c))});assert.equal(clock(c),target);assert.equal(c.pendingEncounter,null);
 }
 c=order(c,{type:'assignCare',operativeId:patient,assignment:'patient'});c=order(c,{type:'assignCare',operativeId:doctor,assignment:'doctor'});c=order(c,{type:'selectSquad',id:selected});
 assert.deepEqual(d,declaration);return {campaign:saved({campaign:c}).campaign,guards,fallen,doctor,patient,field,hires};
}
const run=(c,options={})=>restageCordobaMedicalRear(c,{deadlineSeconds:clock(c)+72*3600,...options});
function replay(start,result){
 let c=start,b=null,shown=null,validated=null;
 for(const [index,row]of result.receipt.orders.entries()){
  assert.equal(clock(c),row.from);
  if(row.kind==='campaign'){
   if(row.action.type==='leaveSector')assert.deepEqual(row.action.sectorState,b);c=order(c,row.action);
   if(row.action.type==='visitSector'){b=enterSector(c.pendingBattle,c.sectorStates[sector]);const n=syncBattleTime(c,b);assert.equal(n.error,null);c=n.campaign;b=n.battle;shown=structuredClone(b);validated=validateBattleSnapshot(JSON.parse(JSON.stringify(b)));}
   if(row.action.type==='leaveSector')b=null;
  }else{
   b=actBattle(b,row.action);assert.equal(b.lastError,null);shown=presentedActBattle(shown,row.action).state;validated=validateBattleSnapshot(JSON.parse(JSON.stringify(actBattle(validated,row.action))));assert.deepEqual(shown,b);assert.deepEqual(validated,b);
   const n=syncBattleTime(c,b);assert.equal(n.error,null);c=n.campaign;b=n.battle;shown=structuredClone(b);validated=validateBattleSnapshot(JSON.parse(JSON.stringify(b)));
  }
  assert.equal(clock(c),row.to);if(index===Math.floor(result.receipt.orders.length/2)){const pair=saved({campaign:c,battle:b});c=pair.campaign;b=pair.battle;}
 }
 assert.deepEqual({campaign:c,battle:b},{campaign:result.campaign,battle:result.battle});saved({campaign:c,battle:b});
}

test('six actual ground survivors regain distinct paid roof posts while eight groups, prior death, finite rifles and the working remote clinic remain authoritative',()=>{
 const s=setup(),start=s.campaign,before=structuredClone(start),r=run(start),c=r.campaign;
 assert.equal(r.receipt.restored,true);assert.equal(r.battle,null);assert.ok(clock(c)>clock(start)&&clock(c)<=r.receipt.until);assert.ok(r.receipt.orders.some(row=>row.action.type==='climb'));
 assert.deepEqual(c.squads,start.squads);assert.equal(c.activeSquadId,start.activeSquadId);assert.deepEqual(c.squad,start.squad);assert.deepEqual(c.recruited,start.recruited);assert.equal(c.resources.treasury,start.resources.treasury);assert.deepEqual(c.contracts,start.contracts);
 for(const id of s.guards){const old=start.operativeState[id],n=c.operativeState[id];assert.equal(old.residentPosition.tacticalLevel??0,0);assert.ok(n.residentPosition.tacticalLevel>0);for(const k of ['alive','hp','medkits','inventory','carriedLoaded','assignment'])assert.deepEqual(n[k],old[k]);assert.ok(contractExpiresSeconds(c.contracts[id])>clock(c));}
 assert.equal(new Set(s.guards.map(id=>JSON.stringify(c.operativeState[id].residentPosition))).size,6);assert.equal(c.operativeState[s.fallen].alive,false);assert.equal(c.operativeState[s.fallen].deathMinute,start.operativeState[s.fallen].deathMinute);
 assert.equal(c.operativeState[s.doctor].assignment,'doctor');assert.equal(c.operativeState[s.patient].assignment,'patient');for(const id of s.field)assert.deepEqual(c.operativeState[id].residentPosition,start.operativeState[id].residentPosition);
 assert.deepEqual(start,before);replay(start,r);assert.deepEqual(run(saved({campaign:start}).campaign),r);
 // Re-entry uses only this successful fresh result. Native resident placement
 // must admit the exact posts actually paid above, with the original six IDs.
 for(const q of c.squads.filter(q=>q.location===sector&&q.members.length)){
  let visit=order(c,{type:'selectSquad',id:q.id});for(const id of q.members)visit=order(visit,{type:'assignCare',operativeId:id,assignment:'active'});visit=order(visit,{type:'visitSector'});
  const b=enterSector(visit.pendingBattle,visit.sectorStates[sector]);for(const id of q.members)assert.ok(sameCell(body(b,id),c.operativeState[id].residentPosition));saved({campaign:visit,battle:b});
 }
});

test('actual near-expiry service is quoted and paid for every current duty before the bounded visit',()=>{
 const s=setup({nearExpiry:true}),r=run(s.campaign);assert.ok(r.receipt.renewals.length>0);assert.equal(r.campaign.resources.treasury,s.campaign.resources.treasury-r.receipt.renewals.reduce((n,row)=>n+row.quote.price,0));
 for(const id of s.campaign.recruited.filter(id=>s.campaign.operativeState[id].alive))assert.ok(contractExpiresSeconds(r.campaign.contracts[id])>r.receipt.until);replay(s.campaign,r);
});

test('already earned roof posts are an exact no-op without extra care time, service payment or visits',()=>{
 const s=setup({ground:false}),r=run(s.campaign);assert.equal(r.campaign,s.campaign);assert.equal(r.battle,null);assert.deepEqual(r.receipt.orders,[]);assert.equal(r.receipt.endSeconds,r.receipt.startSeconds);assert.equal(r.receipt.restored,true);
});

test('unfunded joint current service retains its real paid prefix and refuses before roof movement',()=>{
 const s=setup({nearExpiry:true,treasury:100});let failure;try{run(s.campaign);}catch(e){failure=e;}assert.match(failure?.message??'',/funded current service/);assert.equal(failure.battle,null);const r=failure.cordobaMedicalRearRestaging;
 assert.equal(r.restored,false);assert.ok(r.orders.length>0);assert.ok(r.orders.every(row=>row.action.type==='renewContract'));assert.equal(s.campaign.resources.treasury-failure.campaign.resources.treasury,r.orders.reduce((n,row)=>n+row.cost,0));assert.deepEqual(failure.campaign.squads,s.campaign.squads);JSON.stringify({campaign:failure.campaign,receipt:r});
});

test('an actual acute local survivor refuses before any renewal, visit or movement',()=>{
 const s=setup({acute:true});let failure;try{run(s.campaign);}catch(e){failure=e;}assert.match(failure?.message??'',/acute/);assert.equal(failure.campaign,s.campaign);assert.equal(failure.battle,null);assert.deepEqual(failure.cordobaMedicalRearRestaging.orders,[]);assert.equal(failure.cordobaMedicalRearRestaging.restored,false);JSON.stringify(failure.cordobaMedicalRearRestaging);
});

test('an exhausted original deadline refuses with the unchanged actual pair and no false roof restoration',()=>{
 const s=setup();let failure;try{run(s.campaign,{deadlineSeconds:clock(s.campaign)});}catch(e){failure=e;}assert.match(failure?.message??'',/deadline/);assert.equal(failure.campaign,s.campaign);assert.equal(failure.battle,null);assert.equal(failure.cordobaMedicalRearRestaging.restored,false);assert.deepEqual(failure.cordobaMedicalRearRestaging.orders,[]);
});

test('an inaccessible declared roof retains the accepted visit prefix and exact actual battle without claiming restoration',()=>{
 const s=setup({blocked:true});let failure;try{run(s.campaign);}catch(e){failure=e;}assert.match(failure?.message??'',/reachable vacant roof/);assert.ok(failure.battle);assert.equal(failure.pair.battle,failure.battle);assert.equal(failure.pair.campaign,failure.campaign);assert.ok(failure.campaign.pendingBattle);assert.equal(failure.routeRoofDefenders.restored,false);assert.ok(failure.routeRoofDefenders.orders.some(row=>row.action.type==='visitSector'));assert.ok(failure.battle.units.filter(u=>s.guards.map(String).includes(u.id)).every(u=>(u.tacticalLevel??0)===0));JSON.stringify(failure.routeRoofDefenders);
});

test('a real announced raid stops the paid visit at its accepted prefix without later orders or failed-result re-entry',()=>{
 const s=setup({raid:true});let failure;try{run(s.campaign);}catch(e){failure=e;}assert.match(failure?.message??'',/encounter|contact/i);assert.ok(failure.campaign.pendingEncounter||failure.battle?.mode==='combat');assert.equal(failure.cordobaMedicalRearRestaging.restored,false);assert.equal(failure.pair.campaign,failure.campaign);assert.equal(failure.pair.battle,failure.battle);const rows=failure.cordobaMedicalRearRestaging.orders;assert.ok(rows.length>0);assert.ok(rows.at(-1).to>=rows.at(-1).from);JSON.stringify({campaign:failure.campaign,battle:failure.battle,receipt:failure.cordobaMedicalRearRestaging});
});

// This separate declaration leaves one real paid recruit unbooked. The old
// physician earns the first roof post before that new group can arrive.
function oldPostAndNewRearSetup(){
 const d=scaffoldDocuments('cordoba-rear-post-reservations');
 d.manifest.scenario='granaderos-historical-v1';
 for(const key of ['content','world','maps'])d[key]=JSON.parse(JSON.stringify(d[key]).replaceAll('watch-post',sector));
 const old=Array.from({length:12},(_,i)=>101+i),courier=old[0],owner=old.at(-1),newId=139,base=d.content.characters[0];
 d.content.rules.startingTreasury=20000;d.content.rules.deploymentCartridges=12;d.content.startingTerritory[sector].owner='patriot';d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];
 d.world.expansion.buildingTargets={camp:0,[sector]:0};d.world.arrivalFacilities[sector]=['barracks'];d.content.arrivalSites.push({sector,facilities:['barracks']});
 d.content.weapons.push(structuredClone(defaultContentPackage().weapons.find(w=>w.id==='firearm-1800')));
 d.content.characters=[...old,newId].map(id=>({...structuredClone(base),id:'person-'+id,name:'Guardia '+id,nickname:'Guardia '+id,monthlyPay:30,arrivalHours:0,weapon:'firearm-1800',
  attributes:{...base.attributes,maxHp:80,strength:90,medical:id===courier||id===owner?90:0},startingSupplies:{rations:0,torches:0,boleadoras:0,medkits:2},startingCondition:{hp:80,bleeding:0,bandaged:0,energy:100,fatigue:0}}));
 d.maps[sector].upperSurfaces=Array.from({length:24},(_,i)=>({id:'reserved-rear-roof-'+i,x:8+i%6,y:5+Math.floor(i/6),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:25}));
 d.maps[sector].climbLinks=[{id:'reserved-rear-access',kind:'climb',from:{x:7,y:6,tacticalLevel:0},to:{x:8,y:6,tacticalLevel:1}}];
 const cacheId='reserved-rear-chest',repair={item:'inventory:reserved-rear-repair',kind:'repair-kit',name:'Herramientas',count:1,weight:2,repairPoints:73,instanceId:'reserved-rear-repair'};
 d.maps[sector].props=[{id:cacheId,type:'chest',x:5,y:12,footprint:{width:1,height:1},blocksMovement:true}];
 d.world.physical.caches[sector]={chest:cacheId,contents:[{item:'weapon',weapon:1800,count:1,weight:4,loaded:0,condition:100,jammed:false,instanceId:'reserved-rear-rifle'},{item:'inventory:ammo:musket_75',kind:'ammunition',ammoType:'musket_75',name:'Cartuchos de mosquete',count:24,weight:.04},repair]};
 d.world.enemyStrategy={version:1,theaters:{frontier:{legHours:1,reserve:0,raidEveryHours:240,axis:[sector]}}};
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);let c=initialCampaign(42,content);const paid=[];
 for(const id of old){const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'week'),cash=c.resources.treasury;c=order(c,{type:'recruitCivic',id,term:'week',destination:sector});assert.equal(c.resources.treasury,cash-quote.total);paid.push({id,quote});}
 const homes=[];for(const ids of [old.slice(0,6),old.slice(6)]){c=order(c,{type:'createSquad',sector,ids,name:'Guardia anterior'});homes.push(c.activeSquadId);}
 c=order(c,{type:'selectSquad',id:homes[0]});c=order(c,{type:'visitSector'});let pair=saved({campaign:c,battle:enterSector(c.pendingBattle,c.sectorStates[sector])});pair=takeFiniteCache(pair,courier,[],{cacheId});c=leave(pair);
 const events=[];c=stageRouteRoofDefenders(c,[owner],{report:event=>events.push(event)});const earned=events.find(event=>event.event==='routeRoofDefenders');assert.ok(earned.actions.some(action=>action.type==='move'));assert.ok(c.operativeState[owner].residentPosition.tacticalLevel>0);
 for(const id of old)if(id!==courier)c=order(c,{type:'assignCare',operativeId:id,assignment:id===owner?'doctor':'rest'});
 c=order(c,{type:'selectSquad',id:homes[0]});assert.equal(c.recruited.includes(newId),false);assert.deepEqual(d,declaration);return {campaign:saved({campaign:c}).campaign,old,courier,owner,newId,homes,paid,repair,earned};
}

test('a new paid rear group preserves an earlier physician roof post while its finite recovered rifle and all later posts stay distinct',()=>{
 const s=oldPostAndNewRearSetup(),start=s.campaign,before=structuredClone(start),events=[],oldPost=spacePoint(start.operativeState[s.owner].residentPosition),quote=contractQuote(start,rosterFor(start).find(op=>op.id===s.newId),'day');
 const model=c=>sectorInventoryModel(c,sector,rosterFor(c),s.courier),stacks=c=>model(c).entries.map(row=>JSON.parse(row.expected)),rounds=c=>Object.values(fieldAmmunitionByType(c.sectorStates[sector])).reduce((a,b)=>a+b,0)+c.recruited.reduce((n,id)=>n+Object.values(unitAmmunitionByType(carriedAmmunition(rosterFor(c).find(op=>op.id===id),c.operativeState[id]))).reduce((a,b)=>a+b,0),0)+Object.values(c.ammunitionStores).reduce((n,store)=>n+Object.values(store).reduce((a,b)=>a+b,0),0);
 assert.equal(quote.available,true,quote.reason);assert.equal(stacks(start).find(row=>row.instanceId==='reserved-rear-rifle').count,1);assert.deepEqual(stacks(start).find(row=>row.instanceId===s.repair.instanceId),s.repair);
 const r=prepareCordobaMedicalRear(start,s.courier,{report:event=>events.push(event)}),c=r.campaign,stage=events.find(event=>event.event==='routeRoofDefenders');
 assert.deepEqual(r.receipt.newIds,[s.newId]);assert.deepEqual(r.receipt.relief,[]);assert.equal(r.receipt.hires[0].debited,quote.total);assert.equal(r.receipt.hires[0].arrival.travelHours,0);assert.equal(c.resources.treasury,start.resources.treasury-quote.total);
 assert.deepEqual(stage.reservedPositions,[{id:s.owner,...oldPost}]);assert.ok(stage.actions.some(action=>action.type==='move'));assert.ok(stage.elapsedSeconds>0&&stage.elapsedSeconds<=3600);assert.ok(c.operativeState[s.newId].residentPosition.tacticalLevel>0);assert.ok(!sameCell(c.operativeState[s.newId].residentPosition,oldPost));
 for(const id of s.old){assert.deepEqual(c.operativeState[id].residentPosition,start.operativeState[id].residentPosition);assert.equal(c.operativeState[id].assignment,start.operativeState[id].assignment);assert.deepEqual(c.contracts[id],start.contracts[id]);for(const key of ['hp','bleeding','bandaged','medkits','alive','captured'])assert.deepEqual(c.operativeState[id][key],start.operativeState[id][key]);}
 for(const home of start.squads)assert.deepEqual(c.squads.find(q=>q.id===home.id),home);assert.equal(c.activeSquadId,start.activeSquadId);assert.deepEqual(c.squad,start.squad);assert.equal(c.recruited.length,13);assert.equal(c.contracts[s.newId].paid,quote.price);assert.equal(c.operativeState[s.newId].assignment,'rest');assert.equal(c.operativeState[s.newId].weaponInstanceId,'reserved-rear-rifle');assert.equal(rounds(c),rounds(start)+12);
 assert.equal(stacks(c).some(row=>row.instanceId==='reserved-rear-rifle'),false);assert.deepEqual(stacks(c).find(row=>row.instanceId===s.repair.instanceId),s.repair);assert.deepEqual(start,before);saved({campaign:c});assert.deepEqual(prepareCordobaMedicalRear(saved({campaign:start}).campaign,s.courier),r);
 const restored=restageCordobaMedicalRear(c,{deadlineSeconds:clock(c)+3600,preserveGroundCrew:true});assert.equal(restored.receipt.restored,true);assert.ok(clock(restored.campaign)<=clock(c)+3600);assert.deepEqual(restored.campaign.operativeState[s.owner].residentPosition,c.operativeState[s.owner].residentPosition);assert.deepEqual(restored.campaign.operativeState[s.newId].residentPosition,c.operativeState[s.newId].residentPosition);
 assert.equal(new Set(restored.campaign.recruited.map(id=>JSON.stringify(restored.campaign.operativeState[id].residentPosition))).size,13);assert.deepEqual(restored.campaign.squads,c.squads);assert.equal(rounds(restored.campaign),rounds(c));assert.equal(restored.campaign.resources.treasury,c.resources.treasury);replay(c,restored);
});
