'use client';
import {ammoCount,ammoTypeFor,AMMO_TYPES,ammunitionForWeapon} from '../../game/ammo-types.js';
// MODE B: single-merc inventory panel (header / stats / stance grid / paper-doll / slot-grid / pertrechos / far-right cluster).
// Pure read model (game/ja2-hud.js inventoryModel/orderDescriptors); all mutations are caller-provided callbacks.
import {useEffect, useState} from 'react';
import TacticalMinimap from './TacticalMinimap';
import TrainingProgress from './TrainingProgress';
import PersonalPockets from './PersonalPockets';
import {inventoryModel, orderDescriptors, orderAction, slotAction, levelFor} from '../../game/ja2-hud.js';
import {hasFirearm, ignitionRisk, visibleEnemies, weaponTransferPreview} from '../../game/tactical.js';
import {portraitFor} from '../lib/portraits';

const short = (u: any) => u.nickname || String(u.name || '').split(' ').slice(-1)[0] || '';
const alive = (u: any) => u.hp > 0 && !u.routed && !u.unconscious;
const MOVEMENT = [['walk', 'Caminar'], ['run', 'Correr'], ['crouch', 'Agachado y sigiloso'], ['prone', 'Cuerpo a tierra']] as const;
const STANCE_IDS = ['torch', 'bolas', 'free', 'brace', 'repair', 'ration'];

type RadarProps = {
  battle: any; units: any[]; selected: any; project: (x: number, y: number) => { x: number; y: number };
  vw: number; vh: number; cameraRect: any; zoom: number; mode: any;
  missionAllies: any[]; localMilitia: any[];
  onSelect: (id: any) => void; onRetreat: () => void; onCameraCenter: () => void; onCameraPan: (dx: number, dy: number) => void; onZoom: (delta: number) => void;
};
// Shared far-right cluster (radar + locale + garrison popovers + Retirada), reused by MODE A (.ja2-right) and MODE B.
export function RadarCluster({battle, units, selected, project, vw, vh, cameraRect, zoom, mode, missionAllies, localMilitia, onSelect, onRetreat, onCameraCenter, onCameraPan, onZoom}: RadarProps) {
  const enemies = visibleEnemies(battle);
  return (
    <>
      <div className="ja2-radar">
        <TacticalMinimap state={battle} units={units} selected={selected} project={project} width={vw} height={vh} camera={cameraRect} onCenter={(x, y) => onCameraPan(x - (cameraRect.x + cameraRect.width / 2), y - (cameraRect.y + cameraRect.height / 2))} />
        <span className="map-zoom">
          <button aria-label="Desplazar cámara a la izquierda" onClick={() => onCameraPan(-90, 0)}>←</button>
          <button aria-label="Desplazar cámara hacia arriba" onClick={() => onCameraPan(0, -65)}>↑</button>
          <button aria-label="Centrar cámara en el combatiente seleccionado" onClick={onCameraCenter}>◎</button>
          <button aria-label="Desplazar cámara hacia abajo" onClick={() => onCameraPan(0, 65)}>↓</button>
          <button aria-label="Desplazar cámara a la derecha" onClick={() => onCameraPan(90, 0)}>→</button>
          <button aria-label="Alejar campo" disabled={zoom<=1} onClick={()=>onZoom(-.25)}>−</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button aria-label="Acercar campo" disabled={zoom>=3} onClick={()=>onZoom(.25)}>+</button>
        </span>
      </div>
      <div className="ja2-locale">
        <p className="eyebrow">OPERACIÓN TERRESTRE · {battle.night ? 'NOCHE' : 'DÍA'} · {battle.weather?.rain ? 'LLUVIA' : 'CIELO DESPEJADO'}</p>
        <h3>{battle.sectorName}</h3>
        <p>{battle.mode === 'exploration' ? 'Exploración libre' : `Turno ${battle.turn} · Ejército patriota`}</p>
        <p>{enemies.length} avistados</p>
        <p>{mode === 'move' ? 'Seleccioná una casilla para avanzar' : mode === 'heal' ? 'Seleccioná un compañero herido' : mode === 'artilleryMove' ? 'Seleccioná una casilla contigua al cañón' : mode === 'artilleryPivot' ? 'Seleccioná hacia dónde apuntar' : 'Seleccioná un enemigo'}</p>
      </div>
      {missionAllies.length > 0 && <details className="ja2-garrison-toggle" aria-label="Aliados de la misión"><summary>Oficiales aliados · {missionAllies.length} temporales</summary><div className="squad-strip">{missionAllies.map((p: any) => <button key={p.id} className={`squad-card ${p.id === selected ? 'active' : ''} ${alive(p) ? '' : 'fallen'}`} disabled={!alive(p)} aria-label={`Seleccionar aliado ${p.name}`} onClick={() => onSelect(p.id)}><div><strong>{p.name}</strong><span>{alive(p) ? `${Math.ceil(p.hp)} SALUD · ${p.ap} PA` : 'Fuera de combate'}</span></div></button>)}</div></details>}
      {localMilitia.length > 0 && <details className="ja2-garrison-toggle" aria-label="Guarnición local"><summary>Guarnición local · {localMilitia.length} milicianos</summary><p>Las milicias actúan por su cuenta. Podés atenderlas con un integrante de tu escuadra.</p><div className="squad-strip">{localMilitia.map((p: any, i: number) => <article key={p.id} className={`squad-card ${alive(p) ? '' : 'fallen'}`} aria-label={`Miliciano ${i + 1}: ${p.name}`}><div><strong>{i + 1}. {p.name}</strong><span>{p.unconscious ? 'Inconsciente' : alive(p) ? `${Math.ceil(p.hp)} SALUD · ${p.ap} PA` : 'Fuera de combate'}</span></div></article>)}</div></details>}
      <button className="retreat-button" onClick={onRetreat}>{battle.mode === 'exploration' ? 'Volver a la campaña' : 'Retirada'}</button>
    </>
  );
}

type Props = {
  unit: any; battle: any; mode: any; showSight: boolean; busy: boolean; units: any[]; selected: any;
  missionAllies: any[]; localMilitia: any[];
  vw: number; vh: number; cameraRect: any; project: (x: number, y: number) => { x: number; y: number }; zoom: number;
  onOrder: (a: any) => void; onMode: (id: any) => void; onToggleSight: () => void; onSelect: (id: any) => void;
  onRetreat: () => void; onCameraCenter: () => void; onCameraPan: (dx: number, dy: number) => void; onZoom: (delta: number) => void; onCloseInventory: () => void;
};
export default function JA2Inventory({unit, battle, mode, showSight, busy, units, selected, missionAllies, localMilitia, vw, vh, cameraRect, project, zoom, onOrder, onMode, onToggleSight, onSelect, onRetreat, onCameraCenter, onCameraPan, onZoom, onCloseInventory}: Props) {
  const [recipient, setRecipient] = useState('');
  const recipients = battle.units.filter((u:any) => u.side === unit.side && u.id !== unit.id && !u.militia && !u.fled && !u.departure);
  const heldTransfer = weaponTransferPreview(battle, unit, recipients.find((u:any) => u.id === recipient), undefined, unit.activeSlot || 'primary');
  const inv: any = inventoryModel(battle, unit);
  const descriptors: any[] = orderDescriptors(battle, unit, {busy});
  const def = (id: string) => descriptors.find((d: any) => d.id === id);
  const busyDisabled = busy || battle.status !== 'active' || !inv.unitAlive;
  const dropDisabled = busyDisabled || (battle.mode !== 'exploration' && unit.ap < 4);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const editing = Boolean((e.target as HTMLElement)?.closest('input,select,textarea,[contenteditable]:not([contenteditable="false"]),[role="textbox"]'));
      if (e.key === 'Escape' && !e.repeat && !e.ctrlKey && !e.metaKey && !editing) { e.preventDefault(); onCloseInventory(); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onCloseInventory]);
  const movementActive = (id: string) => id === 'prone' ? (unit.stance === 'prone' || unit.movementMode === 'prone') : unit.movementMode === id;
  const slots: any = inv.slots;
  return (
    <div className="ja2-inventory" role="dialog" aria-modal="true" aria-label="Equipo y órdenes del combatiente">
      <div className="ja2-inv-header">
        <div className="portrait">{portraitFor(unit.portraitId ?? unit.id) ? <img src={portraitFor(unit.portraitId ?? unit.id)!} alt={unit.name} /> : <span>{short(unit).slice(0, 2).toUpperCase()}</span>}</div>
        <div><h2>{short(unit)}</h2><span>{unit.mounted ? 'Granadero a caballo' : 'Ejército patriota'} · Nivel {levelFor(unit)}</span></div>
      </div>
      <div className="ja2-stats">
        {inv.stats.map((st: any) => <div key={st.id}><span>{st.label}</span><b>{st.value}</b></div>)}
        <div><span>Salud</span><b>{Math.ceil(unit.hp)} / {unit.maxHp}</b></div>
        <div><span>{battle.mode === 'exploration' ? 'Movimiento sin coste de PA' : 'Puntos de acción'}</span><b>{unit.ap} / {unit.maxAP || 100}</b></div>
        <div><span>Energía</span><b>{Math.round(unit.energy ?? 100)} / 100</b></div>
        <div><span>Carga / capacidad</span><b>{inv.weight.toFixed(1)} / {inv.capacity.toFixed(1)} kg</b></div>
        <div><span>Moral</span><b>{Math.round(unit.morale)}%</b></div>
        <div><span>Estado del mecanismo</span><b>{unit.condition}%</b></div>
        {hasFirearm(unit) && <div><span>Riesgo de chispa fallida</span><b>{Math.round(ignitionRisk(battle, unit))}%</b></div>}
        {unit.knockedDown && <p className="danger-text">Derribado: ponerse de pie cuesta 12 PA.</p>}
        {unit.braced && <p>Bayoneta calada: espera una carga.</p>}
        {unit.bleeding > 0 && <p className="danger-text">Hemorragia: −{unit.bleeding} salud / turno</p>}
        <TrainingProgress unit={unit} />
      </div>
      <div className="ja2-stance-grid">
        <div>
          {MOVEMENT.map(([id, label]) => <button key={id} className={movementActive(id) ? 'active' : ''} aria-label={`Cambiar a ${label}`} disabled={busyDisabled} onClick={() => onOrder(orderAction(battle, unit, {movement: id}, 'movement'))}>{label}</button>)}
        </div>
        <div>
          <button className={showSight ? 'active' : ''} aria-pressed={showSight} disabled={busyDisabled} onClick={onToggleSight}>{showSight ? 'Ocultar' : 'Mostrar'} campo de visión</button>
          {STANCE_IDS.map(id => { const d = def(id); if (!d) return null; return <button key={id} disabled={d.disabled} aria-label={d.label} title={d.detail} onClick={() => { if (d.kind === 'mode') onMode(id); else onOrder(orderAction(battle, unit, {}, id)); }}>{d.label}{d.seconds!==undefined?` · ${d.seconds} s`:d.pa !== undefined ? ` · ${d.pa} PA` : ''}{d.id==='reload'&&d.detail&&<small style={{display:'block'}}>{d.detail}</small>}</button>; })}
        </div>
      </div>
      <div className="paper-doll">
        <div className="hand-slot active held-weapon" aria-label="Arma en uso">
          {inv.activeSlot !== 'unarmed' && slots[inv.activeSlot||'primary']?.id > 0 && <img src={slots[inv.activeSlot||'primary'].art??`/art/weapon-${slots[inv.activeSlot||'primary'].id}.png`} alt=""/>}
          <span>{inv.activeSlot==='unarmed'?'Manos vacías':slots[inv.activeSlot||'primary']?.name??'Manos vacías'}</span>
          {hasFirearm(unit)&&<small>Munición: {ammunitionForWeapon(unit)?.name} · {ammoCount(unit)} disponibles</small>}
        </div>
        <div className="paper-readouts">
          <button className={`line-button ${unit.activeSlot==='unarmed'?'active':''}`} aria-label="Usar manos vacías" aria-pressed={unit.activeSlot==='unarmed'} disabled={busyDisabled || unit.activeSlot==='unarmed' || (battle.mode!=='exploration' && unit.ap<4)} onClick={()=>onOrder(slotAction(unit, 'unarmed'))}>Manos vacías · {battle.mode==='exploration'?'1 s':'4 PA'}</button>
          <button className="line-button" disabled={dropDisabled || (unit.activeSlot==='blade'?!unit.blade:unit.activeSlot==='unarmed'||unit.weaponDropped||!unit.weapon)} onClick={()=>onOrder({type:'drop',slot:unit.activeSlot||'primary'})}>Dejar arma en uso · {battle.mode==='exploration'?'1 s':'4 PA'}</button>
          <label>Entregar a <select aria-label="Entregar arma en uso a" value={recipient} disabled={busyDisabled} onChange={e=>setRecipient(e.target.value)}><option value="">Elegí un compañero</option>{recipients.map((u:any)=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
          <button className="line-button" disabled={busyDisabled || Boolean(heldTransfer.reason)} onClick={()=>onOrder({type:'transfer',slot:unit.activeSlot||'primary',targetId:recipient})}>Entregar arma en uso · {battle.mode==='exploration'?'1 s':'4 PA'}</button>
          {recipient && heldTransfer.reason && <small>{heldTransfer.reason}</small>}
          <span className="armor"><small>Armadura</small><b>{inv.poncho ? 'Sí' : '—'}</b></span>
          <span className="weight"><small>Peso</small><b>{inv.weight.toFixed(1)} / {inv.capacity.toFixed(1)} kg</b></span>
          <span className="camo"><small>Camuflaje</small><b>—</b></span>
        </div>
      </div>
      <PersonalPockets key={unit.id} unit={unit} battle={battle} busy={busy} onOrder={onOrder}/>
      <div className="ja2-right">
        <RadarCluster battle={battle} units={units} selected={selected} project={project} vw={vw} vh={vh} cameraRect={cameraRect} zoom={zoom} mode={mode} missionAllies={missionAllies} localMilitia={localMilitia} onSelect={onSelect} onRetreat={onRetreat} onCameraCenter={onCameraCenter} onCameraPan={onCameraPan} onZoom={onZoom} />
        <button className="ja2-done gold-button" onClick={onCloseInventory}>Listo</button>
      </div>
    </div>
  );
}
