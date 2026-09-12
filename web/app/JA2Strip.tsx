'use client';
import './ja2-compact.css';
import JA2OrdersMenu from './JA2OrdersMenu';
// JA2 bottom-strip disposition (DESIGN.md MODE A / MODE B). Root switches content on inventoryId.
// Pure read model (game/ja2-hud.js orderDescriptors/orderAction); all mutations are caller-provided callbacks.
import {useMemo,useState} from 'react';
import JA2Roster from './JA2Roster';
import JA2Inventory, {RadarCluster} from './JA2Inventory';
import {turnModel, unitCanAct} from '../../game/ja2-hud.js';
import {canSee} from '../../game/tactical.js';

type Props = {
  groupIds?: string[]; target?: any; cursorLevel?:number; onCursorLevelChange?:(level:number)=>void;
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

function LogOverlay({log}: { log: string[] }) {
  const [open, setOpen] = useState(false);
  const lines = log.slice(-5).reverse();
  return (
    <section className={`ja2-log-overlay ${open ? 'expanded' : 'collapsed'}`} aria-label="Diario de combate">
      <button className="line-button" aria-expanded={open} onClick={() => setOpen(v => !v)}>Diario</button>
      <div aria-live="polite">{(open ? lines : lines.slice(0, 1)).map((l, i) => <p className={i === 0 ? 'latest' : ''} key={`${log.length}-${i}`}>{l}</p>)}</div>
    </section>
  );
}

export default function JA2Strip({battle, selected, unit, players, missionAllies, localMilitia, mode, showSight, aim, hitLocation, costs, weapon, firearm, cannonId, shotType, gunCosts, artillery, busy, inventoryId, vw, vh, cameraRect, project, cameraX, cameraY, zoom, onSelect, onOrder, onMode, onToggleSight, onEndTurn, onRetreat, onOpenInventory, onCloseInventory, onCameraCenter, onCameraPan, onZoom, onCannonChange, onShotTypeChange, onSetAim, onHitLocationChange, onAutoBandage, bandageReport, groupIds, target, cursorLevel, onCursorLevelChange}: Props) {
  const units = useMemo(()=>battle.units.filter((v: any) => !v.departure && !v.fled && (v.side === 'player' || players.some((p: any) => canSee(battle, p, v)))),[battle,players]);
  const turn = turnModel(battle);
  if (inventoryId) {
    return (
      <div className="ja2-hud">
      <section className="ja2-strip inventory-open">
        {unit ? <JA2Inventory cursorLevel={cursorLevel} onCursorLevelChange={onCursorLevelChange} unit={unit} battle={battle} mode={mode} showSight={showSight} busy={busy} units={units} selected={selected} missionAllies={missionAllies} localMilitia={localMilitia} vw={vw} vh={vh} cameraRect={cameraRect} project={project} zoom={zoom} onOrder={onOrder} onMode={onMode} onToggleSight={onToggleSight} onSelect={onSelect} onRetreat={onRetreat} onCameraCenter={onCameraCenter} onCameraPan={onCameraPan} onZoom={onZoom} onCloseInventory={onCloseInventory} onAutoBandage={onAutoBandage} bandageReport={bandageReport} /> : <button className="gold-button" onClick={onCloseInventory}>Listo</button>}
      </section>
      <LogOverlay log={battle.log || []} />
      </div>
    );
  }
  return (
    <div className="ja2-hud">
    <section className="ja2-strip squad-view">
      <JA2Roster groupIds={groupIds} battle={battle} players={players.filter((p: any) => !p.militia && !p.missionAlly)} selected={selected} medicalTargeting={unit?.activeSlot === 'medical' && unitCanAct(battle, unit)} onSelect={onSelect} onOpenInventory={onOpenInventory} />
      <JA2OrdersMenu battle={battle} unit={unit} mode={mode} aim={aim} firearm={firearm} cannonId={cannonId} shotType={shotType} artillery={artillery} busy={busy} target={target} onOrder={onOrder} onMode={onMode} onToggleSight={onToggleSight} onEndTurn={onEndTurn} onOpenInventory={onOpenInventory} onCannonChange={onCannonChange} onShotTypeChange={onShotTypeChange} />
      <div className="ja2-right">
        <RadarCluster battle={battle} units={units} selected={selected} project={project} vw={vw} vh={vh} cameraRect={cameraRect} zoom={zoom} mode={mode} missionAllies={missionAllies} localMilitia={localMilitia} onSelect={onSelect} onRetreat={onRetreat} onCameraCenter={onCameraCenter} onCameraPan={onCameraPan} onZoom={onZoom} />
        <div className="ja2-essential"><button className="line-button" disabled={!unit} onClick={()=>unit && onOpenInventory(unit.id)}>Equipo</button>{battle.mode !== 'exploration' && <button className="gold-button" disabled={busy || battle.status !== 'active'} onClick={onEndTurn}>{turn.endLabel}</button>}</div>
      </div>
    </section>
    <LogOverlay log={battle.log || []} />
    </div>
  );
}
