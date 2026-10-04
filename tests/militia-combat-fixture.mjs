import assert from 'node:assert/strict';
import {woundedGarrison,MILITIA_DOCTOR as D} from './militia-care-fixture.mjs';
import {order,saved,sync,leave} from './local-contract-fixture.mjs';
import {createBattle,endTurn} from '../game/tactical.js';
export function combatMilitia(customize=()=>{}){
 const configure=d=>{d.weapons.push({...structuredClone(d.weapons.find(w=>w.id==='firearm-1805')),id:'militia-test-pistol',name:'Pistola de instrucción',damage:100,capacity:3,fireAP:8,range:24});d.militiaEquipment.green='militia-test-pistol';customize(d);};
 let {campaign:s,patientId:id}=woundedGarrison({configure,injuryDamage:38,medicalKits:5});s=order(s,{type:'assignCare',id:D,assignment:'militia_doctor'});s=order(s,{type:'wait',hours:2});s=order(s,{type:'wait',hours:3});s=order(s,{type:'assignCare',id:D,assignment:'active'});assert.equal(s.garrisons.retiro.find(u=>u.id===id).hp,44);if(s.hour%24<6)s=order(s,{type:'wait',hours:6-s.hour%24});return {s:saved({campaign:s}).campaign,id};
}
export function militiaEncounter(s,id){
 s=order(s,{type:'visitSector'});const r=s.pendingBattle;
 const enemies=[{id:'raider',name:'Asaltante',x:7,y:1,weapon:1812,blade:1812,ammo:0,hp:30,maxHp:30,morale:100,patrol:false}];
 r.enemies=createBattle([],{width:14,height:10,enemies}).units;
 // Ordinary autonomous fire in an explicitly declared compact encounter. A real
 // allied phase supplies the shot and casualty; no health/result/credit edit.
 let battle=createBattle([...r.squad.map((u,i)=>({...u,x:1,y:6+i})),...r.garrison.map((u,i)=>({...u,x:u.id===id?1:4+i*2,y:u.id===id?1:6}))],{...r,hour:s.hour,secondOfHour:s.secondOfHour??0,exploration:false,seed:45,lights:[{x:3,y:1,type:'campfire',radius:9,intensity:1}],weather:{rain:0,humidity:0},width:14,height:10,props:[],tiles:Array.from({length:140},(_,i)=>({x:i%14,y:Math.floor(i/14),type:Math.floor(i/14)===4?'wall':i%14===3?'window':'grass',blocked:Math.floor(i/14)===4||i%14===3,blocksSight:Math.floor(i/14)===4,cover:0})),enemies:r.enemies});
 return {s,battle};
}
export function militiaCombatReturn(campaign,id){
 let {s,battle}=militiaEncounter(campaign,id);battle=endTurn(battle);assert.equal(battle.lastError,null);assert.equal(battle.units.find(u=>u.side==='enemy').hp,0,JSON.stringify({log:battle.log,units:battle.units.map(u=>({id:u.id,x:u.x,y:u.y,hp:u.hp,ap:u.ap,loaded:u.loaded,overwatch:u.overwatch}))}));assert.equal(battle.status,'victory');
 const actual=structuredClone(battle.units.find(u=>Number(u.id)===id)),p=saved(sync({campaign:s,battle}));return {s:saved({campaign:leave(p)}).campaign,actual,battle:p.battle};
}
