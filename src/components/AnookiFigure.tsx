import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Photo-informed inflated fabric forms. The shell stays opaque for correct
// column occlusion; thickness-based diffusion approximates subsurface transport.
function shellMaterial(night: boolean, thickness: number, colour = "#f2f2e8") {
  const material = new THREE.MeshPhysicalMaterial({
    color: colour,
    roughness: 0.64,
    metalness: 0,
    sheen: 0.32,
    sheenColor: new THREE.Color("#fff8dc"),
    sheenRoughness: 0.8,
    emissive: "#fff3cf",
    emissiveIntensity: night ? 0.3 : 0,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.shellThickness = { value: thickness };
    shader.uniforms.innerLight = { value: night ? 1.25 : 0.008 };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `
      #include <common>
      uniform float shellThickness;
      uniform float innerLight;
    `,
      )
      .replace(
        "#include <lights_physical_pars_fragment>",
        `
        #include <lights_physical_pars_fragment>
        void RE_Direct_Anooki(const in IncidentLight directLight, const in vec3 geometryPosition,
          const in vec3 geometryNormal, const in vec3 geometryViewDir,
          const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material,
          inout ReflectedLight reflectedLight) {
          RE_Direct_Physical(directLight, geometryPosition, geometryNormal, geometryViewDir,
            geometryClearcoatNormal, material, reflectedLight);
          // Shadowed incident light also diffuses through the thin fabric.
          float wrap = clamp((dot(geometryNormal, directLight.direction) + 0.5) / 1.5, 0.0, 1.0);
          float backlight = pow(max(0.0, dot(geometryViewDir,
            -normalize(directLight.direction + geometryNormal * 0.35))), 3.0);
          reflectedLight.directDiffuse += directLight.color * material.diffuseColor *
            exp(-shellThickness) * (wrap * 0.09 + backlight * 0.3);
        }
        #undef RE_Direct
        #define RE_Direct RE_Direct_Anooki
      `,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `
      #include <emissivemap_fragment>
      // A longer path through the shell at grazing angles gently darkens the
      // silhouette. Thin hood trim transmits more of the warm internal source.
      float facing = abs(dot(normalize(normal), normalize(vViewPosition)));
      float opticalDepth = shellThickness / max(0.38, sqrt(facing));
      vec3 diffusion = exp(-vec3(0.75, 0.9, 1.15) * opticalDepth);
      totalEmissiveRadiance += diffusion * vec3(1.0, 0.96, 0.85) * innerLight;
    `,
      );
  };
  material.customProgramCacheKey = () =>
    `anooki-diffusion-${night}-${thickness}`;
  return material;
}
function hoodGeometry() {
  const profile = new THREE.SplineCurve([
    new THREE.Vector2(0, -1.52),
    new THREE.Vector2(1.35, -1.26),
    new THREE.Vector2(2.15, -0.65),
    new THREE.Vector2(2.36, 0.2),
    new THREE.Vector2(2.2, 1.04),
    new THREE.Vector2(1.87, 1.57),
    new THREE.Vector2(1.62, 1.65),
  ]);
  const geometry = new THREE.LatheGeometry(profile.getPoints(40), 64);
  geometry.rotateX(Math.PI / 2);
  return geometry;
}
function hoodTrim() {
  const points = Array.from({ length: 161 }, (_, i) => {
    const a = (i / 160) * Math.PI * 2;
    const r = 1.72 + 0.115 * Math.cos(a * 14);
    return new THREE.Vector3(
      Math.cos(a) * r,
      Math.sin(a) * r,
      1.66 + 0.04 * Math.cos(a * 14),
    );
  });
  return new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(points, true),
    160,
    0.13,
    8,
    true,
  );
}
function fringeGeometry(side: number) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 1.53);
  shape.bezierCurveTo(side * 0.2, 1.64, side * 0.97, 1.43, side * 1.43, 0.75);
  shape.bezierCurveTo(side * 0.72, 0.76, side * 0.22, 1.12, 0, 1.53);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 0.07,
    bevelEnabled: true,
    bevelSize: 0.06,
    bevelThickness: 0.045,
    bevelSegments: 3,
    curveSegments: 20,
  });
  g.translate(0, 0, 1.62);
  return g;
}
export function AnookiFigure({
  side,
  night,
  flight,
}: {
  side: number;
  night: boolean;
  flight: RefObject<{ progress: number }>;
}) {
  const spill = useRef<THREE.PointLight>(null);
  const sleeve = useRef<THREE.Mesh>(null);
  const farArm = useRef<THREE.Group>(null);
  const arm = useRef<THREE.Group>(null),
    boot = useRef<THREE.Group>(null);
  const forms = useMemo(
    () => ({
      sphere: new THREE.SphereGeometry(1, 40, 28),
      hood: hoodGeometry(),
      trim: hoodTrim(),
      goggles: new THREE.TorusGeometry(0.49, 0.115, 12, 40),
      hair: [fringeGeometry(-1), fringeGeometry(1)],
    }),
    [],
  );
  const materials = useMemo(
    () => ({
      shell: shellMaterial(night, 0.65),
      rim: shellMaterial(night, 0.2, "#f5f4ec"),
      face: shellMaterial(night, 0.95, "#cddbdc"),
      hair: shellMaterial(night, 1.4, "#b8c8cc"),
      sole: shellMaterial(night, 1.1, "#d7dfdc"),
      eye: new THREE.MeshPhysicalMaterial({
        color: "#0c171b",
        roughness: 0.34,
        clearcoat: 0.15,
      }),
    }),
    [night],
  );
  useEffect(
    () => () => {
      Object.values(forms)
        .flat()
        .forEach((g) => g.dispose());
    },
    [forms],
  );
  useEffect(
    () => () => Object.values(materials).forEach((m) => m.dispose()),
    [materials],
  );
  useFrame(() => {
    const lift = flight.current.progress;
    if (spill.current) {
      spill.current.intensity = night ? 15 * (1 - lift) : 0;
      spill.current.visible = night && lift < 0.95;
    }
    if (sleeve.current) {
      sleeve.current.visible = lift < 0.98;
      sleeve.current.scale.z = Math.max(0.01, 1.3 * (1 - lift));
    }

    if (arm.current) {
      arm.current.position.x = side * THREE.MathUtils.lerp(0.5, -0.3, lift);
      arm.current.rotation.z = side * THREE.MathUtils.lerp(0.42, 1.18, lift);
      arm.current.position.z = THREE.MathUtils.lerp(3.5, 0.5, lift);
      arm.current.scale.setScalar(THREE.MathUtils.lerp(0.8, 1, lift));
    }
    if (farArm.current) {
      farArm.current.position.x = side * THREE.MathUtils.lerp(1.8, 2.6, lift);
      farArm.current.rotation.z =
        -side * THREE.MathUtils.lerp(0.12, 1.18, lift);
      farArm.current.scale.setScalar(THREE.MathUtils.lerp(0.75, 1, lift));
    }
    if (boot.current)
      boot.current.rotation.z = side * THREE.MathUtils.lerp(-0.45, 0.35, lift);
  });
  const ellipsoid = (
    position: [number, number, number],
    scale: [number, number, number],
    material = materials.shell,
  ) => (
    <mesh
      geometry={forms.sphere}
      material={material}
      position={position}
      scale={scale}
      castShadow
      receiveShadow
    />
  );
  return (
    <group>
      <pointLight
        ref={spill}
        position={[side * 1.8, 2, 3.6]}
        color="#fff2d7"
        intensity={night ? 15 : 0}
        distance={11}
        decay={2}
        castShadow
        shadow-mapSize={[256, 256]}
        shadow-camera-near={0.1}
        shadow-camera-far={12}
        shadow-bias={-0.0002}
        shadow-normalBias={0.04}
      />
      {/* Full pear-shaped suit, with the hood hiding the shoulder junction. */}
      {ellipsoid([side * 1.15, 0, 0.15], [1.72, 2.35, 1.25])}
      {ellipsoid([side * 1.05, -1.1, 0.2], [1.8, 1.25, 1.32])}
      <group
        position={[side * 2.2, 3.04, 0]}
        rotation={[0, -side * 0.09, side * 0.08]}
      >
        <mesh
          geometry={forms.hood}
          material={materials.shell}
          castShadow
          receiveShadow
        />
        {ellipsoid([0, 0, 1.35], [1.64, 1.63, 0.37], materials.face)}
        <mesh
          geometry={forms.trim}
          material={materials.rim}
          castShadow
          receiveShadow
        />
        {side < 0 ? (
          [-0.61, 0.61].map((x) => (
            <group key={x} position={[x, 0.12, 1.7]}>
              {ellipsoid([0, 0, 0.015], [0.53, 0.55, 0.13], materials.rim)}
              <mesh
                geometry={forms.goggles}
                material={materials.rim}
                position={[0, 0, 0.12]}
                castShadow
              />
              {ellipsoid([0.06, 0, 0.19], [0.18, 0.21, 0.11], materials.eye)}
            </group>
          ))
        ) : (
          <>
            {forms.hair.map((g, i) => (
              <mesh
                key={i}
                geometry={g}
                material={materials.hair}
                castShadow
                receiveShadow
              />
            ))}
            {[-0.51, 0.51].map((x) => (
              <group key={x}>
                {ellipsoid([x, 0.2, 1.72], [0.17, 0.2, 0.1], materials.eye)}
              </group>
            ))}
            {ellipsoid([0, -0.35, 1.71], [0.17, 0.12, 0.1], materials.face)}
          </>
        )}
      </group>
      <mesh
        ref={sleeve}
        geometry={forms.sphere}
        material={materials.shell}
        position={[side * 1, 1, 1.8]}
        scale={[0.62, 0.85, 1.3]}
        castShadow
        receiveShadow
      />
      {/* Near mitten curls around the front of the pillar; face remains behind. */}
      <group
        ref={arm}
        position={[side * 0.5, 0.9, 3.5]}
        rotation={[0, 0, side * 0.42]}
      >
        {ellipsoid([0, 0.75, 0], [0.62, 1.16, 0.62])}
        {ellipsoid([0, 1.85, 0.15], [0.69, 0.83, 0.65])}
      </group>
      <group
        ref={farArm}
        position={[side * 1.8, 0.65, 0.5]}
        rotation={[0, 0, -side * 0.12]}
      >
        {ellipsoid([0, 0.75, 0], [0.62, 1.16, 0.62])}
        {ellipsoid([0, 1.85, 0.15], [0.69, 0.83, 0.65])}
      </group>
      <group
        ref={boot}
        position={[-side * 0.05, -1.86, 1.1]}
        rotation={[0, 0, -side * 0.45]}
      >
        {ellipsoid([0, 0, 0], [0.84, 1.05, 0.82])}
        {ellipsoid([0, -0.39, 0.47], [0.8, 0.66, 0.6], materials.sole)}
      </group>
      {ellipsoid([side * 1.68, -1.8, 0.85], [0.81, 0.7, 0.91])}
    </group>
  );
}
