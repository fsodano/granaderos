'use client';
import {formatAP} from '../../game/action-points.js';

import {useMemo, useState} from 'react';
import {artilleryCosts, artilleryCrewPlan, artilleryReloadPreview} from '../../game/tactical.js';
import {artilleryProfile} from '../../game/artillery-definitions.js';
import {unitCanAct} from '../../game/ja2-hud.js';

type Props = {
  battle: any; unit: any; artillery: any[]; cannonId: string; shotType: string; busy: boolean; mode: string;
  onCannonChange: (id: string) => void; onShotTypeChange: (type: string) => void;
  onOrder: (action: any) => void; onMode: (mode: string) => void;
  onLeaveCannon: () => void; onPersonalWeapon: () => void; personalWeaponReason?: string; personalWeaponPA: number;
};

// Crew previews stay idle until a cannon is selected or the menu is opened.
export default function JA2ArtilleryMenu(props: Props) {
  const [open, setOpen] = useState(false);
  const gun = props.artillery.find(g => g.id === props.cannonId);
  const active = props.mode.startsWith('artillery');
  const plan = useMemo(() => {
    if (!gun || !props.unit) return null;
    if (props.mode === 'artilleryReload' || !gun.loaded && !['artilleryMove', 'artilleryPivot'].includes(props.mode)) return artilleryReloadPreview(props.battle, props.unit, gun);
    const costs = artilleryCosts(props.battle, props.unit, gun);
    const cost = props.mode === 'artilleryMove' ? costs.move : props.mode === 'artilleryPivot' ? costs.pivot : costs.fire;
    return {...artilleryCrewPlan(props.battle, props.unit, gun, cost), pa: cost};
  }, [props.battle, props.unit, gun, props.mode]);
  return <div className="ja2-artillery-toolbar">
    {gun && <section className="ja2-artillery-status" aria-label="Control del cañón">
      <strong>{active ? 'Control: cañón' : 'Pieza seleccionada'} · {artilleryProfile(props.battle, gun).name}</strong>
      <span>Operario: {props.unit?.nickname || props.unit?.name || 'Seleccioná un combatiente'}</span>
      <div className="ja2-artillery-crew" aria-live="polite">
        <span>Dotación para {props.mode === 'artilleryMove' ? 'mover' : props.mode === 'artilleryPivot' ? 'girar' : !gun.loaded ? 'recargar' : 'disparar'}: {plan?.crew.length || 0}/{artilleryProfile(props.battle, gun).crew}</span>
        {plan?.crew.map((id: string) => {
          const member = props.battle.units.find((actor: any) => actor.id === id);
          return <span key={id} data-artillery-crew-id={id}>{member?.nickname || member?.name} · {props.battle.mode === 'exploration' ? 'sin PA' : `${formatAP(plan.pa)} PA`}</span>;
        })}
        {plan?.reason && <span className="unavailable">{plan.reason}</span>}
      </div>
      <div className="ja2-artillery-switch">
        <button className="line-button" disabled={props.busy} onClick={props.onLeaveCannon}>Dejar cañón</button>
        <button className="line-button" disabled={props.busy || Boolean(props.personalWeaponReason)} title={props.personalWeaponReason || undefined} onClick={props.onPersonalWeapon}>Usar arma personal{props.personalWeaponPA > 0 && props.battle.mode !== 'exploration' ? ` · ${formatAP(props.personalWeaponPA)} PA` : ''}</button>
      </div>
      {props.personalWeaponReason && <span role="status">{props.personalWeaponReason}</span>}
    </section>}
    <details className="ja2-artillery-menu" onToggle={event => {
    if (event.target === event.currentTarget) setOpen(event.currentTarget.open);
  }}><summary>Artillería</summary>{open && <ArtilleryControls {...props}/>}</details>
  </div>;
}

function ArtilleryControls({battle, unit, artillery, cannonId, shotType, busy, onCannonChange, onShotTypeChange, onOrder, onMode}: Props) {
  const gun = artillery.find(g => g.id === cannonId);
  const ready = Boolean(unit && unitCanAct(battle, unit) && !busy);
  const costs = unit && gun ? artilleryCosts(battle, unit, gun) : null;
  const reload = unit && gun ? artilleryReloadPreview(battle, unit, gun) : null;
  const actions = [
    {id: 'artillery', label: 'Disparar pieza', pa: costs?.fire, disabled: !gun?.loaded},
    {id: 'artilleryMove', label: 'Mover pieza', pa: costs?.move},
    {id: 'artilleryPivot', label: 'Girar pieza', pa: costs?.pivot},
  ];
  return <section className="ja2-artillery" aria-label="Órdenes de artillería">
    <p>La dotación se elige para cada orden entre los combatientes próximos. Podés volver a tu arma sin cambiar de casilla.</p>
    <select aria-label="Seleccionar pieza de artillería" value={cannonId} onChange={e => onCannonChange(e.target.value)}>
      <option value="">Elegir cañón</option>
      {artillery.map(g => <option key={g.id} value={g.id}>{artilleryProfile(battle, g).name} · {g.loaded ? 'cargado' : g.reloadProgress ? `recarga ${Math.floor(g.reloadProgress * 100)}%` : 'descargado'}</option>)}
    </select>
    {reload && <p aria-live="polite">{reload.reason || (battle.mode === 'exploration'
      ? 'Recarga sin coste de PA. Consume una munición al completar la carga.'
      : `Recarga: ${formatAP(reload.pa)} PA por artillero${reload.partial ? ` ahora; faltan ${formatAP(reload.remainingPA)} PA por artillero` : ''}.`)}</p>}
    <select aria-label="Munición de artillería" value={shotType} onChange={e => onShotTypeChange(e.target.value)}>
      <option value="solid">Bala rasa</option><option value="canister">Metralla</option>
    </select>
    {actions.map(action => {
      const crew = unit && gun ? artilleryCrewPlan(battle, unit, gun, action.pa) : null;
      return <button key={action.id} className="line-button" disabled={!ready || !crew || Boolean(crew.reason) || action.disabled}
        title={crew?.reason || undefined} onClick={() => onMode(action.id)}>{action.label} · {battle.mode === 'exploration' ? 'sin PA' : `${formatAP(action.pa ?? '—')} PA por artillero`}</button>;
    })}
    <button className="line-button" disabled={!ready || !reload?.valid} onClick={() => onOrder({type:'artilleryReload', artilleryId:cannonId})}>
      Recargar pieza · {battle.mode === 'exploration' ? 'sin PA' : `${formatAP(reload?.pa ?? '—')} PA por artillero`}
    </button>
  </section>;
}
