import {ShaderChunk} from 'three';
import type {MeshStandardMaterial} from 'three';

export type ArchitectureRole='wall'|'volume';
type Palette={base:string;trim:string;shadow:string};
// Retained authored paint colours from TacticalArchitectureMaterials.
const palettes:Record<string,Palette>={
  adobe:{base:'#b49a71',trim:'#cab48e',shadow:'#776448'},
  limewash:{base:'#ded8c5',trim:'#eee6d1',shadow:'#aaa18a'},
  ochre:{base:'#c5a36e',trim:'#e4d3ab',shadow:'#8f754f'},
  stone:{base:'#928f80',trim:'#c5bd9f',shadow:'#5e635c'},
  brick:{base:'#a17258',trim:'#cfb490',shadow:'#6f5140'},
};
export type ArchitectureFinish={role:ArchitectureRole;base:string;texture:string;textureOpacity:number;multiplyOpacity:number};

/** Main walls and solid ornaments use different source texture opacities.
 * This applies only to authored architecture; legacy surfaces and props keep
 * their existing material selection. Geometry UVs remain world metres. */
export function architectureFinish(finish:string,role:ArchitectureRole):ArchitectureFinish|undefined{
  const palette=palettes[finish];if(!palette)return;
  const masonry=finish==='stone'||finish==='brick';
  return {role,base:palette.base,texture:`/art/architecture-${masonry?finish:'plaster'}-v2.png`,textureOpacity:role==='wall'?(masonry?.92:.85):(masonry?.60:.36),multiplyOpacity:role==='wall'?(finish==='adobe'?.48:finish==='ochre'?.34:0):0};
}

/** SVG texture overlays and pigment multiplication occur in encoded sRGB.
 * Decode the resulting paint before ordinary vertex light and PBR lighting.
 * Native lighting supplies the side shade represented by the flat sprite's
 * palette.shadow; baking it a second time would darken the same face twice. */
export function applyArchitectureFinish(material:MeshStandardMaterial,finish:ArchitectureFinish){
  material.userData.architectureFinish={...finish,base:`#${material.color.getHexString()}`};
  material.onBeforeCompile=shader=>{
    const multiply=finish.multiplyOpacity>0?`architectureEncoded *= mix( vec3( 1.0 ), architecturePaint, ${finish.multiplyOpacity.toFixed(2)} );`:'';
    const fragment=ShaderChunk.map_fragment.replace('diffuseColor *= sampledDiffuseColor;',`vec3 architecturePaint = sRGBTransferOETF( vec4( diffuseColor.rgb, 1.0 ) ).rgb;
      vec3 architectureEncoded = mix( architecturePaint, sRGBTransferOETF( sampledDiffuseColor ).rgb, ${finish.textureOpacity.toFixed(2)} );
      ${multiply}
      diffuseColor.rgb = sRGBTransferEOTF( vec4( architectureEncoded, 1.0 ) ).rgb;
      diffuseColor.a *= sampledDiffuseColor.a;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',fragment);
  };
  material.customProgramCacheKey=()=>`architecture-finish:${finish.role}:${finish.textureOpacity.toFixed(2)}:${finish.multiplyOpacity.toFixed(2)}`;
}
