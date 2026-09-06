'use client';
type Props={state:any;units:any[];selected:any;project:(x:number,y:number)=>{x:number;y:number};width:number;height:number;camera:{x:number;y:number;width:number;height:number};onCenter:(x:number,y:number)=>void};
export default function TacticalMinimap({state,units,selected,project,width,height,camera,onCenter}:Props){
 const colors:Record<string,string>={grass:'#73744c',forest:'#3c5439',road:'#a08b5c',floor:'#9d8061',water:'#4b7271',wall:'#c0b592',window:'#a89e7c',door:'#786344',stone:'#777662',mud:'#74644b'};
 return <svg className="tactical-minimap" viewBox={`0 0 ${width} ${height}`} role="button" tabIndex={0} aria-label="Minimapa del sector. Clic para centrar; flechas para desplazar la cámara." onClick={e=>{const matrix=e.currentTarget.getScreenCTM();if(!matrix)return;const point=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());onCenter(point.x,point.y);}} onKeyDown={e=>{const offsets:Record<string,[number,number]>={ArrowLeft:[-80,0],ArrowRight:[80,0],ArrowUp:[0,-60],ArrowDown:[0,60]};const d=offsets[e.key];if(d){e.preventDefault();e.stopPropagation();onCenter(camera.x+camera.width/2+d[0],camera.y+camera.height/2+d[1]);}}}>
  <rect width={width} height={height} fill="#17211a"/>
  {state.tiles.map((t:any)=>{const p=project(t.x,t.y);return <path key={`${t.x},${t.y}`} d={`M${p.x},${p.y-14}l26,14-26,14-26,-14Z`} fill={colors[t.type]??'#736f51'}/>;})}
  {units.filter(u=>u.hp>0&&!u.fled).map(u=>{const p=project(u.x,u.y);return <circle key={u.id} cx={p.x} cy={p.y} r={u.id===selected?11:7} fill={u.side==='player'?'#dcdf9d':'#d7755a'}/>;})}
  <rect x={camera.x} y={camera.y} width={camera.width} height={camera.height} fill="none" stroke="#ded387" strokeWidth="6"/>
 </svg>;
}
