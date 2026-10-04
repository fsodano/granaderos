import {AlwaysStencilFunc,ReplaceStencilOp,Color, DoubleSide, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, Texture, TextureLoader} from 'three';
import type {WorldInput,WorldOptions,WorldPoint} from './world-types';

const colours:Record<string,string>={wood:'#76503a',darkwood:'#443227',iron:'#41494b',brass:'#b19650',stone:'#918a76',adobe:'#b49676',limewash:'#d3cbb3',ochre:'#c7ac72',brick:'#a37057',trim:'#e0d2ad',clay:'#9e624d',aged:'#786a59',thatch:'#a18c58',leather:'#4b3b2f',linen:'#c4b99a',water:'#547b78',grass:'#6e754d',leaf:'#45553a',poplar:'#596745',trunk:'#66503c',rubble:'#978772',wax:'#ddcfb1',flame:'#ffbd61',ember:'#aa5233',smoke:'#b8b8ad',rug:'#845547',ceramic:'#ae7951',glass:'#94b8b1',food:'#91805c'};
const texturePaths:Record<string,string>={adobe:'/art/architecture-plaster-v2.png',limewash:'/art/architecture-plaster-v2.png',ochre:'/art/architecture-plaster-v2.png',brick:'/art/architecture-brick-v2.png',stone:'/art/architecture-stone-v2.png',wood:'/art/architecture-wood-v2.png',clay:'/art/architecture-roof-clay-v2.png',aged:'/art/architecture-roof-clay-v2.png',thatch:'/art/architecture-roof-thatch-v2.png'};
export class WorldMaterials {
  private materials=new Map<string,MeshStandardMaterial>();
  private textures=new Map<string,Texture>();
  pending=0;
  errors:string[]=[];
  private disposed=false;
  constructor(private options:WorldOptions){}
  get(kind:string,options:{colour?:string;opacity?:number;emissive?:boolean;texture?:string}={}){
    const key=JSON.stringify([kind,options]);
    const retained=this.materials.get(key);if(retained)return retained;
    const opacity=options.opacity??1,metal=['iron','brass'].includes(kind);
    const material=new MeshStandardMaterial({name:`world:${kind}`,color:options.colour??colours[kind]??'#91836b',roughness:metal ? .48 : .94,metalness:metal ? .68 : 0,vertexColors:true,transparent:opacity<1,opacity,depthWrite:opacity>=1,side:DoubleSide});
    if(opacity>=1){material.stencilWrite=true;material.stencilRef=1;material.stencilFunc=AlwaysStencilFunc;material.stencilZPass=ReplaceStencilOp;}
    if(kind==='water'){material.roughness=.35;material.metalness=.12;}
    if(options.emissive){material.emissive=new Color(options.colour??colours[kind]??'#f0ac50');material.emissiveIntensity=1.3;}
    const path=options.texture??texturePaths[kind];
    if(path&&typeof document!=='undefined'){
      let texture=this.textures.get(path);
      if(!texture){
        this.pending++;
        texture=new TextureLoader().load(this.options.assetUrl(path),()=>{this.pending--;if(this.disposed)texture?.dispose();},undefined,error=>{this.pending--;const message=`Cannot load world texture ${path}: ${String(error)}`;this.errors.push(message);this.options.onAssetError?.(new Error(message));});
        texture.colorSpace=SRGBColorSpace;texture.wrapS=RepeatWrapping;texture.wrapT=RepeatWrapping;texture.anisotropy=4;this.textures.set(path,texture);
      }
      material.map=texture;
    }
    this.materials.set(key,material);return material;
  }
  terrain(material:string){return this.get(`terrain-${material}`,{colour:'#ffffff',texture:`/art/terrain-${material}-v1.webp`});}
  dispose(){if(this.disposed)return;this.disposed=true;for(const material of this.materials.values())material.dispose();for(const texture of this.textures.values())texture.dispose();this.materials.clear();this.textures.clear();}
}
export const worldKey=(p:WorldPoint)=>`${p.tacticalLevel??0}:${p.x},${p.y}`;
export function illuminationAt(input:WorldInput,p:WorldPoint){
  if(!input.terrain.night)return 1;
  const key=worldKey(p),source=input.illumination;
  const value=source instanceof Map?source.get(key):(source as Readonly<Record<string,number>>|undefined)?.[key];
  return .27+.73*Math.max(0,Math.min(1,value??.08));
}
