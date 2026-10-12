import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign} from '../game/campaign.js';
import {launchEnemyGroup} from '../game/enemy-groups.js';
import {ownedArtilleryCount,prepareSectorArtillery} from '../game/campaign-artillery.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';

const order=(state,action)=>{const next=dispatchCampaign(state,action);assert.equal(next.lastError,null,next.lastError);return next;};
const gun=()=>({id:'piece-1',type:'bronze4',side:'player',loaded:false,ammo:2,reloadProgress:.4,facing:.7});
function storedBattery(){
 const state=order(initialCampaign(),{type:'configureArtillery',types:[]});
 // Declared subsystem fixture: one previously owned physical cannon. Its
 // identity, partial work and finite rounds must survive the public response.
 state.artilleryDepots={retiro:[gun()]};state.nextArtilleryId=2;
 return order(state,{type:'configureArtillery',types:['depot:piece-1']});
}
function encounter(state){launchEnemyGroup(state,'coast','retiro',{immediate:true});return order(state,{type:'wait',hours:1});}
const defend=state=>order(state,{type:'respondToEncounter',groupId:state.pendingEncounter.groupId,choice:'tactical'});
const savedDefense=state=>decodeSave(encodeSave(state,enterSector(state.pendingBattle,state.sectorStates.retiro))).campaign;

test('a local defense issues the selected physical depot cannon once with its exact remaining load',()=>{
 const start=encounter(storedBattery()),before=structuredClone(start),state=defend(start),request=state.pendingBattle;
 assert.deepEqual(state.artilleryDepots.retiro,[]);assert.deepEqual(request.artillery,[gun()]);
 assert.deepEqual(request.artilleryDeployment.issued,['piece-1']);assert.equal(ownedArtilleryCount(state),1);
 assert.equal(state.resources.treasury,start.resources.treasury);assert.deepEqual([state.hour,state.secondOfHour],[start.hour,start.secondOfHour]);
 const pair={campaign:state,battle:enterSector(request,state.sectorStates.retiro)};
 assert.deepEqual(decodeSave(encodeSave(pair.campaign,pair.battle)),pair);
 const issued=structuredClone(state);prepareSectorArtillery(state,request);assert.deepEqual(state,issued);
 assert.deepEqual(start,before);
});

test('an empty battery choice keeps the local physical cannon in its depot during defense',()=>{
 const start=encounter(order(storedBattery(),{type:'configureArtillery',types:[]})),state=defend(start);
 assert.deepEqual(state.pendingBattle.artillery,[]);assert.deepEqual(state.artilleryDepots.retiro,[gun()]);
 assert.deepEqual(savedDefense(state),state);assert.equal(ownedArtilleryCount(state),1);
});

test('an older implicit battery choice deploys the available local cannon without a fresh round',()=>{
 const state=storedBattery();state.artillerySelection=[];delete state.artillerySelectionExplicit;
 const start=encounter(state),result=defend(start);
 assert.deepEqual(result.pendingBattle.artillery,[gun()]);assert.deepEqual(result.artilleryDepots.retiro,[]);
 assert.equal(ownedArtilleryCount(result),1);assert.deepEqual(savedDefense(result),result);
});

test('a local automatic defense settles the same selected gun with only its real remaining rounds',()=>{
 const start=encounter(storedBattery()),before=structuredClone(start),result=order(start,{type:'respondToEncounter',groupId:start.pendingEncounter.groupId,choice:'auto'});
 const scene=result.sectorStates.retiro,piece=scene.artillery.find(piece=>piece.id==='piece-1');
 assert.ok(piece);assert.equal(piece.type,gun().type);assert.ok(piece.ammo+Number(piece.loaded)<=2);
 assert.deepEqual(result.artilleryDepots.retiro,[]);assert.equal(scene.artillery.filter(piece=>piece.id==='piece-1').length,1);
 assert.equal(result.pendingBattle,null);assert.equal(result.pendingEncounter,null);
 assert.equal(result.hour*3600+result.secondOfHour,start.hour*3600+start.secondOfHour+scene.elapsedSeconds);
 assert.deepEqual(decodeSave(encodeSave(result)).campaign,result);assert.deepEqual(start,before);
});

test('a remote defense cannot take the selected cannon from the active squad depot',()=>{
 let state=storedBattery();state=order(state,{type:'createSquad',name:'Mando separado',ids:[10]});
 state=order(state,{type:'travel',sector:'buenos_aires'});
 // The selected command is in Buenos Aires; the local Retiro soldiers defend
 // their own sector. No cannon travels without the public transport order.
 state.artilleryDepots.buenos_aires=state.artilleryDepots.retiro;state.artilleryDepots.retiro=[];
 state=order(state,{type:'configureArtillery',types:['depot:piece-1']});
 const start=encounter(state),defense=defend(start);
 assert.equal(defense.location,'buenos_aires');assert.ok(defense.pendingBattle.squad.length);
 assert.deepEqual(defense.pendingBattle.artillery,[]);assert.deepEqual(defense.artilleryDepots.buenos_aires,[gun()]);
 assert.deepEqual(savedDefense(defense),defense);assert.equal(ownedArtilleryCount(defense),1);
});

test('a precombat retreat leaves the selected depot cannon out of the remaining militia defense',()=>{
 const state=storedBattery();state.sectors.retiro.militia=[0,0,1];
 const start=encounter(state),result=order(start,{type:'respondToEncounter',groupId:start.pendingEncounter.groupId,choice:'retreat',destination:'buenos_aires'});
 assert.equal(result.location,'buenos_aires');assert.deepEqual(result.artilleryDepots.retiro,[gun()]);
 assert.equal(result.sectorStates.retiro.artillery.some(piece=>piece.id==='piece-1'),false);
 assert.deepEqual(decodeSave(encodeSave(result)).campaign,result);
});
