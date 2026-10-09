import {BoxGeometry,BufferAttribute,BufferGeometry,ConeGeometry,CylinderGeometry,Group,IcosahedronGeometry,LatheGeometry,Matrix4,Mesh,MeshStandardMaterial,Quaternion,Shape,ShapeGeometry,TorusGeometry,Vector2,Vector3} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {rockForm} from './world-rock-forms';
import {leafSpray} from './world-leaf-sprays';

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
    else if(kind==='grass-tuft'){
      // Three tapered leaves bend through their middle from a shared root.
      // The existing double-sided material lights both leaf faces.
      const vertices:number[]=[],colours:number[]=[];
      for(const [index,height,lean]of [[0,.72,.40],[1,1,.29],[2,.44,.90]]){
        const angle=index*2.0943951024,dx=Math.cos(angle),dz=Math.sin(angle),width=.024;
        const point=(reach:number,y:number,halfWidth:number)=>new Vector3(dx*reach-dz*halfWidth,y,dz*reach+dx*halfWidth);
        const a=point(0,0,-width),b=point(0,0,width),c=point(height*lean*.36,height*.56,width*.65),d=point(height*lean*.36,height*.56,-width*.65),tip=point(height*lean,height,0);
        for(const face of [[a,b,c],[a,c,d],[d,c,tip]])for(const p of face){
          vertices.push(p.x,p.y,p.z);const shade=.83+.20*p.y/height;colours.push(shade,shade,shade);
        }
      }
      geometry=new BufferGeometry().setAttribute('position',new BufferAttribute(new Float32Array(vertices),3));
      geometry.setAttribute('color',new BufferAttribute(new Float32Array(colours),3));geometry.computeVertexNormals();
    }
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
    else if(kind.startsWith('leaf-spray-')){const variant=Number(kind.slice('leaf-spray-'.length));geometry=leafSpray(this.get(`crown-${variant}`),variant);}
    else if(kind.startsWith('rock-form-'))geometry=rockForm(Number(kind.slice('rock-form-'.length)));
    else if(kind==='torus')geometry=new TorusGeometry(1,.09,6,16);
    else if(kind==='bed-mattress')geometry=new RoundedBoxGeometry(1,1,1,1,.12);
    else if(kind==='bed-pillow')geometry=new RoundedBoxGeometry(1,1,1,1,.28);
    else if(kind==='bed-blanket')geometry=bedBlanketGeometry();
    else if(kind==='washstand-basin')geometry=lathe([[0,-.012],[.12,-.012],[.12,0],[.16,.025],[.19,.10],[.18,.13],[.16,.12],[.13,.04],[.10,.035],[0,.035]]);
    else if(kind==='washstand-pitcher')geometry=washstandPitcherGeometry();
    else if(kind==='washstand-handle')geometry=washstandHandleGeometry();
    else if(kind==='washstand-towel')geometry=washstandTowelGeometry();
    else if(kind==='hearth-pot')geometry=lathe([[0,0],[.082,0],[.105,.017],[.132,.070],[.140,.134],[.142,.153],[.139,.160],[.127,.160],[.125,.147],[.127,.130],[.119,.074],[.090,.022],[0,.022]]);
    else if(kind==='hearth-bail')geometry=new TorusGeometry(1,.04,4,12,Math.PI);
    else if(kind==='shelf-jar')geometry=shelfVesselGeometry('jar');
    else if(kind==='shelf-bottle')geometry=shelfVesselGeometry('bottle');
    else if(kind==='shelf-bowl')geometry=shelfVesselGeometry('bowl');
    else throw Error(`Unknown world primitive ${kind}`);
    this.cache.set(kind,geometry);return geometry;
  }
  dispose(){for(const geometry of this.cache.values())geometry.dispose();this.cache.clear();}
}
/** A thin folded sheet and one loose side edge, shared by every bed. X/Z are
 * unit dimensions; Y stays in metres because furniture height does not stretch. */
function bedBlanketGeometry(){
  const columns=[-.5,-.40,-.18,.12,.34,.5],rows=[-.5,-.37,-.19,-.03,.15,.32,.5],folds=[.005,.030,.003,.025,0,.033,.005];
  const positions:number[]=[],uv:number[]=[],indices:number[]=[];
  for(let row=0;row<rows.length;row++){
    const z=rows[row],fold=folds[row];
    for(const x of columns){
      // A thin sheet clears the whole mattress top, including each rounded
      // edge triangle. Positive folds and all hanging hem vertices stay exact.
      const edge=Math.max(0,(Math.abs(x)-.40)/.10),y=Math.max(.002,fold*(.82+.18*Math.cos(x*5+z*2))-.016*edge*edge);
      positions.push(x,y,z);uv.push(x+.5,z+.5);
    }
    // The edge bends out before falling. Its loose hem stays inside the frame
    // width and above the frame platform, including on shorter authored beds.
    for(const [x,y]of [[.526,-.055+fold*.20],[.510,-.130+fold*.08],[.500,-.190+.012*Math.sin(row*2.3)]]){positions.push(x,y,z);uv.push(x+.5,z+.5);}
  }
  const stride=columns.length+3;
  for(let row=0;row<rows.length-1;row++)for(let column=0;column<stride-1;column++){
    const a=row*stride+column,b=a+1,c=a+stride,d=c+1;indices.push(a,c,b,b,c,d);
  }
  const geometry=new BufferGeometry().setAttribute('position',new BufferAttribute(new Float32Array(positions),3)).setAttribute('uv',new BufferAttribute(new Float32Array(uv),2)).setIndex(indices);
  geometry.computeVertexNormals();return geometry;
}
function washstandPitcherGeometry(){
  const geometry=lathe([[0,0],[.048,0],[.049,.015],[.067,.045],[.071,.110],[.059,.167],[.036,.196],[.039,.232],[.043,.240],[.032,.240],[.029,.200],[.047,.164],[.056,.107],[.049,.046],[0,.028]]),position=geometry.getAttribute('position');
  // A narrow neck and outside handle retain the authored jug proportions.
  // A small lip points towards the basin without raising its 24 cm rim.
  for(let n=0;n<position.count;n++){
    const x=position.getX(n),y=position.getY(n),z=position.getZ(n),radius=Math.hypot(x,z);
    if(radius>0&&y>.196){const sector=Math.max(0,(-x/radius-.82)/.18),lip=Math.min(1,(y-.196)/.036);position.setX(n,x-.018*sector*lip);}
  }
  geometry.computeVertexNormals();return geometry;
}
function washstandHandleGeometry(){
  const geometry=new TorusGeometry(1,.15,4,12,Math.PI);geometry.rotateZ(-Math.PI*.5);
  const position=geometry.getAttribute('position');
  // An open D handle joins the shoulder and body without passing through the
  // jug cavity. Its upper attachment leans towards the narrower shoulder.
  for(let n=0;n<position.count;n++)position.setX(n,position.getX(n)-.22*Math.max(0,position.getY(n)));
  geometry.computeVertexNormals();return geometry;
}
/** Top folds rest on the table; a narrow sheet bends over its front edge. */
function washstandTowelGeometry(){
  const columns=[-.5,-.30,0,.30,.5],path=[[-.5,0,1],[.05,0,1],[.5,0,1],[.55,-.035,.99],[.565,-.120,.94],[.55,-.235,.97],[.53,-.350,1.02]],positions:number[]=[],uv:number[]=[],indices:number[]=[];
  for(let row=0;row<path.length;row++)for(const x of columns){
    const [z,y,width]=path[row],crease=Math.sin(x*Math.PI*3),top=row<3;
    positions.push(x*width,y+(top?.006*crease*crease:row===path.length-1?.014*Math.cos(x*Math.PI*4+1):0),z+(top?0:.035*crease));uv.push(x+.5,row/(path.length-1));
  }
  for(let row=0;row<path.length-1;row++)for(let column=0;column<columns.length-1;column++){
    const a=row*columns.length+column,b=a+1,c=a+columns.length,d=c+1;indices.push(a,c,b,b,c,d);
  }
  const geometry=new BufferGeometry().setAttribute('position',new BufferAttribute(new Float32Array(positions),3)).setAttribute('uv',new BufferAttribute(new Float32Array(uv),2)).setIndex(indices);
  geometry.computeVertexNormals();return geometry;
}
/** Small storage vessels have an outside foot, rolled lip and real cavity.
 * Eight radial segments limit the cached geometry cost. */
function shelfVesselGeometry(kind:'jar'|'bottle'|'bowl'){
  const profiles={
    jar:[[0,0],[.039,0],[.053,.014],[.069,.074],[.063,.130],[.036,.166],[.036,.181],[.043,.181],[.043,.191],[.030,.191],[.027,.175],[.052,.126],[.057,.057],[0,.024]],
    bottle:[[0,0],[.031,0],[.043,.014],[.052,.082],[.047,.157],[.020,.202],[.020,.245],[.027,.245],[.027,.257],[.014,.257],[.013,.207],[.035,.156],[.039,.035],[0,.025]],
    bowl:[[0,0],[.043,0],[.055,.012],[.066,.062],[.070,.093],[.070,.103],[.058,.103],[.054,.080],[.043,.025],[0,.025]],
  } as const;
  const points=profiles[kind],geometry=lathe(points,8),colours=new Float32Array(geometry.getAttribute('position').count*3),inside=kind==='bowl'?6:9;
  // Shared ceramic/food materials retain the admitted room light. A restrained
  // cavity shade survives the day sky's fill without adding a material batch.
  for(let n=0;n<colours.length/3;n++){const shade=n%points.length>=inside ? .68 : 1;colours.fill(shade,n*3,n*3+3);}
  geometry.setAttribute('color',new BufferAttribute(colours,3));return geometry;
}
export class WorldBatch {
  private parts=new Map<MeshStandardMaterial,BufferGeometry[]>();
  constructor(public library:WorldGeometry){}
  add(geometry:BufferGeometry,material:MeshStandardMaterial,matrix=new Matrix4(),light=1,metricBoxUV=false){
    const part=geometry.index?geometry.toNonIndexed():geometry.clone();part.applyMatrix4(matrix);
    if(!part.getAttribute('normal'))part.computeVertexNormals();
    if(metricBoxUV){
      const p=part.getAttribute('position'),normal=part.getAttribute('normal'),uv=new Float32Array(p.count*2);
      for(let n=0;n<p.count;n++){
        const nx=normal.getX(n),ny=normal.getY(n),nz=normal.getZ(n);
        if(Math.abs(ny)>.5){uv[n*2]=p.getX(n);uv[n*2+1]=p.getZ(n);}
        else if(Math.abs(nx)>Math.abs(nz)){uv[n*2]=p.getZ(n)*(nx>0?-1:1);uv[n*2+1]=p.getY(n);}
        else{uv[n*2]=p.getX(n)*(nz>0?1:-1);uv[n*2+1]=p.getY(n);}
      }
      part.setAttribute('uv',new BufferAttribute(uv,2));
    }
    if(!part.getAttribute('uv'))part.setAttribute('uv',new BufferAttribute(new Float32Array(part.getAttribute('position').count*2),2));
    const colours=new Float32Array(part.getAttribute('position').count*3),source=part.getAttribute('color');
    if(source)for(let n=0;n<source.count;n++){colours[n*3]=source.getX(n)*light;colours[n*3+1]=source.getY(n)*light;colours[n*3+2]=source.getZ(n)*light;}else colours.fill(light);
    part.setAttribute('color',new BufferAttribute(colours,3));
    const list=this.parts.get(material)??[];list.push(part);this.parts.set(material,list);
  }
  primitive(kind:string,material:MeshStandardMaterial,position:Vector3|readonly number[],scale:readonly number[],rotation?:Quaternion,light=1){
    const point=position instanceof Vector3?position:new Vector3(...position as [number,number,number]);
    this.add(this.library.get(kind),material,new Matrix4().compose(point,rotation??new Quaternion(),new Vector3(...scale as [number,number,number])),light,kind==='box'&&material.userData.metricBoxUV===true);
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
