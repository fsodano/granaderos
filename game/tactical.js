import {OUTFIT_CHANGE_AP,normalizeOutfit,wornOutfit,hasPoncho} from './outfits.js';
import {handsRequired,selectMainHand,handLayout} from './hand-layout.js';
import {firearmPreparation,lowerWeapon,lowersWeapon,turnLowersWeapon} from './weapon-readiness.js';
import {planReload} from './weapon-reload.js';
import {discoverInventory} from './inventory-discovery.js';
import {automaticOrder,searchOrder} from './autonomous-orders.js';
import {shotRangeModifiers} from './shot-range.js';
import {limitEnergy,recoverEnergy,recoverFatigue} from './fatigue.js';
import {recordMilitiaHit} from './militia-experience.js';
import {projectilePath,projectileFlight,pointProjectileFlight,concealmentAt,concealmentSightPenalty} from './projectile-cover.js';
import {boundaryMatches} from './tactical-exits.js';
import {HELD_SUPPLIES,heldSupply,clearEmptySupply} from './held-supplies.js';
import {heldTool,environmentActionProfile,resolveEnvironmentInteraction,extractContainerItem} from './environment-interactions.js';
import {SUPPLY_ITEMS,carriedObject,inventoryUsage,itemDescriptor,itemQuantity,extractItemQuantity,applyItemQuantity,transferItemQuantity,planFitBayonet,planRemoveBayonet,planPocketMove,planEquipOutfit,planStowOutfit,planHoldOffhand,equipmentEndpoint,equipmentFingerprint,placeStoredItem} from './tactical-inventory.js';
import {FITTING_RULES_VERSION,FIT_BAYONET_AP,REMOVE_BAYONET_AP,LOOSE_BAYONET,fixedBayonetFor,fixedBayonetProfile,fittingWeight,weaponItemWeight,normalizeUnitFittings} from './weapon-fittings.js';
import {FISTS,BUTTSTOCK,unarmedChance,unarmedImpact,weaponStealChance,STEAL_MIN_AP} from './unarmed-combat.js';
import {directionTo,facingAllowsSight,turnAPCost,stealthAPMultiplier,noiseRadius,approximateHeardPosition} from './tactical-awareness.js';
import {HIT_LOCATIONS,shotLocationsFor,shotLocationPenalty,shotLocationEffects,getHitLocationProfile} from './targeted-combat.js';
import {hearNpcNoise,runCivilianPhase,advanceCivilianTime} from './npc-ai.js';
import {chooseEnemyAction,choosePatrolAction} from './tactical-ai.js';
import {AP_CARRY_LIMIT,CRITICAL_HEALTH,STANCES,isUnconscious,effectiveWounds,maxActionPoints,actionPointBudget,stanceCost,movementStance,refreshCondition} from './tactical-condition.js';
export {AP_CARRY_LIMIT,CRITICAL_HEALTH,maxActionPoints,actionPointBudget,stanceCost};
import {propBlocksAt,propCells} from './props.js';
import {advanceBattleClock,COMBAT_ROUND_SECONDS,REST_SECONDS} from './time.js';
import {practice} from './skill-training.js';
// Deterministic, serializable tactical simulation. The browser uses this module directly.
export const WEAPONS = Object.fromEntries([
  [1800,'Brown Bess',58,12,6,45,18,1],[1801,'Charleville',52,11,5,42,22,1],
  [1802,'Fusil Baker',64,16,10,70,45,1],[1803,'Tercerola',44,9,4,38,12,1],
  [1804,'Escopeta Criolla',48,10,4,35,10,1],[1805,'Pistola de Arzón',42,7,3,32,8,1],
  [1806,'Pistola de Duelo de Oficial',38,6,2,28,12,1],[1807,'Trabuco Naranjero',75,12,5,40,6,1],
  [1808,'Pistola Doble Cañón',40,8,3,55,9,2],
].map(([id,name,damage,fireAP,aimAP,reloadAP,range,capacity])=>[id,{id,name,damage,fireAP,aimAP,reloadAP,range,capacity}]));
export const ARTILLERY={bronze4:{name:'Cañón de Bronce de 4 lb',crew:2,fireAP:30,reloadAP:60,radius:4,range:80,damage:85},field8:{name:'Cañón de Campaña de 8 lb',crew:3,fireAP:40,reloadAP:75,radius:6,range:110,damage:110},swivel:{name:'Pedrero de Regala',crew:1,fireAP:20,reloadAP:35,radius:3,range:35,damage:65}};
export const BLADES=Object.fromEntries([[1809,'Sable Corvo Sanmartiniano',12,46,1.5],[1810,'Sable de Caroya',14,42,1.5],[1811,'Bayoneta suelta',16,24,1],[1812,'Lanza de Tacuara',18,56,2.5],[1813,'Facón Gaucho con Poncho',8,32,1.5]].map(([id,name,ap,damage,reach])=>[id,{id,name,ap,damage,reach}]));
export function bladeFor(unit){if(['unarmed','medical','tool','supply','item'].includes(unit.activeSlot))return FISTS;if(unit.activeSlot==='blade')return unit.blade===1811?LOOSE_BAYONET:BLADES[unit.blade]||FISTS;if(unit.weaponDropped)return FISTS;return fixedBayonetProfile(unit)||(unit.weapon===1811?LOOSE_BAYONET:BLADES[unit.weapon])||(hasFirearm(unit)?BUTTSTOCK:FISTS);}
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const onField=u=>u.hp>0&&!u.departure;
const targetable=u=>onField(u)&&!u.surrendered;
const present=u=>targetable(u)&&!u.routed;
export const fieldCapable=u=>Boolean(onField(u)&&!u.surrendered&&u.hp>=CRITICAL_HEALTH);
const alive=u=>present(u)&&!u.unconscious;
const clone=s=>{const copy=structuredClone(s);copy.fittingRulesVersion??=FITTING_RULES_VERSION;for(const u of copy.units){if(u.side==='enemy'&&u.patrol!==false)u.patrolOrigin??={x:u.x,y:u.y};normalizeUnitFittings(u);u.activeSlot??='primary';u.facing??=u.side==='enemy'?6:2;u.stealthMode??=false;u.reactionSpent??=0;u.reactionTurn??=0;u.interceptTurn??=0;u.fatigue??=0;u.priming??=50;u.flints??=4;u.rations??=2;u.parryTurn??=0;u.counterTurn??=0;u.braceTurn??=0;u.knockedDown??=false;u.braced??=false;u.energy??=100;u.unconscious??=u.energy<=0;u.movementMode??='walk';u.inventory??={};u.boleadoras??=1;u.torches??=2;u.strengthTraining??=0;u.bandaged??=u.bleeding?0:Math.max(0,u.maxHp-u.hp);u.shock??=0;u.experienceLevel??=4;u.carriedAP??=0;}copy.artillery??=[];copy.mode??='combat';copy.groundItems??=[];copy.lights??=[];copy.buildings??=[];copy.revealedRooms??=[];copy.sectorCleared??=false;copy.enemyTurns??=copy.mode==='combat'?Math.max(0,copy.turn-1):0;copy.droppedWeapons??=[];return copy;};
function random(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
function say(s,text){s.log.push(text);s.log=s.log.slice(-80);}
// Record names only while the squad can observe the event. Later contact must
// not reveal earlier hidden actions through the saved journal.
function journalVisible(s,unit){return unit.side!=='enemy'||teamCanSee(s,'player',unit);}
function sayObserved(s,subjects,text){if(subjects.every(unit=>journalVisible(s,unit)))say(s,text);}
export function hasFirearm(unit){if(unit.weaponDropped)return false;if(unit.activeSlot&&unit.activeSlot!=='primary')return false;return typeof unit.weapon==='object'?unit.weapon.capacity>0:Boolean(WEAPONS[unit.weapon]);}
export function weaponFor(unit){if(unit.activeSlot==='item')return {id:'item',name:carriedObject(unit)?.label??'Objeto',damage:0,fireAP:0,aimAP:0,reloadAP:0,capacity:0,range:0};if(unit.activeSlot==='supply'){const supply=heldSupply(unit);return {id:supply?.key??'supply',name:supply?.name??'Pertrecho',damage:0,fireAP:0,aimAP:0,reloadAP:0,capacity:0,range:supply?.range??0};}if(unit.activeSlot==='tool'){const tool=heldTool(unit);return {id:tool?.toolKey??'tool',name:tool?.label??'Herramienta',damage:0,fireAP:0,aimAP:0,reloadAP:0,capacity:0,range:1.5};}if(unit.activeSlot==='unarmed')return {...FISTS,fireAP:0,aimAP:0,reloadAP:0,capacity:0,range:FISTS.reach};if(unit.activeSlot==='medical')return {id:'medical',name:'Equipo de curación',damage:0,fireAP:0,aimAP:0,reloadAP:0,capacity:0,range:1.5};if(unit.activeSlot==='blade')return {...bladeFor(unit),fireAP:0,aimAP:0,reloadAP:0,capacity:0,range:bladeFor(unit).reach};if(unit.weaponDropped)return {...FISTS,fireAP:0,aimAP:0,reloadAP:0,capacity:0,range:FISTS.reach};return typeof unit.weapon==='object'?unit.weapon:WEAPONS[unit.weapon]||{...bladeFor(unit),fireAP:0,aimAP:0,reloadAP:0,capacity:0,range:bladeFor(unit).reach};}
export function misfireChance(condition=100,rain=0,humidity=0){return clamp(Math.round(2+(100-clamp(condition,0,100))*.2+clamp(rain,0,100)*.5+clamp(humidity,0,100)),0,95);}
export function hasTrait(u,id){return Array.isArray(u.traits)&&u.traits.includes(id);}
function nearbyTrait(s,u,id,radius=4){return s.units.some(v=>v.side===u.side&&alive(v)&&hasTrait(v,id)&&dist(u,v)<=radius);}
export function actionCosts(s,u,point){
  const w=weaponFor(u),cavalry=u.mounted&&hasTrait(u,'cavalry_commander');
  const fire=Math.max(1,Math.ceil(w.fireAP*(cavalry?.8:1))-(Number(u.id)===4&&[1803,1805,1806,1808].includes(w.id)?2:0));
  const turn=hasFirearm(u)&&Number.isFinite(point?.x)&&Number.isFinite(point?.y)?turnAPCost(u,directionTo(u,point)):0;
  const preparation=hasFirearm(u)?firearmPreparation(u,w,fire,turn):{raise:0,turn:0,setup:0,discharge:fire,total:fire};
  return {
    fire:preparation.total,ready:preparation.raise,turn:preparation.turn,setup:preparation.setup,discharge:preparation.discharge,overwatch:preparation.total,aim:Math.max(1,Math.ceil(w.aimAP*(hasTrait(u,'line_marksman')?.65:1))),
    stance:stanceCost(u,STANCES[(STANCES.indexOf(u.stance??'standing')+1)%3]),
    weapon:4,brace:16,ration:10,torch:10,bolas:12,free:15,loot:8,equipLoot:6,fitBayonet:FIT_BAYONET_AP,removeBayonet:REMOVE_BAYONET_AP,
    heal:Number(u.id)===10?18:hasTrait(u,'field_rescuer')?20:25,
    breach:Number(u.id)===6?25:45,mount:hasTrait(u,'cavalry_commander')?8:12,
    reprime:hasTrait(u,'gunsmith_artillerist')?10:15,repair:hasTrait(u,'gunsmith_artillerist')?18:25,
    reload:reloadCost(u,s),melee:Math.ceil(bladeFor(u).ap*(cavalry?.8:1)),
  };
}
// All ordinary hostile clicks, HUD previews and attack animations share this
// choice. Gun mode is explicit; distance never silently changes fire into melee.
export function contextualAttack(s,u,target,options={}){
  const explicit=['fire','melee'].includes(options.type)?options.type:null;
  const type=explicit??(hasFirearm(u)?u.weaponMode??'fire':'melee');
  const costs=actionCosts(s,u,target),aim=clamp(Math.floor(Number.isFinite(options.aim)?options.aim:0),0,4);
  return {type,pa:type==='fire'?costs.fire+aim*costs.aim:costs.melee,profile:type==='fire'?weaponFor(u):bladeFor(u)};
}
export function artilleryCosts(s,u,gun){const spec=ARTILLERY[gun.type],assist=(nearby(s,u,2,2)?.8:1)*(hasTrait(u,'gunsmith_artillerist')?.85:1),base={bronze4:{move:20,pivot:10},field8:{move:30,pivot:15},swivel:{move:10,pivot:5}}[gun.type];return{crew:spec.crew,fire:Math.ceil(spec.fireAP*assist*(Number(u.id)===5?.85:1)),reload:Math.ceil(spec.reloadAP*assist*(Number(u.id)===7?.8:1)),move:base.move,pivot:base.pivot};}
// Crew work is simultaneous: the least available assigned member limits one
// loading step. Prefer stronger available helpers without spending other units' AP.
export function artilleryCrewPlan(s,u,gun,cost,partial=false){
  const spec=ARTILLERY[gun?.type];
  const eligible=v=>v.side===u?.side&&Boolean(v.militia)===Boolean(u?.militia)&&!v.fled&&!v.mounted&&
    !inventoryOrderReason(s,v,cost)&&dist(v,gun)<=1.5&&hasLineOfSight(s,v,gun)&&
    (dist(v,gun)===0||Number.isFinite(movementStepCost(s,v,v,gun)));
  if(!u||!spec||gun.side!==u.side)return {crew:[],reason:'Debes estar junto a una pieza de artillería propia.'};
  const helpers=s.units.filter(v=>v.id!==u.id&&eligible(v));
  if(partial)helpers.sort((a,b)=>b.ap-a.ap||String(a.id).localeCompare(String(b.id)));
  const assigned=eligible(u)?[u,...helpers].slice(0,spec.crew):[];
  const reason=assigned.length<spec.crew?`La pieza necesita ${spec.crew} artilleros a pie, próximos y disponibles${s.mode==='exploration'?'':` con ${cost} PA cada uno`}.`:null;
  return {crew:assigned.map(v=>v.id),reason};
}
export function artilleryReloadPreview(s,u,gun){
  const spec=ARTILLERY[gun?.type],rate=spec&&u?artilleryCosts(s,u,gun).reload:0;
  const crew=artilleryCrewPlan(s,u,gun,1,true);
  const ap=crew.crew.length?Math.min(...crew.crew.map(id=>s.units.find(v=>v.id===id).ap)):0;
  const plan=planReload({loaded:Number(gun?.loaded??false),ammo:gun?.ammo??0,reloadProgress:gun?.reloadProgress,ap},rate,1,s.mode==='exploration');
  const reason=gun?.loaded?'La pieza ya está cargada.':gun&&gun.ammo<1?'No quedan municiones para la pieza.':crew.reason||(!plan.pa?'Faltan puntos de acción para recargar.':null);
  return {...plan,crew:crew.crew,rate,reason,valid:!reason};
}

export function interruptInitiative(s,u){return (u.agility??75)+(u.wisdom??50)*.25+(u.experienceLevel??4)*10-(u.shock??0)*2-(u.movementMode==='run'?10:0)+(nearby(s,u,11,4)?25:0)+(nearby(s,u,57,6)?50:0);}
export function ignitionRisk(s,u){const w=weaponFor(u);return clamp(misfireChance(u.condition,s.weather.rain,s.weather.humidity)*(w.id===1801?.9:1)*(hasTrait(u,'gunsmith_artillerist')?.65:1)-(w.id===1806?1:0)+(u.priming===0?15:0),0,95);}
function nearby(s,u,id,radius=4){return s?.units.some(v=>Number(v.id)===id&&v.side===u.side&&alive(v)&&dist(u,v)<=radius);}

function holdMorale(s,u){if(nearby(s,u,57,6)||(u.militia&&nearby(s,u,1,4))||(u.mounted&&nearbyTrait(s,u,'cavalry_commander',4))||(!u.mounted&&nearby(s,u,7,4))){u.morale=Math.max(20,u.morale);u.routed=false;return true;}return false;}
// The v1.13 look cursor turns first; a second look along the same facing
// raises the held firearm. This never fires, identifies a target, or loads it.
export function lookPreview(s,u,point){
  let reason=!u||!alive(u)?'El combatiente no puede actuar.':u.knockedDown?'Primero debés levantarte.':
    !Number.isInteger(point?.x)||!Number.isInteger(point?.y)||!tile(s,point.x,point.y)||point.x===u.x&&point.y===u.y?'Seleccioná otra casilla del mapa.':null;
  const facing=reason?u?.facing??2:directionTo(u,point),turn=reason?0:turnAPCost(u,facing);
  const prepare=!reason&&!turn&&hasFirearm(u)&&!u.weaponReady;
  const pa=reason?0:prepare?actionCosts(s,u).ready:turn;
  if(!reason&&!pa)reason=hasFirearm(u)?'El arma ya está en posición de tiro.':'El combatiente ya mira en esa dirección.';
  if(!reason&&s.mode!=='exploration'&&u.ap<pa)reason='PA insuficientes.';
  return {valid:!reason,reason,pa,facing,prepare,actionLabel:prepare?'Preparar el arma':'Mirar'};
}
export function reloadPlan(unit,state){
  const w=weaponFor(unit),rate=w.reloadAP/w.capacity*(unit.stance==='prone'?1.5:1)*(state&&nearby(state,unit,2,2)?.8:1)*(hasTrait(unit,'gunsmith_artillerist')?.85:1);
  return planReload(unit,rate,w.capacity,state?.mode==='exploration');
}
export function reloadCost(unit,state){return reloadPlan(unit,state).totalPA;}
function makeUnit(raw,side,index,x,y){const stats=raw.stats||{};const weapon=raw.weapon??raw.primary??1800;const w=typeof weapon==='object'?weapon:WEAPONS[weapon]||WEAPONS[1800];return {...raw,id:String(raw.id??`${side}-${index}`),name:raw.name||raw.nickname||(side==='player'?'Granadero':'Realista'),side,facing:raw.facing??(side==='enemy'?6:2),stealthMode:Boolean(raw.stealthMode),x:raw.x??x,y:raw.y??y,maxHp:raw.maxHp??raw.health??stats.health??100,hp:raw.hp??raw.health??stats.health??100,ap:100,morale:raw.morale??Math.min(100,(raw.personality==='optimistic'?90:raw.personality==='pessimistic'?70:80)+((raw.traits||[]).includes('steadfast')?10:0)),marksmanship:raw.marksmanship??stats.marksmanship??70,agility:raw.agility??stats.agility??75,strength:raw.strength??stats.strength??75,medical:raw.medical??stats.medical??30,mechanical:raw.mechanical??stats.mechanical??0,stealth:raw.stealth??stats.stealth??0,weapon,loaded:raw.loaded??(WEAPONS[weapon]||typeof weapon==='object'?w.capacity:0),ammo:raw.ammo??12,condition:raw.condition??100,stance:raw.stance??movementStance(raw.movementMode??'walk'),mounted:Boolean(raw.mounted),horse:Boolean(raw.horse||raw.canMount||raw.mounted),jammed:raw.jammed??false,bleeding:raw.bleeding??0,bandaged:raw.bandaged??((raw.bleeding??0)>0?0:Math.max(0,(raw.maxHp??raw.health??stats.health??100)-(raw.hp??raw.health??stats.health??100))),shock:raw.shock??0,experienceLevel:raw.experienceLevel??stats.experienceLevel??Math.min(10,4+Math.floor((raw.xp??0)/100)),dexterity:raw.dexterity??stats.dexterity??75,wisdom:raw.wisdom??stats.wisdom??50,carriedAP:0,routed:raw.routed??false,medkits:raw.medkits??2,momentum:0,lastDirection:null,weaponMode:raw.weaponMode??'fire',activeSlot:raw.activeSlot||'primary',fatigue:raw.fatigue||0,priming:raw.priming??50,flints:raw.flints??4,rations:raw.rations??2,energy:raw.energy??100,unconscious:isUnconscious({hp:raw.hp??raw.health??stats.health??100,energy:raw.energy??100}),movementMode:raw.movementMode||'walk',inventory:{...raw.inventory},boleadoras:raw.boleadoras??1,torches:raw.torches??2,strengthTraining:raw.strengthTraining??0,interceptTurn:0,parryTurn:0,counterTurn:0,braceTurn:0,braced:false,knockedDown:Boolean(raw.knockedDown),overwatch:raw.overwatch??(side==='enemy'),reactionTurn:0,reactionSpent:0};}
export function createBattle(squad=[],sector={}){const width=sector.width||16,height=sector.height||12;const state={version:1,fittingRulesVersion:FITTING_RULES_VERSION,exits:structuredClone(sector.exits??[]),exitRulesVersion:sector.exitRulesVersion??1,enemyExits:['N','E','S','W'].map(edge=>({id:`enemy:${edge}`,edge,destination:'__offmap_enemy__'})),battleId:sector.id??null,startSeconds:(sector.hour??(sector.night||sector.weather?.night?0:12))*3600+(sector.secondOfHour??0),elapsedSeconds:0,syncedSeconds:0,roundTimeCharged:false,quietCombatTurns:sector.exploration?2:0,contactThisRound:false,sectorId:sector.sector||sector.id||'san-lorenzo',sectorName:sector.name||'San Lorenzo',width,height,biome:sector.biome||'grassland',altitude:sector.altitude||0,night:Boolean(sector.night||sector.weather?.night||(sector.hour!==undefined&&(sector.hour%24>=20||sector.hour%24<6))),enemyCommand:sector.enemyCommand||null,objective:sector.objective||null,npcs:structuredClone(sector.npcs||[]),props:structuredClone(sector.props??[]),buildings:sector.buildings||[],revealedRooms:[],decor:sector.decor||[],turn:1,enemyTurns:0,phase:'player',mode:sector.exploration?'exploration':'combat',sectorCleared:false,status:'active',seed:(sector.seed??18130203)>>>0,weather:{rain:0,humidity:0,...sector.weather},tiles:[],units:[],droppedWeapons:[],groundItems:[],lights:(sector.lights||[]).map((l,i)=>({id:`light-${i}`,type:'campfire',radius:4,intensity:1,...l})),artillery:(sector.artillery||[]).map((g,i)=>({id:`gun-${i}`,type:'bronze4',side:'player',loaded:true,ammo:6,...g})),smoke:[],log:[],lastError:null};
state.weather.rain=typeof state.weather.rain==='boolean'?(state.weather.rain?40:0):state.weather.rain;state.weather.humidity=state.weather.humidity>0&&state.weather.humidity<=1?state.weather.humidity*10:state.weather.humidity;
for(let y=0;y<height;y++)for(let x=0;x<width;x++){const edge=x===Math.floor(width*.56)&&y>1&&y<height-2&&y!==Math.floor(height/2);state.tiles.push({x,y,type:edge?'wall':sector.biome==='wetland'&&x>3&&x<width-3&&y%3===0?'mud':sector.biome==='mountain'||sector.biome==='foothills'?'stone':'grass',blocked:edge,cover:edge?40:sector.biome==='forest'&&x>3&&x<width-3&&y%3===0?20:0});}
if(Array.isArray(sector.tiles))state.tiles=sector.tiles.map(t=>({blocked:false,cover:0,...t}));
state.units=squad.map((u,i)=>makeUnit(u,'player',i,1+Math.floor(i/(height-2)),1+i%(height-2)));
const enemies=Array.isArray(sector.enemies)?sector.enemies:Array.from({length:sector.exploration?0:sector.enemyCount||Math.max(3,squad.length+(sector.difficulty||1)-1)},(_,i)=>({id:`enemy-${i}`,name:`Realista ${i+1}`,weapon:i%3===0?1801:1800,marksmanship:50+(sector.difficulty||1)*5,morale:60+(sector.difficulty||1)*5}));
state.units.push(...enemies.map((u,i)=>makeUnit(u,'enemy',i,width-2-Math.floor(i/(height-2)),1+i%(height-2))));
if(!state.artillery.length&&sector.cannons>0)state.artillery=Array.from({length:Math.min(sector.cannons,3)},(_,i)=>({id:`gun-${i}`,type:'bronze4',side:'player',x:2,y:2+i*3,loaded:true,ammo:6}));
for(const u of state.units){normalizeOutfit(u);lowerWeapon(u);limitEnergy(u);if(u.side==='enemy'&&u.patrol!==false)u.patrolOrigin??={x:u.x,y:u.y};normalizeUnitFittings(u);u.weaponFittings=structuredClone(u.weaponFittings);u.maxAP=maxActionPoints(state,u.routed?{...u,routed:false}:u);u.ap=u.maxAP;}
say(state,`Combate en ${state.sectorName}. Los PA dependen de la salud y las fuerzas. Puedes conservar hasta 20 PA entre turnos.`);return sector.deferContact?state:initializeBattlePerception(state);}
export function initializeBattlePerception(state){checkEnd(state);detectContact(state);rememberContacts(state);revealRooms(state);return resolveFirstContact(state);}
function tile(s,x,y){const at=s.tiles[y*s.width+x];return at?.x===x&&at?.y===y?at:s.tiles.find(t=>t.x===x&&t.y===y);}
function occupied(s,x,y,except){return propBlocksAt(s,x,y)||(s.npcs||[]).some(n=>n.x===x&&n.y===y)||s.units.some(u=>onField(u)&&!u.unconscious&&u.id!==except&&u.x===x&&u.y===y);}
export function carryCapacity(u){return Math.max(10,(u.strength||50)*.5);}
export function carriedWeight(u){const inventory=Object.values(u.inventory||{}).reduce((sum,item)=>sum+(item&&typeof item==='object'?(item.count||0)*((item.weight||0)+fittingWeight(item))+(item.count||0)*(item.loaded||0)*.04:0),0);return Number(u.weight??u.carryWeight??0)+(wornOutfit(u)?.weight??0)+inventory+(u.loaded||0)*.04+Object.entries(SUPPLY_ITEMS).reduce((sum,[key,item])=>sum+(u[key]??0)*item.weight,0)+(u.weaponDropped?0:weaponItemWeight(u.weapon)+fittingWeight(u))+weaponItemWeight(u.blade)+(u.offHand?weaponItemWeight(u.offHand.weapon)+fittingWeight(u.offHand)+(u.offHand.loaded??0)*.04:0);}
function weightPenalty(u){return Math.max(1,carriedWeight(u)/carryCapacity(u));}
export function movementEnergy(u,t){const style=u.movementMode||'walk',base={walk:1,run:3,crouch:2,prone:3}[style]||1;return Math.max(1,Math.ceil(base*weightPenalty(u)*(u.mounted?1-Math.min(100,u.ridingSkill||0)*.005:1)*(t?.type==='mud'?1.5:1)*(hasTrait(u,'guerrilla_tactician')?.75:1)));}
function exhaust(s,u,cost){limitEnergy(u);if(u.mounted&&u.mount){u.mount.stamina=Math.max(0,u.mount.stamina-Math.max(1,Math.ceil(cost*(1-Math.min(100,u.ridingSkill||0)*.005))));if(u.mount.stamina===0){u.mounted=false;sayObserved(s,[u],`${u.name} desmonta: su caballo está agotado.`);}}u.energy=Math.max(0,(u.energy??100)-cost);if(u.energy===0){lowerWeapon(u);u.unconscious=true;u.ap=0;u.mounted=false;sayObserved(s,[u],`${u.name} cae inconsciente por agotamiento.`);}}
export function tileIllumination(s,x,y){if(!s.night)return 1;let light=.08;for(const lamp of s.lights||[]){if(lamp.turns===0||lamp.extinguished)continue;const distance=dist(lamp,{x,y});if(distance>lamp.radius||!hasLineOfSight(s,lamp,{x,y}))continue;light=Math.max(light,(lamp.intensity??1)*(1-distance/(lamp.radius+1)));}return clamp(light,0,1);}
const nightSightBonus=u=>hasTrait(u,'night_vision')||Number(u.id)===6?2:hasTrait(u,'night_vision_basic')?1:0;
export function visibleDistance(s,u,target){
  const concealment=['crouch','prone'].includes(target.movementMode)&&!target.mounted?Math.min(1,(target.trainedStats?.stealth||0)*.1):0;
  const cover=concealmentSightPenalty(s,target),normal=(s.night?6+nightSightBonus(u):12)-concealment-cover;
  return Math.max(0,normal,tileIllumination(s,target.x,target.y)>=.25?16-cover:0);
}
export function canSee(s,u,target){if(!alive(u)||target.departure||!facingAllowsSight(u,target)||!hasLineOfSight(s,u,target)||dist(u,target)>visibleDistance(s,u,target))return false;const smoke=line(u,target).filter(p=>s.smoke.some(v=>dist(p,v)<=v.radius)).length;return smoke<5;}
export function teamCanSee(s,side,target){return s.units.some(u=>u.side===side&&alive(u)&&canSee(s,u,target));}
export function visibleRooms(s){const ids=new Set();for(const t of s.tiles){if(t.roomId&&s.units.some(u=>u.side==='player'&&alive(u)&&canSee(s,u,t)))ids.add(t.roomId);}return [...ids];}
function revealRooms(s){s.revealedRooms=[...new Set([...(s.revealedRooms||[]),...visibleRooms(s)])];discoverInventory(s);}
export function visibleTiles(s,u){return s.tiles.filter(t=>canSee(s,u,t)).map(t=>({x:t.x,y:t.y,illumination:tileIllumination(s,t.x,t.y)}));}
export function visibleHostiles(s,u){return s.units.filter(v=>v.side!==u.side&&onField(v)&&canSee(s,u,v));}
export function visibleEnemies(s){return s.units.filter(v=>v.side==='enemy'&&s.units.some(u=>u.side==='player'&&alive(u)&&visibleHostiles(s,u).some(t=>t.id===v.id)));}
function emitNoise(s,source,kind,position=source){
  const radius=noiseRadius(kind,source,tile(s,position.x,position.y));
  hearNpcNoise(s,position,kind,radius,n=>line(n,position).slice(0,-1).filter(p=>tile(s,p.x,p.y)?.blocksSight??tile(s,p.x,p.y)?.blocked).length);
  for(const listener of s.units.filter(v=>v.side!==source.side&&alive(v))){
    if(canSee(s,listener,source))continue;
    const obstructions=line(listener,position).slice(0,-1).filter(p=>tile(s,p.x,p.y)?.blocksSight??tile(s,p.x,p.y)?.blocked).length;
    const heard=approximateHeardPosition(listener,position,{kind,radius,turn:s.turn,width:s.width,height:s.height,obstructions,night:s.night});
    if(!heard)continue;
    const previous=listener.lastHeardNoise;listener.lastHeardNoise=heard;
    if(listener.side==='player'&&(!previous||previous.kind!==kind||previous.x!==heard.x||previous.y!==heard.y))sayObserved(s,[listener],`${listener.name} oye ${kind==='fire'?'un disparo':kind==='explosion'?'una detonación':kind==='alarm'?'una alarma':'un ruido'} cerca de ${heard.x+1}, ${heard.y+1}.`);
  }
}
function forgetInvestigatedNoise(s){
  for(const u of s.units)if(u.lastHeardNoise&&s.turn-u.lastHeardNoise.turn>3)delete u.lastHeardNoise;
}
function investigateNoise(s,u){
  const heard=u.lastHeardNoise;
  if(heard&&dist(u,heard)<=Math.max(1,heard.uncertainty)&&facingAllowsSight(u,heard,{peripheralRange:0})&&hasLineOfSight(s,u,heard)){delete u.lastHeardNoise;u.lastInvestigatedTurn=s.turn;}
}
function rememberContacts(s){if(s.mode==='combat'&&hasVisualContact(s)){s.contactThisRound=true;s.quietCombatTurns=0;}forgetInvestigatedNoise(s);for(const u of s.units.filter(alive)){const seen=visibleHostiles(s,u).filter(alive).sort((a,b)=>dist(u,a)-dist(u,b)||String(a.id).localeCompare(String(b.id)));if(seen.length)u.lastKnownEnemy={x:seen[0].x,y:seen[0].y,turn:s.turn};else if(u.lastKnownEnemy&&(s.turn-u.lastKnownEnemy.turn>3||dist(u,u.lastKnownEnemy)<=1))delete u.lastKnownEnemy;}}
function hasVisualContact(s){return s.units.some(u=>alive(u)&&visibleHostiles(s,u).some(alive));}
export function canEndCombat(s){
  if(s.status!=='active'||s.mode!=='combat'||s.phase!=='player'||s.alliedTurn||s.enemyTurn||s.interrupt||s.reactionStack?.length||s.units.some(u=>u.routed&&fieldCapable(u))||hasVisualContact(s))return false;
  // Older snapshots have no counter. Use their retained sight history only;
  // anonymous sound remains an investigation clue, not visible enemy contact.
  return s.quietCombatTurns===undefined?!s.units.some(u=>alive(u)&&u.lastKnownEnemy&&s.turn-u.lastKnownEnemy.turn<=2):s.quietCombatTurns>=2;
}
function resumeExploration(s){
  s.mode='exploration';s.status='active';s.phase='player';s.roundTimeCharged=false;s.contactThisRound=false;s.quietCombatTurns=2;
  delete s.enemyFirstAwaitingPlayer;delete s.roundFirstSide;
  say(s,s.sectorCleared?'El sector está despejado. Puedes explorar y recoger equipo.':'Dos turnos sin contacto visual. La escuadra vuelve a explorar.');
  return s;
}
function resolveFirstContact(s){
  if(s.contactInitiative!=='enemy')return s;
  delete s.contactInitiative;return endTurn(s);
}
function detectContact(s){
  if(s.mode!=='exploration'||s.status!=='active')return false;
  const observers=s.units.filter(u=>alive(u)&&visibleHostiles(s,u).some(alive));
  if(!observers.length)return false;
  const playerAware=observers.some(u=>u.side==='player');
  s.mode='combat';s.phase='player';s.enemyTurns=0;s.roundTimeCharged=false;s.quietCombatTurns=0;s.contactThisRound=true;
  s.roundFirstSide=playerAware?'player':'enemy';delete s.enemyFirstAwaitingPlayer;
  for(const u of s.units.filter(alive)){u.maxAP=maxActionPoints(s,u);u.ap=u.maxAP;}
  if(!playerAware)s.contactInitiative='enemy';
  say(s,playerAware?'¡Contacto visual con el enemigo! Comienza el combate por turnos.':'¡El enemigo descubre a la escuadra y toma la iniciativa!');
  return true;
}
function stepCost(u,t){const rough=['mud','forest','stone','scrub'].includes(t?.type),base=(u.mounted?(hasTrait(u,'cavalry_commander')?3:4):u.stance==='prone'?16:Number(u.id)===4?6:8)*(t?.type==='mud'?(u.mounted?(Number(u.id)===0?1.25:2):1.5):1);return Math.max(2,Math.ceil(base*(u.mounted?1-Math.min(100,u.ridingSkill||0)*.005:1)*(u.movementMode==='run'?.7:u.movementMode==='crouch'?1.25:1)*weightPenalty(u)*stealthAPMultiplier(u)*(rough&&hasTrait(u,'guerrilla_tactician')?.75:1)));}
function movementFactor(from,to){return from.x!==to.x&&from.y!==to.y?1.4:1;}
export function movementIntentReason(u,intent='forward'){
  if(!['forward','preserveFacing'].includes(intent))return 'La intención de movimiento no es válida.';
  if(intent==='preserveFacing'&&u?.mounted)return 'Debes desmontar antes de retroceder o avanzar de costado.';
  if(intent==='preserveFacing'&&u?.movementMode==='run')return 'Camina, agáchate o arrástrate para conservar la dirección.';
  return null;
}
const intentFactor=intent=>intent==='preserveFacing'?1.25:1;
function stepCostWithGeometry(s,u,from,to,lookup,propBlocked,intent='forward'){
  const dx=Math.abs(to.x-from.x),dy=Math.abs(to.y-from.y),ground=lookup(to.x,to.y);
  if(!Number.isInteger(from.x)||!Number.isInteger(from.y)||!lookup(from.x,from.y)||!Number.isInteger(dx)||!Number.isInteger(dy)||Math.max(dx,dy)!==1||!ground||ground.blocked||propBlocked(to.x,to.y))return Infinity;
  if(dx&&dy&&(!lookup(to.x,from.y)||!lookup(from.x,to.y)||lookup(to.x,from.y).blocked||lookup(from.x,to.y).blocked||propBlocked(to.x,from.y)||propBlocked(from.x,to.y)))return Infinity;
  return Math.ceil(Math.ceil(stepCost(u,ground)*movementFactor(from,to))*intentFactor(intent));
}
export function movementStepCost(s,u,from,to,options={}){
  const intent=options?.movementIntent===undefined?'forward':options.movementIntent;
  if(movementIntentReason(u,intent))return Infinity;
  return stepCostWithGeometry(s,u,from,to,(x,y)=>tile(s,x,y),(x,y)=>propBlocksAt(s,x,y),intent);
}
export function getReachable(s,unitOrId,options={}){
  const u=typeof unitOrId==='object'?unitOrId:s.units.find(u=>u.id===String(unitOrId)),intent=options?.movementIntent===undefined?'forward':options.movementIntent;if(!u||!alive(u)||s.status!=='active'||movementIntentReason(u,intent))return [];
  const tiles=new Map(s.tiles.map(t=>[`${t.x},${t.y}`,t])),props=new Set((s.props??[]).filter(p=>p.blocksMovement!==false).flatMap(propCells).map(p=>`${p.x},${p.y}`));
  const lookup=(x,y)=>tiles.get(`${x},${y}`),propBlocked=(x,y)=>props.has(`${x},${y}`);
  const occupants=new Set([...(s.npcs??[]),...s.units.filter(v=>onField(v)&&!v.unconscious&&v.id!==u.id)].map(v=>`${v.x},${v.y}`));
  const costs=new Map([[`${u.x},${u.y}`,0]]),paths=new Map([[`${u.x},${u.y}`,[]]]),queue=[{x:u.x,y:u.y,cost:0}];
  while(queue.length){
    queue.sort((a,b)=>a.cost-b.cost);const p=queue.shift();if(p.cost!==costs.get(`${p.x},${p.y}`))continue;
    if(options?.stopAt?.(p))return [{...p,path:paths.get(`${p.x},${p.y}`)}];
    for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
      const x=p.x+dx,y=p.y+dy,key=`${x},${y}`;if(occupants.has(key))continue;
      const step=stepCostWithGeometry(s,u,p,{x,y},lookup,propBlocked,intent),cost=p.cost+step;
      if(!Number.isFinite(cost)||cost>(s.mode==='exploration'?Infinity:u.ap)||cost>=(costs.get(key)??Infinity))continue;
      costs.set(key,cost);paths.set(key,[...paths.get(`${p.x},${p.y}`),{x,y}]);queue.push({x,y,cost});
    }
  }
  return options?.stopAt?[]:[...costs].map(([key,cost])=>{const[x,y]=key.split(',').map(Number);return{x,y,cost,path:paths.get(key)};});
}
// Animation positions can lie between cells. Trace their grid cells so each
// integer step reaches the endpoint instead of growing an unbounded point list.
function line(a,b){const points=[];let x=Math.round(a.x),y=Math.round(a.y);const endX=Math.round(b.x),endY=Math.round(b.y);if(![x,y,endX,endY].every(Number.isSafeInteger))throw new RangeError('Invalid sight coordinates');const dx=Math.abs(endX-x),dy=Math.abs(endY-y),sx=x<endX?1:-1,sy=y<endY?1:-1;let err=dx-dy;while(x!==endX||y!==endY){const e=2*err;if(e>-dy){err-=dy;x+=sx;}if(e<dx){err+=dx;y+=sy;}points.push({x,y});}return points;}
export function hasLineOfSight(s,a,b){return !line(a,b).slice(0,-1).some(p=>(tile(s,p.x,p.y)?.blocksSight??(tile(s,p.x,p.y)?.type==='window'?false:tile(s,p.x,p.y)?.blocked)));}
export function firearmProjectilePath(s,attacker,target,hitLocation='torso'){return projectilePath(s,attacker,target,weaponFor(attacker),hitLocation);}
// Forecast only known bodies; actual flight below checks every body. Hypothetical
// target positions used by AI exposure replace that actor's old position.
export function firearmFlightPreview(s,attacker,target,hitLocation='torso'){
  const units=s.units.filter(u=>u.id!==target.id&&(u.side===attacker.side||(attacker.side==='player'?teamCanSee(s,'player',u):canSee(s,attacker,u))));
  if(target.id!==undefined)units.push(target);
  return projectileFlight({...s,units},attacker,target,weaponFor(attacker),hitLocation);
}
export function shotChance(s,attacker,target,aim=0,hitLocation='torso'){
  const accuracy=shotAccuracy(s,attacker,target,aim,hitLocation);
  const path=firearmFlightPreview(s,attacker,target,hitLocation);
  return accuracy&&!path.blocked&&(!path.victimId||path.victimId===target.id)?accuracy:0;
}
// One geometry trace per body region serves all affordable aim increments.
// This is a fresh read, not a cache that can outlive movement or a breached wall.
export function firearmShotOptions(s,attacker,target,maxAim=4){
  if(!hasFirearm(attacker)||!hasLineOfSight(s,attacker,target))return [];
  const options=[],limit=clamp(Number.isFinite(maxAim)?Math.floor(maxAim):0,0,4);
  for(const hitLocation of shotLocationsFor(target)){
    const path=firearmFlightPreview(s,attacker,target,hitLocation);
    for(let aim=0;aim<=limit;aim++)options.push({hitLocation,aim,chance:path.blocked||path.victimId&&path.victimId!==target.id?0:shotAccuracy(s,attacker,target,aim,hitLocation),damageFactor:path.damageFactor});
  }
  return options;
}
export function firearmRangeProfile(s,attacker,target){
  const distance=dist(attacker,target),w=weaponFor(attacker);
  const smoke=line(attacker,target).filter(p=>s.smoke.some(v=>dist(p,v)<=v.radius)).length;
  // Preserve period-game obscuration weights, expressed as apparent distance.
  // Night training improves both detection reach and aiming in poor light.
  const concealment=concealmentAt(s,target)*(Number(attacker.id)===6&&w.id===1807?.5:1);
  const darkness=s.night?(20-nightSightBonus(attacker)*7.5)*(1-tileIllumination(s,target.x,target.y)):0;
  const apparentRange=distance+(concealment+darkness+smoke*(hasTrait(attacker,'line_marksman')?6:12))/3;
  return shotRangeModifiers({distance,weaponRange:w.range,apparentRange,visibleRange:visibleDistance(s,attacker,target)});
}
function shotAccuracy(s,attacker,target,aim=0,hitLocation='torso',pointShot=false){
  if(attacker.departure||target.departure||!hasFirearm(attacker)||!pointShot&&!hasLineOfSight(s,attacker,target))return 0;
  const w=weaponFor(attacker),range=dist(attacker,target);
  const rangeProfile=firearmRangeProfile(s,attacker,target);
  const skill=attacker.marksmanship??70,condition=attacker.condition??100;
  const effectiveSkill=condition<skill?(skill+condition)/2:skill;
  const targetPosture=target.mounted?0:Math.min(Math.max(0,range-5)*3,target.stance==='prone'?40:target.stance==='crouched'?20:0);
  const support=attacker.mounted?0:attacker.stance==='prone'?10:attacker.stance==='crouched'?5:0;
  const repeat=!pointShot&&attacker.lastTargetId===target.id&&attacker.lastShotPosition?.x===attacker.x&&attacker.lastShotPosition?.y===attacker.y?10:0;
  const chance=effectiveSkill+support+repeat+(nearby(s,attacker,57,6)?12:0)+(nearby(s,attacker,11,4)?8:0)+clamp(Number.isFinite(aim)?Math.floor(aim):0,0,4)*8+rangeProfile.sightAdjustment-rangeProfile.weaponPenalty-effectiveWounds(attacker)*.3-(100-(attacker.energy??100))*.15-(attacker.shock??0)*5+((attacker.morale??80)-80)*.1-targetPosture
    -(attacker.mounted&&![1803,1805,1806,1808].includes(w.id)?15:0)
    +(hasTrait(attacker,'guerrilla_tactician')&&!attacker.momentum&&((tile(s,attacker.x,attacker.y)?.cover||0)>=20||['forest','scrub'].includes(tile(s,attacker.x,attacker.y)?.type))?10:0)
    -(hasTrait(target,'guerrilla_tactician')&&!target.mounted&&((tile(s,target.x,target.y)?.cover||0)>=20||['forest','scrub'].includes(tile(s,target.x,target.y)?.type))?12:0);
  return Math.round(clamp((chance-shotLocationPenalty(hitLocation,rangeProfile.effectiveSightRange))*rangeProfile.chanceFactor,1,95));
}
function firearmImpact(s,attacker,target,amount,hitLocation='torso'){
  const path=firearmProjectilePath(s,attacker,target,hitLocation),observed=journalVisible(s,target);
  if(path.blocked){if(observed)say(s,'La cobertura detiene el disparo.');return;}
  if(path.damageFactor<1&&observed)say(s,'El disparo atraviesa la cobertura y pierde fuerza.');
  damage(s,target,amount*path.damageFactor,attacker,true,hitLocation);
}
function scatteredShotDestination(s,u,target){
  const radius=Math.min(4,Math.max(1,Math.ceil(dist(u,target)/8))),dx=Math.floor(random(s)*(radius*2+1))-radius,dy=Math.floor(random(s)*(radius*2+1))-radius;
  return {x:target.x+(dx||dy?dx:1),y:target.y+dy,stance:target.unconscious||target.knockedDown?'prone':target.stance??'standing',mounted:!target.unconscious&&!target.knockedDown&&Boolean(target.mounted)};
}
function directedFireImpact(s,u,target,hitLocation,hit){
  const w=weaponFor(u),end=hit?target:scatteredShotDestination(s,u,target);
  // A failed accuracy roll must remain a miss of the selected soldier. The
  // cell-wide approximation still checks every other body along that miss.
  const flightState=hit?s:{...s,units:s.units.filter(v=>v.id!==target.id)};
  const flight=projectileFlight(flightState,u,end,w,hitLocation),victim=s.units.find(v=>v.id===flight.victimId);
  // Keep the established damage draw for aimed hits, including blocked ones.
  const amount=hit||victim?w.damage*(.8+random(s)*.4):0;
  if(flight.blocked){if(journalVisible(s,target))say(s,'La cobertura detiene el disparo.');return;}
  if(victim){
    if(flight.damageFactor<1&&journalVisible(s,victim))say(s,'El disparo atraviesa la cobertura y pierde fuerza.');
    damage(s,victim,amount*flight.damageFactor,u,true,flight.hitLocation);
  }
}
function checkEnd(s){
  const able=side=>s.units.some(u=>u.side===side&&fieldCapable(u));
  if(!able('player')){const status=s.units.some(u=>u.side==='player'&&u.departure)?'retreat':'defeat';if(s.status!==status)say(s,status==='retreat'?'La última fuerza capaz salió del sector.':'La escuadra quedó fuera de combate.');s.status=status;s.phase='player';delete s.interrupt;delete s.enemyTurn;delete s.reactionStack;delete s.alliedTurn;}
  else if(!able('enemy')){s.sectorCleared=true;if(s.mode==='exploration')return;if(s.status!=='victory')say(s,'¡Victoria! El enemigo quedó fuera de combate.');s.status='victory';s.phase='player';delete s.interrupt;delete s.enemyTurn;delete s.reactionStack;delete s.alliedTurn;}
}
function rout(s,u,report=true){
  if(u.routed||!onField(u)||holdMorale(s,u))return;
  lowerWeapon(u);u.routed=true;u.fled=false;u.fleePath=[];u.braced=false;u.overwatch=false;
  if(!u.weaponDropped&&(WEAPONS[u.weapon]||BLADES[u.weapon]||typeof u.weapon==='object')){
    u.weaponDropped=true;u.droppedWeapon=typeof u.weapon==='object'?u.weapon.id:u.weapon;
    s.droppedWeapons??=[];s.droppedWeapons.push({unitId:u.id,x:u.x,y:u.y,weapon:u.droppedWeapon,weight:weaponItemWeight(u.weapon),loaded:u.loaded,...(u.reloadProgress?{reloadProgress:u.reloadProgress}:{}),condition:u.condition,...(u.jammed?{jammed:true}:{}),...(u.weaponInstanceId?{instanceId:u.weaponInstanceId}:{}),...(u.weaponFittings?.bayonet?{fittings:structuredClone(u.weaponFittings)}:{}),...(u.weaponFittingPattern!=null?{fittingPattern:u.weaponFittingPattern}:{})});u.loaded=0;delete u.reloadProgress;u.weaponFittings={};u.weaponFittingPattern=null;delete u.weaponInstanceId;
  }
  if(report)sayObserved(s,[u],`${u.name} pierde la disciplina y abandona su arma. Intentará alcanzar una salida en su turno.`);
}
function wearBayonet(unit){const fitting=fixedBayonetFor(unit);if(fitting){fitting.condition=Math.max(0,fitting.condition-1);if(fitting.condition===0)unit.braced=false;}}
function meleeStrike(s,attacker,target,amount,{counter=true}={}){const blade=bladeFor(attacker),defense=bladeFor(target);wearBayonet(attacker);if([1809,1810].includes(defense.id)&&target.ap>=6&&target.parryTurn!==s.turn){target.parryTurn=s.turn;target.ap-=6;amount*=.75;sayObserved(s,[target],`${target.name} desvía parte del golpe con su sable.`);}if(defense.id===1813||hasPoncho(target))amount*=.8;damage(s,target,amount,attacker);if(alive(target)){if([1809,1810].includes(blade.id))target.bleeding=Math.min(10,target.bleeding+3);if(blade.id===1812){lowerWeapon(target);target.knockedDown=true;target.stance='prone';target.mounted=false;target.ap=Math.max(0,target.ap-20);sayObserved(s,[target],`${target.name} cae derribado por la lanza.`);}if(counter&&(defense.id===1813||Number(target.id)===3)&&target.counterTurn!==s.turn&&target.ap>=defense.ap&&dist(target,attacker)<=defense.reach&&alive(attacker)){lowerWeapon(target);target.counterTurn=s.turn;target.ap-=defense.ap;sayObserved(s,[target],`${target.name} responde con un contragolpe.`);wearBayonet(target);damage(s,attacker,defense.damage*.5,target);}}}
function interceptCharge(s,mover,target){const blade=fixedBayonetProfile(target);if(!alive(target)||!target.braced||target.braceTurn===s.turn||!blade||target.ap<16||dist(mover,target)>2||!hasLineOfSight(s,target,mover))return;target.braceTurn=s.turn;target.ap-=16;sayObserved(s,[target],`${target.name} recibe la carga con la bayoneta fijada.`);wearBayonet(target);damage(s,mover,blade.damage,target);}
function damage(s,target,amount,source,projectile=false,hitLocation='torso',extraBreath=0,report=true){
  if(projectile&&(Number(target.id)===57||(target.leadership||0)>=90)){
    const guard=s.units.find(v=>Number(v.id)===3&&v.side===target.side&&v.id!==target.id&&alive(v)&&v.hp>25&&v.ap>=8&&v.interceptTurn!==s.turn&&dist(v,target)<=1.5);
    if(guard){guard.ap-=8;guard.interceptTurn=s.turn;if(report)sayObserved(s,[guard,target],`${guard.name} se interpone para proteger a ${target.name}.`);target=guard;}
  }
  report=report&&journalVisible(s,target);
  const sourceKnown=journalVisible(s,source);
  const creditEligible=target.hp>=CRITICAL_HEALTH&&!target.unconscious&&!target.routed&&!target.surrendered&&!target.departure;
  const impact=shotLocationEffects(projectile?hitLocation:'torso',Math.max(0,amount),target);
  impact.breathLoss+=extraBreath;const loss=Math.min(target.hp,impact.damage);
  target.hp=Math.max(0,target.hp-loss);target.energy=Math.max(0,(target.energy??100)-impact.breathLoss);
  target.shock=Math.min(20,(target.shock??0)+loss/10+impact.breathLoss/20);
  recordMilitiaHit(s,source,target,creditEligible,loss);
  if(projectile){
    target.lastHitLocation=hitLocation;
    if(impact.balanceLoss)target.ap=Math.max(0,target.ap-impact.balanceLoss);
    if(impact.knockedDown){target.knockedDown=true;target.stance='prone';target.movementMode='prone';target.mounted=false;if(report)say(s,`${target.name} cae por el impacto en las piernas.`);}
  }
  refreshCondition(target);
  target.bleeding=target.hp>0?Math.min(10,target.bleeding+Math.ceil(impact.damage/15)):0;
  target.morale=Math.max(0,target.morale-impact.damage*.45);
  if(report)say(s,`${sourceKnown?source.name+' hiere a': 'Un ataque alcanza a'} ${target.name}${projectile&&hitLocation!=='torso'?` (${getHitLocationProfile(hitLocation).label.toLowerCase()})`:''}: ${impact.damage} de daño.`);
  if(target.hp===0){if(report)say(s,`${target.name} cayó en combate.`);for(const u of s.units.filter(u=>u.side===target.side&&alive(u)))u.morale=Math.max(0,u.morale-18);}
  holdMorale(s,target);if(alive(target)&&target.morale<15)rout(s,target,report);
}
// An interrupt grants control, not a new AP budget. Normal orders remain usable.
export function interruptAvailable(s,u){
  return Boolean(u&&u.side==='player'&&alive(u)&&s.status==='active'&&
    (s.phase==='player'||s.phase==='interrupt'&&s.interrupt?.unitIds.includes(u.id)));
}
// Capture only what each opponent knew before this action. The snapshot is
// transient: save files retain anonymous noise reports, never sound source IDs.
function reactionObservation(s,actor){
  return {x:actor.x,y:actor.y,listeners:new Map(s.units.filter(u=>u.side!==actor.side&&alive(u)).map(u=>[u.id,{seen:canSee(s,u,actor),noise:u.lastHeardNoise}]))};
}
function reactionFire(s,actor,before){
  if(s.mode!=='combat'||s.status!=='active'||!alive(actor)||!before)return false;
  const moved=before.crossing===true||before.x!==actor.x||before.y!==actor.y;
  const qualified=s.units.filter(u=>u.side!==actor.side&&alive(u)&&!u.knockedDown&&u.reactionTurn!==s.turn&&u.ap>=3&&
    (u.side==='player'||u.overwatch!==false)).filter(u=>{
      if(interruptInitiative(s,u)<interruptInitiative(s,actor))return false;
      const prior=before.listeners.get(u.id),seen=canSee(s,u,actor),noise=u.lastHeardNoise;
      const newSound=noise&&noise!==prior?.noise&&(!prior?.noise||['x','y','kind','turn'].some(key=>noise[key]!==prior.noise[key]));
      return seen&&(!prior?.seen||moved)&&dist(u,actor)<=(nearby(s,u,57,6)?12:nearby(s,u,11,4)?10:8)||Boolean(newSound);
    }).sort((a,b)=>interruptInitiative(s,b)-interruptInitiative(s,a)||String(a.id).localeCompare(String(b.id)));
  if(!qualified.length)return false;
  if(actor.side==='enemy'){
    if(s.phase!=='enemy'||!s.enemyTurn&&!s.reactionStack?.length)return false;
    for(const u of qualified)u.reactionTurn=s.turn;
    s.phase='interrupt';s.interrupt={side:'player',unitIds:qualified.map(u=>u.id),enemyId:actor.id,...(s.reactionStack?.length?{returnTo:'reaction'}:{})};
    say(s,`¡Interrupción! ${qualified.map(u=>u.name).join(', ')} pueden actuar con sus PA restantes.`);
  }else{
    if(!['player','interrupt'].includes(s.phase))return false;
    for(const u of qualified)u.reactionTurn=s.turn;
    s.reactionStack??=[];
    s.reactionStack.push({unitIds:qualified.map(u=>u.id),unitIndex:0,actionsTaken:0,resumePhase:s.phase,...(s.interrupt?{resumeInterrupt:structuredClone(s.interrupt)}:{})});
    s.phase='enemy';delete s.interrupt;
    const seen=qualified.filter(u=>journalVisible(s,u));
    say(s,seen.length?`${seen.map(u=>u.name).join(', ')} interrumpen con sus PA restantes.`:'El enemigo interrumpe.');
  }
  return true;
}

function replaceUnit(unit,next){for(const key of Object.keys(unit))if(!Object.hasOwn(next,key))delete unit[key];Object.assign(unit,next);}
function inventoryOrderReason(s,u,pa){
  const window=u?.side==='enemy'?s.phase==='enemy'&&s.status==='active'&&alive(u):interruptAvailable(s,u);
  if(!window||u.knockedDown)return 'El soldado no puede manejar equipo ahora.';
  if(s.mode!=='exploration'&&u.ap<pa)return `Faltan ${pa} PA para manejar el equipo.`;
  return null;
}
export function pointFirePreview(s,u,point,aim=0){
  const level=clamp(Number.isFinite(aim)?Math.floor(aim):0,0,4),costs=u?actionCosts(s,u,point):{fire:0,aim:0},pa=costs.fire+level*costs.aim;
  let reason=!u||!(u.side==='enemy'?s.phase==='enemy'&&alive(u)&&s.status==='active':interruptAvailable(s,u))||u.knockedDown?'El soldado no puede disparar ahora.':null;
  if(!reason&&!hasFirearm(u))reason='Equipá un arma de fuego.';
  if(!reason&&(!Number.isInteger(point?.x)||!Number.isInteger(point?.y)||point.x<0||point.y<0||point.x>=s.width||point.y>=s.height))reason='Seleccioná una casilla del mapa.';
  if(!reason&&point.x===u.x&&point.y===u.y)reason='Seleccioná otra casilla para disparar.';
  if(!reason&&u.jammed)reason='Cebá el arma antes de disparar.';
  if(!reason&&!(u.loaded>0))reason='Recargá el arma.';
  if(!reason&&s.mode!=='exploration'&&u.ap<pa)reason='PA insuficientes.';
  // No occupancy, enemy attributes, cover or sight query: empty and unobserved
  // occupied coordinates have exactly the same public preflight.
  return {valid:!reason,reason,pa,aim:level};
}
function pointFireImpact(s,u,point,aim){
  const w=weaponFor(u),accuracy=shotAccuracy(s,u,{...point,stance:'standing'},aim,'torso',true);
  const impact=(victim,amount,location)=>{
    const visible=victim.side==='player'||teamCanSee(s,'player',victim),before=victim.hp,eligible=fieldCapable(victim)&&!victim.unconscious&&!victim.routed;
    damage(s,victim,amount,u,true,location,0,visible);
    if(eligible&&victim.side!==u.side&&victim.hp<before)practice(u,'marksmanship',2);
  };
  if(w.id===1807){
    const length=dist(u,point),dx=(point.x-u.x)/length,dy=(point.y-u.y)/length;
    for(const victim of s.units.filter(v=>onField(v)&&v.id!==u.id)){
      const vx=victim.x-u.x,vy=victim.y-u.y,forward=vx*dx+vy*dy,across=Math.abs(vx*dy-vy*dx);
      if(forward<=0||forward>6||across>Math.max(.5,forward*.25))continue;
      const path=firearmProjectilePath(s,u,victim);
      if(!path.blocked&&random(s)*100<Math.min(95,accuracy+20))impact(victim,w.damage*(1-forward/12)*path.damageFactor,'torso');
    }
    return;
  }
  let end={x:point.x,y:point.y};
  if(random(s)*100>=accuracy){
    end=scatteredShotDestination(s,u,point);
  }
  const flight=pointProjectileFlight(s,u,end,w),victim=s.units.find(v=>v.id===flight.victimId);
  if(victim)impact(victim,w.damage*(.8+random(s)*.4)*flight.damageFactor,flight.hitLocation);
}
export function dropPreview(s,u,item,count=1){
  const pa=4;let reason=inventoryOrderReason(s,u,pa);
  if(!reason)try{extractItemQuantity(u,item,count);}catch(error){reason=error.message;}
  return {pa,kind:'drop',chance:100,reason,valid:!reason};
}
export function fitBayonetPreview(s,u,item){
  const pa=FIT_BAYONET_AP;let reason=inventoryOrderReason(s,u,pa),plan;
  if(!reason)try{plan=planFitBayonet(u,item);}catch(error){reason=error.message;}
  return {pa,source:item,destination:'primary',host:u?.weapon,fitting:plan?.fitting??null,reason,valid:!reason};
}
export function removeBayonetPreview(s,u,destination='inventory'){
  const pa=REMOVE_BAYONET_AP;let reason=inventoryOrderReason(s,u,pa),plan;
  if(!reason)try{plan=planRemoveBayonet(u,destination);}catch(error){reason=error.message;}
  return {pa,source:'primary',destination,host:u?.weapon,fitting:plan?.fitting??u?.weaponFittings?.bayonet??null,reason,valid:!reason};
}
// A relay is one inventory transaction. Intermediate soldiers must be able to
// handle this exact stack, without swapping their own equipment into the chain.
function itemRelayRoute(s,u,target,stack){
  const adjacent=(a,b)=>dist(a,b)<=1.5&&hasLineOfSight(s,a,b)&&Number.isFinite(movementStepCost(s,a,a,b));
  if(adjacent(u,target))return [u,target];
  const helpers=s.units.filter(v=>v.id!==u.id&&v.id!==target.id&&v.side===u.side&&
    !v.fled&&Boolean(v.militia)===Boolean(u.militia)&&!inventoryOrderReason(s,v,4)).filter(v=>{
      try{applyItemQuantity(v,stack);return true;}catch{return false;}
    }).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  const queue=[[u]],seen=new Set([u.id]);
  for(let i=0;i<queue.length;i++){
    const path=queue[i],last=path[path.length-1];
    if(adjacent(last,target))return [...path,target];
    for(const v of helpers)if(!seen.has(v.id)&&adjacent(last,v)){seen.add(v.id);queue.push([...path,v]);}
  }
  return null;
}
export function transferPreview(s,u,target,item,count=1){
  const distance=u&&target?dist(u,target):Infinity;
  let kind=distance<=1.5?'give':'throw',pa=kind==='give'?4:8,route=null;
  let reason=inventoryOrderReason(s,u,4),chance=kind==='give'?100:0;
  if(!reason&&(!target||target.id===u.id||target.side!==u.side||!alive(target)))reason='Elige otro compañero consciente.';
  if(!reason)try{
    const transfer=transferItemQuantity(u,target,item,count);
    route=itemRelayRoute(s,u,target,transfer.stack);
  }catch(error){reason=error.message;}
  if(route){kind=route.length>2?'relay':'give';pa=4;chance=100;}
  else if(!reason){kind='throw';pa=8;reason=inventoryOrderReason(s,u,pa);}
  if(!reason&&!route&&(distance>6||!hasLineOfSight(s,u,target)))reason='El compañero debe estar al alcance y sin obstáculos, o conectado por aliados contiguos.';
  if(kind==='throw'&&target)chance=target.knockedDown||(s.mode!=='exploration'&&target.ap<2)?0:Math.round(clamp(((u?.dexterity??50)+(target.dexterity??50))/2+20-distance*5-(100-(target.energy??100))*.2,5,95));
  const participants=route?.map((v,i)=>({id:v.id,name:v.nickname||v.name,pa:i<route.length-1?4:0}))??[];
  return {pa,kind,chance,route:participants,totalPA:route?(route.length-1)*4:pa,reason,valid:!reason};
}
function groundStack(ground){
  if(ground.type==='boleadoras')return {item:'boleadoras',count:ground.count,weight:SUPPLY_ITEMS.boleadoras.weight};
  const {id,type,x,y,heldBy,knownToPlayer,...stack}=ground;return stack;
}
function addGroundStack(s,stack,position){s.groundItems.push({...stack,id:`item-${s.turn}-${s.groundItems.length}`,type:'item',x:position.x,y:position.y});}
function lootSource(s,a){
  const source=a.targetId?s.units.find(v=>v.id===String(a.targetId)):null,drop=a.dropIndex!==undefined?s.droppedWeapons[a.dropIndex]:null,ground=a.groundId?s.groundItems.find(g=>g.id===a.groundId):null;
  return {source,drop,ground,position:source||drop||ground};
}
export function planLoot(s,u,a){
  const {source,drop,ground,position}=lootSource(s,a);
  if(source?.departure||source?.fled)throw Error('Esa persona ya salió del sector.');
  if(!position||dist(u,position)>1.5||!hasLineOfSight(s,u,position))throw Error('Acércate al cuerpo o equipo que quieres registrar.');
  if(source&&source.hp>0&&!source.unconscious&&!source.surrendered)throw Error('Solo puedes registrar un cuerpo o una persona inconsciente.');
  if(drop?.taken||ground?.count===0||ground?.heldBy)throw Error('Ese objeto ya fue recogido o sigue enredado.');
  let receiver=u,donor=source;
  if(source){
    const wanted=a.item??'all';
    const items=wanted==='all'?[...Object.keys(SUPPLY_ITEMS).filter(k=>(source[k]??0)>0),...(!source.weaponDropped&&(WEAPONS[source.weapon]||BLADES[source.weapon])?['primary']:[]),...(BLADES[source.blade]?['blade']:[]),...(source.offHand?['offhand']:[]),...(wornOutfit(source)?['outfit']:[]),...Object.entries(source.inventory??{}).filter(([,r])=>(typeof r==='number'?r:r?.count)>0).map(([key])=>`inventory:${key}`)]:[wanted==='weapon'?'primary':wanted];
    if(!items.length)throw Error('No queda equipo que recoger.');
    for(const item of items){const count=wanted==='all'?itemQuantity(donor,item):a.count??itemQuantity(donor,item);const transfer=transferItemQuantity(donor,receiver,item,count);donor=transfer.source;receiver=transfer.target;}
  }else{
    const stack=drop?{item:'weapon',count:1,weapon:drop.weapon,loaded:drop.loaded,...(drop.reloadProgress?{reloadProgress:drop.reloadProgress}:{}),condition:drop.condition,jammed:Boolean(drop.jammed),...(drop.instanceId?{instanceId:drop.instanceId}:{}),...(drop.fittings?{fittings:structuredClone(drop.fittings)}:{}),...(drop.fittingPattern!=null?{fittingPattern:drop.fittingPattern}:{}),weight:drop.weight??weaponItemWeight(drop.weapon)}:groundStack(ground);
    const count=a.count??stack.count;if(!Number.isSafeInteger(count)||count<1||count>stack.count)throw Error('No queda esa cantidad del objeto.');
    receiver=applyItemQuantity(receiver,{...stack,count});
    return {receiver,drop,ground,remaining:stack.count-count};
  }
  return {receiver,source,donor};
}
function commitLoot(u,plan){
  replaceUnit(u,plan.receiver);
  if(plan.source)replaceUnit(plan.source,plan.donor);
  if(plan.drop)plan.drop.taken=true;
  if(plan.ground)plan.ground.count=plan.remaining;
}
function planLootBatch(s,u,items){
  if(!Array.isArray(items)||!items.length||items.length>1000)throw Error('Seleccioná entre uno y mil objetos para recoger.');
  // Work on private source/receiver copies. A later capacity or quantity failure
  // must not consume any earlier selection in the same pickup transaction.
  const view={...s,units:structuredClone(s.units),groundItems:structuredClone(s.groundItems),droppedWeapons:structuredClone(s.droppedWeapons)};
  const receiver=view.units.find(unit=>unit.id===u.id),seen=new Set();let point=null;
  for(const item of items){
    if(!item||typeof item!=='object'||Array.isArray(item)||Object.keys(item).some(key=>!['targetId','groundId','dropIndex','item','count'].includes(key)))throw Error('La selección de equipo no es válida.');
    const selectors=['targetId','groundId','dropIndex'].filter(key=>Object.hasOwn(item,key));
    if(selectors.length!==1||!Number.isSafeInteger(item.count)||item.count<1)throw Error('Indicá un origen y una cantidad entera para cada objeto.');
    const selector=selectors[0];
    if(selector==='dropIndex'?!Number.isSafeInteger(item.dropIndex)||item.dropIndex<0:typeof item[selector]!=='string'||!item[selector])throw Error('El origen del objeto no es válido.');
    if(selector==='targetId'?(typeof item.item!=='string'||!item.item||item.item==='all'):item.item!==undefined)throw Error('Seleccioná cada objeto del cuerpo por separado.');
    const key=JSON.stringify([selector,item[selector],item.item==='weapon'?'primary':item.item??null]);
    if(seen.has(key))throw Error('El mismo objeto aparece más de una vez en la selección.');seen.add(key);
    const {position}=lootSource(view,item);
    if(!position||!canSee(view,receiver,position))throw Error('El equipo seleccionado debe estar a la vista.');
    if(point&&(position.x!==point.x||position.y!==point.y))throw Error('Recogé objetos de una sola casilla por vez.');point=position;
    commitLoot(receiver,planLoot(view,receiver,item));
  }
  return view;
}
export function lootBatchPreview(s,u,items){
  const pa=8;let reason=inventoryOrderReason(s,u,pa);
  if(!reason)try{planLootBatch(s,u,items);}catch(error){reason=error.message;}
  return {pa,valid:!reason,reason};
}
export function planEquipLoot(u,key,slot='primary'){
  if(slot==='offhandItem')return planHoldOffhand(u,key);
  if(slot==='outfit')return key===null?planStowOutfit(u):planEquipOutfit(u,key);
  const record=u.inventory?.[key];
  if(!record||typeof record!=='object'||record.count<1||!['primary','blade','offhand'].includes(slot))throw Error('Selecciona un arma recuperada disponible.');
  if(!(WEAPONS[record.weapon]||BLADES[record.weapon])||(slot==='blade'&&!BLADES[record.weapon]))throw Error('Ese objeto no puede equiparse en esa mano.');
  const extracted=extractItemQuantity(u,`inventory:${key}`,1);
  return equipIncomingHand(extracted.unit,extracted.stack,slot);
}
function equipIncomingHand(unit,incoming,slot){
  let next=structuredClone(unit);
  if(slot==='offhand'){
    delete next.leftHandItem;
    if(handsRequired(incoming.weapon)>1)throw Error('La mano secundaria necesita un arma de una mano.');
    if(!next.weaponDropped&&handsRequired(next.weapon)>1&&(next.activeSlot??'primary')==='primary')throw Error('El arma principal ocupa las dos manos.');
    for(const item of ['blade','offhand'])if(itemQuantity(next,item)){const stored=extractItemQuantity(next,item,1,{keepOtherHand:false});next=applyItemQuantity(stored.unit,stored.stack,{deferCapacity:true});}
    const {item,...record}=incoming;next.offHand=structuredClone(record);next.offHand.count=1;
    if(inventoryUsage(next).overloaded)throw Error('No queda espacio para guardar el equipo desplazado.');
    return next;
  }
  if(slot==='blade'&&next.offHand){const stored=extractItemQuantity(next,'offhand',1,{keepOtherHand:false});next=applyItemQuantity(stored.unit,stored.stack,{deferCapacity:true});}
  const previous=slot==='primary'?next.weapon:next.blade;
  if(previous&&!(slot==='primary'&&next.weaponDropped)){
    const stored=extractItemQuantity(next,slot,1,{keepOtherHand:false});next=applyItemQuantity(stored.unit,stored.stack,{deferCapacity:true});
  }
  if(slot==='primary'){next.weapon=incoming.weapon;next.loaded=incoming.loaded??0;delete next.reloadProgress;if(incoming.reloadProgress)next.reloadProgress=incoming.reloadProgress;next.condition=incoming.condition??100;next.jammed=Boolean(incoming.jammed);next.weaponDropped=false;next.weaponFittings=structuredClone(incoming.fittings??{});next.weaponFittingPattern=incoming.fittingPattern??null;delete next.weaponInstanceId;if(incoming.instanceId)next.weaponInstanceId=incoming.instanceId;}
  else {next.blade=incoming.weapon;next.bladeCondition=incoming.condition??100;next.bladeFittingPattern=incoming.fittingPattern??null;delete next.bladeInstanceId;if(incoming.instanceId)next.bladeInstanceId=incoming.instanceId;}
  lowerWeapon(next);next=selectMainHand(next,{activeSlot:slot});delete next.activeTool;delete next.activeSupply;delete next.activeItem;next.braced=false;next.momentum=0;delete next.lastTargetId;delete next.lastShotPosition;
  if(inventoryUsage(next).overloaded)throw Error('No queda espacio para guardar el equipo desplazado.');
  return next;
}
export function planSwapHands(unit){
  if(!unit.offHand)throw Error('La mano secundaria está vacía.');
  let next=structuredClone(unit);const incoming=next.offHand;delete next.offHand;
  if(!next.weaponDropped&&next.weapon){const taken=extractItemQuantity(next,'primary',1,{keepOtherHand:false});next=taken.unit;if(handsRequired(taken.stack.weapon)===1){const {item,...record}=taken.stack;next.offHand=record;}else next=applyItemQuantity(next,taken.stack,{deferCapacity:true});}
  return equipIncomingHand(next,{item:'weapon',...incoming},'primary');
}
function planStealWeapon(u,target){
  const slot=target.activeSlot??'primary';
  if(!['primary','blade'].includes(slot)||!itemQuantity(target,slot))throw Error('El enemigo no lleva un arma en la mano.');
  const taken=extractItemQuantity(target,slot,1);
  return {source:taken.unit,receiver:equipIncomingHand(u,taken.stack,'primary')};
}
export function stealPreview(s,u,target){
  const pa=s.mode==='exploration'?STEAL_MIN_AP:Math.max(STEAL_MIN_AP,u?.ap??0);
  let reason=!u||!alive(u)||s.status!=='active'||(u.side==='player'?!interruptAvailable(s,u):s.phase!=='enemy')?'El soldado no puede actuar ahora.':null;
  if(!reason&&(u.activeSlot!=='unarmed'||handLayout(u).held.length))reason='Prepará las manos libres antes de quitar un arma.';
  if(!reason&&(u.mounted||u.knockedDown||u.entangled||u.stance==='prone'))reason='Debés estar de pie o agachado, desmontado y libre para quitar un arma.';
  if(!reason&&(!target||target.side===u.side||!alive(target)||target.routed||target.surrendered))reason='Seleccioná un enemigo consciente; los cuerpos se registran con Recoger equipo.';
  if(!reason&&(!teamCanSee(s,u.side,target)||dist(u,target)>1.5||!hasLineOfSight(s,u,target)||!Number.isFinite(movementStepCost(s,u,u,target))))reason='Acercate al enemigo visible para quitarle el arma.';
  if(!reason&&target.mounted)reason='El arma de un jinete queda fuera del alcance de las manos.';
  if(!reason&&s.mode!=='exploration'&&u.ap<STEAL_MIN_AP)reason=`Quitar el arma requiere al menos ${STEAL_MIN_AP} PA y consume todos los restantes.`;
  if(!reason)try{planStealWeapon(u,target);}catch(error){reason=error.message;}
  return {pa,valid:!reason,reason};
}
function planMainHandEquipment(u,a){
 if(!['primary','blade','medical','unarmed','tool','supply','item'].includes(a.slot))throw Error('Selecciona el objeto que quieres llevar en la mano.');
 if(a.slot==='primary'&&(u.weaponDropped||!(WEAPONS[u.weapon]||BLADES[u.weapon]||typeof u.weapon==='object')))throw Error('No lleva un arma principal disponible.');
 if(a.slot==='item'&&!carriedObject(u,a.item))throw Error('No lleva ese objeto disponible.');
 if(a.slot==='medical'&&u.medkits<1)throw Error('No quedan vendas en el equipo de curación.');
 if(a.slot==='blade'&&!BLADES[u.blade])throw Error('No hay un arma blanca secundaria equipada.');
 if(a.slot==='tool'&&!heldTool({...u,activeSlot:'tool',activeTool:a.toolKey}))throw Error('No lleva esa herramienta en el inventario.');
 if(a.slot==='supply'&&!heldSupply({...u,activeSlot:'supply',activeSupply:a.supplyKey}))throw Error('No lleva ese pertrecho en el inventario.');
 if(!(a.slot==='unarmed'&&handLayout(u).left)&&(u.activeSlot||'primary')===a.slot&&(a.slot!=='tool'||u.activeTool===a.toolKey)&&(a.slot!=='supply'||u.activeSupply===a.supplyKey)&&(a.slot!=='item'||u.activeItem===a.item))throw Error('Ese objeto ya está en la mano.');
 const next=selectMainHand(structuredClone(u),{activeSlot:a.slot,...(a.slot==='tool'?{activeTool:a.toolKey}:a.slot==='supply'?{activeSupply:a.supplyKey}:a.slot==='item'?{activeItem:a.item}:{})});
 if(a.slot!=='tool')delete next.activeTool;if(a.slot!=='supply')delete next.activeSupply;if(a.slot!=='item')delete next.activeItem;
 if(inventoryUsage(next).overloaded)throw Error('No queda espacio para guardar el objeto que tenés en la mano.');
 lowerWeapon(next);next.momentum=0;next.braced=false;delete next.lastTargetId;delete next.lastShotPosition;return next;
}
function readyReference(unit,item,side){
 const descriptor=itemDescriptor(unit,item),weapon=descriptor.weapon;
 if(side==='left'){
  if(weapon){
   if(handsRequired(weapon)>1)throw Error('El arma necesita las dos manos.');
   if(item.startsWith('inventory:'))return {unit:planEquipLoot(unit,item.slice(10),'offhand'),pa:6};
   let next=structuredClone(unit);if(handLayout(next).right===item){next.activeSlot='unarmed';delete next.activeTool;delete next.activeSupply;delete next.activeItem;}
   next.leftHandItem=item;lowerWeapon(next);
   if(inventoryUsage(next).overloaded)throw Error('No queda espacio para guardar el objeto desplazado.');
   return {unit:next,pa:4};
  }
  let next=structuredClone(unit);if(handLayout(next).right===item){next.activeSlot='unarmed';delete next.activeTool;delete next.activeSupply;delete next.activeItem;}
  return {unit:planHoldOffhand(next,item),pa:4};
 }
 if(weapon){
  if(item.startsWith('inventory:'))return {unit:planEquipLoot(unit,item.slice(10),'primary'),pa:6};
  if(item==='offhand')return {unit:planSwapHands(unit),pa:4};
  return {unit:planMainHandEquipment(unit,{slot:item}),pa:4};
 }
 const action=item==='medkits'?{slot:'medical'}:HELD_SUPPLIES[item]?{slot:'supply',supplyKey:item}:heldTool({...unit,activeSlot:'tool',activeTool:item})?{slot:'tool',toolKey:item}:carriedObject(unit,item)?{slot:'item',item}:null;
 if(!action)throw Error('Este objeto no se puede llevar en la mano principal.');
 return {unit:planMainHandEquipment(unit,action),pa:4};
}
// Campaign equipment uses the same item-to-mode and pocket checks as dragging.
export function planReadyMainHand(unit,item){return readyReference(unit,item,'right').unit;}
function storeHandReference(unit,source){
 let next=structuredClone(unit),item=source.item;const other=handLayout(unit)[source.side==='right'?'left':'right'];
 if(['primary','blade','offhand'].includes(item)){
  const oldKeys=new Set(Object.keys(next.inventory??{})),taken=extractItemQuantity(next,item,1,{keepOtherHand:false});next=taken.unit;
  if(source.side==='right'){next.activeSlot='unarmed';delete next.activeTool;delete next.activeSupply;delete next.activeItem;next.leftHandItem=other;}
  else next.leftHandItem=null;
  next=applyItemQuantity(next,taken.stack,{deferCapacity:true});item='inventory:'+Object.keys(next.inventory).find(key=>!oldKeys.has(key));
 }else if(source.side==='right'){
  next.activeSlot='unarmed';delete next.activeTool;delete next.activeSupply;delete next.activeItem;next.leftHandItem=other;
 }else next.leftHandItem=null;
 lowerWeapon(next);return {unit:next,item};
}
export function planEquipmentPlacement(unit,action){
 const {sourceId,destinationId,expectedSource,expectedDestination}=action;
 if(sourceId===destinationId)throw Error('Elegí otra ranura.');
 for(const [id,expected]of [[sourceId,expectedSource],[destinationId,expectedDestination]])if(typeof expected!=='string'||expected!==equipmentFingerprint(unit,id))throw Error('Cambió el equipo. Volvé a seleccionar el objeto.');
 const source=equipmentEndpoint(unit,sourceId),destination=equipmentEndpoint(unit,destinationId);
 if(!source.item)throw Error('La ranura de origen está vacía.');
 if(source.kind==='pocket'&&destination.kind==='pocket')return {unit:planPocketMove(unit,sourceId,destinationId),pa:0};
 if(destination.kind==='hand'){
  if(destination.blocked)throw Error('El arma principal ocupa las dos manos.');
  return readyReference(unit,source.item,destination.side);
 }
 // A hand-to-pocket exchange first puts the held item away. If the target
 // was occupied, ready its item in that hand before fixing the pocket order.
 const stored=storeHandReference(unit,source);let next=stored.unit,pa=4;
 if(destination.item&&destination.item!==stored.item){
  const ready=readyReference(next,destination.item,source.side);next=ready.unit;pa=Math.max(pa,ready.pa);
 }
 if(inventoryUsage(next).overloaded)throw Error('No queda espacio para guardar el objeto desplazado.');
 next=placeStoredItem(next,stored.item,destinationId);
 return {unit:next,pa};
}
export function mainItemPreview(s,u,item){
 let reason=inventoryOrderReason(s,u,4);
 if(!reason)try{planMainHandEquipment(u,{slot:'item',item});}catch(error){reason=error.message;}
 return {pa:s.mode==='exploration'?0:4,valid:!reason,reason,action:{type:'weapon',slot:'item',item}};
}
export function equipmentPlacementPreview(s,u,action){
 let pa=0,reason=inventoryOrderReason(s,u,0);
 if(!reason)try{pa=planEquipmentPlacement(u,action).pa;reason=inventoryOrderReason(s,u,pa);}catch(error){reason=error.message;}
 return {pa,reason,valid:!reason};
}
export function swapHandsPreview(s,u){
 const pa=s.mode==='exploration'?0:4;let reason=inventoryOrderReason(s,u,pa);
 if(!reason)try{planSwapHands(u);}catch(error){reason=error.message;}
 return {pa,reason,valid:!reason};
}
export function equipLootPreview(s,u,inventoryKey,slot='primary'){
  const pa=slot==='outfit'?OUTFIT_CHANGE_AP:slot==='offhandItem'?4:6;let reason=inventoryOrderReason(s,u,pa);
  if(!reason)try{planEquipLoot(u,inventoryKey,slot);}catch(error){reason=error.message;}
  return {pa,reason,valid:!reason};
}
export function lootPreview(s,u,action={}){
  const pa=8;let reason=inventoryOrderReason(s,u,pa);
  if(!reason)try{planLoot(s,u,action);}catch(error){reason=error.message;}
  return {pa,reason,valid:!reason};
}
export function lootApproachPreview(s,u,action={}){
  const local=lootPreview(s,u,action),{position}=lootSource(s,action);
  const result=(reason=local.reason,route=null)=>({...local,type:'loot',actionPa:local.pa,movePa:route?.cost??0,pa:local.pa+(route?.cost??0),
    destination:route?{x:route.x,y:route.y}:null,path:route?.path??[],valid:!reason,reason});
  if(!u||inventoryOrderReason({...s,mode:'exploration'},u,0))return result();
  if(!position||position.departure||!canSee(s,u,position))return result('El cuerpo o equipo debe estar a la vista del soldado.');
  if(dist(u,position)<=1.5&&hasLineOfSight(s,u,position))return result();
  // Capacity and exact source quantities must be valid before the approach.
  // This virtual preflight changes neither ownership nor position in the battle.
  const ready=lootPreview({...s,mode:'exploration'},{...u,x:position.x,y:position.y},action);
  if(!ready.valid)return result(ready.reason);
  if(u.entangled)return result('Primero debés liberarte de las boleadoras.');
  const route=knownApproachRoute(s,u,cell=>dist(cell,position)<=1.5&&hasLineOfSight(s,cell,position));
  if(!route)return result('No hay una ruta para acercarse y recoger el equipo.');
  return result(s.mode!=='exploration'&&route.cost+local.pa>u.ap?'PA insuficientes para acercarse y recoger el equipo.':null,route);
}
export function lootSearchPreview(s,u,point){
  let available=false;
  const result=(reason=null,route=null)=>({type:'approachLoot',available,pa:route?.cost??0,movePa:route?.cost??0,actionPa:0,destination:route?{x:route.x,y:route.y}:u?{x:u.x,y:u.y}:null,path:route?.path??[],valid:!reason,reason});
  const reason=inventoryOrderReason({...s,mode:'exploration'},u,0);if(reason)return result(reason);
  if(!point||!canSee(s,u,point))return result('El cuerpo o equipo debe estar a la vista del soldado.');
  const at=source=>source.x===point.x&&source.y===point.y;
  const found=s.units.some(source=>source.id!==u.id&&!source.departure&&!source.fled&&(source.hp<=0||source.unconscious||source.surrendered)&&at(source))||s.droppedWeapons.some(source=>!source.taken&&at(source))||s.groundItems.some(source=>source.count>0&&!source.heldBy&&at(source));
  if(!found)return result('No hay un cuerpo o equipo para registrar en esta casilla.');
  available=true;
  if(dist(u,point)<=1.5&&hasLineOfSight(s,u,point))return result();
  if(u.entangled)return result('Primero debés liberarte de las boleadoras.');
  const route=knownApproachRoute(s,u,cell=>dist(cell,point)<=1.5&&hasLineOfSight(s,cell,point));
  if(!route)return result('No hay una ruta para acercarse al equipo.');
  return result(s.mode!=='exploration'&&u.ap<route.cost?'PA insuficientes para acercarse al equipo.':null,route);
}
function environmentObject(s,ref){
  if(ref?.kind==='door')return s.tiles.find(t=>t.type==='door'&&(t.doorId??`door:${t.x}:${t.y}`)===ref.id);
  if(ref?.kind==='container')return s.props.find(p=>p.type==='chest'&&p.id===ref.id);
  return null;
}
export function environmentTargetAt(s,point){
  const door=s.tiles.find(t=>t.x===point.x&&t.y===point.y&&t.type==='door');
  if(door)return {...door,kind:'door',id:door.doorId??`door:${door.x}:${door.y}`};
  const chest=s.props.find(p=>p.type==='chest'&&propCells(p).some(t=>t.x===point.x&&t.y===point.y));
  return chest?{...chest,kind:'container'}:null;
}
function environmentReachReason(s,u,object){
  if(!object)return 'El objeto ya no está en el sector.';
  if(!u||!alive(u)||!interruptAvailable(s,u)||u.knockedDown)return 'El soldado no puede manejar el objeto ahora.';
  const cells=object.type==='chest'?propCells(object):[object];
  if(!cells.some(p=>dist(u,p)<=1.5&&canSee(s,u,p)))return 'Acércate al objeto y mira hacia él.';
  return null;
}
export function environmentPreview(s,u,ref,verb){
  const target=environmentObject(s,ref),tool=u&&heldTool(u);
  verb??=tool?.toolKey==='pliers'?'disarm':target?.locked?(tool?.verb??'inspect'):target?.open?'close':'open';
  const profile=environmentActionProfile(u??{},target,verb);
  let reason=environmentReachReason(s,u,target)??profile.reason;
  if(!reason&&verb==='close'&&target.type==='door'&&(s.units.some(v=>onField(v)&&v.x===target.x&&v.y===target.y)||(s.npcs??[]).some(v=>v.x===target.x&&v.y===target.y)||s.artillery.some(v=>v.x===target.x&&v.y===target.y)))reason='Hay una persona o una pieza en el paso de la puerta.';
  if(!reason&&s.mode!=='exploration'&&u.ap<profile.pa)reason=`Faltan ${profile.pa} PA para manejar el objeto.`;
  return {...profile,reason,valid:!reason,action:{type:'environment',unitId:u?.id,kind:ref?.kind,id:ref?.id,verb}};
}
export function environmentUsePreview(s,u,ref,verb){
  const local=environmentPreview(s,u,ref,verb),target=environmentObject(s,ref);
  const result=(reason=local.reason,route=null)=>({...local,type:'environment',actionPa:local.pa,movePa:route?.cost??0,pa:local.pa+(route?.cost??0),
    label:route?.cost?`Acercarse y ${local.label.toLowerCase()}`:local.label,destination:route?{x:route.x,y:route.y}:null,path:route?.path??[],reason,valid:!reason});
  if(!target||!u||!alive(u)||!interruptAvailable(s,u)||u.knockedDown)return result();
  const cells=target.type==='chest'?propCells(target):[target];
  const visible=cells.find(point=>canSee(s,u,point));
  if(!visible)return result('El objeto debe estar a la vista del soldado.');
  if(!environmentReachReason(s,u,target))return result();
  // Check the held tool, lock, known trap and occupied doorway before spending
  // movement. Only position and the AP cap are relaxed in this pure preflight.
  const ready=environmentPreview({...s,mode:'exploration'},{...u,x:visible.x,y:visible.y},ref,local.action.verb);
  if(!ready.valid)return result(ready.reason);
  if(u.entangled)return result('Primero debés liberarte de las boleadoras.');
  const route=knownApproachRoute(s,u,cell=>cells.some(point=>dist(cell,point)<=1.5&&canSee(s,{...u,...cell},point)));
  if(!route)return result('No hay una ruta para acercarse y usar el objeto.');
  return result(s.mode!=='exploration'&&route.cost+local.pa>u.ap?'PA insuficientes para acercarse y usar el objeto.':null,route);
}
export function containerLootPreview(s,u,ref,index,count=1){
  const target=environmentObject(s,{...ref,kind:'container'}),pa=8;
  let reason=environmentReachReason(s,u,target);
  if(!reason&&s.mode!=='exploration'&&u.ap<pa)reason=`Recoger el objeto requiere ${pa} PA.`;
  if(!reason)try{const {stack}=extractContainerItem(target,index,count);applyItemQuantity(u,stack);}catch(error){reason=error.message;}
  return {pa,valid:!reason,reason,action:{type:'containerLoot',unitId:u?.id,kind:'container',id:ref?.id,index,count}};
}

export function medicalUsePreview(s,u,target=u){
  const cost=u?actionCosts(s,u).heal:0;
  let reason=!u||!alive(u)||s.status!=='active'||(u.side==='player'?!interruptAvailable(s,u):s.phase!=='enemy')?'El soldado no puede usar equipo ahora.':null;
  if(!reason&&u.activeSlot!=='medical')reason='Prepará las vendas en la mano antes de tratar una herida.';
  if(!reason&&(!target||target.side!==u.side||target.hp<=0||target.departure||target.routed||dist(u,target)>1.5||!hasLineOfSight(s,u,target)))reason='El herido debe estar vivo, junto a ti y al alcance de las vendas.';
  if(!reason&&!u.medkits)reason='No quedan vendas.';
  if(!reason&&!(u.medical>0))reason='Este soldado no tiene conocimientos de primeros auxilios.';
  if(!reason&&!target.bleeding&&(target.bandaged??0)>=target.maxHp-target.hp)reason='Las heridas ya están vendadas. Necesita recuperación en campaña.';
  if(!reason&&s.mode!=='exploration'&&u.ap<cost)reason=`Vendar requiere ${cost} PA.`;
  return {allowed:!reason,reason,cost};
}

// Ordinary held-item targeting can include an approach. Explicit heal/melee
// aliases remain local actions; the composed command uses those same rules.
function knownApproachRoute(s,u,inReach){
  const units=s.units.filter(other=>other.side===u.side||teamCanSee(s,u.side,other));
  // Stop Dijkstra at the cheapest usable position. Ignoring the AP cap reports
  // the true combined cost even when this turn cannot afford the whole order.
  return getReachable({...s,units,mode:'exploration'},u,{stopAt:cell=>inReach(cell)&&
    !units.some(other=>other.id!==u.id&&!other.departure&&other.hp>0&&other.x===cell.x&&other.y===cell.y)})[0];
}
export function itemUsePreview(s,u,target){
  if(!u||!['primary','blade','unarmed','medical'].includes(u.activeSlot??'primary'))return null;
  const type=u.activeSlot==='medical'?'heal':contextualAttack(s,u,target).type;
  if(!['heal','melee'].includes(type))return null;
  const actionPa=actionCosts(s,u)[type==='heal'?'heal':'melee'],reach=type==='heal'?1.5:bladeFor(u).reach;
  const result=(reason=null,route=null)=>({type,actionPa,movePa:route?.cost??0,pa:actionPa+(route?.cost??0),destination:route?{x:route.x,y:route.y}:null,path:route?.path??[],valid:!reason,reason});
  if(!alive(u)||s.status!=='active'||(u.side==='player'?!interruptAvailable(s,u):s.phase!=='enemy'))return result('El combatiente no puede actuar ahora.');
  if(!target||!onField(target)||type==='heal'&&target.side!==u.side||type==='melee'&&(target.side===u.side||target.surrendered))return result('El objetivo no está disponible para este objeto.');
  if(type==='melee'&&!teamCanSee(s,u.side,target))return result('Ningún compañero puede ver ese objetivo.');
  if(type==='heal'){
    // Validate the actual supplies and patient before searching. The virtual
    // position removes only the reach check; it grants no AP, kit or treatment.
    const medical=medicalUsePreview(s,{...u,x:target.x,y:target.y},target);
    if(!medical.allowed)return result(medical.reason);
  }
  const inReach=dist(u,target)<=reach&&hasLineOfSight(s,u,target);
  if(u.knockedDown&&(type!=='heal'||!inReach))return result('El soldado está derribado: primero debés levantarte.');
  if(s.mode!=='exploration'&&u.ap<actionPa)return result('PA insuficientes para usar el objeto.');
  if(inReach)return result();
  if(u.entangled)return result('Primero debés liberarte de las boleadoras.');
  const route=knownApproachRoute(s,u,cell=>dist(cell,target)>0&&dist(cell,target)<=reach&&hasLineOfSight(s,cell,target));
  if(!route)return result('No hay una ruta para acercarse y usar el objeto.');
  return result(s.mode!=='exploration'&&route.cost+actionPa>u.ap?'PA insuficientes para acercarse y usar el objeto.':null,route);
}

export function supplyUsePreview(s,u,target,key=u?.activeSupply){
  const supply=Object.hasOwn(HELD_SUPPLIES,key)?HELD_SUPPLIES[key]:null,cost=supply?.cost??0;
  let reason=!u||!alive(u)||s.status!=='active'||(u.side==='player'?!interruptAvailable(s,u):s.phase!=='enemy')?'El soldado no puede usar equipo ahora.':null;
  if(!reason&&target?.departure)reason='Esa persona ya salió del sector.';
  if(!reason&&!supply)reason='Selecciona un pertrecho disponible.';
  if(!reason&&heldSupply(u)?.key!==key)reason='Prepará ese pertrecho en la mano antes de usarlo.';
  if(!reason&&u.knockedDown&&key!=='rations')reason='El soldado está derribado: debe ponerse de pie.';
  if(!reason&&!(u[key]>0))reason='No queda ese pertrecho.';
  if(!reason&&key==='torches'){
    if(!target||!Number.isInteger(target.x)||!Number.isInteger(target.y)||!tile(s,target.x,target.y)||tile(s,target.x,target.y).blocked||propBlocksAt(s,target.x,target.y)||dist(u,target)>supply.range||!hasLineOfSight(s,u,target))reason='La antorcha debe caer en terreno accesible a ocho casillas o menos.';
    else if(target.id!==undefined&&target.side!==u.side&&!teamCanSee(s,u.side,target))reason='Ningún compañero puede ver ese objetivo.';
  }
  if(!reason&&key==='boleadoras'){
    const victim=target&&s.units.find(v=>v.id===String(target.id));
    if(!victim||victim.side===u.side||!targetable(victim)||dist(u,victim)>supply.range||!hasLineOfSight(s,u,victim)||!teamCanSee(s,u.side,victim))reason='El blanco de las boleadoras debe estar visible y a ocho casillas o menos.';
  }
  if(!reason&&key==='rations'){
    if(target?.id!==u.id)reason='La ración se usa sobre el mismo soldado.';
    else if(!(u.fatigue>0)&&(u.energy??100)>=100)reason='El soldado ya está descansado.';
  }
  if(!reason&&s.mode!=='exploration'&&u.ap<cost)reason=`Usar ${supply.name.toLowerCase()} requiere ${cost} PA.`;
  return {allowed:!reason,reason,cost};
}

function apply(s,a,enemy=false,movementPath=null){if(a.type==='useItem'){const user=s.units.find(v=>v.id===String(a.unitId));if(user?.activeSlot==='supply'){const point=s.units.find(v=>v.id===String(a.targetId));a={...a,type:heldSupply(user)?.action??'invalidSupply',...(point?{x:point.x,y:point.y}:{}),targetId:a.targetId??(user.activeSupply==='rations'?'':undefined)};}else if(a.environment)a={...a,...a.environment,type:'environment'};else a={...a,type:user?.activeSlot==='medical'?'heal':user?contextualAttack(s,user,s.units.find(v=>v.id===String(a.targetId)),a).type:'melee'};}const fail=text=>{if(!enemy||u&&journalVisible(s,u)){s.lastError=text;say(s,text);}return false;};const u=s.units.find(u=>u.id===String(a.unitId));if(s.status!=='active')return fail('El combate ya terminó.');if(!u||!alive(u))return fail('El soldado no puede actuar.');if(u.side!==(enemy?'enemy':'player'))return fail('No puedes dar órdenes a ese soldado.');if(!enemy&&!interruptAvailable(s,u))return fail('Ese soldado no puede actuar en esta interrupción.');if(u.knockedDown&&!['stance','heal','ration'].includes(a.type))return fail('El soldado está derribado: debe ponerse de pie.');const observation=reactionObservation(s,u);const target=s.units.find(u=>u.id===String(a.targetId)&&!u.departure);if(a.targetId!==undefined&&!target)return fail('El objetivo no está disponible en este sector.');const pay=n=>{if(!Number.isFinite(n)||n<0||s.mode!=='exploration'&&u.ap<n)return false;if(n>0&&(lowersWeapon(a.type)||a.type==='look'&&u.stance==='prone'))lowerWeapon(u);if(s.mode==='exploration'){if(a.type!=='move')s.actionDurationSeconds=Math.max(1,Math.ceil(n*.06));return true;}u.ap-=n;return true;};
if(a.type==='move'){
  if(u.entangled)return fail('Las boleadoras inmovilizan al soldado: debe liberarse.');
  let postureCost=0;
  if(a.movement!==undefined){
    if(!['walk','run','crouch','prone'].includes(a.movement))return fail('Forma de desplazamiento inválida.');
    const stance=movementStance(a.movement);
    if(u.mounted&&stance!=='standing')return fail('Debes desmontar antes de agacharte.');
    postureCost=stanceCost(u,stance);if(!pay(postureCost))return fail('Faltan PA para cambiar de postura.');
    u.movementMode=a.movement;u.stance=stance;
  }
  const movementIntent=a.movementIntent===undefined?'forward':a.movementIntent,intentReason=movementIntentReason(u,movementIntent);
  if(intentReason)return fail(intentReason);
  const path=movementPath??getReachable(s,u,{movementIntent}).find(p=>p.x===a.x&&p.y===a.y);
  if(!path||path.cost===0)return fail('Destino inaccesible o puntos de acción insuficientes.');
  const exploring=s.mode==='exploration',setupSeconds=postureCost>0?Math.max(1,Math.ceil(postureCost*.06)):0;
  u.braced=false;u.overwatch=false;s.actionDurationSeconds=setupSeconds;let spent=postureCost,steps=0;
  if(exploring&&setupSeconds){advanceExplorationAction(s,setupSeconds);if(alive(u))detectContact(s);}
  for(const p of path.path){
    if(!alive(u)||exploring&&s.mode!=='exploration')break;
    // A planned item approach uses known occupancy. An unseen obstruction can
    // stop that route, but cannot secretly select a different path around it.
    if(occupied(s,p.x,p.y,u.id)||!Number.isFinite(movementStepCost(s,u,u,p,{movementIntent}))){
      if(!steps)return fail('La ruta está bloqueada.');
      sayObserved(s,[u],`${u.name} se detiene: la ruta está bloqueada.`);break;
    }
    const stepObservation=reactionObservation(s,u);
    const factor=movementFactor(u,p),step=movementStepCost(s,u,u,p,{movementIntent});if(!pay(step))break;spent+=step;steps++;
    const seconds=Math.ceil((u.movementMode==='run'?1:u.movementMode==='prone'?5:3)*stealthAPMultiplier(u)*factor*intentFactor(movementIntent));s.actionDurationSeconds+=seconds;
    const dir=`${p.x-u.x},${p.y-u.y}`;u.momentum=movementIntent==='preserveFacing'?0:dir===u.lastDirection?u.momentum+1:1;u.lastDirection=dir;if(movementIntent!=='preserveFacing')u.facing=directionTo(u,p);u.x=p.x;u.y=p.y;investigateNoise(s,u);
    delete u.lastTargetId;delete u.lastShotPosition;
    if(u.mounted&&u.mount&&u.mount.stamina>0){u.ridingPracticeTiles??=[];const key=`${u.x},${u.y}`;if(!u.ridingPracticeTiles.includes(key)){u.ridingPracticeTiles.push(key);practice(u,'ridingSkill');}}
    exhaust(s,u,Math.ceil(movementEnergy(u,tile(s,p.x,p.y))*factor));
    if(exploring)advanceExplorationAction(s,seconds);
    emitNoise(s,u,'move');rememberContacts(s);
    if(u.stealthMode&&!u.mounted&&s.units.some(v=>v.side!==u.side&&alive(v)&&dist(v,u)<=12)&&!s.units.some(v=>v.side!==u.side&&alive(v)&&canSee(s,v,u))){u.practiceTiles??=[];const key=`${u.x},${u.y}`;if(!u.practiceTiles.includes(key)){u.practiceTiles.push(key);practice(u,'agility');practice(u,'stealth');}}
    if(carriedWeight(u)>carryCapacity(u)){u.strengthTraining++;if(u.strengthTraining>=30){u.strength=Math.min(100,u.strength+1);u.strengthTraining=0;}}
    if(!alive(u)||detectContact(s))break;
    if(s.mode==='combat'&&reactionFire(s,u,stepObservation))break;
    if(!alive(u)||s.status!=='active')break;
  }

  sayObserved(s,[u],u.side==='player'?`${u.name} ${movementIntent==='preserveFacing'?'se desplaza sin girar':'avanza'} ${steps} casillas (${exploring?0:spent} PA).`:`${u.name} avanza.`);
}
else if(a.type==='firePoint'){
  const preview=pointFirePreview(s,u,a,a.aim);if(!preview.valid)return fail(preview.reason);
  if(a.targetId!==undefined)return fail('El disparo a una casilla usa coordenadas, no una persona.');
  if(a.hitLocation!==undefined&&a.hitLocation!=='torso')return fail('El disparo a una casilla apunta a una altura fija.');
  if(!pay(preview.pa))return fail('PA insuficientes.');
  u.weaponReady=true;u.momentum=0;u.facing=directionTo(u,a);delete u.lastTargetId;delete u.lastShotPosition;
  if(random(s)*100<ignitionRisk(s,u)){u.jammed=true;sayObserved(s,[u],`${u.name}: fallo de chispa. La carga se conserva; cebar cuesta ${actionCosts(s,u).reprime} PA.`);}
  else{
    u.loaded--;emitNoise(s,u,'fire');
    pointFireImpact(s,u,a,preview.aim);u.condition=Math.max(0,u.condition-1);s.smoke.push({x:u.x,y:u.y,radius:1,turns:3});
    sayObserved(s,[u],`${u.name} dispara hacia ${a.x+1}, ${a.y+1}. El disparo puede alcanzar a cualquiera en su trayectoria.`);
  }
}
else if(a.type==='fire'){const hitLocation=a.hitLocation??'torso';if(!HIT_LOCATIONS.includes(hitLocation))return fail('Selecciona torso, cabeza o piernas.');if(!target||target.side===u.side||!targetable(target))return fail('Selecciona un enemigo activo.');if(!hasFirearm(u))return fail('Este soldado lleva un arma blanca: acércate para atacar.');if(!teamCanSee(s,u.side,target))return fail('Ningún compañero puede ver ese objetivo.');if(!shotLocationsFor(target).includes(hitLocation))return fail('Un objetivo cuerpo a tierra tiene una sola zona de tiro.');if(u.jammed)return fail('La cazoleta falló: vuelve a cebar el arma.');if(u.loaded<1)return fail('El arma está descargada.');if(!hasLineOfSight(s,u,target))return fail('No hay línea de tiro.');const aim=clamp(Math.floor(Number.isFinite(a.aim)?a.aim:0),0,4),w=weaponFor(u),chance=shotAccuracy(s,u,target,aim,hitLocation);if(!pay(actionCosts(s,u,target).fire+aim*actionCosts(s,u,target).aim))return fail('Faltan puntos de acción para disparar.');u.weaponReady=true;u.momentum=0;u.facing=directionTo(u,target);u.lastTargetId=target.id;u.lastShotPosition={x:u.x,y:u.y};const risk=ignitionRisk(s,u);if(random(s)*100<risk){u.jammed=true;sayObserved(s,[u],`${u.name}: fallo de chispa. La carga se conserva; cebar cuesta ${actionCosts(s,u).reprime} PA.`);}else{u.loaded--;emitNoise(s,u,'fire');practice(u,'marksmanship',2);u.condition=Math.max(0,u.condition-1);s.smoke.push({x:u.x,y:u.y,radius:1,turns:3});if(w.id===1807){const length=dist(u,target),dx=(target.x-u.x)/length,dy=(target.y-u.y)/length;for(const victim of s.units.filter(v=>onField(v)&&v.id!==u.id)){const vx=victim.x-u.x,vy=victim.y-u.y,forward=vx*dx+vy*dy,across=Math.abs(vx*dy-vy*dx);if(forward<=0||forward>6||across>Math.max(.5,forward*.25)||!hasLineOfSight(s,u,victim))continue;victim.morale=Math.max(0,victim.morale-18);if(random(s)*100<Math.min(95,shotAccuracy(s,u,victim,aim,victim.id===target.id?hitLocation:'torso')+20))firearmImpact(s,u,victim,w.damage*(1-forward/12),victim.id===target.id?hitLocation:'torso');else if(victim.morale<15)rout(s,victim);}sayObserved(s,[u],`${u.name} descarga el trabuco: una nube de metralla barre tres casillas de ancho.`);}else{const hit=random(s)*100<chance;directedFireImpact(s,u,target,hitLocation,hit);if(!hit){target.morale=Math.max(0,target.morale-4);sayObserved(s,[u],`${u.name} dispara sin acertar al punto elegido (${chance}%).`);}} }}
else if(a.type==='swapHands'){
  let next;try{next=planSwapHands(u);}catch(error){return fail(error.message);}
  if(!pay(4))return fail('Cambiar de mano requiere 4 PA.');next.ap=u.ap;replaceUnit(u,next);sayObserved(s,[u],`${u.name} prepara el arma de la otra mano.`);
}
else if(a.type==='weaponMode'){
  if(!hasFirearm(u))return fail('Prepará un arma de fuego en la mano.');
  if(!['fire','melee'].includes(a.mode))return fail('Elegí disparo o combate cercano.');
  if(u.weaponMode===a.mode)return fail('Ese modo ya está seleccionado.');
  u.weaponMode=a.mode;
  sayObserved(s,[u],`${u.name}: ${a.mode==='fire'?'disparo':fixedBayonetFor(u)?'estocada de bayoneta':'culatazo'}.`);return true;
}
else if(a.type==='reload'){
  if(!hasFirearm(u))return fail('Las armas blancas no necesitan recarga.');
  if(u.jammed)return fail('Primero debes volver a cebar el arma.');
  const plan=reloadPlan(u,s);
  if(!plan.totalPA)return fail('No falta carga o no quedan cartuchos.');
  if(!plan.pa||!pay(plan.pa))return fail('Faltan puntos de acción para recargar.');
  u.loaded+=plan.rounds;u.ammo-=plan.rounds;
  if(plan.progress>0)u.reloadProgress=plan.progress;else delete u.reloadProgress;
  emitNoise(s,u,'reload');u.priming=Math.max(0,u.priming-plan.rounds);u.momentum=0;
  sayObserved(s,[u],plan.partial?`${u.name} avanza la recarga (${plan.pa} PA). Carga ${plan.rounds} cartuchos; faltan ${plan.remainingPA} PA para completar la recarga.`:`${u.name} recarga (${plan.pa} PA).`);
}
else if(a.type==='reprime'){if(!u.jammed)return fail('El arma no necesita cebado.');if(u.priming<1)return fail('El frasco de pólvora de cebar está vacío.');const cost=actionCosts(s,u).reprime;if(!pay(cost))return fail(`Cebar requiere ${cost} PA.`);u.priming--;practice(u,'mechanical');u.jammed=false;sayObserved(s,[u],`${u.name} vuelve a cebar la cazoleta.`);}
else if(a.type==='melee'){
  if(u.activeSlot==='item')return fail('Este objeto no sirve para atacar. Guardalo o elegí un arma.');
  if(u.activeSlot==='tool')return fail('La herramienta se usa sobre una puerta o un cofre.');
  if(u.activeSlot==='supply')return fail('Usa el pertrecho que llevas en la mano.');
  if(u.activeSlot==='medical')return fail('El equipo de curación se usa sobre un compañero herido.');
  const blade=bladeFor(u);if(!target||!targetable(target)||target.side===u.side||dist(u,target)>blade.reach||!hasLineOfSight(s,u,target))return fail('Debes acercarte al enemigo para atacar.');
  const meleeCost=actionCosts(s,u).melee;if(!pay(meleeCost))return fail(`El ataque requiere ${meleeCost} PA.`);
  const direction=`${Math.sign(target.x-u.x)},${Math.sign(target.y-u.y)}`,bonus=1+(direction===u.lastDirection?Math.min(u.momentum,5)*.1:0);
  u.facing=directionTo(u,target);emitNoise(s,u,'melee');
  if(blade.id===FISTS.id){
    const chance=unarmedChance(u,target,{aware:canSee(s,target,u)});
    if(random(s)*100<chance){const impact=unarmedImpact(u);damage(s,target,impact.damage,u,false,'torso',Math.max(0,impact.breathLoss-Math.ceil(impact.damage/2)));practice(u,'agility');if(target.unconscious)sayObserved(s,[target],`${target.name} queda inconsciente por el golpe.`);}
    else sayObserved(s,[u],`${u.name} falla el golpe (${chance}%).`);
  }else meleeStrike(s,u,target,blade.damage*bonus);
  u.momentum=0;
}
else if(a.type==='charge'){if(['medical','tool','supply','item'].includes(u.activeSlot))return fail('Prepara un arma antes de atacar.');const blade=bladeFor(u);if(blade.id===0)return fail('Acércate al enemigo para golpear con las manos vacías.');if(!target||!targetable(target)||target.side===u.side)return fail('Selecciona un enemigo para cargar.');const dx=target.x-u.x,dy=target.y-u.y;if(dx!==0&&dy!==0&&Math.abs(dx)!==Math.abs(dy))return fail('La carga exige una línea recta.');let path=line(u,target);const contact=path.findIndex(p=>dist(p,target)<=blade.reach);path=dist(u,target)<=blade.reach?[]:path.slice(0,contact+1);if(!path.length&&dist(u,target)>blade.reach)return fail('No hay espacio para cargar.');let previous=u,cost=actionCosts(s,u).melee;for(const p of path){const t=tile(s,p.x,p.y);if(!t||t.blocked||occupied(s,p.x,p.y,u.id))return fail('La carga está bloqueada.');const step=movementStepCost(s,u,previous,p);if(!Number.isFinite(step))return fail('La carga no puede atravesar una esquina.');cost+=step;previous=p;}if(!hasLineOfSight(s,u,target))return fail('No hay un paso libre hasta el objetivo.');if(u.ap<Math.ceil(cost))return fail('Faltan puntos de acción para completar la carga.');let stopped=false;for(const p of path){const stepObservation=reactionObservation(s,u);const factor=movementFactor(u,p),step=movementStepCost(s,u,u,p);if(u.ap<step){stopped=true;break;}u.ap-=step;lowerWeapon(u);u.facing=directionTo(u,p);u.x=p.x;u.y=p.y;investigateNoise(s,u);delete u.lastTargetId;delete u.lastShotPosition;exhaust(s,u,Math.ceil(movementEnergy({...u,movementMode:'run'},tile(s,p.x,p.y))*factor));emitNoise(s,{...u,movementMode:'run',stealthMode:false},'move');rememberContacts(s);if(!alive(u)){stopped=true;break;}const interrupted=reactionFire(s,u,stepObservation);interceptCharge(s,u,target);if(interrupted||!alive(u)||s.status!=='active'){stopped=true;break;}}if(stopped){sayObserved(s,[u],`${u.name} detiene la carga antes de alcanzar al enemigo.`);checkEnd(s);return true;}const impactObservation=reactionObservation(s,u);lowerWeapon(u);u.ap=0;if(!alive(u)){sayObserved(s,[u],`${u.name} no logra completar la carga.`);checkEnd(s);return true;}u.facing=directionTo(u,target);emitNoise(s,u,'melee');meleeStrike(s,u,target,blade.damage*(1+path.length*.1)*(u.mounted?1.25:1)*(Number(u.id)===57&&u.mounted?1.2:1));if(Number(u.id)===9&&u.mounted){for(const levy of s.units.filter(v=>v.side!==u.side&&alive(v)&&dist(v,u)<=4&&(v.militia||v.levy||v.marksmanship<60))){levy.morale=Math.max(0,levy.morale-25);if(levy.morale<15)rout(s,levy);}sayObserved(s,[u],`${u.name} aterroriza a las levas con su carga montada.`);}target.morale=Math.max(0,target.morale-15);holdMorale(s,target);if(alive(target)&&target.morale<15){rout(s,target);}u.momentum=0;sayObserved(s,[u],u.side==='player'?`${u.name} ejecuta una carga de ${path.length} casillas con ${blade.name}.`:`${u.name} ataca con ${blade.name}.`);checkEnd(s);reactionFire(s,u,impactObservation);}
else if(['artillery','artilleryReload','artilleryMove','artilleryPivot'].includes(a.type)){
const gun=s.artillery.find(g=>g.id===a.artilleryId),spec=ARTILLERY[gun?.type];
if(!gun||!spec||gun.side!==u.side||dist(u,gun)>1.5)return fail('Debes estar junto a una pieza de artillería propia.');
const costs=artilleryCosts(s,u,gun),loading=a.type==='artilleryReload'?artilleryReloadPreview(s,u,gun):null;
const cost=loading?loading.pa:costs[{artillery:'fire',artilleryMove:'move',artilleryPivot:'pivot'}[a.type]];
const crew=loading??artilleryCrewPlan(s,u,gun,cost);if(crew.reason)return fail(crew.reason);
const assigned=crew.crew.map(id=>s.units.find(v=>v.id===id));
if(a.type==='artilleryMove'){
const dx=a.x-gun.x,dy=a.y-gun.y;if(!Number.isInteger(a.x)||!Number.isInteger(a.y)||Math.abs(dx)+Math.abs(dy)!==1)return fail('La pieza se arrastra una casilla horizontal o vertical por orden.');
const positions=[{x:a.x,y:a.y},...assigned.map(v=>({x:v.x+dx,y:v.y+dy}))],ids=new Set(assigned.map(v=>v.id));
if(positions.some(p=>propBlocksAt(s,p.x,p.y)||!tile(s,p.x,p.y)||tile(s,p.x,p.y).blocked||tile(s,p.x,p.y).type==='water'||s.units.some(v=>onField(v)&&!v.unconscious&&!ids.has(v.id)&&v.x===p.x&&v.y===p.y)||(s.npcs??[]).some(v=>v.x===p.x&&v.y===p.y)||s.artillery.some(g=>g!==gun&&g.x===p.x&&g.y===p.y)))return fail('La pieza y su dotación no caben en ese terreno.');
gun.x=a.x;gun.y=a.y;for(const v of assigned){v.x+=dx;v.y+=dy;}sayObserved(s,[u],`${u.name} dirige el arrastre de ${spec.name}.`);
}else if(a.type==='artilleryPivot'){
if(!Number.isInteger(a.x)||!Number.isInteger(a.y)||!tile(s,a.x,a.y)||dist(gun,a)<1)return fail('Indica una casilla hacia la cual orientar la pieza.');gun.facing=Math.atan2(a.y-gun.y,a.x-gun.x);sayObserved(s,[u],`${spec.name} gira hacia la nueva línea de tiro.`);
}else if(a.type==='artilleryReload'){
if(loading.rounds){gun.loaded=true;gun.ammo--;delete gun.reloadProgress;}
else if(loading.progress>0)gun.reloadProgress=loading.progress;
emitNoise(s,u,'reload',gun);
sayObserved(s,[u],loading.partial?`${u.name} dirige la recarga de ${spec.name}: ${cost} PA por artillero; faltan ${loading.remainingPA} PA por artillero.`:`${u.name} completa la recarga de ${spec.name} (${cost} PA por artillero).`);
}else{
if(!gun.loaded)return fail('Primero hay que recargar la pieza.');const point=target||{x:a.x,y:a.y};
if(!Number.isInteger(point.x)||!Number.isInteger(point.y)||!tile(s,point.x,point.y)||dist(gun,point)<1||dist(gun,point)>spec.range)return fail(`Objetivo fuera del alcance de ${spec.range} casillas o no válido.`);
const facing=Math.atan2(point.y-gun.y,point.x-gun.x);if(Number.isFinite(gun.facing)&&Math.abs(Math.atan2(Math.sin(facing-gun.facing),Math.cos(facing-gun.facing)))>Math.PI/4)return fail('Gira la pieza antes de disparar fuera de su arco frontal.');
gun.facing=facing;gun.loaded=false;emitNoise(s,u,'explosion',gun);s.smoke.push({x:gun.x,y:gun.y,radius:2,turns:3});
if(a.mode==='canister'){
const len=dist(gun,point),dx=(point.x-gun.x)/len,dy=(point.y-gun.y)/len;
for(const v of s.units.filter(onField)){const vx=v.x-gun.x,vy=v.y-gun.y,forward=vx*dx+vy*dy,across=Math.abs(vx*dy-vy*dx);if(forward>1&&forward<=spec.radius*2&&across<=Math.max(1,forward*.5)&&hasLineOfSight(s,gun,v)){damage(s,v,spec.damage*Math.max(.35,1-forward/(spec.radius*3))*(Number(u.id)===5?1.15:1),u);if(alive(v)){v.morale=Math.max(0,v.morale-12);if(v.morale<15)rout(s,v);}}}
sayObserved(s,[u],`${spec.name} barre el frente con metralla.`);
}else{
let energy=spec.damage,penetration=({bronze4:3,field8:5,swivel:1}[gun.type])+(Number(u.id)===7?1:0);
for(const p of line(gun,point)){
const ground=tile(s,p.x,p.y);if(ground?.blocked){if(ground.type==='water'||ground.type==='cliff'){break;}const stone=ground.material==='stone'||ground.type==='stone';const resistance=stone?3:1;if(penetration<resistance){say(s,'La bala se detiene contra la fortificación.');break;}penetration-=resistance;ground.blocked=false;ground.blocksSight=false;ground.type='rubble';ground.cover=20;delete ground.obstacleHeight;delete ground.projectileResistance;say(s,`La bala abre una brecha en ${stone?'la piedra':'el adobe'}.`);}
for(const victim of s.units.filter(v=>onField(v)&&v.x===p.x&&v.y===p.y)){damage(s,victim,energy,u);energy*=.75;penetration--;}
if(penetration<0||energy<20)break;
}
sayObserved(s,[u],`${spec.name} dispara una bala rasa que atraviesa su línea de tiro.`);
}}
for(const v of assigned){lowerWeapon(v);if(s.mode!=='exploration')v.ap-=cost;}
if(s.mode==='exploration')s.actionDurationSeconds=Math.max(1,Math.ceil(cost*.06));
}
else if(a.type==='door'||a.type==='environment'){
  const ref=a.type==='door'?{kind:'door',id:a.doorId??environmentTargetAt(s,a)?.id}:a;
  const object=environmentObject(s,ref);
  const verb=a.type==='door'?(typeof a.open==='boolean'?(a.open?'open':'close'):object?.open?'close':'open'):a.verb;
  const preview=environmentPreview(s,u,ref,verb);if(!preview.valid)return fail(preview.reason);
  const result=resolveEnvironmentInteraction(u,object,{verb:preview.verb,...(preview.requiresRoll?{roll:random(s)}:{})});
  replaceUnit(u,result.unit);pay(result.pa);replaceUnit(object,result.target);u.facing=directionTo(u,object);
  for(const [skill,amount]of Object.entries(result.practice))practice(u,skill,amount);
  if(result.damage||result.breathLoss)damage(s,u,result.damage,{name:'La trampa'},false,'torso',Math.max(0,result.breathLoss-Math.ceil(result.damage/2)));
  if(result.noiseKind)emitNoise(s,{...u,activeSlot:'unarmed'},result.noiseKind,object);
  sayObserved(s,[u],`${u.name}: ${result.message}`);
}
else if(a.type==='containerLoot'){
  const preview=containerLootPreview(s,u,a,a.index,a.count??1);if(!preview.valid)return fail(preview.reason);
  const object=environmentObject(s,{...a,kind:'container'}),extracted=extractContainerItem(object,a.index,a.count??1);
  replaceUnit(u,applyItemQuantity(u,extracted.stack));replaceUnit(object,extracted.target);pay(preview.pa);
  sayObserved(s,[u],`${u.name} recoge el objeto del cofre.`);
}
else if(a.type==='throwTorch'){const point=target??{x:a.x,y:a.y},preview=supplyUsePreview(s,u,point,'torches');if(!preview.allowed)return fail(preview.reason);pay(preview.cost);u.torches--;clearEmptySupply(u);s.lights.push({id:`torch-${u.id}-${s.turn}-${s.lights.length}`,type:'torch',x:point.x,y:point.y,radius:4,intensity:1,turns:s.weather.rain>50?4:8,age:0});if(dist(u,point)>0)u.facing=directionTo(u,point);sayObserved(s,[u],`${u.name} lanza una antorcha encendida.`);}
else if(a.type==='look'){
  const preview=lookPreview(s,u,a);if(!preview.valid)return fail(preview.reason);
  if(!pay(preview.pa))return fail('PA insuficientes.');
  u.momentum=0;
  if(preview.prepare){u.weaponReady=true;sayObserved(s,[u],`${u.name} pone ${weaponFor(u).name} en posición de tiro (${preview.pa} PA).`);}
  else {if(turnLowersWeapon(u,preview.pa))lowerWeapon(u);u.facing=preview.facing;investigateNoise(s,u);delete u.lastTargetId;delete u.lastShotPosition;
    sayObserved(s,[u],`${u.name} gira para observar (${s.mode==='exploration'?0:preview.pa} PA).`);}
}
else if(a.type==='stealth'){
  if(typeof a.enabled!=='boolean')return fail('Indica si quieres activar el sigilo.');
  if(a.enabled&&u.mounted)return fail('Debes desmontar antes de avanzar con sigilo.');
  u.stealthMode=a.enabled;s.actionDurationSeconds=0;sayObserved(s,[u],`${u.name} ${a.enabled?'avanzará con sigilo':'deja de avanzar con sigilo'}.`);
}
else if(a.type==='movement'){
  if(!['walk','run','crouch','prone'].includes(a.movement))return fail('Elige caminar, correr, agacharte o arrastrarte.');
  const stance=movementStance(a.movement);if(u.mounted&&stance!=='standing')return fail('Debes desmontar antes de agacharte.');
  const cost=stanceCost(u,stance);if(!pay(cost))return fail(`Cambiar de postura requiere ${cost} PA.`);
  u.movementMode=a.movement;u.stance=stance;u.momentum=0;sayObserved(s,[u],`${u.name} cambia su forma de desplazarse.`);
}
else if(a.type==='fitBayonet'||a.type==='removeBayonet'){
  const fitting=a.type==='fitBayonet',pa=fitting?FIT_BAYONET_AP:REMOVE_BAYONET_AP;let plan;
  try{plan=fitting?planFitBayonet(u,a.item):planRemoveBayonet(u,a.destination??'inventory');}catch(error){return fail(error.message);}
  if(!pay(pa))return fail(`Cambiar la bayoneta requiere ${pa} PA.`);
  plan.unit.ap=u.ap;replaceUnit(u,plan.unit);emitNoise(s,u,'reload');
  sayObserved(s,[u],`${u.name} ${fitting?'fija la bayoneta correspondiente al fusil':'retira la bayoneta del fusil'} (${pa} PA).`);
}
else if(a.type==='steal'){
  const preview=stealPreview(s,u,target);if(!preview.valid)return fail(preview.reason);
  const plan=planStealWeapon(u,target),chance=weaponStealChance(u,target,{aware:canSee(s,target,u)});
  pay(preview.pa);
  if(random(s)*100<chance){
    plan.receiver.ap=u.ap;replaceUnit(u,plan.receiver);replaceUnit(target,plan.source);
    practice(u,'dexterity');sayObserved(s,[u,target],`${u.name} quita ${weaponFor(u).name} a ${target.name}. El enemigo aún puede combatir.`);
  }else sayObserved(s,[u,target],`${u.name} no logra quitar el arma a ${target.name}.`);
  u.facing=directionTo(u,target);u.momentum=0;u.braced=false;u.overwatch=false;delete u.lastTargetId;delete u.lastShotPosition;
  exhaust(s,u,8);emitNoise(s,{...u,activeSlot:'unarmed'},'melee');
}
else if(a.type==='equipLoot'){
  const preview=equipLootPreview(s,u,a.inventoryKey,a.slot??'primary');if(!preview.valid)return fail(preview.reason);
  const next=planEquipLoot(u,a.inventoryKey,a.slot??'primary');pay(preview.pa);next.ap=u.ap;
  replaceUnit(u,next);sayObserved(s,[u],a.slot==='offhandItem'?`${u.name} ${a.inventoryKey===null?'guarda el objeto de la segunda mano':'sostiene '+itemDescriptor(u,a.inventoryKey).label+' en la segunda mano'}.`:a.slot==='outfit'?`${u.name} ${a.inventoryKey===null?'guarda su vestimenta en un bolsillo grande':'se pone '+itemDescriptor(u,'outfit').label}.`:`${u.name} equipa ${weaponFor(u).name} y guarda el arma desplazada.`);
}
else if(a.type==='moveEquipment'){
 const preview=equipmentPlacementPreview(s,u,a);if(!preview.valid)return fail(preview.reason);
 const plan=planEquipmentPlacement(u,a);pay(plan.pa);plan.unit.ap=u.ap;replaceUnit(u,plan.unit);sayObserved(s,[u],`${u.name} cambia el equipo de ranura.`);
}
else if(a.type==='movePocket'){
  const reason=inventoryOrderReason(s,u,0);if(reason)return fail(reason);
  let next;try{next=planPocketMove(u,a.sourceId,a.destinationId,a.expectedSource,a.expectedDestination);}catch(error){return fail(error.message);}
  pay(0);replaceUnit(u,next);sayObserved(s,[u],`${u.name} ordena sus bolsillos.`);
}
else if(a.type==='drop'){
  const preview=dropPreview(s,u,a.item,a.count??1);if(!preview.valid)return fail(preview.reason);
  const extracted=extractItemQuantity(u,a.item,a.count??1);replaceUnit(u,extracted.unit);pay(preview.pa);addGroundStack(s,extracted.stack,u);
  sayObserved(s,[u],`${u.name} deja el objeto en el suelo.`);
}
else if(a.type==='transfer'){
  const preview=transferPreview(s,u,target,a.item,a.count??1);if(!preview.valid)return fail(preview.reason);
  if(a.transferKind!==undefined&&(a.transferKind!==preview.kind||JSON.stringify(a.transferRoute)!==JSON.stringify(preview.route.map(v=>v.id))))return fail('Cambió la entrega. Revisa el destinatario y los PA antes de confirmar.');
  const transfer=transferItemQuantity(u,target,a.item,a.count??1);replaceUnit(u,transfer.source);pay(preview.pa);
  if(preview.kind==='relay'){
    for(const step of preview.route.slice(1,-1)){
      const helper=s.units.find(v=>v.id===step.id);lowerWeapon(helper);
      if(s.mode!=='exploration')helper.ap-=step.pa;
    }
    if(s.mode==='exploration')s.actionDurationSeconds=preview.route.length-1;
  }
  if(preview.kind!=='throw'||random(s)*100<preview.chance){replaceUnit(target,transfer.target);lowerWeapon(target);if(preview.kind==='throw'&&s.mode!=='exploration')target.ap-=2;sayObserved(s,[u,target],`${u.name} entrega el objeto a ${target.name}${preview.kind==='relay'?' a través de '+preview.route.slice(1,-1).map(v=>v.name).join(', '):''}.`);}
  else {addGroundStack(s,transfer.stack,target);sayObserved(s,[target],`${target.name} no atrapa el objeto. Queda en el suelo a sus pies.`);}
}
else if(a.type==='loot'){
  const preview=lootPreview(s,u,a);if(!preview.valid)return fail(preview.reason);
  const plan=planLoot(s,u,a);commitLoot(u,plan);pay(preview.pa);
  sayObserved(s,[u],`${u.name} recoge el equipo seleccionado.`);
}
else if(a.type==='lootBatch'){
  const preview=lootBatchPreview(s,u,a.items);if(!preview.valid)return fail(preview.reason);
  const plan=planLootBatch(s,u,a.items);
  for(const unit of s.units)replaceUnit(unit,plan.units.find(next=>next.id===unit.id));
  s.groundItems=plan.groundItems;s.droppedWeapons=plan.droppedWeapons;pay(preview.pa);
  sayObserved(s,[u],`${u.name} recoge ${a.items.length} objeto(s) seleccionados (${preview.pa} PA).`);
}
else if(a.type==='boleadoras'){const preview=supplyUsePreview(s,u,target,'boleadoras');if(!preview.allowed)return fail(preview.reason);pay(preview.cost);u.boleadoras--;clearEmptySupply(u);u.facing=directionTo(u,target);target.entangled=true;target.mounted=false;exhaust(s,target,20);s.groundItems.push({id:`bola-${u.id}-${s.turn}-${s.groundItems.length}`,type:'boleadoras',x:target.x,y:target.y,count:1,heldBy:target.id});sayObserved(s,[u,target],`${u.name} enreda a ${target.name} con las boleadoras.`);}
else if(a.type==='free'){if(!u.entangled)return fail('El soldado no está enredado.');if(!pay(15))return fail('Soltarse requiere 15 PA.');u.entangled=false;for(const g of s.groundItems)if(g.heldBy===u.id)g.heldBy=null;sayObserved(s,[u],`${u.name} se libera de las boleadoras.`);}
else if(a.type==='breach'){const wall=tile(s,a.x,a.y);if(!wall?.blocked||dist(u,{x:a.x,y:a.y})>1.5)return fail('Acércate a una barricada o pared de adobe.');if(wall.material==='stone'||['stone','cliff','water'].includes(wall.type))return fail('La piedra requiere artillería; no puede abrirse a mano.');const cost=Number(u.id)===6?25:45;if(!pay(cost))return fail(`Abrir la brecha requiere ${cost} PA.`);wall.blocked=false;wall.blocksSight=false;wall.type='rubble';wall.cover=15;delete wall.obstacleHeight;delete wall.projectileResistance;emitNoise(s,u,'explosion',wall);sayObserved(s,[u],`${u.name} abre una brecha para el asalto.`);}
else if(a.type==='repair'){if(!hasFirearm(u))return fail('Prepara primero el arma de fuego que quieres mantener.');if(u.condition>=100)return fail('El mecanismo ya está en buen estado.');if(u.flints<1)return fail('No quedan piedras de sílex.');const cost=actionCosts(s,u).repair;if(!pay(cost))return fail(`Cambiar el sílex requiere ${cost} PA.`);u.flints--;practice(u,'mechanical',3);u.condition=Math.min(100,u.condition+(hasTrait(u,'gunsmith_artillerist')?45:hasTrait(u,'workshop_training')?40:30));sayObserved(s,[u],`${u.name} cambia el sílex y ajusta el mecanismo.`);}
else if(a.type==='ration'){
  const preview=supplyUsePreview(s,u,a.targetId===undefined?u:target,'rations');if(!preview.allowed)return fail(preview.reason);pay(preview.cost);
  u.rations--;clearEmptySupply(u);recoverFatigue(u,10,20);
  sayObserved(s,[u],`${u.name} come una ración y recupera fuerzas. Las heridas requieren vendas.`);
}
else if(a.type==='brace'){if(!fixedBayonetFor(u))return fail('Se necesita una bayoneta preparada para recibir la carga.');if(u.ap<16)return fail('Reserva al menos 16 PA para detener una carga.');u.braced=true;sayObserved(s,[u],`${u.name} mantiene la bayoneta fijada en guardia.`);}
else if(a.type==='weapon'){
 let next;try{next=planMainHandEquipment(u,a);}catch(error){return fail(error.message);}
 if(!pay(4))return fail('Cambiar de objeto requiere 4 PA.');next.ap=u.ap;replaceUnit(u,next);sayObserved(s,[u],`${u.name} prepara ${weaponFor(u).name}.`);
}
else if(a.type==='overwatch'){
  if(u.overwatch){u.overwatch=false;sayObserved(s,[u],`${u.name} deja de cubrir el frente.`);}
  else {if(!hasFirearm(u)||!u.loaded||u.jammed)return fail('Necesitas un arma cargada y cebada para cubrir el frente.');
    if(s.mode!=='exploration'&&u.ap<actionCosts(s,u).fire)return fail('Reserva PA suficientes para disparar.');
    u.overwatch=true;sayObserved(s,[u],`${u.name} reserva sus PA para fuego de reacción.`);}
}
else if(a.type==='mount'){if(!u.horse)return fail('Este soldado no tiene una montura asignada.');if(!u.mounted&&u.mount&&(u.mount.stamina<20||u.mount.condition<30))return fail('El caballo necesita descanso y cuidados antes de la monta.');const cost=actionCosts(s,u).mount;if(!pay(cost))return fail(`Montar o desmontar requiere ${cost} PA.`);u.mounted=!u.mounted;u.stance='standing';u.momentum=0;sayObserved(s,[u],`${u.name} ${u.mounted?'monta a caballo':'desmonta'}.`);}
else if(a.type==='heal'){
  const t=target||u;
  const preview=medicalUsePreview(s,u,t);if(!preview.allowed)return fail(preview.reason);pay(preview.cost);
  u.medkits--;practice(u,'medical',3);t.bleeding=0;t.bandaged=t.maxHp-t.hp;refreshCondition(t);
  sayObserved(s,[u,t],`${u.name} venda a ${t.name} y detiene la hemorragia. La salud se recupera con descanso y atención médica.`);
}
else if(a.type==='stance'){
  if(u.mounted)return fail('Debes desmontar antes de cambiar de postura.');
  if(!STANCES.includes(a.stance)||u.stance===a.stance)return fail('Postura no válida.');
  if(u.knockedDown&&a.stance!=='standing')return fail('El soldado derribado debe ponerse de pie.');
  const cost=stanceCost(u,a.stance);if(!pay(cost))return fail(`Cambiar de postura requiere ${cost} PA.`);
  u.stance=a.stance;u.movementMode=a.stance==='prone'?'prone':a.stance==='crouched'?'crouch':'walk';
  if(a.stance==='standing')u.knockedDown=false;u.momentum=0;
  sayObserved(s,[u],`${u.name} ${a.stance==='prone'?'se tiende cuerpo a tierra':a.stance==='crouched'?'se agacha':'se pone de pie'}.`);
}
else return fail('Orden desconocida.');if(lowersWeapon(a.type)&&a.type!=='movement')lowerWeapon(u);checkEnd(s);if(!['move','charge'].includes(a.type))reactionFire(s,u,observation);return true;}
function advanceWounds(s,seconds){
  s.bleedSeconds=(s.bleedSeconds??0)+seconds;
  const ticks=Math.floor(s.bleedSeconds/COMBAT_ROUND_SECONDS);s.bleedSeconds%=COMBAT_ROUND_SECONDS;
  if(!ticks)return;
  for(const u of s.units.filter(u=>u.hp>0)){
    if(u.bleeding){const loss=Math.min(u.hp,u.bleeding*ticks);u.hp-=loss;u.bandaged=Math.min(u.bandaged??0,u.maxHp-u.hp);if(u.side==='player'||teamCanSee(s,'player',u))sayObserved(s,[u],`${u.name} pierde ${loss} de salud por hemorragia.`);}
    refreshCondition(u);
  }
}
// Apply exploration time at the end of each completed movement step. This lets
// bleeding and changing light stop a route at the tile where they take effect.
// The scratch counter is removed before returning a public battle snapshot.
function advanceExplorationAction(s,seconds){
  advanceBattleClock(s,seconds);advanceWounds(s,seconds);advanceAmbientTime(s,seconds);
  s.actionTimeAppliedSeconds=(s.actionTimeAppliedSeconds??0)+seconds;
}
function advanceAmbientTime(s,seconds){
  if(s.mode!=='exploration'||s.status!=='active')return;
  advanceCivilianTime(s,seconds,()=>{
    if(detectContact(s))return false;
    for(const u of s.units.filter(u=>(u.side==='enemy'||u.militia)&&alive(u)&&!u.routed)){
      const patrolState={...s,turn:(s.civilianTurns??0)+1,mode:'combat'};
      const order=u.militia?searchOrder(patrolState,{...u,ap:100},{changeStance:false}):choosePatrolAction(patrolState,{...u,patrolTurn:undefined,ap:24});
      if(!order)continue;
      const step=getReachable(patrolState,{...u,ap:u.militia?100:24}).find(p=>p.x===order.x&&p.y===order.y)?.path[0];
      if(!step)continue;
      const cost=movementEnergy(u,tile(s,step.x,step.y));
      if(u.energy<=cost){recoverEnergy(u,10);continue;}
      lowerWeapon(u);u.facing=directionTo(u,step);Object.assign(u,step);exhaust(s,u,cost);
      if(detectContact(s))return false;
    }
    return true;
  });
  detectContact(s);
}
function beginUnitTurn(s,u){
  const budget=actionPointBudget(s,u.routed?{...u,routed:false}:u);u.maxAP=budget.base;u.carriedAP=budget.carryover;u.ap=budget.total;
  u.reactionSpent=0;u.shock=(u.shock??0)/2;
}
// Exit orders retain every participant. A receipt records the paid crossing;
// it does not transfer the soldier or their equipment to campaign stock.
function exitUnitReason(s,u,exit,{routing=false}={}){
  if(!u||u.side!=='player'&&!routing)return 'No puedes retirar a ese combatiente.';
  if(u.departure)return 'El soldado ya salió del sector.';
  if(u.hp<=0||u.unconscious||u.hp<CRITICAL_HEALTH)return 'El soldado no puede caminar.';
  if(u.surrendered||u.routed&&!routing)return 'El soldado no está bajo tus órdenes.';
  if(u.knockedDown)return 'El soldado debe ponerse de pie.';
  if(u.entangled)return 'El soldado debe liberarse de las boleadoras.';
  if(!boundaryMatches(s,u,exit.edge))return 'Debe alcanzar el borde de esta salida.';
  const ground=tile(s,u.x,u.y);
  if(!ground||ground.blocked||propBlocksAt(s,u.x,u.y))return 'El paso de salida está bloqueado.';
  if(s.mode!=='exploration'&&u.ap<stepCost(u,ground))return 'Faltan PA para cruzar el borde.';
  if(u.energy<=movementEnergy(u,ground))return 'Faltan fuerzas para cruzar el borde.';
  return null;
}
export function exitPreview(s,{unitIds,exitId}={}){
  const exit=s?.exits?.find(v=>v.id===exitId),ids=Array.isArray(unitIds)?unitIds.map(String):[];
  let reason=!s||s.status!=='active'||s.phase!=='player'||s.interrupt||s.enemyTurn||s.alliedTurn||s.reactionStack?.length?'La salida requiere el turno normal del jugador.':null;
  if(!reason&&!exit)reason='Selecciona una salida autorizada.';
  if(!reason&&(!ids.length||new Set(ids).size!==ids.length))reason='Selecciona combatientes distintos para salir.';
  const eligibleIds=[],blocked=[],costById={};
  for(const id of ids){const u=s?.units?.find(v=>v.id===id),why=reason??(u?.militia?'La milicia actúa por su cuenta.':exitUnitReason(s,u,exit));if(why)blocked.push({id,reason:why});else {eligibleIds.push(id);costById[id]=stepCost(u,tile(s,u.x,u.y));}}
  return {available:!reason&&!blocked.length&&ids.length>0,reason:reason??blocked[0]?.reason??null,edge:exit?.edge??null,destination:exit?.destination??null,eligibleIds,blocked,costById};
}
function crossBoundary(s,u,exit){
  const exploring=s.mode==='exploration',observation={...reactionObservation(s,u),crossing:true},ground=tile(s,u.x,u.y),cost=stepCost(u,ground);
  if(!exploring)u.ap-=cost;
  lowerWeapon(u);u.facing={N:0,E:2,S:4,W:6}[exit.edge];u.momentum=0;u.overwatch=false;u.braced=false;
  delete u.lastTargetId;delete u.lastShotPosition;
  exhaust(s,u,movementEnergy(u,ground));
  if(exploring){const seconds=Math.ceil((u.movementMode==='run'?1:u.movementMode==='prone'?5:3)*stealthAPMultiplier(u));s.actionDurationSeconds=(s.actionDurationSeconds??0)+seconds;advanceExplorationAction(s,seconds);}
  else if(!s.roundTimeCharged){advanceBattleClock(s,COMBAT_ROUND_SECONDS);s.roundTimeCharged=true;}
  emitNoise(s,u,'move');rememberContacts(s);
  if(!alive(u)||exploring&&detectContact(s)){sayObserved(s,[u],`${u.name} detiene la salida en el borde del sector.`);return false;}
  if(s.mode==='combat'&&reactionFire(s,u,observation)){sayObserved(s,[u],`${u.name} detiene la salida ante una reacción enemiga.`);return false;}
  const departureObserved=journalVisible(s,u);
  u.departure={exitId:exit.id,edge:exit.edge,destination:exit.destination,x:u.x,y:u.y,elapsedSeconds:s.elapsedSeconds??0,mountId:u.mounted&&u.mount?.id?u.mount.id:null};
  if(u.routed)u.fled=true;
  delete u.lastKnownEnemy;delete u.lastHeardNoise;
  if(departureObserved)say(s,`${u.name} sale del sector por el borde ${{N:'norte',E:'este',S:'sur',W:'oeste'}[exit.edge]}.`);
  return true;
}
function applyExit(s,a){
  const preview=exitPreview(s,a);
  if(!preview.available){s.lastError=preview.reason;say(s,s.lastError);return false;}
  const exit=s.exits.find(v=>v.id===a.exitId);s.actionDurationSeconds=0;
  for(const id of preview.eligibleIds){
    const u=s.units.find(v=>v.id===id),reason=exitUnitReason(s,u,exit);
    if(reason){sayObserved(s,[u],`${u.name}: ${reason}`);break;}
    if(!crossBoundary(s,u,exit))break;
    checkEnd(s);if(s.status!=='active')break;
  }
  return true;
}
function routedOrder(s,u,action){
  // Internal automation uses the ordinary reducer. Restore the flag before a
  // public snapshot, including an interruption. Apply exploration time once.
  const exploring=s.mode==='exploration';
  delete s.actionDurationSeconds;delete s.actionTimeAppliedSeconds;u.routed=false;
  const accepted=apply(s,{...action,unitId:u.id},u.side==='enemy');
  if(accepted!==false&&exploring){const seconds=Math.max(0,(s.actionDurationSeconds??6)-(s.actionTimeAppliedSeconds??0));if(seconds)advanceExplorationAction(s,seconds);checkEnd(s);detectContact(s);}
  u.routed=true;if(accepted===false)s.lastError=null;
  delete s.actionDurationSeconds;delete s.actionTimeAppliedSeconds;
  return accepted;
}
function processRout(s,u){
  if(!u.routed||!fieldCapable(u)||u.unconscious)return;
  const exploring=s.mode==='exploration',stopped=()=>s.status!=='active'||s.phase==='interrupt'||s.reactionStack?.length||exploring&&s.mode!=='exploration';
  if(u.knockedDown){if(!routedOrder(s,u,{type:'stance',stance:'standing'})||stopped())return;}
  if(u.entangled){if(!routedOrder(s,u,{type:'free'})||stopped())return;}
  if(stopped())return;
  const exits=u.side==='player'?s.exits??[]:s.enemyExits??['N','E','S','W'].map(edge=>({id:`enemy:${edge}`,edge,destination:'__offmap_enemy__'}));
  const proxy={...u,routed:false},routes=getReachable({...s,mode:'exploration'},proxy).flatMap(point=>exits.filter(exit=>boundaryMatches(s,point,exit.edge)).map(exit=>({...point,exit})));
  routes.sort((a,b)=>a.cost-b.cost||a.exit.id.localeCompare(b.exit.id)||a.y-b.y||a.x-b.x);
  if(!routes.length){lowerWeapon(u);u.surrendered=true;u.ap=0;sayObserved(s,[u],`${u.name} se rinde: no encuentra un paso de salida.`);checkEnd(s);return;}
  const route=routes[0];
  if(route.path.length){
    const reachable=getReachable(s,proxy),step=[...route.path].reverse().map(p=>reachable.find(v=>v.x===p.x&&v.y===p.y)).find(Boolean);
    if(!step)return;
    const before={x:u.x,y:u.y};if(!routedOrder(s,u,{type:'move',x:step.x,y:step.y}))return;
    const actual=step.path.findIndex(p=>p.x===u.x&&p.y===u.y);if(actual>=0)u.fleePath=[...(u.fleePath??[]),...step.path.slice(0,actual+1)];
    if(u.x===before.x&&u.y===before.y)return;
  }
  if(stopped()||exitUnitReason(s,u,route.exit,{routing:true}))return;
  u.routed=false;const departed=crossBoundary(s,u,route.exit);u.routed=true;if(departed)u.fled=true;checkEnd(s);
}

export function actBattle(state,action){
  const ids=[action.unitId,...(Array.isArray(action.unitIds)?action.unitIds:[])].filter(id=>id!==undefined).map(String);
  if(state.units.some(u=>u.militia&&ids.includes(u.id))||state.alliedTurn&&state.phase!=='interrupt'){
    const rejected=clone(state);rejected.lastError='La milicia actúa por su cuenta. Da órdenes a los combatientes de tu escuadra.';say(rejected,rejected.lastError);return rejected;
  }
  const next=actBattleInput(state,action);
  return next.lastError?next:cleanActionTime(settleAutonomous(next));
}
function actBattleInput(state,action){
  if(action.type==='approachLoot'){
    const unit=state.units.find(u=>u.id===String(action.unitId)),plan=lootSearchPreview(state,unit,action);
    if(unit?.side!=='player'||!plan.valid){const rejected=clone(state);rejected.lastError=plan.reason??'No puedes dar órdenes a ese soldado.';say(rejected,rejected.lastError);return rejected;}
    if(!plan.path.length){const next=clone(state);next.lastError=null;return next;}
    return actBattleOrder(state,{type:'move',unitId:action.unitId,...plan.destination},{...plan.destination,cost:plan.movePa,path:plan.path});
  }
  if(action.type==='useItem'||action.type==='loot'){
    const unit=state.units.find(u=>u.id===String(action.unitId));
    const plan=unit?.side==='player'?contextualUsePlan(state,unit,action):null;
    if(plan&&!plan.valid){const rejected=clone(state);rejected.lastError=plan.reason;say(rejected,plan.reason);return rejected;}
    if(plan?.path.length)return approachAndUse(state,action,plan);
  }
  return actBattleOrder(state,action);
}
function contextualUsePlan(state,unit,action){
  if(action.type==='loot')return lootApproachPreview(state,unit,action);
  if(action.environment)return environmentUsePreview(state,unit,action.environment,action.environment.verb);
  return action.targetId!==undefined?itemUsePreview(state,unit,state.units.find(u=>u.id===String(action.targetId))):null;
}
export function approachCompleted(state,moved,unitId,plan){
  const unit=moved.units.find(u=>u.id===String(unitId));
  return Boolean(unit&&alive(unit)&&!moved.lastError&&moved.mode===state.mode&&moved.phase===state.phase&&unit.x===plan.destination?.x&&unit.y===plan.destination?.y&&
    !moved.units.some(other=>other.side!==unit.side&&other.reactionTurn!==state.units.find(old=>old.id===other.id)?.reactionTurn));
}
function approachAndUse(state,action,plan){
  const moved=actBattleOrder(state,{type:'move',unitId:action.unitId,...plan.destination},{...plan.destination,cost:plan.movePa,path:plan.path});
  if(moved.lastError)return moved;
  const unit=moved.units.find(u=>u.id===String(action.unitId));
  const pending=plan.type==='environment'?{...action,environment:{...action.environment,verb:plan.action.verb}}:action;
  const current=contextualUsePlan(moved,unit,pending);
  if(!approachCompleted(state,moved,action.unitId,plan)||!current?.valid||current.path.length){
    say(moved,'El desplazamiento terminó antes de usar el objeto. Revisá la situación y seleccioná el objetivo de nuevo.');return moved;
  }
  return actBattleOrder(moved,plan.type==='environment'?plan.action:{...action,type:plan.type});
}
function actBattleOrder(state,action,movementPath=null){
  if(action.type==='rest')return endTurn(state);
  const s=clone(state);s.lastError=null;
  if(action.type==='ambient'){
    if(s.mode!=='exploration'||s.phase!=='player'||s.status!=='active')return s;
    advanceExplorationAction(s,6);checkEnd(s);detectContact(s);rememberContacts(s);revealRooms(s);
    return cleanActionTime(resolveFirstContact(s));
  }
  if(action.type==='explore'){
    if(s.status==='victory'||s.status==='active'&&(s.sectorCleared||canEndCombat(s))){
      return resumeExploration(s);
    }
    s.lastError='Deben pasar dos turnos completos sin contacto visual con el enemigo.';say(s,s.lastError);return s;
  }
  const oldMode=s.mode;delete s.actionDurationSeconds;delete s.actionTimeAppliedSeconds;
  const success=action.type==='exit'?applyExit(s,action):apply(s,action,false,movementPath);
  if(success===false||s.lastError){const rejected=clone(state);rejected.lastError=s.lastError;say(rejected,s.lastError);return rejected;}
  if(action.type==='weaponMode')return cleanActionTime(s);
  if(oldMode==='exploration'){
    const seconds=Math.max(0,(s.actionDurationSeconds??6)-(s.actionTimeAppliedSeconds??0));if(seconds){advanceBattleClock(s,seconds);advanceWounds(s,seconds);advanceAmbientTime(s,seconds);}
  }else if(!s.roundTimeCharged){advanceBattleClock(s,COMBAT_ROUND_SECONDS);s.roundTimeCharged=true;}
  delete s.actionDurationSeconds;delete s.actionTimeAppliedSeconds;checkEnd(s);detectContact(s);rememberContacts(s);revealRooms(s);if(s.phase==='enemy'&&s.reactionStack?.length)runEnemyReactions(s);return cleanActionTime(resolveFirstContact(s));
}
function finishEnemyRound(s){
  delete s.enemyTurn;delete s.interrupt;delete s.reactionStack;s.enemyTurns++;
  if(s.roundFirstSide==='enemy'){s.enemyFirstAwaitingPlayer=true;s.phase='player';s.lastError=null;rememberContacts(s);revealRooms(s);return s;}
  return beginAlliedTurn(s);
}
function beginAlliedTurn(s,startEnemyAfter=false){
  s.phase='player';
  s.alliedTurn={unitIds:s.units.filter(u=>u.side==='player'&&u.militia&&fieldCapable(u)).map(u=>u.id),unitIndex:0,actionsTaken:0,startEnemyAfter};
  if(s.alliedTurn.unitIds.length)say(s,`Turno ${s.turn}: actúa la guarnición local.`);
  return runAlliedTurn(s);
}
// Militia use their existing AP, equipment and awareness. This queue survives
// enemy reactions and hired-soldier interrupts without starting the turn again.
function runAlliedTurn(s){
  const queue=s.alliedTurn;
  while(queue.unitIndex<queue.unitIds.length&&s.status==='active'){
    const u=s.units.find(v=>v.id===queue.unitIds[queue.unitIndex]);
    if(u?.routed&&fieldCapable(u)&&!queue.actionsTaken){queue.actionsTaken=12;processRout(s,u);if(s.status!=='active'||s.phase!=='player')return s;}
    while(u&&alive(u)&&u.ap>=3&&queue.actionsTaken<12&&s.status==='active'){
      rememberContacts(s);const order=automaticOrder(s,u);if(!order)break;
      queue.actionsTaken++;
      const accepted=apply(s,order,false);if(order.patrol)u.patrolTurn=s.turn;
      if(accepted===false){s.lastError=null;break;}
      if(s.status!=='active'||s.phase!=='player')return s;
    }
    queue.unitIndex++;queue.actionsTaken=0;
  }
  if(s.status!=='active')return s;
  delete s.alliedTurn;finishCombatRound(s);
  return queue.startEnemyAfter&&s.status==='active'&&s.mode==='combat'?endTurnState(s):s;
}
function settleAutonomous(s){
  while(s.status==='active'){
    if(s.phase==='enemy'&&s.reactionStack?.length){runEnemyReactions(s);continue;}
    if(s.phase==='interrupt'){
      const window=s.interrupt;
      const militia=window.unitIds.map(id=>s.units.find(u=>u.id===id)).find(u=>u?.militia&&alive(u)&&u.ap>=3&&(window.militiaActions?.[u.id]??0)<12);
      if(militia){
        window.militiaActions??={};rememberContacts(s);const order=chooseEnemyAction(s,militia);
        window.militiaActions[militia.id]=order?(window.militiaActions[militia.id]??0)+1:12;
        if(order&&apply(s,order,false)===false){window.militiaActions[militia.id]=12;s.lastError=null;}
        continue;
      }
      if(window.unitIds.some(id=>{const u=s.units.find(v=>v.id===id);return u&&!u.militia;}))break;
      const reaction=window.returnTo==='reaction';delete s.interrupt;s.phase='enemy';
      if(reaction)runEnemyReactions(s);else runEnemyPhase(s);
      continue;
    }
    if(s.phase==='player'&&s.alliedTurn){s=runAlliedTurn(s);continue;}
    break;
  }
  return s;
}
function finishCombatRound(s){
  if(s.npcs?.length)say(s,`Turno ${s.turn}: actúan los civiles.`);
  runCivilianPhase(s);
  s.smoke=s.smoke.map(v=>({...v,radius:Math.min((v.radius||1)+.5,3),turns:v.turns-1})).filter(v=>v.turns>0);
  advanceWounds(s,COMBAT_ROUND_SECONDS);
  for(const u of s.units.filter(u=>onField(u)&&!u.surrendered)){
    recoverEnergy(u,10);refreshCondition(u);
    if(u.side==='player')beginUnitTurn(s,u);
    u.momentum=0;u.lastDirection=null;
  }
  const contact=s.contactThisRound||hasVisualContact(s);
  s.quietCombatTurns=contact?0:Math.min(2,(s.quietCombatTurns??0)+1);s.contactThisRound=false;
  s.turn++;s.phase='player';s.roundTimeCharged=false;checkEnd(s);rememberContacts(s);revealRooms(s);
  if(canEndCombat(s))resumeExploration(s);
  else if(s.status==='active')say(s,`Turno ${s.turn}: ¡órdenes, comandante!`);
  s.lastError=null;return s;
}
function runEnemyPhase(s){
  const queue=s.enemyTurn;
  while(queue.unitIndex<queue.unitIds.length&&s.status==='active'){
    const u=s.units.find(v=>v.id===queue.unitIds[queue.unitIndex]);
    if(!u||!alive(u)&&!fieldCapable(u)){queue.unitIndex++;queue.actionsTaken=0;queue.started=false;continue;}
    if(!queue.started){
      // Initial AP has already been issued at contact and may have paid a reaction.
      if(s.enemyTurns>0)beginUnitTurn(s,u);else {u.reactionSpent=0;u.shock=(u.shock??0)/2;}
      queue.started=true;
    }
    if(u.routed){processRout(s,u);if(s.status!=='active'||s.phase==='interrupt')return s;if(u.departure)queue.unitIds.splice(queue.unitIndex,1);else queue.unitIndex++;queue.actionsTaken=0;queue.started=false;continue;}
    while(queue.actionsTaken<12&&alive(u)&&u.ap>=3&&s.status==='active'){
      rememberContacts(s);const order=chooseEnemyAction(s,u);if(!order)break;
      const accepted=apply(s,order,true);if(order.patrol)u.patrolTurn=s.turn;queue.actionsTaken++;
      if(accepted===false)break;
      if(s.status!=='active'){s.lastError=null;revealRooms(s);return s;}
      if(s.phase==='interrupt'){s.lastError=null;revealRooms(s);return s;}
    }
    if(alive(u)){
      // Readiness to react is independent of a loaded gun: looking, loading,
      // moving and melee can all use the remaining budget.
      u.overwatch=u.ap>=3;
      if(!u.mounted&&u.ap>=16&&fixedBayonetFor(u))u.braced=true;
    }
    queue.unitIndex++;queue.actionsTaken=0;queue.started=false;
  }
  return finishEnemyRound(s);
}
// Enemy reactions are resumable mini-turns. They consume the current AP budget;
// they never advance the clock, bleed wounds, refresh AP, or reset a reaction.
function runEnemyReactions(s){
  while(s.reactionStack?.length&&s.status==='active'){
    const frame=s.reactionStack.at(-1);
    while(frame.unitIndex<frame.unitIds.length&&s.status==='active'){
      const unit=s.units.find(u=>u.id===frame.unitIds[frame.unitIndex]);
      while(unit&&alive(unit)&&unit.ap>=3&&frame.actionsTaken<12&&s.status==='active'){
        rememberContacts(s);const order=chooseEnemyAction(s,unit);if(!order)break;
        const accepted=apply(s,order,true);frame.actionsTaken++;
        if(accepted===false){s.lastError=null;break;}
        if(s.phase==='interrupt'){revealRooms(s);s.lastError=null;return s;}
      }
      frame.unitIndex++;frame.actionsTaken=0;
    }
    if(s.status!=='active')return s;
    s.reactionStack.pop();s.phase=frame.resumePhase;
    if(frame.resumeInterrupt)s.interrupt=frame.resumeInterrupt;else delete s.interrupt;
    if(!s.reactionStack.length)delete s.reactionStack;
    // A parent player window must be returned to the player before its older
    // enemy reaction continues, including after save/load at any nesting depth.
    if(s.phase==='interrupt')break;
  }
  checkEnd(s);rememberContacts(s);revealRooms(s);s.lastError=null;return s;
}
function cleanActionTime(s){delete s.actionDurationSeconds;delete s.actionTimeAppliedSeconds;return s;}
export function endTurn(state){return cleanActionTime(settleAutonomous(endTurnState(state)));}
function endTurnState(state){
  const s=clone(state);s.lastError=null;if(s.status!=='active')return s;
  if(s.phase==='interrupt'){
    const reaction=s.interrupt?.returnTo==='reaction';
    if(reaction?!s.reactionStack?.length:!s.enemyTurn){s.lastError='Falta el turno enemigo que debe continuar.';return s;}
    delete s.interrupt;s.phase='enemy';say(s,'Continúa el turno enemigo.');return reaction?runEnemyReactions(s):runEnemyPhase(s);
  }
  if(s.mode==='exploration'){
    const startedAt=s.elapsedSeconds??0;
    for(const u of s.units.filter(u=>u.routed&&fieldCapable(u))){processRout(s,u);if(s.status!=='active'||s.mode!=='exploration')return resolveFirstContact(s);}
    if((s.elapsedSeconds??0)>startedAt){s.turn++;checkEnd(s);rememberContacts(s);revealRooms(s);return s;}
    for(const u of s.units.filter(u=>onField(u)&&!u.surrendered)){recoverEnergy(u,15);refreshCondition(u);}
    for(let seconds=0;seconds<REST_SECONDS;seconds+=6){
      advanceBattleClock(s,6,{resting:true});advanceWounds(s,6);advanceAmbientTime(s,6);checkEnd(s);
      if(s.status!=='active'||s.mode!=='exploration'){rememberContacts(s);revealRooms(s);return resolveFirstContact(s);}
    }
    s.turn++;checkEnd(s);detectContact(s);rememberContacts(s);revealRooms(s);return resolveFirstContact(s);
  }
  if(s.phase==='enemy'&&s.reactionStack?.length)return runEnemyReactions(s);
  if(s.phase==='enemy'&&s.enemyTurn)return runEnemyPhase(s);
  if(s.alliedTurn)return runAlliedTurn(s);
  if(s.enemyFirstAwaitingPlayer){delete s.enemyFirstAwaitingPlayer;return beginAlliedTurn(s,true);}
  if(!s.roundTimeCharged){advanceBattleClock(s,COMBAT_ROUND_SECONDS);s.roundTimeCharged=true;}
  for(const u of s.units.filter(u=>u.side==='player'&&!u.militia&&u.routed)){processRout(s,u);if(s.status!=='active'||s.phase==='interrupt')return s;if(s.reactionStack?.length)return runEnemyReactions(s);}
  if(!s.roundTimeCharged)advanceBattleClock(s,COMBAT_ROUND_SECONDS);
  s.roundTimeCharged=true;return startEnemyTurn(s);
}
function startEnemyTurn(s){
  s.phase='enemy';rememberContacts(s);
  s.enemyTurn={unitIds:s.units.filter(u=>u.side==='enemy'&&fieldCapable(u)).map(u=>u.id),unitIndex:0,actionsTaken:0,started:false};
  return runEnemyPhase(s);
}
