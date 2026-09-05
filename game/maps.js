import {CAMPAIGN_SECTORS} from './data.js';
import {placeBuilding} from './buildings.js';

// Authored tactical plans. Buildings are solid footprints, never walkable painted facades.
// The strategic grid is schematic; these tactical layouts are original gameplay maps,
// not archaeological reconstructions or surveyed historical plans.
export const MAP_IDS = [...CAMPAIGN_SECTORS.map(s=>s.id),'san_lorenzo'];
const WIDTH=20,HEIGHT=16;
const clone=value=>JSON.parse(JSON.stringify(value));
const names={buenos_aires:'Plaza Mayor y Cabildo',retiro:'Cuartel de Retiro',ensenada:'Puerto de Ensenada',san_nicolas:'Paso de San Nicolás',santa_fe:'Puerto de Santa Fe',cordoba:'Talleres de Caroya',mendoza:'Campamento de El Plumerillo',uspallata:'Desfiladero de Uspallata',los_patos:'Senda de Los Patos',tucuman:'La Ciudadela de Tucumán',salta:'Quebradas de Salta',jujuy:'Posta de Jujuy',humahuaca:'Entrada a la Quebrada',san_lorenzo:'Convento de San Carlos · San Lorenzo'};

function canvas(base='grass'){
 const tiles=Array.from({length:WIDTH*HEIGHT},(_,i)=>({x:i%WIDTH,y:Math.floor(i/WIDTH),type:base,blocked:false,cover:base==='forest'?20:0}));
 const paint=(x,y,type,blocked=['wall','water'].includes(type))=>{if(x>=0&&x<WIDTH&&y>=0&&y<HEIGHT)tiles[y*WIDTH+x]={x,y,type,blocked,cover:blocked?40:type==='forest'?20:type==='stone'?10:0};};
 const rect=(x,y,w,h,type,blocked)=>{for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)paint(i,j,type,blocked);};
 const hroad=(y,x=0,w=WIDTH)=>rect(x,y,w,2,'road',false);
 const vroad=(x,y=0,h=HEIGHT)=>rect(x,y,2,h,'road',false);
 const coast=(x=18)=>rect(x,0,WIDTH-x,HEIGHT,'water',true);
 const woods=(points)=>points.forEach(([x,y,w,h])=>rect(x,y,w,h,'forest',false));
 return {tiles,paint,rect,hroad,vroad,coast,woods};
}
function plan(id){
 const c=canvas(['uspallata','los_patos','humahuaca'].includes(id)?'stone':'grass'),{rect,hroad,vroad,coast,woods,paint}=c;
 const decor=[];
 switch(id){
 case 'buenos_aires':
   hroad(7);vroad(9);rect(5,5,9,6,'stone',false);hroad(7);vroad(9);
   rect(3,1,5,3,'wall');rect(11,1,6,3,'wall');rect(4,12,4,3,'wall');rect(12,12,5,3,'wall');
   rect(8,5,1,1,'stone');rect(12,10,1,1,'stone');break;
 case 'retiro':
   hroad(3);hroad(12);vroad(14);rect(6,6,8,4,'stone',false);
   rect(4,0,9,2,'wall');rect(5,14,8,2,'wall');rect(6,6,2,1,'wall');rect(11,9,2,1,'wall');
   rect(16,4,1,8,'wall');rect(16,7,1,2,'road');break;
 case 'ensenada':
   coast();rect(15,0,3,16,'mud',false);hroad(7,0,18);rect(12,7,6,2,'road',false);
   rect(5,2,4,3,'wall');rect(7,11,5,3,'wall');rect(13,3,2,2,'wall');woods([[3,10,2,3],[10,1,2,2]]);break;
 case 'san_nicolas':
   coast();rect(16,0,2,16,'mud',false);hroad(6,0,18);vroad(11);rect(5,3,3,2,'wall');rect(5,10,3,3,'wall');
   rect(13,3,2,1,'wall');rect(13,11,2,1,'wall');woods([[8,1,2,3],[8,12,2,3],[2,7,2,3]]);break;
 case 'santa_fe':
   coast(17);rect(10,0,2,5,'water');rect(8,11,2,5,'water');rect(11,5,4,2,'mud');rect(5,8,4,3,'mud');
   hroad(7,0,17);vroad(4);rect(12,11,3,3,'wall');rect(4,1,3,3,'wall');woods([[6,4,2,2],[11,8,3,2],[2,11,2,4]]);break;
 case 'cordoba':
   hroad(7);vroad(9);rect(5,2,3,3,'wall');rect(12,2,5,3,'wall');rect(5,11,3,4,'wall');rect(12,11,4,3,'wall');
   woods([[2,1,2,3],[2,12,2,3],[16,7,2,2]]);rect(12,6,3,1,'stone',false);break;
 case 'mendoza':
   hroad(7);vroad(12);rect(5,1,5,3,'wall');rect(5,12,5,3,'wall');rect(13,2,3,3,'wall');
   rect(6,6,3,1,'stone',false);rect(6,10,4,1,'stone',false);woods([[2,1,2,3],[10,11,2,3],[16,10,2,4]]);break;
 case 'uspallata':
   rect(0,0,20,4,'stone',true);rect(0,12,20,4,'stone',true);
   rect(7,4,4,3,'stone',true);rect(12,9,4,3,'stone',true);
   hroad(7);rect(9,7,3,2,'road',false);rect(15,5,2,1,'wall');break;
 case 'los_patos':
   rect(0,0,20,3,'stone',true);rect(0,13,20,3,'stone',true);
   rect(6,3,3,5,'stone',true);rect(11,9,3,4,'stone',true);rect(15,3,2,3,'stone',true);
   hroad(9,0,9);rect(8,7,4,4,'road',false);hroad(6,11,9);rect(15,10,2,2,'stone',false);break;
 case 'tucuman':
   woods([[0,0,5,3],[0,12,4,4],[5,2,2,3],[5,11,2,4]]);hroad(7);vroad(12);
   rect(9,3,1,10,'wall');rect(9,3,8,1,'wall');rect(9,12,8,1,'wall');rect(16,3,1,10,'wall');
   rect(9,6,1,3,'road');rect(16,7,1,2,'road');rect(12,3,2,1,'road');rect(12,12,2,1,'road');rect(11,5,3,1,'wall');break;
 case 'salta':
   rect(5,1,3,3,'stone',true);rect(5,12,3,3,'stone',true);rect(12,2,4,2,'wall');rect(12,11,4,3,'wall');
   hroad(7);woods([[7,5,3,2],[8,10,3,2],[15,6,2,3],[2,2,2,3]]);vroad(10);break;
 case 'jujuy':
   rect(0,0,20,2,'stone',true);rect(0,14,20,2,'stone',true);hroad(7);
   rect(6,3,4,3,'wall');rect(8,11,4,2,'wall');rect(14,4,2,2,'wall');woods([[4,9,3,3],[11,3,2,3],[15,10,2,3]]);break;
 case 'humahuaca':
   rect(0,0,20,4,'stone',true);rect(0,12,20,4,'stone',true);rect(6,4,3,2,'stone',true);rect(6,10,3,2,'stone',true);
   rect(12,4,3,3,'stone',true);rect(12,9,3,3,'stone',true);hroad(7);rect(16,5,1,2,'wall');rect(16,10,1,1,'wall');break;
 case 'san_lorenzo':
   coast(18);rect(17,0,1,16,'stone',true); // The bluff is impassable; no painted traversable river.
   rect(4,5,5,6,'wall');decor.push({type:'convent',asset:'/art/convent.png',name:'Convento de San Carlos',x:4,y:5,width:5,height:6});
   hroad(2,0,17);hroad(12,0,17);vroad(11);rect(13,5,3,6,'grass',false);
   woods([[9,5,2,2],[9,9,2,2],[2,0,2,2],[2,14,2,2]]);break;
 default:throw Error('No existe un plano para ese sector.');
 }
 const footprints={buenos_aires:[3,1,5,3],retiro:[6,6,5,4],ensenada:[5,2,4,3],san_nicolas:[5,10,3,3],santa_fe:[12,11,3,3],cordoba:[12,2,5,3],mendoza:[5,1,5,3],tucuman:[11,5,4,4],salta:[12,11,4,3],jujuy:[6,3,4,3],san_lorenzo:[4,5,5,6]};
 const buildings=[],lights=[];const footprint=footprints[id];
 if(footprint){const[x,y,width,height]=footprint,doorX=x+Math.floor(width/2),doorY=y+height-1;
   const doors=[{id:`${id}:door-left`,x:doorX,y:doorY}];if(width>=5)doors.push({id:`${id}:door-right`,x:doorX+1,y:doorY});
   const result=placeBuilding(c.tiles,{id:`${id}:building`,name:id==='san_lorenzo'?'Convento de San Carlos':id==='mendoza'?'Maestranza de El Plumerillo':'Casa del sector',x,y,width,height,doors,windows:[{x,y:y+1}],material:'adobe'});
   c.tiles.splice(0,c.tiles.length,...result.tiles);buildings.push(result.building);
   lights.push({id:`${id}:lantern`,type:'lantern',x:doorX,y:Math.min(15,doorY+1),radius:3,intensity:.8});
 }
 return {...c,decor,buildings,lights};
}
const key=p=>`${p.x},${p.y}`;
function connected(tiles,start){
 const reached=new Set([key(start)]),queue=[start];while(queue.length){const p=queue.shift();for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const x=p.x+dx,y=p.y+dy,t=tiles[y*WIDTH+x];if(x>=0&&x<WIDTH&&y>=0&&y<HEIGHT&&t&&!t.blocked&&!reached.has(key(t))){reached.add(key(t));queue.push(t);}}}return reached;
}
export function buildSectorMap(request={}){
 const id=request.sector??request.id??'san_lorenzo';const authored=plan(id),tiles=authored.tiles;
 const open=tiles.filter(t=>!t.blocked);const component=connected(tiles,open.find(t=>t.x<=2&&t.y>=5)??open[0]);
 const reserved=new Set(),choose=(preferred,side)=>{
   const candidates=open.filter(t=>component.has(key(t))&&!reserved.has(key(t)));
   candidates.sort((a,b)=>{
     const da=Math.abs(a.x-preferred.x)+Math.abs(a.y-preferred.y),db=Math.abs(b.x-preferred.x)+Math.abs(b.y-preferred.y);
     return da-db||(side==='player'?a.x-b.x:b.x-a.x)||a.y-b.y;
   });
   if(!candidates.length)throw Error('El mapa no tiene posiciones de despliegue suficientes.');
   reserved.add(key(candidates[0]));return{x:candidates[0].x,y:candidates[0].y};
 };
 const squad=(request.squad??[]).map((op,i)=>({...clone(op),...choose({x:id==='san_lorenzo'?2:1,y:id==='san_lorenzo'?(i%2===0?2:12)+Math.floor(i/2):4+i},'player')}));
 const enemyCount=request.enemies?.length??Math.max(3,squad.length+(request.difficulty??1)-1);
 const enemies=Array.from({length:enemyCount},(_,i)=>({id:`enemy-${i}`,name:`Soldado realista ${i+1}`,weapon:i%3===0?1801:1800,marksmanship:50+(request.difficulty??1)*5,morale:60+(request.difficulty??1)*5,...clone(request.enemies?.[i]??{}),...choose({x:id==='santa_fe'?15:id==='san_lorenzo'?15:17,y:3+i%10},'enemy')}));
 const artillery=(request.artillery??Array.from({length:Math.min(request.cannons??0,3)},()=>({type:'bronze4',side:'player',loaded:true,ammo:6}))).map((gun,i)=>({...clone(gun),...choose({x:3,y:4+i*3},'player')}));
 return {...clone(request),sector:id,name:request.name??names[id],width:WIDTH,height:HEIGHT,tiles,decor:authored.decor,buildings:authored.buildings,lights:authored.lights,squad,enemies,artillery,mapTitle:names[id]};
}
