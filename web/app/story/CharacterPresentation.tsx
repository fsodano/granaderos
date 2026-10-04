import {sitePath} from '../../lib/site-path.js';
import {AUTHORABLE_SPEECH_EVENTS,OPTIONAL_SPEECH_EVENTS} from '../../../game/characters.js';
import {CHARACTER_PORTRAITS} from '../../../game/character-profile.js';
import {APPEARANCE_LABELS,SPEECH_LABELS,SPEECH_LINE_LIMIT,characterPresentationDefaults} from '../../../game/content-character-presentation.js';
import {spriteRender,spriteViewport} from '../../../game/sprite-render.js';
import ServiceRelationshipsEditor from './ServiceRelationshipsEditor';

export default function CharacterPresentation({character,portraits,characters,weapon,onChange}:{character:any;portraits:any[];characters?:any[];weapon:number;onChange:(patch:any)=>void}){
 const values=characterPresentationDefaults(character);
 const choices=[...CHARACTER_PORTRAITS.filter(p=>p.id.startsWith('avatar-')),...portraits.map(c=>({src:c.portrait,name:c.name}))];
 const sprite=spriteRender({id:'preview',side:'player',hp:100,spriteAppearance:values.spriteAppearance,weapon},{direction:2,moving:false,frame:0});
 const viewport=spriteViewport(sprite,{x:0,y:0},2,0,90);
 return <section aria-label="Voz y apariencia del personaje" className="character-presentation">
  <h3>Retrato y apariencia</h3>
  <label>Retrato disponible
   <select value={choices.some(p=>p.src===character.portrait)?character.portrait:''} onChange={e=>onChange({portrait:e.target.value})}>
    <option value="" disabled>Imagen propia</option>
    {choices.map(p=><option key={p.src} value={p.src}>{p.name}</option>)}
   </select>
  </label>
  <div className="appearance-choice">
   <svg viewBox={viewport.viewBox} width="112" height="112" role="img" aria-label={`Apariencia: ${APPEARANCE_LABELS[values.spriteAppearance as keyof typeof APPEARANCE_LABELS]}`}>
    <image href={sitePath(sprite.href)} width={sprite.size[0]} height={sprite.size[1]} style={{imageRendering:'pixelated'}}/>
   </svg>
   <label>Apariencia en combate
    <select value={values.spriteAppearance} onChange={e=>onChange({spriteAppearance:e.target.value})}>
     {Object.entries(APPEARANCE_LABELS).map(([id,name])=><option key={id} value={id}>{name}</option>)}
    </select>
    <small>El retrato y la apariencia se eligen por separado. No cambian los atributos ni las habilidades.</small>
   </label>
  </div>
  <h3>Carácter y frases</h3>
  <label>Carácter
   <textarea rows={3} maxLength={2000} value={values.personality} onChange={e=>onChange({personality:e.target.value})}/>
  </label>
  <small>Describe su personalidad en la hoja de servicio. La moral mantiene las reglas de combate.</small>
  {characters&&<ServiceRelationshipsEditor character={character} characters={characters} onChange={onChange}/>}
  <p>Estas frases se usan cuando ocurre cada evento. Dejá una frase vacía para que no hable en esa situación.</p>
  {AUTHORABLE_SPEECH_EVENTS.map(event=><label key={event}>{SPEECH_LABELS[event as keyof typeof SPEECH_LABELS]}
   <textarea rows={2} maxLength={SPEECH_LINE_LIMIT} value={values.speech[event]??''} onChange={e=>{const speech={...values.speech,[event]:e.target.value};if(OPTIONAL_SPEECH_EVENTS.includes(event)&&!e.target.value)delete speech[event];onChange({speech});}}/>
   {event==='treated'&&<small>Habla después de recibir vendas de otra persona si está consciente. No habla al vendarse solo, durante un tratamiento que lo deja inconsciente ni al recuperarse con el tiempo.</small>}
  </label>)}
 </section>;
}
