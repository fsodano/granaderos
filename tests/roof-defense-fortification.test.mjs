import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {validateContentPackage} from '../game/content-package.js';
import {operativeIdForCharacter} from '../game/content-character-ids.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {prepareCampaignBattle} from '../game/battle-handoff.js';
import {actBattle,presentedActBattle,getReachable,climbPreview} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {surfaceAt,sameCell,spacePoint,tacticalLevel} from '../game/tactical-space.js';
import {concealmentAt} from '../game/projectile-cover.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';

const SEED=42,SECTOR='watch-post';
const clock=c=>c.hour*3600+(c.secondOfHour??0);
const save=pair=>decodeSave(encodeSave(pair.campaign,pair.battle??null));
const unit=(b,id)=>b.units.find(u=>u.id===String(id));
const body=u=>Object.fromEntries(['hp','maxHp','bleeding','bandaged','weapon','blade','loaded','ammo','medkits','rations','inventory','condition','bladeCondition'].map(key=>[key,structuredClone(u[key])]));

function contentFor({roofCover=0,groundCover=0}={}){
 const docs=scaffoldDocuments('roof-defense-fixture'),base=docs.content.characters[0];
 // All people, terrain, cover and finite enemy reserves are declared before
 // package validation and the campaign factory. No returned body is patched.
 docs.content.characters=[{...structuredClone(base),id:'roof-guard',name:'Guardia de azotea',nickname:'Azotea'},
  {...structuredClone(base),id:'ground-guard',name:'Guardia de patio',nickname:'Patio'}];
 docs.content.startingTerritory[SECTOR]={owner:'patriot',loyalty:65};
 docs.content.arrivalSites.push({sector:SECTOR,facilities:['barracks']});
 docs.world.arrivalFacilities[SECTOR]=['barracks'];
 docs.content.campaignStory.chapters[0].conditions=[{type:'day',min:1000,max:null}];
 docs.world.enemyStrategy={version:1,theaters:{frontier:{legHours:1,reserve:3,raidEveryHours:4,axis:[SECTOR]}}};
 const map=docs.maps[SECTOR];
 for(const tile of map.terrain)tile.cover=groundCover;
 map.spawns=[{id:'entry',x:3,y:8,side:'player'},{id:'opposition',x:16,y:8,side:'enemy'}];
 map.upperSurfaces=Array.from({length:16},(_,i)=>({id:`roof:${i}`,x:4+i%4,y:6+Math.floor(i/4),tacticalLevel:1,
  elevation:3,slabThickness:.2,type:'floor',kind:'platform',blocked:false,cover:roofCover,material:'wood'}));
 map.climbLinks=[{id:'roof-access',kind:'climb',from:{x:3,y:6,tacticalLevel:0},to:{x:4,y:6,tacticalLevel:1}}];
 const content=compileCampaignPackage(docs.manifest,docs);
 assert.deepEqual(validateContentPackage(content),[]);
 return content;
}

function staged(options={}){
 const content=contentFor(options),campaignStart=initialCampaign(SEED,content),ids=['roof-guard','ground-guard'].map(id=>operativeIdForCharacter(content,id));
 let campaign=campaignStart,battle=null;const orders=[],moves=[];
 const order=action=>{
  const before=structuredClone(campaign),next=dispatchCampaign(campaign,action);
  assert.equal(next.lastError,null,`${action.type}: ${next.lastError}`);assert.deepEqual(campaign,before);
  orders.push({action:structuredClone(action),cost:campaign.resources.treasury-next.resources.treasury,from:clock(campaign),to:clock(next)});campaign=next;
 };
 for(const id of ids){
  const quote=contractQuote(campaign,rosterFor(campaign).find(op=>op.id===id),'day');assert.equal(quote.available,true,quote.reason);assert.ok(quote.total>0);assert.equal(quote.total,quote.daily);
  order({type:'recruitCivic',id,term:'day',destination:SECTOR});assert.equal(orders.at(-1).cost,quote.total);
  assert.ok(campaign.recruited.includes(id));assert.equal(campaign.operativeState[id].location,SECTOR);
 }
 order({type:'createSquad',name:'Guardia local',ids,sector:SECTOR});
 const home=campaign.squads.find(q=>q.location===SECTOR&&ids.every(id=>q.members.includes(id)));assert.ok(home);
 order({type:'selectSquad',id:home.id});order({type:'visitSector'});
 let pair=prepareCampaignBattle(campaign);assert.equal(pair.error,null);({campaign,battle}=pair);
 const initialPair=save({campaign,battle}),link=battle.climbLinks.find(l=>l.id==='roof-access');assert.ok(link);assert.equal(battle.mode,'exploration');
 const act=action=>{
  const before=structuredClone(battle),direct=actBattle(battle,action),presented=presentedActBattle(battle,action).state;
  assert.equal(direct.lastError,null,JSON.stringify(action)+': '+direct.lastError);assert.deepEqual(direct,presented);assert.deepEqual(battle,before);
  validateBattleSnapshot(direct,campaign.pendingBattle);moves.push(action);
  pair=syncBattleTime(campaign,direct);assert.equal(pair.error,null);({campaign,battle}=pair);
 };
 const actor=unit(battle,ids[0]),point=getReachable(battle,actor,{stopAt:p=>sameCell(p,link.from)})[0];assert.ok(point?.cost>0);
 act({type:'move',unitId:actor.id,...spacePoint(point)});
 const quote=climbPreview(battle,unit(battle,ids[0]),{linkId:link.id});assert.equal(quote.valid,true,quote.reason);
 const before=unit(battle,ids[0]);act({type:'climb',unitId:before.id,linkId:link.id});
 assert.equal(unit(battle,ids[0]).energy,before.energy-quote.energy);assert.ok(sameCell(unit(battle,ids[0]),quote.destination));
 assert.ok(clock(campaign)>clock(initialPair.campaign));assert.equal(tacticalLevel(unit(battle,ids[1])),0);
 // Re-execute only this fresh successful setup tape from its own genuine pair.
 let repeated=initialPair;
 for(const action of moves){const b=actBattle(repeated.battle,action);assert.equal(b.lastError,null);const s=syncBattleTime(repeated.campaign,b);assert.equal(s.error,null);repeated={campaign:s.campaign,battle:s.battle};}
 assert.deepEqual(repeated,{campaign,battle});
 const posts=ids.map(id=>spacePoint(unit(battle,id))),bodies=ids.map(id=>body(unit(battle,id)));
 order({type:'leaveSector',battleId:campaign.pendingBattle.id,sectorState:battle,survivors:battle.units.filter(u=>u.side==='player')});battle=null;
 assert.equal(campaign.pendingBattle,null);for(let i=0;i<ids.length;i++)assert.ok(sameCell(campaign.operativeState[ids[i]].residentPosition,posts[i]));
 for(const id of ids)assert.ok(contractExpiresSeconds(campaign.contracts[id])>clock(campaign)+5*3600,'Actual paid service covers the five-hour raid horizon plus all real setup seconds.');
 assert.deepEqual(save({campaign}).campaign,campaign);
 return {campaign,ids,posts,bodies,orders,order,get current(){return campaign;}};
}

function raid(options={}){
 const setup=staged(options),{ids,posts,bodies,orders,order}=setup,level=options.level??3;
 const before=setup.current,cash=before.resources.treasury,time=clock(before),properties=ids.map(id=>body(before.operativeState[id]));
 for(let n=0;n<level;n++){
  order({type:'fortify',sector:SECTOR});assert.equal(orders.at(-1).cost,150);assert.equal(orders.at(-1).from,orders.at(-1).to);
 }
 assert.equal(setup.current.resources.treasury,cash-level*150);assert.equal(clock(setup.current),time);assert.equal(setup.current.sectors[SECTOR].fort,level);
 assert.deepEqual(ids.map(id=>body(setup.current.operativeState[id])),properties);
 order({type:'wait',hours:8});let campaign=setup.current;
 assert.equal(campaign.pendingEncounter.sector,SECTOR);assert.equal(campaign.hour,5);assert.equal(campaign.enemyGroups.length,1);assert.equal(campaign.enemyReserves.remaining.frontier,0);
 order({type:'respondToEncounter',groupId:campaign.pendingEncounter.groupId,choice:'tactical'});campaign=setup.current;
 const request=campaign.pendingBattle;assert.equal(request.defenseFort,level);assert.equal(request.enemies.length,3);assert.deepEqual(request.squad.map(u=>Number(u.id)).sort((a,b)=>a-b),[...ids].sort((a,b)=>a-b));
 const previous=structuredClone(campaign.sectorStates[SECTOR]),beforeEntry=structuredClone(campaign),pair=prepareCampaignBattle(campaign);assert.equal(pair.error,null);
 assert.deepEqual(campaign,beforeEntry);assert.deepEqual(campaign.sectorStates[SECTOR],previous);
 const battle=pair.battle;assert.equal(battle.units.filter(u=>u.side==='enemy'&&u.hp>0).length,3);
 for(let i=0;i<ids.length;i++){
  assert.ok(sameCell(unit(battle,ids[i]),posts[i]));assert.deepEqual(body(unit(battle,ids[i])),bodies[i]);
 }
 validateBattleSnapshot(battle,request);assert.deepEqual(save(pair),{campaign:pair.campaign,battle});
 return {...pair,request,ids,posts,previous,orders};
}

test('three paid fortification levels protect the real roof and ground defenders in a scheduled raid',()=>{
 const pair=raid(),{battle,ids,previous}=pair,roof=unit(battle,ids[0]),ground=unit(battle,ids[1]);
 assert.equal(tacticalLevel(roof),1);assert.equal(tacticalLevel(ground),0);
 for(const actor of [roof,ground]){assert.equal(surfaceAt(previous,actor).cover,0);assert.equal(surfaceAt(battle,actor).cover,30);assert.equal(concealmentAt(battle,actor),30);}
 const under={x:roof.x,y:roof.y,tacticalLevel:0};assert.equal(surfaceAt(battle,under).cover,surfaceAt(previous,under).cover);assert.equal(surfaceAt(battle,under).cover,0,'roof cover must not be written to the unrelated ground below');
 assert.deepEqual(battle.artillery,previous.artillery);assert.deepEqual(battle.groundItems,previous.groundItems);
 const own=new Set(ids.map(String)),unoccupied=battle.upperSurfaces.filter(p=>!battle.units.some(u=>own.has(u.id)&&sameCell(u,p)));assert.ok(unoccupied.length>0);for(const point of unoccupied)assert.equal(point.cover,surfaceAt(previous,point).cover);
});

test('an unfortified scheduled defense keeps both original surfaces and the same finite people',()=>{
 const {battle,ids,previous,orders}=raid({level:0});assert.ok(!orders.some(row=>row.action.type==='fortify'));
 for(const id of ids){const actor=unit(battle,id);assert.equal(surfaceAt(battle,actor).cover,0);assert.deepEqual(surfaceAt(battle,actor),surfaceAt(previous,actor));}
 assert.equal(battle.units.filter(u=>u.side==='player').length,2);
});

test('each paid level uses its existing ten-point cover bound and preserves stronger authored roof and ground cover',()=>{
 for(const level of [1,2]){
  const {battle,ids}=raid({level});for(const id of ids)assert.equal(surfaceAt(battle,unit(battle,id)).cover,level*10);
 }
 const {battle,ids}=raid({level:3,roofCover:45,groundCover:40});assert.equal(surfaceAt(battle,unit(battle,ids[0])).cover,45);assert.equal(surfaceAt(battle,unit(battle,ids[1])).cover,40);
});

test('official paired saves and real sector reentry retain paid roof cover without coating the floor below',()=>{
 const pair=raid(),loaded=save(pair),before=structuredClone(loaded),again=enterSector(loaded.campaign.pendingBattle,loaded.battle);
 validateBattleSnapshot(again,loaded.campaign.pendingBattle);assert.deepEqual(loaded,before);
 for(const id of pair.ids){const actor=unit(again,id);assert.ok(sameCell(actor,unit(pair.battle,id)));assert.equal(surfaceAt(again,actor).cover,30);assert.deepEqual(body(actor),body(unit(pair.battle,id)));}
 const roof=unit(again,pair.ids[0]);assert.equal(surfaceAt(again,{x:roof.x,y:roof.y,tacticalLevel:0}).cover,0);
 const synced=syncBattleTime(loaded.campaign,again);assert.equal(synced.error,null);assert.deepEqual(save(synced),{campaign:synced.campaign,battle:synced.battle});
});
