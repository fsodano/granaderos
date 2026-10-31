'use client';

type Mission = {
  name: string;
  anchor?: string;
  stage?: string;
  objectives?: (string | { done?: boolean; text?: string; label?: string; name?: string })[];
  available?: boolean;
  reason?: string;
};
export default function MissionBriefing({
  mission,
  canEnter,
  blocked,
  onEnter,
  eyebrow = 'MISIÓN',
  entryLabel = 'Entrar en la misión',
  unavailableText = 'La escuadra todavía no puede entrar en esta misión.',
}: {
  mission: Mission;
  canEnter: boolean;
  blocked?: boolean;
  onEnter: () => void;
  eyebrow?: string;
  entryLabel?: string;
  unavailableText?: string;
}) {
  return (
    <section className="field-supplies" aria-label={mission.name}>
      <p className="eyebrow">{eyebrow}</p>
      <h3>{mission.name}</h3>
      <ul>
        {(mission.objectives || []).map((objective, index: number) => (
          <li key={index}>
            {typeof objective === 'string'
              ? objective
              : `${objective.done ? '✓ ' : ''}${objective.text || objective.label || objective.name}`}
          </li>
        ))}
      </ul>
      {!canEnter && <p>{mission.reason || unavailableText}</p>}
      <button className="line-button" disabled={!canEnter || blocked} onClick={onEnter}>
        {entryLabel}
      </button>
    </section>
  );
}
