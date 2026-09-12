import {validatePocketOrder} from './inventory-pockets.js';
import {validateWeaponReadiness} from './weapon-readiness.js';
import {validateReloadProgress} from './weapon-reload.js';
import {validMilitiaExperience} from './militia-experience.js';
import {validateCoverMetadata} from './projectile-cover.js';
import {boundaryMatches,EXIT_EDGES,validEntry} from './tactical-exits.js';
import {NPC_ACTIVITIES} from './npc-ai.js';
import {heldSupply} from './held-supplies.js';
import {heldTool,validateEnvironment} from './environment-interactions.js';
import {validateItemStack,validateHands} from './tactical-inventory.js';
import {FITTING_RULES_VERSION,validateUnitFittings,normalizeUnitFittings,validateWeaponFittings,validateFittingPattern,fittingItemIds,heldItemIds,validItemIdentity,weaponItemWeight} from './weapon-fittings.js';
import {HIT_LOCATIONS} from './targeted-combat.js';
import {AP_CARRY_LIMIT,isUnconscious} from './tactical-condition.js';
import {propBlocksAt,propCells,propSize} from './props.js';
import {validateTraining} from './skill-training.js';
import {WEAPONS,BLADES,ARTILLERY,fieldCapable} from './tactical.js';
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const number=(x,lo,hi)=>typeof x==='number'&&Number.isFinite(x)&&x>=lo&&x<=hi;
const integer=(x,lo,hi)=>Number.isInteger(x)&&number(x,lo,hi);
const text=x=>typeof x==='string'&&x.length<=1000;
function need(ok,label){if(!ok)throw Error(`La partida contiene ${label} inválidos.`);}
function safeTree(value,depth=0){need(depth<=20,'objetos anidados');if(typeof value==='number')need(Number.isFinite(value),'números');if(value&&typeof value==='object'){need(Object.keys(value).length<=10000,'colecciones');for(const[k,v]of Object.entries(value)){need(!['__proto__','constructor','prototype'].includes(k),'claves');safeTree(v,depth+1);}}}
export function validateBattleSnapshot(value){
need(object(value),'datos tácticos');safeTree(value);need(JSON.stringify(value).length<=3000000,'tamaño táctico');const s=structuredClone(value);if(s.bleedSeconds!==undefined)need(number(s.bleedSeconds,0,6)&&s.bleedSeconds<6,'reloj de hemorragia');for(const key of ['elapsedSeconds','syncedSeconds','startSeconds'])if(s[key]!==undefined)need(Number.isSafeInteger(s[key])&&s[key]>=0,'reloj táctico');if(s.roundTimeCharged!==undefined)need(typeof s.roundTimeCharged==='boolean','turno del reloj');for(const l of s.lights??[])if(l.remainingSeconds!==undefined)need(Number.isFinite(l.remainingSeconds)&&l.remainingSeconds>=0,'duración de luz');for(const u of s.units??[])validateTraining(u);
need(integer(s.width,4,128)&&integer(s.height,4,128),'dimensiones');const coord=p=>object(p)&&integer(p.x,0,s.width-1)&&integer(p.y,0,s.height-1);
need(Array.isArray(s.tiles)&&s.tiles.length===s.width*s.height,'casillas');const seen=new Set();
for(const t of s.tiles){validateCoverMetadata(t);need(coord(t)&&!seen.has(`${t.x},${t.y}`),'posiciones');seen.add(`${t.x},${t.y}`);need(['wall','grass','road','water','stone','mud','forest','scrub','floor','door','window','rubble','cliff'].includes(t.type)&&typeof t.blocked==='boolean'&&number(t.cover,0,100),'terreno');for(const key of ['blocksSight','open','locked'])if(t[key]!==undefined)need(typeof t[key]==='boolean','puertas');for(const key of ['buildingId','roomId','doorId'])if(t[key]!=null)need(text(t[key]),'habitaciones');}
if(s.enemyTurns!==undefined)need(integer(s.enemyTurns,0,1e9),'turnos enemigos');if(s.quietCombatTurns!==undefined)need(integer(s.quietCombatTurns,0,2),'turnos sin contacto');if(s.contactThisRound!==undefined)need(typeof s.contactThisRound==='boolean','contacto del turno');s.mode??='combat';s.phase??='player';s.status??='active';s.seed??=1812;s.turn??=1;s.weather??={rain:0,humidity:0};need(['combat','exploration'].includes(s.mode)&&['player','enemy','interrupt'].includes(s.phase)&&['active','victory','defeat','retreat'].includes(s.status)&&integer(s.seed,0,4294967295)&&integer(s.turn,1,1e9),'turnos');need(object(s.weather)&&number(s.weather.rain,0,100)&&number(s.weather.humidity,0,100),'clima');
if(s.exitRulesVersion!==undefined)need(s.exitRulesVersion===1,'reglas de salida');
const legacyFittings=s.fittingRulesVersion===undefined;need(legacyFittings||s.fittingRulesVersion===FITTING_RULES_VERSION,'reglas de encastre');s.fittingRulesVersion=FITTING_RULES_VERSION;
for(const key of ['exits','enemyExits'])if(s[key]!==undefined){
 need(Array.isArray(s[key])&&s[key].length<=40,'salidas');const seenExits=new Set();
 for(const exit of s[key]){
  need(object(exit)&&text(exit.id)&&exit.id.length>0&&!seenExits.has(exit.id)&&EXIT_EDGES.includes(exit.edge)&&text(exit.destination)&&exit.destination.length>0,'salidas');seenExits.add(exit.id);
  if(key==='enemyExits')need(exit.id===`enemy:${exit.edge}`&&exit.destination==='__offmap_enemy__','salidas enemigas');
  else need(validEntry(exit.entryEdge,exit.entryAnchor),'llegada de salida');
 }
}
need(Array.isArray(s.units)&&s.units.length<=2000&&s.units.filter(u=>u.hp>0).length<=200,'combatientes');const ids=new Set(),instances=new Set();const claimInstance=id=>{if(id===undefined)return;need(validItemIdentity(id)&&!instances.has(id),'identidad del equipo');instances.add(id);};
const claimStack=stack=>{for(const id of fittingItemIds(stack))claimInstance(id);};
for(const u of s.units){need(validMilitiaExperience(u),'experiencia de milicia');if(u.militiaCreditId!==undefined)need(typeof u.militiaCreditId==='string'&&u.militiaCreditId.length>0&&u.militiaCreditId.length<=2400,'identidad de experiencia');need(coord(u)&&text(u.id)&&!ids.has(u.id)&&text(u.name)&&['player','enemy'].includes(u.side),'combatientes');ids.add(u.id);
const defaults={maxHp:100,ap:100,morale:80,condition:100,marksmanship:50,agility:50,strength:50,medical:30,bleeding:0,loaded:0,ammo:0,weapon:1800,stance:'standing',activeSlot:'primary',energy:100,unconscious:isUnconscious(u),movementMode:'walk',fatigue:0,bandaged:u.bleeding?0:Math.max(0,(u.maxHp??100)-u.hp),shock:0,experienceLevel:4,carriedAP:0,priming:50,flints:4,rations:2,torches:2,boleadoras:1,strengthTraining:0,inventory:{}};for(const[k,v]of Object.entries(defaults))if(u[k]===undefined)u[k]=v;
need(number(u.maxHp,1,1000)&&number(u.hp,0,u.maxHp)&&number(u.ap,0,100+AP_CARRY_LIMIT),'salud o acción');for(const key of ['morale','condition','marksmanship','agility','strength','medical','bleeding','energy','fatigue'])need(number(u[key],0,100),'atributos');
if(!legacyFittings)need(object(u.weaponFittings)&&Object.hasOwn(u,'weaponFittingPattern')&&u.weaponFittingPattern!==undefined&&Object.hasOwn(u,'bladeFittingPattern')&&u.bladeFittingPattern!==undefined,'datos de encastre');
validateHands(u);validateUnitFittings(u);normalizeUnitFittings(u);for(const id of heldItemIds(u))claimInstance(id);if(u.bladeCondition!==undefined)need(number(u.bladeCondition,0,100),'condición de la hoja');
need(integer(u.weapon,0,65535),'armas');if(u.blade!==undefined)need(integer(u.blade,0,65535),'armas blancas');need(integer(u.loaded,0,WEAPONS[u.weapon]?.capacity??(BLADES[u.weapon]?0:100)),'cargas');
validateWeaponReadiness(u,Boolean(WEAPONS[u.weapon]));
validateReloadProgress(u.reloadProgress,WEAPONS[u.weapon]?.capacity??0,u.loaded,u.weaponDropped);
for(const k of ['ammo','priming','flints','rations','torches','boleadoras','medkits','strengthTraining'])if(u[k]!==undefined)need(integer(u[k],0,1000000),'suministros');
if(u.facing===undefined)u.facing=u.side==='enemy'?6:2;need(integer(u.facing,0,7),'dirección de observación');if(u.stealthMode===undefined)u.stealthMode=false;need(typeof u.stealthMode==='boolean','sigilo');
if(u.lastHeardNoise!==undefined){const n=u.lastHeardNoise;need(coord(n)&&integer(n.turn,1,s.turn)&&['move','fire','reload','door','melee','explosion','alarm'].includes(n.kind)&&number(n.uncertainty,0,20),'ruido percibido');need(Object.keys(n).every(k=>['x','y','turn','kind','uncertainty'].includes(k)),'información del ruido');}
if(u.patrolOrigin!==undefined)need(coord(u.patrolOrigin),'puesto de patrulla');if(u.patrol!==undefined)need(typeof u.patrol==='boolean','patrulla');for(const k of ['patrolTurn','lastInvestigatedTurn'])if(u[k]!==undefined)need(integer(u[k],0,1e9),'reloj de patrulla');
for(const k of ['unconscious','knockedDown','weaponDropped','fled','braced','mounted','horse','canMount','jammed','routed','surrendered','entangled','poncho','overwatch'])if(u[k]!==undefined)need(typeof u[k]==='boolean','estados del soldado');
need(u.weaponMode===undefined||['fire','melee'].includes(u.weaponMode),'modo del arma');
need(['standing','crouched','prone'].includes(u.stance)&&['primary','blade','medical','unarmed','tool','supply','item'].includes(u.activeSlot)&&['walk','run','crouch','prone'].includes(u.movementMode),'posturas');
need(u.unconscious===isUnconscious(u),'estado de conciencia');need(number(u.bandaged,0,u.maxHp-u.hp)&&number(u.shock,0,20)&&integer(u.experienceLevel,1,10)&&integer(u.carriedAP,0,AP_CARRY_LIMIT),'heridas e iniciativa');if(u.lastHitLocation!==undefined)need(HIT_LOCATIONS.includes(u.lastHitLocation),'zona de impacto');if(u.lastTargetId!==undefined)need(text(u.lastTargetId),'último objetivo');if(u.lastShotPosition!==undefined)need(coord(u.lastShotPosition),'posición de tiro');if(u.lastKnownEnemy!==undefined)need(coord(u.lastKnownEnemy)&&integer(u.lastKnownEnemy.turn,1,s.turn),'contacto recordado');
for(const key of ['leadership','wisdom','dexterity','mechanical','explosives','maxAP'])if(u[key]!==undefined)need(number(u[key],0,100),'atributos adicionales');for(const key of ['reactionSpent','reactionTurn','interceptTurn','parryTurn','counterTurn','braceTurn','momentum'])if(u[key]!==undefined)need(number(u[key],0,1000000000),'iniciativa');if(u.lastDirection!=null)need(text(u.lastDirection),'dirección');
if(u.traits!==undefined)need(Array.isArray(u.traits)&&u.traits.length<=30&&u.traits.every(text),'rasgos');
validatePocketOrder(u.pocketOrder);need(object(u.inventory)&&Object.keys(u.inventory).length<=1000,'inventario');for(const [key,record] of Object.entries(u.inventory)){if(typeof record==='number'){need(integer(record,0,1000000),'cantidades');continue;}need(object(record)&&integer(record.count,0,1000000)&&number(record.weight,0,10000),'pertrechos');validateItemStack({...record,item:`inventory:${key}`,count:Math.max(1,record.count)});if(record.count>0)claimStack(record);}
if(u.activeSlot==='tool')need(Boolean(heldTool(u)),'herramienta equipada');else need(u.activeTool===undefined,'herramienta fuera de mano');
if(u.activeSlot==='supply')need(Boolean(heldSupply(u)),'pertrecho equipado');else need(u.activeSupply===undefined,'pertrecho fuera de mano');
for(const k of ['weight','carryWeight','ridingSkill'])if(u[k]!==undefined)need(number(u[k],0,k==='ridingSkill'?100:100000),'peso o equitación');if(u.mount!==undefined)need(object(u.mount)&&text(u.mount.id)&&number(u.mount.stamina,0,100)&&number(u.mount.condition,0,100),'monturas');if(u.fleePath!==undefined)need(Array.isArray(u.fleePath)&&u.fleePath.every(coord),'retirada');}
for(const u of s.units)if(u.departure!==undefined){
 const receipt=u.departure,exit=(u.side==='enemy'?s.enemyExits:s.exits)?.find(v=>v.id===receipt?.exitId);
 need(object(receipt)&&Object.keys(receipt).length===7&&exit&&receipt.edge===exit.edge&&receipt.destination===exit.destination&&coord(receipt)&&receipt.x===u.x&&receipt.y===u.y&&boundaryMatches(s,receipt,receipt.edge),'constancia de salida');
 need(integer(receipt.elapsedSeconds,1,s.elapsedSeconds??0)&&Object.hasOwn(receipt,'mountId')&&(receipt.mountId===null||text(receipt.mountId)&&receipt.mountId.length>0),'reloj o montura de salida');
 need(!s.tiles.find(t=>t.x===receipt.x&&t.y===receipt.y)?.blocked&&!propBlocksAt(s,receipt.x,receipt.y),'paso de salida');
 if(receipt.mountId!==null)need(u.mount?.id===receipt.mountId,'identidad de montura salida');
 if(u.mounted&&u.mount?.id)need(receipt.mountId===u.mount.id,'montura que cruzó la salida');
}
if(s.status==='retreat')need(s.units.some(u=>u.side==='player'&&u.departure)&&!s.units.some(u=>u.side==='player'&&fieldCapable(u)),'resultado de retirada');
if(s.returnLedger!==undefined){const ledger=s.returnLedger;need(object(ledger)&&ledger.battleId===s.battleId&&integer(ledger.creditedCartridges,0,100000000)&&Array.isArray(ledger.entries)&&new Set(ledger.entries.map(e=>e.unitId)).size===ledger.entries.length&&ledger.entries.every(e=>object(e)&&ids.has(e.unitId)&&['departed','resident','captured','dead','dispersed'].includes(e.kind)&&text(e.sector)),'registro de devolución');}
if(s.enemyTurn!==undefined){
 const q=s.enemyTurn;need(object(q)&&Array.isArray(q.unitIds)&&q.unitIds.length<=200&&new Set(q.unitIds).size===q.unitIds.length&&q.unitIds.every(id=>s.units.some(u=>u.id===id&&!u.departure&&u.side==='enemy')),'continuación enemiga');
 need(integer(q.unitIndex,0,q.unitIds.length)&&integer(q.actionsTaken,0,12)&&typeof q.started==='boolean','avance enemigo');
 need(s.mode==='combat'&&['enemy','interrupt'].includes(s.phase)&&s.status==='active'&&s.roundTimeCharged===true,'fase de continuación');
}
if(s.alliedTurn!==undefined){
 const q=s.alliedTurn;
 need(object(q)&&Array.isArray(q.unitIds)&&q.unitIds.length>0&&q.unitIds.length<=200&&new Set(q.unitIds).size===q.unitIds.length&&q.unitIds.every(id=>s.units.some(u=>u.id===id&&u.side==='player'&&u.militia)),'continuación de milicia');
 need(integer(q.unitIndex,0,q.unitIds.length-1)&&integer(q.actionsTaken,0,12)&&typeof q.startEnemyAfter==='boolean','avance de milicia');
 need(s.mode==='combat'&&s.status==='active'&&s.roundTimeCharged===true&&!s.enemyTurn&&(!q.startEnemyAfter||s.roundFirstSide==='enemy'),'fase de milicia');
 need(s.phase==='player'||s.reactionStack?.length,'retorno de milicia');
}
const checkInterruption=(interruption,queue,reaction=false)=>{
 need(object(queue)&&queue.unitIndex<queue.unitIds.length&&object(interruption)&&interruption.side==='player'&&interruption.enemyId===queue.unitIds[queue.unitIndex],'interrupción');
 need(reaction?interruption.returnTo==='reaction':interruption.returnTo===undefined,'retorno de interrupción');
 need(Array.isArray(interruption.unitIds)&&interruption.unitIds.length>0&&interruption.unitIds.length<=200&&new Set(interruption.unitIds).size===interruption.unitIds.length&&interruption.unitIds.every(id=>s.units.some(u=>u.id===id&&!u.departure&&u.side==='player'&&u.reactionTurn===s.turn)),'combatientes de interrupción');
 if(interruption.militiaActions!==undefined)need(object(interruption.militiaActions)&&Object.entries(interruption.militiaActions).every(([id,count])=>interruption.unitIds.includes(id)&&s.units.some(u=>u.id===id&&u.militia)&&integer(count,1,12)),'acciones de interrupción de milicia');
};
if(s.reactionStack!==undefined){
 need(Array.isArray(s.reactionStack)&&s.reactionStack.length>0&&s.reactionStack.length<=s.units.length&&s.mode==='combat'&&s.status==='active'&&['enemy','interrupt'].includes(s.phase)&&s.roundTimeCharged===true,'cadena de interrupciones');
 const reactions=new Set();
 for(const [index,frame] of s.reactionStack.entries()){
  need(object(frame)&&Array.isArray(frame.unitIds)&&frame.unitIds.length>0&&frame.unitIds.length<=200&&new Set(frame.unitIds).size===frame.unitIds.length&&frame.unitIds.every(id=>s.units.some(u=>u.id===id&&!u.departure&&u.side==='enemy'&&u.reactionTurn===s.turn)&&!reactions.has(id)),'soldados de reacción');
  for(const id of frame.unitIds)reactions.add(id);
  need(integer(frame.unitIndex,0,frame.unitIds.length-1)&&integer(frame.actionsTaken,0,12)&&['player','interrupt'].includes(frame.resumePhase),'avance de reacción');
  if(frame.resumePhase==='player')need(index===0&&!s.enemyTurn&&frame.resumeInterrupt===undefined,'retorno del jugador');
  else {const parent=index?s.reactionStack[index-1]:s.enemyTurn;need(index>0||parent?.started,'turno suspendido');checkInterruption(frame.resumeInterrupt,parent,index>0);}
 }
}
if(s.phase==='interrupt'){
 const reaction=s.interrupt?.returnTo==='reaction',queue=reaction?s.reactionStack?.at(-1):s.enemyTurn;
 need(reaction||queue?.started,'inicio de interrupción');
 checkInterruption(s.interrupt,queue,reaction);
}else need(s.interrupt===undefined||s.interrupt===null,'interrupción fuera de turno');

for(const key of ['smoke','artillery','log','decor','props','npcs','groundItems','droppedWeapons','lights','buildings','revealedRooms']){if(s[key]===undefined)s[key]=[];need(Array.isArray(s[key])&&s[key].length<=2000,key);}
for(const k of ['night','sectorCleared'])if(s[k]!==undefined)need(typeof s[k]==='boolean','situación táctica');need(s.log.every(text),'diario');need(s.smoke.every(v=>coord(v)&&number(v.radius,0,20)&&integer(v.turns,1,100)),'humo');
for(const g of s.artillery){need(coord(g)&&text(g.id)&&ARTILLERY[g.type]&&['player','enemy'].includes(g.side)&&typeof g.loaded==='boolean'&&integer(g.ammo,0,1000000)&&(g.facing===undefined||number(g.facing,-Math.PI*2,Math.PI*2)),'artillería');validateReloadProgress(g.reloadProgress,1,Number(g.loaded));}
for(const l of s.lights)need(coord(l)&&number(l.radius,0,100)&&(l.intensity===undefined||number(l.intensity,0,1))&&(l.turns===undefined||integer(l.turns,0,1000000)),'luces');
if(s.roundFirstSide!==undefined)need(['player','enemy'].includes(s.roundFirstSide),'primera facción');
if(s.enemyFirstAwaitingPlayer!==undefined)need(typeof s.enemyFirstAwaitingPlayer==='boolean'&&s.roundFirstSide==='enemy'&&s.mode==='combat','orden de facciones');
if(s.civilianTurns!==undefined)need(integer(s.civilianTurns,0,1e9),'turnos civiles');
if(s.civilianSeconds!==undefined)need(number(s.civilianSeconds,0,6)&&s.civilianSeconds<6,'reloj civil');
const npcIds=new Set();
for(const n of s.npcs){
 need(coord(n)&&text(n.id)&&text(n.name)&&!ids.has(n.id)&&!npcIds.has(n.id),'personajes');npcIds.add(n.id);
 if(n.stance!==undefined)need(['standing','crouched','prone'].includes(n.stance),'postura civil');
 if(n.movementMode!==undefined)need(['walk','run','crouch','prone'].includes(n.movementMode),'movimiento civil');
 if(n.facing!==undefined)need(integer(n.facing,0,7),'dirección civil');
 if(n.lastMovePath!==undefined)need(Array.isArray(n.lastMovePath)&&n.lastMovePath.length<=128&&n.lastMovePath.every(coord),'ruta civil');
 if(n.ai!==undefined){const a=n.ai;need(object(a)&&integer(a.cycle,0,1e9)&&integer(a.wait,0,100)&&NPC_ACTIVITIES.includes(a.activity)&&(a.homeId===null||text(a.homeId)),'rutina civil');
  if(a.destination!==undefined)need(coord(a.destination),'destino civil');
  if(a.safeAfter!==undefined)need(Number.isSafeInteger(a.safeAfter)&&a.safeAfter>=0,'calma civil');
  if(a.threat!==undefined)need(coord(a.threat)&&integer(a.threat.turn,1,s.turn)&&['fire','explosion','alarm'].includes(a.threat.kind)&&number(a.threat.uncertainty,0,20)&&Object.keys(a.threat).every(k=>['x','y','turn','kind','uncertainty'].includes(k))&&a.safeAfter!==undefined,'alarma civil');
 }
}
for(const value of [...s.units,...s.groundItems,...s.droppedWeapons,...s.props])if(value.knownToPlayer!==undefined)need(typeof value.knownToPlayer==='boolean','conocimiento del inventario');
const groundIds=new Set();for(const g of s.groundItems){
 need(coord(g)&&text(g.id)&&!groundIds.has(g.id)&&text(g.type)&&integer(g.count,0,1000000)&&(g.heldBy==null||text(g.heldBy)),'objetos del suelo');groundIds.add(g.id);
 if(g.type==='item'){const {id,type,x,y,heldBy,knownToPlayer,...stack}=g;validateItemStack({...stack,count:Math.max(1,stack.count)});if(g.count>0)claimStack(g);}
}
for(const d of s.droppedWeapons){need(coord(d)&&integer(d.weapon,0,65535)&&number(d.condition,0,100)&&integer(d.loaded,0,WEAPONS[d.weapon]?.capacity??0)&&(d.taken===undefined||typeof d.taken==='boolean')&&(d.jammed===undefined||typeof d.jammed==='boolean'),'equipo abandonado');need(d.count===undefined||d.count===1,'cantidad de arma abandonada');validateWeaponFittings(d.fittings,d.weapon);validateFittingPattern(d.fittingPattern,d.weapon,d.instanceId);validateItemStack({...d,item:'weapon',count:1,weight:d.weight===undefined?weaponItemWeight(d.weapon):d.weight});if(!d.taken)claimStack(d);}
for(const t of s.tiles.filter(t=>t.type==='door')){validateEnvironment(t);if(t.open!==undefined)need(t.blocked===!t.open&&(t.blocksSight===undefined||t.blocksSight===!t.open),'paso de puerta');for(const stack of t.contents??[])claimStack(stack);}
const propIds=new Set();for(const p of s.props){validateCoverMetadata(p);need(coord(p)&&text(p.id)&&p.id.length>0&&!propIds.has(p.id)&&['table','bench','bed','chest','barrels','hay'].includes(p.type),'mobiliario');if(p.footprint!==undefined)need(object(p.footprint),'huella del mobiliario');const size=propSize(p);need(object(size)&&integer(size.width,1,8)&&integer(size.height,1,8),'dimensiones del mobiliario');need(propCells(p).every(coord),'huella del mobiliario');if(p.blocksMovement!==undefined)need(typeof p.blocksMovement==='boolean','colisión del mobiliario');propIds.add(p.id);if(p.type==='chest'){validateEnvironment(p);for(const stack of p.contents??[])claimStack(stack);}for(const key of ['buildingId','roomId'])if(p[key]!=null)need(text(p[key]),'habitación del mobiliario');}
for(const d of s.decor)need(coord(d)&&integer(d.width,1,s.width)&&integer(d.height,1,s.height)&&d.x+d.width<=s.width&&d.y+d.height<=s.height&&text(d.type),'decoración');
for(const b of s.buildings){need(coord(b)&&text(b.id)&&integer(b.width,1,s.width)&&integer(b.height,1,s.height)&&b.x+b.width<=s.width&&b.y+b.height<=s.height&&Array.isArray(b.rooms),'edificios');for(const room of b.rooms)need(object(room)&&text(room.id)&&Array.isArray(room.cells)&&room.cells.every(coord),'habitaciones');}need(s.revealedRooms.every(text),'habitaciones vistas');return s;
}
