'use client';
import {useEffect,useRef,useState} from 'react';
import {Scene,WebGLRenderer,OrthographicCamera,Color,HemisphereLight,DirectionalLight,PCFShadowMap,SRGBColorSpace,ACESFilmicToneMapping,Frustum,Matrix4,Sphere,Vector3} from 'three';
import {createCombatEffects,type CombatEffectEvent} from '../lib/three/combat-effects';
import {createSectorWorld} from '../lib/three/sector-world';
import {ActorAssetLibrary} from '../lib/three/actor-assets';
import {ActorOcclusion,markActorMaterials} from '../lib/three/actor-occlusion';
import {ActorRuntime} from '../lib/three/actor-runtime';
import {resolveContactTargetModel} from '../lib/three/contact-target-model';
import {advanceSceneActors} from '../lib/three/scene-actors';
import {updateSectorCamera,TILE_METRES,characterLOD,type SectorCameraView} from '../lib/three/projection';
import type {WorldInput} from '../lib/three/world-types';
import type {ActorVisual} from '../lib/three/presentation';
import {sitePath} from '../lib/site-path.js';
import './tactical-three.css';

type Props={world:WorldInput;actors:readonly ActorVisual[];view:SectorCameraView;sceneId:string;effects?:readonly CombatEffectEvent[];ambientPaused?:boolean;onCueComplete?:(key:string,id:string)=>void};
type LiveActor={assetKey:string;generation:number;runtime?:ActorRuntime;visual?:ActorVisual;pending?:boolean;error?:boolean};
export default function TacticalThreeScene(props:Props){
  const canvas=useRef<HTMLCanvasElement>(null),latest=useRef(props);latest.current=props;
  const [status,setStatus]=useState('Cargando sector…'),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
  useEffect(()=>{
    const element=canvas.current;if(!element)return;
    setStatus('Cargando sector…');setFailed(false);
    let renderer:WebGLRenderer;try{renderer=new WebGLRenderer({canvas:element,antialias:true,stencil:true,alpha:false,powerPreference:'high-performance'});}catch(error){setStatus('No se pudo iniciar la vista del sector.');setFailed(true);return;}
    renderer.outputColorSpace=SRGBColorSpace;renderer.toneMapping=ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;renderer.shadowMap.enabled=true;renderer.shadowMap.type=PCFShadowMap;
    const scene=new Scene(),camera=new OrthographicCamera(),library=new ActorAssetLibrary(sitePath),actors=new Map<string,LiveActor>(),frustum=new Frustum(),projection=new Matrix4(),actorBounds=new Sphere(new Vector3(),3);
    const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    scene.background=new Color('#454b3a');const sky=new HemisphereLight('#dee9f0','#685b40',2.0);scene.add(sky);
    const sun=new DirectionalLight('#ffe2b9',3.0);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.normalBias=.025;sun.shadow.bias=-.0003;sun.shadow.camera.near=.5;sun.shadow.camera.far=160;scene.add(sun,sun.target);
    let alive=true,initialReady=false,request=0,last=performance.now(),worldInput:WorldInput|undefined,actorInput:readonly ActorVisual[]|undefined,frames=0,frameStart=last,failedMessage='';
    const report=(error:unknown)=>{const message=error instanceof Error?error.message:String(error);if(message!==failedMessage){failedMessage=message;console.error('[Tactical3D]',error);element.dataset.error=message;setStatus('No se pudo cargar parte del sector.');setFailed(true);}};
    const world=createSectorWorld(scene,{tileMetres:TILE_METRES,assetUrl:sitePath,onAssetError:report}),effects=createCombatEffects(scene,{tileMetres:TILE_METRES}),occlusion=new ActorOcclusion();
    let effectInput:readonly CombatEffectEvent[]|undefined,lastReduced:boolean|undefined;
    const ensure=(visual:ActorVisual,lod:number)=>{
      const mounted=visual.mounted||visual.cue?.fromPosture==='mounted'||['mount','dismount'].includes(visual.action),key=`${visual.appearance}:${lod}:${mounted}`,old=actors.get(visual.key);
      if(old?.assetKey===key)return;
      const entry:LiveActor={assetKey:key,generation:(old?.generation??0)+1,runtime:old?.runtime,visual:old?.visual,pending:true};actors.set(visual.key,entry);
      void library.actor(visual.appearance,lod,mounted).then(asset=>{
        if(!alive||actors.get(visual.key)!==entry)return;
        const current=latest.current.actors.find(actor=>actor.key===visual.key);if(!current)return;
        const runtime=new ActorRuntime(asset,current,(key,id)=>latest.current.onCueComplete?.(key,id),target=>resolveContactTargetModel(target,latest.current.actors,actors.get(target.key)));entry.runtime?.dispose();entry.runtime=runtime;entry.visual=current;entry.pending=false;markActorMaterials(runtime.root);scene.add(runtime.root);
      }).catch(error=>{if(!alive||actors.get(visual.key)!==entry)return;entry.pending=false;entry.error=true;report(error);});
    };
    const tick=(now:number)=>{
      if(!alive)return;request=requestAnimationFrame(tick);if(document.hidden){last=now;return;}
      const delta=Math.max(0,(now-last)/1000);last=now;
      const input=latest.current,bounds=element.getBoundingClientRect();if(!bounds.width||!bounds.height)return;
      const ratio=Math.min(window.devicePixelRatio||1,2);
      if(element.width!==Math.round(bounds.width*ratio)||element.height!==Math.round(bounds.height*ratio)){renderer.setPixelRatio(ratio);renderer.setSize(bounds.width,bounds.height,false);}
      updateSectorCamera(camera,input.view);
      frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
      const quiet=Boolean(reduced?.matches);
      if(worldInput!==input.world||lastReduced!==quiet){worldInput=input.world;try{world.update({...input.world,reducedMotion:quiet});}catch(error){report(error);}const night=Boolean(input.world.terrain.night);sky.intensity=night?.8:2;sun.intensity=night?.55:3;sun.color.set(night?'#b8ccef':'#ffe2b9');scene.background=new Color(night?'#111923':'#454b3a');}
      // Keep shadow coverage around the viewed cells rather than the whole campaign map.
      const centreX=((input.view.x+input.view.width/2-(input.view.mapHeight*26+28))/26+(input.view.y+input.view.height/2-65)/14)/2*TILE_METRES;
      const centreZ=(-(input.view.x+input.view.width/2-(input.view.mapHeight*26+28))/26+(input.view.y+input.view.height/2-65)/14)/2*TILE_METRES;
      sun.position.set(centreX-18,30,centreZ-12);sun.target.position.set(centreX,0,centreZ);const span=Math.max(12,input.view.width/29.747);Object.assign(sun.shadow.camera,{left:-span,right:span,top:span,bottom:-span});sun.shadow.camera.updateProjectionMatrix();
      const visible=new Set(input.actors.map(actor=>actor.key));for(const [key,entry]of actors)if(!visible.has(key)){entry.runtime?.dispose();actors.delete(key);}
      if(actorInput!==input.actors){actorInput=input.actors;world.updateActors?.(input.actors.map(actor=>({x:actor.position[0]/TILE_METRES,y:actor.position[2]/TILE_METRES,elevation:actor.position[1],tacticalLevel:actor.motion?.tacticalLevel??actor.tacticalLevel,activeClimbLink:actor.motion?.moving&&actor.motion.kind==='climb'?actor.motion.linkId:undefined})));}
      const pixelHeight=1.76*25.0666666667*bounds.width/input.view.width,lod=characterLOD(pixelHeight);
      for(const visual of input.actors)ensure(visual,lod);
      const activeActors=advanceSceneActors({visuals:input.actors,entry:key=>actors.get(key),active:visual=>{
        actorBounds.center.fromArray(visual.position);actorBounds.center.y+=1;return frustum.intersectsSphere(actorBounds);
      },delta,now,ambientPaused:input.ambientPaused,reducedMotion:Boolean(reduced?.matches),report});
      const selected=input.actors.find(actor=>actor.selected);occlusion.setActor(selected?actors.get(selected.key)?.runtime?.root??null:null);occlusion.sync();
      if(effectInput!==input.effects||lastReduced!==quiet){
        effectInput=input.effects;
        const events=input.effects?.map(event=>{
          const anchor=event.kind==='firearm'&&event.actorKey?actors.get(event.actorKey)?.runtime?.anchor('muzzle'):event.kind==='artillery'&&event.cannonId?world.anchor(event.cannonId,'muzzle'):null;
          return anchor?{...event,dischargeAnchor:{x:anchor.x/TILE_METRES,y:anchor.z/TILE_METRES,height:anchor.y}}:event;
        });
        effects.update({events,timeSeconds:now/1000,reducedMotion:quiet});
      }lastReduced=quiet;
      if(!input.ambientPaused)world.tick?.(delta,now/1000);effects.tick(delta,now/1000);renderer.render(scene,camera);frames++;
      if(now-frameStart>=1000){
        // Empty sectors are ready too. Wait for ground/building textures so
        // the initial loading state covers the complete admitted scene.
        if(!initialReady&&!failedMessage&&[...actors.values()].every(actor=>!actor.pending&&actor.runtime)&&world.inspect().pendingTextures===0){initialReady=true;setStatus('');}
        element.dataset.effects=String(effects.inspect().events.length);element.dataset.fps=(frames*1000/(now-frameStart)).toFixed(1);element.dataset.drawCalls=String(renderer.info.render.calls);element.dataset.triangles=String(renderer.info.render.triangles);element.dataset.actors=String(actors.size);element.dataset.loadedActors=String([...actors.values()].filter(actor=>actor.runtime).length);element.dataset.activeActors=String(activeActors);element.dataset.pendingActors=String([...actors.values()].filter(actor=>actor.pending).length);element.dataset.lod=String(lod);element.dataset.geometries=String(renderer.info.memory.geometries);element.dataset.textures=String(renderer.info.memory.textures);frames=0;frameStart=now;}
    };
    request=requestAnimationFrame(tick);
    const lost=(event:Event)=>{event.preventDefault();report(Error('WebGL context lost'));},restored=()=>setAttempt(value=>value+1);element.addEventListener('webglcontextlost',lost);element.addEventListener('webglcontextrestored',restored);
    return()=>{alive=false;cancelAnimationFrame(request);element.removeEventListener('webglcontextlost',lost);element.removeEventListener('webglcontextrestored',restored);for(const actor of actors.values())actor.runtime?.dispose();actors.clear();occlusion.dispose();effects.dispose();world.dispose();library.dispose();renderer.dispose();};
  },[props.sceneId,attempt]);
  return <><canvas key={attempt} ref={canvas} className="tactical-three-canvas" aria-hidden="true" data-sector-renderer="three"/>{status&&<div className={`tactical-three-status${failed?' failed':''}`} role="status">{status}{failed&&<button type="button" onClick={()=>setAttempt(value=>value+1)}>Volver a cargar la vista</button>}</div>}</>;
}
