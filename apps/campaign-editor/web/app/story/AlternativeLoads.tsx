'use client';
import { applyDraftPatch, isAlternativeLoad } from '../../lib/editor-values.ts';
import type {
  AlternativeLoad,
  DraftPatch,
  WeaponDefinition,
} from '../../../../../packages/campaign-format/types.ts';
import {
  AMMO_KEYS,
  AMMO_TYPES,
  primaryAmmoTypeFor,
  ammunitionLoadsFor,
} from '../../../../../packages/game/public/campaign-editor-api.ts';
export default function AlternativeLoads({
  weapon,
  onChange,
}: {
  weapon: WeaponDefinition;
  onChange: (patch: DraftPatch<WeaponDefinition>) => void;
}) {
  const primary = primaryAmmoTypeFor(weapon),
    loads: AlternativeLoad[] = ammunitionLoadsFor(weapon).filter(isAlternativeLoad),
    change = (index: number, patch: DraftPatch<AlternativeLoad>) =>
      onChange({
        alternativeLoads: loads.map((load, i: number) =>
          i === index ? applyDraftPatch(load, patch) : load,
        ),
      });
  return (
    <section aria-label="Cargas alternativas">
      <h3>Cargas alternativas</h3>
      <p>
        La carga principal usa los valores del arma. Cada alternativa consume otra familia de
        munición y puede cambiar el daño, el alcance y el patrón del disparo. El jugador elige con
        el arma vacía, antes de recargar.
      </p>
      {loads.map((load, index: number) => {
        const energy = load.projectileEnergy;
        const drag = load.projectileAirDrag;
        return (
          <fieldset key={load.family} aria-label={`Carga alternativa ${index + 1}`}>
            <legend>Carga alternativa {index + 1}</legend>
            <label>
              Familia de la carga
              <select
                value={load.family}
                onChange={(e) => change(index, { family: e.target.value })}
              >
                {AMMO_KEYS.filter(
                  (key) =>
                    key !== primary &&
                    !loads.some((l, i: number) => i !== index && l.family === key),
                ).map((key) => (
                  <option key={key} value={key}>
                    {AMMO_TYPES[key]?.name ?? key}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Daño de la carga
              <input
                type="number"
                min={1}
                max={100}
                step={1}
                value={Number.isFinite(load.damage) ? load.damage : ''}
                onChange={(e) => change(index, { damage: e.target.valueAsNumber })}
              />
            </label>
            <label>
              Alcance de la carga
              <input
                type="number"
                min={1}
                max={100}
                step={1}
                value={Number.isFinite(load.range) ? load.range : ''}
                onChange={(e) => change(index, { range: e.target.valueAsNumber })}
              />
            </label>
            <label>
              Patrón del disparo
              <select
                value={load.pattern}
                onChange={(e) =>
                  change(index, { pattern: e.target.value === 'cone' ? 'cone' : 'single' })
                }
              >
                <option value="single">Tiro único</option>
                <option value="cone">Abanico</option>
              </select>
            </label>
            <label>
              Pérdida de penetración de la carga
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={load.materialRangeSlope ?? ''}
                onChange={(e) =>
                  change(index, {
                    materialRangeSlope: e.target.value === '' ? undefined : e.target.valueAsNumber,
                  })
                }
              />
            </label>
            <p>
              Más allá de este alcance, el valor aumenta la resistencia al entrar en cobertura.
              Vacío o cero conserva la resistencia original; no hereda el valor de la carga
              principal.
            </p>
            <label>
              <input
                type="checkbox"
                checked={energy !== undefined}
                onChange={(e) =>
                  change(
                    index,
                    e.target.checked
                      ? {
                          projectileEnergy: {
                            model: 'kinetic-energy-v1',
                            massGrams: 16,
                            muzzleVelocityMps: 265,
                          },
                        }
                      : { projectileEnergy: undefined, projectileAirDrag: undefined },
                  )
                }
              />
              Energía física de la carga alternativa
            </label>
            {energy && (
              <>
                <label>
                  Masa total de la carga alternativa (g)
                  <input
                    type="number"
                    min={0.1}
                    max={40}
                    step={0.1}
                    value={energy.massGrams}
                    onChange={(e) =>
                      change(index, {
                        projectileEnergy: {
                          ...energy,
                          massGrams: e.target.valueAsNumber,
                        },
                      })
                    }
                  />
                </label>
                <label>
                  Velocidad inicial de la carga alternativa (m/s)
                  <input
                    type="number"
                    min={25}
                    max={600}
                    step={1}
                    value={energy.muzzleVelocityMps}
                    onChange={(e) =>
                      change(index, {
                        projectileEnergy: {
                          ...energy,
                          muzzleVelocityMps: e.target.valueAsNumber,
                        },
                      })
                    }
                  />
                </label>
              </>
            )}
            <p>
              Este modelo convierte la masa total y la velocidad en energía de impacto. Más energía
              puede atravesar más material; el daño del arma conserva su límite. En abanico, los
              nueve rayos comparten la masa y la energía. Es ajuste de juego, sin escala física para
              la trayectoria. Desactivado no hereda el modelo principal. Cada carga completa pesa 40
              g.
            </p>
            <label>
              <input
                type="checkbox"
                checked={drag !== undefined}
                disabled={!energy}
                onChange={(e) =>
                  change(index, {
                    projectileAirDrag: e.target.checked
                      ? { model: 'range-energy-retention-v1', retentionAtRange: 0.65 }
                      : undefined,
                  })
                }
              />
              Pérdida de energía en el aire de la carga alternativa
            </label>
            {drag && (
              <label>
                Energía restante al alcance de la carga (%)
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={Number((drag.retentionAtRange * 100).toPrecision(15))}
                  onChange={(e) =>
                    change(index, {
                      projectileAirDrag: {
                        ...drag,
                        retentionAtRange: e.target.valueAsNumber / 100,
                      },
                    })
                  }
                />
              </label>
            )}
            <p>
              Requiere energía física en esta misma carga. El porcentaje debe ser mayor que cero y
              no superar 100. Tras una distancia de vuelo libre igual a su alcance, conserva esa
              parte de la energía antes de otras pérdidas; un valor menor puede reducir el daño y la
              penetración. Desactivado no pierde energía en el aire ni hereda el valor principal. Es
              ajuste de juego; no cambia el tiempo de vuelo ni la trayectoria.
            </p>
            <button
              onClick={() =>
                onChange({ alternativeLoads: loads.filter((_, i: number) => i !== index) })
              }
            >
              Quitar carga alternativa {index + 1}
            </button>
          </fieldset>
        );
      })}
      <button
        disabled={loads.length >= AMMO_KEYS.length - 1}
        onClick={() =>
          onChange({
            alternativeLoads: [
              ...loads,
              {
                family:
                  AMMO_KEYS.find(
                    (key) => key !== primary && !loads.some((l) => l.family === key),
                  ) ?? '',
                damage: weapon.damage,
                range: weapon.range ?? 1,
                pattern: 'single',
              },
            ],
          })
        }
      >
        Agregar carga alternativa
      </button>
      <button onClick={() => onChange({ alternativeLoads: undefined })}>
        Restaurar cargas alternativas originales
      </button>
      <p>
        Los cartuchos conservan su familia y se compran al precio del proveedor. Una carga ya
        preparada no puede convertirse en otra. Los valores son reglas de juego editables.
      </p>
    </section>
  );
}
