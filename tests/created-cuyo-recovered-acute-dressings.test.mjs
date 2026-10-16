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
import {stabilizeCreatedCuyoSurvivors} from './created-cuyo-route.mjs';

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
