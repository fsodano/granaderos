'use client';
import {useState} from 'react';
import {actBattle} from '../../game/tactical.js';
import {sectorDeploymentModel} from '../../game/sector-deployment.js';
import './sector-deployment.css';

type Selection={unitId:string;wholeSquad:boolean};
type Props={battle:any;onChange:(battle:any)=>void;onMap?:()=>void};
type Cell={x:number;y:number};
type ArrivalUnit={id:string;name:string;nickname:string;edge:string;squadId:string;squadName:string;position:Cell|null};
type DeploymentModel={sectorName:string;width:number;height:number;units:ArrivalUnit[];cells:(Cell&{type:string;blocked:boolean})[];entryCells:Record<string,Cell[]>;ready:boolean;remaining:number};
const edgeName:Record<string,string>={N:'norte',E:'este',S:'sur',W:'oeste'};
const terrainColor:Record<string,string>={grass:'#526345',forest:'#344b36',road:'#9d8960',dirt:'#766343',sand:'#b3a075',water:'#354f5b',wall:'#777768',floor:'#91836c',stone:'#777b70',rock:'#666d66',snow:'#bdc4b5',mud:'#5d533c'};
const cellKey=(p:{x:number;y:number})=>`${p.x},${p.y}`;
const positionLabel=(p:{x:number;y:number}|null)=>p?`Columna ${p.x+1}, fila ${p.y+1}`:'Sin colocar';

// Keep selection in the view. Only explicit orders change the saved deployment.
export default function SectorDeployment(props:Props){
 const [selection,setSelection]=useState<Selection>({unitId:'',wholeSquad:false});
 return <SectorDeploymentPanel {...props} selection={selection} onSelection={setSelection}/>;
}

export function SectorDeploymentPanel({battle,onChange,onMap,selection,onSelection}:Props&{selection:Selection;onSelection:(selection:Selection)=>void}){
 const model=sectorDeploymentModel(battle) as DeploymentModel|null;if(!model)return null;
 const selected=model.units.find(u=>u.id===selection.unitId)??model.units[0];
 if(!selected)return null;
 const groups=[...new Map(model.units.map(u=>[u.squadId,{id:u.squadId,name:u.squadName}])).values()];
 const squad=model.units.filter(u=>u.squadId===selected.squadId);
 const chosen=selection.wholeSquad?squad.filter(u=>u.edge===selected.edge):[selected];
 const chosenIds=chosen.map(u=>u.id),entries=model.entryCells[selected.edge];
 const order=(action:any)=>onChange(actBattle(battle,action));
 const place=(x:number,y:number)=>order({type:'placeDeployment',unitIds:chosenIds,x,y});
 const terrain=new Map<string,string>();
 for(const cell of model.cells){const color=terrainColor[cell.type]??(cell.blocked?'#3a3d35':'#69684e');terrain.set(color,(terrain.get(color)??'')+`M${cell.x} ${cell.y}h1v1h-1z`);}
 const chooseUnit=(id:string)=>onSelection({...selection,unitId:id});
 const keyEntry=(event:React.KeyboardEvent<SVGRectElement>,x:number,y:number)=>{
  if(event.key==='Enter'||event.key===' '){event.preventDefault();place(x,y);return;}
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
  event.preventDefault();const cells=Array.from(event.currentTarget.parentElement!.querySelectorAll<SVGRectElement>('[data-deployment-cell]'));
  const index=cells.indexOf(event.currentTarget),direction=['ArrowLeft','ArrowUp'].includes(event.key)?-1:1;
  const next=event.key==='Home'?0:event.key==='End'?cells.length-1:(index+direction+cells.length)%cells.length;
  for(const cell of cells)cell.tabIndex=-1;cells[next].tabIndex=0;cells[next].focus();
 };
 const selectedName=selection.wholeSquad?`${selected.squadName} · ${chosen.length} combatientes`:selected.nickname;
 return <section className="sector-deployment" aria-label="Colocación de llegada">
  <header className="deployment-heading"><div><p>LLEGADA AL SECTOR</p><h1>{model.sectorName}</h1></div>{onMap&&<button className="line-button" onClick={onMap}>Carta de campaña</button>}</header>
  <div className="deployment-layout">
   <div className="deployment-map-panel">
    <p id="deployment-map-help"><strong>{selectedName}</strong> · Ingreso por el {edgeName[selected.edge]}. Elegí una casilla iluminada.</p>
    <div className="deployment-map-frame">
     <span className="deployment-compass north" aria-hidden="true">N</span><span className="deployment-compass east" aria-hidden="true">E</span><span className="deployment-compass south" aria-hidden="true">S</span><span className="deployment-compass west" aria-hidden="true">O</span>
     <svg className="deployment-map" viewBox={`-1 -1 ${model.width+2} ${model.height+2}`} role="group" aria-label={`Mapa de entrada: ${model.sectorName}`} aria-describedby="deployment-map-help deployment-key-help">
      <g aria-hidden="true" className="deployment-terrain">{[...terrain].map(([color,path])=><path key={color} d={path} fill={color}/>)}</g>
      <g className="deployment-entry-cells">{entries.map((p:any,index:number)=><rect key={cellKey(p)} x={p.x} y={p.y} width={1} height={1} className="deployment-entry" data-deployment-cell={cellKey(p)} role="button" tabIndex={index===0?0:-1} aria-label={`Colocar ${selectedName} en el borde ${edgeName[selected.edge]}, columna ${p.x+1}, fila ${p.y+1}`} onKeyDown={event=>keyEntry(event,p.x,p.y)} onClick={()=>place(p.x,p.y)}/>)}</g>
      <g className="deployment-markers" aria-hidden="true" pointerEvents="none">{model.units.filter(u=>u.position).map(u=>{const p=u.position!;return <g key={u.id} className={chosenIds.includes(u.id)?'selected':''}><rect x={p.x+.07} y={p.y+.07} width={.86} height={.86}/><text x={p.x+.5} y={p.y+.53} dominantBaseline="middle" textAnchor="middle">{model.units.indexOf(u)+1}</text></g>;})}</g>
     </svg>
    </div>
    <p id="deployment-key-help" className="deployment-key-help">Teclado: Tab al borde, flechas para elegir, Intro para colocar.</p>
   </div>
   <aside className="deployment-roster" aria-label="Combatientes que llegan">
    <label className="deployment-squad-label">Escuadra<select aria-label="Escuadra de llegada" value={selected.squadId} onChange={event=>{const unit=model.units.find(u=>u.squadId===event.target.value);if(unit)chooseUnit(unit.id);}}>{groups.map(group=><option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
    <div className="deployment-selection-mode" role="group" aria-label="Colocar un combatiente o su escuadra"><button aria-pressed={!selection.wholeSquad} onClick={()=>onSelection({...selection,wholeSquad:false})}>Uno</button><button aria-pressed={selection.wholeSquad} onClick={()=>onSelection({...selection,wholeSquad:true})}>Escuadra</button></div>
    <ol className="deployment-soldiers">{squad.map(unit=><li key={unit.id}><button aria-pressed={unit.id===selected.id} aria-label={`Seleccionar ${unit.name}. Ingreso por el ${edgeName[unit.edge]}. ${positionLabel(unit.position)}`} onClick={()=>chooseUnit(unit.id)}><span className="deployment-number">{model.units.indexOf(unit)+1}</span><span><strong>{unit.nickname}</strong><small>{positionLabel(unit.position)}</small></span><span className="deployment-check" aria-label={unit.position?'Colocado':'Sin colocar'}>{unit.position?'✓':'—'}</span></button></li>)}</ol>
    <button className="line-button deployment-clear" disabled={!chosen.some(u=>u.position)} onClick={()=>order({type:'clearDeployment',unitIds:chosenIds})}>Quitar selección del mapa</button>
   </aside>
  </div>
  <footer className="deployment-footer">
   <div className="deployment-progress"><p role="status" aria-live="polite">{model.ready?'Todos colocados. Listos para entrar.':`${model.units.length-model.remaining} de ${model.units.length} colocados · ${model.remaining} ${model.remaining===1?'pendiente':'pendientes'}`}</p>{battle.lastError&&<p className="deployment-error" role="alert">{battle.lastError}</p>}</div>
   <div className="deployment-actions"><button className="line-button" onClick={()=>order({type:'spreadDeployment'})}>Distribuir</button><button className="line-button" disabled={model.remaining===model.units.length} onClick={()=>order({type:'clearDeployment'})}>Quitar todos</button><button className="gold-button" disabled={!model.ready} onClick={()=>order({type:'confirmDeployment'})}>Entrar al sector</button></div>
  </footer>
 </section>;
}
