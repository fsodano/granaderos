'use client';
import { replaceCampaignContentField } from '../../lib/editor-documents.ts';
import type {
  CampaignContent,
  CampaignEvent,
} from '../../../../../packages/campaign-format/types.ts';
import { useState } from 'react';
import DialogueConditions from './DialogueConditions.tsx';
import DialogueEffects from './DialogueEffects.tsx';
import { DocumentEditor } from '../studio/FieldEditor.tsx';
import { DEFAULT_AMMUNITION_MARKET } from '../../../../../packages/game/public/campaign-editor-api.ts';
import { DEFAULT_ARTILLERY_SUPPLY } from '../../../../../packages/game/public/campaign-editor-api.ts';
import { freshDefaultRoadsideDiscoveries } from '../../../../../packages/game/public/campaign-editor-api.ts';

export default function AdvancedContent({
  draft,
  onChange,
}: {
  draft: CampaignContent;
  onChange: (next: CampaignContent) => void;
}) {
  const [selected, setSelected] = useState(''),
    [search, setSearch] = useState(''),
    events = draft.campaignEvents ?? [],
    event = events.find((e) => e.id === selected) ?? events[0];
  const norm = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase();
  const filtered = events.filter((e) => norm(`${e.id} ${e.text}`).includes(norm(search.trim())));
  const changeEvents = (next: CampaignEvent[]) => onChange({ ...draft, campaignEvents: next });
  const update = (patch: Partial<CampaignEvent>) => {
    if (!event) {
      return;
    }
    changeEvents(events.map((e) => (e.id === event.id ? { ...e, ...patch } : e)));
    if (patch.id !== undefined) {
      setSelected(patch.id);
    }
  };
  const add = () => {
    let n = 1;
    while (events.some((e) => e.id === `event-${n}`)) {
      n++;
    }
    const id = `event-${n}`;
    changeEvents([
      ...events,
      {
        id,
        atHour: 24,
        conditions: [],
        text: 'Describí el evento que verá el jugador.',
        effects: [],
      },
    ]);
    setSelected(id);
  };
  const optional = [
    ['imports', 'Importaciones', { port: null, minHours: 12, maxHours: 24 }],
    ['artillerySupply', 'Suministro de artillería', DEFAULT_ARTILLERY_SUPPLY],
    ['artilleryTrading', 'Comercio de artillería', draft.world?.artilleryTrading],
    ['ammunitionMarket', 'Munición', { defaults: DEFAULT_AMMUNITION_MARKET, locations: {} }],
  ] as const;
  return (
    <section aria-label="Eventos y suministros de campaña">
      <h2>Eventos programados</h2>
      <p>
        Cada evento se comprueba una vez, a su hora. Las condiciones, el costo y el encargo se
        evalúan juntos. Una condición falsa deja un recibo de evento omitido.
      </p>
      <div className="editor-columns">
        <aside aria-label="Catálogo de eventos">
          <h2>
            Eventos <small>{events.length}</small>
          </h2>
          <button
            type="button"
            className="primary"
            disabled={events.length >= 100}
            onClick={() => {
              add();
              setSearch('');
            }}
          >
            Crear evento
          </button>
          <label className="list-search">
            Buscar eventos
            <input
              type="search"
              value={search}
              placeholder="Texto o ID"
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearch('');
                }
              }}
            />
          </label>
          <div className="content-list-feedback">
            <output>
              {filtered.length} de {events.length} eventos
            </output>
            {search && (
              <button type="button" onClick={() => setSearch('')}>
                Limpiar búsqueda
              </button>
            )}
          </div>
          <div className="entry-list">
            {filtered.map((e) => (
              <button
                type="button"
                key={e.id}
                aria-current={e.id === event?.id ? 'true' : undefined}
                onClick={() => setSelected(e.id)}
              >
                {e.id}
                <small>
                  {e.atHour} h · {e.text.slice(0, 64)}
                </small>
              </button>
            ))}
            {filtered.length === 0 && (
              <output className="content-empty">
                {search ? 'No hay resultados para esta búsqueda.' : 'No hay eventos programados.'}
              </output>
            )}
          </div>
        </aside>
        {event ? (
          <fieldset>
            <legend>{event.id}</legend>
            {search && !filtered.some((e) => e.id === event.id) && (
              <p className="content-selection-note">
                El filtro conserva el evento que estás editando.
              </p>
            )}
            <label>
              Identidad del evento
              <input value={event.id} onChange={(e) => update({ id: e.target.value })} />
            </label>
            <label>
              Hora del evento
              <input
                type="number"
                min={0}
                max={876000}
                value={event.atHour}
                onChange={(e) => update({ atHour: e.target.valueAsNumber })}
              />
            </label>
            <label>
              Texto del evento
              <textarea
                rows={3}
                maxLength={1000}
                value={event.text}
                onChange={(e) => update({ text: e.target.value })}
              />
            </label>
            <DialogueConditions
              content={draft}
              campaign
              conditions={event.conditions}
              characters={draft.characters}
              quests={draft.quests ?? []}
              onChange={(conditions) => update({ conditions })}
            />
            <DialogueEffects
              allowMovement={false}
              effects={event.effects}
              quests={draft.quests ?? []}
              characters={draft.characters}
              ownerId=""
              onChange={(effects) => update({ effects })}
            />
            <button
              type="button"
              className="content-danger"
              onClick={() => changeEvents(events.filter((e) => e.id !== event.id))}
            >
              Eliminar evento
            </button>
          </fieldset>
        ) : (
          <div className="form-panel content-empty">
            <h2>Programá un evento</h2>
            <p>Elegí cuándo ocurre, sus condiciones y el resultado que recibe el jugador.</p>
          </div>
        )}
      </div>
      <h2>Hallazgos de camino</h2>
      <p>
        Este hallazgo contiene una palanca y una camisa de lino. Para otros contenidos usá los
        objetos físicos del mundo.
      </p>
      <label>
        <input
          type="checkbox"
          checked={Boolean(draft.roadsideDiscoveries?.length)}
          onChange={(e) => {
            const defaults = freshDefaultRoadsideDiscoveries(),
              cell =
                draft.world?.cells.find(
                  (c) =>
                    c.land &&
                    c.location === (draft.headquarters ?? draft.world?.defaultHeadquarters),
                ) ?? draft.world?.cells.find((c) => c.land);
            onChange({
              ...draft,
              roadsideDiscoveries: e.target.checked
                ? defaults.map((d) => (cell ? { ...d, id: 'field-cache', cell: cell.id } : d))
                : [],
            });
          }}
        />
        Colocar hallazgo de herramientas y ropa
      </label>
      {(draft.roadsideDiscoveries?.length ?? 0) > 0 && (
        <DocumentEditor
          label="Hallazgo"
          path="roadsideDiscoveries"
          value={draft.roadsideDiscoveries}
          onChange={(value) =>
            onChange(replaceCampaignContentField(draft, 'roadsideDiscoveries', value))
          }
        />
      )}
      <h2>Reglas de suministro</h2>
      {optional.map(([field, label, defaults]) => (
        <section key={field}>
          <h3>{label}</h3>
          {draft[field] === undefined ? (
            <>
              <p>Se usa el valor predeterminado de las reglas.</p>
              <button
                type="button"
                onClick={() => onChange({ ...draft, [field]: structuredClone(defaults ?? {}) })}
              >
                Configurar {label.toLowerCase()}
              </button>
            </>
          ) : (
            <>
              <DocumentEditor
                label={label}
                path={field}
                value={draft[field]}
                onChange={(value) => onChange(replaceCampaignContentField(draft, field, value))}
              />
              <button
                type="button"
                onClick={() => {
                  const next = { ...draft };
                  delete next[field];
                  onChange(next);
                }}
              >
                Usar reglas predeterminadas de {label.toLowerCase()}
              </button>
            </>
          )}
        </section>
      ))}
    </section>
  );
}
