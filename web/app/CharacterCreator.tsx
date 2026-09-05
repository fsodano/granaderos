'use client';
import {useState} from 'react';
import {OFFICER_QUESTIONS,PROFILE_QUESTIONS,PROFILE_ATTRIBUTES,PROFILE_POINTS,CHARACTER_CLASSES,CHARACTER_PORTRAITS,defaultProfile,createOfficerRecord} from '../../game/recruitment.js';
import './CharacterCreator.css';
export default function CharacterCreator({onCreate,busy=false}:{onCreate:(name:string,answers:any,profile:any)=>void;busy?:boolean}){
 const [name,setName]=useState(''),[profile,setProfile]=useState<any>(defaultProfile),[answers,setAnswers]=useState<any>({}),[error,setError]=useState('');
 const remaining=PROFILE_POINTS-(Object.values(profile.attributes) as number[]).reduce((a,b)=>a+b,0);
 return <section className="character-creator"><p className="eyebrow">Tu primer granadero · Personaje ficticio</p><h2>Hoja de servicio</h2><p>Elegí tu rostro y oficio, distribuí 550 puntos y respondé el cuestionario. Este personaje te representa durante la campaña y no cobra contratación.</p>
 <label>Nombre<input maxLength={30} value={name} onChange={e=>setName(e.target.value)} placeholder="Nombre y apellido"/></label>
 <label>Apodo (opcional)<input maxLength={16} value={profile.nickname??''} onChange={e=>setProfile({...profile,nickname:e.target.value})} placeholder="Cómo te llama la escuadra"/></label>
 <fieldset><legend>Retrato</legend><div className="creator-portraits">{CHARACTER_PORTRAITS.filter((p:any)=>p.id.startsWith('avatar-')).map((p:any)=><button type="button" key={p.id} className={profile.portraitId===p.id?'chosen':''} aria-pressed={profile.portraitId===p.id} onClick={()=>setProfile({...profile,portraitId:p.id})}><img src={p.src} alt={p.name}/></button>)}</div><small>Rostros ficticios originales. La apariencia no limita el oficio ni las habilidades.</small></fieldset>
 <label>Oficio<select value={profile.classId} onChange={e=>setProfile({...profile,classId:e.target.value})}>{CHARACTER_CLASSES.map((c:any)=><option key={c.id} value={c.id}>{c.name} — {c.description}</option>)}</select></label>
 <fieldset><legend>Atributos · {remaining} puntos por distribuir</legend><div className="creator-attributes">{PROFILE_ATTRIBUTES.map((a:any)=><label key={a.id}>{a.name}<input type="number" min={35} max={85} value={profile.attributes[a.id]} onChange={e=>setProfile({...profile,attributes:{...profile.attributes,[a.id]:Number(e.target.value)}})}/></label>)}</div></fieldset>
 {[...OFFICER_QUESTIONS,...PROFILE_QUESTIONS].map((q:any)=><label key={q.id}>{q.label}<select value={answers[q.id]??''} onChange={e=>setAnswers({...answers,[q.id]:e.target.value})}><option value="" disabled>Elegí una respuesta</option>{q.choices.map((c:any)=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>)}
 <p>La equitación facilita marchar a caballo; la experiencia nocturna amplía la visión; la enseñanza mejora la instrucción. El optimismo o pesimismo afectan la moral inicial.</p>
 {error&&<p role="alert">{error}</p>}<button className="line-button" disabled={busy} onClick={()=>{try{createOfficerRecord(name,answers,profile);setError('');onCreate(name,answers,profile);}catch(e){setError(e instanceof Error?e.message:'Revisá la hoja de servicio.');}}}>Comenzar mi campaña</button></section>;
}
