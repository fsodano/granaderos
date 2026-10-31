'use client';

import type { TacticalOrder } from '../../../packages/game/public/hud-types.ts';

import { formatAP } from '../../../packages/game/action-points.js';
import type { WeaponFitting } from '../../../packages/game/public/compatibility-types.ts';
import type { AttachedBayonet, BayonetSource } from './tactical-ui-types';

import { fittingLabel } from '../../../packages/game/weapon-fittings.js';

export function FittingReadout({ fitting }: { fitting: WeaponFitting | null | undefined }) {
  return fitting ? (
    <small>
      {fittingLabel(fitting.fittingPattern)} fijada · estado {fitting.condition}%
    </small>
  ) : null;
}

export function LooseBayonetControl({
  source,
  busy,
  onOrder,
  freeActions = false,
}: {
  freeActions?: boolean;
  source: BayonetSource | null | undefined;
  busy: boolean;
  onOrder: (action: TacticalOrder) => void;
}) {
  if (!source) {
    return null;
  }
  return (
    <div className="ja2-bayonet-control">
      <small>
        {source.label} · suelta · estado {source.condition}% · {source.weight} kg
      </small>
      <button
        className="line-button"
        disabled={busy || !source.preview.valid}
        title={source.preview.reason || 'Fijada no ocupa espacio de mochila.'}
        onClick={() => onOrder(source.action)}
      >
        Fijar al Brown Bess · {freeActions ? 'sin PA' : `${formatAP(source.preview.pa)} PA`}
      </button>
      {source.preview.reason && <small>{source.preview.reason}</small>}
    </div>
  );
}

export function AttachedBayonetControl({
  attached,
  busy,
  onOrder,
  freeActions = false,
}: {
  freeActions?: boolean;
  attached: AttachedBayonet | null | undefined;
  busy: boolean;
  onOrder: (action: TacticalOrder) => void;
}) {
  if (!attached) {
    return null;
  }
  return (
    <section className="ja2-bayonet-control" aria-label="Bayoneta fijada">
      <FittingReadout fitting={attached} />
      <small>
        Fusil: estado {attached.hostCondition}% · Bayoneta: {attached.weight} kg, sin espacio
        adicional de mochila.
      </small>
      {attached.removals.map((option) => (
        <div key={option.destination}>
          <button
            className="line-button"
            disabled={busy || !option.preview.valid}
            title={option.preview.reason || undefined}
            onClick={() => onOrder(option.action)}
          >
            {option.label} · {freeActions ? 'sin PA' : `${formatAP(option.preview.pa)} PA`}
          </button>
          {option.preview.reason && <small>{option.preview.reason}</small>}
        </div>
      ))}
    </section>
  );
}
