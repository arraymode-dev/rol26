import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// A separate depth-only view of ghost buildings lets rings recede behind them
// without making the buildings opaque to the artworks in the main render.
export const GHOST_DEPTH_LAYER = 2;
const DepthContext = createContext<{
  target: THREE.WebGLRenderTarget;
  size: THREE.Vector2;
} | null>(null);
export function BoundaryDepth({
  children,
  active,
  lowQuality,
}: {
  children: ReactNode;
  active: boolean;
  lowQuality: boolean;
}) {
  const cleared = useRef(false);
  const state = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(1, 1);
    target.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
    const material = new THREE.MeshDepthMaterial();
    return { target, material, size: new THREE.Vector2() };
  }, []);
  useEffect(
    () => () => {
      state.target.depthTexture?.dispose();
      state.target.dispose();
      state.material.dispose();
    },
    [state],
  );
  useFrame(({ gl, scene, camera }) => {
    gl.getDrawingBufferSize(state.size);
    const scale = lowQuality ? 0.5 : 1;
    const width = active ? Math.max(1, Math.floor(state.size.x * scale)) : 1;
    const height = active ? Math.max(1, Math.floor(state.size.y * scale)) : 1;
    if (state.target.width !== width || state.target.height !== height) {
      state.target.setSize(width, height);
      cleared.current = false;
    }
    // No ghost buildings in overview: keep an empty depth texel instead of
    // traversing and rendering another scene pass on every frame.
    if (!active && cleared.current) {
      gl.render(scene, camera);
      return;
    }
    const target = gl.getRenderTarget(),
      mask = camera.layers.mask,
      background = scene.background,
      override = scene.overrideMaterial,
      shadows = gl.shadowMap.enabled,
      autoClear = gl.autoClear;
    try {
      camera.layers.set(GHOST_DEPTH_LAYER);
      scene.background = null;
      scene.overrideMaterial = state.material;
      gl.shadowMap.enabled = false;
      gl.autoClear = true;
      gl.setRenderTarget(state.target);
      gl.clear();
      if (active) gl.render(scene, camera);
      cleared.current = !active;
    } finally {
      camera.layers.mask = mask;
      scene.background = background;
      scene.overrideMaterial = override;
      gl.shadowMap.enabled = shadows;
      gl.autoClear = autoClear;
      gl.setRenderTarget(target);
    }
    gl.render(scene, camera);
  }, 1);
  return (
    <DepthContext.Provider value={state}>{children}</DepthContext.Provider>
  );
}

export function BoundaryMaterial({
  color,
  opacity,
  radial = false,
  beam = false,
  spillColor = color,
  spillSecondary = spillColor,
}: {
  color: string;
  opacity: number;
  radial?: boolean;
  beam?: boolean;
  spillColor?: string;
  spillSecondary?: string;
}) {
  const state = useContext(DepthContext)!;
  const uniforms = useMemo(
    () => ({
      ghostDepth: { value: state.target.depthTexture },
      viewport: { value: state.size },
      tint: { value: new THREE.Color(color) },
      spillTint: { value: new THREE.Color(spillColor) },
      spillOther: { value: new THREE.Color(spillSecondary) },
      alpha: { value: opacity },
      radial: { value: radial ? 1 : 0 },
      beam: { value: beam ? 1 : 0 },
    }),
    [state, color, opacity, radial, beam, spillColor, spillSecondary],
  );
  return (
    <shaderMaterial
      transparent
      depthTest
      depthWrite={false}
      uniforms={uniforms}
      vertexShader={`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      uniform float beam;
      varying vec2 boundaryUV;
      varying float areaDetail;
      varying float overview;
      varying float beamStrength;
      void main() {
        boundaryUV = uv;
        vec3 centre = (modelMatrix * vec4(0.0, -90.0 * beam, 0.0, 1.0)).xyz;
        float cameraDistance = distance(cameraPosition, centre);
        areaDetail = 1.0 - smoothstep(190.0, 500.0, cameraDistance);
        overview = smoothstep(280.0, 650.0, cameraDistance);
        float distant = smoothstep(650.0, 2300.0, cameraDistance);
        beamStrength = mix(1.0, 1.3, distant);
        vec3 elevated = position;
        // Stretch from the ground, keeping the radius and floor anchor fixed.
        elevated.y += beam * (position.y + 90.0) * distant;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(elevated, 1.0);
        #include <logdepthbuf_vertex>
      }`}
      fragmentShader={`
      #include <logdepthbuf_pars_fragment>
      uniform sampler2D ghostDepth;
      uniform vec2 viewport;
      uniform vec3 tint;
      uniform vec3 spillTint;
      uniform vec3 spillOther;
      uniform float alpha;
      uniform float radial;
      uniform float beam;
      varying vec2 boundaryUV;
      varying float areaDetail;
      varying float overview;
      varying float beamStrength;
      void main() {
        #include <logdepthbuf_fragment>
        float front = texture2D(ghostDepth, gl_FragCoord.xy / viewport).r;
        float depth = gl_FragCoord.z;
        #ifdef USE_LOGARITHMIC_DEPTH_BUFFER
          depth = gl_FragDepth;
        #endif
        float behind = step(front + 0.000005, depth);
        float gradient = pow(max(0.0, 1.0 - length(boundaryUV - 0.5) * 2.0), 1.6);
        float fill = mix(1.0, gradient * areaDetail, radial);
        // The cylinder retains the ground circle's radius; only its light
        // intensity tapers away. No top cap or hard cutoff at overview zoom.
        float column = pow(1.0 - boundaryUV.y, 1.8) * overview * beamStrength;
        fill = mix(fill, column, beam);
        float spill = (1.0 - smoothstep(0.0, 0.48, boundaryUV.y)) * beam;
        float around = 0.5 + 0.5 * sin(boundaryUV.x * 6.2831853);
        vec3 baseColour = mix(spillTint, spillOther, around * 0.42);
        vec3 columnTint = mix(tint, baseColour, spill * 0.82);
        gl_FragColor = vec4(columnTint, alpha * fill * mix(1.0, 0.22, behind));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`}
    />
  );
}
