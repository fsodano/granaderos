'use client';
import BattlePerformance from './BattlePerformance';
import {useEnemyPlayback} from '../lib/useEnemyPlayback';
import {firearmMaintenanceAction,chancePercent} from '../../game/ja2-hud.js';
import {useBattleExecutor} from '../lib/useBattleExecutor';
import {useMovementController} from '../lib/useMovementController';
import {useBattlePreview} from '../lib/useBattlePreview';
import {useGroupMovePreview} from '../lib/useGroupMovePreview';
import PrisonerActions from './PrisonerActions';
import {spriteOrderPose} from '../../game/sprite-order-pose.js';
import {battleFramePose} from '../../game/battle-playback.js';
import {tacticalViewport} from '../../game/tactical-viewport.js';
import AimCursor from './AimCursor';
import MovementCursor from './MovementCursor';
import {tacticalFeedback,contextualBanter} from '../../game/tactical-feedback.js';
import './playtest-feedback.css';
import KnifeThrowEffect,{KNIFE_EFFECT_DURATION,type KnifeVisual} from './KnifeThrowEffect';
import GrenadeThrowEffect,{GRENADE_EFFECT_DURATION,type GrenadeVisual} from './GrenadeThrowEffect';
import FirearmShotEffect from './FirearmShotEffect';
import InventoryMapCursor from './InventoryMapCursor';
import {EquipmentInteractionProvider,useEquipmentInteraction} from '../lib/equipment-drag';
import {selectedItemMapPreview,placeSelectedItemOnMap,inventoryIntentAt,toggleInventoryDestination,retainInventoryDestination,type InventoryMapOverride} from '../lib/inventory-map-controls';
import JA2Conversation,{JA2Speech} from './JA2Conversation';
import {npcGiftFeedback} from '../lib/npc-gift-feedback';
import {hasAuthoredDialogue,dialogueReason,dialogueAvailability,dialogueApproach,ambientReply} from '../../game/npc-dialogue.js';
import {rightClickAim} from '../../game/aim-cursor.js';
import {canChooseShotLocation} from '../../game/targeted-combat.js';
import {heldGrenade} from '../../game/grenade-throw.js';
import {tacticalGridLabel} from '../../game/tactical-grid.js';
import TacticalScene from './TacticalScene';
import {tacticalCamera} from '../../game/tactical-camera.js';
import JA2Strip from './JA2Strip';
import JA2ExitPanel from './JA2ExitPanel';
import JA2LootPicker from './JA2LootPicker';
import JA2GroupMovePanel from './JA2GroupMovePanel';
import JA2CampaignReturn from './JA2CampaignReturn';
import {autoBandageBattle} from '../../game/auto-bandage.js';
import './tactical-hud.css';
import {TACTICAL_KEYS,tacticalShortcut,pointerMovementIntent,pointerItemIntent} from '../../game/hotkeys.js';
import {aimOptions, slotAction, targetPreview, targetingHelp, STANCES, unitCanAct, turnModel, visibleHover, interruptHover, heldSupplyAction, groupSelectionMode, isGroupGround, isMovementGround, movementAction, toggleMovementGroup, movementGroupModel, exitModel, fieldState, attackCursorMode, aimedCursorMode, retainedAttackCursor, pointFireInputAction, meleePointInputAction, meleePointTargetingMode, civilianMedicalInputAction, knifeThrowInputAction, grenadeThrowInputAction, grenadeTargetingMode, targetItemAction, pickupTargetAction, pickupSelection, resolvedOrderType, tacticalInputAction, cellOccupant} from '../../game/ja2-hud.js';
import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useUnitMotion, type MovementFacingOverride } from './useUnitMotion';
import {tacticalLevel,sameCell,spaceKey} from '../../game/tactical-space.js';
import {isInteriorVisible} from '../../game/tactical-visibility.js';
import {projectSurface} from '../lib/tactical-elevation';
import {fixedBayonetFor} from '../../game/weapon-fittings.js';
import { ChevronRight,Hand,RotateCcw,RotateCw,MessageCircle,Eye,ChevronUp,ChevronDown } from 'lucide-react';
import { actBattle, presentedActBattle, getKnifeThrowVisual, getGrenadeThrowVisual, getMeleeAttackResult, getNpcGiftResult, endTurn, weaponFor, hasFirearm, bladeFor, actionCosts, artilleryCosts, visibleEnemies, visibleTiles, visibleRooms, canSee, environmentTargetAt, lootSearchPreview, approachCompleted } from '../../game/tactical.js';

type Props = {onPlaybackBusy?:(busy:boolean)=>void;onPlaybackValidate?:(state:any)=>boolean;onPlaybackFrame?:(before:any,after:any)=>void;battle:any; onChange:(s:any)=>any; onFinish:()=>void; peacefulVisit?:boolean; onMap?:()=>void; onMissionFinish?:()=>void; mission?:any; conversation?:any; quests?:any; onTalk?:(npcId:string,approach:string,unitId:string,term?:string,choice?:{node:string;id:string})=>void; dialogues?:Record<string,any>; hireTerms?:Record<string,any[]>};
type CameraView={x:number;y:number;width:number;height:number;worldWidth:number;worldHeight:number;zoom:number};
type CameraAnchor={x:number;y:number};
type CameraGesture={dx:number;dy:number}|{scale:number;from:CameraAnchor;to:CameraAnchor};
const isAlive=(u:any)=>u.hp>0&&!u.routed&&!u.unconscious;
const EMPTY_ROUTES:any[]=[];
export default function Battlefield(props:Props){
 return <EquipmentInteractionProvider key={`${props.battle.battleId??''}:${props.battle.sectorId??''}`}><BattlefieldContents {...props}/></EquipmentInteractionProvider>;
}
function BattlefieldContents({battle:committed,onPlaybackBusy,onPlaybackValidate,onPlaybackFrame,onChange,onFinish,peacefulVisit=false,conversation,onTalk,onMap,quests,onMissionFinish,mission,hireTerms,dialogues}:Props){
  const presentation=useEnemyPlayback(committed,onChange,onPlaybackBusy,onPlaybackValidate,onPlaybackFrame),s=presentation.state;
  const calculation=useBattleExecutor(committed);
  const [failedDestination,setFailedDestination]=useState<any>(null),[feedbackPopup,setFeedbackPopup]=useState<string|null>(null);
  const failedId=useRef(0),lastFeedback=useRef(s),lastChatter=useRef(0),chatterCount=useRef(0);
  const reportActionFailure=(next:any,action:any,source:any)=>{if(!next.lastError)return;const target=[...source.units,...(source.npcs??[])].find((person:any)=>person.id===action.targetId)??action;if(Number.isFinite(target.x)&&Number.isFinite(target.y))setFailedDestination({...target,id:++failedId.current});else setFeedbackPopup(next.lastError);};
  useEffect(()=>{if(!failedDestination)return;const timer=setTimeout(()=>setFailedDestination(null),1200);return()=>clearTimeout(timer);},[failedDestination]);
  useEffect(()=>{if(!feedbackPopup)return;const timer=setTimeout(()=>setFeedbackPopup(null),4000);return()=>clearTimeout(timer);},[feedbackPopup]);
  const {store:equipmentStore,current:equipmentState}=useEquipmentInteraction();
  const pickedItem=equipmentState?.selection??null;
  const [inventoryMapOverride,setInventoryMapOverride]=useState<InventoryMapOverride>(null);
  useEffect(()=>setInventoryMapOverride(null),[pickedItem?.unitId,pickedItem?.sourceId,pickedItem?.expectedSource]);
  const facingOverride=useRef<MovementFacingOverride|null>(null);
  const movement=useMovementController(calculation.run,(next,action,source,result)=>{
    reportActionFailure(next,action,source);
    if(action.type==='groupMove'&&result?.report){setGroupReport({...result.report,names:Object.fromEntries(source.units.map((member:any)=>[member.id,member.name]))});if(result.status==='contact')setGroupIds([]);}
    const accepted=onChange(next);
    if(!next.lastError&&accepted!==null&&action.movementIntent==='preserveFacing'){
      const actor=source.units.find((unit:any)=>unit.id===action.unitId);
      facingOverride.current={battle:accepted??next,unitId:action.unitId,direction:((actor?.facing??2)+1)%8};
    }
    return accepted;
  });
  const field=useMemo(()=>fieldState(s),[s]);
  const players=useMemo(()=>field.units.filter((u:any)=>u.side==='player'),[field]);
  const renderedUnits=useMemo(()=>field.units.filter((v:any)=>v.side==='player'||players.some((p:any)=>canSee(s,p,v))),[s,field,players]);
  const revealedBuildingRooms=useMemo(()=>new Set<string>([...(s.revealedRooms||[]),...visibleRooms(s)]),[s]);
  const inventoryPeople=useMemo(()=>[...renderedUnits,...(field.npcs??[]).filter((person:any)=>visibleHover(s,person))].filter((person:any)=>isInteriorVisible(s,person,revealedBuildingRooms)),[s,field,renderedUnits,revealedBuildingRooms]);
  const visibleActorIds=useMemo(()=>new Set<string>(inventoryPeople.map((person:any)=>person.id)),[inventoryPeople]);
  const continuingMotionIds=useMemo(()=>new Set<string>([...movement.continuingIds,...(presentation.frame?.type==='step'&&presentation.frame.unitId?[presentation.frame.unitId]:[])]),[movement.continuingIds,presentation.frame]);
  const motion=useUnitMotion(s,facingOverride,visibleActorIds,continuingMotionIds);
  useEffect(()=>movement.observe(s,motion.positions),[s,motion.positions,movement.observe]);
  const fieldRef=useRef<SVGSVGElement>(null);
  const [fieldSize,setFieldSize]=useState({width:960,height:540});
  useEffect(()=>{
    const field=fieldRef.current;if(!field)return;
    const observer=new ResizeObserver(([entry])=>{const {width,height}=entry.contentRect;if(width>0&&height>0)setFieldSize({width,height});});
    observer.observe(field);return()=>observer.disconnect();
  },[]);
  const [knifeEffect,setKnifeEffect]=useState<{id:number;visual:KnifeVisual}|null>(null),knifeEffectId=useRef(0);
  useEffect(()=>{if(!knifeEffect)return;const timer=setTimeout(()=>setKnifeEffect(null),KNIFE_EFFECT_DURATION);return()=>clearTimeout(timer);},[knifeEffect]);
  useEffect(()=>setKnifeEffect(null),[s.battleId,s.sectorId]);
  const [grenadeEffect,setGrenadeEffect]=useState<{id:number;visual:GrenadeVisual}|null>(null),grenadeEffectId=useRef(0);
  useEffect(()=>{if(!grenadeEffect)return;const timer=setTimeout(()=>setGrenadeEffect(null),GRENADE_EFFECT_DURATION);return()=>clearTimeout(timer);},[grenadeEffect]);
  useEffect(()=>setGrenadeEffect(null),[s.battleId,s.sectorId]);
  const [keyHelp,setKeyHelp]=useState(false);
  const [ambientPaused,setAmbientPaused]=useState(false);
  const [cameraOpen,setCameraOpen]=useState(false),cameraMenu=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!cameraOpen)return;
    const close=(event:PointerEvent)=>{if(!cameraMenu.current?.contains(event.target as Node))setCameraOpen(false);};
    document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);
  },[cameraOpen]);
  useEffect(()=>{if(keyHelp)setCameraOpen(false);},[keyHelp]);
  const [exitOpen,setExitOpen]=useState(false),[exitUnitIds,setExitUnitIds]=useState<string[]>([]),[exitId,setExitId]=useState('');
  const [bandageReport,setBandageReport]=useState<any>(null);
  const [groupIds,setGroupIds]=useState<string[]>([]);
  const [groupPreviewOpen,setGroupPreviewOpen]=useState(false);
  const [groupReport,setGroupReport]=useState<any>(null);
  const additiveClick=useRef(false);
  const clickMovementIntent=useRef('forward');
  const [movementIntent,setMovementIntent]=useState('forward');
  const [itemIntent,setItemIntent]=useState('use'),clickItemIntent=useRef('use');
  const [talkingSelection,setTalking]=useState<any>(null);
  const [pendingGift,setPendingGift]=useState<any>(null),[giftReply,setGiftReply]=useState<any>(null);
  const [speech,setSpeech]=useState<any>(null);const replyCounts=useRef<Record<string,number>>({});
  useEffect(()=>{if(!speech)return;const timer=setTimeout(()=>setSpeech(null),10000);return()=>clearTimeout(timer);},[speech]);
  useEffect(()=>{const before=lastFeedback.current;lastFeedback.current=s;if(before.battleId!==s.battleId||before.sectorId!==s.sectorId)return;const messages=tacticalFeedback(before,s);if(messages.length)setFeedbackPopup(messages.slice(0,3).join(' · '));if(talking||speech||Date.now()-lastChatter.current<12000)return;const line=contextualBanter(before,s,++chatterCount.current);if(line){lastChatter.current=Date.now();setSpeech(line);}},[s]);
  useEffect(()=>{setSpeech(null);setTalking(null);setPendingGift(null);setGiftReply(null);},[s.battleId,s.sectorId]);
  const talking=talkingSelection?(s.npcs??[]).find((n:any)=>n.id===talkingSelection.id&&(n.hp??100)>0&&!n.unconscious&&!n.departure&&!n.fled&&!n.routed)??null:null;
  useEffect(()=>{if(talkingSelection&&!talking){setTalking(null);setGiftReply(null);}},[talkingSelection,talking]);
  useEffect(()=>{
    const modifier=(event:KeyboardEvent)=>{setMovementIntent(pointerMovementIntent(event));setItemIntent(pointerItemIntent(event));};
    const reset=()=>{setMovementIntent('forward');clickMovementIntent.current='forward';setItemIntent('use');clickItemIntent.current='use';};
    const visibility=()=>{if(document.hidden)reset();};
    window.addEventListener('keydown',modifier);window.addEventListener('keyup',modifier);window.addEventListener('blur',reset);document.addEventListener('visibilitychange',visibility);
    return()=>{window.removeEventListener('keydown',modifier);window.removeEventListener('keyup',modifier);window.removeEventListener('blur',reset);document.removeEventListener('visibilitychange',visibility);};
  },[]);
  const [showSight,setShowSight]=useState(false);
  const [cursorLevel,setCursorLevel]=useState(0),hasElevation=Boolean(s.upperSurfaces?.length);
  const [selected,setSelected]=useState(s.units.find((u:any)=>u.equipmentCursor&&unitCanAct(s,u))?.id??s.units.find((u:any)=>unitCanAct(s,u))?.id);
  const poseTimers=useRef<Record<string,ReturnType<typeof setTimeout>>>({});
  const pendingStrikes=useRef<Record<string,{x:number;y:number;tacticalLevel?:number}>>({});
  useEffect(()=>()=>Object.values(poseTimers.current).forEach(clearTimeout),[]);
  const [poses,setPoses]=useState<Record<string,string>>({});const [directions,setDirections]=useState<Record<string,number>>({});const [zoom,setZoom]=useState(2);const [cameraOffset,setCameraOffset]=useState({x:0,y:0});const [cameraFollowsSelection,setCameraFollowsSelection]=useState(Boolean(s.deploymentComplete));const cameraSelection=useRef(selected);const [inventoryId,setInventoryId]=useState<string|null>(s.units.find((actor:any)=>actor.equipmentCursor&&unitCanAct(s,actor))?.id??null);const [lootPoint,setLootPoint]=useState<{x:number;y:number;tacticalLevel?:number}|null>(null);const [mode,setMode]=useState('move');const [aim,setAim]=useState(0);const [hitLocation,setHitLocation]=useState('torso');const [pointer,setHover]=useState<any>(null);const [cursorPoint,setCursorPoint]=useState<{x:number;y:number}|null>(null);const aimTarget=useRef(''),clickCount=useRef(1);const busy=presentation.busy||calculation.working||motion.blocking||Boolean(movement.intent);
  const playPose=(id:string,pose:string)=>{
    clearTimeout(poseTimers.current[id]);
    setPoses(p=>({...p,[id]:pose}));
    poseTimers.current[id]=setTimeout(()=>setPoses(p=>({...p,[id]:'idle'})),1000);
  };
  useEffect(()=>{
    for(const [id,destination] of Object.entries(pendingStrikes.current)){
      const actor=s.units.find((unit:any)=>unit.id===id),position=motion.positions[id];
      if(!actor||!isAlive(actor)||!sameCell(actor,destination)){delete pendingStrikes.current[id];continue;}
      if(position&&!position.moving&&sameCell(position,destination)){
        delete pendingStrikes.current[id];playPose(id,'strike');
      }
    }
  },[s,motion.positions]);
  useEffect(()=>{pendingStrikes.current={};},[s.battleId,s.sectorId]);
  const hover=useMemo(()=>visibleHover(s,pointer),[s,pointer]);
  const u=field.units.find((u:any)=>u.id===selected);
  useEffect(()=>{if(u)equipmentStore.revalidate(u,busy,order,s);},[equipmentStore,u,busy,s]);
  const enemies=useMemo(()=>visibleEnemies(s),[s]);
  const sight=useMemo(()=>new Set<string>(showSight&&u?visibleTiles(s,u).map(spaceKey):[]),[s,u,showSight]);
  const {hiredPlayers,missionAllies,localMilitia}=useMemo(()=>({hiredPlayers:players.filter((p:any)=>!p.militia&&!p.missionAlly),missionAllies:players.filter((p:any)=>p.missionAlly),localMilitia:players.filter((p:any)=>p.militia)}),[players]);
  const withdrawal=useMemo(()=>exitModel(s,{unitIds:exitUnitIds,exitId}),[s,exitUnitIds,exitId]);
  const readyPlayers=useMemo(()=>players.filter((p:any)=>unitCanAct(s,p)),[s,players]);const turn=useMemo(()=>turnModel(s),[s]);
  // Search once per actor/state/intent in a background worker. Pointer changes
  // reuse the result; stale snapshots never supply a destination or approach.
  const routeRequest=useMemo(()=>unitCanAct(s,u)?{unitId:u.id,movementIntent,previewBudget:true}:null,[s,u,movementIntent]);
  const routePreview=useBattlePreview(s,!busy&&(hover||talking)?routeRequest:null,'reachable-preview');
  const reachable=routePreview.preview??EMPTY_ROUTES;
  const talkingApproach=dialogueApproach(reachable,talking);
  const talkingAvailability=dialogueAvailability(s,u,talking,{visible:Boolean(u&&talking&&canSee(s,u,talking)),busy});
  const costs=useMemo(()=>u?actionCosts(s,u):null,[s,u]);const weapon=u?weaponFor(u):null;const firearm=u&&hasFirearm(u);const [cannonId,setCannonId]=useState('');const [shotType,setShotType]=useState('solid');const gun=s.artillery?.find((g:any)=>g.id===cannonId);const gunCosts=u&&gun?artilleryCosts(s,u,gun):null;
  const maxAim=useMemo(()=>aimOptions(s,u,{mode,target:hover,hitLocation}).filter((option:any)=>!option.disabled).at(-1)?.level??0,[s,u,mode,hover,hitLocation]);
  useEffect(()=>setAim(value=>Math.min(value,maxAim)),[maxAim]);
  useEffect(()=>{setTalking(null);setSpeech(null);setPendingGift(null);setGiftReply(null);},[selected]);
  useEffect(()=>{
    if(!pendingGift||busy)return;
    const actor=s.units.find((person:any)=>person.id===pendingGift.unitId),position=motion.positions[pendingGift.unitId];
    // State resolves before the walking animation. The reply appears only
    // when the courier has visibly reached the final authoritative position.
    if(actor&&position&&!sameCell(actor,position))return;
    setPendingGift(null);
    if(pendingGift.status==='interrupted'){equipmentStore.report(pendingGift.text);return;}
    const reply=npcGiftFeedback(s,pendingGift,conversation);if(!reply)return;
    setMode('move');setSpeech(null);setGiftReply(reply);
    if(reply.kind==='conversation')setTalking({id:reply.id});
    else {setTalking(null);setSpeech(reply);}
  },[pendingGift,busy,motion.positions,s,conversation,equipmentStore]);
  useEffect(()=>{
    if(!talking||!giftReply?.responseOnly)return;
    const timer=setTimeout(()=>{setTalking(null);setGiftReply(null);},10000);
    return()=>clearTimeout(timer);
  },[talking?.id,giftReply]);
  useEffect(()=>{setAim(0);setHitLocation('torso');aimTarget.current='';},[selected]);
  useEffect(()=>setAim(0),[u?.activeSlot,u?.weapon,u?.blade,u?.bladeInstanceId,u?.offHand,u?.x,u?.y,u?.tacticalLevel,s.phase,s.turn]);
  useEffect(()=>{setCursorLevel(tacticalLevel(u));setHover(null);},[u?.id,u?.tacticalLevel]);
  function changeCursorLevel(level:number){setCursorLevel(level);setHover(null);setAim(0);aimTarget.current='';}
  useEffect(()=>{if(hover?.id&&!canChooseShotLocation(hover))setHitLocation('torso');},[hover?.id,hover?.stance,hover?.knockedDown,hover?.unconscious,hover?.hp,hover?.energy]);
  useEffect(()=>{const next=retainedAttackCursor(u,mode);if(next!==mode){setMode(next);setAim(0);}},[mode,u]);
  const groupTarget=mode==='move'&&!grenadeTargetingMode(u,mode)&&movementIntent!=='preserveFacing'&&(isGroupGround(s,u,hover)||groupSelectionMode(s)&&tacticalLevel(hover)>0&&isMovementGround(s,u,hover))?hover:null;
  const movementGroup=useMemo(()=>movementGroupModel(s,groupIds,selected,groupTarget,{preview:false}),[s,groupIds,selected,groupTarget?.x,groupTarget?.y,groupTarget?.tacticalLevel]);
  const movementGroupIds=useMemo(()=>movementGroup.members.map((member:any)=>member.id),[movementGroup]);
  const groupPreview=useGroupMovePreview(s,groupPreviewOpen&&!busy?movementGroup.request:null);
  const mapItemTarget=hover?(inventoryPeople.find((person:any)=>sameCell(person,hover))??hover):null;
  const inventoryMapIntent=inventoryIntentAt(inventoryMapOverride,mapItemTarget);
  const itemPreview=useMemo(()=>selectedItemMapPreview(s,u,pickedItem,mapItemTarget,inventoryMapIntent),[s,u,pickedItem,mapItemTarget?.id,mapItemTarget?.x,mapItemTarget?.y,mapItemTarget?.tacticalLevel,inventoryMapIntent]);
  const preview=useMemo(()=>pickedItem?itemPreview:mode==='talk'||movementGroup.request?null:targetPreview(s,u,hover,{mode,aim,hitLocation,reachable,routesPending:routePreview.working,routesFailed:routePreview.failed,movementIntent,itemIntent}),[pickedItem,itemPreview,mode,movementGroup.request,routePreview.working,routePreview.failed,s,u,hover,aim,hitLocation,reachable,movementIntent,itemIntent]);
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
    const plan=lootSearchPreview(s,u,point),next=order({type:'approachLoot',x:point.x,y:point.y,tacticalLevel:tacticalLevel(point)});
    if(next&&approachCompleted(s,next,selected,plan))setLootPoint({x:point.x,y:point.y,tacticalLevel:tacticalLevel(point)});
  }
  function openTalk(target:any){
    if(placeInventoryItem(target))return;
    if(busy||!u)return;
    if(grenadeTargetingMode(u,mode)){order(grenadeThrowInputAction(s,u,target));return;}
    const actual=(s.npcs??[]).find((n:any)=>n.id===target.id)??renderedUnits.find((n:any)=>n.id===target.id&&n.side==='enemy');
    if(!actual||!canSee(s,u,actual))return;
    if(mode==='fire'){order(pointFireInputAction(actual,{aim}));return;}
    const civilianAid=civilianMedicalInputAction(s,u,actual,mode);if(civilianAid){order(civilianAid);return;}
    if(['move','useItem'].includes(mode)&&u.activeSlot==='item'&&!heldGrenade(u)&&(s.npcs??[]).some((n:any)=>n.id===actual.id)){order({type:'useItem',targetId:actual.id});return;}
    setSpeech(null);setGiftReply(null);setPendingGift(null);clearGroup();setMode('move');
    if(dialogues?.[actual.id]||hasAuthoredDialogue(actual)){setTalking(actual);return;}
    const reason=dialogueReason(s,u,actual,{visible:true,busy});
    const count=replyCounts.current[actual.id]??0;
    if(!reason)replyCounts.current[actual.id]=count+1;
    setTalking(null);setSpeech({id:actual.id,name:reason?'Aviso':actual.name,text:reason??ambientReply(actual,count),x:actual.x,y:actual.y,tacticalLevel:tacticalLevel(actual)});
  }
  function openExit(){clearGroup();setExitUnitIds(u?[u.id]:[]);setExitOpen(true);}
  function leaveSector(){if(busy||!withdrawal.preview.available)return;clearGroup();setBandageReport(null);facingOverride.current=null;const next=actBattle(s,withdrawal.action);onChange(next);if(!next.lastError){setExitUnitIds(ids=>ids.filter(id=>!next.units.find((unit:any)=>unit.id===id)?.departure));if(next.status!=='active')setExitOpen(false);}}
  function clearGroup(){setGroupIds([]);setGroupReport(null);setGroupPreviewOpen(false);}
  function selectUnit(id:string,additive=false){
    const target=players.find((person:any)=>person.id===id);if(target&&placeInventoryItem(target))return;
    if(equipmentStore.getSnapshot().selection&&equipmentStore.getSnapshot().selection?.unitId!==id){equipmentStore.report('Colocá o devolvé el objeto antes de cambiar de combatiente.');return;}
    if(busy){
      const contextualTarget=u?.activeSlot==='medical'||u?.activeSlot==='supply'&&u.activeSupply==='rations';
      if(!additive&&!contextualTarget&&!pickedItem&&unitCanAct(s,target)){clearGroup();setSelected(id);centerCamera();}
      return;
    }
    if(additive&&groupSelectionMode(s)){setGroupIds(ids=>toggleMovementGroup(s,ids,id,selected));setGroupReport(null);setMode('move');return;}
    clearGroup();
    if(u?.activeSlot==='medical'||u?.activeSlot==='supply'&&u.activeSupply==='rations')order({type:'useItem',targetId:id});
    else if(unitCanAct(s,players.find((p:any)=>p.id===id))){setSelected(id);centerCamera();}
  }
  function moveGroup(point:any,moving?:string){
    if(presentation.busy||!groupSelectionMode(s)||busy&&movement.intent?.action.type!=='groupMove')return;
    // The worker validates and plans the formation. Do not duplicate that
    // search on the input thread before sending the request.
    const group=movementGroupModel(s,groupIds,selected,point,{preview:false});if(!group.request)return;
    setBandageReport(null);movement.request({type:'groupMove',unitId:group.anchorId,...group.request,...(moving?{movement:moving}:{})});
  }
  const order=(a:any)=>{
    const redirecting=a.type==='move'&&movement.isActive(selected)&&!presentation.busy;
    if(!unitCanAct(s,u)||!redirecting&&(busy||calculation.pending.current))return;
    if(u.equipmentCursor&&!['pickupEquipment','placeEquipment','returnEquipmentCursor','dragEquipment','inventoryMap','attachment'].includes(a.type)){equipmentStore.report('Colocá o devolvé el objeto antes de dar otra orden.');return null;}
    a=tacticalInputAction(s,u,a);
    setBandageReport(null);clearGroup();facingOverride.current=null;
    const actionType=resolvedOrderType(s,u,a),request={unitId:selected,aim,...(actionType==='throwGrenade'?{}:{hitLocation}),...a},preserveFacing=a.type==='move'&&a.movementIntent==='preserveFacing';
    if(a.type==='move'){
      const queued=movement.request(request);if(queued)setHover(null);return null;
    }
    const accept=(next:any,alreadyPresented=false)=>{
    if(!next)return null;
    const knifeVisual=getKnifeThrowVisual(s,next),grenadeVisual=getGrenadeThrowVisual(s,next),giftResult=getNpcGiftResult(s,next);
    const preparationOnly=actionType==='throwKnife'&&!knifeVisual||actionType==='throwGrenade'&&!grenadeVisual||['melee','meleePoint'].includes(actionType)&&!getMeleeAttackResult(s,next,selected);
    if(!next.lastError&&['fire','firePoint','throwKnife','throwGrenade'].includes(actionType))setAim(0);
    if(!alreadyPresented&&!next.lastError&&!['pickupEquipment','placeEquipment','returnEquipmentCursor','dragEquipment'].includes(a.type)){
      const target=(a.targetKind==='npc'?s.npcs:s.units)?.find((t:any)=>t.id===a.targetId)||a;
      if(preparationOnly)setDirections(d=>({...d,[selected]:((next.units.find((actor:any)=>actor.id===selected)?.facing??u.facing??2)+1)%8}));
      else if(!preserveFacing&&Number.isFinite(target.x)&&Number.isFinite(target.y))setDirections(d=>({...d,[selected]:(Math.round(Math.atan2((target.x-u.x)-(target.y-u.y),-((target.x-u.x)+(target.y-u.y)))/(Math.PI/4))+8)%8}));
      // Contact can stop paid preparation before a throw or melee attack occurs.
      const pose=spriteOrderPose(preparationOnly?'look':actionType);
      const actor=next.units.find((unit:any)=>unit.id===selected);
      delete pendingStrikes.current[selected];
      if(!preparationOnly&&['melee','meleePoint'].includes(actionType)&&actor&&!sameCell(u,actor)){
        // The reducer already resolved the strike. Show it only after the
        // recorded approach reaches its final cell on the animation clock.
        pendingStrikes.current[selected]={x:actor.x,y:actor.y,tacticalLevel:tacticalLevel(actor)};
        clearTimeout(poseTimers.current[selected]);setPoses(p=>({...p,[selected]:'idle'}));
      }else playPose(selected,pose);
    }
    reportActionFailure(next,request,s);
    const accepted=onChange(next);
    if(!next.lastError&&accepted!==null&&actionType==='move')setHover(null);
    if(giftResult&&accepted!==null){setTalking(null);setSpeech(null);setGiftReply(null);setPendingGift(giftResult);}
    if(!alreadyPresented&&knifeVisual&&accepted!==null)setKnifeEffect({id:++knifeEffectId.current,visual:knifeVisual});
    if(!alreadyPresented&&grenadeVisual&&accepted!==null)setGrenadeEffect({id:++grenadeEffectId.current,visual:grenadeVisual});
    if(!next.lastError&&preserveFacing&&accepted!==null)facingOverride.current={battle:accepted??next,unitId:selected,direction:((u.facing??2)+1)%8};
    return accepted===null?null:accepted??next;
    };
    if(['move','climb'].includes(a.type)){void calculation.run(request).then(accept);return null;}
    if(['fire','firePoint','melee','meleePoint','charge','throwKnife','throwGrenade','reload','reprime','artillery','useItem','heal'].includes(actionType)){const result=presentedActBattle(s,request);if(result.state.lastError)return accept(result.state);void presentation.present(result,next=>accept(next,true));return null;}
    return accept(actBattle(s,request));
  };
  function placeInventoryItem(point:any){
    const target=inventoryPeople.find((person:any)=>sameCell(person,point))??point;
    return placeSelectedItemOnMap(equipmentStore,s,u,target,inventoryIntentAt(inventoryMapOverride,target),busy,order);
  }
  function bandageSquad(){if(busy)return;clearGroup();const {battle, ...report}=autoBandageBattle(s);setBandageReport(report);setMode('move');onChange(battle);}
  function nextTurn(){if(busy||calculation.pending.current||s.status!=='active')return;clearGroup();setBandageReport(null);void presentation.run();}
  useEffect(()=>{if(groupIds.length&&!groupSelectionMode(s))setGroupIds([]);},[s.status,s.mode,s.phase,s.interrupt,groupIds.length]);
  useEffect(()=>{if(!unitCanAct(s,u))setSelected(readyPlayers[0]?.id);},[s,selected]);
  useEffect(()=>{if(s.phase==='interrupt'){setMode('move');setInventoryId(null);setTalking(null);setHover(interruptHover(s,selected));}else setHover(null);},[s.phase,s.interrupt?.enemyId,s.interrupt?.unitIds?.join(',')]);
  useEffect(()=>{const key=(e:KeyboardEvent)=>{
    const editing=Boolean((e.target as HTMLElement)?.closest('input,select,textarea,[contenteditable]:not([contenteditable="false"]),[role="textbox"]'));
    if(talking&&e.key==='Escape'&&!e.ctrlKey&&!e.metaKey&&!e.repeat){e.preventDefault();setTalking(null);return;}
    if(cameraOpen&&e.key==='Escape'){e.preventDefault();setCameraOpen(false);return;}
    if(keyHelp&&e.key==='Escape'&&!e.ctrlKey&&!e.metaKey){e.preventDefault();setKeyHelp(false);return;}
    const mapTab=e.key==='Tab'&&Boolean((e.target as Element)?.closest('.tactical-field'));
    const nativeControl=!mapTab&&Boolean((e.target as HTMLElement)?.closest('button,a,summary,[role="button"]'));
    const shortcut=tacticalShortcut(e,{editing,nativeControl,dialog:talking!==null||Boolean(document.querySelector('[role="dialog"],dialog[open]'))});
    if(!shortcut||shortcut==='cursor-level'&&(!hasElevation||inventoryId&&!pickedItem))return;e.preventDefault();
    if(pickedItem&&!['cursor-level','zoom-in','zoom-out','help'].includes(shortcut)){
      if(shortcut==='next'||shortcut.startsWith('select:')){equipmentStore.report('Colocá o devolvé el objeto antes de cambiar de combatiente.');return;}else return;
    }
    if(shortcut==='help'){setKeyHelp(v=>!v);return;}if(keyHelp)return;
    if(shortcut==='cancel'){movement.cancel();setSpeech(null);clearGroup();setExitOpen(false);setMode('move');return;}
    if(shortcut==='cursor-level'){changeCursorLevel(cursorLevel===0?1:0);return;}
    if(shortcut==='sight'){setShowSight(v=>!v);return;}
    if(shortcut==='zoom-in'||shortcut==='zoom-out'){setZoom(v=>Math.max(1,Math.min(3,v+(shortcut==='zoom-in'?1:-1))));return;}
    if(busy||s.status!=='active')return;
    if(shortcut==='next'){clearGroup();const ready=readyPlayers;if(ready.length)setSelected(ready[(ready.findIndex((p:any)=>p.id===selected)+1)%ready.length].id);return;}
    if(shortcut.startsWith('select:')){clearGroup();const p=hiredPlayers[Number(shortcut.split(':')[1])];if(p&&unitCanAct(s,p))setSelected(p.id);return;}
    if(shortcut==='turn'){nextTurn();return;}if(shortcut==='map'){onMap?.();return;}
    if(!unitCanAct(s,u))return;
    if(['move','loot','look','talk'].includes(shortcut)){setMode(shortcut);return;}
    if(shortcut==='fire'){clearGroup();setMode(attackCursorMode(u));setAim(0);return;}
    if(shortcut==='melee'||shortcut==='heal'){const slot=shortcut==='heal'?'medical':'blade';if(u.activeSlot!==slot)order({type:'weapon',slot});setMode('move');return;}
    if(['run','walk','crouch','prone'].includes(shortcut)){order({type:'movement',movement:shortcut});return;}
    if(shortcut==='stealth'){order({type:'stealth',enabled:!u.stealthMode});return;}
    if(shortcut.startsWith('stance-')){const current=Math.max(0,STANCES.findIndex(([id])=>id===u.stance)),stance=STANCES[Math.max(0,Math.min(2,current+(shortcut==='stance-up'?-1:1)))][0];if(u.knockedDown||stance!==u.stance)order({type:'stance',stance:u.knockedDown?'standing':stance});return;}
    if(shortcut==='reload'&&firearm)order(firearmMaintenanceAction(s,u));
    else if(shortcut==='weapon')order(slotAction(u));
    else if(shortcut==='weapon-mode'&&firearm){const next=u.weaponMode==='melee'?'fire':'melee';order({type:'weaponMode',mode:next});setMode(next==='melee'?'useItem':'move');setAim(0);}
    else if(shortcut==='overwatch'&&firearm)order({type:'overwatch'});
    else if(shortcut==='mount'&&u.horse)order({type:'mount'});
    else if(shortcut==='aim-up'||shortcut==='aim-down')setAim(v=>Math.max(0,Math.min(maxAim,v+(shortcut==='aim-up'?1:-1))));
  };window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);});

  const hw=26,hh=14,origin=s.height*hw+28,project=useCallback((x:number,y:number)=>({x:origin+(x-y)*hw,y:65+(x+y)*hh}),[origin]);
  const grenadeLanding=preview?.attackType==='throwGrenade'&&preview.blocked&&preview.landing?projectSurface(s,project,preview.landing):null;
  const vw=(s.width+s.height)*hw+60,vh=(s.width+s.height)*hh+155;
  const followed=presentation.frame?.cameraFocus?projectSurface(s,project,presentation.frame.cameraFocus):cameraFollowsSelection&&u?projectSurface(s,project,{...u,...motion.positions[u.id]}):{x:vw/2,y:vh/2};
  // Match the SVG viewport to its CSS dimensions: one logical pixel occupies
  // exactly zoom CSS pixels, including on narrow screens and during a pinch.
  const {x:cameraX,y:cameraY,width:viewWidth,height:viewHeight}=tacticalCamera({width:vw,height:vh},fieldSize,followed,presentation.busy?{x:0,y:0}:cameraOffset,zoom);
  const viewBounds=tacticalViewport({x:cameraX,y:cameraY,width:viewWidth,height:viewHeight});
  const sceneViewport=useMemo(()=>viewBounds,[viewBounds.x,viewBounds.y,viewBounds.width,viewBounds.height]);
  const manualCamera=useRef(false),gestureFrame=useRef<number|null>(null),cameraGestures=useRef<CameraGesture[]>([]),touchPinch=useRef<{distance:number;anchor:CameraAnchor}|null>(null);
  const limitCamera=(value:number,extent:number)=>Math.max(0,Math.min(Math.max(0,extent),value));
  const cameraState=useRef<CameraView>({x:0,y:0,width:viewWidth,height:viewHeight,worldWidth:vw,worldHeight:vh,zoom});
  cameraState.current={x:cameraX,y:cameraY,width:viewWidth,height:viewHeight,worldWidth:vw,worldHeight:vh,zoom};
  const commitCamera=useCallback((camera:CameraView)=>{
    cameraState.current=camera;manualCamera.current=true;setCameraFollowsSelection(false);setZoom(camera.zoom);
    setCameraOffset({x:camera.x+camera.width/2-camera.worldWidth/2,y:camera.y+camera.height/2-camera.worldHeight/2});
  },[]);
  const panCamera=useCallback((dx:number,dy:number)=>{
    const camera=cameraState.current;commitCamera({...camera,x:limitCamera(camera.x+dx,camera.worldWidth-camera.width),y:limitCamera(camera.y+dy,camera.worldHeight-camera.height)});
  },[commitCamera]);
  const cancelCameraGesture=useCallback(()=>{if(gestureFrame.current!==null)cancelAnimationFrame(gestureFrame.current);gestureFrame.current=null;cameraGestures.current=[];touchPinch.current=null;},[]);
  const centerCamera=useCallback(()=>{cancelCameraGesture();manualCamera.current=false;setCameraFollowsSelection(true);setCameraOffset({x:0,y:0});},[cancelCameraGesture]);
  const queueCameraGesture=useCallback((gesture:CameraGesture)=>{
    cameraGestures.current.push(gesture);if(gestureFrame.current!==null)return;
    gestureFrame.current=requestAnimationFrame(()=>{
      gestureFrame.current=null;let camera=cameraState.current;
      // Apply ordered deltas together, so mixed pan/pinch input and a moving
      // touch midpoint retain their world anchor with one React update per frame.
      for(const gesture of cameraGestures.current){
        if('scale' in gesture){
          const zoom=Math.max(1,Math.min(3,camera.zoom*gesture.scale)),width=camera.width*camera.zoom/zoom,height=camera.height*camera.zoom/zoom;
          camera={...camera,zoom,width,height,x:limitCamera(camera.x+gesture.from.x*camera.width-gesture.to.x*width,camera.worldWidth-width),y:limitCamera(camera.y+gesture.from.y*camera.height-gesture.to.y*height,camera.worldHeight-height)};
        }else camera={...camera,x:limitCamera(camera.x+gesture.dx/camera.zoom,camera.worldWidth-camera.width),y:limitCamera(camera.y+gesture.dy/camera.zoom,camera.worldHeight-camera.height)};
      }
      cameraGestures.current=[];commitCamera(camera);
    });
  },[commitCamera]);
  useEffect(()=>{
    const field=fieldRef.current;if(!field)return;
    const anchorAt=(clientX:number,clientY:number)=>{const bounds=field.getBoundingClientRect();return {x:bounds.width?Math.max(0,Math.min(1,(clientX-bounds.left)/bounds.width)):.5,y:bounds.height?Math.max(0,Math.min(1,(clientY-bounds.top)/bounds.height)):.5};};
    const wheel=(event:WheelEvent)=>{
      // Trackpad pinch is a Ctrl+wheel event. Command remains browser-owned.
      if(event.metaKey)return;
      let dx=event.deltaX,dy=event.deltaY;if(event.shiftKey&&!dx){dx=dy;dy=0;}
      if(!dx&&!dy)return;event.preventDefault();
      const camera=cameraState.current,linePixels=16;
      const scaleX=event.deltaMode===1?linePixels:event.deltaMode===2?camera.width*camera.zoom:1,scaleY=event.deltaMode===1?linePixels:event.deltaMode===2?camera.height*camera.zoom:1;
      if(event.ctrlKey){const anchor=anchorAt(event.clientX,event.clientY);queueCameraGesture({scale:Math.exp(-event.deltaY*scaleY*.01),from:anchor,to:anchor});}
      else queueCameraGesture({dx:dx*scaleX,dy:dy*scaleY});
    };
    const touchPosition=(event:TouchEvent)=>{const [a,b]=[event.touches[0],event.touches[1]];return {distance:Math.hypot(b.clientX-a.clientX,b.clientY-a.clientY),anchor:anchorAt((a.clientX+b.clientX)/2,(a.clientY+b.clientY)/2)};};
    const touchStart=(event:TouchEvent)=>{if(event.touches.length!==2)return;event.preventDefault();touchPinch.current=touchPosition(event);};
    const touchMove=(event:TouchEvent)=>{
      if(event.touches.length!==2)return;event.preventDefault();const next=touchPosition(event),previous=touchPinch.current;touchPinch.current=next;
      if(previous?.distance&&next.distance)queueCameraGesture({scale:next.distance/previous.distance,from:previous.anchor,to:next.anchor});
    };
    const touchEnd=(event:TouchEvent)=>{if(touchPinch.current)event.preventDefault();touchPinch.current=event.touches.length===2?touchPosition(event):null;};
    const touchCancel=(event:TouchEvent)=>{if(touchPinch.current)event.preventDefault();cancelCameraGesture();};
    field.addEventListener('wheel',wheel,{passive:false});
    field.addEventListener('touchstart',touchStart,{passive:false});field.addEventListener('touchmove',touchMove,{passive:false});field.addEventListener('touchend',touchEnd,{passive:false});field.addEventListener('touchcancel',touchCancel,{passive:false});
    return()=>{field.removeEventListener('wheel',wheel);field.removeEventListener('touchstart',touchStart);field.removeEventListener('touchmove',touchMove);field.removeEventListener('touchend',touchEnd);field.removeEventListener('touchcancel',touchCancel);cancelCameraGesture();};
  },[queueCameraGesture,cancelCameraGesture]);
  useEffect(()=>{if(cameraSelection.current!==selected){cameraSelection.current=selected;if(!manualCamera.current)centerCamera();}},[selected,centerCamera]);
  const diamond=(x:number,y:number)=>`${x},${y-hh} ${x+hw},${y} ${x},${y+hh} ${x-hw},${y}`;
  const hoverTarget=(point:any)=>{
    setInventoryMapOverride(value=>retainInventoryDestination(value,point));
    if(!point){setHover(null);return;}
    const target=visibleHover(s,point),location=!pickedItem&&!grenadeTargetingMode(u,mode)&&target?.id&&!(s.npcs??[]).some((npc:any)=>npc.id===target.id&&sameCell(npc,target)&&canSee(s,u,npc))&&canChooseShotLocation(target)?point?.aimLocation??'torso':'torso';
    const key=target?`${target.id??spaceKey(target)}:${location}`:'';
    if(aimTarget.current!==key){setAim(0);aimTarget.current=key;}
    setHitLocation(location);setHover((previous:any)=>previous&&sameCell(previous,point)&&previous.id===point.id&&previous.loot===point.loot&&previous.aimLocation===point.aimLocation?previous:point);
  };
  const svgPoint=(event:{currentTarget:SVGSVGElement;clientX:number;clientY:number})=>{
    const matrix=event.currentTarget.getScreenCTM();if(!matrix)return null;
    const point=event.currentTarget.createSVGPoint();point.x=event.clientX;point.y=event.clientY;
    const local=point.matrixTransform(matrix.inverse());return {x:local.x+cameraX,y:local.y+cameraY};
  };
  const tileClick=(t:any)=>{
    const clicks=clickCount.current;clickCount.current=1;
    const moveTo=(point:any,intent='forward')=>({...movementAction(point,intent),...(clicks>=3&&intent!=='preserveFacing'?{movement:'run'}:{})});
    const additive=additiveClick.current;additiveClick.current=false;
    const intent=clickMovementIntent.current;clickMovementIntent.current='forward';
    const itemAction=clickItemIntent.current;clickItemIntent.current='use';
    if(placeInventoryItem(t))return;
    if(mode==='move'&&!additive&&itemAction!=='steal'&&movement.isActive(selected)&&!presentation.busy&&u&&sameCell(u,t)){movement.cancel();clearGroup();setHover(null);return;}
    if(itemAction==='moveOnly'&&['move','useItem','loot'].includes(mode)&&isMovementGround(s,u,t)){order(moveTo(t,intent));return;}
    const civilianAid=civilianMedicalInputAction(s,u,t,mode);if(civilianAid){order(civilianAid);return;}
    const occupant=cellOccupant(renderedUnits,t);
    if(grenadeTargetingMode(u,mode)){order(grenadeThrowInputAction(s,u,t));return;}
    if(mode==='throwKnife'){order(knifeThrowInputAction(s,u,t,{aim,hitLocation:t.aimLocation??hitLocation}));return;}
    if(mode==='talk'){const target=occupant??(s.npcs??[]).find((n:any)=>sameCell(n,t));if(target)openTalk(target);return;}
    if(additive&&occupant?.side==='player'&&groupSelectionMode(s)){selectUnit(occupant.id,true);return;}
    if(mode==='look'){order({type:'look',x:t.x,y:t.y,tacticalLevel:tacticalLevel(t)});return;}
    if(mode==='torch'){order({type:'throwTorch',x:t.x,y:t.y,tacticalLevel:tacticalLevel(t)});return;}
    if(itemAction==='steal'&&occupant&&pickupTargetAction(occupant,u).type==='steal'&&['move','useItem'].includes(mode)){order({type:'steal',targetId:occupant.id});return;}
    if(mode==='loot'||itemAction==='steal'&&['move','useItem'].includes(mode)){
      if(occupant&&pickupTargetAction(occupant,u).type==='steal')order(pickupTargetAction(occupant,u));else openPickup(t);
      return;
    }
    if(mode==='bolas'){if(occupant)order({type:'boleadoras',targetId:occupant.id});else order({type:'boleadoras',x:t.x,y:t.y,tacticalLevel:tacticalLevel(t)});return;}
    if(mode.startsWith('artillery')){order({type:mode,artilleryId:cannonId,x:t.x,y:t.y,tacticalLevel:tacticalLevel(t),targetId:occupant?.id,mode:shotType});return;}
    if(mode==='move'&&intent==='preserveFacing'&&isMovementGround(s,u,t)){order(moveTo(t,intent));return;}
    if(mode==='move'&&movementGroup.members.length&&isGroupGround(s,u,t)){moveGroup(t,clicks>=3?'run':undefined);return;}
    if(u?.activeSlot==='supply'&&['move','useItem'].includes(mode)&&(u.activeSupply==='torches'||(u.activeSupply==='boleadoras'&&!occupant))){order(heldSupplyAction(u,occupant??t));return;}
    if(!occupant&&meleePointTargetingMode(u,mode)&&!(s.npcs??[]).some((npc:any)=>sameCell(npc,t)&&canSee(s,u,npc))){order(meleePointInputAction(t));return;}
    if(pickupSelection(s,u,t,{mode,movementIntent:intent,itemIntent:itemAction}).length){openPickup(t);return;}
    if(mode==='move'&&heldGrenade(u)){
      if(occupant){if(occupant.side==='player'&&unitCanAct(s,occupant))selectUnit(occupant.id);return;}
      order(moveTo(t));return;
    }
    if(mode==='fire'&&(t.anonymous||(s.npcs??[]).some((npc:any)=>npc.id===t.id&&sameCell(npc,t)&&canSee(s,u,npc))||!occupant||occupant.side==='player'||occupant.hp<=0||occupant.surrendered)){order(pointFireInputAction(t,{aim}));return;}
    if(occupant){
      if(u?.activeSlot==='supply'&&u.activeSupply==='rations'&&['move','useItem'].includes(mode))order(heldSupplyAction(u,occupant));
      else if(u?.activeSlot==='medical'||occupant.side!=='player')order({...targetItemAction(mode,occupant.id,u),hitLocation:canChooseShotLocation(occupant)?t.aimLocation??hitLocation:'torso'});
      else if(unitCanAct(s,occupant))selectUnit(occupant.id);
      return;
    }
    const environment=environmentTargetAt(s,t);
    if(environment&&u&&['move','useItem'].includes(mode)&&canSee(s,u,t)){order({type:'useItem',environment:{kind:environment.kind,id:environment.id}});return;}
    if(mode==='move')order(moveTo(t));
  };
  const aimAtPointer=(event:React.MouseEvent<SVGSVGElement>)=>{
    event.preventDefault();
    const targetId=(event.target as Element).closest('[data-person-hit-target]')?.closest('[data-unit-id]')?.getAttribute('data-unit-id');
    const target=targetId?renderedUnits.find((person:any)=>person.id===targetId)||s.npcs?.find((person:any)=>person.id===targetId):null;
    if(equipmentStore.getSnapshot().selection){
      if(target){setHover(target);setInventoryMapOverride(value=>toggleInventoryDestination(value,target));}else equipmentStore.cancel();
      return;
    }
    const next=rightClickAim(s,u,{mode,aim,busy,target,hitLocation});if(!next)return;
    clearGroup();setMode(next.mode);setAim(next.aim);setCursorPoint(svgPoint(event));
  };
  const orderHelp=pickedItem?'Objeto seleccionado: clic para pasar, dejar o lanzar. Sobre un personaje, botón derecho cambia el destino al suelo. Esc devuelve el objeto.':targetingHelp(mode,u,{movementIntent,itemIntent});
  const stepStance=(delta:number)=>{if(!u)return;const index=Math.max(0,STANCES.findIndex(([id])=>id===u.stance)),stance=STANCES[Math.max(0,Math.min(2,index+delta))][0];order({type:'stance',stance:u.knockedDown?'standing':stance});};
  const turnUnit=(delta:number)=>{if(!u)return;const direction=((u.facing??2)+delta+8)%8,[dx,dy]=[[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]][direction];order({type:'look',x:u.x+dx,y:u.y+dy,tacticalLevel:tacticalLevel(u)});};
  const orderLabel=pickedItem?'Objeto en mano':mode==='useItem'?(u?.activeSlot==='medical'?'Vendar':hasFirearm(u||{})?u.weaponMode==='melee'?fixedBayonetFor(u)?'Bayoneta':'Culatazo':'Disparo':'Usar equipo'):({move:'Mover',fire:'Disparo',throwKnife:'Lanzar facón',throwGrenade:'Granada',look:'Mirar',talk:'Hablar',loot:'Recoger',torch:'Antorcha',bolas:'Boleadoras'} as Record<string,string>)[mode]??'Orden';
  return <section className={`battle-layout ${s.night?'night-field':''}`}>
    <header className="battle-header tactical-map-toolbar" aria-label="Órdenes y cámara del campo">
      <JA2CampaignReturn battle={s} peacefulVisit={peacefulVisit} busy={busy} onFinish={onFinish} compact/>
      <h1 className="battle-heading" title={s.sectorName}>{s.sectorName}</h1>
      <div className="battle-status"><span className="battle-phase"><span className="turn-dot"/>{busy?'Procesando órdenes':turn.label}</span><span className="enemy-count" title={`${enemies.length} enemigos avistados`}>{enemies.length} avistados</span></div>
      <div className="map-toolbar-actions">
        <span className="map-order-mode" title={orderHelp}>{orderLabel}</span>
        <div className="map-camera-menu" ref={cameraMenu}>
          <button className="line-button" aria-expanded={cameraOpen} aria-controls="tactical-camera-panel" onClick={()=>{setCameraOpen(v=>!v);setKeyHelp(false);}}>Cámara</button>
          {cameraOpen&&<section id="tactical-camera-panel" aria-label="Controles de cámara">
            <div className="map-camera-controls">
          <div className="map-camera" role="group" aria-label="Cámara del campo"><span className="map-control-label">Cámara</span><button aria-label="Desplazar cámara a la izquierda" title="Desplazar cámara a la izquierda" onClick={()=>panCamera(-90,0)}>←</button><button aria-label="Desplazar cámara hacia arriba" title="Desplazar cámara hacia arriba" onClick={()=>panCamera(0,-65)}>↑</button><button className="map-center" aria-label="Centrar cámara en el combatiente seleccionado" title="Seguir al combatiente seleccionado" onClick={centerCamera}>Centrar</button><button aria-label="Desplazar cámara hacia abajo" title="Desplazar cámara hacia abajo" onClick={()=>panCamera(0,65)}>↓</button><button aria-label="Desplazar cámara a la derecha" title="Desplazar cámara a la derecha" onClick={()=>panCamera(90,0)}>→</button></div>
          <div className="map-zoom" role="group" aria-label="Zoom del campo"><span className="map-control-label">Zoom</span><button aria-label="Alejar campo" title="Alejar campo" disabled={zoom<=1} onClick={()=>setZoom(Math.max(1,zoom-1))}>−</button><output aria-label="Escala del campo">{Math.round(zoom*100)}%</output><button aria-label="Acercar campo" title="Acercar campo" disabled={zoom>=3} onClick={()=>setZoom(Math.min(3,zoom+1))}>+</button></div>
        </div>
            <div className="map-reference"><span className="map-north">↑ Norte</span>{hasElevation&&<button className="line-button" aria-label="Cambiar altura del cursor" onClick={()=>changeCursorLevel(cursorLevel===0?1:0)}>Cursor: {cursorLevel===0?'Suelo':'Nivel superior'} · Tab</button>}<span className="map-grid-reference" aria-label="Casilla señalada">{hover?tacticalGridLabel(hover.x,hover.y):''}</span></div>
            <p>Rueda: mover · Pellizcar: zoom</p>
          </section>}
        </div>
        <div className="tactical-help-toggle" hidden={Boolean(inventoryId)}><button className="line-button" aria-expanded={keyHelp} aria-controls="tactical-key-reference" onClick={()=>setKeyHelp(v=>!v)}>Ayuda · H</button>{keyHelp&&<section id="tactical-key-reference" aria-label="Atajos de teclado" style={{padding:'1rem',background:'#20332c',color:'#f1e5c7'}}><h2>Ayuda táctica</h2><p className="map-order-help">{orderHelp}</p><p><kbd>Mayús</kbd> + clic en aliados o retratos: seleccionar un grupo.</p><p>{s.night?'Noche':'Día'} · {s.weather.rain?'Lluvia':'Cielo despejado'}</p><h3>Órdenes de teclado</h3><p>Equipá un arma o las vendas. Seleccioná un enemigo para atacar, o un aliado para vendarlo. Con las vendas equipadas también podés seleccionarte a vos. Presioná B para alternar Disparo y Combate cercano, o elegí el modo en el arma. El modo cercano usa la bayoneta fijada o la culata. Seleccioná un enemigo o una casilla vacía: se acerca y golpea. Esc vuelve a caminar. Botón derecho o F respeta el modo elegido con B. El culatazo y la bayoneta no requieren carga ni cazoleta cebada. Para disparar, volvé al modo Disparo con B. G o Esc vuelve al uso contextual. Las órdenes respetan los PA y el equipo disponible.</p><dl style={{display:'grid',gridTemplateColumns:'minmax(120px, 1fr) 3fr',gap:'.35rem 1rem'}}>{TACTICAL_KEYS.map(([keys,label])=><div key={keys} style={{display:'contents'}}><dt><kbd>{keys}</kbd></dt><dd style={{margin:0}}>{label}</dd></div>)}</dl><p>Apuntar aumenta el coste del disparo. Las heridas y el cansancio reducen los PA. Al terminar el turno se conservan hasta 20 PA. Vendar detiene la hemorragia; el tratamiento en campaña recupera salud.</p><p>En modo Disparo, botón derecho o F entra en puntería. Otro clic derecho sobre un personaje aumenta la puntería y sus PA; al máximo vuelve a cero. Sobre el suelo, el clic derecho vuelve a movimiento. Clic izquierdo: confirmar el ataque elegido o lanzar el facón equipado. El lanzamiento consume el facón de la mano; puede quedar en un cuerpo o en el suelo. Con el facón, el clic normal sin mira conserva el ataque cuerpo a cuerpo. Si el arma está descargada, el clic recarga con los cartuchos disponibles; otro clic dispara. Una X indica que no quedan cartuchos. Mové la mira sobre cabeza, torso o piernas; un objetivo cuerpo a tierra tiene una sola zona. L permite mirar hacia una casilla. El giro consume PA. Z activa el sigilo: reduce el ruido y aumenta los PA de movimiento, sin cambiar la postura.</p><p>Durante la marcha individual, otro clic en una casilla cambia el destino del combatiente seleccionado. Un triple clic lo hace correr los pasos restantes. Esc detiene la marcha al terminar el paso actual.</p><p>Alt+clic en una casilla libre mueve solo al seleccionado sin girar y cancela la selección de grupo. Se puede caminar, avanzar agachado o arrastrarse. Consume más PA y tiempo. No permite correr ni moverse a caballo.</p><p>Al detectar un movimiento enemigo, algunos combatientes pueden interrumpirlo. Solo ellos actúan con sus PA restantes. Elegí Continuar turno enemigo para terminar la pausa.</p><p>La rueda o el panel táctil desplaza el mapa. Mayús+rueda desplaza horizontalmente. Pellizcá con dos dedos para acercar o alejar. Seleccionar un combatiente o centrar la cámara vuelve a seguirlo.</p><p>Mientras escribís o conversás, los atajos se suspenden. Ctrl+clic recoge equipo. Mayús+clic en suelo mueve sin recoger; ⌘ queda reservado al navegador.</p><button className="line-button" onClick={()=>setKeyHelp(false)}>Cerrar ayuda · Esc</button></section>}</div>
      </div>
    </header>
    <PrisonerActions state={s} unit={u} busy={busy} onRelease={id=>order({type:'free',targetKind:'npc',targetId:id})} onEscort={(id,escortOrder)=>order({type:'prisonerEscort',targetKind:'npc',targetId:id,escortOrder})}/>
    {mission&&<details className="hud-mission" aria-label="Objetivos de la misión"><summary>{mission.name} · Objetivos</summary><ul>{(mission.objectives||[]).map((objective:any,index:number)=><li key={index}>{typeof objective==='string'?objective:`${objective.done?'✓ ':''}${objective.text||objective.label||objective.name}`}</li>)}</ul>{s.sceneId==='yatasto'&&onMissionFinish&&<button className="line-button" disabled={busy||!(mission.objectives||[]).every((o:any)=>o.done)} onClick={onMissionFinish}>Concluir el encuentro</button>}</details>}

    {exitOpen&&s.status==='active'&&<JA2ExitPanel model={withdrawal} selectedId={selected} busy={busy} exploring={s.mode==='exploration'} onUnits={setExitUnitIds} onExit={setExitId} onLeave={leaveSector} onClose={()=>setExitOpen(false)}/>}
    {withdrawal.departures.length>0&&s.status==='active'&&<p className="ja2-departure-notice" role="status">{withdrawal.departures.length} combatientes ya salieron. El encuentro continúa con los que permanecen en el sector.</p>}

    <div className="battle-middle" data-equipment-scope={equipmentStore.scope}>
      <div className="tactical-notices">
    <JA2GroupMovePanel members={movementGroup.members} anchorId={movementGroup.anchorId} preview={groupPreview.preview} previewOpen={groupPreviewOpen} previewWorking={groupPreview.working} onPreviewOpenChange={setGroupPreviewOpen} report={groupReport} busy={busy} onRemove={id=>{setGroupIds(ids=>ids.filter(member=>member!==id));setGroupReport(null);}} onClear={clearGroup}/>
    {turn.interrupted&&<section className="ja2-interrupt-banner" aria-label="Interrupción de combate" role="status"><div><strong>Interrupción</strong><span>Actuá con los PA restantes. Después continúa el turno enemigo.</span></div><div className="ja2-interrupt-units" aria-label="Combatientes disponibles">{turn.units.map((p:any)=><button key={p.id} disabled={busy} aria-pressed={p.id===selected} onClick={()=>selectUnit(p.id)}>{p.nickname||p.name} · {p.ap} PA</button>)}</div><button className="line-button" disabled={busy} onClick={nextTurn}>Continuar turno enemigo</button></section>}
      </div>
      <div className="field-wrap">
      <div className={`tactical-turn-bar ${turn.interrupted?'interrupt':s.phase==='enemy'?'enemy':'player'}`} role={turn.interrupted?'status':undefined} aria-label={turn.interrupted?'Interrupción':s.phase==='enemy'?'Turno enemigo':'Turno del jugador'}>{turn.interrupted?'Interrupción · Actuá con los PA restantes':''}</div>
      {feedbackPopup&&<aside className="tactical-feedback-popup" role="status">{feedbackPopup}</aside>}
      <div className="tactical-quick-tools" role="toolbar" aria-label="Acciones tácticas">
        <button title="Recoger o interactuar · Ctrl+clic" aria-label="Recoger o interactuar" aria-pressed={mode==='loot'} disabled={busy||!unitCanAct(s,u)} onClick={()=>setMode(mode==='loot'?'move':'loot')}><Hand/></button>
        <button title="Girar a la izquierda" aria-label="Girar a la izquierda" disabled={busy||!unitCanAct(s,u)} onClick={()=>turnUnit(-1)}><RotateCcw/></button>
        <button title="Girar a la derecha" aria-label="Girar a la derecha" disabled={busy||!unitCanAct(s,u)} onClick={()=>turnUnit(1)}><RotateCw/></button>
        <button title="Hablar · J" aria-label="Hablar" aria-pressed={mode==='talk'} disabled={busy||!unitCanAct(s,u)} onClick={()=>setMode(mode==='talk'?'move':'talk')}><MessageCircle/></button>
        <button title="Campo de visión · V" aria-label="Campo de visión" aria-pressed={showSight} onClick={()=>setShowSight(v=>!v)}><Eye/></button>
        <button title="Subir postura · RePág" aria-label="Subir postura" disabled={busy||!unitCanAct(s,u)||u?.stance==='standing'} onClick={()=>stepStance(-1)}><ChevronUp/></button>
        <button title="Bajar postura · AvPág" aria-label="Bajar postura" disabled={busy||!unitCanAct(s,u)||u?.stance==='prone'} onClick={()=>stepStance(1)}><ChevronDown/></button>
      </div>
      <BattlePerformance/><svg data-enemy-frame={presentation.frame?`${presentation.frame.index}:${presentation.frame.unitId??"unseen"}:${presentation.frame.type}:${presentation.frame.action}`:undefined} ref={fieldRef} style={{touchAction:'none'}} onFocusCapture={event=>{const bounds=(event.target as SVGElement).getBoundingClientRect();setCursorPoint(svgPoint({currentTarget:event.currentTarget,clientX:bounds.left+bounds.width/2,clientY:bounds.top+bounds.height/2}));}} onMouseMoveCapture={event=>{if(!pickedItem)setCursorPoint(svgPoint(event));setMovementIntent(pointerMovementIntent(event));setItemIntent(pointerItemIntent(event));}} onClickCapture={event=>{clickCount.current=Math.max(1,event.detail);additiveClick.current=event.shiftKey;clickMovementIntent.current=pointerMovementIntent(event);setMovementIntent(clickMovementIntent.current);clickItemIntent.current=pointerItemIntent(event);setItemIntent(clickItemIntent.current);}} onKeyDownCapture={event=>{if(['Enter',' '].includes(event.key)){clickCount.current=1;if(event.shiftKey&&event.repeat){event.preventDefault();event.stopPropagation();return;}additiveClick.current=event.shiftKey;clickMovementIntent.current=pointerMovementIntent(event);setMovementIntent(clickMovementIntent.current);clickItemIntent.current=pointerItemIntent(event);}}} onContextMenu={aimAtPointer} onMouseLeave={()=>setCursorPoint(null)} className={`tactical-field ${!pickedItem&&aimedCursorMode(mode)&&cursorPoint&&!busy?'aiming':''}`} viewBox={`0 0 ${viewWidth} ${viewHeight}`} role="group" aria-label="Campo táctico. Seleccioná un soldado y una casilla. Rueda o panel táctil: desplazar mapa. Mayús+rueda: desplazar horizontalmente. Pellizcá con dos dedos para acercar o alejar.">
        {/* Camera motion changes one transform. The root viewport dimensions stay
            fixed, so walking does not lay out every nested sprite SVG again. */}
        <g data-scene-camera="true" transform={`translate(${-cameraX} ${-cameraY})`}>
        <TacticalScene cursorLevel={cursorLevel} viewport={sceneViewport} state={field} selected={selected} unit={u} players={players} units={renderedUnits} positions={motion.positions} poses={presentation.frame?.unitId?{...poses,[presentation.frame.unitId]:battleFramePose(presentation.frame)}:poses} directions={directions} hover={hover} mode={pickedItem?'inventory':mode} aim={aim} hitLocation={hitLocation} reachable={reachable} routesPending={routePreview.working} showSight={showSight} sight={sight} revealed={revealedBuildingRooms} project={project} onTile={tileClick} onHover={hoverTarget} onTalk={openTalk} onCannon={(id)=>{const itemPoint=s.artillery?.find((gun:any)=>gun.id===id);if(itemPoint&&placeInventoryItem({...itemPoint,id:undefined}))return;if(mode==='throwKnife'||grenadeTargetingMode(u,mode)){const point=s.artillery?.find((gun:any)=>gun.id===id);if(point)tileClick(point);return;}setCannonId(id);setMode('artillery')}} cannonId={cannonId}/>
        {!pickedItem&&!busy&&u&&<MovementCursor state={s} unit={u} preview={preview} project={project} scale={1/zoom}/>}
        {failedDestination&&<g key={failedDestination.id} className="tactical-action-failure" data-action-failed="true" aria-label="Orden no disponible" pointerEvents="none" transform={`translate(${projectSurface(s,project,failedDestination).x} ${projectSurface(s,project,failedDestination).y}) scale(${1/zoom})`}><path d="M-7-7L7 7M7-7L-7 7"/></g>}
        {(presentation.frame?.impacts??[]).map((impact:any)=>{const point=projectSurface(s,project,impact);return <g key={`${presentation.frame.index}:${impact.victimKind??'unit'}:${impact.unitId}`} data-hit-reaction={impact.unitId} className="tactical-hit-reaction" transform={`translate(${point.x} ${point.y-20})`}><path d="M-16-8l-5-6M16-8l5-6M-18 6l7 2M18 6l7 2"/><text y="-30" textAnchor="middle">−{Math.ceil(impact.damage)}</text></g>;})}
        {presentation.frame?.shotVisual&&<FirearmShotEffect key={`shot-${presentation.frame.index}`} state={s} visual={presentation.frame.shotVisual} stage={presentation.frame.type} project={project}/>}
        {(presentation.frame?.knifeVisual??knifeEffect)&&<KnifeThrowEffect key={presentation.frame?.knifeVisual?`action-${presentation.frame.index}`:knifeEffect!.id} state={s} visual={presentation.frame?.knifeVisual??knifeEffect!.visual} project={project}/>}
        {(presentation.frame?.grenadeEffect??grenadeEffect)&&<GrenadeThrowEffect key={presentation.frame?.grenadeEffect?`enemy-${presentation.frame.grenadeEffect.id}`:grenadeEffect!.id} state={s} visual={(presentation.frame?.grenadeEffect??grenadeEffect)!.visual} project={project}/>}
        {grenadeLanding&&!pickedItem&&<g data-grenade-landing="true" transform={`translate(${grenadeLanding.x} ${grenadeLanding.y})`} pointerEvents="none" aria-label={`Caída prevista: ${preview.landingLabel}`}>
          <ellipse rx="18" ry="9" fill="#ed9d7c" fillOpacity=".15" stroke="#ed9d7c" strokeWidth="1.5"/>
          <path d="M-5-3L5 3M5-3L-5 3" stroke="#ed9d7c" strokeWidth="1.5"/>
          <text y="-13" textAnchor="middle" fill="#ed9d7c" stroke="#11190f" strokeWidth="2" paintOrder="stroke" fontSize="10">Caída</text>
        </g>}
        {!pickedItem&&aimedCursorMode(mode)&&cursorPoint&&!busy&&unitCanAct(s,u)&&<AimCursor exploring={s.mode==='exploration'} point={cursorPoint} aim={aim} preview={preview} target={hover} scale={1/zoom} bounds={{x:cameraX,y:cameraY,width:viewWidth,height:viewHeight}}/>}
        {pickedItem&&<InventoryMapCursor state={field} preview={itemPreview} target={mapItemTarget} project={project}/>}
        </g>
      </svg>
      {talking&&<JA2Conversation dialogue={dialogues?.[talking.id]} hireTerms={hireTerms?.[talking.id]} npc={talking} conversation={giftReply?.id===talking.id?giftReply.conversation:conversation} responseOnly={giftReply?.id===talking.id&&giftReply.responseOnly} quest={quests?.[talking.id]} reason={!onTalk?'Esta conversación necesita una campaña activa.':talkingAvailability.reason} availability={talkingAvailability} canApproach={Boolean(onTalk&&talkingAvailability.canApproach&&!busy&&u&&unitCanAct(s,u)&&canSee(s,u,talking)&&(s.mode==='exploration'||s.sectorCleared)&&talkingApproach)} onApproach={()=>{if(talkingApproach)order(movementAction(talkingApproach));}} onTalk={(approach,term,choice)=>{setGiftReply(null);onTalk?.(talking.id,approach,selected,term,choice);}} onClose={()=>{setTalking(null);setGiftReply(null);}}/>}
      {speech&&<JA2Speech name={speech.name} text={speech.text} position={{left:Math.max(15,Math.min(85,(projectSurface(s,project,speech).x-cameraX)/viewWidth*100)),top:Math.max(38,Math.min(85,(projectSurface(s,project,speech).y-cameraY-42)/viewHeight*100))}} onClose={()=>setSpeech(null)}/>}
      {preview&&!preview.movement&&<aside className={`ja2-target-preview ${preview.valid?'':'unavailable'}`} aria-label="Vista previa de la orden"><strong>{preview.name}</strong><span>{!pickedItem&&preview.chance!==undefined?`${preview.hitLocation||preview.attackLabel||'Ataque'} · ${chancePercent(preview.chance)} de ${preview.chanceLabel||'impacto'} · `:preview.actionLabel?`${preview.actionLabel} · `:''}{preview.pa!==undefined&&(!pickedItem||preview.valid)&&s.mode!=='exploration'?`${preview.pa} PA · ${preview.remaining} PA restantes`:''}</span>{preview.coverNote&&<span>{preview.coverNote}</span>}{preview.reason&&<span>{preview.reason}</span>}</aside>}
      {!presentation.busy&&s.status!=='active'&&<div className="battle-result"><p className="eyebrow">PARTE DE GUERRA</p><h2>{s.status==='victory'?'¡Victoria patriota!':s.status==='retreat'?'Retirada completada':'La escuadra ha caído'}</h2><p>{s.status==='victory'?'El enemigo abandona el campo. La patria avanza.':s.status==='retreat'?'La salida quedó registrada. Los combatientes conservan sus heridas y su equipo.':'Reorganizá las tropas y prepará una nueva ofensiva.'}</p><>{s.status==='victory'&&<button className="line-button" onClick={()=>onChange(actBattle(s,{type:'explore'}))}>Explorar el sector y recoger equipo</button>}<button className="gold-button" onClick={onFinish}>Volver a la campaña <ChevronRight size={16}/></button></></div>}
    </div>
    </div>
    {lootPoint&&u&&<JA2LootPicker battle={s} unit={u} point={lootPoint} busy={busy} onClose={()=>setLootPoint(null)} onTake={action=>{setLootPoint(null);order(action);}}/>}
    <JA2Strip
      battle={s}
      ambientPaused={ambientPaused}
      onToggleAmbientPause={()=>setAmbientPaused(paused=>!paused)}
      selected={selected}
      groupIds={movementGroupIds}
      unit={u}
      players={players}
      missionAllies={missionAllies}
      localMilitia={localMilitia}
      mode={mode}
      target={hover&&renderedUnits.find((target:any)=>target.side!==u?.side&&target.hp>0&&!target.surrendered&&sameCell(target,hover)&&(hover.id?target.id===hover.id:true))}
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
      busy={busy||Boolean(lootPoint)}
      inventoryId={inventoryId}
      cursorLevel={cursorLevel}
      onCursorLevelChange={changeCursorLevel}
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
      onOpenInventory={(id)=>{if(inventoryId===id&&equipmentStore.getSnapshot().selection){equipmentStore.report('Colocá o devolvé el objeto antes de cerrar el equipo.');return;}if(equipmentStore.getSnapshot().selection?.unitId&&equipmentStore.getSnapshot().selection?.unitId!==id){equipmentStore.report('Colocá o devolvé el objeto antes de cambiar de combatiente.');return;}const p=players.find((x:any)=>x.id===id);if(p){clearGroup();setSelected(id);setInventoryId(current=>current===id?null:id);}}}
      onCloseInventory={()=>{if(equipmentStore.getSnapshot().selection){equipmentStore.report('Colocá o devolvé el objeto antes de cerrar el equipo.');return;}setInventoryId(null);}}
      onCameraCenter={centerCamera}
      onCameraPan={panCamera}
      onZoom={delta=>setZoom(value=>Math.max(1,Math.min(3,value+Math.sign(delta))))}
      onCannonChange={(id)=>setCannonId(id)}
      onShotTypeChange={(t)=>setShotType(t)}
      onSetAim={(n)=>setAim(Math.max(0,Math.min(maxAim,n)))}
      onHitLocationChange={setHitLocation}
    />
    {bandageReport?.untreated.length>0&&!inventoryId&&<aside className="battle-error" role="status"><span>{bandageReport.stoppedReason} {bandageReport.untreated.length} heridos pendientes.</span><button className="line-button" onClick={()=>setBandageReport(null)}>Cerrar aviso</button></aside>}

    {missionAllies.length>0&&<details className="local-garrison" aria-label="Aliados de la misión"><summary>Oficiales aliados · {missionAllies.length} temporales</summary><div className="squad-strip">{missionAllies.map((p:any)=><button key={p.id} className={`squad-card ${p.id===selected?'active':''} ${!isAlive(p)?'fallen':''}`} onClick={event=>selectUnit(p.id,event.shiftKey)} disabled={!unitCanAct(s,p)} aria-label={`Seleccionar aliado ${p.name}`}><div><strong>{p.name}</strong><span>{isAlive(p)?`${Math.ceil(p.hp)} SALUD · ${p.ap} PA`:'Fuera de combate'}</span></div></button>)}</div><small>Estos aliados participan en esta misión; no ocupan un contrato ni una plaza permanente en tu escuadra.</small></details>}
    {localMilitia.length>0&&<details className="local-garrison"><summary>Guarnición local · {localMilitia.length} milicianos</summary><p>La milicia combate por su cuenta después del enemigo y responde a las interrupciones con sus PA restantes. Podés darle equipo y vendar a sus heridos.</p><div className="squad-strip">{localMilitia.map((p:any,index:number)=><div aria-label={`Miliciano ${index+1}: ${p.name}`} key={p.id} className={`squad-card ${!isAlive(p)?'fallen':''}`}><div><strong>{index+1}. {p.name}</strong><span>{p.unconscious?'Inconsciente':!isAlive(p)?'Fuera de combate':`${Math.ceil(p.hp)} SALUD · ${p.ap} PA`}</span></div></div>)}</div></details>}

  </section>;
}
