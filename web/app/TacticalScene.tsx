'use client';
import SpriteFigure from './SpriteFigure';
import {canSee,tileIllumination,shotChance,ARTILLERY} from '../../game/tactical.js';
import type {ReactNode} from 'react';
type Props={state:any;selected:any;unit:any;players:any[];units:any[];positions:any;poses:any;directions:any;hover:any;mode:string;aim:number;reachable:any[];showSight:boolean;sight:Set<string>;revealed:Set<string>;project:(x:number,y:number)=>{x:number;y:number};onTile:(t:any)=>void;onHover:(t:any)=>void;onTalk:(n:any)=>void;onCannon:(id:string)=>void;cannonId:string};
const materials=['dry-grass','dirt','cobble','green-grass','mud','floor','plaster','roof','wood'];
const diamond=(x:number,y:number)=>`${x},${y-14} ${x+26},${y} ${x},${y+14} ${x-26},${y}`;
const hash=(x:number,y:number)=>((x*374761393+y*668265263)>>>0)%1000;
export default function TacticalScene({state:s,selected,unit:u,players,units,positions,poses,directions,hover,mode,aim,reachable,showSight,sight,revealed,project,onTile,onHover,onTalk,onCannon,cannonId}:Props){
 const objects:{depth:number;key:string;node:ReactNode}[]=[];
 const add=(key:string,x:number,y:number,node:ReactNode,bias=0)=>objects.push({key,depth:x+y+bias,node});
 const reachableSet=new Set(reachable.map(t=>`${t.x},${t.y}`));
 const light=(x:number,y:number)=>s.night?.27+tileIllumination(s,x,y)*.73:1;
 const material=(t:any)=>t.type==='road'?'dirt':t.type==='stone'?'cobble':t.type==='mud'?'mud':t.type==='floor'?'floor':t.type==='forest'?'green-grass':'dry-grass';
 for(const t of s.tiles){
  const p=project(t.x,t.y);
  if(['wall','door','window'].includes(t.type)){
   const building=s.buildings?.find((b:any)=>b.id===t.buildingId),open=building?.rooms.some((r:any)=>revealed.has(r.id));
   const front=building&&(t.x===building.x+building.width-1||t.y===building.y+building.height-1),height=open&&front&&t.type==='wall'?10:40;
   const x=p.x,y=p.y;
   add(`wall-${t.x}-${t.y}`,t.x,t.y,<g style={{filter:`brightness(${light(t.x,t.y)})`}} pointerEvents="none">
    <path d={`M${x-26},${y}v-${height}l26,-14 26,14v${height}l-26,14Z`} fill="url(#terrain-plaster)"/>
    <path d={`M${x},${y+14}v-${height}l26,-14v${height}Z`} fill="#29281e" opacity=".27"/>
    <path d={`M${x-26},${y-height}l26,-14 26,14-26,14Z`} fill="url(#terrain-plaster)"/>
    {t.type!=='wall'&&<g><path d={`M${x-9},${y+5}v-${t.type==='window'?29:37}l18,-9v${t.type==='window'?29:37}Z`} fill="#1c2018" stroke="#d4c6a5" strokeWidth="3"/>{t.type==='door'?<path d={`M${x-8},${y+4}v-35l16,-8v35Z`} fill="url(#terrain-wood)" stroke="#50422d" transform={t.open?`translate(15 -7) scale(.28 1)`:undefined}/>:<path d={`M${x},${y-32}v29M${x-8},${y-13}l16,-8`} stroke="#7f755b" strokeWidth="2"/>}</g>}
   </g>);
  }else if(t.blocked&&t.type!=='water'){
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
 for(const b of s.buildings??[])for(const room of b.rooms??[])if(!revealed.has(room.id)&&room.cells.length){
  const xs=room.cells.map((c:any)=>c.x),ys=room.cells.map((c:any)=>c.y),left=Math.min(...xs)-1,right=Math.max(...xs)+1,top=Math.min(...ys)-1,bottom=Math.max(...ys)+1,middle=(left+right)/2;
  const roof=(x:number,y:number,ridge=false)=>{const p=project(x,y);return `${p.x},${p.y-40-(ridge?20:0)}`;};
  add(`roof-${room.id}`,right,bottom,<g data-roof-room={room.id} pointerEvents="none" style={{filter:`brightness(${light(left,top)})`}}><polygon points={[roof(left,top),roof(middle,top,true),roof(middle,bottom,true),roof(left,bottom)].join(' ')} fill="url(#terrain-roof)" stroke="#51452f"/><polygon points={[roof(middle,top,true),roof(right,top),roof(right,bottom),roof(middle,bottom,true)].join(' ')} fill="url(#terrain-roof)" stroke="#51452f"/><polygon points={[roof(middle,top,true),roof(right,top),roof(right,bottom),roof(middle,bottom,true)].join(' ')} fill="#171b12" opacity=".25"/><path d={`M${roof(middle,top,true)} L${roof(middle,bottom,true)}`} stroke="#bb966a" strokeWidth="3"/></g>,.1);
 }
 const drawPerson=(v:any,npc=false)=>{
  const moving=positions[v.id]??{...v,direction:v.side==='enemy'?7:3,frame:0,moving:false};const p=project(moving.x,moving.y);
  const posture=v.hp<=0||v.unconscious||v.stance==='prone'||v.movementMode==='prone'?'prone':v.movementMode==='crouch'?'crouch':'standing';
  const selectedUnit=v.id===selected,top=p.y-(v.mounted?72:posture==='prone'?24:49);
  return <g data-unit-id={v.id} data-moving={moving.moving} data-direction={moving.direction} data-posture={posture} role="button" tabIndex={0} aria-label={npc?`Hablar con ${v.name}`:`${v.name} · ${v.hp<=0?'caído':Math.ceil(v.hp)+' salud'}`} onClick={()=>npc?onTalk(v):onTile(v)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();npc?onTalk(v):onTile(v);}}} opacity={v.hp<=0?.7:1}>
   <ellipse cx={p.x+5} cy={p.y+2} rx={v.mounted?21:11} ry="4" fill="#13150f" opacity=".5" pointerEvents="none"/>
   {selectedUnit&&<ellipse cx={p.x} cy={p.y} rx="15" ry="6" fill="none" stroke="#dacb86" strokeWidth="1" pointerEvents="none"/>}
   <g style={{filter:`brightness(${light(moving.x,moving.y)})${npc?' sepia(.55)':''}`}}><SpriteFigure unit={{...v,...(posture==='prone'?{stance:'prone'}:{})}} position={p} motion={{...moving,direction:!moving.moving&&poses[v.id]&&poses[v.id]!=='idle'?(directions[v.id]??moving.direction):moving.direction}} pose={poses[v.id]??'idle'} drawSize={52}/></g>
   {!npc&&v.hp>0&&(selectedUnit||hover?.x===v.x&&hover?.y===v.y)&&<><rect x={p.x-14} y={top} width="28" height="2" fill="#191d14"/><rect x={p.x-14} y={top} width={28*v.hp/v.maxHp} height="2" fill={v.side==='player'?'#81a866':'#bf644b'}/></>}
   {(selectedUnit||npc&&hover?.x===v.x&&hover?.y===v.y)&&<text x={p.x} y={top-4} textAnchor="middle" fill="#ede6c3" fontSize="8" stroke="#11180f" strokeWidth="2" paintOrder="stroke">{v.nickname||v.name}</text>}
   {hover?.x===v.x&&hover?.y===v.y&&v.side==='enemy'&&u&&<text x={p.x} y={top-5} textAnchor="middle" fill="#f2d5a0" fontSize="10" stroke="#11180f" strokeWidth="2" paintOrder="stroke">{shotChance(s,u,v,aim)}%</text>}
  </g>;
 };
 for(const v of units.filter(v=>!v.fled)){const at=positions[v.id]??v;add(`unit-${v.id}`,at.x,at.y,drawPerson(v),.05);}
 for(const npc of s.npcs??[])if(players.some(p=>canSee(s,p,npc)))add(`npc-${npc.id}`,npc.x,npc.y,drawPerson({...npc,hp:100,maxHp:100,side:'player'},true),.05);
 for(const a of s.artillery??[]){const p=project(a.x,a.y);add(`gun-${a.id}`,a.x,a.y,<g role="button" tabIndex={0} aria-label={`Seleccionar ${(ARTILLERY as any)[a.type].name}`} onClick={()=>onCannon(a.id)} onKeyDown={e=>{if(e.key==='Enter')onCannon(a.id);}}>{a.id===cannonId&&<ellipse cx={p.x} cy={p.y} rx="24" ry="10" fill="none" stroke="#d8bf7e"/>}<image href="/art/cannon.png" x={p.x-38} y={p.y-58} width="76" height="76" pointerEvents="none" style={{filter:`brightness(${light(a.x,a.y)})`}}/></g>);}
 return <>
  <defs>{materials.map(name=><pattern key={name} id={`terrain-${name}`} patternUnits="userSpaceOnUse" width="128" height="128" patternTransform={['plaster','roof','wood'].includes(name)?undefined:'matrix(1 .538 -1 .538 0 0)'}><image href={`/art/terrain-${name}-v1.webp`} width="128" height="128"/></pattern>)}<radialGradient id="smokefill"><stop offset="0" stopColor="#d4ccae" stopOpacity=".65"/><stop offset="1" stopColor="#d4ccae" stopOpacity="0"/></radialGradient></defs>
  <g>{s.tiles.map((t:any)=>{const p=project(t.x,t.y),key=`${t.x},${t.y}`,isHover=hover?.x===t.x&&hover?.y===t.y,occupant=units.find(v=>v.x===t.x&&v.y===t.y&&!v.fled);return <g key={key} role="button" tabIndex={0} aria-label={`${String.fromCharCode(65+t.y)}${t.x+1}${occupant?', '+occupant.name:t.blocked?', obstáculo':', accesible'}`} onClick={()=>onTile(t)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onTile(t);}}} onMouseEnter={()=>onHover(t)} onMouseLeave={()=>onHover(null)}><polygon points={diamond(p.x,p.y)} fill={t.type==='water'?'#516b67':`url(#terrain-${material(t)})`} stroke="none"/>{t.type==='water'&&<path d={`M${p.x-17},${p.y}l15,-3m-5,9l20,-3`} stroke="#a8b9a6" opacity=".22" strokeWidth=".7"/>}{s.night&&<polygon points={diamond(p.x,p.y)} fill="#050914" opacity={.78*(1-tileIllumination(s,t.x,t.y))} pointerEvents="none"/>}{showSight&&<polygon points={diamond(p.x,p.y)} fill={sight.has(key)?'#69ac54':'#a94536'} opacity=".32" pointerEvents="none"/>}{isHover&&<polygon points={diamond(p.x,p.y)} fill={mode==='move'&&reachableSet.has(key)?'#d8dca1':'#bd6f4d'} fillOpacity=".16" stroke="#ddd6a7" strokeWidth="1" pointerEvents="none"/>}</g>;})}</g>
  {objects.sort((a,b)=>a.depth-b.depth||a.key.localeCompare(b.key)).map(o=><g key={o.key}>{o.node}</g>)}
  {(s.droppedWeapons??[]).filter((d:any)=>!d.taken).map((d:any,i:number)=>{const p=project(d.x,d.y);return <path key={i} d={`M${p.x-8},${p.y+3}l16,-6`} stroke="#b3a781" strokeWidth="2" pointerEvents="none"/>})}
  {(s.lights??[]).map((l:any,i:number)=>{const p=project(l.x,l.y);return <g key={i} pointerEvents="none"><ellipse cx={p.x} cy={p.y-4} rx="3" ry="7" fill="#efa242"/><ellipse cx={p.x} cy={p.y-5} rx="1.5" ry="4" fill="#ffe3a0"/></g>})}
  {(s.smoke??[]).map((v:any,i:number)=>{const p=project(v.x,v.y);return <ellipse key={i} cx={p.x} cy={p.y-24} rx={32*v.radius} ry={23*v.radius} fill="url(#smokefill)" pointerEvents="none"/>})}
 </>;
}
