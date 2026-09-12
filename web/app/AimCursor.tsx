import {canChooseShotLocation} from '../../game/targeted-combat.js';
import './aim-cursor.css';
export default function AimCursor({point,aim,preview,target,scale=1,bounds,exploring=false}:{point:{x:number;y:number};aim:number;preview:any;target:any;scale?:number;exploring?:boolean;bounds?:{x:number;y:number;width:number;height:number}}){
 const reloading=preview?.attackType==='reload';
 const throwing=preview?.attackType==='throwKnife';
 const region=preview?.hitLocation?(canChooseShotLocation(target)?preview.hitLocation:'Cuerpo'):'Casilla';
 const label=reloading?preview.actionLabel:throwing?`Facón · ${region}`:region;
 const cost=preview?.pa;
 const margin=bounds?Math.min(bounds.width/2,88*scale):0;
 const labelX=bounds?(Math.max(bounds.x+margin,Math.min(bounds.x+bounds.width-margin,point.x))-point.x)/scale:0;
 const labelY=bounds&&point.y+135*scale>bounds.y+bounds.height?-50:43;
 const text=`${label}${!exploring&&cost!==undefined&&preview?.cursor!=='empty'?` · ${cost} PA`:''}`;
 return <g className={`aim-cursor ${preview?.valid?'valid':'invalid'}`} transform={`translate(${point.x} ${point.y}) scale(${scale})`} pointerEvents="none" role="img" aria-label={`Mira: ${text}. ${reloading?'':`Puntería ${aim} de 4.`}${preview?.reason?` ${preview.reason}`:''}`}>
  <circle r="21" className="aim-outer"/>
  {preview?.cursor==='empty'?<path className="aim-empty" d="M-13-13L13 13M13-13L-13 13"/>:reloading?<path className="aim-reload" d="M12-6A14 14 0 1 0 12 7M12-16V-6H2"/>:<><circle r="8"/><path d="M-13 0h9M4 0h9M0-13v9M0 4v9"/></>}
  {!reloading&&[0,1,2,3].map(i=><path key={i} className={i<aim?'aim-step filled':'aim-step'} transform={`rotate(${i*90})`} d="M-11-26Q0-31 11-26"/>)}
  <text x={labelX} y={labelY} textAnchor="middle">{text}</text><text x={labelX} y={labelY+14} textAnchor="middle" className="aim-detail">{throwing?`${preview.energy} EN${exploring?'':` · ${preview.remaining} PA restantes`}`:preview?.cursor==='empty'?'No quedan cartuchos':!exploring&&cost!==undefined?preview?.partial?`Faltan ${preview.remainingReloadPA} PA de recarga`:`${preview.remaining} PA restantes`:preview?.reason??'Elegí un objetivo'}</text>
 </g>;
}
