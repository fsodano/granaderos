import type {Object3D, Vector3} from 'three';

/** Presentation records only. Simulation rosters are deliberately absent. */
export type WorldPoint={x:number;y:number;tacticalLevel?:number;elevation?:number};
export type WorldTile=WorldPoint&{id?:string;type:string;kind?:string;blocked?:boolean;cover?:number;material?:string;buildingId?:string|null;roomId?:string|null;slabThickness?:number;obstacleHeight?:number;open?:boolean;locked?:boolean;broken?:boolean;doorId?:string;style?:string};
export type WorldRoom={id:string;cells:readonly WorldPoint[];tacticalLevel?:number;ruined?:boolean};
export type WorldBuilding={id:string;x:number;y:number;width:number;height:number;kind?:string;architecture?:string;roof?:string;material?:string;wallFinish?:string;roofFinish?:string;doorStyle?:string;windowStyle?:string;rooms?:readonly WorldRoom[];walls?:readonly WorldTile[];ruined?:boolean;ruin?:boolean};
export type WorldProp=WorldPoint&{id:string;type:string;roomId?:string;buildingId?:string;footprint?:{width:number;height:number};rotation?:number;material?:string;obstacleHeight?:number;decorative?:boolean;blocksMovement?:boolean;open?:boolean;broken?:boolean;purpose?:string};
export type WorldLight=WorldPoint&{id?:string;type?:string;radius?:number;intensity?:number;extinguished?:boolean;turns?:number;remainingSeconds?:number};
export type WorldItem={id?:string;weapon?:string;blade?:string;item?:string;type?:string;kind?:string;outfit?:string;count?:number;fittings?:Readonly<Record<string,unknown>>};
export type WorldLoot=WorldPoint&WorldItem&{id?:string;items?:readonly WorldItem[]};
export type WorldCannon=WorldPoint&{id:string;type:string;side?:string;facing?:number;loaded?:boolean;reloadProgress?:number;profile?:{name?:string;crew?:number}};
export type WorldSmoke=WorldPoint&{id?:string;radius?:number;turns?:number;remainingSeconds?:number};
export type WorldTerrain={width:number;height:number;tiles:readonly WorldTile[];upperSurfaces?:readonly WorldTile[];buildings?:readonly WorldBuilding[];props?:readonly WorldProp[];lights?:readonly WorldLight[];climbLinks?:readonly {id:string;kind:string;from:WorldPoint;to:WorldPoint}[];night?:boolean;sectorId?:string;sceneId?:string};
export type WorldInput={
  terrain:WorldTerrain;
  revealedRooms?:ReadonlySet<string>|readonly string[];
  cursorLevel?:number;
  admittedActorPoints?:readonly WorldPoint[];
  loot?:readonly WorldLoot[];
  cannons?:readonly WorldCannon[];
  smoke?:readonly WorldSmoke[];
  /** Existing tileIllumination results, keyed by level:x,y. */
  illumination?:ReadonlyMap<string,number>|Readonly<Record<string,number>>;
  timeSeconds?:number;
  reducedMotion?:boolean;
};
export type WorldOptions={tileMetres:number;assetUrl:(path:string)=>string;onAssetError?:(error:Error)=>void};
export type WorldInspection={objects:number;meshes:number;triangles:number;chunks:number;semanticIds:readonly string[];pendingTextures:number;assetErrors:readonly string[];disposed:boolean};
export type SectorWorld={update:(input:WorldInput)=>void;updateActors:(points:readonly WorldPoint[])=>void;tick:(deltaSeconds:number,timeSeconds:number)=>void;dispose:()=>void;inspect:()=>WorldInspection;anchor:(id:string,role:string)=>Vector3|null};
export type WorldNode={id:string;signature:string;object:Object3D;anchors?:Map<string,Object3D>};
