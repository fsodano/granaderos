'use client';
import {AMMO_KEYS,AMMO_TYPES,primaryAmmoTypeFor,ammunitionLoadsFor} from '../../../game/ammo-types.js';
export default function AlternativeLoads({weapon,onChange}:{weapon:any;onChange:(patch:any)=>void}){
 const primary=primaryAmmoTypeFor(weapon),loads=ammunitionLoadsFor(weapon).slice(1),change=(index:number,patch:any)=>onChange({alternativeLoads:loads.map((load:any,i:number)=>i===index?Object.fromEntries(Object.entries({...load,...patch}).filter(([,value])=>value!==undefined)):load)});
 return <section aria-label="Cargas alternativas"><h3>Cargas alternativas</h3><p>La carga principal usa los valores del arma. Cada alternativa consume otra familia de munición y puede cambiar el daño, el alcance y el patrón del disparo. El jugador elige con el arma vacía, antes de recargar.</p>
 {loads.map((load:any,index:number)=><fieldset key={load.family} aria-label={`Carga alternativa ${index+1}`}><legend>Carga alternativa {index+1}</legend>
 <label>Familia de la carga<select value={load.family} onChange={e=>change(index,{family:e.target.value})}>{AMMO_KEYS.filter(key=>key!==primary&&(!loads.some((l:any,i:number)=>i!==index&&l.family===key))).map(key=><option key={key} value={key}>{AMMO_TYPES[key].name}</option>)}</select></label>
 <label>Daño de la carga<input type="number" min={1} max={100} step={1} value={Number.isFinite(load.damage)?load.damage:''} onChange={e=>change(index,{damage:e.target.valueAsNumber})}/></label>
 <label>Alcance de la carga<input type="number" min={1} max={100} step={1} value={Number.isFinite(load.range)?load.range:''} onChange={e=>change(index,{range:e.target.valueAsNumber})}/></label>
 <label>Patrón del disparo<select value={load.pattern} onChange={e=>change(index,{pattern:e.target.value})}><option value="single">Tiro único</option><option value="cone">Abanico</option></select></label>
 <label>Pérdida de penetración de la carga<input type="number" min={0} max={1} step={.05} value={load.materialRangeSlope??''} onChange={e=>change(index,{materialRangeSlope:e.target.value===''?undefined:e.target.valueAsNumber})}/></label>
 <p>Más allá de este alcance, el valor aumenta la resistencia al entrar en cobertura. Vacío o cero conserva la resistencia original; no hereda el valor de la carga principal.</p>
 <button onClick={()=>onChange({alternativeLoads:loads.filter((_:any,i:number)=>i!==index)})}>Quitar carga alternativa {index+1}</button>
 </fieldset>)}
 <button disabled={loads.length>=AMMO_KEYS.length-1} onClick={()=>onChange({alternativeLoads:[...loads,{family:AMMO_KEYS.find(key=>key!==primary&&!loads.some((l:any)=>l.family===key)),damage:weapon.damage,range:weapon.range,pattern:'single'}]})}>Agregar carga alternativa</button>
 <button onClick={()=>onChange({alternativeLoads:undefined})}>Restaurar cargas alternativas originales</button>
 <p>Los cartuchos conservan su familia y se compran al precio del proveedor. Una carga ya preparada no puede convertirse en otra. Los valores son reglas de juego editables.</p>
 </section>;
}
