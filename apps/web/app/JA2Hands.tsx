'use client';

import type { TacticalOrder } from '../../../packages/game/public/hud-types.ts';

import { formatAP } from '../../../packages/game/action-points.js';
import type {
  BattleSnapshot,
  BattleUnit,
} from '../../../packages/game/public/compatibility-types.ts';

import { handSlots, unitCanAct } from '../../../packages/game/ja2-hud.ts';
import { useEquipmentDrag } from '../lib/equipment-drag';
import { sitePath } from '../lib/site-path.js';
import './ja2-hands.css';
type Props = {
  battle: BattleSnapshot;
  unit: BattleUnit;
  busy: boolean;
  compact?: boolean;
  onOrder: (action: TacticalOrder) => void;
  onPick: (item: string, slotId?: string) => void;
};
export default function JA2Hands({ battle, unit, busy, compact = false, onOrder, onPick }: Props) {
  const unavailable = busy || !unitCanAct(battle, unit);
  const drag = useEquipmentDrag(battle, unit, unavailable, onOrder);
  return (
    <div className={`ja2-hands ${compact ? 'compact' : ''}`} aria-label="Manos del combatiente">
      {handSlots(battle, unit).map((hand) => (
        <button
          key={hand.side}
          type="button"
          className={
            hand.blocked ? 'blocked' : drag.target === `hand:${hand.side}` ? 'drop-target' : ''
          }
          disabled={unavailable || hand.blocked}
          aria-label={`${hand.side === 'right' ? 'Mano principal' : 'Segunda mano'}: ${hand.label}${hand.loading ? `. ${hand.loading.description}` : ''}`}
          title={[
            hand.reason ||
              `${hand.label}. ${compact && hand.action ? `Usar este objeto · ${battle.mode === 'exploration' ? 'sin PA' : `${formatAP(hand.pa)} PA`}` : 'Clic: tomar o colocar. Botón derecho: detalles.'}`,
            hand.loading?.description,
          ]
            .filter(Boolean)
            .join(' ')}
          data-held={Boolean(hand.item)}
          {...drag.handlers(`hand:${hand.side}`, {
            onInspect: onPick,
            selectOnClick: !compact,
          })}
          {...(compact
            ? {
                onClick: () => {
                  if (hand.disabled) {
                    return;
                  }
                  if (hand.action) {
                    onOrder(hand.action);
                  } else {
                    onPick(hand.item || 'primary');
                  }
                },
              }
            : {})}
        >
          <small>{hand.side === 'right' ? 'Mano principal' : 'Segunda mano'}</small>
          {!compact && (hand.art || hand.weapon) && (
            <img src={sitePath(hand.art ?? `/art/weapon-${hand.weapon}.png`)} alt="" />
          )}
          <span>{hand.blocked ? '↔ Arma de dos manos' : hand.label}</span>
          {hand.loaded === undefined && hand.condition !== undefined && (
            <small>Estado {hand.condition}%</small>
          )}
          {hand.loaded !== undefined && (
            <small>
              {hand.loaded} carga(s) · {hand.condition}%
            </small>
          )}
          {hand.loading && <small title={hand.loading.description}>{hand.loading.label}</small>}
          {hand.condition !== undefined && (
            <span className="ja2-item-bar" title={`Estado ${hand.condition}%`} aria-hidden="true">
              <i style={{ width: `${hand.condition}%` }} />
            </span>
          )}
        </button>
      ))}
      {compact && drag.hint && <output className="equipment-drag-hint">{drag.hint}</output>}
    </div>
  );
}
