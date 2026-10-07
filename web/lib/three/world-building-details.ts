import {ExtrudeGeometry,Group,Matrix4,MeshStandardMaterial,Quaternion,Shape,Vector3} from 'three';
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
  const bearing=(u:number,v=0,actualAlong=false)=>[u-(actualAlong?alongInset:.06*(frame.u.x+frame.u.y)),v-.06*(frame.v.x+frame.v.y)] as const;
  const walkableAbove=(u:number,v:number,w:number,d=w)=>{
    const point=at(u,v,0),alongReach=(w+1)*T*.5,depthReach=(d+1)*T*.5;
    return (input.terrain.upperSurfaces??[]).some(surface=>{
      const x=surface.x*T-point.x,z=surface.y*T-point.z;
      return !surface.blocked&&(surface.tacticalLevel??0)>0&&Math.abs(x*frame.u.x+z*frame.u.y)<alongReach-1e-6&&Math.abs(x*frame.v.x+z*frame.v.y)<depthReach-1e-6;
    });
  };
  const roofRise=b.roof==='terrace'||(input.terrain.upperSurfaces??[]).some(surface=>surface.kind==='roof'&&surface.buildingId===b.id)?0:Math.min(getBuildingProfile(b).roofRise/25.066666666666666,Math.max(.4,frame.width*.28));
  const entranceSupports=()=>[Math.round(frame.doorU-1),Math.round(frame.doorU+1)].filter(u=>u>=0&&u<=frame.width&&wallAt(u,0)?.type==='wall');
  const palaceSupports=kind==='palace'?entranceSupports():[],hasBalcony=palaceSupports.length===2&&height>=4;
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
  const tower=(u:number,v:number,w:number,top:number,bottom=0,civic=false)=>{
    // The broad base cornice belongs to the occupied tower footprint too.
    // Decoration cannot fill an authored upper walking cell.
    if(walkableAbove(u,v,w+.15))return;
    feature(civic?'civic-clock-tower':'bell-tower',()=>{
    // The civic cupola rests on the facade. It never fills the entrance below.
    box(u,v,(top+bottom)*.5,w,top-bottom,w);
    for(const y of [Math.max(height,bottom),top-.12])box(u,v,y,w+.15,.12,w+.15,trim);
    const e=w*.57,corners=[at(u-e,v-e,top+.06),at(u+e,v-e,top+.06),at(u+e,v+e,top+.06),at(u-e,v+e,top+.06)],apex=at(u,v,top+.64);
    if(civic)batch.primitive('sphere',roof,at(u,v,top+.26),[w*T*.57,.37,w*T*.57],undefined,light);
    else for(let n=0;n<4;n++){const panel=[corners[n],corners[(n+1)%4],apex];batch.polygon(roof,panel,light,roofTextureProjector(panel));}
    box(u,v,top+.06,w*1.16,.08,w*1.16,darkwood);
    box(u,v,top+.91,.044,.45,.044,iron);box(u,v,top+.99,.24,.044,.044,iron);
    if(!civic){
      const openingHeight=Math.min(1.30,Math.max(.85,w*T*.70)),bottom=top-.17-openingHeight,spring=top-.17-.24,rx=Math.min(.50,w*T*.22),cy=(bottom+top-.17)*.5;
      for(const [nu,nv,du,dv]of [[0,-1,1,0],[0,1,1,0],[-1,0,0,1],[1,0,0,1]]){
        const point=(a:number,y:number,outset=.01)=>at(u+nu*(w*.51+outset/T)+du*a/T,v+nv*(w*.51+outset/T)+dv*a/T,y);
        const arch=Array.from({length:17},(_,n)=>point(Math.cos(n*Math.PI/16)*rx,spring+Math.sin(n*Math.PI/16)*.24));
        batch.polygon(darkwood,[point(-rx,bottom),point(rx,bottom),...arch],light);
        for(const sign of [-1,1])batch.cylinder(trim,point(sign*(rx+.025),bottom-.025,.025),point(sign*(rx+.025),spring,.025),.032,light);
        for(let n=1;n<arch.length;n++)batch.cylinder(trim,arch[n-1],arch[n],.037,light);
        batch.cylinder(wood,point(-rx*.91,spring-.025,.028),point(rx*.91,spring-.025,.028),.032,light);
        const bellRotation=du?rotation:rotation.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.PI*.5)),radius=Math.min(.18,rx*.60);
        batch.primitive('flare',materials.get('brass'),point(0,cy-.05,.028),[radius,.28,.11],bellRotation,light);
        batch.cylinder(iron,point(0,cy-.18,.030),point(0,cy-.25,.030),.023,light);
      }
      box(u,v,bottom-.09,w+.12,.12,w+.12,trim);
      return;
    }
    for(const face of [-1,1]){
      const cy=top-.53,cv=v+face*w*.51;
      box(u,cv,cy,w*.46,.68,.028/T,darkwood);
      for(const side of [-1,1])box(u+side*w*.25,cv,cy,.040/T,.76,.04/T,trim);
      box(u,cv,cy+.38,w*.54,.055,.04/T,trim);
      clock(u,cv+face*.044/T,cy,Math.min(.34,w*T*.30),face);
    }
    });
  };
  const townhallCrown=()=>{
    const supports=[...new Set([-2,2].map(offset=>Math.max(0,Math.min(frame.width,Math.round(frame.doorU+offset)))))].filter(u=>wallAt(u,0)?.type==='wall');
    if(supports.length!==2||height<2.4)return;
    const lo=Math.min(...supports)-alongInset,hi=Math.max(...supports)-alongInset,width=hi-lo,center=(lo+hi)*.5;
    // The long, shallow crown and its stone entablature must not occupy an
    // authored roof route. Their rectangle follows the actual facade rotation.
    if(walkableAbove(center,-.06,width+.20,.68))return;
    const V=25.066666666666666,rise=Math.min(48,24+width*5)/V,baseY=height+4/V,front=-.31,back=.22,x=(value:number)=>value/40*width*T,y=(value:number)=>value/46*rise,shape=new Shape();
    // This closed curved outline follows the retained town-hall sprite crown.
    // The cabildo keeps its distinct clock cupola.
    shape.moveTo(0,0);shape.lineTo(0,y(7));shape.lineTo(x(9),y(7));shape.lineTo(x(9),y(14));shape.quadraticCurveTo(x(9),y(21),x(14),y(25));shape.lineTo(x(14),y(32));shape.bezierCurveTo(x(14),y(48),x(26),y(48),x(26),y(32));shape.lineTo(x(26),y(25));shape.quadraticCurveTo(x(31),y(21),x(31),y(14));shape.lineTo(x(31),y(7));shape.lineTo(x(40),y(7));shape.lineTo(x(40),0);shape.closePath();
    feature('townhall-clock-pediment',()=>{
      const mesh=new ExtrudeGeometry(shape,{depth:(back-front)*T,bevelEnabled:false,curveSegments:16});
      batch.add(mesh,wall,new Matrix4().compose(at(lo,front,baseY),rotation,new Vector3(1,1,1)),light);mesh.dispose();
      const outline=shape.getPoints(16);for(let n=1;n<outline.length;n++)batch.cylinder(trim,at(lo+outline[n-1].x/T,front-.025/T,baseY+outline[n-1].y),at(lo+outline[n].x/T,front-.025/T,baseY+outline[n].y),.045,light);
      box(center,-.06,height+1.5/V,width+.20,7/V,.68,materials.get('stone'));
      clock(center,front-.028/T,baseY+y(29),7.5/V);
    });
    feature('townhall-finials',()=>{
      for(const u of [lo+.16,hi-.16]){
        box(u,-.135,baseY+7.5/V,.20,5/V,.31,materials.get('stone'));
        batch.primitive('sphere',trim,at(u,-.13,baseY+12/V),[2.3/V,3/V,2.3/V],undefined,light);
      }
    });
  };
  const frontSupports=()=>Array.from({length:Math.floor(frame.width)+1},(_,u)=>u).filter(u=>wallAt(u,0)?.type==='wall'&&(u===0||u===frame.width||u%2===0||Math.abs(u-frame.doorU)===1));
  const roofCanopy=(name:string,supports:number[],depth=.55,masonry=false)=>{
    if(supports.length<2||height<2.4)return;
    const lo=Math.min(...supports),hi=Math.max(...supports),low=Math.max(2.12,height*.82),high=low+.24,front=-depth-.15,back=.16;
    const panel=[at(lo-.18,front,low),at(hi+.18,front,low),at(hi+.18,back,high),at(lo-.18,back,high)],roofAt=(v:number)=>low+(v-front)/(back-front)*(high-low);
    feature(name,()=>{
      for(const u of supports){
        // Wide masonry feet use a slightly smaller global art inset. They
        // still meet the shell, and every ground vertex stays in its wall cell.
        const shift=masonry?.06:0,a=u-shift*(frame.u.x+frame.u.y),v=-shift*(frame.v.x+frame.v.y),top=roofAt(v);
        if(masonry){
          box(a,v,(top+.16)*.5,.30/T,top-.16,.30/T,wall);box(a,v,.08,.38/T,.16,.38/T,materials.get('stone'));box(a,v,top-.02,.38/T,.10,.38/T,trim);
        }else{
          box(a,v,top*.5,.11/T,top,.11/T,wood);box(a,v,.055,.21/T,.11,.21/T,materials.get('stone'));
          const toward=u==lo?1:-1;batch.cylinder(wood,at(a,v,top-.30),at(a+toward*.28,v,roofAt(v)-.065),.025,light);
        }
      }
      box((lo+hi)*.5,0,roofAt(0)-.045,hi-lo+.18,.11,.14/T,masonry?trim:wood);
      batch.polygon(roof,panel,light,roofTextureProjector(panel));
    });
    root.getObjectByName(`building-detail:${b.id}:${name}`)?.add(roofEdgeDetails(`${b.id}:${name}`,[panel],low,geometry,roof,darkwood,light));
  };
  const farmhouseGallery=()=>{
    const frontSupports=[...new Set([0,.3,.7,1].map(r=>Math.round(frame.width*r)))].filter(u=>wallAt(u,0)?.type==='wall'),length=Math.max(1,Math.round(frame.depth*.57)),sideSupports=[0,length].filter(v=>wallAt(0,v)?.type==='wall');
    const hasFront=frontSupports.length>=2,hasSide=sideSupports.length===2,joint=hasFront&&hasSide&&frontSupports[0]===0;
    if((!hasFront&&!hasSide)||height<2.4)return;
    const low=height-.16,high=height+.12,outside=-.45,inside=.42,postTop=low+(0-outside)/(inside-outside)*(high-low),panels:Vector3[][]=[];
    feature('farmhouse-gallery',()=>{
      const post=(u:number,v:number,du:number,dv:number)=>{
        box(u,v,postTop*.5,.11/T,postTop,.11/T,wood);box(u,v,.055,.21/T,.11,.21/T,materials.get('stone'));
        batch.cylinder(wood,at(u,v,postTop-.32),at(u+du*.30,v+dv*.30,postTop-.06),.027,light);
      };
      if(hasFront){
        const lo=Math.min(...frontSupports),hi=Math.max(...frontSupports);
        for(const u of frontSupports)post(u,0,u===lo?1:-1,0);
        box((lo+hi)*.5,0,postTop-.04,hi-lo+.18,.12,.14/T,wood);
        panels.push([at(joint?outside:lo-.15,outside,low),at(hi+.15,outside,low),at(hi+.15,inside,high),at(joint?inside:lo-.15,inside,high)]);
      }
      if(hasSide){
        for(const v of sideSupports)if(v!==0||!joint)post(0,v,0,v===0?1:-1);
        box(0,length*.5,postTop-.04,.14/T,.12,length+.18,wood);
        panels.push([at(outside,length+.15,low),at(outside,joint?outside:0,low),at(inside,joint?inside:0,high),at(inside,length+.15,high)]);
      }
      for(const panel of panels)batch.polygon(roof,panel,light,roofTextureProjector(panel));
    });
    root.getObjectByName(`building-detail:${b.id}:farmhouse-gallery`)?.add(roofEdgeDetails(`${b.id}:farmhouse-gallery`,panels,low,geometry,roof,darkwood,light));
  };
  const chimney=(u:number,v:number,options:{material?:MeshStandardMaterial;capMaterial?:MeshStandardMaterial;top?:number;industrial?:boolean;name?:string}={})=>feature(options.name??(options.industrial?'forge-chimney':'domestic-chimney'),()=>{
    const bottom=height-.12,top=options.top??height+1.02,w=options.industrial?.42:.38,cap=options.industrial?.56:.48;
    box(u,v,(bottom+top)*.5,w,top-bottom,w,options.material??materials.get('brick'));box(u,v,top+.015,cap,.12,cap,options.capMaterial??trim);box(u,v,top+.08,w-.11,.018,w-.11,darkwood);
  });
  const sideChimney=(industrial=false)=>{
    const supports=[frame.width,0].flatMap(u=>Array.from({length:Math.max(0,Math.floor(frame.depth)-1)},(_,n)=>({u,v:n+1}))).filter(({u,v})=>{
      const point=frame.at(u,v);
      return wallAt(u,v)?.type==='wall'&&!(input.terrain.upperSurfaces??[]).some(surface=>surface.x===point.x&&surface.y===point.y&&!surface.blocked&&(surface.tacticalLevel??0)>0);
    }).sort((a,c)=>Math.abs(a.v-frame.depth*.66)-Math.abs(c.v-frame.depth*.66));
    if(supports.length){
      const {u,v}=supports[0];
      chimney(u-alongInset,v-depthInset,{material:industrial?materials.get('brick'):wall,top:height+roofRise+(industrial?1.08:.64),industrial});
    }
  };

  if(kind==='chapel'&&!walkableAbove(doorU,-.17/T,1.36/T,.28/T))feature('chapel-bell-gable',()=>{
    const bottom=height+roofRise*.62,spring=bottom+.55,u=doorU,outer=.64,inner=.23,front=-.17/T,back=front+.095/T;
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
    const reserved=(end:boolean)=>[0,1].every(u=>[0,1].every(v=>wallAt(end?frame.width-u:u,v)?.type==='wall'))&&!walkableAbove((end?frame.width-.5:.5)-alongInset,.5-depthInset,1.95);
    const end=[true,false].find(reserved)??[true,false].find(end=>wallAt(end?frame.width:0,0)?.type==='wall'&&!walkableAbove((end?frame.width:0)-alongInset,-depthInset,.95));
    if(end!==undefined){
      const wide=reserved(end),u=end?frame.width-(wide?.5:0):wide?.5:0,v=wide?.5:0;
      // The tower foundation follows the solid authored cells rather than
      // the wall-art inset. A narrow corner never occupies the nave floor.
      tower(u-alongInset,v-depthInset,wide?1.8:.8,height+roofRise+(wide?1.80:1.25));
    }
    const span=Math.min(Math.max(.8,frame.width-1.8),5.2),center=Math.max(span*.5+.15,Math.min(frame.width-span*.5-.15,doorU)),rise=roofRise,crest=rise+.42;
    feature('church-shaped-facade',()=>{
      const width=span*T,x=(value:number)=>value/40*width,y=(value:number)=>value/50*crest,shape=new Shape();
      // The retained town-parish catalogue uses a curved masonry silhouette.
      // Extrusion keeps that concave outline closed and joined to the gable.
      shape.moveTo(0,0);shape.lineTo(0,y(5));shape.bezierCurveTo(x(5),y(6),x(7),y(10),x(9),y(23));shape.bezierCurveTo(x(11),y(34),x(14),y(29),x(15),y(40));shape.bezierCurveTo(x(17),y(53),x(23),y(53),x(25),y(40));shape.bezierCurveTo(x(26),y(29),x(29),y(34),x(31),y(23));shape.bezierCurveTo(x(33),y(10),x(35),y(6),x(40),y(5));shape.lineTo(width,0);shape.closePath();
      const front=-.22/T,baseY=height-.035,mesh=new ExtrudeGeometry(shape,{depth:.27,bevelEnabled:false,curveSegments:12});
      batch.add(mesh,wall,new Matrix4().compose(at(center-span*.5,front,baseY),rotation,new Vector3(1,1,1)),light);mesh.dispose();
      const outline=shape.getPoints(14);for(let n=1;n<outline.length;n++)batch.cylinder(trim,at(center-span*.5+outline[n-1].x/T,front-.035/T,baseY+outline[n-1].y),at(center-span*.5+outline[n].x/T,front-.035/T,baseY+outline[n].y),.038,light);
      box(center,-.13/T,height+.015,span+.17/T,.13,.35/T,trim);
      box(center,-.16/T,height+crest+.18,.040/T,.50,.040/T,iron);box(center,-.16/T,height+crest+.27,.28/T,.040,.040/T,iron);
    });
    feature('church-oculus',()=>{
      const y=height+rise*.43,radius=Math.min(.28,span*T*.10),v=-.276/T;
      faceDisc(center,v,y,radius-.010,darkwood);
      const q=new Quaternion().setFromUnitVectors(new Vector3(0,0,1),new Vector3(frame.v.x,0,frame.v.y));
      batch.primitive('torus',trim,at(center,v-.018/T,y),[radius,radius,radius],q,light);
      for(const a of [-.48,0,.48]){const x=a*radius,half=Math.sqrt(radius*radius-x*x)*.92;batch.cylinder(iron,at(center+x/T,v-.036/T,y-half),at(center+x/T,v-.036/T,y+half),.014,light);}
      batch.cylinder(iron,at(center-radius*.88/T,v-.036/T,y),at(center+radius*.88/T,v-.036/T,y),.015,light);
    });
    feature('church-facade-pilasters',()=>{
      for(const u of [0,frame.width])if(wallAt(u,0)?.type==='wall'){
        const [a,v]=bearing(u);box(a,v,height*.5,.23/T,height,.38/T,trim);box(a,v,.11,.34/T,.22,.38/T,materials.get('stone'));box(a,v,height-.035,.35/T,.15,.38/T,trim);
      }
    });
    for(let v=1;v<frame.depth;v+=1.6)for(const u of [0,frame.width])if(wallAt(u,Math.round(v))?.type==='wall')box(u,v,.80,.20,1.6,.32,trim);
  }else if(kind==='townhall'){
    const profile=getBuildingProfile(b),twoStoreys=height>=4,storey=twoStoreys?height*profile.groundFloorHeight/profile.wallHeight:height,stone=materials.get('stone'),formal=[...new Set([-2,2].map(offset=>Math.max(0,Math.min(frame.width,Math.round(frame.doorU+offset)))))].filter(u=>wallAt(u,0)?.type==='wall');
    feature('townhall-formal-columns',()=>{
      const column=(u:number,v:number,w:number,material:MeshStandardMaterial)=>{
        box(u,v,(storey-.10)*.5,w/T,storey-.10,.38/T,material);box(u,v,.12,.38/T,.24,.38/T,stone);box(u,v,storey-.08,.38/T,.14,.38/T,stone);
      };
      for(const support of formal){const [u,v]=bearing(support,0,support!==0&&support!==frame.width);column(u,v,.30,stone);}
      for(const u of [0,frame.width])for(const v of [0,frame.depth])if(wallAt(u,v)?.type==='wall'){
        const [a,c]=bearing(u,v);if(v!==0||!formal.includes(u))column(a,c,.38,trim);
        if(twoStoreys)box(a,c,(storey+.18+height-.16)*.5,.38/T,height-storey-.34,.38/T,stone);
      }
      for(const u of [0,frame.width])for(let v=2;v<frame.depth-1;v+=4)if(wallAt(u,v)?.type==='wall')column(u-.06*(frame.u.x+frame.u.y),v-depthInset,.30,wall);
    });
    feature('townhall-storey-bands',()=>{
      const bands=twoStoreys?[[storey,stone],[height-.10,trim]] as const:[[height-.10,trim]] as const;
      for(const [y,material]of bands){
        for(const v of [0,frame.depth])box(frame.width*.5,v+(v===0?-.10:.10)/T,y,frame.width+.20/T,.15,.29/T,material);
        for(const u of [0,frame.width])box(u+(u===0?-.10:.10)/T,frame.depth*.5,y,.29/T,.15,frame.depth,material);
      }
    });
    if(twoStoreys)feature('townhall-upper-windows',()=>{
      // Match the retained opening's roughly 3 cm pale iron bars. Their
      // finish and width keep the grille legible against the dark recess.
      const paneHeight=Math.min(.90,height-storey-.82),y=storey+.62+paneHeight*.5,bars=materials.get('iron',{colour:'#a7ae9b'});
      const positions=(length:number,parity:number)=>{const result:number[]=[];for(let n=parity||2;n<length;n+=2)result.push(n);return result;};
      const pane=(u:number,v:number,side:number,alongFront:boolean)=>{
        const width=.72,edge=width*.5+.04,face=alongFront?v+side*.085/T:u+side*.085/T,bar=face+side*.045/T;
        if(alongFront){
          box(u,face,y,width/T,paneHeight,.04/T,darkwood);
          for(const offset of [-edge,edge])box(u+offset/T,face+side*.022/T,y,.06/T,paneHeight+.14,.065/T,trim);
          for(const dy of [-paneHeight*.5-.04,paneHeight*.5+.04])box(u,face+side*.022/T,y+dy,(width+.14)/T,.06,.065/T,trim);
          for(const offset of [-.16,0,.16])box(u+offset/T,bar,y,.028/T,paneHeight,.028/T,bars);box(u,bar,y-.025,width/T,.028,.028/T,bars);
        }else{
          box(face,v,y,.04/T,paneHeight,width/T,darkwood);
          for(const offset of [-edge,edge])box(face+side*.022/T,v+offset/T,y,.065/T,paneHeight+.14,.06/T,trim);
          for(const dy of [-paneHeight*.5-.04,paneHeight*.5+.04])box(face+side*.022/T,v,y+dy,.065/T,.06,(width+.14)/T,trim);
          for(const offset of [-.16,0,.16])box(bar,v+offset/T,y,.028/T,paneHeight,.028/T,bars);box(bar,v,y-.025,.028/T,.028,width/T,bars);
        }
      };
      for(const v of [0,frame.depth])for(const u of positions(frame.width,v===0?Math.round(frame.doorU)%2:1))if(wallAt(u,v))pane(u-alongInset,v,v===0?-1:1,true);
      for(const u of [0,frame.width])for(const v of positions(frame.depth,1))if(wallAt(u,v))pane(u,v-depthInset,u===0?-1:1,false);
    });
    townhallCrown();
  }else if(kind==='cabildo'){
    const twoStoreys=height>=4,storey=twoStoreys?height*.50:height,records:{a:number;u:number;v:number}[]=[];
    for(let u=0;u<=frame.width;u++)if(wallAt(u,0)?.type==='wall'){const [a,v]=bearing(u,0,u!==0&&u!==frame.width);records.push({a:u===0||u===frame.width?u:u-alongInset,u:a,v});}
    records.sort((a,b)=>a.a-b.a);
    const arcade=(name:string,bottom:number,top:number,upper=false)=>feature(name,()=>{
      const columns=records.map(record=>upper?record.a:record.u);
      for(const record of records){const u=upper?record.a:record.u,v=upper?-.16/T:record.v;box(u,v,(bottom+top)*.5,.21/T,top-bottom,(upper?.25:.38)/T,trim);box(u,v,top-.08,.30/T,.13,(upper?.29:.38)/T,trim);}
      for(let n=1;n<columns.length;n++){
        const margin=(upper?.14:.10)/T,left=columns[n-1]+margin,right=columns[n]-margin;
        if(right-left<.25/T)continue;
        const radius=(right-left)*T*.5,center=(left+right)*.5,peak=top-.17,spring=peak-Math.min(radius,.52);
        const arch=Array.from({length:17},(_,k)=>at(center+Math.cos(k*Math.PI/16)*radius/T,upper?-.20/T:-.04,spring+Math.sin(k*Math.PI/16)*(peak-spring)));
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
  }else if(kind==='posta'){
    const supports=[...new Set([0,...entranceSupports(),frame.width])].filter(u=>wallAt(u,0)?.type==='wall').sort((a,c)=>a-c);
    roofCanopy('posta-masonry-veranda',supports,.55,true);
  }else if(['farmhouse','estancia'].includes(kind)){
    farmhouseGallery();
    for(const u of [0,frame.width]){
      const v=Array.from({length:Math.max(0,Math.floor(frame.depth)-1)},(_,n)=>n+1).filter(v=>wallAt(u,v)?.type==='wall'&&!walkableAbove(u-alongInset,v-depthInset,.48)).sort((a,c)=>Math.abs(a-frame.depth+1)-Math.abs(c-frame.depth+1))[0];
      if(v!==undefined)chimney(u-alongInset,v-depthInset,{name:u===0?'farmhouse-chimney-left':'farmhouse-chimney-right',material:wall,capMaterial:materials.get('stone'),top:height+roofRise+.68});
    }
  }else if(kind==='pulperia'){
    roofCanopy('gallery',frontSupports(),.55);
    const support=Array.from({length:Math.floor(frame.width)+1},(_,u)=>u).filter(u=>wallAt(u,0)?.type==='wall').sort((a,c)=>Math.abs(a-frame.doorU-1)-Math.abs(c-frame.doorU-1))[0];
    if(support!==undefined&&height>=2.4)feature('trade-sign',()=>{
      const u=support-alongInset,y=Math.max(2.05,Math.max(2.12,height*.82)-.055);
      box(u,-.04,y+.21,.50,.035,.10,iron);
      for(const offset of [-.19,.19])box(u+offset,-.082,y+.17,.017,.12,.02,iron);
      box(u,-.052,y,.58,.30,.06,wood);
      for(const offset of [-.17,.17])box(u+offset,-.088,y,.022,.25,.012,trim);
      for(const offset of [-.105,.105])box(u,-.092,y+offset,.47,.020,.010,trim);
      // A small barrel emblem identifies trade without adding tiny text.
      box(u,-.090,y,.13,.21,.012,darkwood);for(const offset of [-.065,.065])box(u,-.092,y+offset,.17,.025,.010,trim);
    });
  }else if(kind==='palace'){
    const floor=hasBalcony?height*.56:height;
    feature('entrance-columns',()=>{for(const support of palaceSupports){const [u,v]=bearing(support,0,true);batch.cylinder(trim,at(u,v,.08),at(u,v,floor-.13),.18,light);box(u,v,.08,.38/T,.16,.38/T,materials.get('stone'));box(u,v,floor-.15,.38/T,.12,.38/T,trim);}});
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
    for(let v=1;v<frame.depth;v+=2)for(const u of [0,frame.width])if(wallAt(u,v)?.type==='wall')box(u,v,.5,.16,1,.18,trim);
    if(kind==='warehouse')roofCanopy('loading-canopy',entranceSupports(),.50);
    if(kind==='depot'){
      roofCanopy('gallery',frontSupports(),.60);
      const supports=entranceSupports();if(supports.length===2&&height>=2.4&&!walkableAbove(doorU,-.08,2.25))feature('depot-hoist',()=>{
        box(doorU,-.08,height-.05,2.20,.12,.13/T,wood);batch.primitive('torus',iron,at(doorU,-.10,height-.01),[.12,.12,.12],rotation,light);batch.cylinder(iron,at(doorU,-.10,height-.10),at(doorU,-.10,height-.26),.014,light);
      });
    }
    if(kind==='barracks')feature('barracks-gate',()=>{
      const supports=entranceSupports();
      for(const support of supports){const [u,v]=bearing(support,0,true);box(u,v,height*.50,.22,height,.38/T,trim);}
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
        const [a,v]=bearing(u,0,u!==0&&u!==frame.width);box(a,v,y*.5,.15,y,.38/T,wood);
        batch.cylinder(wood,at(a,v,y-.30),at(a+(u<frame.width/2?.42:-.42),v,y-.04),.04,light);
      }
      const center=frame.width*.5,half=Math.min(1.20,frame.width*.32),rise=.65,v=-.11/T;
      const panel=[at(center-half,v,height+.025),at(center+half,v,height+.025),at(center,v,height+rise)];
      batch.polygon(darkwood,panel,light);
      for(let n=0;n<3;n++)batch.cylinder(wood,panel[n],panel[(n+1)%3],.04,light);
      for(let u=center-half+.18;u<center+half;u+=.25){const top=height+.025+(rise-.025)*(1-Math.abs(u-center)/half);batch.cylinder(trim,at(u,v-.015/T,height+.055),at(u,v-.015/T,top-.035),.018,light);}
    });
  }else if(kind==='smithy'){sideChimney(true);roofCanopy('forge-canopy',entranceSupports(),.50);}
  else if(kind==='house')sideChimney();
  if(['palace','mansion'].includes(kind)&&height>=4)feature('upper-windows',()=>{
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
