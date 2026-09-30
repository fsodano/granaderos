import assert from 'node:assert/strict';
import {defaultContentPackage} from '../game/content-package.js';
import {initialCampaign} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {createBattle,actBattle,getReachable} from '../game/tactical.js';
import {order,saved,sync} from './local-contract-fixture.mjs';
export const secondaryName='Sable del Regimiento';
export function secondaryLootField({companion=false,sameFirearm=false}={}){
 const d=defaultContentPackage(),source=d.weapons.find(w=>w.id==='blade-1809');Object.assign(source,{name:secondaryName,art:'/art/weapon-1810.png',damage:23,ap:18,reach:1.7,weight:2.5});
 const own=d.weapons.find(w=>w.id==='blade-1812');Object.assign(own,{damage:100,ap:8,reach:3});d.oppositionBlades={officer:'blade-1809',line:'blade-1809',veteran:'blade-1809'};
 const c=d.characters.find(c=>c.id==='person-110');c.arrivalHours=0;c.blade='blade-1812';
 if(companion){const second=d.characters.find(c=>c.id==='person-111');second.arrivalHours=0;if(sameFirearm)second.weapon=c.weapon;}
 let s=order(initialCampaign(45,d),{type:'recruitCivic',id:110,term:'week'});if(companion)s=order(s,{type:'recruitCivic',id:111,term:'week'});s=order(s,{type:'attack',sector:'buenos_aires'});const request=s.pendingBattle,field=enterSector(request),enemies=field.units.filter(u=>u.side==='enemy');
 // Actual paid attack and issued troop equipment, in declared compact geometry.
 // Keep one distant opponent so looting spends combat AP after the real kill.
 const tiles=Array.from({length:400},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',blocked:false,cover:0}));
 let battle=createBattle(request.squad.map((u,i)=>({...u,x:1,y:i?0:1,activeSlot:'blade'})),{...request,width:20,height:20,tiles,enemies:enemies.map((u,i)=>({...u,x:i?19:2,y:i?19-i:1,patrolOrigin:{x:i?19:2,y:i?19-i:1},overwatch:false})),seed:45});
 const target=battle.units.find(u=>u.side==='enemy').id;
 for(let i=0;i<3&&battle.units.find(u=>u.id===target).hp>0;i++){battle=actBattle(battle,{type:'melee',unitId:'110',targetId:target});assert.equal(battle.lastError,null);}
 assert.equal(battle.units.find(u=>u.id===target).hp,0);return {...saved(sync({campaign:s,battle})),target};
}
export function secondaryOrder(pair,action){const battle=actBattle(pair.battle,{unitId:'110',...action});assert.equal(battle.lastError,null,battle.lastError);return {...sync({campaign:pair.campaign,battle}),target:pair.target};}

// Complete a real boundary withdrawal before submitting a campaign report.
export function secondaryRetreat(pair){
 let p=pair;const exit=p.battle.exits.find(e=>e.destination===p.campaign.pendingBattle.origin);assert.ok(exit);const onEdge=u=>exit.edge==='N'?u.y===0:exit.edge==='S'?u.y===p.battle.height-1:exit.edge==='W'?u.x===0:u.x===p.battle.width-1;
 for(const id of p.battle.units.filter(u=>u.side==='player'&&u.hp>0&&!u.departure).map(u=>u.id)){
  const u=p.battle.units.find(u=>u.id===id);
  if(!onEdge(u)){const destination=getReachable(p.battle,u).filter(q=>onEdge(q)&&!p.battle.units.some(v=>v.id!==id&&v.hp>0&&!v.departure&&v.x===q.x&&v.y===q.y)).sort((a,b)=>a.cost-b.cost)[0];assert.ok(destination);p=secondaryOrder(p,{type:'move',unitId:id,x:destination.x,y:destination.y});}
  p=secondaryOrder(p,{type:'exit',unitIds:[id],exitId:exit.id});
 }
 assert.equal(p.battle.status,'retreat');return p;
}
