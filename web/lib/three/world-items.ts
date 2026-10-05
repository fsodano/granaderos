import {Matrix4,Quaternion,Vector3} from 'three';
import {WorldBatch,seeded} from './world-geometry';
import {illuminationAt} from './world-materials';
import type {WorldGeometry} from './world-geometry';
import type {WorldMaterials} from './world-materials';
import type {WorldInput,WorldItem,WorldLoot} from './world-types';

const equipmentKinds:Record<number,string>={1800:'brown-bess',1801:'charleville',1802:'baker-rifle',1803:'cavalry-carbine',1804:'shotgun',1805:'saddle-pistol',1806:'duelling-pistol',1807:'blunderbuss',1808:'double-pistol',1809:'curved-sabre',1810:'caroya-sabre',1811:'socket-bayonet',1812:'lance',1813:'facon'};
export function worldItemKind(item:WorldItem){
  const raw=item.weapon??item.blade??item.outfit??item.item??item.kind??item.type??'supply',id=typeof raw==='object'?raw.id:raw;
  const template=item.template??item.contentWeapon?.template??item.weaponMetadata?.contentWeapon?.template??item.bladeMetadata?.contentWeapon?.template??item.itemMetadata?.contentWeapon?.template??Number(id);
  return equipmentKinds[template]??String(id).toLowerCase();
}

export function buildLoot(id:string,pile:WorldLoot,input:WorldInput,T:number,geometry:WorldGeometry,materials:WorldMaterials){
  const batch=new WorldBatch(geometry),items=pile.items?.length?pile.items:[pile],light=illuminationAt(input,pile);
  for(const [n,item]of items.slice(0,5).entries()){
    const kind=worldItemKind(item),part=new WorldBatch(geometry),wood=materials.get('wood'),iron=materials.get('iron'),brass=materials.get('brass');
    if(/pistol|pistola/.test(kind)){
      const duel=kind==='duelling-pistol',double=kind==='double-pistol',barrels=double?[-.028,.028]:[0],end=duel?.21:.25;
      part.box(wood,-.055,.03,0,.18,.06,double?.10:.075,light);part.primitive('taper',wood,[-.12,.025,-.04],[.038,.17,.035],new Quaternion().setFromAxisAngle(new Vector3(1,0,0),Math.PI*.5-.28),light);
      for(const z of barrels)part.cylinder(iron,new Vector3(-.02,.065,z),new Vector3(end,.065,z),duel?.019:.024,light);
      part.box(iron,-.01,.075,-.065,.045,.03,.02,light);part.box(brass,-.12,.025,-.13,.065,.01,.03,light);
    }else if(/rifle|musket|fusil|carbine|carabina|brown|charleville|shotgun|blunderbuss|trabuco|escopeta/.test(kind)){
      const short=/carbine|blunderbuss|trabuco/.test(kind),shotgun=/shotgun|escopeta/.test(kind),baker=/baker/.test(kind),length=short?.78:baker?1.04:1.21,end=length*.53,start=-length*.47;
      part.box(wood,start+.16,.045,0,.32,.09,.12,light);part.box(wood,.08,.035,0,length*.57,.065,shotgun?.10:.07,light);
      for(const z of shotgun?[-.022,.022]:[0])part.cylinder(iron,new Vector3(start+.33,.079,z),new Vector3(end,.079,z),baker?.025:.021,light);
      part.box(iron,start+.34,.08,-.045,.09,.045,.02,light);for(const x of [end*.30,end*.69])part.box(kind==='charleville'?iron:brass,x,.051,0,.023,.10,shotgun?.12:.08,light);
      if(/blunderbuss|trabuco/.test(kind)){const flare=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),-Math.PI*.5);part.primitive('flare',brass,[end+.055,.079,0],[.067,.16,.067],flare,light);}
      if(item.fittings?.bayonet)part.box(iron,.79,.069,0,.34,.016,.025,light);
    }else if(/sabre|saber|sable|facon|facón|knife|cuchillo|bayonet/.test(kind)){
      const long=/sabre|saber|sable/.test(kind),socket=/bayonet/.test(kind),length=long?.76:.29,curve=kind==='curved-sabre'?.14:long?.055:0;
      if(socket){part.primitive('torus',iron,[-.055,.04,0],[.043,.043,.043],new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.PI*.5),light);part.box(iron,.01,.04,-.06,.11,.021,.021,light);}
      else{part.box(materials.get('leather'),-.12,.03,0,.20,.05,.055,light);part.box(brass,-.012,.038,0,.025,.025,.16,light);if(long)part.primitive('torus',brass,[-.13,.028,-.03],[.105,.065,.075],new Quaternion().setFromAxisAngle(new Vector3(1,0,0),Math.PI*.5),light);}
      for(let k=0;k<7;k++){const a=k/7,b=(k+1)/7;part.cylinder(iron,new Vector3(a*length,.028,curve*a*a),new Vector3(b*length,.028,curve*b*b),.014*(1-a*.3),light);}
      part.primitive('cone',iron,[length+.035,.028,curve],[.021,.10,.008],new Quaternion().setFromAxisAngle(new Vector3(0,0,1),-Math.PI*.5),light);
    }else if(/lance|lanza|pike|pica/.test(kind)){
      part.cylinder(wood,new Vector3(-.8,.025,0),new Vector3(.78,.025,0),.018,light);part.primitive('cone',iron,[.91,.025,0],[.05,.26,.018],new Quaternion().setFromAxisAngle(new Vector3(0,0,1),-Math.PI*.5),light);
    }else if(item.outfit||/coat|uniform|outfit|ropa/.test(kind)){
      part.box(materials.get('rug',{colour:'#283946'}),0,.04,0,.33,.08,.27,light);part.box(materials.get('linen'),0,.084,0,.04,.012,.25,light);
    }else if(/ammo|round|ball|cartridge|cartucho|municion|munición|powder/.test(kind)){
      part.box(materials.get('linen'),0,.04,0,.19,.08,.14,light);for(let k=0;k<3;k++)part.primitive('sphere',iron,[(k-1)*.05,.085,.045],[.021,.021,.021],undefined,light);
    }else{
      part.primitive('sphere',materials.get(/medical|bandage|vendaje|botiquin/.test(kind)?'linen':'leather'),[0,.07,0],[.17,.09,.13],undefined,light);part.box(materials.get('linen'),0,.12,0,.03,.025,.18,light);
    }
    const built=part.finish(`item:${n}`),angle=seeded(Math.floor(pile.x),Math.floor(pile.y),n+90)*Math.PI;
    let bottom=Infinity;for(const child of built.children){const mesh=child as import('three').Mesh;mesh.geometry.computeBoundingBox();bottom=Math.min(bottom,mesh.geometry.boundingBox!.min.y);}
    const offset=new Vector3((n%3-1)*.17,.006-bottom+Math.floor(n/3)*.035,(Math.floor(n/3)-.5)*.18),matrix=new Matrix4().compose(offset,new Quaternion().setFromAxisAngle(new Vector3(0,1,0),angle),new Vector3(1,1,1));
    for(const child of built.children){const mesh=child as import('three').Mesh;batch.add(mesh.geometry,mesh.material as typeof wood,matrix,1);mesh.geometry.dispose();}
  }
  const group=batch.finish(`loot:${id}`);group.position.set(pile.x*T,pile.elevation??0,pile.y*T);group.userData.kind='loot';group.userData.semanticId=`loot:${id}`;group.userData.itemKinds=items.map(worldItemKind);return group;
}
