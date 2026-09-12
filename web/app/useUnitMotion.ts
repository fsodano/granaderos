'use client';
import { useEffect, useRef, useState } from 'react';
import { getReachable } from '../../game/tactical.js';
import {sameCell,sameSurface,spaceKey,tacticalLevel,surfacesAtLevel} from '../../game/tactical-space.js';
import {surfaceMotionPoint,type SurfaceRenderOffset} from '../lib/tactical-elevation';

type Point = {x:number;y:number;tacticalLevel?:number;kind?:string;linkId?:string;renderedHeight?:number;renderedOffset?:SurfaceRenderOffset};
type Motion = Point & {direction:number;frame:number;moving:boolean;elapsedMs?:number};
type Track = {points:Point[];start:number;step:number;direction:number;preservedDirection?:number};
export type MovementFacingOverride = {battle:any;unitId:string;direction:number};
type OverrideHolder = {current:MovementFacingOverride|null};
export function motionActivity(battle:any,positions:Record<string,Motion>){
  const present=(actor:any)=>!actor.departure&&!actor.fled&&!(actor.hp<=0)&&!actor.unconscious;
  const moving=(actor:any)=>present(actor)&&Boolean(positions[actor.id]?.moving);
  const combat=battle.mode!=='exploration';
  // Patrols and civilian routines continue in the background during exploration.
  // Orders still wait for squad movement, and for every actor during combat.
  return {
    moving:battle.units.some(moving)||(battle.npcs??[]).some(moving),
    blocking:battle.units.some((actor:any)=>moving(actor)&&(combat||actor.side==='player'))||combat&&(battle.npcs??[]).some(moving),
  };
}
export function takeMovementFacingOverride(holder:OverrideHolder|undefined,battle:any){
  const command=holder?.current;if(holder)holder.current=null;
  return command?.battle===battle?command:null;
}
// Screen compass after the map's isometric projection, clockwise from north.
export function motionDirection(a:Point,b:Point,preservedDirection?:number){if(preservedDirection!==undefined)return preservedDirection;const dx=(b.x-a.x)-(b.y-a.y),dy=(b.x-a.x)+(b.y-a.y);return (Math.round(Math.atan2(dx,-dy)/ (Math.PI/4))+8)%8;}
export function movementRoute(previous:any,unit:any,target:Point,charge=false,preserveFacing=false):Point[]{
  const recorded=(target as any).lastMovePath;
  if(Array.isArray(recorded)&&recorded.length&&sameCell(recorded.at(-1),target)&&(recorded[0].kind==='climb'||sameSurface(unit,recorded[0])&&Math.max(Math.abs(recorded[0].x-unit.x),Math.abs(recorded[0].y-unit.y))===1))return [unit,...recorded];
  const dx=target.x-unit.x,dy=target.y-unit.y;
  if(charge&&sameSurface(unit,target)&&(dx===0||dy===0||Math.abs(dx)===Math.abs(dy))){
    const points=[unit];for(let i=1;i<=Math.max(Math.abs(dx),Math.abs(dy));i++)points.push({x:unit.x+Math.sign(dx)*i,y:unit.y+Math.sign(dy)*i,tacticalLevel:tacticalLevel(unit)});
    if(points.every(p=>surfacesAtLevel(previous,tacticalLevel(p)).some((t:any)=>sameCell(t,p)&&!t.blocked)))return points;
  }
  // Animation needs one destination, not a full-map movement overlay. Stop when
  // the same pathfinder settles that cell, preserving its route and tie order.
  const reachable=getReachable({...previous,status:'active',mode:'exploration'},unit,{stopAt:(point:any)=>sameCell(point,target),...(preserveFacing?{movementIntent:'preserveFacing'}:{})}).find((p:any)=>sameCell(p,target));
  if(reachable?.path)return [unit,...reachable.path];
  // A charge may be diagonal; a resolved turn can end on a previously occupied
  // cell. Traverse terrain, allowing the authoritative destination to be reached.
  if(!sameSurface(unit,target))return [unit,target];
  const queue:Point[][]=[[unit]],seen=new Set([spaceKey(unit)]),tiles=surfacesAtLevel(previous,tacticalLevel(unit));
  for(let i=0;i<queue.length;i++){const path=queue[i],p=path[path.length-1];if(sameCell(p,target))return path;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=p.x+dx,y=p.y+dy,next={x,y,tacticalLevel:tacticalLevel(unit)},key=spaceKey(next);if(seen.has(key)||!tiles.some((t:any)=>sameCell(t,next)&&!t.blocked))continue;seen.add(key);queue.push([...path,next]);}}
  return [unit,target];
}
export function sampleMovementSegment(a:Point,b:Point,fraction:number){
  const offsetA=a.renderedOffset??{x:0,y:0,height:0},offsetB=b.renderedOffset??{x:0,y:0,height:0};
  return {x:a.x+(b.x-a.x)*fraction,y:a.y+(b.y-a.y)*fraction,tacticalLevel:tacticalLevel(b),renderedHeight:(a.renderedHeight??0)+((b.renderedHeight??0)-(a.renderedHeight??0))*fraction,
    renderedOffset:{x:offsetA.x+(offsetB.x-offsetA.x)*fraction,y:offsetA.y+(offsetB.y-offsetA.y)*fraction,height:offsetA.height+(offsetB.height-offsetA.height)*fraction}};
}
export function useUnitMotion(battle:any,override?:OverrideHolder){
  const previous=useRef(battle),tracks=useRef(new Map<string,Track>()),positions=useRef<Record<string,Motion>>({});
  const [snapshot,setSnapshot]=useState<Record<string,Motion>>({});
  useEffect(()=>{
    const before=previous.current,now=performance.now(),command=takeMovementFacingOverride(override,battle);
    const actors=[...battle.units.filter((unit:any)=>!unit.departure&&!unit.fled),...(battle.npcs??[])],oldActors=[...before.units,...(before.npcs??[])];
    const ids=new Set(actors.map((v:any)=>v.id));for(const id of Object.keys(positions.current))if(!ids.has(id)){delete positions.current[id];tracks.current.delete(id);}
    for(const unit of actors){const old=oldActors.find((v:any)=>v.id===unit.id);if(unit.hp<=0||unit.unconscious){tracks.current.delete(unit.id);positions.current[unit.id]={...surfaceMotionPoint(battle,{x:unit.x,y:unit.y,tacticalLevel:tacticalLevel(unit)}),direction:positions.current[unit.id]?.direction??(unit.side==='enemy'?7:3),frame:0,moving:false};continue;}if(old&&!sameCell(old,unit)){
      const preservedDirection=command&&command.unitId===unit.id?command.direction:undefined;
      const points=movementRoute(before,old,unit,battle.log?.slice(before.log.length).some((text:string)=>text.startsWith(`${unit.name} ejecuta una carga`)),preservedDirection!==undefined).map(point=>surfaceMotionPoint(before,point,battle));tracks.current.set(unit.id,{points,start:now,step:(unit.mounted?150:unit.stance==='prone'||unit.movementMode==='prone'?420:unit.movementMode==='crouch'?320:unit.movementMode==='run'?150:240)*(preservedDirection!==undefined?1.25:1),direction:preservedDirection??positions.current[unit.id]?.direction??3,preservedDirection});
    }else if(!tracks.current.has(unit.id))positions.current[unit.id]={...surfaceMotionPoint(battle,{x:unit.x,y:unit.y,tacticalLevel:tacticalLevel(unit)}),direction:positions.current[unit.id]?.direction??(unit.side==='player'?3:7),frame:0,moving:false};}
    previous.current=battle;let request=0;
    const tick=(time:number)=>{for(const [id,track] of tracks.current){const elapsed=Math.max(0,time-track.start),progress=elapsed/track.step,index=Math.floor(progress),last=track.points.length-1;
      if(index>=last){positions.current[id]={...track.points[last],direction:track.direction,frame:0,moving:false};tracks.current.delete(id);continue;}
      const a=track.points[index],b=track.points[index+1],fraction=progress-index;if(a.x!==b.x||a.y!==b.y)track.direction=motionDirection(a,b,track.preservedDirection);
      positions.current[id]={...sampleMovementSegment(a,b,fraction),direction:track.direction,frame:Math.floor(elapsed/100)%8,elapsedMs:elapsed,moving:true};
    }setSnapshot({...positions.current});if(tracks.current.size)request=requestAnimationFrame(tick);};
    tick(now);return()=>cancelAnimationFrame(request);
  },[battle]);
  return {positions:snapshot,...motionActivity(battle,snapshot)};
}
