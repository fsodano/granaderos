import {Group,Quaternion,Vector3} from 'three';
import {WorldBatch,lathe,seeded} from './world-geometry';
import {illuminationAt} from './world-materials';
import type {WorldGeometry} from './world-geometry';
import type {WorldMaterials} from './world-materials';
import type {WorldInput,WorldProp} from './world-types';

/** Furniture occupies its authored footprint; only its mesh rotates. */
export function buildProps(id:string,props:readonly WorldProp[],input:WorldInput,T:number,geometry:WorldGeometry,materials:WorldMaterials){
  const batch=new WorldBatch(geometry);
  for(const prop of props){
    const light=illuminationAt(input,prop),width=(prop.footprint?.width??1)*T,depth=(prop.footprint?.height??1)*T;
    const x=(prop.x+((prop.footprint?.width??1)-1)*.5)*T,z=(prop.y+((prop.footprint?.height??1)-1)*.5)*T,y=prop.elevation??0;
    const angle=(prop.rotation??0)*Math.PI/180,rotation=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),-angle);
    const frame=new Group();frame.position.set(x,y,z);frame.quaternion.copy(rotation);frame.updateMatrix();
    const wood=materials.get(prop.material==='stone'?'stone':'wood'),dark=materials.get('darkwood'),iron=materials.get('iron'),linen=materials.get('linen'),stone=materials.get('stone');
    // Rotated long furniture fits inside the same authoritative cells.
    const w=Math.abs(Math.sin(angle))>.5?depth:width,d=Math.abs(Math.sin(angle))>.5?width:depth;
    const part=new WorldBatch(geometry);
    const box=(m:typeof wood,a:number,b:number,c:number,wa:number,h:number,dc:number)=>part.box(m,a,b,c,wa,h,dc,light);
    const pole=(m:typeof wood,a:readonly number[],b:readonly number[],r:number)=>part.cylinder(m,new Vector3(...a as [number,number,number]),new Vector3(...b as [number,number,number]),r,light);
    const h=prop.obstacleHeight??({table:.8,bench:.45,bed:.55,chest:.8,barrels:1.2,hay:1.3,cart:1.2,shelf:1.5,hearth:.7,washstand:.8,pottery:.45,sacks:.7,'broken-timber':.3,rubble:.35,candle:.3,rug:.012}[prop.type]??.7);
    if(prop.type==='table'||prop.type==='bench'||prop.type==='washstand'){
      const tw=w*.80,td=d*(prop.type==='bench'?.35:.68),th=.07;box(wood,0,h-th*.5,0,tw,th,td);
      for(const a of [-1,1])for(const b of [-1,1]){box(wood,a*tw*.40,(h-th)*.5,b*td*.33,.075,h-th,.075);if(prop.type!=='bench')box(dark,a*tw*.40,.25,b*td*.33,.09,.05,.09);}
      box(wood,0,h-.18,0,tw*.90,.14,td*.7);
      if(prop.type==='washstand'){
        const bowl=lathe([[.12,0],[.16,.025],[.19,.10],[.18,.13],[.16,.12],[.13,.04],[.10,.035]]);part.add(bowl,materials.get('ceramic'),frame.matrix.clone().identity().makeTranslation(0,h+.012,0),light);bowl.dispose();
        box(linen,w*.22,h+.008,0,.18,.015,td*.8);
      }
    }else if(prop.type==='bed'){
      box(wood,0,.18,0,w*.72,.15,d*.90);for(const a of [-1,1])for(const b of [-1,1])box(wood,a*w*.31,.15,b*d*.40,.08,.3,.08);
      box(linen,0,h-.06,0,w*.69,.12,d*.84);box(materials.get('rug'),0,h+.008,d*.10,w*.70,.025,d*.52);
      box(linen,0,h+.045,-d*.29,w*.50,.09,d*.19);box(wood,0,h*.70,-d*.45,w*.77,h*.65,.08);box(wood,0,h*.50,d*.45,w*.76,h*.4,.07);
    }else if(prop.type==='chest'){
      const cw=w*.68,cd=d*.51;box(wood,0,h*.42,0,cw,h*.79,cd);box(dark,0,.04,0,cw+.035,.07,cd+.035);
      const lid=new WorldBatch(geometry);lid.box(wood,0,0,-cd*.5,cw,.10,cd,light);const lidGroup=lid.finish('chest-lid');lidGroup.position.set(0,h-.05,cd*.5);if(prop.open)lidGroup.rotation.x=-Math.PI*.42;lidGroup.updateMatrix();for(const mesh of lidGroup.children)if('geometry'in mesh){const item=mesh as import('three').Mesh;part.add(item.geometry,item.material as typeof wood,lidGroup.matrix,light);item.geometry.dispose();}
      for(const a of [-1,1])box(iron,a*cw*.31,h*.42,-cd*.51,.034,h*.78,.025);box(iron,0,h*.55,-cd*.53,.07,.11,.02);
    }else if(prop.type==='barrels'){
      const count=Math.max(1,Math.min(4,Math.round(w*d/(T*T)))),r=Math.min(.32,w*.30,d*.30),barrel=lathe([[r*.76,0],[r,.13],[r*1.08,h*.48],[r,h-.13],[r*.76,h]]);
      for(let n=0;n<count;n++){
        const a=count>1?(n%2-.5)*r*2.1:0,b=count>2?(Math.floor(n/2)-.5)*r*2.1:0;part.add(barrel,wood,new importMatrix().makeTranslation(a,0,b),light);
        for(const by of [.10,h*.48,h-.10])part.primitive('torus',iron,[a,by,b],[r*1.03,r*1.03,r*1.03],new Quaternion().setFromAxisAngle(new Vector3(1,0,0),Math.PI*.5),light);
        part.primitive('cylinder',dark,[a,h,b],[r*.79,.025,r*.79],undefined,light);
      }barrel.dispose();
    }else if(prop.type==='hay'||prop.type==='sacks'){
      const m=materials.get(prop.type==='hay'?'thatch':'linen');for(let n=0;n<4;n++){const a=(n%2-.5)*w*.34,b=(Math.floor(n/2)-.5)*d*.34;part.primitive(prop.type==='hay'?'box':'sphere',m,[a,h*(n===3?.57:.32),b],[w*.33,h*.34,d*.31],new Quaternion().setFromAxisAngle(new Vector3(0,1,0),n*.12),light);}
      if(prop.type==='hay')for(let n=0;n<6;n++)box(dark,(n-2.5)*w*.1,h*.66,0,.006,.015,d*.60);
    }else if(prop.type==='cart'){
      const cw=w*.68,cd=d*.72;box(wood,0,.61,0,cw,.10,cd);for(const a of [-1,1]){box(wood,a*cw*.5,.87,0,.08,.50,cd);for(const by of [.76,.95])box(dark,a*cw*.51,by,0,.02,.035,cd);}
      box(wood,0,.85,cd*.5,cw,.43,.075);for(const a of [-1,1])pole(wood,[a*cw*.39,.6,-cd*.45],[a*cw*.39,.39,-cd*.83],.045);
      pole(iron,[-cw*.75,.39,.08],[cw*.75,.39,.08],.035);for(const a of [-1,1])wheel(part,materials,light,a*cw*.69,.39,.08,.39);
    }else if(prop.type==='shelf'){
      const sw=w*.74,sd=d*.25;for(const a of [-1,1])box(wood,a*sw*.5,h*.5,0,.08,h,sd);for(const by of [.08,h*.35,h*.65,h-.04])box(wood,0,by,0,sw,.06,sd);
      for(let n=0;n<5;n++){const a=(n-2)*sw*.15,by=h*(n%2?.68:.38);part.primitive('cylinder',materials.get(n%2?'ceramic':'food'),[a,by+.11,0],[.07,.20,.07],undefined,light);}
    }else if(prop.type==='hearth'){
      box(stone,0,.04,0,w*.65,.08,d*.58);box(materials.get('brick'),0,h*.5,d*.20,w*.68,h,.18);for(const a of [-1,1])box(stone,a*w*.27,h*.34,0,w*.13,h*.68,d*.47);box(stone,0,h*.73,0,w*.67,.18,d*.53);
      box(materials.get('ember',{emissive:true}),0,.105,0,w*.24,.025,d*.18);for(const a of [-1,1])pole(dark,[a*.17,.13,-.12],[-a*.17,.13,.12],.035);
    }else if(prop.type==='pottery'){
      const pot=lathe([[.08,0],[.14,.04],[.18,h*.42],[.16,h*.76],[.07,h*.90],[.07,h],[.06,h],[.06,h*.9]]);part.add(pot,materials.get('ceramic'),new importMatrix(),light);pot.dispose();
      for(const a of [-1,1])part.primitive('torus',materials.get('ceramic'),[a*.15,h*.62,0],[.065,.09,.065],undefined,light);
    }else if(prop.type==='rug'){
      box(materials.get('rug'),0,.009,0,w*.84,.018,d*.84);for(const a of [-1,1])box(linen,a*w*.35,.022,0,.035,.005,d*.77);for(const b of [-1,1])box(linen,0,.022,b*d*.35,w*.77,.005,.035);
    }else if(prop.type==='candle'){
      part.primitive('cylinder',materials.get('brass'),[0,.02,0],[.09,.035,.09],undefined,light);part.primitive('cylinder',materials.get('wax'),[0,h*.45,0],[.035,h*.85,.035],undefined,light);part.primitive('cone',materials.get('flame',{emissive:true}),[0,h+.035,0],[.025,.07,.025],undefined,light);
    }else if(prop.type==='broken-timber'||prop.type==='rubble'){
      for(let n=0;n<7;n++){const a=seeded(prop.x,prop.y,n+80),b=seeded(prop.y,prop.x,n+31);part.primitive(prop.type==='rubble'?'rock':'box',prop.type==='rubble'?stone:wood,[(a-.5)*w*.8,h*.35,(b-.5)*d*.8],[prop.type==='rubble'?.15:.07,h*.3,prop.type==='rubble'?.16:Math.min(.6,d*.6)],new Quaternion().setFromAxisAngle(new Vector3(0,1,0),a*5),light);}
    }else{
      // Unknown authored props retain a modest storage silhouette, never a sprite.
      box(wood,0,h*.5,0,w*.68,h,d*.68);for(const by of [.12,h-.12])box(iron,0,by,-d*.35,w*.69,.035,.025);
    }
    const built=part.finish(`prop:${prop.id}`);for(const mesh of built.children){const item=mesh as import('three').Mesh;batch.add(item.geometry,item.material as typeof wood,frame.matrix,1);item.geometry.dispose();}
  }
  const group=batch.finish(`props:${id}`);group.userData.kind='props';group.userData.semanticIds=props.map(prop=>`prop:${prop.id}`);return group;
}

import {Matrix4 as importMatrix} from 'three';
export function wheel(batch:WorldBatch,materials:WorldMaterials,light:number,x:number,y:number,z:number,radius:number){
  const q=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.PI*.5);
  batch.primitive('torus',materials.get('wood'),[x,y,z],[radius,radius,radius],q,light);batch.primitive('torus',materials.get('iron'),[x,y,z],[radius*1.04,radius*1.04,radius*1.04],q,light);
  batch.cylinder(materials.get('iron'),new Vector3(x-.055,y,z),new Vector3(x+.055,y,z),.075,light);
  for(let n=0;n<10;n++){const a=n*Math.PI*.2;batch.cylinder(materials.get('wood'),new Vector3(x,y,z),new Vector3(x,y+Math.sin(a)*radius*.93,z+Math.cos(a)*radius*.93),.021,light);}
}
