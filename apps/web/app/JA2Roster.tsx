'use client';

import { formatAP } from '../../../packages/game/action-points.js';
import type {
  BattleSnapshot,
  BattleUnit,
} from '../../../packages/game/public/compatibility-types.ts';

import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { maximumEnergy } from '../../../packages/game/fatigue.js';
import { sitePath } from '../lib/site-path.js';
// Every deployed squad remains accessible in the portrait strip.
// Pure read model (game/ja2-hud.ts rosterCells); all mutations are caller-provided callbacks.
import {
  Ban,
  Cross,
  Eye,
  Flame,
  Hammer,
  Hand,
  KeyRound,
  Link,
  Package,
  Scissors,
  Shirt,
  Skull,
  Utensils,
  Wrench,
} from 'lucide-react';
import { firearmLoadingProgress, rosterCells } from '../../../packages/game/ja2-hud.ts';
import { rosterHands } from '../../../packages/game/roster-hands.ts';
import { portraitFor } from '../lib/portraits';

type Props = {
  battle?: BattleSnapshot;
  players: BattleUnit[];
  selected: string | undefined;
  groupIds?: string[] | undefined;
  medicalTargeting?: boolean;
  onSelect: (id: string, additive?: boolean) => void;
  onOpenInventory: (id: string) => void;
};
const short = (u: BattleUnit) =>
  u.nickname ||
  String(u.name || '')
    .split(' ')
    .slice(-1)[0] ||
  '';
const handIcons: Record<string, LucideIcon> = {
  ammo: Package,
  rations: Utensils,
  medical: Cross,
  boleadoras: Link,
  torch: Flame,
  key: KeyRound,
  lockpick: Wrench,
  crowbar: Hammer,
  pliers: Scissors,
  outfit: Shirt,
  item: Package,
  empty: Hand,
  blocked: Ban,
};

export function StableJA2Roster(props: Props) {
  return <JA2Roster {...props} />;
}
export default function JA2Roster({
  battle,
  players,
  selected,
  groupIds = [],
  medicalTargeting = false,
  onSelect,
  onOpenInventory,
}: Props) {
  const all = rosterCells(players, selected, battle);
  const selectedIndex = players.findIndex((p) => p.id === selected);
  const [paging, setPaging] = useState({
    selected,
    page: Math.floor(Math.max(0, selectedIndex) / 6),
  });
  const selectedPage = selectedIndex >= 0 ? Math.floor(selectedIndex / 6) : paging.page;
  const page = paging.selected === selected ? paging.page : selectedPage;
  const pageCount = Math.max(1, Math.ceil(all.length / 6));
  const currentPage = Math.min(page, pageCount - 1);
  const setPage = (nextPage: number) => setPaging({ selected, page: nextPage });
  const cells = all.slice(currentPage * 6, currentPage * 6 + 6);
  while (cells.length < 6) {
    cells.push({ empty: true });
  }
  const exploring = battle?.mode === 'exploration';
  return (
    <div className="ja2-roster-pages">
      <ul className="ja2-roster" aria-label="Escuadra táctica">
        {cells.map((cell, i: number) => {
          if (cell.empty) {
            return (
              <li className="empty-portrait-slot" key={`empty-${i}`} aria-hidden="true">
                <span>—</span>
              </li>
            );
          }
          const u = cell.unit;
          const portrait = portraitFor(cell.portrait ?? u.portrait ?? u.portraitId ?? u.id, battle);
          const hands = rosterHands(u).map((hand) => {
            const loading = firearmLoadingProgress(u, hand.item);
            return {
              ...hand,
              loading,
              description: `${hand.description}${loading ? ` ${loading.description}` : ''}`,
            };
          });
          return (
            <li key={u.id} style={{ minWidth: 0, minHeight: 0 }}>
              <button
                style={{ width: '100%', height: '100%' }}
                className={`ja2-portrait-cell ${cell.active ? 'active' : ''} ${cell.fallen ? 'fallen' : ''} ${cell.interruptReady ? 'interrupt-ready' : ''} ${groupIds.includes(u.id) ? 'group-selected' : ''}`}
                aria-disabled={medicalTargeting ? u.hp <= 0 || u.routed : cell.disabled}
                aria-label={`${cell.index + 1}. ${u.name}. ${cell.dead ? 'Muerto' : u.unconscious ? 'Inconsciente' : cell.fallen ? 'Fuera de combate' : `Salud ${Math.ceil(u.hp)}, ${exploring ? '' : `${formatAP(u.ap)} puntos de acción, `}energía ${Math.round(u.energy ?? 100)}, moral ${Math.round(u.morale ?? 0)}`}${!cell.dead ? `. Ve ${cell.visibleEnemyCount} ${cell.visibleEnemyCount === 1 ? 'enemigo' : 'enemigos'}` : ''}${cell.bleeding && !cell.dead ? `. Hemorragia: ${cell.bleeding} salud por turno` : ''}${cell.interruptReady ? '. Puede actuar en la interrupción' : ''}${groupIds.includes(u.id) ? '. En el grupo de marcha' : ''}. ${hands.map((hand) => hand.description).join(' ')} Botón derecho: equipo del combatiente`}
                onClick={(event) => {
                  if (!(medicalTargeting ? u.hp <= 0 || u.routed : cell.disabled)) {
                    onSelect(u.id, event.shiftKey);
                  }
                }}
                onDoubleClick={() => {
                  if (!medicalTargeting) {
                    onOpenInventory(u.id);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onOpenInventory(u.id);
                }}
              >
                <span className={`ja2-portrait-face ${cell.dead ? 'dead' : ''}`}>
                  {cell.dead ? (
                    <>
                      <Skull className="ja2-dead-skull" aria-hidden="true" />
                      <span className="ja2-portrait-blood" aria-hidden="true" />
                    </>
                  ) : portrait ? (
                    <img src={sitePath(portrait)} alt="" />
                  ) : (
                    <span className="portrait-fallback">{short(u).slice(0, 2).toUpperCase()}</span>
                  )}
                  {cell.bleeding > 0 && !cell.dead && (
                    <span
                      className="ja2-bleeding-mark"
                      title={`Hemorragia: ${cell.bleeding} salud por turno`}
                    >
                      −{cell.bleeding} SAL
                    </span>
                  )}
                  {!cell.dead && (
                    <span
                      className="ja2-personal-enemies"
                      title={`${short(u)} ve ${cell.visibleEnemyCount} ${cell.visibleEnemyCount === 1 ? 'enemigo' : 'enemigos'}`}
                    >
                      <Eye size={12} aria-hidden="true" />
                      {cell.visibleEnemyCount}
                    </span>
                  )}
                  {!exploring && !cell.dead && (
                    <span className="ja2-ap-readout" title="Puntos de acción restantes">
                      {formatAP(u.ap)}
                      <small>PA</small>
                    </span>
                  )}
                </span>
                <span className="portrait-name">
                  <b>{cell.index + 1}</b> {cell.label}
                </span>
                {groupIds.includes(u.id) && <span className="ja2-group-tag">En el grupo</span>}
                <span className="ja2-vitals" aria-hidden={cell.dead}>
                  <span
                    title={
                      cell.dead
                        ? 'Muerto'
                        : `Salud: ${Math.ceil(u.hp)}/${u.maxHp}. Heridas vendadas: ${cell.bandaged}. Heridas sin tratar: ${cell.untreated}. Hemorragia: ${cell.bleeding}.`
                    }
                  >
                    <i className="untreated" style={{ height: `${cell.dead ? 0 : 100}%` }} />
                    <i
                      className="bandaged"
                      style={{
                        height: `${cell.dead ? 0 : Math.min(100, cell.hpPct + (cell.bandaged / u.maxHp) * 100)}%`,
                      }}
                    />
                    <i className="health" style={{ height: `${cell.hpPct}%` }} />
                  </span>
                  <span
                    title={`Energía ${Math.round(u.energy ?? 100)}/${maximumEnergy(u)} · la fatiga limita la recuperación`}
                  >
                    <i
                      className="energy"
                      style={{
                        height: `${cell.dead ? 0 : Math.max(0, Math.min(100, u.energy ?? 100))}%`,
                      }}
                    />
                  </span>
                  <span title={`Moral ${Math.round(u.morale ?? 0)}%`}>
                    <i className="morale" style={{ height: `${cell.moralePct}%` }} />
                  </span>
                </span>
                <span className="ja2-roster-hands" aria-hidden="true">
                  {hands.map((hand) => {
                    const Icon = handIcons[hand.icon] ?? Package;
                    return (
                      <span
                        key={hand.side}
                        className={`ja2-roster-hand ${hand.blocked ? 'blocked' : hand.item ? 'held' : 'empty'}`}
                        data-hand-side={hand.side}
                        data-hand-item={hand.item ?? ''}
                        data-close-combat={hand.closeCombat}
                        data-attachment={hand.attached}
                        title={hand.description}
                      >
                        {hand.weapon ? (
                          <img
                            src={sitePath(hand.art ?? `/art/weapon-${hand.weapon}.png`)}
                            alt=""
                            draggable={false}
                          />
                        ) : (
                          <Icon size={16} strokeWidth={1.7} />
                        )}
                        {hand.loaded !== undefined && (
                          <small className="roster-hand-load">
                            {hand.loaded}
                            {hand.loading && (
                              <span
                                className="roster-hand-loading"
                                title={hand.loading.description}
                              >
                                {' '}
                                ·{hand.loading.percent}
                              </span>
                            )}
                          </small>
                        )}
                        {(hand.closeCombat || hand.attached) && (
                          <span className="roster-hand-status">
                            {hand.closeCombat && <b className="close-combat">*</b>}
                            {hand.attached && <b className="attachment">*</b>}
                          </span>
                        )}
                      </span>
                    );
                  })}
                </span>
                <span className="portrait-numbers">
                  {cell.dead
                    ? 'Muerto'
                    : u.unconscious
                      ? 'Inconsciente'
                      : cell.fallen
                        ? 'Fuera de combate'
                        : `${Math.ceil(u.hp)} SAL · ${Math.round(u.energy ?? 100)} EN`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {pageCount > 1 && (
        <nav className="ja2-roster-paging" aria-label="Páginas de combatientes">
          <button
            aria-label="Combatientes anteriores"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            ←
          </button>
          <span>
            {currentPage + 1} / {pageCount}
          </span>
          <button
            aria-label="Combatientes siguientes"
            disabled={currentPage + 1 >= pageCount}
            onClick={() => setPage(currentPage + 1)}
          >
            →
          </button>
        </nav>
      )}
    </div>
  );
}
