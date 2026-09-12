import {publicLogisticsNotice,logisticsEventText} from '../../game/logistics-attention.js';
import './assignment-attention.css';

export default function LogisticsAttention({state}:{state:any}){
 const notice=publicLogisticsNotice(state);
 if(!notice)return null;
 return <section className="assignment-attention" role="status" aria-live="polite" aria-atomic="true" aria-label="Producción y entregas completadas">
  <div className="assignment-attention-heading"><h2>Producción y entregas completadas</h2><span>Día {Math.floor(notice.hour/24)+1} · {String(notice.hour%24).padStart(2,'0')}:00</span></div>
  <p>Tiempo avanzado: <strong>{notice.advancedHours} de {notice.requestedHours} {notice.requestedHours===1?'hora solicitada':'horas solicitadas'}</strong>.</p>
  <ul>{notice.events.map((event:any,index:number)=><li key={index}>{logisticsEventText(event)}</li>)}</ul>
  <p className="assignment-attention-resume">Ya se completó la producción o entrega. Pulsá <strong>Avanzar</strong> para iniciar otro período desde la hora actual.</p>
 </section>;
}
