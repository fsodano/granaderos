'use client';
import {hasFirearm} from '../../game/tactical.js';
import {fixedBayonetFor} from '../../game/weapon-fittings.js';
import {unitCanAct} from '../../game/ja2-hud.js';
import './ja2-weapon-mode.css';
export default function JA2WeaponMode({battle,unit,busy,onOrder,onMode}:{battle:any;unit:any;busy:boolean;onOrder:(a:any)=>void;onMode:(mode:string)=>void}){
 if(!unit||!hasFirearm(unit))return null;
 const current=unit.weaponMode??'fire',disabled=busy||!unitCanAct(battle,unit)||unit.knockedDown;
 return <div className="ja2-weapon-mode" role="group" aria-label="Modo del arma en mano">{[['fire','Disparo'],['melee','Combate cercano']].map(([mode,label])=><button key={mode} aria-pressed={current===mode} disabled={disabled} title={mode==='fire'?'Disparar con la munición disponible.':fixedBayonetFor(unit)?'Acercarse y atacar con la bayoneta fijada.':'Acercarse y golpear con la culata del arma.'} onClick={()=>{if(current!==mode)onOrder({type:'weaponMode',mode});onMode('move');}}>{label}</button>)}{current==='melee'&&<span>{fixedBayonetFor(unit)?'Bayoneta':'Culata'}</span>}</div>;
}
