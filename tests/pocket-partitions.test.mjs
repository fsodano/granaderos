import test from 'node:test';
import assert from 'node:assert/strict';
import {POCKETS,allocatePockets,pocketOrderFromSlots,rearrangePockets,validatePocketOrder} from '../game/inventory-pockets.js';
const item=(name,count,stackLimit=4,slotSize=1)=>({item:name,label:name,count,stackLimit,slotSize,weight:.1,condition:47,stacks:Math.ceil(count/stackLimit),slots:Math.ceil(count/stackLimit)});
const hint=(slotId,index,count,item='cloth')=>({slotId,item,index,...(count===undefined?{}:{count})});
const contents=layout=>layout.slots.filter(s=>s.entry).map(s=>({slotId:s.id,item:s.entry.item,index:s.entry.index,count:s.entry.count}));
const quantities=layout=>Object.fromEntries(layout.slots.filter(s=>s.entry).map(s=>[s.id,[s.entry.item,s.entry.count]]));
const conserved=(items,layout)=>{for(const item of items)assert.equal(layout.slots.reduce((sum,s)=>sum+(s.entry?.item===item.item?s.entry.count:0),0)+layout.overflow.reduce((sum,r)=>sum+(r.item===item.item?r.count:0),0),item.count,`${item.item} must have one finite total`);};

test('an explicit 2 + 1 partition persists through repeated snapshots without repacking or changing metadata',()=>{
 const items=[item('cloth',3)],order=[hint('small-3',0,2),hint('large-4',1,1)],before=structuredClone({items,order});
 let layout=allocatePockets(items,order);assert.deepEqual(quantities(layout),{'large-4':['cloth',1],'small-3':['cloth',2]});assert.deepEqual(layout.overflow,[]);
 for(let i=0;i<3;i++){
  const saved=JSON.parse(JSON.stringify(pocketOrderFromSlots(layout.slots)));layout=allocatePockets(items,saved);
  assert.deepEqual(quantities(layout),{'large-4':['cloth',1],'small-3':['cloth',2]});conserved(items,layout);
  assert.ok(layout.slots.filter(s=>s.entry).every(s=>s.entry.condition===47&&s.entry.weight===.1));
 }
 assert.deepEqual({items,order},before);
});

test('snapshot helper records real counts and reindexes each item independently in physical slot order',()=>{
 const items=[item('cloth',3),item('ammo',25,20)],layout=allocatePockets(items,[hint('large-4',1,1),hint('small-6',0,2),hint('large-1',1,5,'ammo'),hint('small-2',0,20,'ammo')]),before=structuredClone(layout);
 const order=pocketOrderFromSlots(layout.slots);
 assert.deepEqual(order,[hint('large-1',0,5,'ammo'),hint('large-4',0,1),hint('small-2',1,20,'ammo'),hint('small-6',1,2)]);
 assert.deepEqual(quantities(allocatePockets(items,order)),quantities(layout));assert.deepEqual(layout,before);assert.deepEqual(pocketOrderFromSlots(POCKETS),[]);
});

test('decreasing actual ownership caps desired partitions and cannot leave phantom stacks',()=>{
 const order=[hint('small-1',0,2),hint('small-4',1,2),hint('large-3',2,1)];
 for(const [count,expected]of [[5,{'large-3':['cloth',1],'small-1':['cloth',2],'small-4':['cloth',2]}],[3,{'small-1':['cloth',2],'small-4':['cloth',1]}],[1,{'small-1':['cloth',1]}],[0,{}]]){
  const items=[item('cloth',count)],layout=allocatePockets(items,order);assert.deepEqual(quantities(layout),expected);assert.deepEqual(layout.overflow,[]);conserved(items,layout);
 }
 const gone=allocatePockets([],order);assert.deepEqual(contents(gone),[]);assert.deepEqual(gone.overflow,[]);
});

test('unspecified indices use normal stack limits while saved partial partitions retain their places',()=>{
 const items=[item('cloth',11)],layout=allocatePockets(items,[hint('large-4',0,2),hint('small-7',2,1)]);
 assert.deepEqual(contents(layout),[
  hint('large-4',0,2),hint('small-1',1,4),hint('small-2',3,4),hint('small-7',2,1),
 ]);conserved(items,layout);assert.deepEqual(layout.overflow,[]);
});

test('swapping partial stacks of the same item exchanges exact quantities rather than repacking',()=>{
 const items=[item('cloth',3)],layout=allocatePockets(items,[hint('small-3',0,2),hint('large-4',1,1)]),before=structuredClone(layout);
 const swapped=allocatePockets(items,rearrangePockets(layout,'small-3','large-4'));
 assert.deepEqual(quantities(swapped),{'large-4':['cloth',2],'small-3':['cloth',1]});assert.deepEqual(layout,before);conserved(items,swapped);
 const moved=allocatePockets(items,rearrangePockets(swapped,'small-3','small-8'));
 assert.deepEqual(quantities(moved),{'large-4':['cloth',2],'small-8':['cloth',1]});conserved(items,moved);
});

test('different-item swaps preserve every partial partition and still enforce physical pocket sizes',()=>{
 const items=[item('cloth',3),item('poncho',1,1,2)],layout=allocatePockets(items,[hint('large-1',0,2),hint('small-5',1,1),hint('large-4',0,1,'poncho')]);
 const swapped=allocatePockets(items,rearrangePockets(layout,'large-1','large-4'));
 assert.deepEqual(quantities(swapped),{'large-1':['poncho',1],'large-4':['cloth',2],'small-5':['cloth',1]});conserved(items,swapped);
 assert.throws(()=>rearrangePockets(swapped,'large-1','small-5'),/bolsillo grande/);assert.throws(()=>rearrangePockets(swapped,'small-8','small-7'));
});

test('million-item stacks expand to at most twelve partitions and leave an exact finite overflow',()=>{
 const items=[item('ammo',1000000,20)],order=POCKETS.map((p,index)=>hint(p.id,index,1,'ammo')),layout=allocatePockets(items,order);
 assert.equal(layout.slots.length,12);assert.equal(layout.slots.filter(s=>s.entry).length,12);assert.ok(layout.slots.every(s=>s.entry.count===1));assert.equal(layout.overflow.length,1);assert.equal(layout.overflow[0].count,999988);conserved(items,layout);
 const restored=allocatePockets(items,JSON.parse(JSON.stringify(pocketOrderFromSlots(layout.slots))));assert.deepEqual(restored,layout);
});

test('overflow remains conserved when bulk restrictions and partial stacks compete for real pockets',()=>{
 const items=[item('poncho',5,1,2),item('ammo',1000000,20)],layout=allocatePockets(items,[hint('small-1',0,1,'ammo')]);
 assert.equal(layout.slots.filter(s=>s.size==='large'&&s.entry?.item==='poncho').length,4);
 assert.equal(layout.slots.find(s=>s.id==='small-1').entry.count,1);assert.equal(layout.overflow.find(r=>r.item==='poncho').count,1);assert.equal(layout.overflow.find(r=>r.item==='ammo').count,999859);conserved(items,layout);
});

test('explicit counts must be positive safe integers and must not exceed a known item stack limit',()=>{
 const order=[hint('small-1',0,1)];
 for(const count of [0,-1,.5,NaN,Infinity,-Infinity,Number.MAX_SAFE_INTEGER+1,'2',null,{},[]])assert.throws(()=>validatePocketOrder([{...order[0],count}]));
 assert.doesNotThrow(()=>validatePocketOrder([hint('small-1',0,undefined)]));
 for(const index of [0,1000000])for(const count of [0,3])assert.throws(()=>allocatePockets([item('cloth',count)], [hint('small-1',index,5)]),/límite/);
 assert.doesNotThrow(()=>allocatePockets([item('cloth',1)], [hint('small-1',0,4)]),'a desired count is capped by actual ownership');
 assert.throws(()=>pocketOrderFromSlots([{id:'small-1',entry:{item:'cloth',count:0}}]));
 assert.throws(()=>pocketOrderFromSlots([{id:'small-1',entry:{item:'cloth',count:1}},{id:'small-1',entry:{item:'cloth',count:1}}]));
});

test('stale high indices and missing items do not create or hide owned quantities',()=>{
 const items=[item('cloth',3)],order=[hint('small-8',1000000,1),hint('small-7',0,100,'missing')],before=structuredClone(order),layout=allocatePockets(items,order);
 assert.deepEqual(contents(layout),[hint('small-1',0,3)]);assert.deepEqual(layout.overflow,[]);conserved(items,layout);assert.deepEqual(order,before);
});

test('legacy orders without explicit counts keep their original default stacks and placement',()=>{
 const items=[item('poncho',1,1,2),item('ammo',25,20),item('cloth',3)];
 const plain=allocatePockets(items);
 assert.deepEqual(contents(plain),[hint('large-1',0,1,'poncho'),hint('small-1',0,20,'ammo'),hint('small-2',1,5,'ammo'),hint('small-3',0,3)]);
 const order=[hint('large-4',1,undefined,'ammo'),hint('small-7',0,undefined,'ammo'),hint('small-5',0,undefined)],before=structuredClone(order),moved=allocatePockets(items,order);
 assert.deepEqual(contents(moved),[hint('large-1',0,1,'poncho'),hint('large-4',1,5,'ammo'),hint('small-5',0,3),hint('small-7',0,20,'ammo')]);assert.deepEqual(order,before);conserved(items,moved);
 assert.deepEqual(allocatePockets(items,JSON.parse(JSON.stringify(order))),moved);
});
