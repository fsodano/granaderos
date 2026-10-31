'use client';

import type { TacticalOrder } from '../../../packages/game/public/hud-types.ts';

import { formatAP } from '../../../packages/game/action-points.js';
import type {
  BattleSnapshot,
  BattleUnit,
} from '../../../packages/game/public/compatibility-types.ts';

import { useEffect, useRef, useState } from 'react';
import { lootBatchSelectionModel, nearbyLootOptions } from '../../../packages/game/ja2-hud.ts';
import { tacticalGridLabel } from '../../../packages/game/tactical-grid.js';

export default function JA2LootPicker({
  battle,
  unit,
  point,
  busy,
  onTake,
  onClose,
}: {
  battle: BattleSnapshot;
  unit: BattleUnit;
  point: { x: number; y: number };
  busy: boolean;
  onTake: (action: TacticalOrder) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    first = useRef<HTMLInputElement>(null);
  const [selection, setSelection] = useState<Record<string, number>>(() => {
    const option = nearbyLootOptions(battle, unit, point)[0];
    return option ? { [option.id]: 1 } : {};
  });
  const { options, action, preview, selectedCount } = lootBatchSelectionModel(
    battle,
    unit,
    point,
    selection,
  );
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  useEffect(() => {
    if (!busy) {
      first.current?.focus();
    }
  }, [busy]);
  const toggle = (id: string) =>
    setSelection((current) => {
      const next = { ...current };
      if (Object.hasOwn(next, id)) {
        delete next[id];
      } else {
        next[id] = 1;
      }
      return next;
    });
  return (
    <dialog
      ref={dialog}
      className="ja2-loot-dialog"
      aria-labelledby="loot-picker-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header>
        <div>
          <h2 id="loot-picker-title">Equipo · {tacticalGridLabel(point.x, point.y)}</h2>
          <p>
            {unit.nickname || unit.name} ·{' '}
            {battle.mode === 'exploration' ? `${unit.energy} EN` : `${formatAP(unit.ap)} PA`}
          </p>
        </div>
        <button className="line-button" onClick={onClose}>
          Cerrar equipo
        </button>
      </header>
      {options.length ? (
        <>
          <div className="ja2-loot-select">
            <button
              className="line-button"
              disabled={busy}
              onClick={() =>
                setSelection(Object.fromEntries(options.map((option) => [option.id, option.count])))
              }
            >
              Seleccionar todos
            </button>
            <button
              className="line-button"
              disabled={busy || !selectedCount}
              onClick={() => setSelection({})}
            >
              Limpiar selección
            </button>
          </div>
          <fieldset
            className="ja2-loot-list"
            aria-label="Objetos disponibles"
            style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
          >
            {options.map((option, index) => {
              const checked = Object.hasOwn(selection, option.id);
              return (
                <div className="ja2-loot-row" key={option.id}>
                  <div>
                    <label className="ja2-loot-choice">
                      <input
                        ref={index === 0 ? first : undefined}
                        type="checkbox"
                        checked={checked}
                        disabled={busy}
                        aria-label={`Recoger ${index + 1}: ${option.source} · ${option.label}`}
                        onChange={() => toggle(option.id)}
                      />
                      <span>
                        <strong>
                          {option.label} · {option.count}
                        </strong>
                        <small>{option.source}</small>
                      </span>
                    </label>
                    <p>
                      {option.condition !== undefined && `Estado ${option.condition}%. `}
                      {option.loaded !== undefined && `${option.loaded} carga(s). `}
                      {option.jammed && 'Necesita cebado. '}
                      {option.fittings?.['bayonet'] && 'Con bayoneta fijada. '}
                    </p>
                  </div>
                  <label className="ja2-loot-quantity">
                    Cantidad
                    <input
                      aria-label={`Cantidad ${index + 1}: ${option.source} · ${option.label}`}
                      type="number"
                      min="1"
                      max={option.count}
                      step="1"
                      value={checked ? selection[option.id] : 1}
                      disabled={busy || !checked}
                      onChange={(event) =>
                        setSelection((current) => ({
                          ...current,
                          [option.id]: Number(event.target.value),
                        }))
                      }
                    />
                  </label>
                </div>
              );
            })}
          </fieldset>
          <footer>
            <p aria-live="polite">
              {selectedCount} objeto(s) seleccionados.{' '}
              {battle.mode === 'exploration'
                ? 'Recoger consume tiempo.'
                : `Recoger: ${formatAP(preview.pa)} PA · ${formatAP(Math.max(0, unit.ap - preview.pa))} PA restantes.`}
            </p>
            <p>
              Solo se recogen las cantidades seleccionadas. Si no cabe todo, quitá objetos o reducí
              cantidades.
            </p>
            {preview.reason && (
              <p>
                <output>{preview.reason}</output>
              </p>
            )}
            <button
              className="gold-button"
              disabled={busy || !preview.valid}
              onClick={() => onTake(action)}
            >
              Recoger selección
              {battle.mode === 'exploration' ? '' : ` · ${formatAP(preview.pa)} PA`}
            </button>
          </footer>
        </>
      ) : (
        <p>
          <output>No queda equipo visible en esta casilla.</output>
        </p>
      )}
    </dialog>
  );
}
