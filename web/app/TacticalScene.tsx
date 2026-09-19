'use client';
import {pointInViewport} from '../../game/tactical-viewport.js';
import {terrainMaterial} from '../../game/regional-terrain.js';
import {aimedBodyPart,targetHitFrame} from '../../game/aim-cursor.js';
import {canChooseShotLocation} from '../../game/targeted-combat.js';
import {tacticalGridLabel} from '../../game/tactical-grid.js';
import {NPC_ACTIVITY_LABELS} from '../../game/npc-ai.js';
import {propBlocksAt} from '../../game/props.js';
import SpriteFigure from './SpriteFigure';
import {spriteCondition} from '../../game/sprite-state.js';
import {createBuildingRenderer} from './TacticalBuildings';
import {isInteriorVisible} from '../../game/tactical-visibility.js';
import {buildPropObjects} from './TacticalProps';
import {canSee,tileIllumination,shotChance,hasFirearm,contextualAttack,ARTILLERY} from '../../game/tactical.js';
import {heardNoiseModel,groundLootPiles,civilianMedicalInputAction,aimedCursorMode,grenadeTargetingMode} from '../../game/ja2-hud.js';
import {useMemo,useRef,type ReactNode} from 'react';
import {sameCell,spaceKey,tacticalLevel,surfaceHeight} from '../../game/tactical-space.js';
import {projectSurface,surfaceDrawDepth,surfaceRenderOffset} from '../lib/tactical-elevation';
type Props={viewport?:any;cursorLevel?:number;state:any;selected:any;unit:any;players:any[];units:any[];positions:any;poses:any;directions:any;hover:any;mode:string;aim:number;hitLocation?:string;reachable:any[];showSight:boolean;sight:Set<string>;revealed:Set<string>;project:(x:number,y:number)=>{x:number;y:number};onTile:(t:any)=>void;onHover:(t:any)=>void;onTalk:(n:any)=>void;onCannon:(id:string)=>void;cannonId:string};
const materials=['dry-grass','dirt','cobble','green-grass','mud','floor','plaster','roof','wood'];
const diamond=(x:number,y:number)=>`${x},${y-14} ${x+26},${y} ${x},${y+14} ${x-26},${y}`;
const hash=(x:number,y:number)=>((x*374761393+y*668265263)>>>0)%1000;
export default function TacticalScene({viewport,cursorLevel=0,state:s,selected,unit:u,players,units,positions,poses,directions,hover,mode,aim,hitLocation='torso',reachable,showSight,sight,revealed,project,onTile,onHover,onTalk,onCannon,cannonId}:Props){
 const handlers=useRef({onTile,onHover});handlers.current={onTile,onHover};
 // Roof geography remains drawn in full. Upper-floor controls and changing
 // contents require actual shared sight, including the room on that floor.
 const upperPointVisible=(point:any)=>!tacticalLevel(point)||isInteriorVisible(s,point,revealed)&&players.some(player=>canSee(s,player,point));
 const visibleTiles=useMemo(()=>s.tiles.filter((t:any)=>pointInViewport(viewport,projectSurface(s,project,t),110)),[s.tiles,viewport,project]);
 const upperTiles=useMemo(()=>(s.upperSurfaces??[]).filter((t:any)=>tacticalLevel(t)===cursorLevel&&pointInViewport(viewport,projectSurface(s,project,t),110)&&upperPointVisible(t)),[s,players,revealed,viewport,project,cursorLevel]);
 const heard=heardNoiseModel(s,u),heardPoint=heard?projectSurface(s,project,heard):null;
 const buildings=useMemo(()=>createBuildingRenderer({state:s,revealed,cursorLevel,project,light:(x,y,level=0)=>s.night?.27+tileIllumination(s,x,y,level)*.73:1}),[s,revealed,project,cursorLevel]);
 const scenery=useMemo(()=>{
 const objects:{depth:number;key:string;node:ReactNode}[]=[];
 const add=(key:string,x:number,y:number,node:ReactNode,bias=0)=>objects.push({key,depth:x+y+bias,node});

 const light=(x:number,y:number,level=0)=>s.night?.27+tileIllumination(s,x,y,level)*.73:1;

 for(const t of visibleTiles){
  const p=projectSurface(s,project,t);
  if(t.blocked&&!['wall','door','window','water'].includes(t.type)){
   add(`rock-${t.x}-${t.y}`,t.x,t.y,<image href="/art/scenery-rocks-v1.webp" x={p.x-25} y={p.y-32} width="50" height="40" pointerEvents="none" style={{filter:`brightness(${light(t.x,t.y)})`}}/>);
  }else if(t.type==='stone'&&t.material==='stone'&&!t.buildingId){
   add(`loose-rock-${t.x}-${t.y}`,t.x,t.y,<image href="/art/scenery-rocks-v1.webp" x={p.x-14} y={p.y-14} width="28" height="22" pointerEvents="none" style={{filter:`brightness(${light(t.x,t.y)})`}}/>);
  }
  // Natural decoration is stable per tile. Cover-bearing woods remain traversable.
  if(t.type==='forest'){
   const h=hash(t.x,t.y),tree=h%4!==0,width=tree?75+h%28:40,height=tree?90+h%30:35;
   const soften=units.some(v=>v.hp>0&&Math.abs(v.x-t.x)<1.4&&Math.abs(v.y-t.y)<1.4);
   add(`woodland-${t.x}-${t.y}`,t.x+.25,t.y+.25,<image href={`/art/scenery-${tree?(h%3?'tree':'poplar'):'shrub'}-v1.webp`} x={p.x-width*.5+6} y={p.y-height+10} width={width} height={height} opacity={soften?.48:1} pointerEvents="none" style={{filter:`brightness(${light(t.x,t.y)})`}}/>);
  }else if(t.type==='scrub'||t.type==='grass'&&!t.buildingId&&hash(t.x,t.y)%11===0){
   add(`scrub-${t.x}-${t.y}`,t.x,t.y,<image href="/art/scenery-shrub-v1.webp" x={p.x-16} y={p.y-20} width="32" height="26" pointerEvents="none" opacity=".9" style={{filter:`brightness(${light(t.x,t.y)})`}}/>);
  }
 }
 objects.push(...buildings(viewport));
 const visibleProps=(s.props??[]).filter((p:any)=>pointInViewport(viewport,projectSurface(s,project,p),200)&&upperPointVisible(p));
 objects.push(...buildPropObjects({state:{...s,props:visibleProps.filter((p:any)=>!surfaceHeight(s,p))},revealed,project,light}));
 for(const prop of visibleProps.filter((p:any)=>(surfaceHeight(s,p)??0)>0)){
  const level=tacticalLevel(prop),height=surfaceHeight(s,prop)??0;
  const offset=surfaceRenderOffset(s,prop);
  const raised=buildPropObjects({state:{...s,props:[prop]},revealed,project:(x,y)=>projectSurface(s,project,{x,y,tacticalLevel:level,renderedHeight:height,renderedOffset:offset}),light:(x,y)=>light(x,y,level)});
  objects.push(...raised.map((object:any)=>({...object,depth:surfaceDrawDepth(s,prop,object.depth-prop.x-prop.y)})));
 }
 return objects;
 },[s,players,revealed,project,units,viewport,visibleTiles,buildings]);
 const objects=[...scenery];
 const add=(key:string,x:number,y:number,node:ReactNode,bias=0,level=0)=>objects.push({key,depth:surfaceDrawDepth(s,{x,y,tacticalLevel:level},bias),node});
 const reachableSet=useMemo(()=>new Set(reachable.map(spaceKey)),[reachable]);
 const illumination=useMemo(()=>new Map<string,number>(visibleTiles.map((t:any)=>[`${t.x},${t.y}`,tileIllumination(s,t.x,t.y)])),[s,visibleTiles]);
 const light=(x:number,y:number,level=0)=>s.night?.27+tileIllumination(s,x,y,level)*.73:1;
 const material=(t:any)=>terrainMaterial(t,s.sceneId??s.sectorId);
 const areaThrow=grenadeTargetingMode(u,mode),pointThrow=areaThrow||mode==='throwKnife',grenadeHeld=grenadeTargetingMode(u,'useItem');
 const drawPerson=(v:any,npc=false)=>{
  const moving=positions[v.id]??{...v,direction:v.side==='enemy'?7:3,frame:0,moving:false};const at={...v,...moving},p=projectSurface(s,project,at),interactive=tacticalLevel(v)===cursorLevel,hovered=hover&&(hover.id?hover.id===v.id:sameCell(hover,v));
  const posture=spriteCondition(v),collapsed=posture==='dead'||posture==='unconscious';
  const mounted=v.mounted&&!collapsed;
  const direction=collapsed||moving.moving?moving.direction:Number.isInteger(v.facing)?(v.facing+1)%8:poses[v.id]&&poses[v.id]!=='idle'?(directions[v.id]??moving.direction):moving.direction;
  const selectedUnit=v.id===selected,top=p.y-(collapsed||posture==='prone'?24:mounted?72:49);
  const frame=targetHitFrame(v,p);
  const bodyAim=!npc&&!areaThrow&&canChooseShotLocation(v);
  const medicalInteraction=npc&&Boolean(civilianMedicalInputAction(s,u,v,mode));
  const firePoint=npc&&mode==='fire',pointInteraction=pointThrow||firePoint;
  const aimPoint=(location='torso')=>npc&&pointInteraction?{x:v.x,y:v.y,tacticalLevel:tacticalLevel(v),anonymous:true,aimLocation:'torso'}:{...v,...(medicalInteraction?{targetKind:'npc'}:{}),aimLocation:location};
  const pointerTarget=(event:any)=>{const bounds=event.currentTarget.getBoundingClientRect();return aimPoint(mode==='inventory'||areaThrow||npc?'torso':aimedBodyPart(v,bounds.height?(event.clientY-bounds.top)/bounds.height:.5));};
  return <g data-unit-id={v.id} data-npc-activity={npc?v.ai?.activity:undefined} data-moving={!collapsed&&moving.moving} data-direction={direction} data-posture={posture} data-tactical-level={tacticalLevel(v)||undefined} opacity={v.hp<=0?.7:1}>
   <rect data-person-hit-target="true" {...frame} fill="transparent" pointerEvents={interactive?"all":"none"} role="button" tabIndex={interactive?0:-1} aria-label={medicalInteraction?`Vendar a ${v.name}`:mode==='inventory'?`Colocar objeto: ${v.name}`:areaThrow?`Lanzar granada a la casilla de ${v.name}`:firePoint?`Disparar a la casilla de ${v.name}`:npc&&!pointInteraction?`${u?.activeSlot==='item'&&!grenadeHeld&&['move','useItem'].includes(mode)?'Entregar objeto a':'Hablar con'} ${v.name}${v.ai?.activity?", "+(NPC_ACTIVITY_LABELS as any)[v.ai.activity]:""}`:npc?`Lanzar a la casilla de ${v.name}`:`${v.name} · ${v.hp<=0?'muerto':v.unconscious?'inconsciente':Math.ceil(v.hp)+' salud'}`} onMouseEnter={event=>onHover(pointerTarget(event))} onMouseMove={event=>onHover(pointerTarget(event))} onMouseLeave={()=>onHover(null)} onFocus={()=>onHover(aimPoint(bodyAim?hitLocation:'torso'))} onBlur={()=>onHover(null)} onClick={event=>npc&&!pointInteraction&&!medicalInteraction?onTalk(v):onTile(pointerTarget(event))} onKeyDown={e=>{if(aimedCursorMode(mode)&&['ArrowUp','ArrowDown'].includes(e.key)&&bodyAim){e.preventDefault();const parts=['head','torso','legs'],index=Math.max(0,parts.indexOf(hitLocation));onHover({...v,aimLocation:parts[Math.max(0,Math.min(2,index+(e.key==='ArrowUp'?-1:1)))]});return;}if(e.key==='Enter'||e.key===' '){e.preventDefault();npc&&!pointInteraction&&!medicalInteraction?onTalk(v):onTile(aimPoint(bodyAim?hitLocation:'torso'));}}}/>
   <ellipse cx={p.x+5} cy={p.y+2} rx={mounted?21:11} ry="4" fill="#13150f" opacity=".5" pointerEvents="none"/>
   {!npc&&v.side==='enemy'&&v.hp>0&&!v.surrendered&&<g aria-label="Enemigo" pointerEvents="none"><path d={`M${p.x-20},${top-4}l4,4l-4,4l-4,-4z`} fill="#bf644b" stroke="#fff0d0" strokeWidth="1.2"/></g>}
   {selectedUnit&&<ellipse cx={p.x} cy={p.y} rx="15" ry="6" fill="none" stroke="#dacb86" strokeWidth="1" pointerEvents="none"/>}
   <g style={{filter:`brightness(${light(moving.x,moving.y,tacticalLevel(v))})`}}><SpriteFigure unit={v} position={p} motion={{...moving,direction}} pose={poses[v.id]&&poses[v.id]!=='idle'?poses[v.id]:selectedUnit&&mode==='fire'?'aim':'idle'} drawSize={52} appearance={npc?'civilian':'soldier'}/></g>
   {!npc&&v.hp>0&&(selectedUnit||hovered)&&<><rect x={p.x-14} y={top} width="28" height="2" fill="#191d14"/><rect x={p.x-14} y={top} width={28*v.hp/v.maxHp} height="2" fill={v.side==='player'?'#81a866':'#bf644b'}/></>}
   {(selectedUnit||npc&&hovered)&&<text x={p.x} y={top-4} textAnchor="middle" fill="#ede6c3" fontSize="8" stroke="#11180f" strokeWidth="2" paintOrder="stroke">{v.nickname||v.name}{npc&&v.ai?.activity?` · ${(NPC_ACTIVITY_LABELS as any)[v.ai.activity]}`:""}</text>}
   {mode!=='inventory'&&hovered&&v.side==='enemy'&&v.hp>0&&!v.surrendered&&u&&hasFirearm(u)&&contextualAttack(s,u,v,{type:mode,aim}).type==='fire'&&<text x={p.x} y={top-5} textAnchor="middle" fill="#f2d5a0" fontSize="10" stroke="#11180f" strokeWidth="2" paintOrder="stroke">{shotChance(s,u,v,aim,hitLocation)}%</text>}
  </g>;
 };
 for(const v of units.filter(v=>!v.fled&&isInteriorVisible(s,v,revealed))){const at=positions[v.id]??v;objects.push({key:`unit-${v.id}`,depth:surfaceDrawDepth(s,{...v,...at},.05),node:drawPerson(v)});}
 for(const npc of s.npcs??[])if(isInteriorVisible(s,npc,revealed)&&players.some(p=>canSee(s,p,npc))){const at=positions[npc.id]??npc;objects.push({key:`npc-${npc.id}`,depth:surfaceDrawDepth(s,{...npc,...at},.05),node:drawPerson({...npc,hp:npc.hp??100,maxHp:npc.maxHp??100,side:'player'},true)});}
 for(const a of s.artillery??[]){const p=projectSurface(s,project,a);add(`gun-${a.id}`,a.x,a.y,<g role="button" tabIndex={0} aria-label={`Seleccionar ${(ARTILLERY as any)[a.type].name}`} onClick={()=>onCannon(a.id)} onKeyDown={e=>{if(e.key==='Enter')onCannon(a.id);}}>{a.id===cannonId&&<ellipse cx={p.x} cy={p.y} rx="24" ry="10" fill="none" stroke="#d8bf7e"/>}<image href="/art/cannon.png" x={p.x-38} y={p.y-58} width="76" height="76" pointerEvents="none" style={{filter:`brightness(${light(a.x,a.y,tacticalLevel(a))})`}}/></g>,0,tacticalLevel(a));}
 for(const pile of groundLootPiles(s,players))if(isInteriorVisible(s,pile,revealed)){
  const p=projectSurface(s,project,pile),point={x:pile.x,y:pile.y,...(pile.tacticalLevel===undefined?{}:{tacticalLevel:pile.tacticalLevel}),loot:true};
  add(`equipment-${spaceKey(pile)}`,pile.x,pile.y,<g data-ground-equipment="true" role="button" pointerEvents={tacticalLevel(pile)===cursorLevel?"auto":"none"} tabIndex={tacticalLevel(pile)===cursorLevel?0:-1} aria-label={`Equipo en ${tacticalGridLabel(pile.x,pile.y)} · ${pile.count} objeto(s)`} onMouseEnter={()=>onHover(point)} onMouseLeave={()=>onHover(null)} onFocus={()=>onHover(point)} onBlur={()=>onHover(null)} onClick={()=>onTile(point)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onTile(point);}}}>
   <ellipse cx={p.x} cy={p.y} rx="17" ry="10" fill="#243123" stroke="#d8bf7e" strokeWidth="1"/>
   <path d={`M${p.x-8},${p.y-4}h16v8h-16zM${p.x},${p.y-4}v8`} fill="#837452" stroke="#ebd39a" strokeWidth="1" pointerEvents="none"/>
   {pile.count>1&&<text x={p.x+11} y={p.y+9} textAnchor="middle" fill="#fff2c7" stroke="#18261d" strokeWidth="2" paintOrder="stroke" fontSize="10" pointerEvents="none">{pile.count}</text>}
  </g>,.02,tacticalLevel(pile));
 }
 for(const [i,l] of (s.lights??[]).entries())if(isInteriorVisible(s,l,revealed)&&upperPointVisible(l)){const p=projectSurface(s,project,l);add(`light-${i}`,l.x,l.y,<g pointerEvents="none"><ellipse cx={p.x} cy={p.y-4} rx="3" ry="7" fill="#efa242"/><ellipse cx={p.x} cy={p.y-5} rx="1.5" ry="4" fill="#ffe3a0"/></g>,.03,tacticalLevel(l));}
 for(const t of upperTiles){
  const p=projectSurface(s,project,t),key=spaceKey(t),occupant=units.find(v=>sameCell(v,t)&&!v.fled);
  objects.push({key:`surface-${key}`,depth:surfaceDrawDepth(s,t,.01),node:<g data-surface-level={tacticalLevel(t)} data-surface-id={t.id} role="button" tabIndex={0} aria-label={`${tacticalGridLabel(t.x,t.y)}, nivel superior${occupant?', '+occupant.name:t.blocked?', obstáculo':', accesible'}`} onClick={()=>onTile(t)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onTile(t);}}} onMouseEnter={()=>onHover(t)} onMouseLeave={()=>onHover(null)} onFocus={()=>onHover(t)} onBlur={()=>onHover(null)}>
   <polygon points={diamond(p.x,p.y)} fill={t.buildingId?'transparent':'url(#terrain-floor)'} stroke="none" pointerEvents="all"/>
   {showSight&&<polygon points={diamond(p.x,p.y)} fill={sight.has(key)?'#69ac54':'#a94536'} opacity=".32" pointerEvents="none"/>}
   {hover&&sameCell(hover,t)&&<polygon points={diamond(p.x,p.y)} fill={mode==='move'&&reachableSet.has(key)?'#d8dca1':'#bd6f4d'} fillOpacity=".16" stroke="#ddd6a7" strokeWidth="1" pointerEvents="none"/>}
  </g>});
 }
 const ground=useMemo(()=>(<g>{visibleTiles.map((t:any)=>{const p=projectSurface(s,project,t),key=`${t.x},${t.y}`,occupant=units.find(v=>sameCell(v,t)&&!v.fled);return <g key={key} data-surface-level="0" role="button" pointerEvents={cursorLevel===0?"auto":"none"} tabIndex={cursorLevel===0?0:-1} aria-label={`${tacticalGridLabel(t.x,t.y)}${occupant?', '+occupant.name:(t.blocked||propBlocksAt(s,t.x,t.y))?', obstáculo':', accesible'}`} onClick={()=>handlers.current.onTile({...t,tacticalLevel:0})} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();handlers.current.onTile({...t,tacticalLevel:0});}}} onMouseEnter={()=>handlers.current.onHover({...t,tacticalLevel:0})} onMouseLeave={()=>handlers.current.onHover(null)} onFocus={()=>handlers.current.onHover({...t,tacticalLevel:0})} onBlur={()=>handlers.current.onHover(null)}><polygon points={diamond(p.x,p.y)} fill={t.type==='water'?'#516b67':`url(#terrain-${material(t)})`} stroke="none"/>{t.type==='water'&&<path d={`M${p.x-17},${p.y}l15,-3m-5,9l20,-3`} stroke="#a8b9a6" opacity=".22" strokeWidth=".7"/>}{s.night&&<polygon points={diamond(p.x,p.y)} fill="#050914" opacity={.78*(1-(illumination.get(key)??0))} pointerEvents="none"/>}{showSight&&<polygon points={diamond(p.x,p.y)} fill={sight.has(spaceKey(t))?'#69ac54':'#a94536'} opacity=".32" pointerEvents="none"/>}</g>;})}</g>),[visibleTiles,units,project,s.night,s.props,showSight,sight,illumination,cursorLevel]);
 return <>
  <defs>{materials.map(name=><pattern key={name} id={`terrain-${name}`} patternUnits="userSpaceOnUse" width="128" height="128" patternTransform={['plaster','roof','wood'].includes(name)?undefined:'matrix(1 .538 -1 .538 0 0)'}><image href={`/art/terrain-${name}-v1.webp`} width="128" height="128"/></pattern>)}<radialGradient id="smokefill"><stop offset="0" stopColor="#d4ccae" stopOpacity=".65"/><stop offset="1" stopColor="#d4ccae" stopOpacity="0"/></radialGradient></defs>
  {ground}
  {hover&&!tacticalLevel(hover)&&pointInViewport(viewport,projectSurface(s,project,hover))&&<polygon points={diamond(projectSurface(s,project,hover).x,projectSurface(s,project,hover).y)} fill={mode==='move'&&reachableSet.has(spaceKey(hover))?'#d8dca1':'#bd6f4d'} fillOpacity=".16" stroke="#ddd6a7" strokeWidth="1" pointerEvents="none"/>}
  {objects.sort((a,b)=>a.depth-b.depth||a.key.localeCompare(b.key)).map(o=><g key={o.key}>{o.node}</g>)}
  {(s.smoke??[]).filter(upperPointVisible).map((v:any,i:number)=>{const p=projectSurface(s,project,v);return <ellipse key={i} cx={p.x} cy={p.y-24} rx={32*v.radius} ry={23*v.radius} fill="url(#smokefill)" pointerEvents="none"/>})}
  {heard&&heardPoint&&<g className="ja2-noise-marker" aria-label="Ruido: zona aproximada" pointerEvents="none"><ellipse cx={heardPoint.x} cy={heardPoint.y} rx={Math.max(26,heard.radius*26)} ry={Math.max(14,heard.radius*14)} fill="#d4b35a" fillOpacity=".08" stroke="#e7ca7d" strokeWidth="1.5" strokeDasharray="4 4"/><text x={heardPoint.x} y={heardPoint.y+4} textAnchor="middle" fill="#fff0b7" fontSize="17" fontWeight="bold" stroke="#282316" strokeWidth="3" paintOrder="stroke">?</text></g>}
 </>;
}
