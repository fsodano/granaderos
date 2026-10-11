import {mkdir,writeFile,rename,rm,readFile} from 'node:fs/promises';
import {resolve,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import {blankMap,validateMap} from '../game/map-schema.js';
import {verifyCampaignFolder} from './campaign-export.mjs';
import {validateCampaignManifest} from '../game/campaign-library.js';
import {refreshCampaignAssetFolder} from './refresh-campaign-assets.mjs';

const json=value=>JSON.stringify(value,null,2)+'\n';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const validId=id=>typeof id==='string'&&/^[a-z][a-z0-9-]{0,79}$/.test(id)&&!['constructor','prototype','granaderos'].includes(id);
const architecture=['house','farmhouse','estancia','church','mansion','cabildo','pulperia','warehouse','barracks'];

// Original neutral silhouette. No installed campaign art enters a new draft.
function placeholderPNG(){
 const width=96,height=96,raw=Buffer.alloc(height*(1+width*4));
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const silhouette=(x-48)**2+(y-30)**2<14**2||((x-48)/30)**2+((y-86)/34)**2<1;
  const i=y*(1+width*4)+1+x*4;
  raw.set(silhouette?[57,72,75,255]:[212,214,202,255],i);
 }
 const crc=bytes=>{let c=0xffffffff;for(const byte of bytes){c^=byte;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
 const chunk=(name,bytes)=>{const type=Buffer.from(name),length=Buffer.alloc(4),checksum=Buffer.alloc(4);length.writeUInt32BE(bytes.length);checksum.writeUInt32BE(crc(Buffer.concat([type,bytes])));return Buffer.concat([length,type,bytes,checksum]);};
 const header=Buffer.alloc(13);header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}

export function scaffoldDocuments(id){
 if(!validId(id))throw Error('Use a new lower-case campaign id with letters, digits and hyphens.');
 const name=id.split('-').map(word=>word[0].toUpperCase()+word.slice(1)).join(' '),portrait=`/campaigns/${id}/assets/guide.png`;
 const positions={camp:[15,16],'watch-post':[19,16]},names={camp:'Campamento','watch-post':'Puesto de guardia'};
 const cells=Array.from({length:36*33},(_,i)=>{
  const col=i%36,row=Math.floor(i/36),anchor=Object.keys(positions).find(id=>positions[id][0]===col&&positions[id][1]===row),land=col>=12&&col<=22&&row>=13&&row<=19;
  return {id:`cell-${col}-${row}`,col,row,grid:`${col+1},${row+1}`,name:anchor?names[anchor]:`Celda ${col+1},${row+1}`,x:36+col*18,y:36+row*18,district:Boolean(anchor),location:anchor??`cell-${col}-${row}`,locality:anchor??null,anchor:Boolean(anchor),land,biome:land?'plains':'water',theater:'frontier'};
 });
 const geo=(x,y)=>[(x-36)/18,33-(y-36)/18];
 const landRing=[[12,20],[23,20],[23,13],[12,13],[12,20]];
 const sectors=Object.keys(positions).map(id=>({id,grid:cells.find(c=>c.location===id).grid,name:names[id],theater:'frontier',biome:'plains',x:50,y:50,income:0,asset:'Territorio',neighbors:Object.keys(positions).filter(other=>other!==id)}));
 const foundry={sector:'camp',name:'Taller del campamento',armyName:'Escuadra',setupCost:100,fundingCost:200};
 const world={version:1,columns:36,rows:33,projection:{minLongitude:0,maxLatitude:33,longitudeScale:18,latitudeScale:18},sectors,theaters:[{id:'frontier',name:'Frontera'}],factions:[{id:'patriot',name:'La escuadra'},{id:'royalist',name:'La oposición'},{id:'foreign',name:'Visitantes'}],cells,
  places:Object.fromEntries(sectors.map(s=>{const c=cells.find(c=>c.location===s.id),[lon,lat]=geo(c.x,c.y);return [s.id,{lon,lat,label:s.name,dx:12,dy:0}];})),districts:Object.fromEntries(sectors.map(s=>{const c=cells.find(c=>c.location===s.id);return [s.id,[{id:`${s.id}:0`,sectorId:s.id,col:c.col,row:c.row,name:s.name,x:c.x,y:c.y,urban:false}]];})),cities:[],ruralSectors:['camp','watch-post'],geography:{land:[{type:'Polygon',coordinates:[landRing]}],rivers:[]},incomeSources:[],
  buildings:{types:Object.fromEntries(architecture.map(kind=>[kind,{name:'Construcción',roof:'tile',wall:'#b5ac91',trim:'#d8cfb9',height:64}])),footprints:Object.fromEntries(architecture.map(kind=>[kind,[6,5]]))},arrivalFacilities:{camp:['barracks'],'watch-post':[]},defaultHeadquarters:'camp',defaultFoundry:foundry,defaultRoles:{foundryEngineer:null,marchCommander:null},exitLinks:[],sceneExits:{},sceneEntries:[],sceneExitAnchors:{},landscapes:{camp:'settlement','watch-post':'settlement'},
  expansion:{rural:['camp','watch-post'],coast:[],waterOffsets:{},buildingTargets:{camp:1,'watch-post':1},buildingLandmarks:{camp:'house','watch-post':'house'},buildingSelections:{},defaultBuildingSelection:['house']},sectorCash:{},physical:{version:1,caches:{},arsenals:{},environment:{}}};
 const content={format:'granaderos-content',version:1,id,name,includeOriginalResidents:false,quests:[],errands:[],roadsideDiscoveries:[],campaignRoles:{foundryEngineer:null,marchCommander:null},rules:{startingTreasury:1000,deploymentCartridges:0,enemyCartridges:0,militiaCartridges:0},headquarters:'camp',startingTerritory:{camp:{owner:'patriot',loyalty:65},'watch-post':{owner:'royalist',loyalty:25}},foundry,imports:{port:null,minHours:72,maxHours:120},arrivalSites:[{sector:'camp',facilities:['barracks']}],
  oppositionEquipment:{officer:null,line:null,veteran:null},militiaEquipment:{green:null,regular:null,veteran:null},oppositionBlades:{officer:'field-tool',line:'field-tool',veteran:'field-tool'},militiaBlades:{green:'field-tool',regular:'field-tool',veteran:'field-tool'},
  characters:[{id:'guide',name:'Guía del campamento',nickname:'Guía',role:'Exploración',biography:'Un personaje de ejemplo. Cambiá su identidad y sus atributos para tu campaña.',portrait,recruitmentSource:'contract',service:'contract',progression:'experience',traits:[],spriteAppearance:'surgeon',skinTone:'brown',monthlyPay:300,arrivalHours:0,weapon:null,blade:'field-tool',attributes:{maxHp:70,agility:60,dexterity:60,strength:60,leadership:60,wisdom:60,marksmanship:40,mechanical:30,explosives:20,medical:30}}],
  weapons:[{id:'field-tool',template:1813,name:'Herramienta de campo',damage:20,ap:8,reach:1.5,weight:1,price:0,art:portrait}],placements:[],campaignStory:{introduction:'Reuní una escuadra y explorá la frontera.',victory:'El primer objetivo está cumplido.',defeat:'La escuadra no pudo continuar.',chapters:[{id:'first-day',name:'Una jornada en la frontera',objective:'Llegá al segundo día de campaña.',conditions:[{type:'day',min:2,max:null}]}],failureConditions:[]}};
 const presentation={version:1,title:name,subtitle:'Campaña propia',eyebrow:'JUEGO TÁCTICO',caption:'Reuní tu escuadra y comenzá la campaña.',calendar:{year:1,month:1,day:1},footer:'ESTRATEGIA · TÁCTICA',characterPortraits:[{id:'guide-face',name:'Guía',src:portrait,gender:'man',role:'scout',skinTone:'brown',spriteSkinTone:'brown',spriteAppearance:'surgeon',selectable:true}]};
 const maps=Object.fromEntries(sectors.map(s=>{const map=blankMap({id:s.id,title:s.name});map.spawns=[{id:'entry',x:3,y:8,side:'player'},{id:'opposition',x:16,y:8,side:'enemy'}];return [s.id,map];}));
 const image=placeholderPNG(),assets={version:1,assets:[{id:'guide',path:'assets/guide.png',sha256:digest(image),type:'image/png'}]};
 const manifest={format:'granaderos-campaign',version:1,id,name,revision:'1',scenario:'generic-v1',content:'content.json',world:'world.json',maps:'maps/index.json',presentation:'presentation.json',assets:'assets.json'};
 return {manifest,content,world,presentation,maps,assets,image};
}

export async function scaffoldCampaign(id,destination){
 const folder=resolve(destination);
 if(basename(folder)!==id)throw Error('The destination folder name must match the campaign id.');
 const documents=scaffoldDocuments(id),temporary=resolve(dirname(folder),`.${id}-${randomUUID()}`);
 await mkdir(dirname(folder),{recursive:true});await mkdir(temporary);
 try{
  await mkdir(resolve(temporary,'maps'));await mkdir(resolve(temporary,'assets'));
  for(const field of ['manifest','content','world','presentation','assets'])await writeFile(resolve(temporary,`${field}.json`),json(documents[field]));
  await writeFile(resolve(temporary,'maps/index.json'),json({maps:Object.keys(documents.maps).map(id=>({id,path:`${id}.json`}))}));
  for(const [id,map]of Object.entries(documents.maps)){const result=validateMap(map,{playable:true});if(!result.valid)throw Error(result.errors.join('\n'));await writeFile(resolve(temporary,`maps/${id}.json`),json(map));}
  await writeFile(resolve(temporary,'assets/guide.png'),documents.image);
  await verifyCampaignFolder(temporary);
  // mkdir is exclusive: an existing campaign is never overwritten.
  await mkdir(folder);await rename(temporary,folder);
  return folder;
 }catch(error){await rm(temporary,{recursive:true,force:true});throw error;}
}

export async function checkCampaign(directory){return verifyCampaignFolder(resolve(directory));}
export async function refreshAuthorAssets(directory){
 const folder=resolve(directory),manifest=JSON.parse(await readFile(resolve(folder,'manifest.json'),'utf8'));validateCampaignManifest(manifest);
 return refreshCampaignAssetFolder(folder,manifest.assets);
}

async function main(args){
 const [command,id,destination]=args;
 if(command==='check'&&id&&!destination){const content=await checkCampaign(id);console.log(`Campaign valid: ${content.id} (${content.campaignOrigin.revision})`);return;}
 if(command==='assets'&&id&&!destination){console.log(`Campaign assets updated: ${(await refreshAuthorAssets(id)).length}`);return;}
 if(command==='scaffold'&&id&&destination&&args.length===3){console.log(`Campaign created: ${await scaffoldCampaign(id,destination)}`);return;}
 throw Error('Usage: campaign-authoring.mjs check <folder> | assets <folder> | scaffold <new-id> <destination-folder>');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(error=>{console.error(error.message);process.exitCode=1;});
