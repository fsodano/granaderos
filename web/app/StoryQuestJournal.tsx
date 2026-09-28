import {contentQuestJournal,QUEST_STATE_LABELS} from '../../game/content-quests.js';
export default function StoryQuestJournal({state}:{state:any}){
 const quests=contentQuestJournal(state);if(!quests.length)return null;
 return <section className="notice" aria-label="Encargos de la historia"><div><h2>Encargos</h2>{quests.map((q:any)=><article key={q.id}><h3>{q.title} · {QUEST_STATE_LABELS[q.status as keyof typeof QUEST_STATE_LABELS]}</h3><p>{q.description}</p><small>Iniciado el día {Math.floor(q.startedAt/24)+1}{q.resolvedAt!==null?` · Resuelto el día ${Math.floor(q.resolvedAt/24)+1}`:''}</small></article>)}</div></section>;
}
