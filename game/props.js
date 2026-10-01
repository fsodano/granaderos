import {sameCell,sameSurface,spaceKey,surfaceHeight,surfacesAtLevel,tacticalLevel} from './tactical-space.js';
// Serializable tile footprints. Legacy props retain their original one-cell size.
export const PROP_TYPES=['table','bench','bed','chest','barrels','hay','cart'];
export function propSize(prop){return prop.footprint??{width:1,height:1};}
export function propCells(prop){
 const {width,height}=propSize(prop),cells=[];
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)cells.push({x:prop.x+x,y:prop.y+y,...(prop.tacticalLevel===undefined?{}:{tacticalLevel:prop.tacticalLevel})});
 return cells;
}
export function propBlocksAt(state,x,y,level=0){return (state.props??[]).some(p=>{
 const {width,height}=propSize(p);
 return tacticalLevel(p)===level&&p.blocksMovement!==false&&x>=p.x&&x<p.x+width&&y>=p.y&&y<p.y+height;
});}
const key=spaceKey;
const adjacent=(a,b)=>sameSurface(a,b)&&Math.abs(a.x-b.x)+Math.abs(a.y-b.y)===1;
// Pure placement check shared by authored maps and a future editor. Closed doors
// count as potential entrances, so opening one later still gives room access.
export function propPlacementError(state,prop){
 const size=propSize(prop);
 if(!PROP_TYPES.includes(prop.type)||!Number.isInteger(prop.x)||!Number.isInteger(prop.y)||!Number.isInteger(size.width)||!Number.isInteger(size.height)||size.width<1||size.height<1||size.width>8||size.height>8)return 'Invalid furniture footprint.';
 if((state.props??[]).some(p=>p.id===prop.id))return 'Duplicate furniture ID.';
 const cells=propCells(prop),tiles=new Map(surfacesAtLevel(state,tacticalLevel(prop)).map(t=>[key(t),t]));
 const occupied=new Set((state.props??[]).flatMap(propCells).map(key));
 if(cells.some(c=>!tiles.has(key(c))||tiles.get(key(c)).blocked||tiles.get(key(c)).type==='door'||occupied.has(key(c))||surfaceHeight(state,c)!==surfaceHeight(state,prop)))return 'Furniture overlaps an obstacle or another object.';
 const room=(state.buildings??[]).flatMap(b=>b.rooms??[]).find(r=>r.id===prop.roomId);
 if(prop.roomId&&!room)return 'Unknown room.';
 if(room&&!cells.every(c=>room.cells.some(t=>key(c)===key(t))))return 'Furniture must fit inside its room.';
 if(!room||prop.blocksMovement===false)return null;
 const proposed={...state,props:[...(state.props??[]),prop]};
 const free=room.cells.filter(c=>!tiles.get(key(c))?.blocked&&!propBlocksAt(proposed,c.x,c.y,tacticalLevel(c)));
 if(!free.length)return 'Furniture leaves no walking space.';
 const entrances=surfacesAtLevel(state,tacticalLevel(prop)).filter(t=>t.type==='door'&&room.cells.some(c=>adjacent(c,t)));
 if(entrances.some(d=>!free.some(c=>adjacent(c,d))))return 'Furniture blocks a door approach.';
 const reached=new Set([key(free[0])]),queue=[free[0]],available=new Map(free.map(c=>[key(c),c]));
 for(let i=0;i<queue.length;i++)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
  const next=available.get(key({...queue[i],x:queue[i].x+dx,y:queue[i].y+dy}));
  if(next&&!reached.has(key(next))){reached.add(key(next));queue.push(next);}
 }
 if(reached.size!==free.length)return 'Furniture separates the walking space.';
 const roomProps=proposed.props.filter(p=>p.roomId===room.id);
 if(roomProps.some(p=>!propCells(p).some(c=>free.some(f=>adjacent(c,f)))))return 'Furniture has no accessible side.';
 return null;
}

// Park a cart beside a pulpería, never on a door approach or an occupied square.
export function placePulperiaCart(state,building){
 if(building.architecture!=='pulperia'||state.props.some(p=>p.id===`${building.id}:cart`))return false;
 const doors=state.tiles.filter(t=>t.type==='door');
 const people=[...(state.squad??[]),...(state.enemies??[]),...(state.artillery??[]),...(state.npcs??[])];
 const candidates=[{x:building.x,y:building.y+building.height+1},{x:building.x-2,y:building.y+building.height-2},{x:building.x+building.width,y:building.y+1}];
 for(const at of candidates){
  const prop={id:`${building.id}:cart`,type:'cart',...at,footprint:{width:2,height:1},blocksMovement:true};
  const cells=propCells(prop);
  if(cells.some(c=>doors.some(d=>Math.abs(c.x-d.x)+Math.abs(c.y-d.y)<=1)||people.some(p=>sameCell(p,c))||state.tiles.some(t=>t.x===c.x&&t.y===c.y&&t.buildingId)))continue;
  if(propPlacementError(state,prop))continue;
  state.props.push(prop);return true;
 }
 return false;
}
