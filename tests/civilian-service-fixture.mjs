import assert from 'node:assert/strict';
import {secondaryRetreat} from './secondary-loot-fixture.mjs';
import {initializeUnitAmmunition} from '../game/tactical-ammunition.js';
import {createBattle,actBattle,endTurn} from '../game/tactical.js';
import {travelLegHours} from '../game/squad-travel.js';
import {order,saved,sync,localId,readyLocal,leave,hireLocal,localPackage} from './local-contract-fixture.mjs';
const ledger=s=>s.civilianState.people[`person-${localId(s)}`];

export function woundedService({medical=18,casualty=false,term='day',careRules,contactHour,configure=()=>{}}={}){
 const d=localPackage({pay:300});if(careRules!==undefined)d.careRules=careRules;configure(d);d.characters.find(c=>c.id==='person-110').attributes.medical=medical;
 d.characters.find(c=>c.id==='alma-contract').attributes.maxHp=casualty?20:100;
 let p=hireLocal(readyLocal(undefined,d),term),s=order(leave(p),{type:'travel',sector:'retiro'});
 if(contactHour!==undefined){
  // Schedule the actual injury when its test needs a living handoff at expiry
  // or across midnight. Spend the extra time before the enemy inflicts it.
  const hours=Math.ceil(contactHour-travelLegHours(s.location,'buenos_aires')-s.hour);
  assert.ok(Number.isSafeInteger(hours)&&hours>=0,'the contact schedule must follow the actual return march');
  if(hours)s=order(s,{type:'wait',hours});
 }
 s=order(s,{type:'attack',sector:'buenos_aires'});
 if(contactHour!==undefined)assert.equal(s.hour,contactHour,'the paid approach must reach the scheduled combat hour');
 const id=localId(s),r=s.pendingBattle;
 // Paid deployment with compact barrier geometry to isolate a real enemy shot.
 // This is an injury handoff check, not an accepted capital-victory route.
 const tiles=Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,blocksSight:false,cover:0}));
 // Shield the doctor's cell on its two inward edges. The exposed local
 // remains in the enemy's actual firing lane at (1,1).
 const wallEdges=[{id:'doctor-south',x:0,y:1,axis:'x'},{id:'doctor-east',x:1,y:0,axis:'y'}].map(edge=>({...edge,type:'wall',material:'stone',blocked:true,blocksSight:true,cover:0}));
 Object.assign(r,{width:12,height:8,seed:45,tiles,wallEdges,enemies:[initializeUnitAmmunition({id:'guard',x:7,y:1,weapon:1805,ammo:0,marksmanship:100,fatigue:90})]});
 let battle=createBattle(r.squad.map(u=>({...u,x:u.id===id?1:0,y:u.id===id?1:0})),r);
 battle=actBattle(battle,{type:'weapon',unitId:id,slot:'supply',supplyKey:'torches'});assert.equal(battle.lastError,null);
 const before=battle.units.find(u=>Number(u.id)===id);
 battle=actBattle(battle,{type:'throwTorch',unitId:id,x:3,y:1});assert.equal(battle.lastError,null);
 battle=endTurn(battle);const patient=battle.units.find(u=>Number(u.id)===id);if(casualty)assert.equal(patient.hp,0);else assert.ok(patient.hp>0&&patient.hp<before.hp&&patient.bleeding>0);assert.equal(patient.torches,before.torches-1);
 p=secondaryRetreat(saved(sync({campaign:s,battle})));s=order(p.campaign,{type:'battleResult',battleId:r.id,outcome:'retreat',sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')});
 assert.equal(s.operativeState[id].hp,patient.hp);assert.equal(s.operativeState[id].bleeding,patient.bleeding);assert.equal(ledger(s).inService,true);assert.equal(ledger(s).health.hp,before.hp);
 return saved({campaign:s}).campaign;
}
