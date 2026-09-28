import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {deployedArtillery} from '../game/equipment.js';
import {enterSector} from '../game/world.js';
import {createBattle} from '../game/tactical.js';
import {order,saved} from './local-contract-fixture.mjs';
function paidBattery(){let s=order(initialCampaign(42,defaultContentPackage()),{type:'createOfficer',name:'Isabel del Valle',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});const cash=s.resources.treasury;s=order(s,{type:'purchaseEquipment',item:'swivel'});assert.equal(s.resources.treasury,cash-400);return s;}

test('an explicit empty battery survives full saves and actual attack entry without sending purchased guns',()=>{
 let s=paidBattery();assert.equal(deployedArtillery(s)[0].type,'swivel');const stock=structuredClone(s.armory),money=s.resources.treasury,hour=s.hour;
 s=order(s,{type:'configureArtillery',types:[]});assert.equal(s.artillerySelectionExplicit,true);assert.deepEqual(s.armory,stock);assert.equal(s.resources.treasury,money);assert.equal(s.hour,hour);s=saved({campaign:s}).campaign;assert.deepEqual(deployedArtillery(s),[]);
 s=order(s,{type:'attack',sector:'buenos_aires'});const battle=enterSector(s.pendingBattle);assert.deepEqual(s.pendingBattle.artillery,[]);assert.deepEqual(battle.artillery,[]);assert.deepEqual(s.armory,stock);assert.deepEqual(saved({campaign:s,battle}).battle.artillery,[]);
});
test('purchasing another piece does not undo an empty choice and a later saved selection enables exact owned models',()=>{
 let s=order(paidBattery(),{type:'configureArtillery',types:[]});s=order(s,{type:'purchaseEquipment',item:'bronze4'});assert.deepEqual(deployedArtillery(saved({campaign:s}).campaign),[]);
 s=order(s,{type:'configureArtillery',types:['bronze4','swivel']});s=saved({campaign:s}).campaign;assert.deepEqual(deployedArtillery(s).map(g=>g.type),['bronze4','swivel']);s=order(s,{type:'attack',sector:'buenos_aires'});const b=enterSector(s.pendingBattle);assert.deepEqual(saved({campaign:s,battle:b}).battle.artillery.map(g=>g.type),['bronze4','swivel']);
});
test('older automatic and named selections retain their semantics while unavailable types and malformed saved choices cannot create guns',()=>{
 let s=paidBattery();assert.equal(s.artillerySelectionExplicit,undefined);assert.equal(saved({campaign:s}).campaign.artillerySelectionExplicit,undefined);assert.equal(deployedArtillery(s).length,1);
 s.artillerySelection=['swivel'];assert.equal(deployedArtillery(saved({campaign:s}).campaign)[0].type,'swivel');
 const stale=structuredClone(s);stale.artillerySelection=['field8','swivel','swivel'];assert.deepEqual(deployedArtillery(stale).map(g=>g.type),['swivel']);
 for(const types of [['field8'],['swivel','swivel'],['unknown'],['swivel','swivel','swivel','swivel'],null,'swivel']){const no=dispatchCampaign(s,{type:'configureArtillery',types});assert.ok(no.lastError);const expected=structuredClone(s);delete expected.lastError;delete no.lastError;assert.deepEqual(no,expected);}
 for(const flag of [0,1,'true',null,{}]){const bad=structuredClone(s);bad.artillerySelectionExplicit=flag;assert.throws(()=>saved({campaign:bad}),/batería/);}
});

test('a tactical explicit empty manifest takes precedence over an older count while count-only requests remain compatible',()=>{
 assert.deepEqual(createBattle([],{cannons:3,artillery:[],exploration:true}).artillery,[]);
 assert.equal(createBattle([],{cannons:3,exploration:true}).artillery.length,3);
});
