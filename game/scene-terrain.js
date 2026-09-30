// Rendering-only structural sharing. Battle reducers clone their snapshots;
// unchanged scenery should keep its geometry and React elements across ticks.
// One current snapshot is retained per mounted scene, never a history of maps.
export function createSceneTerrainCache(){
 let signature,retained;
 return state=>{
  // A burning light has the same appearance and illumination until it expires.
  // Countdown-only updates must not discard every cached building and tile.
  const lights=state.lights?.map(({remainingSeconds,turns,...light})=>({...light,...(turns===undefined?{}:{turns:turns===0?0:1})}));
  const terrain={width:state.width,height:state.height,tiles:state.tiles,upperSurfaces:state.upperSurfaces,buildings:state.buildings,props:state.props,lights,night:state.night,sectorId:state.sectorId,sceneId:state.sceneId};
  const next=JSON.stringify(terrain);
  if(next!==signature){signature=next;retained=terrain;}
  return retained;
 };
}
