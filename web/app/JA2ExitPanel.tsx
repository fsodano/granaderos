'use client';

type Props = {model:any; selectedId?:string; busy:boolean; onUnits:(ids:string[])=>void; onExit:(id:string)=>void; onLeave:()=>void; onClose:()=>void; exploring:boolean};

export default function JA2ExitPanel({model,selectedId,busy,onUnits,onExit,onLeave,onClose,exploring}:Props){
  const {units,exits,selectedExit,unitIds,preview}=model;
  return <section className="ja2-exit-panel" aria-label="Salida del sector">
    <header><div><strong>{exploring?'Salir del sector':'Retirada por el borde'}</strong><p>Mové a los combatientes hasta el borde elegido. Cruzarlo consume fuerzas{exploring?' y tiempo.':' y PA. El enemigo puede reaccionar.'}</p></div><button className="line-button" onClick={onClose}>Cerrar salida</button></header>
    <label>Destino <select aria-label="Destino de salida" value={selectedExit?.id||''} disabled={busy||!exits.length} onChange={event=>onExit(event.target.value)}>{!exits.length&&<option value="">No hay salidas autorizadas</option>}{exits.map((exit:any)=><option key={exit.id} value={exit.id}>{exit.label}</option>)}</select></label>
    <div className="ja2-exit-selection"><button className="line-button" disabled={busy||!units.some((unit:any)=>unit.id===selectedId)} onClick={()=>onUnits(selectedId?[selectedId]:[])}>Solo seleccionado</button><button className="line-button" disabled={busy||!units.length} onClick={()=>onUnits(units.map((unit:any)=>unit.id))}>Todos presentes</button>{preview.blocked.length>0&&preview.eligibleIds.length>0&&<button className="line-button" disabled={busy} onClick={()=>onUnits(preview.eligibleIds)}>Seleccionar los que pueden salir</button>}</div>
    <fieldset><legend>Combatientes que van a salir</legend>{units.map((unit:any)=>{const checked=unitIds.includes(unit.id),blocked=preview.blocked.find((entry:any)=>entry.id===unit.id);return <label className="ja2-exit-unit" key={unit.id}><input type="checkbox" checked={checked} disabled={busy} onChange={()=>onUnits(checked?unitIds.filter((id:string)=>id!==unit.id):[...unitIds,unit.id])}/><span>{unit.nickname||unit.name}</span>{checked&&<small>{blocked?.reason||(exploring?'Puede cruzar':`${preview.costById[unit.id]} PA para cruzar`)}</small>}</label>;})}</fieldset>
    {preview.reason&&<p role="status">{preview.reason}</p>}
    <button className="gold-button" disabled={busy||!preview.available} onClick={onLeave}>Cruzar el borde · {unitIds.length} {unitIds.length===1?'combatiente':'combatientes'}</button>
    <p className="ja2-exit-note">La salida parcial conserva este encuentro. Solo se mantiene un encuentro táctico activo. M abre la carta y conserva el despliegue.</p>
  </section>;
}
