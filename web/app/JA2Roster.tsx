'use client';
// MODE A left zone: squad portrait strip (up to 6 cells + empty placeholders).
// Pure read model (game/ja2-hud.js rosterCells); all mutations are caller-provided callbacks.
import {rosterCells} from '../../game/ja2-hud.js';
import {weaponFor, hasFirearm} from '../../game/tactical.js';
import {portraitFor} from '../lib/portraits';

type Props = {players: any[]; selected: any; onSelect: (id: any) => void; onOpenInventory: (id: any) => void};
const short = (u: any) => u.nickname || String(u.name || '').split(' ').slice(-1)[0] || '';
const loadState = (u: any, firearm: boolean) =>
  !firearm ? 'Arma blanca' : u.jammed ? 'Cazoleta sin cebar' : u.loaded ? `${u.loaded} carga preparada` : 'Arma descargada';

export default function JA2Roster({players, selected, onSelect, onOpenInventory}: Props) {
  const cells = rosterCells(players, selected);
  return (
    <div className="ja2-roster" role="list" aria-label="Escuadra táctica">
      {cells.map((cell: any, i: number) => {
        if (cell.empty) return <div className="empty-portrait-slot" key={`empty-${i}`} aria-hidden="true"><span>—</span></div>;
        const u = cell.unit;
        const portrait = cell.portrait || portraitFor(u.portraitId ?? u.id);
        const firearm = hasFirearm(u);
        const weapon = weaponFor(u);
        return (
          <button
            key={u.id}
            role="listitem"
            className={`ja2-portrait-cell ${cell.active ? 'active' : ''} ${cell.fallen ? 'fallen' : ''}`}
            disabled={cell.disabled}
            aria-label={`${cell.index + 1}. ${u.name}. ${cell.fallen ? 'Fuera de combate' : `Salud ${Math.ceil(u.hp)}, ${u.ap} puntos de acción, energía ${Math.round(u.energy ?? 100)}`}. Botón derecho: equipo del combatiente`}
            onClick={() => onSelect(u.id)}
            onDoubleClick={() => onOpenInventory(u.id)}
            onContextMenu={(e) => { e.preventDefault(); onOpenInventory(u.id); }}
          >
            <span className="ja2-portrait-face">{portrait ? <img src={portrait} alt="" /> : <span className="portrait-fallback">{short(u).slice(0, 2).toUpperCase()}</span>}</span>
            <span className="portrait-name"><b>{cell.index + 1}</b> {cell.label}</span>
            <span className="ja2-vitals">
              <span title="Salud"><i className="health" style={{height: `${Math.max(0, Math.min(100, cell.hpPct))}%`}} /></span>
              <span title="Puntos de acción"><i className="action" style={{height: `${Math.max(0, Math.min(100, (u.ap / (u.maxAP || 100)) * 100))}%`}} /></span>
              <span title="Energía"><i className="energy" style={{height: `${Math.max(0, Math.min(100, u.energy ?? 100))}%`}} /></span>
            </span>
            <span className="ja2-weapon-line">{weapon.name} · {loadState(u, firearm)}{firearm ? ` · ${u.ammo} cartuchos` : ''}</span>
            <span className="portrait-numbers">{cell.fallen ? 'Fuera de combate' : `${Math.ceil(u.hp)} SAL · ${u.ap} PA · ${Math.round(u.energy ?? 100)} EN`}</span>
          </button>
        );
      })}
    </div>
  );
}
