'use client';
// JA2 bottom-strip disposition (DESIGN.md MODE A / MODE B). Root switches content on inventoryId.
// Pure read model (game/ja2-hud.js orderDescriptors/orderAction); all mutations are caller-provided callbacks.
import {useState} from 'react';
import JA2Roster from './JA2Roster';
import JA2Inventory, {RadarCluster} from './JA2Inventory';
import {orderDescriptors, orderAction} from '../../game/ja2-hud.js';
import {canSee, visibleEnemies, ARTILLERY} from '../../game/tactical.js';
import {Footprints, Crosshair, Swords, Flag, Heart, RotateCcw, Shield, Eye, CircleArrowUp, Package} from 'lucide-react';

type Props = {
  battle: any; selected: any; unit: any; players: any[]; missionAllies: any[]; localMilitia: any[];
  mode: any; showSight: boolean; aim: number; costs: any; weapon: any; firearm: boolean;
  cannonId: any; shotType: any; gunCosts: any; artillery: any[]; busy: boolean; inventoryId: any;
  vw: number; vh: number; cameraRect: any; project: (x: number, y: number) => { x: number; y: number };
  cameraX: number; cameraY: number; zoom: number;
  onSelect: (id: any) => void; onOrder: (a: any) => void; onMode: (id: any) => void; onToggleSight: () => void;
  onEndTurn: () => void; onRetreat: () => void; onOpenInventory: (id: any) => void; onCloseInventory: () => void;
  onCameraCenter: () => void; onCameraPan: (dx: number, dy: number) => void;
  onCannonChange: (id: any) => void; onShotTypeChange: (t: any) => void; onSetAim: (n: number) => void;
};

const GRID_EXCLUDE = new Set(['torch', 'bolas', 'free', 'brace', 'repair', 'ration', 'sight', 'endTurn', 'artillery', 'artilleryMove', 'artilleryPivot', 'artilleryReload']);
const GRID_ICONS: Record<string, any> = {move: Footprints, fire: Crosshair, melee: Swords, charge: Flag, heal: Heart, loot: Package, reload: RotateCcw, weapon: Swords, stance: Shield, overwatch: Eye, mount: CircleArrowUp};

function LogOverlay({log}: { log: string[] }) {
  const [open, setOpen] = useState(false);
  const lines = log.slice(-5).reverse();
  return (
    <section className="ja2-log-overlay" aria-label="Diario de combate">
      <button className="line-button" aria-expanded={open} onClick={() => setOpen(v => !v)}>DIARIO DE COMBATE</button>
      <div aria-live="polite">{(open ? lines : lines.slice(0, 1)).map((l, i) => <p className={i === 0 ? 'latest' : ''} key={`${log.length}-${i}`}>{l}</p>)}</div>
    </section>
  );
}

export default function JA2Strip({battle, selected, unit, players, missionAllies, localMilitia, mode, showSight, aim, costs, weapon, firearm, cannonId, shotType, gunCosts, artillery, busy, inventoryId, vw, vh, cameraRect, project, cameraX, cameraY, zoom, onSelect, onOrder, onMode, onToggleSight, onEndTurn, onRetreat, onOpenInventory, onCloseInventory, onCameraCenter, onCameraPan, onCannonChange, onShotTypeChange, onSetAim}: Props) {
  const units = battle.units.filter((v: any) => v.side === 'player' || players.some((p: any) => canSee(battle, p, v)));
  const gridDefs = unit ? orderDescriptors(battle, unit, {busy}).filter((d: any) => !GRID_EXCLUDE.has(d.id)) : [];
  if (inventoryId) {
    return (
      <section className="ja2-strip inventory-open">
        {unit ? <JA2Inventory unit={unit} battle={battle} mode={mode} showSight={showSight} busy={busy} units={units} selected={selected} missionAllies={missionAllies} localMilitia={localMilitia} vw={vw} vh={vh} cameraRect={cameraRect} project={project} zoom={zoom} onOrder={onOrder} onMode={onMode} onToggleSight={onToggleSight} onSelect={onSelect} onRetreat={onRetreat} onCameraCenter={onCameraCenter} onCameraPan={onCameraPan} onCloseInventory={onCloseInventory} /> : <button className="gold-button" onClick={onCloseInventory}>Listo</button>}
        <LogOverlay log={battle.log || []} />
      </section>
    );
  }
  return (
    <section className="ja2-strip">
      <JA2Roster players={players} selected={selected} onSelect={onSelect} onOpenInventory={onOpenInventory} />
      <div className="ja2-context">
        <div className="ja2-order-grid">
          {gridDefs.map((d: any) => {
            const Icon = GRID_ICONS[d.id];
            const label = d.id === 'stance' ? (unit?.stance === 'prone' ? 'De pie' : 'Cuerpo a tierra') : d.id === 'mount' ? (unit?.mounted ? 'Desmontar' : 'Montar') : d.label;
            return (
              <button key={d.id} className={d.kind === 'mode' && mode === d.id ? 'selected' : ''} disabled={d.disabled} aria-label={label} onClick={() => { if (d.kind === 'mode') onMode(d.id); else if (d.id === 'sight') onToggleSight(); else onOrder(orderAction(battle, unit, {}, d.id)); }}>
                {Icon && <Icon size={16} />}<span>{label}{d.kind === 'order' && d.pa !== undefined ? ` · ${d.pa} PA` : ''}</span>
              </button>
            );
          })}
          {firearm && unit && <span aria-label="Puntería">{['Sin apuntar', 'Apuntería 1', 'Apuntería 2', 'Apuntería 3', 'Apuntería 4'].map((a, n) => <button key={n} aria-label={a} aria-pressed={aim === n} onClick={() => onSetAim(n)}>{n}</button>)}</span>}
        </div>
        {(artillery || []).length > 0 && <div className="ja2-artillery">
          <p className="eyebrow">ARTILLERÍA DE CAMPAÑA</p>
          <select aria-label="Seleccionar pieza de artillería" value={cannonId} onChange={e => onCannonChange(e.target.value)}><option value="">Elegir cañón</option>{artillery.map((a: any) => <option key={a.id} value={a.id}>{(ARTILLERY as any)[a.type]?.name ?? a.type} · {a.loaded ? 'cargado' : 'descargado'}</option>)}</select>
          <select aria-label="Munición de artillería" value={shotType} onChange={e => onShotTypeChange(e.target.value)}><option value="solid">Bala rasa</option><option value="canister">Metralla</option></select>
          <div>
            <button className="line-button" disabled={!cannonId} onClick={() => onMode('artillery')}>Disparar · {gunCosts?.fire ?? '—'} PA</button>
            <button className="line-button" disabled={!cannonId} onClick={() => onMode('artilleryMove')}>Desplazar · {gunCosts?.move ?? '—'} PA</button>
            <button className="line-button" disabled={!cannonId} onClick={() => onMode('artilleryPivot')}>Girar · {gunCosts?.pivot ?? '—'} PA</button>
            <button className="line-button" disabled={!cannonId} onClick={() => onOrder({ type: 'artilleryReload', artilleryId: cannonId })}>Recargar pieza · {gunCosts?.reload ?? '—'} PA</button>
          </div>
          <small>La pieza debe apuntar al objetivo. Cada artillero paga el coste de la orden.</small>
        </div>}
        <button className="line-button" disabled={!unit} onClick={() => unit && onOpenInventory(unit.id)}>Equipo y órdenes</button>
        <button className="gold-button end-turn" disabled={busy || battle.status !== 'active'} onClick={onEndTurn}>{busy ? 'Procesando…' : battle.mode === 'exploration' ? 'Descansar' : 'Fin del turno'}</button>
      </div>
      <div className="ja2-right">
        <RadarCluster battle={battle} units={units} selected={selected} project={project} vw={vw} vh={vh} cameraRect={cameraRect} zoom={zoom} mode={mode} missionAllies={missionAllies} localMilitia={localMilitia} onSelect={onSelect} onRetreat={onRetreat} onCameraCenter={onCameraCenter} onCameraPan={onCameraPan} />
      </div>
      <LogOverlay log={battle.log || []} />
    </section>
  );
}
