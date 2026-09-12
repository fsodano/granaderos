'use client';
import {handSlots,unitCanAct} from '../../game/ja2-hud.js';
import './ja2-hands.css';
type Props={battle:any;unit:any;busy:boolean;compact?:boolean;onOrder:(action:any)=>void;onPick:(item:string)=>void};
export default function JA2Hands({battle,unit,busy,compact=false,onOrder,onPick}:Props){
 return <div className={`ja2-hands ${compact?'compact':''}`} aria-label="Manos del combatiente">{handSlots(battle,unit).map((hand:any)=><button key={hand.side} className={hand.blocked?'blocked':''} disabled={busy||!unitCanAct(battle,unit)||hand.disabled} aria-label={`${hand.side==='right'?'Mano principal':'Segunda mano'}: ${hand.label}`} title={hand.reason|| (hand.action?`Usar esta arma · ${hand.pa} PA`:'Seleccionar objeto')} onClick={()=>{if(hand.action)onOrder(hand.action);else onPick(hand.item||'primary');}}>
  <small>{hand.side==='right'?'Mano principal':'Segunda mano'}</small>
  {!compact&&hand.weapon&&<img src={`/art/weapon-${hand.weapon}.png`} alt=""/>}
  <span>{hand.blocked?'↔ ':''}{hand.label}</span>
  {hand.loaded!==undefined&&<small>{hand.loaded} carga(s) · {hand.condition}%</small>}
 </button>)}</div>;
}
