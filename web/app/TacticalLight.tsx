// Small static shapes keep light sources readable without per-frame filters.
export default function TacticalLight({source,point,night}:{source:{type?:string;extinguished?:boolean;turns?:number};point:{x:number;y:number};night:boolean}){
 const type=source.type??'campfire',lit=!source.extinguished&&source.turns!==0;
 const flame=(x:number,y:number,size=1)=>!lit?null:<g transform={`translate(${x} ${y}) scale(${size})`} data-light-flame="true"><path d="M0 1C-5 0-4-5-1-8C-1-5 3-5 2-10C7-4 6 0 0 1Z" fill="#ce7838"/><path d="M0 0C-2-2-1-4 1-6C1-3 3-2 2 0Z" fill="#ffe0a0"/></g>;
 return <g transform={`translate(${point.x} ${point.y})`} pointerEvents="none" data-light-source={type}>
  <ellipse cy="2" rx={type==='campfire'?10:7} ry="3" fill="#171b17" opacity=".45"/>
  {night&&lit&&<ellipse data-light-glow="true" cy={type==='lantern'?-22:-3} rx={type==='lantern'?9:12} ry={type==='lantern'?11:6} fill="#e9b76a" opacity=".12"/>}
  {type==='lantern'?<>
   <path d="M-7 1V-37H2V-32" fill="none" stroke="#292c26" strokeWidth="2.5"/>
   <path d="M-6 0V-36" stroke="#80715a" strokeWidth=".7"/>
   <path d="M0-30V-32Q2-35 4-32V-30" fill="none" stroke="#aaa080" strokeWidth="1"/>
   <path d="M-3-28L0-31H4L7-28V-17L4-14H0L-3-17Z" fill="#252d28" stroke="#a29370" strokeWidth=".8"/>
   <path d="M-1-27H5V-18H-1Z" fill={night&&lit?'#c5a064':'#82795c'} opacity=".85"/>
   <path d="M1-18V-23H3V-18" fill="#e5ce99"/>
   {flame(2,-23,.4)}
   <path d="M2-28V-17M-3-17H7M-3-28H7" stroke="#313930" strokeWidth="1"/>
  </>:type==='torch'?<>
   <path d="M-8 3L5-3" stroke="#30271d" strokeWidth="3.5" strokeLinecap="round"/>
   <path d="M-8 2L3-3" stroke="#8b7050" strokeWidth="1.5" strokeLinecap="round"/>
   <path d="M2-4L6-2M3-5L7-3" stroke="#6b5140" strokeWidth="2"/>
   {flame(5,-4,.75)}
  </>:type==='campfire'?<>
   <path d="M-8 3L7-3M-7-3L8 3" stroke="#30291e" strokeWidth="4" strokeLinecap="round"/>
   <path d="M-7 2L6-3M-6-3L7 2" stroke="#745338" strokeWidth="1.3"/>
   {flame(-2,-2,1)}{flame(3,-1,.65)}
  </>:null}
 </g>;
}
