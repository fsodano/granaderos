'use client';
import {defaultCampaignStory} from '../../../game/campaign-story.js';
import DialogueConditions from './DialogueConditions';
export default function CampaignStory({draft,onChange}:{draft:any;onChange:(value:any)=>void}){
 const story=draft.campaignStory;
 const update=(patch:any)=>onChange({...draft,campaignStory:{...story,...patch}});
 const chapter=(index:number,patch:any)=>update({chapters:story.chapters.map((c:any,i:number)=>i===index?{...c,...patch}:c)});
 const move=(index:number,step:number)=>{const chapters=[...story.chapters];[chapters[index],chapters[index+step]]=[chapters[index+step],chapters[index]];update({chapters});};
 const add=()=>{let n=1;while(story.chapters.some((c:any)=>c.id===`chapter-${n}`))n++;update({chapters:[...story.chapters,{...defaultCampaignStory().chapters[0],id:`chapter-${n}`,name:`Objetivo ${n}`} ]});};
 return <section aria-label="Objetivos de campaña"><h2>Objetivos y final de campaña</h2>
  <label>Avance de la historia<select value={story?'authored':'original'} onChange={e=>onChange({...draft,campaignStory:e.target.value==='authored'?defaultCampaignStory():null})}><option value="original">Campaña histórica original</option><option value="authored">Capítulos propios</option></select></label>
  <p>Los capítulos propios reemplazan el avance y el final históricos. El mundo, las reglas de combate, la economía y los requisitos de los personajes históricos siguen vigentes. San Lorenzo y Yatasto pertenecen al avance original.</p>
  <label><input type="checkbox" checked={draft.includeOriginalResidents!==false} onChange={e=>onChange({...draft,includeOriginalResidents:e.target.checked})}/>Incluir habitantes genéricos del mapa original</label>
  <p>Incluye los contactos como el sargento del cuartel y los guías de las postas. Desactivalos para usar tus propios habitantes. Los personajes con ficha se administran desde Personajes.</p>
  {story&&<><p>Podés eliminar personajes históricos desde sus fichas o copiarlos como habitantes independientes. La copia conserva su ficha, equipo, retrato y habilidades editables; tiene incorporación local sin requisitos históricos. Su diálogo, servicio y apariciones se editan como los de cualquier habitante nuevo. Las funciones históricas no se transfieren.</p>
   <label>Introducción de campaña<textarea maxLength={1000} value={story.introduction} onChange={e=>update({introduction:e.target.value})}/></label>
   <label>Texto de victoria<textarea maxLength={1000} value={story.victory} onChange={e=>update({victory:e.target.value})}/></label>
   <label>Texto de derrota<textarea maxLength={1000} value={story.defeat} onChange={e=>update({defeat:e.target.value})}/></label>
   <p>Los capítulos se cumplen en orden. Cada uno necesita todas sus condiciones. Los capítulos cumplidos no se reinician si el mundo cambia. La victoria espera a que salgas del sector táctico.</p>
   {story.chapters.map((c:any,i:number)=><fieldset key={c.id} aria-label={`Capítulo ${i+1}`}><legend>Capítulo {i+1}</legend>
    <label>Nombre del capítulo<input maxLength={100} value={c.name} onChange={e=>chapter(i,{name:e.target.value})}/></label>
    <label>Objetivo visible<textarea maxLength={1000} value={c.objective} onChange={e=>chapter(i,{objective:e.target.value})}/></label>
    <DialogueConditions campaign conditions={c.conditions} characters={draft.characters} quests={draft.quests??[]} onChange={conditions=>chapter(i,{conditions})}/>
    <button type="button" disabled={i===0} onClick={()=>move(i,-1)}>Subir capítulo {i+1}</button><button type="button" disabled={i===story.chapters.length-1} onClick={()=>move(i,1)}>Bajar capítulo {i+1}</button>
    <button type="button" disabled={story.chapters.length===1} onClick={()=>update({chapters:story.chapters.filter((_:any,index:number)=>index!==i)})}>Eliminar capítulo {i+1}</button>
   </fieldset>)}
   <button type="button" disabled={story.chapters.length>=12} onClick={add}>Agregar capítulo</button>
   <fieldset aria-label="Derrota de campaña"><legend>Derrota de campaña</legend><p>La derrota ocurre cuando se cumplen todas estas condiciones. Sin condiciones adicionales, solo se aplican la pérdida del cuartel y la pérdida de todos los combatientes en una salida táctica. La derrota tiene prioridad sobre una victoria simultánea.</p>
    <DialogueConditions campaign conditions={story.failureConditions} characters={draft.characters} quests={draft.quests??[]} onChange={failureConditions=>update({failureConditions})}/>
   </fieldset>
  </>}
 </section>;
}
