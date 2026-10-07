import {BoxGeometry,BufferAttribute,BufferGeometry,ConeGeometry,CylinderGeometry,Group,IcosahedronGeometry,LatheGeometry,Matrix4,Mesh,MeshStandardMaterial,Quaternion,Shape,ShapeGeometry,TorusGeometry,Vector2,Vector3} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export type PolygonUV=(point:Vector3)=>readonly [number,number];
/** Roof courses run along the low eave, with their spacing measured on the
 * actual slope. Retain this projector when clipping a plane for room reveal. */
export function roofTextureProjector(points:readonly Vector3[]):PolygonUV{
  const origin=points[0],across=points[1]?.clone().sub(origin);
  if(!origin||!across||across.lengthSq()<1e-12)return point=>[point.x,point.z+point.y];
  across.normalize();
  const uphill=points.slice(2).map(point=>point.clone().sub(origin)).map(offset=>offset.addScaledVector(across,-offset.dot(across))).find(offset=>offset.lengthSq()>1e-12);
  if(!uphill)return point=>[point.x,point.z+point.y];
  uphill.normalize();
  // TextureLoader's vertical axis points upwards. Positive V therefore runs
  // from the eave to the ridge; the image's lower tile edge faces downhill.
  return point=>{const offset=point.clone().sub(origin);return [offset.dot(across),offset.dot(uphill)];};
}

/** Owned primitive library; merged render geometry does not retain its inputs. */
export class WorldGeometry {
  private cache=new Map<string,BufferGeometry>();
  get(kind:string){
    let geometry=this.cache.get(kind);if(geometry)return geometry;
    if(kind==='box')geometry=new BoxGeometry(1,1,1);
    else if(kind==='cone')geometry=new ConeGeometry(1,1,10);
    else if(kind==='cylinder')geometry=new CylinderGeometry(1,1,1,12);
    else if(kind==='taper')geometry=new CylinderGeometry(.82,1,1,12);
    else if(kind==='flare')geometry=new CylinderGeometry(1,.35,1,12);
    else if(kind==='sphere')geometry=new IcosahedronGeometry(1,1);
    else if(kind.startsWith('crown-')){
      geometry=new IcosahedronGeometry(1,1);const position=geometry.getAttribute('position'),colours=new Float32Array(position.count*3),variant=Number(kind.slice(6));
      for(let n=0;n<position.count;n++){
        const x=position.getX(n),y=position.getY(n),z=position.getZ(n),noise=Math.sin(x*8.3+y*4.7+variant*2.1)*Math.cos(z*7.2-y*3.1+variant),radius=.84+.19*noise;
        position.setXYZ(n,x*radius,y*(radius+.05*Math.sin(z*11)),z*(radius+.06*Math.cos(x*9)));
        const shade=.81+.16*(.5+.5*Math.sin(x*6.1+y*5.8+z*3.2+variant*7));colours[n*3]=shade*(.92+.06*Math.sin(y*9+variant));colours[n*3+1]=shade;colours[n*3+2]=shade*.88;
      }
      geometry.setAttribute('color',new BufferAttribute(colours,3));
    }
    else if(kind==='rock')geometry=new IcosahedronGeometry(1,0);
    else if(kind==='torus')geometry=new TorusGeometry(1,.09,6,16);
    else throw Error(`Unknown world primitive ${kind}`);
    this.cache.set(kind,geometry);return geometry;
  }
  dispose(){for(const geometry of this.cache.values())geometry.dispose();this.cache.clear();}
}
export class WorldBatch {
  private parts=new Map<MeshStandardMaterial,BufferGeometry[]>();
  constructor(public library:WorldGeometry){}
  add(geometry:BufferGeometry,material:MeshStandardMaterial,matrix=new Matrix4(),light=1){
    const part=geometry.index?geometry.toNonIndexed():geometry.clone();part.applyMatrix4(matrix);
    if(!part.getAttribute('normal'))part.computeVertexNormals();
    if(!part.getAttribute('uv'))part.setAttribute('uv',new BufferAttribute(new Float32Array(part.getAttribute('position').count*2),2));
    const colours=new Float32Array(part.getAttribute('position').count*3),source=part.getAttribute('color');
    if(source)for(let n=0;n<source.count;n++){colours[n*3]=source.getX(n)*light;colours[n*3+1]=source.getY(n)*light;colours[n*3+2]=source.getZ(n)*light;}else colours.fill(light);
    part.setAttribute('color',new BufferAttribute(colours,3));
    const list=this.parts.get(material)??[];list.push(part);this.parts.set(material,list);
  }
  primitive(kind:string,material:MeshStandardMaterial,position:Vector3|readonly number[],scale:readonly number[],rotation?:Quaternion,light=1){
    const point=position instanceof Vector3?position:new Vector3(...position as [number,number,number]);
    this.add(this.library.get(kind),material,new Matrix4().compose(point,rotation??new Quaternion(),new Vector3(...scale as [number,number,number])),light);
  }
  box(material:MeshStandardMaterial,x:number,y:number,z:number,w:number,h:number,d:number,light=1){if(w>0&&h>0&&d>0)this.primitive('box',material,[x,y,z],[w,h,d],undefined,light);}
  cylinder(material:MeshStandardMaterial,a:Vector3,b:Vector3,radius:number,light=1,kind='cylinder'){
    const vector=b.clone().sub(a);this.primitive(kind,material,a.clone().add(b).multiplyScalar(.5),[radius,vector.length(),radius],new Quaternion().setFromUnitVectors(new Vector3(0,1,0),vector.normalize()),light);
  }
  polygon(material:MeshStandardMaterial,points:readonly Vector3[],light=1,projectUV?:PolygonUV){
    if(points.length<3)return;const vertices:number[]=[];
    for(let n=1;n<points.length-1;n++)for(const point of [points[0],points[n],points[n+1]])vertices.push(point.x,point.y,point.z);
    const geometry=new BufferGeometry().setAttribute('position',new BufferAttribute(new Float32Array(vertices),3));geometry.computeVertexNormals();
    const uv=new Float32Array(vertices.length/3*2);for(let n=0;n<vertices.length/3;n++){
      if(projectUV){const value=projectUV(new Vector3(vertices[n*3],vertices[n*3+1],vertices[n*3+2]));uv[n*2]=value[0];uv[n*2+1]=value[1];}
      else{uv[n*2]=vertices[n*3];uv[n*2+1]=vertices[n*3+2]+vertices[n*3+1];}
    }geometry.setAttribute('uv',new BufferAttribute(uv,2));
    this.add(geometry,material,new Matrix4(),light);geometry.dispose();
  }
  finish(name:string){
    const group=new Group();group.name=name;
    for(const [material,parts]of this.parts){
      const geometry=mergeGeometries(parts,false);for(const part of parts)part.dispose();
      if(!geometry)throw Error(`Cannot merge world mesh ${name}`);
      const mesh=new Mesh(geometry,material);mesh.name=`${name}:${material.name}`;mesh.castShadow=material.opacity>=1;mesh.receiveShadow=true;group.add(mesh);
    }
    this.parts.clear();return group;
  }
}
export function disposeWorldNode(object:Group|Mesh|import('three').Object3D){object.traverse(child=>{if(child instanceof Mesh)child.geometry.dispose();});object.removeFromParent();}
export function lathe(points:readonly (readonly [number,number])[],segments=12){return new LatheGeometry(points.map(point=>new Vector2(point[0],point[1])),segments);}
export function planarShape(points:readonly (readonly [number,number])[]){const shape=new Shape(points.map(point=>new Vector2(point[0],point[1])));return new ShapeGeometry(shape);}
export const seeded=(x:number,y:number,salt=0)=>((Math.imul(x+salt+71,374761393)^Math.imul(y-salt+97,668265263))>>>0)/0xffffffff;
export function cellTop(batch:WorldBatch,material:MeshStandardMaterial,x0:number,z0:number,x1:number,z1:number,height:number,light=1){
  batch.polygon(material,[new Vector3(x0,height,z0),new Vector3(x0,height,z1),new Vector3(x1,height,z1),new Vector3(x1,height,z0)],light);
}
