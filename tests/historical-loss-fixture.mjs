import {scriptedWithdrawal} from './scripted-battle-report.mjs';
import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {actBattle,endTurn} from '../game/tactical.js';
import {approachNPC} from './approach-npc.mjs';
import {order,saved,sync} from './local-contract-fixture.mjs';
import {freshNorthernRoute} from './fresh-northern-fixture.mjs';
import {fight} from './opening-driver.mjs';
import {mendozaBatteryController} from './fresh-cuyo-fixture.mjs';
import {assembleCreatedCuyo,prepareCreatedMendozaAssault} from './created-cuyo-route.mjs';
import {recordRouteBattleFailure} from './route-failure-evidence.mjs';

export function freshMendozaLoss({northernCheckpoint,onCheckpoint,report=()=>{}}={}){
 const northern=northernCheckpoint??freshNorthernRoute({onCheckpoint,report}).campaign;
 assert.equal(northern.phase,3);assert.equal(northern.missions.yatasto.completed,true);assert.equal(northern.flags.northPact,true);
 let s=prepareCreatedMendozaAssault(assembleCreatedCuyo(northern,{report}),{report});
 assert.equal(s.operativeState[2].alive,true);
 const request={...s.pendingBattle,hour:s.hour,secondOfHour:s.secondOfHour??0};
 const controller=mendozaBatteryController(enterSector(request,s.sectorStates.mendoza));
 onCheckpoint?.('historical-mendoza-ready',s);
 const result=fight(request,s.sectorStates.mendoza,{controller}),{battle,orders,actions}=result;
 if(battle.status!=='victory')recordRouteBattleFailure({campaign:s,request,previous:s.sectorStates.mendoza,result,expectedOutcome:'victory',controller,executeBattle:fight,failureStage:'historical-mendoza-victory'});
 assert.equal(battle.status,'victory');assert.ok(battle.npcs.find(n=>n.operativeId===2).hp>0);
 let p={campaign:s,battle:enterSector(request,s.sectorStates.mendoza)},deathCheckpoint;
 const execute=a=>{const battle=a.type==='endTurn'?endTurn(p.battle):actBattle(p.battle,a);assert.equal(battle.lastError,null);p=sync({campaign:p.campaign,battle});};
 const requirePreInjury=()=>{
  const commander=p.battle.npcs.find(n=>n.operativeId===57),engineer=p.battle.npcs.find(n=>n.operativeId===2);
  const isolated=p.campaign.defeated===false&&p.campaign.completed===false&&[57,2].every(id=>p.campaign.operativeState[id].alive===true&&p.campaign.operativeState[id].hp>0)&&commander?.hp>0&&engineer?.hp>0;
  // The combat tape does not include the later approach. Retain the actual
  // checkpoint without presenting a partial tape as its complete history.
  if(!isolated)recordRouteBattleFailure({campaign:p.campaign,request:p.campaign.pendingBattle,previous:p.campaign.sectorStates.mendoza,result:{battle:p.battle},expectedOutcome:'victory',controller,executeBattle:fight,failureStage:'historical-engineer-pre-injury'});
  assert.equal(p.campaign.defeated,false,'the engineer injury needs a playable campaign');assert.equal(p.campaign.completed,false);
  for(const id of [57,2]){assert.equal(p.campaign.operativeState[id].alive,true);assert.ok(p.campaign.operativeState[id].hp>0);}
  assert.ok(commander?.hp>0,'the commander must survive before the intentional engineer injury');assert.ok(engineer?.hp>0);
 };
 for(let i=0;i<orders.length;i++){execute(orders[i]);if(i===Math.floor(orders.length/2))p=saved(p);}
 assert.deepEqual(p.battle.units,battle.units);assert.deepEqual(p.battle.npcs,battle.npcs);assert.deepEqual(p.battle.artillery,battle.artillery);assert.deepEqual(p.battle.wallEdges,battle.wallEdges);assert.equal(p.battle.seed,battle.seed);requirePreInjury();
 const combatCheckpoint=saved(p);onCheckpoint?.('historical-mendoza-victory',combatCheckpoint.campaign,combatCheckpoint.battle);execute({type:'explore'});
 // A won battlefield cannot conceal a subsequent confirmed essential death.
 // Use actual movement and fatal orders, without inserting a prepared casualty.
 const engineer=()=>p.battle.npcs.find(n=>n.operativeId===2),injuryOrders=[];
 const actor=p.battle.units.filter(u=>u.side==='player'&&u.hp>0&&!u.unconscious&&!u.routed).sort((a,b)=>b.hp-a.hp)[0];assert.ok(actor);
 if(actor.stance!=='standing')execute({type:'stance',unitId:actor.id,stance:'standing'});
 if(p.battle.units.find(u=>u.id===actor.id).activeSlot!=='blade')execute({type:'weapon',unitId:actor.id,slot:'blade'});
 for(let i=0;i<20&&engineer().hp>0;i++){
  p=sync({campaign:p.campaign,battle:approachNPC(p.battle,actor.id,engineer().id)});
  if(i===0)requirePreInjury();
  const action={type:'melee',unitId:actor.id,targetId:engineer().id,targetKind:'npc'};execute(action);injuryOrders.push(action);
 }
 assert.equal(engineer().hp,0);deathCheckpoint=saved(p);assert.ok(deathCheckpoint.campaign.defeated);
 s=saved({campaign:order(p.campaign,{type:'battleResult',battleId:request.id,outcome:'victory',sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')})}).campaign;
 return {campaign:s,combatCheckpoint,deathCheckpoint,injuryOrders,actions,turns:battle.turn};
}

// Authored starting control and a compact engagement isolate the role/death
// boundary. Hiring, project payment, enemy fire and settlement are real actions.
export async function servingEngineerLoss({built=false,custom=false}={}){
 const {initialCampaign}=await import('../game/campaign.js');const {defaultContentPackage}=await import('../game/content-package.js');const {defaultCampaignStory}=await import('../game/campaign-story.js');const {createBattle}=await import('../game/tactical.js');
 const d=defaultContentPackage();d.startingTerritory.buenos_aires.owner='patriot';d.campaignRoles={foundryEngineer:'person-110',marchCommander:'person-57'};d.foundry={sector:'retiro',name:'Taller del Retiro',armyName:'Ejército de Prueba',setupCost:137,fundingCost:809};
 for(const id of ['person-110','person-136'])d.characters.find(c=>c.id===id).arrivalHours=0;
 d.characters.find(c=>c.id==='person-110').attributes.maxHp=30;
 if(custom){d.campaignStory=defaultCampaignStory();d.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];}
 let s=order(initialCampaign(8,d),{type:'recruitCivic',id:110,term:'week'});s=order(s,{type:'recruitCivic',id:136,term:'week'});
 if(built){const money=s.resources.treasury;s=order(s,{type:'foundry'});assert.equal(s.resources.treasury,money-137);}
 s=order(s,{type:'travel',sector:'buenos_aires'});s=order(s,{type:'attack',sector:'san_nicolas'});const r=s.pendingBattle;
 let battle=createBattle(r.squad.map(u=>({...u,x:u.id===110?5:1,y:u.id===110?1:6})),{...r,width:12,height:8,seed:45,tiles:Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:Math.floor(i/12)===4?'wall':'grass',blocked:Math.floor(i/12)===4,blocksSight:Math.floor(i/12)===4,cover:0})),enemies:r.enemies.map((u,i)=>({...u,x:7,y:i%8,...(i?{hp:0,bleeding:0,bandaged:0}:{y:1,marksmanship:100})}))});
 const preInjury={campaign:structuredClone(s),battle:structuredClone(battle)};
 battle=endTurn(battle);assert.equal(battle.units.find(u=>u.id==='110').hp,0);const active=saved(sync({campaign:s,battle}));
 const returned=sync({campaign:active.campaign,battle:scriptedWithdrawal(active.battle)});
 s=saved({campaign:order(returned.campaign,{type:'battleResult',battleId:r.id,outcome:'retreat',sectorState:returned.battle,survivors:returned.battle.units.filter(u=>u.side==='player')})}).campaign;
 return {campaign:s,active,preInjury};
}
