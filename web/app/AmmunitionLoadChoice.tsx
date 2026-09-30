'use client';
import {AMMO_TYPES,ammoTypeFor,ammunitionLoadsFor,ammunitionChoiceReason} from '../../game/ammo-types.js';
export default function AmmunitionLoadChoice({unit,disabled=false,onSelect,onUnload,unloadCost=''}:{unit:any;disabled?:boolean;onSelect:(family:string)=>void;onUnload:()=>void;unloadCost?:string}){
 const loads=ammunitionLoadsFor(unit);if(loads.length<2||unit.weaponDropped||unit.activeSlot==='blade'||unit.activeSlot==='unarmed')return null;
 const reason=ammunitionChoiceReason(unit,ammoTypeFor(unit));
 return <div className="ammunition-load-choice"><label>Carga para esta arma<select aria-label="Carga para esta arma" value={ammoTypeFor(unit)} disabled={disabled||!!reason} onChange={e=>onSelect(e.target.value)}>{loads.map((load:any)=><option key={load.family} value={load.family}>{AMMO_TYPES[load.family].name}{load.damage?` · daño ${load.damage} · alcance ${load.range} · ${load.pattern==='cone'?'abanico':'tiro único'}`:' · carga principal'}</option>)}</select></label>{reason&&<small>{reason}</small>}<button disabled={disabled||!(unit.loaded>0)||!!unit.reloadProgress||unit.weaponDropped||unit.activeSlot==='blade'||unit.activeSlot==='unarmed'} onClick={onUnload}>Descargar arma{unloadCost}</button></div>;
}
