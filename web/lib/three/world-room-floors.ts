import {BufferAttribute,BufferGeometry,Matrix4,ShaderChunk} from 'three';
import type {MeshStandardMaterial} from 'three';
import {seeded} from './world-geometry';
import type {WorldBatch} from './world-geometry';
import type {WorldRoom,WorldTile} from './world-types';

// The retained wood sheet already has longitudinal grain and plank courses.
// These metric end joints add staggered board lengths without replacing it.
export const FLOOR_BOARD_LENGTH=1.65;
export const FLOOR_JOINT_HALF_WIDTH=.014;
const courses=[.12,.30,.49,.67,.86] as const;
const fract=(n:number)=>n-Math.floor(n);
export function floorBoardRow(v:number){return Math.floor(v)*5+courses.filter(edge=>fract(v)>=edge).length;}
export function floorJointDistance(u:number,v:number){return Math.abs(fract(u/FLOOR_BOARD_LENGTH+((floorBoardRow(v)%3+3)%3)*.37)-.5)*FLOOR_BOARD_LENGTH;}

/** One shared shader; UVs remain the original continuous world metres. */
export function applyRoomFloorJoints(material:MeshStandardMaterial){
  material.userData.roomFloorJoints=true;
  material.onBeforeCompile=shader=>{
    const fragment=ShaderChunk.map_fragment.replace('diffuseColor *= sampledDiffuseColor;',`
      float floorV = fract( vMapUv.y );
      float floorRow = floor( vMapUv.y ) * 5.0 + step( 0.12, floorV ) + step( 0.30, floorV ) + step( 0.49, floorV ) + step( 0.67, floorV ) + step( 0.86, floorV );
      float floorJoint = abs( fract( vMapUv.x / ${FLOOR_BOARD_LENGTH.toFixed(2)} + mod( floorRow, 3.0 ) * 0.37 ) - 0.5 ) * ${FLOOR_BOARD_LENGTH.toFixed(2)};
      float floorAA = max( fwidth( vMapUv.x ), 0.001 );
      // Average the thin joint over a pixel footprint; a subpixel joint must
      // lose coverage rather than become a thick opaque line when zoomed out.
      float floorMask = min( clamp( ( ${FLOOR_JOINT_HALF_WIDTH.toFixed(3)} + 0.5 * floorAA - floorJoint ) / floorAA, 0.0, 1.0 ), min( 1.0, ${(2*FLOOR_JOINT_HALF_WIDTH).toFixed(3)} / floorAA ) );
      sampledDiffuseColor.rgb *= 1.0 - 0.44 * floorMask;
      diffuseColor *= sampledDiffuseColor;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',fragment);
  };
  material.customProgramCacheKey=()=>`room-floor-joints:1:${FLOOR_BOARD_LENGTH}:${FLOOR_JOINT_HALF_WIDTH}`;
}

export type FloorFinish={shade:(x:number,z:number,level:number)=>number};
/** Only admitted doors adjacent to this disclosed room can supply wear. The
 * room's coordinate seed supplies broad pigment, never simulation randomness. */
export function roomFloorFinish(room:WorldRoom,doors:readonly WorldTile[],T:number,finish:string):FloorFinish{
  if(!['wood','floor','cobble'].includes(finish))return {shade:()=>1};
  const cells=room.cells,level=room.tacticalLevel??0,minX=Math.min(...cells.map(cell=>cell.x)),minY=Math.min(...cells.map(cell=>cell.y));
  const seed=seeded(Number.isFinite(minX)?minX:0,Number.isFinite(minY)?minY:0,1709+level*13),phase=seed*Math.PI*2;
  const entries=doors.filter(door=>cells.some(cell=>(cell.tacticalLevel??level)===(door.tacticalLevel??0)&&Math.abs(cell.x-door.x)+Math.abs(cell.y-door.y)<=1));
  const strength=finish==='wood'?1:finish==='floor'?.60:.35;
  const sample=(x:number,z:number,cellLevel:number)=>{
    const broad=(seed-.5)*.065+.035*Math.sin(x*.61+phase)*Math.sin(z*.53-phase);
    let wear=0;
    for(const door of entries)if((door.tacticalLevel??0)===cellLevel){const distance=Math.hypot(x-door.x*T,z-door.y*T)/1.8,t=Math.max(0,1-distance);wear=Math.max(wear,t*t*(3-2*t));}
    return 1+strength*(broad+.20*wear);
  };
  return {shade:(x,z,cellLevel)=>{
    // Sample one common tile grid. Along each cell edge this is linear, so a
    // vertex inserted by hatch clipping matches the adjacent uncut edge too.
    const u=x/T+.5,v=z/T+.5,ix=Math.floor(u),iz=Math.floor(v),tx=u-ix,tz=v-iz,x0=(ix-.5)*T,z0=(iz-.5)*T;
    const a=sample(x0,z0,cellLevel)*(1-tx)+sample(x0+T,z0,cellLevel)*tx,b=sample(x0,z0+T,cellLevel)*(1-tx)+sample(x0+T,z0+T,cellLevel)*tx;
    return a*(1-tz)+b*tz;
  }};
}

/** Same oriented corners, two triangles, metric UVs and plane as cellTop.
 * Shade only the retained vertices; do not add a raised wear/decal surface. */
export function roomFloorPart(batch:WorldBatch,material:MeshStandardMaterial,rect:{minX:number;minZ:number;maxX:number;maxZ:number},height:number,level:number,light:number,finish:FloorFinish){
  const {minX:x0,minZ:z0,maxX:x1,maxZ:z1}=rect,points=[[x0,height,z0],[x0,height,z1],[x1,height,z1],[x0,height,z0],[x1,height,z1],[x1,height,z0]],position=new Float32Array(points.flat()),uv=new Float32Array(12),colours=new Float32Array(18);
  for(let n=0;n<6;n++){uv[n*2]=points[n][0];uv[n*2+1]=points[n][2]+height;const shade=finish.shade(points[n][0],points[n][2],level);colours.fill(shade,n*3,n*3+3);}
  const geometry=new BufferGeometry().setAttribute('position',new BufferAttribute(position,3)).setAttribute('uv',new BufferAttribute(uv,2)).setAttribute('color',new BufferAttribute(colours,3));geometry.computeVertexNormals();batch.add(geometry,material,new Matrix4(),light);geometry.dispose();
}
