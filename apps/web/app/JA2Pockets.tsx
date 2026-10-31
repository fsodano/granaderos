'use client';
import type {
  InventoryActor,
  InventoryContext,
  InventoryOrderHandler,
} from '../../../packages/game/public/inventory-types.ts';

import type { LucideIcon } from 'lucide-react';
import { CircleDot, Cross, Flame, Package, Utensils } from 'lucide-react';
import type { InventoryPocketLayout } from '../../../packages/game/public/hud-types.ts';
import { useEquipmentDrag } from '../lib/equipment-drag';
import { sitePath } from '../lib/site-path.js';
import './ja2-pockets.css';
const icons: Record<string, LucideIcon> = {
  ammo: Package,
  rations: Utensils,
  medkits: Cross,
  boleadoras: CircleDot,
  torches: Flame,
};
type QuantityProps = {
  scope: string;
  quantity: { count: number; maxCount: number };
  setCount: (count: number) => boolean;
  disabled?: boolean;
};
export function EquipmentQuantityControls({
  scope,
  quantity,
  setCount,
  disabled = false,
}: QuantityProps) {
  return (
    <fieldset
      className="equipment-quantity"
      data-equipment-scope={scope}

      aria-label="Cantidad a mover"
      style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
    >
      <label>
        Cantidad{' '}
        <input
          type="number"
          onClick={(event) => event.stopPropagation()}
          aria-label="Cantidad a mover"
          min={1}
          max={quantity.maxCount}
          step={1}
          value={quantity.count}
          disabled={disabled}
          onChange={(event) => {
            if (!setCount(event.currentTarget.valueAsNumber)) {
              event.currentTarget.value = String(quantity.count);
            }
          }}
        />
      </label>
      <span>de {quantity.maxCount}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          setCount(quantity.maxCount);
        }}
      >
        Todo
      </button>
    </fieldset>
  );
}
type Props = {
  battle: InventoryContext;
  unit: InventoryActor;
  layout: InventoryPocketLayout;
  disabled: boolean;
  onPick: (item: string, slotId?: string) => void;
  onOrder: InventoryOrderHandler;
};
export default function JA2Pockets({ battle, unit, layout, disabled, onPick, onOrder }: Props) {
  const drag = useEquipmentDrag(battle, unit, disabled, onOrder);
  return (
    <section className="ja2-pockets" aria-label="Bolsillos del combatiente">
      <p>Bolsillos · 4 grandes / 8 pequeños</p>
      <output className="equipment-drag-hint">
        {drag.hint ||
          (drag.active
            ? 'Elegí el destino. Esc: devolver objeto.'
            : 'Clic: uno. Mayús + clic: todos. Botón derecho: detalles.')}
      </output>
      {drag.quantity && drag.quantity.maxCount > 1 && (
        <EquipmentQuantityControls
          scope={drag.scope}
          quantity={drag.quantity}
          setCount={drag.setCount}
          disabled={disabled || drag.dragging}
        />
      )}
      {['large', 'small'].map((size) => (
        <fieldset
          style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
          className={`ja2-pocket-row ${size}`}
          key={size}
          aria-label={size === 'large' ? 'Bolsillos grandes' : 'Bolsillos pequeños'}
        >
          {layout.slots
            .filter((slot) => slot.size === size)
            .map((slot) => {
              const weaponArt =
                typeof slot.entry?.weapon === 'number'
                  ? `/art/weapon-${slot.entry.weapon}.png`
                  : '';
              const Icon = icons[slot.entry?.item ?? ''] ?? Package;
              return (
                <button
                  key={slot.id}
                  type="button"
                  className={`ja2-pocket ${slot.entry ? 'occupied' : ''}${drag.target === slot.id ? ' drop-target' : ''}`}
                  aria-label={`${slot.label}: ${slot.entry ? `${slot.entry.label} · ${slot.entry.count}` : 'vacío'}`}
                  disabled={disabled}
                  title={`${slot.label}${slot.entry ? `: ${slot.entry.label} · ${slot.entry.count}${slot.entry.condition !== undefined ? ` · estado ${slot.entry.condition}%` : ''}` : ''}`}
                  {...drag.handlers(slot.id, { onInspect: onPick })}
                >
                  {slot.entry ? (
                    <>
                      {slot.entry.art ||
                      (typeof slot.entry.weapon === 'number' &&
                        slot.entry.weapon >= 1800 &&
                        slot.entry.weapon <= 1813) ? (
                        <img src={sitePath(slot.entry.art ?? weaponArt)} alt="" />
                      ) : (
                        <Icon size={22} aria-hidden="true" />
                      )}
                      <span>{slot.entry.label}</span>
                      <b>{slot.entry.count}</b>
                      {(slot.entry.ammoType || slot.entry.condition !== undefined) && (
                        <span
                          className={`ja2-item-bar ${slot.entry.ammoType ? 'ammunition' : ''}`}
                          title={
                            slot.entry.ammoType
                              ? `${slot.entry.count} cartuchos`
                              : `Estado ${slot.entry.condition}%`
                          }
                          aria-hidden="true"
                        >
                          <i
                            style={{
                              width: `${Math.max(0, Math.min(100, slot.entry.ammoType ? (slot.entry.count / Math.max(1, slot.entry.stackLimit ?? slot.entry.count)) * 100 : (slot.entry.condition ?? 0)))}%`,
                            }}
                          />
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="empty">{size === 'large' ? 'Grande' : 'Pequeño'}</span>
                  )}
                </button>
              );
            })}
        </fieldset>
      ))}
      {layout.overflow.length > 0 && (
        <fieldset
          className="ja2-pocket-overflow"
          aria-label="Objetos sin espacio"
          style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
        >
          <p>No cabe todo el equipo. Entregá o soltá estos objetos.</p>
          {layout.overflow.map((entry) => (
            <button key={entry.item} disabled={disabled} onClick={() => onPick(entry.item)}>
              {entry.label} · {entry.count}
            </button>
          ))}
        </fieldset>
      )}
    </section>
  );
}
