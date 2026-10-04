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
        vec2 rearUv = windowUv - slope * vec2(0.70 / 2.43, 0.70 / 1.43);
        vec3 interior = mix(vec3(0.038,0.065,0.080), vec3(0.11,0.16,0.18), clamp(rearUv.y,0.0,1.0));
        float bench = 1.0 - smoothstep(0.15,0.18,rearUv.y);
        interior = mix(interior, vec3(0.10,0.12,0.13), bench);
        // 60% of the original portrait, anchored at the sill. The portrait sits
        // 30cm behind the glass, with the cabin further back for stronger parallax.
        // Keep the cropped lower edge behind the sill, even when viewed from above.
        vec2 portraitShift = vec2(slope.x * 0.30/2.43, clamp(slope.y * 0.30/1.43,-0.03,0.03));
        vec2 childUv = (windowUv - vec2(0.73,-0.035) - portraitShift) / (vec2(0.42,0.92) * 0.60) + vec2(0.5,0.0);
        vec4 child = texture2D(portrait, clamp(childUv, 0.0, 1.0));
        float inside = step(0.0,childUv.x)*step(childUv.x,1.0)*step(0.0,childUv.y)*step(childUv.y,1.0);
        vec3 cabin = mix(interior, child.rgb * illumination, child.a * inside);
        // Glass transmission + Fresnel reflection, composited over the opaque
        // photo/interior in linear space. No additive/transparent portrait ghosting.
        float facing = max(V.z,0.0);
        float fresnel = 0.04 + 0.55 * pow(1.0-facing,3.0);
        vec3 reflected = reflect(-V,vec3(0.0,0.0,1.0));
        float sky = smoothstep(-0.4,0.7,reflected.y);
        vec3 reflection = mix(vec3(0.055,0.11,0.15),vec3(0.32,0.46,0.57),sky);
        // Broad diagonal sky sheen drifts over the glazing as the view changes.
        float band = dot(windowUv,vec2(0.75,0.42)) + reflected.x*0.22 + reflected.y*0.14;
        float sheen = smoothstep(0.23,0.35,band) * (1.0-smoothstep(0.40,0.65,band));
        reflection += vec3(0.14,0.18,0.21)*sheen;
        vec3 H = normalize(V + normalize(vec3(-0.4,0.8,0.7)));
        float highlight = pow(max(H.z,0.0),48.0)*0.32 + pow(max(H.z,0.0),8.0)*0.035;
        vec3 transmitted = cabin * vec3(0.78,0.88,0.94);
        vec3 colour = mix(transmitted,reflection,0.16+fresnel) + vec3(0.66,0.78,0.88)*highlight;
        gl_FragColor = vec4(colour,fade);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
