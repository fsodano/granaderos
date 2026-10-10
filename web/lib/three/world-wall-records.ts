import type {WorldInput,WorldTile} from './world-types';
/** Wall artwork uses the edge centre; source coordinates remain available for targeting. */
export function worldWallRecords(input:WorldInput):WorldTile[]{
 const terrain=input.terrain;
 if(terrain.wallEdges!==undefined)return terrain.wallEdges.filter(edge=>['wall','door','window'].includes(edge.type)).map(edge=>({...edge,edgeX:edge.x,edgeY:edge.y,x:edge.x-(edge.axis==='y'?.5:0),y:edge.y-(edge.axis==='x'?.5:0)}));
 return terrain.tiles.filter(tile=>['wall','door','window'].includes(tile.type)) as WorldTile[];
}
export function wallAtPoint(walls:readonly WorldTile[],point:{x:number;y:number},type?:string){
 return walls.filter(tile=>(!type||tile.type===type)&&(tile.axis==='x'?Math.abs(tile.y-point.y)<1e-8&&Math.abs(tile.x-point.x)<=.500001:tile.axis==='y'?Math.abs(tile.x-point.x)<1e-8&&Math.abs(tile.y-point.y)<=.500001:tile.x===point.x&&tile.y===point.y)).sort((a,b)=>Math.hypot(a.x-point.x,a.y-point.y)-Math.hypot(b.x-point.x,b.y-point.y)||(a.type==='wall'?-1:b.type==='wall'?1:0))[0];
}
/** Facade frames consume canonical authoring coordinates, not projected centres. */
export function wallFrameRecords(walls:readonly WorldTile[]){return walls.map(tile=>tile.axis?{...tile,x:tile.edgeX??tile.x,y:tile.edgeY??tile.y}:tile);}

/** Exterior artwork follows its facade plane, even where a partition ends. */
export function buildingWallAtPoint(walls:readonly WorldTile[],point:{x:number;y:number},building:{x:number;y:number;width:number;height:number},type?:string){
 if(!walls.some(wall=>wall.axis))return wallAtPoint(walls,point,type);
 const axes:string[]=[];
 if(Math.abs(point.x-(building.x-.5))<1e-8||Math.abs(point.x-(building.x+building.width-.5))<1e-8)axes.push('y');
 if(Math.abs(point.y-(building.y-.5))<1e-8||Math.abs(point.y-(building.y+building.height-.5))<1e-8)axes.push('x');
 return wallAtPoint(axes.length?walls.filter(wall=>wall.axis&&axes.includes(wall.axis)):walls,point,type);
}
