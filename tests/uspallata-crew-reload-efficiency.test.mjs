import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {DEFAULT_WORLD} from '../campaigns/default.js';
import {mapLibrary} from '../game/map-library.js';
import {blankMap} from '../game/map-schema.js';
import {contractQuote} from '../game/contracts.js';
import {createBattle,actBattle,presentedActBattle,endTurn,presentedEndTurn,artilleryCosts,artilleryReloadPreview,artilleryCrewPlan,artilleryShotTrace,artilleryContact,interruptAvailable,medicalUsePreview,lookPreview,getReachable} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {sectorDeploymentAction,sectorDeploymentModel} from '../game/sector-deployment.js';
import {sameCell,spacePoint} from '../game/tactical-space.js';
import {depotSelection} from '../game/artillery-transport.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {syncBattleTime,COMBAT_ROUND_SECONDS} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {createdUspallataBattery} from './created-uspallata-battery.mjs';
import {takeFiniteCache} from './finite-cache-driver.mjs';

const ids=[100,126,118,138,135,132,143,0],unit=(b,id)=>b.units.find(u=>u.id===String(id)),heavy=b=>b.artillery.find(g=>g.type==='field8');
const load=(b,id)=>({type:'artilleryReload',unitId:String(id),artilleryId:heavy(b).id});
const fire=(b,id)=>({type:'artillery',unitId:String(id),artilleryId:heavy(b).id,x:22,y:3,mode:'solid'});
const native=(b,a)=>['placeDeployment','confirmDeployment'].includes(a.type)?sectorDeploymentAction(b,a):a.type==='endTurn'?endTurn(b):actBattle(b,a);
function replay(start,orders){
 let direct=structuredClone(start),shown=structuredClone(start),stored=validateBattleSnapshot(JSON.parse(JSON.stringify(start)));
 for(const action of orders){
  const input=direct,before=structuredClone(input);direct=native(input,action);assert.equal(direct.lastError,null,JSON.stringify(action));assert.deepEqual(input,before);
  shown=action.type==='endTurn'?presentedEndTurn(shown).state:presentedActBattle(shown,JSON.parse(JSON.stringify(action))).state;
  stored=validateBattleSnapshot(JSON.parse(JSON.stringify(native(stored,JSON.parse(JSON.stringify(action))))));
  assert.deepEqual(shown,direct);assert.deepEqual(stored,direct);
 }
 return direct;
}

// Current source profiles are read without changing their skills or traits.
// Geometry, finite guns/gear, wounds and initial component conditions below
// precede the tactical factory; subsequent AP, work and time are Native only.
function arena({expertProne=false,expertAway=false,offRole=false,care=false,empty=false}={}){
 const content=defaultContentPackage();assert.deepEqual(validateContentPackage(content),[]);
 const profiles=rosterFor(initialCampaign(8,content)),positions=[[8,7],[7,8],[7,7],[14,7],[12,12],[3,12],[4,12],[5,12]];
 const players=ids.map((id,i)=>{
  const source=profiles.find(op=>op.id===id);assert.ok(source);
  return {...structuredClone(source),id:String(id),x:expertAway&&id===118?3:offRole&&id===135?8:positions[i][0],y:offRole&&id===135?9:positions[i][1],
   hp:care&&id===100?30:source.maxHp,maxHp:source.maxHp,bleeding:care&&id===100?1:0,bandaged:0,
   energy:88,fatigue:12,poncho:true,morale:90,loaded:1,ammo:10,medkits:id===135?3:2,activeSlot:care&&id===118?'medical':'primary',
   stance:expertProne&&id===118?'prone':'standing',movementMode:expertProne&&id===118?'prone':'walk',facing:2};
 });
 const options={id:'declared-efficient-heavy-crew',width:40,height:20,biome:'mountain',hour:12,seed:45,
  tiles:Array.from({length:800},(_,i)=>({x:i%40,y:Math.floor(i/40),type:'grass',blocked:false,cover:0})),
  enemies:[{id:'distant-observer',name:'Observador distante',x:37,y:17,hp:100,maxHp:100,weapon:0,blade:0,ammo:0,loaded:0,patrol:false,overwatch:false}],
  artillery:[{id:'heavy',type:'field8',side:'player',x:8,y:8,loaded:!empty,ammo:6},{id:'small',type:'swivel',side:'player',x:14,y:8,loaded:true,ammo:6}]};
 const declaration=structuredClone({players,options}),battle=createBattle(players,options);assert.deepEqual({players,options},declaration);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(battle))),battle);
 const helper=createdUspallataBattery(battle);assert.deepEqual(helper.roles.crews.find(row=>row.gunId==='heavy').ids,['100','126','118']);assert.equal(helper.roles.physicianId,'135');return {battle,helper};
}
function unchangedPeople(before,after){
 for(const old of before.units.filter(u=>u.side==='player')){
  const actual=unit(after,old.id);for(const key of ['x','y','tacticalLevel','hp','maxHp','bleeding','energy','fatigue','stance','movementMode','loaded','ammo','weapon','medkits'])assert.deepEqual(actual[key],old[key],old.id+': '+key);
 }
}
function coupled(before,after,quote){
 for(const old of before.units.filter(u=>u.side==='player'))assert.equal(old.ap-unit(after,old.id).ap,quote.crew.includes(old.id)?quote.pa:0,old.id+' pays only its actual Native crew debit');
}

test('the actual specialist initiates coupled work and retains a payable second-turn heavy shot',()=>{
 const {battle:start,helper}=arena(),before=structuredClone(start),first=fire(start,118),spent=replay(start,[first]);assert.equal(heavy(spent).loaded,false);assert.equal(artilleryCosts(spent,unit(spent,118),heavy(spent)).reload,59);assert.equal(artilleryCosts(spent,unit(spent,126),heavy(spent)).reload,81);
 assert.equal(helper.controller(spent,unit(spent,126)),null);assert.equal(helper.controller(spent,unit(spent,100)),null);
 const action=helper.controller(spent,unit(spent,118));assert.deepEqual(action,load(spent,118));const q=artilleryReloadPreview(spent,unit(spent,118),heavy(spent));assert.equal(q.valid,true);assert.equal(q.partial,true);
 const partial=replay(spent,[action]);coupled(spent,partial,q);unchangedPeople(spent,partial);assert.equal(heavy(partial).reloadProgress,q.progress);assert.equal(heavy(partial).ammo,6);
 const round=replay(partial,[{type:'endTurn'}]);assert.equal(round.turn,2);assert.equal(round.phase,'player');assert.equal(round.mode,'combat');
 const finish=helper.controller(round,unit(round,118));assert.deepEqual(finish,load(round,118));const finishQuote=artilleryReloadPreview(round,unit(round,118),heavy(round)),loaded=replay(round,[finish]);coupled(round,loaded,finishQuote);assert.equal(heavy(loaded).loaded,true);assert.equal(heavy(loaded).ammo,5);
 const cost=artilleryCosts(loaded,unit(loaded,118),heavy(loaded)).fire,crew=artilleryCrewPlan(loaded,unit(loaded,118),heavy(loaded),cost);assert.equal(crew.reason,null);assert.deepEqual(new Set(crew.crew),new Set(['100','126','118']));
 const second=fire(loaded,118),after=replay(loaded,[second]);for(const id of crew.crew)assert.equal(unit(after,id).ap,unit(loaded,id).ap-cost);assert.equal(heavy(after).loaded,false);assert.equal(heavy(after).ammo,5);assert.equal(after.turn,2);
 assert.deepEqual(replay(start,[first,action,{type:'endTurn'},finish,second]),after);unchangedPeople(start,after);assert.equal(after.elapsedSeconds,2*COMBAT_ROUND_SECONDS);assert.deepEqual(start,before);
});

test('the previous real low-rate initiator leaves the same fresh crew short of a second-turn shot',()=>{
 const {battle:start}=arena(),before=structuredClone(start),first=fire(start,118),spent=replay(start,[first]),slow=load(spent,126),q=artilleryReloadPreview(spent,unit(spent,126),heavy(spent));assert.equal(q.valid,true);assert.equal(q.rate,81);
 const partial=replay(spent,[slow]);coupled(spent,partial,q);const round=replay(partial,[{type:'endTurn'}]),finish=load(round,118),finishQuote=artilleryReloadPreview(round,unit(round,118),heavy(round)),after=replay(round,[finish]);coupled(round,after,finishQuote);assert.equal(heavy(after).loaded,true);assert.equal(heavy(after).ammo,5);
 assert.ok(artilleryCrewPlan(after,unit(after,118),heavy(after),artilleryCosts(after,unit(after,118),heavy(after)).fire).reason);assert.deepEqual(replay(start,[first,slow,{type:'endTurn'},finish]),after);unchangedPeople(start,after);assert.deepEqual(start,before);
});

test('a specialist below the existing callback floor permits the next actually actable fixed initiator',()=>{
 const {battle:start,helper}=arena(),orders=[fire(start,118)];let b=replay(start,orders);
 for(let n=0;n<4;n++){const actor=unit(b,118),action={type:'look',unitId:actor.id,x:n%2?20:0,y:actor.y},q=lookPreview(b,actor,action);assert.equal(q.valid,true);assert.equal(q.pa,8);b=replay(b,[action]);orders.push(action);}
 assert.equal(unit(b,118).ap,2);assert.equal(interruptAvailable(b,unit(b,118)),true);assert.equal(artilleryReloadPreview(b,unit(b,118),heavy(b)).valid,true,'The specialist can still assist but openingControlWindow will not call it below 3 AP.');
 const before=structuredClone(b),action=helper.controller(b,unit(b,100));assert.deepEqual(action,load(b,100));assert.equal(helper.controller(b,unit(b,126)),null);const q=artilleryReloadPreview(b,unit(b,100),heavy(b)),after=replay(b,[action]);assert.equal(q.pa,2);coupled(b,after,q);assert.deepEqual(new Set(q.crew),new Set(['100','126','118']));unchangedPeople(b,after);assert.deepEqual(replay(start,[...orders,action]),after);assert.deepEqual(b,before);
});

test('a genuinely missing or prone fixed helper cannot borrow a physician to admit a load',()=>{
 for(const options of [{expertAway:true},{expertProne:true}]){
  const {battle:start,helper}=arena({...options,empty:true}),before=structuredClone(start),gun=heavy(start);
  assert.equal(artilleryReloadPreview(start,unit(start,100),gun).valid,false);
  for(const id of [100,126])assert.notEqual(helper.controller(start,unit(start,id))?.type,'artilleryReload');
  assert.deepEqual(start,before);
 }
});

test('the full actual Native body set cannot be filtered to conceal an off-role helper',()=>{
 const {battle:start,helper}=arena({offRole:true,empty:true}),before=structuredClone(start),plan=artilleryReloadPreview(start,unit(start,118),heavy(start));assert.equal(plan.valid,true);assert.ok(plan.crew.includes('135'));
 for(const id of [100,126,118])assert.notEqual(helper.controller(start,unit(start,id))?.type,'artilleryReload');assert.deepEqual(start,before);
});

test('actual adjacent finite aid retains priority over an expert reload reservation',()=>{
 const {battle:start,helper}=arena({care:true}),before=structuredClone(start),doctor=unit(start,118),patient=unit(start,100),q=medicalUsePreview(start,doctor,patient);assert.equal(q.allowed,true);
 const action=helper.controller(start,doctor);assert.deepEqual(action,{type:'useItem',unitId:doctor.id,targetId:patient.id});const after=replay(start,[action]);assert.equal(unit(after,118).medkits,doctor.medkits-q.treatment.dressingsUsed);assert.equal(unit(after,118).ap,doctor.ap-q.cost);assert.equal(unit(after,100).bleeding,q.treatment.bleedingAfter);assert.deepEqual(after.artillery,start.artillery);assert.deepEqual(start,before);
});

test('real paid service and an actual declared finite arsenal retain coupled work through unchanged Native request, deployment and official save',()=>{
 const content=defaultContentPackage(),paid=[100,126,118,138,135,132,143,134],cacheId='declared-crew-proof-arsenal';content.headquarters='buenos_aires';content.startingTerritory.buenos_aires={owner:'patriot',loyalty:65};content.rules.startingTreasury=300000;
 content.world=structuredClone(DEFAULT_WORLD);content.maps=structuredClone(mapLibrary(content));
 for(const at of ['buenos_aires','san_nicolas']){const map=blankMap({id:at,title:at,width:20,height:16});map.spawns=[{id:'crew-arrival',x:18,y:8,side:'player'},{id:'opposition',x:1,y:8,side:'enemy'}];content.maps[at]=map;content.world.expansion.buildingTargets[at]=0;}
 content.maps.buenos_aires.props.push({id:cacheId,type:'chest',x:16,y:6,footprint:{width:1,height:1},blocksMovement:true});
 content.world.physical.caches.buenos_aires={chest:cacheId,contents:[]};content.world.physical.arsenals.buenos_aires={version:1,sector:'buenos_aires',chest:cacheId,pieces:[{id:'arsenal:crew-proof:heavy',type:'field8',side:'player',loaded:true,ammo:6},{id:'arsenal:crew-proof:small',type:'swivel',side:'player',loaded:true,ammo:6}]};
 assert.deepEqual(validateContentPackage(content),[]);const declaration=structuredClone(content);
 let c=initialCampaign(8,content);const order=action=>{const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);c=next;};
 for(const id of paid){const q=contractQuote(c,rosterFor(c).find(op=>op.id===id),'week'),cash=c.resources.treasury;assert.equal(q.available,true);order({type:'recruitCivic',id,term:'week',destination:'buenos_aires'});assert.equal(cash-c.resources.treasury,q.total);}
 order({type:'createSquad',sector:'buenos_aires',name:'Dotación de prueba',ids:paid.slice(0,6)});const main=c.activeSquadId;order({type:'createSquad',sector:'buenos_aires',name:'Pantalla de prueba',ids:paid.slice(6)});const support=c.activeSquadId;
 order({type:'selectSquad',id:main});order({type:'visitSector'});let pair=syncBattleTime(c,enterSector(c.pendingBattle,c.sectorStates.buenos_aires));assert.equal(pair.error,null);pair=takeFiniteCache(pair,118,[],{cacheId});c=pair.campaign;assert.equal(pair.battle.artillery.length,2);
 order({type:'leaveSector',battleId:c.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});
 const recovered=c.sectorStates.buenos_aires.artillery.map(g=>({id:g.id,ammo:g.ammo,loaded:g.loaded}));for(const gun of recovered)order({type:'storeArtillery',sector:'buenos_aires',artilleryId:gun.id});assert.deepEqual(c.artilleryDepots.buenos_aires.map(g=>({id:g.id,ammo:g.ammo,loaded:g.loaded})),recovered);
 order({type:'configureArtillery',types:c.artilleryDepots.buenos_aires.map(depotSelection)});order({type:'transport',mode:'posta'});
 for(const id of [main,support]){order({type:'selectSquad',id});order({type:'attack',sector:'san_nicolas',mode:'posta',queue:true});}
 for(let n=0;![main,support].every(id=>c.squads.find(q=>q.id===id).journey?.status==='ready')&&n<24;n++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 order({type:'beginAssault',sector:'san_nicolas'});const request=structuredClone(c.pendingBattle);assert.equal(request.squad.length,8);assert.equal(request.artillery.length,2);assert.deepEqual(request.artillery.map(g=>({id:g.id,ammo:g.ammo,loaded:g.loaded})).sort((a,b)=>a.id.localeCompare(b.id)),recovered.sort((a,b)=>a.id.localeCompare(b.id)));
 pair=syncBattleTime(c,enterSector(c.pendingBattle,c.sectorStates.san_nicolas,{placement:true}));assert.equal(pair.error,null);pair=decodeSave(encodeSave(pair.campaign,pair.battle));const initial=structuredClone(pair),helper=createdUspallataBattery(pair.battle),tape=[],model=sectorDeploymentModel(pair.battle),occupied=new Set(pair.battle.artillery.map(g=>g.x+','+g.y));let next=pair.battle;
 // This integration control proves legal generic arrival/custody and codec
 // work. It does not claim the Uspallata-specific deploy fits another map.
 const roleIds=helper.roles.crews.flatMap(row=>row.ids),others=next.units.filter(u=>u.side==='player'&&!roleIds.includes(u.id)).map(u=>u.id);
 for(const id of [...roleIds,...others]){
  const row=model.units.find(u=>u.id===id),crew=helper.roles.crews.find(row=>row.ids.includes(id)),gun=crew&&next.artillery.find(g=>g.id===crew.gunId),distance=p=>gun?Math.hypot(p.x-gun.x,p.y-gun.y):Math.min(...next.artillery.map(g=>Math.hypot(p.x-g.x,p.y-g.y))),cells=model.entryCells[row.edge].filter(p=>!occupied.has(p.x+','+p.y)&&(!gun?distance(p)>3:true)).sort((a,b)=>distance(a)-distance(b)||a.y-b.y||a.x-b.x),point=cells[0];assert.ok(point);
  const action={type:'placeDeployment',unitIds:[id],x:point.x,y:point.y};next=replay(next,[action]);tape.push(action);occupied.add(point.x+','+point.y);
 }
 const confirm={type:'confirmDeployment'};next=replay(next,[confirm]);tape.push(confirm);
 for(const crew of helper.roles.crews)for(const id of crew.ids){
  for(let n=0;!artilleryContact(next,unit(next,id),next.artillery.find(g=>g.id===crew.gunId))&&n<12;n++){
   const actor=unit(next,id),gun=next.artillery.find(g=>g.id===crew.gunId),route=getReachable(next,actor).filter(point=>point.path.length&&Math.hypot(point.x-gun.x,point.y-gun.y)<=1.5).sort((a,b)=>a.cost-b.cost||a.y-b.y||a.x-b.x)[0];assert.ok(route,'The real generic arrival must pay a legal route into its fixed gun contact.');const previous=spacePoint(actor),action={type:'move',unitId:id,...spacePoint(route.path[0])};next=replay(next,[action]);tape.push(action);assert.equal(sameCell(unit(next,id),previous),false);
  }
  assert.equal(artilleryContact(next,unit(next,id),next.artillery.find(g=>g.id===crew.gunId)),true);
 }
 for(let n=0;n<4&&Math.hypot(...['x','y'].map(key=>next.artillery[0][key]-next.artillery[1][key]))<3;n++){const id=helper.roles.crews.find(row=>row.gunId===next.artillery.find(g=>g.type==='swivel').id).ids[0],action=helper.controller(next,unit(next,id));assert.equal(action?.type,'artilleryMove');next=replay(next,[action]);tape.push(action);}
 const gun=heavy(next),expert=unit(next,118),point=next.tiles.find(point=>Math.hypot(point.x-gun.x,point.y-gun.y)>=8&&Math.hypot(point.x-gun.x,point.y-gun.y)<=20&&!artilleryShotTrace(next,expert,gun,point,'solid').events.some(hit=>hit.type==='impact'&&(hit.victimKind==='npc'||next.units.find(u=>u.id===hit.unitId)?.side==='player')));assert.ok(point);
 if(Number.isFinite(gun.facing)&&Math.abs(Math.atan2(Math.sin(Math.atan2(point.y-gun.y,point.x-gun.x)-gun.facing),Math.cos(Math.atan2(point.y-gun.y,point.x-gun.x)-gun.facing)))>Math.PI/4){const pivot={type:'artilleryPivot',unitId:expert.id,artilleryId:gun.id,x:point.x,y:point.y};next=replay(next,[pivot]);tape.push(pivot);}
 const shot={type:'artillery',unitId:expert.id,artilleryId:gun.id,x:point.x,y:point.y,mode:'solid'};next=replay(next,[shot]);tape.push(shot);
 const beforeLoad=next,loading=artilleryReloadPreview(beforeLoad,unit(beforeLoad,118),heavy(beforeLoad));assert.equal(loading.valid,true,loading.reason);const action=helper.controller(beforeLoad,unit(beforeLoad,118));assert.deepEqual(action,load(beforeLoad,118));next=replay(beforeLoad,[action]);tape.push(action);
 assert.equal(heavy(next).loaded,loading.rounds>0);assert.equal(heavy(next).reloadProgress,loading.rounds?undefined:loading.progress);assert.equal(heavy(next).ammo,heavy(beforeLoad).ammo-loading.rounds);
 for(const actor of beforeLoad.units.filter(u=>u.side==='player'))assert.equal(actor.ap-unit(next,actor.id).ap,beforeLoad.mode==='exploration'?0:loading.crew.includes(actor.id)?loading.pa:0);
 const actual=syncBattleTime(pair.campaign,next);assert.equal(actual.error,null);const restored=decodeSave(encodeSave(actual.campaign,actual.battle));assert.deepEqual(restored,{campaign:actual.campaign,battle:actual.battle});
 const repeated=syncBattleTime(initial.campaign,replay(initial.battle,tape));assert.equal(repeated.error,null);assert.deepEqual(restored,{campaign:repeated.campaign,battle:repeated.battle});assert.equal(heavy(restored.battle).ammo+Number(heavy(restored.battle).loaded),heavy(initial.battle).ammo+Number(heavy(initial.battle).loaded)-1);assert.deepEqual(pair,initial);assert.deepEqual(content,declaration);assert.deepEqual(c.pendingBattle,request);
});
