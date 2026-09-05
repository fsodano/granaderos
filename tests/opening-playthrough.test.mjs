import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchCampaign as dispatch} from '../game/campaign.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {buildSectorMap} from '../game/maps.js';
import {createBattle,actBattle,endTurn,getReachable,bladeFor,hasLineOfSight,shotChance} from '../game/tactical.js';
function fight(request){const map=buildSectorMap(request);let b=createBattle(map.squad,map),actions=0;
for(let round=0;round<80&&b.status==='active';round++){
for(const id of b.units.filter(u=>u.side==='player').map(u=>u.id)){
for(let attempt=0;attempt<20&&b.status==='active';attempt++){
const u=b.units.find(u=>u.id===id);if(u.hp<=0||u.routed||u.ap<6)break;
const targets=b.units.filter(t=>t.side==='enemy'&&t.hp>0&&!t.routed).sort((a,b)=>Math.hypot(a.x-u.x,a.y-u.y)-Math.hypot(b.x-u.x,b.y-u.y));const t=targets[0];if(!t)break;
const opts=[];if((u.bleeding||u.hp<u.maxHp-15)&&u.medkits)opts.push({type:'heal'});if(u.horse&&!u.mounted)opts.push({type:'mount'});
if(Math.hypot(t.x-u.x,t.y-u.y)<=bladeFor(u).reach)opts.push({type:'melee',targetId:t.id});

if(u.jammed)opts.push({type:'reprime'});
if(u.loaded&&hasLineOfSight(b,u,t)&&shotChance(b,u,t)>20)opts.push({type:'fire',targetId:t.id});
if(!u.loaded&&u.ammo)opts.push({type:'reload'});
opts.push({type:'charge',targetId:t.id});
const moves=getReachable(b,u).filter(p=>p.cost>0).sort((a,b)=>Math.hypot(a.x-t.x,a.y-t.y)-Math.hypot(b.x-t.x,b.y-t.y)||a.cost-b.cost);if(moves[0])opts.push({type:'move',x:moves[0].x,y:moves[0].y});
if(!u.loaded&&u.ammo)opts.push({type:'reload'});
let done=false;for(const a of opts){const n=actBattle(b,{...a,unitId:id});if(!n.lastError){b=n;actions++;done=true;break;}}if(!done)break;
}}
if(b.status==='active')b=endTurn(b);
}
return {battle:b,actions};}

test('legal authored-map opening campaign wins San Nicolás then San Lorenzo',()=>{
 let c=initialCampaign(7);const transcript=[];
 const order=a=>{c=dispatch(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+': '+c.lastError);};
 order({type:'academy'});order({type:'travel',sector:'buenos_aires'});
 for(const sector of ['san_nicolas','san_lorenzo']){
  if(sector==='san_lorenzo'){order({type:'travel',sector:'san_nicolas'});order({type:'wait',hours:120});}
  order({type:'attack',sector});const request=c.pendingBattle;
  const {battle:b,actions}=fight(request);
  assert.deepEqual(b,fight(request).battle,'identical seed and legal orders replay deterministically');
  assert.ok(actions>0);assert.ok(b.turn>1);
  assert.ok(b.units.filter(u=>u.side==='player').reduce((sum,u)=>sum+u.loaded+u.ammo,0)<request.issuedCartridges,'actual shots consume issued cartridges');
  transcript.push({sector,status:b.status,turn:b.turn,actions,units:b.units.map(u=>({id:u.id,hp:u.hp,energy:u.energy,ammo:u.ammo,loaded:u.loaded,routed:u.routed}))});
  assert.equal(b.status,'victory',JSON.stringify(transcript));
  order({type:'battleResult',battleId:request.id,outcome:b.status,survivors:b.units.filter(u=>u.side==='player'&&u.hp>0),sectorState:b});
 }
 assert.equal(c.operativeState[3].alive,false,'Cabral casualty persists across both battles');assert.deepEqual(c.squad,[4,10]);
 assert.equal(c.phase,2);assert.equal(c.flags.sanLorenzo,true);
 console.log('Opening playthrough:',JSON.stringify(transcript));
});
