'use client';
import {formatAP} from '../../game/action-points.js';

import {useState} from 'react';
import {artilleryCosts, artilleryCrewPlan, artilleryReloadPreview} from '../../game/tactical.js';
import {artilleryProfile} from '../../game/artillery-definitions.js';
import {unitCanAct} from '../../game/ja2-hud.js';

type Props = {
  battle: any; unit: any; artillery: any[]; cannonId: string; shotType: string; busy: boolean;
  onCannonChange: (id: string) => void; onShotTypeChange: (type: string) => void;
  onOrder: (action: any) => void; onMode: (mode: string) => void;
};

// A closed menu does not calculate crew or loading previews on every map frame.
export default function JA2ArtilleryMenu(props: Props) {
  const [open, setOpen] = useState(false);
  return <details className="ja2-artillery-menu" onToggle={event => {
    if (event.target === event.currentTarget) setOpen(event.currentTarget.open);
  }}><summary>Artillería</summary>{open && <ArtilleryControls {...props}/>}</details>;
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
