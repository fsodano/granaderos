import {publicContractNotice} from '../../game/contract-attention.js';
import {contractTermsFor,contractQuote} from '../../game/contracts.js';
import './assignment-attention.css';

export default function ContractAttention({state:s,roster,dispatch}:{state:any;roster:any[];dispatch:(action:any)=>void}){
 const notice=publicContractNotice(s);
 if(!notice)return null;
 const blocked=Boolean(s.pendingBattle||s.pendingEncounter||s.defeated);
 return <section className="assignment-attention" aria-label="Avisos de contratos">
  <div role="status" aria-live="polite" aria-atomic="true"><div className="assignment-attention-heading"><h2>Avance detenido por contratos</h2><span>Día {Math.floor(notice.hour/24)+1} · {String(notice.hour%24).padStart(2,'0')}:00</span></div>
   <p>Tiempo avanzado: <strong>{notice.advancedHours} de {notice.requestedHours} {notice.requestedHours===1?'hora solicitada':'horas solicitadas'}</strong>.</p>
  </div>
  <ul>{notice.events.map((event:any)=>{
   const op=roster.find(o=>o.id===event.operativeId),name=op?.nickname??op?.name??'Combatiente',current=s.contracts[event.operativeId],r=s.operativeState[event.operativeId];
   const serving=s.recruited.includes(event.operativeId)&&r?.alive&&!r.captured;
   const unchanged=current?.expiresAt===event.expiresAt;
   const remaining=Math.max(0,event.expiresAt-s.hour);
   return <li key={event.operativeId}><strong>{name}</strong>: {!serving?'Ya no está en servicio.':!unchanged?'El contrato ya fue renovado.':remaining?`El contrato termina en ${remaining} ${remaining===1?'hora':'horas'}.`:'El contrato terminó. La salida queda pendiente hasta que pueda dejar la escuadra.'}
    {serving&&unchanged&&op&&<div className="travel-actions">{Object.entries(contractTermsFor(s)).map(([term,period])=>{
     const quote=contractQuote(s,op,term),reason=blocked?'Resolvé el encuentro antes de renovar.':!quote.available?quote.reason:s.resources.treasury<quote.price?'No hay suficientes pesos.':'';
     return <button className="line-button" key={term} disabled={Boolean(reason)} title={reason||undefined} aria-label={`Renovar a ${name}: ${period.name} · ${quote.price} pesos`} onClick={()=>dispatch({type:'renewContract',id:event.operativeId,term,expectedExpiresAt:event.expiresAt})}>{period.name} · {quote.price} pesos</button>;
    })}</div>}
   </li>;
  })}</ul>
  <p className="assignment-attention-resume">Para continuar sin renovar, pulsá <strong>Avanzar</strong>. El contrato conserva su fecha de finalización.</p>
 </section>;
}
