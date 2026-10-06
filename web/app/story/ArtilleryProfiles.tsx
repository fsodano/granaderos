'use client';
import {displayedAP,storedAP,isAPField} from '../../../game/action-points.js';
import {sitePath} from '../../lib/site-path.js';
import {useRef,useState} from 'react';
import {ARTILLERY,ARTILLERY_FIELDS} from '../../../game/artillery-definitions.js';
const normalized=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
export default function ArtilleryProfiles({draft,onChange}:{draft:any;onChange:(value:any)=>void}){
 const [search,setSearch]=useState(''),[selected,setSelected]=useState('bronze4'),[notice,setNotice]=useState(''),imageRef=useRef<HTMLInputElement>(null),latest=useRef(draft);latest.current=draft;
 const profiles=draft.artilleryProfiles??ARTILLERY,profile=profiles[selected],query=normalized(search.trim()),types=Object.keys(ARTILLERY).filter(type=>normalized(`${type} ${profiles[type].name}`).includes(query));
 const update=(fields:any,type=selected)=>{const current=latest.current,values=current.artilleryProfiles??ARTILLERY;onChange({...current,artilleryProfiles:{...values,[type]:{...values[type],...fields}}});};
 async function upload(file:File|undefined){
  if(!file)return;const type=selected;
  try{
   if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>250000)throw Error('Usá una imagen PNG, JPEG o WebP de hasta 250 KB.');
   const art=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('No se pudo leer la imagen.'));reader.readAsDataURL(file);});
   update({art},type);setNotice('Imagen de artillería actualizada.');
  }catch(error:any){setNotice(error.message);}
 }
 return <section aria-label="Modelos de artillería" className="editor-columns"><aside>
  <h2>Artillería <small>{types.length} / 3</small></h2><label>Buscar artillería<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nombre del modelo"/></label>
  <div className="entry-list">{types.map(type=><button key={type} aria-pressed={selected===type} onClick={()=>setSelected(type)}><img className="weapon-thumbnail" src={sitePath(profiles[type].art)} alt=""/>{profiles[type].name}</button>)}{types.length===0&&<p role="status">No hay resultados para esta búsqueda.</p>}</div>
  <button onClick={()=>{const next={...draft};delete next.artilleryProfiles;onChange(next);}}>Restaurar artillería original</button>
 </aside><div className="form-panel">
  <h2>{profile.name}</h2><img className="weapon-preview" src={sitePath(profile.art)} alt={profile.name}/>
  <input ref={imageRef} type="file" hidden accept="image/png,image/jpeg,image/webp" aria-label="Imagen de artillería" onChange={e=>{void upload(e.target.files?.[0]);e.target.value='';}}/>
  <button onClick={()=>imageRef.current?.click()}>Cambiar imagen de artillería</button><button onClick={()=>update({art:ARTILLERY[selected as keyof typeof ARTILLERY].art})}>Usar imagen original de artillería</button>
  <label>Nombre del modelo<input value={profile.name} maxLength={80} onChange={e=>update({name:e.target.value})}/></label>
  <div className="fields">{ARTILLERY_FIELDS.map(([key,label,min,max]:any)=><label key={key}>{label}<input type="number" min={isAPField(key)?displayedAP(min):min} max={isAPField(key)?displayedAP(max):max} step={isAPField(key)?displayedAP(1):1} value={Number.isFinite(profile[key])?(isAPField(key)?displayedAP(profile[key]):profile[key]):''} onChange={e=>update({[key]:isAPField(key)?storedAP(e.target.valueAsNumber):e.target.valueAsNumber})}/></label>)}</div>
  <label>Se entrega cargada<input type="checkbox" checked={profile.initialLoaded} onChange={e=>update({initialLoaded:e.target.checked})}/></label>
  <p>Los cambios se aplican a las piezas propias y enemigas de este modelo. Cada artillero paga los PA indicados. Una recarga puede continuar en varios turnos.</p>
  <p>La metralla alcanza hasta dos veces su escala y se abre en abanico. La bala rasa pierde penetración al atravesar personas o muros. Las reservas iniciales se entregan una sola vez; volver al sector conserva la munición restante.</p>
  <p>El precio de reposición y su límite se editan en Reglas. La imagen también aparece en el campo de batalla.</p>
  {notice&&<p role="status">{notice}</p>}
 </div></section>;
}
