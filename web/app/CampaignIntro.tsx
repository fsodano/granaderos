'use client';
import {sitePath} from '../lib/site-path.js';
import {useEffect,useRef,useState} from 'react';
import './campaign-intro.css';

type Scene={id:string;eyebrow:string;title:string;text:string;portrait?:string;portraitAlt?:string;portraitName?:string;portraitCaption?:string;seal?:{letter:string;label:string};visual:string;durationMs:number};
type Content={id:string;version:number;title:string;wordmark?:string;period?:string;createLabel?:string;chart?:any;scenes:Scene[]};
const opening:Content={id:'opening',version:1,title:'Introducción',scenes:[{id:'start',eyebrow:'CAMPAÑA',title:'Prepará a tu escuadra',text:'Elegí a tu primer combatiente o creá un personaje para comenzar.',visual:'muster',durationMs:0}]};
type Props={onComplete:(destination:'hire'|'create')=>void;onBack:()=>void;replay?:boolean;content?:Content};

function CampaignMap({route=false,chart}:{route?:boolean;chart?:any}){
 return <svg className={`intro-map${route?' intro-map-route':''}`} viewBox="0 0 620 640" aria-hidden="true">
  <defs><pattern id="intro-grid" width="62" height="64" patternUnits="userSpaceOnUse"><path d="M62 0H0V64" fill="none" stroke="currentColor" strokeWidth=".5"/></pattern></defs>
  <rect width="620" height="640" fill="url(#intro-grid)" opacity=".18"/>
  {chart?.land&&<path className="intro-land" d={chart.land}/>}
  {chart?.river&&<path className="intro-river" d={chart.river}/>}
  {chart?.mountains&&<path className="intro-mountains" d={chart.mountains}/>}
  <g className="intro-map-labels">{chart?.labels?.map((label:any,index:number)=><text key={index} x={label.x} y={label.y} transform={label.transform} className={label.className}>{label.text}</text>)}</g>
  {chart?.route&&<path className="intro-campaign-route" pathLength="1" d={chart.route}/>}
  <g className="intro-map-towns">{chart?.towns?.map((town:any,index:number)=><g key={index}><circle cx={town.x} cy={town.y} r={town.r??4}/><text x={town.textX??town.x+12} y={town.textY??town.y}>{town.text}</text></g>)}</g>
  {chart?.beacon&&<circle className="intro-beacon" cx={chart.beacon.x} cy={chart.beacon.y} r="21"/>}
  <g transform="translate(525 80)" className="intro-compass"><path d="M0-31 7-7 31 0 7 7 0 31-7 7-31 0-7-7Z"/><path d="M0-42V42M-42 0H42"/><text x="0" y="-50" textAnchor="middle">N</text></g>
 </svg>;
}

export default function CampaignIntro({onComplete,onBack,replay=false,content=opening}:Props){
 const [index,setIndex]=useState(0),[paused,setPaused]=useState(false),[reduced,setReduced]=useState(false),[hidden,setHidden]=useState(false);
 const root=useRef<HTMLElement>(null),focusAfter=useRef(false),scene=content.scenes[index],last=index===content.scenes.length-1;
 function showScene(next:number){focusAfter.current=Boolean(root.current?.contains(document.activeElement));setIndex(next);}
 useEffect(()=>{
  if(focusAfter.current&&!root.current?.contains(document.activeElement))root.current?.querySelector<HTMLButtonElement>('.intro-choices button, .intro-next')?.focus({preventScroll:true});
  focusAfter.current=false;
 },[index]);
 useEffect(()=>{
  root.current?.focus({preventScroll:true});
  const media=window.matchMedia?.('(prefers-reduced-motion: reduce)'),update=()=>setReduced(Boolean(media?.matches));update();media?.addEventListener('change',update);
  const visibility=()=>setHidden(document.hidden);visibility();document.addEventListener('visibilitychange',visibility);
  return()=>{media?.removeEventListener('change',update);document.removeEventListener('visibilitychange',visibility);};
 },[]);
 const playing=!paused&&!reduced&&!hidden&&!last;
 useEffect(()=>{
  if(!playing||!scene.durationMs)return;
  const timer=window.setTimeout(()=>showScene(Math.min(index+1,content.scenes.length-1)),scene.durationMs);
  return()=>window.clearTimeout(timer);
 },[index,playing,scene.durationMs,content.scenes.length]);
 return <section ref={root} tabIndex={-1} className="campaign-intro" data-campaign-intro="true" data-paused={paused||hidden} data-reduced-motion={reduced} aria-label={content.title} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();onBack();}}}>
  <header className="intro-topbar"><button onClick={onBack}>← Volver</button><span>{content.wordmark??content.title} <i>{content.period}</i></span><button onClick={()=>onComplete('hire')}>{replay?'Cerrar introducción':'Omitir introducción'} →</button></header>
  <div className={`intro-stage intro-stage-${scene.visual}`} data-intro-scene={scene.id}>
   <div className="intro-visual" key={scene.id} aria-hidden="true">
    {scene.portrait?<div className="intro-portrait"><img src={sitePath(scene.portrait)} alt=""/>{scene.portraitName&&<div className="intro-signature">{scene.portraitName}</div>}{scene.portraitCaption&&<span>{scene.portraitCaption}</span>}</div>:<CampaignMap chart={content.chart} route={scene.visual==='route'||scene.visual==='muster'}/>}
    {scene.seal&&<div className="intro-seal"><span>{scene.seal.letter}</span><small>{scene.seal.label}</small></div>}
   </div>
   <div className="intro-message"><div aria-live="polite" aria-atomic="true"><p className="intro-eyebrow">{scene.eyebrow}</p><h1>{scene.title}</h1><div className="intro-rule"/><p className="intro-body">{scene.text}</p></div>
    {last?<div className="intro-choices">{replay?<button className="intro-primary" onClick={()=>onComplete('hire')}>Volver al juego →</button>:<><button className="intro-primary" onClick={()=>onComplete('hire')}>Contratar combatientes →</button><button className="intro-secondary" onClick={()=>onComplete('create')}>{content.createLabel??'Crear mi personaje'} →</button></>}</div>:<button className="intro-next" onClick={()=>showScene(index+1)}>Siguiente <span>→</span></button>}
   </div>
  </div>
  <footer className="intro-footer"><nav aria-label="Escenas de la introducción">{content.scenes.map((item,number)=><button key={item.id} aria-label={`Ver escena ${number+1}`} aria-current={number===index?'step':undefined} onClick={()=>showScene(number)}><span>{String(number+1).padStart(2,'0')}</span><i/></button>)}</nav><div className="intro-playback"><span>{String(index+1).padStart(2,'0')} / {String(content.scenes.length).padStart(2,'0')}</span>{!last&&!reduced&&<button onClick={()=>setPaused(value=>!value)}>{paused?'Reproducir':'Pausar'}</button>}{reduced&&<span>Avance manual</span>}</div></footer>
 </section>;
}
