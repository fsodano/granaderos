'use client';
import {useState} from 'react';
import Battlefield from '../Battlefield';
import {createBattle} from '../../../game/tactical.js';
import {buildSectorMap} from '../../../game/maps.js';
import {OPERATIVES} from '../../../game/data.js';
import {placeBuilding,buildTerrace} from '../../../game/buildings.js';
const families=['granadero','royalist','worker','surgeon','gaucho','friar','woman-scout','woman-shawl'];
function fixture(count=24,architecture=false){
  const squad=Array.from({length:count},(_,index)=>({...OPERATIVES[index%OPERATIVES.length],id:`review-${index}`,name:`${families[index%families.length]} ${index+1}`,nickname:families[index%families.length],spriteAppearance:families[index%families.length],skinTone:['light','brown','dark'][Math.floor(index/8)%3],x:4+(index%10)*2,y:6+Math.floor(index/10)*2,weapon:1800,blade:1810,activeSlot:index%4===0?'unarmed':index%4===1?'primary':index%4===2?'blade':'offhand',offHand:{weapon:1805,count:1,weight:1.3,loaded:1,condition:100,jammed:false},headwear:null,outfit:null,legwear:null}));
  if(architecture){const map=buildSectorMap({sector:'tucuman',compactLayout:false,squad:squad.slice(0,8),enemies:[],exploration:true});return {...createBattle(map.squad,map),deploymentComplete:true};}
  const tiles=Array.from({length:40*36},(_,i)=>({x:i%40,y:Math.floor(i/40),type:i%40>28?'forest':Math.floor(i/40)<4?'cobble':'grass',cover:0,blocked:false}));
  const house=placeBuilding(tiles,{id:'review-house',x:25,y:12,width:8,height:7,architecture:'house',roof:'terrace',doors:[{x:25,y:15,open:true}],windows:[{x:28,y:12},{x:32,y:15}]});
  const upper=buildTerrace(house.building,{climbPoints:[{id:'ladder',from:{x:24,y:14},to:{x:25,y:14}}]} as any);
  return {...createBattle(squad,{width:40,height:36,tiles:house.tiles,buildings:[house.building],...upper,enemies:[],exploration:true,props:[{id:'review-table',type:'table',x:27,y:15},{id:'review-barrels',type:'barrels',x:22,y:12}],artillery:[{id:'review-cannon',type:'bronze4',side:'player',x:22,y:9,facing:Math.PI,loaded:true,ammo:6}]}),deploymentComplete:true};
}
export default function RendererSandbox(){
 const [battle,setBattle]=useState(()=>fixture()),[version,setVersion]=useState(0);
 function reset(count:number,architecture=false){setBattle(fixture(count,architecture));setVersion(version+1);}
 return <main className="game-shell"><nav style={{display:'flex',gap:8,padding:'8px 16px',alignItems:'center',flexWrap:'wrap'}} aria-label="Pruebas del sector"><strong>Prueba del sector 3D</strong>{[24,60,100].map(count=><button className="line-button" key={count} onClick={()=>reset(count)}>{count} personajes</button>)}<button className="line-button" onClick={()=>reset(8,true)}>Sector de Tucumán</button><span style={{fontSize:12}}>Cámara isométrica · Órdenes del juego</span></nav><Battlefield key={version} battle={battle} onChange={next=>{setBattle(next);return next;}} onFinish={()=>{}}/></main>;
}
