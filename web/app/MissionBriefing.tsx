'use client';
type Mission = {name:string;anchor?:string;stage?:string;objectives?:any[];available?:boolean;reason?:string};
export default function MissionBriefing({mission,canEnter,blocked,onEnter}:{mission:Mission;canEnter:boolean;blocked?:boolean;onEnter:()=>void}){
 return <section className="field-supplies" aria-label={mission.name}><p className="eyebrow">MISIÓN HISTÓRICA</p><h3>{mission.name}</h3><ul>{(mission.objectives||[]).map((objective:any,index:number)=><li key={index}>{typeof objective==='string'?objective:`${objective.done?'✓ ':''}${objective.text||objective.label||objective.name}`}</li>)}</ul>{!canEnter&&<p>{mission.reason||'La escuadra debe llegar a Tucumán, bajo control patriota, después de San Lorenzo.'}</p>}<button className="line-button" disabled={!canEnter||blocked} onClick={onEnter}>Visitar la posta de Yatasto</button></section>;
}
