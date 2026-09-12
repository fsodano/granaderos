import {canChooseShotLocation} from '../../game/targeted-combat.js';
import './aim-cursor.css';
export default function AimCursor({point,aim,preview,target,scale=1,bounds}:{point:{x:number;y:number};aim:number;preview:any;target:any;scale?:number;bounds?:{x:number;y:number;width:number;height:number}}){
 const label=preview?.hitLocation?(canChooseShotLocation(target)?preview.hitLocation:'Cuerpo'):'Casilla';
 const cost=preview?.pa;
 const margin=bounds?Math.min(bounds.width/2,88*scale):0;
 const labelX=bounds?(Math.max(bounds.x+margin,Math.min(bounds.x+bounds.width-margin,point.x))-point.x)/scale:0;
 const labelY=bounds&&point.y+135*scale>bounds.y+bounds.height?-50:43;
 const text=`${label}${cost!==undefined?` · ${cost} PA`:''}`;
 return <g className={`aim-cursor ${preview?.valid?'valid':'invalid'}`} transform={`translate(${point.x} ${point.y}) scale(${scale})`} pointerEvents="none" role="img" aria-label={`Mira: ${text}. Puntería ${aim} de 4.${preview?.reason?` ${preview.reason}`:''}`}>
  <circle r="21" className="aim-outer"/><circle r="8"/><path d="M-13 0h9M4 0h9M0-13v9M0 4v9"/>
  {[0,1,2,3].map(i=><path key={i} className={i<aim?'aim-step filled':'aim-step'} transform={`rotate(${i*90})`} d="M-11-26Q0-31 11-26"/>)}
  <text x={labelX} y={labelY} textAnchor="middle">{text}</text><text x={labelX} y={labelY+14} textAnchor="middle" className="aim-detail">{cost!==undefined?`${preview.remaining} PA restantes`:preview?.reason??'Elegí un objetivo'}</text>
 </g>;
}
