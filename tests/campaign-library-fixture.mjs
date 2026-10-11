import {readFile,readdir} from 'node:fs/promises';
import {blankMap} from '../game/map-schema.js';
import {discoverCampaigns} from '../tools/campaign-export.mjs';
const root=new URL('..',import.meta.url),registry=await discoverCampaigns(root.pathname),documents=new Map([['/campaigns/index.json',registry]]);
async function collect(directory){for(const entry of await readdir(directory,{withFileTypes:true})){const path=new URL(entry.name+(entry.isDirectory()?'/':''),directory);if(entry.isDirectory())await collect(path);else if(entry.name.endsWith('.json'))documents.set(path.pathname.slice(root.pathname.length-1),JSON.parse(await readFile(path,'utf8')));}}
for(const entry of registry.campaigns)await collect(new URL(`campaigns/${entry.id}/`,root));
const resourceBytes=new Map();
for(const entry of registry.campaigns)for(const asset of documents.get(`/campaigns/${entry.id}/assets.json`).assets)resourceBytes.set(`/campaigns/${entry.id}/${asset.path}`,await readFile(new URL(`campaigns/${entry.id}/${asset.path}`,root)));
export function campaignResponse(docs,path,overrides=new Map()){
 const key=String(path).replace(/^https?:\/\/[^/]+/,'').replace(/^\/granaderos(?=\/campaigns\/)/,''),value=docs.get(key),bytes=overrides.get(key)??resourceBytes.get(key)??resourceBytes.get(key.replace(/^\/campaigns\/[^/]+\//,'/campaigns/granaderos/')),ok=value!==undefined||bytes!==undefined;
 return {ok,status:ok?200:404,json:async()=>structuredClone(value),arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
}
export function campaignFetch(path){return Promise.resolve(campaignResponse(documents,path));}
export const stockPresentation=documents.get('/campaigns/granaderos/presentation.json');
export const campaignDocuments=documents;
export function alternateCampaignDocuments(){
 const docs=new Map([...documents].map(([path,value])=>[path,structuredClone(value)])),entry={id:'another',name:'Otra campaña',revision:'1',manifest:'another/manifest.json'};
 for(const [path,value]of documents)if(path.startsWith('/campaigns/granaderos/'))docs.set(path.replace('/granaderos/','/another/'),JSON.parse(JSON.stringify(value).replaceAll('/campaigns/granaderos/','/campaigns/another/')));
 for(const [path,map]of docs)if(/^\/campaigns\/another\/maps\/(?!index\.json$)[^/]+\.json$/.test(path)){const next=blankMap({id:map.id,title:map.metadata.title});next.spawns=[{id:'player-entry',side:'player',x:3,y:8},{id:'enemy-entry',side:'enemy',x:16,y:8}];docs.set(path,next);}
 const manifest=docs.get('/campaigns/another/manifest.json');Object.assign(manifest,{id:entry.id,name:entry.name,revision:entry.revision,scenario:'generic-v1'});
 const content=docs.get('/campaigns/another/content.json');content.id=entry.id;content.name=entry.name;content.characters=[content.characters.find(character=>character.id==='person-100')];content.placements=[];content.errands=[];content.quests=[];content.includeOriginalResidents=false;content.campaignRoles={foundryEngineer:null,marchCommander:null};
 docs.set('/campaigns/another/presentation.json',{version:1,title:entry.name,caption:'Una campaña diferente.'});
 docs.get('/campaigns/index.json').campaigns.push(entry);
 return {docs,entry,reader:async(path)=>campaignResponse(docs,path)};
}
