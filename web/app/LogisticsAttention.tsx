import {publicLogisticsNotice,logisticsEventText} from '../../game/logistics-attention.js';
import './assignment-attention.css';

// Existing owned artillery and already-paid cargo still retain their delivery
// receipts. These notices do not expose a new order or a trade control.
export default function LogisticsAttention({state}:{state:any}){
 const notice=publicLogisticsNotice(state);
 if(!notice)return null;
 const events=notice.events.filter((event:any)=>event.kind==='artillery'||event.kind==='equipment');
 if(!events.length)return null;
 const blocked=events.some((event:any)=>event.state==='blocked'),title=blocked?'Traslados pendientes':'Traslados completados';
 const text=(event:any)=>event.kind==='equipment'&&event.code==='armory_full'?'El equipo ya pagado sigue en espera: no queda espacio para recibirlo.':logisticsEventText(event);
 return <section className="assignment-attention" role="status" aria-live="polite" aria-atomic="true" aria-label={title}>
  <div className="assignment-attention-heading"><h2>{title}</h2><span>Día {Math.floor(notice.hour/24)+1} · {String(notice.hour%24).padStart(2,'0')}:00</span></div>
  <ul>{events.map((event:any,index:number)=><li key={index}>{text(event)}</li>)}</ul>
  <p className="assignment-attention-resume">{blocked?'El traslado sigue en espera. Resolvé la causa indicada y reanudá el reloj para continuar.':'La carga llegó a su destino. Reanudá el reloj para continuar.'}</p>
 </section>;
}
