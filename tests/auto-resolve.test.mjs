import test from 'node:test';
import assert from 'node:assert/strict';
import {autoResolve, withdrawAutomatically} from '../game/auto-resolve.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {enterSector} from '../game/world.js';
import {createBattle,actBattle,endTurn} from '../game/tactical.js';
import {battleFromRequest} from '../game/battle-handoff.js';
const request=(style='balanced')=>({id:'auto-defense',sector:'san_nicolas',seed:45,defenseGroupId:'enemy-group-1',defenseFort:1,
 squad:Array.from({length:style==='weak'?1:3},(_,i)=>({id:1000+i,name:`Defensor ${i}`,weapon:style==='blade'?1813:1800,marksmanship:style==='weak'?20:65,medical:50,agility:style==='blade'?95:70,experienceLevel:style==='blade'?9:4,hp:style==='weak'?30:90,maxHp:90,loaded:style==='blade'?0:1,ammo:style==='blade'?0:4,priming:5,flints:0,rations:0,torches:0,boleadoras:0,medkits:1,morale:100})),
 enemies:Array.from({length:3},(_,i)=>({id:`enemy-group-1-${i}`,name:`Realista ${i}`,weapon:style==='blade'?1813:1800,marksmanship:style==='weak'?95:65,agility:70,experienceLevel:4,hp:100,maxHp:100,loaded:style==='blade'?0:1,ammo:style==='blade'?0:2,priming:3,medkits:0,morale:100}))});
const supply=b=>b.units.reduce((sum,u)=>sum+u.loaded+u.ammo,0);
test('automatic defense uses deterministic ordinary combat, actual wounds, cartridges and interrupt budgets',()=>{
 const r=request(),original=structuredClone(r),initial=enterSector(r),first=autoResolve(r),second=autoResolve(JSON.parse(JSON.stringify(r)));
 assert.deepEqual(first,second);assert.deepEqual(r,original);assert.equal(first.outcome,'victory');assert.equal(first.timedOut,false);
 assert.ok(first.actions>0);assert.ok(first.battle.units.some(u=>u.side==='player'&&u.reactionTurn>0));
 assert.ok(supply(first.battle)<supply(initial));assert.ok(first.battle.units.some(u=>u.side==='enemy'&&u.hp===0));
 for(const u of first.battle.units){const start=initial.units.find(v=>v.id===u.id);assert.ok(u.hp<=start.hp);assert.ok(u.ammo+u.loaded<=start.ammo+start.loaded);assert.ok(u.medkits<=start.medkits);}
 assert.equal(first.battle.elapsedSeconds,first.battle.turn*6);assert.doesNotThrow(()=>validateBattleSnapshot(first.battle));
 assert.equal(first.battle.interrupt,undefined);assert.equal(first.battle.reactionStack,undefined);assert.equal(first.battle.enemyTurn,undefined);
});
test('automatic defeat returns the actual wounded survivor, not invented deaths or a success',()=>{
 const r=request('weak'),initial=enterSector(r),result=autoResolve(r),survivor=result.battle.units.find(u=>u.side==='player');
 assert.equal(result.outcome,'defeat');assert.equal(result.timedOut,false);assert.ok(survivor.hp>=0&&survivor.hp<initial.units[0].hp);
 assert.ok(survivor.hp<15||survivor.routed);assert.ok(supply(result.battle)<=supply(initial));assert.doesNotThrow(()=>validateBattleSnapshot(result.battle));
});
test('visible blade formations approach and fight through the same movement and interrupt rules',()=>{
 const result=autoResolve(request('blade'));
 assert.ok(result.actions>0);assert.ok(result.battle.units.some(u=>u.hp<(u.side==='player'?90:100)));
 assert.equal(supply(result.battle),0);assert.notEqual(result.outcome,'active');assert.doesNotThrow(()=>validateBattleSnapshot(result.battle));
});
test('bounded automatic resolution keeps an unfinished timeout instead of inventing a retreat',()=>{
 const r=request(),initial=structuredClone(r),result=autoResolve(r,null,{maxRounds:1});
 assert.equal(result.timedOut,true);assert.equal(result.outcome,null);assert.equal(result.battle.status,'active');assert.notEqual(result.outcome,'victory');
 assert.deepEqual(r,initial);assert.doesNotThrow(()=>validateBattleSnapshot(result.battle));
 for(const maxRounds of [0,81,Infinity,1.5])assert.throws(()=>autoResolve(r,null,{maxRounds}));
});


const withdrawalFixture=(players,extra={})=>{
 const tiles=Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0}));
 for(const t of tiles)if(Math.abs(t.x-10)<=1&&Math.abs(t.y-6)<=1&&(t.x!==10||t.y!==6))Object.assign(t,{type:'wall',blocked:true,blocksSight:true});
 return createBattle(players,{id:'withdrawal',width:12,height:8,tiles,exits:[{id:'west',edge:'W',destination:'retiro',entryEdge:'E',entryAnchor:{x:19,y:3}}],enemies:[{id:'enemy',x:10,y:6,weapon:1813,overwatch:false}],...extra});
};
const replayWithdrawal=(state,orders)=>orders.reduce((state,order)=>{const next=order.type==='endTurn'?endTurn(state):actBattle(state,order);assert.equal(next.lastError,null);return next;},state);

test('bounded withdrawal walks real paths across turns and exits through paid boundary orders',()=>{
 const state=withdrawalFixture([{id:'p',name:'Vigía',x:5,y:2}]);state.units[0].ap=8;
 const before=structuredClone(state),result=withdrawAutomatically(state);
 assert.deepEqual(state,before);assert.equal(result.battle.status,'retreat');assert.ok(result.rounds>0&&result.rounds<=8);
 assert.ok(result.orders.some(order=>order.type==='move'));assert.ok(result.orders.some(order=>order.type==='endTurn'));assert.equal(result.orders.at(-1).type,'exit');
 assert.deepEqual(result.battle,replayWithdrawal(state,result.orders));assert.equal(result.battle.units[0].departure.edge,'W');assert.equal(result.battle.units[0].x,0);assert.ok(result.battle.elapsedSeconds>0);
 assert.equal(result.battle.units[0].ammo,state.units[0].ammo);assert.equal(result.battle.units[0].medkits,state.units[0].medkits);assert.doesNotThrow(()=>validateBattleSnapshot(result.battle));
});

test('a sealed remaining soldier stays in the encounter after partial withdrawal reaches its bound',()=>{
 const state=withdrawalFixture([{id:'p',x:0,y:2},{id:'q',x:4,y:4}]);
 for(const t of state.tiles)if(Math.abs(t.x-4)<=1&&Math.abs(t.y-4)<=1&&(t.x!==4||t.y!==4))Object.assign(t,{type:'wall',blocked:true,blocksSight:true});
 const result=withdrawAutomatically(state);
 assert.equal(result.battle.status,'active');assert.equal(result.rounds,8);assert.ok(result.battle.units[0].departure);assert.equal(result.battle.units[1].departure,undefined);
 assert.deepEqual({x:result.battle.units[1].x,y:result.battle.units[1].y},{x:4,y:4});assert.deepEqual(result.battle,replayWithdrawal(state,result.orders));
 const resumed=battleFromRequest({resumeSnapshot:result.battle},{hour:999});assert.deepEqual(resumed,result.battle);assert.notEqual(resumed,result.battle);assert.notEqual(resumed.units[0],result.battle.units[0]);assert.doesNotThrow(()=>validateBattleSnapshot(resumed));
});

test('withdrawal can free and stand a soldier but cannot rest or refill during exploration',()=>{
 const state=withdrawalFixture([{id:'p',x:1,y:2,knockedDown:true,stance:'prone',entangled:true}],{exploration:true,enemies:[]});
 const result=withdrawAutomatically(state);assert.equal(result.battle.status,'retreat');assert.deepEqual(result.orders.slice(0,2).map(order=>order.type),['stance','free']);assert.ok(!result.orders.some(order=>['rest','endTurn','ration'].includes(order.type)));assert.deepEqual(result.battle,replayWithdrawal(state,result.orders));assert.ok(result.battle.units[0].energy<state.units[0].energy);
 const tired=withdrawalFixture([{id:'p',x:0,y:2,energy:1}],{exploration:true,enemies:[]}),blocked=withdrawAutomatically(tired);assert.equal(blocked.battle,tired);assert.deepEqual(blocked.orders,[]);assert.equal(blocked.battle.units[0].departure,undefined);
 for(const maxRounds of [0,9,Infinity,1.5])assert.throws(()=>withdrawAutomatically(state,{maxRounds}));
});

test('automatic boundary crossing preserves the actual watcher reaction and interrupted withdrawal',()=>{
 const state=withdrawalFixture([{id:'p',x:0,y:2,agility:30,experienceLevel:1},{id:'q',x:0,y:6}],{seed:45,enemies:[{id:'watch',x:4,y:2,facing:6,weapon:1800,agility:100,experienceLevel:10,marksmanship:95,overwatch:true}]});
 state.units[0].ap=8;
 const result=withdrawAutomatically(state,{maxRounds:1});assert.equal(result.orders[0].type,'exit');
 const first=actBattle(state,result.orders[0]);assert.equal(first.units[0].departure,undefined);assert.ok(first.units[0].hp<state.units[0].hp);assert.equal(first.units[2].reactionTurn,first.turn);
 assert.deepEqual(result.battle,replayWithdrawal(state,result.orders));assert.ok(result.battle.units[0].hp<=first.units[0].hp);assert.doesNotThrow(()=>validateBattleSnapshot(result.battle));assert.ok(result.rounds<=1);
});
