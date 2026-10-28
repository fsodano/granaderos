import {Group,Matrix4,Object3D,Quaternion,Vector3} from 'three';
import {WorldBatch,lathe} from './world-geometry';
import {wheel} from './world-props';
import {illuminationAt} from './world-materials';
import type {WorldGeometry} from './world-geometry';
import type {WorldMaterials} from './world-materials';
import type {WorldCannon,WorldInput} from './world-types';

export function buildCannon(cannon:WorldCannon,input:WorldInput,T:number,geometry:WorldGeometry,materials:WorldMaterials){
  const batch=new WorldBatch(geometry),light=illuminationAt(input,cannon),wood=materials.get('darkwood'),iron=materials.get('iron'),metal=materials.get(cannon.type==='field8'?'iron':'brass'),swivel=cannon.type==='swivel';
  const length=swivel?1.03:cannon.type==='field8'?1.95:1.52,radius=swivel?.072:cannon.type==='field8'?.145:.12,height=swivel?1.05:.80,axle=swivel?.45:.87;
  // A turned hollow muzzle, breech mouldings, trunnions, trail and spoked wheels
  // give the three authored cannon types different real silhouettes.
  const barrel=lathe([[radius*.48,-length*.50],[radius*.95,-length*.48],[radius*1.18,-length*.42],[radius*1.22,-length*.35],[radius*1.09,-length*.10],[radius*.86,length*.35],[radius*1.05,length*.42],[radius*1.05,length*.50],[radius*.68,length*.50],[radius*.68,length*.35]]);
  const barrelQ=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),-Math.PI*.5),centre=new Vector3(.22,height,0);
  batch.add(barrel,metal,new Matrix4().compose(centre,barrelQ,new Vector3(1,1,1)),light);barrel.dispose();
  batch.primitive('sphere',metal,[-length*.50+.12,height,0],[radius*.45,radius*.45,radius*.45],undefined,light);
  batch.cylinder(iron,new Vector3(-.11,height,-radius*1.9),new Vector3(-.11,height,radius*1.9),radius*.3,light);
  if(swivel){
    batch.box(wood,-.11,.47,0,.17,.94,.17,light);batch.box(iron,-.11,.96,0,.24,.09,.34,light);
    for(const side of [-1,1])batch.box(iron,-.11,1.02,side*.14,.05,.19,.055,light);
    batch.box(wood,-.10,.10,0,.85,.20,.66,light);for(const side of [-1,1])batch.box(wood,-.10,.22,side*.24,.78,.07,.075,light);
    batch.cylinder(wood,new Vector3(-.44,height,0),new Vector3(-.80,height-.18,0),.03,light);
  }else{
    batch.cylinder(iron,new Vector3(-.10,.48,-axle*.60),new Vector3(-.10,.48,axle*.60),.045,light);
    // wheel helper axle is local X; rotate wheel geometry to local Z here.
    const wheels=new WorldBatch(geometry),wheelRadius=.48/(1.04*1.09);for(const side of [-1,1])wheel(wheels,materials,light,side*axle*.59,.48,.10,wheelRadius);
    const wheelGroup=wheels.finish('cannon-wheels'),matrix=new Matrix4().makeRotationY(Math.PI*.5);for(const mesh of wheelGroup.children){const item=mesh as import('three').Mesh;batch.add(item.geometry,item.material as typeof wood,matrix,1);item.geometry.dispose();}
    for(const side of [-1,1]){
      batch.box(wood,-.12,.61,side*radius*1.5,.71,.25,.11,light);
      batch.cylinder(wood,new Vector3(.10,.54,side*.20),new Vector3(-1.14,.15,side*.13),.072,light);
      batch.box(iron,-.06,.71,side*radius*1.54,.19,.05,.13,light);
    }
    batch.box(wood,-1.07,.13,0,.39,.10,.42,light);batch.box(iron,-1.12,.15,0,.11,.035,.40,light);
    batch.box(wood,-.61,.32,0,.24,.10,.42,light);
    if(cannon.loaded)for(let n=0;n<3;n++)batch.primitive('sphere',iron,[-.78+(n%2)*.12,.41+(n===2?.1:0),(n%2-.5)*.13],[.052,.052,.052],undefined,light);
  }
  const group=batch.finish(`cannon:${cannon.id}`);group.position.set(cannon.x*T,cannon.elevation??0,cannon.y*T);group.rotation.y=-(cannon.facing??0);group.userData.kind='cannon';group.userData.semanticId=`cannon:${cannon.id}`;group.userData.loaded=Boolean(cannon.loaded);group.userData.cannonType=cannon.type;
  const muzzle=new Object3D();muzzle.name=`muzzle:${cannon.id}`;muzzle.position.set(centre.x+length*.5,height,0);group.add(muzzle);
  const muzzleForward=new Object3D();muzzleForward.name=`muzzle-forward:${cannon.id}`;muzzleForward.position.set(centre.x+length*.5+.30,height,0);group.add(muzzleForward);
  group.userData.anchorNodes=new Map([['muzzle',muzzle],['muzzleForward',muzzleForward]]);return group;
}
