'use client';
import {memo,useEffect,useState,type SVGProps} from 'react';
import {shadedSceneryImage} from '../lib/rasterize-svg';

function SceneryImage({href,brightness=1,...props}:SVGProps<SVGImageElement>&{href:string;brightness?:number}){
 const [prepared,setPrepared]=useState<{href:string;brightness:number;image:string}|null>(null);
 useEffect(()=>{
  if(brightness===1)return;
  let cancelled=false;
  shadedSceneryImage(href,brightness).then(image=>{if(!cancelled)setPrepared({href,brightness,image});}).catch(()=>{/* Retain the exact live filter when conversion is unavailable. */});
  return()=>{cancelled=true;};
 },[href,brightness]);
 const ready=prepared?.href===href&&prepared.brightness===brightness;
 return <image {...props} href={ready?prepared.image:href} style={brightness===1||ready?props.style:{...props.style,filter:`brightness(${brightness})`}}/>;
}

export default memo(SceneryImage);
