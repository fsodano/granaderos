import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchCampaign as dispatch,serializeCampaign,restoreCampaign} from '../game/campaign.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {createBattle,actBattle,endTurn,getReachable,bladeFor,hasLineOfSight,shotChance} from '../game/tactical.js';
function fight(seed=1812){
let c=dispatch(dispatch(initialCampaign(seed),{type:'travel',sector:'buenos_aires'}),{type:'attack',sector:'san_nicolas'});if(c.lastError)throw Error(c.lastError);let b=createBattle(c.pendingBattle.squad,c.pendingBattle);let actions=1;b=actBattle(b,{type:'fire',unitId:4,targetId:'enemy-0',aim:2});b=endTurn(b);
for(let round=0;round<30&&b.status==='active';round++){
for(const id of b.units.filter(u=>u.side==='player').map(u=>u.id)){
for(let attempt=0;attempt<20&&b.status==='active';attempt++){
const u=b.units.find(u=>u.id===id);if(u.hp<=0||u.routed||u.ap<6)break;
const targets=b.units.filter(t=>t.side==='enemy'&&t.hp>0&&!t.routed).sort((a,b)=>Math.hypot(a.x-u.x,a.y-u.y)-Math.hypot(b.x-u.x,b.y-u.y));const t=targets[0];if(!t)break;
const opts=[];if(u.bleeding&&u.medkits)opts.push({type:'heal'});if(u.horse&&!u.mounted)opts.push({type:'mount'});
if(Math.hypot(t.x-u.x,t.y-u.y)<=bladeFor(u).reach)opts.push({type:'melee',targetId:t.id});
opts.push({type:'charge',targetId:t.id});
if(u.jammed)opts.push({type:'reprime'});
if(u.loaded&&hasLineOfSight(b,u,t)&&shotChance(b,u,t)>45)opts.push({type:'fire',targetId:t.id});
const moves=getReachable(b,u).filter(p=>p.cost>0).sort((a,b)=>Math.hypot(a.x-t.x,a.y-t.y)-Math.hypot(b.x-t.x,b.y-t.y)||a.cost-b.cost);if(moves[0])opts.push({type:'move',x:moves[0].x,y:moves[0].y});
if(!u.loaded&&u.ammo)opts.push({type:'reload'});
let done=false;for(const a of opts){const n=actBattle(b,{...a,unitId:id});if(!n.lastError){b=n;actions++;done=true;break;}}if(!done)break;
}}
if(b.status==='active')b=endTurn(b);
}
return {campaign:c,battle:b,actions};
}

test('actual opening battle connects campaign resources, deterministic tactics and survivors',()=>{
  const {campaign,battle,actions}=fight();
  assert.equal(battle.status,'victory');
  assert.ok(battle.turn>=2,'the enemy must have acted');
  assert.ok(actions>1);
  assert.deepEqual(battle,fight().battle,'same seed and orders replay exactly');
  const survivors=battle.units.filter(u=>u.side==='player'&&u.hp>0);
  const returned=survivors.reduce((sum,u)=>sum+u.loaded+u.ammo,0);
  assert.ok(returned<campaign.pendingBattle.issuedCartridges,'the battle expended real ammunition');
  const result=dispatch(campaign,{type:'battleResult',battleId:campaign.pendingBattle.id,outcome:battle.status,survivors});
  assert.equal(result.lastError,null);
  assert.equal(result.sectors.san_nicolas.owner,'patriot');
  assert.equal(result.pendingBattle,null);
  assert.equal(result.resources.treasury,campaign.resources.treasury+returned+250);
  for(const u of survivors){assert.equal(result.operativeState[Number(u.id)].hp,u.hp);assert.equal(result.operativeState[Number(u.id)].alive,true);}
  assert.deepEqual(restoreCampaign(serializeCampaign(result)),result);
});
test('real defeat preserves actual wounds and deaths in campaign operative IDs',()=>{
  const campaign=dispatch(dispatch(initialCampaign(17),{type:'travel',sector:'buenos_aires'}),{type:'attack',sector:'san_nicolas'});
  let battle=createBattle(campaign.pendingBattle.squad,campaign.pendingBattle);
  for(let i=0;i<30&&battle.status==='active';i++)battle=endTurn(battle);
  assert.equal(battle.status,'defeat');
  assert.ok(battle.units.some(u=>u.side==='player'&&u.hp===0),'enemy actions must produce actual fatalities');
  const survivors=battle.units.filter(u=>u.side==='player'&&u.hp>0);
  const result=dispatch(campaign,{type:'battleResult',battleId:campaign.pendingBattle.id,outcome:battle.status,survivors});
  assert.equal(result.lastError,null);
  assert.equal(result.sectors.san_nicolas.owner,'royalist');
  for(const u of battle.units.filter(u=>u.side==='player')){assert.equal(result.operativeState[Number(u.id)].hp,u.hp);assert.equal(result.operativeState[Number(u.id)].alive,u.hp>0);}
});
