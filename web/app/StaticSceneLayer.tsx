'use client';
import {memo,useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {rasterizeSvgGroup} from '../lib/rasterize-svg';
import {sameStaticSceneProps} from '../lib/static-scene-content';
type Picture=NonNullable<Awaited<ReturnType<typeof rasterizeSvgGroup>>>;
/** Preserve depth order: each static layer remains between the same actors. */
function StaticSceneLayer({children}:{children:ReactNode}){
 const source=useRef<SVGGElement>(null);
 const retained=useRef<{markup:string;image:Picture}|null>(null);
 const [picture,setPicture]=useState<{source:ReactNode;image:Picture}|null>(null);
 useEffect(()=>()=>{retained.current?.image.release();retained.current=null;},[]);
 useLayoutEffect(()=>{
  const node=source.current;if(!node)return;
  const markup=node.innerHTML;
  if(retained.current?.markup===markup){setPicture({source:children,image:retained.current.image});return;}
  const controller=new AbortController();
  void rasterizeSvgGroup(node,controller.signal).then(image=>{
   if(!image)return;
   if(controller.signal.aborted){image.release();return;}
   retained.current?.image.release();
   retained.current={markup,image};setPicture({source:children,image});
  }).catch(()=>{/* Keep the original SVG if a texture or browser rasterizer fails. */});
  return()=>controller.abort();
 },[children]);
 // Camera zoom scales this native-density image without replacing its texture.
 const ready=picture&&picture.source===children;
 return <g data-static-layer={ready?'cached':'vector'} pointerEvents="none">{!ready&&<g ref={source}>{children}</g>}{ready&&<image {...picture.image.image}/>}</g>;
}
export default memo(StaticSceneLayer,sameStaticSceneProps);
