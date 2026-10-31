import type {
  CampaignOperative,
  CampaignOperativeState,
} from '../../../packages/game/public/campaign-types.ts';
import { studyForecast } from '../../../packages/game/study-training.js';
import { TRAINING_LABELS } from '../../../packages/game/skill-training.js';
export default function StudyForecast({
  record,
  op,
  skill,
  instructor,
}: {
  record: CampaignOperativeState;
  op: CampaignOperative;
  skill: string;
  instructor?: CampaignOperative | undefined;
}) {
  const solo = studyForecast(record, op, skill),
    paired = instructor ? studyForecast(record, op, skill, instructor) : null;
  if (!solo) {
    return null;
  }
  return (
    <p
      className="care-condition"
      aria-label={`Previsión de estudio de ${op.nickname}`}
    >
      <strong>
        {Object.entries(TRAINING_LABELS).find(([id]) => id === skill)?.[1]} ·{' '}
        {solo.value}
      </strong>
      <br />
      {solo.ineligible ? (
        'Sin aptitud para mejorar: esta habilidad necesita un valor de al menos 35.'
      ) : solo.capped ? (
        'Límite de práctica alcanzado.'
      ) : (
        <>
          Estimación de mejora: {solo.hoursToNext} h de práctica individual.
          {paired && instructor && (
            <>
              {' '}
              Con {instructor.nickname}: {paired.hoursToNext} h.
            </>
          )}
          <br />
          {solo.earned}/10 mejoras por práctica · quedan {solo.remainingGains}.
          Las horas cuentan solo mientras trabaja; las pausas y el descanso
          alargan el plazo.
        </>
      )}
    </p>
  );
}
