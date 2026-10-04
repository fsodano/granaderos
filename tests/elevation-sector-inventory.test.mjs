import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {createBattle} from '../game/tactical.js';
import {sectorInventoryModel,knownSectorEquipment} from '../game/sector-inventory.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
const order=(c,a)=>{const next=dispatchCampaign(c,a);assert.equal(next.lastError,null,JSON.stringify(a)+': '+next.lastError);return next;};
function returned(){
 let campaign=initialCampaign(45);campaign.resources.treasury=20000;
 for(const id of [128,142])campaign=order(campaign,{type:'recruitCivic',id,term:'day'});
 campaign=order(campaign,{type:'visitSector'});const request=campaign.pendingBattle;
 const tiles=Array.from({length:160},(_,i)=>({x:i%16,y:Math.floor(i/16),type:'grass',blocked:false,cover:0})),upperSurfaces=Array.from({length:12},(_,i)=>({id:`roof:${i}`,x:4+i%4,y:4+Math.floor(i/4),tacticalLevel:1,elevation:3,type:'floor',kind:'platform',blocked:false,cover:0}));
 const squad=request.squad.map((u,i)=>({...u,x:5,y:5,tacticalLevel:i}));
 const battle=createBattle(squad,{...request,width:16,height:10,tiles,upperSurfaces,climbLinks:[],enemies:[],props:[],npcs:request.npcs.map((npc,i)=>({...npc,x:14-i,y:8}))});
 return order(campaign,{type:'leaveSector',battleId:request.id,sectorState:battle,survivors:battle.units});
}
const model=(c,id)=>sectorInventoryModel(c,'retiro',rosterFor(c),id);
test('campaign inventory retains a roof resident and cannot retrieve its gear from directly downstairs',()=>{
 let c=returned();const rationsBefore=c.operativeState[142].rations;
 c=order(c,{type:'sectorInventory',sector:'retiro',operativeId:142,direction:'drop',item:'rations',count:1});
 const roof=model(c,142).entries[0],ground=model(c,128).entries[0],item=c.sectorStates.retiro.groundItems[0];
 assert.equal(item.tacticalLevel,1);assert.equal(roof.tacticalLevel,1);assert.equal(roof.reachable,true);assert.equal(ground.reachable,false);
 assert.equal(Object.hasOwn(JSON.parse(roof.expected),'tacticalLevel'),false,'physical position is not item metadata');
 assert.equal(knownSectorEquipment(c.sectorStates.retiro)[0].tacticalLevel,1);
 assert.equal(c.operativeState[142].rations+item.count,rationsBefore);
 const refused=dispatchCampaign(c,{type:'sectorInventory',sector:'retiro',operativeId:128,direction:'take',sourceKey:ground.key,expected:ground.expected,count:1});assert.ok(refused.lastError);assert.deepEqual({...refused,lastError:null},{...c,lastError:null});
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 c=order(c,{type:'sectorInventory',sector:'retiro',operativeId:142,direction:'take',sourceKey:roof.key,expected:roof.expected,count:1});assert.equal(c.operativeState[142].rations,rationsBefore);assert.equal(c.sectorStates.retiro.groundItems[0].count,0);
 c=order(c,{type:'visitSector'});const battle=enterSector(c.pendingBattle,c.sectorStates.retiro);
 assert.equal(battle.units.find(u=>u.id==='142').tacticalLevel,1);assert.equal(battle.units.find(u=>u.id==='128').tacticalLevel,0);assert.equal(battle.groundItems[0].count,0);assert.deepEqual(decodeSave(encodeSave(c,battle)).battle,battle);
});
test('a real authored access makes discovered roof gear available from the campaign map',()=>{
 let c=returned();c=order(c,{type:'sectorInventory',sector:'retiro',operativeId:142,direction:'drop',item:'rations',count:1});
 assert.equal(model(c,128).entries[0].reachable,false);
 c.sectorStates.retiro.climbLinks=[{id:'access',kind:'climb',from:{x:3,y:4,tacticalLevel:0},to:{x:4,y:4,tacticalLevel:1}}];
 const row=model(c,128).entries[0],before=c.operativeState[128].rations;assert.equal(row.reachable,true);
 c=order(c,{type:'sectorInventory',sector:'retiro',operativeId:128,direction:'take',sourceKey:row.key,expected:row.expected,count:1});
 assert.equal(c.operativeState[128].rations,before+1);assert.equal(c.sectorStates.retiro.groundItems[0].count,0);
});
