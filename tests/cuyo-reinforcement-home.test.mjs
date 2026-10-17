import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {validateContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote} from '../game/contracts.js';
import {canCreateSquad,operativeLocation} from '../game/squads.js';
import {previewStrategicRoute} from '../game/strategic-route.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {visit,leave} from './local-contract-fixture.mjs';
import {formCreatedCuyoReinforcement} from './created-cuyo-route.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const saved=c=>{const restored=decodeSave(encodeSave(c)).campaign;assert.deepEqual(restored,c);return restored;};
const order=(c,action)=>{const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;};
const property=(c,id)=>Object.fromEntries(['hp','alive','bleeding','weapon','condition','weaponInstanceId','weaponFittings','blade','bladeInstanceId','loaded','ammo','ammoStock','carriedLoaded','carriedAmmo','inventory','medkits','rations','torches','boleadoras'].map(key=>[key,structuredClone(c.operativeState[id][key])]));

// Money, supplies, healthy personnel, safe territory and both route endpoints
// are declared before the fresh factory. Paid hires and Native orders then
// earn every squad, journey, resident post and resting assignment below.
function setup(occupied){
 const d=scaffoldDocuments('declared-cuyo-reinforcement-home'),base=d.content.characters[0],keys=['assembly','first','second','mate',...Array.from({length:6},(_,i)=>`guard-${i+1}`)];
 d.content.rules.startingTreasury=20000;d.content.rules.deploymentCartridges=0;
 d.content.startingTerritory['watch-post']={...d.content.startingTerritory['watch-post'],owner:'patriot'};
 d.world.exitLinks=[['camp','E',19,8,'watch-post','W',0,8]];
 d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];
 d.world.expansion.buildingTargets={camp:0,'watch-post':0};
 d.content.characters=keys.map(id=>({...structuredClone(base),id,name:id,nickname:id,monthlyPay:30,arrivalHours:0,weapon:null,
  attributes:{...base.attributes,maxHp:80},startingSupplies:{rations:3,torches:1,medkits:2,boleadoras:0},
  startingCondition:{hp:80,bleeding:0,bandaged:0,energy:100,fatigue:0}}));
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);
 let c=initialCampaign(42,content);const people=rosterFor(c),id=key=>people.find(op=>op.contentId===key).id;
 for(const key of keys.slice(0,occupied+2)){
  const operativeId=id(key),quote=contractQuote(c,people.find(op=>op.id===operativeId),'month'),cash=c.resources.treasury;assert.equal(quote.available,true);
  c=order(c,{type:'recruitCivic',id:operativeId,term:'month'});assert.equal(c.resources.treasury,cash-quote.total);
 }
 c=order(c,{type:'squad',ids:[id('assembly')]});const assembly=c.activeSquadId;
 c=order(c,{type:'createSquad',name:'Hogar del refuerzo',ids:[id('first'),id('second'),id('mate')],sector:'camp'});const home=c.activeSquadId;
 const guards=[];
 for(let i=1;i<=occupied-2;i++){c=order(c,{type:'createSquad',name:`Puesto ${i}`,ids:[id(`guard-${i}`)],sector:'camp'});guards.push(c.activeSquadId);}
 c=order(c,{type:'transport',mode:'posta'});c=order(c,{type:'selectSquad',id:home});c=order(c,{type:'travel',sector:'watch-post',mode:'posta'});
 assert.equal(c.location,'watch-post');assert.equal(c.squads.find(squad=>squad.id===home).journey,undefined);
 c=leave(visit(c));assert.ok(c.operativeState[id('mate')].residentPosition);c=order(c,{type:'assignCare',operativeId:id('mate'),assignment:'rest'});
 const earlier=guards[0];c=order(c,{type:'selectSquad',id:earlier});c=order(c,{type:'travel',sector:'watch-post',mode:'posta'});assert.equal(c.location,'watch-post');
 c=order(c,{type:'travel',sector:'camp',mode:'posta',queue:true});assert.ok(c.squads.find(squad=>squad.id===earlier).journey);
 c=order(c,{type:'selectSquad',id:assembly});assert.equal(c.squads.length,occupied);assert.ok(c.squads.every(squad=>squad.members.length));assert.deepEqual(d,declaration);
 return {campaign:saved(c),assembly,home,earlier,members:[id('first'),id('second')],mate:id('mate')};
}

for(const occupied of [8,7])test(`${occupied} occupied squads ${occupied===8?'reuse the real source home':'retain the original create-squad path'} before paid Cuyo assembly travel`,()=>{
 const {campaign:start,assembly,home,earlier,members,mate}=setup(occupied),before=structuredClone(start),actions=[],events=[];
 assert.equal(canCreateSquad(start),occupied===7);
 const issue=(current,action)=>{actions.push(action);return order(current,action);};
 let c=formCreatedCuyoReinforcement(start,members,'watch-post',{protectedSquadIds:[assembly,earlier],campaignOrder:issue,report:event=>events.push(event)});
 if(occupied===8){assert.equal(c.activeSquadId,home);assert.deepEqual(actions,[{type:'selectSquad',id:home},{type:'squad',ids:members}]);assert.equal(events[0].squadId,home);}
 else{assert.deepEqual(actions,[{type:'createSquad',name:'Refuerzo de Cuyo',ids:members,sector:'watch-post'}]);assert.deepEqual(c,order(start,actions[0]));assert.deepEqual(events,[]);}
 const reinforcement=c.activeSquadId;
 assert.equal(c.squads.length,8);assert.deepEqual(c.squads.find(squad=>squad.id===assembly),start.squads.find(squad=>squad.id===assembly));
 assert.deepEqual(c.squads.find(squad=>squad.id===earlier),start.squads.find(squad=>squad.id===earlier));
 assert.deepEqual(c.operativeState,start.operativeState);assert.deepEqual(c.resources,start.resources);assert.deepEqual(c.contracts,start.contracts);assert.equal(clock(c),clock(start));
 assert.equal(operativeLocation(c,mate),'watch-post');assert.equal(c.operativeState[mate].assignment,'rest');assert.deepEqual(c.operativeState[mate].residentPosition,start.operativeState[mate].residentPosition);
 for(const operativeId of members)c=issue(c,{type:'assignCare',operativeId,assignment:'active'});
 const posta=previewStrategicRoute(c,reinforcement,'camp','posta'),route=posta.valid?posta:previewStrategicRoute(c,reinforcement,'camp','march');assert.equal(route.valid,true,route.reason);assert.equal(route.action.queue,true);
 c=issue(c,route.action);assert.deepEqual(c.squads.find(squad=>squad.id===reinforcement).journey.path,route.path);
 for(let h=0;h<48&&c.squads.find(squad=>squad.id===reinforcement).journey;h++){assert.equal(c.pendingEncounter,null);c=issue(c,{type:'wait',hours:1});}
 assert.equal(c.squads.find(squad=>squad.id===reinforcement).journey,undefined);assert.equal(c.squads.find(squad=>squad.id===reinforcement).location,'camp');
 assert.equal(c.squads.find(squad=>squad.id===earlier).journey,undefined);assert.equal(c.squads.find(squad=>squad.id===earlier).location,'camp');
 assert.equal(clock(c)-clock(start),route.hours*3600);assert.equal(c.resources.treasury,start.resources.treasury-20,'both actual one-leg posta journeys pay their remount charge');
 assert.deepEqual(c.squads.find(squad=>squad.id===assembly),start.squads.find(squad=>squad.id===assembly));assert.deepEqual(c.contracts,start.contracts);
 assert.equal(operativeLocation(c,mate),'watch-post');assert.equal(c.operativeState[mate].assignment,'rest');assert.deepEqual(c.operativeState[mate].residentPosition,start.operativeState[mate].residentPosition);
 for(const id of start.recruited)assert.deepEqual(property(c,id),property(start,id),'squad formation and paid travel preserve actual finite property and health');
 saved(c);let replay=saved(start);
 for(const [index,action]of actions.entries()){replay=order(replay,action);if(index===Math.floor(actions.length/2))replay=saved(replay);}
 assert.deepEqual(replay,c);assert.deepEqual(start,before);
});
