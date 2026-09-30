'use client';
import {useMemo} from 'react';
import {isInteriorVisible} from '../../game/tactical-visibility.js';
import {visibleRooms,canSee} from '../../game/tactical.js';
type Props={state:any;units:any[];selected:any;project:(x:number,y:number)=>{x:number;y:number};width:number;height:number;camera:{x:number;y:number;width:number;height:number};onCenter:(x:number,y:number)=>void};
export default function TacticalMinimap({state,units,selected,project,width,height,camera,onCenter}:Props){
 const revealed=useMemo(()=>new Set([...(state.revealedRooms??[]),...visibleRooms(state)]),[state]);
 const players=useMemo(()=>state.units.filter((u:any)=>u.side==='player'),[state]);
 const colors:Record<string,string>={grass:'#73744c',forest:'#3c5439',scrub:'#697249',road:'#a08b5c',floor:'#9d8061',water:'#4b7271',wall:'#c0b592',window:'#a89e7c',door:'#786344',stone:'#777662',mud:'#74644b'};
 // One compound path per color replaces thousands of independent mini tiles.
 const terrain=useMemo(()=>{
  const paths=new Map<string,string[]>();
  for(const t of state.tiles){const p=project(t.x,t.y),color=!isInteriorVisible(state,t,revealed)?'#685037':colors[t.type]??'#736f51';if(!paths.has(color))paths.set(color,[]);paths.get(color)!.push(`M${p.x},${p.y-14}l26,14-26,14-26,-14Z`);}
  return [...paths].map(([color,paths])=><path key={color} d={paths.join('')} fill={color}/>);
 },[state,project,revealed]);
 const markers=useMemo(()=>units.filter(u=>u.hp>0&&!u.fled&&isInteriorVisible(state,u,revealed)&&(u.side==='player'||players.some((p:any)=>canSee(state,p,u)))).map(u=>{const p=project(u.x,u.y);return <circle key={u.id} cx={p.x} cy={p.y} r={u.id===selected?11:7} fill={u.side==='player'?'#dcdf9d':'#d7755a'}/>;}),[state,units,revealed,players,project,selected]);
 return <svg className="tactical-minimap" viewBox={`0 0 ${width} ${height}`} role="button" tabIndex={0} aria-label="Minimapa del sector. Clic para centrar; flechas para desplazar la cámara." onClick={e=>{const matrix=e.currentTarget.getScreenCTM();if(!matrix)return;const point=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());onCenter(point.x,point.y);}} onKeyDown={e=>{const offsets:Record<string,[number,number]>={ArrowLeft:[-80,0],ArrowRight:[80,0],ArrowUp:[0,-60],ArrowDown:[0,60]};const d=offsets[e.key];if(d){e.preventDefault();e.stopPropagation();onCenter(camera.x+camera.width/2+d[0],camera.y+camera.height/2+d[1]);}}}>
  <rect width={width} height={height} fill="#17211a"/>
  {terrain}

  {markers}
  <rect x={camera.x} y={camera.y} width={camera.width} height={camera.height} fill="none" stroke="#ded387" strokeWidth="6"/>
 </svg>;
}
