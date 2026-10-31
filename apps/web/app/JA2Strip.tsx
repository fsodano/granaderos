'use client';

import type { TacticalOrder } from '../../../packages/game/public/hud-types.ts';

import type {
  BattleArtillery,
  BattleSnapshot,
  BattleUnit,
  CampaignContext,
} from '../../../packages/game/public/compatibility-types.ts';
import './ja2-compact.css';
import type { BandageReport, Viewport } from './tactical-ui-types';
// JA2 bottom-strip disposition (DESIGN.md MODE A / MODE B). Root switches content on inventoryId.
// Pure read model (game/ja2-hud.ts orderDescriptors/orderAction); all mutations are caller-provided callbacks.
import { useMemo } from 'react';
import { turnModel, unitCanAct } from '../../../packages/game/ja2-hud.ts';
import { canSee } from '../../../packages/game/tactical.js';
import JA2ArtilleryMenu from './JA2ArtilleryMenu';
import JA2Inventory, { RadarCluster } from './JA2Inventory';
import { StableJA2Roster as JA2Roster } from './JA2Roster';

type Props = {
  campaignContext?: CampaignContext | undefined;
  ambientPaused?: boolean;
  onToggleAmbientPause?: () => void;
  groupIds?: string[];
  cursorLevel?: number;
  onCursorLevelChange?: (level: number) => void;
  battle: BattleSnapshot;
  selected: string | undefined;
  unit: BattleUnit | undefined;
  players: BattleUnit[];
  missionAllies: BattleUnit[];
  localMilitia: BattleUnit[];
  mode: string;
  showSight: boolean;
  cannonId: string;
  shotType: string;
  artillery: BattleArtillery[];
  busy: boolean;
  inventoryId: string | null;
  vw: number;
  vh: number;
  cameraRect: Viewport;
  project: (x: number, y: number) => { x: number; y: number };
  zoom: number;
  onSelect: (id: string, additive?: boolean) => void;
  onOrder: (a: TacticalOrder) => void;
  onMode: (id: string) => void;
  onToggleSight: () => void;
  onAutoBandage?: () => void;
  bandageReport?: BandageReport | null;
  onEndTurn: () => void;
  onRetreat: () => void;
  onOpenInventory: (id: string) => void;
  onCloseInventory: () => void;
  onCameraCenter: () => void;
  onCameraPan: (dx: number, dy: number) => void;
  onZoom: (delta: number) => void;
  onCannonChange: (id: string) => void;
  onShotTypeChange: (type: string) => void;
  onLeaveCannon: () => void;
  onPersonalWeapon: () => void;
  personalWeaponReason?: string | undefined;
  personalWeaponPA: number;
};

export default function JA2Strip({
  campaignContext,
  battle,
  ambientPaused,
  onToggleAmbientPause,
  selected,
  unit,
  players,
  missionAllies,
  localMilitia,
  mode,
  showSight,
  cannonId,
  shotType,
  artillery,
  busy,
  inventoryId,
  vw,
  vh,
  cameraRect,
  project,
  zoom,
  onSelect,
  onOrder,
  onMode,
  onToggleSight,
  onEndTurn,
  onRetreat,
  onOpenInventory,
  onCloseInventory,
  onCameraCenter,
  onCameraPan,
  onZoom,
  onCannonChange,
  onShotTypeChange,
  onAutoBandage,
  bandageReport,
  groupIds,
  cursorLevel,
  onCursorLevelChange,
  onLeaveCannon,
  onPersonalWeapon,
  personalWeaponReason,
  personalWeaponPA,
}: Props) {
  const units = useMemo(
    () =>
      battle.units.filter(
        (v) =>
          !v.departure &&
          !v.fled &&
          (v.side === 'player' || players.some((p) => canSee(battle, p, v))),
      ),
    [battle, players],
  );
  const turn = useMemo(() => turnModel(battle, campaignContext), [battle, campaignContext]);
  const rosterPlayers = useMemo(
    () => players.filter((p) => !p.militia && !p.missionAlly),
    [players],
  );
  if (inventoryId) {
    return (
      <div className="ja2-hud">
        <section className="ja2-strip inventory-open">
          {unit ? (
            <JA2Inventory
              key={unit.id}
              campaignContext={campaignContext}
              cursorLevel={cursorLevel}
              onCursorLevelChange={onCursorLevelChange}
              unit={unit}
              battle={battle}
              mode={mode}
              showSight={showSight}
              busy={busy}
              units={units}
              selected={selected}
              missionAllies={missionAllies}
              localMilitia={localMilitia}
              vw={vw}
              vh={vh}
              cameraRect={cameraRect}
              project={project}
              zoom={zoom}
              onOrder={onOrder}
              onMode={onMode}
              onToggleSight={onToggleSight}
              onSelect={onSelect}
              onInventoryUnit={onOpenInventory}
              onRetreat={onRetreat}
              onCameraCenter={onCameraCenter}
              onCameraPan={onCameraPan}
              onZoom={onZoom}
              onCloseInventory={onCloseInventory}
              onAutoBandage={onAutoBandage}
              bandageReport={bandageReport}
            />
          ) : (
            <button className="gold-button" onClick={onCloseInventory}>
              Listo
            </button>
          )}
        </section>
      </div>
    );
  }
  return (
    <div className="ja2-hud">
      <section className={`ja2-strip squad-view${artillery.length ? ' has-artillery' : ''}`}>
        {artillery.length > 0 && (
          <JA2ArtilleryMenu
            battle={battle}
            unit={unit}
            artillery={artillery}
            cannonId={cannonId}
            shotType={shotType}
            busy={busy}
            mode={mode}
            onCannonChange={onCannonChange}
            onShotTypeChange={onShotTypeChange}
            onOrder={onOrder}
            onMode={onMode}
            onLeaveCannon={onLeaveCannon}
            onPersonalWeapon={onPersonalWeapon}
            personalWeaponReason={personalWeaponReason}
            personalWeaponPA={personalWeaponPA}
          />
        )}
        <JA2Roster
          groupIds={groupIds}
          battle={battle}
          players={rosterPlayers}
          selected={selected}
          medicalTargeting={unit?.activeSlot === 'medical' && unitCanAct(battle, unit)}
          onSelect={onSelect}
          onOpenInventory={onOpenInventory}
        />
        <div className="ja2-right">
          <RadarCluster
            campaignContext={campaignContext}
            battle={battle}
            units={units}
            selected={selected}
            project={project}
            vw={vw}
            vh={vh}
            cameraRect={cameraRect}
            zoom={zoom}
            mode={mode}
            missionAllies={missionAllies}
            localMilitia={localMilitia}
            onSelect={onSelect}
            onRetreat={onRetreat}
            onCameraCenter={onCameraCenter}
            onCameraPan={onCameraPan}
            onZoom={onZoom}
          />
          <div className="ja2-essential">
            {battle.mode === 'exploration' &&
              battle.status === 'active' &&
              onToggleAmbientPause && (
                <button
                  className="line-button"
                  disabled={busy}
                  aria-pressed={Boolean(ambientPaused)}
                  title={
                    ambientPaused
                      ? 'Reloj detenido entre órdenes.'
                      : 'El tiempo, las heridas y los habitantes siguen activos.'
                  }
                  onClick={onToggleAmbientPause}
                >
                  {ambientPaused ? 'Reanudar' : 'Pausar'}
                </button>
              )}
            <button
              className="line-button"
              disabled={!unit}
              onClick={() => unit && onOpenInventory(unit.id)}
            >
              Equipo
            </button>
            {battle.mode !== 'exploration' && (
              <button
                className="gold-button"
                disabled={busy || battle.status !== 'active'}
                onClick={onEndTurn}
              >
                {turn.endLabel}
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
