import {contextActionCursorModel} from '../../../packages/game/context-action-cursor.js';
import {formatAP} from '../../../packages/game/action-points.js';

type Props={state:any;unit:any;hover:any;preview?:any;mode?:string;point:{x:number;y:number}|null;scale?:number;itemIntent?:string;movementIntent?:string;busy?:boolean};

// One small pointer glyph and its current verb. All actions and availability
// remain in the native click/preview models; this component has no events.
export default function ContextActionCursor({state,unit,hover,preview=null,mode='move',point,scale=1,itemIntent='use',movementIntent='forward',busy=false}:Props){
 const model=contextActionCursorModel(state,unit,hover,{preview,mode,itemIntent,movementIntent,busy});
 if(!model||!point||![point.x,point.y,scale].every(Number.isFinite)||scale<=0)return null;
 const color=model.valid?'#f3e6c8':'#d9a294';
 const pa='pa' in model?model.pa:undefined;
 const label=`${model.label}${pa===undefined?'':` · ${formatAP(pa)} PA`}`;
 return <g data-context-action-cursor={model.icon} transform={`translate(${point.x+12*scale} ${point.y+8*scale}) scale(${scale})`} pointerEvents="none" role="img" aria-label={`${label}${model.reason?': '+model.reason:''}`}>
  <title>{`${label}${model.reason?': '+model.reason:''}`}</title>
  <g data-context-icon-size="16" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
   {model.icon==='lips'?<><path d="M-8 0Q-4-6 0-2Q4-6 8 0Q4 6 0 5Q-4 6-8 0Z"/><path d="M-8 0Q0 3 8 0"/></>:model.icon==='select'?<><path d="M-7-6v12l4-3 3 5 3-2-3-5 5-1Z"/></>:model.icon==='aim'?<><circle r="5"/><path d="M-8 0h4M4 0h4M0-8v4M0 4v4"/></>:model.icon==='look'?<><path d="M-8 0Q0-8 8 0Q0 8-8 0Z"/><circle r="2"/></>:model.icon==='medical'?<path d="M-2-7h4v5h5v4H2v5h-4V2h-5v-4h5Z"/>:model.icon==='reload'?<><path d="M5-4A6 6 0 1 0 6 3"/><path d="M5-8v5H0"/></>:<path d="M-6 3V-3q0-2 2-2v5-7q0-2 2-2v8-9q0-2 2-2V0-6q0-2 2-2v10l2-2q2-1 2 1L5 7H-2Z"/>}
  </g>
  <text x="12" y="3" fill={color} stroke="#16241f" strokeWidth="2.5" paintOrder="stroke fill" fontSize="10" fontFamily="sans-serif">{label}</text>
  {model.reason&&<text x="12" y="15" fill={color} stroke="#16241f" strokeWidth="2.5" paintOrder="stroke fill" fontSize="9" fontFamily="sans-serif">{model.reason.length>100?model.reason.slice(0,97)+'…':model.reason}</text>}
 </g>;
}
