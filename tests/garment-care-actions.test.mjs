import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,fieldDressingsPreview,firearmFlightPreview,carriedWeight} from '../game/tactical.js';
import {makeOutfit,BODY_SLOTS} from '../game/outfits.js';
import {fieldDressingsSource,FIELD_DRESSINGS_AP} from '../game/field-dressings.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

const clothes=id=>({headwear:{...makeOutfit('hat',63),instanceId:`${id}:hat`},outfit:{...makeOutfit('poncho',63),instanceId:`${id}:poncho`},legwear:{...makeOutfit('trousers',63),instanceId:`${id}:trousers`}});
const shirt=(condition=100,id='packed:shirt')=>({...makeOutfit('linen_shirt',condition),instanceId:id});
const body=(s,id='p')=>s.units.find(unit=>unit.id===id);
const field=(player={},options={})=>createBattle([{id:'p',name:'Testigo',x:1,y:3,facing:2,weapon:1801,marksmanship:100,ammo:2,condition:100,...player}],{
 width:30,height:8,seed:11,tiles:Array.from({length:240},(_,i)=>({x:i%30,y:Math.floor(i/30),type:'grass',cover:0,blocked:false,blocksSight:false})),
 enemies:[{id:'e',name:'Guardia',x:7,y:3,morale:100,patrol:false,overwatch:false,...clothes('e')},{id:'reserve',x:25,y:6,morale:100,patrol:false,overwatch:false}],...options,
});
const shot=hitLocation=>({type:'fire',unitId:'p',targetId:'e',aim:4,hitLocation});
const craft=s=>({type:'craftDressings',unitId:'p',inventoryKey:'linen',expectedSource:fieldDressingsSource(body(s),'linen')});
function accepted(s,action){const n=actBattle(s,action);assert.equal(n.lastError,null,n.lastError);assert.deepEqual(presentedActBattle(s,action).state,n);assert.deepEqual(actBattle(validateBattleSnapshot(structuredClone(s)),action),n);return n;}
function rejected(s,action){const before=structuredClone(s),n=actBattle(s,action);assert.ok(n.lastError);assert.deepEqual(s,before);assert.deepEqual(n.units,s.units);assert.equal(n.seed,s.seed);assert.equal(n.elapsedSeconds,s.elapsedSeconds);return n;}

test('real regional firearm injuries wear only their worn garment, without cloth armor, new RNG or forecast mutation',()=>{
 for(const [region,slot]of [['head','headwear'],['torso','outfit'],['legs','legwear']]){
  const s=field(),before=structuredClone(s);firearmFlightPreview(s,body(s),body(s,'e'),region);assert.deepEqual(s,before);
  const n=accepted(s,shot(region)),target=body(n,'e'),loss=body(s,'e').hp-target.hp;assert.ok(loss>0);assert.equal(target.lastHitLocation,region);
  for(const current of BODY_SLOTS)assert.deepEqual(target[current],{...body(s,'e')[current],condition:current===slot?63-Math.min(63,Math.ceil(loss/5)):63});
  const bare=structuredClone(s);for(const current of BODY_SLOTS)body(bare,'e')[current]=null;
  const unprotected=actBattle(bare,shot(region));assert.equal(target.hp,body(unprotected,'e').hp);assert.equal(n.seed,unprotected.seed);
 }
});

test('bodyguard interception wears only the actual guard once and leaves the protected garment intact',()=>{
 const s=field({}, {enemies:[{id:'e',x:7,y:3,leadership:95,morale:100,patrol:false,overwatch:false,...clothes('e')},{id:'guard',x:8,y:3,abilities:['bodyguard'],morale:100,patrol:false,overwatch:false,...clothes('guard')}]}),n=accepted(s,shot('torso'));
 assert.equal(body(n,'e').hp,100);assert.deepEqual(body(n,'e').outfit,body(s,'e').outfit);assert.equal(body(n,'guard').hp,51);
 assert.deepEqual(body(n,'guard').outfit,{...body(s,'guard').outfit,condition:53});assert.equal(body(n,'guard').ap,92);
 assert.deepEqual(body(n,'guard').headwear,body(s,'guard').headwear);assert.deepEqual(body(n,'guard').legwear,body(s,'guard').legwear);
});

test('lethal overkill uses real lost HP and subsequent wound time cannot wear clothing again',()=>{
 const s=field({}, {enemies:[{id:'e',x:7,y:3,hp:15,maxHp:100,morale:100,patrol:false,overwatch:false,...clothes('e')},{id:'reserve',x:25,y:6,patrol:false,overwatch:false}]}),n=accepted(s,shot('head'));
 assert.equal(body(n,'e').hp,0);assert.equal(body(n,'e').headwear.condition,60);assert.equal(body(n,'e').headwear.instanceId,'e:hat');
 const bleeding=field({hp:80,maxHp:100,bleeding:3,...clothes('p')},{exploration:true,enemies:[]}),later=actBattle(bleeding,{type:'ambient'});
 assert.ok(body(later).hp<body(bleeding).hp);for(const slot of BODY_SLOTS)assert.deepEqual(body(later)[slot],body(bleeding)[slot]);
});

test('ordinary crafting pays AP, lowers the raised gun and conserves weight before separate first aid consumes a dressing',()=>{
 const s=field({hp:55,maxHp:100,bleeding:3,medical:80,medkits:0,inventory:{linen:shirt()},...clothes('p')});body(s).weaponReady=true;
 const before=structuredClone(body(s)),action=craft(s),weight=carriedWeight(before),preview=fieldDressingsPreview(s,body(s),'linen',action.expectedSource);
 assert.equal(preview.valid,true);assert.equal(preview.pa,20);assert.deepEqual(body(s),before);
 const n=accepted(s,action),u=body(n);assert.equal(u.ap,before.ap-FIELD_DRESSINGS_AP);assert.equal(u.weaponReady,undefined);assert.equal(u.inventory.linen,undefined);assert.equal(u.medkits,3);assert.equal(carriedWeight(u),weight);
 for(const key of ['hp','bleeding','bandaged','loaded','ammo','condition','energy','activeSlot','weapon','blade'])assert.deepEqual(u[key],before[key],key);
 assert.equal(n.seed,s.seed);assert.equal(n.elapsedSeconds-s.elapsedSeconds,6);
 const prepared=accepted(n,{type:'weapon',unitId:'p',slot:'medical'});assert.equal(body(prepared).ap,u.ap-4);
 const treated=accepted(prepared,{type:'heal',unitId:'p',targetId:'p'});assert.equal(body(treated).medkits,2);assert.equal(body(treated).hp,before.hp);assert.equal(body(treated).bleeding,0);assert.equal(body(treated).ap,u.ap-4-25);
});

test('exploration crafting spends two seconds without AP or direct treatment',()=>{
 const s=field({medkits:1,inventory:{linen:shirt()}},{exploration:true,enemies:[]});body(s).ap=0;body(s).weaponReady=true;
 const n=accepted(s,craft(s));assert.equal(body(n).ap,0);assert.equal(n.elapsedSeconds-s.elapsedSeconds,2);assert.equal(body(n).medkits,4);assert.equal(body(n).weaponReady,undefined);assert.equal(body(n).hp,body(s).hp);assert.equal(n.seed,s.seed);
});

test('unpaid, worn, depleted, unsuitable and stale-source requests reject atomically',()=>{
 const valid=field({medkits:0,inventory:{linen:shirt()}}),stale=craft(valid);
 const poor=structuredClone(valid);body(poor).ap=19;rejected(poor,craft(poor));
 const worn=field({outfit:shirt(),medkits:0});rejected(worn,{type:'craftDressings',unitId:'p',inventoryKey:'outfit'});
 const damaged=field({inventory:{linen:shirt(49)}});rejected(damaged,craft(damaged));
 const replaced=structuredClone(valid);body(replaced).inventory.linen=shirt(100,'replacement:shirt');rejected(replaced,stale);
 const changed=structuredClone(valid);body(changed).inventory.linen.condition=99;rejected(changed,stale);
 const completed=accepted(valid,stale);rejected(completed,stale);assert.equal(body(completed).medkits,3);
});
