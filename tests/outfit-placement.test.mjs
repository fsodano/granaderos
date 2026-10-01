import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,equipmentPlacementPreview,planEquipmentPlacement,carriedWeight} from '../game/tactical.js';
import {equipmentEndpoint,equipmentFingerprint,inventoryUsage} from '../game/tactical-inventory.js';
import {makeOutfit,OUTFIT_CHANGE_AP} from '../game/outfits.js';
import {handLayout} from '../game/hand-layout.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
const garment=(instanceId,condition=63)=>({...makeOutfit('poncho',condition),...(instanceId?{instanceId}:{})});
const emptySupplies={ammo:0,priming:0,flints:0,rations:0,medkits:0,boleadoras:0,torches:0};
const clothes=()=>Object.fromEntries(['a','b','c','d'].map((id,i)=>[id,garment(id,40+i)]));
const notes=()=>Object.fromEntries(Array.from({length:8},(_,i)=>[`note${i}`,{name:'Carta',instanceId:`letter${i}`,count:1,weight:.1,condition:70+i}]));
const field=(unit={},options={})=>createBattle([{id:'p',x:2,y:2,weapon:1805,loaded:1,blade:0,...emptySupplies,outfit:garment('worn'),...unit}],{width:20,height:8,seed:127,tiles:Array.from({length:160},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',cover:0,blocked:false})),enemies:[{id:'e',x:3,y:2,patrol:false,overwatch:false}],...options});
const u=b=>b.units[0];
const layout=unit=>inventoryUsage(unit).slots;
const pocket=(unit,item)=>layout(unit).find(s=>s.entry?.item===item).id;
const action=(b,sourceId,destinationId)=>({type:'moveEquipment',unitId:'p',sourceId,destinationId,expectedSource:equipmentFingerprint(u(b),sourceId),expectedDestination:equipmentFingerprint(u(b),destinationId)});
const garments=unit=>[...(unit.outfit?[unit.outfit]:[]),...Object.values(unit.inventory??{}).filter(r=>r.kind==='outfit')].flatMap(r=>Array.from({length:r.count},()=>({...r,count:1}))).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
const heldGarment=(unit,side)=>unit.inventory[handLayout(unit)[side]?.slice(10)];
const inPocket=(unit,id)=>{const ref=layout(unit).find(p=>p.id===id).entry?.item;return ref?.startsWith('inventory:')?unit.inventory[ref.slice(10)]:null;};
function move(b,from,to){
 const before=structuredClone(b),a=action(b,from,to),preview=equipmentPlacementPreview(b,u(b),a);
 assert.equal(preview.valid,true,preview.reason);assert.equal(preview.pa,OUTFIT_CHANGE_AP);
 assert.deepEqual(b,before,'preview must not change the source');
 const n=actBattle(b,a);assert.equal(n.lastError,null,n.lastError);
 assert.equal(u(n).ap,u(b).ap-(b.mode==='exploration'?0:OUTFIT_CHANGE_AP));
 assert.equal(carriedWeight(u(n)),carriedWeight(u(b)));assert.deepEqual(garments(u(n)),garments(u(b)));
 assert.doesNotThrow(()=>validateBattleSnapshot(n));assert.deepEqual(b,before);return n;
}
function reject(b,a){
 const before=structuredClone(b);assert.equal(equipmentPlacementPreview(b,u(b),a).valid,false);
 const n=actBattle(b,a);assert.ok(n.lastError);assert.deepEqual(n.units,before.units);assert.equal(n.seed,before.seed);assert.equal(n.elapsedSeconds,before.elapsedSeconds);assert.deepEqual(b,before);
}

test('the outfit endpoint fingerprints the owner, exact garment and empty state without changing ownership',()=>{
 const b=field(),before=structuredClone(b);
 assert.deepEqual(equipmentEndpoint(u(b),'outfit'),{id:'outfit',kind:'outfit',item:'outfit',count:1});
 const fingerprint=equipmentFingerprint(u(b),'outfit');
 for(const patch of [{outfit:garment('worn',62)},{outfit:garment('other')},{outfit:null},{id:'q'}])assert.notEqual(equipmentFingerprint({...u(b),...patch},'outfit'),fingerprint);
 assert.deepEqual(equipmentEndpoint({...u(b),outfit:null},'outfit'),{id:'outfit',kind:'outfit',item:null,count:0});assert.deepEqual(b,before);
});

test('wearing and removing clothing use the selected large pocket and leave other pockets in place',()=>{
 let b=field({inventory:{coat:garment('coat',47),note:notes().note0},pocketOrder:[{slotId:'large-4',item:'inventory:coat',index:0},{slotId:'large-2',item:'inventory:note',index:0}]});
 b=move(b,'large-4','outfit');assert.deepEqual(u(b).outfit,garment('coat',47));assert.deepEqual(inPocket(u(b),'large-4'),garment('worn'));assert.equal(pocket(u(b),'inventory:note'),'large-2');
 b=move(b,'outfit','large-4');assert.deepEqual(u(b).outfit,garment('worn'));assert.deepEqual(inPocket(u(b),'large-4'),garment('coat',47));
 b=move(b,'outfit','large-3');assert.equal(u(b).outfit,null);assert.deepEqual(inPocket(u(b),'large-3'),garment('worn'));
 b=move(b,'large-3','outfit');assert.deepEqual(u(b).outfit,garment('worn'));assert.equal(inPocket(u(b),'large-3'),null);assert.equal(pocket(u(b),'inventory:note'),'large-2');
});

test('full pockets permit a clothing exchange only in the vacated source pocket',()=>{
 const b=field({inventory:{...clothes(),...notes()}});assert.equal(inventoryUsage(u(b)).free,0);
 const before=layout(u(b)),source=pocket(u(b),'inventory:d'),n=move(b,source,'outfit');
 assert.deepEqual(u(n).outfit,garment('d',43));assert.deepEqual(inPocket(u(n),source),garment('worn'));
 for(const p of before.filter(p=>p.id!==source))assert.deepEqual(layout(u(n)).find(q=>q.id===p.id).entry,p.entry);
 assert.equal(inventoryUsage(u(n)).free,0);
});

test('wearing one outfit from a multi-pocket stack preserves the other exact pockets',()=>{
 const b=field({inventory:{clothes:{...garment(null,51),count:4},...notes()}}),before=layout(u(b));
 const n=move(b,'large-3','outfit');assert.deepEqual(u(n).outfit,garment(null,51));assert.equal(u(n).inventory.clothes.count,3);assert.deepEqual(inPocket(u(n),'large-3'),garment('worn'));
 for(const id of ['large-1','large-2','large-4'])assert.equal(layout(u(n)).find(p=>p.id===id).entry.item,'inventory:clothes');
 assert.deepEqual(layout(u(n)).filter(p=>p.size==='small'),before.filter(p=>p.size==='small'));
});

test('either hand can exchange worn clothing with full pockets and retain the opposite held item',()=>{
 for(const side of ['right','left']){
  const b=field({weapon:0,loaded:0,activeSlot:'item',activeItem:'inventory:right',leftHandItem:'inventory:left',inventory:{...clothes(),...notes(),right:garment('right',29),left:garment('left',78)}});
  assert.equal(inventoryUsage(u(b)).free,0);const other=side==='right'?'left':'right',before=structuredClone(u(b));
  const n=move(b,`hand:${side}`,'outfit');assert.deepEqual(u(n).outfit,garment(side,side==='right'?29:78));assert.deepEqual(heldGarment(u(n),side),garment('worn'));assert.deepEqual(heldGarment(u(n),other),heldGarment(before,other));assert.deepEqual(layout(u(n)),layout(before));
  const back=move(n,'outfit',`hand:${side}`);assert.deepEqual(u(back).outfit,garment('worn'));assert.deepEqual(heldGarment(u(back),side),heldGarment(before,side));
 }
});

test('empty hands receive worn clothing without pack space; wearing it clears only that physical hand',()=>{
 for(const side of ['right','left']){
  let b=field({weapon:0,loaded:0,activeSlot:'unarmed',leftHandItem:null,inventory:{...clothes(),...notes()}});
  b=move(b,'outfit',`hand:${side}`);assert.equal(u(b).outfit,null);assert.deepEqual(heldGarment(u(b),side),garment('worn'));assert.equal(inventoryUsage(u(b)).free,0);
  b=move(b,`hand:${side}`,'outfit');assert.equal(handLayout(u(b))[side],null);assert.deepEqual(u(b).outfit,garment('worn'));assert.equal(inventoryUsage(u(b)).free,0);
 }
});

test('wearing from a held outfit stack leaves its packed copies and the other hand where they were',()=>{
 for(const side of ['right','left']){
  let b=field({weapon:0,loaded:0,outfit:null,activeSlot:side==='right'?'item':'unarmed',...(side==='right'?{activeItem:'inventory:clothes'}:{}),leftHandItem:side==='left'?'inventory:clothes':null,inventory:{clothes:{...garment(null,51),count:3}},pocketOrder:[{slotId:'large-2',item:'inventory:clothes',index:0},{slotId:'large-4',item:'inventory:clothes',index:1}]});
  const before=layout(u(b));b=move(b,`hand:${side}`,'outfit');assert.equal(handLayout(u(b))[side],null);assert.equal(u(b).inventory.clothes.count,2);assert.deepEqual(layout(u(b)),before);
 }
});

test('small pockets, non-clothing exchanges, blocked hands, empty origins and insufficient AP reject atomically',()=>{
 const b=field({inventory:{...clothes(),note:notes().note0},medkits:1});
 for(const [from,to]of [['outfit','small-8'],['hand:right','outfit'],['outfit','hand:right'],[pocket(u(b),'inventory:note'),'outfit'],['outfit',pocket(u(b),'medkits')],['outfit','outfit']])reject(b,action(b,from,to));
 const long=field({weapon:1800});reject(long,action(long,'outfit','hand:left'));
 const naked=field({outfit:null});reject(naked,action(naked,'outfit','large-4'));
 const tired=field();u(tired).ap=OUTFIT_CHANGE_AP-1;reject(tired,action(tired,'outfit','large-4'));
 const full=field({inventory:{...clothes(),...notes()}});reject(full,action(full,'outfit','small-8'));
});

test('changed source or destination garment identity, condition and stack count reject delayed placement',()=>{
 for(const change of [unit=>unit.outfit.condition--,unit=>unit.outfit.instanceId='changed',unit=>unit.inventory.coat.condition--,unit=>unit.inventory.coat.instanceId='changed']){
  const b=field({inventory:{coat:garment('coat')}}),a=action(b,'large-1','outfit');change(u(b));reject(b,a);
 }
 const b=field({inventory:{coat:{...garment(null),count:2}}}),a=action(b,'large-2','outfit');u(b).inventory.coat.count=1;reject(b,a);
 for(const patch of [{expectedSource:undefined},{expectedDestination:'stale'},{destinationId:'unknown'}])reject(field(),{...action(field(),'outfit','large-4'),...patch});
});

test('exploration outfit placement costs time but no AP, and planner replay is deterministic',()=>{
 const b=field({}, {exploration:true,enemies:[]}),a=action(b,'outfit','large-4'),before=structuredClone(b);
 assert.deepEqual(planEquipmentPlacement(u(b),a),planEquipmentPlacement(structuredClone(u(b)),a));assert.deepEqual(b,before);
 const n=move(b,'outfit','large-4');assert.equal(u(n).ap,100);assert.equal(n.elapsedSeconds,b.elapsedSeconds+1);assert.deepEqual(actBattle(b,a),actBattle(JSON.parse(JSON.stringify(b)),a));
});
