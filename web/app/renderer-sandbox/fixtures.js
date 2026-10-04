import {createBattle,actBattle} from '../../../game/tactical.js';
import {buildSectorMap} from '../../../game/maps.js';
import {OPERATIVES} from '../../../game/data.js';
import {placeBuilding,buildTerrace} from '../../../game/buildings.js';
import {makeGrenadeStack} from '../../../game/grenades.js';

export const RENDERER_SCENARIOS=Object.freeze([
  {id:'combat',label:'Combate',help:'Fusil, pistola, sable, granada y cuchillo: cada especialista tiene un blanco enfrente. Los dos artilleros están junto al cañón. Usa las órdenes habituales; reinicia para repetir.'},
  {id:'mounted',label:'Montura y azotea',help:'Jinete: caminar, correr y montar/desmontar. Escaladora: subir por el acceso junto a la casa. Vigía: moverse por la azotea. La puerta está abierta.'},
  {id:'night',label:'Noche',help:'Las fogatas iluminan los blancos. El fusil ya disparó y dejó humo: puedes recargarlo. Todos llevan antorchas; equipa una para añadir luz.'},
  {id:'performance24',label:'24 personajes',help:'Sector abierto para comprobar movimiento y variedad con 24 personajes.'},
  {id:'performance60',label:'60 personajes',help:'Sector abierto para comprobar movimiento y variedad con 60 personajes.'},
  {id:'performance100',label:'100 personajes',help:'Sector abierto para comprobar movimiento y variedad con 100 personajes.'},
  {id:'tucuman',label:'Sector de Tucumán',help:'Mapa real de Tucumán, con ocho personajes y las órdenes habituales de exploración.'},
]);
const families=['granadero','royalist','worker','surgeon','gaucho','friar','woman-scout','woman-shawl'];
const ground=(width,height)=>Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:Math.floor(i/width)<4?'stone':'grass',cover:0,blocked:false}));
function soldier(id,name,x,y,extra={}){
  return {id,name,nickname:name,x,y,facing:2,weapon:1800,loaded:1,ammo:12,blade:1810,activeSlot:'primary',condition:100,energy:100,agility:90,dexterity:85,strength:85,marksmanship:85,wisdom:80,experienceLevel:7,medical:70,mechanical:70,explosives:80,medkits:2,torches:3,rations:2,spriteAppearance:'granadero',skinTone:'brown',headwear:null,outfit:null,legwear:null,...extra};
}
function target(id,x,y){
  return {id,name:`Realista ${id.replace('target-','')}`,x,y,facing:6,weapon:1800,loaded:1,ammo:6,hp:100,morale:100,patrol:false,overwatch:false,marksmanship:55,spriteAppearance:'royalist',skinTone:'light'};
}
function courtyard(){
  const house=placeBuilding(ground(24,20),{id:'sandbox-house',name:'Casa de la azotea',x:11,y:7,width:8,height:8,architecture:'house',roof:'terrace',doors:[{id:'sandbox-door',x:11,y:10,open:true}],windows:[{x:14,y:7},{x:18,y:11}]});
  return {width:24,height:20,tiles:house.tiles,buildings:[house.building],...buildTerrace(house.building,{climbPoints:[{id:'access',from:{x:10,y:8},to:{x:11,y:8}}]}),props:[{id:'sandbox-table',type:'table',x:14,y:11},{id:'sandbox-barrels',type:'barrels',x:20,y:13}]};
}
function combat(night=false){
  const squad=[
    soldier('rifle','Fusil',4,5),
    soldier('pistol','Pistola',4,7,{weapon:1805,skinTone:'light',spriteAppearance:'gaucho'}),
    soldier('sabre','Sable',6,10,{weapon:1810,blade:0,loaded:0,ammo:0,skinTone:'dark'}),
    soldier('grenade','Granada',4,13,{activeSlot:'item',activeItem:'inventory:grenade',inventory:{grenade:makeGrenadeStack('arsenal',2)},spriteAppearance:'woman-scout'}),
    soldier('knife','Cuchillo',4,16,{weapon:1813,weaponInstanceId:'sandbox-knife',blade:0,loaded:0,ammo:0,spriteAppearance:'gaucho',skinTone:'dark'}),
    soldier('gunner','Artillero',4,2,{activeSlot:'unarmed',spriteAppearance:'worker'}),
    soldier('loader','Ayudante',5,3,{activeSlot:'unarmed',spriteAppearance:'worker',skinTone:'light'}),
  ];
  const enemies=[target('target-rifle',10,5),target('target-pistol',8,7),target('target-sabre',7,10),target('target-grenade',9,13),target('target-knife',8,16),target('target-cannon',14,2)];
  let battle=createBattle(squad,{...courtyard(),id:`renderer-${night?'night':'combat'}`,name:night?'Patio de noche':'Patio de combate',seed:45,enemies,firstSide:'player',night,hour:night?22:12,lights:night?[{id:'north-fire',type:'campfire',x:10,y:4,radius:5,intensity:1},{id:'south-fire',type:'campfire',x:9,y:15,radius:5,intensity:1}]:[],artillery:[{id:'sandbox-cannon',type:'bronze4',side:'player',x:5,y:2,facing:0,loaded:true,ammo:6}]});
  if(night){
    // Prepare smoke through the same finite-ammunition shot used by the HUD.
    battle=actBattle(battle,{type:'fire',unitId:'rifle',targetId:'target-rifle',aim:0});
    if(battle.lastError)throw new Error(`Night fixture shot failed: ${battle.lastError}`);
  }
  return {...battle,deploymentComplete:true};
}
function mounted(){
  const squad=[
    soldier('rider','Jinete',4,7,{weapon:1812,blade:0,loaded:0,ammo:0,mounted:true,horse:true,ridingSkill:90,mount:{id:'sandbox-horse',condition:100,stamina:100},skinTone:'dark'}),
    soldier('climber','Escaladora',10,8,{activeSlot:'unarmed',spriteAppearance:'woman-scout',skinTone:'light'}),
    soldier('roof-guard','Vigía',14,8,{tacticalLevel:1,spriteAppearance:'gaucho'}),
    soldier('door-guard','Guardia',10,10,{weapon:1805,skinTone:'light'}),
  ];
  return {...createBattle(squad,{...courtyard(),id:'renderer-mounted',name:'Montura y azotea',seed:45,enemies:[],exploration:true}),deploymentComplete:true};
}
function performance(count,architecture=false){
  const squad=Array.from({length:count},(_,index)=>({...OPERATIVES[index%OPERATIVES.length],id:`review-${index}`,name:`${families[index%families.length]} ${index+1}`,nickname:families[index%families.length],spriteAppearance:families[index%families.length],skinTone:['light','brown','dark'][Math.floor(index/8)%3],x:4+(index%10)*2,y:6+Math.floor(index/10)*2,weapon:index%4===3?1805:1800,blade:1810,activeSlot:index%4===0?'unarmed':index%4===2?'blade':'primary',offHand:{weapon:1805,count:1,weight:1.3,loaded:1,condition:100,jammed:false},headwear:null,outfit:null,legwear:null}));
  if(architecture){const map=buildSectorMap({sector:'tucuman',compactLayout:false,squad:squad.slice(0,8),enemies:[],exploration:true});return {...createBattle(map.squad,map),deploymentComplete:true};}
  const tiles=ground(40,36).map(tile=>({...tile,type:tile.x>28?'forest':tile.type}));
  const house=placeBuilding(tiles,{id:'review-house',x:25,y:12,width:8,height:7,architecture:'house',roof:'terrace',doors:[{x:25,y:15,open:true}],windows:[{x:28,y:12},{x:32,y:15}]});
  const upper=buildTerrace(house.building,{climbPoints:[{id:'ladder',from:{x:24,y:14},to:{x:25,y:14}}]});
  return {...createBattle(squad,{width:40,height:36,tiles:house.tiles,buildings:[house.building],...upper,enemies:[],exploration:true,props:[{id:'review-table',type:'table',x:27,y:15},{id:'review-barrels',type:'barrels',x:22,y:12}],artillery:[{id:'review-cannon',type:'bronze4',side:'player',x:22,y:9,facing:Math.PI,loaded:true,ammo:6}]}),deploymentComplete:true};
}
/** Fresh real battle state. Scene selection never issues private renderer poses. */
export function createRendererSandboxBattle(id='combat'){
  if(id==='combat'||id==='night')return combat(id==='night');
  if(id==='mounted')return mounted();
  if(id==='tucuman')return performance(8,true);
  if(['performance24','performance60','performance100'].includes(id))return performance(Number(id.replace('performance','')));
  throw new Error(`Unknown renderer scenario: ${id}`);
}
