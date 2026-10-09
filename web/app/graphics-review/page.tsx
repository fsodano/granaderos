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
  {id:'terrain-detail',name:'Terreno'},
  {id:'furnishings',name:'Mobiliario'},
] as const;

/** Compact review surface; all orders and presentation use the real battlefield. */
export default function GraphicsReview(){
  const [scene,setScene]=useState('characters');
  const [stance,setStance]=useState('standing');
  const [gear,setGear]=useState('family');
  const [facing,setFacing]=useState('3');
  const [version,setVersion]=useState(0);
  const [battle,setBattle]=useState(()=>createRendererSandboxBattle('characters'));
  function reset(id:string,nextStance=stance,nextGear=gear,nextFacing=facing){setScene(id);setBattle(createRendererSandboxBattle(id==='characters'?`characters:${nextStance}:${nextGear}:${nextFacing}`:id));setVersion(value=>value+1);}
  return <main className="game-shell graphics-review">
    <nav aria-label="Revisión gráfica">
      <strong>Revisión gráfica</strong>
      {scenes.map(item=><button className="line-button" key={item.id} aria-pressed={scene===item.id} onClick={()=>reset(item.id)}>{item.name}</button>)}
      <button className="line-button" onClick={()=>reset(scene)}>Reiniciar</button>
      <a href={sitePath('/renderer-sandbox')}>Más escenas</a>
      {scene==='characters'&&<>
        <label>Postura <select aria-label="Postura de los personajes" value={stance} onChange={event=>{setStance(event.target.value);reset(scene,event.target.value);}}><option value="standing">De pie</option><option value="crouched">Agachados</option><option value="prone">Cuerpo a tierra</option></select></label>
        <label>Equipo <select aria-label="Equipo de los personajes" value={gear} onChange={event=>{setGear(event.target.value);reset(scene,stance,event.target.value);}}><option value="family">Por familia</option><option value="unarmed">Sin arma</option><option value="rifle">Fusil</option><option value="pistol">Pistola</option><option value="sabre">Sable</option><option value="knife">Cuchillo</option><option value="paired-pistols">Dos pistolas</option></select></label>
        <label>Vista <select aria-label="Vista de los personajes" value={facing} onChange={event=>{setFacing(event.target.value);reset(scene,stance,gear,event.target.value);}}><option value="3">Frente</option><option value="5">Perfil</option><option value="7">Espalda</option></select></label>
      </>}
    </nav>
    <Battlefield key={version} battle={battle} onChange={next=>{setBattle(next);return next;}} onFinish={()=>{}}/>
  </main>;
}
