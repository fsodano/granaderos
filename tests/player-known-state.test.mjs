import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,canSee} from '../game/tactical.js';
import {playerKnownBattle,playerKnownCampaign,playerKnownState,playerKnownError} from '../game/player-known-state.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {launchEnemyGroup} from '../game/enemy-groups.js';
import {AMMUNITION_RESOURCE_KEYS,initialAmmunitionStock} from '../game/campaign-ammunition.js';

const secret='HIDDEN_PRIVATE_SENTINEL';
function fixture(){
  const state=createBattle([{id:'p',name:'Sanitario',x:2,y:2,facing:2,medical:80,inventory:{key:{itemType:'tool',toolKey:'key',keyId:secret,count:1,weight:.2,condition:100,debug:secret}}},{id:'q',name:'Apoyo',x:2,y:3,facing:2}],{
    id:`battle-${secret}`,sector:'retiro',width:30,height:12,seed:424242421,
    tiles:Array.from({length:360},(_,i)=>({x:i%30,y:Math.floor(i/30),type:'grass',blocked:false,cover:0})),
    enemies:[{id:'visible',name:'Realista visible',x:7,y:2,hp:73,ammo:33,inventory:{private:{count:1,weight:1,label:secret}}},{id:secret,name:secret,x:28,y:10,hp:69}],
    props:[{id:'closed',type:'chest',x:4,y:3,open:false,locked:true,keyId:secret,lockDifficulty:94,trap:{type:'alarm',difficulty:88,discoveredBy:['enemy']},contents:[{item:'ammo',count:7,weight:.04,name:secret}]},{id:'hidden-chest',type:'chest',x:28,y:9,open:true,contents:[{item:'ammo',count:11,weight:.04,name:secret}]}],
    npcs:[{id:'npc-visible',name:'Vecino visible',x:3,y:3,dialogue:secret},{id:'npc-hidden',name:secret,x:28,y:8}],
  });
  state.log=[`Una orden enemiga privada: ${secret}`];state.privateState={secret};state.units[0].rng=secret;
  return state;
}

test('current shared sight exposes useful actors and own controls without private simulation fields',()=>{
  const state=fixture(),view=playerKnownBattle(state);
  assert.ok(canSee(state,state.units[0],state.units[2]));assert.ok(!canSee(state,state.units[0],state.units[3]));
  assert.deepEqual(view.units.map(unit=>unit.id),['p','q','visible']);
  const enemy=view.units.find(unit=>unit.id==='visible');assert.equal(enemy.hp,73);assert.equal(enemy.ammo,undefined);assert.equal(enemy.inventory,undefined);assert.equal(enemy.ap,undefined);
  const own=view.units.find(unit=>unit.id==='p');assert.equal(own.ap,100);assert.equal(own.medical,80);assert.equal(own.inventory.key.toolKey,'key');assert.equal(own.inventory.key.keyId,undefined);
  assert.deepEqual(view.npcs.map(unit=>unit.id),['npc-visible']);assert.ok(view.tiles.every(tile=>tile.x<28));
  const controls=view.orders.find(order=>order.unitId==='p');assert.equal(controls.canAct,true);assert.ok(controls.equipment.some(slot=>slot.slot==='tool'));assert.ok(controls.targets.some(target=>target.targetId==='visible'&&typeof target.chance==='number'));assert.ok(controls.orders.some(order=>order.id==='useItem'));
  for(const key of ['seed','battleId','enemyTurn','reactionStack','log','privateState','enemyCommand','enemyExits'])assert.equal(view[key],undefined,key);
  assert.ok(!JSON.stringify(view).includes(secret));assert.ok(!JSON.stringify(view).includes('424242421'));
});

test('fitting projection exposes owned compatibility and condition but hides identities and unopened assemblies',()=>{
  const state=fixture(),u=state.units[0];
  const attached={weapon:1811,fittingPattern:'india_socket',condition:73,instanceId:secret};
  Object.assign(u,{weapon:1800,activeSlot:'primary',weaponFittings:{bayonet:attached},blade:1811,bladeFittingPattern:'india_socket',bladeInstanceId:'loose-projection'});
  u.inventory.assembly={weapon:1800,count:1,loaded:1,condition:66,weight:4,fittings:{bayonet:attached}};
  state.units[2].weaponFittings={bayonet:attached};state.units[3].weaponFittings={bayonet:attached};
  state.props[0].contents=[{item:'weapon',weapon:1800,count:1,weight:4,fittings:{bayonet:attached}}];
  let view=playerKnownBattle(state),own=view.units.find(unit=>unit.id==='p');
  assert.deepEqual(own.weaponFittings.bayonet,{weapon:1811,fittingPattern:'india_socket',condition:73});
  assert.deepEqual(own.inventory.assembly.fittings,own.weaponFittings);
  assert.equal(view.units.find(unit=>unit.id==='visible').weaponFittings,undefined);
  assert.equal(view.environment[0].contents,undefined);assert.ok(!JSON.stringify(view).includes(secret));
  const fittingOptions=view.orders.find(order=>order.unitId==='p').fittings;
  assert.ok(fittingOptions.some(option=>option.action.type==='fitBayonet'&&option.action.item==='blade'));
  assert.ok(fittingOptions.some(option=>option.action.type==='removeBayonet'&&option.action.destination==='inventory'));
  state.props[0].open=true;state.props[0].locked=false;view=playerKnownBattle(state);
  assert.deepEqual(view.environment[0].contents[0].fittings,own.weaponFittings);assert.ok(!JSON.stringify(view).includes(secret));
});

test('unseen movement returns only historical anonymous sight and does not expose the new health or position',()=>{
  const state=fixture(),target=state.units[2];
  state.units[0].lastKnownEnemy={x:target.x,y:target.y,turn:state.turn,enemyId:target.id,privateState:secret};
  Object.assign(target,{x:26,y:10,hp:17});
  const view=playerKnownBattle(state);assert.ok(!view.units.some(unit=>unit.id==='visible'));assert.ok(!view.orders.some(order=>order.targets.some(target=>target.targetId==='visible')));
  assert.deepEqual(view.contacts,[{observerId:'p',kind:'lastSeen',x:7,y:2,turn:state.turn,anonymous:true},{observerId:'q',kind:'lastSeen',x:7,y:2,turn:state.turn,anonymous:true}]);
  assert.ok(!JSON.stringify(view).includes('Realista visible'));assert.ok(!JSON.stringify(view).includes(secret));
  state.turn+=4;assert.deepEqual(playerKnownBattle(state).contacts,[]);
});

test('hearing-only interrupts expose the approximate area and eligible players without the hidden mover or queue',()=>{
  const state=fixture();for(const unit of state.units)delete unit.lastKnownEnemy;Object.assign(state.units[2],{x:26,y:10});state.phase='interrupt';state.interrupt={side:'player',unitIds:['p'],enemyId:secret,context:{private:secret}};
  state.enemyTurn={unitIds:[secret],unitIndex:0,private:secret};state.reactionStack=[{actorId:secret,action:{type:'move',x:28,y:10}}];
  state.units[0].lastHeardNoise={x:15,y:1,turn:state.turn,kind:'fire',uncertainty:3,sourceId:secret};
  const view=playerKnownBattle(state);assert.deepEqual(view.interrupt,{side:'player',unitIds:['p']});assert.equal(view.orders.find(order=>order.unitId==='p').canAct,true);assert.equal(view.orders.find(order=>order.unitId==='q').canAct,false);
  assert.deepEqual(view.contacts,[{observerId:'p',kind:'heard',x:15,y:1,radius:3,label:'Ruido: zona aproximada',turn:state.turn,anonymous:true}]);assert.ok(!JSON.stringify(view).includes(secret));
});

test('closed contents and unknown traps remain absent; opened visible contents expose only safe item metadata',()=>{
  const state=fixture(),closed=playerKnownBattle(state).environment;
  assert.equal(closed.length,1);assert.equal(closed[0].id,'closed');assert.equal(closed[0].contents,undefined);assert.equal(closed[0].trap,undefined);assert.equal(closed[0].keyId,undefined);assert.equal(closed[0].lockDifficulty,undefined);
  Object.assign(state.props[0],{open:true,locked:false});state.props[0].contents[0].name='Cartuchos conocidos';state.props[0].contents[0].debug=secret;state.props[0].contents.push({item:'weapon',weapon:1800,count:1,weight:4,loaded:1,condition:70,instanceId:secret});state.props[0].trap.discoveredBy.push('player');
  const open=playerKnownBattle(state).environment[0];assert.deepEqual(open.trap,{type:'alarm',armed:true});assert.equal(open.contents[0].name,'Cartuchos conocidos');assert.equal(open.contents[0].index,0);assert.equal(open.contents[0].count,7);assert.equal(open.contents[1].instanceId,undefined);assert.ok(!JSON.stringify(open).includes(secret));
});

test('hidden ground gear and departed observers cannot reveal enemy or item data',()=>{
  const state=fixture();state.groundItems=[{id:'near',type:'item',item:'ammo',count:2,weight:.04,x:3,y:2},{id:secret,type:'item',item:'ammo',count:81,weight:.04,x:28,y:10}];
  state.droppedWeapons=[{weapon:1800,loaded:1,condition:38,x:28,y:8,unitId:secret}];
  let view=playerKnownBattle(state);assert.deepEqual(view.groundItems.map(item=>item.id),['near']);assert.deepEqual(view.droppedWeapons,[]);assert.ok(view.orders[0].loot.some(item=>item.action.groundId==='near'));
  state.units[0].departure={edge:'W',destination:'buenos_aires',elapsedSeconds:3,mountId:null};state.units[1].unconscious=true;state.units[1].energy=0;
  view=playerKnownBattle(state);assert.deepEqual(view.units.map(unit=>unit.id),['q']);assert.equal(view.departedPlayers[0].id,'p');assert.deepEqual(view.groundItems,[]);assert.ok(!view.orders.some(order=>order.unitId==='p'));
});

test('campaign projection retains player records and reported groups without snapshots, enemy units, RNG or future waypoints',()=>{
  const campaign=initialCampaign(),battle=fixture(),group=launchEnemyGroup(campaign,'coast','retiro');
  group.route.push(secret);group.seed=424242421;group.units[0].name=secret;campaign.seed=424242421;
  campaign.operativeState[0].secret=secret;campaign.operativeState[0].location=secret;campaign.sectorStates.retiro=battle;campaign.sceneStates.yatasto=battle;campaign.sectorRemains.retiro=[{private:secret}];
  campaign.pendingBattle={id:secret,sector:'retiro',name:'Defensa de Retiro',seed:424242421,enemies:[{name:secret}],squad:[{private:secret}],resumeSnapshot:battle};campaign.log=[{text:secret,hour:0}];campaign.privateState={secret};
  const view=playerKnownCampaign(campaign),stock=Object.fromEntries(Object.values(AMMUNITION_RESOURCE_KEYS).map(key=>[key,view.resources[key]]));assert.deepEqual(stock,initialAmmunitionStock());assert.equal(Object.values(stock).reduce((sum,count)=>sum+count,0),300);assert.deepEqual(view.operatives.map(unit=>unit.id),[3,4,10]);assert.equal(view.squads[0].members.length,3);assert.equal(view.enemyReports[0].id,group.id);assert.equal(view.enemyReports[0].strength,3);assert.equal(view.pendingBattle.resumeAvailable,true);
  assert.equal(view.enemyReports[0].route,undefined);assert.equal(view.enemyReports[0].units,undefined);assert.equal(view.pendingBattle.id,undefined);assert.equal(view.pendingBattle.resumeSnapshot,undefined);
  for(const key of ['seed','sectorStates','sceneStates','sectorRemains','operativeState','log','privateState'])assert.equal(view[key],undefined,key);
  assert.ok(!JSON.stringify(view).includes(secret));assert.ok(!JSON.stringify(view).includes('424242421'));
});

test('the projection is detached, deterministic and leaves real item orders usable',()=>{
  const battle=fixture(),campaign=initialCampaign(),source={screen:'battle',campaign,battle},before=structuredClone(source),view=playerKnownState(source);
  assert.deepEqual(source,before);assert.deepEqual(playerKnownState(source),view);
  const option=view.battle.orders.find(order=>order.unitId==='p').equipment.find(slot=>slot.slot==='medical');
  const next=actBattle(battle,{...option.action,unitId:'p'});assert.equal(next.lastError,null);assert.equal(playerKnownBattle(next).units[0].activeSlot,'medical');
  view.battle.units[0].inventory.key.count=0;view.campaign.squads[0].members.pop();view.campaign.resources.cartridges=0;assert.deepEqual(source,before);
  assert.deepEqual(playerKnownState({screen:'title',campaign:null,battle:null}),{screen:'title',campaign:null,battle:null});
});


test('order error responses preserve text admission reasons but never serialize internal objects',()=>{
  assert.equal(playerKnownError('Faltan puntos de acción para disparar.'),'Faltan puntos de acción para disparar.');
  for(const value of [{enemy:fixture().units[3]},new Error(secret),[secret],null])assert.equal(playerKnownError(value),'La orden no se pudo completar.');
});

test('a corpse-heavy sector emits only active-person order lists and preserves unconscious patient targets',()=>{
  const state=fixture();state.units[0].activeSlot='medical';Object.assign(state.units[1],{hp:12,unconscious:true,bleeding:1});
  for(let i=0;i<210;i++)state.units.push({...state.units[1],id:`old-corpse-${i}`,name:`Miliciano caído ${i}`,militia:true,hp:0,unconscious:false,bleeding:0,x:20+i%8,y:7+Math.floor(i/8)%4});
  const view=playerKnownBattle(state);
  assert.equal(view.units.filter(unit=>unit.id.startsWith('old-corpse-')).length,210);
  assert.deepEqual(view.orders.map(order=>order.unitId),['p']);
  assert.ok(view.orders[0].targets.some(target=>target.targetId==='q'&&target.valid));
  assert.ok(!JSON.stringify(view.orders).includes('old-corpse-'));
  assert.ok(JSON.stringify(view.orders).length<15_000);assert.ok(JSON.stringify(view).length<400_000);
});
