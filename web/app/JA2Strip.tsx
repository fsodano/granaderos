'use client';
import './ja2-compact.css';
// JA2 bottom-strip disposition (DESIGN.md MODE A / MODE B). Root switches content on inventoryId.
// Pure read model (game/ja2-hud.js orderDescriptors/orderAction); all mutations are caller-provided callbacks.
import {useMemo} from 'react';
import {StableJA2Roster as JA2Roster} from './JA2Roster';
import JA2Inventory, {RadarCluster} from './JA2Inventory';
import JA2ArtilleryMenu from './JA2ArtilleryMenu';
import {turnModel, unitCanAct} from '../../game/ja2-hud.js';
import {canSee} from '../../game/tactical.js';

type Props = {
  ambientPaused?: boolean; onToggleAmbientPause?: () => void;
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

export default function JA2Strip({battle, ambientPaused, onToggleAmbientPause, selected, unit, players, missionAllies, localMilitia, mode, showSight, aim, hitLocation, costs, weapon, firearm, cannonId, shotType, gunCosts, artillery, busy, inventoryId, vw, vh, cameraRect, project, cameraX, cameraY, zoom, onSelect, onOrder, onMode, onToggleSight, onEndTurn, onRetreat, onOpenInventory, onCloseInventory, onCameraCenter, onCameraPan, onZoom, onCannonChange, onShotTypeChange, onSetAim, onHitLocationChange, onAutoBandage, bandageReport, groupIds, target, cursorLevel, onCursorLevelChange}: Props) {
  const units = useMemo(()=>battle.units.filter((v: any) => !v.departure && !v.fled && (v.side === 'player' || players.some((p: any) => canSee(battle, p, v)))),[battle,players]);
  const turn = useMemo(()=>turnModel(battle),[battle]);
  const rosterPlayers=useMemo(()=>players.filter((p:any)=>!p.militia&&!p.missionAlly),[players]);
  if (inventoryId) {
    return (
      <div className="ja2-hud">
      <section className="ja2-strip inventory-open">
        {unit ? <JA2Inventory cursorLevel={cursorLevel} onCursorLevelChange={onCursorLevelChange} unit={unit} battle={battle} mode={mode} showSight={showSight} busy={busy} units={units} selected={selected} missionAllies={missionAllies} localMilitia={localMilitia} vw={vw} vh={vh} cameraRect={cameraRect} project={project} zoom={zoom} onOrder={onOrder} onMode={onMode} onToggleSight={onToggleSight} onSelect={onSelect} onInventoryUnit={onOpenInventory} onRetreat={onRetreat} onCameraCenter={onCameraCenter} onCameraPan={onCameraPan} onZoom={onZoom} onCloseInventory={onCloseInventory} onAutoBandage={onAutoBandage} bandageReport={bandageReport} /> : <button className="gold-button" onClick={onCloseInventory}>Listo</button>}
      </section>
      </div>
    );
  }
  return (
    <div className="ja2-hud">
    <section className="ja2-strip squad-view">
      {artillery.length > 0 && <JA2ArtilleryMenu battle={battle} unit={unit} artillery={artillery} cannonId={cannonId} shotType={shotType} busy={busy} onCannonChange={onCannonChange} onShotTypeChange={onShotTypeChange} onOrder={onOrder} onMode={onMode}/>}
      <JA2Roster groupIds={groupIds} battle={battle} players={rosterPlayers} selected={selected} medicalTargeting={unit?.activeSlot === 'medical' && unitCanAct(battle, unit)} onSelect={onSelect} onOpenInventory={onOpenInventory} />
      <div className="ja2-right">
        <RadarCluster battle={battle} units={units} selected={selected} project={project} vw={vw} vh={vh} cameraRect={cameraRect} zoom={zoom} mode={mode} missionAllies={missionAllies} localMilitia={localMilitia} onSelect={onSelect} onRetreat={onRetreat} onCameraCenter={onCameraCenter} onCameraPan={onCameraPan} onZoom={onZoom} />
        <div className="ja2-essential">{battle.mode==='exploration'&&battle.status==='active'&&onToggleAmbientPause&&<button className="line-button" disabled={busy} aria-pressed={Boolean(ambientPaused)} title={ambientPaused?'Reloj detenido entre órdenes.':'El tiempo, las heridas y los habitantes siguen activos.'} onClick={onToggleAmbientPause}>{ambientPaused?'Reanudar':'Pausar'}</button>}<button className="line-button" disabled={!unit} onClick={()=>unit && onOpenInventory(unit.id)}>Equipo</button>{battle.mode !== 'exploration' && <button className="gold-button" disabled={busy || battle.status !== 'active'} onClick={onEndTurn}>{turn.endLabel}</button>}</div>
      </div>
    </section>
    </div>
  );
}
