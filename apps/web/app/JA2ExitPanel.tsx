'use client';

import { formatAP } from '../../../packages/game/action-points.js';
import type { ExitModel } from '../../../packages/game/public/hud-types.ts';

type Props = {
  model: ExitModel;
  selectedId?: string | undefined;
  busy: boolean;
  onUnits: (ids: string[]) => void;
  onExit: (id: string) => void;
  onLeave: () => void;
  onClose: () => void;
  exploring: boolean;
};

export default function JA2ExitPanel({
  model,
  selectedId,
  busy,
  onUnits,
  onExit,
  onLeave,
  onClose,
  exploring,
}: Props) {
  const { units, exits, selectedExit, unitIds, preview } = model;
  return (
    <section className="ja2-exit-panel" aria-label="Salida del sector">
      <header>
        <div>
          <strong>{exploring ? 'Salir del sector' : 'Retirada por el borde'}</strong>
          <p>
            Mové a los combatientes hasta el borde elegido. Cruzarlo consume fuerzas
            {exploring ? ' y tiempo.' : ' y PA. El enemigo puede reaccionar.'}
          </p>
        </div>
        <button className="line-button" onClick={onClose}>
          Cerrar salida
        </button>
      </header>
      <label>
        Destino{' '}
        <select
          aria-label="Destino de salida"
          value={selectedExit?.id || ''}
          disabled={busy || !exits.length}
          onChange={(event) => onExit(event.target.value)}
        >
          {!exits.length && <option value="">No hay salidas autorizadas</option>}
          {exits.map((exit) => (
            <option key={exit.id} value={exit.id}>
              {exit.label}
            </option>
          ))}
        </select>
      </label>
      <div className="ja2-exit-selection">
        <button
          className="line-button"
          disabled={busy || !units.some((unit) => unit.id === selectedId)}
          onClick={() => onUnits(selectedId ? [selectedId] : [])}
        >
          Solo seleccionado
        </button>
        <button
          className="line-button"
          disabled={busy || !units.length}
          onClick={() => onUnits(units.map((unit) => unit.id))}
        >
          Todos presentes
        </button>
        {preview.blocked.length > 0 && preview.eligibleIds.length > 0 && (
          <button
            className="line-button"
            disabled={busy}
            onClick={() => onUnits(preview.eligibleIds)}
          >
            Seleccionar los que pueden salir
          </button>
        )}
      </div>
      <fieldset>
        <legend>Combatientes que van a salir</legend>
        {units.map((unit) => {
          const checked = unitIds.includes(unit.id),
            blocked = preview.blocked.find((entry) => entry.id === unit.id);
          return (
            <label className="ja2-exit-unit" key={unit.id}>
              <input
                type="checkbox"
                checked={checked}
                disabled={busy}
                onChange={() =>
                  onUnits(
                    checked
                      ? unitIds.filter((id: string) => id !== unit.id)
                      : [...unitIds, unit.id],
                  )
                }
              />
              <span>{unit.nickname || unit.name}</span>
              {checked && (
                <small>
                  {blocked?.reason ||
                    (exploring
                      ? 'Puede cruzar'
                      : `${formatAP(preview.costById[unit.id])} PA para cruzar`)}
                </small>
              )}
            </label>
          );
        })}
      </fieldset>
      {(preview.prisoners ?? []).length > 0 && (
        <ul aria-label="Prisioneros escoltados">
          {preview.prisoners.map((npc) => (
            <li key={npc.id}>
              {npc.name}:{' '}
              {npc.ready
                ? 'cruzará con su rescatista si la salida tiene éxito.'
                : 'quedará en el sector. Debe poder caminar y estar junto a su rescatista, en el mismo borde, con la orden de seguir.'}
            </li>
          ))}
        </ul>
      )}
      {preview.reason && (
        <p>
          <output>{preview.reason}</output>
        </p>
      )}
      <button className="gold-button" disabled={busy || !preview.available} onClick={onLeave}>
        Cruzar el borde · {unitIds.length} {unitIds.length === 1 ? 'combatiente' : 'combatientes'}
      </button>
      <p className="ja2-exit-note">
        La salida parcial conserva la visita al sector. Podés atender otra escuadra y reanudar esta
        visita desde la carta de operaciones.
      </p>
    </section>
  );
}
