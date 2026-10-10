'use client';
import {wallEdgeControlObjects} from './TacticalWallEdgeControls';
import {sitePath} from '../lib/site-path.js';
import {artilleryProfile} from '../../game/artillery-definitions.js';
import {createSceneTerrainCache} from '../../game/scene-terrain.js';
import {pointInViewport} from '../../game/tactical-viewport.js';
import {terrainMaterial} from '../../game/regional-terrain.js';
import {aimedBodyPart,targetHitFrame} from '../../game/aim-cursor.js';
import {canChooseShotLocation} from '../../game/targeted-combat.js';
import {tacticalGridLabel} from '../../game/tactical-grid.js';
import {pointerItemIntent} from '../../game/hotkeys.js';
import {NPC_ACTIVITY_LABELS} from '../../game/npc-ai.js';
import {propCells} from '../../game/props.js';
import SpriteFigure from './SpriteFigure';
import TacticalLight from './TacticalLight';
import StaticSceneLayer from './StaticSceneLayer';
import SceneryImage from './SceneryImage';
import {spriteCondition} from '../../game/sprite-state.js';
import {createBuildingRenderer} from './TacticalBuildings';
import {isInteriorVisible} from '../../game/tactical-visibility.js';
import {actorInteriorReadable,foregroundOccludesActor,corpseBloodShape} from '../../game/scene-readability.js';
import {roomDressings} from '../../game/room-dressing.js';
import {buildPropObjects} from './TacticalProps';
import {canSee,tileIllumination,shotChance,hasFirearm,contextualAttack} from '../../game/tactical.js';
import {heardNoiseModel,groundLootPiles,civilianMedicalInputAction,aimedCursorMode,grenadeTargetingMode,chancePercent} from '../../game/ja2-hud.js';
import {cloneElement,useMemo,useRef,useId,type CSSProperties,type ReactElement,type ReactNode} from 'react';
import './tactical-readability.css';
import {sameCell,spaceKey,tacticalLevel,surfaceHeight} from '../../game/tactical-space.js';
import {projectSurface,surfaceDrawDepth,surfaceRenderOffset} from '../lib/tactical-elevation';
type Props={groundOverlay?:ReactNode;terrainVisible?:boolean;interactive?:boolean;viewport?:any;cursorLevel?:number;state:any;selected:any;unit:any;players:any[];units:any[];positions:any;poses:any;directions:any;hover:any;mode:string;aim:number;hitLocation?:string;reachable:any[];routesPending?:boolean;showSight:boolean;sight:Set<string>;revealed:Set<string>;project:(x:number,y:number)=>{x:number;y:number};onTile:(t:any)=>void;onHover:(t:any)=>void;onTalk:(n:any)=>void;onCannon:(id:string)=>void;cannonId:string};
const ignoreInteraction=()=>{};
const materials=['dry-grass','dirt','cobble','green-grass','mud','floor','plaster','roof','wood'];
// Fixed offsets give each cloud an uneven silhouette without render-time randomness.
const smokePuffs=[[-18,2,17,12],[-7,-9,20,15],[10,-6,18,14],[22,4,15,11],[3,10,22,12],[-23,-10,12,10],[15,-20,13,11],[-4,-24,14,12]];
const diamond=(x:number,y:number)=>`${x},${y-14} ${x+26},${y} ${x},${y+14} ${x-26},${y}`;
const hash=(x:number,y:number)=>((x*374761393+y*668265263)>>>0)%1000;
export default function TacticalScene({groundOverlay,terrainVisible=true,interactive:sceneInteractive=true,viewport,cursorLevel=0,state:s,selected,unit:u,players,units,positions,poses,directions,hover,mode,aim,hitLocation='torso',reachable,routesPending=false,showSight,sight,revealed,project,onTile:tileHandler,onHover:hoverHandler,onTalk:talkHandler,onCannon:cannonHandler,cannonId}:Props){
 const onTile=sceneInteractive?tileHandler:ignoreInteraction,onHover=sceneInteractive?hoverHandler:ignoreInteraction,onTalk=sceneInteractive?talkHandler:ignoreInteraction,onCannon=sceneInteractive?cannonHandler:ignoreInteraction;
 const filterPrefix=useId().replace(/:/g,''),enemyGlow=`enemy-glow-${filterPrefix}`,knownGhost=`actor-ghost-${filterPrefix}`;
 const terrainCache=useRef<ReturnType<typeof createSceneTerrainCache>|null>(null);
 if(!terrainCache.current)terrainCache.current=createSceneTerrainCache();
 const terrain=useMemo(()=>terrainCache.current!(s),[s]);
 const roomKey=JSON.stringify([...revealed].sort());
 const stableRooms=useMemo(()=>new Set<string>(JSON.parse(roomKey)),[roomKey]);
 const handlers=useRef({onTile,onHover});handlers.current={onTile,onHover};
 // Roof geography remains drawn in full. Upper-floor controls and changing
 // contents require actual shared sight, including the room on that floor.
 const upperPointVisible=(point:any)=>!tacticalLevel(point)||isInteriorVisible(s,point,revealed)&&players.some(player=>canSee(s,player,point));
 const visibleTiles=useMemo(()=>terrain.tiles.filter((t:any)=>pointInViewport(viewport,projectSurface(terrain,project,t),110)),[terrain,viewport,project]);
 const upperTiles=useMemo(()=>(s.upperSurfaces??[]).filter((t:any)=>tacticalLevel(t)===cursorLevel&&pointInViewport(viewport,projectSurface(s,project,t),110)&&upperPointVisible(t)),[s,players,revealed,viewport,project,cursorLevel]);
 const heard=heardNoiseModel(s,u),heardPoint=heard?projectSurface(s,project,heard):null;
 const buildings=useMemo(()=>createBuildingRenderer({state:terrain,revealed:stableRooms,cursorLevel,project,light:(x,y,level=0)=>terrain.night?.27+tileIllumination(terrain,x,y,level)*.73:1}),[terrain,stableRooms,project,cursorLevel]);
 const sightAdmittedUnits=useMemo(()=>units.filter(v=>v.side==='player'||players.some(p=>canSee(s,p,v))),[s,units,players]);
 const softenedWoods=useMemo(()=>new Set<string>(terrain.tiles.filter((t:any)=>t.type==='forest'&&sightAdmittedUnits.some(v=>{if(v.hp<=0||v.departure)return false;const at=positions[v.id]??v;return Math.abs(at.x-t.x)<1.4&&Math.abs(at.y-t.y)<1.4;})).map((t:any)=>`${t.x},${t.y}`)),[terrain,sightAdmittedUnits,positions]);
 const sceneProps=useMemo(()=>[...(terrain.props??[]),...roomDressings(terrain)],[terrain]);
 const propVisibilityKey=JSON.stringify(sceneProps.filter(upperPointVisible).map((p:any)=>p.id));
 const scenery=useMemo(()=>{
 const s=terrain,visiblePropsIds=new Set(JSON.parse(propVisibilityKey));
 const objects:{depth:number;key:string;node:ReactNode}[]=[];
 const add=(key:string,x:number,y:number,node:ReactNode,bias=0)=>objects.push({key,depth:x+y+bias,node});

 const light=(x:number,y:number,level=0)=>s.night?.27+tileIllumination(s,x,y,level)*.73:1;

 for(const t of terrain.tiles){
  const p=projectSurface(s,project,t);
  if(t.blocked&&!['wall','door','window','water'].includes(t.type)){
   const width=38+hash(t.x,t.y)%21,height=width*.8;
   add(`rock-${t.x}-${t.y}`,t.x,t.y,<g pointerEvents="none"><ellipse cx={p.x+6} cy={p.y+2} rx={width*.48} ry="7" fill="#17201a" opacity=".23"/><image href={sitePath('/art/scenery-rocks-v1.webp')} x={p.x-width*.5} y={p.y-height+8} width={width} height={height} style={{filter:`brightness(${light(t.x,t.y)})`}}/></g>);
  }else if(t.type==='stone'&&t.material==='stone'&&!t.buildingId){
   add(`loose-rock-${t.x}-${t.y}`,t.x,t.y,<image href={sitePath('/art/scenery-rocks-v1.webp')} x={p.x-14} y={p.y-14} width="28" height="22" pointerEvents="none" style={{filter:`brightness(${light(t.x,t.y)})`}}/>);
  }
  // Low ground decoration can share a static depth cache.
  if(t.type==='scrub'||t.type==='grass'&&!t.buildingId&&hash(t.x,t.y)%11===0){
   add(`scrub-${t.x}-${t.y}`,t.x,t.y,<image href={sitePath('/art/scenery-shrub-v1.webp')} x={p.x-16} y={p.y-20} width="32" height="26" pointerEvents="none" opacity=".9" style={{filter:`brightness(${light(t.x,t.y)})`}}/>);
  }
  if(['grass','scrub','forest'].includes(t.type)&&!t.buildingId){
   const seed=hash(t.x,t.y),tufts=Array.from({length:1+seed%3},(_,index)=>{const x=p.x-16+(seed+index*13)%32,y=p.y-5+(seed+index*7)%10;return `M${x},${y}l-2,-5m2,5l2,-7m-2,7l5,-3`;}).join('');
   add(`vegetation-${t.x}-${t.y}`,t.x,t.y,<g pointerEvents="none" style={{filter:`brightness(${light(t.x,t.y)})`}}><path d={tufts} stroke={seed%2?'#727546':'#85804d'} strokeWidth=".7" opacity=".7"/>{seed%9===0&&<><ellipse cx={p.x-13} cy={p.y+3} rx="3" ry="1.5" fill="#928b70"/><ellipse cx={p.x-9} cy={p.y+5} rx="2" ry="1" fill="#777b63"/></>}</g>,-.1);
  }
  if(t.type==='forest')add(`tree-shadow-${t.x}-${t.y}`,t.x,t.y,<ellipse cx={p.x+20} cy={p.y+6} rx={22+hash(t.x,t.y)%13} ry="10" transform={`rotate(12 ${p.x+20} ${p.y+6})`} fill="#17251a" opacity=".18" pointerEvents="none"/>,-.1);
 }
 objects.push(...buildings());
 const visibleProps=sceneProps.filter((p:any)=>visiblePropsIds.has(p.id));
 objects.push(...buildPropObjects({state:{...s,props:visibleProps.filter((p:any)=>!surfaceHeight(s,p))},revealed,project,light,includeDressing:false}));
 for(const prop of visibleProps.filter((p:any)=>(surfaceHeight(s,p)??0)>0)){
  const level=tacticalLevel(prop),height=surfaceHeight(s,prop)??0;
  const offset=surfaceRenderOffset(s,prop);
  const raised=buildPropObjects({state:{...s,props:[prop]},revealed,project:(x,y)=>projectSurface(s,project,{x,y,tacticalLevel:level,renderedHeight:height,renderedOffset:offset}),light:(x,y)=>light(x,y,level),includeDressing:false});
  objects.push(...raised.map((object:any)=>({...object,depth:surfaceDrawDepth(s,prop,object.depth-prop.x-prop.y)})));
 }
 return objects;
 },[terrain,stableRooms,project,buildings,propVisibilityKey,sceneProps]);
 const staticGroups=useMemo(()=>{
  const groups=new Map<number,typeof scenery>();
  for(const object of scenery){const group=groups.get(object.depth)??[];group.push(object);groups.set(object.depth,group);}
  return [...groups].map(([depth,group])=>{
   group.sort((a,b)=>a.key.localeCompare(b.key));
   const children=group.map(object=><g key={object.key}>{object.node}</g>);
   return {depth,key:group[0].key,members:group,children};
  });
 },[scenery]);
 const staticLayers=staticGroups.map(({children,...group})=>({...group,node:<StaticSceneLayer>{children}</StaticSceneLayer>}));
 // Trees already use small raster assets. Keep them separate from scenery
 // caches: fading nearby foliage must not regenerate large depth-layer PNGs.
 const woodland=useMemo(()=>terrain.tiles.filter((t:any)=>t.type==='forest').map((t:any)=>{
  const p=projectSurface(terrain,project,t),h=hash(t.x,t.y),tree=h%4!==0,width=tree?54+h%51:30+h%17,height=tree?66+h%67:25+h%18;
  const brightness=terrain.night?.27+tileIllumination(terrain,t.x,t.y)*.73:1;
  return {point:p,cell:`${t.x},${t.y}`,key:`woodland-${t.x}-${t.y}`,depth:t.x+t.y+.5,node:<SceneryImage href={sitePath(`/art/scenery-${tree?(h%3?'tree':'poplar'):'shrub'}-v1.webp`)} brightness={brightness} x={p.x-width*.5+6} y={p.y-height+10} width={width} height={height} opacity={1} pointerEvents="none"/>};
 }),[terrain,project]);
 const visibleWoodland=woodland.filter((tree:any)=>pointInViewport(viewport,tree.point,160)).map((tree:any)=>({...tree,node:softenedWoods.has(tree.cell)?cloneElement(tree.node,{opacity:.48}):tree.node}));
 const objects:{depth:number;key:string;node:ReactNode;members?:{depth:number;key:string;node:ReactNode}[]}[]=[...staticLayers,...visibleWoodland];
 const add=(key:string,x:number,y:number,node:ReactNode,bias=0,level=0)=>objects.push({key,depth:surfaceDrawDepth(s,{x,y,tacticalLevel:level},bias),node});
 const reachableSet=useMemo(()=>new Set(reachable.map(spaceKey)),[reachable]);
 const illumination=useMemo(()=>new Map<string,number>(terrain.tiles.map((t:any)=>[`${t.x},${t.y}`,tileIllumination(terrain,t.x,t.y)])),[terrain]);
 const light=(x:number,y:number,level=0)=>s.night?.27+tileIllumination(s,x,y,level)*.73:1;
 const areaThrow=grenadeTargetingMode(u,mode),pointThrow=areaThrow||mode==='throwKnife',grenadeHeld=grenadeTargetingMode(u,'useItem');
 const drawPerson=(v:any,npc=false)=>{
  const moving=positions[v.id]??{...v,direction:v.side==='enemy'?7:3,frame:0,moving:false};const at={...v,...moving},p=projectSurface(s,project,at),interactive=sceneInteractive&&tacticalLevel(v)===cursorLevel,hovered=hover&&(hover.id?hover.id===v.id:sameCell(hover,v));
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
   <ellipse cx={p.x+5} cy={p.y+2} rx={mounted?21:11} ry="4" fill="#13150f" opacity=".5" pointerEvents="none"/>
   {v.hp<=0&&(()=>{const blood=corpseBloodShape(v.id);return <g data-corpse-blood={npc?'civilian':v.side} transform={`translate(${p.x} ${p.y}) rotate(${blood.rotation})`} pointerEvents="none"><g className="corpse-blood-spread"><ellipse cx="-3" cy="-1" rx={blood.rx} ry={blood.ry} fill="#722b28" opacity=".9"/><ellipse cx="8" cy="2" rx="7" ry="3" fill="#8e3330" opacity=".78"/><path d="M-15,0l-4,2m27,2l6,1m-9,-9l3,-2" stroke="#7e2b28" strokeWidth="2" strokeLinecap="round"/></g></g>;})()}
   {!npc&&v.side==='enemy'&&v.hp>0&&!v.surrendered&&<g aria-label="Enemigo" pointerEvents="none"><path d={`M${p.x-20},${top-4}l4,4l-4,4l-4,-4z`} fill="#bf644b" stroke="#fff0d0" strokeWidth="1.2"/></g>}
   {selectedUnit&&<ellipse cx={p.x} cy={p.y} rx="15" ry="6" fill="none" stroke="#dacb86" strokeWidth="1" pointerEvents="none"/>}
   <g data-enemy-highlight={!npc&&v.side==='enemy'&&v.hp>0&&!v.surrendered||undefined} filter={!npc&&v.side==='enemy'&&v.hp>0&&!v.surrendered?`url(#${enemyGlow})`:undefined}><g style={{filter:`brightness(${light(moving.x,moving.y,tacticalLevel(v))})`}}><SpriteFigure unit={v} position={p} motion={{...moving,direction}} pose={poses[v.id]&&poses[v.id]!=='idle'?poses[v.id]:selectedUnit&&mode==='fire'?'aim':'idle'} drawSize={52} appearance={npc?'civilian':'soldier'}/></g></g>
   {v.hp>0&&(selectedUnit||hovered)&&<><rect x={p.x-14} y={top} width="28" height="2" fill="#191d14"/><rect x={p.x-14} y={top} width={28*v.hp/v.maxHp} height="2" fill={v.side==='player'?'#81a866':'#bf644b'}/></>}
   {(selectedUnit||npc&&hovered)&&<text x={p.x} y={top-4} textAnchor="middle" fill="#ede6c3" fontSize="8" stroke="#11180f" strokeWidth="2" paintOrder="stroke">{v.nickname||v.name}{npc&&!collapsed&&v.ai?.activity?` · ${(NPC_ACTIVITY_LABELS as any)[v.ai.activity]}`:""}</text>}
   {mode!=='inventory'&&hovered&&v.side==='enemy'&&v.hp>0&&!v.surrendered&&u&&hasFirearm(u)&&contextualAttack(s,u,v,{type:mode,aim}).type==='fire'&&<text x={p.x} y={top-5} textAnchor="middle" fill="#f2d5a0" fontSize="10" stroke="#11180f" strokeWidth="2" paintOrder="stroke">{chancePercent(shotChance(s,u,v,aim,hitLocation))}</text>}
  </g>;
 };
 const visiblePeople=useMemo(()=>sightAdmittedUnits.filter(v=>!v.fled&&!v.departure&&actorInteriorReadable(s,v,positions[v.id],revealed)),[s,sightAdmittedUnits,revealed,positions]);
 const visibleCivilians=useMemo(()=>(s.npcs??[]).filter((npc:any)=>!npc.departure&&!npc.fled&&isInteriorVisible(s,npc,revealed)&&players.some(p=>canSee(s,p,npc))),[s,players,revealed]);
 const lootPiles=useMemo(()=>groundLootPiles(s,players).filter((pile:any)=>isInteriorVisible(s,pile,revealed)),[s,players,revealed]);
 for(const v of visiblePeople){const at=positions[v.id]??v;objects.push({key:`unit-${v.id}`,depth:surfaceDrawDepth(s,{...v,...at},.05),node:drawPerson(v)});}
 for(const npc of visibleCivilians){const at=positions[npc.id]??npc;objects.push({key:`npc-${npc.id}`,depth:surfaceDrawDepth(s,{...npc,...at},.05),node:drawPerson({...npc,hp:npc.hp??100,maxHp:npc.maxHp??100,side:'player'},true)});}
 for(const a of s.artillery??[]){const p=projectSurface(s,project,a);add(`gun-${a.id}`,a.x,a.y,<g role={sceneInteractive?"button":undefined} tabIndex={sceneInteractive?0:-1} aria-label={`Seleccionar ${artilleryProfile(s,a).name}`} onClick={()=>onCannon(a.id)} onKeyDown={e=>{if(e.key==='Enter')onCannon(a.id);}}>{a.id===cannonId&&<ellipse cx={p.x} cy={p.y} rx="24" ry="10" fill="none" stroke="#d8bf7e"/>}<image href={sitePath(artilleryProfile(s,a).art)} x={p.x-38} y={p.y-58} width="76" height="76" pointerEvents="none" style={{filter:`brightness(${light(a.x,a.y,tacticalLevel(a))})`}}/></g>,0,tacticalLevel(a));}
 for(const pile of lootPiles){
  const p=projectSurface(s,project,pile),point={x:pile.x,y:pile.y,...(pile.tacticalLevel===undefined?{}:{tacticalLevel:pile.tacticalLevel}),loot:true};
  add(`equipment-${spaceKey(pile)}`,pile.x,pile.y,<g data-ground-equipment="true" role={sceneInteractive?"button":undefined} pointerEvents={sceneInteractive&&tacticalLevel(pile)===cursorLevel?"auto":"none"} tabIndex={sceneInteractive&&tacticalLevel(pile)===cursorLevel?0:-1} aria-label={`Equipo en ${tacticalGridLabel(pile.x,pile.y)} · ${pile.count} objeto(s)`} onMouseEnter={()=>onHover(point)} onMouseLeave={()=>onHover(null)} onFocus={()=>onHover(point)} onBlur={()=>onHover(null)} onClick={()=>onTile(point)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onTile(point);}}}>
   <ellipse cx={p.x} cy={p.y} rx="17" ry="10" fill="#243123" stroke="#d8bf7e" strokeWidth="1"/>
   <path d={`M${p.x-8},${p.y-4}h16v8h-16zM${p.x},${p.y-4}v8`} fill="#837452" stroke="#ebd39a" strokeWidth="1" pointerEvents="none"/>
   {pile.count>1&&<text x={p.x+11} y={p.y+9} textAnchor="middle" fill="#fff2c7" stroke="#18261d" strokeWidth="2" paintOrder="stroke" fontSize="10" pointerEvents="none">{pile.count}</text>}
  </g>,.02,tacticalLevel(pile));
 }
 for(const [i,l] of (s.lights??[]).entries())if(isInteriorVisible(s,l,revealed)&&upperPointVisible(l)){const p=projectSurface(s,project,l);add(`light-${i}`,l.x,l.y,<TacticalLight source={l} point={p} night={s.night}/>,.03,tacticalLevel(l));}
 for(const t of terrainVisible?upperTiles:[]){
  const p=projectSurface(s,project,t),key=spaceKey(t),occupant=visiblePeople.find(v=>sameCell(v,t));
  objects.push({key:`surface-${key}`,depth:surfaceDrawDepth(s,t,.01),node:<g data-surface-level={tacticalLevel(t)} data-surface-id={t.id} role={sceneInteractive?"button":undefined} tabIndex={sceneInteractive?0:-1} aria-label={`${tacticalGridLabel(t.x,t.y)}, nivel superior${occupant?', '+occupant.name:t.blocked?', obstáculo':', accesible'}`} onClick={()=>onTile(t)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onTile(t);}}} onMouseEnter={()=>onHover(t)} onMouseLeave={()=>onHover(null)} onFocus={()=>onHover(t)} onBlur={()=>onHover(null)}>
   <polygon points={diamond(p.x,p.y)} fill={t.buildingId?'transparent':'url(#terrain-floor)'} stroke="none" pointerEvents="all"/>
   {showSight&&<polygon points={diamond(p.x,p.y)} fill={sight.has(key)?'#69ac54':'#a94536'} opacity=".32" pointerEvents="none"/>}
   {hover&&sameCell(hover,t)&&<polygon points={diamond(p.x,p.y)} fill={mode==='move'&&routesPending?'#aaa99c':mode==='move'&&reachableSet.has(key)?'#d8dca1':'#bd6f4d'} fillOpacity=".16" stroke="#ddd6a7" strokeWidth="1" pointerEvents="none"/>}
  </g>});
 }
 const groundPaint=useMemo(()=>{
  const fills=new Map<string,string[]>(),shades=new Map<number,string[]>();
  for(const t of terrain.tiles){const p=projectSurface(terrain,project,t),d=`M${p.x},${p.y-14}l26,14 -26,14 -26,-14z`,fill=t.type==='water'?'#516b67':`url(#terrain-${terrainMaterial(t,terrain.sceneId??terrain.sectorId)})`;
   if(!fills.has(fill))fills.set(fill,[]);fills.get(fill)!.push(d);
   if(terrain.night){const opacity=.78*(1-(illumination.get(`${t.x},${t.y}`)??0));if(!shades.has(opacity))shades.set(opacity,[]);shades.get(opacity)!.push(d);}
  }
  return <g pointerEvents="none" data-ground-paint="batched">{[...fills].map(([fill,paths])=><path key={fill} d={paths.join('')} fill={fill}/>)}{[...shades].map(([opacity,paths])=><path key={opacity} d={paths.join('')} fill="#050914" opacity={opacity}/>)}</g>;
 },[terrain,project,illumination]);
 // Reuse tile elements when the camera crosses an overscan boundary. Rebuilding
 // labels and obstacle checks for every visible tile caused an 80 ms pause.
 const blockedGround=useMemo(()=>new Set<string>((terrain.props??[]).filter((p:any)=>tacticalLevel(p)===0&&p.blocksMovement!==false).flatMap(propCells).map((p:any)=>`${p.x},${p.y}`)),[terrain]);
 const groundNodes=useMemo(()=>new Map<string,ReactElement<{'aria-label':string}>>(terrain.tiles.map((t:any)=>{const p=projectSurface(terrain,project,t),key=`${t.x},${t.y}`;return [key,<g key={key} data-surface-level="0" role={sceneInteractive?"button":undefined} pointerEvents={sceneInteractive&&cursorLevel===0?"auto":"none"} tabIndex={sceneInteractive&&cursorLevel===0?0:-1} aria-label={`${tacticalGridLabel(t.x,t.y)}${(t.blocked||blockedGround.has(key))?', obstáculo':', accesible'}`} onClick={()=>handlers.current.onTile({...t,tacticalLevel:0})} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();handlers.current.onTile({...t,tacticalLevel:0});}}} onMouseEnter={()=>handlers.current.onHover({...t,tacticalLevel:0})} onMouseLeave={()=>handlers.current.onHover(null)} onFocus={()=>handlers.current.onHover({...t,tacticalLevel:0})} onBlur={()=>handlers.current.onHover(null)}><polygon points={diamond(p.x,p.y)} fill="transparent" stroke="none"/>{t.type==='water'&&<path d={`M${p.x-17},${p.y}l15,-3m-5,9l20,-3`} stroke="#a8b9a6" opacity=".22" strokeWidth=".7"/>}</g>] as const;})),[terrain,project,blockedGround,cursorLevel,sceneInteractive]);
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
 objects.push(...wallEdgeControlObjects({state:s,players,revealed,cursorLevel,mode,interactive:sceneInteractive,hover,viewport,project,onTile,onHover}));
 // At an exact actor/scenery depth tie retain the original key ordering.
 // Only that layer uses vectors for this frame; actors never jump in front of
 // a tree or prop merely because the surrounding scenery was cached.
 const actorDepths=new Set(objects.filter(object=>!object.members).map(object=>object.depth));
 const orderedObjects=objects.flatMap(object=>{
  if(!object.members)return [object];
  const tied=actorDepths.has(object.depth);
  // Retain the decoded image while exact-depth members interleave with actors.
  // Unmounting here would rasterize the layer again at the next movement step.
  const cached={...object,key:`static-cache-${object.depth}`,node:<g visibility={tied?'hidden':undefined}>{object.node}</g>};
  return tied?[cached,...object.members]:[cached];
 }).sort((a,b)=>a.depth-b.depth||a.key.localeCompare(b.key));
 return <>
  <defs>{materials.map(name=><pattern key={name} id={`terrain-${name}`} patternUnits="userSpaceOnUse" width="128" height="128" patternTransform={['plaster','roof','wood'].includes(name)?undefined:'matrix(1 .538 -1 .538 0 0)'}><image href={sitePath(`/art/terrain-${name}-v1.webp`)} width="128" height="128"/></pattern>)}<radialGradient id="smokefill"><stop offset="0" stopColor="#d9dce0" stopOpacity=".72"/><stop offset=".45" stopColor="#aeb6bf" stopOpacity=".46"/><stop offset="1" stopColor="#84909d" stopOpacity="0"/></radialGradient><filter id={enemyGlow} x="-25%" y="-20%" width="150%" height="140%"><feMorphology in="SourceAlpha" operator="dilate" radius="1.5" result="expanded"/><feFlood floodColor="#fa5546" floodOpacity=".9" result="red"/><feComposite in="red" in2="expanded" operator="in" result="outline"/><feComposite in="outline" in2="SourceAlpha" operator="out"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id={knownGhost} x="-20%" y="-20%" width="140%" height="140%"><feColorMatrix type="matrix" values="0 0 0 0 .83 0 0 0 0 .92 0 0 0 0 .72 0 0 0 .65 0"/></filter></defs>
  {terrainVisible&&<><StaticSceneLayer>{groundPaint}</StaticSceneLayer>{ground}</>}
  {terrainVisible&&hover&&!hover.wallEdgeId&&!tacticalLevel(hover)&&pointInViewport(viewport,projectSurface(s,project,hover))&&<polygon points={diamond(projectSurface(s,project,hover).x,projectSurface(s,project,hover).y)} fill={mode==='move'&&routesPending?'#aaa99c':mode==='move'&&reachableSet.has(spaceKey(hover))?'#d8dca1':'#bd6f4d'} fillOpacity=".16" stroke="#ddd6a7" strokeWidth="1" pointerEvents="none"/>}
  {groundOverlay}
  {orderedObjects.map(o=><g key={o.key}>{o.node}</g>)}
  {[...visiblePeople,...visibleCivilians].filter(v=>!(visiblePeople.includes(v)&&v.side==='player'&&positions[v.id]?.moving)&&foregroundOccludesActor(s,{...v,...positions[v.id]},project,revealed)).map(v=>{const moving=positions[v.id]??{...v,direction:v.side==='enemy'?7:3,frame:0,moving:false},at={...v,...moving},p=projectSurface(s,project,at),npc=visibleCivilians.includes(v),highlighted=!npc&&v.side==='enemy'&&v.hp>0&&!v.surrendered;return <g key={`ghost-${v.id}`} data-known-actor-silhouette={v.id} data-enemy-highlight={highlighted||undefined} filter={highlighted?`url(#${enemyGlow})`:undefined} pointerEvents="none"><g filter={`url(#${knownGhost})`} opacity=".7"><SpriteFigure unit={v} position={p} motion={{...moving,direction:moving.moving?moving.direction:Number.isInteger(v.facing)?(v.facing+1)%8:moving.direction}} pose={poses[v.id]??'idle'} appearance={npc?'civilian':'soldier'}/></g></g>;})}
  {(()=>{
   const occurrences=new Map<string,number>();
   return (s.smoke??[]).map((v:any)=>{
    // Expiry round stays constant as turns decrease. Removing an older cloud
    // must not restart the animation of a later shot at a different position.
    const identity=`${spaceKey(v)}:${(s.turn??0)+(v.turns??3)}`,ordinal=occurrences.get(identity)??0;
    occurrences.set(identity,ordinal+1);
    if(!upperPointVisible(v))return null;
    const p=projectSurface(s,project,v),age=Math.max(0,3-(v.turns??3));
    return <g key={`${identity}:${ordinal}`} data-powder-smoke="true" transform={`translate(${p.x} ${p.y-22})`} data-smoke-age={age} pointerEvents="none" aria-hidden="true">
     <g style={{transform:`scale(${v.radius})`,transition:'transform 1.2s ease-out'}}>
      {smokePuffs.map(([x,y,rx,ry],index)=><g key={index} className="powder-smoke-puff" style={{'--smoke-dx':`${8+x*.65}px`,'--smoke-dy':`${-12+y*.3}px`,'--smoke-age':Math.min(2,age),'--smoke-opacity':age===0?.75:age===1?.42:.2} as CSSProperties}>
       <g className={age===0?"powder-smoke-bloom":undefined}><ellipse cx={x} cy={y} rx={rx} ry={ry} fill="url(#smokefill)"/></g>
      </g>)}
     </g>
    </g>;
   });
  })()}
  {heard&&heardPoint&&u&&(()=>{const origin=projectSurface(s,project,positions[u.id]??u),angle=Math.atan2(heardPoint.y-origin.y,heardPoint.x-origin.x)*180/Math.PI;return <g key={`${u.id}:${u.lastHeardNoise?.turn}:${heard.x}:${heard.y}`} className="tactical-noise-direction" aria-label="Ruido en esa dirección" transform={`translate(${origin.x} ${origin.y-18}) rotate(${angle})`} pointerEvents="none"><path d="M22,-5l5,5-5,5m7,-4l4,4-4,4" fill="none" stroke="#e0c58a" strokeWidth="1.5" opacity=".65"/></g>;})()}
 </>;
}
