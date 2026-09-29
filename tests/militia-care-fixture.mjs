import assert from 'node:assert/strict';
import {defaultContentPackage} from '../game/content-package.js';
import {initialCampaign} from '../game/campaign.js';
import {createBattle,endTurn} from '../game/tactical.js';
import {order,saved,sync,leave} from './local-contract-fixture.mjs';
export const MILITIA_DOCTOR=112,SECOND_MILITIA_DOCTOR=137;
export function woundedGarrison({twoDoctors=false,casualty=false,careRules,passage=false,headquarters='retiro',configure=()=>{}}={}){
 const d=defaultContentPackage();d.rules.startingTreasury=10000;for(const sector of ['buenos_aires','ensenada'])d.startingTerritory[sector]={owner:'patriot',loyalty:65};if(careRules)d.careRules=careRules;if(headquarters!=='retiro'){d.headquarters=headquarters;d.startingTerritory[headquarters]={owner:'patriot',loyalty:65};}
 for(const id of [MILITIA_DOCTOR,SECOND_MILITIA_DOCTOR]){const c=d.characters.find(c=>c.id===`person-${id}`);c.arrivalHours=0;c.attributes.medical=id===MILITIA_DOCTOR?80:60;c.attributes.leadership=50;}
 configure(d);
 let s=order(initialCampaign(42,d),{type:'createOfficer',name:'Isabel del Valle',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});
 for(const id of twoDoctors?[MILITIA_DOCTOR,SECOND_MILITIA_DOCTOR]:[MILITIA_DOCTOR])s=order(s,{type:'recruitCivic',id,term:'month'});
 const cost=s.resources.treasury;s=order(s,{type:'militia',trainerId:1000,rank:0});assert.ok(s.resources.treasury<cost);const trainingCost=cost-s.resources.treasury;s=order(s,{type:'wait',hours:s.militiaTraining[0].remaining});s=order(s,{type:'visitSector'});const r=s.pendingBattle;
 // Authored controlled capital, paid training and an actual enemy phase in compact barrier geometry.
 // The declared ambush gives enemies the first phase. Return before the allied
 // response so a critical patient cannot earn a rank in this care fixture.
 // This isolates local garrison care, not a newly accepted defense route.
 const troops=[...r.squad.map((u,i)=>({...u,x:1,y:6+i})),...r.garrison.map((u,i)=>({...u,x:i===0?1:4+i*2,y:i===0?1:6}))];
 let battle=createBattle(troops,{id:r.id,sector:r.sector,npcs:r.npcs,firstSide:'enemy',width:14,height:10,seed:45,tiles:Array.from({length:140},(_,i)=>({x:i%14,y:Math.floor(i/14),type:Math.floor(i/14)===4&&(!passage||i%14!==13)?'wall':'grass',blocked:Math.floor(i/14)===4&&(!passage||i%14!==13),blocksSight:Math.floor(i/14)===4&&(!passage||i%14!==13),cover:0})),enemies:[casualty?{id:'raider',x:2,y:1,weapon:1812,blade:1812,ammo:0,strength:95,agility:95,hp:100,maxHp:100}:{id:'guard',x:7,y:1,weapon:1803,ammo:0,fatigue:100,marksmanship:100}]});
 if(casualty)battle=endTurn(battle);const patient=battle.units.find(u=>u.militia&&Number(u.id)===r.garrison[0].id);if(casualty)assert.equal(patient.hp,0);else assert.ok(patient.hp>0&&patient.hp<patient.maxHp&&patient.bleeding>0,JSON.stringify({hp:patient.hp,bleeding:patient.bleeding}));
 const p=saved(sync({campaign:s,battle}));s=leave(p);return {campaign:saved({campaign:s}).campaign,patientId:Number(patient.id),body:patient,trainingCost};
}
