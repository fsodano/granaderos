'use client';
import {useEffect,useState} from 'react';
type Motion={direction:number;frame:number;moving:boolean};
type Props={unit:any;position:{x:number;y:number};motion:Motion;pose?:string;drawSize?:number};
/** Original articulated atlases. The fixed projected ground origin anchors every pose. */
export default function SpriteFigure({unit,position,motion,pose='idle',drawSize=52}:Props){
 const [actionFrame,setActionFrame]=useState(0);
 const action=['fire','reload','strike'].includes(pose)?pose:null;
 useEffect(()=>{if(!action){setActionFrame(0);return;}let handle=0;const start=performance.now();const tick=(now:number)=>{setActionFrame(Math.min(7,Math.floor((now-start)/100)));if(now-start<800)handle=requestAnimationFrame(tick);};handle=requestAnimationFrame(tick);return()=>cancelAnimationFrame(handle);},[action,unit.ap,unit.loaded]);
 const dir=((Math.round(motion.direction)||0)%8+8)%8,frame=((Math.floor(motion.frame)||0)%8+8)%8;
 const faction=unit.side==='enemy'?'royalist':'granadero';
 const posture=unit.stance==='prone'||unit.movementMode==='prone'?'prone':unit.movementMode==='crouch'?'crouch':'standing';
 let name='',cell=192,size=drawSize,col=dir,row=0,rows=1,anchor=.8830497935;
 if(unit.mounted){cell=256;size=drawSize*1.62;name=`cavalry-${motion.moving?'walk':'idle'}`;anchor=.8828744590;if(motion.moving){col=frame;row=dir;rows=8;}}
 else if(posture==='standing'&&action&&!motion.moving){name=`${faction}-${action}`;size=drawSize*(3.5/2.6);col=actionFrame;row=dir;rows=8;}
 else{const gait=motion.moving?(posture==='standing'&&unit.movementMode==='run'?'run':'walk'):'idle';name=`${faction}-${posture==='standing'?'':`${posture}-`}${gait}`;if(posture==='prone'){size=drawSize*(3.1/2.6);anchor=.6396817267;}if(motion.moving){col=frame;row=dir;rows=8;}}
 return <g pointerEvents="none" data-sprite={name}><ellipse cx={position.x} cy={position.y-.5} rx={unit.mounted?drawSize*.22:drawSize*.115} ry={drawSize*.045} fill="#171812" opacity=".36"/><svg x={position.x-size*.5000002384} y={position.y-size*anchor} width={size} height={size} viewBox={`${col*cell} ${row*cell} ${cell} ${cell}`} overflow="hidden"><image href={`/art/${name}-atlas.png`} width={cell*8} height={cell*rows}/></svg></g>;
}
