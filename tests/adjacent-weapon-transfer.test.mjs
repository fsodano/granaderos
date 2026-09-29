import test from 'node:test';import assert from 'node:assert/strict';
import {actBattle,createBattle,weaponTransferPreview,carriedWeight} from '../game/tactical.js';
import {refreshMilitaryCondition} from '../game/actor-condition.js';
import {enterSector} from '../game/world.js';
import {order,saved} from './local-contract-fixture.mjs';
import {secondaryLootField,secondaryOrder} from './secondary-loot-fixture.mjs';
const soldier=(p,id='110')=>p.battle.units.find(u=>u.id===id);
export function handoverField(item='blade'){
 const p=secondaryLootField({companion:true});return secondaryOrder(p,{type:'loot',targetId:p.target,item});
}
const keyFor=p=>Object.keys(soldier(p).inventory).find(k=>k.startsWith('blade:')||k.startsWith('weapon:'));
const physical=b=>({units:b.units,drops:b.droppedWeapons,ground:b.groundItems,seed:b.seed,elapsed:b.elapsedSeconds});

test('an actually recovered authored blade moves once to a paid adjacent companion, survives campaign return and equips there',()=>{
 let p=handoverField(),key=keyFor(p),record=structuredClone(soldier(p).inventory[key]),ap=soldier(p).ap,recipientAP=soldier(p,'111').ap,sourceWeight=carriedWeight(soldier(p)),recipientWeight=carriedWeight(soldier(p,'111'));
 p=secondaryOrder(p,{type:'transfer',targetId:'111',inventoryKey:key});assert.equal(soldier(p).ap,ap-4);assert.equal(soldier(p,'111').ap,recipientAP);assert.equal(soldier(p).inventory[key],undefined);assert.deepEqual(Object.values(soldier(p,'111').inventory),[record]);assert.equal(carriedWeight(soldier(p)),sourceWeight-record.weight);assert.equal(carriedWeight(soldier(p,'111')),recipientWeight+record.weight);assert.equal(p.battle.units.find(u=>u.id===p.target).blade,0);
 const repeat=actBattle(p.battle,{type:'transfer',unitId:'110',targetId:'111',inventoryKey:key});assert.ok(repeat.lastError);assert.deepEqual(physical(repeat),physical(p.battle));p={...saved(p),target:p.target};
 let c=order(p.campaign,{type:'battleResult',battleId:p.campaign.pendingBattle.id,outcome:'retreat',sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')});c=order(saved({campaign:c}).campaign,{type:'attack',sector:'buenos_aires'});p={campaign:c,battle:enterSector(c.pendingBattle,c.sectorStates.buenos_aires)};
 assert.deepEqual(Object.values(soldier(p,'111').inventory),[record]);key=Object.keys(soldier(p,'111').inventory)[0];p=secondaryOrder(p,{type:'equipLoot',unitId:'111',inventoryKey:key,slot:'blade'});assert.equal(soldier(p,'111').bladeMetadata.contentWeapon.name,record.contentWeapon.name);assert.ok(saved(p));
});

test('handing over a recovered firearm retains declared wear, jam and unfinished loading through save and actual equip',()=>{
 let p=handoverField('weapon'),key=keyFor(p);Object.assign(soldier(p).inventory[key],{loaded:0,reloadProgress:.4,condition:37,jammed:true});p={...saved(p),target:p.target};const record=structuredClone(soldier(p).inventory[key]);
 p=secondaryOrder(p,{type:'transfer',targetId:'111',inventoryKey:key});p={...saved(p),target:p.target};assert.deepEqual(Object.values(soldier(p,'111').inventory),[record]);key=Object.keys(soldier(p,'111').inventory)[0];p=secondaryOrder(p,{type:'equipLoot',unitId:'111',inventoryKey:key});assert.equal(soldier(p,'111').condition,37);assert.equal(soldier(p,'111').jammed,true);assert.equal(soldier(p,'111').loaded,0);assert.equal(soldier(p,'111').reloadProgress,.4);assert.ok(saved(p));
});

function prepared(exploration=false){return createBattle([{id:'sender',x:1,y:1,inventory:{pair:{count:2,weight:2.3,weapon:1808,loaded:1,condition:57,jammed:false}}},{id:'receiver',x:2,y:1}],{width:8,height:8,exploration,enemies:exploration?[]:[{id:'guard',x:7,y:7,overwatch:false}]});}
const send=(b,action={})=>actBattle(b,{type:'transfer',unitId:'sender',targetId:'receiver',inventoryKey:'pair',...action});
test('one handover extracts one piece, preserves colliding recipient records and spends only one exploration second',()=>{
 let b=prepared(true);b.units[0].ap=0;b.units[1].ap=0;const other={count:1,weight:2.3,weapon:1808,loaded:0,condition:12,jammed:true};b.units[1].inventory['transfer:sender:pair']=other;const second=b.elapsedSeconds;
 b=send(b);assert.equal(b.lastError,null);assert.equal(b.elapsedSeconds,second+1);assert.equal(b.units[0].inventory.pair.count,1);assert.equal(b.units[0].ap,0);assert.equal(b.units[1].ap,0);assert.deepEqual(b.units[1].inventory['transfer:sender:pair'],other);assert.deepEqual(b.units[1].inventory['transfer:sender:pair:1'],{count:1,weight:2.3,weapon:1808,loaded:1,condition:57,jammed:false});assert.deepEqual(b.droppedWeapons,[]);
});
test('handover rejects changed recipient, resource and AP conditions atomically and preview does not mutate',()=>{
 const mutations=[b=>b.units[1].x=5,b=>b.units[1].hp=0,b=>{b.units[1].hp=10;b.units[1].ap=0;b.units[1].maxAP=0;b.units[1].unconscious=true;},b=>b.units[1].knockedDown=true,b=>b.units[1].routed=true,b=>b.units[1].fled=true,b=>b.units[1].departure={},b=>b.units[1].entangled=true,b=>b.units[1].militia=true,b=>{b.units[1].side='enemy';b.units[1].patrol=false;},b=>b.units[0].ap=3,b=>b.units[0].inventory.pair.count=0,b=>b.units[0].inventory.pair.weight=-1,b=>b.units[0].inventory.pair.loaded=3,b=>b.units[0].inventory.pair.weapon=1820,b=>b.units[1].inventory=Object.fromEntries(Array.from({length:1000},(_,i)=>['old'+i,{count:1,weight:0}]))];
 for(const change of mutations){const b=prepared();change(b);b.units.forEach(refreshMilitaryCondition);const before=structuredClone(b);assert.ok(weaponTransferPreview(b,b.units[0],b.units[1],'pair').reason,String(change));assert.deepEqual(b,before);const n=send(b);assert.ok(n.lastError);assert.deepEqual(physical(n),physical(b));}
 for(const action of [{targetId:'sender'},{targetId:'missing'},{inventoryKey:'missing'},{unitId:'guard'}]){const b=prepared(),n=send(b,action);assert.ok(n.lastError);assert.deepEqual(physical(n),physical(b));}
});
test('adjacent handover respects closed cells, diagonal corners and furniture instead of using distance alone',()=>{
 for(const mutate of [b=>Object.assign(b.tiles.find(t=>t.x===2&&t.y===1),{type:'door',blocked:true,blocksSight:true}),b=>{b.units[1].y=2;b.tiles.find(t=>t.x===2&&t.y===1).blocked=true;},b=>b.props.push({id:'table',type:'table',x:2,y:1,blocksMovement:true})]){const b=prepared();mutate(b);const n=send(b);assert.ok(n.lastError);assert.deepEqual(physical(n),physical(b));}
 const b=prepared();b.units[1].y=2;assert.equal(send(b).lastError,null);
});
