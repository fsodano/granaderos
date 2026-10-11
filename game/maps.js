import {wallMovementBlocked} from './wall-geometry.js';
import {mapLibrary} from './map-library.js';
import {compileMap} from './compile-map.js';
import {worldCellPlan} from './world-cell-map.js';
import {worldCell} from './world-cells.js';
import {expandSectorMap} from './sector-expansion.js';
import {propBlocksAt} from './props.js';
import {campaignSectors,campaignDefinitions,campaignWorld,campaignPresentation} from './campaign-definition.js';
import {tacticalLevel,validateTacticalSpace} from './tactical-space.js';
import {campaignTerraces} from './campaign-terraces.js';
import {connectWorldCellApproaches} from './world-cell-approaches.js';
import {hasGenericCharacterDefinitions} from './content-character-ids.js';
import {authoredForceEquipment} from './content-force-equipment.js';
import {campaignRules} from './campaign-rules.js';
import {applyCampaignBuildingStyles} from './campaign-building-styles.js';
import {roadsideDiscoveryProps} from './roadside-discoveries.js';

// Authored tactical plans. Buildings are solid footprints, never walkable painted facades.
// The strategic grid is schematic; these tactical layouts are original gameplay maps,
// not archaeological reconstructions or surveyed historical plans.
export const MAP_IDS=Object.keys(mapLibrary());
const WIDTH=20,HEIGHT=16;
const clone=value=>JSON.parse(JSON.stringify(value));
function plan(id,definitions,context){
 const doc=mapLibrary(context)[id];if(!doc)return worldCellPlan(id,definitions,context);
 const map=compileMap(doc),cell=worldCell(id,context)?.id??id,discoveries=roadsideDiscoveryProps(cell,definitions);
 return {...map,title:doc.metadata?.title,props:[...(map.props??[]),...discoveries.filter(d=>!map.props?.some(p=>p.id===d.id))]};
}
const key=p=>`${p.x},${p.y}`;
function connected(tiles,start,props=[],wallEdges=[]){
 const reached=new Set([key(start)]),queue=[start];while(queue.length){const p=queue.shift();for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const x=p.x+dx,y=p.y+dy,t=tiles[y*WIDTH+x];if(x>=0&&x<WIDTH&&y>=0&&y<HEIGHT&&t&&!t.blocked&&!propBlocksAt({props},x,y)&&!wallMovementBlocked({wallEdges},p,t)&&!reached.has(key(t))){reached.add(key(t));queue.push(t);}}}return reached;
}
function buildCompactSectorMap(request={},restorePrevious=false){
 const {campaignPackage,...storedRequest}=request;
 const id=request.sceneId??request.sector??request.id??campaignPresentation(request).skirmish?.request.id??campaignSectors(request)[0].id;const authored=plan(id,request.roadsideDiscoveryDefinitions,request),tiles=authored.tiles;
 const world=campaignWorld(request),deployment={...world.defaultDeployment,...world.deployment?.[id]},authoredPlayers=authored.spawns?.filter(s=>s.side==='player')??[],authoredEnemies=authored.spawns?.filter(s=>s.side==='enemy')??[];
 const playerAnchors=deployment.playerAnchors??(authoredPlayers.length?authoredPlayers:[{x:1,y:4}]),enemyAnchors=deployment.enemyAnchor?[deployment.enemyAnchor]:authoredEnemies.length?authoredEnemies:[{x:17,y:3}];
 const customSpace=request.upperSurfaces!==undefined||request.climbLinks!==undefined||authored.upperSurfaces!==undefined||authored.climbLinks!==undefined;
 const surfaces=request.upperSurfaces??authored.upperSurfaces,links=request.climbLinks??authored.climbLinks;
 const elevation=customSpace?{...(surfaces!==undefined?{upperSurfaces:surfaces}:{}),...(links!==undefined?{climbLinks:links}:{})}:restorePrevious?{}:campaignTerraces({...authored,width:WIDTH,height:HEIGHT});
 // Saved actors use the saved topology, restored by world.js after this scaffold.
 // Fresh upper posts must be admitted at their authored coordinates before cloning.
 if(!restorePrevious)validateTacticalSpace({...authored,width:WIDTH,height:HEIGHT,...elevation,units:(request.enemies??[]).filter(unit=>tacticalLevel(unit)!==0)});
 const open=tiles.filter(t=>!t.blocked&&!propBlocksAt(authored,t.x,t.y));const component=connected(tiles,open.find(t=>t.x<=2&&t.y>=5)??open[0],authored.props,authored.wallEdges);
 const reserved=new Set(),choose=(preferred,side)=>{
   const candidates=open.filter(t=>component.has(key(t))&&!reserved.has(key(t)));
   candidates.sort((a,b)=>{
     const da=Math.abs(a.x-preferred.x)+Math.abs(a.y-preferred.y),db=Math.abs(b.x-preferred.x)+Math.abs(b.y-preferred.y);
     return da-db||(side==='player'?a.x-b.x:b.x-a.x)||a.y-b.y;
   });
   if(!candidates.length)throw Error('El mapa no tiene posiciones de despliegue suficientes.');
   reserved.add(key(candidates[0]));return{x:candidates[0].x,y:candidates[0].y};
 };
 const squad=(request.squad??[]).map((op,i)=>{const anchor=playerAnchors[i%playerAnchors.length];return {...clone(op),...choose({x:anchor.x,y:anchor.y+Math.floor(i/playerAnchors.length)},'player')};});
 const content=campaignDefinitions(request),generic=hasGenericCharacterDefinitions(content),forceState={contentCampaign:{package:content}};
 const enemyCount=request.enemies?.length??Math.max(3,squad.length+(request.difficulty??1)-1);
 const enemies=Array.from({length:enemyCount},(_,i)=>{
  const base={id:`enemy-${i}`,name:`Combatiente adversario ${i+1}`,weapon:generic?0:i%3===0?1801:1800,marksmanship:50+(request.difficulty??1)*5,morale:60+(request.difficulty??1)*5,...(generic?{blade:0,loaded:0,ammo:0,spriteAppearance:'worker',skinTone:'brown'}:{})};
  const raw=request.enemies?.[i]??(generic?authoredForceEquipment(forceState,'oppositionEquipment',i===0?'officer':i%3===0?'veteran':'line',base,campaignRules(forceState).enemyCartridges):{}),upper=tacticalLevel(raw)!==0;
  const anchor=enemyAnchors[i%enemyAnchors.length];
  return {...base,...clone(raw),...(upper?{}:choose({x:anchor.x,y:anchor.y+Math.floor(i/enemyAnchors.length)%10},'enemy'))};
 });
 const artillery=(request.artillery??Array.from({length:Math.min(request.cannons??0,3)},()=>({type:'bronze4',side:'player',loaded:true,ammo:6}))).map((gun,i)=>gun.stationed?clone(gun):({...clone(gun),...choose({x:3,y:4+i*3},'player')}));
 return {map:{...clone(storedRequest),...elevation,...(authored.worldCell?{worldCell:true}:{}),groundItems:authored.groundItems,sourceMapId:authored.sourceMapId,sourceMapRevision:authored.sourceMapRevision,sector:request.sceneId?request.sector:id,name:request.name??authored.title??worldCell(id,request)?.name,width:WIDTH,height:HEIGHT,tiles,wallEdges:authored.wallEdges??[],wallGeometryVersion:2,decor:authored.decor,props:authored.props,buildings:authored.buildings,lights:authored.lights,squad,enemies,artillery,mapTitle:authored.title??worldCell(id,request)?.name},boundaryRoads:authored.boundaryRoads,customSpace};
}

export function buildSectorMap(request={}, {restorePrevious=false}={}){
 const {map:core,boundaryRoads,customSpace}=buildCompactSectorMap(request,restorePrevious);
 const map=request.compactLayout===true?core:expandSectorMap(core,boundaryRoads,request);
 applyCampaignBuildingStyles(map,request);
 if(!restorePrevious&&request.compactLayout!==true)connectWorldCellApproaches(map,request);
 // Neighbourhood lots and their props only exist after expansion. Derive all
 // fresh accesses there; saved maps and explicit authored fixtures keep theirs.
 if(!restorePrevious&&request.compactLayout!==true&&request.upperSurfaces===undefined&&request.climbLinks===undefined&&!customSpace)Object.assign(map,campaignTerraces(map));
 return map;
}
