import {AlwaysStencilFunc,BackSide,Material,Mesh,MeshBasicMaterial,MeshPhysicalMaterial,MeshStandardMaterial,Object3D,ReplaceStencilOp,Vector2,Vector4} from 'three';

/** Keep the authored pigment and folds, but give native actors the restrained
 * highlights and dark contours of the retained illustrated sprite library.
 * The separate silhouette pass below supplies the visible outer ink contour. */
export function illustrateActorMaterial(material:MeshStandardMaterial){
  material.roughness=1;
  material.roughnessMap=null;
  material.metalness=0;
  material.metalnessMap=null;
  material.normalScale.multiplyScalar(.4);
  if(material instanceof MeshPhysicalMaterial){material.specularIntensity=.12;material.clearcoat=0;material.sheen=0;}
  material.userData.actorIllustration=true;
  material.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <shadowmap_pars_fragment>', '#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>');
    shader.fragmentShader=shader.fragmentShader.replace(
      'vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;',
      `// Broad painted light regions keep the scene's light colours and shadows.
      // The source textures and vertex colours supply the small cloth details.
      vec3 actorPaintLight = ambientLightColor * RECIPROCAL_PI;
      #if NUM_HEMI_LIGHTS > 0
        for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
          actorPaintLight += mix( hemisphereLights[i].groundColor, hemisphereLights[i].skyColor, 0.7 ) * RECIPROCAL_PI;
        }
      #endif
      #if NUM_DIR_LIGHTS > 0
        float actorShadow = getShadowMask();
        for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
          float actorKey = dot( nonPerturbedNormal, directionalLights[i].direction );
          float actorShade = mix( 0.24, 0.86, smoothstep( 0.02, 0.18, actorKey ) );
          actorPaintLight += directionalLights[i].color * actorShade * actorShadow * RECIPROCAL_PI;
        }
      #endif
      vec3 actorPigment = mix( totalDiffuse, diffuseColor.rgb * actorPaintLight, 0.88 );
      // A dark inner contour reads like ink without expanding the body or
      // changing which world pixels cover it.
      float actorContour = mix( 0.10, 1.0, smoothstep( 0.02, 0.42, abs( dot( nonPerturbedNormal, geometryViewDir ) ) ) );
      vec3 outgoingLight = ( actorPigment + totalSpecular * 0.06 ) * actorContour + totalEmissiveRadiance;`
    );
  };
  material.customProgramCacheKey=()=> 'actor-illustration-v1';
}

/** An actor owns its copies. Shared GLTF materials, maps and other actors are
 * untouched, including when a skin palette or an equipped item changes. */
export class ActorIllustration {
  private copies=new Map<Material,Material>();
  private outline:MeshBasicMaterial;
  private cutoutOutlines=new Map<Material,MeshBasicMaterial>();
  private outlined=new WeakSet<Mesh>();
  private outlinePixels={value:new Vector2()};
  private viewport=new Vector4();
  constructor(private owned:Set<Material>){
    this.outline=new MeshBasicMaterial({name:'actor-ink-contour',color:'#171910',side:BackSide,toneMapped:false,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1,stencilWrite:true,stencilRef:0,stencilFunc:AlwaysStencilFunc,stencilZPass:ReplaceStencilOp});
    this.owned.add(this.outline);
    this.outline.onBeforeCompile=shader=>{
      shader.uniforms.actorOutlinePixels=this.outlinePixels;
      shader.vertexShader=shader.vertexShader
        .replace('#include <common>','#include <common>\nuniform vec2 actorOutlinePixels;')
        .replace('#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )','#if 1')
        .replace('#include <project_vertex>',`#include <project_vertex>
          vec2 actorOutlineNormal = ( normalMatrix * objectNormal ).xy;
          gl_Position.xy += actorOutlineNormal / max( length( actorOutlineNormal ), 0.0001 ) * actorOutlinePixels * gl_Position.w;`);
    };
    this.outline.customProgramCacheKey=()=> 'actor-ink-contour-v1';
  }
  private outlineFor(source:Material){
    if(!(source instanceof MeshStandardMaterial||source instanceof MeshBasicMaterial)||!source.alphaTest&&!source.alphaMap&&!source.transparent)return this.outline;
    let outline=this.cutoutOutlines.get(source);
    if(!outline){
      outline=this.outline.clone();outline.map=source.map;outline.alphaMap=source.alphaMap;outline.alphaTest=source.alphaTest;outline.opacity=source.opacity;outline.transparent=source.transparent;outline.depthWrite=source.depthWrite;
      outline.onBeforeCompile=this.outline.onBeforeCompile;outline.customProgramCacheKey=this.outline.customProgramCacheKey;
      this.cutoutOutlines.set(source,outline);this.owned.add(outline);
    }
    return outline;
  }
  apply(root:Object3D){
    root.traverse(node=>{
      if(!(node instanceof Mesh)||node.userData.occlusionOverlay)return;
      const copy=(source:Material)=>{
        if(!(source instanceof MeshStandardMaterial)||this.owned.has(source))return source;
        let material=this.copies.get(source);
        if(!material){material=source.clone();illustrateActorMaterial(material as MeshStandardMaterial);this.copies.set(source,material);this.owned.add(material);}
        return material;
      };
      node.material=Array.isArray(node.material)?node.material.map(copy):copy(node.material);
      if(this.outlined.has(node))return;
      this.outlined.add(node);
      const previous=node.onAfterRender;
      node.onAfterRender=(renderer,scene,camera,geometry,material,group)=>{
        previous.call(node,renderer,scene,camera,geometry,material,group);
        if(!material.colorWrite||material.opacity<=0||!(Array.isArray(node.material)?node.material.includes(material):node.material===material))return;
        renderer.getViewport(this.viewport);this.outlinePixels.value.set(2.3/Math.max(1,this.viewport.z),2.3/Math.max(1,this.viewport.w));
        // This low-level draw does not call object render callbacks. Use the
        // admitted material group and the original skinned/morphed object.
        // No shell enters contact fitting, worker snapshots, or shadow passes.
        renderer.renderBufferDirect(camera,scene,geometry,this.outlineFor(material),node,group as unknown as Parameters<typeof renderer.renderBufferDirect>[5]);
      };
    });
  }
}
