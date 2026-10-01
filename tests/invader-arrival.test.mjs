import test from 'node:test';
import assert from 'node:assert/strict';
import {enterSector} from '../game/world.js';
import {boundaryMatches} from '../game/tactical-exits.js';
import {spaceKey} from '../game/tactical-space.js';
import {entryTerrainCells,exteriorComponent} from '../game/sector-entry.js';
import {choosePatrolAction} from '../game/tactical-ai.js';
import {canSee,getReachable} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {seedCivilianHealth} from '../game/civilian-health.js';

const enemies=Array.from({length:13},(_,i)=>({id:`incoming-${i}`,hp:37,energy:53,loaded:0,ammo:2,condition:41,morale:39}));
for(const [sector,enemyCommand,edge] of [
 ['cordoba','partisans','W'],['tucuman','north','N'],['salta','north','N'],
 ['jujuy','north','W'],['humahuaca','north','W'],
 ['ensenada','naval','S'],['san_nicolas','naval','S'],['santa_fe','naval','S'],
])test(`incoming ${enemyCommand} troops enter ${sector} through connected ${edge} terrain`,()=>{
 const request={sector,seed:45,squad:[{id:'defender',entryReason:'resident'}],enemies,npcs:[{id:'resident',name:'Vecino',x:0,y:8}]};
 const previous=enterSector({...request,enemies:[],exploration:true});
 const garrison=enterSector(request).units.find(u=>u.side==='enemy');
 // Prepared defended town: a resident stands at the former garrison post.
 Object.assign(previous.units[0],{x:garrison.x,y:garrison.y});
 const before=structuredClone(previous),battle=enterSector({...request,enemyCommand,defenseGroupId:'incoming'},previous);
 assert.deepEqual(previous,before);
 const defender=battle.units.find(u=>u.id==='defender');
 assert.deepEqual([defender.x,defender.y],[garrison.x,garrison.y],'arrival must not displace the resident');
 const incoming=battle.units.filter(u=>u.side==='enemy');assert.equal(incoming.length,enemies.length);
 const connected=exteriorComponent(battle,incoming[0]);
 const cells=new Set(entryTerrainCells(battle,incoming[0],edge,connected).map(spaceKey));
 const maxDepth=Math.max(2,Math.ceil(incoming.length/cells.size));
 for(const unit of incoming){
  assert.ok(connected.has(spaceKey(unit)),`${unit.id} must enter through connected exterior terrain`);
  const distance=edge==='N'?unit.y:edge==='E'?battle.width-1-unit.x:edge==='S'?battle.height-1-unit.y:unit.x;
  assert.ok(distance<=maxDepth,`${unit.id} must remain on the boundary or its entry apron`);
  for(const field of ['hp','energy','loaded','ammo','condition','morale'])assert.equal(unit[field],enemies[0][field]);
 }
 assert.ok(incoming.filter(u=>boundaryMatches(battle,u,edge)).length>=Math.min(cells.size,incoming.length)-1,'fill the boundary before adding ranks');
 const occupants=[...battle.units.filter(u=>u.hp>0),...battle.npcs.filter(n=>n.hp>0)];
 assert.equal(new Set(occupants.map(spaceKey)).size,occupants.length);
 assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(battle))),battle);
});

test('an incoming force searches from its boundary with ordinary movement and no hidden target knowledge',()=>{
 const request={sector:'cordoba',seed:45,squad:[{id:'defender',entryReason:'resident'}]},previous=enterSector({...request,exploration:true,enemies:[]});
 Object.assign(previous.units[0],{x:60,y:40});
 const b=enterSector({...request,enemyCommand:'partisans',defenseGroupId:'incoming',enemies:[{id:'incoming',loaded:1,ammo:2}]},previous),u=b.units.find(u=>u.side==='enemy');
 assert.equal(canSee(b,u,b.units[0]),false);
 const action=choosePatrolAction(b,u);assert.equal(action?.type,'move');assert.equal(action.patrol,true);
 const move=getReachable(b,u).find(p=>spaceKey(p)===spaceKey(action));
 assert.ok(move&&move.path.length>0&&move.path.length<=3,'the invader must traverse its recorded path');
 assert.ok(!boundaryMatches(b,action,'W'),'the first search enters the sector');
 const hidden=structuredClone(b);hidden.units[0].y=42;assert.equal(canSee(hidden,hidden.units.find(v=>v.id===u.id),hidden.units[0]),false);
 assert.deepEqual(choosePatrolAction(hidden,hidden.units.find(v=>v.id===u.id)),action);
});

test('a thirty-person column fits the gorge approach without moving to interior garrison posts',()=>{
 const b=enterSector({sector:'humahuaca',seed:45,enemyCommand:'north',defenseGroupId:'incoming',squad:[{id:'defender'}],enemies:Array.from({length:30},(_,i)=>({id:`incoming-${i}`}))});
 const incoming=b.units.filter(u=>u.side==='enemy');assert.equal(incoming.length,30);
 assert.ok(incoming.every(u=>u.x<=4));
 assert.equal(new Set(b.units.map(spaceKey)).size,b.units.length);
 assert.doesNotThrow(()=>validateBattleSnapshot(JSON.parse(JSON.stringify(b))));
});

for(const [sector,enemyCommand,count] of [['cordoba','partisans',1],['humahuaca','north',30]])test(`incoming troops retain boundary placement around detained prisoners in ${sector}`,()=>{
 const prisoner=seedCivilianHealth({id:'captive:3:10',name:'Prisionero',x:1,y:24,detention:{operativeId:3,capturedAt:10,sector,freed:false}},{maxHp:70,hp:37,energy:53});
 const request={sector,seed:45,enemyCommand,defenseGroupId:'incoming',squad:[{id:'defender'}],enemies:enemies.slice(0,count)};
 if(count>enemies.length)request.enemies=Array.from({length:count},(_,i)=>({...enemies[0],id:`incoming-${i}`}));
 const before=structuredClone(prisoner),b=enterSector({...request,detainedPrisoners:[prisoner]});
 assert.deepEqual(prisoner,before,'entry must not alter the detention manifest');
 const captive=b.npcs.find(n=>n.id===prisoner.id),incoming=b.units.filter(u=>u.side==='enemy');
 assert.equal(incoming.length,count);assert.equal(captive.hp,prisoner.hp);assert.equal(captive.energy,prisoner.energy);
 if(sector==='humahuaca')assert.deepEqual([captive.x,captive.y],[1,24],'retain the narrow approach prisoner position');
 assert.ok(incoming.every(u=>u.x<=4),'the incoming force must enter through its western approach');
 for(const unit of incoming){
  assert.deepEqual(unit.patrolOrigin,{x:unit.x,y:unit.y});
  for(const field of ['hp','energy','loaded','ammo','condition','morale'])assert.equal(unit[field],enemies[0][field]);
 }
 const occupants=[...b.units.filter(u=>u.hp>0&&!u.departure),...b.npcs.filter(n=>n.hp>0&&!n.departure)];
 assert.equal(new Set(occupants.map(spaceKey)).size,occupants.length,'detained prisoners must retain exclusive cells');
 assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(b))),b);
});
