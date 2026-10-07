import {Group,MeshStandardMaterial,Quaternion,Vector3} from 'three';
import {entranceFrame} from '../../../game/building-profile.js';
import {buildingAppearance} from '../../../game/building-appearance.js';
import {buildingStyle} from '../../../game/building-types.js';
import {WorldBatch,roofTextureProjector} from './world-geometry';
import {illuminationAt} from './world-materials';
import type {WorldGeometry} from './world-geometry';
import type {WorldMaterials} from './world-materials';
import type {WorldBuilding,WorldInput} from './world-types';

const wallInset=.4;

/** Join the roof planes with a timber fascia and rounded clay ridge caps.
 * This is exterior scenery. Room cutaways omit it with the removed roof. */
export function roofEdgeDetails(id:string,panels:readonly (readonly Vector3[])[],height:number,geometry:WorldGeometry,roof:MeshStandardMaterial,wood:MeshStandardMaterial,light:number,terrace=false){
  const batch=new WorldBatch(geometry),edges=new Map<string,{a:Vector3;b:Vector3;count:number}>(),thickness=terrace?.12:.075;
  const key=(p:Vector3)=>[p.x,p.y,p.z].map(value=>value.toFixed(6)).join(',');
  for(const panel of panels){
    batch.polygon(wood,panel.map(point=>point.clone().add(new Vector3(0,-thickness,0))),light);
    for(let n=0;n<panel.length;n++){
      const a=panel[n],b=panel[(n+1)%panel.length],edgeKey=[key(a),key(b)].sort().join('|'),edge=edges.get(edgeKey);
      if(edge)edge.count++;else edges.set(edgeKey,{a,b,count:1});
    }
  }
  for(const {a,b,count}of edges.values()){
    if(count===1)batch.polygon(wood,[a,b,b.clone().add(new Vector3(0,-thickness,0)),a.clone().add(new Vector3(0,-thickness,0))],light);
    else if(!terrace&&(a.y>height+.01||b.y>height+.01))batch.cylinder(roof,a.clone().add(new Vector3(0,.035,0)),b.clone().add(new Vector3(0,.035,0)),.06,light);
  }
  return batch.finish(`building-roof-edges:${id}`);
}

/** All facade details use the same entrance-relative frame as the roof.
 * Positions and face orientation therefore follow every authored rotation. */
export function architecturalDetails(b:WorldBuilding,input:WorldInput,T:number,height:number,base:number,geometry:WorldGeometry,materials:WorldMaterials,legacy:boolean){
  const walls=input.terrain.tiles.filter(tile=>tile.buildingId===b.id&&['wall','door','window'].includes(tile.type));
  const frame=entranceFrame({...b,walls}),kind=b.kind??b.architecture??'house',appearance=buildingAppearance({...b,roofFinish:b.roofFinish??(b.roof==='thatch'?'thatch':undefined)});
  const wall=materials.get(appearance.wallFinish,legacy?{colour:buildingStyle(b).wall}:{}),trim=materials.get('trim',legacy?{colour:buildingStyle(b).trim}:{}),wood=materials.get('wood'),darkwood=materials.get('darkwood'),iron=materials.get('iron'),roof=materials.get(appearance.roofFinish),light=illuminationAt(input,b);
  const root=new Group();root.name=`building-details:${b.id}`;
  let batch=new WorldBatch(geometry);
  const rotation=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.atan2(-frame.u.y,frame.u.x));
  const alongInset=wallInset*(frame.u.x+frame.u.y),depthInset=wallInset*(frame.v.x+frame.v.y),doorU=frame.doorU-alongInset;
  const at=(u:number,v:number,y:number)=>{const point=frame.at(u,v);return new Vector3((point.x+wallInset)*T,base+y,(point.y+wallInset)*T);};
  const box=(u:number,v:number,y:number,w:number,h:number,d:number,material=wall)=>batch.primitive('box',material,at(u,v,y),[w*T,h,d*T],rotation,light);
  const wallAt=(u:number,v:number)=>{const point=frame.at(u,v);return walls.find(tile=>tile.x===point.x&&tile.y===point.y);};
  const entranceSupports=()=>[Math.round(frame.doorU-1),Math.round(frame.doorU+1)].filter(u=>u>=0&&u<=frame.width&&wallAt(u,0)?.type==='wall');
  const palaceSupports=kind==='palace'?entranceSupports():[],hasBalcony=palaceSupports.length===2;
  const feature=(name:string,draw:()=>void)=>{
    const previous=batch;batch=new WorldBatch(geometry);draw();root.add(batch.finish(`building-detail:${b.id}:${name}`));batch=previous;
  };
  const faceDisc=(u:number,v:number,y:number,radius:number,material:MeshStandardMaterial)=>batch.cylinder(material,at(u,v-.012/T,y),at(u,v+.012/T,y),radius,light);
  const clock=(u:number,v:number,y:number,radius=.27,facing=-1)=>{
    faceDisc(u,v,y,radius+.036,iron);faceDisc(u,v+facing*.018/T,y,radius,materials.get('linen'));
    for(let n=0;n<12;n++){
      const angle=n*Math.PI/6,a=at(u+Math.sin(angle)*radius*.78/T,v+facing*.045/T,y+Math.cos(angle)*radius*.78),c=at(u+Math.sin(angle)*radius*.92/T,v+facing*.045/T,y+Math.cos(angle)*radius*.92);
      batch.cylinder(iron,a,c,.012,light);
    }
    batch.cylinder(iron,at(u,v+facing*.050/T,y),at(u,v+facing*.050/T,y+radius*.65),.018,light);
    batch.cylinder(iron,at(u,v+facing*.050/T,y),at(u+radius*.49/T,v+facing*.050/T,y-radius*.22),.018,light);
  };
  const tower=(u:number,v:number,w:number,top:number,bottom=0,civic=false)=>feature(civic?'civic-clock-tower':'bell-tower',()=>{
    // The civic cupola rests on the facade. It never fills the entrance below.
    box(u,v,(top+bottom)*.5,w,top-bottom,w);
    for(const y of [Math.max(height,bottom),top-.12])box(u,v,y,w+.15,.12,w+.15,trim);
    const e=w*.57,corners=[at(u-e,v-e,top+.06),at(u+e,v-e,top+.06),at(u+e,v+e,top+.06),at(u-e,v+e,top+.06)],apex=at(u,v,top+.64);
    if(civic)batch.primitive('sphere',roof,at(u,v,top+.26),[w*T*.57,.37,w*T*.57],undefined,light);
    else for(let n=0;n<4;n++){const panel=[corners[n],corners[(n+1)%4],apex];batch.polygon(roof,panel,light,roofTextureProjector(panel));}
    box(u,v,top+.06,w*1.16,.08,w*1.16,darkwood);
    box(u,v,top+.91,.044,.45,.044,iron);box(u,v,top+.99,.24,.044,.044,iron);
    for(const face of [-1,1]){
      const cy=top-.53,cv=v+face*w*.51;
      box(u,cv,cy,w*.46,.68,.028/T,darkwood);
      for(const side of [-1,1])box(u+side*w*.25,cv,cy,.040/T,.76,.04/T,trim);
      box(u,cv,cy+.38,w*.54,.055,.04/T,trim);
      if(civic)clock(u,cv+face*.044/T,cy,.26,face);
      else{
        batch.primitive('flare',materials.get('brass'),at(u,cv+face*.022/T,cy-.06),[.13,.22,.09],undefined,light);
        box(u,cv,cy+.20,w*.42,.045,.045/T,wood);
      }
    }
  });
  const gallery=(depth=.65)=>feature('gallery',()=>{
    const roofY=height*.81;
    for(let u=.35;u<frame.width;u+=1.20){
      if(Math.abs(u-doorU)<.48)continue;
      batch.cylinder(wood,at(u,-depth,.08),at(u,-depth,roofY),.055,light);box(u,-depth,.06,.15,.12,.15,materials.get('stone'));
      batch.cylinder(wood,at(u,-depth,roofY-.39),at(u+(u<frame.width/2?.24:-.24),-depth,roofY-.03),.028,light);
    }
    const panel=[at(-.10,-depth-.15,roofY),at(frame.width+.10,-depth-.15,roofY),at(frame.width+.10,.08,roofY+.20),at(-.10,.08,roofY+.20)];
    batch.polygon(roof,panel,light,roofTextureProjector(panel));
    batch.polygon(darkwood,[panel[0],panel[1],panel[1].clone().add(new Vector3(0,-.07,0)),panel[0].clone().add(new Vector3(0,-.07,0))],light);
    box(frame.width*.5,-depth,roofY-.05,frame.width+.18,.12,.13,wood);
  });
  const chimney=(u:number,v:number)=>feature('domestic-chimney',()=>{
    const bottom=height-.12,top=height+1.02,brick=materials.get('brick');
    box(u,v,(bottom+top)*.5,.38,top-bottom,.38,brick);box(u,v,top+.015,.48,.12,.48,trim);box(u,v,top+.08,.27,.018,.27,darkwood);
  });

  if(['church','chapel'].includes(kind)){
    const reserved=(end:boolean)=>[0,1].every(u=>[0,1].every(v=>wallAt(end?frame.width-u:u,v)?.type==='wall'));
    const end=[true,false].find(reserved)??[true,false].find(end=>wallAt(end?frame.width:0,0)?.type==='wall');
    if(end!==undefined){
      const wide=reserved(end),u=end?frame.width-(wide?.5:0):wide?.5:0,v=wide?.5:0;
      // The tower foundation follows the solid authored cells rather than
      // the wall-art inset. A narrow corner never occupies the nave floor.
      tower(u-alongInset,v-depthInset,wide?1.8:.8,height+(kind==='church'?2.25:1.1));
    }
    const center=frame.width*.5;batch.polygon(wall,[at(center-1,0,height),at(center+1,0,height),at(center,0,height+.72)],light);
    for(let v=1;v<frame.depth;v+=1.6)for(const u of [0,frame.width])if(wallAt(u,Math.round(v))?.type==='wall')box(u,v,.80,.20,1.6,.32,trim);
  }else if(['cabildo','townhall'].includes(kind)){
    const columns=Math.max(3,Math.floor(frame.width/1.1));
    for(let n=0;n<columns;n++){
      const u=(n+.5)*frame.width/columns;
      if(Math.abs(u-frame.doorU)>.45)box(u,-.38,height*.40,.22,height*.8,.38,trim);
      if(n<columns-1){const a=u+.15,c=(n+1.5)*frame.width/columns-.15,r=(c-a)*T*.5,y=height*.73;for(let k=0;k<10;k++){const angle=Math.PI*k/10,next=Math.PI*(k+1)/10;batch.cylinder(trim,at((a+c)*.5+Math.cos(angle)*r/T,-.58,y+Math.sin(angle)*r*.6),at((a+c)*.5+Math.cos(next)*r/T,-.58,y+Math.sin(next)*r*.6),.06,light);}}
    }
    box(frame.width*.5,-.36,height*.84,frame.width,.16,.44,trim);
    tower(frame.width*.5,.1,.86,height+1.35,height-.12,true);
  }else if(['farmhouse','estancia','posta','pulperia'].includes(kind)){
    gallery(kind==='pulperia'?.75:.55);
    if(kind==='farmhouse'||kind==='estancia')chimney(Math.max(.60,frame.width-.65),Math.max(.55,frame.depth-.60));
    if(kind==='pulperia')feature('trade-sign',()=>{
      const u=Math.min(frame.width-.55,doorU+1.15),y=height*.68;
      box(u,-.30,y+.40,.055,.055,.66,iron);
      for(const offset of [-.19,.19])box(u+offset,-.58,y+.22,.017,.36,.02,iron);
      box(u,-.58,y,.58,.36,.06,wood);
      for(const offset of [-.17,.17])box(u+offset,-.625,y,.022,.25,.018,trim);
      for(const offset of [-.105,.105])box(u,-.625,y+offset,.47,.020,.018,trim);
      // A small barrel emblem identifies trade without adding tiny text.
      box(u,-.638,y,.13,.21,.018,darkwood);for(const offset of [-.065,.065])box(u,-.65,y+offset,.17,.025,.020,trim);
    });
  }else if(kind==='palace'){
    const floor=height*.56;
    feature('entrance-columns',()=>{for(const support of palaceSupports){const u=support-alongInset;batch.cylinder(trim,at(u,-.25,.08),at(u,-.25,floor-.13),.10,light);box(u,-.25,.08,.24,.16,.24,materials.get('stone'));box(u,-.25,floor-.15,.25,.12,.25,trim);}});
    if(hasBalcony)feature('palace-balcony',()=>{
      const lo=Math.min(...palaceSupports)-alongInset,hi=Math.max(...palaceSupports)-alongInset;
      box((lo+hi)*.5,-.27,floor-.08,hi-lo+.25,.16,.65,materials.get('stone'));
      for(const u of [lo,hi]){box(u,-.54,floor+.34,.085,.68,.085,trim);box(u,-.54,floor+.70,.12,.06,.12,trim);}
      for(const y of [floor+.07,floor+.64])batch.cylinder(iron,at(lo,-.54,y),at(hi,-.54,y),.021,light);
      const rods=Math.ceil((hi-lo)/.18);for(let n=0;n<=rods;n++){const u=lo+(hi-lo)*n/rods;batch.cylinder(iron,at(u,-.54,floor+.07),at(u,-.54,floor+.64),.012,light);}
      for(const u of [lo,hi])batch.cylinder(iron,at(u,-.54,floor+.64),at(u,-.055,floor+.64),.021,light);
      box(doorU,-.085/T,floor+.64,.74/T,1.24,.055/T,darkwood);
      for(const side of [-1,1])box(doorU+side*.405/T,-.12/T,floor+.64,.07/T,1.36,.065/T,trim);
      box(doorU,-.12/T,floor+1.30,.88/T,.08,.065/T,trim);
      box(doorU,-.125/T,floor+.64,.027/T,1.22,.02/T,wood);
      batch.polygon(wall,[at(lo-.10,-.12/T,height),at(hi+.10,-.12/T,height),at((lo+hi)*.5,-.12/T,height+.58)],light);
      for(const u of [lo,hi])box(u,-.10/T,(floor+height)*.5,.17,height-floor,.14,trim);
    });
  }else if(['warehouse','depot','stable','barracks'].includes(kind)){
    for(let v=.3;v<frame.depth;v+=1.7)for(const u of [0,frame.width])box(u,v,.5,.18,1,.22,trim);
    if(kind==='depot'){gallery(.60);box(frame.doorU,-.52,1.2,.10,2.4,.1,wood);batch.primitive('torus',iron,at(frame.doorU,-.75,2.2),[.12,.12,.12],rotation,light);}
    if(kind==='barracks')feature('barracks-gate',()=>{
      const supports=entranceSupports();
      for(const support of supports)box(support-alongInset,-.09/T,height*.50,.22,height,.20/T,trim);
      if(supports.length!==2)return;
      const lo=Math.min(...supports)-alongInset,hi=Math.max(...supports)-alongInset;
      box((lo+hi)*.5,-.11/T,height-.06,hi-lo+.24,.18,.25/T,trim);
      const y=height-.03,v=-.26/T,w=.19/T;
      batch.polygon(trim,[at(doorU-w,v,y+.18),at(doorU+w,v,y+.18),at(doorU+w,v,y-.09),at(doorU,v,y-.23),at(doorU-w,v,y-.09)],light);
      for(const sign of [-1,1]){
        batch.cylinder(iron,at(doorU-sign*.105/T,v-.014/T,y+.105),at(doorU+sign*.105/T,v-.014/T,y-.105),.017,light);
        batch.cylinder(materials.get('brass'),at(doorU+sign*.068/T,v-.018/T,y-.132),at(doorU+sign*.136/T,v-.018/T,y-.068),.018,light);
      }
    });
    if(kind==='stable')feature('stable-timber-frame',()=>{
      const y=height*.91;
      box(frame.width*.5,-.13/T,y,frame.width+.10,.14,.20/T,wood);
      for(let u=0;u<=frame.width;u+=2)if(wallAt(u,0)?.type==='wall'){
        const a=u-alongInset;box(a,-.13/T,y*.5,.15,y,.20/T,wood);
        batch.cylinder(wood,at(a,-.25/T,y-.43),at(a+(u<frame.width/2?.42:-.42),-.25/T,y-.04),.04,light);
      }
      const center=frame.width*.5,half=Math.min(1.20,frame.width*.32),rise=.65,v=-.11/T;
      const panel=[at(center-half,v,height+.025),at(center+half,v,height+.025),at(center,v,height+rise)];
      batch.polygon(darkwood,panel,light);
      for(let n=0;n<3;n++)batch.cylinder(wood,panel[n],panel[(n+1)%3],.04,light);
      for(let u=center-half+.18;u<center+half;u+=.25){const top=height+.025+(rise-.025)*(1-Math.abs(u-center)/half);batch.cylinder(trim,at(u,v-.015/T,height+.055),at(u,v-.015/T,top-.035),.018,light);}
    });
  }else if(kind==='smithy'){
    box(frame.width-.65,frame.depth-.55,(height+1)*.5,.42,height+1,.42,materials.get('brick'));box(frame.width-.65,frame.depth-.55,height+1,.56,.14,.56,trim);
  }
  if(['palace','townhall','mansion','cabildo'].includes(kind))feature('upper-windows',()=>{
    for(let u=.7;u<frame.width;u+=1.35){
      if(hasBalcony&&Math.abs(u-doorU)<.64)continue;
      const y=height*.71;box(u,-.085/T,y,.45/T,.65,.04/T,darkwood);
      for(const side of [-1,1])box(u+side*.255/T,-.096/T,y,.055/T,.75,.065/T,trim);
      for(const dy of [-.36,.36])box(u,-.096/T,y+dy,.56/T,.055,.065/T,trim);
      box(u,-.125/T,y,.025/T,.64,.020/T,iron);box(u,-.125/T,y,.44/T,.025,.020/T,iron);
    }
  });
  root.add(batch.finish(`building-detail:${b.id}:fabric`));return root;
}
