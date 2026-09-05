import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {enterSector} from '../game/world.js';import {endTurn,actBattle,createBattle} from '../game/tactical.js';
const step=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
function trained(){let s=step(initialCampaign(),{type:'createOfficer',name:'Isabel del Valle',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});s=step(s,{type:'militia',trainerId:1000,rank:0});return step(s,{type:'wait',hours:s.militiaTraining[0].remaining});}
const leave=(s,b)=>step(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player').map(u=>({...u,id:Number(u.id)}))});
test('trained local militia become real allied soldiers and retain finite ammo across visits',()=>{
 let s=trained();const stock=s.resources.cartridges;s=step(s,{type:'visitSector'});assert.equal(s.pendingBattle.garrison.length,3);let b=enterSector(s.pendingBattle);const militia=b.units.filter(u=>u.militia);assert.equal(militia.length,3);assert.equal(new Set(b.units.map(u=>`${u.x},${u.y}`)).size,b.units.length);const ids=militia.map(u=>u.id);s=leave(s,b);assert.equal(s.resources.cartridges,stock-18);s=restoreCampaign(serializeCampaign(s));s=step(s,{type:'visitSector'});b=enterSector(s.pendingBattle,s.sectorStates.retiro);assert.deepEqual(b.units.filter(u=>u.militia).map(u=>u.id),ids);s=leave(s,b);assert.equal(s.resources.cartridges,stock-18);s=step(s,{type:'travel',sector:'buenos_aires'});s=step(s,{type:'visitSector'});assert.equal(s.pendingBattle.garrison.length,0);
});
test('actual tactical militia casualties reduce strategic counts and never respawn on reload',()=>{
 let s=trained();s=step(s,{type:'visitSector'});const request=s.pendingBattle;
 const squad=[...request.squad.map(u=>({...u,x:1,y:1})),...request.garrison.map((u,i)=>({...u,x:8,y:3+i}))];
 let b=createBattle(squad,{id:'retiro',width:14,height:10,tiles:Array.from({length:140},(_,i)=>({x:i%14,y:Math.floor(i/14),type:'grass',blocked:false,cover:0})),enemies:[{id:'raider',name:'Asaltante realista',x:9,y:3,weapon:1812,blade:1812,strength:95,agility:95,hp:100,maxHp:100}]});
 b=endTurn(b);const killed=b.units.filter(u=>u.militia&&u.hp<=0);assert.ok(killed.length>0,'The real enemy phase must kill at least one nearby militia soldier');s=leave(s,b);assert.equal(s.sectors.retiro.militia[0],3-killed.length);s=restoreCampaign(serializeCampaign(s));s=step(s,{type:'visitSector'});const next=enterSector(s.pendingBattle,s.sectorStates.retiro);assert.equal(next.units.filter(u=>u.militia&&u.hp>0).length,3-killed.length);assert.ok(killed.every(dead=>next.units.some(u=>u.id===dead.id&&u.hp===0)));
});
test('garrison deployment requires complete casualty snapshots and validates saved records',()=>{
 let s=trained();s=step(s,{type:'visitSector'});const b=enterSector(s.pendingBattle);b.units=b.units.filter(u=>!u.militia);assert.ok(dispatchCampaign(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:b,survivors:b.units.map(u=>({...u,id:Number(u.id)}))}).lastError);const corrupted=structuredClone(s);corrupted.garrisons.retiro[0].ammo=-1;assert.throws(()=>restoreCampaign(serializeCampaign(corrupted)));
});
