import {AlwaysStencilFunc,ReplaceStencilOp,Color, DoubleSide, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, Texture, TextureLoader} from 'three';
import type {WorldInput,WorldOptions,WorldPoint} from './world-types';

const colours:Record<string,string>={wood:'#76503a',darkwood:'#443227',iron:'#41494b',brass:'#b19650',stone:'#918a76',adobe:'#b49676',limewash:'#d3cbb3',ochre:'#c7ac72',brick:'#a37057',trim:'#e0d2ad',clay:'#9e624d',aged:'#786a59',thatch:'#a18c58',leather:'#4b3b2f',linen:'#c4b99a',water:'#547b78',grass:'#6e754d',leaf:'#45553a',poplar:'#596745',trunk:'#66503c',rubble:'#978772',wax:'#ddcfb1',flame:'#ffbd61',ember:'#aa5233',smoke:'#b8b8ad',rug:'#845547',ceramic:'#ae7951',glass:'#94b8b1',food:'#91805c'};
const texturePaths:Record<string,string>={adobe:'/art/buildings/plaster-v1.webp',limewash:'/art/buildings/plaster-v1.webp',ochre:'/art/buildings/plaster-v1.webp',brick:'/art/architecture-brick-v2.png',stone:'/art/architecture-stone-v2.png',wood:'/art/architecture-wood-v2.png',clay:'/art/architecture-roof-clay-v2.png',aged:'/art/architecture-roof-clay-v2.png',thatch:'/art/architecture-roof-thatch-v2.png'};
// Plane UVs use metres. The clay sheet has eight tile columns and seven
// courses; these repeats give approximately 19 cm widths and 45 cm lengths.
const roofSurfaces:Record<string,{repeat:readonly [number,number];relief:number}>={
  '/art/architecture-roof-clay-v2.png':{repeat:[.65,.32],relief:.035},
  '/art/architecture-roof-thatch-v2.png':{repeat:[.75,.50],relief:.025},
};
const colourTextures=new Set(['/art/architecture-wood-v2.png','/art/architecture-brick-v2.png','/art/architecture-stone-v2.png',...Object.keys(roofSurfaces)]);
const textureRelief:Record<string,number>={'/art/architecture-wood-v2.png':.006,'/art/buildings/plaster-v1.webp':.012};
const masonryKinds=new Set(['adobe','limewash','ochre','brick','stone']);
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
    const opacity=options.opacity??1,metal=['iron','brass'].includes(kind),path=options.texture??texturePaths[kind],roofSurface=roofSurfaces[path];
    const material=new MeshStandardMaterial({name:`world:${kind}`,color:options.colour??(colourTextures.has(path)?'#ffffff':colours[kind]??'#91836b'),roughness:metal ? .48 : .94,metalness:metal ? .68 : 0,vertexColors:true,transparent:opacity<1,opacity,depthWrite:opacity>=1,side:DoubleSide});
    // The retained sprite texture already contains a muted plaster pigment.
    // Compensate that base so the finish tint does not darken it twice.
    if(path==='/art/buildings/plaster-v1.webp')material.color.multiplyScalar(1.65);
    material.userData.metricBoxUV=masonryKinds.has(kind);
    if(opacity>=1){material.stencilWrite=true;material.stencilRef=1;material.stencilFunc=AlwaysStencilFunc;material.stencilZPass=ReplaceStencilOp;}
    if(kind==='water'){material.roughness=.35;material.metalness=.12;}
    if(options.emissive){material.emissive=new Color(options.colour??colours[kind]??'#f0ac50');material.emissiveIntensity=1.3;}
    if(path&&typeof document!=='undefined'){
      let texture=this.textures.get(path);
      if(!texture){
        this.pending++;
        texture=new TextureLoader().load(this.options.assetUrl(path),()=>{this.pending--;if(this.disposed)texture?.dispose();},undefined,error=>{this.pending--;const message=`Cannot load world texture ${path}: ${String(error)}`;this.errors.push(message);this.options.onAssetError?.(new Error(message));});
        texture.colorSpace=SRGBColorSpace;texture.wrapS=RepeatWrapping;texture.wrapT=RepeatWrapping;texture.anisotropy=4;this.textures.set(path,texture);
        if(roofSurface)texture.repeat.set(...roofSurface.repeat);
        else if(path==='/art/buildings/plaster-v1.webp')texture.repeat.set(.25,.25);
      }
      material.map=texture;
      const relief=roofSurface?.relief??textureRelief[path];if(relief){material.bumpMap=texture;material.bumpScale=relief;}
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
