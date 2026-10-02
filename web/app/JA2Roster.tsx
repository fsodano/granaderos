'use client';
import {sitePath} from '../lib/site-path.js';
import {memo,useEffect,useMemo,useRef,useState} from 'react';
import {maximumEnergy} from '../../game/fatigue.js';
// Every deployed squad remains accessible in the portrait strip.
// Pure read model (game/ja2-hud.js rosterCells); all mutations are caller-provided callbacks.
import {rosterCells} from '../../game/ja2-hud.js';
import {rosterHands} from '../../game/roster-hands.js';
import {Package,Flame,Utensils,Cross,Gem,CircleDot,Link,KeyRound,Wrench,Hammer,Scissors,Shirt,Hand,Ban} from 'lucide-react';
import {portraitFor} from '../lib/portraits';

type Props = {battle?: any; players: any[]; selected: any; groupIds?: string[]; medicalTargeting?: boolean; onSelect: (id: any, additive?: boolean) => void; onOpenInventory: (id: any) => void};
const short = (u: any) => u.nickname || String(u.name || '').split(' ').slice(-1)[0] || '';
const handIcons:Record<string,any>={ammo:Package,rations:Utensils,medical:Cross,boleadoras:Link,torch:Flame,key:KeyRound,lockpick:Wrench,crowbar:Hammer,pliers:Scissors,outfit:Shirt,item:Package,empty:Hand,blocked:Ban};

export function StableJA2Roster(props:Props) {
  // Camera and walking updates replace parent callbacks. Keep their current
  // behavior without rebuilding portraits and inventory descriptions each frame.
  const handlers=useRef(props);handlers.current=props;
  const callbacks=useMemo(()=>({onSelect:(id:any,additive?:boolean)=>handlers.current.onSelect(id,additive),onOpenInventory:(id:any)=>handlers.current.onOpenInventory(id)}),[]);
  return <MemoizedRoster {...props} {...callbacks}/>;
}
export default function JA2Roster({battle, players, selected, groupIds = [], medicalTargeting = false, onSelect, onOpenInventory}: Props) {
  const all = rosterCells(players, selected, battle);
  const [page,setPage] = useState(()=>Math.floor(Math.max(0,all.findIndex((cell:any)=>cell.active))/6));
  const pageCount = Math.max(1,Math.ceil(all.length/6));
  const currentPage = Math.min(page,pageCount-1);
  const selectedIndex=players.findIndex(p=>p.id===selected);
  useEffect(()=>{if(selectedIndex>=0)setPage(Math.floor(selectedIndex/6));},[selectedIndex]);
  const cells = all.slice(currentPage*6,currentPage*6+6);
  while(cells.length<6)cells.push({empty:true});
  const exploring=battle?.mode==='exploration';
  return (
    <div className="ja2-roster-pages"><div className="ja2-roster" role="list" aria-label="Escuadra táctica">
      {cells.map((cell: any, i: number) => {
        if (cell.empty) return <div className="empty-portrait-slot" key={`empty-${i}`} aria-hidden="true"><span>—</span></div>;
        const u = cell.unit;
        const portrait = cell.portrait || portraitFor(u.portraitId ?? u.id);
        const hands = rosterHands(u);
        return (
          <button
            key={u.id}
            role="listitem"
            className={`ja2-portrait-cell ${cell.active ? 'active' : ''} ${cell.fallen ? 'fallen' : ''} ${cell.interruptReady ? 'interrupt-ready' : ''} ${groupIds.includes(u.id) ? 'group-selected' : ''}`}
            aria-disabled={medicalTargeting ? u.hp <= 0 || u.routed : cell.disabled}
            aria-label={`${cell.index + 1}. ${u.name}. ${u.unconscious ? 'Inconsciente' : cell.fallen ? 'Fuera de combate' : `Salud ${Math.ceil(u.hp)}, ${exploring ? '' : `${u.ap} puntos de acción, `}energía ${Math.round(u.energy ?? 100)}`}${cell.bleeding ? `. Hemorragia: ${cell.bleeding} salud por turno` : ''}${cell.interruptReady ? '. Puede actuar en la interrupción' : ''}${groupIds.includes(u.id) ? '. En el grupo de marcha' : ''}. ${hands.map((hand:any)=>hand.description).join(' ')} Botón derecho: equipo del combatiente`}
            onClick={event => {if(!(medicalTargeting ? u.hp <= 0 || u.routed : cell.disabled))onSelect(u.id, event.shiftKey);}}
            onDoubleClick={() => { if (!medicalTargeting) onOpenInventory(u.id); }}
            onContextMenu={(e) => { e.preventDefault(); onOpenInventory(u.id); }}
          >
            <span className="ja2-portrait-face">{portrait ? <img src={sitePath(portrait)} alt="" /> : <span className="portrait-fallback">{short(u).slice(0, 2).toUpperCase()}</span>}{cell.bleeding > 0 && <span className="ja2-bleeding-mark" title={`Hemorragia: ${cell.bleeding} salud por turno`}>−{cell.bleeding} SAL</span>}</span>
            <span className="portrait-name"><b>{cell.index + 1}</b> {cell.label}</span>
            {groupIds.includes(u.id) && <span className="ja2-group-tag">En el grupo</span>}
            <span className="ja2-vitals">
              <span title={`Salud: ${Math.ceil(u.hp)}/${u.maxHp}. Heridas vendadas: ${cell.bandaged}. Hemorragia: ${cell.bleeding}.`}><i className="bandaged" style={{height: `${Math.min(100, cell.hpPct + cell.bandaged / u.maxHp * 100)}%`}} /><i className="health" style={{height: `${cell.hpPct}%`}} /></span>
              {!exploring && <span title="Puntos de acción"><i className="action" style={{height: `${cell.apPct}%`}} /></span>}
              <span title={`Energía ${Math.round(u.energy??100)}/${maximumEnergy(u)} · la fatiga limita la recuperación`}><i className="energy" style={{height: `${Math.max(0, Math.min(100, u.energy ?? 100))}%`}} /></span>
            </span>
            <span className="ja2-roster-hands" aria-hidden="true">{hands.map((hand:any)=>{
              const Icon=handIcons[hand.icon]??Package;
              return <span key={hand.side} className={`ja2-roster-hand ${hand.blocked?'blocked':hand.item?'held':'empty'}`} data-hand-side={hand.side} data-hand-item={hand.item??''} data-close-combat={hand.closeCombat} data-attachment={hand.attached} title={hand.description}>
                {hand.weapon?<img src={sitePath(hand.art??`/art/weapon-${hand.weapon}.png`)} alt="" draggable={false}/>:<Icon size={16} strokeWidth={1.7}/>}
                {hand.loaded!==undefined&&<small className="roster-hand-load">{hand.loaded}</small>}
                {(hand.closeCombat||hand.attached)&&<span className="roster-hand-status">{hand.closeCombat&&<b className="close-combat">*</b>}{hand.attached&&<b className="attachment">*</b>}</span>}
              </span>;
            })}</span>
            <span className="portrait-numbers">{u.unconscious ? 'Inconsciente' : cell.fallen ? 'Fuera de combate' : `${Math.ceil(u.hp)} SAL · ${exploring ? '' : `${u.ap} PA · `}${Math.round(u.energy ?? 100)} EN`}</span>
          </button>
        );
      })}
    </div>{pageCount>1 && <nav className="ja2-roster-paging" aria-label="Páginas de combatientes"><button aria-label="Combatientes anteriores" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>←</button><span>{currentPage+1} / {pageCount}</span><button aria-label="Combatientes siguientes" disabled={currentPage+1>=pageCount} onClick={()=>setPage(currentPage+1)}>→</button></nav>}</div>
  );
}
const MemoizedRoster=memo(JA2Roster);
