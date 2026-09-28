import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn} from '../game/tactical.js';
import {order,saved,sync,localId,readyLocal,leave,hireLocal,localPackage} from './local-contract-fixture.mjs';
const ledger=s=>s.civilianState.people[`person-${localId(s)}`];

export function woundedService({medical=18,casualty=false,term='day',careRules,configure=()=>{}}={}){
 const d=localPackage({pay:300});if(careRules!==undefined)d.careRules=careRules;configure(d);d.characters.find(c=>c.id==='person-110').attributes.medical=medical;
 if(casualty)d.characters.find(c=>c.id==='alma-contract').attributes.maxHp=20;
 let p=hireLocal(readyLocal(undefined,d),term),s=order(leave(p),{type:'travel',sector:'retiro'});s=order(s,{type:'attack',sector:'buenos_aires'});
 const id=localId(s),r=s.pendingBattle;
 // Paid deployment with compact barrier geometry to isolate a real enemy shot.
 // This is an injury handoff check, not an accepted capital-victory route.
 let battle=createBattle(r.squad.map(u=>({...u,x:1,y:u.id===id?1:6})),{id:r.id,sector:r.sector,npcs:r.npcs,width:12,height:8,seed:45,tiles:Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:Math.floor(i/12)===4?'wall':'grass',blocked:Math.floor(i/12)===4,blocksSight:Math.floor(i/12)===4,cover:0})),enemies:[{id:'guard',x:7,y:1,weapon:1805,ammo:0,fatigue:100,marksmanship:100}]});
 const before=battle.units.find(u=>Number(u.id)===id);
 battle=actBattle(battle,{type:'throwTorch',unitId:id,x:3,y:1});assert.equal(battle.lastError,null);
 battle=endTurn(battle);const patient=battle.units.find(u=>Number(u.id)===id);if(casualty)assert.equal(patient.hp,0);else assert.ok(patient.hp>0&&patient.hp<before.hp&&patient.bleeding>0);assert.equal(patient.torches,before.torches-1);
 p=saved(sync({campaign:s,battle}));s=order(p.campaign,{type:'battleResult',battleId:r.id,outcome:'retreat',sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')});
 assert.equal(s.operativeState[id].hp,patient.hp);assert.equal(s.operativeState[id].bleeding,patient.bleeding);assert.equal(ledger(s).inService,true);assert.equal(ledger(s).health.hp,before.hp);
 return saved({campaign:s}).campaign;
}

