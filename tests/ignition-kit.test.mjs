import test from 'node:test';
import assert from 'node:assert/strict';
import {removeIgnitionSupplies} from '../game/ignition-kit.js';

const holder = () => ({hp:80,priming:0,flints:3,loaded:1,ammo:7,inventory:{priming:{name:'Documento',count:1,weight:0},flints:{name:'Estuche',count:1,weight:.1}},pocketOrder:[{item:'priming',index:0,slot:4},{item:'flints',index:0,slot:5},{item:'inventory:priming',index:0,slot:6}]});
test('obsolete ignition stocks and their references leave all stored holders without deleting ordinary inventory',()=>{
 const source=holder(),state={operativeState:{priming:holder()},missionAllies:{flints:holder()},garrisons:{a:[holder()]},militiaTraining:[{trainees:[holder()]}],enemyGroups:[{units:[holder()]}],sectorRemains:{a:[{unit:holder()}]},pendingBattle:{squad:[holder()],garrison:[holder()],missionAllies:[holder()],enemies:[holder()],ammunitionSources:[holder()],garrisonLootSources:[holder()],casualtyLootSources:[holder()],remains:[{unit:holder()}],resumeSnapshot:{units:[holder()]}},sectorStates:{a:{units:[holder()]}},sceneStates:{a:{npcs:[{...holder(),civilianSupplies:{version:1,priming:8,flints:2,rations:1}}]}}};
 removeIgnitionSupplies(state);
 const units=[state.operativeState.priming,state.missionAllies.flints,...state.garrisons.a,...state.militiaTraining[0].trainees,...state.enemyGroups[0].units,state.sectorRemains.a[0].unit,...state.pendingBattle.squad,...state.pendingBattle.garrison,...state.pendingBattle.missionAllies,...state.pendingBattle.enemies,...state.pendingBattle.ammunitionSources,...state.pendingBattle.garrisonLootSources,...state.pendingBattle.casualtyLootSources,state.pendingBattle.remains[0].unit,...state.pendingBattle.resumeSnapshot.units,...state.sectorStates.a.units,...state.sceneStates.a.npcs];
 for(const u of units){assert.equal(Object.hasOwn(u,'priming'),false);assert.equal(Object.hasOwn(u,'flints'),false);assert.deepEqual(u.inventory,source.inventory);assert.equal(u.loaded,1);assert.equal(u.ammo,7);assert.deepEqual(u.pocketOrder,[source.pocketOrder[2]]);}
 assert.deepEqual(state.sceneStates.a.npcs[0].civilianSupplies,{version:1,rations:1});
 const once=structuredClone(state);removeIgnitionSupplies(state);assert.deepEqual(state,once);
});

test('held obsolete supplies are released while real ammunition and stored item references remain',()=>{
 const state={units:[{...holder(),activeSlot:'item',activeItem:'priming',leftHandItem:'flints',equipmentCursor:{stack:{item:'priming',count:2}}},{...holder(),activeSlot:'supply',activeSupply:'flints'},{...holder(),activeSlot:'item',activeItem:'inventory:priming',leftHandItem:'inventory:flints',equipmentCursor:{stack:{item:'inventory:ammo:musket_75',kind:'ammunition',ammoType:'musket_75',count:3}}}],groundItems:[{id:'obsolete1',type:'priming',count:4},{id:'obsolete2',item:'flints',count:2},{id:'ammo',type:'ammoMusket',count:6},{id:'document',item:'inventory:priming',count:1}]};
 state.props=[{id:'chest',contents:[{item:'flints',count:1},{item:'inventory:priming',count:1},{item:'ammoMusket',count:3}]}];
 const retained=structuredClone(state.units[2]);delete retained.priming;delete retained.flints;retained.pocketOrder=retained.pocketOrder.slice(2);
 removeIgnitionSupplies(state);
 assert.equal(state.units[0].activeSlot,'unarmed');assert.equal(state.units[0].activeItem,undefined);assert.equal(state.units[0].leftHandItem,null);assert.equal(state.units[0].equipmentCursor,undefined);
 assert.equal(state.units[1].activeSlot,'unarmed');assert.equal(state.units[1].activeSupply,undefined);assert.deepEqual(state.units[2],retained);
 assert.deepEqual(state.groundItems.map(g=>g.id),['ammo','document']);assert.equal(state.groundItems[0].count,6);
 assert.deepEqual(state.props[0].contents,[{item:'inventory:priming',count:1},{item:'ammoMusket',count:3}]);
});

test('migration preserves pinned story content and arbitrary extension dictionaries',()=>{
 const contentCampaign={hash:'unchanged',package:{characters:[{id:'priming',startingSupplies:{priming:50,flints:4}}],dialogues:[{conditions:[{type:'supply',item:'flints',minimum:4}]}]}};
 const state={contentCampaign,startingSupplies:{priming:50,flints:4},extensions:{priming:{flints:8}},units:[holder()]},before=JSON.stringify(contentCampaign);
 removeIgnitionSupplies(state);
 assert.equal(JSON.stringify(state.contentCampaign),before);assert.deepEqual(state.startingSupplies,{priming:50,flints:4});assert.deepEqual(state.extensions,{priming:{flints:8}});
});
