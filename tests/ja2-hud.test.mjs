import {makeOutfit} from '../game/outfits.js';
import test from 'node:test';import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,weaponFor,bladeFor,carriedWeight,carryCapacity,actionCosts,actionPointBudget,stanceCost,shotChance,getReachable,movementIntentReason,canSee,transferPreview,dropPreview,lootPreview,environmentTargetAt,environmentPreview,containerLootPreview,supplyUsePreview,BLADES} from '../game/tactical.js';
import {OPERATIVES} from '../game/data.js';
import {rosterCells,inventoryModel,inventoryHandlingModel,nearbyLootOptions,nearbyEnvironmentModel,toolItems,orderDescriptors,orderAction,slotAction,backpackEquipAction,levelFor,aimOptions,targetPreview,equipmentSlots,nextStance,shotLocationOptions,turnModel,unitCanAct,heardNoiseModel,facingLabel,visibleHover,interruptHover,supplyItems,heldSupplyAction,targetingHelp,groupSelectionMode,isGroupGround,isMovementGround,movementAction,toggleMovementGroup,movementGroupModel,exitModel,fieldUnits,fieldState} from '../game/ja2-hud.js';
import {executeGroupMove} from '../game/group-movement.js';
import {directionTo,turnAPCost} from '../game/tactical-awareness.js';
import {unarmedChance} from '../game/unarmed-combat.js';
import {campaignReturnModel} from '../game/ja2-hud.js';
import {fittingInventoryModel,attackCursorMode,targetItemAction,resolvedOrderType,equippedItemHelp} from '../game/ja2-hud.js';
import {contextualAttack,fitBayonetPreview,removeBayonetPreview} from '../game/tactical.js';
import {medicalUsePreview} from '../game/tactical.js';
import {AMMUNITION_TYPES,isAmmunitionStack,totalReserveAmmunition,weaponAmmoType} from '../game/ammunition-types.js';
import {setTestAmmunition} from './typed-ammunition-fixture.mjs';
import {freshDefaultErrands} from '../game/quest-definitions.js';
const tiles=()=>Array.from({length:80},(_,i)=>({x:i%10,y:Math.floor(i/10),type:'grass',blocked:false,cover:0}));
const merc=(id,extra={})=>({...OPERATIVES[id],...extra});
function battle(units=[merc(0)],extra={}){return createBattle(units,{width:10,height:8,tiles:tiles(),enemies:[{id:'enemy-0',x:5,y:1,hp:100,weapon:1800,condition:63}],seed:45,...extra});}
const players=s=>s.units.filter(u=>u.side==='player');
const ammoItem=u=>`inventory:${Object.entries(u.inventory).find(([,stack])=>isAmmunitionStack(stack)&&stack.ammoType===weaponAmmoType(u.weapon))[0]}`;
const ORDER_IDS=['move','look','stealth','useItem','fire','melee','charge','heal','loot','reload','reprime','weapon','stance','overwatch','mount','brace','repair','ration','torch','bolas','free','sight','endTurn','artillery','artilleryMove','artilleryPivot','artilleryReload'];
test('campaign return accepts settled victory care and peaceful visits without declaring hidden enemies cleared',()=>{
  const visit=battle([merc(0)],{exploration:true,enemies:[]});
  visit.sectorCleared=false;
  assert.equal(campaignReturnModel(visit).available,false);
  assert.equal(campaignReturnModel(visit,true).available,true);
  const cleared=battle([merc(0)]);
  cleared.sectorCleared=true;cleared.mode='exploration';
  Object.assign(cleared.units[1],{hp:1,unconscious:true});
  cleared.units[0].lastKnownEnemy={x:5,y:1,turn:cleared.turn};
  cleared.units[0].lastHeardNoise={x:5,y:1,turn:cleared.turn,kind:'shot',uncertainty:2};
  const before=structuredClone(cleared);
  assert.equal(campaignReturnModel(cleared).available,true);
  assert.deepEqual(cleared,before);
  for(const change of [{hp:100,unconscious:false},{hp:40,energy:0,unconscious:true},{hp:50,routed:true}]){
    const pending=structuredClone(cleared);Object.assign(pending.units[1],{x:9,y:7},change);
    assert.equal(campaignReturnModel(pending,true).available,false,'a capable enemy keeps the report closed even when unseen, exhausted, or routed');
  }
  for(const change of [{mode:'combat'},{phase:'enemy'},{phase:'interrupt',interrupt:{side:'player',unitIds:[cleared.units[0].id]}},{enemyTurn:{unitIds:[]}},{reactionStack:[]},{contactInitiative:'enemy'},{status:'victory'}]){
    assert.equal(campaignReturnModel({...cleared,...change},true).available,false);
  }
  const departed=structuredClone(cleared);departed.units[0].departure={destination:'retiro'};
  assert.equal(campaignReturnModel(departed,true).available,false);
  assert.match(campaignReturnModel(departed,true).note,/Quienes siguen aquí/);
});
test('held physical delivery discloses both destinations before its first paid gift and then shows the actual locked destination',()=>{
  // Declared finite garment and local contact isolate the real held-item HUD.
  const s=battle([merc(0,{x:1,y:1,facing:2,inventory:{gift:{item:'inventory:gift',...makeOutfit('poncho',75),instanceId:'hud-delivery:one'},spare:{item:'inventory:spare',...makeOutfit('poncho',75),instanceId:'hud-delivery:two'}},activeSlot:'item',activeItem:'inventory:gift'})],{id:'retiro',sector:'retiro',exploration:true,enemies:[],errandDefinitions:freshDefaultErrands(),questBeneficiaries:{},npcs:[{id:'local-retiro',name:'Sargento del cuartel',x:2,y:1,hp:100}]});
  const u=players(s)[0],npc=s.npcs[0],before=structuredClone(s),preview=targetPreview(s,u,npc,{mode:'useItem'});
  assert.equal(preview.valid,true,preview.reason);assert.equal(preview.pa,0);assert.match(preview.coverNote,/Retiro: apoyo local \+8/);assert.match(preview.coverNote,/Ensenada de Barragán: apoyo local \+8/);assert.match(preview.coverNote,/primera entrega aceptada fija el destino.*No podrás cambiarlo/);assert.deepEqual(s,before);
  const delivered=actBattle(s,{type:'useItem',unitId:u.id,targetId:npc.id});assert.equal(delivered.lastError,null);assert.equal(delivered.elapsedSeconds-s.elapsedSeconds,1);assert.equal(delivered.units[0].ap,u.ap);assert.equal(delivered.questBeneficiaries['retiro-uniformes'],'cuartel');assert.equal(delivered.npcs[0].questGifts[0].condition,75);assert.equal(delivered.units[0].inventory.gift,undefined);
  const held=actBattle(delivered,{type:'weapon',unitId:u.id,slot:'item',item:'inventory:spare'});assert.equal(held.lastError,null);
  const locked=targetPreview(held,held.units[0],held.npcs[0],{mode:'useItem'});assert.match(locked.coverNote,/Destino fijado: Buenos Aires · Fuerte y Retiro/);assert.doesNotMatch(locked.coverNote,/primera entrega aceptada/);assert.equal(held.units[0].inventory.spare.instanceId,'hud-delivery:two');
  // This distinct prepared contact scene starts with the already fixed choice.
  // Its public held-item order remains a paid refusal, not an item transfer.
  const other=battle([merc(0,{x:1,y:1,facing:2,inventory:{spare:before.units[0].inventory.spare},activeSlot:'item',activeItem:'inventory:spare'})],{id:'ensenada',sector:'ensenada',exploration:true,enemies:[],errandDefinitions:freshDefaultErrands(),questBeneficiaries:{'retiro-uniformes':'cuartel'},npcs:[{id:'local-ensenada',name:'Capataz del puerto',x:2,y:1,hp:100}]});
  const refusal=targetPreview(other,other.units[0],other.npcs[0],{mode:'useItem'});assert.equal(refusal.valid,true,refusal.reason);assert.match(refusal.coverNote,/Destino fijado: Buenos Aires · Fuerte y Retiro.*Este contacto rechazará el objeto; seguirá en tu equipo/);
  const refused=actBattle(other,{type:'useItem',unitId:other.units[0].id,targetId:other.npcs[0].id});assert.equal(refused.lastError,null);assert.ok(refused.elapsedSeconds>other.elapsedSeconds);assert.deepEqual(refused.units[0].inventory,other.units[0].inventory);assert.equal(refused.npcs[0].questGifts,undefined);assert.deepEqual(refused.questBeneficiaries,other.questBeneficiaries);

});
test('bayonet inventory controls share paid fit/removal admission and retain incompatible loose choices',()=>{
  const s=battle([merc(0,{weapon:1800,blade:1811,bladeCondition:73,bladeFittingPattern:'india_socket',bladeInstanceId:'socket-hud-1',activeSlot:'primary'})]);
  const u=players(s)[0];u.weapon=1800;u.condition=61;u.activeSlot='primary';
  const source=fittingInventoryModel(s,u).sources[0];
  assert.equal(source.item,'blade');assert.equal(source.condition,73);assert.equal(source.weight,.5);
  assert.deepEqual(source.preview,fitBayonetPreview(s,u,'blade'));assert.equal(source.preview.valid,true);
  const fitted=actBattle(s,{unitId:u.id,...source.action}),actor=players(fitted)[0];assert.equal(fitted.lastError,null);
  const attached=fittingInventoryModel(fitted,actor).attached;
  assert.equal(inventoryModel(fitted,actor).slots.blade,null);
  assert.equal(attached.condition,73);assert.equal(attached.hostCondition,61);assert.equal(attached.removals.length,2);
  for(const option of attached.removals)assert.deepEqual(option.preview,removeBayonetPreview(fitted,actor,option.destination));
  const incompatible=structuredClone(s);incompatible.units[0].weapon=1801;
  assert.equal(fittingInventoryModel(incompatible,incompatible.units[0]).sources[0].preview.valid,false);
  assert.ok(inventoryModel(incompatible,incompatible.units[0]).items.some(item=>item.item==='blade'));
  const unknown=structuredClone(s);unknown.units[0].bladeFittingPattern=null;
  assert.equal(fittingInventoryModel(unknown,unknown.units[0]).sources[0].preview.valid,false);
});
test('close-combat mode shares thrust routing, AP and pose while F retains the selected attack',()=>{
  const s=battle([merc(0,{weapon:1800})]);const u=players(s)[0],target=s.units.find(unit=>unit.side==='enemy');
  Object.assign(u,{weapon:1800,activeSlot:'primary',weaponMode:'melee',x:1,y:1,condition:61,loaded:0,jammed:true,weaponFittings:{bayonet:{weapon:1811,fittingPattern:'india_socket',instanceId:'socket-attack-hud',condition:73}}});
  Object.assign(target,{x:3,y:1});
  const attack=contextualAttack(s,u,target,{aim:4}),preview=targetPreview(s,u,target,{aim:4,hitLocation:'head'});
  assert.equal(attack.type,'melee');assert.equal(preview.pa,attack.pa);assert.equal(preview.valid,true);assert.equal(preview.attackLabel,'Estocada de bayoneta');assert.equal(preview.chance,undefined);assert.equal(preview.hitLocation,undefined);
  assert.equal(orderDescriptors(s,u,{target,aim:4}).find(order=>order.id==='useItem').disabled,false);
  assert.equal(resolvedOrderType(s,u,{type:'useItem',targetId:target.id}),'melee');
  assert.match(equippedItemHelp(s,u,{target,aim:4}),/Estocada de bayoneta/);
  assert.equal(attackCursorMode(u),'useItem');assert.deepEqual(targetItemAction('fire',target.id,u),{type:'fire',targetId:target.id});
  assert.equal(targetPreview(s,u,target,{mode:'fire'}).valid,false);
  u.loaded=1;u.jammed=false;
  const deliberate=targetPreview(s,u,target,{mode:'fire',aim:2});assert.equal(deliberate.pa,contextualAttack(s,u,target,{type:'fire',aim:2}).pa);assert.equal(typeof deliberate.chance,'number');
  target.x=5;assert.equal(targetPreview(s,u,target).attackType,'melee');assert.ok(targetPreview(s,u,target).pa>16);
  u.activeSlot='medical';assert.equal(attackCursorMode(u),'useItem');assert.equal(targetItemAction('fire',u.id,u).type,'useItem');assert.equal(resolvedOrderType(s,u,{type:'useItem',targetId:u.id}),'heal');
  assert.deepEqual(targetItemAction('move',target.id,u),{type:'useItem',targetId:target.id});
});
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
  assert.deepEqual(Object.fromEntries(model.stats.map(x=>[x.id,x.value])),{agility:90,dexterity:85,strength:78,leadership:95,wisdom:88,level:4,marksmanship:81,explosives:40,mechanical:35,medical:30});
  assert.equal(levelFor(u),4);
  assert.equal(levelFor({agility:84,dexterity:80,strength:92,leadership:60,wisdom:70,marksmanship:68,mechanical:40,explosives:25,medical:35,maxHp:96}),6);
  assert.deepEqual(model.slots.primary,weaponFor(u));assert.equal(model.slots.primary.id,1803);assert.equal(model.slots.primary.name,'Tercerola');
  assert.deepEqual(model.slots.blade,BLADES[u.blade]);assert.equal(model.slots.blade.id,1813);assert.equal(model.slots.blade.name,'Facón Gaucho con Poncho');
  assert.deepEqual(slotAction(u),{type:'weapon',slot:'blade'});
  u.activeSlot='blade';assert.deepEqual(slotAction(u),{type:'weapon',slot:'medical'});
  u.activeSlot='medical';assert.deepEqual(slotAction(u),{type:'weapon',slot:'supply',supplyKey:'torches'});
  u.activeSlot='unarmed';assert.deepEqual(slotAction(u),{type:'weapon',slot:'primary'});u.activeSlot='primary';
  u.inventory.found={count:1,weight:4,weapon:1800,loaded:1,condition:63,jammed:true};
  assert.deepEqual(inventoryModel(s,u).backpack.find(b=>b.key==='found'),{key:'found',count:1,weight:4,weapon:1800,loaded:1,condition:63,jammed:true,equippable:true,name:'Brown Bess',art:'/art/weapon-1800.png'});
  assert.deepEqual(backpackEquipAction('found','primary'),{type:'equipLoot',inventoryKey:'found',slot:'primary'});
  u.inventory.junk={count:1,weight:2,weapon:9999,loaded:0};
  assert.equal(inventoryModel(s,u).backpack.find(b=>b.key==='junk').equippable,false);
  const supplies=inventoryModel(s,u).supplies;
  assert.equal(supplies.length,4);
  const byId=Object.fromEntries(supplies.map(x=>[x.id,x]));
  assert.deepEqual(Object.keys(byId).sort(),['boleadoras','medkits','rations','torches']);
  const ammunition=inventoryModel(s,u).items.filter(isAmmunitionStack);
  assert.equal(ammunition.length,1);assert.equal(ammunition[0].item,ammoItem(u));assert.equal(ammunition[0].ammoType,'musket_75');assert.equal(ammunition[0].label,AMMUNITION_TYPES.musket_75.label);assert.equal(ammunition[0].count,totalReserveAmmunition(u));assert.equal(ammunition[0].weight,.04);
  assert.equal(byId.medkits.count,u.medkits);assert.equal(byId.priming,undefined);assert.equal(byId.flints,undefined);assert.equal(byId.rations.count,u.rations);assert.equal(byId.boleadoras.count,u.boleadoras);assert.equal(byId.torches.count,u.torches);
  for(const x of supplies){assert.ok(x.label&&x.label.length>0);assert.equal(typeof x.count,'number');}
  const m2=inventoryModel(s,u);
  assert.equal(m2.weight,carriedWeight(u));assert.equal(m2.capacity,carryCapacity(u));assert.equal(m2.poncho,false);
  u.outfit=makeOutfit();assert.equal(inventoryModel(s,u).poncho,true);
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
  assert.equal(byId.move.kind,'mode');assert.equal(byId.useItem.kind,'mode');assert.equal(byId.useItem.label,'Usar arma');assert.equal(byId.reload.kind,'order');assert.equal(byId.sight.kind,'toggle');
  assert.equal(byId.move.label,'Mover');assert.equal(byId.fire.label,'Disparar');assert.equal(byId.melee.label,'Golpear con la culata');assert.equal(byId.charge.label,'Cargar');assert.equal(byId.heal.label,'Vendar');assert.equal(byId.endTurn.label,'Fin del turno');
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
  assert.deepEqual(orderAction(s,u,{},'stance'),{type:'stance',stance:'crouched'});
  assert.deepEqual(orderAction(s,{...u,stance:'crouched'}, {},'stance'),{type:'stance',stance:'prone'});
  assert.deepEqual(orderAction(s,{...u,stance:'prone'}, {},'stance'),{type:'stance',stance:'standing'});
  assert.deepEqual(orderAction(s,u,{stance:'prone'},'stance'),{type:'stance',stance:'prone'});
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
  assert.deepEqual(orderAction(s,u,{targetId:'enemy-0',aim:2},'useItem'),{type:'useItem',targetId:'enemy-0',aim:2,hitLocation:'torso'});
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

test('HUD uses shared costs with specialist and nearby support modifiers',()=>{
  const s=battle([merc(0),merc(2)]),u=players(s)[0];
  u.loaded=0;u.stance='prone';u.traits=[...(u.traits||[]),'field_rescuer'];
  const descriptors=Object.fromEntries(orderDescriptors(s,u).map(d=>[d.id,d]));
  assert.equal(descriptors.heal.pa,20);
  for(const id of ['heal','fire','reload','reprime','repair','weapon','loot','mount','melee','ration'])assert.equal(descriptors[id].pa,actionCosts(s,u)[id],id);
  const result=actBattle(s,{unitId:u.id,type:'reload'});
  assert.equal(result.lastError,null);
  assert.equal(result.units[0].ap,u.ap-descriptors.reload.pa);
});

test('item slots expose medical supplies, skip missing equipment, and respect AP',()=>{
  const s=battle(),u=players(s)[0];
  assert.equal(inventoryModel(s,u).supplies.find(item=>item.id==='medkits').count,u.medkits);
  assert.equal(equipmentSlots(s,u).find(item=>item.slot==='medical').disabled,false);
  u.activeSlot='blade';u.medkits=0;
  assert.deepEqual(slotAction(u),{type:'weapon',slot:'supply',supplyKey:'torches'});
  assert.equal(equipmentSlots(s,u).find(item=>item.slot==='medical').disabled,true);
  u.ap=3;
  for(const slot of equipmentSlots(s,u))assert.equal(slot.disabled,true);
  u.ap=0;s.mode='exploration';u.medkits=1;
  assert.equal(equipmentSlots(s,u).find(item=>item.slot==='medical').disabled,false);
  u.activeSlot='medical';
  const inv=inventoryModel(s,u);
  assert.equal(inv.slots.primary.id,u.weapon);
  assert.equal(inv.slots.medical.count,1);
});

test('aim levels stop at four and unavailable firearm actions cannot be selected',()=>{
  const s=battle(),u=players(s)[0],costs=actionCosts(s,u);
  u.ap=costs.fire+costs.aim*2;
  assert.deepEqual(aimOptions(s,u).map(option=>option.disabled),[false,false,false,true,true]);
  assert.equal(aimOptions(s,u).length,5);
  assert.equal(orderDescriptors(s,u,{aim:3}).find(d=>d.id==='useItem').disabled,true);
  u.ap=100;u.jammed=true;
  assert.ok(aimOptions(s,u).every(option=>option.disabled));
  assert.equal(orderDescriptors(s,u).find(d=>d.id==='useItem').disabled,true);
  assert.equal(orderDescriptors(s,u).find(d=>d.id==='reprime').disabled,false);
  u.priming=0;assert.equal(orderDescriptors(s,u).find(d=>d.id==='reprime').disabled,false);
  u.jammed=false;u.loaded=0;setTestAmmunition(u,0);
  for(const id of ['useItem','fire','reload','overwatch'])assert.equal(orderDescriptors(s,u).find(d=>d.id===id).disabled,true,id);
  u.activeSlot='medical';u.medkits=0;
  assert.equal(orderDescriptors(s,u).find(d=>d.id==='useItem').disabled,true);
  u.medkits=1;u.medical=0;
  assert.equal(orderDescriptors(s,u).find(d=>d.id==='useItem').disabled,true);
});

test('stance control cycles all three paid postures and gets up after knockdown',()=>{
  let s=battle();
  for(const stance of ['crouched','prone','standing']){
    const u=players(s)[0],action=orderAction(s,u,{},'stance'),cost=stanceCost(u,stance),before=u.ap;
    assert.equal(action.stance,stance);assert.equal(nextStance(u),stance);
    assert.equal(orderDescriptors(s,u).find(d=>d.id==='stance').pa,cost);
    s=actBattle(s,{unitId:u.id,...action});
    assert.equal(s.lastError,null);assert.equal(players(s)[0].ap,before-cost);assert.equal(players(s)[0].stance,stance);
  }
  const u=players(s)[0];u.knockedDown=true;u.stance='prone';
  assert.equal(nextStance(u),'standing');assert.equal(orderDescriptors(s,u).find(d=>d.id==='stance').pa,12);
  u.mounted=true;assert.equal(orderDescriptors(s,u).find(d=>d.id==='stance').disabled,true);
});

test('equipped medical item previews critical stabilization while ordinary wounds need campaign recovery',()=>{
  let s=battle([merc(0),merc(1,{hp:10,bleeding:4,bandaged:0})]);
  let u=players(s)[0],patient=players(s)[1];Object.assign(u,{activeSlot:'medical',abilities:['care_composure'],shock:3.5});
  const beforeKits=u.medkits;
  const preview=targetPreview(s,u,patient,{mode:'move'});
  assert.equal(patient.unconscious,true);assert.equal(preview.valid,true);assert.equal(preview.pa,actionCosts(s,u).heal);assert.equal(preview.chance,undefined);assert.equal(preview.composureRelief,2);assert.match(preview.coverNote,/Tensión del sanitario: −2/);
  assert.equal(targetPreview(s,u,patient,{mode:'heal'}).composureRelief,2);
  s=actBattle(s,{unitId:u.id,...orderAction(s,u,{targetId:patient.id},'useItem')});
  assert.equal(s.lastError,null);u=players(s)[0];patient=players(s)[1];
  assert.equal(patient.hp,15);assert.equal(patient.bleeding,0);assert.equal(u.medkits,beforeKits-1);assert.equal(patient.hp,preview.treatment.hpAfter);assert.match(preview.coverNote,/Salud: \+5, hasta 15/);
  assert.equal(u.shock,1.5);assert.equal(targetPreview(s,u,patient,{mode:'move'}).valid,false);assert.equal(targetPreview(s,u,patient,{mode:'move'}).composureRelief,undefined);
  u.hp=40;u.bleeding=3;u.bandaged=0;
  assert.equal(targetPreview(s,u,u,{mode:'move'}).valid,true);assert.equal(targetPreview(s,u,u,{mode:'move'}).composureRelief,undefined);
  s=actBattle(s,{unitId:u.id,type:'useItem',targetId:u.id});
  assert.equal(s.lastError,null);assert.equal(players(s)[0].hp,40);assert.equal(players(s)[0].bleeding,0);assert.equal(players(s)[0].shock,1.5);
});

test('legacy healing preview requires the held medical kit and shares all medical admission reasons',()=>{
  let s=battle([merc(0),merc(1,{hp:10,bleeding:4,bandaged:0})]);let u=players(s)[0],patient=players(s)[1];
  const wrongHand=targetPreview(s,u,patient,{mode:'heal'}),shared=medicalUsePreview(s,u,patient);
  assert.equal(wrongHand.valid,false);assert.equal(wrongHand.reason,shared.reason);assert.equal(wrongHand.pa,shared.cost);
  assert.equal(orderDescriptors(s,u,{target:patient}).find(order=>order.id==='heal').disabled,true);
  assert.equal(equipmentSlots(s,u).find(slot=>slot.slot==='medical').disabled,false,'owning the kit permits its separate paid selection');
  s=actBattle(s,{type:'weapon',unitId:u.id,slot:'medical'});assert.equal(s.lastError,null);u=players(s)[0];patient=players(s)[1];
  for(const mode of ['move','useItem','heal'])assert.equal(targetPreview(s,u,patient,{mode}).valid,true);
  assert.equal(orderDescriptors(s,u,{target:patient}).find(order=>order.id==='heal').disabled,false);
  for(const change of [{ap:0},{medkits:0},{medical:0}]){
    const actor={...u,...change};const preview=targetPreview(s,actor,patient,{mode:'heal'}),expected=medicalUsePreview(s,actor,patient);
    assert.equal(preview.valid,expected.allowed);assert.equal(preview.reason,expected.reason);assert.equal(preview.pa,expected.cost);
  }
  u.knockedDown=true;assert.equal(targetPreview(s,u,patient,{mode:'heal'}).valid,true,'an already held kit can treat while knocked down');
  patient.x=9;assert.equal(targetPreview(s,u,patient,{mode:'heal'}).reason,medicalUsePreview(s,u,patient).reason);
});

test('legacy supply descriptors require the corresponding held supply without disabling equipment selection',()=>{
  const s=battle(),u=players(s)[0],enemy=s.units.find(unit=>unit.side==='enemy');u.energy=40;
  for(const [id,key,target] of [['torch','torches',{x:2,y:3}],['bolas','boleadoras',enemy],['ration','rations',u]]){
    u.activeSlot='primary';delete u.activeSupply;
    const preview=targetPreview(s,u,target,{mode:id});assert.equal(preview.valid,false);assert.equal(preview.reason,supplyUsePreview(s,u,target,key).reason);
    assert.equal(orderDescriptors(s,u,{target}).find(order=>order.id===id).disabled,true);
    assert.equal(equipmentSlots(s,u).find(slot=>slot.slot==='supply').disabled,false);
    Object.assign(u,{activeSlot:'supply',activeSupply:key});
    const shared=supplyUsePreview(s,u,target,key),descriptor=orderDescriptors(s,u,{target}).find(order=>order.id===id);
    assert.equal(descriptor.disabled,!shared.allowed);assert.equal(descriptor.pa,shared.cost);
    assert.equal(targetPreview(s,u,target,{mode:id}).valid,shared.allowed);
  }
});

test('hover preview shares shot chance and movement costs without revealing hidden enemies',()=>{
  const s=battle(),u=players(s)[0],enemy=s.units.find(v=>v.side==='enemy');enemy.hp=80;enemy.unconscious=false;
  const shot=targetPreview(s,u,enemy,{mode:'move',aim:2});
  assert.equal(shot.chance,shotChance(s,u,enemy,2));assert.equal(shot.pa,actionCosts(s,u).fire+2*actionCosts(s,u).aim);
  const reachable=getReachable(s,u),point=reachable.find(p=>p.cost>0),movement=targetPreview(s,u,point,{mode:'move',reachable});
  assert.equal(movement.pa,point.cost);assert.equal(movement.remaining,u.ap-point.cost);
  s.tiles.find(t=>t.x===3&&t.y===1).blocked=true;
  assert.equal(targetPreview(s,u,enemy,{mode:'useItem'}),null);
});

test('AP and wound readouts distinguish current capacity from the next-turn reserve',()=>{
  const s=battle(),u=players(s)[0];u.maxAP=80;u.carriedAP=20;u.ap=70;u.hp=50;u.bandaged=20;u.bleeding=3;
  const inv=inventoryModel(s,u),cell=rosterCells([u],u.id)[0];
  assert.equal(inv.currentAPLimit,100);assert.deepEqual(inv.apBudget,actionPointBudget(s,u));
  assert.equal(inv.apBudget.carryover,20);assert.equal(cell.apPct,70);assert.equal(cell.bleeding,3);assert.equal(cell.bandaged,20);
});

test('shot locations stay attached to the held firearm and ordinary useItem actions',()=>{
  const s=battle(),u=players(s)[0],target=s.units.find(v=>v.side==='enemy');
  const options=shotLocationOptions(s,u,{hitLocation:'head'});
  assert.deepEqual(options.map(location=>location.id),['torso','head','legs']);
  assert.deepEqual(options.map(location=>location.active),[false,true,false]);
  assert.ok(options.every(location=>!location.disabled));
  for(const hitLocation of ['torso','head','legs']){
    const action=orderAction(s,u,{targetId:target.id,aim:2,hitLocation},'useItem');
    assert.deepEqual(action,{type:'useItem',targetId:target.id,aim:2,hitLocation});
    const preview=targetPreview(s,u,target,{mode:'move',aim:2,hitLocation});
    assert.equal(preview.chance,shotChance(s,u,target,2,hitLocation));
    assert.equal(preview.pa,actionCosts(s,u).fire+2*actionCosts(s,u).aim);
    assert.equal(preview.hitLocation,options.find(location=>location.id===hitLocation).label);
  }
  assert.equal(orderAction(s,u,{hitLocation:'unknown'},'useItem').hitLocation,'torso');
  u.activeSlot='medical';assert.deepEqual(shotLocationOptions(s,u),[]);
  u.activeSlot='blade';assert.deepEqual(shotLocationOptions(s,u),[]);
});

const pausedBattle=()=>{
  const state=createBattle([
    {id:'spotter',name:'Vigía',x:1,y:1,agility:100,wisdom:100,experienceLevel:10,weapon:1800},
    {id:'slow',name:'Recluta',x:1,y:6,agility:1,wisdom:0,experienceLevel:1,weapon:1800},
  ],{width:10,height:8,tiles:tiles(),enemies:[{id:'mover',x:7,y:1,weapon:1800,loaded:0,ammo:0,agility:20,wisdom:50,experienceLevel:1,marksmanship:0}],seed:45});
  state.units[0].ap=20;
  return endTurn(state);
};

test('a real interrupt exposes only eligible troops and preserves their remaining AP',()=>{
  const s=pausedBattle(),spotter=s.units[0],waiting=s.units[1],turn=turnModel(s);
  assert.equal(s.phase,'interrupt');assert.equal(spotter.ap,20);
  assert.equal(turn.interrupted,true);assert.equal(turn.label,'Interrupción');assert.equal(turn.endLabel,'Continuar turno enemigo');
  assert.deepEqual(turn.units.map(u=>u.id),['spotter']);
  assert.equal(unitCanAct(s,spotter),true);assert.equal(unitCanAct(s,waiting),false);
  const cells=rosterCells(players(s),spotter.id,s);
  assert.equal(cells[0].interruptReady,true);assert.equal(cells[0].disabled,false);
  assert.equal(cells[1].interruptReady,false);assert.equal(cells[1].disabled,true);
  assert.ok(orderDescriptors(s,waiting).every(d=>d.disabled));
  assert.ok(equipmentSlots(s,waiting).every(slot=>slot.disabled));
  assert.ok(aimOptions(s,waiting).every(option=>option.disabled));
  assert.ok(shotLocationOptions(s,waiting).every(location=>location.disabled));
  assert.equal(inventoryModel(s,waiting).unitReady,false);
});

test('interrupt previews use the current AP and Continue resumes the same enemy round',()=>{
  const s=pausedBattle(),spotter=s.units[0],target=s.units.find(u=>u.id===s.interrupt.enemyId);
  const action=orderAction(s,spotter,{targetId:target.id},'useItem');
  const preview=targetPreview(s,spotter,target,{mode:'move',hitLocation:'torso'});
  assert.equal(preview.valid,true);assert.equal(preview.remaining,20-actionCosts(s,spotter).fire);
  const fired=actBattle(s,{unitId:spotter.id,...action});
  assert.equal(fired.lastError,null);assert.equal(fired.units[0].ap,preview.remaining);assert.equal(fired.phase,'interrupt');
  assert.equal(fired.elapsedSeconds,s.elapsedSeconds);
  const continued=endTurn(fired);
  assert.equal(continued.phase,'player');assert.equal(continued.turn,s.turn+1);assert.equal(continued.elapsedSeconds,s.elapsedSeconds);
  assert.equal(turnModel(continued).interrupted,false);assert.equal(turnModel(continued).endLabel,'Fin del turno');
});

test('look previews charge a turn, then offer weapon preparation in the same direction',()=>{
  const s=battle(),u=players(s)[0],point={x:u.x,y:0};
  u.facing=2;u.ap=10;
  const preview=targetPreview(s,u,point,{mode:'look'}),cost=turnAPCost(u,directionTo(u,point));
  assert.equal(preview.pa,cost);assert.equal(preview.remaining,u.ap-cost);assert.equal(preview.valid,true);
  const next=actBattle(s,{unitId:u.id,...orderAction(s,u,point,'look')});
  assert.equal(next.lastError,null);assert.equal(next.units[0].ap,u.ap-cost);assert.equal(facingLabel(next.units[0]),'N');
  const ready=targetPreview(next,next.units[0],point,{mode:'look'});assert.equal(ready.valid,true);assert.equal(ready.pa,actionCosts(next,next.units[0]).ready);
  const prepared=actBattle(next,{unitId:u.id,type:'look',...point});assert.equal(prepared.lastError,null);assert.equal(prepared.units[0].weaponReady,true);assert.equal(targetPreview(prepared,prepared.units[0],point,{mode:'look'}).valid,false);
  u.ap=cost-1;assert.match(targetPreview(s,u,point,{mode:'look'}).reason,/PA insuficientes/);
  u.stance='prone';u.ap=100;assert.equal(targetPreview(s,u,point,{mode:'look'}).pa,cost*2);
});

const separatedBattle=()=>createBattle([{id:'scout',x:1,y:1}],{width:24,height:8,enemies:[{id:'far',x:22,y:6}],seed:45});
test('stealth is a free independent switch whose movement cost matches the reachable preview',()=>{
  let s=separatedBattle(),u=s.units[0];
  const point={x:2,y:1},normal=getReachable(s,u).find(p=>p.x===point.x&&p.y===point.y);
  const action=orderAction(s,u,{},'stealth');assert.deepEqual(action,{type:'stealth',enabled:true});
  s=actBattle(s,{unitId:u.id,...action});
  assert.equal(s.lastError,null);const sneaking=s.units[0];
  assert.equal(sneaking.ap,u.ap);assert.equal(sneaking.stance,u.stance);assert.equal(sneaking.movementMode,u.movementMode);
  assert.equal(orderDescriptors(s,sneaking).find(d=>d.id==='stealth').active,true);
  const quiet=getReachable(s,sneaking).find(p=>p.x===point.x&&p.y===point.y);assert.ok(quiet.cost>normal.cost);
  const moved=actBattle(s,{type:'move',unitId:u.id,...point});assert.equal(moved.lastError,null);assert.equal(moved.units[0].ap,sneaking.ap-quiet.cost);
  assert.deepEqual(orderAction(s,sneaking,{},'stealth'),{type:'stealth',enabled:false});
});

test('hearing shows an anonymous approximate area until investigated or expired',()=>{
  const s=battle(),u=s.units[0];u.lastHeardNoise={x:4,y:2,turn:s.turn,kind:'fire',uncertainty:2,sourceId:'hidden-enemy'};
  assert.deepEqual(heardNoiseModel(s,u),{x:4,y:2,radius:2,label:'Ruido: zona aproximada'});
  s.turn+=3;assert.ok(heardNoiseModel(s,u));s.turn++;assert.equal(heardNoiseModel(s,u),null);
  u.lastHeardNoise.turn=s.turn;u.lastHeardNoise.investigated=true;assert.equal(heardNoiseModel(s,u),null);
  delete u.lastHeardNoise.investigated;u.unconscious=true;assert.equal(heardNoiseModel(s,u),null);
});

test('return to exploration requires two completed quiet turns',()=>{
  const s=separatedBattle();assert.equal(turnModel(s).canExplore,false);
  s.quietCombatTurns=1;assert.equal(turnModel(s).canExplore,false);
  s.quietCombatTurns=2;s.units[1].lastHeardNoise={x:5,y:5,turn:s.turn,uncertainty:2};assert.equal(turnModel(s).canExplore,true);
  const ap=s.units[0].ap,medkits=s.units[0].medkits;
  const next=actBattle(s,{type:'explore'});
  assert.equal(next.lastError,null);assert.equal(next.mode,'exploration');assert.equal(next.sectorCleared,false);
  assert.equal(next.units[0].ap,ap);assert.equal(next.units[0].medkits,medkits);assert.equal(turnModel(next).canExplore,false);
});

test('empty hands stay selectable without equipment and ordinary useItem uses fists',()=>{
  let s=battle(),u=s.units[0];u.weaponDropped=true;u.blade=null;u.medkits=0;u.torches=0;u.boleadoras=0;u.rations=0;
  assert.equal(slotAction(u).slot,'unarmed');
  assert.deepEqual(equipmentSlots(s,u).map(slot=>slot.disabled),[true,true,true,false]);
  s=actBattle(s,{type:'weapon',unitId:u.id,slot:'unarmed'});u=s.units[0];
  assert.equal(s.lastError,null);assert.equal(u.activeSlot,'unarmed');assert.equal(weaponFor(u).name,'Puños');
  assert.equal(orderDescriptors(s,u).find(d=>d.id==='useItem').label,'Usar puños');
  assert.equal(shotLocationOptions(s,u).length,0);
  const enemy=s.units.find(v=>v.side==='enemy');enemy.x=u.x+1;enemy.y=u.y;
  const preview=targetPreview(s,u,enemy,{mode:'move'});assert.equal(preview.valid,true);assert.equal(preview.pa,actionCosts(s,u).melee);
  assert.equal(preview.chance,unarmedChance(u,enemy,{aware:canSee(s,enemy,u)}));assert.equal(preview.hitLocation,undefined);assert.equal(preview.attackLabel,'Puños');
});

const exchangeBattle=()=>createBattle([{id:'giver',name:'Proveedor',x:1,y:1},{id:'receiver',name:'Compañero',x:2,y:1}],{width:24,height:8,enemies:[{id:'far',x:22,y:6}],seed:45});
test('item handling shares AP, range, capacity, quantity and throw previews with the reducer',()=>{
  const s=exchangeBattle(),u=s.units[0],target=s.units[1],item=ammoItem(u),ctx={item,count:5,targetId:target.id};
  let model=inventoryHandlingModel(s,u,ctx),shared=transferPreview(s,u,target,item,5);
  assert.equal(model.transfer.disabled,false);assert.equal(model.transfer.label,'Dar al aliado');assert.equal(model.transfer.pa,shared.pa);
  assert.equal(model.drop.pa,dropPreview(s,u,item,5).pa);
  const next=actBattle(s,{type:'transfer',unitId:u.id,...ctx});assert.equal(next.lastError,null);assert.equal(totalReserveAmmunition(next.units[0]),totalReserveAmmunition(u)-5);assert.equal(totalReserveAmmunition(next.units[1]),totalReserveAmmunition(target)+5);assert.equal(next.units[0].ap,u.ap-model.transfer.pa);
  target.x=5;model=inventoryHandlingModel(s,u,ctx);shared=transferPreview(s,u,target,item,5);
  assert.equal(model.transfer.label,'Arrojar al aliado');assert.equal(model.transfer.pa,shared.pa);assert.equal(model.transfer.chance,shared.chance);
  target.ap=0;assert.equal(inventoryHandlingModel(s,u,ctx).transfer.chance,0);
  target.x=9;assert.equal(inventoryHandlingModel(s,u,ctx).transfer.disabled,true);
  target.x=2;assert.equal(inventoryHandlingModel(s,u,{...ctx,count:1.5}).transfer.disabled,true);
  assert.equal(inventoryHandlingModel(s,u,{...ctx,count:totalReserveAmmunition(u)+1}).drop.disabled,true);
  assert.equal(inventoryHandlingModel(s,u,{...ctx,busy:true}).drop.disabled,true);
  for(const slot of inventoryModel(s,target).pockets.slots.filter(slot=>!slot.entry))target.inventory[`full-${slot.id}`]={count:1,weight:.1};
  setTestAmmunition(u,20);assert.equal(inventoryModel(s,target).pockets.free,0);
  assert.equal(inventoryHandlingModel(s,u,{...ctx,count:20}).transfer.disabled,true);
});

test('inventory rows retain exact weapon records and use canonical keys when managing a stack',()=>{
  const s=exchangeBattle(),u=s.units[0];
  u.inventory.ammo={count:1,weight:4,weapon:1800,loaded:1,condition:63,jammed:true,instanceId:'old-musket'};
  const row=inventoryModel(s,u).items.find(item=>item.item==='inventory:ammo');
  assert.equal(row.condition,63);assert.equal(row.loaded,1);assert.equal(row.jammed,true);assert.equal(row.instanceId,'old-musket');
  const next=actBattle(s,{type:'drop',unitId:u.id,item:row.item,count:1});
  assert.equal(next.lastError,null);assert.equal(next.units[0].ammo,u.ammo);assert.equal(next.units[0].inventory.ammo,undefined);
  const ground=next.groundItems[0];assert.equal(ground.condition,63);assert.equal(ground.loaded,1);assert.equal(ground.instanceId,'old-musket');
  const option=nearbyLootOptions(next,next.units[0]).find(item=>item.action.groundId===ground.id);
  assert.ok(option);assert.equal(option.label,'Brown Bess');assert.equal(option.count,1);
});

test('nearby loot gives a selectable partial stack without exposing distant or fled bodies',()=>{
  const s=exchangeBattle(),u=s.units[0],source=s.units[1];source.hp=0;source.unconscious=true;
  for(const slot of inventoryModel(s,u).pockets.slots.filter(slot=>!slot.entry))u.inventory[`full-${slot.id}`]={count:1,weight:.1};
  const options=nearbyLootOptions(s,u),ammo=options.find(item=>item.action.targetId===source.id&&item.action.item===ammoItem(source));
  assert.ok(ammo);assert.ok(options.some(item=>item.action.item==='weapon'));
  assert.equal(lootPreview(s,u,{type:'loot',targetId:source.id}).valid,true);
  assert.equal(lootPreview(s,u,{type:'loot',targetId:source.id,item:'weapon',count:1}).valid,false);
  assert.equal(lootPreview(s,u,{...ammo.action,count:1}).valid,true);
  const next=actBattle(s,{unitId:u.id,...ammo.action,count:1});assert.equal(next.lastError,null);assert.equal(totalReserveAmmunition(next.units[0]),totalReserveAmmunition(u)+1);assert.equal(totalReserveAmmunition(next.units[1]),totalReserveAmmunition(source)-1);
  source.x=8;assert.deepEqual(nearbyLootOptions(s,u),[]);
  source.x=2;source.fled=true;assert.deepEqual(nearbyLootOptions(s,u),[]);
});

test('knockdown blocks attack and movement previews while equipped bandaging remains possible',()=>{
  const s=exchangeBattle(),u=s.units[0],target=s.units[1];target.side='enemy';
  Object.assign(u,{knockedDown:true,stance:'prone'});
  for(const activeSlot of ['primary','unarmed']){
    u.activeSlot=activeSlot;
    const preview=targetPreview(s,u,target,{mode:'move'});
    assert.equal(preview.valid,false);assert.match(preview.reason,/levantarte/);
    assert.match(actBattle(s,{type:'useItem',unitId:u.id,targetId:target.id}).lastError,/derribado/);
  }
  const point={x:1,y:2,cost:16};assert.match(targetPreview(s,u,point,{mode:'move',reachable:[point]}).reason,/levantarte/);
  Object.assign(u,{activeSlot:'medical',hp:70,bleeding:3,bandaged:0});
  assert.equal(targetPreview(s,u,u,{mode:'move'}).valid,true);
  assert.equal(actBattle(s,{type:'useItem',unitId:u.id,targetId:u.id}).lastError,null);
});

test('the weapon selector skips an empty primary slot without inventing a droppable object',()=>{
  const s=exchangeBattle(),u=s.units[0];Object.assign(u,{weapon:0,blade:null,medkits:0,torches:0,boleadoras:0,rations:0,activeSlot:'unarmed',weaponDropped:false});
  assert.equal(equipmentSlots(s,u).find(slot=>slot.slot==='primary').disabled,true);
  assert.equal(slotAction(u).slot,'unarmed');assert.ok(!inventoryModel(s,u).items.some(item=>item.item==='primary'));
});

test('owned tools join the item selector with their canonical record and actual condition',()=>{
  const s=exchangeBattle(),u=s.units[0];u.inventory.picks={itemType:'tool',toolKey:'lockpick',count:1,condition:47,weight:.3};
  u.inventory.empty={itemType:'tool',toolKey:'crowbar',count:0,condition:80,weight:2};
  const tools=toolItems(u);assert.equal(tools.length,1);assert.equal(tools[0].item,'inventory:picks');assert.equal(tools[0].condition,47);
  assert.equal(inventoryModel(s,u).backpack.find(item=>item.key==='picks').name,tools[0].name);
  assert.deepEqual(equipmentSlots(s,u).find(slot=>slot.slot==='tool').action,{type:'weapon',slot:'tool',toolKey:'inventory:picks'});
  u.activeSlot='medical';assert.deepEqual(slotAction(u),{type:'weapon',slot:'tool',toolKey:'inventory:picks'});
  u.ap=3;assert.equal(equipmentSlots(s,u).find(slot=>slot.slot==='tool').disabled,true);
  u.inventory.picks.count=0;assert.equal(toolItems(u).length,0);assert.ok(!equipmentSlots(s,u).some(slot=>slot.slot==='tool'));
});

test('ordinary environmental use follows the held key and shares unlock/open AP previews',()=>{
  let s=exchangeBattle(),u=s.units[0];s.units[1].y=3;
  Object.assign(s.tiles.find(t=>t.x===2&&t.y===1),{type:'door',doorId:'store',open:false,blocked:true,blocksSight:true,locked:true,keyId:'blue'});
  u.inventory.key={itemType:'tool',toolKey:'key',keyId:'blue',count:1,condition:80,weight:.2};
  s=actBattle(s,{unitId:u.id,type:'weapon',slot:'tool',toolKey:'inventory:key'});assert.equal(s.lastError,null);u=s.units[0];
  assert.equal(orderDescriptors(s,u).find(order=>order.id==='useItem').pa,undefined);
  for(const expected of ['unlock','open']){
    const ref=environmentTargetAt(s,{x:2,y:1}),shared=environmentPreview(s,u,ref),preview=targetPreview(s,u,{x:2,y:1},{mode:'move'}),before=u.ap;
    assert.equal(shared.action.verb,expected);assert.equal(preview.valid,true);assert.equal(preview.pa,shared.pa);assert.equal(preview.actionLabel,shared.label);
    s=actBattle(s,{type:'useItem',unitId:u.id,environment:{kind:ref.kind,id:ref.id}});assert.equal(s.lastError,null);u=s.units[0];assert.equal(u.ap,before-preview.pa);
  }
  assert.equal(s.tiles.find(t=>t.doorId==='store').open,true);
});

test('nearby wall controls expose only observed ground walls and the actual equipped crowbar action',()=>{
  const s=createBattle([{id:'p',x:1,y:3,facing:2,activeSlot:'tool',activeTool:'inventory:bar',inventory:{bar:{kind:'tool',toolKey:'crowbar',count:1,condition:72,weight:2.5}}}],
    {width:8,height:7,tiles:Array.from({length:56},(_,i)=>({x:i%8,y:Math.floor(i/8),type:'grass',blocked:false,cover:0})),enemies:[{id:'guard',x:7,y:6,patrol:false,overwatch:false}]});
  const wall=s.tiles.find(t=>t.x===2&&t.y===3);
  Object.assign(wall,{type:'wall',material:'adobe',blocked:true,blocksSight:true,buildingId:'private-building',roomId:null});
  Object.assign(s.tiles.find(t=>t.x===3&&t.y===3),{type:'wall',material:'wood',blocked:true,blocksSight:true,roomId:'private-room'});
  const u=s.units[0],before=structuredClone(s),model=nearbyEnvironmentModel(s,u),ref=environmentTargetAt(s,wall);
  assert.equal(model.targets.length,1);assert.equal(model.target.kind,'wall');assert.match(model.target.label,/Pared de adobe/);
  assert.deepEqual(model.verbs.map(verb=>verb.id),['breach']);assert.deepEqual(model.contents,[]);assert.equal(model.loot,null);
  for(const field of ['open','locked','broken','trapKnown','contents','buildingId','roomId'])assert.equal(model.target[field],undefined,field);
  assert.ok(!JSON.stringify(model).includes('private-'));
  const shared=environmentPreview(s,u,ref,'breach'),hover=targetPreview(s,u,wall,{mode:'useItem'});
  assert.equal(model.preview.valid,true);assert.deepEqual(model.preview.action,shared.action);assert.equal(model.preview.pa,shared.pa);
  assert.equal(hover.actionLabel,shared.label);assert.equal(hover.pa,shared.pa);assert.match(hover.coverNote,new RegExp(`hasta ${shared.toolWear} puntos`));
  assert.match(targetingHelp('useItem',u),/pared de adobe/);assert.deepEqual(s,before,'listing and forecasting do not mutate the field or tool');
  assert.deepEqual(nearbyEnvironmentModel(s,{...u,x:0}).targets,[],'distant walls do not fill the panel');
  assert.deepEqual(nearbyEnvironmentModel(s,{...u,tacticalLevel:1}).targets,[],'roof actors do not receive ground-wall actions');
  const wood=structuredClone(s);Object.assign(wood.tiles.find(t=>t.x===2&&t.y===3),{material:'wood'});
  assert.match(nearbyEnvironmentModel(wood,wood.units[0]).target.label,/Barricada de madera/);
  for(const material of [undefined,'stone']){
    const unsupported=structuredClone(s);unsupported.tiles.find(t=>t.x===2&&t.y===3).material=material;
    assert.deepEqual(nearbyEnvironmentModel(unsupported,unsupported.units[0]).targets,[]);
  }
  const broken=structuredClone(s);broken.units[0].inventory.bar.condition=0;
  assert.equal(nearbyEnvironmentModel(broken,broken.units[0]).preview.valid,false);
});

test('closed container contents and unknown traps stay absent from the HUD until revealed',()=>{
  let s=exchangeBattle(),u=s.units[0];s.units[1].y=3;
  s.props.push({id:'box',type:'chest',x:2,y:1,open:false,locked:true,trap:{type:'alarm',difficulty:73,armed:true,discoveredBy:[]},contents:[{item:ammoItem(u),kind:'ammunition',ammoType:weaponAmmoType(u.weapon),name:AMMUNITION_TYPES[weaponAmmoType(u.weapon)].name,count:137,weight:.04}]});
  let model=nearbyEnvironmentModel(s,u);assert.equal(model.target.trapKnown,false);assert.deepEqual(model.contents,[]);assert.equal(model.preview.chance,null);
  assert.ok(!JSON.stringify(model).includes('137'));assert.ok(!JSON.stringify(model).includes('73'));
  const ref=environmentTargetAt(s,{x:2,y:1});assert.equal(containerLootPreview(s,u,ref,0,1).valid,false);
  Object.assign(s.props[0],{open:true,locked:false});s.props[0].trap.discoveredBy=['player'];s.props[0].trap.armed=false;
  model=nearbyEnvironmentModel(s,u,{index:0,count:3});assert.equal(model.target.trapKnown,true);assert.equal(model.contents[0].count,137);assert.equal(model.loot.valid,true);
  s=actBattle(s,model.loot.action);assert.equal(s.lastError,null);assert.equal(totalReserveAmmunition(s.units[0]),totalReserveAmmunition(u)+3);assert.equal(s.props[0].contents[0].count,134);
  s.units[0].x=12;assert.deepEqual(nearbyEnvironmentModel(s,s.units[0]).targets,[]);
});

test('held tools cannot produce a valid attack preview on a person',()=>{
  const s=exchangeBattle(),u=s.units[0],enemy=s.units[1];enemy.side='enemy';u.activeSlot='tool';u.activeTool='inventory:key';u.inventory.key={itemType:'tool',toolKey:'key',count:1,condition:100};
  const preview=targetPreview(s,u,enemy,{mode:'move'});assert.equal(preview.valid,false);assert.match(preview.reason,/puerta o un cofre/);assert.equal(preview.chance,undefined);
});

test('hearing-only interrupts focus anonymous noise and never expose the hidden enemy location',()=>{
  const s=separatedBattle(),u=s.units[0],enemy=s.units[1];s.phase='interrupt';s.interrupt={side:'player',unitIds:[u.id],enemyId:enemy.id};
  u.lastHeardNoise={x:15,y:4,uncertainty:3,turn:s.turn,kind:'alarm'};
  const hover=interruptHover(s,u.id);assert.deepEqual(hover,{x:15,y:4,anonymous:true});
  assert.notEqual(hover.x,enemy.x);assert.equal(hover.id,undefined);assert.equal(hover.name,undefined);
  assert.equal(targetPreview(s,u,hover,{mode:'useItem'}),null);
  assert.equal(visibleHover(s,enemy),null);
  delete u.lastHeardNoise;assert.equal(interruptHover(s,u.id),null);
});

test('unit hover is recalculated from current visibility after the enemy moves out of sight',()=>{
  const s=exchangeBattle(),u=s.units[0],enemy=s.units[1];enemy.side='enemy';
  const oldHover={...enemy};assert.equal(visibleHover(s,oldHover).id,enemy.id);
  enemy.x=22;enemy.y=6;assert.equal(visibleHover(s,oldHover),null);
  enemy.x=3;enemy.y=1;assert.equal(visibleHover(s,oldHover).x,3);
});

test('W cycles each owned supply and the HUD keeps one contextual supply slot',()=>{
  let s=battle(),u=s.units[0];u.activeSlot='medical';
  assert.deepEqual(supplyItems(u).map(item=>item.key),['torches','boleadoras','rations']);
  assert.equal(equipmentSlots(s,u).filter(slot=>slot.slot==='supply').length,1);
  const load=u.loaded,ammo=u.ammo;
  for(const key of ['torches','boleadoras','rations']){
    const action=slotAction(u),ap=u.ap;
    assert.deepEqual(action,{type:'weapon',slot:'supply',supplyKey:key});
    s=actBattle(s,{...action,unitId:u.id});assert.equal(s.lastError,null);u=s.units[0];
    assert.equal(u.ap,ap-4);assert.equal(u.activeSupply,key);assert.equal(u.loaded,load);assert.equal(u.ammo,ammo);
    assert.equal(equipmentSlots(s,u).find(slot=>slot.slot==='supply').active,true);
  }
  assert.equal(slotAction(u).slot,'unarmed');
  u.activeSlot='supply';u.activeSupply='torches';u.boleadoras=0;
  assert.deepEqual(slotAction(u),{type:'weapon',slot:'supply',supplyKey:'rations'});
  u.ap=3;assert.equal(equipmentSlots(s,u).find(slot=>slot.slot==='supply').disabled,true);
  u.torches=0;u.rations=0;assert.equal(supplyItems(u).length,0);assert.ok(!equipmentSlots(s,u).some(slot=>slot.slot==='supply'));
});

test('held torches use the tile before movement or door interaction and share exact rejection costs',()=>{
  let s=battle(),u=s.units[0];
  s=actBattle(s,{type:'weapon',unitId:u.id,slot:'supply',supplyKey:'torches'});assert.equal(s.lastError,null);u=s.units[0];
  const point={x:2,y:1};Object.assign(s.tiles.find(tile=>tile.x===point.x&&tile.y===point.y),{type:'door',doorId:'entry',open:false,blocked:true});
  const blocked=targetPreview(s,u,point,{mode:'move'}),shared=supplyUsePreview(s,u,point);
  assert.equal(blocked.valid,false);assert.equal(blocked.reason,shared.reason);assert.equal(blocked.pa,10);assert.equal(blocked.actionLabel,'Arrojar antorcha');
  assert.notEqual(blocked.actionLabel,'Abrir');
  assert.deepEqual(heldSupplyAction(u,point),{type:'useItem',x:2,y:1});
  assert.equal(actBattle(s,{...heldSupplyAction(u,point),unitId:u.id}).lastError,blocked.reason);
  const clear={x:3,y:3},before={ap:u.ap,torches:u.torches,x:u.x,y:u.y};
  const preview=targetPreview(s,u,clear,{mode:'move',reachable:getReachable(s,u)});
  assert.equal(preview.valid,true);assert.equal(preview.pa,10);assert.equal(preview.hitLocation,undefined);
  s=actBattle(s,{...heldSupplyAction(u,clear),unitId:u.id});assert.equal(s.lastError,null);u=s.units[0];
  assert.equal(u.ap,before.ap-10);assert.equal(u.torches,before.torches-1);assert.equal(u.x,before.x);assert.equal(u.y,before.y);
  assert.ok(s.lights.some(light=>light.type==='torch'&&light.x===3&&light.y===3));
  assert.equal(orderDescriptors(s,u).find(order=>order.id==='useItem').pa,10);
});

test('held rations preview self-use, fatigue, AP and knockdown through the same rule as execution',()=>{
  let s=battle([merc(0,{energy:40}),merc(3)]),u=s.units[0];
  s=actBattle(s,{type:'weapon',unitId:u.id,slot:'supply',supplyKey:'rations'});assert.equal(s.lastError,null);u=s.units[0];
  const ally=s.units[1],wrong=targetPreview(s,u,ally,{mode:'move'});
  assert.equal(wrong.valid,false);assert.equal(wrong.reason,supplyUsePreview(s,u,ally).reason);
  assert.deepEqual(heldSupplyAction(u,u),{type:'useItem',targetId:u.id});
  const ap=u.ap,hp=u.hp,rations=u.rations;u.knockedDown=true;
  const preview=targetPreview(s,u,u,{mode:'move'});assert.equal(preview.valid,true);assert.equal(preview.pa,10);assert.match(targetingHelp('move',u),/Seleccionate a vos/);
  s=actBattle(s,{...heldSupplyAction(u,u),unitId:u.id});assert.equal(s.lastError,null);u=s.units[0];
  assert.equal(u.ap,ap-10);assert.equal(u.rations,rations-1);assert.equal(u.hp,hp);assert.equal(u.energy,60);
  u.energy=100;u.fatigue=0;
  assert.equal(targetPreview(s,u,u,{mode:'move'}).valid,false);
  assert.equal(orderDescriptors(s,u).find(order=>order.id==='useItem').disabled,true);
});

test('held boleadoras target only visible enemies with the shared AP and interrupt limits',()=>{
  let s=battle(),u=s.units[0];
  s=actBattle(s,{type:'weapon',unitId:u.id,slot:'supply',supplyKey:'boleadoras'});assert.equal(s.lastError,null);u=s.units[0];
  const target=s.units.find(unit=>unit.side==='enemy'),preview=targetPreview(s,u,target,{mode:'move'});
  assert.equal(preview.valid,true);assert.equal(preview.pa,12);assert.equal(preview.hitLocation,undefined);assert.equal(preview.chance,undefined);
  const ap=u.ap,bolas=u.boleadoras;
  s=actBattle(s,{...heldSupplyAction(u,target),unitId:u.id});assert.equal(s.lastError,null);u=s.units[0];
  assert.equal(u.ap,ap-12);assert.equal(u.boleadoras,bolas-1);assert.equal(s.units.find(unit=>unit.id===target.id).entangled,true);
  Object.assign(u,{activeSlot:'supply',activeSupply:'boleadoras',boleadoras:1,ap:11});
  const short=targetPreview(s,u,target,{mode:'move'});assert.equal(short.valid,false);assert.equal(short.reason,supplyUsePreview(s,u,target).reason);
  u.ap=30;s.phase='interrupt';s.interrupt={side:'player',unitIds:[],enemyId:target.id};
  assert.equal(targetPreview(s,u,target,{mode:'move'}).valid,false);
  s.phase='player';delete s.interrupt;s.units.find(unit=>unit.id===target.id).x=100;
  assert.equal(visibleHover(s,target),null);assert.equal(targetPreview(s,u,visibleHover(s,target),{mode:'move'}),null);
});

test('additive group selection preserves the anchor and cannot include hostiles or inactive soldiers',()=>{
  const s=battle([merc(0),merc(3),merc(10,{energy:0})],{exploration:true,enemies:[]});
  assert.equal(groupSelectionMode(s),true);
  let ids=toggleMovementGroup(s,[],'3','0');assert.deepEqual(ids,['0','3']);
  ids=toggleMovementGroup(s,ids,'10','0');assert.deepEqual(ids,['0','3']);
  ids=toggleMovementGroup(s,ids,'0','0');assert.deepEqual(ids,['3']);
  assert.deepEqual(toggleMovementGroup(s,ids,'unknown','0'),ids);
  s.mode='combat';assert.deepEqual(toggleMovementGroup(s,ids,'0','0'),ids);
  assert.deepEqual(movementGroupModel(s,ids,'0',{x:4,y:4}).members,[]);
});

test('group HUD uses the shared request and per-member route while retaining each movement mode',()=>{
  const s=battle([merc(0,{mounted:false,movementMode:'walk'}),merc(3,{movementMode:'crouch'})],{exploration:true,enemies:[]});
  const model=movementGroupModel(s,['0','3'],'0',{x:5,y:3});
  assert.deepEqual(model.request,{unitIds:['0','3'],anchorId:'0',x:5,y:3});
  assert.equal(model.preview.ok,true);assert.equal(model.preview.members.length,2);
  const result=executeGroupMove(s,model.request);assert.equal(result.status,'completed');
  assert.ok(result.elapsedSeconds>0);assert.equal(result.state.units[0].movementMode,'walk');assert.equal(result.state.units[1].movementMode,'crouch');
  assert.ok(result.orders.every(order=>order.type==='move'&&!('movement' in order)));
  s.mode='combat';s.phase='interrupt';s.interrupt={side:'player',unitIds:['0'],enemyId:'unseen'};
  const contact=movementGroupModel(s,['0','3'],'0',{x:5,y:3});assert.equal(contact.request,null);assert.deepEqual(contact.members,[]);
});

test('explicit group ground selection takes precedence over a held torch but leaves unit and door use individual',()=>{
  const s=battle([merc(0),merc(3)],{exploration:true,enemies:[]}),u=s.units[0];
  Object.assign(u,{activeSlot:'supply',activeSupply:'torches'});
  assert.equal(isGroupGround(s,u,{x:4,y:3}),true);
  assert.equal(isGroupGround(s,u,s.units[1]),false);
  Object.assign(s.tiles.find(tile=>tile.x===2&&tile.y===1),{type:'door',doorId:'group-entry',blocked:true,open:false});
  assert.equal(isGroupGround(s,u,{x:2,y:1}),false);
  s.mode='combat';assert.equal(isGroupGround(s,u,{x:4,y:3}),false);
});

test('Alt movement previews and executes the same paid route in standing, crouched and prone stances',()=>{
  for(const [movementMode,stance] of [['walk','standing'],['crouch','crouched'],['prone','prone']]){
    const s=battle([merc(3,{x:3,y:3,facing:2,mounted:false,movementMode,stance})]),u=s.units[0],point={x:1,y:3};
    const normal=getReachable(s,u).find(tile=>tile.x===point.x&&tile.y===point.y),reachable=getReachable(s,u,{movementIntent:'preserveFacing'});
    const destination=reachable.find(tile=>tile.x===point.x&&tile.y===point.y),preview=targetPreview(s,u,point,{mode:'move',movementIntent:'preserveFacing',reachable});
    assert.equal(preview.valid,true);assert.equal(preview.pa,destination.cost);assert.ok(preview.pa>normal.cost);assert.equal(preview.actionLabel,'Mover sin girar');
    const action=movementAction(point,'preserveFacing');assert.deepEqual(action,{type:'move',x:1,y:3,tacticalLevel:0,movementIntent:'preserveFacing'});
    const next=actBattle(s,{...action,unitId:u.id});assert.equal(next.lastError,null);assert.equal(next.units[0].facing,u.facing);assert.equal(next.units[0].ap,u.ap-preview.pa);
    assert.equal(next.units[0].stance,stance);assert.equal(next.units[0].movementMode,movementMode);
    assert.deepEqual(movementAction(point),{type:'move',x:1,y:3,tacticalLevel:0});
    assert.notEqual(actBattle(s,{...movementAction(point),unitId:u.id}).units[0].facing,u.facing);
  }
});

test('Alt movement shows shared mounted and running errors and never consumes a held torch',()=>{
  for(const options of [{movementMode:'run',mounted:false},{movementMode:'walk',mounted:true}]){
    const s=battle([merc(3,{x:3,y:3,...options})]),u=s.units[0],point={x:2,y:3};
    const preview=targetPreview(s,u,point,{mode:'move',movementIntent:'preserveFacing'});
    assert.equal(preview.valid,false);assert.equal(preview.reason,movementIntentReason(u,'preserveFacing'));
    assert.equal(actBattle(s,{...movementAction(point,'preserveFacing'),unitId:u.id}).lastError,preview.reason);
  }
  const s=battle([merc(3,{x:3,y:3,mounted:false,activeSlot:'supply',activeSupply:'torches'})]),u=s.units[0],point={x:2,y:3};
  assert.equal(isMovementGround(s,u,point),true);assert.equal(targetPreview(s,u,point,{mode:'move',movementIntent:'preserveFacing'}).actionLabel,'Mover sin girar');
  const next=actBattle(s,{...movementAction(point,'preserveFacing'),unitId:u.id});assert.equal(next.lastError,null);assert.equal(next.units[0].torches,u.torches);assert.equal(next.lights.length,s.lights.length);
  assert.match(targetingHelp('move',u,{movementIntent:'preserveFacing'}),/Cancela el grupo/);
});


test('exit HUD uses shared all-member admission and explicitly selects an eligible subset',()=>{
 const s=battle([{id:'p',name:'En el borde',x:0,y:2},{id:'q',name:'En el centro',x:3,y:2}],{exploration:true,enemies:[],exits:[{id:'west',edge:'W',destination:'retiro',entryEdge:'E',entryAnchor:{x:19,y:3}}]});
 const model=exitModel(s,{unitIds:['p','q'],exitId:'west'});assert.equal(model.preview.available,false);assert.deepEqual(model.preview.eligibleIds,['p']);assert.match(model.preview.blocked[0].reason,/borde/);assert.equal(model.selectedExit.label,'Oeste · retiro');
 const subset=exitModel(s,{unitIds:model.preview.eligibleIds,exitId:'west'});assert.equal(subset.preview.available,true);assert.deepEqual(subset.action,{type:'exit',unitIds:['p'],exitId:'west'});
 const next=actBattle(s,subset.action);assert.equal(next.lastError,null);assert.equal(next.status,'active');const after=exitModel(next,{unitIds:['p','q'],exitId:'west'});assert.deepEqual(after.unitIds,['q']);assert.equal(after.departures.length,1);
 next.phase='interrupt';next.interrupt={side:'player',unitIds:['q'],enemyId:'e'};assert.match(exitModel(next,{unitIds:['q']}).preview.reason,/turno normal/);
});

test('departed receipts never become field units, roster portraits, hover or item recipients',()=>{
 let s=battle([{id:'p',name:'Se fue',x:0,y:2},{id:'q',name:'Queda',x:1,y:2}],{exploration:true,enemies:[],exits:[{id:'west',edge:'W',destination:'retiro',entryEdge:'E',entryAnchor:{x:19,y:3}}]});
 s=actBattle(s,{type:'exit',unitIds:['p'],exitId:'west'});const [p,q]=s.units;
 assert.equal(s.units.length,2);assert.deepEqual(fieldUnits(s).map(u=>u.id),['q']);assert.equal(fieldState(s).units.length,1);assert.equal(visibleHover(s,p),null);assert.equal(rosterCells(s.units,'q',s).filter(cell=>!cell.empty).length,1);
 assert.ok(!inventoryHandlingModel(s,q,{item:'ammo',count:1}).recipients.some(u=>u.id==='p'));assert.deepEqual(movementGroupModel(s,['p','q'],'q',null).members.map(u=>u.id),['q']);assert.equal(isMovementGround(s,q,p),true);
 p.unconscious=true;assert.ok(!nearbyLootOptions(s,q).some(option=>option.action.targetId==='p'));
 const fleeing={...q,id:'fleeing',side:'enemy',routed:true};s.units.push(fleeing);assert.ok(fieldUnits(s).includes(fleeing));
});


test('a routed visible enemy remains an attack target until surrender or real departure',()=>{
 const s=battle([{id:'p',x:1,y:1}],{enemies:[{id:'e',x:3,y:1,routed:true}]});
 const [u,target]=s.units;const preview=targetPreview(s,u,target);assert.ok(preview);assert.equal(preview.valid,true);assert.equal(actBattle(s,{type:'useItem',unitId:u.id,targetId:target.id}).lastError,null);
 target.surrendered=true;assert.equal(targetPreview(s,u,target),null);
});

test('movement preview pending and failure states never suppress independent firing previews',()=>{
 const s=battle([merc(0,{x:1,y:1,weapon:1800})]),u=players(s)[0],point={x:2,y:2},enemy=s.units.find(v=>v.side==='enemy');
 for(const movementIntent of ['forward','preserveFacing']){
  const pending=targetPreview(s,u,point,{mode:'move',movementIntent,reachable:[],routesPending:true});
  assert.equal(pending.pending,true);assert.match(pending.reason,/Calculando ruta/);assert.equal(pending.pa,undefined);
  const failed=targetPreview(s,u,point,{mode:'move',movementIntent,reachable:[],routesFailed:true});
  assert.match(failed.reason,/comprobará al dar la orden/);assert.equal(failed.pa,undefined);
  const ready=targetPreview(s,u,point,{mode:'move',movementIntent,reachable:getReachable(s,u,{movementIntent})});
  assert.equal(ready.valid,true);assert.ok(ready.pa>0);
 }
 for(const mode of ['move','fire'])for(const status of [{routesPending:true},{routesFailed:true}]){
  const expected=targetPreview(s,u,enemy,{mode,aim:1});
  assert.equal(expected.attackType,'fire');
  assert.deepEqual(targetPreview(s,u,enemy,{mode,aim:1,...status}),expected);
 }
});
