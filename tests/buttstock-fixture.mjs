import {defaultContentPackage} from '../game/content-package.js';
import {initialCampaign} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {createBattle} from '../game/tactical.js';
import {order,saved,sync} from './local-contract-fixture.mjs';

export function buttstockField({stock={}}={}){
 const d=defaultContentPackage();
 Object.assign(d.weapons.find(w=>w.id==='firearm-1800'),{name:'Fusil de Acosta',art:'/art/weapon-1801.png',damage:61,weight:4.8,...stock});
 Object.assign(d.characters.find(c=>c.id==='person-110'),{arrivalHours:0,blade:'blade-1809'});
 let campaign=order(initialCampaign(45,d),{type:'recruitCivic',id:110,term:'week'});
 campaign=order(campaign,{type:'attack',sector:'buenos_aires'});
 const request=campaign.pendingBattle,enemies=enterSector(request).units.filter(u=>u.side==='enemy');
 // A real paid deployment in declared compact geometry. No assigned hit or kill.
 const tiles=Array.from({length:120},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0}));
 const battle=createBattle(request.squad.map(u=>({...u,x:1,y:1})),{...request,width:12,height:10,tiles,enemies:[{...enemies[0],x:2,y:1,patrolOrigin:{x:2,y:1}},{...enemies[1],x:11,y:9,patrolOrigin:{x:11,y:9}}],seed:45});
 return {...saved(sync({campaign,battle})),target:battle.units.find(u=>u.side==='enemy').id};
}
