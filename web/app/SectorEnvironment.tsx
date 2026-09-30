import {regionalClimate,regionalWeatherAt,regionalWeatherLabel,campaignSeason} from '../../game/regional-weather.js';
import './sector-environment.css';

export default function SectorEnvironment({sector,hour,local}:{sector:string;hour:number;local:boolean}){
 const climate=regionalClimate(sector);if(!climate)return null;
 const weather=regionalWeatherAt(sector,hour);
 return <details className="sector-environment"><summary>Terreno y clima</summary>
  <p>{climate.name} · {campaignSeason(hour).name}</p><p>{climate.terrain}</p>
  {local&&<p>Tiempo actual: <strong>{regionalWeatherLabel(weather)}</strong></p>}
  <small>La humedad y la lluvia dificultan el encendido de la pólvora. El poncho protege del mal tiempo.</small>
  {climate.id==='andes'&&<small>La altura reduce los PA disponibles en combate. Los pasos cierran en invierno.</small>}
 </details>;
}
