'use client';
import {useMemo,useState} from 'react';
import TacticalThreeScene from '../TacticalThreeScene';
import {presentActors,presentWorld} from '../../lib/three/presentation';
import {sectorProject} from '../../lib/three/projection';
import {createBattle} from '../../../game/tactical.js';
import {createSceneTerrainCache} from '../../../game/scene-terrain.js';
import {weaponMetadata} from '../../../game/weapon-definition.js';
import {characterPresentationDefaults,authoredPresentation} from '../../../game/content-character-presentation.js';
import {startingCharacterSupplies} from '../../../game/character-supplies.js';
import {sitePath} from '../../lib/site-path.js';

export function characterPreviewScene(content:any,character:any,{direction=3,motion='idle',posture='standing',equipment='primary'}:any={}){
  const primary=content.weapons.find((w:any)=>w.id===character.weapon),blade=content.weapons.find((w:any)=>w.id===character.blade),presentation=characterPresentationDefaults(character,content);
  const actor={...character.attributes,...startingCharacterSupplies(character),...authoredPresentation(character),spriteAppearance:presentation.spriteAppearance,skinTone:presentation.skinTone??'brown',genericCharacter:true,id:'preview',name:character.name,x:3,y:3,hp:character.attributes.maxHp,weapon:primary?.template??0,blade:blade?.template??0,...(primary?{weaponMetadata:weaponMetadata(primary)}:{}),...(blade?{bladeMetadata:weaponMetadata(blade)}:{}),facing:(direction+7)%8,stance:posture==='standing'?'standing':posture,movementMode:motion==='run'?'run':posture==='prone'?'prone':'walk',activeSlot:equipment==='none'?'unarmed':equipment,leftHandItem:equipment==='none'?null:undefined,weaponReady:motion==='aim',traits:character.traits??[],abilities:character.abilities??[]};
  const battle=createBattle([actor],{id:'studio-character-preview',sector:'studio-character-preview',name:'Vista del personaje',width:7,height:7,enemies:[],npcs:[],exploration:true,tiles:Array.from({length:49},(_,i)=>({x:i%7,y:Math.floor(i/7),type:'grass',blocked:false,cover:0})),campaignPackage:content});
  battle.campaignPackage=content;
  const unit=battle.units[0],entries=[{key:'unit:preview',kind:'unit' as const,actor:unit}],rooms=new Set<string>(),yaw=(5-direction)*Math.PI/4;
  const positions:any=motion==='walk'||motion==='run'?{'unit:preview':{x:3,y:3,direction,moving:true,frame:0,travelX:Math.sin(yaw),travelY:Math.cos(yaw)}}:{};
  const actors=presentActors(battle,entries,positions,rooms,{selected:'preview',mode:motion==='aim'?'fire':'move'}),world=presentWorld(battle,createSceneTerrainCache()(battle),[unit],rooms,entries,0),point=sectorProject(7)(3,3);
  return {actors,world,view:{x:point.x-115,y:point.y-145,width:230,height:220,mapHeight:7}};
}

export default function CharacterPreview({content,character,resolveAsset=sitePath}:{content:any;character:any;resolveAsset?:(reference:string)=>string}){
 const [direction,setDirection]=useState(3),[motion,setMotion]=useState('idle'),[posture,setPosture]=useState('standing'),[equipment,setEquipment]=useState('primary');
 const preview=useMemo(()=>{
  try{return characterPreviewScene(content,character,{direction,motion,posture,equipment});}catch(error:any){return {error:error.message};}
 },[content,character,direction,motion,posture,equipment]);
 if('error' in preview)return <section aria-label="Vista 3D del personaje"><p role="alert">Completá una ficha válida para abrir la vista: {preview.error}</p></section>;
 return <section className="studio-character-preview" aria-label={`Vista 3D de ${character.name}`}>
  <h3>Vista 3D del personaje</h3>
  <p>Usa el mismo modelo, piel y equipo que el juego. Estas opciones solo cambian la vista.</p>
  <div className="studio-character-stage" style={{position:'relative',height:300}}><TacticalThreeScene {...preview} sceneId="studio-character-preview"/></div>
  <img className="studio-portrait-preview" src={resolveAsset(character.portrait)} alt={`Retrato de ${character.name}`} width={96} height={96}/>
  <div className="fields">
   <label>Dirección de la vista<select value={direction} onChange={e=>setDirection(Number(e.target.value))}>{['N','NE','E','SE','S','SO','O','NO'].map((name,index)=><option key={name} value={index}>{name}</option>)}</select></label>
   <label>Movimiento de la vista<select value={motion} onChange={e=>setMotion(e.target.value)}><option value="idle">Reposo</option><option value="walk">Caminar</option><option value="run">Correr</option><option value="aim">Apuntar</option></select></label>
   <label>Postura de la vista<select value={posture} onChange={e=>setPosture(e.target.value)}><option value="standing">De pie</option><option value="crouched">Agachado</option><option value="prone">Tendido</option></select></label>
   <label>Equipo en la vista<select value={equipment} onChange={e=>setEquipment(e.target.value)}><option value="primary">Arma principal</option><option value="blade">Arma blanca</option><option value="none">Manos libres</option></select></label>
  </div>
 </section>;
}
