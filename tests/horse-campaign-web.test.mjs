import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign as dispatch,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {buildSectorMap} from '../game/maps.js';
import {createBattle} from '../game/tactical.js';
import {GESTATION_HOURS} from '../game/horses.js';
const order=(s,a)=>{const n=dispatch(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const horse=(s,request)=>order(s,{type:'horseAction',order:request});
test('individual mounts cost real silver and remain separate from remount reserves',()=>{
 let s=initialCampaign();const reserve=s.resources.horses;s=horse(s,{type:'acquire',name:'Moro',sex:'stallion',funds:999999});assert.equal(s.resources.treasury,3020);assert.equal(s.resources.horses,reserve);s=horse(s,{type:'assign',horseId:'horse-1',operativeId:3});s=order(s,{type:'visitSector'});assert.equal(s.pendingBattle.squad.find(o=>o.id===3).mount.id,'horse-1');assert.equal(s.pendingBattle.squad.find(o=>o.id===4).horse,false);
});
test('travel preserves horse identity, moves its location and spends stamina',()=>{
 let s=horse(initialCampaign(),{type:'acquire',name:'Mora',sex:'mare'});s=horse(s,{type:'assign',horseId:'horse-1',operativeId:3});s=order(s,{type:'travel',sector:'buenos_aires'});assert.equal(s.horseState.horses[0].location,'buenos_aires');assert.ok(s.horseState.horses[0].stamina<100);assert.equal(s.horseState.hour,s.hour);assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);
});
test('returned tactical mount stamina survives subsequent sector visits',()=>{
 let s=horse(initialCampaign(),{type:'hire',name:'Bayo'});s=horse(s,{type:'assign',horseId:'horse-1',operativeId:3});s=order(s,{type:'visitSector'});const map=buildSectorMap(s.pendingBattle),battle=createBattle(map.squad,map);battle.units.find(u=>u.id==='3').mount.stamina=30;
 s=order(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:battle,survivors:battle.units.map(u=>({...u,id:Number(u.id)}))});assert.equal(s.horseState.horses[0].stamina,30);s=order(s,{type:'visitSector'});assert.equal(s.pendingBattle.squad.find(o=>o.id===3).mount.stamina,30);
});
test('breeding uses campaign calendar and cannot produce immediate usable horses',()=>{
 let s=horse(initialCampaign(),{type:'acquire',name:'Mora',sex:'mare'});s=horse(s,{type:'acquire',name:'Moro',sex:'stallion'});s=horse(s,{type:'breed',horseId:'horse-1',sireId:'horse-2'});assert.equal(s.horseState.horses[0].pregnantUntil,s.hour+GESTATION_HOURS);s=order(s,{type:'wait',hours:240});assert.equal(s.horseState.horses.length,2);assert.equal(s.horseState.hour,s.hour);
});
test('old saves migrate without inventing personal mounts and malformed ownership rejects',()=>{
 const old=initialCampaign();delete old.horseState;const migrated=restoreCampaign(JSON.stringify(old));assert.equal(migrated.horseState.horses.length,0);let s=horse(initialCampaign(),{type:'acquire',name:'Moro'});s.horseState.horses[0].assignedTo=999;assert.throws(()=>restoreCampaign(serializeCampaign(s)));
});
test('victory preserves peaceful calendar and mature breeding without raids or defeat',()=>{
 let s=initialCampaign();s.completed=true;s.phase=4;for(const region of Object.values(s.sectors)){region.owner='patriot';region.loyalty=0;}
 s=horse(s,{type:'acquire',name:'Mora',sex:'mare'});s=horse(s,{type:'acquire',name:'Moro',sex:'stallion'});s=horse(s,{type:'breed',horseId:'horse-1',sireId:'horse-2'});
 const end=(330+3*365)*24;
 while(s.hour<end){if(s.hour%720===0)for(const h of s.horseState.horses)s=horse(s,{type:'feed',horseId:h.id,days:30});s=order(s,{type:'wait',hours:Math.min(240,end-s.hour)});}
 assert.equal(s.hour,end);assert.equal(s.completed,true);assert.equal(s.defeated,false);assert.equal(s.blockade,false);assert.ok(Object.values(s.sectors).every(r=>r.owner==='patriot'));assert.equal(s.horseState.horses.length,3);
 s=horse(s,{type:'assign',horseId:'horse-3',operativeId:3});assert.equal(s.horseState.horses[2].assignedTo,3);
 assert.ok(dispatch(s,{type:'attack',sector:'san_nicolas'}).lastError);
 s=order(s,{type:'travel',sector:'buenos_aires'});s=order(s,{type:'visitSector'});assert.equal(s.pendingBattle.exploration,true);
});
test('defeat remains terminal even for peaceful horse and wait orders',()=>{
 const s=initialCampaign();s.defeated=true;assert.ok(dispatch(s,{type:'wait',hours:24}).lastError);assert.ok(dispatch(s,{type:'horseAction',order:{type:'acquire'}}).lastError);assert.equal(dispatch(s,{type:'wait',hours:24}).hour,0);
});
