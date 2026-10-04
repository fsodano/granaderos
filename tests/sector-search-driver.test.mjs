import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,teamCanSee} from '../game/tactical.js';
import {sectorSearchGoal,sectorSearchOrder} from './sector-search-driver.mjs';

const quiet=point=>{
 const battle=createBattle([{id:'scout',x:1,y:1}],{width:20,height:20,night:true,enemies:[{id:'hidden',...point}]});
 battle.turn=20;battle.tiles.forEach(tile=>Object.assign(tile,{type:'grass',blocked:false,blocksSight:false}));
 // A public wall forces reconnaissance to use its actual southern opening.
 for(const tile of battle.tiles.filter(tile=>tile.x===4&&tile.y<12))Object.assign(tile,{type:'wall',blocked:true,blocksSight:true});
 return battle;
};
test('quiet-sector reconnaissance follows legal map geometry without reading hidden occupants',()=>{
 const first=quiet({x:18,y:18}),second=quiet({x:18,y:17});
 assert.equal(teamCanSee(first,'player',first.units.find(unit=>unit.id==='hidden')),false);
 const action=sectorSearchOrder(first,first.units[0]);
 assert.equal(action.type,'move');assert.deepEqual(action,sectorSearchOrder(second,second.units[0]));
 const after=actBattle(first,action);assert.equal(after.lastError,null);assert.ok(after.units[0].ap<first.units[0].ap);
 assert.equal(after.units[0].hp,first.units[0].hp);assert.deepEqual(after.tiles,first.tiles);
 assert.notDeepEqual(sectorSearchGoal(first),sectorSearchGoal({...first,turn:28}),'the next public quadrant extends the search beyond its original center');
});
