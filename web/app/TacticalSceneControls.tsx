'use client';
import {artilleryProfile} from '../../game/artillery-definitions.js';
import {createSceneTerrainCache} from '../../game/scene-terrain.js';
import {pointInViewport} from '../../game/tactical-viewport.js';
import {aimedBodyPart,targetHitFrame} from '../../game/aim-cursor.js';
import {canChooseShotLocation} from '../../game/targeted-combat.js';
import {tacticalGridLabel} from '../../game/tactical-grid.js';
import {pointerItemIntent} from '../../game/hotkeys.js';
import {NPC_ACTIVITY_LABELS} from '../../game/npc-ai.js';
import {propCells} from '../../game/props.js';
import {spriteCondition} from '../../game/sprite-state.js';
import {isInteriorVisible} from '../../game/tactical-visibility.js';
import {actorInteriorReadable} from '../../game/scene-readability.js';
import {canSee,tileIllumination,shotChance,hasFirearm,contextualAttack} from '../../game/tactical.js';
import {heardNoiseModel,groundLootPiles,civilianMedicalInputAction,aimedCursorMode,grenadeTargetingMode,chancePercent} from '../../game/ja2-hud.js';
import {cloneElement,useMemo,useRef,useId,type CSSProperties,type ReactElement,type ReactNode} from 'react';
import './tactical-readability.css';
import {sameCell,spaceKey,tacticalLevel,surfaceHeight} from '../../game/tactical-space.js';
import {projectSurface,surfaceDrawDepth,surfaceRenderOffset} from '../lib/tactical-elevation';
type Props={groundOverlay?:ReactNode;terrainVisible?:boolean;interactive?:boolean;viewport?:any;cursorLevel?:number;state:any;selected:any;unit:any;players:any[];units:any[];positions:any;poses:any;directions:any;hover:any;mode:string;aim:number;hitLocation?:string;reachable:any[];routesPending?:boolean;showSight:boolean;sight:Set<string>;revealed:Set<string>;project:(x:number,y:number)=>{x:number;y:number};onTile:(t:any)=>void;onHover:(t:any)=>void;onTalk:(n:any)=>void;onCannon:(id:string)=>void;cannonId:string};
const ignoreInteraction=()=>{};
const diamond=(x:number,y:number)=>`${x},${y-14} ${x+26},${y} ${x},${y+14} ${x-26},${y}`;
export default function TacticalSceneControls({groundOverlay,terrainVisible=true,interactive:sceneInteractive=true,viewport,cursorLevel=0,state:s,selected,unit:u,players,units,positions,poses,directions,hover,mode,aim,hitLocation='torso',reachable,routesPending=false,showSight,sight,revealed,project,onTile:tileHandler,onHover:hoverHandler,onTalk:talkHandler,onCannon:cannonHandler,cannonId}:Props){
 const onTile=sceneInteractive?tileHandler:ignoreInteraction,onHover=sceneInteractive?hoverHandler:ignoreInteraction,onTalk=sceneInteractive?talkHandler:ignoreInteraction,onCannon=sceneInteractive?cannonHandler:ignoreInteraction;
 const terrainCache=useRef<ReturnType<typeof createSceneTerrainCache>|null>(null);
 if(!terrainCache.current)terrainCache.current=createSceneTerrainCache();
 const terrain=useMemo(()=>terrainCache.current!(s),[s]);
 const handlers=useRef({onTile,onHover});handlers.current={onTile,onHover};
 const position=(actor:any,npc=false)=>positions[`${npc?'npc':'unit'}:${actor.id}`]??positions[actor.id];
 const upperPointVisible=(point:any)=>!tacticalLevel(point)||isInteriorVisible(s,point,revealed)&&players.some(player=>canSee(s,player,point));
 const visibleTiles=useMemo(()=>terrain.tiles.filter((t:any)=>pointInViewport(viewport,projectSurface(terrain,project,t),110)),[terrain,viewport,project]);
 const upperTiles=useMemo(()=>(s.upperSurfaces??[]).filter((t:any)=>tacticalLevel(t)===cursorLevel&&pointInViewport(viewport,projectSurface(s,project,t),110)&&upperPointVisible(t)),[s,players,revealed,viewport,project,cursorLevel]);
 const sightAdmittedUnits=useMemo(()=>units.filter(v=>v.side==='player'||players.some(p=>canSee(s,p,v))),[s,units,players]);
 const reachableSet=useMemo(()=>new Set(reachable.map(spaceKey)),[reachable]);
 const objects:{key:string;depth:number;node:ReactNode}[]=[];
 const add=(key:string,x:number,y:number,node:ReactNode,bias=0,level=0)=>objects.push({key,depth:surfaceDrawDepth(s,{x,y,tacticalLevel:level},bias),node});
 const areaThrow=grenadeTargetingMode(u,mode),pointThrow=areaThrow||mode==='throwKnife',grenadeHeld=grenadeTargetingMode(u,'useItem');
 const heard=heardNoiseModel(s,u),heardPoint=heard?projectSurface(s,project,heard):null;
 const drawPerson=(v:any,npc=false)=>{
  const moving=position(v,npc)??{...v,direction:v.side==='enemy'?7:3,frame:0,moving:false};const at={...v,...moving},p=projectSurface(s,project,at),interactive=sceneInteractive&&tacticalLevel(v)===cursorLevel,hovered=hover&&(hover.id?hover.id===v.id:sameCell(hover,v));
  const posture=spriteCondition(v),collapsed=posture==='dead'||posture==='unconscious';
  const mounted=v.mounted&&!collapsed;
  const direction=collapsed||moving.moving?moving.direction:Number.isInteger(v.facing)?(v.facing+1)%8:poses[v.id]&&poses[v.id]!=='idle'?(directions[v.id]??moving.direction):moving.direction;
  const selectedUnit=v.id===selected&&!(!npc&&v.side==='player'&&moving.moving),top=p.y-(collapsed||posture==='prone'?24:mounted?72:49);
  const frame=targetHitFrame(v,p);
  const bodyAim=!npc&&!areaThrow&&canChooseShotLocation(v);
  const medicalInteraction=npc&&Boolean(civilianMedicalInputAction(s,u,v,mode));
  const pickupInteraction=npc&&!medicalInteraction&&(mode==='loot'||(['move','useItem'].includes(mode)&&!grenadeHeld&&!(u?.activeSlot==='supply'&&u.activeSupply==='torches')&&collapsed));
  const controlPickup=(event:any)=>npc&&!medicalInteraction&&!grenadeHeld&&['move','useItem'].includes(mode)&&pointerItemIntent(event)==='steal'&&(collapsed||lootPiles.some(pile=>sameCell(pile,v)));
  const pickupPoint=()=>({x:v.x,y:v.y,tacticalLevel:tacticalLevel(v),anonymous:true,loot:true,aimLocation:'torso'});
  const firePoint=npc&&mode==='fire',pointInteraction=pointThrow||firePoint||pickupInteraction;
  const aimPoint=(location='torso')=>npc&&pointInteraction?{x:v.x,y:v.y,tacticalLevel:tacticalLevel(v),anonymous:true,...(pickupInteraction?{loot:true}:{}),aimLocation:'torso'}:{...v,...(medicalInteraction?{targetKind:'npc'}:{}),aimLocation:location};
  const pointerTarget=(event:any)=>{if(controlPickup(event))return pickupPoint();const bounds=event.currentTarget.getBoundingClientRect();return aimPoint(mode==='inventory'||areaThrow||npc?'torso':aimedBodyPart(v,bounds.height?(event.clientY-bounds.top)/bounds.height:.5));};
  return <g data-unit-id={v.id} data-npc-activity={npc&&!collapsed?v.ai?.activity:undefined} data-moving={!collapsed&&moving.moving} data-direction={direction} data-posture={posture} data-tactical-level={tacticalLevel(v)||undefined}>
   <rect data-person-hit-target="true" {...frame} fill="transparent" pointerEvents={interactive?"all":"none"} role={sceneInteractive?"button":undefined} tabIndex={interactive?0:-1} aria-label={pickupInteraction?`Recoger equipo en la casilla de ${v.name}`:medicalInteraction?`Vendar a ${v.name}`:mode==='inventory'?`Colocar objeto: ${v.name}`:areaThrow?`Lanzar granada a la casilla de ${v.name}`:firePoint?`Disparar a la casilla de ${v.name}`:npc&&!pointInteraction?`${u?.activeSlot==='item'&&!grenadeHeld&&['move','useItem'].includes(mode)?'Entregar objeto a':'Hablar con'} ${v.name} · ${v.hp<=0?'muerto':v.unconscious?'inconsciente':Math.ceil(v.hp)+' salud'}${v.bleeding?', sangra':''}${!collapsed&&v.ai?.activity?", "+(NPC_ACTIVITY_LABELS as any)[v.ai.activity]:""}`:npc?`Lanzar a la casilla de ${v.name}`:`${v.name} · ${v.hp<=0?'muerto':v.unconscious?'inconsciente':Math.ceil(v.hp)+' salud'}`} onMouseEnter={event=>onHover(pointerTarget(event))} onMouseMove={event=>onHover(pointerTarget(event))} onMouseLeave={()=>onHover(null)} onFocus={()=>onHover(aimPoint(bodyAim?hitLocation:'torso'))} onBlur={()=>onHover(null)} onClick={event=>npc&&!pointInteraction&&!medicalInteraction&&!controlPickup(event)?onTalk(v):onTile(pointerTarget(event))} onKeyDown={e=>{if(aimedCursorMode(mode)&&['ArrowUp','ArrowDown'].includes(e.key)&&bodyAim){e.preventDefault();const parts=['head','torso','legs'],index=Math.max(0,parts.indexOf(hitLocation));onHover({...v,aimLocation:parts[Math.max(0,Math.min(2,index+(e.key==='ArrowUp'?-1:1)))]});return;}if(e.key==='Enter'||e.key===' '){e.preventDefault();npc&&!pointInteraction&&!medicalInteraction&&!controlPickup(e)?onTalk(v):onTile(controlPickup(e)?pickupPoint():aimPoint(bodyAim?hitLocation:'torso'));}}}/>
   {!npc&&v.side==='enemy'&&v.hp>0&&!v.surrendered&&<g aria-label="Enemigo" pointerEvents="none"><path d={`M${p.x-20},${top-4}l4,4l-4,4l-4,-4z`} fill="#bf644b" stroke="#fff0d0" strokeWidth="1.2"/></g>}
   {selectedUnit&&<ellipse cx={p.x} cy={p.y} rx="15" ry="6" fill="none" stroke="#dacb86" strokeWidth="1" pointerEvents="none"/>}
   {v.hp>0&&(selectedUnit||hovered)&&<><rect x={p.x-14} y={top} width="28" height="2" fill="#191d14"/><rect x={p.x-14} y={top} width={28*v.hp/v.maxHp} height="2" fill={v.side==='player'?'#81a866':'#bf644b'}/></>}
   {(selectedUnit||npc&&hovered)&&<text x={p.x} y={top-4} textAnchor="middle" fill="#ede6c3" fontSize="8" stroke="#11180f" strokeWidth="2" paintOrder="stroke">{v.nickname||v.name}{npc&&!collapsed&&v.ai?.activity?` · ${(NPC_ACTIVITY_LABELS as any)[v.ai.activity]}`:""}</text>}
   {mode!=='inventory'&&hovered&&v.side==='enemy'&&v.hp>0&&!v.surrendered&&u&&hasFirearm(u)&&contextualAttack(s,u,v,{type:mode,aim}).type==='fire'&&<text x={p.x} y={top-5} textAnchor="middle" fill="#f2d5a0" fontSize="10" stroke="#11180f" strokeWidth="2" paintOrder="stroke">{chancePercent(shotChance(s,u,v,aim,hitLocation))}</text>}
  </g>;
 };
 const visiblePeople=useMemo(()=>sightAdmittedUnits.filter(v=>!v.fled&&!v.departure&&actorInteriorReadable(s,v,position(v),revealed)),[s,sightAdmittedUnits,revealed,positions]);
 const visibleCivilians=useMemo(()=>(s.npcs??[]).filter((npc:any)=>!npc.departure&&!npc.fled&&isInteriorVisible(s,npc,revealed)&&players.some(p=>canSee(s,p,npc))),[s,players,revealed]);
 const lootPiles=useMemo(()=>groundLootPiles(s,players).filter((pile:any)=>isInteriorVisible(s,pile,revealed)),[s,players,revealed]);
 for(const v of visiblePeople){const at=position(v)??v;objects.push({key:`unit-${v.id}`,depth:surfaceDrawDepth(s,{...v,...at},.05),node:drawPerson(v)});}
 for(const npc of visibleCivilians){const at=position(npc,true)??npc;objects.push({key:`npc-${npc.id}`,depth:surfaceDrawDepth(s,{...npc,...at},.05),node:drawPerson({...npc,hp:npc.hp??100,maxHp:npc.maxHp??100,side:'player'},true)});}
 for(const a of s.artillery??[]){if(!isInteriorVisible(s,a,revealed)||!players.some(player=>canSee(s,player,a)))continue;const p=projectSurface(s,project,a);add(`gun-${a.id}`,a.x,a.y,<g role={sceneInteractive?"button":undefined} tabIndex={sceneInteractive?0:-1} aria-label={`Seleccionar ${artilleryProfile(s,a).name}`} onClick={()=>onCannon(a.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onCannon(a.id);}}}><rect x={p.x-38} y={p.y-58} width="76" height="76" fill="transparent"/>{a.id===cannonId&&<ellipse cx={p.x} cy={p.y} rx="24" ry="10" fill="none" stroke="#d8bf7e"/>}</g>,0,tacticalLevel(a));}
 for(const pile of lootPiles){
  const p=projectSurface(s,project,pile),point={x:pile.x,y:pile.y,...(pile.tacticalLevel===undefined?{}:{tacticalLevel:pile.tacticalLevel}),loot:true};
  add(`equipment-${spaceKey(pile)}`,pile.x,pile.y,<g data-ground-equipment="true" role={sceneInteractive?"button":undefined} pointerEvents={sceneInteractive&&tacticalLevel(pile)===cursorLevel?"auto":"none"} tabIndex={sceneInteractive&&tacticalLevel(pile)===cursorLevel?0:-1} aria-label={`Equipo en ${tacticalGridLabel(pile.x,pile.y)} · ${pile.count} objeto(s)`} onMouseEnter={()=>onHover(point)} onMouseLeave={()=>onHover(null)} onFocus={()=>onHover(point)} onBlur={()=>onHover(null)} onClick={()=>onTile(point)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onTile(point);}}}>
   <ellipse cx={p.x} cy={p.y} rx="17" ry="10" fill="transparent"/>
   {pile.count>1&&<text x={p.x+11} y={p.y+9} textAnchor="middle" fill="#fff2c7" stroke="#18261d" strokeWidth="2" paintOrder="stroke" fontSize="10" pointerEvents="none">{pile.count}</text>}
  </g>,.02,tacticalLevel(pile));
 }
 for(const t of terrainVisible?upperTiles:[]){
  const p=projectSurface(s,project,t),key=spaceKey(t),occupant=visiblePeople.find(v=>sameCell(v,t));
  objects.push({key:`surface-${key}`,depth:surfaceDrawDepth(s,t,.01),node:<g data-surface-level={tacticalLevel(t)} data-surface-id={t.id} role={sceneInteractive?"button":undefined} tabIndex={sceneInteractive?0:-1} aria-label={`${tacticalGridLabel(t.x,t.y)}, nivel superior${occupant?', '+occupant.name:t.blocked?', obstáculo':', accesible'}`} onClick={()=>onTile(t)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onTile(t);}}} onMouseEnter={()=>onHover(t)} onMouseLeave={()=>onHover(null)} onFocus={()=>onHover(t)} onBlur={()=>onHover(null)}>
   <polygon points={diamond(p.x,p.y)} fill="transparent" stroke="none" pointerEvents="all"/>
   {showSight&&<polygon points={diamond(p.x,p.y)} fill={sight.has(key)?'#69ac54':'#a94536'} opacity=".32" pointerEvents="none"/>}
   {hover&&sameCell(hover,t)&&<polygon points={diamond(p.x,p.y)} fill={mode==='move'&&routesPending?'#aaa99c':mode==='move'&&reachableSet.has(key)?'#d8dca1':'#bd6f4d'} fillOpacity=".16" stroke="#ddd6a7" strokeWidth="1" pointerEvents="none"/>}
  </g>});
 }
 const blockedGround=useMemo(()=>new Set<string>((terrain.props??[]).filter((p:any)=>tacticalLevel(p)===0&&p.blocksMovement!==false).flatMap(propCells).map((p:any)=>`${p.x},${p.y}`)),[terrain]);
 const groundNodes=useMemo(()=>new Map<string,ReactElement<{'aria-label':string}>>(terrain.tiles.map((t:any)=>{const p=projectSurface(terrain,project,t),key=`${t.x},${t.y}`;return [key,<g key={key} data-surface-level="0" role={sceneInteractive?"button":undefined} pointerEvents={sceneInteractive&&cursorLevel===0?"auto":"none"} tabIndex={sceneInteractive&&cursorLevel===0?0:-1} aria-label={`${tacticalGridLabel(t.x,t.y)}${(t.blocked||blockedGround.has(key))?', obstáculo':', accesible'}`} onClick={()=>handlers.current.onTile({...t,tacticalLevel:0})} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();handlers.current.onTile({...t,tacticalLevel:0});}}} onMouseEnter={()=>handlers.current.onHover({...t,tacticalLevel:0})} onMouseLeave={()=>handlers.current.onHover(null)} onFocus={()=>handlers.current.onHover({...t,tacticalLevel:0})} onBlur={()=>handlers.current.onHover(null)}><polygon points={diamond(p.x,p.y)} fill="transparent" stroke="none"/></g>] as const;})),[terrain,project,blockedGround,cursorLevel,sceneInteractive]);
 const occupiedGround=useMemo(()=>{
  const nodes=new Map();
  for(const occupant of visiblePeople){
   if(occupant.fled||tacticalLevel(occupant))continue;
   const key=`${occupant.x},${occupant.y}`,base=groundNodes.get(key);
   if(base&&!nodes.has(key))nodes.set(key,cloneElement(base,{'aria-label':`${tacticalGridLabel(occupant.x,occupant.y)}, ${occupant.name}`}));
  }
  return nodes;
 },[visiblePeople,groundNodes]);
 const ground=useMemo(()=><g>{visibleTiles.map((tile:any)=>{const key=`${tile.x},${tile.y}`;return occupiedGround.get(key)??groundNodes.get(key);})}{showSight&&visibleTiles.map((tile:any)=>{const p=projectSurface(terrain,project,tile);return <polygon key={`sight-${tile.x},${tile.y}`} points={diamond(p.x,p.y)} fill={sight.has(spaceKey(tile))?'#69ac54':'#a94536'} opacity=".32" pointerEvents="none"/>;})}</g>,[visibleTiles,groundNodes,occupiedGround,showSight,sight,terrain,project]);
 return <g data-sector-input="true">
  {terrainVisible&&ground}
  {terrainVisible&&hover&&!tacticalLevel(hover)&&pointInViewport(viewport,projectSurface(s,project,hover))&&<polygon points={diamond(projectSurface(s,project,hover).x,projectSurface(s,project,hover).y)} fill={mode==='move'&&routesPending?'#aaa99c':mode==='move'&&reachableSet.has(spaceKey(hover))?'#d8dca1':'#bd6f4d'} fillOpacity=".16" stroke="#ddd6a7" strokeWidth="1" pointerEvents="none"/>}
  {groundOverlay}
  {objects.sort((a,b)=>a.depth-b.depth||a.key.localeCompare(b.key)).map(o=><g key={o.key}>{o.node}</g>)}
  {heard&&heardPoint&&u&&(()=>{const origin=projectSurface(s,project,position(u)??u),angle=Math.atan2(heardPoint.y-origin.y,heardPoint.x-origin.x)*180/Math.PI;return <g key={`${u.id}:${u.lastHeardNoise?.turn}:${heard.x}:${heard.y}`} className="tactical-noise-direction" aria-label="Ruido en esa dirección" transform={`translate(${origin.x} ${origin.y-18}) rotate(${angle})`} pointerEvents="none"><path d="M22,-5l5,5-5,5m7,-4l4,4-4,4" fill="none" stroke="#e0c58a" strokeWidth="1.5" opacity=".65"/></g>;})()}
 </g>;
}
