'use client';
import {useState} from 'react';
import Battlefield from '../Battlefield';
import {createRendererSandboxBattle} from '../renderer-sandbox/fixtures';
import {sitePath} from '../../lib/site-path';
import './review.css';

const scenes=[
  {id:'characters',name:'Personajes'},
  {id:'postures',name:'Posturas'},
  {id:'combat',name:'Armas'},
  {id:'tucuman',name:'Terreno'},
  {id:'furnishings',name:'Mobiliario'},
] as const;

/** Compact review surface; all orders and presentation use the real battlefield. */
export default function GraphicsReview(){
  const [scene,setScene]=useState('characters');
  const [version,setVersion]=useState(0);
  const [battle,setBattle]=useState(()=>createRendererSandboxBattle('characters'));
  function reset(id:string){setScene(id);setBattle(createRendererSandboxBattle(id));setVersion(value=>value+1);}
  return <main className="game-shell graphics-review">
    <nav aria-label="Revisión gráfica">
      <strong>Revisión gráfica</strong>
      {scenes.map(item=><button className="line-button" key={item.id} aria-pressed={scene===item.id} onClick={()=>reset(item.id)}>{item.name}</button>)}
      <button className="line-button" onClick={()=>reset(scene)}>Reiniciar</button>
      <a href={sitePath('/renderer-sandbox')}>Más escenas</a>
    </nav>
    <Battlefield key={version} battle={battle} onChange={next=>{setBattle(next);return next;}} onFinish={()=>{}}/>
  </main>;
}
