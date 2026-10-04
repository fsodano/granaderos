'use client';
import {sitePath} from '../lib/site-path.js';
import {Skull} from 'lucide-react';
import AmmunitionLoadChoice from './AmmunitionLoadChoice';
import {outfitSlot} from '../../game/outfits.js';
import './ja2-outfit.css';
import JA2Hands from './JA2Hands';
import JA2ItemCard from './JA2ItemCard';
import {equipmentEndpoint} from '../../game/tactical-inventory.js';
import {FIELD_DRESSINGS_AP,fieldDressingsSource} from '../../game/field-dressings.js';
import JA2OutfitSlot from './JA2OutfitSlot';
import {EquipmentInteractionProvider,useEquipmentInteraction} from '../lib/equipment-drag';
import JA2WeaponMode from './JA2WeaponMode';
import {handsRequired} from '../../game/hand-layout.js';
import {accessStepsFrom,tacticalLevel} from '../../game/tactical-space.js';
import {climbPreview,fieldDressingsPreview} from '../../game/tactical.js';
import {maximumEnergy} from '../../game/fatigue.js';
import {nervousIsolationStatus} from '../../game/nervous-isolation.js';
// MODE B: single-merc inventory panel (header / stats / stance grid / paper-doll / slot-grid / pertrechos / far-right cluster).
// Pure read model (game/ja2-hud.js inventoryModel/orderDescriptors); all mutations are caller-provided callbacks.
import {useEffect, useState} from 'react';
import TacticalMinimap from './TacticalMinimap';
import {tacticalMinimapLabel} from '../../game/tactical-minimap-label.js';
import JA2Pockets from './JA2Pockets';
import TrainingProgress from './TrainingProgress';
import JA2EnvironmentPanel from './JA2EnvironmentPanel';
import {LooseBayonetControl, AttachedBayonetControl, FittingReadout} from './JA2Bayonet';
import {inventoryModel, inventoryHandlingModel, nearbyLootOptions, nearbyEnvironmentModel, orderDescriptors, orderAction, backpackEquipAction, levelFor, targetingHelp, stanceLabel, equipmentSlots, turnModel, unitCanAct, facingLabel, rosterCells} from '../../game/ja2-hud.js';
import {mainItemPreview,swapHandsPreview, WEAPONS, BLADES, hasFirearm, ignitionRisk, visibleEnemies, stanceCost, lootPreview, equipLootPreview, containerLootPreview, AP_CARRY_LIMIT} from '../../game/tactical.js';
import {portraitFor} from '../lib/portraits';
import {autoBandageStatus} from '../../game/auto-bandage.js';

const short = (u: any) => u.nickname || String(u.name || '').split(' ').slice(-1)[0] || '';
const alive = (u: any) => u.hp > 0 && !u.routed && !u.unconscious && !u.departure;
const MOVEMENT = [['walk', 'Caminar'], ['run', 'Correr'], ['crouch', 'Agachado'], ['prone', 'Cuerpo a tierra']] as const;
const STANCE_IDS = ['mount', 'free', 'brace', 'repair'];
const shockFormat = new Intl.NumberFormat('es-AR', {maximumFractionDigits: 2});

type RadarProps = {
  equipmentScope?:string;
  battle: any; units: any[]; selected: any; project: (x: number, y: number) => { x: number; y: number };
  vw: number; vh: number; cameraRect: any; zoom: number; mode: any;
  missionAllies: any[]; localMilitia: any[];
  onSelect: (id: any, additive?: boolean) => void; onRetreat: () => void; onCameraCenter: () => void; onCameraPan: (dx: number, dy: number) => void; onZoom: (delta: number) => void;
};
// Shared far-right cluster (radar + locale + garrison popovers + Retirada), reused by MODE A (.ja2-right) and MODE B.
export function RadarCluster({equipmentScope,battle, units, selected, project, vw, vh, cameraRect, zoom, mode, missionAllies, localMilitia, onSelect, onRetreat, onCameraCenter, onCameraPan, onZoom}: RadarProps) {
  const enemies = visibleEnemies(battle);
  const actor = battle.units.find((u: any) => u.id === selected);
  const medicalTargeting = actor?.activeSlot === 'medical' && unitCanAct(battle, actor);
  const selectable = (p: any) => medicalTargeting ? p.hp > 0 && !p.routed : unitCanAct(battle, p);
  const radarLabel = tacticalMinimapLabel(battle);
  return (
    <>
      <div className="ja2-radar" data-equipment-scope={equipmentScope}>
        <TacticalMinimap state={battle} units={units} selected={selected} project={project} width={vw} height={vh} camera={cameraRect} onCenter={(x, y) => onCameraPan(x - (cameraRect.x + cameraRect.width / 2), y - (cameraRect.y + cameraRect.height / 2))} />
        <span className="ja2-radar-caption" title={`${radarLabel.sectorCode} · ${radarLabel.sectorName} · Día ${radarLabel.day} · ${radarLabel.time}`}>{radarLabel.sectorCode} · {radarLabel.sectorName}<small>Día {radarLabel.day} · {radarLabel.time}</small></span>
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
        <h3 title={`Sector ${radarLabel.sectorCode}`}>{battle.sectorName}</h3>
        <p>{turnModel(battle).label}</p>
        <p>{enemies.length} avistados</p>
        <p>{targetingHelp(mode, battle.units.find((u: any) => u.id === selected))}</p>
      </div>
      {missionAllies.length > 0 && <details className="ja2-garrison-toggle" aria-label="Aliados de la misión"><summary>Oficiales aliados · {missionAllies.length} temporales</summary><div className="squad-strip">{missionAllies.map((p: any) => <button key={p.id} className={`squad-card ${p.id === selected ? 'active' : ''} ${alive(p) ? '' : 'fallen'}`} disabled={!selectable(p)} aria-label={`Seleccionar aliado ${p.name}`} onClick={event => onSelect(p.id, event.shiftKey)}><div><strong>{p.name}</strong><span>{alive(p) ? `${Math.ceil(p.hp)} SALUD · ${battle.mode === 'exploration' ? 'Exploración' : `${p.ap} PA`}` : 'Fuera de combate'}</span></div></button>)}</div></details>}
      {localMilitia.length > 0 && <details className="ja2-garrison-toggle" aria-label="Guarnición local"><summary>Guarnición local · {localMilitia.length} milicianos</summary><p>La milicia combate por su cuenta.</p><div className="squad-strip">{localMilitia.map((p: any, i: number) => {
        const content = <div><strong>{i + 1}. {p.name}</strong><span>{p.unconscious ? 'Inconsciente' : alive(p) ? `${Math.ceil(p.hp)} SALUD · ${battle.mode === 'exploration' ? 'Exploración' : `${p.ap} PA`}` : 'Fuera de combate'}</span></div>;
        return medicalTargeting
          ? <button key={p.id} className="squad-card" disabled={!selectable(p)} aria-label={`Vendar a ${p.name}`} onClick={() => onSelect(p.id)}>{content}</button>
          : <div key={p.id} className={`squad-card ${alive(p) ? '' : 'fallen'}`} aria-label={`Miliciano ${i + 1}: ${p.name}`}>{content}</div>;
      })}</div></details>}
      <button className="retreat-button" onClick={onRetreat}>{battle.mode === 'exploration' ? 'Salir del sector' : 'Retirada'}</button>
    </>
  );
}

// Only map navigation preserves an inventory reservation. These children read
// the provider shared with the field without adding a wrapper to the HUD grid.
function InventoryRadarCluster(props:RadarProps){
  const {store}=useEquipmentInteraction();
  return <RadarCluster {...props} equipmentScope={store.scope}/>;
}
function InventoryCursorLevel({level,onChange}:{level:number;onChange:(level:number)=>void}){
  const {store}=useEquipmentInteraction();
  return <button className="line-button" data-equipment-scope={store.scope} aria-label="Cambiar altura del cursor" onClick={()=>onChange(level===0?1:0)}>Cursor: {level===0?'Suelo':'Nivel superior'}</button>;
}

type Props = {
  cursorLevel?:number; onCursorLevelChange?:(level:number)=>void;
  unit: any; battle: any; mode: any; showSight: boolean; busy: boolean; units: any[]; selected: any;
  missionAllies: any[]; localMilitia: any[];
  vw: number; vh: number; cameraRect: any; project: (x: number, y: number) => { x: number; y: number }; zoom: number;
  onOrder: (a: any) => void; onMode: (id: any) => void; onToggleSight: () => void; onSelect: (id: any, additive?: boolean) => void;
  onInventoryUnit?: (id: any) => void;
  onRetreat: () => void; onCameraCenter: () => void; onCameraPan: (dx: number, dy: number) => void; onZoom: (delta: number) => void; onCloseInventory: () => void;
  onAutoBandage?: () => void; bandageReport?: any;
};
export default function JA2Inventory({cursorLevel=0,onCursorLevelChange,unit, battle, mode, showSight, busy, units, selected, missionAllies, localMilitia, vw, vh, cameraRect, project, zoom, onOrder, onMode, onToggleSight, onSelect, onInventoryUnit, onRetreat, onCameraCenter, onCameraPan, onZoom, onCloseInventory, onAutoBandage, bandageReport}: Props) {
  const cost=(n:number|undefined)=>battle.mode==='exploration'?'sin PA':`${n ?? 0} PA`;
  const inv: any = inventoryModel(battle, unit);
  const isolation = nervousIsolationStatus(battle, {...unit, shock: (unit.shock ?? 0) / 2});
  const isolationText = isolation.reason === 'companion' ? 'Compañía cercana: sin aumento.'
    : isolation.reason === 'morale' ? 'Moral suficiente: sin aumento.'
    : isolation.reason === 'incapable' ? 'Ahora no puede combatir.'
    : battle.mode === 'combat' && battle.status === 'active'
      ? `Si sigue aislado y con moral baja: tensión +${shockFormat.format(isolation.addedShock)} al comenzar su turno, tras la recuperación habitual.`
      : 'Fuera de combate: sin aumento.';
  const vitals: any = rosterCells([unit],unit.id,battle)[0];
  const inventoryUnits = battle.units.filter((u:any)=>u.side==='player'&&!u.militia&&!u.missionAlly&&!u.departure&&!u.fled);
  const inventoryIndex = inventoryUnits.findIndex((u:any)=>u.id===unit.id);
  const navigateInventory = (offset:number) => {
    const next = inventoryUnits[(inventoryIndex + offset + inventoryUnits.length) % inventoryUnits.length];
    if(next)(onInventoryUnit ?? onSelect)?.(next.id);
  };
  const bandaging = autoBandageStatus(battle);
  const descriptors: any[] = orderDescriptors(battle, unit, {busy});
  const def = (id: string) => descriptors.find((d: any) => d.id === id);
  const equipped = equipmentSlots(battle, unit, {busy});
  const slotDisabled = (id: string) => equipped.find((slot: any) => slot.slot === id)?.disabled;
  const busyDisabled = busy || !inv.unitReady;
  const [managedReference, setManagedItem] = useState('');
  const [inspectedSlot,setInspectedSlot]=useState('');
  const [dressingsSelection,setDressingsSelection]=useState<{key:string;expectedSource:string}|null>(null);
  const managedItem=inspectedSlot?equipmentEndpoint(unit,inspectedSlot).item??managedReference:managedReference;
  const [quantity, setQuantity] = useState(1);
  const [recipient, setRecipient] = useState('');
  const [lootId, setLootId] = useState('');
  const [lootQuantity, setLootQuantity] = useState(1);
  const [environmentKey, setEnvironmentKey] = useState('');
  const [environmentVerb, setEnvironmentVerb] = useState('');
  const [contentIndex, setContentIndex] = useState(0);
  const [contentQuantity, setContentQuantity] = useState(1);
  const [contentSource,setContentSource]=useState<{targetKey:string;expectedSource:string}|null>(null);
  // An emptied inspected slot must not silently select another possession.
  const item = inv.items.find((entry: any) => entry.item === managedItem) || (managedItem ? null : inv.items[0]);
  const count = Math.min(quantity, item?.count ?? 1);
  const handling = inventoryHandlingModel(battle, unit, {item: item?.item, count, targetId: recipient, busy});
  const nearby = nearbyLootOptions(battle, unit);
  const lootItem = nearby.find(entry => entry.id === lootId) || nearby[0];
  const lootCount = Math.min(lootQuantity, lootItem?.count ?? 1);
  const loot = lootPreview(battle, unit, {...lootItem?.action, count: lootCount});
  const environment = nearbyEnvironmentModel(battle, unit, {targetKey: environmentKey, verb: environmentVerb});
  const containerTarget=environment.target?.kind==='container'?environment.target:null;
  const containerOpen=containerTarget&&'open'in containerTarget?containerTarget.open:undefined;
  const selectedSource=containerTarget&&contentSource&&contentSource.targetKey===containerTarget.key?contentSource:null;
  const candidate = environment.contents.find((entry: any) => entry.index === contentIndex);
  const contentCount = Math.min(contentQuantity, candidate?.count ?? 1);
  const currentLoot=containerTarget?containerLootPreview(battle,unit,containerTarget,contentIndex,contentCount):null;
  const sourceMatches=selectedSource&&selectedSource.expectedSource===currentLoot?.action.expectedSource;
  const content=sourceMatches?candidate:null;
  const containerLoot=currentLoot&&containerTarget?(selectedSource
    ?containerLootPreview(battle,unit,containerTarget,contentIndex,contentCount,selectedSource.expectedSource)
    :{...currentLoot,valid:false,reason:'Seleccioná un objeto del cofre.'}):null;
  // Pin the first disclosed item when a container is opened or selected.
  // Ordinary state updates never repin a changed or removed stack.
  useEffect(()=>{
    const first=containerTarget?environment.contents[0]:null,preview=first&&containerTarget?containerLootPreview(battle,unit,containerTarget,first.index,1):null;
    setContentIndex(first?.index??0);setContentQuantity(1);
    setContentSource(containerTarget&&preview?.action.expectedSource?{targetKey:containerTarget.key,expectedSource:preview.action.expectedSource}:null);
  },[unit.id,containerTarget?.key,containerOpen]);
  const [itemOpen,setItemOpen]=useState(false);
  const chooseItem = (id: string,slotId='') => {
    setManagedItem(id);setInspectedSlot(slotId);setQuantity(1);setItemOpen(true);
    let selection:{key:string;expectedSource:string}|null=null;
    if(id.startsWith('inventory:'))try{const key=id.slice(10);selection={key,expectedSource:fieldDressingsSource(unit,key)};}catch{}
    setDressingsSelection(selection);
  };
  useEffect(() => { setManagedItem(''); setInspectedSlot('');setDressingsSelection(null); setQuantity(1); setRecipient(''); setLootId(''); setLootQuantity(1); setEnvironmentKey(''); setEnvironmentVerb(''); setContentIndex(0); setContentQuantity(1); setItemOpen(false); }, [unit.id]);
  const packedShirt=inv.backpack.find((record:any)=>`inventory:${record.key}`===managedItem&&record.outfit==='linen_shirt');
  const wornShirt=['headwear','outfit','legwear'].includes(managedItem)&&unit[managedItem]?.outfit==='linen_shirt';
  const dressings=packedShirt?fieldDressingsPreview(battle,unit,packedShirt.key,dressingsSelection?.expectedSource):null;
  const dressingsReason=wornShirt?'Guardá la camisa de lino en un bolsillo antes de preparar vendas.':dressings?.reason||
    (packedShirt&&dressingsSelection?.key!==packedShirt.key?'Seleccioná la camisa de lino de nuevo.':'');
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const editing = Boolean((e.target as HTMLElement)?.closest('input,select,textarea,[contenteditable]:not([contenteditable="false"]),[role="textbox"]'));
      if (!e.defaultPrevented && e.key === 'Escape' && !e.repeat && !e.ctrlKey && !e.metaKey && !editing) { e.preventDefault(); onCloseInventory(); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onCloseInventory]);
  const movementActive = (id: string) => unit.movementMode === id;
  const otherHand=swapHandsPreview(battle,unit);
  const holdMain=item?mainItemPreview(battle,unit,item.item):null;
  const holdSecond=item?equipLootPreview(battle,unit,item.item,'offhandItem'):null;
  const stowSecond=equipLootPreview(battle,unit,null,'offhandItem');
  return (
    <EquipmentInteractionProvider key={unit.id}><div className="ja2-inventory" role="region" aria-label="Equipo y órdenes del combatiente">
      <div className="ja2-inv-header">
        <button className={`portrait ja2-inventory-portrait ${unit.hp<=0?'dead':''}`} aria-label={`${unit.name}${unit.hp<=0?' · muerto':''}. Botón derecho: cerrar equipo`} onContextMenu={event=>{event.preventDefault();onCloseInventory();}}>{unit.hp<=0?<><Skull className="ja2-dead-skull" aria-hidden="true"/><span className="ja2-portrait-blood" aria-hidden="true"/></>:portraitFor(unit.portraitId ?? unit.id) ? <img src={sitePath(portraitFor(unit.portraitId ?? unit.id)!)} alt={unit.name} /> : <span>{short(unit).slice(0, 2).toUpperCase()}</span>}</button>
        <div><h2>{short(unit)}</h2><span>{unit.mounted ? 'Granadero a caballo' : 'Ejército patriota'} · Nivel {levelFor(unit)}</span></div>
        <nav className="ja2-inventory-paging" aria-label="Combatiente del inventario"><button disabled={busy||inventoryUnits.length<2} aria-label="Combatiente anterior" onClick={()=>navigateInventory(-1)}>←</button><span>{inventoryIndex+1}/{inventoryUnits.length}</span><button disabled={busy||inventoryUnits.length<2} aria-label="Combatiente siguiente" onClick={()=>navigateInventory(1)}>→</button></nav>
        {!vitals.dead&&<div className="ja2-inventory-vitals" aria-label="Salud, energía y moral"><span title={`Salud ${Math.ceil(unit.hp)}/${unit.maxHp} · heridas vendadas ${vitals.bandaged} · sin tratar ${vitals.untreated}`}><i className="untreated" style={{width:'100%'}}/><i className="bandaged" style={{width:`${Math.min(100,vitals.hpPct+vitals.bandaged/unit.maxHp*100)}%`}}/><i className="health" style={{width:`${vitals.hpPct}%`}}/></span><span title={`Energía ${Math.round(unit.energy??100)}/${maximumEnergy(unit)}`}><i className="energy" style={{width:`${Math.max(0,Math.min(100,unit.energy??100))}%`}}/></span><span title={`Moral ${Math.round(unit.morale??0)}%`}><i className="morale" style={{width:`${vitals.moralePct}%`}}/></span></div>}
<details className="ja2-inventory-extra"><summary>Postura y órdenes</summary><div className="ja2-inventory-popup">      <div className="ja2-stance-grid">
        <div>
          {MOVEMENT.map(([id, label]) => { const targetStance = id === 'prone' ? 'prone' : id === 'crouch' ? 'crouched' : 'standing'; const pa = battle.mode === 'exploration' ? 0 : stanceCost(unit, targetStance); return <button key={id} className={movementActive(id) ? 'active' : ''} aria-pressed={movementActive(id)} aria-label={`Cambiar a ${label}: ${battle.mode === 'exploration' ? 'sin PA' : `${pa} PA`}`} disabled={busyDisabled || unit.knockedDown || (unit.mounted && ['prone', 'crouch'].includes(id)) || (battle.mode !== 'exploration' && unit.ap < pa)} onClick={() => onOrder(orderAction(battle, unit, {movement: id}, 'movement'))}>{label} · {pa} PA</button>; })}
        </div>
        <div>
          <button disabled={def('stealth')?.disabled} aria-pressed={Boolean(unit.stealthMode)} className={unit.stealthMode ? 'active' : ''} title="Consume más PA al moverse y reduce el ruido. No cambia la postura." onClick={() => onOrder(orderAction(battle, unit, {}, 'stealth'))}>Sigilo · {unit.stealthMode ? 'Sí' : 'No'}</button>
          <button className={showSight ? 'active' : ''} aria-pressed={showSight} disabled={busyDisabled} onClick={onToggleSight}>{showSight ? 'Ocultar' : 'Mostrar'} campo de visión</button>
          {STANCE_IDS.map(id => { const d = def(id); if (!d) return null; return <button key={id} disabled={d.disabled} aria-label={d.label} title={id==='repair'?d.detail:undefined} onClick={() => { if (d.kind === 'mode') onMode(id); else onOrder(id==='repair'?d.action:orderAction(battle, unit, {}, id)); }}>{d.label}{d.pa !== undefined ? ` · ${cost(d.pa)}` : ''}</button>; })}
          {def('repair')?.detail && <small>{def('repair')?.detail}</small>}
        </div>
      </div>
</div></details>      </div>
      {battle.upperSurfaces?.length>0&&<div className="ja2-elevation-controls" role="group" aria-label="Altura y accesos">
        {onCursorLevelChange&&<InventoryCursorLevel level={cursorLevel} onChange={onCursorLevelChange}/>}
        <span>Combatiente: {tacticalLevel(unit)===0?'Suelo':'Nivel superior'}</span>
        {accessStepsFrom(battle,unit).map((step:any)=>{const preview=climbPreview(battle,unit,{linkId:step.linkId});return <span key={step.linkId}><button className="line-button" disabled={busy||!preview.valid} title={preview.reason||undefined} onClick={()=>onOrder({type:'climb',linkId:step.linkId})}>{tacticalLevel(step)>tacticalLevel(unit)?'Subir':'Bajar'}{preview.pa>0?` · ${cost(preview.pa)}`:''}</button>{preview.reason&&<small>{preview.reason}</small>}</span>;})}
      </div>}
      <div className="ja2-stats">
        {inv.stats.map((st: any) => <div key={st.id}><span>{st.label}</span><b>{st.value}</b></div>)}
        <div className="inventory-health"><span>Salud</span><b>{unit.hp<=0?'Muerto':`${Math.ceil(unit.hp)} / ${unit.maxHp}`}</b></div>
        {battle.mode !== 'exploration' && <div><span>Puntos de acción</span><b>{unit.ap} / {inv.currentAPLimit}</b></div>}
        <div><span>Postura</span><b>{stanceLabel(unit.stance)}</b></div>
        <div><span>Orientación</span><b>{facingLabel(unit)}</b></div>
        <div><span>Energía</span><b>{Math.round(unit.energy ?? 100)} / {maximumEnergy(unit)}</b></div>
        <div className="ja2-mobile-weight"><span>Peso</span><b>{inv.weight.toFixed(1)} / {inv.capacity.toFixed(1)} kg</b></div>
        <div><span>Moral</span><b>{unit.hp<=0?'—':`${Math.round(unit.morale ?? 0)}%`}</b></div>
        {isolation.reason !== 'ability' && <>
          <div><span>Tensión actual</span><b>{shockFormat.format(unit.shock ?? 0)}</b></div>
          <p role="status" aria-label="Temor al aislamiento"><b>Temor al aislamiento.</b> {isolationText}</p>
        </>}
<details className="ja2-inventory-extra"><summary>Más detalles</summary><div className="ja2-inventory-popup">        <div><span>Carga / capacidad</span><b>{inv.weight.toFixed(1)} / {inv.capacity.toFixed(1)} kg</b></div>
        <div><span>Espacio del equipo</span><b>{inv.pockets.used ?? '—'} / {inv.pockets.capacity}</b></div>
        {inv.pockets.overloaded && <p className="danger-text">Falta espacio en el equipo. Soltá o entregá objetos antes de recibir más.</p>}
        <div><span>Moral</span><b>{Math.round(unit.morale)}%</b></div>
        <div><span>Estado del mecanismo</span><b>{unit.condition}%</b></div>
        {hasFirearm(unit) && <div><span>Riesgo de chispa fallida</span><b>{Math.round(ignitionRisk(battle, unit))}%</b></div>}
        {unit.knockedDown && <p className="danger-text">Derribado: ponerse de pie · {cost(12)}.</p>}
        {unit.braced && <p>Bayoneta calada: espera una carga.</p>}
        {unit.bleeding > 0 && <p className="danger-text">Hemorragia: −{unit.bleeding} salud / turno</p>}
        {unit.bandaged > 0 && <p>Heridas vendadas: {Math.ceil(unit.bandaged)}. Requieren tratamiento en campaña.</p>}
        <p>Las vendas reducen la hemorragia y estabilizan heridas críticas hasta 15 de salud. Se puede atender a un aliado inconsciente.</p>
        <section className="ja2-auto-bandage" aria-label="Vendaje de los heridos">
          <button className="line-button" disabled={busy || !onAutoBandage || !bandaging.available} title={bandaging.reason || 'Los sanitarios atienden a la escuadra y a los civiles heridos a la vista con sus propias vendas.'} onClick={onAutoBandage}>Vendar heridos</button>
          <p>Atiende a la escuadra y a los civiles heridos a la vista. Usa tiempo, fuerzas y vendas de los sanitarios. Puede necesitar varias vendas por herido. Se detiene ante peligro. La recuperación completa requiere atención en campaña.</p>
          {bandaging.reason && <p>{bandaging.reason}</p>}
          {bandageReport && <div role="status"><p>{bandageReport.treatedIds.length} atendidos · {bandageReport.elapsedSeconds} s.</p>{bandageReport.untreated.length > 0 ? <ul>{bandageReport.untreated.map((patient: any) => <li key={patient.id}>{patient.name}: {patient.reason}</li>)}</ul> : <p>Todas las heridas están vendadas.</p>}</div>}
        </section>
        {battle.mode !== 'exploration' && <p>Se conservan hasta {AP_CARRY_LIMIT} PA. Reserva posible: {inv.apBudget.carryover}. Las heridas y el cansancio reducen los PA del turno.</p>}
        <TrainingProgress unit={unit} />
</div></details>      </div>
      <div className="paper-doll">
        <JA2OutfitSlot battle={battle} unit={unit} disabled={busyDisabled} onPick={chooseItem} onOrder={onOrder}/>
        <JA2Hands battle={battle} unit={unit} busy={busy} onOrder={onOrder} onPick={chooseItem}/>
<details className="ja2-inventory-extra"><summary>Cargas y accesorios</summary><div className="ja2-inventory-popup">
        <AmmunitionLoadChoice unit={unit} disabled={busyDisabled} unloadCost={battle.mode==='exploration'?' · 1 s':' · 4 PA'} onUnload={()=>onOrder({type:'unloadAmmunition',unitId:unit.id})} onSelect={family=>onOrder({type:'selectAmmunitionLoad',unitId:unit.id,family})}/>
        {unit.leftHandItem!=null&&<button className="line-button ja2-stow-hand" disabled={busyDisabled||!stowSecond.valid} title={stowSecond.reason||undefined} onClick={()=>onOrder({type:'equipLoot',slot:'offhandItem',inventoryKey:null})}>Guardar objeto de segunda mano · {battle.mode==='exploration'?'sin PA':'4 PA'}</button>}
        <JA2WeaponMode battle={battle} unit={unit} busy={busy} onOrder={onOrder} onMode={onMode}/>
        <div className="ja2-hand-management">{inv.items.filter((entry: any) => ['primary', 'blade', 'offhand'].includes(entry.item)).map((entry: any) => <button key={entry.item} className="line-button" disabled={busyDisabled} aria-pressed={item?.item === entry.item} onClick={() => chooseItem(entry.item)}>Dar o soltar {entry.label}</button>)}</div>
        <AttachedBayonetControl freeActions={battle.mode==='exploration'} attached={inv.fittings.attached} busy={busyDisabled} onOrder={onOrder}/>
        <LooseBayonetControl freeActions={battle.mode==='exploration'} source={inv.fittings.sources.find((source: any) => source.item === 'blade')} busy={busyDisabled} onOrder={onOrder}/>
</div></details>        <div className="paper-readouts">
          <span className="weight"><small>Peso</small><b>{inv.weight.toFixed(1)} / {inv.capacity.toFixed(1)} kg</b></span>
        </div>
      </div>
      <div className="slot-grid">
        <JA2Pockets key={unit.id} battle={battle} unit={unit} layout={inv.pockets} disabled={busyDisabled} onPick={chooseItem} onOrder={onOrder}/>

      </div>
      <details className="pertrechos ja2-inventory-extra" open={itemOpen} onToggle={event=>setItemOpen(event.currentTarget.open)}><summary>{item?.label || 'Objeto'} · detalles</summary><div className="ja2-inventory-popup"><button className="line-button" onClick={()=>setItemOpen(false)}>Cerrar objeto</button>{itemOpen&&<JA2ItemCard battle={battle} unit={unit} reference={item?.item??''} slotId={inspectedSlot} disabled={busyDisabled} onOrder={onOrder}/>}        {managedItem==='offhand'&&<button disabled={busyDisabled||!otherHand.valid} title={otherHand.reason||undefined} onClick={()=>{onOrder({type:'swapHands'});onMode('move');}}>Poner {item?.label} en mano · {cost(otherHand.pa)}</button>}
        {['primary','blade'].includes(managedItem)&&equipped.filter((option:any)=>option.slot===managedItem).map((option:any)=><button key={option.slot} disabled={option.disabled||option.active} title={option.reason||undefined} onClick={()=>{onOrder(option.action);onMode('move');}}>Poner {item?.label} en mano · {cost(option.pa)}</button>)}
        {inv.backpack.filter((record:any)=>`inventory:${record.key}`===managedItem).map((item: any) => {
          const gun = (WEAPONS as any)[item.weapon];
          const blade = (BLADES as any)[item.weapon];
          const outfitEquip = item.kind==='outfit' ? equipLootPreview(battle,unit,item.key,outfitSlot(item)) : null;
          const primaryEquip = equipLootPreview(battle, unit, item.key, 'primary');
          const bladeEquip = blade ? equipLootPreview(battle, unit, item.key, 'blade') : null;
          const offHandEquip = gun && !blade && handsRequired(item.weapon)===1 ? equipLootPreview(battle,unit,item.key,'offhand') : null;
          const tool = inv.tools.find((entry: any) => entry.key === item.key);
          return (
            <div key={item.key} className={`slot-cell ${item.equippable ? 'equippable' : ''}`}>
              <span>{item.name ?? 'Pertrechos'} · {item.count}{gun ? ` · ${item.loaded || 0} carga(s)` : ''}{item.condition !== undefined ? ` · estado ${item.condition}%` : ''}</span>
              <FittingReadout fitting={item.fittings?.bayonet}/>
              <LooseBayonetControl freeActions={battle.mode==='exploration'} source={inv.fittings.sources.find((source: any) => source.item === `inventory:${item.key}`)} busy={busyDisabled} onOrder={onOrder}/>
              {outfitEquip && <button className="line-button" disabled={busyDisabled || !outfitEquip.valid} title={outfitEquip.reason || undefined} onClick={()=>onOrder(backpackEquipAction(item.key,outfitSlot(item)))}>Ponerse vestimenta · {battle.mode==='exploration'?'sin PA':`${outfitEquip.pa} PA`}</button>}
              {(gun || blade) && <>
                <button className="line-button" disabled={busyDisabled || !primaryEquip.valid} title={primaryEquip.reason || undefined} onClick={() => onOrder(backpackEquipAction(item.key, 'primary'))}>Equipar principal · {cost(primaryEquip.pa)}</button>
                {offHandEquip && <button className="line-button" disabled={busyDisabled || !offHandEquip.valid} title={offHandEquip.reason||undefined} onClick={()=>onOrder(backpackEquipAction(item.key,'offhand'))}>Equipar segunda mano · {cost(offHandEquip.pa)}</button>}
                {bladeEquip && <button className="line-button" disabled={busyDisabled || !bladeEquip.valid} title={bladeEquip.reason || undefined} onClick={() => onOrder(backpackEquipAction(item.key, 'blade'))}>Equipar secundaria · {cost(bladeEquip.pa)}</button>}
              </>}
              {tool && <button className="line-button" disabled={slotDisabled('tool') || tool.active} aria-pressed={tool.active} onClick={() => { onOrder({type: 'weapon', slot: 'tool', toolKey: tool.item}); onMode('move'); }}>Equipar herramienta · {cost(def('weapon')?.pa)}</button>}
              <button className="line-button" disabled={busyDisabled || item.count < 1} aria-pressed={managedItem === `inventory:${item.key}`} onClick={() => chooseItem(`inventory:${item.key}`)}>Dar o soltar</button>
            </div>
          );
        })}


        {(packedShirt||wornShirt)&&<div className="ja2-item-handling" aria-label="Preparación de vendas">
          <p>Consume una camisa de lino guardada para obtener 3 vendas. No cura heridas.</p>
          <button className="line-button" disabled={busyDisabled||!dressings?.valid||Boolean(dressingsReason)} title={dressingsReason||undefined}
            onClick={()=>{if(packedShirt&&dressingsSelection&&dressings?.valid&&!dressingsReason)onOrder({type:'craftDressings',inventoryKey:packedShirt.key,expectedSource:dressingsSelection.expectedSource});}}>Preparar vendas · {cost(dressings?.pa??FIELD_DRESSINGS_AP)}</button>
          {dressingsReason&&<p role="status">{dressingsReason}</p>}
        </div>}
        <div className="ja2-item-handling" aria-label="Dar o soltar equipo">
          <label>Objeto<select aria-label="Objeto para dar o soltar" disabled={busyDisabled || !inv.items.length} value={item?.item || ''} onChange={event => chooseItem(event.target.value)}>{!item && <option value="">{inv.items.length?'Elegir objeto':'Sin objetos'}</option>}{inv.items.map((entry: any) => <option key={entry.item} value={entry.item}>{entry.label} · {entry.count}</option>)}</select></label>
          <label>Cantidad<input aria-label="Cantidad de objetos" type="number" min="1" step="1" max={item?.count || 1} disabled={busyDisabled || !item} value={count} onChange={event => setQuantity(Number(event.target.value))} /></label>
          <label>Destinatario<select aria-label="Aliado que recibe el equipo" disabled={busyDisabled} value={recipient} onChange={event => setRecipient(event.target.value)}><option value="">Elegir aliado</option>{handling.recipients.map((target: any) => <option key={target.id} value={target.id} disabled={target.unconscious}>{target.nickname || target.name}{target.unconscious ? ' · inconsciente' : ''}</option>)}</select></label>
          {holdMain?.valid&&<button className="line-button" disabled={busyDisabled} onClick={()=>onOrder(holdMain.action)}>Poner en mano principal · {cost(holdMain.pa)}</button>}
          {item&&(!item.weapon||typeof item.weapon!=='number')&&!['headwear','outfit','legwear'].includes(item.item)&&!['primary','blade','offhand'].includes(item.item)&&<button className="line-button" disabled={busyDisabled||!holdSecond?.valid} title={holdSecond?.reason||undefined} onClick={()=>onOrder({type:'equipLoot',slot:'offhandItem',inventoryKey:item.item})}>Poner en segunda mano · {battle.mode==='exploration'?'sin PA':'4 PA'}</button>}
          <button className="line-button" disabled={handling.transfer.disabled} title={handling.transfer.reason || undefined} onClick={() => onOrder(handling.transfer.action)}>{handling.transfer.label}{recipient ? ` · ${cost(handling.transfer.totalPA)}${handling.transfer.kind === 'relay' ? ' en total' : ''}` : ''}</button>
          <button className="line-button" disabled={handling.drop.disabled} title={handling.drop.reason || undefined} onClick={() => onOrder({type: 'drop', item: item.item, count})}>Soltar aquí · {cost(handling.drop.pa)}</button>
        </div>
        <p className="ja2-item-feedback" aria-live="polite">{item && `${item.label} · ${item.count} disponible(s). `}{item?.condition !== undefined && `Estado ${item.condition}%. `}{item?.loaded !== undefined && `${item.loaded} carga(s). `}{item?.jammed && 'Necesita cebado. '}{recipient ? handling.transfer.reason || handling.transfer.detail : 'Elegí un aliado para entregar equipo. Soltar deja el objeto en tu casilla.'}{handling.drop.reason && ` ${handling.drop.reason}`}</p>
        <details className="ja2-nearby-loot"><summary>Objetos cercanos · {nearby.length}</summary>{nearby.length ? <>
          <div className="ja2-item-handling">
            <label>Objeto cercano<select aria-label="Objeto cercano para recoger" disabled={busyDisabled} value={lootItem?.id || ''} onChange={event => { setLootId(event.target.value); setLootQuantity(1); }}>{nearby.map(entry => <option key={entry.id} value={entry.id}>{entry.source} · {entry.label} · {entry.count}</option>)}</select></label>
            <label>Cantidad<input aria-label="Cantidad para recoger" type="number" min="1" step="1" max={lootItem?.count || 1} disabled={busyDisabled} value={lootCount} onChange={event => setLootQuantity(Number(event.target.value))} /></label>
            <button className="line-button" disabled={busyDisabled || !loot.valid} title={loot.reason || undefined} onClick={() => onOrder({...lootItem.action, count: lootCount})}>Recoger · {cost(loot.pa)}</button>
          </div>
          <p className="ja2-item-feedback">{lootItem?.condition !== undefined && `Estado ${lootItem.condition}%. `}{lootItem?.loaded !== undefined && `${lootItem.loaded} carga(s). `}{lootItem?.jammed && 'Necesita cebado. '}{loot.reason || 'Solo se recoge la cantidad indicada.'}</p>
        </> : <p>Acercate a un cuerpo o a un objeto visible en el suelo.</p>}</details>
        <JA2EnvironmentPanel targets={environment.targets} selected={environment.target?.key || ''} target={environment.target} preview={environment.preview} verbs={environment.verbs} verb={environmentVerb} busy={busyDisabled} contents={environment.contents} contentIndex={content?.index ?? -1} count={contentCount} loot={containerLoot}
          onTarget={key => { setEnvironmentKey(key); setEnvironmentVerb(''); setContentIndex(0); setContentQuantity(1); }} onVerb={setEnvironmentVerb} onUse={() => environment.preview && onOrder(environment.preview.action)}
          onContent={index => { if(!containerTarget)return;const preview=containerLootPreview(battle,unit,containerTarget,index,1);setContentIndex(index);setContentQuantity(1);setContentSource(preview.action.expectedSource?{targetKey:containerTarget.key,expectedSource:preview.action.expectedSource}:null); }} onCount={setContentQuantity} onLoot={() => containerLoot?.valid && onOrder(containerLoot.action)} />
      </div></details>
      <div className="ja2-right">
        <InventoryRadarCluster battle={battle} units={units} selected={selected} project={project} vw={vw} vh={vh} cameraRect={cameraRect} zoom={zoom} mode={mode} missionAllies={missionAllies} localMilitia={localMilitia} onSelect={onSelect} onRetreat={onRetreat} onCameraCenter={onCameraCenter} onCameraPan={onCameraPan} onZoom={onZoom} />
        <button className="ja2-done gold-button" onClick={onCloseInventory}>Listo</button>
      </div>
    </div></EquipmentInteractionProvider>
  );
}
