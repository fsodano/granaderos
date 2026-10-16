import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {validateContentPackage} from '../game/content-package.js';
import {initialCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote} from '../game/contracts.js';
import {actBattle} from '../game/tactical.js';
import {sameCell,spacePoint} from '../game/tactical-space.js';
import {order,saved,visit,sync,leave} from './local-contract-fixture.mjs';
import {stageCreatedCuyoDefensePosts} from './created-cuyo-route.mjs';

const sector='cordoba',clock=c=>c.hour*3600+(c.secondOfHour??0),key=p=>`${p.tacticalLevel??0}:${p.x}:${p.y}`;
const gear=['alive','captured','hp','maxHp','bleeding','weaponDropped','carriedAmmo','carriedLoaded','ammunition','medkits','inventory'];

// The complete roster, finite issues, treasury, ownership and authored roof
// are declared before compilation/factory. Every arrival and resident post
// below is earned through ordinary paid recruitment and Native movement.
function declaredDefense(count=7){
 const d=JSON.parse(JSON.stringify(scaffoldDocuments('declared-cuyo-defense-posts')).replaceAll('"camp"','"cordoba"').replaceAll('camp:','cordoba:'));
 d.content.rules.startingTreasury=20000;d.content.rules.deploymentCartridges=0;
 d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];
 d.world.expansion.buildingTargets[sector]=0;
 d.maps[sector].upperSurfaces=Array.from({length:32},(_,i)=>({id:'declared-post-'+i,x:7+i%8,y:4+Math.floor(i/8),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:20}));
 d.maps[sector].climbLinks=[{id:'declared-public-climb',kind:'climb',from:{x:7,y:3,tacticalLevel:0},to:{x:7,y:4,tacticalLevel:1}}];
 const base=d.content.characters[0];
 d.content.characters=Array.from({length:count},(_,i)=>({...structuredClone(base),id:'guard-'+i,name:'Guardia '+i,nickname:'Guardia '+i,monthlyPay:30,serviceGuarantee:0,arrivalHours:0,weapon:null,
  attributes:{...base.attributes,maxHp:80,strength:90,medical:0},startingSupplies:{rations:0,torches:0,boleadoras:0,medkits:i===0?2:0},startingCondition:{hp:80,energy:100,fatigue:0,bleeding:0,bandaged:0}}));
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);
 let c=initialCampaign(42,content);const ids=rosterFor(c).map(person=>person.id),hires=[];
 assert.equal(c.resources.treasury,20000);
 for(const id of ids){
  const quote=contractQuote(c,rosterFor(c).find(person=>person.id===id),'week'),cash=c.resources.treasury;
  assert.equal(quote.available,true);c=order(c,{type:'recruitCivic',id,term:'week'});
  assert.equal(c.resources.treasury,cash-quote.total);assert.ok(c.recruited.includes(id));hires.push({id,quote});
 }
 for(let offset=0;offset<ids.length;offset+=4)c=order(c,{type:'createSquad',name:'Guardia declarada '+offset,ids:ids.slice(offset,offset+4),sector});
 assert.equal(c.resources.treasury,20000-hires.reduce((sum,row)=>sum+row.quote.total,0));
 assert.equal(c.hiringArrivals.length,0);assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);assert.deepEqual(d,declaration);
 return {campaign:saved({campaign:c}).campaign,ids,hires,declaration};
}

function checkPosts(c,ids){
 const points=ids.map(id=>({id,...spacePoint(c.operativeState[id].residentPosition)})),access=c.sectorStates[sector].climbLinks.flatMap(link=>[link.from,link.to]);
 assert.equal(new Set(points.map(key)).size,ids.length);
 for(const point of points){
  assert.equal(point.tacticalLevel,1);assert.ok(!access.some(endpoint=>sameCell(point,endpoint)));
 }
 for(const unit of c.sectorStates[sector].units.filter(person=>ids.includes(Number(person.id))))assert.deepEqual(spacePoint(unit),spacePoint(points.find(point=>String(point.id)===unit.id)));
 // Each saved scene omits the other homes. Their canonical resident posts
 // must also restore through an ordinary visit by each actual paid squad.
 for(const home of c.squads.filter(home=>home.location===sector&&home.members.some(id=>ids.includes(id)))){
  const entered=visit(order(c,{type:'selectSquad',id:home.id}));
  assert.equal(clock(entered.campaign),clock(c));assert.equal(entered.campaign.resources.treasury,c.resources.treasury);
  for(const id of home.members){
   const unit=entered.battle.units.find(person=>person.id===String(id));assert.ok(unit);
   assert.deepEqual(spacePoint(unit),spacePoint(points.find(point=>point.id===id)));
  }
 }
 return points;
}

function checkLedger(start,end,ids){
 assert.equal(end.resources.treasury,start.resources.treasury);assert.deepEqual(end.contracts,start.contracts);
 assert.deepEqual(end.recruited,start.recruited);assert.deepEqual(end.squads,start.squads);assert.equal(end.activeSquadId,start.activeSquadId);
 for(const id of ids)for(const field of gear)assert.deepEqual(field==='inventory'?(end.operativeState[id][field]??{}):end.operativeState[id][field],field==='inventory'?(start.operativeState[id][field]??{}):start.operativeState[id][field],`${id} retains actual ${field}`);
 assert.equal(end.pendingEncounter,null);assert.equal(end.pendingBattle,null);saved({campaign:end});
}

// Independent ordinary no-move expectation for a successful already-staged
// campaign. It retains the existing paid stand/crouch orders and clock.
function holdAcceptedPosts(start){
 let c=start;const selected=c.activeSquadId;
 for(const squad of c.squads.filter(home=>home.location===sector&&home.members.length)){
  c=order(c,{type:'selectSquad',id:squad.id});
  for(const operativeId of c.squad)c=order(c,{type:'assignCare',operativeId,assignment:'active'});
  const entered=visit(c);let battle=entered.battle;
  for(const id of c.squad)for(const action of [{type:'movement',unitId:String(id),movement:'walk'},{type:'stance',unitId:String(id),stance:'crouched'}]){
   battle=actBattle(battle,action);assert.equal(battle.lastError,null);
  }
  c=leave(sync({campaign:entered.campaign,battle}));
 }
 return order(c,{type:'selectSquad',id:selected});
}

test('fresh paid squads reach distinct authored roof posts with real movement time and unchanged finite custody',()=>{
 const {campaign:start,ids,hires}=declaredDefense(),before=structuredClone(start),events=[];
 const c=stageCreatedCuyoDefensePosts(start,{report:event=>events.push(event)}),positions=checkPosts(c,ids);
 assert.equal(hires.length,7);assert.equal(positions.length,7);assert.equal(events.length,7);assert.equal(new Set(events.map(event=>event.squadId)).size,2);
 assert.ok(events.every(event=>event.event==='createdCuyoDefensePosition'&&!sameCell(event.before,event.after)));
 assert.ok(events.some(event=>event.energy<start.operativeState[event.id].energy),'The actual roof approach spends Native energy.');
 assert.ok(clock(c)>clock(start));assert.ok(clock(c)-clock(start)<3600);checkLedger(start,c,ids);assert.deepEqual(start,before);
});

test('repeated saved staging keeps all seven accepted posts and pays only the unchanged Native posture orders',()=>{
 const {campaign:fresh,ids}=declaredDefense(),first=stageCreatedCuyoDefensePosts(fresh),start=saved({campaign:first}).campaign,before=structuredClone(start),points=checkPosts(start,ids),events=[];
 const expected=holdAcceptedPosts(start),c=stageCreatedCuyoDefensePosts(start,{report:event=>events.push(event)});
 assert.deepEqual(c,expected,'Already-at-post staging is exactly the ordinary no-move posture sequence.');
 assert.equal(clock(c)-clock(start),ids.length*2,'Each actual stand and crouch still pays one Native second.');
 assert.equal(events.length,ids.length);assert.ok(events.every(event=>sameCell(event.before,event.after)));
 assert.deepEqual(checkPosts(c,ids),points);checkLedger(start,c,ids);assert.deepEqual(start,before);
 assert.deepEqual(stageCreatedCuyoDefensePosts(saved({campaign:before}).campaign),c,'The successful fresh save repeats the same Native costs and positions.');
});

test('Native still refuses a zero-distance roof move without changing the fresh accepted battle or its clock',()=>{
 const {campaign:fresh,ids}=declaredDefense(1),c=stageCreatedCuyoDefensePosts(fresh),entered=visit(c),unit=entered.battle.units.find(person=>person.id===String(ids[0])),before=structuredClone(entered);
 const refused=actBattle(entered.battle,{type:'move',unitId:unit.id,...spacePoint(unit)});
 assert.equal(refused.lastError,'Destino inaccesible o puntos de acción insuficientes.');
 assert.equal(refused.elapsedSeconds,before.battle.elapsedSeconds);assert.deepEqual(refused.units,before.battle.units);assert.deepEqual(entered,before);
 // The refused Native result is inspected only. It is not synced, saved,
 // queried, replayed, or supplied to any further order or helper.
});
