'use client';
import {useEffect,useId,useState} from 'react';

export const FIELD_LABELS:Record<string,string>={
 id:'Identidad',name:'Nombre',title:'Título',version:'Versión del formato',revision:'Revisión',
 content:'Contenido',world:'Mundo',presentation:'Presentación',assets:'Recursos',maps:'Mapas',
 characters:'Personajes',weapons:'Armas',placements:'Ubicaciones',quests:'Misiones',errands:'Encargos',
 rules:'Reglas',campaignStory:'Historia',campaignEvents:'Eventos programados',roadsideDiscoveries:'Hallazgos',
 introduction:'Introducción',subtitle:'Subtítulo',caption:'Descripción',footer:'Pie',eyebrow:'Antetítulo',
 menuArt:'Imagen de inicio',menuArtAlt:'Descripción de la imagen',calendar:'Calendario',
 characterPortraits:'Catálogo de retratos',officerCreation:'Creación de personajes',manual:'Manual',atlas:'Atlas',
 year:'Año',month:'Mes',day:'Día',scenes:'Escenas',text:'Texto',visual:'Presentación visual',durationMs:'Duración (ms)',
 portrait:'Retrato',src:'Imagen',gender:'Género',role:'Función',skinTone:'Tono de piel',
 spriteAppearance:'Apariencia táctica',spriteSkinTone:'Piel táctica',selectable:'Disponible para elegir',
 biography:'Biografía',personality:'Personalidad',nickname:'Apodo',attributes:'Atributos',speech:'Frases',
 conditions:'Condiciones',effects:'Efectos',status:'Estado',type:'Tipo',amount:'Cantidad',min:'Mínimo',max:'Máximo',
 chapters:'Capítulos',objective:'Objetivo',victory:'Victoria',defeat:'Derrota',failureConditions:'Condiciones de derrota',
 atHour:'Hora del evento',operation:'Operación',quest:'Misión',requiredAlive:'Personajes necesarios',deadlineHours:'Plazo (horas)',
 sectors:'Localidades',cells:'Casillas',theaters:'Regiones',factions:'Facciones',cities:'Ciudades',districts:'Distritos',
 geography:'Geografía',projection:'Proyección',places:'Rótulos de localidades',buildings:'Construcciones',
 physical:'Recursos físicos',expansion:'Generación de escenas',weather:'Clima',enemyStrategy:'Estrategia adversaria',
 headquarters:'Cuartel general',defaultHeadquarters:'Cuartel general inicial',foundry:'Taller',defaultFoundry:'Taller inicial',
 campaignRoles:'Funciones de campaña',defaultRoles:'Funciones iniciales',incomeSources:'Ingresos',sectorCash:'Dinero en sectores',
 arrivalFacilities:'Instalaciones de llegada',arrivalSites:'Lugares de llegada',ruralSectors:'Localidades rurales',
 path:'Ruta del archivo',sha256:'SHA-256',label:'Etiqueta',enabled:'Activado',width:'Ancho',height:'Altura',
 roof:'Techo',wall:'Pared',trim:'Molduras',types:'Tipos',footprints:'Dimensiones',
 wallFinish:'Acabado de pared',roofFinish:'Acabado de techo',doorStyle:'Estilo de puerta',windowStyle:'Estilo de ventana',
 land:'Tierra',rivers:'Ríos',neighbors:'Localidades conectadas',income:'Ingreso',biome:'Bioma',theater:'Región',
 caches:'Depósitos',arsenals:'Artillería almacenada',environment:'Puertas y contenedores',
 classes:'Clases',questions:'Preguntas',choices:'Opciones',defaults:'Valores iniciales',equipment:'Equipo',
 templates:'Plantillas',buildingsTemplates:'Plantillas de edificios',longitudes:'Longitudes',latitudes:'Latitudes',
 longitudeScale:'Escala de longitud',latitudeScale:'Escala de latitud',minLongitude:'Longitud inicial',maxLatitude:'Latitud superior',
 startingTerritory:'Territorio inicial',startingTreasury:'Tesorería inicial',owner:'Control',loyalty:'Lealtad',
 requiredSectors:'Sectores necesarios',requires:'Requisitos',reward:'Recompensa',cost:'Costo',
 imports:'Importaciones',artillerySupply:'Suministro de artillería',artilleryTrading:'Comercio de artillería',
 ammunitionMarket:'Munición',oppositionAppearance:'Apariencia adversaria',militiaAppearance:'Apariencia de milicias',
};
const forbidden=new Set(['__proto__','constructor','prototype']);
const valueFor=(type:string)=>type==='number'?0:type==='boolean'?false:type==='object'?{}:type==='array'?[]:type==='null'?null:'';
export const fieldLabel=(key:string)=>FIELD_LABELS[key]??key.replace(/([a-z])([A-Z])/g,'$1 $2').replaceAll('_',' ');
export type FieldEditorProps={value:any;onChange:(next:any)=>void;label?:string;path?:string;depth?:number};

export default function FieldEditor({value,onChange,label='Campos',path='',depth=0}:FieldEditorProps){
 const inputId=useId(),[open,setOpen]=useState(depth===0),[newKey,setNewKey]=useState(''),[newType,setNewType]=useState('string'),[page,setPage]=useState(0),[query,setQuery]=useState('');
 const array=Array.isArray(value),object=value!==null&&typeof value==='object'&&!array;
 if(array||object){
  const entries=array?value.map((entry:any,index:number)=>[String(index),entry] as const):Object.entries(value);
  const filtered=entries.filter(([key,entry])=>!query||`${key} ${entry?.id??''} ${entry?.name??''} ${entry?.title??''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const pages=Math.max(1,Math.ceil(filtered.length/20)),current=Math.min(page,pages-1),shown=filtered.slice(current*20,current*20+20);
  const patch=(key:string,next:any)=>onChange(array?value.map((entry:any,index:number)=>String(index)===key?next:entry):{...value,[key]:next});
  const remove=(key:string)=>{if(array)onChange(value.filter((_:any,index:number)=>String(index)!==key));else{const next={...value};delete next[key];onChange(next);}};
  function add(){
   if(array){onChange([...value,valueFor(newType)]);setPage(Math.floor(value.length/20));return;}
   const key=newKey.trim();if(!key||forbidden.has(key)||Object.hasOwn(value,key))return;
   onChange({...value,[key]:valueFor(newType)});setNewKey('');setPage(Math.floor(entries.length/20));
  }
  return <section className={`studio-fields studio-fields-depth-${Math.min(depth,3)}`} aria-label={label}>
   <button type="button" className="studio-field-heading" aria-expanded={open} onClick={()=>setOpen(!open)}><span>{open?'▾':'▸'} {label}</span><small>{entries.length} {array?'elementos':'campos'}</small></button>
   {open&&<div className="studio-field-body">
    {entries.length>20&&<div className="studio-field-tools"><label>Buscar elementos<input value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/></label><button type="button" disabled={current===0} onClick={()=>setPage(current-1)}>Anterior</button><span>{current+1} / {pages}</span><button type="button" disabled={current>=pages-1} onClick={()=>setPage(current+1)}>Siguiente</button></div>}
    {shown.map(([key,entry])=><div className="studio-field-row" key={key}>
     <FieldEditor value={entry} onChange={next=>patch(key,next)} label={array?`${Number(key)+1}. ${entry?.name??entry?.title??entry?.id??'Elemento'}`:fieldLabel(key)} path={path?`${path}.${key}`:key} depth={depth+1}/>
     <div className="studio-field-row-actions">{array&&<><button type="button" title="Mover hacia arriba" aria-label={`Subir ${key}`} disabled={key==='0'} onClick={()=>{const next=[...value],index=Number(key);[next[index-1],next[index]]=[next[index],next[index-1]];onChange(next);}}>↑</button><button type="button" title="Duplicar elemento" onClick={()=>onChange([...value.slice(0,Number(key)+1),structuredClone(entry),...value.slice(Number(key)+1)])}>Duplicar</button></>}<button type="button" className="studio-text-danger" aria-label={`Quitar ${array?'elemento '+(Number(key)+1):fieldLabel(key)}`} onClick={()=>remove(key)}>Quitar</button></div>
    </div>)}
    {!entries.length&&<p className="studio-muted">Todavía no hay {array?'elementos':'campos'}. Agregá el primero.</p>}
    <div className="studio-add-field">
     {!array&&<label>Campo nuevo<input value={newKey} onChange={e=>setNewKey(e.target.value)} placeholder="Nombre del campo" list={`${inputId}-keys`}/><datalist id={`${inputId}-keys`}>{Object.keys(FIELD_LABELS).filter(key=>!Object.hasOwn(value,key)).map(key=><option value={key} key={key}>{fieldLabel(key)}</option>)}</datalist></label>}
     <label>Tipo<select value={newType} onChange={e=>setNewType(e.target.value)}><option value="string">Texto</option><option value="number">Número</option><option value="boolean">Sí / no</option><option value="object">Grupo de campos</option><option value="array">Lista</option><option value="null">Sin valor</option></select></label>
     <button type="button" disabled={!array&&(!newKey.trim()||forbidden.has(newKey.trim())||Object.hasOwn(value,newKey.trim()))} onClick={add}>Agregar {array?'elemento':'campo'}</button>
    </div>
   </div>}
  </section>;
 }
 if(typeof value==='boolean')return <label className="studio-check-field"><input type="checkbox" checked={value} onChange={e=>onChange(e.target.checked)}/><span>{label}</span><small>{path}</small></label>;
 if(typeof value==='number')return <label className="studio-value-field">{label}<input type="number" step="any" value={Number.isFinite(value)?value:''} onChange={e=>onChange(e.target.value===''?null:e.target.valueAsNumber)}/><small>{path}</small></label>;
 if(value===null||value===undefined)return <div className="studio-null-field"><span>{label}</span><small>Sin valor</small><select aria-label={`Tipo de ${label}`} value={newType} onChange={e=>setNewType(e.target.value)}><option value="string">Texto</option><option value="number">Número</option><option value="boolean">Sí / no</option><option value="object">Grupo de campos</option><option value="array">Lista</option></select><button type="button" onClick={()=>onChange(valueFor(newType))}>Definir</button></div>;
 return <label className="studio-value-field">{label}{typeof value==='string'&&/^#[a-f\d]{6}$/i.test(value)?<span className="studio-colour-field"><input aria-label={`Color de ${label}`} type="color" value={value} onChange={e=>onChange(e.target.value)}/><input value={value} onChange={e=>onChange(e.target.value)}/></span>:typeof value==='string'&&(value.length>100||/text|description|biography|introduction|objective|victory|defeat|caption|personality|note/i.test(path))?<textarea rows={3} value={value} onChange={e=>onChange(e.target.value)}/>:<input value={String(value??'')} onChange={e=>onChange(e.target.value)}/>}<small>{path}</small></label>;
}

export function DocumentEditor(props:FieldEditorProps){
 const [mode,setMode]=useState('fields'),[text,setText]=useState(''),[error,setError]=useState('');
 useEffect(()=>{if(mode==='fields')setText(JSON.stringify(props.value,null,2));},[props.value,mode]);
 return <section className="studio-document"><div className="studio-document-mode"><button type="button" aria-pressed={mode==='fields'} onClick={()=>setMode('fields')}>Campos</button><button type="button" aria-pressed={mode==='json'} onClick={()=>{setText(JSON.stringify(props.value,null,2));setMode('json');setError('');}}>JSON</button></div>{mode==='fields'?<FieldEditor {...props}/>:<><label>Documento JSON<textarea className="studio-json" rows={22} spellCheck={false} value={text} onChange={e=>setText(e.target.value)}/></label>{error&&<p role="alert">{error}</p>}<button type="button" onClick={()=>{try{const next=JSON.parse(text);props.onChange(next);setError('');}catch(e:any){setError(e.message);}}}>Aplicar documento</button></>}</section>;
}
