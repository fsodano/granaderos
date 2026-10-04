import {publicAssignmentNotice,assignmentAttentionText} from '../../game/assignment-attention.js';
import './assignment-attention.css';

export default function AssignmentAttention({state,roster}:{state:any;roster:any[]}){
 const notice=publicAssignmentNotice(state);
 if(!notice)return null;
 return <section className="assignment-attention" role="status" aria-live="polite" aria-atomic="true" aria-label="Avance detenido por asignaciones">
  <div className="assignment-attention-heading"><h2>Avance detenido por asignaciones</h2><span>Día {Math.floor(notice.hour/24)+1} · {String(notice.hour%24).padStart(2,'0')}:00</span></div>
  <p>Tiempo avanzado: <strong>{notice.advancedHours} de {notice.requestedHours} {notice.requestedHours===1?'hora solicitada':'horas solicitadas'}</strong>.</p>
  <ul>{notice.events.map((event:any)=><li key={event.subject}>{assignmentAttentionText(state,event,roster)}</li>)}</ul>
  <p className="assignment-attention-resume">Al pulsar <strong>Iniciar</strong> de nuevo, comienza un nuevo período desde la hora actual.</p>
 </section>;
}
