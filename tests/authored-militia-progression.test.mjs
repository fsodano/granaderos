import test from 'node:test';import assert from 'node:assert/strict';
import {DEFAULT_MILITIA_PROGRESSION,MILITIA_PROGRESSION_FIELDS,militiaProgression} from '../game/militia-progression-rules.js';
import {defaultContentPackage,validateContentPackage,encodeContentPackage,parseContentPackage} from '../game/content-package.js';
import {initialCampaign} from '../game/campaign.js';
import {earnedMilitiaRank,promoteMilitia,recordMilitiaHit,validMilitiaExperience} from '../game/militia-experience.js';
import {campaignContentReport} from '../game/campaign-content.js';
import {order,saved,visit,leave} from './local-contract-fixture.mjs';
import {combatMilitia,militiaReaction} from './militia-combat-fixture.mjs';
const rules=values=>({...DEFAULT_MILITIA_PROGRESSION,...values});
const save=s=>saved({campaign:s}).campaign;
const soldier=(s,id)=>s.garrisons.retiro.find(u=>u.id===id);

test('optional militia rules preserve older identity, round-trip strictly and reject incomplete or unordered thresholds',()=>{
 const d=defaultContentPackage(),old=initialCampaign(42,d),identity=old.contentCampaign.identity;assert.equal(d.militiaProgression,undefined);assert.equal(save(old).contentCampaign.package.militiaProgression,undefined);assert.deepEqual(save(old).contentCampaign.identity,identity);assert.deepEqual(militiaProgression(save(old)),DEFAULT_MILITIA_PROGRESSION);
 d.militiaProgression=rules({regularThreshold:99,veteranThreshold:100,marksmanshipGain:0,levelGain:9});assert.deepEqual(parseContentPackage(encodeContentPackage(d)),d);assert.deepEqual(campaignContentReport(d).blocked,[]);assert.deepEqual(militiaProgression(initialCampaign(42,d)),d.militiaProgression);
 const invalid=[null,[],{}, {...d.militiaProgression,extra:1},rules({regularThreshold:7,veteranThreshold:7}),rules({regularThreshold:8,veteranThreshold:7})];for(const [key,,min,max]of MILITIA_PROGRESSION_FIELDS)for(const value of [min-1,max+1,1.5,'2',null,NaN])invalid.push({...d.militiaProgression,[key]:value});
 for(const config of invalid){const x={...d,militiaProgression:config};assert.ok(validateContentPackage(x).length);assert.throws(()=>initialCampaign(42,x));}
});

test('authored cumulative thresholds delay actual wounded-soldier promotion and apply pinned attribute gains on both returns',()=>{
 const authored=rules({regularThreshold:4,veteranThreshold:7,marksmanshipGain:3,leadershipGain:2,levelGain:2});let {s,id}=combatMilitia(d=>d.militiaProgression=authored);const before=structuredClone(soldier(s,id));authored.regularThreshold=1;authored.marksmanshipGain=99;
 for(const [index,rank]of [[1,0],[2,1],[3,2]]){const result=militiaReaction(s,id);s=result.s;const u=soldier(s,id);assert.equal(u.militiaExperience,index*3);assert.equal(u.militiaRank,rank);assert.equal(u.marksmanship,before.marksmanship+rank*3);assert.equal(u.leadership,before.leadership+rank*2);assert.equal(u.experienceLevel??4,(before.experienceLevel??4)+rank*2);assert.equal(u.hp,43);assert.equal(u.loaded,3-index);assert.equal(u.ammo,before.ammo);assert.deepEqual(u.weaponMetadata,before.weaponMetadata);assert.equal(u.condition,before.condition-index);s=save(s);}
 assert.equal(militiaProgression(s).regularThreshold,4);assert.equal(militiaProgression(s).veteranThreshold,7);s=save(leave(visit(s)));assert.equal(soldier(s,id).militiaRank,2);assert.equal(soldier(s,id).hp,43);
 const altered=structuredClone(s);altered.contentCampaign.package.militiaProgression.levelGain=9;assert.throws(()=>save(altered),/identidad/);
});

test('zero promotion gains preserve actual attributes, wound and finite equipment through paid regular instruction and veteran combat',()=>{
 let {s,id}=combatMilitia(d=>d.militiaProgression=rules({marksmanshipGain:0,leadershipGain:0,levelGain:0}));const before=structuredClone(soldier(s,id));s=order(s,{type:'militia',rank:1,trainerId:1000});s=order(save(s),{type:'wait',hours:s.militiaTraining[0].remaining});assert.equal(soldier(s,id).militiaRank,1);for(const key of ['marksmanship','leadership','hp','weaponMetadata','loaded','ammo','condition'])assert.deepEqual(soldier(s,id)[key],before[key],key);
 for(let i=0;i<2;i++)({s}=militiaReaction(s,id));const veteran=soldier(save(s),id);assert.equal(veteran.militiaRank,2);assert.equal(veteran.hp,43);assert.equal(veteran.loaded,before.loaded-2);for(const key of ['marksmanship','leadership'])assert.equal(veteran[key],before[key]);assert.equal(veteran.experienceLevel??4,before.experienceLevel??4);
});

test('authored gains respect attribute caps and high thresholds still require newly earned combat credit',()=>{
 const u={militia:true,militiaRank:0,hp:40,marksmanship:95,leadership:99,experienceLevel:9,name:'Defensor'};const promoted=promoteMilitia(structuredClone(u),1,rules({marksmanshipGain:100,leadershipGain:100,levelGain:9}));assert.equal(promoted.marksmanship,100);assert.equal(promoted.leadership,100);assert.equal(promoted.experienceLevel,10);assert.equal(promoted.hp,40);
 // Ledger boundary only; these prepared receipts are not claimed as real kills.
 const credit=Array.from({length:33},(_,i)=>({id:`opponent-${i}`,points:3}));const actual={...u,militiaExperience:99,militiaCombatCredit:credit};assert.equal(earnedMilitiaRank(u,actual,rules({regularThreshold:99,veteranThreshold:100})),1);assert.equal(earnedMilitiaRank(actual,structuredClone(actual),rules({regularThreshold:99,veteranThreshold:100})),0);
});

test('high thresholds retain enough distinct opponent receipts to earn the next rank after a large encounter',()=>{
 const policy=rules({regularThreshold:99,veteranThreshold:100});
 // Boundary proof, not a fabricated campaign victory: a saved green soldier
 // has 98 earlier wound receipts, then wounds up to 199 new enemies from the
 // supported 200-unit tactical limit before returning for its first ascent.
 const issued={id:'militia',side:'player',hp:60,militia:true,militiaRank:0,name:'Defensor',militiaExperience:98,militiaCombatCredit:Array.from({length:98},(_,i)=>({id:`old-${i}`,points:1}))};
 const returned=structuredClone(issued),battle={battleId:'large',startSeconds:0};
 for(let i=0;i<199;i++)recordMilitiaHit(battle,returned,{id:`enemy-${i}`,side:'enemy',hp:50},true,10);
 assert.equal(returned.militiaExperience,297);assert.equal(validMilitiaExperience(returned),true);assert.equal(earnedMilitiaRank(issued,returned,policy),1);promoteMilitia(returned,1,policy);
 const next=structuredClone(returned);recordMilitiaHit({battleId:'next',startSeconds:6},next,{id:'new-opponent',side:'enemy',hp:0},true,30);assert.equal(next.militiaExperience,300);assert.equal(validMilitiaExperience(next),true);assert.equal(earnedMilitiaRank(returned,next,policy),2);assert.equal(earnedMilitiaRank(returned,structuredClone(returned),policy),1);
 // A fully bounded ledger still refuses an extra identity, without corruption.
 const saturated={...next,militiaCombatCredit:Array.from({length:300},(_,i)=>({id:`cap-${i}`,points:3})),militiaExperience:900};recordMilitiaHit(battle,saturated,{id:'beyond-cap',side:'enemy',hp:0},true,30);assert.equal(saturated.militiaExperience,900);assert.equal(saturated.militiaCombatCredit.length,300);assert.equal(validMilitiaExperience(saturated),true);assert.equal(validMilitiaExperience({...saturated,militiaCombatCredit:[...saturated.militiaCombatCredit,{id:'extra',points:1}],militiaExperience:901}),false);
});
