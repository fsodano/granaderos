'use client';
import {useEffect,useRef} from 'react';
import {maximumEnergy} from '../../game/fatigue.js';
// Every deployed squad remains accessible in the portrait strip.
// Pure read model (game/ja2-hud.js rosterCells); all mutations are caller-provided callbacks.
import {rosterCells} from '../../game/ja2-hud.js';
import {weaponFor, hasFirearm} from '../../game/tactical.js';
import {portraitFor} from '../lib/portraits';

type Props = {battle?: any; players: any[]; selected: any; groupIds?: string[]; medicalTargeting?: boolean; onSelect: (id: any, additive?: boolean) => void; onOpenInventory: (id: any) => void};
const short = (u: any) => u.nickname || String(u.name || '').split(' ').slice(-1)[0] || '';
const loadState = (u: any, firearm: boolean) =>
  u.activeSlot === 'medical' ? `${u.medkits ?? 0} vendas` : u.activeSlot === 'supply' ? `${u[u.activeSupply] ?? 0} disponibles` : u.activeSlot === 'tool' ? 'Herramienta preparada' : u.activeSlot === 'unarmed' ? 'Manos libres' : !firearm ? 'Arma blanca' : u.jammed ? 'Cazoleta sin cebar' : u.loaded ? `${u.loaded} carga preparada` : 'Arma descargada';

export default function JA2Roster({battle, players, selected, groupIds = [], medicalTargeting = false, onSelect, onOpenInventory}: Props) {
  const selectedCell=useRef<HTMLButtonElement>(null);
  useEffect(()=>{selectedCell.current?.scrollIntoView({block:'nearest',inline:'nearest'});},[selected]);
  const cells = rosterCells(players, selected, battle);
  return (
    <div className={`ja2-roster ${cells.length>6?'multiple-squads':''}`} role="list" aria-label="Escuadra táctica">
      {cells.map((cell: any, i: number) => {
        if (cell.empty) return <div className="empty-portrait-slot" key={`empty-${i}`} aria-hidden="true"><span>—</span></div>;
        const u = cell.unit;
        const portrait = cell.portrait || portraitFor(u.portraitId ?? u.id);
        const firearm = hasFirearm(u);
        const weapon = weaponFor(u);
        return (
          <button
            key={u.id}
            ref={cell.active?selectedCell:undefined}
            role="listitem"
            className={`ja2-portrait-cell ${cell.active ? 'active' : ''} ${cell.fallen ? 'fallen' : ''} ${cell.interruptReady ? 'interrupt-ready' : ''} ${groupIds.includes(u.id) ? 'group-selected' : ''}`}
            disabled={medicalTargeting ? u.hp <= 0 || u.routed : cell.disabled}
            aria-label={`${cell.index + 1}. ${u.name}. ${u.unconscious ? 'Inconsciente' : cell.fallen ? 'Fuera de combate' : `Salud ${Math.ceil(u.hp)}, ${u.ap} puntos de acción, energía ${Math.round(u.energy ?? 100)}`}${cell.bleeding ? `. Hemorragia: ${cell.bleeding} salud por turno` : ''}${cell.interruptReady ? '. Puede actuar en la interrupción' : ''}${groupIds.includes(u.id) ? '. En el grupo de marcha' : ''}. Botón derecho: equipo del combatiente`}
            onClick={event => onSelect(u.id, event.shiftKey)}
            onDoubleClick={() => { if (!medicalTargeting) onOpenInventory(u.id); }}
            onContextMenu={(e) => { e.preventDefault(); onOpenInventory(u.id); }}
          >
            <span className="ja2-portrait-face">{portrait ? <img src={portrait} alt="" /> : <span className="portrait-fallback">{short(u).slice(0, 2).toUpperCase()}</span>}{cell.bleeding > 0 && <span className="ja2-bleeding-mark" title={`Hemorragia: ${cell.bleeding} salud por turno`}>−{cell.bleeding} SAL</span>}</span>
            <span className="portrait-name"><b>{cell.index + 1}</b> {cell.label}</span>
            {groupIds.includes(u.id) && <span className="ja2-group-tag">En el grupo</span>}
            <span className="ja2-vitals">
              <span title={`Salud: ${Math.ceil(u.hp)}/${u.maxHp}. Heridas vendadas: ${cell.bandaged}. Hemorragia: ${cell.bleeding}.`}><i className="bandaged" style={{height: `${Math.min(100, cell.hpPct + cell.bandaged / u.maxHp * 100)}%`}} /><i className="health" style={{height: `${cell.hpPct}%`}} /></span>
              <span title="Puntos de acción"><i className="action" style={{height: `${cell.apPct}%`}} /></span>
              <span title={`Energía ${Math.round(u.energy??100)}/${maximumEnergy(u)} · la fatiga limita la recuperación`}><i className="energy" style={{height: `${Math.max(0, Math.min(100, u.energy ?? 100))}%`}} /></span>
            </span>
            <span className="ja2-weapon-line">{weapon.name} · {loadState(u, firearm)}{firearm ? ` · ${u.ammo} cartuchos` : ''}</span>
            <span className="portrait-numbers">{u.unconscious ? 'Inconsciente' : cell.fallen ? 'Fuera de combate' : `${Math.ceil(u.hp)} SAL · ${u.ap} PA · ${Math.round(u.energy ?? 100)} EN`}</span>
          </button>
        );
      })}
    </div>
  );
}
