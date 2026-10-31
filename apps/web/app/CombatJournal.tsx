import type { BattleSnapshot } from '../../../packages/game/public/compatibility-types.ts';
import { publicCombatJournal } from '../../../packages/game/combat-journal.js';
import './combat-journal.css';

export default function CombatJournal({ battle }: { battle: BattleSnapshot }) {
  const entries = publicCombatJournal(battle);
  return (
    <details className="combat-journal">
      <summary onKeyDown={(event) => event.stopPropagation()}>Diario de combate</summary>
      <section aria-label="Sucesos recientes del combate" className="combat-journal-panel">
        <p>Últimos sucesos observados por la escuadra. Los más recientes aparecen primero.</p>
        {entries.length ? (
          <ol>
            {entries
              .slice()
              .reverse()
              .map((entry: { turn: number; text: string }, index: number) => (
                <li key={`${entries.length - index}:${entry.turn}:${entry.text}`}>
                  <span className="combat-journal-turn">Turno {entry.turn}</span>
                  <span>{entry.text}</span>
                </li>
              ))}
          </ol>
        ) : (
          <p>Aún no hay sucesos registrados. Los nuevos sucesos aparecerán aquí.</p>
        )}
      </section>
    </details>
  );
}
