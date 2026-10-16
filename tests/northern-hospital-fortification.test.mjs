import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {validateContentPackage} from '../game/content-package.js';
import {operativeIdForCharacter} from '../game/content-character-ids.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {actBattle,presentedActBattle,getReachable,climbPreview} from '../game/tactical.js';
import {sameCell,spacePoint,surfaceAt,tacticalLevel} from '../game/tactical-space.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {prepareNorthernHospitalFortification} from './northern-hospital-fortification.mjs';

const SECTOR='watch-post',clock=c=>c.hour*3600+(c.secondOfHour??0);
const order=(c,action)=>{const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,next.lastError);return next;};
const saved=c=>{const result=decodeSave(encodeSave(c)).campaign;assert.deepEqual(result,c);return result;};
function setup({treasury=1000,level=0,raid=false}={}){
 const docs=scaffoldDocuments('paid-hospital-fortification');
 docs.content.rules.startingTreasury=treasury;
 docs.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];
 docs.content.startingTerritory[SECTOR]={owner:'patriot',loyalty:65};
 docs.world.arrivalFacilities[SECTOR]=['barracks'];
 docs.content.arrivalSites.push({sector:SECTOR,facilities:['barracks']});
 if(raid)docs.world.enemyStrategy={version:1,theaters:{frontier:{legHours:1,reserve:3,raidEveryHours:4,axis:[SECTOR]}}};
 const content=compileCampaignPackage(docs.manifest,docs);assert.deepEqual(validateContentPackage(content),[]);
 const declaration=structuredClone(content);let c=initialCampaign(42,content);
 const id=operativeIdForCharacter(content,'guide'),quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury;
 c=order(c,{type:'recruitCivic',id,term:'day',destination:SECTOR});assert.equal(cash-c.resources.treasury,quote.total);assert.ok(c.recruited.includes(id));
 c=order(c,{type:'createSquad',name:'Guardia del hospital',ids:[id],sector:SECTOR});assert.equal(c.location,SECTOR);assert.deepEqual(c.squad,[id]);
 for(let n=0;n<level;n++)c=order(c,{type:'fortify',sector:SECTOR});
 assert.deepEqual(content,declaration);return {campaign:saved(c),id};
}

test('three actual paid defenses preserve people, finite property, service and clinic time before a real scheduled raid',()=>{
 const {campaign:start,id}=setup({raid:true}),before=structuredClone(start),result=prepareNorthernHospitalFortification(start,{sector:SECTOR}),c=result.campaign;
 assert.equal(result.receipt.orders.length,3);assert.equal(result.receipt.cost,450);assert.equal(c.resources.treasury,start.resources.treasury-450);assert.equal(c.sectors[SECTOR].fort,3);
 assert.equal(clock(c),clock(start));assert.deepEqual(c.operativeState,start.operativeState);assert.deepEqual(c.contracts,start.contracts);assert.deepEqual(c.recruited,start.recruited);assert.deepEqual(c.squads,start.squads);assert.deepEqual(c.ammunitionStores,start.ammunitionStores);assert.deepEqual(c.armory,start.armory);assert.deepEqual(c.sectorStates,start.sectorStates);
 let replay=saved(start);for(const row of result.receipt.orders){assert.equal(row.cost,150);assert.equal(row.from,row.to);replay=order(replay,row.action);}assert.deepEqual(saved(replay),c);assert.deepEqual(start,before);
 let current=c;for(let n=0;!current.pendingEncounter&&n<8;n++)current=order(current,{type:'wait',hours:1});assert.equal(current.pendingEncounter?.sector,SECTOR);assert.ok(contractExpiresSeconds(current.contracts[id])>clock(current));
 current=order(current,{type:'respondToEncounter',groupId:current.pendingEncounter.groupId,choice:'tactical'});assert.equal(current.pendingBattle.defenseFort,3);assert.equal(current.pendingBattle.enemies.length,3);assert.equal(current.pendingBattle.squad.length,1);
 const battle=enterSector(current.pendingBattle,current.sectorStates[SECTOR]),pair=syncBattleTime(current,battle);assert.equal(pair.error,null);assert.deepEqual(decodeSave(encodeSave(pair.campaign,pair.battle)),{campaign:pair.campaign,battle:pair.battle});
});

test('existing paid levels buy only the missing defenses and maximum level is an exact no-op',()=>{
 for(const level of [1,2,3]){
  const {campaign:start}=setup({level}),before=structuredClone(start),result=prepareNorthernHospitalFortification(start,{sector:SECTOR});
  assert.equal(result.receipt.orders.length,3-level);assert.equal(result.receipt.cost,(3-level)*150);assert.equal(result.campaign.resources.treasury,start.resources.treasury-(3-level)*150);assert.equal(clock(result.campaign),clock(start));assert.deepEqual(result.campaign.contracts,start.contracts);assert.deepEqual(start,before);saved(result.campaign);
  if(level===3)assert.equal(result.campaign,start);
 }
});

test('an actual treasury short of the complete fortification bill refuses before spending',()=>{
 const {campaign:start}=setup({treasury:500}),before=structuredClone(start);assert.ok(start.resources.treasury<450);let failure;
 try{prepareNorthernHospitalFortification(start,{sector:SECTOR});}catch(error){failure=error;}
 assert.match(failure?.message??'',/Actual funds must cover every remaining/);assert.deepEqual(failure.hospitalFortification.orders,[]);assert.deepEqual(failure.campaign,before);assert.deepEqual(start,before);
});

test('an actual pending raid prevents purchases and cannot be bypassed by fortifying',()=>{
 let {campaign:start}=setup({raid:true});for(let n=0;!start.pendingEncounter&&n<8;n++)start=order(start,{type:'wait',hours:1});assert.ok(start.pendingEncounter);const before=structuredClone(start);let failure;
 try{prepareNorthernHospitalFortification(start,{sector:SECTOR});}catch(error){failure=error;}
 assert.match(failure?.message??'',/Resolve the actual encounter/);assert.deepEqual(failure.hospitalFortification.orders,[]);assert.deepEqual(failure.campaign,before);assert.deepEqual(start,before);
});

test('the Córdoba hospital pays for existing defenses before its next wait and a real raid protects its paid roof post',()=>{
 const sector='cordoba',docs=scaffoldDocuments('cordoba-paid-hospital-roof');
 for(const key of ['content','world','maps'])docs[key]=JSON.parse(JSON.stringify(docs[key]).replaceAll('watch-post',sector));
 docs.content.rules.startingTreasury=1000;docs.content.startingTerritory[sector]={owner:'patriot',loyalty:65};
 docs.content.arrivalSites.push({sector,facilities:['barracks']});docs.world.arrivalFacilities[sector]=['barracks'];
 docs.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];docs.world.expansion.buildingTargets={camp:0,[sector]:0};
 docs.world.enemyStrategy={version:1,theaters:{frontier:{legHours:1,reserve:3,raidEveryHours:4,axis:[sector]}}};
 docs.maps[sector].upperSurfaces=Array.from({length:16},(_,i)=>({id:'hospital-roof-'+i,x:4+i%4,y:6+Math.floor(i/4),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:0}));
 docs.maps[sector].climbLinks=[{id:'cordoba-hospital-access',kind:'climb',from:{x:3,y:6,tacticalLevel:0},to:{x:4,y:6,tacticalLevel:1}}];
 const declaration=structuredClone(docs),content=compileCampaignPackage(docs.manifest,docs);assert.deepEqual(validateContentPackage(content),[]);
 let campaign=initialCampaign(42,content);const id=operativeIdForCharacter(content,'guide'),quote=contractQuote(campaign,rosterFor(campaign).find(op=>op.id===id),'day'),cash=campaign.resources.treasury;
 assert.equal(quote.available,true);assert.ok(quote.total>0);campaign=order(campaign,{type:'recruitCivic',id,term:'day',destination:sector});assert.equal(cash-campaign.resources.treasury,quote.total);
 campaign=order(campaign,{type:'createSquad',name:'Hospital de Córdoba',ids:[id],sector});campaign=order(campaign,{type:'visitSector'});
 let pair=syncBattleTime(campaign,enterSector(campaign.pendingBattle,campaign.sectorStates[sector]));assert.equal(pair.error,null);pair={campaign:pair.campaign,battle:pair.battle};
 const initial=decodeSave(encodeSave(pair.campaign,pair.battle));assert.deepEqual(initial,pair);const actions=[];
 const execute=(current,action)=>{
  const before=structuredClone(current.battle),battle=actBattle(current.battle,action);assert.equal(battle.lastError,null,JSON.stringify(action)+': '+battle.lastError);
  assert.deepEqual(presentedActBattle(current.battle,action).state,battle);assert.deepEqual(actBattle(validateBattleSnapshot(JSON.parse(JSON.stringify(current.battle))),action),battle);assert.deepEqual(current.battle,before);
  const next=syncBattleTime(current.campaign,battle);assert.equal(next.error,null);const result={campaign:next.campaign,battle:next.battle};assert.deepEqual(decodeSave(encodeSave(result.campaign,result.battle)),result);return result;
 };
 const body=b=>b.units.find(unit=>unit.id===String(id)),link=pair.battle.climbLinks.find(link=>link.id==='cordoba-hospital-access');assert.ok(link);
 const route=getReachable(pair.battle,body(pair.battle),{stopAt:point=>sameCell(point,link.from)})[0];assert.ok(route?.cost>0);
 const move={type:'move',unitId:String(id),...spacePoint(route)};pair=execute(pair,move);actions.push(move);
 const climb={type:'climb',unitId:String(id),linkId:link.id},access=climbPreview(pair.battle,body(pair.battle),climb);assert.equal(access.valid,true,access.reason);
 const energy=body(pair.battle).energy;pair=execute(pair,climb);actions.push(climb);assert.equal(body(pair.battle).energy,energy-access.energy);assert.ok(sameCell(body(pair.battle),link.to));
 const post=spacePoint(body(pair.battle));assert.equal(tacticalLevel(post),1);assert.equal(surfaceAt(pair.battle,post).cover,0);assert.ok(clock(pair.campaign)>clock(initial.campaign));
 let repeated=initial;for(const action of actions)repeated=execute(repeated,action);assert.deepEqual(repeated,pair);
 campaign=order(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(unit=>unit.side==='player')});
 assert.ok(sameCell(campaign.operativeState[id].residentPosition,post));assert.ok(contractExpiresSeconds(campaign.contracts[id])>clock(campaign)+5*3600);saved(campaign);
 const start=campaign,before=structuredClone(start),fortified=prepareNorthernHospitalFortification(start,{sector});campaign=fortified.campaign;
 assert.equal(fortified.receipt.orders.length,3);assert.equal(fortified.receipt.cost,450);assert.equal(campaign.resources.treasury,start.resources.treasury-450);assert.equal(clock(campaign),clock(start));assert.equal(campaign.sectors[sector].fort,3);
 for(const key of ['operativeState','contracts','recruited','squads','ammunitionStores','armory','sectorStates'])assert.deepEqual(campaign[key],start[key]);assert.deepEqual(start,before);
 let replay=saved(start);for(const row of fortified.receipt.orders){assert.equal(row.cost,150);assert.equal(row.from,row.to);replay=order(replay,row.action);}assert.deepEqual(saved(replay),campaign);
 for(let n=0;!campaign.pendingEncounter&&n<8;n++)campaign=order(campaign,{type:'wait',hours:1});assert.equal(campaign.pendingEncounter?.sector,sector);assert.equal(campaign.hour,5);assert.ok(contractExpiresSeconds(campaign.contracts[id])>clock(campaign));
 campaign=order(campaign,{type:'respondToEncounter',groupId:campaign.pendingEncounter.groupId,choice:'tactical'});const request=campaign.pendingBattle;
 assert.equal(request.defenseFort,3);assert.deepEqual(request.squad.map(unit=>Number(unit.id)),[id]);assert.equal(request.enemies.length,3);assert.equal(campaign.enemyReserves.remaining.frontier,0);
 const previous=structuredClone(campaign.sectorStates[sector]),atEntry=structuredClone(campaign),battle=enterSector(request,campaign.sectorStates[sector]);assert.deepEqual(campaign,atEntry);
 assert.ok(sameCell(body(battle),post));assert.equal(surfaceAt(previous,post).cover,0);assert.equal(surfaceAt(battle,post).cover,30);assert.equal(surfaceAt(battle,{x:post.x,y:post.y,tacticalLevel:0}).cover,surfaceAt(previous,{x:post.x,y:post.y,tacticalLevel:0}).cover);
 for(const key of ['hp','maxHp','bleeding','bandaged','medkits','inventory','weapon','blade','loaded','ammo','condition'])assert.deepEqual(body(battle)[key],request.squad[0][key]);
 const synced=syncBattleTime(campaign,battle);assert.equal(synced.error,null);assert.deepEqual(decodeSave(encodeSave(synced.campaign,synced.battle)),{campaign:synced.campaign,battle:synced.battle});assert.deepEqual(docs,declaration);
});
