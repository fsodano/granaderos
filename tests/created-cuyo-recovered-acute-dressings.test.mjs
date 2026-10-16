import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {validateContentPackage} from '../game/content-package.js';
import {initialCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote} from '../game/contracts.js';
import {getReachable,lookPreview} from '../game/tactical.js';
import {spacePoint,sameCell} from '../game/tactical-space.js';
import {atHand} from '../game/tactical-planning-space.js';
import {order,visit,tactical,saved,leave} from './local-contract-fixture.mjs';
import {stabilizeCreatedCuyoSurvivors,stabilizeStockMendozaSurvivors} from './created-cuyo-route.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);

// All wounds, stock and geometry precede the compiler and campaign factory.
// Ordinary paid orders spring the real trap; no corpse or result is assigned.
function setup({stock=3,critical=false}={}){
 const d=scaffoldDocuments('declared-recovered-acute-dressings'),base=d.content.characters[0];
 d.content.rules.startingTreasury=20000;d.content.rules.deploymentCartridges=0;
 d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];
 d.world.expansion.buildingTargets.camp=0;
 d.content.characters=['fallen','doctor','patient'].map(id=>({...structuredClone(base),id,name:id,nickname:id,monthlyPay:30,arrivalHours:0,weapon:null,
  attributes:{...base.attributes,maxHp:80,medical:id==='doctor'?90:0},
  startingSupplies:{rations:0,torches:0,boleadoras:0,medkits:id==='fallen'?stock:0},
  startingCondition:{hp:id==='patient'?(critical?2:50):80,bleeding:id==='patient'?(critical?5:2):0,bandaged:0,energy:100,fatigue:0}}));
 d.maps.camp.props=[{id:'finite-trap',type:'chest',x:6,y:8,footprint:{width:1,height:1},blocksMovement:true}];
 d.maps.camp.spawns=d.maps.camp.spawns.map(spawn=>spawn.side==='player'?{...spawn,x:5,y:9}:spawn);
 d.world.physical.environment.camp={doors:[],containers:[{selector:{type:'chest',id:'finite-trap'},configuration:{type:'chest',open:false,locked:false,contents:[],trap:{type:'injury',difficulty:100,armed:true,damage:100,breathLoss:0,discoveredBy:[]}}}]};
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);
 let c=initialCampaign(42,content);const people=rosterFor(c),id=key=>people.find(op=>op.contentId===key).id,fallen=id('fallen'),doctor=id('doctor'),patient=id('patient');
 const hire=operativeId=>{const quote=contractQuote(c,people.find(op=>op.id===operativeId),'month'),cash=c.resources.treasury;c=order(c,{type:'recruitCivic',id:operativeId,term:'month'});assert.equal(c.resources.treasury,cash-quote.total);};
 hire(fallen);hire(doctor);c=order(c,{type:'squad',ids:[fallen,doctor]});let p=visit(c);
 const actor=()=>p.battle.units.find(u=>u.id===String(fallen)),trap=p.battle.props.find(prop=>prop.id==='finite-trap');
 for(let n=0;Math.hypot(actor().x-trap.x,actor().y-trap.y)>1.5&&n<16;n++){
  const point=getReachable(p.battle,actor()).filter(point=>Math.hypot(point.x-trap.x,point.y-trap.y)<=1.5).sort((a,b)=>a.cost-b.cost)[0];assert.ok(point);
  const before=spacePoint(actor());p=saved(tactical(p,{type:'move',unitId:String(fallen),...spacePoint(point)}));assert.equal(sameCell(actor(),before),false);
 }
 assert.ok(Math.hypot(actor().x-trap.x,actor().y-trap.y)<=1.5);
 if(lookPreview(p.battle,actor(),trap).valid)p=saved(tactical(p,{type:'look',unitId:String(fallen),...spacePoint(trap)}));
 const observer=p.battle.units.find(unit=>unit.id===String(doctor));assert.ok(atHand(observer,actor()));
 if(lookPreview(p.battle,observer,actor()).valid)p=saved(tactical(p,{type:'look',unitId:String(doctor),...spacePoint(actor())}));
 p=saved(tactical(p,{type:'useItem',unitId:String(fallen),environment:{kind:'container',id:trap.id,verb:'open'}}));assert.equal(actor().hp,0);assert.equal(actor().medkits,stock);
 assert.equal(actor().knownToPlayer,true,'the living adjacent observer must discover the actual body');
 c=leave(p);assert.equal(c.operativeState[fallen].alive,false);
 hire(patient);c=order(c,{type:'createSquad',name:'Socorro declarado',ids:[doctor,patient],sector:'camp'});
 assert.equal(c.operativeState[doctor].medkits,0);assert.equal(c.operativeState[patient].medkits,0);
 assert.equal(c.operativeState[patient].hp,critical?2:50);assert.equal(c.operativeState[patient].bleeding,critical?5:2);assert.deepEqual(d,declaration);
 return {campaign:saved({campaign:c}).campaign,fallen,doctor,patient,stock};
}

for(const critical of [false,true])test(`a living empty medic recovers a known finite stack before ${critical?'critical':'bleeding'} field aid`,()=>{
 const {campaign:start,fallen,doctor,patient,stock}=setup({critical}),before=structuredClone(start),events=[];
 const c=stabilizeCreatedCuyoSurvivors(start,{report:event=>events.push(event)}),recovered=events.filter(event=>event.event==='createdCuyoAcuteDressingRecovered'),aid=events.filter(event=>event.event==='createdCuyoFieldAid');
 assert.equal(recovered.length,1);assert.equal(recovered[0].doctor,doctor);assert.equal(recovered[0].count,stock);assert.equal(recovered[0].sourceBefore,stock);assert.equal(recovered[0].sourceAfter,0);
 assert.ok(aid.length>0);const spent=aid.flatMap(event=>event.steps).filter(action=>action.type==='useItem').length;assert.equal(spent,critical?2:1);
 assert.ok(aid[0].orders.some(action=>action.type==='sectorInventory'&&action.direction==='take'&&action.count===stock));
 assert.equal(c.operativeState[patient].bleeding,0);assert.ok(c.operativeState[patient].hp>=15);assert.equal(c.operativeState[fallen].alive,false);
 const body=c.sectorStates.camp.units.find(u=>u.id===String(fallen));assert.equal(body.hp,0);assert.equal(body.medkits,0);
 assert.equal(body.medkits+c.operativeState[doctor].medkits+c.operativeState[patient].medkits+spent,stock);
 assert.equal(c.resources.treasury,start.resources.treasury);assert.deepEqual(c.contracts,start.contracts);assert.ok(clock(c)>clock(start));
 assert.deepEqual(start,before);assert.deepEqual(saved({campaign:c}).campaign,c);
 assert.deepEqual(stabilizeCreatedCuyoSurvivors(saved({campaign:before}).campaign),c,'successful fresh care replays through the official save');
});

test('a real empty field cannot invent a dressing for an unsupplied medic',()=>{
 const {campaign:start}=setup({stock:0}),before=structuredClone(start);
 assert.throws(()=>stabilizeCreatedCuyoSurvivors(start),/living local medic with finite dressings/);
 // Only plain input comparisons follow the terminal refusal.
 assert.deepEqual(start,before);
});


// This independent two-locality care declaration is not a captured convoy
// result. Ordinary traps earn both known finite corpses; public paid hires
// place the wounded groups at their actual declared localities.
function declaredFinalConvoyCare(){
 const d=scaffoldDocuments('declared-final-convoy-finite-care'),base=d.content.characters[0];
 d.content.rules.startingTreasury=20000;d.content.rules.deploymentCartridges=0;
 d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];
 d.content.startingTerritory['watch-post'].owner='patriot';
 d.world.arrivalFacilities['watch-post']=['barracks'];d.content.arrivalSites.push({sector:'watch-post',facilities:['barracks']});
 d.world.expansion.buildingTargets={camp:0,'watch-post':0};d.world.physical.caches={};
 d.world.exitLinks=[['camp','E',19,8,'watch-post','W',0,8]];
 const specs=[
  {name:'fallen-a',kits:2},{name:'fallen-b',kits:2},{name:'physician',medical:90},
  {name:'local-critical',hp:12},{name:'local-bleeder',hp:30,bleeding:4},
  {name:'escaped-a',hp:45,bleeding:2,remote:true},{name:'escaped-b',hp:50,bleeding:2,remote:true},
 ];
 d.content.characters=specs.map(s=>({...structuredClone(base),id:s.name,name:s.name,nickname:s.name,monthlyPay:30,arrivalHours:0,weapon:null,
  attributes:{...base.attributes,maxHp:80,medical:s.medical??0},
  startingSupplies:{rations:0,torches:0,boleadoras:0,medkits:s.kits??0},
  startingCondition:{hp:s.hp??80,bleeding:s.bleeding??0,bandaged:0,energy:100,fatigue:0}}));
 const traps=[{id:'finite-trap-a',x:6,y:8},{id:'finite-trap-b',x:9,y:8}];
 d.maps.camp.props=traps.map(trap=>({...trap,type:'chest',footprint:{width:1,height:1},blocksMovement:true}));
 d.maps.camp.spawns=d.maps.camp.spawns.map(spawn=>spawn.side==='player'?{...spawn,x:5,y:9}:spawn);
 d.world.physical.environment.camp={doors:[],containers:traps.map(trap=>({selector:{type:'chest',id:trap.id},configuration:{type:'chest',open:false,locked:false,contents:[],trap:{type:'injury',difficulty:100,armed:true,damage:100,breathLoss:0,discoveredBy:[]}}}))};
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);
 let c=initialCampaign(42,content);const role=Object.fromEntries(rosterFor(c).map(op=>[op.name,op.id]));
 const hire=(name,destination='camp')=>{
  const id=role[name],quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'month'),cash=c.resources.treasury;
  assert.equal(quote.available,true,quote.reason);c=order(c,{type:'recruitCivic',id,term:'month',destination});assert.equal(c.resources.treasury,cash-quote.total);
 };
 for(const name of ['fallen-a','fallen-b','physician'])hire(name);
 c=order(c,{type:'createSquad',name:'Custodia finita',sector:'camp',ids:['fallen-a','fallen-b','physician'].map(name=>role[name])});
 let p=visit(c);const actor=id=>p.battle.units.find(u=>u.id===String(id));
 const near=(id,target)=>{
  for(let n=0;Math.hypot(actor(id).x-target.x,actor(id).y-target.y)>1.5&&n<16;n++){
   const point=getReachable(p.battle,actor(id)).filter(point=>Math.hypot(point.x-target.x,point.y-target.y)<=1.5).sort((a,b)=>a.cost-b.cost)[0];assert.ok(point);
   const old=spacePoint(actor(id));p=saved(tactical(p,{type:'move',unitId:String(id),...spacePoint(point)}));assert.equal(sameCell(actor(id),old),false);
  }
  assert.ok(Math.hypot(actor(id).x-target.x,actor(id).y-target.y)<=1.5);
  const quote=lookPreview(p.battle,actor(id),target);if(quote.valid&&quote.pa>0)p=saved(tactical(p,{type:'look',unitId:String(id),...spacePoint(target)}));
 };
 for(const [i,name]of ['fallen-a','fallen-b'].entries()){
  const id=role[name],trap=p.battle.props.find(prop=>prop.id===traps[i].id);near(id,trap);near(role.physician,actor(id));assert.ok(atHand(actor(role.physician),actor(id)));
  p=saved(tactical(p,{type:'useItem',unitId:String(id),environment:{kind:'container',id:trap.id,verb:'open'}}));
  assert.equal(actor(id).hp,0);assert.equal(actor(id).medkits,2);assert.equal(actor(id).knownToPlayer,true);
 }
 c=leave(p);
 for(const s of specs.filter(s=>s.hp!==undefined))hire(s.name,s.remote?'watch-post':'camp');
 const local=['physician','local-critical','local-bleeder'].map(name=>role[name]),remote=['escaped-a','escaped-b'].map(name=>role[name]);
 c=order(c,{type:'createSquad',name:'Retén exterior',sector:'watch-post',ids:remote});
 c=order(c,{type:'createSquad',name:'Socorro local',sector:'camp',ids:local});
 assert.equal(c.location,'camp');for(const id of [...local,...remote])assert.equal(c.operativeState[id].medkits,0);
 for(const name of ['fallen-a','fallen-b'])assert.equal(c.operativeState[role[name]].alive,false);
 assert.deepEqual(d,declaration);return {campaign:saved({campaign:c}).campaign,role,local,remote};
}

test('final convoy care uses known finite corpses, treats both actual localities before waiting and returns the stable party',()=>{
 const {campaign:start,role,local,remote}=declaredFinalConvoyCare(),before=structuredClone(start),events=[];
 const c=stabilizeStockMendozaSurvivors(start,{stagingSector:'camp',immediateFieldAid:true,returnSector:'camp',report:event=>events.push(event)});
 const accepted=events.find(e=>e.event==='stockMendozaCareAccepted');assert.ok(accepted);assert.equal(accepted.hourlyDressings,0);assert.equal(accepted.tacticalDressings,4);
 const supplied=events.filter(e=>e.event==='stockMendozaCareAdmissionSupply'||e.event==='stockMendozaCareSupply');assert.equal(supplied.reduce((sum,e)=>sum+(e.taken??1),0),4);
 const aid=events.filter(e=>e.event==='stockMendozaCareTreatment');assert.equal(aid.reduce((sum,e)=>sum+e.dressingUsed,0),4);
 assert.deepEqual([...new Set(aid.map(e=>e.patientId))].sort(),[...local.slice(1),...remote].sort());
 const remoteReady=events.findIndex(e=>e.event==='stockMendozaCareCheckpoint'&&e.stage==='remote-stabilized');assert.ok(remoteReady>=0);
 assert.equal(events.slice(0,remoteReady+1).some(e=>e.event==='stockMendozaCareOrder'&&e.action.type==='wait'),false,'No hourly wait precedes actual stabilization.');
 assert.ok(events.some(e=>e.event==='stockMendozaCareOrder'&&e.kind==='tactical'&&e.action.type==='exit'),'The physician reaches the other group through an actual public exit.');
 for(const id of [...local,...remote]){assert.equal(c.operativeState[id].alive,true);assert.ok(c.operativeState[id].hp>=15);assert.equal(c.operativeState[id].bleeding,0);assert.equal(c.operativeState[id].location,'camp');}
 for(const name of ['fallen-a','fallen-b']){assert.equal(c.operativeState[role[name]].alive,false);assert.equal(c.sectorStates.camp.units.find(u=>u.id===String(role[name])).medkits,0);}
 assert.equal([...local,...remote].reduce((sum,id)=>sum+c.operativeState[id].medkits,0)+accepted.tacticalDressings,4);
 assert.equal(c.resources.treasury,start.resources.treasury);assert.deepEqual(c.contracts,start.contracts);assert.ok(clock(c)>clock(start));
 for(const id of [...local,...remote])for(const key of ['maxHp','inventory','carriedLoaded','condition','weaponInstanceId','primaryWeapon','bladeWeapon'])assert.deepEqual(key==='inventory'?(c.operativeState[id][key]??{}):c.operativeState[id][key],key==='inventory'?(start.operativeState[id][key]??{}):start.operativeState[id][key],id+'.'+key);
 assert.deepEqual(saved({campaign:c}).campaign,c);assert.deepEqual(start,before);
 assert.deepEqual(stabilizeStockMendozaSurvivors(saved({campaign:before}).campaign,{stagingSector:'camp',immediateFieldAid:true,returnSector:'camp'}),c,'The complete successful finite care repeats from its fresh official source.');
});
