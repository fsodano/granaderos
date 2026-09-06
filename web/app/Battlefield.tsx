'use client';
import TacticalScene from './TacticalScene';
import {tacticalCamera} from '../../game/tactical-camera.js';
import JA2Strip from './JA2Strip';
import './tactical-hud.css';
import {TACTICAL_KEYS,tacticalShortcut} from '../../game/hotkeys.js';
import { useEffect, useMemo, useState, useRef } from 'react';
import { useUnitMotion } from './useUnitMotion';
import { ChevronRight } from 'lucide-react';
import { actBattle, endTurn, getReachable, weaponFor, hasFirearm, bladeFor, actionCosts, artilleryCosts, visibleEnemies, visibleTiles, visibleRooms, canSee } from '../../game/tactical.js';

type Props = {battle:any; onChange:(s:any)=>void; onFinish:()=>void; onRetreat:()=>void; onMap?:()=>void; onMissionFinish?:()=>void; mission?:any; conversation?:any; quests?:any; onTalk?:(npcId:string,approach:string,unitId:string)=>void};
const isAlive=(u:any)=>u.hp>0&&!u.routed&&!u.unconscious;
export default function Battlefield({battle:s,onChange,onFinish,onRetreat,conversation,onTalk,onMap,quests,onMissionFinish,mission}:Props){
  const motion=useUnitMotion(s);
  const fieldRef=useRef<SVGSVGElement>(null);
  const [fieldSize,setFieldSize]=useState({width:960,height:540});
  useEffect(()=>{
    const field=fieldRef.current;if(!field)return;
    const observer=new ResizeObserver(([entry])=>{const {width,height}=entry.contentRect;if(width>0&&height>0)setFieldSize({width,height});});
    observer.observe(field);return()=>observer.disconnect();
  },[]);
  const [keyHelp,setKeyHelp]=useState(false);
  const [talking,setTalking]=useState<any>(null);
  const [showSight,setShowSight]=useState(false);
  const [selected,setSelected]=useState(s.units.find((u:any)=>u.side==='player')?.id);
  const [poses,setPoses]=useState<Record<string,string>>({});const [directions,setDirections]=useState<Record<string,number>>({});const [zoom,setZoom]=useState(2);const [cameraOffset,setCameraOffset]=useState({x:0,y:0});const [cameraFollowsSelection,setCameraFollowsSelection]=useState(false);const cameraSelection=useRef(selected);const [inventoryId,setInventoryId]=useState<string|null>(null);const [mode,setMode]=useState('move');const [aim,setAim]=useState(0);const [hover,setHover]=useState<any>(null);const [turnBusy,setBusy]=useState(false);const busy=turnBusy||motion.moving;
  const u=s.units.find((u:any)=>u.id===selected);const players=s.units.filter((u:any)=>u.side==='player');const enemies=visibleEnemies(s);const renderedUnits=s.units.filter((v:any)=>v.side==='player'||players.some((p:any)=>canSee(s,p,v)));const sight=new Set<string>(u?visibleTiles(s,u).map((t:any)=>`${t.x},${t.y}`):[]);
  const revealedBuildingRooms=useMemo(()=>new Set<string>([...(s.revealedRooms||[]),...visibleRooms(s)]),[s]);
  const hiredPlayers=players.filter((p:any)=>!p.militia&&!p.missionAlly),missionAllies=players.filter((p:any)=>p.missionAlly),localMilitia=players.filter((p:any)=>p.militia);
  const reachable=useMemo(()=>u?getReachable(s,u):[],[s,u]);
  const costs=u?actionCosts(s,u):null;const weapon=u?weaponFor(u):null;const firearm=u&&hasFirearm(u);const [cannonId,setCannonId]=useState('');const [shotType,setShotType]=useState('solid');const gun=s.artillery?.find((g:any)=>g.id===cannonId);const gunCosts=u&&gun?artilleryCosts(s,u,gun):null;
  const order=(a:any)=>{if(!u||busy)return;const next=actBattle(s,{unitId:selected,aim,...a});if(!next.lastError){const target=s.units.find((t:any)=>t.id===a.targetId)||a;if(Number.isFinite(target.x)&&Number.isFinite(target.y))setDirections(d=>({...d,[selected]:(Math.round(Math.atan2((target.x-u.x)-(target.y-u.y),-((target.x-u.x)+(target.y-u.y)))/(Math.PI/4))+8)%8}));const pose=a.type==='fire'?'fire':['reload','reprime','repair'].includes(a.type)?'reload':['melee','charge'].includes(a.type)?'strike':'idle';setPoses(p=>({...p,[selected]:pose}));setTimeout(()=>setPoses(p=>({...p,[selected]:'idle'})),1000);}onChange(next);};
  function nextTurn(){if(busy||s.status!=='active')return;setBusy(true);setTimeout(()=>{onChange(endTurn(s));setBusy(false);},450);}
  useEffect(()=>{if(!u||!isAlive(u))setSelected(players.find(isAlive)?.id);},[s]);
  useEffect(()=>{const key=(e:KeyboardEvent)=>{
    const editing=Boolean((e.target as HTMLElement)?.closest('input,select,textarea,[contenteditable]:not([contenteditable="false"]),[role="textbox"]'));
    if(talking&&e.key==='Escape'&&!e.ctrlKey&&!e.metaKey&&!e.repeat){e.preventDefault();setTalking(null);return;}
    if(keyHelp&&e.key==='Escape'&&!e.ctrlKey&&!e.metaKey){e.preventDefault();setKeyHelp(false);return;}
    const nativeControl=Boolean((e.target as HTMLElement)?.closest('button,a,summary,[role="button"]'));
    const shortcut=tacticalShortcut(e,{editing,nativeControl,dialog:talking!==null||Boolean(document.querySelector('[role="dialog"],dialog[open]'))});
    if(!shortcut)return;e.preventDefault();
    if(shortcut==='help'){setKeyHelp(v=>!v);return;}if(keyHelp)return;
    if(shortcut==='cancel'){setMode('move');return;}
    if(shortcut==='sight'){setShowSight(v=>!v);return;}
    if(shortcut==='zoom-in'||shortcut==='zoom-out'){setZoom(v=>Math.max(1,Math.min(3,v+(shortcut==='zoom-in'?1:-1))));return;}
    if(busy||s.status!=='active')return;
    if(shortcut==='next'){const ready=players.filter(isAlive);if(ready.length)setSelected(ready[(ready.findIndex((p:any)=>p.id===selected)+1)%ready.length].id);return;}
    if(shortcut.startsWith('select:')){const p=hiredPlayers[Number(shortcut.split(':')[1])];if(p&&isAlive(p))setSelected(p.id);return;}
    if(shortcut==='turn'){nextTurn();return;}if(shortcut==='map'){onMap?.();return;}
    if(!u||!isAlive(u))return;
    if(['move','fire','melee','loot','heal'].includes(shortcut)){if(shortcut!=='fire'||firearm)setMode(shortcut);return;}
    if(['run','walk','crouch','prone'].includes(shortcut)){order({type:'movement',movement:shortcut});return;}
    if(shortcut==='sneak'){order({type:'movement',movement:u.movementMode==='crouch'?'walk':'crouch'});return;}
    if(shortcut.startsWith('stance-')){const levels=['walk','crouch','prone'],current=u.stance==='prone'?2:u.movementMode==='crouch'?1:0;order({type:'movement',movement:levels[Math.max(0,Math.min(2,current+(shortcut==='stance-up'?-1:1)))]});return;}
    if(shortcut==='reload'&&firearm)order({type:u.jammed?'reprime':'reload'});
    else if(shortcut==='weapon')order({type:'weapon',slot:u.activeSlot==='blade'?'primary':'blade'});
    else if(shortcut==='brace'&&bladeFor(u).id===1811)order({type:'brace'});
    else if(shortcut==='overwatch'&&firearm)order({type:'overwatch'});
    else if(shortcut==='mount'&&u.horse)order({type:'mount'});
    else if(shortcut==='aim-up'||shortcut==='aim-down')setAim(v=>Math.max(0,Math.min(4,v+(shortcut==='aim-up'?1:-1))));
  };window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);});

  const hw=26,hh=14,origin=s.height*hw+28,project=(x:number,y:number)=>({x:origin+(x-y)*hw,y:65+(x+y)*hh});
  const vw=(s.width+s.height)*hw+60,vh=(s.width+s.height)*hh+155;
  const followed=cameraFollowsSelection&&u?project(motion.positions[u.id]?.x??u.x,motion.positions[u.id]?.y??u.y):{x:vw/2,y:vh/2};
  // Match the SVG viewport to its CSS dimensions: one logical pixel occupies
  // exactly zoom CSS pixels, including on narrow screens. Snap camera translation.
  const {x:cameraX,y:cameraY,width:viewWidth,height:viewHeight}=tacticalCamera({width:vw,height:vh},fieldSize,followed,cameraOffset,zoom);
  const panCamera=(dx:number,dy:number)=>setCameraOffset({x:Math.max(0,Math.min(Math.max(0,vw-viewWidth),cameraX+dx))+viewWidth/2-followed.x,y:Math.max(0,Math.min(Math.max(0,vh-viewHeight),cameraY+dy))+viewHeight/2-followed.y});
  useEffect(()=>{if(cameraSelection.current!==selected){cameraSelection.current=selected;setCameraFollowsSelection(true);setCameraOffset({x:0,y:0});}},[selected]);
  const diamond=(x:number,y:number)=>`${x},${y-hh} ${x+hw},${y} ${x},${y+hh} ${x-hw},${y}`;
  const tileClick=(t:any)=>{const occupant=renderedUnits.find((p:any)=>p.x===t.x&&p.y===t.y&&!p.fled);if(mode==='torch'){order({type:'throwTorch',x:t.x,y:t.y});return;}if(mode==='loot'){if(occupant)order({type:'loot',targetId:occupant.id});else{const dropIndex=(s.droppedWeapons||[]).findIndex((d:any)=>d.x===t.x&&d.y===t.y&&!d.taken);const ground=(s.groundItems||[]).find((d:any)=>d.x===t.x&&d.y===t.y&&d.count>0);order({type:'loot',...(dropIndex>=0?{dropIndex}:{groundId:ground?.id})});}return;}if(t.type==='door'&&mode==='move'){order({type:'door',doorId:t.doorId});return;}if(mode==='bolas'&&occupant){order({type:'boleadoras',targetId:occupant.id});return;}if(mode.startsWith('artillery')){order({type:mode,artilleryId:cannonId,x:t.x,y:t.y,targetId:occupant?.id,mode:shotType});return;}if(occupant){if(occupant.side==='player'){if(mode==='heal')order({type:'heal',targetId:occupant.id});else setSelected(occupant.id);}else if(mode==='artillery')order({type:'artillery',artilleryId:cannonId,targetId:occupant.id,mode:shotType});else order({type:mode==='charge'?'charge':mode==='melee'||!firearm?'melee':'fire',targetId:occupant.id});}else if(mode==='move')order({type:'move',x:t.x,y:t.y});else if(mode==='artillery')order({type:'artillery',artilleryId:cannonId,x:t.x,y:t.y,mode:shotType});};
  return <section className={`battle-layout ${s.night?'night-field':''}`}>
    <header className="battle-header"><div><p className="eyebrow">OPERACIÓN TERRESTRE · {s.night?'NOCHE':'DÍA'} · {s.weather.rain?'LLUVIA':'CIELO DESPEJADO'}</p><h1>{s.sectorName}</h1></div><div className="battle-status"><span className="turn-dot"/>{busy?'Procesando órdenes':s.mode==='exploration'?'Exploración libre':`Turno ${s.turn} · Ejército patriota`}<span className="enemy-count">{enemies.length} avistados</span></div></header>
    {mission&&<details className="hud-mission" aria-label="Objetivos de la misión"><summary>{mission.name} · Objetivos</summary><ul>{(mission.objectives||[]).map((objective:any,index:number)=><li key={index}>{typeof objective==='string'?objective:`${objective.done?'✓ ':''}${objective.text||objective.label||objective.name}`}</li>)}</ul>{s.sceneId==='yatasto'&&onMissionFinish&&<button className="line-button" disabled={busy||!(mission.objectives||[]).every((o:any)=>o.done)} onClick={onMissionFinish}>Concluir el encuentro</button>}</details>}
    <div className="tactical-help-toggle"><button className="line-button" aria-expanded={keyHelp} aria-controls="tactical-key-reference" onClick={()=>setKeyHelp(v=>!v)}>Atajos de teclado · H</button>{keyHelp&&<section id="tactical-key-reference" aria-label="Atajos de teclado" style={{padding:'1rem',background:'#20332c',color:'#f1e5c7'}}><h2>Órdenes de teclado</h2><p>Los cursores requieren seleccionar una casilla o un objetivo. Las órdenes respetan los puntos de acción y el equipo disponible.</p><dl style={{display:'grid',gridTemplateColumns:'minmax(120px, 1fr) 3fr',gap:'.35rem 1rem'}}>{TACTICAL_KEYS.map(([keys,label])=><div key={keys} style={{display:'contents'}}><dt><kbd>{keys}</kbd></dt><dd style={{margin:0}}>{label}</dd></div>)}</dl><p>Mientras escribís o conversás, los atajos se suspenden. Ctrl y ⌘ quedan reservados al navegador.</p><button className="line-button" onClick={()=>setKeyHelp(false)}>Cerrar ayuda · Esc</button></section>}</div>
    <div className="battle-middle"><div className="field-wrap"><div className="map-caption"><span>↑ NORTE</span><span>{mode==='move'?'Seleccioná una casilla para avanzar':mode==='heal'?'Seleccioná un compañero herido':mode==='artilleryMove'?'Seleccioná una casilla contigua al cañón':mode==='artilleryPivot'?'Seleccioná hacia dónde apuntar':'Seleccioná un enemigo'}{hover&&` · ${String.fromCharCode(65+hover.y)}${hover.x+1}`}</span><span className="map-zoom"><button aria-label="Desplazar cámara a la izquierda" onClick={()=>panCamera(-90,0)}>←</button><button aria-label="Desplazar cámara hacia arriba" onClick={()=>panCamera(0,-65)}>↑</button><button aria-label="Centrar cámara en el combatiente seleccionado" onClick={()=>{setCameraFollowsSelection(true);setCameraOffset({x:0,y:0});}}>◎</button><button aria-label="Desplazar cámara hacia abajo" onClick={()=>panCamera(0,65)}>↓</button><button aria-label="Desplazar cámara a la derecha" onClick={()=>panCamera(90,0)}>→</button><button aria-label="Alejar campo" disabled={zoom<=1} onClick={()=>setZoom(Math.max(1,zoom-1))}>−</button><span>{Math.round(zoom*100)}%</span><button aria-label="Acercar campo" disabled={zoom>=3} onClick={()=>setZoom(Math.min(3,zoom+1))}>+</button></span></div>
      <svg ref={fieldRef} className="tactical-field" viewBox={`${cameraX} ${cameraY} ${viewWidth} ${viewHeight}`} role="group" aria-label="Campo táctico. Seleccioná un soldado y una casilla.">
        <TacticalScene state={s} selected={selected} unit={u} players={players} units={renderedUnits} positions={motion.positions} poses={poses} directions={directions} hover={hover} mode={mode} aim={aim} reachable={reachable} showSight={showSight} sight={sight} revealed={revealedBuildingRooms} project={project} onTile={tileClick} onHover={setHover} onTalk={setTalking} onCannon={(id)=>{setCannonId(id);setMode('artillery')}} cannonId={cannonId}/>
      </svg>
      {s.lastError&&<p className="battle-error" role="alert">{s.lastError}</p>}{s.status!=='active'&&<div className="battle-result"><p className="eyebrow">PARTE DE GUERRA</p><h2>{s.status==='victory'?'¡Victoria patriota!':'La escuadra ha caído'}</h2><p>{s.status==='victory'?'El enemigo abandona el campo. La patria avanza.':'Reorganizá las tropas y prepará una nueva ofensiva.'}</p><>{s.status==='victory'&&<button className="line-button" onClick={()=>onChange(actBattle(s,{type:'explore'}))}>Explorar el sector y recoger equipo</button>}<button className="gold-button" onClick={onFinish}>Volver a la campaña <ChevronRight size={16}/></button></></div>}
    </div>
    </div>
    <JA2Strip
      battle={s}
      selected={selected}
      unit={u}
      players={players}
      missionAllies={missionAllies}
      localMilitia={localMilitia}
      mode={mode}
      showSight={showSight}
      aim={aim}
      costs={costs}
      weapon={weapon}
      firearm={firearm}
      cannonId={cannonId}
      shotType={shotType}
      gunCosts={gunCosts}
      artillery={s.artillery||[]}
      busy={busy}
      inventoryId={inventoryId}
      vw={vw}
      vh={vh}
      cameraRect={{x:cameraX,y:cameraY,width:viewWidth,height:viewHeight}}
      project={project}
      cameraX={cameraX}
      cameraY={cameraY}
      zoom={zoom}
      onSelect={(id)=>setSelected(id)}
      onOrder={order}
      onMode={setMode}
      onToggleSight={()=>setShowSight(!showSight)}
      onEndTurn={nextTurn}
      onRetreat={onRetreat}
      onOpenInventory={(id)=>{const p=players.find((x:any)=>x.id===id);if(p&&isAlive(p)){setSelected(id);setInventoryId(id);}}}
      onCloseInventory={()=>setInventoryId(null)}
      onCameraCenter={()=>{setCameraFollowsSelection(true);setCameraOffset({x:0,y:0});}}
      onCameraPan={panCamera}
      onZoom={delta=>setZoom(value=>Math.max(1,Math.min(3,value+Math.sign(delta))))}
      onCannonChange={(id)=>setCannonId(id)}
      onShotTypeChange={(t)=>setShotType(t)}
      onSetAim={(n)=>setAim(n)}
    />
    {talking&&<section className="notice" aria-label="Conversación"><div><h3>{talking.name} · {String.fromCharCode(65+talking.y)}{talking.x+1}</h3>{u&&Math.abs(u.x-talking.x)+Math.abs(u.y-talking.y)>1&&<button className="line-button" disabled={busy} onClick={()=>{const target=reachable.filter((r:any)=>Math.abs(r.x-talking.x)+Math.abs(r.y-talking.y)===1).sort((a:any,b:any)=>(a.cost??0)-(b.cost??0))[0];if(target)order({type:'move',x:target.x,y:target.y});}}>Acercarse para conversar</button>}<p>{conversation?.npcId===talking.id?conversation.text:'Acercá al combatiente seleccionado a una casilla contigua para conversar.'}</p>{[...(talking.mission?[['mission','Conversar sobre la misión']]:[['friendly','Saludar'],['direct','Preguntar por sus condiciones']]),...(quests?.[talking.id]&&quests[talking.id].status!=='completed'?[['quest',quests[talking.id].status==='offered'?'Entregar pertrechos':'Consultar encargo']]:[]),...(talking.operativeId!==undefined?[['recruit','Proponer incorporación']]:[])].map(([approach,label])=><button className="line-button" key={approach} disabled={busy||!onTalk||!u||Math.abs(u.x-talking.x)+Math.abs(u.y-talking.y)>1} onClick={()=>onTalk?.(talking.id,approach,selected)}>{label}</button>)}<button className="line-button" onClick={()=>setTalking(null)}>Cerrar conversación</button></div></section>}
    {missionAllies.length>0&&<details className="local-garrison" aria-label="Aliados de la misión"><summary>Oficiales aliados · {missionAllies.length} temporales</summary><div className="squad-strip">{missionAllies.map((p:any)=><button key={p.id} className={`squad-card ${p.id===selected?'active':''} ${!isAlive(p)?'fallen':''}`} onClick={()=>setSelected(p.id)} disabled={!isAlive(p)} aria-label={`Seleccionar aliado ${p.name}`}><div><strong>{p.name}</strong><span>{isAlive(p)?`${Math.ceil(p.hp)} SALUD · ${p.ap} PA`:'Fuera de combate'}</span></div></button>)}</div><small>Estos aliados participan en esta misión; no ocupan un contrato ni una plaza permanente en tu escuadra.</small></details>}
    {localMilitia.length>0&&<details className="local-garrison"><summary>Guarnición local · {localMilitia.length} milicianos</summary><div className="squad-strip">{localMilitia.map((p:any,index:number)=><button aria-label={`Seleccionar miliciano ${index+1}: ${p.name}`} key={p.id} className={`squad-card ${p.id===selected?'active':''} ${!isAlive(p)?'fallen':''}`} onClick={()=>setSelected(p.id)} disabled={!isAlive(p)}><div><strong>{index+1}. {p.name}</strong><span>{p.unconscious?'Inconsciente':!isAlive(p)?'Fuera de combate':`${Math.ceil(p.hp)} SALUD · ${p.ap} PA`}</span></div></button>)}</div></details>}

  </section>;
}
