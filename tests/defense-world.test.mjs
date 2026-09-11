import test from 'node:test';
import assert from 'node:assert/strict';
import {enterSector} from '../game/world.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
const request={id:'occupation',sector:'cordoba',squad:[{id:'p'}],enemies:[{id:'old',hp:80}],seed:45};
test('arriving and occupying groups use their real survivors while retaining sector terrain and objects',()=>{
 const old=enterSector(request);old.units.find(u=>u.id==='old').hp=70;
 const ground=old.tiles.find(t=>t.type==='grass'&&!t.blocked);ground.type='rubble';ground.cover=15;
 old.groundItems.push({id:'stash',type:'item',x:ground.x,y:ground.y,item:'rations',count:1,weight:.8});
 const enemies=[{id:'enemy-group-1-0',hp:37,energy:53,loaded:0,ammo:2,condition:41,morale:39}];
 for(const marker of [{defenseGroupId:'enemy-group-1'},{occupationGroupIds:['enemy-group-1']}]){
  const b=enterSector({...request,...marker,enemies},old),e=b.units.find(u=>u.side==='enemy');
  assert.equal(e.id,enemies[0].id);for(const key of ['hp','energy','loaded','ammo','condition','morale'])assert.equal(e[key],enemies[0][key]);
  assert.deepEqual(b.groundItems,old.groundItems);assert.deepEqual(b.props,old.props);assert.deepEqual(b.tiles,old.tiles);assert.doesNotThrow(()=>validateBattleSnapshot(b));
 }
 const unfinished=enterSector(request,old);assert.equal(unfinished.units.find(u=>u.side==='enemy').id,'old');assert.equal(unfinished.units.find(u=>u.side==='enemy').hp,70);
});
test('defense fortifications give bounded cover to actual defenders without adding soldiers or supplies',()=>{
 const plain=enterSector({...request,defenseGroupId:'enemy-group-1'}),fort=enterSector({...request,defenseGroupId:'enemy-group-1',defenseFort:3});
 assert.deepEqual(fort.units,plain.units);assert.equal(fort.units.length,2);
 for(const u of fort.units.filter(u=>u.side==='player'))assert.ok(fort.tiles.find(t=>t.x===u.x&&t.y===u.y).cover>=30);
 assert.doesNotThrow(()=>validateBattleSnapshot(fort));
});
