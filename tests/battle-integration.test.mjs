import {totalReserveAmmunition} from '../game/ammunition-types.js';
import {stockAndCarriedAmmo,stockAmmo} from './ammunition-balance.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {contractQuote,rosterFor,dispatchCampaign as dispatch,serializeCampaign,restoreCampaign} from '../game/campaign.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {createBattle,actBattle,endTurn,interruptAvailable} from '../game/tactical.js';
const order=(c,a)=>{const next=dispatch(c,a);assert.equal(next.lastError,null,next.lastError);return next;};
function stage(seed,{reinforce=false}={}){
 let c=initialCampaign(seed);
 if(reinforce)for(const id of [110,113,115]){
  const resources={...c.resources},quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'week');
  c=order(c,{type:'recruitCivic',id,term:'week'});
  assert.deepEqual(c.resources,{...resources,treasury:resources.treasury-quote.price,ponchos:resources.ponchos-1},'the contract and issued poncho use existing resources');
  assert.equal(c.contracts[id].paid,quote.price);
 }
 c=order(c,{type:'travel',sector:'buenos_aires'});
 for(const operativeId of c.squad)c=order(c,{type:'setSleep',operativeId,asleep:true});
 // Assignment notices interrupt waits; continue the actual remaining hours.
 for(let attempt=0;c.hour<24&&attempt<20;attempt++)c=order(c,{type:'wait',hours:24-c.hour});
 assert.equal(c.hour,24);
 return order(c,{type:'attack',sector:'san_nicolas'});
}
// This small authored combat fixture verifies settlement, not campaign weather
// or the full-size opening route. Keep its original wet conditions explicit;
// regional-weather and the playthrough suites exercise real deployment weather.
function fight(seed=1812){
 // Territory now supplies nine defenders. Hire three reinforcements through
 // ordinary paid contracts; keep the actual enemy force and finite ammunition.
 const c=stage(seed,{reinforce:true});
 let b=createBattle(c.pendingBattle.squad,{...c.pendingBattle,regionalWeather:false,weather:{rain:40,humidity:8}}),actions=0;
 for(let window=0;window<600&&b.turn<=80&&b.status==='active';window++){
  const ids=b.units.filter(u=>u.side==='player').sort((a,c)=>c.marksmanship-a.marksmanship).map(u=>u.id);
  // Coordinate one order per soldier before issuing another, including each
  // interrupt window. An idle or ineligible soldier does not stop the squad.
  for(let attempt=0;attempt<20&&b.status==='active';attempt++){
   let acted=false;
   for(const id of ids){
    if(b.status!=='active')break;
    const u=b.units.find(u=>u.id===id);if(u.hp<=0||u.routed||u.ap<3||!interruptAvailable(b,u))continue;
    const action=chooseEnemyAction(b,u);if(!action)continue;
    b=actBattle(b,{...action,unitId:id});assert.equal(b.lastError,null,JSON.stringify(action));actions++;acted=true;
   }
   if(!acted)break;
  }
  if(b.status==='active'){b=endTurn(b);assert.equal(b.lastError,null);}
 }
 return {campaign:c,battle:b,actions};
}

test('a controlled wet-weather battle connects campaign resources, deterministic tactics and survivors',()=>{
  const {campaign,battle,actions}=fight();
  assert.equal(battle.status,'victory');
  assert.equal(battle.units.filter(u=>u.side==='enemy').length,campaign.pendingBattle.enemies.length);
  assert.ok(battle.turn>=2,'the enemy must have acted');
  assert.ok(actions>1);
  assert.deepEqual(battle,fight().battle,'same seed and orders replay exactly');
  const survivors=battle.units.filter(u=>u.side==='player'&&u.hp>0);
  const returned=survivors.reduce((sum,u)=>sum+u.loaded+totalReserveAmmunition(u),0);
  assert.ok(returned<campaign.pendingBattle.issuedCartridges,'the battle expended real ammunition');
  const result=dispatch(campaign,{type:'battleResult',battleId:campaign.pendingBattle.id,outcome:battle.status,sectorState:battle,survivors:battle.units.filter(u=>u.side==='player')});
  assert.equal(result.lastError,null);
  assert.equal(result.sectors.san_nicolas.owner,'patriot');
  assert.equal(result.pendingBattle,null);
  assert.equal(stockAndCarriedAmmo(result),stockAmmo(campaign)+returned+80);
  for(const u of survivors){assert.equal(result.operativeState[Number(u.id)].hp,u.hp);assert.equal(result.operativeState[Number(u.id)].alive,true);}
  const deaths=battle.units.filter(u=>u.side==='player'&&u.hp===0);
  assert.ok(deaths.length>0,'the victory retains its real casualties');
  for(const u of deaths){assert.equal(result.operativeState[Number(u.id)].alive,false);assert.equal(result.operativeState[Number(u.id)].hp,0);assert.ok(!result.squad.includes(Number(u.id)));}
  assert.deepEqual(restoreCampaign(serializeCampaign(result)),result);
});
test('real defeat preserves actual wounds and deaths in campaign operative IDs',()=>{
  const campaign=stage(17);
  let battle=createBattle(campaign.pendingBattle.squad,campaign.pendingBattle);
  for(let i=0;i<30&&battle.status==='active';i++)battle=endTurn(battle);
  assert.equal(battle.status,'defeat');
  assert.ok(battle.units.some(u=>u.side==='player'&&u.hp===0),'enemy actions must produce actual fatalities');
  const survivors=battle.units.filter(u=>u.side==='player'&&u.hp>0);
  const result=dispatch(campaign,{type:'battleResult',battleId:campaign.pendingBattle.id,outcome:battle.status,sectorState:battle,survivors:battle.units.filter(u=>u.side==='player')});
  assert.equal(result.lastError,null);
  assert.equal(result.sectors.san_nicolas.owner,'royalist');
  for(const u of battle.units.filter(u=>u.side==='player')){assert.equal(result.operativeState[Number(u.id)].hp,u.hp);assert.equal(result.operativeState[Number(u.id)].alive,u.hp>0);}
});
