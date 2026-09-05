import {marchToFront} from './campaign-test-helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign as dispatch,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {TRANSPORT_OPTIONS,transferOptions,cargoWeight} from '../game/logistics.js';
const order=(s,a)=>{const n=dispatch(marchToFront(s,a),a);assert.equal(n.lastError,null,n.lastError);return n;};
const transfer=(goods,mode='carts',source='reserve',destination='retiro')=>({type:'supplyTransfer',goods,mode,source,destination});
test('convoy removes cargo once and delivers only after elapsed route time',()=>{
 let s=order(initialCampaign(),{type:'transport',mode:'carts'});const stock=s.resources.muskets;s=order(s,transfer({muskets:20}));assert.equal(s.resources.muskets,stock-20);assert.equal(s.depots.retiro,undefined);assert.equal(s.convoys.length,1);
 s=order(s,{type:'wait',hours:17});assert.equal(s.depots.retiro,undefined);s=order(s,{type:'wait',hours:1});assert.equal(s.depots.retiro.muskets,20);assert.equal(s.convoys.length,0);s=order(s,{type:'wait',hours:1});assert.equal(s.depots.retiro.muskets,20);
 s=order(s,transfer({muskets:20},'carts','retiro','reserve'));s=order(s,{type:'wait',hours:18});assert.equal(s.resources.muskets,stock);assert.equal(s.depots.retiro.muskets,0);
});
test('captured route holds cargo in transit rather than duplicating or teleporting it',()=>{
 let s=order(initialCampaign(),{type:'transport',mode:'carts'});s.sectors.cordoba.owner='patriot';s.sectors.mendoza.owner='patriot';s=order(s,transfer({copper:10},'carts','reserve','mendoza'));s.sectors.cordoba.owner='royalist';s=order(s,{type:'wait',hours:36});assert.equal(s.convoys.length,1);assert.equal(s.depots.mendoza,undefined);s.sectors.cordoba.owner='patriot';s=order(s,{type:'wait',hours:1});assert.equal(s.convoys.length,0);assert.equal(s.depots.mendoza.copper,10);
});
test('posta capacity and remount costs are enforced atomically',()=>{
 let s=order(initialCampaign(),{type:'transport',mode:'posta'});const before=s.resources.horses;const bad=dispatch(s,transfer({muskets:8},'posta'));assert.ok(bad.lastError);assert.equal(bad.resources.horses,before);s=order(s,transfer({muskets:7},'posta'));assert.equal(s.resources.horses,before-1);assert.equal(cargoWeight({muskets:7}),28);
});
test('cannons require heavy transport; loaded carts obey one-tonne limit',()=>{
 let s=initialCampaign();s.resources.cannons=3;s=order(s,{type:'transport',mode:'posta'});assert.ok(dispatch(s,transfer({cannons:1},'posta')).lastError);s=order(s,{type:'transport',mode:'carts'});assert.ok(dispatch(s,transfer({cannons:3})).lastError);s=order(s,transfer({cannons:2}));assert.equal(s.convoys[0].goods.cannons,2);
});
test('mule saddle adds40kg; high passes reject carts and accept packed cargo',()=>{
 let s=initialCampaign();for(const id of ['cordoba','mendoza','uspallata'])s.sectors[id].owner='patriot';s=order(s,{type:'transport',mode:'mules'});s=order(s,{type:'transport',mode:'carts'});const mule=TRANSPORT_OPTIONS.find(o=>o.id==='mules');assert.equal(mule.capacity,mule.baseCapacity+40);assert.equal(mule.saddleWeight,6);
 assert.equal(transferOptions(s,'reserve','uspallata').find(o=>o.id==='carts').available,false);s=order(s,transfer({muskets:20},'mules','reserve','uspallata'));assert.equal(s.convoys.length,1);
});
test('flotilla excludes inland routes and blocks transit during a naval blockade',()=>{
 let s=initialCampaign();s.resources.cannons=1;s=order(s,{type:'transport',mode:'flotilla'});s.sectors.cordoba.owner='patriot';assert.equal(transferOptions(s,'reserve','cordoba').find(o=>o.id==='flotilla').available,false);
 s=order(s,transfer({muskets:20},'flotilla','reserve','ensenada'));s.blockade=true;s=order(s,{type:'wait',hours:5});assert.equal(s.convoys.length,1);s.blockade=false;s=order(s,{type:'wait',hours:1});assert.equal(s.depots.ensenada.muskets,20);
});
test('depot ammunition enters tactical stock and survives save migration',()=>{
 let s=order(initialCampaign(),{type:'transport',mode:'carts'});s=order(s,transfer({cartridges:300},'carts','reserve','buenos_aires'));s=order(s,{type:'wait',hours:18});assert.equal(s.resources.cartridges,0);s=restoreCampaign(serializeCampaign(s));s=order(s,{type:'attack',sector:'san_nicolas'});assert.equal(s.pendingBattle.issuedCartridges,20);assert.equal(s.depots.buenos_aires.cartridges,280);
 const legacy=initialCampaign();delete legacy.depots;delete legacy.convoys;delete legacy.routes.mules;const migrated=restoreCampaign(JSON.stringify(legacy));assert.deepEqual(migrated.depots,{});assert.deepEqual(migrated.convoys,[]);assert.equal(migrated.routes.mules,false);
});
