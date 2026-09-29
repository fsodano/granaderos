'use client';
import { useEffect, useRef, useState } from 'react';
import { getReachable,teamCanSee } from '../../game/tactical.js';

type Point = {x:number;y:number};
type Motion = Point & {direction:number;frame:number;moving:boolean;elapsedMs?:number};
type Track = {points:Point[];start:number;animationStart:number;step:number;direction:number};
// Screen compass after the map's isometric projection, clockwise from north.
function facing(a:Point,b:Point){const dx=(b.x-a.x)-(b.y-a.y),dy=(b.x-a.x)+(b.y-a.y);return (Math.round(Math.atan2(dx,-dy)/ (Math.PI/4))+8)%8;}
function route(previous:any,unit:any,target:Point,charge=false):Point[]{
  const recorded=(target as any).lastMovePath;
  if(Array.isArray(recorded)&&recorded.length&&Math.abs(recorded[0].x-unit.x)+Math.abs(recorded[0].y-unit.y)===1&&recorded.at(-1).x===target.x&&recorded.at(-1).y===target.y)return [unit,...recorded];
  const dx=target.x-unit.x,dy=target.y-unit.y;
  if(charge&&(dx===0||dy===0||Math.abs(dx)===Math.abs(dy))){
    const points=[unit];for(let i=1;i<=Math.max(Math.abs(dx),Math.abs(dy));i++)points.push({x:unit.x+Math.sign(dx)*i,y:unit.y+Math.sign(dy)*i});
    if(points.every(p=>previous.tiles.some((t:any)=>t.x===p.x&&t.y===p.y&&!t.blocked)))return points;
  }
  const reachable=getReachable({...previous,status:'active',mode:'exploration'},unit).find((p:any)=>p.x===target.x&&p.y===target.y);
  if(reachable?.path)return [unit,...reachable.path];
  // A charge may be diagonal; a resolved turn can end on a previously occupied
  // cell. Traverse terrain, allowing the authoritative destination to be reached.
  const queue:Point[][]=[[unit]],seen=new Set([`${unit.x},${unit.y}`]);
  for(let i=0;i<queue.length;i++){const path=queue[i],p=path[path.length-1];if(p.x===target.x&&p.y===target.y)return path;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=p.x+dx,y=p.y+dy,key=`${x},${y}`;if(seen.has(key)||!previous.tiles.some((t:any)=>t.x===x&&t.y===y&&!t.blocked))continue;seen.add(key);queue.push([...path,{x,y}]);}}
  return [unit,target];
}
export function useUnitMotion(battle:any){
  const previous=useRef(battle),tracks=useRef(new Map<string,Track>()),positions=useRef<Record<string,Motion>>({});
  const gaitStarts=useRef(new Map<string,number>());
  const [snapshot,setSnapshot]=useState<Record<string,Motion>>({});
  useEffect(()=>{
    const before=previous.current,started:Track[]=[],continuingId=battle.presentationMovingUnitId;
    for(const id of gaitStarts.current.keys())if(id!==continuingId)gaitStarts.current.delete(id);
    const beforeVisible=battle.presentationVisibleIds?new Set(before.presentationVisibleIds??before.units.filter((v:any)=>v.side==='player'||teamCanSee(before,'player',v)).map((v:any)=>v.id)):null;
    const actors=[...battle.units,...(battle.npcs??[])],oldActors=[...before.units,...(before.npcs??[])];
    const ids=new Set(actors.map((v:any)=>v.id));for(const id of Object.keys(positions.current))if(!ids.has(id)){delete positions.current[id];tracks.current.delete(id);gaitStarts.current.delete(id);}
    for(const unit of actors){const old=oldActors.find((v:any)=>v.id===unit.id);if(battle.presentationVisibleIds&&(!battle.presentationVisibleIds.includes(unit.id)||!beforeVisible?.has(unit.id))||unit.hp<=0||unit.unconscious){tracks.current.delete(unit.id);gaitStarts.current.delete(unit.id);positions.current[unit.id]={x:unit.x,y:unit.y,direction:positions.current[unit.id]?.direction??(unit.side==='enemy'?7:3),frame:0,moving:false};continue;}if(old&&(old.x!==unit.x||old.y!==unit.y)){
      const points=battle.presentationStepMs?[old,unit]:route(before,old,unit,battle.log?.slice(before.log.length).some((text:string)=>text.startsWith(`${unit.name} ejecuta una carga`)));const track={points,start:0,animationStart:0,step:battle.presentationStepMs??(unit.mounted?150:unit.stance==='prone'||unit.movementMode==='prone'?420:unit.movementMode==='crouch'?320:unit.movementMode==='run'?150:240),direction:positions.current[unit.id]?.direction??3};tracks.current.set(unit.id,track);started.push(track);
    }else if(!tracks.current.has(unit.id)&&!(unit.id===continuingId&&positions.current[unit.id]?.moving))positions.current[unit.id]={x:unit.x,y:unit.y,direction:positions.current[unit.id]?.direction??(unit.side==='player'?3:7),frame:0,moving:false};}
    // Route work must finish before the first visible frame starts. Consecutive
    // enemy cells share one gait clock instead of replaying pose zero each cell.
    const now=performance.now();for(const [id,track]of tracks.current)if(started.includes(track)){track.start=now;track.animationStart=gaitStarts.current.get(id)??now;if(id===continuingId)gaitStarts.current.set(id,track.animationStart);}
    previous.current=battle;let request=0;
    const tick=(time:number)=>{for(const [id,track] of tracks.current){const elapsed=Math.max(0,time-track.start),animationElapsed=Math.max(0,time-track.animationStart),progress=elapsed/track.step,index=Math.floor(progress),last=track.points.length-1;
      if(index>=last){positions.current[id]={...track.points[last],direction:track.direction,frame:id===continuingId?Math.floor(animationElapsed/100)%8:0,moving:id===continuingId,...(id===continuingId?{elapsedMs:animationElapsed}:{})};tracks.current.delete(id);continue;}
      const a=track.points[index],b=track.points[index+1],fraction=progress-index;track.direction=facing(a,b);
      positions.current[id]={x:a.x+(b.x-a.x)*fraction,y:a.y+(b.y-a.y)*fraction,direction:track.direction,frame:Math.floor(animationElapsed/100)%8,elapsedMs:animationElapsed,moving:true};
    }setSnapshot({...positions.current});if(tracks.current.size)request=requestAnimationFrame(tick);};
    tick(now);return()=>cancelAnimationFrame(request);
  },[battle]);
  return {positions:snapshot,moving:Object.values(snapshot).some(p=>p.moving)};
}
