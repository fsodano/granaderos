import {BUILDING_TEMPLATES} from '../../../game/map-templates.js';
import {blankMap} from '../../../game/map-schema.js';
import {applyMapCommands} from '../../../game/map-commands.js';
import {compileMap} from '../../../game/compile-map.js';
import {entranceFrame} from '../../../game/building-profile.js';
import {createBattle,actBattle} from '../../../game/tactical.js';
import {directionTo} from '../../../game/tactical-awareness.js';
import {propBlocksAt} from '../../../game/props.js';

export const ARCHITECTURE_REVIEW_TEMPLATES=Object.freeze(Object.entries(BUILDING_TEMPLATES).map(([id,template])=>Object.freeze({id,label:template.name})));
export const ARCHITECTURE_REVIEW_VIEWS=Object.freeze(['exterior','partial','interior']);
const key=point=>`${point.x},${point.y}`;

/** Review visits use legal ground movement and door orders. They do not set
 * revealedRooms or override the renderer's ordinary disclosure rules. */
function visit(battle,room){
 const unit=battle.units[0],goals=new Set(room.cells.filter(cell=>!propBlocksAt(battle,cell.x,cell.y)).map(key));
 if(goals.has(key(unit)))return battle;
 const tiles=new Map(battle.tiles.map(tile=>[key(tile),tile])),queue=[{x:unit.x,y:unit.y}],previous=new Map([[key(unit),null]]);
 let destination;
 for(let n=0;n<queue.length&&!destination;n++){
  const point=queue[n];
  for(const [dx,dy]of [[1,0],[0,1],[-1,0],[0,-1]]){
   const next={x:point.x+dx,y:point.y+dy},cell=key(next),tile=tiles.get(cell);
   if(previous.has(cell)||!tile||propBlocksAt(battle,next.x,next.y)||tile.blocked&&(tile.type!=='door'||tile.locked))continue;
   previous.set(cell,point);queue.push(next);if(goals.has(cell)){destination=next;break;}
  }
 }
 if(!destination)throw Error(`No legal review route to ${room.id}`);
 const path=[];for(let point=destination;previous.get(key(point));point=previous.get(key(point)))path.unshift(point);
 for(const point of path){
  const door=battle.tiles.find(tile=>tile.x===point.x&&tile.y===point.y&&tile.type==='door');
  if(door&&!door.open)battle=order(battle,{type:'door',unitId:unit.id,doorId:door.doorId,open:true});
  battle=order(battle,{type:'move',unitId:unit.id,...point});
 }
 return battle;
}
function order(battle,action){
 const next=actBattle(battle,action);if(next.lastError)throw Error(`Architecture review ${action.type}: ${next.lastError}`);return next;
}

export function createArchitectureReviewBattle(templateId='casa',rotation=0,view='exterior'){
 if(!Object.hasOwn(BUILDING_TEMPLATES,templateId))throw Error(`Unknown building template: ${templateId}`);
 if(![0,90,180,270].includes(rotation))throw Error(`Unknown building rotation: ${rotation}`);
 if(!ARCHITECTURE_REVIEW_VIEWS.includes(view))throw Error(`Unknown building view: ${view}`);
 const template=BUILDING_TEMPLATES[templateId],size=Math.max(template.building.width,template.building.height)+10;
 const result=applyMapCommands(blankMap({id:`review-${templateId}-${rotation}`,title:template.name,width:size,height:size}),[
  {type:'stampTemplate',id:`review-${templateId}`,template,x:4,y:4},
  ...Array.from({length:rotation/90},()=>({type:'rotateObject',id:`review-${templateId}`})),
 ]);
 if(result.errors.length)throw Error(result.errors.join('; '));
 const map=compileMap(result.document),building=map.buildings[0],frame=entranceFrame(building),outside=frame.at(frame.doorU,-2);
 const guard={id:'architecture-guard',name:template.name,nickname:template.name,...outside,activeSlot:'unarmed',weapon:1800,loaded:1,ammo:12,blade:1810,spriteAppearance:'granadero',skinTone:'brown',headwear:null,outfit:null,legwear:null,condition:100,energy:100,agility:90,strength:85,dexterity:85,marksmanship:85,facing:directionTo(outside,{x:outside.x-frame.v.x,y:outside.y-frame.v.y})};
 let battle=createBattle([guard],{...map,id:`renderer-catalog-${templateId}-${rotation}-${view}`,name:template.name,seed:45,enemies:[],exploration:true});
 if(view!=='exterior'){
  // Start with the room reached from the main entrance, rather than assuming
  // that the first compiled room is the reception room.
  const door=frame.at(frame.doorU,0),rooms=[...building.rooms].sort((a,b)=>Math.min(...a.cells.map(cell=>Math.abs(cell.x-door.x)+Math.abs(cell.y-door.y)))-Math.min(...b.cells.map(cell=>Math.abs(cell.x-door.x)+Math.abs(cell.y-door.y))));
  battle=visit(battle,rooms[0]);
  if(view==='interior')for(const room of rooms)if(!battle.revealedRooms.includes(room.id))battle=visit(battle,room);
 }
 return {...battle,deploymentComplete:true};
}
