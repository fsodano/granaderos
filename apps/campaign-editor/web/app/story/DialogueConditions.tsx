'use client';
import { selectValue, supplyIds, questStates, characterStates } from '../../lib/editor-values.ts';
import type {
  CampaignContent,
  CharacterDefinition,
  DialogueCondition,
  QuestDefinition,
} from '../../../../../packages/campaign-format/types.ts';
import { CHARACTER_SUPPLY_LABELS } from '../../../../../packages/game/public/campaign-editor-api.ts';
import { DIALOGUE_PERSON_STATE_LABELS } from '../../../../../packages/game/public/campaign-editor-api.ts';
import { CAMPAIGN_PROJECT_LABELS } from '../../../../../packages/game/public/campaign-editor-api.ts';
import { isWorldCharacter } from '../../../../../packages/game/public/campaign-editor-api.ts';
import { QUEST_STATE_LABELS } from '../../../../../packages/game/public/campaign-editor-api.ts';
import { campaignSectors } from '../../../../../packages/game/public/campaign-editor-api.ts';
import { campaignFactionName } from '../../../../../packages/game/public/campaign-editor-api.ts';
export default function DialogueConditions({
  conditions = [],
  characters,
  quests,
  onChange,
  campaign = false,
  content,
}: {
  content?: CampaignContent | undefined;
  campaign?: boolean;
  conditions?: DialogueCondition[] | undefined;
  characters: CharacterDefinition[];
  quests: QuestDefinition[];
  onChange: (conditions: DialogueCondition[]) => void;
}) {
  const sectors = campaignSectors(content);
  const residents = characters.filter(isWorldCharacter);
  const update = (index: number, value: DialogueCondition) =>
    onChange(conditions.map((c, i) => (i === index ? value : c)));
  const initial = (type: string): DialogueCondition =>
    type === 'supply'
      ? { type, character: characters[0]?.id ?? '', item: 'medkits', min: 1, max: null }
      : type === 'project'
        ? { type, project: 'foundry', completed: true }
        : type === 'meeting'
          ? { type, character: residents[0]?.id ?? '' }
          : type === 'quest'
            ? { type, quest: quests[0]?.id ?? '', status: 'active' }
            : type === 'character'
              ? { type, character: characters[0]?.id ?? '', state: 'alive' }
              : type === 'sector'
                ? { type, sector: sectors[0]?.id ?? '', owner: 'patriot' }
                : {
                    type: type === 'day' ? 'day' : 'treasury',
                    min: type === 'day' ? 1 : 0,
                    max: null,
                  };
  return (
    <div>
      <p>
        {campaign
          ? 'Se evalúan todas las condiciones en el estado de la campaña.'
          : 'La opción aparece cuando se cumplen todas sus condiciones.'}
      </p>
      {conditions.map((c, i) => (
        <fieldset key={i} aria-label={`Condición ${i + 1}`}>
          <legend>Condición {i + 1}</legend>
          <label>
            Tipo de condición
            <select value={c.type} onChange={(e) => update(i, initial(e.target.value))}>
              <option value="day">Día de campaña</option>
              <option value="treasury">Pesos disponibles</option>
              <option value="sector">Control de una localidad</option>
              <option value="project">Estado de un proyecto</option>
              <option value="character" disabled={!characters.length}>
                Estado de un personaje
              </option>
              <option value="supply" disabled={!characters.length}>
                Suministros de un personaje
              </option>
              {!campaign && (
                <option value="meeting" disabled={!residents.length}>
                  Personaje en su encuentro
                </option>
              )}
              <option value="quest" disabled={!quests.length}>
                Estado de un encargo
              </option>
            </select>
          </label>
          {c.type === 'supply' ? (
            <>
              <label>
                Personaje que lleva los suministros
                <select
                  value={c.character}
                  onChange={(e) => update(i, { ...c, character: e.target.value })}
                >
                  {characters.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Suministro requerido
                <select
                  value={c.item}
                  onChange={(e) =>
                    update(i, { ...c, item: selectValue(e.target.value, supplyIds) })
                  }
                >
                  {Object.entries(CHARACTER_SUPPLY_LABELS).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Cantidad mínima
                <input
                  type="number"
                  min={0}
                  max={c.item === 'medkits' ? 1000000 : 100000}
                  value={c.min}
                  onChange={(e) => update(i, { ...c, min: e.target.valueAsNumber })}
                />
              </label>
              <label>
                Cantidad máxima (opcional)
                <input
                  type="number"
                  min={c.min}
                  max={c.item === 'medkits' ? 1000000 : 100000}
                  value={c.max ?? ''}
                  onChange={(e) =>
                    update(i, { ...c, max: e.target.value === '' ? null : e.target.valueAsNumber })
                  }
                />
              </label>
              <p>
                Comprueba lo que conserva este personaje, también durante una escena. No entrega ni
                consume suministros. Usá mínimo y máximo cero para exigir que no queden. Agregá
                condiciones de vida, presencia o servicio si las necesitás.
              </p>
            </>
          ) : c.type === 'project' ? (
            <>
              <label>
                Proyecto de la condición
                <select
                  value={c.project}
                  onChange={(e) =>
                    update(i, { ...c, project: e.target.value === 'army' ? 'army' : 'foundry' })
                  }
                >
                  {Object.entries(CAMPAIGN_PROJECT_LABELS).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Estado del proyecto requerido
                <select
                  value={c.completed ? 'complete' : 'pending'}
                  onChange={(e) => update(i, { ...c, completed: e.target.value === 'complete' })}
                >
                  <option value="complete">Completado</option>
                  <option value="pending">Pendiente</option>
                </select>
              </label>
              <p>
                Comprueba el paso cumplido en la campaña. No exige que su responsable siga en
                servicio ni que la localidad conserve el control.
              </p>
            </>
          ) : c.type === 'meeting' ? (
            <>
              <label>
                Personaje que debe llegar
                <select
                  value={c.character}
                  onChange={(e) => update(i, { ...c, character: e.target.value })}
                >
                  {residents.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </label>
              <p>
                Debe estar consciente y sin peligro inmediato en el destino de su última llamada,
                dentro del sector abierto. Una orden pendiente o un tiempo transcurrido no bastan.
              </p>
            </>
          ) : c.type === 'quest' ? (
            <>
              <label>
                Encargo de la condición
                <select
                  value={c.quest}
                  onChange={(e) => update(i, { ...c, quest: e.target.value })}
                >
                  {quests.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Estado del encargo requerido
                <select
                  value={c.status}
                  onChange={(e) =>
                    update(i, { ...c, status: selectValue(e.target.value, questStates) })
                  }
                >
                  {Object.entries(QUEST_STATE_LABELS).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : c.type === 'character' ? (
            <>
              <label>
                Personaje de la condición
                <select
                  value={c.character}
                  onChange={(e) => update(i, { ...c, character: e.target.value })}
                >
                  {characters.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Estado requerido
                <select
                  value={c.state}
                  onChange={(e) =>
                    update(i, { ...c, state: selectValue(e.target.value, characterStates) })
                  }
                >
                  {Object.entries(DIALOGUE_PERSON_STATE_LABELS).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <p>
                La salud usa el estado actual, también durante el combate. Estar consciente o sano
                no exige presencia ni servicio: combiná esas condiciones si las necesitás. Una
                persona estabilizada todavía puede estar herida.
              </p>
            </>
          ) : c.type === 'sector' ? (
            <>
              <label>
                Localidad de la condición
                <select
                  value={c.sector}
                  onChange={(e) => update(i, { ...c, sector: e.target.value })}
                >
                  {sectors.map((place: { id: string; name: string }) => (
                    <option key={place.id} value={place.id}>
                      {place.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Control requerido
                <select
                  value={c.owner}
                  onChange={(e) =>
                    update(i, {
                      ...c,
                      owner: e.target.value === 'royalist' ? 'royalist' : 'patriot',
                    })
                  }
                >
                  <option value="patriot">{campaignFactionName(content, 'patriot')}</option>
                  <option value="royalist">{campaignFactionName(content, 'royalist')}</option>
                </select>
              </label>
            </>
          ) : (
            <>
              <label>
                {c.type === 'day' ? 'Desde el día' : 'Pesos mínimos'}
                <input
                  type="number"
                  min={c.type === 'day' ? 1 : 0}
                  max={1000000000}
                  value={c.min}
                  onChange={(e) => update(i, { ...c, min: e.target.valueAsNumber })}
                />
              </label>
              <label>
                {c.type === 'day' ? 'Hasta el día (opcional)' : 'Pesos máximos (opcional)'}
                <input
                  type="number"
                  min={c.min}
                  max={1000000000}
                  value={c.max ?? ''}
                  onChange={(e) =>
                    update(i, { ...c, max: e.target.value === '' ? null : e.target.valueAsNumber })
                  }
                />
              </label>
            </>
          )}
          <button
            type="button"
            onClick={() => onChange(conditions.filter((_, index) => index !== i))}
          >
            Quitar condición {i + 1}
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        disabled={conditions.length >= 6}
        onClick={() => onChange([...conditions, initial('day')])}
      >
        Agregar condición
      </button>
    </div>
  );
}
