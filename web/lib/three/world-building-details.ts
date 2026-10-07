import {Group,MeshStandardMaterial,Quaternion,Vector3} from 'three';
import {entranceFrame,getBuildingProfile} from '../../../game/building-profile.js';
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
      if(civic)clock(u,cv+face*.044/T,cy,Math.min(.34,w*T*.30),face);
      else{
        batch.primitive('flare',materials.get('brass'),at(u,cv+face*.022/T,cy-.06),[.13,.22,.09],rotation,light);
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
  const chimney=(u:number,v:number,options:{material?:MeshStandardMaterial;top?:number;industrial?:boolean}={})=>feature(options.industrial?'forge-chimney':'domestic-chimney',()=>{
    const bottom=height-.12,top=options.top??height+1.02,w=options.industrial?.42:.38,cap=options.industrial?.56:.48;
    box(u,v,(bottom+top)*.5,w,top-bottom,w,options.material??materials.get('brick'));box(u,v,top+.015,cap,.12,cap,trim);box(u,v,top+.08,w-.11,.018,w-.11,darkwood);
  });
  const sideChimney=(industrial=false)=>{
    const supports=[frame.width,0].flatMap(u=>Array.from({length:Math.max(0,Math.floor(frame.depth)-1)},(_,n)=>({u,v:n+1}))).filter(({u,v})=>{
      const point=frame.at(u,v);
      return wallAt(u,v)?.type==='wall'&&!(input.terrain.upperSurfaces??[]).some(surface=>surface.x===point.x&&surface.y===point.y&&!surface.blocked&&(surface.tacticalLevel??0)>0);
    }).sort((a,c)=>Math.abs(a.v-frame.depth*.66)-Math.abs(c.v-frame.depth*.66));
    if(supports.length){
      const {u,v}=supports[0],rise=b.roof==='terrace'?0:Math.min(getBuildingProfile(b).roofRise/25.066666666666666,Math.max(.4,frame.width*.28));
      chimney(u-alongInset,v-depthInset,{material:industrial?materials.get('brick'):wall,top:height+rise+(industrial?1.08:.64),industrial});
    }
  };

  if(kind==='chapel')feature('chapel-bell-gable',()=>{
    const rise=Math.min(getBuildingProfile(b).roofRise/25.066666666666666,Math.max(.4,frame.width*.28)),bottom=height+rise*.62,spring=bottom+.55,u=doorU,outer=.64,inner=.23,front=-.17/T,back=front+.095/T;
    // Two jambs and an arched crown leave a real bell opening. The narrow
    // gable joins the existing front masonry without occupying floor cells.
    box(u,front,bottom+.05,outer*2/T,.10,.19/T,trim);
    for(const sign of [-1,1])box(u+sign*(outer+inner)*.5/T,front,(bottom+spring)*.5,(outer-inner)/T,spring-bottom,.19/T,wall);
    const faceUV=(point:Vector3)=>[point.x*frame.u.x+point.z*frame.u.y,point.y] as const;
    for(let n=0;n<16;n++){
      const a=n*Math.PI/16,c=(n+1)*Math.PI/16;
      const crown=(angle:number,width:number,rise:number,v:number)=>at(u+Math.cos(angle)*width/T,v,spring+Math.sin(angle)*rise);
      for(const v of [front-.095/T,back])batch.polygon(wall,[crown(a,outer,.52,v),crown(c,outer,.52,v),crown(c,inner,.23,v),crown(a,inner,.23,v)],light,faceUV);
      batch.polygon(wall,[crown(a,outer,.52,front-.095/T),crown(c,outer,.52,front-.095/T),crown(c,outer,.52,back),crown(a,outer,.52,back)],light,faceUV);
      batch.polygon(wall,[crown(a,inner,.23,front-.095/T),crown(c,inner,.23,front-.095/T),crown(c,inner,.23,back),crown(a,inner,.23,back)],light,faceUV);
      batch.cylinder(trim,crown(a,outer,.52,front-.105/T),crown(c,outer,.52,front-.105/T),.038,light);
      batch.cylinder(trim,crown(a,inner,.23,front-.105/T),crown(c,inner,.23,front-.105/T),.024,light);
    }
    box(u,front+.025/T,spring-.035,inner*2/T,.055,.085/T,wood);
    batch.primitive('flare',materials.get('brass'),at(u,front+.025/T,spring-.18),[.12,.22,.10],rotation,light);
    batch.cylinder(iron,at(u,front+.025/T,spring-.25),at(u,front+.025/T,spring-.34),.022,light);
    box(u,front,spring+.77,.035/T,.44,.035/T,iron);box(u,front,spring+.83,.23/T,.035,.035/T,iron);
  });
  else if(kind==='church'){
    const reserved=(end:boolean)=>[0,1].every(u=>[0,1].every(v=>wallAt(end?frame.width-u:u,v)?.type==='wall'));
    const end=[true,false].find(reserved)??[true,false].find(end=>wallAt(end?frame.width:0,0)?.type==='wall');
    if(end!==undefined){
      const wide=reserved(end),u=end?frame.width-(wide?.5:0):wide?.5:0,v=wide?.5:0;
      // The tower foundation follows the solid authored cells rather than
      // the wall-art inset. A narrow corner never occupies the nave floor.
      tower(u-alongInset,v-depthInset,wide?1.8:.8,height+2.25);
    }
    const center=frame.width*.5;batch.polygon(wall,[at(center-1,0,height),at(center+1,0,height),at(center,0,height+.72)],light);
    for(let v=1;v<frame.depth;v+=1.6)for(const u of [0,frame.width])if(wallAt(u,Math.round(v))?.type==='wall')box(u,v,.80,.20,1.6,.32,trim);
  }else if(['cabildo','townhall'].includes(kind)){
    const twoStoreys=height>=4,storey=twoStoreys?height*.50:height,columns:number[]=[];
    for(let u=0;u<=frame.width;u++)if(wallAt(u,0)?.type==='wall')columns.push(u===0||u===frame.width?u:u-alongInset);
    columns.sort((a,b)=>a-b);
    const arcade=(name:string,bottom:number,top:number,upper=false)=>feature(name,()=>{
      for(const u of columns){box(u,-.16/T,(bottom+top)*.5,.21/T,top-bottom,.25/T,trim);box(u,-.16/T,top-.08,.30/T,.13,.29/T,trim);}
      for(let n=1;n<columns.length;n++){
        const left=columns[n-1]+.14/T,right=columns[n]-.14/T;
        if(right-left<.25/T)continue;
        const radius=(right-left)*T*.5,center=(left+right)*.5,peak=top-.17,spring=peak-Math.min(radius,.52);
        const arch=Array.from({length:17},(_,k)=>at(center+Math.cos(k*Math.PI/16)*radius/T,-.20/T,spring+Math.sin(k*Math.PI/16)*(peak-spring)));
        if(upper){
          // Upper arcade recesses are scenery on the retained exterior shell.
          // They never create new playable doors or reveal actors indoors.
          const pane=[at(left,-.13/T,bottom+.10),at(right,-.13/T,bottom+.10),...arch.map(point=>point.clone().add(new Vector3(frame.v.x*.07,0,frame.v.y*.07)))];
          batch.polygon(darkwood,pane,light);
          for(const u of [left,right])batch.cylinder(trim,at(u,-.20/T,bottom+.08),at(u,-.20/T,spring),.038,light);
          for(const y of [bottom+.14,bottom+.53])batch.cylinder(iron,at(left,-.26/T,y),at(right,-.26/T,y),.021,light);
          const rods=Math.max(2,Math.ceil((right-left)/.20));for(let k=0;k<=rods;k++){const u=left+(right-left)*k/rods;batch.cylinder(iron,at(u,-.26/T,bottom+.14),at(u,-.26/T,bottom+.53),.012,light);}
        }
        for(let k=1;k<arch.length;k++)batch.cylinder(trim,arch[k-1],arch[k],.053,light);
      }
    });
    arcade('civic-ground-arcade',.03,storey-.09);
    if(twoStoreys)arcade('civic-upper-arcade',storey+.12,height-.12,true);
    feature('civic-cornices',()=>{
      for(const y of twoStoreys?[storey,height-.10]:[height-.10]){
        box(frame.width*.5,-.12/T,y,frame.width+.20/T,.15,.29/T,trim);
        for(const u of [0,frame.width])box(u,frame.depth*.5,y,.22/T,.14,frame.depth,trim);
      }
    });
    if(twoStoreys)feature('civic-side-windows',()=>{
      const y=storey+(height-storey)*.46;
      for(const side of [0,frame.width])for(let v=1;v<frame.depth;v+=2){
        if(wallAt(side,v)?.type!=='wall')continue;
        const sign=side===0?-1:1,u=side+sign*.085/T;
        box(u,v,y,.04/T,1.04,.72/T,darkwood);
        for(const offset of [-.40,.40])box(u+sign*.024/T,v+offset/T,y,.065/T,1.17,.055/T,trim);
        for(const dy of [-.55,.55])box(u+sign*.024/T,v,y+dy,.065/T,.06,.86/T,trim);
        for(const offset of [-.23,0,.23])box(u+sign*.045/T,v+offset/T,y,.023/T,1.03,.024/T,iron);
        box(u+sign*.045/T,v,y-.16,.023/T,.024,.72/T,iron);
      }
    });
    tower(frame.width*.5,.1,Math.min(1.4,Math.max(1.1,frame.width*.22)),height+(twoStoreys?2.05:1.35),height-.12,true);
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
  }else if(kind==='smithy')sideChimney(true);
  else if(kind==='house')sideChimney();
  if(['palace','mansion'].includes(kind))feature('upper-windows',()=>{
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
