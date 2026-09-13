import {syncUnitAmmunition} from '../game/tactical-ammunition.js';
import {AMMUNITION_TYPES} from '../game/ammunition-types.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {FITTING_RULES_VERSION,weaponItemWeight} from '../game/weapon-fittings.js';

const fitting = (id='bayonet-1') => ({weapon:1811,fittingPattern:'india_socket',instanceId:id,condition:67});
const assembly = (id='bayonet-1') => ({item:'weapon',weapon:1800,count:1,weight:weaponItemWeight(1800),loaded:1,jammed:true,condition:43,fittings:{bayonet:fitting(id)}});
const loose = (id='bayonet-1') => ({item:'weapon',weapon:1811,count:1,weight:weaponItemWeight(1811),loaded:0,jammed:false,condition:67,instanceId:id,fittingPattern:'india_socket'});
function field() {
  return createBattle([{id:'p',x:1,y:1,weapon:1800,blade:1811},{id:'q',x:2,y:1,weapon:1800,blade:1811}], {
    width:10,height:8,seed:18,exploration:true,enemies:[],
    tiles:Array.from({length:80},(_,i)=>({x:i%10,y:Math.floor(i/10),type:'grass',blocked:false,cover:0})),
  });
}
const placements = {
  held: (s,id) => {s.units[0].weaponFittings={bayonet:fitting(id)};},
  secondary: (s,id) => {Object.assign(s.units[1],{blade:1811,bladeInstanceId:id,bladeFittingPattern:'india_socket'});},
  primaryLoose: (s,id) => {Object.assign(s.units[1],{weapon:1811,loaded:0,weaponInstanceId:id,weaponFittingPattern:'india_socket'});syncUnitAmmunition(s.units[1]);},
  pack: (s,id) => {s.units[0].inventory.musket=assembly(id);},
  ground: (s,id) => {s.groundItems.push({...assembly(id),id:'ground-musket',type:'item',x:3,y:3});},
  dropped: (s,id) => {const {item,count,...record}=assembly(id);s.droppedWeapons.push({...record,x:4,y:3});},
  door: (s,id) => {Object.assign(s.tiles.find(t=>t.x===5&&t.y===3),{type:'door',doorId:'store-door',open:false,blocked:true,contents:[assembly(id)]});},
  chest: (s,id) => {s.props.push({id:'store-chest',type:'chest',x:6,y:3,open:false,contents:[assembly(id)]});},
};
function reject(change,message) {const s=field();change(s);assert.throws(()=>validateBattleSnapshot(s),message);}

test('new battles have explicit fitting rules and all canonical held fields',()=>{
  const s=field();assert.equal(s.fittingRulesVersion,FITTING_RULES_VERSION);
  for(const u of s.units){assert.deepEqual(u.weaponFittings,{});assert.equal(u.weaponFittingPattern,null);assert.equal(u.bladeFittingPattern,null);}
  assert.deepEqual(validateBattleSnapshot(s),s);
});

test('legacy normalization never grants a pattern, fitting or identity and does not mutate RNG or input',()=>{
  const s=field();delete s.fittingRulesVersion;
  for(const u of s.units)for(const key of ['weaponFittings','weaponFittingPattern','bladeFittingPattern'])delete u[key];
  s.units[0].inventory.old={weapon:1811,count:3,weight:1.3,loaded:0,condition:32};
  const original=structuredClone(s),n=validateBattleSnapshot(s);
  assert.deepEqual(s,original);assert.equal(n.seed,s.seed);assert.equal(n.fittingRulesVersion,FITTING_RULES_VERSION);
  for(const u of n.units){assert.deepEqual(u.weaponFittings,{});assert.equal(u.weaponFittingPattern,null);assert.equal(u.bladeFittingPattern,null);assert.equal(u.bladeInstanceId,undefined);}
  assert.deepEqual(n.units[0].inventory,s.units[0].inventory);
  assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(n))),n);
});

test('explicit fitting versions require complete canonical fields and reject unknown versions',()=>{
  for(const version of [null,0,2,'1'])reject(s=>s.fittingRulesVersion=version);
  for(const key of ['weaponFittings','weaponFittingPattern','bladeFittingPattern'])reject(s=>delete s.units[0][key]);
  for(const value of [null,[],false,1])reject(s=>s.units[0].weaponFittings=value);
  reject(s=>{delete s.fittingRulesVersion;s.units[0].weaponFittings=null;});
});

test('valid assemblies in both hands, pack, ground, drops, doors and chests survive JSON exactly',()=>{
  const s=field();Object.entries(placements).forEach(([name,place])=>place(s,`bayonet-${name}`));
  s.units[0].weaponInstanceId='host-held';
  const n=validateBattleSnapshot(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(n,s);assert.equal(n.seed,s.seed);assert.equal(n.units[0].weaponFittings.bayonet.condition,67);
});

test('every pair of active ownership locations rejects a shared fitting identity',()=>{
  const choices=Object.entries(placements);
  for(let i=0;i<choices.length;i++)for(let j=i+1;j<choices.length;j++){
    const [left,placeLeft]=choices[i],[right,placeRight]=choices[j];
    reject(s=>{placeLeft(s,'same-fitting');placeRight(s,'same-fitting');},`${left} / ${right}`);
  }
});

test('fitting identities cannot alias their host or an unrelated held or stored item',()=>{
  reject(s=>{placements.held(s,'host');s.units[0].weaponInstanceId='host';});
  reject(s=>{placements.pack(s,'host');s.units[0].inventory.musket.instanceId='host';});
  reject(s=>{placements.chest(s,'tool');s.units[0].inventory.key={count:1,weight:.1,itemType:'tool',toolKey:'key',condition:80,instanceId:'tool'};});
  reject(s=>{placements.door(s,'gun');s.units[1].weaponInstanceId='gun';});
});

test('incompatible hosts, invented patterns and malformed fitting records are rejected in every assembly location',()=>{
  const stored=['pack','ground','dropped','door','chest'];
  const locate={pack:s=>s.units[0].inventory.musket,ground:s=>s.groundItems[0],dropped:s=>s.droppedWeapons[0],door:s=>s.tiles.find(t=>t.type==='door').contents[0],chest:s=>s.props[0].contents[0]};
  for(const name of stored){
    reject(s=>{placements[name](s,'b');locate[name](s).weapon=1801;},`${name} incompatible host`);
    for(const corrupt of [b=>b.fittingPattern='universal',b=>b.weapon=1813,b=>b.condition=-1,b=>b.condition=101,b=>delete b.instanceId,b=>b.instanceId='constructor',b=>b.extra=true,b=>b.fittings={bayonet:fitting('nested')}]){
      reject(s=>{placements[name](s,'b');corrupt(locate[name](s).fittings.bayonet);},name);
    }
  }
  reject(s=>{placements.held(s,'b');s.units[0].weapon=1801;});
  reject(s=>s.units[0].weaponFittings={sight:{}});
  reject(s=>s.units[0].weaponFittings={bayonet:{...fitting(),condition:NaN}});
});

test('matched loose bayonets need a valid identity and the correct weapon in either hand',()=>{
  for(const slot of ['weapon','blade']){
    const pattern=slot==='weapon'?'weaponFittingPattern':'bladeFittingPattern',identity=slot==='weapon'?'weaponInstanceId':'bladeInstanceId';
    reject(s=>{Object.assign(s.units[0],{[slot]:1811,loaded:0,[pattern]:'india_socket'});});
    reject(s=>{Object.assign(s.units[0],{[slot]:1813,loaded:0,[pattern]:'india_socket',[identity]:'b'});});
    reject(s=>{Object.assign(s.units[0],{[slot]:1811,loaded:0,[pattern]:{},[identity]:'b'});});
  }
  reject(s=>s.units[0].inventory.fake={count:1,weight:0,fittingPattern:'constructor',instanceId:'fake'});
  reject(s=>s.units[0].inventory.fake={count:1,weight:0,fittingPattern:'india_socket',instanceId:'fake'});
});

test('matched and fitted stacks reject altered weight or multiple copies while unmarked legacy stacks remain valid',()=>{
  for(const record of [assembly(),loose()])for(const corrupt of [r=>r.count=2,r=>r.weight=0,r=>r.weight+=.5]){
    reject(s=>{s.units[0].inventory.bad=structuredClone(record);corrupt(s.units[0].inventory.bad);});
    reject(s=>{s.groundItems=[{...structuredClone(record),id:'bad',type:'item',x:3,y:3}];corrupt(s.groundItems[0]);});
    reject(s=>{s.props=[{id:'chest',type:'chest',x:4,y:3,contents:[structuredClone(record)]}];corrupt(s.props[0].contents[0]);});
  }
  for(const weight of [0,null])reject(s=>{placements.dropped(s,'b');s.droppedWeapons[0].weight=weight;});
  reject(s=>{placements.dropped(s,'b');s.droppedWeapons[0].count=2;});
  const s=field();s.units[0].inventory.legacy={weapon:1820,count:3,weight:.7,loaded:0,condition:80};s.units[0].inventory.numeric=9;
  assert.deepEqual(validateBattleSnapshot(s).units[0].inventory,s.units[0].inventory);
});

test('depleted and taken histories validate metadata but do not claim a fitting that was already picked up',()=>{
  const s=field();placements.held(s,'owned');
  s.units[0].inventory.depleted={...assembly('owned'),count:0};
  s.groundItems=[{...assembly('owned'),id:'taken-ground',type:'item',x:3,y:3,count:0}];
  const {item,count,...drop}=assembly('owned');s.droppedWeapons=[{...drop,x:4,y:3,taken:true}];
  assert.doesNotThrow(()=>validateBattleSnapshot(s));
  for(const change of [r=>r.weapon=1801,r=>r.fittings.bayonet.condition=-1]){
    const invalid=structuredClone(s);change(invalid.droppedWeapons[0]);assert.throws(()=>validateBattleSnapshot(invalid));
  }
});

test('an abandoned primary can retain its legacy host marker but cannot retain the transferred fitting',()=>{
  const s=field();Object.assign(s.units[0],{weaponDropped:true,weaponInstanceId:'dropped-host',loaded:0});
  s.droppedWeapons=[{weapon:1800,condition:43,loaded:1,x:3,y:3,instanceId:'dropped-host',fittings:{bayonet:fitting('dropped-fitting')}}];
  assert.doesNotThrow(()=>validateBattleSnapshot(s));
  s.units[0].weaponFittings={bayonet:fitting('dropped-fitting')};assert.throws(()=>validateBattleSnapshot(s));
});

test('supplies cannot hide fitting metadata and corrupt non-tool pack weapons fail before actions',()=>{
  for(const extra of [{fittings:{}},{fittingPattern:'india_socket'},{fittings:{bayonet:fitting()}}])reject(s=>s.groundItems=[{id:'supply',type:'item',x:3,y:3,item:'inventory:ammo:musket_75',kind:'ammunition',ammoType:'musket_75',name:AMMUNITION_TYPES.musket_75.name,count:1,weight:.04,...extra}]);
  reject(s=>s.units[0].inventory.gun={weapon:1800,count:1,weight:4,loaded:2,condition:100});
  reject(s=>s.units[0].inventory.gun={weapon:1800,count:1,weight:4,loaded:1,condition:100,jammed:'yes'});
});

test('a valid fitted save resumes an ordinary paid action without identity, condition or RNG drift',()=>{
  const s=field();placements.held(s,'resumed-bayonet');
  const resumed=validateBattleSnapshot(JSON.parse(JSON.stringify(s))),action={type:'look',unitId:'p',x:1,y:0};
  const a=actBattle(s,action),b=actBattle(resumed,action);
  assert.equal(a.lastError,null);assert.deepEqual(a,b);assert.equal(a.seed,s.seed);
  assert.deepEqual(a.units[0].weaponFittings,s.units[0].weaponFittings);assert.deepEqual(validateBattleSnapshot(a),a);
});
