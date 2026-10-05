import {publicContractNotice} from '../../game/contract-attention.js';
import {contractTermsFor,contractRenewalQuote,contractExpiresSeconds} from '../../game/contracts.js';
import ServiceRefusalNotice from './ServiceRefusalNotice';
import {serviceObjectionReason} from '../../game/service-objections.js';
import ServiceObjectionNotice from './ServiceObjectionNotice';
import {lowMoraleRenewalStatus} from '../../game/morale-renewal.js';
import ContractMoraleNotice from './ContractMoraleNotice';
import './assignment-attention.css';

const duration=(seconds:number)=>{const whole=Math.max(0,Math.round(seconds)),h=Math.floor(whole/3600),m=Math.floor(whole%3600/60),s=whole%60;return [h?`${h} ${h===1?'hora':'horas'}`:'',m?`${m} ${m===1?'minuto':'minutos'}`:'',s?`${s} ${s===1?'segundo':'segundos'}`:''].filter(Boolean).join(' ');};
const clock=(hour:number,seconds=0)=>`${String(hour%24).padStart(2,'0')}:${String(Math.floor(seconds/60)).padStart(2,'0')}${seconds%60?`:${String(seconds%60).padStart(2,'0')}`:''}`;

export default function ContractAttention({state:s,roster,dispatch}:{state:any;roster:any[];dispatch:(action:any)=>void}){
 const notice=publicContractNotice(s);
 if(!notice)return null;
 const blocked=Boolean(s.pendingBattle||s.pendingEncounter||s.defeated);
 return <section className="assignment-attention" aria-label="Avisos de contratos">
  <div role="status" aria-live="polite" aria-atomic="true"><div className="assignment-attention-heading"><h2>Avance detenido por contratos</h2><span>Día {Math.floor(notice.hour/24)+1} · {clock(notice.hour,notice.secondOfHour??0)}</span></div>
   <p>Tiempo avanzado: <strong>{notice.advancedHours} de {notice.requestedHours} {notice.requestedHours===1?'hora solicitada':'horas solicitadas'}</strong>.</p>
  </div>
  <ul>{notice.events.map((event:any)=>{
   const op=roster.find(o=>o.id===event.operativeId),name=op?.nickname??op?.name??'Combatiente',current=s.contracts[event.operativeId],r=s.operativeState[event.operativeId];
   const serving=s.recruited.includes(event.operativeId)&&r?.alive&&!r.captured;
   const expiry=contractExpiresSeconds(event)!,unchanged=Boolean(current)&&contractExpiresSeconds(current)===expiry;
   const remaining=Math.max(0,expiry-s.hour*3600-(s.secondOfHour??0));
   return <li key={event.operativeId}><strong>{name}</strong>: {!serving?'Ya no está en servicio.':!unchanged?'El contrato ya fue renovado.':remaining?`El contrato termina en ${duration(remaining)}.`:'El contrato terminó. La salida queda pendiente hasta que pueda dejar la escuadra.'}
    {serving&&unchanged&&op&&<><ServiceObjectionNotice reason={serviceObjectionReason(s,op)}/><ContractMoraleNotice status={lowMoraleRenewalStatus(s,op)}/><ServiceRefusalNotice state={s} refusal={contractRenewalQuote(s,op,'day').serviceRefusal} disabled={blocked} dispatch={dispatch}/></>}
    {serving&&unchanged&&op&&<div className="travel-actions">{Object.entries(contractTermsFor(s)).filter(([term])=>['day','week','fortnight'].includes(term)).map(([term,period])=>{
     const quote=contractRenewalQuote(s,op,term),reason=blocked?'Resolvé el encuentro antes de renovar.':!quote.available?quote.reason:s.resources.treasury<quote.price?'No hay suficientes pesos.':'';
     return <button className="line-button" key={term} disabled={Boolean(reason)} title={reason||undefined} aria-label={`Renovar a ${name}: ${period.name} · ${quote.price} pesos`} onClick={()=>dispatch({type:'renewContract',id:event.operativeId,term,expectedExpiresAt:event.expiresAt,expectedExpiresSecond:event.expiresSecond??0})}>{period.name} · {quote.price} pesos</button>;
    })}</div>}
   </li>;
  })}</ul>
  <p className="assignment-attention-resume">Para continuar sin renovar, pulsá <strong>Iniciar</strong>. El contrato conserva su fecha de finalización.</p>
 </section>;
}
