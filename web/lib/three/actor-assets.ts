import {AnimationClip,Material,Mesh,Texture} from 'three';
import type {AnimationMirroring} from './clip-mirroring';
import {GLTFLoader,type GLTF} from 'three/addons/loaders/GLTFLoader.js';
export type SocketSpec={node:string;bone?:string;position?:number[];rotation?:number[];scale?:number;mirror?:{socket:string;localAxis:'x'|'y'|'z'}};
export type ClipSpec={name:string;semantic?:string;gesture?:string;freeHands?:('handRight'|'handLeft')[];handProps?:{hand:'handRight'|'handLeft';categories:string[];untilMarker?:string}[];duration?:number;durationSeconds?:number;loop:boolean;seatAnchor?:number[];seatWeight?:{time:number;weight:number}[];propCues?:{item:string;socket:string;start:number;end:number}[];markers?:Record<string,number>;locomotionSpeed?:number};
export type AppearanceSpec={id:string;gender:string;height:number;animationLibrary:string;lods:{lod:number;url:string;triangles:number;bytes?:number}[];parts?:Record<string,string>;lodPixelThresholds?:number[];materials?:Record<string,string>;sockets?:Record<string,SocketSpec>};
export type EquipmentSpec={node:string;category?:string;socket?:string;grip?:string;position?:number[];rotation?:number[];scale?:number;stowedSocket?:string;muzzle?:string;clipOverrides?:Record<string,string>};
export type CharacterManifest={version:number;animationMirroring?:AnimationMirroring;appearances:Record<string,AppearanceSpec>|AppearanceSpec[];bones:Record<string,string>;rig?:{bones?:Record<string,string>;sockets?:Record<string,SocketSpec>};sockets?:Record<string,SocketSpec>;skinTones?:Record<string,string>;animationLibraries:Record<string,{url:string;clips:ClipSpec[]}>;equipment:{url:string;items:Record<string,EquipmentSpec>;aliases?:Record<string,string>;fittings?:Record<string,EquipmentSpec>};garments?:Record<string,{url:string;items:Record<string,{node:string;slot:string;hideAppearanceParts:string[]}>}>;horse?:{lods:{lod:number;url:string}[];saddle?:{node:string;position:number[]};actions?:Record<string,string>;clips?:ClipSpec[]}};
export function appearanceById(manifest:CharacterManifest,id:string){return Array.isArray(manifest.appearances)?manifest.appearances.find(entry=>entry.id===id):manifest.appearances[id];}
export type LoadedActor={manifest:CharacterManifest;appearance:AppearanceSpec;body:GLTF;animation:GLTF;clips:ClipSpec[];equipment:GLTF;garments?:GLTF;horse?:GLTF;lod:number};
/** Assets are loaded once per scene; actors clone skeletons, not meshes/textures. */
export class ActorAssetLibrary {
  private loader=new GLTFLoader();private loads=new Map<string,Promise<GLTF>>();private manifestPromise:Promise<CharacterManifest>|null=null;private released=false;
  constructor(private assetUrl:(path:string)=>string,private manifestPath='/models/characters/manifest.json'){}
  manifest(){return this.manifestPromise??=fetch(this.assetUrl(this.manifestPath)).then(response=>{if(!response.ok)throw Error(`Character manifest: ${response.status}`);return response.json();});}
  private load(url:string){
    let load=this.loads.get(url);if(!load){load=this.loader.loadAsync(this.assetUrl(url)).then(gltf=>{if(this.released)this.disposeGltf(gltf);return gltf;});this.loads.set(url,load);}return load;
  }
  async actor(id:string,lod:number,mounted=false):Promise<LoadedActor>{
    const manifest=await this.manifest(),appearance=appearanceById(manifest,id);if(!appearance)throw Error(`Missing character appearance: ${id}`);
    const level=appearance.lods.find(level=>level.lod===lod)??appearance.lods.at(-1)!;
    const library=manifest.animationLibraries[appearance.animationLibrary];if(!library)throw Error(`Missing animation library: ${appearance.animationLibrary}`);
    const garment=manifest.garments?.[appearance.gender],horse=mounted?manifest.horse?.lods.find(item=>item.lod===lod)??manifest.horse?.lods.at(-1):undefined;
    const [body,animation,equipment,garments,horseFile]=await Promise.all([this.load(level.url),this.load(library.url),this.load(manifest.equipment.url),garment?this.load(garment.url):undefined,horse?this.load(horse.url):undefined]);
    return {manifest,appearance,body,animation,clips:library.clips,equipment,garments,horse:horseFile,lod:level.lod};
  }
  private disposedGeometry=new Set<unknown>();private disposedMaterial=new Set<Material>();private disposedTexture=new Set<Texture>();
  private disposeGltf(gltf:GLTF){gltf.scene.traverse(object=>{if(!(object instanceof Mesh))return;if(!this.disposedGeometry.has(object.geometry)){this.disposedGeometry.add(object.geometry);object.geometry.dispose();}for(const material of Array.isArray(object.material)?object.material:[object.material]){if(this.disposedMaterial.has(material))continue;this.disposedMaterial.add(material);for(const value of Object.values(material))if(value instanceof Texture&&!this.disposedTexture.has(value)){this.disposedTexture.add(value);value.dispose();}material.dispose();}});}
  dispose(){if(this.released)return;this.released=true;for(const promise of this.loads.values())void promise.then(gltf=>this.disposeGltf(gltf),()=>{});this.loads.clear();}
}
/** A semantic key can refer to a renamed clip in a replacement model. */
export function boundClip(specs:readonly ClipSpec[],clips:readonly AnimationClip[],semantic:string){
  const spec=specs.find(entry=>entry.semantic===semantic||entry.name===semantic);
  if(!spec)throw Error(`Missing animation capability: ${semantic}`);
  const clip=clips.find(entry=>entry.name===spec.name);if(!clip)throw Error(`Missing animation data: ${spec.name}`);
  return {spec,clip};
}
