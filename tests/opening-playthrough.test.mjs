import {fight} from './cuyo-route-driver.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchCampaign as dispatch} from '../game/campaign.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';

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
  assert.ok(b.units.filter(u=>u.side==='player').reduce((sum,u)=>sum+u.loaded+u.ammo,0)<request.issuedCartridges+(request.missionAllies??[]).reduce((sum,u)=>sum+u.loaded+u.ammo,0),'actual shots consume issued cartridges');
  transcript.push({sector,status:b.status,turn:b.turn,actions,units:b.units.map(u=>({id:u.id,hp:u.hp,energy:u.energy,ammo:u.ammo,loaded:u.loaded,routed:u.routed}))});
  assert.equal(b.status,'victory',JSON.stringify(transcript));
  order({type:'battleResult',battleId:request.id,outcome:b.status,survivors:b.units.filter(u=>u.side==='player'&&u.hp>0),sectorState:b});
 }
 assert.equal(c.operativeState[3].alive,true,'cover and actual fire preserve Cabral through both deployments');assert.equal(c.operativeState[3].hp,52);assert.deepEqual(c.squad,[3,4,10]);
 assert.equal(c.phase,2);assert.equal(c.flags.sanLorenzo,true);
 console.log('Opening playthrough:',JSON.stringify(transcript));
});
