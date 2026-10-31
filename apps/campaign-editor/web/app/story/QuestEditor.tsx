'use client';
import type {
  CampaignContent,
  QuestDefinition,
} from '../../../../../packages/campaign-format/types.ts';
import { storyReferences } from '../../../../../packages/game/public/campaign-editor-api.ts';
import { useState } from 'react';
export default function QuestEditor({
  draft,
  onChange,
}: {
  draft: CampaignContent;
  onChange: (draft: CampaignContent) => void;
}) {
  const quests = draft.quests ?? [],
    [selected, setSelected] = useState(''),
    [query, setQuery] = useState(''),
    [person, setPerson] = useState('');
  const quest = quests.find((q) => q.id === selected) ?? quests[0];
  const norm = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase();
  const filtered = quests.filter((q) => norm(`${q.title} ${q.id}`).includes(norm(query.trim())));
  const survivors = quest?.requiredAlive ?? [],
    available = draft.characters.filter((c) => !survivors.includes(c.id)),
    candidate = available.find((c) => c.id === person) ?? available[0];
  const update = (patch: Partial<QuestDefinition>) => {
    if (!quest) {
      return;
    }
    onChange({
      ...draft,
      quests: quests.map((q) => (q.id === quest.id ? { ...q, ...patch } : q)),
    });
  };
  const add = (copy = false) => {
    if (copy && !quest) {
      return;
    }
    let n = 1;
    while (quests.some((q) => q.id === `quest-${n}`)) {
      n++;
    }
    const id = `quest-${n}`;
    onChange({
      ...draft,
      quests: [
        ...quests,
        copy && quest
          ? { ...quest, id, title: `${quest.title.slice(0, 94)} copia` }
          : { id, title: `Encargo ${n}`, description: 'Escribí el objetivo que verá el jugador.' },
      ],
    });
    setSelected(id);
  };
  const eventUsers = (draft.campaignEvents ?? []).filter((e) =>
    [...(e.conditions ?? []), ...(e.effects ?? [])].some(
      (v) => v.type === 'quest' && v.quest === quest?.id,
    ),
  );
  const storyUser = quest && storyReferences(draft.campaignStory, 'quest', quest.id);
  const users = quest
    ? draft.characters.filter((c) =>
        c.encounter?.dialogue?.nodes.some((n) =>
          n.choices.some((choice) =>
            [...(choice.conditions ?? []), ...(choice.effects ?? [])].some(
              (e) => e.type === 'quest' && e.quest === quest.id,
            ),
          ),
        ),
      )
    : [];
  return (
    <section aria-label="Encargos editables">
      <p>
        Creá un encargo y usalo en las condiciones y efectos de las conversaciones. Empieza sin
        iniciar. Puede pasar a «En curso» y luego a «Completado» o «Fallido». Los estados finales no
        se reinician.
      </p>
      <div className="editor-columns">
        <aside aria-label="Catálogo de encargos">
          <h2>
            Encargos <small>{quests.length}</small>
          </h2>
          <button
            type="button"
            className="primary"
            disabled={quests.length >= 100}
            onClick={() => {
              add();
              setQuery('');
            }}
          >
            Crear encargo
          </button>
          <label className="list-search">
            Buscar encargos
            <input
              type="search"
              value={query}
              placeholder="Título o ID"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setQuery('');
                }
              }}
            />
          </label>
          <div className="content-list-feedback">
            <output>
              {filtered.length} de {quests.length} encargos
            </output>
            {query && (
              <button type="button" onClick={() => setQuery('')}>
                Limpiar búsqueda
              </button>
            )}
          </div>
          <div className="entry-list">
            {filtered.map((q) => (
              <button
                type="button"
                key={q.id}
                aria-current={q.id === quest?.id ? 'true' : undefined}
                onClick={() => setSelected(q.id)}
              >
                {q.title}
                <small>{q.id}</small>
              </button>
            ))}
            {filtered.length === 0 && (
              <output className="content-empty">
                {query
                  ? 'No hay resultados para esta búsqueda.'
                  : 'No hay encargos. Creá uno para comenzar.'}
              </output>
            )}
          </div>
        </aside>
        {quest ? (
          <fieldset>
            <legend>{quest.title}</legend>
            {query && !filtered.some((q) => q.id === quest.id) && (
              <p className="content-selection-note">
                El filtro conserva el encargo que estás editando.
              </p>
            )}
            <label>
              Título del encargo
              <input
                value={quest.title}
                maxLength={100}
                onChange={(e) => update({ title: e.target.value })}
              />
            </label>
            <label>
              Objetivo del encargo
              <textarea
                rows={4}
                value={quest.description}
                maxLength={1000}
                onChange={(e) => update({ description: e.target.value })}
              />
            </label>
            <label>
              Plazo desde la aceptación (horas, opcional)
              <input
                type="number"
                min={1}
                max={720}
                value={quest.deadlineHours ?? ''}
                onChange={(e) =>
                  update({ deadlineHours: e.target.value === '' ? null : e.target.valueAsNumber })
                }
              />
            </label>
            <p>
              Con un plazo, el encargo falla al cumplirse esas horas desde su aceptación. Dejalo
              vacío para no limitar el tiempo. Se cuentan los viajes, la espera y el tiempo dentro
              del sector.
            </p>
            <fieldset aria-label="Personajes necesarios para el encargo">
              <legend>Personajes necesarios para el encargo</legend>
              <p>
                El encargo falla si muere cualquiera de estas personas mientras está en curso. Si ya
                murió, no se puede iniciar. Heridas, inconsciencia y retiro del servicio no cuentan
                como muerte. Hasta seis personas.
              </p>
              <label>
                Personaje que debe sobrevivir
                <select value={candidate?.id ?? ''} onChange={(e) => setPerson(e.target.value)}>
                  {available.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={!candidate || survivors.length >= 6}
                onClick={() => {
                  if (candidate) {
                    update({ requiredAlive: [...survivors, candidate.id] });
                  }
                }}
              >
                Agregar personaje necesario
              </button>
              {survivors.map((id: string) => (
                <div key={id}>
                  <span>{draft.characters.find((c) => c.id === id)?.name ?? id}</span>
                  <button
                    type="button"
                    onClick={() =>
                      update({ requiredAlive: survivors.filter((v: string) => v !== id) })
                    }
                  >
                    Quitar requisito de {draft.characters.find((c) => c.id === id)?.name ?? id}
                  </button>
                </div>
              ))}
            </fieldset>
            <button type="button" disabled={quests.length >= 100} onClick={() => add(true)}>
              Duplicar encargo
            </button>
            <button
              type="button"
              className="content-danger"
              disabled={users.length > 0 || storyUser || eventUsers.length > 0}
              onClick={() => {
                onChange({ ...draft, quests: quests.filter((q) => q.id !== quest.id) });
                setSelected('');
              }}
            >
              Eliminar encargo
            </button>
            {eventUsers.length > 0 && (
              <p>
                Usado por eventos: {eventUsers.map((e) => e.id).join(', ')}. Quitá esas referencias
                antes de eliminarlo.
              </p>
            )}
            {storyUser && (
              <p>
                Usado por los objetivos o la derrota de campaña. Quitá esa referencia antes de
                eliminarlo.
              </p>
            )}
            {users.length > 0 && (
              <p>
                Usado por: {users.map((c) => c.name).join(', ')}. Quitá esas referencias antes de
                eliminarlo.
              </p>
            )}
            <p>
              Las opciones de diálogo pueden iniciar, completar o fallar este encargo. Agregá sus
              requisitos como condiciones de la misma opción. El jugador lo verá en la carta de
              campaña desde que lo inicia.
            </p>
          </fieldset>
        ) : (
          <div className="form-panel content-empty">
            <h2>Prepará tu primer encargo</h2>
            <p>
              Creá un objetivo y luego conectalo con las condiciones y los efectos de una
              conversación.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
