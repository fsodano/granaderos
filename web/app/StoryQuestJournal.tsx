import {contentQuestJournal,QUEST_STATE_LABELS} from '../../game/content-quests.js';
export default function StoryQuestJournal({state}:{state:any}){
 const quests=contentQuestJournal(state);if(!quests.length)return null;
 return <section className="notice" aria-label="Encargos de la historia"><div><h2>Encargos</h2>{quests.map((q:any)=><article key={q.id}><h3>{q.title} · {QUEST_STATE_LABELS[q.status as keyof typeof QUEST_STATE_LABELS]}</h3><p>{q.description}</p><small>Iniciado el día {Math.floor(q.startedAt/24)+1}{q.resolvedAt!==null?` · Resuelto el día ${Math.floor(q.resolvedAt/24)+1}`:''}</small>{q.status==='active'&&q.deadline!==null&&<p>Plazo restante: {q.remainingMinutes} minutos · vence el día {Math.floor(q.deadline/86400)+1}, {String(Math.floor(q.deadline/3600)%24).padStart(2,'0')}:{String(Math.floor(q.deadline/60)%60).padStart(2,'0')}.</p>}{q.expired&&<p>Falló por vencimiento del plazo.</p>}</article>)}</div></section>;
}
