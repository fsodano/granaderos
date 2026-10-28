import {BufferAttribute,BufferGeometry,Vector3} from 'three';

// Support corners of the three retained irregular crown recipes. Interior
// corners are omitted; every old hull plane and rotated bound stays exact.
const support:readonly (readonly number[])[]=[
  [0,1,2,3,4,5,6,7,9,10,11,14,16,17,19,20,21,22,24,25,26,27,28,29,31,33,34,36,37,38,40,41],
  [0,1,2,3,4,5,6,8,9,10,12,15,16,17,18,19,20,21,22,24,25,26,27,28,29,31,32,34,35,36,37,38,39,40,41],
  [0,1,3,5,6,7,8,9,10,11,12,13,14,15,17,19,20,22,23,24,25,26,28,29,30,31,32,33,35,36,37,38,39,40,41],
];
/** Folded leaf diamonds replace the closed lobe. Each new corner is a
 * convex blend of retained crown corners and its interior origin. */
export function leafSpray(crown:BufferGeometry,variant:number){
  const tips=support[variant];if(!tips)throw Error(`Unknown leaf spray ${variant}`);
  const p=crown.getAttribute('position'),colour=crown.getAttribute('color'),corners:Vector3[]=[],shades:Vector3[]=[],ids:number[]=[],unique=new Map<string,number>();
  for(let n=0;n<p.count;n++){
    const point=new Vector3().fromBufferAttribute(p,n),key=point.toArray().join(',');let id=unique.get(key);
    if(id===undefined){id=corners.length;unique.set(key,id);corners.push(point);shades.push(new Vector3().fromBufferAttribute(colour,n));}ids.push(id);
  }
  const neighbours=corners.map(()=>new Set<number>());
  for(let n=0;n<ids.length;n+=3)for(let a=0;a<3;a++)for(let b=0;b<3;b++)if(a!==b)neighbours[ids[n+a]].add(ids[n+b]);
  const vertices:number[]=[],colours:number[]=[];
  for(const id of tips){
    const tip=corners[id],axis=tip.clone().normalize(),near=[...neighbours[id]],tangent=(n:number)=>corners[n].clone().addScaledVector(axis,-corners[n].dot(axis)).normalize();
    let left=near[0],right=near[1],spread=1;
    for(let a=0;a<near.length;a++)for(let b=a+1;b<near.length;b++){const gap=tangent(near[a]).dot(tangent(near[b]));if(gap<spread){spread=gap;left=near[a];right=near[b];}}
    const root=tip.clone().multiplyScalar(.28),a=tip.clone().multiplyScalar(.45).addScaledVector(corners[left],.38),b=tip.clone().multiplyScalar(.45).addScaledVector(corners[right],.38);
    for(const face of [[root,a,tip],[root,tip,b]])for(const point of face){
      vertices.push(point.x,point.y,point.z);const shade=point===root?.84:point===tip?1:.94,c=shades[id];colours.push(c.x*shade,c.y*shade,c.z*shade);
    }
  }
  const geometry=new BufferGeometry().setAttribute('position',new BufferAttribute(new Float32Array(vertices),3));geometry.setAttribute('color',new BufferAttribute(new Float32Array(colours),3));geometry.computeVertexNormals();return geometry;
}
