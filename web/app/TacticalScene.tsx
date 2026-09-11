'use client';
import {tacticalGridLabel} from '../../game/tactical-grid.js';
import {NPC_ACTIVITY_LABELS} from '../../game/npc-ai.js';
import {propBlocksAt} from '../../game/props.js';
import SpriteFigure from './SpriteFigure';
import {spriteCondition} from '../../game/sprite-state.js';
import {buildBuildingObjects} from './TacticalBuildings';
import {isInteriorVisible} from '../../game/tactical-visibility.js';
import {buildPropObjects} from './TacticalProps';
import {canSee,tileIllumination,shotChance,hasFirearm,contextualAttack,ARTILLERY} from '../../game/tactical.js';
import {heardNoiseModel,groundLootPiles} from '../../game/ja2-hud.js';
import type {ReactNode} from 'react';
type Props={state:any;selected:any;unit:any;players:any[];units:any[];positions:any;poses:any;directions:any;hover:any;mode:string;aim:number;hitLocation?:string;reachable:any[];showSight:boolean;sight:Set<string>;revealed:Set<string>;project:(x:number,y:number)=>{x:number;y:number};onTile:(t:any)=>void;onHover:(t:any)=>void;onTalk:(n:any)=>void;onCannon:(id:string)=>void;cannonId:string};
const materials=['dry-grass','dirt','cobble','green-grass','mud','floor','plaster','roof','wood'];
const diamond=(x:number,y:number)=>`${x},${y-14} ${x+26},${y} ${x},${y+14} ${x-26},${y}`;
const hash=(x:number,y:number)=>((x*374761393+y*668265263)>>>0)%1000;
export default function TacticalScene({state:s,selected,unit:u,players,units,positions,poses,directions,hover,mode,aim,hitLocation='torso',reachable,showSight,sight,revealed,project,onTile,onHover,onTalk,onCannon,cannonId}:Props){
 const heard=heardNoiseModel(s,u),heardPoint=heard?project(heard.x,heard.y):null;
 const objects:{depth:number;key:string;node:ReactNode}[]=[];
 const add=(key:string,x:number,y:number,node:ReactNode,bias=0)=>objects.push({key,depth:x+y+bias,node});
 const reachableSet=new Set(reachable.map(t=>`${t.x},${t.y}`));
 const light=(x:number,y:number)=>s.night?.27+tileIllumination(s,x,y)*.73:1;
 const material=(t:any)=>t.type==='road'?'dirt':t.type==='stone'?'cobble':t.type==='mud'?'mud':t.type==='floor'?'floor':t.type==='forest'?'green-grass':'dry-grass';
 for(const t of s.tiles){
  const p=project(t.x,t.y);
  if(t.blocked&&!['wall','door','window','water'].includes(t.type)){
   add(`rock-${t.x}-${t.y}`,t.x,t.y,<image href="/art/scenery-rocks-v1.webp" x={p.x-25} y={p.y-32} width="50" height="40" pointerEvents="none" style={{filter:`brightness(${light(t.x,t.y)})`}}/>);
  }
  // Natural decoration is stable per tile. Cover-bearing woods remain traversable.
  if(t.type==='forest'){
   const h=hash(t.x,t.y),tree=h%4!==0,width=tree?75+h%28:40,height=tree?90+h%30:35;
   const soften=units.some(v=>v.hp>0&&Math.abs(v.x-t.x)<1.4&&Math.abs(v.y-t.y)<1.4);
   add(`woodland-${t.x}-${t.y}`,t.x+.25,t.y+.25,<image href={`/art/scenery-${tree?(h%3?'tree':'poplar'):'shrub'}-v1.webp`} x={p.x-width*.5+6} y={p.y-height+10} width={width} height={height} opacity={soften?.48:1} pointerEvents="none" style={{filter:`brightness(${light(t.x,t.y)})`}}/>);
  }else if(t.type==='grass'&&!t.buildingId&&hash(t.x,t.y)%11===0){
   add(`scrub-${t.x}-${t.y}`,t.x,t.y,<image href="/art/scenery-shrub-v1.webp" x={p.x-16} y={p.y-20} width="32" height="26" pointerEvents="none" opacity=".9" style={{filter:`brightness(${light(t.x,t.y)})`}}/>);
  }
 }
 objects.push(...buildBuildingObjects({state:s,revealed,project,light}));
 objects.push(...buildPropObjects({state:s,revealed,project,light}));
 const drawPerson=(v:any,npc=false)=>{
  const moving=positions[v.id]??{...v,direction:v.side==='enemy'?7:3,frame:0,moving:false};const p=project(moving.x,moving.y);
  const posture=spriteCondition(v),collapsed=posture==='dead'||posture==='unconscious';
  const mounted=v.mounted&&!collapsed;
  const direction=collapsed||moving.moving?moving.direction:Number.isInteger(v.facing)?(v.facing+1)%8:poses[v.id]&&poses[v.id]!=='idle'?(directions[v.id]??moving.direction):moving.direction;
  const selectedUnit=v.id===selected,top=p.y-(collapsed||posture==='prone'?24:mounted?72:49);
  return <g data-unit-id={v.id} data-npc-activity={npc?v.ai?.activity:undefined} data-moving={!collapsed&&moving.moving} data-direction={direction} data-posture={posture} opacity={v.hp<=0?.7:1}>
   <ellipse data-person-hit-target="true" cx={p.x} cy={p.y-18} rx={mounted?24:14} ry="25" fill="transparent" pointerEvents="all" role="button" tabIndex={0} aria-label={npc?`Hablar con ${v.name}${v.ai?.activity?", "+(NPC_ACTIVITY_LABELS as any)[v.ai.activity]:""}`:`${v.name} · ${v.hp<=0?'muerto':v.unconscious?'inconsciente':Math.ceil(v.hp)+' salud'}`} onMouseEnter={()=>onHover(v)} onMouseLeave={()=>onHover(null)} onFocus={()=>onHover(v)} onBlur={()=>onHover(null)} onClick={()=>npc?onTalk(v):onTile(v)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();npc?onTalk(v):onTile(v);}}}/>
   <ellipse cx={p.x+5} cy={p.y+2} rx={mounted?21:11} ry="4" fill="#13150f" opacity=".5" pointerEvents="none"/>
   {!npc&&v.side==='enemy'&&v.hp>0&&!v.surrendered&&<g aria-label="Enemigo" pointerEvents="none"><path d={`M${p.x-20},${top-4}l4,4l-4,4l-4,-4z`} fill="#bf644b" stroke="#fff0d0" strokeWidth="1.2"/></g>}
   {selectedUnit&&<ellipse cx={p.x} cy={p.y} rx="15" ry="6" fill="none" stroke="#dacb86" strokeWidth="1" pointerEvents="none"/>}
   <g style={{filter:`brightness(${light(moving.x,moving.y)})`}}><SpriteFigure unit={v} position={p} motion={{...moving,direction}} pose={poses[v.id]??'idle'} drawSize={52} appearance={npc?'civilian':'soldier'}/></g>
   {!npc&&v.hp>0&&(selectedUnit||hover?.x===v.x&&hover?.y===v.y)&&<><rect x={p.x-14} y={top} width="28" height="2" fill="#191d14"/><rect x={p.x-14} y={top} width={28*v.hp/v.maxHp} height="2" fill={v.side==='player'?'#81a866':'#bf644b'}/></>}
   {(selectedUnit||npc&&hover?.x===v.x&&hover?.y===v.y)&&<text x={p.x} y={top-4} textAnchor="middle" fill="#ede6c3" fontSize="8" stroke="#11180f" strokeWidth="2" paintOrder="stroke">{v.nickname||v.name}{npc&&v.ai?.activity?` · ${(NPC_ACTIVITY_LABELS as any)[v.ai.activity]}`:""}</text>}
   {hover?.x===v.x&&hover?.y===v.y&&v.side==='enemy'&&v.hp>0&&!v.surrendered&&u&&hasFirearm(u)&&contextualAttack(s,u,v,{type:mode,aim}).type==='fire'&&<text x={p.x} y={top-5} textAnchor="middle" fill="#f2d5a0" fontSize="10" stroke="#11180f" strokeWidth="2" paintOrder="stroke">{shotChance(s,u,v,aim,hitLocation)}%</text>}
  </g>;
 };
 for(const v of units.filter(v=>!v.fled&&isInteriorVisible(s,v,revealed))){const at=positions[v.id]??v;add(`unit-${v.id}`,at.x,at.y,drawPerson(v),.05);}
 for(const npc of s.npcs??[])if(isInteriorVisible(s,npc,revealed)&&players.some(p=>canSee(s,p,npc))){const at=positions[npc.id]??npc;add(`npc-${npc.id}`,at.x,at.y,drawPerson({...npc,hp:npc.hp??100,maxHp:npc.maxHp??100,side:'player'},true),.05);}
 for(const a of s.artillery??[]){const p=project(a.x,a.y);add(`gun-${a.id}`,a.x,a.y,<g role="button" tabIndex={0} aria-label={`Seleccionar ${(ARTILLERY as any)[a.type].name}`} onClick={()=>onCannon(a.id)} onKeyDown={e=>{if(e.key==='Enter')onCannon(a.id);}}>{a.id===cannonId&&<ellipse cx={p.x} cy={p.y} rx="24" ry="10" fill="none" stroke="#d8bf7e"/>}<image href="/art/cannon.png" x={p.x-38} y={p.y-58} width="76" height="76" pointerEvents="none" style={{filter:`brightness(${light(a.x,a.y)})`}}/></g>);}
 for(const pile of groundLootPiles(s,players))if(isInteriorVisible(s,pile,revealed)){
  const p=project(pile.x,pile.y),point={x:pile.x,y:pile.y,loot:true};
  add(`equipment-${pile.x}-${pile.y}`,pile.x,pile.y,<g data-ground-equipment="true" role="button" tabIndex={0} aria-label={`Equipo en ${tacticalGridLabel(pile.x,pile.y)} · ${pile.count} objeto(s)`} onMouseEnter={()=>onHover(point)} onMouseLeave={()=>onHover(null)} onFocus={()=>onHover(point)} onBlur={()=>onHover(null)} onClick={()=>onTile(point)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onTile(point);}}}>
   <ellipse cx={p.x} cy={p.y} rx="17" ry="10" fill="#243123" stroke="#d8bf7e" strokeWidth="1"/>
   <path d={`M${p.x-8},${p.y-4}h16v8h-16zM${p.x},${p.y-4}v8`} fill="#837452" stroke="#ebd39a" strokeWidth="1" pointerEvents="none"/>
   {pile.count>1&&<text x={p.x+11} y={p.y+9} textAnchor="middle" fill="#fff2c7" stroke="#18261d" strokeWidth="2" paintOrder="stroke" fontSize="10" pointerEvents="none">{pile.count}</text>}
  </g>,.02);
 }
 for(const [i,l] of (s.lights??[]).entries())if(isInteriorVisible(s,l,revealed)){const p=project(l.x,l.y);add(`light-${i}`,l.x,l.y,<g pointerEvents="none"><ellipse cx={p.x} cy={p.y-4} rx="3" ry="7" fill="#efa242"/><ellipse cx={p.x} cy={p.y-5} rx="1.5" ry="4" fill="#ffe3a0"/></g>,.03);}
 return <>
  <defs>{materials.map(name=><pattern key={name} id={`terrain-${name}`} patternUnits="userSpaceOnUse" width="128" height="128" patternTransform={['plaster','roof','wood'].includes(name)?undefined:'matrix(1 .538 -1 .538 0 0)'}><image href={`/art/terrain-${name}-v1.webp`} width="128" height="128"/></pattern>)}<radialGradient id="smokefill"><stop offset="0" stopColor="#d4ccae" stopOpacity=".65"/><stop offset="1" stopColor="#d4ccae" stopOpacity="0"/></radialGradient></defs>
  <g>{s.tiles.map((t:any)=>{const p=project(t.x,t.y),key=`${t.x},${t.y}`,isHover=hover?.x===t.x&&hover?.y===t.y,occupant=units.find(v=>v.x===t.x&&v.y===t.y&&!v.fled);return <g key={key} role="button" tabIndex={0} aria-label={`${tacticalGridLabel(t.x,t.y)}${occupant?', '+occupant.name:(t.blocked||propBlocksAt(s,t.x,t.y))?', obstáculo':', accesible'}`} onClick={()=>onTile(t)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onTile(t);}}} onMouseEnter={()=>onHover(t)} onMouseLeave={()=>onHover(null)} onFocus={()=>onHover(t)} onBlur={()=>onHover(null)}><polygon points={diamond(p.x,p.y)} fill={t.type==='water'?'#516b67':`url(#terrain-${material(t)})`} stroke="none"/>{t.type==='water'&&<path d={`M${p.x-17},${p.y}l15,-3m-5,9l20,-3`} stroke="#a8b9a6" opacity=".22" strokeWidth=".7"/>}{s.night&&<polygon points={diamond(p.x,p.y)} fill="#050914" opacity={.78*(1-tileIllumination(s,t.x,t.y))} pointerEvents="none"/>}{showSight&&<polygon points={diamond(p.x,p.y)} fill={sight.has(key)?'#69ac54':'#a94536'} opacity=".32" pointerEvents="none"/>}{isHover&&<polygon points={diamond(p.x,p.y)} fill={mode==='move'&&reachableSet.has(key)?'#d8dca1':'#bd6f4d'} fillOpacity=".16" stroke="#ddd6a7" strokeWidth="1" pointerEvents="none"/>}</g>;})}</g>
  {objects.sort((a,b)=>a.depth-b.depth||a.key.localeCompare(b.key)).map(o=><g key={o.key}>{o.node}</g>)}
  {(s.smoke??[]).map((v:any,i:number)=>{const p=project(v.x,v.y);return <ellipse key={i} cx={p.x} cy={p.y-24} rx={32*v.radius} ry={23*v.radius} fill="url(#smokefill)" pointerEvents="none"/>})}
  {heard&&heardPoint&&<g className="ja2-noise-marker" aria-label="Ruido: zona aproximada" pointerEvents="none"><ellipse cx={heardPoint.x} cy={heardPoint.y} rx={Math.max(26,heard.radius*26)} ry={Math.max(14,heard.radius*14)} fill="#d4b35a" fillOpacity=".08" stroke="#e7ca7d" strokeWidth="1.5" strokeDasharray="4 4"/><text x={heardPoint.x} y={heardPoint.y+4} textAnchor="middle" fill="#fff0b7" fontSize="17" fontWeight="bold" stroke="#282316" strokeWidth="3" paintOrder="stroke">?</text></g>}
 </>;
}
