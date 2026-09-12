'use client';
import JA2WeaponMode from './JA2WeaponMode';
import {maximumEnergy} from '../../game/fatigue.js';
// JA2 bottom-strip disposition (DESIGN.md MODE A / MODE B). Root switches content on inventoryId.
// Pure read model (game/ja2-hud.js orderDescriptors/orderAction); all mutations are caller-provided callbacks.
import {MILITIA_NAMES} from '../../game/militia.js';
import {useState} from 'react';
import JA2Roster from './JA2Roster';
import JA2Inventory, {RadarCluster} from './JA2Inventory';
import {orderDescriptors, orderAction, stanceLabel, targetingHelp, equipmentSlots, turnModel, unitCanAct, facingLabel, heardNoiseModel, equippedItemHelp} from '../../game/ja2-hud.js';
import {canSee, actionPointBudget, AP_CARRY_LIMIT, ARTILLERY, artilleryReloadPreview} from '../../game/tactical.js';
import {Footprints, RotateCcw, Shield, Package, Eye} from 'lucide-react';

type Props = {
  groupIds?: string[]; target?: any;
  battle: any; selected: any; unit: any; players: any[]; missionAllies: any[]; localMilitia: any[];
  mode: any; showSight: boolean; aim: number; hitLocation: string; costs: any; weapon: any; firearm: boolean;
  cannonId: any; shotType: any; gunCosts: any; artillery: any[]; busy: boolean; inventoryId: any;
  vw: number; vh: number; cameraRect: any; project: (x: number, y: number) => { x: number; y: number };
  cameraX: number; cameraY: number; zoom: number;
  onSelect: (id: any, additive?: boolean) => void; onOrder: (a: any) => void; onMode: (id: any) => void; onToggleSight: () => void;
  onAutoBandage?: () => void; bandageReport?: any;
  onEndTurn: () => void; onRetreat: () => void; onOpenInventory: (id: any) => void; onCloseInventory: () => void;
  onCameraCenter: () => void; onCameraPan: (dx: number, dy: number) => void; onZoom: (delta: number) => void;
  onCannonChange: (id: any) => void; onShotTypeChange: (t: any) => void; onSetAim: (n: number) => void; onHitLocationChange: (location: string) => void;
};

const GRID_EXCLUDE = new Set(['useItem', 'fire', 'melee', 'charge', 'heal', 'weapon', 'overwatch', 'mount', 'torch', 'bolas', 'free', 'brace', 'repair', 'ration', 'sight', 'endTurn', 'artillery', 'artilleryMove', 'artilleryPivot', 'artilleryReload']);
const GRID_ICONS: Record<string, any> = {move: Footprints, look: Eye, loot: Package, reload: RotateCcw, reprime: RotateCcw, stance: Shield};

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

export default function JA2Strip({battle, selected, unit, players, missionAllies, localMilitia, mode, showSight, aim, hitLocation, costs, weapon, firearm, cannonId, shotType, gunCosts, artillery, busy, inventoryId, vw, vh, cameraRect, project, cameraX, cameraY, zoom, onSelect, onOrder, onMode, onToggleSight, onEndTurn, onRetreat, onOpenInventory, onCloseInventory, onCameraCenter, onCameraPan, onZoom, onCannonChange, onShotTypeChange, onSetAim, onHitLocationChange, onAutoBandage, bandageReport, groupIds, target}: Props) {
  const units = battle.units.filter((v: any) => !v.departure && !v.fled && (v.side === 'player' || players.some((p: any) => canSee(battle, p, v))));
  const descriptors = unit ? orderDescriptors(battle, unit, {busy, aim, cannonId, target}) : [];
  const gridDefs = descriptors.filter((d: any) => !GRID_EXCLUDE.has(d.id) && (d.id !== 'reprime' || unit?.jammed) && (d.id !== 'reload' || !unit?.jammed) && (!['reload', 'reprime', 'overwatch'].includes(d.id) || firearm));
  const budget = unit ? actionPointBudget(battle, unit) : null;
  const turn = turnModel(battle);
  const heardNoise = heardNoiseModel(battle, unit);
  if (inventoryId) {
    return (
      <div className="ja2-hud">
      <section className="ja2-strip inventory-open">
        {unit ? <JA2Inventory unit={unit} battle={battle} mode={mode} showSight={showSight} busy={busy} units={units} selected={selected} missionAllies={missionAllies} localMilitia={localMilitia} vw={vw} vh={vh} cameraRect={cameraRect} project={project} zoom={zoom} onOrder={onOrder} onMode={onMode} onToggleSight={onToggleSight} onSelect={onSelect} onRetreat={onRetreat} onCameraCenter={onCameraCenter} onCameraPan={onCameraPan} onZoom={onZoom} onCloseInventory={onCloseInventory} onAutoBandage={onAutoBandage} bandageReport={bandageReport} /> : <button className="gold-button" onClick={onCloseInventory}>Listo</button>}
      </section>
      <LogOverlay log={battle.log || []} />
      </div>
    );
  }
  return (
    <div className="ja2-hud">
    <section className="ja2-strip">
      <JA2Roster groupIds={groupIds} battle={battle} players={players.filter((p: any) => !p.militia && !p.missionAlly)} selected={selected} medicalTargeting={unit?.activeSlot === 'medical' && unitCanAct(battle, unit)} onSelect={onSelect} onOpenInventory={onOpenInventory} />
      <div className="ja2-context">
        {unit && <div className="ja2-action-readout" aria-label="Estado del combatiente">
          <strong>{unit.nickname || unit.name} · {battle.mode === 'exploration' ? 'Sin coste de PA' : `${unit.ap} PA`}</strong>
          {unit.militia&&<small>{MILITIA_NAMES[unit.militiaRank]??"Milicia"} · {unit.militiaExperience??0} puntos de combate</small>}
          <span>{stanceLabel(unit.stance)} · {facingLabel(unit)} · {Math.ceil(unit.hp)}/{unit.maxHp} salud · {Math.round(unit.energy ?? 100)}/{maximumEnergy(unit)} energía{unit.bleeding > 0 ? ` · Hemorragia ${unit.bleeding}` : ''}{unit.stealthMode ? ' · Sigilo' : ''}</span>
          {heardNoise && <span className="ja2-noise-readout">{heardNoise.label}</span>}
          <small>{turn.interrupted ? 'Interrupción: usá los PA restantes. Esta pausa no recupera PA.' : battle.mode === 'exploration' ? 'Exploración: moverse consume energía y tiempo, sin gastar PA.' : `Dejá PA para interrumpir al enemigo. Se conservan hasta ${budget?.carryover} PA al próximo turno (límite ${AP_CARRY_LIMIT}).`}</small>
        </div>}
        {unit && <div className="ja2-equipped-slots" aria-label="Objeto equipado">
          {equipmentSlots(battle, unit, {busy}).map((slot: any) => <button key={slot.slot} aria-pressed={slot.active} disabled={slot.active || slot.disabled} title={`Equipar ${slot.label} · ${slot.pa} PA`} onClick={() => { onOrder(slot.action); onMode('move'); }}>{slot.label}</button>)}
        </div>}
        <JA2WeaponMode battle={battle} unit={unit} busy={busy} onOrder={onOrder} onMode={onMode}/>
        <p className="ja2-equipped-help">{equippedItemHelp(battle, unit, {target, mode, aim})}</p>
        {firearm && unit && <p className="ja2-equipped-help">Botón derecho: apuntar; sobre un personaje, aumentar puntería; sobre el suelo, volver a movimiento. Con la mira activa, clic izquierdo: disparar. La mira muestra la zona y los PA. Esc: cancelar.</p>}
        <div className="ja2-order-grid">
          {gridDefs.map((d: any) => {
            const Icon = GRID_ICONS[d.id];
            const label = d.id === 'mount' ? (unit?.mounted ? 'Desmontar' : 'Montar') : d.label;
            return (
              <button key={d.id} className={(d.kind === 'mode' && mode === d.id) || d.active ? 'selected' : ''} disabled={d.disabled} aria-label={label} aria-pressed={d.id === 'stealth' ? Boolean(d.active) : undefined} title={d.id === 'stealth' ? 'Reduce el ruido al moverse. Consume más PA de movimiento y no cambia la postura. Atajo: Z.' : d.reserve ? `Conservá ${d.pa} PA para un disparo de reacción. Se pagan cuando dispara.` : d.kind === 'mode' ? targetingHelp(d.id, unit) : undefined} onClick={() => { if (d.kind === 'mode') onMode(d.id); else if (d.id === 'sight') onToggleSight(); else onOrder(orderAction(battle, unit, {}, d.id)); }}>
                {Icon && <Icon size={16} />}<span>{label}{d.pa !== undefined ? ` · ${d.reserve ? 'reservar ' : ''}${d.pa} PA` : ''}</span>
              </button>
            );
          })}
        </div>
        {(artillery || []).length > 0 && <div className="ja2-artillery">
          <p className="eyebrow">ARTILLERÍA DE CAMPAÑA</p>
          <select aria-label="Seleccionar pieza de artillería" value={cannonId} onChange={e => onCannonChange(e.target.value)}><option value="">Elegir cañón</option>{artillery.map((a: any) => <option key={a.id} value={a.id}>{(ARTILLERY as any)[a.type]?.name ?? a.type} · {a.loaded ? 'cargado' : a.reloadProgress ? `recarga ${Math.floor(a.reloadProgress*100)}%` : 'descargado'}</option>)}</select>
          {cannonId && (() => { const gun=artillery.find((a:any)=>a.id===cannonId); const reload=artilleryReloadPreview(battle,unit,gun); return <p aria-live="polite">{reload.reason || (battle.mode === 'exploration' ? 'Recarga sin coste de PA. Consume una munición al completar la carga.' : `Recarga: ${reload.pa} PA por artillero${reload.partial ? ` ahora; faltan ${reload.remainingPA} PA por artillero` : ''}. La munición se descuenta al completar la carga.`)}</p>; })()}
          <select aria-label="Munición de artillería" value={shotType} onChange={e => onShotTypeChange(e.target.value)}><option value="solid">Bala rasa</option><option value="canister">Metralla</option></select>
          <div>
            {['artillery', 'artilleryMove', 'artilleryPivot', 'artilleryReload'].map(id => { const d = descriptors.find((entry: any) => entry.id === id); return <button key={id} className="line-button" disabled={!d || d.disabled} onClick={() => id === 'artilleryReload' ? onOrder(orderAction(battle, unit, {artilleryId: cannonId}, id)) : onMode(id)}>{d?.label || id} · {d?.pa ?? '—'} PA por artillero</button>; })}
          </div>
          <small>La pieza debe apuntar al objetivo. {battle.mode === 'exploration' ? 'Las órdenes consumen tiempo, sin gastar PA.' : 'Cada artillero paga el coste de la orden.'}</small>
        </div>}
        {battle.mode === 'combat' && <small>La exploración vuelve automáticamente tras dos turnos completos sin contacto visual.</small>}
        <div className="ja2-context-footer">
          <button className="line-button" disabled={!unit} onClick={() => unit && onOpenInventory(unit.id)}>Equipo y órdenes</button>
          <button className="gold-button end-turn" disabled={busy || battle.status !== 'active'} onClick={onEndTurn}>{busy ? 'Procesando…' : turn.endLabel}</button>
        </div>
      </div>
      <div className="ja2-right">
        <RadarCluster battle={battle} units={units} selected={selected} project={project} vw={vw} vh={vh} cameraRect={cameraRect} zoom={zoom} mode={mode} missionAllies={missionAllies} localMilitia={localMilitia} onSelect={onSelect} onRetreat={onRetreat} onCameraCenter={onCameraCenter} onCameraPan={onCameraPan} onZoom={onZoom} />
      </div>
    </section>
    <LogOverlay log={battle.log || []} />
    </div>
  );
}
