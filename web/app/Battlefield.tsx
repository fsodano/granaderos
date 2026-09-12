'use client';
import AimCursor from './AimCursor';
import {rightClickAim} from '../../game/aim-cursor.js';
import {canChooseShotLocation} from '../../game/targeted-combat.js';
import {tacticalGridLabel} from '../../game/tactical-grid.js';
import TacticalScene from './TacticalScene';
import {tacticalCamera} from '../../game/tactical-camera.js';
import JA2Strip from './JA2Strip';
import JA2ExitPanel from './JA2ExitPanel';
import JA2LootPicker from './JA2LootPicker';
import JA2GroupMovePanel from './JA2GroupMovePanel';
import JA2CampaignReturn from './JA2CampaignReturn';
import {executeGroupMove} from '../../game/group-movement.js';
import {autoBandageBattle} from '../../game/auto-bandage.js';
import './tactical-hud.css';
import {TACTICAL_KEYS,tacticalShortcut,pointerMovementIntent,pointerItemIntent} from '../../game/hotkeys.js';
import {aimOptions, slotAction, targetPreview, targetingHelp, STANCES, unitCanAct, turnModel, visibleHover, interruptHover, heldSupplyAction, groupSelectionMode, isGroupGround, isMovementGround, movementAction, toggleMovementGroup, movementGroupModel, exitModel, fieldState, attackCursorMode, targetItemAction, pickupTargetAction, pickupSelection, resolvedOrderType, tacticalInputAction} from '../../game/ja2-hud.js';
import { useEffect, useMemo, useState, useRef } from 'react';
import { useUnitMotion, type MovementFacingOverride } from './useUnitMotion';
import {fixedBayonetFor} from '../../game/weapon-fittings.js';
import { ChevronRight } from 'lucide-react';
import { actBattle, endTurn, getReachable, weaponFor, hasFirearm, bladeFor, actionCosts, artilleryCosts, visibleEnemies, visibleTiles, visibleRooms, canSee, environmentTargetAt, lootSearchPreview, approachCompleted } from '../../game/tactical.js';

type Props = {battle:any; onChange:(s:any)=>any; onFinish:()=>void; peacefulVisit?:boolean; onMap?:()=>void; onMissionFinish?:()=>void; mission?:any; conversation?:any; quests?:any; onTalk?:(npcId:string,approach:string,unitId:string)=>void};
const isAlive=(u:any)=>u.hp>0&&!u.routed&&!u.unconscious;
export default function Battlefield({battle:s,onChange,onFinish,peacefulVisit=false,conversation,onTalk,onMap,quests,onMissionFinish,mission}:Props){
  const facingOverride=useRef<MovementFacingOverride|null>(null);
  const motion=useUnitMotion(s,facingOverride);
  const fieldRef=useRef<SVGSVGElement>(null);
  const [fieldSize,setFieldSize]=useState({width:960,height:540});
  useEffect(()=>{
    const field=fieldRef.current;if(!field)return;
    const observer=new ResizeObserver(([entry])=>{const {width,height}=entry.contentRect;if(width>0&&height>0)setFieldSize({width,height});});
    observer.observe(field);return()=>observer.disconnect();
  },[]);
  const [keyHelp,setKeyHelp]=useState(false);
  const [exitOpen,setExitOpen]=useState(false),[exitUnitIds,setExitUnitIds]=useState<string[]>([]),[exitId,setExitId]=useState('');
  const [bandageReport,setBandageReport]=useState<any>(null);
  const [groupIds,setGroupIds]=useState<string[]>([]);
  const [groupReport,setGroupReport]=useState<any>(null);
  const additiveClick=useRef(false);
  const clickMovementIntent=useRef('forward');
  const [movementIntent,setMovementIntent]=useState('forward');
  const [itemIntent,setItemIntent]=useState('use'),clickItemIntent=useRef('use');
  const [ambientPaused,setAmbientPaused]=useState(false);
  const [talkingSelection,setTalking]=useState<any>(null);
  const talking=talkingSelection?(s.npcs??[]).find((n:any)=>n.id===talkingSelection.id)??null:null;
  useEffect(()=>{
    const modifier=(event:KeyboardEvent)=>{setMovementIntent(pointerMovementIntent(event));setItemIntent(pointerItemIntent(event));};
    const reset=()=>{setMovementIntent('forward');clickMovementIntent.current='forward';setItemIntent('use');clickItemIntent.current='use';};
    const visibility=()=>{if(document.hidden)reset();};
    window.addEventListener('keydown',modifier);window.addEventListener('keyup',modifier);window.addEventListener('blur',reset);document.addEventListener('visibilitychange',visibility);
    return()=>{window.removeEventListener('keydown',modifier);window.removeEventListener('keyup',modifier);window.removeEventListener('blur',reset);document.removeEventListener('visibilitychange',visibility);};
  },[]);
  const [showSight,setShowSight]=useState(false);
  const [selected,setSelected]=useState(s.units.find((u:any)=>unitCanAct(s,u))?.id);
  const [poses,setPoses]=useState<Record<string,string>>({});const [directions,setDirections]=useState<Record<string,number>>({});const [zoom,setZoom]=useState(2);const [cameraOffset,setCameraOffset]=useState({x:0,y:0});const [cameraFollowsSelection,setCameraFollowsSelection]=useState(false);const cameraSelection=useRef(selected);const [inventoryId,setInventoryId]=useState<string|null>(null);const [lootPoint,setLootPoint]=useState<{x:number;y:number}|null>(null);const [mode,setMode]=useState('move');const [aim,setAim]=useState(0);const [hitLocation,setHitLocation]=useState('torso');const [pointer,setHover]=useState<any>(null);const [cursorPoint,setCursorPoint]=useState<{x:number;y:number}|null>(null);const aimTarget=useRef('');const [turnBusy,setBusy]=useState(false);const busy=turnBusy||motion.moving;
  const hover=visibleHover(s,pointer);
  const field=useMemo(()=>fieldState(s),[s]);
  const u=field.units.find((u:any)=>u.id===selected);const players=field.units.filter((u:any)=>u.side==='player');const enemies=visibleEnemies(s);const renderedUnits=field.units.filter((v:any)=>v.side==='player'||players.some((p:any)=>canSee(s,p,v)));const sight=new Set<string>(u?visibleTiles(s,u).map((t:any)=>`${t.x},${t.y}`):[]);
  const revealedBuildingRooms=useMemo(()=>new Set<string>([...(s.revealedRooms||[]),...visibleRooms(s)]),[s]);
  const hiredPlayers=players.filter((p:any)=>!p.militia&&!p.missionAlly),missionAllies=players.filter((p:any)=>p.missionAlly),localMilitia=players.filter((p:any)=>p.militia);
  const withdrawal=exitModel(s,{unitIds:exitUnitIds,exitId});
  const readyPlayers=players.filter((p:any)=>unitCanAct(s,p));const turn=turnModel(s);
  const reachable=useMemo(()=>unitCanAct(s,u)?getReachable(s,u,{movementIntent}):[],[s,u,movementIntent]);
  const costs=u?actionCosts(s,u):null;const weapon=u?weaponFor(u):null;const firearm=u&&hasFirearm(u);const [cannonId,setCannonId]=useState('');const [shotType,setShotType]=useState('solid');const gun=s.artillery?.find((g:any)=>g.id===cannonId);const gunCosts=u&&gun?artilleryCosts(s,u,gun):null;
  const maxAim=aimOptions(s,u).filter((option:any)=>!option.disabled).at(-1)?.level??0;
  useEffect(()=>setAim(value=>Math.min(value,maxAim)),[maxAim]);
  useEffect(()=>{setAim(0);setHitLocation('torso');aimTarget.current='';},[selected]);
  useEffect(()=>setAim(0),[u?.activeSlot,u?.weapon,u?.x,u?.y,s.phase,s.turn]);
  useEffect(()=>{if(hover?.id&&!canChooseShotLocation(hover))setHitLocation('torso');},[hover?.id,hover?.stance,hover?.knockedDown,hover?.unconscious,hover?.hp,hover?.energy]);
  useEffect(()=>{if(mode==='fire'&&!firearm)setMode('move');},[mode,firearm]);
  const groupTarget=mode==='move'&&movementIntent!=='preserveFacing'&&isGroupGround(s,u,hover)?hover:null;
  const movementGroup=useMemo(()=>movementGroupModel(s,groupIds,selected,groupTarget),[s,groupIds,selected,groupTarget?.x,groupTarget?.y]);
  const preview=movementGroup.request?null:targetPreview(s,u,hover,{mode,aim,hitLocation,reachable,movementIntent,itemIntent});
  useEffect(()=>{
    if(s.mode!=='exploration'||s.status!=='active'||s.phase!=='player'||busy||talking||inventoryId||lootPoint||exitOpen||ambientPaused)return;
    const timer=setInterval(()=>{
      if(!document.hidden)onChange(actBattle(s,{type:'ambient'}));
    },6000);
    return()=>clearInterval(timer);
  },[s,busy,talking,inventoryId,lootPoint,exitOpen,ambientPaused,onChange]);
  useEffect(()=>{setLootPoint(null);},[selected,s.phase,s.mode]);
  function openPickup(point:any){
    if(busy||!unitCanAct(s,u))return;
    const plan=lootSearchPreview(s,u,point),next=order({type:'approachLoot',x:point.x,y:point.y});
    if(next&&approachCompleted(s,next,selected,plan))setLootPoint({x:point.x,y:point.y});
  }
  function openExit(){clearGroup();setExitUnitIds(u?[u.id]:[]);setExitOpen(true);}
  function leaveSector(){if(busy||!withdrawal.preview.available)return;clearGroup();setBandageReport(null);facingOverride.current=null;const next=actBattle(s,withdrawal.action);onChange(next);if(!next.lastError){setExitUnitIds(ids=>ids.filter(id=>!next.units.find((unit:any)=>unit.id===id)?.departure));if(next.status!=='active')setExitOpen(false);}}
  function clearGroup(){setGroupIds([]);setGroupReport(null);}
  function selectUnit(id:string,additive=false){
    if(busy)return;
    if(additive&&groupSelectionMode(s)){setGroupIds(ids=>toggleMovementGroup(s,ids,id,selected));setGroupReport(null);setMode('move');return;}
    clearGroup();
    if(u?.activeSlot==='medical'||u?.activeSlot==='supply'&&u.activeSupply==='rations')order({type:'useItem',targetId:id});
    else if(unitCanAct(s,players.find((p:any)=>p.id===id)))setSelected(id);
  }
  function moveGroup(point:any){
    if(busy)return;
    const group=movementGroupModel(s,groupIds,selected,point);if(!group.request)return;
    const {state,...report}=executeGroupMove(s,group.request);
    setBandageReport(null);setGroupReport({...report,names:Object.fromEntries(group.members.map((member:any)=>[member.id,member.name]))});
    if(state!==s)onChange(state);
    if(report.status==='contact'||!groupSelectionMode(state))setGroupIds([]);
  }
  const order=(a:any)=>{
    if(!unitCanAct(s,u)||busy)return;
    a=tacticalInputAction(s,u,a);
    setBandageReport(null);clearGroup();facingOverride.current=null;
    const next=actBattle(s,{unitId:selected,aim,hitLocation,...a}),preserveFacing=a.type==='move'&&a.movementIntent==='preserveFacing';
    if(!next.lastError){
      const target=s.units.find((t:any)=>t.id===a.targetId)||a;
      if(!preserveFacing&&Number.isFinite(target.x)&&Number.isFinite(target.y))setDirections(d=>({...d,[selected]:(Math.round(Math.atan2((target.x-u.x)-(target.y-u.y),-((target.x-u.x)+(target.y-u.y)))/(Math.PI/4))+8)%8}));
      const actionType=resolvedOrderType(s,u,a);
      if(['fire','firePoint'].includes(actionType))setAim(0);
      const pose=['fire','firePoint'].includes(actionType)?'fire':['reload','reprime','repair'].includes(actionType)?'reload':['melee','charge'].includes(actionType)?'strike':'idle';
      setPoses(p=>({...p,[selected]:pose}));setTimeout(()=>setPoses(p=>({...p,[selected]:'idle'})),1000);
    }
    const accepted=onChange(next);
    if(!next.lastError&&preserveFacing&&accepted!==null)facingOverride.current={battle:accepted??next,unitId:selected,direction:((u.facing??2)+1)%8};
    return accepted===null?null:accepted??next;
  };
  function bandageSquad(){if(busy)return;clearGroup();const {battle, ...report}=autoBandageBattle(s);setBandageReport(report);setMode('move');onChange(battle);}
  function nextTurn(){if(busy||s.status!=='active')return;clearGroup();setBandageReport(null);setBusy(true);setTimeout(()=>{onChange(endTurn(s));setBusy(false);},450);}
  useEffect(()=>{if(groupIds.length&&!groupSelectionMode(s))setGroupIds([]);},[s.status,s.mode,s.phase,s.interrupt,groupIds.length]);
  useEffect(()=>{if(!unitCanAct(s,u))setSelected(readyPlayers[0]?.id);},[s,selected]);
  useEffect(()=>{if(s.phase==='interrupt'){setMode('move');setInventoryId(null);setTalking(null);setHover(interruptHover(s,selected));}else setHover(null);},[s.phase,s.interrupt?.enemyId,s.interrupt?.unitIds?.join(',')]);
  useEffect(()=>{const key=(e:KeyboardEvent)=>{
    const editing=Boolean((e.target as HTMLElement)?.closest('input,select,textarea,[contenteditable]:not([contenteditable="false"]),[role="textbox"]'));
    if(talking&&e.key==='Escape'&&!e.ctrlKey&&!e.metaKey&&!e.repeat){e.preventDefault();setTalking(null);return;}
    if(keyHelp&&e.key==='Escape'&&!e.ctrlKey&&!e.metaKey){e.preventDefault();setKeyHelp(false);return;}
    const nativeControl=Boolean((e.target as HTMLElement)?.closest('button,a,summary,[role="button"]'));
    const shortcut=tacticalShortcut(e,{editing,nativeControl,dialog:talking!==null||Boolean(document.querySelector('[role="dialog"],dialog[open]'))});
    if(!shortcut)return;e.preventDefault();
    if(shortcut==='help'){setKeyHelp(v=>!v);return;}if(keyHelp)return;
    if(shortcut==='cancel'){clearGroup();setExitOpen(false);setMode('move');return;}
    if(shortcut==='sight'){setShowSight(v=>!v);return;}
    if(shortcut==='zoom-in'||shortcut==='zoom-out'){setZoom(v=>Math.max(1,Math.min(3,v+(shortcut==='zoom-in'?1:-1))));return;}
    if(busy||s.status!=='active')return;
    if(shortcut==='next'){clearGroup();const ready=readyPlayers;if(ready.length)setSelected(ready[(ready.findIndex((p:any)=>p.id===selected)+1)%ready.length].id);return;}
    if(shortcut.startsWith('select:')){clearGroup();const p=hiredPlayers[Number(shortcut.split(':')[1])];if(p&&unitCanAct(s,p))setSelected(p.id);return;}
    if(shortcut==='turn'){nextTurn();return;}if(shortcut==='map'){onMap?.();return;}
    if(!unitCanAct(s,u))return;
    if(['move','loot','look'].includes(shortcut)){setMode(shortcut);return;}
    if(shortcut==='fire'){setMode(attackCursorMode(u));return;}
    if(shortcut==='melee'||shortcut==='heal'){const slot=shortcut==='heal'?'medical':'blade';if(u.activeSlot!==slot)order({type:'weapon',slot});setMode('move');return;}
    if(['run','walk','crouch','prone'].includes(shortcut)){order({type:'movement',movement:shortcut});return;}
    if(shortcut==='stealth'){order({type:'stealth',enabled:!u.stealthMode});return;}
    if(shortcut.startsWith('stance-')){const current=Math.max(0,STANCES.findIndex(([id])=>id===u.stance)),stance=STANCES[Math.max(0,Math.min(2,current+(shortcut==='stance-up'?-1:1)))][0];if(u.knockedDown||stance!==u.stance)order({type:'stance',stance:u.knockedDown?'standing':stance});return;}
    if(shortcut==='reload'&&firearm)order({type:u.jammed?'reprime':'reload'});
    else if(shortcut==='weapon')order(slotAction(u));
    else if(shortcut==='brace'&&fixedBayonetFor(u))order({type:'brace'});
    else if(shortcut==='overwatch'&&firearm)order({type:'overwatch'});
    else if(shortcut==='mount'&&u.horse)order({type:'mount'});
    else if(shortcut==='aim-up'||shortcut==='aim-down')setAim(v=>Math.max(0,Math.min(maxAim,v+(shortcut==='aim-up'?1:-1))));
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
  const hoverTarget=(point:any)=>{
    if(!point){setHover(null);return;}
    const target=visibleHover(s,point),location=target?.id&&canChooseShotLocation(target)?point?.aimLocation??'torso':'torso';
    const key=target?`${target.id??`${target.x},${target.y}`}:${location}`:'';
    if(aimTarget.current!==key){setAim(0);aimTarget.current=key;}
    setHitLocation(location);setHover(point);
  };
  const svgPoint=(event:React.MouseEvent<SVGSVGElement>)=>{
    const matrix=event.currentTarget.getScreenCTM();if(!matrix)return null;
    const point=event.currentTarget.createSVGPoint();point.x=event.clientX;point.y=event.clientY;
    const local=point.matrixTransform(matrix.inverse());return {x:local.x,y:local.y};
  };
  const tileClick=(t:any)=>{
    const additive=additiveClick.current;additiveClick.current=false;
    const intent=clickMovementIntent.current;clickMovementIntent.current='forward';
    const itemAction=clickItemIntent.current;clickItemIntent.current='use';
    const occupants=renderedUnits.filter((p:any)=>p.x===t.x&&p.y===t.y&&!p.fled);
    const occupant=occupants.find((p:any)=>p.id===t.id)||occupants.find((p:any)=>p.hp>0)||occupants[0];
    if(additive&&occupant?.side==='player'&&groupSelectionMode(s)){selectUnit(occupant.id,true);return;}
    if(mode==='look'){order({type:'look',x:t.x,y:t.y});return;}
    if(mode==='torch'){order({type:'throwTorch',x:t.x,y:t.y});return;}
    if(itemAction==='steal'&&occupant&&pickupTargetAction(occupant,u).type==='steal'&&['move','useItem'].includes(mode)){order({type:'steal',targetId:occupant.id});return;}
    if(mode==='loot'||itemAction==='steal'&&['move','useItem'].includes(mode)){
      if(occupant&&pickupTargetAction(occupant,u).type==='steal')order(pickupTargetAction(occupant,u));else openPickup(t);
      return;
    }
    if(mode==='bolas'){if(occupant)order({type:'boleadoras',targetId:occupant.id});return;}
    if(mode.startsWith('artillery')){order({type:mode,artilleryId:cannonId,x:t.x,y:t.y,targetId:occupant?.id,mode:shotType});return;}
    if(mode==='move'&&intent==='preserveFacing'&&isMovementGround(s,u,t)){order(movementAction(t,intent));return;}
    if(mode==='move'&&movementGroup.members.length&&isGroupGround(s,u,t)){moveGroup(t);return;}
    if(u?.activeSlot==='supply'&&u.activeSupply==='torches'&&['move','useItem'].includes(mode)){order(heldSupplyAction(u,t));return;}
    if(pickupSelection(s,u,t,{mode,movementIntent:intent,itemIntent:itemAction}).length){openPickup(t);return;}
    if(mode==='fire'&&(!occupant||occupant.side==='player'||occupant.hp<=0||occupant.surrendered)){order({type:'firePoint',x:t.x,y:t.y,hitLocation:'torso'});return;}
    if(occupant){
      if(u?.activeSlot==='supply'&&u.activeSupply==='rations'&&['move','useItem'].includes(mode))order(heldSupplyAction(u,occupant));
      else if(u?.activeSlot==='medical'||occupant.side!=='player')order({...targetItemAction(mode,occupant.id,u),hitLocation:canChooseShotLocation(occupant)?t.aimLocation??hitLocation:'torso'});
      else if(unitCanAct(s,occupant))selectUnit(occupant.id);
      return;
    }
    const environment=environmentTargetAt(s,t);
    if(environment&&u&&['move','useItem'].includes(mode)&&canSee(s,u,t)){order({type:'useItem',environment:{kind:environment.kind,id:environment.id}});return;}
    if(mode==='move')order(movementAction(t));
  };
  const aimAtPointer=(event:React.MouseEvent<SVGSVGElement>)=>{
    event.preventDefault();
    const targetId=(event.target as Element).closest('[data-person-hit-target]')?.closest('[data-unit-id]')?.getAttribute('data-unit-id');
    const target=targetId?renderedUnits.find((person:any)=>person.id===targetId)||s.npcs?.find((person:any)=>person.id===targetId):null;
    const next=rightClickAim(s,u,{mode,aim,busy,target});if(!next)return;
    clearGroup();setMode(next.mode);setAim(next.aim);setCursorPoint(svgPoint(event));
  };
  return <section className={`battle-layout ${s.night?'night-field':''}`}>
    <header className="battle-header"><div><p className="eyebrow">OPERACIÓN TERRESTRE · {s.night?'NOCHE':'DÍA'} · {s.weather.rain?'LLUVIA':'CIELO DESPEJADO'}</p><h1>{s.sectorName}</h1></div><div className="battle-status"><span className="turn-dot"/>{busy?'Procesando órdenes':turn.label}<span className="enemy-count">{enemies.length} avistados</span></div></header>
    {s.mode==='exploration'&&s.status==='active'&&<div className="notice" aria-label="Tiempo de exploración"><button className="line-button" onClick={()=>setAmbientPaused(paused=>!paused)}>{ambientPaused?'Reanudar exploración':'Pausar exploración'}</button><span>{ambientPaused?'Reloj detenido entre órdenes.':'El tiempo avanza: los habitantes se mueven, las heridas y las luces siguen su curso.'}</span></div>}
    <JA2CampaignReturn battle={s} peacefulVisit={peacefulVisit} busy={busy} onFinish={onFinish}/>
    {turn.interrupted&&<section className="ja2-interrupt-banner" aria-label="Interrupción de combate" role="status"><div><strong>Interrupción</strong><span>Actuá con los PA restantes. Después continúa el turno enemigo.</span></div><div className="ja2-interrupt-units" aria-label="Combatientes disponibles">{turn.units.map((p:any)=><button key={p.id} disabled={busy} aria-pressed={p.id===selected} onClick={()=>setSelected(p.id)}>{p.nickname||p.name} · {p.ap} PA</button>)}</div><button className="line-button" disabled={busy} onClick={nextTurn}>Continuar turno enemigo</button></section>}
    {mission&&<details className="hud-mission" aria-label="Objetivos de la misión"><summary>{mission.name} · Objetivos</summary><ul>{(mission.objectives||[]).map((objective:any,index:number)=><li key={index}>{typeof objective==='string'?objective:`${objective.done?'✓ ':''}${objective.text||objective.label||objective.name}`}</li>)}</ul>{s.sceneId==='yatasto'&&onMissionFinish&&<button className="line-button" disabled={busy||!(mission.objectives||[]).every((o:any)=>o.done)} onClick={onMissionFinish}>Concluir el encuentro</button>}</details>}
    <div className="tactical-help-toggle"><button className="line-button" aria-expanded={keyHelp} aria-controls="tactical-key-reference" onClick={()=>setKeyHelp(v=>!v)}>Atajos de teclado · H</button>{keyHelp&&<section id="tactical-key-reference" aria-label="Atajos de teclado" style={{padding:'1rem',background:'#20332c',color:'#f1e5c7'}}><h2>Órdenes de teclado</h2><p>Equipá un arma o las vendas. Seleccioná un enemigo para atacar, o un aliado para vendarlo. Con las vendas equipadas también podés seleccionarte a vos. Una bayoneta fijada da una estocada al alcance; a mayor distancia, el fusil dispara. Botón derecho o F permite elegir un disparo cercano; G o Esc vuelve al uso contextual. Las órdenes respetan los PA y el equipo disponible.</p><dl style={{display:'grid',gridTemplateColumns:'minmax(120px, 1fr) 3fr',gap:'.35rem 1rem'}}>{TACTICAL_KEYS.map(([keys,label])=><div key={keys} style={{display:'contents'}}><dt><kbd>{keys}</kbd></dt><dd style={{margin:0}}>{label}</dd></div>)}</dl><p>Apuntar aumenta el coste del disparo. Las heridas y el cansancio reducen los PA. Al terminar el turno se conservan hasta 20 PA. Vendar detiene la hemorragia; el tratamiento en campaña recupera salud.</p><p>Botón derecho o F: entrar en puntería. Otro clic derecho sobre un personaje aumenta la puntería y sus PA; al máximo vuelve a cero. Sobre el suelo, el clic derecho vuelve a movimiento. Clic izquierdo: disparar. Si el arma está descargada, el clic recarga con los cartuchos disponibles; otro clic dispara. Una X indica que no quedan cartuchos. Mové la mira sobre cabeza, torso o piernas; un objetivo cuerpo a tierra tiene una sola zona. L permite mirar hacia una casilla. El giro consume PA. Z activa el sigilo: reduce el ruido y aumenta los PA de movimiento, sin cambiar la postura.</p><p>Alt+clic en una casilla libre mueve solo al seleccionado sin girar y cancela la selección de grupo. Se puede caminar, avanzar agachado o arrastrarse. Consume más PA y tiempo. No permite correr ni moverse a caballo.</p><p>Al detectar un movimiento enemigo, algunos combatientes pueden interrumpirlo. Solo ellos actúan con sus PA restantes. Elegí Continuar turno enemigo para terminar la pausa.</p><p>Mientras escribís o conversás, los atajos se suspenden. Ctrl y ⌘ quedan reservados al navegador.</p><button className="line-button" onClick={()=>setKeyHelp(false)}>Cerrar ayuda · Esc</button></section>}</div>
    {groupSelectionMode(s)&&<p className="ja2-group-hint">Mayús+clic sobre aliados o retratos selecciona un grupo para marchar.</p>}
    {exitOpen&&s.status==='active'&&<JA2ExitPanel model={withdrawal} selectedId={selected} busy={busy} exploring={s.mode==='exploration'} onUnits={setExitUnitIds} onExit={setExitId} onLeave={leaveSector} onClose={()=>setExitOpen(false)}/>}
    {withdrawal.departures.length>0&&s.status==='active'&&<p className="ja2-departure-notice" role="status">{withdrawal.departures.length} combatientes ya salieron. El encuentro continúa con los que permanecen en el sector.</p>}
    <JA2GroupMovePanel members={movementGroup.members} anchorId={movementGroup.anchorId} preview={movementGroup.preview} report={groupReport} busy={busy} onRemove={id=>{setGroupIds(ids=>ids.filter(member=>member!==id));setGroupReport(null);}} onClear={clearGroup}/>
    <div className="battle-middle"><div className="field-wrap"><div className="map-caption"><span>↑ NORTE</span><span>{targetingHelp(mode,u,{movementIntent,itemIntent})}{hover&&` · ${tacticalGridLabel(hover.x,hover.y)}`}</span><span className="map-zoom"><button aria-label="Desplazar cámara a la izquierda" onClick={()=>panCamera(-90,0)}>←</button><button aria-label="Desplazar cámara hacia arriba" onClick={()=>panCamera(0,-65)}>↑</button><button aria-label="Centrar cámara en el combatiente seleccionado" onClick={()=>{setCameraFollowsSelection(true);setCameraOffset({x:0,y:0});}}>◎</button><button aria-label="Desplazar cámara hacia abajo" onClick={()=>panCamera(0,65)}>↓</button><button aria-label="Desplazar cámara a la derecha" onClick={()=>panCamera(90,0)}>→</button><button aria-label="Alejar campo" disabled={zoom<=1} onClick={()=>setZoom(Math.max(1,zoom-1))}>−</button><span>{Math.round(zoom*100)}%</span><button aria-label="Acercar campo" disabled={zoom>=3} onClick={()=>setZoom(Math.min(3,zoom+1))}>+</button></span></div>
      <svg ref={fieldRef} onMouseMoveCapture={event=>{setCursorPoint(svgPoint(event));setMovementIntent(pointerMovementIntent(event));setItemIntent(pointerItemIntent(event));}} onClickCapture={event=>{additiveClick.current=event.shiftKey;clickMovementIntent.current=pointerMovementIntent(event);setMovementIntent(clickMovementIntent.current);clickItemIntent.current=pointerItemIntent(event);setItemIntent(clickItemIntent.current);}} onKeyDownCapture={event=>{if(['Enter',' '].includes(event.key)){if(event.shiftKey&&event.repeat){event.preventDefault();event.stopPropagation();return;}additiveClick.current=event.shiftKey;clickMovementIntent.current=pointerMovementIntent(event);setMovementIntent(clickMovementIntent.current);clickItemIntent.current=pointerItemIntent(event);setItemIntent(clickItemIntent.current);}}} onContextMenu={aimAtPointer} onMouseLeave={()=>setCursorPoint(null)} className={`tactical-field ${mode==='fire'&&cursorPoint&&!busy?'aiming':''}`} viewBox={`${cameraX} ${cameraY} ${viewWidth} ${viewHeight}`} role="group" aria-label="Campo táctico. Seleccioná un soldado y una casilla.">
        <TacticalScene state={field} selected={selected} unit={u} players={players} units={renderedUnits} positions={motion.positions} poses={poses} directions={directions} hover={hover} mode={mode} aim={aim} hitLocation={hitLocation} reachable={reachable} showSight={showSight} sight={sight} revealed={revealedBuildingRooms} project={project} onTile={tileClick} onHover={hoverTarget} onTalk={setTalking} onCannon={(id)=>{setCannonId(id);setMode('artillery')}} cannonId={cannonId}/>
        {mode==='fire'&&cursorPoint&&!busy&&unitCanAct(s,u)&&<AimCursor point={cursorPoint} aim={aim} preview={preview} target={hover} scale={1/zoom} bounds={{x:cameraX,y:cameraY,width:viewWidth,height:viewHeight}}/>}
      </svg>
      {preview&&<aside className={`ja2-target-preview ${preview.valid?'':'unavailable'}`} aria-label="Vista previa de la orden"><strong>{preview.name}</strong><span>{preview.chance!==undefined?`${preview.hitLocation||preview.attackLabel||'Ataque'} · ${preview.chance}% de ${preview.chanceLabel||'impacto'} · `:preview.actionLabel?`${preview.actionLabel} · `:''}{preview.pa!==undefined?`${preview.pa} PA · ${preview.remaining} PA restantes`:''}</span>{preview.coverNote&&<span>{preview.coverNote}</span>}{preview.reason&&<span>{preview.reason}</span>}</aside>}
      {s.lastError&&<p className="battle-error" role="alert">{s.lastError}</p>}{s.status!=='active'&&<div className="battle-result"><p className="eyebrow">PARTE DE GUERRA</p><h2>{s.status==='victory'?'¡Victoria patriota!':s.status==='retreat'?'Retirada completada':'La escuadra ha caído'}</h2><p>{s.status==='victory'?'El enemigo abandona el campo. La patria avanza.':s.status==='retreat'?'La salida quedó registrada. Los combatientes conservan sus heridas y su equipo.':'Reorganizá las tropas y prepará una nueva ofensiva.'}</p><>{s.status==='victory'&&<button className="line-button" onClick={()=>onChange(actBattle(s,{type:'explore'}))}>Explorar el sector y recoger equipo</button>}<button className="gold-button" onClick={onFinish}>Volver a la campaña <ChevronRight size={16}/></button></></div>}
    </div>
    </div>
    {lootPoint&&u&&<JA2LootPicker battle={s} unit={u} point={lootPoint} busy={busy} onClose={()=>setLootPoint(null)} onTake={action=>{setLootPoint(null);order(action);}}/>}
    <JA2Strip
      battle={s}
      selected={selected}
      groupIds={movementGroup.members.map((member:any)=>member.id)}
      unit={u}
      players={players}
      missionAllies={missionAllies}
      localMilitia={localMilitia}
      mode={mode}
      target={hover&&renderedUnits.find((target:any)=>target.side!==u?.side&&target.hp>0&&!target.surrendered&&target.x===hover.x&&target.y===hover.y)}
      showSight={showSight}
      aim={aim}
      hitLocation={hitLocation}
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
      onSelect={selectUnit}
      onOrder={order}
      onMode={setMode}
      onToggleSight={()=>setShowSight(!showSight)}
      onEndTurn={nextTurn}
      onAutoBandage={bandageSquad}
      bandageReport={bandageReport}
      onRetreat={openExit}
      onOpenInventory={(id)=>{const p=players.find((x:any)=>x.id===id);if(p&&unitCanAct(s,p)){clearGroup();setSelected(id);setInventoryId(id);}}}
      onCloseInventory={()=>setInventoryId(null)}
      onCameraCenter={()=>{setCameraFollowsSelection(true);setCameraOffset({x:0,y:0});}}
      onCameraPan={panCamera}
      onZoom={delta=>setZoom(value=>Math.max(1,Math.min(3,value+Math.sign(delta))))}
      onCannonChange={(id)=>setCannonId(id)}
      onShotTypeChange={(t)=>setShotType(t)}
      onSetAim={(n)=>setAim(Math.max(0,Math.min(maxAim,n)))}
      onHitLocationChange={setHitLocation}
    />
    {bandageReport?.untreated.length>0&&!inventoryId&&<aside className="battle-error" role="status"><span>{bandageReport.stoppedReason} {bandageReport.untreated.length} heridos pendientes.</span><button className="line-button" onClick={()=>setBandageReport(null)}>Cerrar aviso</button></aside>}
    {talking&&<section className="notice" aria-label="Conversación"><div><h3>{talking.name} · {tacticalGridLabel(talking.x,talking.y)}</h3>{u&&Math.abs(u.x-talking.x)+Math.abs(u.y-talking.y)>1&&<button className="line-button" disabled={busy} onClick={()=>{const target=reachable.filter((r:any)=>Math.abs(r.x-talking.x)+Math.abs(r.y-talking.y)===1).sort((a:any,b:any)=>(a.cost??0)-(b.cost??0))[0];if(target)order({type:'move',x:target.x,y:target.y});}}>Acercarse para conversar</button>}<p>{conversation?.npcId===talking.id?conversation.text:'Acercá al combatiente seleccionado a una casilla contigua para conversar.'}</p>{[...(talking.mission?[['mission','Conversar sobre la misión']]:[['friendly','Saludar'],['direct','Preguntar por sus condiciones']]),...(quests?.[talking.id]&&quests[talking.id].status!=='completed'?[['quest',quests[talking.id].status==='offered'?'Entregar pertrechos':'Consultar encargo']]:[]),...(talking.operativeId!==undefined?[['recruit','Proponer incorporación']]:[])].map(([approach,label])=><button className="line-button" key={approach} disabled={busy||!onTalk||!u||Math.abs(u.x-talking.x)+Math.abs(u.y-talking.y)>1} onClick={()=>onTalk?.(talking.id,approach,selected)}>{label}</button>)}<button className="line-button" onClick={()=>setTalking(null)}>Cerrar conversación</button></div></section>}
    {missionAllies.length>0&&<details className="local-garrison" aria-label="Aliados de la misión"><summary>Oficiales aliados · {missionAllies.length} temporales</summary><div className="squad-strip">{missionAllies.map((p:any)=><button key={p.id} className={`squad-card ${p.id===selected?'active':''} ${!isAlive(p)?'fallen':''}`} onClick={event=>selectUnit(p.id,event.shiftKey)} disabled={!unitCanAct(s,p)} aria-label={`Seleccionar aliado ${p.name}`}><div><strong>{p.name}</strong><span>{isAlive(p)?`${Math.ceil(p.hp)} SALUD · ${p.ap} PA`:'Fuera de combate'}</span></div></button>)}</div><small>Estos aliados participan en esta misión; no ocupan un contrato ni una plaza permanente en tu escuadra.</small></details>}
    {localMilitia.length>0&&<details className="local-garrison"><summary>Guarnición local · {localMilitia.length} milicianos</summary><div className="squad-strip">{localMilitia.map((p:any,index:number)=><button aria-label={`Seleccionar miliciano ${index+1}: ${p.name}`} key={p.id} className={`squad-card ${p.id===selected?'active':''} ${!isAlive(p)?'fallen':''}`} onClick={event=>selectUnit(p.id,event.shiftKey)} disabled={!unitCanAct(s,p)}><div><strong>{index+1}. {p.name}</strong><span>{p.unconscious?'Inconsciente':!isAlive(p)?'Fuera de combate':`${Math.ceil(p.hp)} SALUD · ${p.ap} PA`}</span></div></button>)}</div></details>}

  </section>;
}
