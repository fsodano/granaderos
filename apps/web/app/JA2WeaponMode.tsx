'use client';

import type { TacticalOrder } from '../../../packages/game/public/hud-types.ts';

import { unitCanAct } from '../../../packages/game/ja2-hud.ts';
import type {
  BattleSnapshot,
  BattleUnit,
} from '../../../packages/game/public/compatibility-types.ts';
import { hasFirearm } from '../../../packages/game/tactical.js';
import { fixedBayonetFor } from '../../../packages/game/weapon-fittings.js';
import './ja2-weapon-mode.css';
export default function JA2WeaponMode({
  battle,
  unit,
  busy,
  onOrder,
  onMode,
}: {
  battle: BattleSnapshot;
  unit: BattleUnit;
  busy: boolean;
  onOrder: (a: TacticalOrder) => void;
  onMode: (mode: string) => void;
}) {
  if (!unit || !hasFirearm(unit)) {
    return null;
  }
  const current = unit.weaponMode ?? 'fire',
    disabled = busy || !unitCanAct(battle, unit) || unit.knockedDown;
  return (
    <fieldset
      className="ja2-weapon-mode"
      style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
      aria-label="Modo del arma en mano"
    >
      {(
        [
          ['fire', 'Disparo'],
          ['melee', 'Combate cercano'],
        ] as const
      ).map(([mode, label]) => (
        <button
          key={mode}
          aria-pressed={current === mode}
          disabled={disabled}
          title={
            mode === 'fire'
              ? 'Disparar con la munición disponible.'
              : fixedBayonetFor(unit)
                ? 'Acercarse y atacar con la bayoneta fijada.'
                : 'Acercarse y golpear con la culata del arma.'
          }
          onClick={() => {
            if (current !== mode) {
              onOrder({ type: 'weaponMode', mode });
            }
            onMode(mode === 'melee' ? 'useItem' : 'move');
          }}
        >
          {label}
        </button>
      ))}
      {current === 'melee' && <span>{fixedBayonetFor(unit) ? 'Bayoneta' : 'Culata'}</span>}
    </fieldset>
  );
}
