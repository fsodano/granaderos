'use client';
import {useEffect,useRef,useState} from 'react';
import {startRasterProfile,readRasterProfile} from '../lib/rasterize-svg';

// Opt-in diagnostics on the real campaign screen; no replacement scene or save.
export default function CampaignPerformance({campaign,battle,screen}:{campaign:any;battle:any;screen:string}){
 const [enabled,setEnabled]=useState(false),[running,setRunning]=useState(false),[result,setResult]=useState(''),[duration,setDuration]=useState(6);
 const current=useRef({campaign,battle,screen});current.current={campaign,battle,screen};
 useEffect(()=>{const query=new URLSearchParams(window.location.search);setEnabled(query.get('qa')==='1'&&query.get('performance')==='1');},[]);
 useEffect(()=>{
  if(!running)return;
  startRasterProfile();
  const party=()=>current.current.battle?.units.filter((u:any)=>u.side==='player').map((u:any)=>({id:u.id,x:u.x,y:u.y,energy:u.energy,movementMode:u.movementMode,unconscious:Boolean(u.unconscious)}));
  const startParty=party();
  let frame=0,last=0,start=0;const gaps:number[]=[],moving:number[]=[],tasks:{at:number;duration:number}[]=[],slowFrames:any[]=[],positionGaps:number[]=[];const motionSamples=new Map<string,{point:string;at:number}>();
  const walkingSprites=new Map<string,{unitId:string;name:string;direction:number;phases:number[];changes:number;samples:number;fractionalPositions:number}>();
  const observer=typeof PerformanceObserver==='undefined'?null:new PerformanceObserver(list=>{for(const entry of list.getEntries()){if(entry.entryType==='long-animation-frame')slowFrames.push(entry.toJSON());else tasks.push({at:entry.startTime-start,duration:entry.duration});}});
  if(observer)observer.observe({entryTypes:['longtask','long-animation-frame'].filter(type=>PerformanceObserver.supportedEntryTypes.includes(type))});
  const stats=(values:number[])=>{const sorted=[...values].sort((a,b)=>a-b);return {frames:values.length,meanMs:values.length?values.reduce((a,b)=>a+b,0)/values.length:0,p95Ms:sorted[Math.floor(sorted.length*.95)]??0,maxMs:sorted.at(-1)??0,over16_8ms:values.filter(v=>v>16.8).length};};
  const tick=(now:number)=>{
   if(!start){start=now;last=now;}else{const gap=now-last;last=now;gaps.push(gap);if(document.querySelector('[data-moving="true"]'))moving.push(gap);}
   const movingActors=document.querySelectorAll('[data-unit-id][data-moving="true"]'),activeIds=new Set<string>();
   for(const actor of movingActors){const id=actor.getAttribute('data-unit-id')!,hit=actor.querySelector('[data-person-hit-target]');if(!hit)continue;activeIds.add(id);const point=`${hit.getAttribute('x')},${hit.getAttribute('y')}`,previous=motionSamples.get(id);if(!previous)motionSamples.set(id,{point,at:now});else if(previous.point!==point){positionGaps.push(now-previous.at);motionSamples.set(id,{point,at:now});}}
   for(const actor of movingActors){
    const sprite=actor.querySelector('[data-playback="movement"]'),atlas=sprite?.querySelector('svg'),placement=sprite?.querySelector('[data-sprite-position]');if(!atlas||!placement)continue;
    const [left,top,cell]=String(atlas.getAttribute('viewBox')).split(' ').map(Number);if(!(cell>0))continue;
    const unitId=actor.getAttribute('data-unit-id')!,name=sprite!.getAttribute('data-sprite')!,direction=top/cell,key=`${unitId}:${name}:${direction}`;
    let entry=walkingSprites.get(key);if(!entry){entry={unitId,name,direction,phases:[],changes:0,samples:0,fractionalPositions:0};walkingSprites.set(key,entry);}
    const phase=left/cell;entry.samples++;if(entry.phases.at(-1)!==phase){entry.changes++;if(entry.phases.length<200)entry.phases.push(phase);}
    const point=placement.getAttribute('transform')?.match(/translate\(([-\d.e]+)[ ,]+([-\d.e]+)\)/);if(point&&(!Number.isInteger(Number(point[1]))||!Number.isInteger(Number(point[2]))))entry.fractionalPositions++;
   }
   for(const id of motionSamples.keys())if(!activeIds.has(id))motionSamples.delete(id);
   if(now-start<duration*1000){frame=requestAnimationFrame(tick);return;}
   const {campaign,battle,screen}=current.current;
   setResult(JSON.stringify({screen,campaign:Boolean(campaign),sector:battle?.sectorId,players:battle?.units.filter((u:any)=>u.side==='player'&&u.hp>0).length,startParty,endParty:party(),actors:document.querySelectorAll('[data-unit-id]').length,svgElements:document.querySelectorAll('svg *').length,cachedLayers:document.querySelectorAll('[data-static-layer="cached"]').length,all:stats(gaps),moving:stats(moving),positionUpdates:stats(positionGaps),walkingSprites:[...walkingSprites.values()],longTasks:tasks.slice(0,30),raster:readRasterProfile({stop:true}).stages,slowFrames:slowFrames.sort((a,b)=>b.duration-a.duration).slice(0,3)}));setRunning(false);
  };
  frame=requestAnimationFrame(tick);return()=>{cancelAnimationFrame(frame);observer?.disconnect();};
 },[running,duration]);
 if(!enabled)return null;
 return <aside aria-label="Campaign performance" style={{position:'fixed',right:8,top:104,zIndex:10000,maxWidth:560,padding:8,background:'#111',color:'#fff',fontSize:12}}><select aria-label="Measurement duration" disabled={running} value={duration} onChange={event=>setDuration(Number(event.target.value))}><option value={6}>6 seconds</option><option value={20}>20 seconds · long walk</option></select><button disabled={running} onClick={()=>{setResult(`Measuring for ${duration} seconds`);setRunning(true);}}>Measure campaign FPS</button><output aria-label="Campaign frame measurements" style={{display:'block',maxHeight:150,overflow:'auto',overflowWrap:'anywhere'}}>{result}</output></aside>;
}
