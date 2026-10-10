import {getBuildingRenderProfile} from './building-profile.js';
import {buildingStyle} from './building-types.js';
import {BUILDING_OPENINGS} from './building-scale.js';
import {isInteriorVisible} from './tactical-visibility.js';
import {tacticalLevel} from './tactical-space.js';

// This is presentation geometry only. Callers must pass actors admitted by
// tactical sight before requesting a silhouette; discovery never grants sight.
export function foregroundOccludesActor(state,actor,project,revealed=new Set()){
 const at=project(actor.x,actor.y),level=tacticalLevel(actor);
 if(level)return false;
 const bodyTop=at.y-(actor.hp<=0||actor.unconscious||actor.stance==='prone'?18:46);
 const walls=(state.wallEdges??[]).map(edge=>({...edge,x:edge.x-(edge.axis==='y'?.5:0),y:edge.y-(edge.axis==='x'?.5:0)}));
 for(const tile of [...(state.tiles??[]),...walls]){
  if(tile.x+tile.y+.415<=actor.x+actor.y+.05)continue;
  const point=project(tile.x,tile.y);
  if(tile.type==='forest'){
   if(Math.abs(point.x-at.x)<38&&point.y+10>bodyTop&&point.y-110<at.y)return true;
   continue;
  }
  if(!['wall','door','window'].includes(tile.type)||Math.abs(point.x-at.x)>30)continue;
  const building=(state.buildings??[]).find(b=>b.id===tile.buildingId);
  const open=building?.rooms?.some(room=>revealed.has(room.id)&&room.cells.some(cell=>Math.abs(cell.x-tile.x)<=1&&Math.abs(cell.y-tile.y)<=1));
  const front=building&&(tile.y===building.y+building.height-(tile.axis?.5:1)||tile.x===building.x+building.width-(tile.axis?.5:1));
  const height=open&&front?BUILDING_OPENINGS.cutawayHeight:building?.architecture&&!building.kind?buildingStyle(building).height:getBuildingRenderProfile(building,revealed).wallHeight;
  if(point.y+6>bodyTop&&point.y-height-6<at.y)return true;
 }
 return false;
}

export function actorInteriorReadable(state,actor,position,revealed){
 // A commanded mercenary remains present while crossing a discovered doorway.
 // Enemy eligibility still comes from the caller's actual visible actor set.
 return actor.side==='player'||isInteriorVisible(state,actor,revealed)||
  Boolean(position?.moving&&isInteriorVisible(state,{...actor,...position,roomId:undefined},revealed));
}

export function corpseBloodShape(id=''){
 const seed=[...String(id)].reduce((value,char)=>value+char.charCodeAt(0),0);
 return {rx:11+seed%5,ry:4+seed%3,rotation:seed%35-17};
}
