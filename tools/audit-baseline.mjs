import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=resolve(process.argv[2]??dirname(fileURLToPath(import.meta.url))+'/..');
const load=path=>import(pathToFileURL(resolve(root,path)));
const spec=readFileSync(resolve(root,'docs/specification/original.txt'),'utf8');
const {OPERATIVES,CAMPAIGN_SECTORS}=await load('game/data.js');
const {WEAPONS,BLADES,ARTILLERY,bladeFor}=await load('game/tactical.js');
const {defaultContentPackage}=await load('game/content-package.js');
const {weaponMetadata}=await load('game/weapon-definition.js');
const {initialCampaign,contractQuote}=await load('game/campaign.js');
const {CIVIC_RECRUITS}=await load('game/recruitment.js');
const tables=spec.split('\n').map(line=>line.split('\t'));
const checks=[],adaptations=[],compare=(id,source,actual)=>checks.push({id,passed:JSON.stringify(source)===JSON.stringify(actual),expected:source,actual});
const attributes=['maxHp','agility','dexterity','strength','leadership','wisdom','marksmanship','mechanical','explosives','medical'];
const people=tables.filter(c=>c.length===13&&c.slice(2,12).every(x=>/^\d+$/.test(x)));
compare('roster-count',13,people.length);
for(const [i,c]of people.entries()){
 const id=i===12?57:i,person=OPERATIVES.find(o=>o.id===id);
 compare(`roster-${id}`,c.slice(2,12).map(Number),attributes.map(k=>person?.[k]??null));
}
const firearms=tables.filter(c=>c.length===8&&/^\d+$/.test(c[2])&&/^\d+$/.test(c[3])&&/^\d+\s*\/\s*\d+$/.test(c[4]));
compare('firearm-count',9,firearms.length);
for(const [i,c]of firearms.entries()){
 const id=1800+i,w=WEAPONS[id],[fire,aim]=c[4].split('/').map(Number);
 compare(`firearm-${id}`,[Number(c[2]),Number(c[3]),fire,aim,Number(c[5]),Number(c[6])],[w?.capacity,w?.damage,w?.fireAP,w?.aimAP,w?.reloadAP,w?.range]);
}
const blades=tables.filter(c=>c.length===7&&/^\d+$/.test(c[3])&&/^\d+$/.test(c[4]));
compare('blade-count',5,blades.length);
for(const[i,c]of blades.entries()){
 const id=1809+i,w=BLADES[id];
 // The later model separates the loose bayonet from the fixed weapon in the
 // source table. Verify its real fixed profile; never waive a mismatch.
 if(id===1811&&existsSync(resolve(root,'game/weapon-fittings.js'))){
  const {fixedBayonetProfile}=await load('game/weapon-fittings.js');
  const fixed=fixedBayonetProfile({weapon:1800,activeSlot:'primary',weaponFittings:{bayonet:{weapon:1811,fittingPattern:'india_socket',instanceId:'audit-bayonet',condition:100}}});
  compare(`blade-${id}`,[Number(c[3]),Number(c[4])],[fixed?.ap,fixed?.damage]);
  const loose=bladeFor({weapon:1800,blade:1811,activeSlot:'blade'});
  compare('loose-bayonet',[16,24,1],[loose?.ap,loose?.damage,loose?.reach]);
  const authored=defaultContentPackage().weapons.find(w=>w.template===1811);
  const held=bladeFor({weapon:1800,blade:1811,activeSlot:'blade',bladeMetadata:weaponMetadata(authored)});
  compare('default-authored-loose-bayonet',[16,24,1],[held?.ap,held?.damage,held?.reach]);
  adaptations.push({id:'blade-1811',reason:'The source describes the fixed bayonet. The later model also has a loose 24-damage, one-tile item. Its healthy fixed profile must retain 16 AP and 50 damage.'});
 }else compare(`blade-${id}`,[Number(c[3]),Number(c[4])],[w?.ap,w?.damage]);
}
const guns=tables.filter(c=>c.length===7&&/^\d+ M(?:en|an)/.test(c[2]));
compare('artillery-count',3,guns.length);
for(const[i,c]of guns.entries()){const id=['bronze4','field8','swivel'][i],w=ARTILLERY[id];compare(`artillery-${id}`,[parseInt(c[2]),...c[3].split('/').map(Number),parseInt(c[4]),parseInt(c[5])],[w?.crew,w?.fireAP,w?.reloadAP,w?.radius,w?.range]);}
compare('named-sector-count',13,CAMPAIGN_SECTORS.length);compare('theater-count',4,new Set(CAMPAIGN_SECTORS.map(s=>s.theater)).size);
const state=initialCampaign(42),funded=structuredClone(state);funded.resources.treasury=1e9;
const elite=CIVIC_RECRUITS.find(o=>o.tier==='elite')??CIVIC_RECRUITS.find(o=>o.marksmanship>=90);
const source=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const result={schema:1,source,checkedAt:new Date().toISOString(),method:'Compare runtime baseline values against the supplied specification tables; inspect a new campaign and funded elite quotes. This is not historical research or a campaign playthrough.',checks,adaptations,passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed).length,opening:{economyVersion:state.economyVersion??null,resourceKeys:Object.keys(state.resources),treasury:state.resources.treasury,controlled:Object.entries(state.sectors).filter(([id,s])=>s.owner==='patriot').map(([id])=>id),recruited:state.recruited,location:state.location},eliteTerms:elite?Object.fromEntries(['day','week','month'].map(term=>{const q=contractQuote(funded,elite,term);return[term,{available:q.available,reason:q.reason??null,price:q.price}]})):null,storyEditorModules:existsSync(resolve(root,'game/content-package.js'))};
console.log(JSON.stringify(result,null,2));
if(result.failed)process.exitCode=1;
