import {BufferAttribute,BufferGeometry} from 'three';

/** Closed low-cost sacks: a flat foot, broad body creases and a gathered neck.
 * X/Z are unit radii. The existing prop keeps its placement and height scale. */
export function storageSackGeometry(variant:number){
  const profile=[[-16/17,.38,.34],[-.62,.78,.73],[-.08,.96,.91],[.36,.83,.78],[.64,.48,.44],[.73,.23,.20],[.97,.32,.27]],position:number[]=[],colour:number[]=[],uv:number[]=[],index:number[]=[],segments=8;
  for(const [ring,[y,rx,rz]]of profile.entries())for(let n=0;n<segments;n++){
    const angle=n*Math.PI*2/segments,body=ring>0&&ring<5,fold=body?.045*Math.cos(angle*3+variant*.7)+.025*Math.sin(angle*2-variant):ring>=5?.045*Math.cos(angle*4):0;
    const lean=ring/6*.035*(variant?1:-1),height=ring===0?y: ring===6?y+.03*Math.cos(angle):y+.025*Math.sin(angle*2+variant)*Number(body);
    position.push(Math.cos(angle)*(rx+fold)+lean,height,Math.sin(angle)*(rz+fold));uv.push(n/segments,ring/6);
    const shade=(ring===5?.67:ring===6?.92:.91)+.045*Math.cos(angle*2+variant)*Number(body);colour.push(shade,shade,shade);
  }
  for(let ring=0;ring<profile.length-1;ring++)for(let n=0;n<segments;n++){const a=ring*segments+n,b=ring*segments+(n+1)%segments,c=b+segments,d=a+segments;index.push(a,c,b,a,d,c);}
  for(const [ring,y,shade]of [[0,-16/17,.84],[6,.93,.67]]){const centre=position.length/3;position.push(ring===0?0:(variant?1:-1)*.035,y,0);uv.push(.5,ring/6);colour.push(shade,shade,shade);for(let n=0;n<segments;n++){const a=ring*segments+n,b=ring*segments+(n+1)%segments;index.push(...(ring===0?[centre,a,b]:[centre,b,a]));}}
  const geometry=new BufferGeometry().setAttribute('position',new BufferAttribute(new Float32Array(position),3)).setAttribute('uv',new BufferAttribute(new Float32Array(uv),2)).setAttribute('color',new BufferAttribute(new Float32Array(colour),3)).setIndex(index);geometry.computeVertexNormals();geometry.computeBoundingBox();return geometry;
}

function clothBuilder(){
  const positions:number[]=[],colours:number[]=[],uv:number[]=[];
  const face=(points:readonly (readonly number[])[],shade:number)=>{for(let n=1;n<points.length-1;n++)for(const p of [points[0],points[n],points[n+1]]){positions.push(...p);colours.push(shade,shade,shade);uv.push(p[0]+.5,p[2]+.5);}};
  const finish=()=>{const geometry=new BufferGeometry().setAttribute('position',new BufferAttribute(new Float32Array(positions),3)).setAttribute('uv',new BufferAttribute(new Float32Array(uv),2)).setAttribute('color',new BufferAttribute(new Float32Array(colours),3));geometry.computeVertexNormals();return geometry;};
  return {face,finish};
}

/** The body rests on the floor. Broad dyed strips stay readable without a
 * fine woven texture, raised cords or a material for each stripe. */
export function floorRugBodyGeometry(){
  const {face,finish}=clothBuilder(),rows=[-.37,-.28,-.16,.10,.22,.37],shades=[.82,.99,.88,1.02,.80],left=-.42,right=.42,top=.018;
  for(let n=0;n<rows.length-1;n++){
    const a=rows[n],b=rows[n+1];face([[left,top,a],[left,top,b],[right,top,b],[right,top,a]],shades[n]);
    face([[left,0,a],[left,0,b],[left,top,b],[left,top,a]],.80);face([[right,0,b],[right,0,a],[right,top,a],[right,top,b]],.80);
  }
  face([[left,0,rows[0]],[right,0,rows[0]],[right,0,rows.at(-1)!],[left,0,rows.at(-1)!]],.78);
  for(const [z,reverse]of [[rows[0],false],[rows.at(-1)!,true]] as const){const points=[[left,0,z],[left,top,z],[right,top,z],[right,0,z]];face(reverse?points.reverse():points,.82);}
  return finish();
}

/** Pale woven bands and uneven separated fringe use the existing linen
 * batch. Every fringe tip meets the floor within the old84% rug rectangle. */
export function floorRugTrimGeometry(){
  const {face,finish}=clothBuilder(),rect=(x0:number,x1:number,z0:number,z1:number,shade:number)=>face([[x0,.021,z0],[x0,.021,z1],[x1,.021,z1],[x1,.021,z0]],shade);
  for(const sign of [-1,1]){
    const x=sign*.35;rect(x-.014,x+.014,-.33,.33,.80);
    for(const [z,width,shade]of [[.22,.025,.78],[.28,.016,.88],[.33,.020,.84]])rect(-.37,.37,sign*z-width*.5,sign*z+width*.5,shade);
    for(let n=0;n<12;n++){
      const x=(n-5.5)*.062,width=.025+.004*Math.sin(n*2.1),end=.408+.012*(.5+.5*Math.sin(n*1.7)),lean=.006*Math.sin(n*2.3);
      const points=[[x-width*.5,.018,sign*.37],[x+width*.5,.018,sign*.37],[x+lean+width*.34,0,sign*end],[x+lean-width*.34,0,sign*end]];face(sign===1?points.reverse():points,.76+.06*(n%3));
    }
  }
  return finish();
}
