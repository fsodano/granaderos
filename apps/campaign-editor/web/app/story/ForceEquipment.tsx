'use client';
import type { CampaignContent } from '../../../../../packages/campaign-format/types.ts';
import {
  FORCE_EQUIPMENT,
  defaultForceEquipment,
  defaultForceBlades,
} from '../../../../../packages/game/public/campaign-editor-api.ts';
import { hasGenericCharacterDefinitions } from '../../../../../packages/game/public/campaign-editor-api.ts';
import { APPEARANCE_LABELS } from '../../../../../packages/game/public/campaign-editor-api.ts';

export default function ForceEquipment({
  draft,
  onChange,
}: {
  draft: CampaignContent;
  onChange: (value: CampaignContent) => void;
}) {
  const generic = hasGenericCharacterDefinitions(draft);
  return (
    <section aria-label="Armamento de las tropas">
      <h2>Armamento de las tropas</h2>
      <p>
        Elegí el arma principal y el arma blanca de cada tipo de tropa. Los soldados reciben su
        equipo al crearse y lo conservan al volver al sector.
      </p>
      {(['oppositionEquipment', 'militiaEquipment'] as const).map((field) => {
        const group = FORCE_EQUIPMENT[field];
        if (!group) {
          return null;
        }
        const blades = field === 'oppositionEquipment' ? 'oppositionBlades' : 'militiaBlades';
        const appearance =
          field === 'oppositionEquipment' ? 'oppositionAppearance' : 'militiaAppearance';
        return (
          <fieldset key={field}>
            <legend>{group.label}</legend>
            {draft[field] === undefined ? (
              <>
                <p>
                  {generic
                    ? 'Este grupo empieza sin arma principal.'
                    : 'Este paquete conserva las armas originales de este grupo.'}
                </p>
                <button
                  onClick={() =>
                    onChange({
                      ...draft,
                      [field]: generic
                        ? Object.fromEntries(Object.keys(group.roles).map((role) => [role, null]))
                        : defaultForceEquipment(field, draft.weapons),
                    })
                  }
                >
                  Configurar armas de {group.label.toLowerCase()}
                </button>
              </>
            ) : (
              <div className="fields">
                {Object.entries(group.roles).map(([role, label]) => (
                  <label key={role}>
                    {label}
                    <select
                      value={draft[field]?.[role] ?? ''}
                      onChange={(e) =>
                        onChange({
                          ...draft,
                          [field]: { ...draft[field], [role]: e.target.value || null },
                        })
                      }
                    >
                      <option value="">Sin arma principal</option>
                      {draft.weapons.map((weapon) => (
                        <option key={weapon.id} value={weapon.id}>
                          {weapon.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            )}
            {draft[blades] === undefined ? (
              <>
                <p>
                  {generic
                    ? 'Este grupo empieza sin arma blanca.'
                    : 'Las armas blancas de este grupo conservan sus valores originales.'}
                </p>
                <button
                  onClick={() =>
                    onChange({
                      ...draft,
                      [blades]: generic
                        ? Object.fromEntries(Object.keys(group.roles).map((role) => [role, null]))
                        : defaultForceBlades(field, draft.weapons),
                    })
                  }
                >
                  Configurar armas blancas de {group.label.toLowerCase()}
                </button>
              </>
            ) : (
              <div className="fields">
                {Object.entries(group.roles).map(([role, label]) => (
                  <label key={role}>
                    {`Arma blanca · ${label}`}
                    <select
                      value={draft[blades]?.[role] ?? ''}
                      onChange={(e) =>
                        onChange({
                          ...draft,
                          [blades]: {
                            ...draft[blades],
                            [role]: e.target.value || null,
                          },
                        })
                      }
                    >
                      <option value="">
                        {generic ? 'Sin arma blanca' : 'Arma blanca original'}
                      </option>
                      {draft.weapons
                        .filter((w) => typeof w.template === 'number' && w.template >= 1809)
                        .map((weapon) => (
                          <option key={weapon.id} value={weapon.id}>
                            {weapon.name}
                          </option>
                        ))}
                    </select>
                  </label>
                ))}
              </div>
            )}
            {draft[appearance] === undefined ? (
              <>
                <p>
                  {generic
                    ? 'Sin una selección, usan la apariencia neutral y piel morena.'
                    : 'Sin una selección, usan su apariencia original.'}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...draft,
                      [appearance]: Object.fromEntries(
                        Object.keys(group.roles).map((role) => [
                          role,
                          {
                            spriteAppearance: generic
                              ? 'worker'
                              : field === 'oppositionEquipment'
                                ? 'royalist'
                                : 'granadero',
                            skinTone: 'brown',
                          },
                        ]),
                      ),
                    })
                  }
                >
                  Configurar apariencia de {group.label.toLowerCase()}
                </button>
              </>
            ) : (
              <div className="fields">
                {Object.entries(group.roles).map(([role, label]) => (
                  <fieldset key={role}>
                    <legend>{label} · apariencia</legend>
                    <label>
                      Apariencia de la tropa
                      <select
                        value={draft[appearance]?.[role]?.spriteAppearance ?? 'worker'}
                        onChange={(e) =>
                          onChange({
                            ...draft,
                            [appearance]: {
                              ...draft[appearance],
                              [role]: {
                                ...draft[appearance]?.[role],
                                spriteAppearance: e.target.value,
                              },
                            },
                          })
                        }
                      >
                        {Object.entries(APPEARANCE_LABELS).map(([id, name]) => (
                          <option key={id} value={id}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Piel de la tropa
                      <select
                        value={draft[appearance]?.[role]?.skinTone ?? 'brown'}
                        onChange={(e) =>
                          onChange({
                            ...draft,
                            [appearance]: {
                              ...draft[appearance],
                              [role]: {
                                ...draft[appearance]?.[role],
                                skinTone: e.target.value,
                              },
                            },
                          })
                        }
                      >
                        <option value="light">Clara</option>
                        <option value="brown">Morena</option>
                        <option value="dark">Oscura</option>
                      </select>
                    </label>
                  </fieldset>
                ))}
              </div>
            )}
          </fieldset>
        );
      })}
    </section>
  );
}
