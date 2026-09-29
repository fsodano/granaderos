import assert from 'node:assert/strict';
import {defaultContentPackage} from '../game/content-package.js';
import {initialCampaign} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {createBattle,actBattle} from '../game/tactical.js';
import {order,saved,sync} from './local-contract-fixture.mjs';
export const secondaryName='Sable del Regimiento';
export function secondaryLootField(){
 const d=defaultContentPackage(),source=d.weapons.find(w=>w.id==='blade-1809');Object.assign(source,{name:secondaryName,art:'/art/weapon-1810.png',damage:23,ap:18,reach:1.7,weight:2.5});
 const own=d.weapons.find(w=>w.id==='blade-1812');Object.assign(own,{damage:100,ap:8,reach:3});d.oppositionBlades={officer:'blade-1809',line:'blade-1809',veteran:'blade-1809'};
 const c=d.characters.find(c=>c.id==='person-110');c.arrivalHours=0;c.blade='blade-1812';
 let s=order(initialCampaign(45,d),{type:'recruitCivic',id:110,term:'week'});s=order(s,{type:'attack',sector:'buenos_aires'});const request=s.pendingBattle,field=enterSector(request),enemies=field.units.filter(u=>u.side==='enemy');
 // Actual paid attack and issued troop equipment, in declared compact geometry.
 // Keep one distant opponent so looting spends combat AP after the real kill.
 const tiles=Array.from({length:120},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0}));
 let battle=createBattle(request.squad.map(u=>({...u,x:1,y:1,activeSlot:'blade'})),{...request,width:12,height:10,tiles,enemies:[{...enemies[0],x:2,y:1,patrolOrigin:{x:2,y:1},overwatch:false},{...enemies[1],x:11,y:9,patrolOrigin:{x:11,y:9},overwatch:false}],seed:45});
 const target=battle.units.find(u=>u.side==='enemy').id;
 for(let i=0;i<3&&battle.units.find(u=>u.id===target).hp>0;i++){battle=actBattle(battle,{type:'melee',unitId:'110',targetId:target});assert.equal(battle.lastError,null);}
 assert.equal(battle.units.find(u=>u.id===target).hp,0);return {...saved(sync({campaign:s,battle})),target};
}
export function secondaryOrder(pair,action){const battle=actBattle(pair.battle,{unitId:'110',...action});assert.equal(battle.lastError,null,battle.lastError);return {...sync({campaign:pair.campaign,battle}),target:pair.target};}
