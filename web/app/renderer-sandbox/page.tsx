'use client';
import {useState} from 'react';
import Battlefield from '../Battlefield';
import {createRendererSandboxBattle,RENDERER_SCENARIOS,CROUCH_REVIEW_EQUIPMENT} from './fixtures';
import {BUILDING_TYPES} from '../../../game/building-types.js';
import {ARCHITECTURE_REVIEW_TEMPLATES,ARCHITECTURE_REVIEW_ROOFS} from './architecture-fixtures.js';
import {PRONE_WORK_TASKS} from './prone-work-fixture.js';
import './sandbox.css';

export default function RendererSandbox(){
  const [scenario,setScenario]=useState('combat');
  const [battle,setBattle]=useState(()=>createRendererSandboxBattle('combat'));
  const [version,setVersion]=useState(0);
  const [architectureType,setArchitectureType]=useState('all');
  const [catalogTemplate,setCatalogTemplate]=useState('casa');
  const [catalogRotation,setCatalogRotation]=useState(0);
  const [catalogView,setCatalogView]=useState('exterior');
  const [catalogRoof,setCatalogRoof]=useState('original');
  const [crouchEquipment,setCrouchEquipment]=useState('long-gun');
  const [reachPosture,setReachPosture]=useState('standing');
  const [proneTask,setProneTask]=useState('rifle-prime');
  function reset(id:string,type='all',template=catalogTemplate,rotation=catalogRotation,view=catalogView,roof=catalogRoof){
    setScenario(id);setArchitectureType(type);setCatalogTemplate(template);setCatalogRotation(rotation);setCatalogView(view);setCatalogRoof(roof);
    setBattle(createRendererSandboxBattle(id==='catalog'?`catalog:${template}:${rotation}:${view}:${roof}`:id==='architecture'&&type!=='all'?`architecture:${type}`:id==='equipped-crouch'?`equipped-crouch:${crouchEquipment}`:id==='prone-work'?`prone-work:${proneTask}`:id==='reach-actions'?`reach-actions:${reachPosture}`:id));setVersion(value=>value+1);
  }
  const help=RENDERER_SCENARIOS.find(item=>item.id===scenario)?.help;
  return <main className="game-shell renderer-sandbox">
    <nav style={{display:'flex',gap:8,padding:'8px 16px',alignItems:'center',flexWrap:'wrap'}} aria-label="Pruebas del sector">
      <strong>Prueba del sector 3D</strong>
      {RENDERER_SCENARIOS.map(item=><button className="line-button" key={item.id} aria-pressed={scenario===item.id} onClick={()=>reset(item.id)}>{item.label}</button>)}
      <button className="line-button" onClick={()=>reset(scenario,architectureType)}>Reiniciar escena</button>
      {scenario==='prone-work'&&<label>Trabajo <select aria-label="Trabajo de armas cuerpo a tierra" value={proneTask} onChange={event=>{const task=event.target.value;setProneTask(task);setBattle(createRendererSandboxBattle(`prone-work:${task}`));setVersion(value=>value+1);}}>{PRONE_WORK_TASKS.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}
      {scenario==='reach-actions'&&<label>Postura <select aria-label="Postura de las interacciones" value={reachPosture} onChange={event=>{const posture=event.target.value;setReachPosture(posture);setBattle(createRendererSandboxBattle(`reach-actions:${posture}`));setVersion(value=>value+1);}}><option value="standing">De pie</option><option value="prone">Cuerpo a tierra</option></select></label>}
      {scenario==='equipped-crouch'&&<label>Equipo <select aria-label="Equipo del movimiento agachado" value={crouchEquipment} onChange={event=>{const gear=event.target.value;setCrouchEquipment(gear);setBattle(createRendererSandboxBattle(`equipped-crouch:${gear}`));setVersion(value=>value+1);}}>{CROUCH_REVIEW_EQUIPMENT.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}
      {scenario==='architecture'&&<label>Edificio <select aria-label="Edificio a revisar" value={architectureType} onChange={event=>reset('architecture',event.target.value)}><option value="all">Todos</option>{Object.entries(BUILDING_TYPES).map(([id,type])=><option key={id} value={id}>{type.name}</option>)}</select></label>}
      {scenario==='catalog'&&<>
        <label>Edificio <select aria-label="Edificio del catálogo" value={catalogTemplate} onChange={event=>reset('catalog','all',event.target.value)}>{ARCHITECTURE_REVIEW_TEMPLATES.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label>Orientación <select aria-label="Orientación del edificio" value={catalogRotation} onChange={event=>reset('catalog','all',catalogTemplate,Number(event.target.value))}>{[0,90,180,270].map(angle=><option key={angle} value={angle}>{angle}°</option>)}</select></label>
        <label>Vista <select aria-label="Vista del edificio" value={catalogView} onChange={event=>reset('catalog','all',catalogTemplate,catalogRotation,event.target.value)}><option value="exterior">Exterior</option><option value="partial">Primera sala</option><option value="interior">Interior completo</option></select></label>
        <label>Tejado <select aria-label="Tejado del edificio" value={catalogRoof} onChange={event=>reset('catalog','all',catalogTemplate,catalogRotation,catalogView,event.target.value)}>{ARCHITECTURE_REVIEW_ROOFS.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      </>}
    </nav>
    <p style={{margin:'0 16px 8px',fontSize:12}} aria-live="polite">{help}</p>
    <Battlefield key={version} battle={battle} onChange={next=>{setBattle(next);return next;}} onFinish={()=>{}}/>
  </main>;
}
