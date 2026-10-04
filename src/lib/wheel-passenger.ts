import * as T from "three";

// Randomly chosen once during authoring, so the discovery stays in the same car.
export const PASSENGER_CABIN = 3;
export const PASSENGER_WINDOW = {
  position: [-0.758, -0.75, 0] as [number, number, number],
  rotation: -Math.PI / 2,
  width: 2.43,
  height: 1.43,
};
export function passengerVisible(
  distance: number,
  highQuality: boolean,
  inView: boolean,
) {
  return highQuality && inView && distance < 55;
}
export function passengerFade(distance: number) {
  const t = T.MathUtils.clamp((distance - 35) / 20, 0, 1);
  return 1 - t * t * (3 - 2 * t);
}

/** One photo sample, a procedural interior and analytic glass in a single quad.
 * Straight-alpha photo compositing happens in linear space before glass shading;
 * normal blending is used only for the distance fade, never additive photo blending. */
export function passengerMaterial(texture: T.Texture, night: boolean) {
  return new T.ShaderMaterial({
    uniforms: {
      portrait: { value: texture },
      fade: { value: 0 },
      illumination: { value: night ? 0.72 : 1.0 },
    },
    transparent: true,
    blending: T.NormalBlending,
    premultipliedAlpha: false,
    depthWrite: false,
    depthTest: true,
    side: T.FrontSide,
    vertexShader: `
      varying vec2 windowUv;
      varying vec3 eyeLocal;
      void main() {
        windowUv = uv;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vec3 eye = cameraPosition - world.xyz;
        // Orthonormal, unscaled window axes; UV depth offsets are in metres.
        eyeLocal = vec3(dot(eye, normalize(modelMatrix[0].xyz)),
                        dot(eye, normalize(modelMatrix[1].xyz)),
                        dot(eye, normalize(modelMatrix[2].xyz)));
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `
      uniform sampler2D portrait;
      uniform float fade;
      uniform float illumination;
      varying vec2 windowUv;
      varying vec3 eyeLocal;
      void main() {
        vec3 V = normalize(eyeLocal);
        // Clamp grazing views: two depth layers, no raymarch or depth texture.
        vec2 slope = clamp(V.xy / max(V.z, 0.3), vec2(-1.5), vec2(1.5));
        vec2 rearUv = windowUv - slope * vec2(0.28 / 2.43, 0.28 / 1.43);
        vec3 interior = mix(vec3(0.038,0.065,0.080), vec3(0.11,0.16,0.18), clamp(rearUv.y,0.0,1.0));
        float bench = 1.0 - smoothstep(0.15,0.18,rearUv.y);
        interior = mix(interior, vec3(0.10,0.12,0.13), bench);
        // Child sits in one pane, clear of the centre mullion, just behind glass.
        vec2 childUv = (windowUv - vec2(0.73,0.0) - slope * vec2(0.075/2.43,0.075/1.43)) / vec2(0.42,0.92) + vec2(0.5,0.0);
        vec4 child = texture2D(portrait, clamp(childUv, 0.0, 1.0));
        float inside = step(0.0,childUv.x)*step(childUv.x,1.0)*step(0.0,childUv.y)*step(childUv.y,1.0);
        vec3 cabin = mix(interior, child.rgb * illumination, child.a * inside);
        float fresnel = 0.04 + 0.35 * pow(1.0-max(V.z,0.0),5.0);
        vec3 glass = vec3(0.18,0.30,0.38);
        vec3 H = normalize(V + normalize(vec3(-0.4,0.8,0.7)));
        float highlight = pow(max(H.z,0.0),72.0) * 0.22;
        vec3 colour = mix(cabin,glass,0.10+fresnel) + vec3(0.66,0.78,0.88)*highlight;
        gl_FragColor = vec4(colour,fade);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
