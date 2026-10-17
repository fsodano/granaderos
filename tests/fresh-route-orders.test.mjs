import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractExpiresSeconds,contractQuote} from '../game/contracts.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {createFreshRouteOrders} from './fresh-cuyo-route.mjs';

const ordinary=(s,action)=>{
 const next=dispatchCampaign(s,action);
 assert.equal(next.lastError,null,next.lastError);
 return next;
};
const saved=s=>decodeSave(encodeSave(s)).campaign;

// Declared immediate-arrival candidates isolate the route guard. This is not
// an earned opening, funded province, or full campaign acceptance fixture.
function hired({acute=false}={}){
 const content=defaultContentPackage();
 for(const id of [110,116])content.characters.find(c=>c.id===`person-${id}`).arrivalHours=0;
 if(acute)content.characters.find(c=>c.id==='person-110').startingCondition={hp:8,energy:100,fatigue:0,bleeding:4,bandaged:0};
 let s=ordinary(initialCampaign(45,content),{type:'advanceStrategicTime',seconds:121});
 for(const id of [110,116])s=ordinary(s,{type:'recruitCivic',id,term:'day'});
 return saved(s);
}
function guarded(start){
 let campaign=structuredClone(start);const events=[];
 const guard=createFreshRouteOrders(()=>campaign,next=>{campaign=next;},{report:event=>events.push(event)});
 return {guard,events,current:()=>campaign};
}
function replay(start,events){
 let s=structuredClone(start);
 for(const event of events)if(event.action)s=ordinary(s,event.action);
 return s;
}

test('route waits retain paid survivors outside the active squad at their exact expiry seconds',()=>{
 let start=hired();const active=start.activeSquadId;
 start=ordinary(start,{type:'createSquad',name:'Reserva',ids:[116],sector:'retiro'});
 start=ordinary(start,{type:'selectSquad',id:active});
 assert.deepEqual(start.squad,[110]);
 const original=structuredClone(start),{guard,events,current}=guarded(start),deadline=contractExpiresSeconds(start.contracts[110]);
 const prices=[110,116].reduce((sum,id)=>sum+contractQuote(start,rosterFor(start).find(op=>op.id===id),'day').price,0);
 for(let i=0;i<30&&current().hour*3600+(current().secondOfHour??0)<deadline+3600;i++)guard.order({type:'wait',hours:1});
 const result=current();
 assert.ok(result.hour*3600+(result.secondOfHour??0)>=deadline+3600);
 for(const id of [110,116]){
  assert.ok(result.recruited.includes(id));assert.equal(result.operativeState[id].alive,true);
  assert.equal(contractExpiresSeconds(result.contracts[id]),deadline+24*3600);
  for(const key of ['hp','bleeding','medkits','ammo','carriedLoaded','condition'])assert.equal(result.operativeState[id][key],start.operativeState[id][key]);
 }
 assert.equal(result.resources.treasury,start.resources.treasury-prices);
 assert.deepEqual(saved(result),result);assert.deepEqual(replay(start,events),result);
 assert.deepEqual(start,original);
});

test('route care uses finite hourly dressings and blocks an acute clock advance after the doctor runs out',()=>{
 const start=hired({acute:true}),{guard,events,current}=guarded(start);
 assert.throws(()=>guard.order({type:'wait',hours:1}),/acute survivor 110/);
 assert.deepEqual(current(),start);
 guard.order({type:'assignCare',id:110,assignment:'patient'});
 guard.order({type:'assignCare',id:116,assignment:'doctor'});
 guard.order({type:'wait',hours:1});
 assert.equal(current().operativeState[110].bleeding,0);
 assert.equal(current().operativeState[110].hp,8);
 assert.equal(current().operativeState[116].medkits,1);
 guard.order({type:'wait',hours:1});
 assert.ok(current().operativeState[110].hp>8&&current().operativeState[110].hp<15);
 assert.equal(current().operativeState[116].medkits,0);
 const stopped=structuredClone(current());
 assert.throws(()=>guard.order({type:'wait',hours:1}),/acute survivor 110/);
 assert.deepEqual(current(),stopped);assert.deepEqual(saved(stopped),stopped);
 assert.deepEqual(replay(start,events),stopped);
 assert.equal(stopped.resources.treasury,start.resources.treasury);
});

test('a legal sector entry remains recorded when later route preparation stops for its tactical report',()=>{
 const start=hired(),{guard,events,current}=guarded(start);
 guard.order({type:'visitSector'});
 const entered=structuredClone(current());
 assert.ok(entered.pendingBattle);
 assert.throws(()=>guard.order({type:'wait',hours:1}),/tactical report/);
 assert.deepEqual(current(),entered);
 assert.deepEqual(events.filter(e=>e.action).map(e=>e.action),[{type:'visitSector'}]);
 assert.deepEqual(replay(start,events),entered);
 const battle=enterSector(entered.pendingBattle,entered.sectorStates.retiro);
 const restored=decodeSave(encodeSave(entered,battle));
 assert.deepEqual(restored.campaign,entered);assert.deepEqual(restored.battle,battle);
 assert.equal(entered.resources.treasury,start.resources.treasury);
});


// Independent finite battle declaration. An exposed paid soldier dies from
// actual enemy actions; victory, official settlement and care are never set.
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {validateContentPackage} from '../game/content-package.js';
import {fightNorthernSector,northernCombatOrder} from './northern-route.mjs';

function recaptureCasualtyCourse(){
 const d=scaffoldDocuments('declared-route-recapture-casualty'),base=d.content.characters[0];
 d.content.rules.startingTreasury=20000;d.content.rules.deploymentCartridges=12;d.content.rules.enemyCartridges=0;
 d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];
 d.world.expansion.buildingTargets={camp:0,'watch-post':0};d.world.physical.caches={};
 d.world.deployment={'watch-post':{playerAnchors:[{x:6,y:8},{x:2,y:8},{x:2,y:10}],enemyAnchor:{x:7,y:8}}};
 d.content.weapons.push({id:'declared-ledger-musket',template:1800,name:'Mosquete de la guardia',damage:58,fireAP:12,aimAP:6,reloadAP:45,range:18,readyAP:6,capacity:1,weight:4,price:240,art:base.portrait});
 // A declared primary blade earns a fatal strike; unarmed fists can leave
 // the exposed soldier unconscious, which is not an actual battle death.
 d.content.weapons.push({id:'declared-ledger-sabre',template:1809,name:'Sable de la oposición',damage:45,ap:60,reach:1.5,weight:1,price:0,art:base.portrait});
 d.content.oppositionEquipment={officer:'declared-ledger-sabre',line:null,veteran:null};
 const roles=['exposed','guard-a','guard-b','physician','patient'];
 d.content.characters=roles.map(name=>({...structuredClone(base),id:name,name,nickname:name,monthlyPay:30,arrivalHours:0,serviceGuarantee:0,
  weapon:name.startsWith('guard-')?'declared-ledger-musket':null,
  attributes:{...base.attributes,maxHp:80,agility:90,dexterity:90,strength:90,wisdom:90,marksmanship:name.startsWith('guard-')?100:0,medical:name==='physician'?80:0},
  startingSupplies:{rations:0,torches:0,boleadoras:0,medkits:name==='physician'?2:0},
  startingCondition:{hp:name==='exposed'?15:name==='patient'?12:80,bleeding:0,bandaged:0,energy:100,fatigue:0}}));
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);
 let c=initialCampaign(45,content);const ids=Object.fromEntries(rosterFor(c).map(op=>[op.name,op.id]));
 for(const name of roles){const id=ids[name],q=contractQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury;assert.equal(q.available,true,q.reason);c=ordinary(c,{type:'recruitCivic',id,term:'day',destination:'camp'});assert.equal(c.resources.treasury,cash-q.total);}
 c=ordinary(c,{type:'createSquad',sector:'camp',name:'Atención retenida',ids:[ids.physician,ids.patient]});
 c=ordinary(c,{type:'createSquad',sector:'camp',name:'Campo de recaptura',ids:[ids.exposed,ids['guard-a'],ids['guard-b']]});
 const start=saved(c),before=structuredClone(start),controller=(battle,u)=>battle.units.find(actor=>actor.id===String(ids.exposed)).hp>0?null:northernCombatOrder(battle,u);
 const won=fightNorthernSector(start,'watch-post',{controller}),dead=won.summary.units.filter(u=>u.side==='player'&&u.hp===0).map(u=>Number(u.id));
 assert.equal(won.summary.status,'victory');assert.ok(won.summary.turns>1&&won.summary.elapsedSeconds>0&&won.summary.actions>0);assert.deepEqual(dead,[ids.exposed]);
 const opposition=won.campaign.sectorStates['watch-post'].units.filter(unit=>unit.side==='enemy'),officer=opposition.find(unit=>unit.id==='enemy-0');assert.equal(opposition.length,4);assert.equal(officer.weapon,1809);assert.equal(officer.weaponMetadata.contentWeapon.id,'declared-ledger-sabre');assert.ok(opposition.every(unit=>unit.loaded===0&&unit.ammo===0),'The four ordinary generated opponents retain their declared zero-cartridge budget.');
 assert.equal(won.campaign.operativeState[ids.exposed].alive,false);assert.equal(won.campaign.operativeState[ids.exposed].hp,0);assert.ok(won.campaign.sectorStates['watch-post'].units.some(u=>u.id===String(ids.exposed)&&u.hp===0));
 assert.ok(roles.filter(name=>name!=='exposed').every(name=>won.campaign.operativeState[ids[name]].alive));
 assert.equal(won.campaign.operativeState[ids.patient].hp,12);assert.equal(won.campaign.operativeState[ids.patient].bleeding,0);
 assert.equal(won.campaign.operativeState[ids.physician].medkits,2);assert.deepEqual(start,before);assert.deepEqual(d,declaration);
 return {start,won,ids};
}

test('a completed Native recapture retires only its actual death while retaining finite care and paid survivor renewals',()=>{
 const {start,won,ids}=recaptureCasualtyCourse(),before=structuredClone(start),{guard,events,current}=guarded(start),death=structuredClone(won.campaign.operativeState[ids.exposed]);
 guard.adoptAfterRecapture(won.campaign,[won.summary]);
 assert.ok(!guard.keepIds().includes(ids.exposed));assert.ok(['guard-a','guard-b','physician','patient'].every(name=>guard.keepIds().includes(ids[name])));
 guard.order({type:'assignCare',operativeId:ids.physician,assignment:'doctor'});guard.order({type:'assignCare',operativeId:ids.patient,assignment:'patient'});
 guard.order({type:'wait',hours:1});
 assert.ok(current().operativeState[ids.patient].hp>=15);assert.equal(current().operativeState[ids.patient].bleeding,0);assert.equal(current().operativeState[ids.physician].medkits,1);
 const oldExpiry=contractExpiresSeconds(current().contracts[ids['guard-a']]),cash=current().resources.treasury;
 guard.retain(24*3600);const renewals=events.filter(e=>e.event==='freshRouteRenewal');assert.ok(renewals.length>0);assert.ok(!renewals.some(e=>e.id===ids.exposed));
 assert.ok(contractExpiresSeconds(current().contracts[ids['guard-a']])>oldExpiry);assert.equal(current().resources.treasury,cash-renewals.reduce((sum,e)=>sum+e.price,0));
 assert.deepEqual(current().operativeState[ids.exposed],death);assert.deepEqual(saved(current()),current());assert.deepEqual(start,before);
 assert.deepEqual(replay(won.campaign,events),current(),'The accepted campaign care and renewal tape repeats from its actual settled victory.');
 const repeated=recaptureCasualtyCourse();assert.deepEqual(repeated.start,start);assert.deepEqual(repeated.won,won,'The independently declared battle earns the same casualty and victory on its ordinary repeat.');
});

test('a casualty absent from the actual recapture victory reports cannot leave the service ledger',()=>{
 const {start,won}=recaptureCasualtyCourse(),before=structuredClone(start),{guard,current}=guarded(start);
 assert.throws(()=>guard.adoptAfterRecapture(won.campaign,[]),/actual Native recapture death report/);
 assert.deepEqual(current(),start);assert.deepEqual(start,before);
 // Guard refusal only; no subsequent gameplay, query, codec or replay.
});

test('a valid battle death cannot hide an actually dismissed living survivor',()=>{
 const {start,won,ids}=recaptureCasualtyCourse(),next=ordinary(won.campaign,{type:'dismiss',id:ids['guard-a']}),{guard}=guarded(start);
 assert.equal(next.operativeState[ids['guard-a']].alive,true);assert.ok(!next.recruited.includes(ids['guard-a']));
 assert.throws(()=>guard.adoptAfterRecapture(next,[won.summary]),/intended serving survivor/);
 // Actual dismissal remains authoritative. No gameplay follows this refusal.
});

test('the accepted casualty transition does not drop an untreated actual survivor from the acute clock guard',()=>{
 const {start,won,ids}=recaptureCasualtyCourse(),{guard,current}=guarded(start);guard.adoptAfterRecapture(won.campaign,[won.summary]);
 assert.ok(guard.keepIds().includes(ids.patient));assert.equal(current().operativeState[ids.patient].hp,12);
 const before=structuredClone(current());assert.throws(()=>guard.order({type:'wait',hours:1}),/actual acute survivor|Actual acute survivor/);assert.deepEqual(current(),before);
 // The refused wait never dispatches. Only raw input comparison follows.
});
