'use client';
import { WEAPONS, BLADES } from '../../game/tactical.js';
type Props={unit:any;disabled:boolean;onEquip:(inventoryKey:string,slot:'primary'|'blade')=>void};
export default function RecoveredInventory({unit,disabled,onEquip}:Props){
 const entries=Object.entries(unit.inventory||{}).filter(([,item]:[string,any])=>item&&typeof item==='object'&&item.count>0);
 if(!entries.length)return null;
 return <section className="field-supplies" aria-label="Equipo recuperado"><p className="eyebrow">EQUIPO RECUPERADO</p>{entries.map(([key,value])=>{const item=value as any;const gun=(WEAPONS as any)[item.weapon],blade=(BLADES as any)[item.weapon],name=gun?.name||blade?.name||item.name||'Pertrechos';return <div key={key}><p><strong>{name}</strong> · {item.count} {gun?`· ${item.loaded||0} carga(s)` : ''}{item.condition!==undefined?` · estado ${item.condition}%`:''}</p>{(gun||blade)&&<button className="line-button" disabled={disabled} onClick={()=>onEquip(key,'primary')}>Equipar principal · 6 PA</button>}{blade&&<button className="line-button" disabled={disabled} onClick={()=>onEquip(key,'blade')}>Equipar secundaria · 6 PA</button>}</div>;})}<small>El arma desplazada queda guardada con su carga y estado.</small></section>;
}
