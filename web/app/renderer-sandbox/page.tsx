'use client';
import {useState} from 'react';
import Battlefield from '../Battlefield';
import {createRendererSandboxBattle,RENDERER_SCENARIOS} from './fixtures';

export default function RendererSandbox(){
  const [scenario,setScenario]=useState('combat');
  const [battle,setBattle]=useState(()=>createRendererSandboxBattle('combat'));
  const [version,setVersion]=useState(0);
  function reset(id:string){setScenario(id);setBattle(createRendererSandboxBattle(id));setVersion(value=>value+1);}
  const help=RENDERER_SCENARIOS.find(item=>item.id===scenario)?.help;
  return <main className="game-shell">
    <nav style={{display:'flex',gap:8,padding:'8px 16px',alignItems:'center',flexWrap:'wrap'}} aria-label="Pruebas del sector">
      <strong>Prueba del sector 3D</strong>
      {RENDERER_SCENARIOS.map(item=><button className="line-button" key={item.id} aria-pressed={scenario===item.id} onClick={()=>reset(item.id)}>{item.label}</button>)}
      <button className="line-button" onClick={()=>reset(scenario)}>Reiniciar escena</button>
    </nav>
    <p style={{margin:'0 16px 8px',fontSize:12}} aria-live="polite">{help}</p>
    <Battlefield key={version} battle={battle} onChange={next=>{setBattle(next);return next;}} onFinish={()=>{}}/>
  </main>;
}
