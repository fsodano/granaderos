import {OrthographicCamera} from 'three';
import {ELEVATION_PIXELS_PER_METRE} from '../tactical-elevation';

/** One metric space for models, terrain, input overlays and recorded effects. */
export const ISO_HALF_WIDTH=26;
export const ISO_HALF_HEIGHT=14;
export const ISO_PITCH=Math.asin(ISO_HALF_HEIGHT/ISO_HALF_WIDTH);
export const PIXELS_PER_METRE=ELEVATION_PIXELS_PER_METRE/Math.cos(ISO_PITCH);
export const TILE_METRES=ISO_HALF_WIDTH*Math.SQRT2/PIXELS_PER_METRE;
export type SectorCameraView={x:number;y:number;width:number;height:number;mapHeight:number};
export type MetricProject=((x:number,y:number)=>{x:number;y:number})&{metric:true};
export function sectorProject(mapHeight:number):MetricProject {
  const origin=mapHeight*ISO_HALF_WIDTH+28;
  return Object.assign((x:number,y:number)=>({x:origin+(x-y)*ISO_HALF_WIDTH,y:65+(x+y)*ISO_HALF_HEIGHT}),{metric:true as const});
}
export function updateSectorCamera(camera:OrthographicCamera,view:SectorCameraView){
  const origin=view.mapHeight*ISO_HALF_WIDTH+28;
  camera.left=(view.x-origin)/PIXELS_PER_METRE;
  camera.right=camera.left+view.width/PIXELS_PER_METRE;
  camera.top=(65-view.y)/PIXELS_PER_METRE;
  camera.bottom=camera.top-view.height/PIXELS_PER_METRE;
  camera.near=.1;camera.far=4000;
  camera.position.set(1000*Math.cos(ISO_PITCH)/Math.SQRT2,1000*Math.sin(ISO_PITCH),1000*Math.cos(ISO_PITCH)/Math.SQRT2);
  camera.up.set(0,1,0);camera.lookAt(0,0,0);camera.updateProjectionMatrix();camera.updateMatrixWorld();
}
/** Facing is the existing screen compass; local +Z is the character's front. */
export function actorYaw(direction:number){return (5-direction)*Math.PI/4;}
