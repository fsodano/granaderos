'use client';
import { useEffect, useRef, useState, useMemo } from 'react';
import { getReachable,teamCanSee } from '../../game/tactical.js';
import {sameCell,sameSurface,spaceKey,tacticalLevel,surfacesAtLevel} from '../../game/tactical-space.js';
import {surfaceMotionPoint,type SurfaceRenderOffset} from '../lib/tactical-elevation';
import {movementStepDuration} from '../lib/three/movement-timing';

type Point = {x:number;y:number;tacticalLevel?:number;kind?:string;linkId?:string;renderedHeight?:number;renderedOffset?:SurfaceRenderOffset};
export type Motion = Point & {direction:number;frame:number;moving:boolean;settled?:boolean;elapsedMs?:number;speed?:number;segmentFraction?:number;climbDirection?:number;travelX?:number;travelY?:number;elapsedDistance?:number;elapsedTravelX?:number;elapsedTravelY?:number};
type Track = {points:Point[];start:number;animationOffset:number;distanceOffset:number;travelOffsetX:number;travelOffsetY:number;steps:number[];duration:number;direction:number;preservedDirection?:number};
const MOTION_FRAME_MS=1000/60,MOTION_FRAME_TOLERANCE_MS=1;
export type MovementFacingOverride = {battle:any;unitId:string;direction:number};
type OverrideHolder = {current:MovementFacingOverride|null};
export const actorMotionKey=(kind:'unit'|'npc',id:string)=>`${kind}:${id}`;
const actors=(battle:any)=>[...battle.units.map((unit:any)=>({unit,key:actorMotionKey('unit',unit.id),kind:'unit'})),...(battle.npcs??[]).map((unit:any)=>({unit,key:actorMotionKey('npc',unit.id),kind:'npc'}))];
const admitted=(set:ReadonlySet<string>|undefined,key:string,id:string)=>!set||set.has(key)||set.has(id);
export function motionActivity(battle:any,positions:Record<string,Motion>){
  const moving=({unit,key}:any)=>!unit.departure&&!unit.fled&&!(unit.hp<=0)&&!unit.unconscious&&Boolean((positions[key]??positions[unit.id])?.moving);
  const combat=battle.mode!=='exploration',entries=actors(battle);
  return {moving:entries.some(moving),blocking:entries.some(actor=>moving(actor)&&(combat||actor.kind==='unit'&&actor.unit.side==='player'))};
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
  return {kind:b.kind,linkId:b.linkId,travelX:b.x-a.x,travelY:b.y-a.y,segmentFraction:fraction,climbDirection:Math.sign((b.renderedHeight??0)-(a.renderedHeight??0)),x:a.x+(b.x-a.x)*fraction,y:a.y+(b.y-a.y)*fraction,tacticalLevel:tacticalLevel(b),renderedHeight:(a.renderedHeight??0)+((b.renderedHeight??0)-(a.renderedHeight??0))*fraction,
    renderedOffset:{x:offsetA.x+(offsetB.x-offsetA.x)*fraction,y:offsetA.y+(offsetB.y-offsetA.y)*fraction,height:offsetA.height+(offsetB.height-offsetA.height)*fraction}};
}
export function presentationMovementEndpoint(unit:any):Point{
  const recorded=unit.lastMovePath?.at(-1);
  return recorded&&sameCell(recorded,unit)?{...unit,...recorded}:unit;
}
export function motionTransitions(before:any,battle:any,previousVisible?:ReadonlySet<string>,visible?:ReadonlySet<string>){
  const oldActors=new Map(actors(before).filter(({unit,key})=>admitted(previousVisible,key,unit.id)).map(({unit,key})=>[key,unit]));
  return actors(battle).filter(({unit,key})=>!unit.departure&&!unit.fled&&admitted(visible,key,unit.id)).map(({unit,key,kind})=>({unit,key,kind,old:oldActors.get(key)}));
}
export function useUnitMotion(battle:any,override?:OverrideHolder,visibleIds?:ReadonlySet<string>,continuingIds?:ReadonlySet<string>){
  // Retain presentation-state callers while the live scene supplies explicit sets.
  const presentedVisible=useMemo(()=>battle.presentationVisibleIds?new Set<string>(battle.presentationVisibleIds):undefined,[battle.presentationVisibleIds]);
  const presentedContinuing=useMemo(()=>battle.presentationMovingUnitId?new Set<string>([battle.presentationMovingUnitId]):undefined,[battle.presentationMovingUnitId]);
  visibleIds??=presentedVisible;continuingIds??=presentedContinuing;
  const previous=useRef(battle),tracks=useRef(new Map<string,Track>()),positions=useRef<Record<string,Motion>>({});
  const previousVisible=useRef(visibleIds);
  const [snapshot,setSnapshot]=useState<Record<string,Motion>>({});
  useEffect(()=>{
    const before=previous.current,command=takeMovementFacingOverride(override,battle),started:Track[]=[];
    const beforeVisible=previousVisible.current??(visibleIds?new Set([...before.units,...(before.npcs??[])].filter(actor=>actor.side==='player'||teamCanSee(before,'player',actor)).map(actor=>actor.id)):undefined);
    const transitions=motionTransitions(before,battle,beforeVisible,visibleIds);
    const ids=new Set(transitions.map(({key})=>key));for(const id of Object.keys(positions.current))if(!ids.has(id)){delete positions.current[id];tracks.current.delete(id);}
    for(const {unit,old,key} of transitions){if(unit.hp<=0||unit.unconscious){tracks.current.delete(key);positions.current[key]={...surfaceMotionPoint(battle,{x:unit.x,y:unit.y,tacticalLevel:tacticalLevel(unit)}),direction:positions.current[key]?.direction??(unit.side==='enemy'?7:3),frame:0,moving:false,settled:true};continue;}if(old&&!sameCell(old,unit)){
      const preservedDirection=command&&command.unitId===unit.id?command.direction:undefined;
      const points=(battle.presentationStepMs?[old,presentationMovementEndpoint(unit)]:movementRoute(before,old,unit,battle.log?.slice(before.log.length).some((text:string)=>text.startsWith(`${unit.name} ejecuta una carga`)),preservedDirection!==undefined)).map(point=>surfaceMotionPoint(before,point,battle)),track={points,start:0,animationOffset:0,distanceOffset:0,travelOffsetX:0,travelOffsetY:0,steps:points.slice(1).map((point,index)=>movementStepDuration(unit,points[index],point,battle.presentationStepMs,preservedDirection!==undefined)),duration:0,direction:preservedDirection??positions.current[key]?.direction??3,preservedDirection};track.duration=track.steps.reduce((sum,step)=>sum+step,0);tracks.current.set(key,track);started.push(track);
    }else if(!tracks.current.has(key)&&!((continuingIds?.has(key)||continuingIds?.has(unit.id))&&positions.current[key]?.moving))positions.current[key]={...surfaceMotionPoint(battle,{x:unit.x,y:unit.y,tacticalLevel:tacticalLevel(unit)}),direction:positions.current[key]?.direction??(unit.side==='player'?3:7),frame:0,moving:false,settled:true};}
    // Route preparation must not consume animation frames. Carry only time
    // spent moving so a wait between cells cannot jump over walking poses.
    const now=performance.now();for(const [id,track]of tracks.current)if(started.includes(track)){track.start=now;const continuing=continuingIds?.has(id)||continuingIds?.has(id.slice(id.indexOf(':')+1));track.animationOffset=continuing?positions.current[id]?.elapsedMs??0:0;track.distanceOffset=continuing?positions.current[id]?.elapsedDistance??0:0;track.travelOffsetX=continuing?positions.current[id]?.elapsedTravelX??0:0;track.travelOffsetY=continuing?positions.current[id]?.elapsedTravelY??0:0;}
    previous.current=battle;previousVisible.current=visibleIds;let request=0,nextPublication=now,lastPublication=-Infinity,nextFinish=Infinity;
    const tick=(time:number)=>{
      // High-refresh displays still use the real rAF clock, but target
      // 60 position snapshots per second. Keep the deadline on its phase and
      // allow small timestamp jitter without waiting a third 120 Hz frame.
      const due=time+MOTION_FRAME_TOLERANCE_MS>=nextPublication&&time-lastPublication+MOTION_FRAME_TOLERANCE_MS>=MOTION_FRAME_MS;
      if(!due&&time<nextFinish){request=requestAnimationFrame(tick);return;}
      if(time+MOTION_FRAME_TOLERANCE_MS>=nextPublication)nextPublication+=Math.max(1,Math.floor((time-nextPublication+MOTION_FRAME_TOLERANCE_MS)/MOTION_FRAME_MS)+1)*MOTION_FRAME_MS;
      lastPublication=time;nextFinish=Infinity;
      for(const [id,track] of tracks.current){const elapsed=Math.max(0,time-track.start),last=track.points.length-1,animationElapsed=track.animationOffset+Math.min(elapsed,track.duration);
      let index=0,segmentStart=0;while(index<last&&elapsed+.000001>=segmentStart+track.steps[index]){segmentStart+=track.steps[index];index++;}
      const segment=Math.min(index,last-1),fraction=index>=last?1:Math.min(1,Math.max(0,(elapsed-segmentStart)/track.steps[segment]));let travelled=0;for(let i=0;i<segment;i++)travelled+=Math.hypot(track.points[i+1].x-track.points[i].x,track.points[i+1].y-track.points[i].y);const from=track.points[segment],to=track.points[segment+1];travelled+=Math.hypot(to.x-from.x,to.y-from.y)*fraction;const distanceFields={elapsedDistance:track.distanceOffset+travelled,elapsedTravelX:track.travelOffsetX+from.x+(to.x-from.x)*fraction-track.points[0].x,elapsedTravelY:track.travelOffsetY+from.y+(to.y-from.y)*fraction-track.points[0].y,travelX:to.x-from.x,travelY:to.y-from.y};
      if(index>=last){const continuing=Boolean((continuingIds?.has(id)||continuingIds?.has(id.slice(id.indexOf(':')+1))));positions.current[id]={...track.points[last],segmentFraction:1,climbDirection:Math.sign((to.renderedHeight??0)-(from.renderedHeight??0)),direction:track.direction,frame:continuing?Math.floor(animationElapsed/100)%8:0,moving:continuing,settled:true,...distanceFields,...(continuing?{elapsedMs:animationElapsed}:{})};tracks.current.delete(id);continue;}
      nextFinish=Math.min(nextFinish,track.start+track.duration);
      const a=track.points[index],b=track.points[index+1];if(a.x!==b.x||a.y!==b.y)track.direction=motionDirection(a,b,track.preservedDirection);
      positions.current[id]={...sampleMovementSegment(a,b,fraction),...distanceFields,direction:track.direction,frame:Math.floor(animationElapsed/100)%8,elapsedMs:animationElapsed,speed:Math.hypot(b.x-a.x,b.y-a.y)*1000/track.steps[index],moving:true,settled:false};
    }setSnapshot({...positions.current});if(tracks.current.size)request=requestAnimationFrame(tick);};
    tick(now);return()=>cancelAnimationFrame(request);
  },[battle,visibleIds,continuingIds]);
  const aliases=useMemo(()=>{const result:Record<string,Motion>={};for(const {unit,key}of actors(battle))if(snapshot[key]&&!Object.hasOwn(result,unit.id))result[unit.id]=snapshot[key];return result;},[battle,snapshot]);
  return {positions:aliases,actorPositions:snapshot,...motionActivity(battle,snapshot)};
}
