import type { CampaignSnapshot } from '../../../packages/game/public/campaign-types.ts';
import { contentQuestJournal, QUEST_STATE_LABELS } from '../../../packages/game/content-quests.js';
export default function StoryQuestJournal({ state }: { state: CampaignSnapshot }) {
  const quests = contentQuestJournal(state);
  if (!quests.length) {
    return null;
  }
  return (
    <section className="notice" aria-label="Encargos de la historia">
      <div>
        <h2>Encargos</h2>
        {quests.map((q) => (
          <article key={q.id}>
            <h3>
              {q.title} · {QUEST_STATE_LABELS[q.status]}
            </h3>
            <p>{q.description}</p>
            <small>
              {q.startedAt === undefined
                ? 'Fecha de inicio sin registrar'
                : `Iniciado el día ${Math.floor(q.startedAt / 24) + 1}`}
              {q.resolvedAt !== null
                ? ` · Resuelto el día ${Math.floor(q.resolvedAt / 24) + 1}`
                : ''}
            </small>
            {q.status === 'active' && q.deadline !== null && (
              <p>
                Plazo restante: {q.remainingMinutes} minutos · vence el día{' '}
                {Math.floor(q.deadline / 86400) + 1},{' '}
                {String(Math.floor(q.deadline / 3600) % 24).padStart(2, '0')}:
                {String(Math.floor(q.deadline / 60) % 60).padStart(2, '0')}.
              </p>
            )}
            {q.expired && <p>Falló por vencimiento del plazo.</p>}
            {q.deathName && <p>Falló por la muerte de {q.deathName}.</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
