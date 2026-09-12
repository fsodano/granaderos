'use client';
import {handSlots,unitCanAct} from '../../game/ja2-hud.js';
import {useEquipmentDrag} from '../lib/equipment-drag';
import './ja2-hands.css';
type Props={battle:any;unit:any;busy:boolean;compact?:boolean;onOrder:(action:any)=>void;onPick:(item:string)=>void};
export default function JA2Hands({battle,unit,busy,compact=false,onOrder,onPick}:Props){
 const unavailable=busy||!unitCanAct(battle,unit);
 const drag=useEquipmentDrag(battle,unit,unavailable,onOrder);
 return <div className={`ja2-hands ${compact?'compact':''}`} aria-label="Manos del combatiente">{handSlots(battle,unit).map((hand:any)=><button key={hand.side} className={hand.blocked?'blocked':drag.target===`hand:${hand.side}`?'drop-target':''} disabled={unavailable||hand.blocked} aria-label={`${hand.side==='right'?'Mano principal':'Segunda mano'}: ${hand.label}`} title={hand.reason|| (hand.action?`Usar este objeto · ${hand.pa} PA`:'Seleccionar objeto')} data-held={Boolean(hand.item)} {...drag.handlers(`hand:${hand.side}`)} onClick={()=>{if(hand.disabled)return;if(hand.action)onOrder(hand.action);else onPick(hand.item||'primary');}}>
  <small>{hand.side==='right'?'Mano principal':'Segunda mano'}</small>
  {!compact&&hand.weapon&&<img src={`/art/weapon-${hand.weapon}.png`} alt=""/>}
  <span>{hand.blocked?'↔ ':''}{hand.label}</span>
  {hand.loaded===undefined&&hand.condition!==undefined&&<small>Estado {hand.condition}%</small>}
  {hand.loaded!==undefined&&<small>{hand.loaded} carga(s) · {hand.condition}%</small>}
 </button>)}{drag.hint&&<small className="equipment-drag-hint" role="status">{drag.hint}</small>}</div>;
}
