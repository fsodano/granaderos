import test from 'node:test';import assert from 'node:assert/strict';
import {createBattle,actBattle,weaponFor,bladeFor,carriedWeight,carryCapacity,BLADES} from '../game/tactical.js';
import {OPERATIVES} from '../game/data.js';
import {rosterCells,inventoryModel,orderDescriptors,orderAction,slotAction,backpackEquipAction,levelFor} from '../game/ja2-hud.js';
const tiles=()=>Array.from({length:80},(_,i)=>({x:i%10,y:Math.floor(i/10),type:'grass',blocked:false,cover:0}));
const merc=(id,extra={})=>({...OPERATIVES[id],...extra});
function battle(units=[merc(0)],extra={}){return createBattle(units,{width:10,height:8,tiles:tiles(),enemies:[{id:'enemy-0',x:5,y:1,hp:10,weapon:1800,condition:63}],seed:45,...extra});}
const players=s=>s.units.filter(u=>u.side==='player');
const ORDER_IDS=['move','fire','melee','charge','heal','loot','reload','reprime','weapon','stance','overwatch','mount','brace','repair','ration','torch','bolas','free','sight','endTurn','artillery','artilleryMove','artilleryPivot','artilleryReload'];
test('S1 squad strip: 4 players render 4 filled cells plus 2 empty slots, selection flag follows selectedId',()=>{
  const s=battle([merc(0),merc(1),merc(2),merc(3)]),cells=rosterCells(players(s),'0');
  assert.equal(cells.length,6);
  const filled=cells.slice(0,4),empty=cells.slice(4);
  for(const [i,c]of filled.entries()){
    assert.ok(!c.empty);assert.equal(c.index,i);assert.equal(c.unit.id,String(i));
    assert.ok(c.portrait===null||typeof c.portrait==='string');
    assert.equal(c.active,c.unit.id==='0');assert.equal(c.fallen,false);assert.equal(c.disabled,false);
  }
  assert.deepEqual(filled.map(c=>c.label),['Güemes','Azurduy','Beltrán','Cabral']);
  assert.equal(filled[0].hpPct,100);assert.equal(filled[0].ap,100);assert.equal(filled[0].energy,100);
  for(const c of empty){assert.equal(c.empty,true);assert.equal(c.unit,undefined);}
  const reselect=rosterCells(players(s),'2');
  assert.equal(reselect[2].active,true);assert.equal(reselect[0].active,false);
  const solo=rosterCells([players(s)[0]],'0');
  assert.equal(solo.length,6);assert.equal(solo[0].unit.id,'0');
  for(const c of solo.slice(1))assert.equal(c.empty,true);
  const spent=battle([merc(0)]);spent.units[0].ap=40;spent.units[0].energy=60;
  const sc=rosterCells(players(spent),'0')[0];
  assert.equal(sc.ap,40);assert.equal(sc.energy,60);
  const wounded=battle([merc(0,{hp:41})]);
  assert.equal(rosterCells(players(wounded),'0')[0].hpPct,50);
});
test('S2 inventory: Güemes stats, hand slots, slotAction, backpack records, supplies, weight and poncho',()=>{
  const s=battle([merc(0)]),u=players(s)[0],model=inventoryModel(s,u);
  assert.equal(model.unitAlive,true);assert.equal(model.activeSlot,'primary');
  assert.deepEqual(model.stats.map(x=>x.id),['agility','dexterity','strength','leadership','wisdom','level','marksmanship','explosives','mechanical','medical']);
  assert.deepEqual(Object.fromEntries(model.stats.map(x=>[x.id,x.label])),{agility:'Agilidad',dexterity:'Destreza',strength:'Fuerza',leadership:'Liderazgo',wisdom:'Sabiduría',level:'Nivel',marksmanship:'Puntería',explosives:'Pólvora y artillería',mechanical:'Mecánica',medical:'Medicina'});
  assert.deepEqual(Object.fromEntries(model.stats.map(x=>[x.id,x.value])),{agility:90,dexterity:85,strength:78,leadership:95,wisdom:88,level:7,marksmanship:81,explosives:40,mechanical:35,medical:30});
  assert.equal(levelFor(u),7);
  assert.equal(levelFor({agility:84,dexterity:80,strength:92,leadership:60,wisdom:70,marksmanship:68,mechanical:40,explosives:25,medical:35,maxHp:96}),6);
  assert.deepEqual(model.slots.primary,weaponFor(u));assert.equal(model.slots.primary.id,1803);assert.equal(model.slots.primary.name,'Tercerola');
  assert.deepEqual(model.slots.blade,BLADES[u.blade]);assert.equal(model.slots.blade.id,1813);assert.equal(model.slots.blade.name,'Facón Gaucho con Poncho');
  assert.deepEqual(slotAction(u),{type:'weapon',slot:'blade'});
  u.activeSlot='blade';assert.deepEqual(slotAction(u),{type:'weapon',slot:'primary'});u.activeSlot='primary';
  u.inventory.found={count:1,weight:4,weapon:1800,loaded:1,condition:63,jammed:true};
  assert.deepEqual(inventoryModel(s,u).backpack.find(b=>b.key==='found'),{key:'found',count:1,weight:4,weapon:1800,loaded:1,condition:63,jammed:true,equippable:true,name:'Brown Bess'});
  assert.deepEqual(backpackEquipAction('found','primary'),{type:'equipLoot',inventoryKey:'found',slot:'primary'});
  u.inventory.junk={count:1,weight:2,weapon:9999,loaded:0};
  assert.equal(inventoryModel(s,u).backpack.find(b=>b.key==='junk').equippable,false);
  const supplies=inventoryModel(s,u).supplies;
  assert.equal(supplies.length,6);
  const byId=Object.fromEntries(supplies.map(x=>[x.id,x]));
  assert.deepEqual(Object.keys(byId).sort(),['ammo','boleadoras','flints','priming','rations','torches']);
  assert.equal(byId.ammo.count,u.ammo);assert.equal(byId.priming.count,u.priming);assert.equal(byId.flints.count,u.flints);assert.equal(byId.rations.count,u.rations);assert.equal(byId.boleadoras.count,u.boleadoras);assert.equal(byId.torches.count,u.torches);
  for(const x of supplies){assert.ok(x.label&&x.label.length>0);assert.equal(typeof x.count,'number');}
  const m2=inventoryModel(s,u);
  assert.equal(m2.weight,carriedWeight(u));assert.equal(m2.capacity,carryCapacity(u));assert.equal(m2.poncho,false);
  u.poncho=true;assert.equal(inventoryModel(s,u).poncho,true);
});
test('S3 edges: empty roster pads to 6, fallen units are flagged and disabled, dead inventory and descriptors',()=>{
  const none=rosterCells([],'x');
  assert.equal(none.length,6);
  for(const c of none){assert.equal(c.empty,true);assert.equal(c.unit,undefined);}
  const dead=battle([merc(0,{hp:0})]),dc=rosterCells(players(dead),'0');
  assert.equal(dc.length,6);assert.equal(dc[0].fallen,true);assert.equal(dc[0].disabled,true);
  for(const c of dc.slice(1))assert.equal(c.empty,true);
  assert.equal(inventoryModel(dead,players(dead)[0]).unitAlive,false);
  const out=battle([merc(0,{energy:0})]);
  assert.equal(rosterCells(players(out),'0')[0].fallen,true);
  const routed=battle([merc(0)]);routed.units[0].routed=true;
  assert.equal(rosterCells(players(routed),'0')[0].fallen,true);
  const alive=battle([merc(0)]),u=players(alive)[0];
  for(const d of orderDescriptors(alive,u,{busy:true}))assert.equal(d.disabled,true);
  for(const d of orderDescriptors(dead,players(dead)[0],{}))assert.equal(d.disabled,true);
});
test('S4 orderDescriptors cover every order id with Spanish labels and kinds',()=>{
  const s=battle([merc(0)]),u=players(s)[0],descriptors=orderDescriptors(s,u,{});
  const ids=descriptors.map(d=>d.id);
  assert.deepEqual([...ids].sort(),[...ORDER_IDS].sort());
  assert.equal(new Set(ids).size,ids.length);
  const byId=Object.fromEntries(descriptors.map(d=>[d.id,d]));
  assert.equal(byId.move.kind,'mode');assert.equal(byId.reload.kind,'order');assert.equal(byId.sight.kind,'toggle');
  assert.equal(byId.move.label,'Mover');assert.equal(byId.fire.label,'Disparar');assert.equal(byId.melee.label,'Atacar');assert.equal(byId.charge.label,'Cargar');assert.equal(byId.heal.label,'Curar');assert.equal(byId.endTurn.label,'Fin del turno');
  for(const d of descriptors){
    assert.ok(d.label&&d.label.length>0);assert.ok(['mode','order','toggle'].includes(d.kind));
    assert.equal(typeof d.disabled,'boolean');
    if('pa'in d)assert.equal(typeof d.pa,'number');
    if('active'in d)assert.equal(typeof d.active,'boolean');
  }
  assert.equal(byId.fire.disabled,false);assert.equal(byId.melee.disabled,false);
});
test('S4 orderAction returns the exact actBattle shapes Battlefield.tsx dispatches',()=>{
  const s=battle([merc(0)]),u=players(s)[0];
  assert.deepEqual(orderAction(s,u,{movement:'run'},'movement'),{type:'movement',movement:'run'});
  assert.deepEqual(orderAction(s,u,{},'reload'),{type:'reload'});
  assert.deepEqual(orderAction(s,u,{},'reprime'),{type:'reprime'});
  assert.deepEqual(orderAction(s,u,{},'weapon'),{type:'weapon',slot:'blade'});
  assert.deepEqual(orderAction(s,u,{},'weapon'),slotAction(u));
  assert.deepEqual(orderAction(s,u,{},'stance'),{type:'stance',stance:'prone'});
  assert.deepEqual(orderAction(s,u,{},'overwatch'),{type:'overwatch'});
  assert.deepEqual(orderAction(s,u,{},'mount'),{type:'mount'});
  assert.deepEqual(orderAction(s,u,{},'brace'),{type:'brace'});
  assert.deepEqual(orderAction(s,u,{},'repair'),{type:'repair'});
  assert.deepEqual(orderAction(s,u,{},'ration'),{type:'ration'});
  assert.deepEqual(orderAction(s,u,{},'free'),{type:'free'});
  assert.deepEqual(orderAction(s,u,{inventoryKey:'found',slot:'primary'},'equipLoot'),{type:'equipLoot',inventoryKey:'found',slot:'primary'});
  assert.deepEqual(orderAction(s,u,{inventoryKey:'found',slot:'primary'},'equipLoot'),backpackEquipAction('found','primary'));
  assert.deepEqual(orderAction(s,u,{x:3,y:4},'torch'),{type:'throwTorch',x:3,y:4});
  assert.deepEqual(orderAction(s,u,{targetId:'enemy-0'},'bolas'),{type:'boleadoras',targetId:'enemy-0'});
  assert.deepEqual(orderAction(s,u,{artilleryId:'gun-0',x:5,y:5,targetId:'enemy-0',mode:'solid'},'artillery'),{type:'artillery',artilleryId:'gun-0',x:5,y:5,targetId:'enemy-0',mode:'solid'});
  assert.deepEqual(orderAction(s,u,{artilleryId:'gun-0',x:5,y:5},'artilleryMove'),{type:'artilleryMove',artilleryId:'gun-0',x:5,y:5});
  assert.deepEqual(orderAction(s,u,{artilleryId:'gun-0',x:5,y:5},'artilleryPivot'),{type:'artilleryPivot',artilleryId:'gun-0',x:5,y:5});
  assert.deepEqual(orderAction(s,u,{artilleryId:'gun-0'},'artilleryReload'),{type:'artilleryReload',artilleryId:'gun-0'});
  assert.deepEqual(orderAction(s,u,{},'endTurn'),{type:'rest'});
});
test('S4 integration smoke: every orderAction output passes through actBattle without throwing',()=>{
  const s=battle([merc(0)],{artillery:[{id:'gun-0',type:'bronze4',side:'player',x:2,y:2,loaded:true,ammo:6}]}),u=players(s)[0];
  u.inventory.found={count:1,weight:4,weapon:1800,loaded:1,condition:63,jammed:true};
  const cases=[['movement',{movement:'run'}],['reload',{}],['reprime',{}],['weapon',{}],['stance',{}],['overwatch',{}],['mount',{}],['brace',{}],['repair',{}],['ration',{}],['free',{}],['equipLoot',{inventoryKey:'found',slot:'primary'}],['torch',{x:3,y:4}],['bolas',{targetId:'enemy-0'}],['artillery',{artilleryId:'gun-0',x:5,y:5,targetId:'enemy-0',mode:'solid'}],['artilleryMove',{artilleryId:'gun-0',x:5,y:5}],['artilleryPivot',{artilleryId:'gun-0',x:5,y:5}],['artilleryReload',{artilleryId:'gun-0'}],['endTurn',{}]];
  for(const [id,ctx]of cases){
    const action=orderAction(s,u,ctx,id);
    let next;
    assert.doesNotThrow(()=>{next=actBattle(s,action);},`${id} threw through actBattle`);
    assert.ok(next.lastError===null||(typeof next.lastError==='string'&&next.lastError.length>0),`${id} lastError must be null or a defined Spanish string`);
  }
});