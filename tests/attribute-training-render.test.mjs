import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
const {default:TrainingProgress}=await import('../web/app/TrainingProgress.tsx');
const {default:StudyForecast}=await import('../web/app/StudyForecast.tsx');
const {default:MedicalCare}=await import('../web/app/MedicalCare.tsx');

test('personal progress displays all eleven attributes, earned gains, zero aptitude and completed practice',()=>{
 const html=render(h(TrainingProgress,{unit:{hp:70,maxHp:80,strength:70,dexterity:60,agility:60,leadership:50,marksmanship:60,medical:0,mechanical:40,explosives:50,stealth:30,ridingSkill:100,trainedStats:{dexterity:2},skillPractice:{dexterity:19}}}));
 for(const label of ['Salud','Fuerza','Destreza','Agilidad','Liderazgo','Puntería','Medicina','Mecánica','Pólvora y artillería','Sigilo','Equitación'])assert.ok(html.includes(label));
 assert.equal((html.match(/<dt /g)??[]).length,11);assert.match(html,/\(\+2\)/);assert.match(html,/19\/40 prácticas/);assert.match(html,/Sin aptitud/);assert.match(html,/Límite alcanzado/);assert.doesNotMatch(html,/<span>Sabiduría<\/span>/);assert.match(html,/al menos 35/);
});

test('study forecast exposes slower solo work, teacher comparison and rest-qualified hours',()=>{
 const html=render(h(StudyForecast,{record:{},op:{nickname:'Alumno',mechanical:40,wisdom:50},skill:'mechanical',instructor:{nickname:'Maestro',mechanical:80}}));
 assert.match(html,/Previsión de estudio de Alumno/);assert.match(html,/24 h de práctica individual/);assert.match(html,/Con Maestro: 16 h/);assert.match(html,/quedan 10/);assert.match(html,/pausas y el descanso/);
 for(const [record,value,expected]of [[{},0,/Sin aptitud/],[{trainedStats:{mechanical:10}},60,/Límite de práctica alcanzado/]]){
  const blocked=render(h(StudyForecast,{record,op:{nickname:'Alumno',mechanical:value},skill:'mechanical'}));assert.match(blocked,expected);assert.doesNotMatch(blocked,/Próxima mejora/);
 }
});

test('the real personnel panel offers new attributes and shows the saved selected-skill forecast',()=>{
 let s=dispatchCampaign(initialCampaign(8),{type:'recruitCivic',id:110,term:'month'});assert.equal(s.lastError,null);
 s=dispatchCampaign(s,{type:'assignWork',operativeId:110,assignment:'practice',skill:'dexterity'});assert.equal(s.lastError,null);
 const html=render(h(MedicalCare,{state:s,sectorId:'retiro',dispatch:()=>{}}));
 for(const key of ['maxHp','strength','dexterity','leadership','explosives'])assert.match(html,new RegExp(`<option value="${key}"`));
 assert.match(html,/<option value="dexterity" selected="">Destreza/);assert.match(html,/Previsión de estudio/);assert.match(html,/Aplicar selección/);assert.doesNotMatch(html,/<option value="wisdom"/);
});
