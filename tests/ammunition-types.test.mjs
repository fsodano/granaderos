import test from 'node:test';
import assert from 'node:assert/strict';
import {AMMUNITION_TYPES, WEAPON_AMMO_TYPES, AMMUNITION_WEIGHT, AMMUNITION_STACK_LIMIT,
  weaponAmmoType, isAmmunitionStack, validateAmmunitionStack, availableAmmunition,
  totalReserveAmmunition, ammunitionByType, addAmmunition, consumeAmmunition} from '../game/ammunition-types.js';

const stack = (type, count, extra={}) => ({kind:'ammunition', ammoType:type, count,
  weight:AMMUNITION_WEIGHT, name:AMMUNITION_TYPES[type].name, ...extra});
const preserved = unit => {const {inventory, ...other} = unit;return structuredClone(other);};

test('all nine explicit prepared loads retain separate catalog identity and physical limits', () => {
  const expected = ['musket_75','musket_69','rifle_62','carbine_65','shot_16','pistol_69','pistol_50','scatter','pistol_54'];
  assert.deepEqual(Object.keys(AMMUNITION_TYPES), expected);
  for (const [index, type] of expected.entries()) {
    const id = 1800 + index, entry = AMMUNITION_TYPES[type];
    assert.equal(weaponAmmoType(id), type);assert.equal(weaponAmmoType({id}), type);
    assert.equal(weaponAmmoType({id:'soldier', weapon:id}), type);assert.equal(WEAPON_AMMO_TYPES[id], type);
    assert.deepEqual(entry.weaponIds, [id]);assert.equal(entry.label, entry.name);assert.ok(entry.name.length > 10);
    assert.equal(entry.weight, .04);assert.equal(entry.stackLimit, 20);assert.ok(Object.isFrozen(entry));
    assert.ok(Object.isFrozen(entry.weaponIds));
  }
  assert.equal(AMMUNITION_STACK_LIMIT, 20);
  assert.notEqual(weaponAmmoType(1801), weaponAmmoType(1805), 'equal nominal .69 diameters do not make musket and pistol charges interchangeable');
  assert.ok(Object.isFrozen(AMMUNITION_TYPES));assert.ok(Object.isFrozen(WEAPON_AMMO_TYPES));
});

test('unknown and nonfirearm weapon IDs never acquire an inferred load type', () => {
  for (const weapon of [0,1809,1813,1820,65535,-1,1800.5,NaN,Infinity,null,undefined,{},'1800',{id:65535},
    {name:'Brown Bess',caliber:'Bala de plomo .75'}, {id:'constructor'}]) assert.equal(weaponAmmoType(weapon), null);
  const unit={weapon:65535, ammo:12, inventory:{reserve:stack('musket_75',4)}};
  assert.equal(availableAmmunition(unit,65535), 0);assert.equal(availableAmmunition(unit), 0);
  assert.equal(totalReserveAmmunition(unit),4);assert.equal(unit.ammo,12);
});

test('readers count exact mixed-caliber inventory reserves and exclude guns, cursor and legacy scalars', () => {
  const unit={weapon:1800, loaded:1, ammo:999, offHand:{weapon:1805,loaded:1},
    equipmentCursor:{sourceId:'small-1',stack:{item:'inventory:held',...stack('musket_75',8)}},
    inventory:{z:stack('pistol_69',3),a:stack('musket_75',17),b:stack('musket_75',4,{name:'Lote del depósito'}),
      zero:stack('scatter',0),gun:{weapon:1800,count:1,loaded:1,weight:4},cloth:{name:'Tela',count:10,weight:.1}}};
  const before=structuredClone(unit);
  assert.deepEqual(ammunitionByType(unit),{musket_75:21,pistol_69:3});assert.equal(totalReserveAmmunition(unit),24);
  assert.equal(availableAmmunition(unit),21);assert.equal(availableAmmunition(unit,1805),3);
  assert.equal(availableAmmunition(unit,1801),0);assert.equal(availableAmmunition(unit,'musket_75'),21);
  assert.equal(availableAmmunition(unit,{weapon:1805}),3);assert.deepEqual(unit,before);
  const result=ammunitionByType(unit);result.musket_75=500;assert.equal(availableAmmunition(unit),21);
});

test('gun changes do not convert or rewrite existing reserve quantities', () => {
  const unit={weapon:1800, inventory:{a:stack('musket_75',5),b:stack('pistol_50',2)}};
  const inventory=unit.inventory, initial=structuredClone(inventory);
  assert.equal(availableAmmunition(unit),5);
  unit.weapon=1806;assert.equal(availableAmmunition(unit),2);
  unit.weapon=1802;assert.equal(availableAmmunition(unit),0);
  assert.equal(unit.inventory,inventory);assert.deepEqual(unit.inventory,initial);assert.equal(totalReserveAmmunition(unit),7);
});

test('tagged malformed ammunition fails admission and readers rather than disappearing', () => {
  assert.equal(isAmmunitionStack({kind:'ammunition',ammoType:'missing'}),true);
  assert.equal(isAmmunitionStack({ammoType:'musket_75',count:1}),false);
  assert.equal(validateAmmunitionStack({kind:'tool',count:1}),false);
  const bad=[{ammoType:'missing'},{ammoType:'__proto__'},{ammoType:'constructor'},{count:-1},{count:.5},{count:1000001},
    {count:Infinity},{count:NaN},{count:'2'},{count:null},{weight:null},{weight:.08},{weight:'0.04'},
    {name:''},{name:null},{name:'x'.repeat(101)},{weapon:1800},{loaded:1},{fittings:{}},{reloadProgress:.5},
    {reloadAmmoType:'musket_75'},{loadedAmmoType:'musket_75'},{outfit:'poncho'},{toolKey:'pliers'},
    {instanceId:'owned',count:2},{instanceId:'constructor',count:1}];
  for(const change of bad){
    const entry=stack('musket_75',2,change),unit={inventory:{bad:entry}};
    assert.throws(()=>validateAmmunitionStack(entry));assert.throws(()=>ammunitionByType(unit));assert.throws(()=>availableAmmunition(unit,1800));
  }
  assert.equal(validateAmmunitionStack(stack('pistol_50',1,{instanceId:'round-1',lot:{maker:'Taller'}})),true);
  assert.equal(validateAmmunitionStack(stack('musket_75',0)),true);
});

test('addition aggregates canonical ammunition without editing custom lots or occupied non-ammunition keys', () => {
  const key='ammo:musket_75', unit={weapon:1805,loaded:1,ammo:19,inventory:{
    [key]:{kind:'tool',toolKey:'key',name:'Llave',count:1,weight:.1},
    custom:stack('musket_75',2,{name:'Cartuchos de Manuel',lot:{maker:'Manuel'}})}};
  const unchanged=preserved(unit),tool=unit.inventory[key],custom=unit.inventory.custom;
  assert.equal(addAmmunition(unit,'musket_75',25),unit);
  assert.equal(unit.inventory[key],tool);assert.equal(unit.inventory.custom,custom);
  assert.deepEqual(unit.inventory[`${key}:1`],stack('musket_75',25));
  addAmmunition(unit,'musket_75',3);
  assert.equal(unit.inventory[`${key}:1`].count,28);assert.equal(totalReserveAmmunition(unit),30);
  assert.equal(Object.keys(unit.inventory).length,3);assert.deepEqual(preserved(unit),unchanged);
});

test('canonical additions choose stable source keys regardless of inventory insertion order', () => {
  const initial={z:stack('musket_75',2),a:stack('musket_75',4),unrelated:stack('pistol_69',5)};
  const left={inventory:structuredClone(initial)},right={inventory:Object.fromEntries(Object.entries(structuredClone(initial)).reverse())};
  addAmmunition(left,'musket_75',3);addAmmunition(right,'musket_75',3);
  assert.deepEqual(left,right);assert.equal(left.inventory.a.count,7);assert.equal(left.inventory.z.count,2);
  const full={inventory:{'ammo:musket_75':stack('musket_75',1000000)}};
  addAmmunition(full,'musket_75',1);
  assert.equal(full.inventory['ammo:musket_75'].count,1000000);assert.equal(full.inventory['ammo:musket_75:1'].count,1);
});

test('consumption spends only the selected type in stable key order and preserves surviving metadata', () => {
  const initial={weapon:1800,loaded:1,reloadProgress:.4,ammo:50,activeItem:'inventory:b',leftHandItem:'inventory:b',
    equipmentCursor:{sourceId:'small-4',stack:{item:'inventory:cursor',...stack('musket_75',2)}},
    inventory:{z:stack('musket_75',9),a:stack('musket_75',2,{instanceId:undefined,name:'Primera caja'}),
      b:stack('musket_75',5,{name:'Segunda caja',lot:{number:42},condition:80}),p:stack('pistol_69',4),
      gun:{weapon:1800,count:1,loaded:1,weight:4},cloth:{count:3,name:'Tela',weight:.1}}};
  const unit=structuredClone(initial),beforeOther=preserved(unit),p=unit.inventory.p,gun=unit.inventory.gun,cloth=unit.inventory.cloth,z=unit.inventory.z;
  assert.equal(consumeAmmunition(unit,'musket_75',4),unit);
  assert.equal(unit.inventory.a,undefined);assert.deepEqual(unit.inventory.b,{...initial.inventory.b,count:3});
  assert.equal(unit.inventory.p,p);assert.equal(unit.inventory.gun,gun);assert.equal(unit.inventory.cloth,cloth);assert.equal(unit.inventory.z,z);
  assert.deepEqual(preserved(unit),beforeOther);assert.equal(totalReserveAmmunition(unit),16);
  const reversed={...structuredClone(initial),inventory:Object.fromEntries(Object.entries(structuredClone(initial.inventory)).reverse())};
  consumeAmmunition(reversed,'musket_75',4);assert.deepEqual(reversed,unit);
});

test('full consumption removes spent records without taking a cursor round or other caliber', () => {
  const unit={ammo:22,inventory:{a:stack('musket_69',3),b:stack('musket_69',2),p:stack('pistol_69',5)},
    equipmentCursor:{sourceId:'small-2',stack:{item:'inventory:cursor',...stack('musket_69',1)}}};
  consumeAmmunition(unit,'musket_69',5);assert.deepEqual(Object.keys(unit.inventory),['p']);
  const before=structuredClone(unit);assert.throws(()=>consumeAmmunition(unit,'musket_69',1));assert.deepEqual(unit,before);
  assert.equal(unit.ammo,22);assert.equal(unit.equipmentCursor.stack.count,1);assert.equal(availableAmmunition(unit,1805),5);
});

test('bad mutation requests reject atomically before any inventory or source reference changes', () => {
  for(const mutation of [addAmmunition,consumeAmmunition])for(const [type,count] of [
    ['musket_75',0],['musket_75',-1],['musket_75',1.1],['musket_75',1000001],['musket_75',NaN],
    ['musket_75',Infinity],['musket_75','1'],['missing',1],['constructor',1],['__proto__',1],[1800,1]]){
    const unit={weapon:1800,inventory:{a:stack('musket_75',5),b:stack('pistol_69',3)}},before=structuredClone(unit),inventory=unit.inventory,a=inventory.a;
    assert.throws(()=>mutation(unit,type,count));assert.deepEqual(unit,before);assert.equal(unit.inventory,inventory);assert.equal(unit.inventory.a,a);
  }
  const unit={inventory:{a:stack('musket_75',5),z:stack('pistol_69',3,{weight:null})}},before=structuredClone(unit),inventory=unit.inventory;
  for(const mutation of [addAmmunition,consumeAmmunition]){assert.throws(()=>mutation(unit,'musket_75',1));assert.deepEqual(unit,before);assert.equal(unit.inventory,inventory);}
});

test('inventory key admission matches existing finite inventory rules and does not traverse inherited records', () => {
  for(const inventory of [null,[],5,{'':stack('musket_75',1)},{['x'.repeat(101)]:stack('musket_75',1)},
    {'bad<key':stack('musket_75',1)}, {'bad\nkey':stack('musket_75',1)},JSON.parse('{"__proto__":{}}'),{constructor:3}]){
    const unit={inventory};assert.throws(()=>ammunitionByType(unit));assert.throws(()=>addAmmunition(unit,'musket_75',1));assert.throws(()=>consumeAmmunition(unit,'musket_75',1));assert.equal(unit.inventory,inventory);
  }
  const inherited={inventory:Object.create({notOwned:stack('musket_75',10)})};assert.equal(totalReserveAmmunition(inherited),0);
  const fresh={weapon:1800,ammo:12};assert.deepEqual(ammunitionByType(fresh),{});assert.equal(Object.hasOwn(fresh,'inventory'),false);
  addAmmunition(fresh,'musket_75',2);assert.equal(totalReserveAmmunition(fresh),2);assert.equal(fresh.ammo,12);
});
