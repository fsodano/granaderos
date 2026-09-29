import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {actBattle,endTurn,getReachable} from '../game/tactical.js';
import {order,saved,sync} from './local-contract-fixture.mjs';
import {freshNorthernRoute} from './fresh-northern-fixture.mjs';
import {fight} from './cuyo-route-driver.mjs';

export function freshMendozaLoss(){
 let s=freshNorthernRoute().campaign;
 for(const sector of Object.keys(s.sectors).filter(id=>s.sectors[id].owner==='patriot'))s=order(s,{type:'fortify',sector});
 s=order(s,{type:'travel',sector:'cordoba'});s=order(s,{type:'recruitCivic',id:108,term:'week',destination:'cordoba'});s=order(s,{type:'wait',hours:6});
 for(const id of s.squad)for(const type of ['resupply','repairWeapon']){const n=dispatchCampaign(s,{type,operativeId:id});if(!n.lastError)s=n;}
 for(const id of s.squad){
  const op=rosterFor(s).find(o=>o.id===id);if(op.weapon===1802)continue;
  s=order(s,{type:'purchaseEquipment',item:'firearm-1801',quantity:1});const instance=s.armoryItems.find(i=>i.contentWeapon?.template===1801);assert.ok(instance);
  s=order(s,{type:'equip',operativeId:id,slot:'weapon',itemId:'firearm-1801',instanceId:instance.id});
 }
 s=saved({campaign:s}).campaign;assert.equal(s.hour,120);assert.equal(s.resources.treasury,2442);assert.equal(s.operativeState[2].alive,true);
 s=order(s,{type:'attack',sector:'mendoza'});const request={...s.pendingBattle,hour:s.hour,secondOfHour:s.secondOfHour??0};
 const {battle,orders,actions}=fight(request,s.sectorStates.mendoza,{scoutCostWeight:.01,avoidCivilians:true});assert.equal(battle.status,'victory');assert.ok(battle.npcs.find(n=>n.operativeId===2).hp>0);
 let p={campaign:s,battle:enterSector(request,s.sectorStates.mendoza)},deathCheckpoint;
 const execute=a=>{const battle=a.type==='endTurn'?endTurn(p.battle):actBattle(p.battle,a);assert.equal(battle.lastError,null);p=sync({campaign:p.campaign,battle});};
 for(let i=0;i<orders.length;i++){execute(orders[i]);if(i===Math.floor(orders.length/2))p=saved(p);}
 assert.deepEqual(p.battle.units,battle.units);assert.deepEqual(p.battle.npcs,battle.npcs);assert.equal(p.battle.seed,battle.seed);execute({type:'explore'});
 // A won battlefield cannot conceal a subsequent confirmed essential death.
 // Use actual movement and fatal orders, without inserting a prepared casualty.
 const engineer=()=>p.battle.npcs.find(n=>n.operativeId===2);
 const actor=p.battle.units.filter(u=>u.side==='player'&&u.hp>0&&!u.unconscious&&!u.routed).sort((a,b)=>b.hp-a.hp)[0];assert.ok(actor);
 for(let i=0;i<20&&engineer().hp>0;i++){
  const spot=getReachable(p.battle,actor.id).filter(t=>Math.abs(t.x-engineer().x)+Math.abs(t.y-engineer().y)===1).sort((a,b)=>a.cost-b.cost)[0];assert.ok(spot);if(spot.cost)execute({type:'move',unitId:actor.id,x:spot.x,y:spot.y});
  const attempt=actBattle(p.battle,{type:'melee',unitId:actor.id,targetId:engineer().id});if(!attempt.lastError)p=sync({campaign:p.campaign,battle:attempt});
 }
 assert.equal(engineer().hp,0);deathCheckpoint=saved(p);assert.ok(deathCheckpoint.campaign.defeated);
 s=saved({campaign:order(p.campaign,{type:'battleResult',battleId:request.id,outcome:'victory',sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')})}).campaign;
 return {campaign:s,deathCheckpoint,actions,turns:battle.turn};
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
 let battle=createBattle(r.squad.map(u=>({...u,x:1,y:u.id===110?1:6})),{width:12,height:8,id:r.id,sector:r.sector,npcs:r.npcs,seed:45,hour:s.hour,tiles:Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0})),enemies:[{id:'guard',x:7,y:1,weapon:1802,ammo:0,fatigue:100,marksmanship:100}]});
 battle=endTurn(battle);assert.equal(battle.units.find(u=>u.id==='110').hp,0);const active=saved(sync({campaign:s,battle}));
 s=saved({campaign:order(active.campaign,{type:'battleResult',battleId:r.id,outcome:'retreat',sectorState:active.battle,survivors:active.battle.units.filter(u=>u.side==='player')})}).campaign;
 return {campaign:s,active};
}
