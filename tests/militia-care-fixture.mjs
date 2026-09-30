import assert from 'node:assert/strict';
import {defaultContentPackage} from '../game/content-package.js';
import {initialCampaign} from '../game/campaign.js';
import {createBattle,actBattle} from '../game/tactical.js';
import {order,saved,sync,leave} from './local-contract-fixture.mjs';
export const MILITIA_DOCTOR=112,SECOND_MILITIA_DOCTOR=137;
export function woundedGarrison({twoDoctors=false,casualty=false,careRules,injuryDamage=44,passage=false,headquarters='retiro',configure=()=>{}}={}){
 const d=defaultContentPackage();d.rules.startingTreasury=10000;for(const sector of ['buenos_aires','ensenada'])d.startingTerritory[sector]={owner:'patriot',loyalty:65};if(careRules)d.careRules=careRules;if(headquarters!=='retiro'){d.headquarters=headquarters;d.startingTerritory[headquarters]={owner:'patriot',loyalty:65};}
 for(const id of [MILITIA_DOCTOR,SECOND_MILITIA_DOCTOR]){const c=d.characters.find(c=>c.id===`person-${id}`);c.arrivalHours=0;c.attributes.medical=id===MILITIA_DOCTOR?80:60;c.attributes.leadership=50;}
 // Pin the training rifle's damage in the content package before hiring.
 d.weapons.push({...d.weapons.find(w=>w.id==='firearm-1804'),id:'care-fixture-carbine',name:'Carabina de instrucción',damage:injuryDamage});
 configure(d);
 let s=order(initialCampaign(42,d),{type:'createOfficer',name:'Isabel del Valle',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});
 for(const id of twoDoctors?[MILITIA_DOCTOR,SECOND_MILITIA_DOCTOR]:[MILITIA_DOCTOR])s=order(s,{type:'recruitCivic',id,term:'month'});
 const cost=s.resources.treasury;s=order(s,{type:'militia',trainerId:1000,rank:0});assert.ok(s.resources.treasury<cost);const trainingCost=cost-s.resources.treasury;s=order(s,{type:'wait',hours:s.militiaTraining[0].remaining});s=order(s,{type:'purchaseEquipment',item:'care-fixture-carbine'});s=order(s,{type:'equip',operativeId:1000,slot:'weapon',itemId:'care-fixture-carbine'});s=order(s,{type:'visitSector'});const r=s.pendingBattle;
 // Keep the paid campaign and actual equipment. An ordinary point shot wounds
 // the local militia without inventing an undeclared enemy in a peaceful visit.
 // This fixture verifies care and custody; enemy initiative has separate coverage.
 const troops=[...r.squad.map((u,i)=>({...u,x:1,y:2+i*2})),...r.garrison.map((u,i)=>({...u,x:i===0?5:9+i,y:i===0?2:6}))];
 let battle=createBattle(troops,{...r,hour:s.hour,secondOfHour:s.secondOfHour??0,width:14,height:10,seed:45,exploration:true,tiles:Array.from({length:140},(_,i)=>({x:i%14,y:Math.floor(i/14),type:'grass',blocked:false,cover:0})),enemies:[]});
 const actor=battle.units.find(u=>u.id==='1000'),patientId=String(r.garrison[0].id);
 for(let i=0;i<(casualty?12:1);i++){
  const current=battle.units.find(u=>u.id===actor.id),patient=battle.units.find(u=>u.id===patientId);if(patient.hp<=0)break;
  battle=actBattle(battle,current.loaded?{type:'firePoint',unitId:actor.id,x:patient.x,y:patient.y,aim:4}:{type:'reload',unitId:actor.id});assert.equal(battle.lastError,null,battle.lastError);
 }
 const patient=battle.units.find(u=>u.id===patientId);if(casualty)assert.equal(patient.hp,0);else assert.ok(patient.hp>0&&patient.hp<patient.maxHp&&patient.bleeding>0,JSON.stringify({hp:patient.hp,bleeding:patient.bleeding,log:battle.log}));
 const p=saved(sync({campaign:s,battle}));s=leave(p);return {campaign:saved({campaign:s}).campaign,patientId:Number(patient.id),body:patient,trainingCost};
}
