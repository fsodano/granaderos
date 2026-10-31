'use client';

import type { TacticalOrder } from '../../../packages/game/public/hud-types.ts';

import { formatAP } from '../../../packages/game/action-points.js';
import type {
  BattleArtillery,
  BattleSnapshot,
  BattleUnit,
} from '../../../packages/game/public/compatibility-types.ts';

import { useState } from 'react';
import { artilleryProfile } from '../../../packages/game/artillery-definitions.ts';
import { unitCanAct } from '../../../packages/game/ja2-hud.ts';
import {
  artilleryCosts,
  artilleryCrewPlan,
  artilleryReloadPreview,
} from '../../../packages/game/tactical.js';

type Props = {
  battle: BattleSnapshot;
  unit: BattleUnit | undefined;
  artillery: BattleArtillery[];
  cannonId: string;
  shotType: string;
  busy: boolean;
  mode: string;
  onCannonChange: (id: string) => void;
  onShotTypeChange: (type: string) => void;
  onOrder: (action: TacticalOrder) => void;
  onMode: (mode: string) => void;
  onLeaveCannon: () => void;
  onPersonalWeapon: () => void;
  personalWeaponReason?: string | undefined;
  personalWeaponPA: number;
};

// The closed view is one short row. Crew previews run only in the open menu.
export default function JA2ArtilleryMenu(props: Props) {
  const [open, setOpen] = useState(false);
  const gun = props.artillery.find((g) => g.id === props.cannonId);
  return (
    <div className="ja2-artillery-toolbar">
      <details
        className="ja2-artillery-menu"
        open={open}
        onToggle={(event) => {
          if (event.target === event.currentTarget) {
            setOpen(event.currentTarget.open);
          }
        }}
      >
        <summary
          data-cannon-active={Boolean(gun)}
          title={gun ? artilleryProfile(props.battle, gun).name : undefined}
        >
          {gun ? (
            <span className="ja2-artillery-active" aria-label="Control del cañón">
              {props.unit?.nickname || props.unit?.name || 'Seleccioná un combatiente'} · Cañón
            </span>
          ) : (
            'Artillería'
          )}
        </summary>
        {open && (
          <ArtilleryControls
            {...props}
            onLeaveCannon={() => {
              props.onLeaveCannon();
              setOpen(false);
            }}
          />
        )}
      </details>
      {gun && (
        <button
          className="line-button ja2-personal-weapon"
          disabled={props.busy || Boolean(props.personalWeaponReason)}
          title={props.personalWeaponReason || undefined}
          onClick={() => {
            props.onPersonalWeapon();
            setOpen(false);
          }}
        >
          Arma personal
          {props.personalWeaponPA > 0 && props.battle.mode !== 'exploration'
            ? ` · ${formatAP(props.personalWeaponPA)} PA`
            : ''}
        </button>
      )}
    </div>
  );
}

function ArtilleryControls({
  battle,
  unit,
  artillery,
  cannonId,
  shotType,
  busy,
  mode,
  onCannonChange,
  onShotTypeChange,
  onOrder,
  onMode,
  onLeaveCannon,
  personalWeaponReason,
}: Props) {
  const gun = artillery.find((g) => g.id === cannonId);
  const ready = Boolean(unit && unitCanAct(battle, unit) && !busy);
  const costs = unit && gun ? artilleryCosts(battle, unit, gun) : null;
  const reload = unit && gun ? artilleryReloadPreview(battle, unit, gun) : null;
  const cost =
    mode === 'artilleryMove' ? costs?.move : mode === 'artilleryPivot' ? costs?.pivot : costs?.fire;
  const plan =
    unit && gun
      ? !gun.loaded && !['artilleryMove', 'artilleryPivot'].includes(mode)
        ? reload
        : { ...artilleryCrewPlan(battle, unit, gun, cost), pa: cost }
      : null;
  const actions = [
    {
      id: 'artillery',
      label: 'Disparar pieza',
      pa: costs?.fire,
      disabled: !gun?.loaded,
    },
    { id: 'artilleryMove', label: 'Mover pieza', pa: costs?.move },
    { id: 'artilleryPivot', label: 'Girar pieza', pa: costs?.pivot },
  ];
  return (
    <section className="ja2-artillery" aria-label="Órdenes de artillería">
      <p>
        La dotación se elige para cada orden entre los combatientes próximos. Podés volver a tu arma
        sin cambiar de casilla.
      </p>
      <select
        aria-label="Seleccionar pieza de artillería"
        value={cannonId}
        onChange={(e) => onCannonChange(e.target.value)}
      >
        <option value="">Elegir cañón</option>
        {artillery.map((g) => (
          <option key={g.id} value={g.id}>
            {artilleryProfile(battle, g).name} ·{' '}
            {g.loaded
              ? 'cargado'
              : g.reloadProgress
                ? `recarga ${Math.floor(g.reloadProgress * 100)}%`
                : 'descargado'}
          </option>
        ))}
      </select>
      {gun && (
        <div className="ja2-artillery-crew" aria-live="polite">
          <span>
            Dotación para{' '}
            {mode === 'artilleryMove'
              ? 'mover'
              : mode === 'artilleryPivot'
                ? 'girar'
                : !gun.loaded
                  ? 'recargar'
                  : 'disparar'}
            : {plan?.crew.length || 0}/{artilleryProfile(battle, gun).crew}
          </span>
          {plan?.crew.map((id: string) => {
            const member = battle.units.find((actor) => actor.id === id);
            return (
              <span key={id} data-artillery-crew-id={id}>
                {member?.nickname || member?.name} ·{' '}
                {battle.mode === 'exploration' ? 'sin PA' : `${formatAP(plan.pa)} PA`}
              </span>
            );
          })}
          {plan?.reason && <span className="unavailable">{plan.reason}</span>}
        </div>
      )}
      {reload && (
        <p aria-live="polite">
          {reload.reason ||
            (battle.mode === 'exploration'
              ? 'Recarga sin coste de PA. Consume una munición al completar la carga.'
              : `Recarga: ${formatAP(reload.pa)} PA por artillero${reload.partial ? ` ahora; faltan ${formatAP(reload.remainingPA)} PA por artillero` : ''}.`)}
        </p>
      )}
      <select
        aria-label="Munición de artillería"
        value={shotType}
        onChange={(e) => onShotTypeChange(e.target.value)}
      >
        <option value="solid">Bala rasa</option>
        <option value="canister">Metralla</option>
      </select>
      {actions.map((action) => {
        const crew = unit && gun ? artilleryCrewPlan(battle, unit, gun, action.pa) : null;
        return (
          <button
            key={action.id}
            className="line-button"
            disabled={!ready || !crew || Boolean(crew.reason) || action.disabled}
            title={crew?.reason || undefined}
            onClick={() => onMode(action.id)}
          >
            {action.label} ·{' '}
            {battle.mode === 'exploration'
              ? 'sin PA'
              : `${formatAP(action.pa ?? '—')} PA por artillero`}
          </button>
        );
      })}
      <button
        className="line-button"
        disabled={!ready || !reload?.valid}
        onClick={() => onOrder({ type: 'artilleryReload', artilleryId: cannonId })}
      >
        Recargar pieza ·{' '}
        {battle.mode === 'exploration'
          ? 'sin PA'
          : `${formatAP(reload?.pa ?? '—')} PA por artillero`}
      </button>
      {gun && (
        <button className="line-button" disabled={busy} onClick={onLeaveCannon}>
          Dejar cañón
        </button>
      )}
      {personalWeaponReason && (
        <p>
          <output>{personalWeaponReason}</output>
        </p>
      )}
    </section>
  );
}
