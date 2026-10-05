import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,reloadPlan,ignitionRisk,supplyTransferPreview} from '../game/tactical.js';
import {AMMO_KEYS,ammoTypeFor,ammoCount,totalAmmo,normalizeAmmo,validateAmmo,changeAmmo} from '../game/ammo-types.js';
import {personalPockets} from '../game/personal-pockets.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
const make=(weapon=1800,unit={})=>createBattle([{id:'a',x:1,y:1,weapon,loaded:0,ammo:3,...unit},{id:'b',x:2,y:1,weapon:1805,loaded:0,ammo:0}],{width:8,height:8,exploration:true,enemies:[]});
const order=(b,a)=>actBattle(b,{unitId:'a',...a});
test('all nine firearms use one of four families and legacy rounds follow their weapon',()=>{
 const expected={1800:'ammoMusket',1801:'ammoMusket',1802:'ammoRifle',1803:'ammoMusket',1804:'ammoShot',1805:'ammoPistol',1806:'ammoPistol',1807:'ammoShot',1808:'ammoPistol'};
 for(const [weapon,key]of Object.entries(expected)){const b=make(Number(weapon)),u=b.units[0];assert.equal(ammoTypeFor(u),key);assert.equal(ammoCount(u),3);assert.equal(totalAmmo(u),3);assert.equal('priming'in u,false);assert.equal('flints'in u,false);const n=order(b,{type:'reload'});assert.equal(n.lastError,null);assert.equal(n.units[0].loaded,weapon==='1808'?2:1);assert.equal(totalAmmo(n.units[0])+n.units[0].loaded,3);}
});
test('wrong-family transfers stay distinct and cannot reload another weapon',()=>{
 let b=make();b=order(b,{type:'transferSupply',targetId:'b',item:'ammoMusket',count:2});assert.equal(b.lastError,null);assert.equal(ammoCount(b.units[1],'ammoMusket'),2);assert.equal(ammoCount(b.units[1]),0);assert.equal(reloadPlan(b.units[1],b).rounds,0);
 const before=structuredClone(b.units[1]);b=actBattle(b,{type:'reload',unitId:'b'});assert.match(b.lastError,/compatible/);assert.deepEqual(b.units[1],before);
});
test('drop and pickup preserve the specific family, quantity and save roundtrip',()=>{
 let b=make(1802);b=order(b,{type:'dropSupply',item:'ammoRifle',count:2});assert.equal(b.lastError,null);const pile=b.groundItems[0];assert.equal(pile.type,'item');assert.equal(pile.ammoType,'rifle_62');assert.equal(pile.count,2);b=actBattle(b,{unitId:'b',type:'loot',groundId:pile.id,count:1});assert.equal(b.lastError,null);assert.equal(ammoCount(b.units[1],'ammoRifle'),1);assert.equal(b.groundItems[0].count,1);b=validateBattleSnapshot(JSON.parse(JSON.stringify(b)));assert.equal(ammoCount(b.units[1],'ammoRifle'),1);assert.equal(ammoCount(b.units[1]),0);
});
test('equipping a recovered gun changes compatibility without converting the carried reserves',()=>{
 let b=make(1800);const u=b.units[0];changeAmmo(u,'ammoPistol',2);u.inventory.pistol={weapon:1805,count:1,weight:1.3,loaded:0,condition:80};b=order(b,{type:'equipLoot',inventoryKey:'pistol',slot:'primary'});assert.equal(b.lastError,null);assert.equal(ammoCount(b.units[0]),2);assert.equal(ammoCount(b.units[0],'ammoMusket'),3);b=order(b,{type:'reload'});assert.equal(b.lastError,null);assert.equal(ammoCount(b.units[0],'ammoPistol'),1);assert.equal(ammoCount(b.units[0],'ammoMusket'),3);
});
test('maintenance and misfire recovery need action time but no tracked ignition supplies',()=>{
 let b=make(1800,{condition:40,jammed:true,priming:0,flints:0,toolkitPoints:30});const risk=ignitionRisk(b,b.units[0]);assert.equal(risk,ignitionRisk(b,{...b.units[0],priming:999}));b=order(b,{type:'reprime'});assert.equal(b.lastError,null);assert.equal(b.units[0].jammed,false);assert.equal(b.units[0].toolkitPoints,30);b=order(b,{type:'repair'});assert.equal(b.lastError,null);assert.equal(b.units[0].condition,70);assert.equal(b.units[0].toolkitPoints,0);assert.ok(b.elapsedSeconds>0);assert.equal('priming'in b.units[0],false);
});
test('separate pocket stacks and legacy migration preserve quantity and reject forged reserves',()=>{
 const u=normalizeAmmo({weapon:1802,ammo:21,priming:50,flints:4,pocketOrder:[{slotId:'large-1',item:'ammo',index:0,count:20}]});assert.equal(u.pocketOrder[0].item,'inventory:ammo:rifle_62');changeAmmo(u,'ammoShot',2);const l=personalPockets(u);assert.equal(l.slots.find(p=>p.id==='large-1').entry.item,'inventory:ammo:rifle_62');assert.equal(l.slots.filter(p=>p.entry?.ammoType==='rifle_62').length,2);assert.ok(l.slots.some(p=>p.entry?.ammoType==='shot_16'));
 assert.throws(()=>validateAmmo({...u,ammo:999}),/reserva/);assert.throws(()=>validateAmmo({...u,ammunition:{ammoFake:1}}),/reserva/);assert.throws(()=>validateAmmo({...u,ammunition:{ammoRifle:-1}}),/reserva/);
});

test('untyped legacy battle reserves migrate as musket rounds without granting ammunition on a second restore',()=>{
 const old=make(1805);delete old.ammunitionVersion;for(const u of old.units){delete u.ammunitionVersion;delete u.ammunition;u.inventory={};u.priming=17;u.flints=2;}
 old.units[0].pocketOrder=[{slotId:'large-2',item:'ammo',index:0,count:3}];
 old.groundItems=[{id:'old-ammo',type:'ammo',count:5,x:1,y:1},{id:'old-kit',type:'flints',count:4,x:1,y:1}];
 const first=validateBattleSnapshot(old),second=validateBattleSnapshot(JSON.parse(JSON.stringify(first)));
 assert.deepEqual(second,first);assert.equal(ammoCount(second.units[0],'ammoMusket'),3);assert.equal(ammoCount(second.units[0],'ammoPistol'),0);assert.equal(second.units[0].pocketOrder[0].item,'inventory:ammo:musket_75');assert.equal(second.groundItems.length,1);assert.equal(second.groundItems[0].ammoType,'musket_75');
});

test('a slow multi-barrel exploration reload consumes completed rounds once across clock slices',()=>{
 let b=make(1808),u=b.units[0];u.weapon={id:1808,capacity:2,reloadAP:250};changeAmmo(u,'ammoRifle',5);
 b=order(b,{type:'reload'});assert.equal(b.lastError,null);assert.equal(b.units[0].loaded,2);assert.equal(ammoCount(b.units[0],'ammoPistol'),1);assert.equal(ammoCount(b.units[0],'ammoRifle'),5);
});
