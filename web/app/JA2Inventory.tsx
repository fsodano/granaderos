'use client';
import JA2WeaponMode from './JA2WeaponMode';
import {maximumEnergy} from '../../game/fatigue.js';
// MODE B: single-merc inventory panel (header / stats / stance grid / paper-doll / slot-grid / pertrechos / far-right cluster).
// Pure read model (game/ja2-hud.js inventoryModel/orderDescriptors); all mutations are caller-provided callbacks.
import {useEffect, useState} from 'react';
import TacticalMinimap from './TacticalMinimap';
import JA2Pockets from './JA2Pockets';
import TrainingProgress from './TrainingProgress';
import JA2EnvironmentPanel from './JA2EnvironmentPanel';
import {LooseBayonetControl, AttachedBayonetControl, FittingReadout} from './JA2Bayonet';
import {inventoryModel, inventoryHandlingModel, nearbyLootOptions, nearbyEnvironmentModel, orderDescriptors, orderAction, backpackEquipAction, levelFor, targetingHelp, stanceLabel, equipmentSlots, turnModel, unitCanAct, facingLabel} from '../../game/ja2-hud.js';
import {WEAPONS, BLADES, hasFirearm, ignitionRisk, visibleEnemies, stanceCost, lootPreview, equipLootPreview, containerLootPreview, AP_CARRY_LIMIT} from '../../game/tactical.js';
import {portraitFor} from '../lib/portraits';
import {autoBandageStatus} from '../../game/auto-bandage.js';

const short = (u: any) => u.nickname || String(u.name || '').split(' ').slice(-1)[0] || '';
const alive = (u: any) => u.hp > 0 && !u.routed && !u.unconscious && !u.departure;
const MOVEMENT = [['walk', 'Caminar'], ['run', 'Correr'], ['crouch', 'Agachado'], ['prone', 'Cuerpo a tierra']] as const;
const STANCE_IDS = ['mount', 'free', 'brace', 'repair'];

type RadarProps = {
  battle: any; units: any[]; selected: any; project: (x: number, y: number) => { x: number; y: number };
  vw: number; vh: number; cameraRect: any; zoom: number; mode: any;
  missionAllies: any[]; localMilitia: any[];
  onSelect: (id: any, additive?: boolean) => void; onRetreat: () => void; onCameraCenter: () => void; onCameraPan: (dx: number, dy: number) => void; onZoom: (delta: number) => void;
};
// Shared far-right cluster (radar + locale + garrison popovers + Retirada), reused by MODE A (.ja2-right) and MODE B.
export function RadarCluster({battle, units, selected, project, vw, vh, cameraRect, zoom, mode, missionAllies, localMilitia, onSelect, onRetreat, onCameraCenter, onCameraPan, onZoom}: RadarProps) {
  const enemies = visibleEnemies(battle);
  const actor = battle.units.find((u: any) => u.id === selected);
  const medicalTargeting = actor?.activeSlot === 'medical' && unitCanAct(battle, actor);
  const selectable = (p: any) => medicalTargeting ? p.hp > 0 && !p.routed : unitCanAct(battle, p);
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
        <p>{turnModel(battle).label}</p>
        <p>{enemies.length} avistados</p>
        <p>{targetingHelp(mode, battle.units.find((u: any) => u.id === selected))}</p>
      </div>
      {missionAllies.length > 0 && <details className="ja2-garrison-toggle" aria-label="Aliados de la misión"><summary>Oficiales aliados · {missionAllies.length} temporales</summary><div className="squad-strip">{missionAllies.map((p: any) => <button key={p.id} className={`squad-card ${p.id === selected ? 'active' : ''} ${alive(p) ? '' : 'fallen'}`} disabled={!selectable(p)} aria-label={`Seleccionar aliado ${p.name}`} onClick={event => onSelect(p.id, event.shiftKey)}><div><strong>{p.name}</strong><span>{alive(p) ? `${Math.ceil(p.hp)} SALUD · ${p.ap} PA` : 'Fuera de combate'}</span></div></button>)}</div></details>}
      {localMilitia.length > 0 && <details className="ja2-garrison-toggle" aria-label="Guarnición local"><summary>Guarnición local · {localMilitia.length} milicianos</summary><p>La milicia combate por su cuenta.</p><div className="squad-strip">{localMilitia.map((p: any, i: number) => {
        const content = <div><strong>{i + 1}. {p.name}</strong><span>{p.unconscious ? 'Inconsciente' : alive(p) ? `${Math.ceil(p.hp)} SALUD · ${p.ap} PA` : 'Fuera de combate'}</span></div>;
        return medicalTargeting
          ? <button key={p.id} className="squad-card" disabled={!selectable(p)} aria-label={`Vendar a ${p.name}`} onClick={() => onSelect(p.id)}>{content}</button>
          : <div key={p.id} className={`squad-card ${alive(p) ? '' : 'fallen'}`} aria-label={`Miliciano ${i + 1}: ${p.name}`}>{content}</div>;
      })}</div></details>}
      <button className="retreat-button" onClick={onRetreat}>{battle.mode === 'exploration' ? 'Salir del sector' : 'Retirada'}</button>
    </>
  );
}

type Props = {
  unit: any; battle: any; mode: any; showSight: boolean; busy: boolean; units: any[]; selected: any;
  missionAllies: any[]; localMilitia: any[];
  vw: number; vh: number; cameraRect: any; project: (x: number, y: number) => { x: number; y: number }; zoom: number;
  onOrder: (a: any) => void; onMode: (id: any) => void; onToggleSight: () => void; onSelect: (id: any, additive?: boolean) => void;
  onRetreat: () => void; onCameraCenter: () => void; onCameraPan: (dx: number, dy: number) => void; onZoom: (delta: number) => void; onCloseInventory: () => void;
  onAutoBandage?: () => void; bandageReport?: any;
};
export default function JA2Inventory({unit, battle, mode, showSight, busy, units, selected, missionAllies, localMilitia, vw, vh, cameraRect, project, zoom, onOrder, onMode, onToggleSight, onSelect, onRetreat, onCameraCenter, onCameraPan, onZoom, onCloseInventory, onAutoBandage, bandageReport}: Props) {
  const inv: any = inventoryModel(battle, unit);
  const bandaging = autoBandageStatus(battle);
  const descriptors: any[] = orderDescriptors(battle, unit, {busy});
  const def = (id: string) => descriptors.find((d: any) => d.id === id);
  const equipped = equipmentSlots(battle, unit, {busy});
  const slotDisabled = (id: string) => equipped.find((slot: any) => slot.slot === id)?.disabled;
  const busyDisabled = busy || !inv.unitReady;
  const [managedItem, setManagedItem] = useState('ammo');
  const [quantity, setQuantity] = useState(1);
  const [recipient, setRecipient] = useState('');
  const [lootId, setLootId] = useState('');
  const [lootQuantity, setLootQuantity] = useState(1);
  const [environmentKey, setEnvironmentKey] = useState('');
  const [environmentVerb, setEnvironmentVerb] = useState('');
  const [contentIndex, setContentIndex] = useState(0);
  const [contentQuantity, setContentQuantity] = useState(1);
  const item = inv.items.find((entry: any) => entry.item === managedItem) || inv.items[0];
  const selectedSupply = inv.heldSupplies.find((supply: any) => supply.key === item?.item);
  const count = Math.min(quantity, item?.count ?? 1);
  const handling = inventoryHandlingModel(battle, unit, {item: item?.item, count, targetId: recipient, busy});
  const nearby = nearbyLootOptions(battle, unit);
  const lootItem = nearby.find(entry => entry.id === lootId) || nearby[0];
  const lootCount = Math.min(lootQuantity, lootItem?.count ?? 1);
  const loot = lootPreview(battle, unit, {...lootItem?.action, count: lootCount});
  const environment = nearbyEnvironmentModel(battle, unit, {targetKey: environmentKey, verb: environmentVerb});
  const content = environment.contents.find((entry: any) => entry.index === contentIndex) || environment.contents[0];
  const contentCount = Math.min(contentQuantity, content?.count ?? 1);
  const containerLoot = environment.target?.kind === 'container' ? containerLootPreview(battle, unit, environment.target, content?.index ?? 0, contentCount) : null;
  const chooseItem = (id: string) => { setManagedItem(id); setQuantity(1); };
  useEffect(() => { setManagedItem('ammo'); setQuantity(1); setRecipient(''); setLootId(''); setLootQuantity(1); setEnvironmentKey(''); setEnvironmentVerb(''); setContentIndex(0); setContentQuantity(1); }, [unit.id]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const editing = Boolean((e.target as HTMLElement)?.closest('input,select,textarea,[contenteditable]:not([contenteditable="false"]),[role="textbox"]'));
      if (e.key === 'Escape' && !e.repeat && !e.ctrlKey && !e.metaKey && !editing) { e.preventDefault(); onCloseInventory(); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onCloseInventory]);
  const movementActive = (id: string) => unit.movementMode === id;
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
        <div><span>{battle.mode === 'exploration' ? 'Movimiento sin coste de PA' : 'Puntos de acción'}</span><b>{unit.ap} / {inv.currentAPLimit}</b></div>
        <div><span>Postura</span><b>{stanceLabel(unit.stance)}</b></div>
        <div><span>Orientación</span><b>{facingLabel(unit)}</b></div>
        <div><span>Energía</span><b>{Math.round(unit.energy ?? 100)} / {maximumEnergy(unit)}</b></div>
        <div><span>Carga / capacidad</span><b>{inv.weight.toFixed(1)} / {inv.capacity.toFixed(1)} kg</b></div>
        <div><span>Espacio del equipo</span><b>{inv.pockets.used ?? '—'} / {inv.pockets.capacity}</b></div>
        {inv.pockets.overloaded && <p className="danger-text">Falta espacio en el equipo. Soltá o entregá objetos antes de recibir más.</p>}
        <div><span>Moral</span><b>{Math.round(unit.morale)}%</b></div>
        <div><span>Estado del mecanismo</span><b>{unit.condition}%</b></div>
        {hasFirearm(unit) && <div><span>Riesgo de chispa fallida</span><b>{Math.round(ignitionRisk(battle, unit))}%</b></div>}
        {unit.knockedDown && <p className="danger-text">Derribado: ponerse de pie cuesta 12 PA.</p>}
        {unit.braced && <p>Bayoneta calada: espera una carga.</p>}
        {unit.bleeding > 0 && <p className="danger-text">Hemorragia: −{unit.bleeding} salud / turno</p>}
        {unit.bandaged > 0 && <p>Heridas vendadas: {Math.ceil(unit.bandaged)}. Requieren tratamiento en campaña.</p>}
        <p>Vendar detiene la hemorragia; no recupera salud. Se puede vendar a un aliado inconsciente.</p>
        <section className="ja2-auto-bandage" aria-label="Vendaje de la escuadra">
          <button className="line-button" disabled={busy || !onAutoBandage || !bandaging.available} title={bandaging.reason || 'Los sanitarios se acercan a los heridos y usan sus propias vendas.'} onClick={onAutoBandage}>Vendar escuadra</button>
          <p>Usa tiempo, fuerzas y vendas de los sanitarios. Se detiene ante peligro. No recupera salud.</p>
          {bandaging.reason && <p>{bandaging.reason}</p>}
          {bandageReport && <div role="status"><p>{bandageReport.treatedIds.length} atendidos · {bandageReport.elapsedSeconds} s.</p>{bandageReport.untreated.length > 0 ? <ul>{bandageReport.untreated.map((patient: any) => <li key={patient.id}>{patient.name}: {patient.reason}</li>)}</ul> : <p>Todas las heridas están vendadas.</p>}</div>}
        </section>
        {battle.mode !== 'exploration' && <p>Se conservan hasta {AP_CARRY_LIMIT} PA. Reserva posible: {inv.apBudget.carryover}. Las heridas y el cansancio reducen los PA del turno.</p>}
        <TrainingProgress unit={unit} />
      </div>
      <div className="ja2-stance-grid">
        <div>
          {MOVEMENT.map(([id, label]) => { const targetStance = id === 'prone' ? 'prone' : id === 'crouch' ? 'crouched' : 'standing'; const pa = stanceCost(unit, targetStance); return <button key={id} className={movementActive(id) ? 'active' : ''} aria-pressed={movementActive(id)} aria-label={`Cambiar a ${label}: ${pa} PA`} disabled={busyDisabled || unit.knockedDown || (unit.mounted && ['prone', 'crouch'].includes(id)) || (battle.mode !== 'exploration' && unit.ap < pa)} onClick={() => onOrder(orderAction(battle, unit, {movement: id}, 'movement'))}>{label} · {pa} PA</button>; })}
        </div>
        <div>
          <button disabled={def('stealth')?.disabled} aria-pressed={Boolean(unit.stealthMode)} className={unit.stealthMode ? 'active' : ''} title="Consume más PA al moverse y reduce el ruido. No cambia la postura." onClick={() => onOrder(orderAction(battle, unit, {}, 'stealth'))}>Sigilo · {unit.stealthMode ? 'Sí' : 'No'}</button>
          <button className={showSight ? 'active' : ''} aria-pressed={showSight} disabled={busyDisabled} onClick={onToggleSight}>{showSight ? 'Ocultar' : 'Mostrar'} campo de visión</button>
          {STANCE_IDS.map(id => { const d = def(id); if (!d) return null; return <button key={id} disabled={d.disabled} aria-label={d.label} onClick={() => { if (d.kind === 'mode') onMode(id); else onOrder(orderAction(battle, unit, {}, id)); }}>{d.label}{d.pa !== undefined ? ` · ${d.pa} PA` : ''}</button>; })}
        </div>
      </div>
      <div className="paper-doll">
        <button className={`hand-slot primary ${inv.activeSlot === 'primary' ? 'active' : ''}`} disabled={slotDisabled('primary') || inv.activeSlot === 'primary'} aria-pressed={inv.activeSlot === 'primary'} aria-label={`Equipar ${slots.primary?.name ?? 'arma principal'}: ${def('weapon')?.pa} PA`} onClick={() => onOrder({type: 'weapon', slot: 'primary'})}>
          {slots.primary?.id >= 1800 && slots.primary?.id <= 1813 && <img src={`/art/weapon-${slots.primary.id}.png`} alt="" />}
          <span>{slots.primary?.name ?? '—'}</span>
        </button>
        <button className={`hand-slot blade ${inv.activeSlot === 'blade' ? 'active' : ''}`} disabled={slotDisabled('blade') || inv.activeSlot === 'blade'} aria-pressed={inv.activeSlot === 'blade'} aria-label={slots.blade ? `Equipar ${slots.blade.name}: ${def('weapon')?.pa} PA` : 'Ranura secundaria vacía'} onClick={() => onOrder({type: 'weapon', slot: 'blade'})}>
          {slots.blade?.id >= 1800 && slots.blade?.id <= 1813 && <img src={`/art/weapon-${slots.blade.id}.png`} alt="" />}
          <span>{slots.blade?.name ?? 'Sin arma secundaria'}</span>
        </button>
        <button className={`hand-slot medical ${inv.activeSlot === 'medical' ? 'active' : ''}`} disabled={slotDisabled('medical') || inv.activeSlot === 'medical'} aria-pressed={inv.activeSlot === 'medical'} aria-label={`Equipar vendas: ${def('weapon')?.pa} PA. Quedan ${slots.medical.count}`} onClick={() => { onOrder({type: 'weapon', slot: 'medical'}); onMode('move'); onCloseInventory(); }}>
          <b aria-hidden="true">✚</b><span>{slots.medical.name} · {slots.medical.count}</span><small>Equipar · {def('weapon')?.pa} PA</small>
        </button>
        <button className={`hand-slot unarmed ${inv.activeSlot === 'unarmed' ? 'active' : ''}`} disabled={slotDisabled('unarmed') || inv.activeSlot === 'unarmed'} aria-pressed={inv.activeSlot === 'unarmed'} aria-label={`Dejar las manos libres: ${def('weapon')?.pa} PA`} onClick={() => onOrder({type: 'weapon', slot: 'unarmed'})}>
          <span>Manos libres</span><small>Atacar con los puños</small>
        </button>
        <JA2WeaponMode battle={battle} unit={unit} busy={busy} onOrder={onOrder} onMode={onMode}/>
        <div className="ja2-hand-management">{inv.items.filter((entry: any) => ['primary', 'blade'].includes(entry.item)).map((entry: any) => <button key={entry.item} className="line-button" disabled={busyDisabled} aria-pressed={item?.item === entry.item} onClick={() => chooseItem(entry.item)}>Dar o soltar {entry.label}</button>)}</div>
        <AttachedBayonetControl attached={inv.fittings.attached} busy={busyDisabled} onOrder={onOrder}/>
        <LooseBayonetControl source={inv.fittings.sources.find((source: any) => source.item === 'blade')} busy={busyDisabled} onOrder={onOrder}/>
        {inv.tools.length > 0 && <label className="ja2-tool-selector">Herramienta<select aria-label="Equipar herramienta" value={unit.activeSlot === 'tool' ? unit.activeTool || '' : ''} disabled={slotDisabled('tool')} onChange={event => { if (event.target.value) { onOrder({type: 'weapon', slot: 'tool', toolKey: event.target.value}); onMode('move'); } }}><option value="">Elegir herramienta</option>{inv.tools.map((tool: any) => <option key={tool.item} value={tool.item}>{tool.name} · {tool.count} · estado {tool.condition ?? 100}%</option>)}</select></label>}
        {inv.heldSupplies.length > 0 && <label className="ja2-tool-selector">Pertrecho en mano<select aria-label="Equipar pertrecho" value={unit.activeSlot === 'supply' ? unit.activeSupply || '' : ''} disabled={slotDisabled('supply')} onChange={event => { if (event.target.value) { onOrder({type: 'weapon', slot: 'supply', supplyKey: event.target.value}); onMode('move'); } }}><option value="">Elegir pertrecho · {def('weapon')?.pa} PA</option>{inv.heldSupplies.map((supply: any) => <option key={supply.key} value={supply.key}>{supply.label} · {supply.count}</option>)}</select></label>}
        <div className="paper-readouts">
          <span className="armor"><small>Armadura</small><b>{inv.poncho ? 'Sí' : '—'}</b></span>
          <span className="weight"><small>Peso</small><b>{inv.weight.toFixed(1)} / {inv.capacity.toFixed(1)} kg</b></span>
          <span className="camo"><small>Camuflaje</small><b>—</b></span>
        </div>
      </div>
      <div className="slot-grid">
        <JA2Pockets key={unit.id} unit={unit} layout={inv.pockets} disabled={busyDisabled} onPick={chooseItem} onOrder={onOrder}/>
        {inv.backpack.filter((record:any)=>`inventory:${record.key}`===managedItem).map((item: any) => {
          const gun = (WEAPONS as any)[item.weapon];
          const blade = (BLADES as any)[item.weapon];
          const primaryEquip = equipLootPreview(battle, unit, item.key, 'primary');
          const bladeEquip = blade ? equipLootPreview(battle, unit, item.key, 'blade') : null;
          const tool = inv.tools.find((entry: any) => entry.key === item.key);
          return (
            <div key={item.key} className={`slot-cell ${item.equippable ? 'equippable' : ''}`}>
              <span>{item.name ?? 'Pertrechos'} · {item.count}{gun ? ` · ${item.loaded || 0} carga(s)` : ''}{item.condition !== undefined ? ` · estado ${item.condition}%` : ''}</span>
              <FittingReadout fitting={item.fittings?.bayonet}/>
              <LooseBayonetControl source={inv.fittings.sources.find((source: any) => source.item === `inventory:${item.key}`)} busy={busyDisabled} onOrder={onOrder}/>
              {item.equippable && <>
                <button className="line-button" disabled={busyDisabled || !primaryEquip.valid} title={primaryEquip.reason || undefined} onClick={() => onOrder(backpackEquipAction(item.key, 'primary'))}>Equipar principal · {primaryEquip.pa} PA</button>
                {bladeEquip && <button className="line-button" disabled={busyDisabled || !bladeEquip.valid} title={bladeEquip.reason || undefined} onClick={() => onOrder(backpackEquipAction(item.key, 'blade'))}>Equipar secundaria · {bladeEquip.pa} PA</button>}
              </>}
              {tool && <button className="line-button" disabled={slotDisabled('tool') || tool.active} aria-pressed={tool.active} onClick={() => { onOrder({type: 'weapon', slot: 'tool', toolKey: tool.item}); onMode('move'); }}>Equipar herramienta · {def('weapon')?.pa} PA</button>}
              <button className="line-button" disabled={busyDisabled || item.count < 1} aria-pressed={managedItem === `inventory:${item.key}`} onClick={() => chooseItem(`inventory:${item.key}`)}>Dar o soltar</button>
            </div>
          );
        })}

      </div>
      <div className="pertrechos">

        <div className="ja2-item-handling" aria-label="Dar o soltar equipo">
          <label>Objeto<select aria-label="Objeto para dar o soltar" disabled={busyDisabled || !inv.items.length} value={item?.item || ''} onChange={event => chooseItem(event.target.value)}>{!inv.items.length && <option value="">Sin objetos</option>}{inv.items.map((entry: any) => <option key={entry.item} value={entry.item}>{entry.label} · {entry.count}</option>)}</select></label>
          <label>Cantidad<input aria-label="Cantidad de objetos" type="number" min="1" step="1" max={item?.count || 1} disabled={busyDisabled || !item} value={count} onChange={event => setQuantity(Number(event.target.value))} /></label>
          <label>Destinatario<select aria-label="Aliado que recibe el equipo" disabled={busyDisabled} value={recipient} onChange={event => setRecipient(event.target.value)}><option value="">Elegir aliado</option>{handling.recipients.map((target: any) => <option key={target.id} value={target.id} disabled={target.unconscious}>{target.nickname || target.name}{target.unconscious ? ' · inconsciente' : ''}</option>)}</select></label>
          <button className="line-button" disabled={handling.transfer.disabled} title={handling.transfer.reason || undefined} onClick={() => onOrder(handling.transfer.action)}>{handling.transfer.label}{recipient ? ` · ${handling.transfer.totalPA} PA${handling.transfer.kind === 'relay' ? ' en total' : ''}` : ''}</button>
          <button className="line-button" disabled={handling.drop.disabled} title={handling.drop.reason || undefined} onClick={() => onOrder({type: 'drop', item: item.item, count})}>Soltar aquí · {handling.drop.pa} PA</button>
          {selectedSupply && <button className="line-button" disabled={slotDisabled('supply') || selectedSupply.active} onClick={() => { onOrder({type: 'weapon', slot: 'supply', supplyKey: selectedSupply.key}); onMode('move'); }}>Equipar {selectedSupply.label} · {def('weapon')?.pa} PA</button>}
        </div>
        <p className="ja2-item-feedback" aria-live="polite">{item && `${item.label} · ${item.count} disponible(s). `}{item?.condition !== undefined && `Estado ${item.condition}%. `}{item?.loaded !== undefined && `${item.loaded} carga(s). `}{item?.jammed && 'Necesita cebado. '}{recipient ? handling.transfer.reason || handling.transfer.detail : 'Elegí un aliado para entregar equipo. Soltar deja el objeto en tu casilla.'}{handling.drop.reason && ` ${handling.drop.reason}`}</p>
        <details className="ja2-nearby-loot"><summary>Objetos cercanos · {nearby.length}</summary>{nearby.length ? <>
          <div className="ja2-item-handling">
            <label>Objeto cercano<select aria-label="Objeto cercano para recoger" disabled={busyDisabled} value={lootItem?.id || ''} onChange={event => { setLootId(event.target.value); setLootQuantity(1); }}>{nearby.map(entry => <option key={entry.id} value={entry.id}>{entry.source} · {entry.label} · {entry.count}</option>)}</select></label>
            <label>Cantidad<input aria-label="Cantidad para recoger" type="number" min="1" step="1" max={lootItem?.count || 1} disabled={busyDisabled} value={lootCount} onChange={event => setLootQuantity(Number(event.target.value))} /></label>
            <button className="line-button" disabled={busyDisabled || !loot.valid} title={loot.reason || undefined} onClick={() => onOrder({...lootItem.action, count: lootCount})}>Recoger · {loot.pa} PA</button>
          </div>
          <p className="ja2-item-feedback">{lootItem?.condition !== undefined && `Estado ${lootItem.condition}%. `}{lootItem?.loaded !== undefined && `${lootItem.loaded} carga(s). `}{lootItem?.jammed && 'Necesita cebado. '}{loot.reason || 'Solo se recoge la cantidad indicada.'}</p>
        </> : <p>Acercate a un cuerpo o a un objeto visible en el suelo.</p>}</details>
        <JA2EnvironmentPanel targets={environment.targets} selected={environment.target?.key || ''} target={environment.target} preview={environment.preview} verbs={environment.verbs} verb={environmentVerb} busy={busyDisabled} contents={environment.contents} contentIndex={content?.index ?? 0} count={contentCount} loot={containerLoot}
          onTarget={key => { setEnvironmentKey(key); setEnvironmentVerb(''); setContentIndex(0); setContentQuantity(1); }} onVerb={setEnvironmentVerb} onUse={() => environment.preview && onOrder(environment.preview.action)}
          onContent={index => { setContentIndex(index); setContentQuantity(1); }} onCount={setContentQuantity} onLoot={() => containerLoot && onOrder(containerLoot.action)} />
      </div>
      <div className="ja2-right">
        <RadarCluster battle={battle} units={units} selected={selected} project={project} vw={vw} vh={vh} cameraRect={cameraRect} zoom={zoom} mode={mode} missionAllies={missionAllies} localMilitia={localMilitia} onSelect={onSelect} onRetreat={onRetreat} onCameraCenter={onCameraCenter} onCameraPan={onCameraPan} onZoom={onZoom} />
        <button className="ja2-done gold-button" onClick={onCloseInventory}>Listo</button>
      </div>
    </div>
  );
}
