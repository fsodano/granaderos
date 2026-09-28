import {secureArea} from './controlled-area-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {createContentTestRange} from '../game/content-test-range.js';
import {campaignContentReport} from '../game/campaign-content.js';
import {operativeIdForCharacter,isContractCharacter} from '../game/content-character-ids.js';
import {initialCampaign,dispatchCampaign,rosterFor,civicStatus} from '../game/campaign.js';
import {contractQuote} from '../game/contracts.js';
import {encountersFor} from '../game/encounters.js';
import {characterProfile} from '../game/characters.js';
import {militiaCourse} from '../game/militia.js';
import {createBattle,actBattle,endTurn,actionCosts,movementEnergy} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {syncBattleTime} from '../game/time.js';

const order=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null,`${a.type}: ${next.lastError}`);return next;};
const save=(s,b=null)=>decodeSave(encodeSave(s,b));
function authored(){
 const d=defaultContentPackage(),template=d.characters.find(c=>c.id==='person-100');
 const c={...structuredClone(template),id:'lucia-del-rio',name:'Lucía del Río',nickname:'Luz',biography:'Exploradora del río.',portrait:'/art/avatar-woman-scout.webp',monthlyPay:300,arrivalHours:2,traits:['teacher','line_marksman'],ridingSkill:35,attributes:{...template.attributes,marksmanship:85,mechanical:80}};
 // Compatibility fixture: the first authored roster format had no voice or appearance fields.
 for(const field of ['personality','speech','spriteAppearance'])delete c[field];
 d.characters=d.characters.filter(c=>!isContractCharacter(c));d.characters.push(c);return d;
}

test('new content identities are stable, separate from legacy powers, and absent until hired',()=>{
 const d=authored();for(const id of ['person-12','person-1000','person-20000'])d.characters.push({...structuredClone(d.characters.at(-1)),id});
 assert.deepEqual(validateContentPackage(d),[]);assert.deepEqual(campaignContentReport(d).blocked,[]);
 const reversed={...d,characters:[...d.characters].reverse()};
 for(const c of d.characters){const id=operativeIdForCharacter(d,c.id);assert.equal(operativeIdForCharacter(reversed,c.id),id);if(isContractCharacter(c))assert.ok(id>=2000&&id<20000);}
 let s=initialCampaign(42,d);assert.equal(s.operativeState[100],undefined);assert.equal(civicStatus(s,100).available,false);
 assert.ok(dispatchCampaign(s,{type:'recruitCivic',id:100}).lastError);
 for(const sector of Object.keys(s.sectors))assert.equal(encountersFor(s,sector).some(n=>n.operativeId>=100),false);
 s=save(s).campaign;assert.equal(s.operativeState[100],undefined);assert.equal(rosterFor(s).some(o=>o.id===100),false);
 const id=operativeIdForCharacter(d,'lucia-del-rio');d.characters.find(c=>c.id==='lucia-del-rio').name='Changed draft';
 assert.equal(rosterFor(s).find(o=>o.id===id).name,'Lucía del Río');
 s=order(s,{type:'createOfficer',name:'Oficial de prueba',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});
 assert.equal(rosterFor(save(s).campaign).filter(o=>o.id===1000).length,1);
});

test('a newly authored candidate has one paid saved arrival, actual deployment and no inherited officer profile',()=>{
 const d=authored(),id=operativeIdForCharacter(d,'lucia-del-rio');let s=initialCampaign(42,d);
 s=order(s,{type:'recruitCivic',id,term:'week',destination:'retiro'});
 assert.equal(s.resources.treasury,3130);assert.equal(s.recruited.includes(id),false);assert.equal(s.contracts[id],undefined);
 assert.ok(dispatchCampaign(s,{type:'recruitCivic',id,term:'week'}).lastError);
 s=order(save(s).campaign,{type:'wait',hours:2});assert.equal(s.resources.treasury,3130);assert.equal(s.contracts[id].started,2);assert.equal(s.contracts[id].expiresAt,170);
 const op=rosterFor(s).find(o=>o.id===id);assert.equal(characterProfile(op).registry,'Boletín Revolucionario Cívico');assert.equal(characterProfile(op).personality,'Exploradora del río.');assert.ok(characterProfile(op).skills.includes('Instrucción'));
 s=order(s,{type:'visitSector'});const b=enterSector(s.pendingBattle);const u=b.units.find(u=>u.id===String(id));
 assert.equal(u.name,'Lucía del Río');assert.equal(u.portraitId,d.characters.at(-1).portrait);assert.equal(u.marksmanship,85);assert.deepEqual(u.traits,['teacher','line_marksman']);
 assert.equal(u.weaponMetadata.contentWeapon.id,d.characters.at(-1).weapon);assert.ok(actionCosts(b,u).aim<actionCosts(b,{...u,traits:[]}).aim);
 const range=createContentTestRange(d,'lucia-del-rio');assert.equal(actionCosts(range,range.units[0]).aim,actionCosts(b,u).aim);assert.equal(range.units[0].ridingSkill,u.ridingSkill);
 assert.ok(militiaCourse(u,0).hours<militiaCourse({...u,traits:[]},0).hours);assert.ok(save(s,b));
});

test('new arrivals can redirect and cancel once, and malformed identity or record saves are rejected',()=>{
 const d=authored(),id=operativeIdForCharacter(d,'lucia-del-rio');let s=order(initialCampaign(42,d),{type:'recruitCivic',id,term:'day'});
 secureArea(s,'ensenada');s=order(save(s).campaign,{type:'redirectHire',id,destination:'ensenada'});assert.equal(s.hiringArrivals[0].destination,'ensenada');assert.equal(s.resources.treasury,3190);
 for(const mutate of [v=>v.hiringArrivals[0].operativeId=100,v=>delete v.operativeState[id],v=>v.hiringArrivals[0].paid++,v=>v.recruited.push(100)]){const copy=structuredClone(s);mutate(copy);assert.throws(()=>save(copy));}
 s=order(save(s).campaign,{type:'cancelHireArrival',id});assert.equal(s.resources.treasury,3200);assert.ok(dispatchCampaign(s,{type:'cancelHireArrival',id}).lastError);assert.equal(save(s).campaign.recruited.length,0);
});

test('new characters retain actual combat injuries and experience across return, save and reentry; fixed progression does not grow',()=>{
 for(const progression of ['experience','fixed']){
  const d=authored(),c=d.characters.at(-1);c.progression=progression;c.arrivalHours=0;c.traits=[];
  const id=operativeIdForCharacter(d,c.id);let s=order(initialCampaign(8,d),{type:'recruitCivic',id,term:'week'});
  // Saved veteran and practice fixture just below the next thresholds.
  s.operativeState[id].xp=95;s.operativeState[id].condition=50;s.operativeState[id].skillPractice={mechanical:39};
  s=save(s).campaign;
  secureArea(s,'buenos_aires');s=order(s,{type:'travel',sector:'buenos_aires'});s=order(s,{type:'attack',sector:'san_nicolas'});const request=s.pendingBattle;
  // Compact combat fixture with actual campaign soldiers and return handlers.
  let b=createBattle(request.squad.map(u=>({...u,x:1,y:1})),{width:12,height:8,sectorId:request.sector,seed:45,tiles:Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0})),enemies:[{id:'guard',x:10,y:1,weapon:1806,blade:1811,ammo:0,fatigue:100,marksmanship:100}]});
  b=actBattle(b,{type:'repair',unitId:String(id)});assert.equal(b.lastError,null);assert.equal(b.units[0].trainedStats.mechanical,1);
  b=endTurn(b);
  assert.equal(b.lastError,null);const hp=b.units.find(u=>u.id===String(id)).hp;assert.ok(hp>0&&hp<c.attributes.maxHp,JSON.stringify({hp,log:b.log}));
  const pair=syncBattleTime(s,b);assert.equal(pair.error,null);
  s=order(pair.campaign,{type:'battleResult',outcome:'retreat',battleId:request.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});
  const expectedMax=rosterFor(s).find(o=>o.id===id).maxHp;assert.equal(s.operativeState[id].maxHp,expectedMax);
  // Recover an older authored save that kept the starting health ceiling.
  s.operativeState[id].maxHp=c.attributes.maxHp;
  s=save(s).campaign;const growth=progression==='experience'?2:0;assert.equal(s.operativeState[id].hp,hp+growth);assert.equal(s.operativeState[id].xp,progression==='experience'?105:95);
  const op=rosterFor(s).find(o=>o.id===id);assert.equal(op.level,progression==='experience'?2:1);assert.equal(op.mechanical,c.attributes.mechanical+1+growth);
  s=order(s,{type:'visitSector'});const back=enterSector(s.pendingBattle);assert.equal(back.units.find(u=>u.id===String(id)).hp,hp+growth);assert.equal(back.units.find(u=>u.id===String(id)).maxHp,c.attributes.maxHp+growth);assert.ok(save(s,back));
 }
});

test('explicit service, training traits and progress use the same campaign rules; unsupported identity policies fail clearly',()=>{
 const d=authored(),c=d.characters.at(-1);c.monthlyPay=0;c.traits=['expert_rider'];c.ridingSkill=10;
 let s=initialCampaign(42,d);const op=rosterFor(s).find(o=>o.contentId===c.id);assert.equal(op.ridingSkill,80);
 assert.ok(movementEnergy({...op,mounted:true,movementMode:'run',weapon:0},{type:'grass'})<movementEnergy({...op,ridingSkill:0,mounted:true,movementMode:'run',weapon:0},{type:'grass'}));
 for(const [term,hours] of [['day',24],['week',168],['month',720]]){const q=contractQuote(s,op,term);assert.equal(q.permanent,false);assert.equal(q.price,0);assert.equal(q.hours,hours);}
 s=order(s,{type:'recruitCivic',id:op.id,term:'day'});s=order(s,{type:'wait',hours:26});assert.equal(s.recruited.includes(op.id),false);assert.ok(save(s));
 for(const mutate of [x=>delete x.characters.at(-1).service,x=>x.characters.at(-1).traits=['unknown'],x=>x.characters.at(-1).recruitmentSource='encounter',x=>x.characters.at(-1).service='permanent',x=>x.characters.shift()]){const copy=authored();mutate(copy);assert.throws(()=>initialCampaign(42,copy));}
});


test('a new teacher can save an ongoing militia course and finish it after reload',()=>{
 const d=authored();d.characters.at(-1).arrivalHours=0;const id=operativeIdForCharacter(d,'lucia-del-rio');
 let s=order(initialCampaign(42,d),{type:'recruitCivic',id,term:'week'});
 secureArea(s,'buenos_aires','ensenada');s=order(s,{type:'militia',trainerId:id,rank:0});s=save(s).campaign;
 assert.equal(s.militiaTraining[0].trainerId,id);s=order(s,{type:'wait',hours:s.militiaTraining[0].remaining});
 assert.equal(s.sectors.retiro.militia[0],3);assert.ok(save(s));
});
