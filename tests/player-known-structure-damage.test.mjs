import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle} from '../game/tactical.js';
import {playerKnownBattle} from '../game/player-known-state.js';

const fixture=()=>createBattle([{id:'p',x:2,y:2,facing:2}],{
 width:30,height:12,exploration:true,enemies:[],
 props:[
  {id:'seen-table',type:'table',x:4,y:3,structureDamage:35},
  {id:'seen-chest',type:'chest',x:5,y:2,structureDamage:100,destroyed:true,open:true,locked:false,broken:true,blocksMovement:false,blocksSight:false,contents:[{item:'inventory:linen',count:1,weight:.2,name:'Tela',instanceId:'private-item-id',condition:67}]},
  {id:'hidden-table',type:'table',x:28,y:10,structureDamage:65},
 ],
});

test('observed structure damage reaches public terrain, furniture and container summaries',()=>{
 const s=fixture(),tile=s.tiles.find(t=>t.x===3&&t.y===2);
 Object.assign(tile,{type:'rubble',structureDamage:100,destroyed:true,blocked:false,blocksSight:false});
 const view=playerKnownBattle(s),terrain=view.tiles.find(t=>t.x===3&&t.y===2);
 assert.equal(terrain.structureDamage,100);assert.equal(terrain.destroyed,true);
 assert.equal(view.props.find(p=>p.id==='seen-table').structureDamage,35);
 const chest=view.props.find(p=>p.id==='seen-chest');
 assert.equal(chest.destroyed,true);assert.equal(chest.structureDamage,100);assert.equal(chest.blocksMovement,false);
 const container=view.environment.find(e=>e.id==='seen-chest');
 assert.equal(container.destroyed,true);assert.equal(container.structureDamage,100);
 assert.equal(container.contents[0].count,1);
 assert.equal(JSON.stringify(view).includes('private-item-id'),false);
});

test('unseen damage changes do not change the player-known projection',()=>{
 const s=fixture(),tile=s.tiles.find(t=>t.x===28&&t.y===9),before=playerKnownBattle(s);
 assert.equal(before.props.some(p=>p.id==='hidden-table'),false);
 assert.equal(before.tiles.some(t=>t.x===28&&t.y===9),false);
 Object.assign(tile,{type:'rubble',structureDamage:100,destroyed:true,blocked:false,blocksSight:false});
 Object.assign(s.props.find(p=>p.id==='hidden-table'),{structureDamage:100,destroyed:true,blocksMovement:false,blocksSight:false});
 assert.deepEqual(playerKnownBattle(s),before);
});
