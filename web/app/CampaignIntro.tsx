'use client';
import {sitePath} from '../lib/site-path.js';
import {useEffect,useRef,useState} from 'react';
import opening from '../../game/campaign-intro.json';
import './campaign-intro.css';

type Scene={id:string;eyebrow:string;title:string;text:string;portrait?:string;portraitAlt?:string;visual:string;durationMs:number};
type Content={id:string;version:number;title:string;scenes:Scene[]};
type Props={onComplete:(destination:'hire'|'create')=>void;onBack:()=>void;replay?:boolean;content?:Content};

function CampaignMap({route=false}:{route?:boolean}){
 return <svg className={`intro-map${route?' intro-map-route':''}`} viewBox="0 0 620 640" aria-hidden="true">
  <defs><pattern id="intro-grid" width="62" height="64" patternUnits="userSpaceOnUse"><path d="M62 0H0V64" fill="none" stroke="currentColor" strokeWidth=".5"/></pattern></defs>
  <rect width="620" height="640" fill="url(#intro-grid)" opacity=".18"/>
  <path className="intro-land" d="M0 0H485L477 65 490 100 467 160 475 188 446 220 470 242 443 267 460 290 417 310 433 340 409 365 445 389 428 418 377 447 352 490 323 521 310 570 283 620 271 640H0Z"/>
  <path className="intro-river" d="M404 50C420 120 381 175 406 232S423 310 417 347L445 389"/>
  <path className="intro-mountains" d="M140 36l-10 34 16-8-12 40 21-9-16 40 20-5-15 44 16-11-12 44 21-8-15 41 20-7-12 47 15-9-13 45 17-10-10 41 16-6-13 43 22-11-11 42 16-5-5 39 18-7-9 48"/>
  <g className="intro-map-labels"><text x="54" y="87">CORDILLERA</text><text x="74" y="109">DE LOS ANDES</text><text x="463" y="472" transform="rotate(-18 463 472)">ATLÁNTICO</text><text x="110" y="585" className="intro-map-caption">PROVINCIAS UNIDAS DEL RÍO DE LA PLATA</text></g>
  <path className="intro-campaign-route" pathLength="1" d="M417 367Q370 336 362 292T309 234L282 169 278 114M362 292Q293 343 220 350"/>
  <g className="intro-map-towns"><circle cx="417" cy="367" r="6"/><text x="429" y="352">BUENOS AIRES</text><circle cx="362" cy="292" r="4"/><text x="376" y="285">LITORAL</text><circle cx="278" cy="114" r="4"/><text x="292" y="113">EL NORTE</text><circle cx="220" cy="350" r="4"/><text x="233" y="373">CUYO</text></g>
  <circle className="intro-beacon" cx="417" cy="367" r="21"/>
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
  <header className="intro-topbar"><button onClick={onBack}>← Volver</button><span>GRANADEROS <i>1812</i></span><button onClick={()=>onComplete('hire')}>{replay?'Cerrar introducción':'Omitir introducción'} →</button></header>
  <div className={`intro-stage intro-stage-${scene.visual}`} data-intro-scene={scene.id}>
   <div className="intro-visual" key={scene.id} aria-hidden="true">
    {scene.portrait?<div className="intro-portrait"><img src={sitePath(scene.portrait)} alt=""/><div className="intro-signature">José de San Martín</div><span>AL SERVICIO DE LA CAUSA AMERICANA</span></div>:<CampaignMap route={scene.visual==='route'||scene.visual==='muster'}/>}
    {scene.visual==='muster'&&<div className="intro-seal"><span>G</span><small>RETIRO</small></div>}
   </div>
   <div className="intro-message"><div aria-live="polite" aria-atomic="true"><p className="intro-eyebrow">{scene.eyebrow}</p><h1>{scene.title}</h1><div className="intro-rule"/><p className="intro-body">{scene.text}</p></div>
    {last?<div className="intro-choices">{replay?<button className="intro-primary" onClick={()=>onComplete('hire')}>Volver al juego →</button>:<><button className="intro-primary" onClick={()=>onComplete('hire')}>Contratar combatientes →</button><button className="intro-secondary" onClick={()=>onComplete('create')}>Crear mi granadero →</button></>}</div>:<button className="intro-next" onClick={()=>showScene(index+1)}>Siguiente <span>→</span></button>}
   </div>
  </div>
  <footer className="intro-footer"><nav aria-label="Escenas de la introducción">{content.scenes.map((item,number)=><button key={item.id} aria-label={`Ver escena ${number+1}`} aria-current={number===index?'step':undefined} onClick={()=>showScene(number)}><span>{String(number+1).padStart(2,'0')}</span><i/></button>)}</nav><div className="intro-playback"><span>{String(index+1).padStart(2,'0')} / {String(content.scenes.length).padStart(2,'0')}</span>{!last&&!reduced&&<button onClick={()=>setPaused(value=>!value)}>{paused?'Reproducir':'Pausar'}</button>}{reduced&&<span>Avance manual</span>}</div></footer>
 </section>;
}
