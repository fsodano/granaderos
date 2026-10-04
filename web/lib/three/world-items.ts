import {Matrix4,Quaternion,Vector3} from 'three';
import {WorldBatch,seeded} from './world-geometry';
import {illuminationAt} from './world-materials';
import type {WorldGeometry} from './world-geometry';
import type {WorldMaterials} from './world-materials';
import type {WorldInput,WorldItem,WorldLoot} from './world-types';

export function buildLoot(id:string,pile:WorldLoot,input:WorldInput,T:number,geometry:WorldGeometry,materials:WorldMaterials){
  const batch=new WorldBatch(geometry),items=pile.items?.length?pile.items:[pile],light=illuminationAt(input,pile);
  for(const [n,item]of items.slice(0,5).entries()){
    const kind=String(item.weapon??item.blade??item.outfit??item.item??item.kind??item.type??'supply').toLowerCase(),part=new WorldBatch(geometry),wood=materials.get('wood'),iron=materials.get('iron'),brass=materials.get('brass');
    if(/pistol|pistola/.test(kind)){
      part.box(wood,-.055,.03,0,.18,.06,.075,light);part.box(wood,-.11,.02,-.045,.07,.055,.14,light);part.cylinder(iron,new Vector3(-.02,.065,0),new Vector3(.24,.065,0),.026,light);part.box(iron,-.01,.075,-.045,.045,.03,.02,light);
    }else if(/rifle|musket|fusil|carbine|carabina|brown|charleville/.test(kind)){
      part.box(wood,-.39,.045,0,.34,.09,.12,light);part.box(wood,.09,.035,0,.64,.065,.07,light);part.cylinder(iron,new Vector3(-.14,.079,0),new Vector3(.63,.079,0),.022,light);part.box(iron,-.13,.08,-.045,.09,.045,.02,light);for(const x of [.16,.40])part.box(brass,x,.051,0,.023,.10,.08,light);
      if(item.fittings?.bayonet)part.box(iron,.79,.069,0,.34,.016,.025,light);
    }else if(/sabre|saber|sable|facon|facón|knife|cuchillo|bayonet/.test(kind)){
      const long=/sabre|saber|sable/.test(kind),length=long?.65:.29;part.box(materials.get('leather'),-.12,.03,0,.20,.05,.055,light);part.box(brass,-.012,.038,0,.025,.025,.16,light);part.box(iron,length*.5,.028,0,length,.016,.055,light);part.primitive('cone',iron,[length+.04,.028,0],[.026,.09,.01],new Quaternion().setFromAxisAngle(new Vector3(0,0,1),-Math.PI*.5),light);
    }else if(/lance|lanza|pike|pica/.test(kind)){
      part.cylinder(wood,new Vector3(-.8,.025,0),new Vector3(.78,.025,0),.018,light);part.primitive('cone',iron,[.91,.025,0],[.05,.26,.018],new Quaternion().setFromAxisAngle(new Vector3(0,0,1),-Math.PI*.5),light);
    }else if(item.outfit||/coat|uniform|outfit|ropa/.test(kind)){
      part.box(materials.get('rug',{colour:'#283946'}),0,.04,0,.33,.08,.27,light);part.box(materials.get('linen'),0,.084,0,.04,.012,.25,light);
    }else if(/ammo|round|ball|cartridge|cartucho|municion|munición|powder/.test(kind)){
      part.box(materials.get('linen'),0,.04,0,.19,.08,.14,light);for(let k=0;k<3;k++)part.primitive('sphere',iron,[(k-1)*.05,.085,.045],[.021,.021,.021],undefined,light);
    }else{
      part.primitive('sphere',materials.get(/medical|bandage|vendaje|botiquin/.test(kind)?'linen':'leather'),[0,.07,0],[.17,.09,.13],undefined,light);part.box(materials.get('linen'),0,.12,0,.03,.025,.18,light);
    }
    const built=part.finish(`item:${n}`),angle=seeded(Math.floor(pile.x),Math.floor(pile.y),n+90)*Math.PI,offset=new Vector3((n%3-1)*.17,.016+Math.floor(n/3)*.035,(Math.floor(n/3)-.5)*.18),matrix=new Matrix4().compose(offset,new Quaternion().setFromAxisAngle(new Vector3(0,1,0),angle),new Vector3(1,1,1));
    for(const child of built.children){const mesh=child as import('three').Mesh;batch.add(mesh.geometry,mesh.material as typeof wood,matrix,1);mesh.geometry.dispose();}
  }
  const group=batch.finish(`loot:${id}`);group.position.set(pile.x*T,pile.elevation??0,pile.y*T);group.userData.kind='loot';group.userData.semanticId=`loot:${id}`;group.userData.itemKinds=items.map((item:WorldItem)=>item.weapon??item.blade??item.item??item.type??item.outfit??'supply');return group;
}
