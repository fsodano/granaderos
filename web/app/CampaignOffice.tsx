'use client';
import {campaignUI} from '../lib/campaign-ui';
import {campaignObjectives} from '../../game/campaign.js';
import QuestJournal from './QuestJournal';
import StoryQuestJournal from './StoryQuestJournal';
import Horses from './Horses';
import Logistics from './Logistics';
import Treasury from './Treasury';
export default function CampaignOffice({state:s,dispatch,section}:{state:any;dispatch:(a:any)=>void;section:string}){
 const ui=campaignUI(s),{Diplomacy,JournalReference}=ui;
 return <div className="office-content">{section==='workshop'&&<><Treasury state={s} dispatch={dispatch}/><Horses state={s} dispatch={dispatch}/><Logistics state={s} dispatch={dispatch}/></>}
 {section==='diplomacy'&&Diplomacy&&<Diplomacy state={s} dispatch={dispatch}/>}
 {section==='journal'&&<><QuestJournal state={s}/><StoryQuestJournal state={s}/><section className="journal"><h2>Cuaderno de campaña</h2>{JournalReference&&<JournalReference state={s} dispatch={dispatch}/>}
 <div className="journal-columns"><div><p className="eyebrow">{ui.journalLabel??'OBJETIVOS DE CAMPAÑA'}</p>{campaignObjectives(s).map((p:any)=><article className={`chapter ${p.active?'active':''}`} key={p.id}><h3>{p.name}{p.complete?' ✓':''}</h3><p>{p.objective}</p></article>)}</div><div><p className="eyebrow">DESPACHOS RECIBIDOS</p>{s.log.map((p:any,i:number)=><article className="dispatch-entry" key={i}><span>DÍA {1+Math.floor(p.hour/24)} · {p.hour%24}:00</span><p>{p.text}</p></article>)}</div></div></section></>}</div>;
}
