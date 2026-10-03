import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { OrbitControls } from "three-stdlib";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { installations } from "../data/installations";
import { project } from "../lib/geo";
import {
  placeStreetLamps,
  LAMP_LIGHT_RADIUS,
  type StreetLamp,
} from "../lib/street-lamps";
import type { MapData } from "../types";
import { TOWN_HALL_FORECOURT } from "./TownHall";

const WARM = "#ffd39b";
const GLOBE_HEIGHT = 3.6;
function lanternGeometry() {
  const profile = [
    [0.27, 0],
    [0.27, 0.1],
    [0.21, 0.15],
    [0.19, 0.42],
    [0.15, 0.64],
    [0.2, 0.7],
    [0.2, 0.79],
    [0.12, 0.85],
    [0.1, 1.1],
    [0.085, 2.85],
    [0.19, 2.92],
    [0.2, 3.02],
    [0.1, 3.09],
    [0.075, 3.33],
  ];
  const parts: THREE.BufferGeometry[] = [
    new THREE.LatheGeometry(
      profile.map(([r, y]) => new THREE.Vector2(r, y)),
      16,
    ),
  ];
  const add = (g: THREE.BufferGeometry, y: number) => {
    g.translate(0, y, 0);
    parts.push(g);
  };
  for (let i = 0; i < 12; i++) {
    const angle = (i * Math.PI) / 6;
    const flute = new THREE.CylinderGeometry(0.012, 0.012, 1.7, 4);
    flute.translate(Math.cos(angle) * 0.09, 1.99, Math.sin(angle) * 0.09);
    parts.push(flute);
  }
  // Slender cast-iron globe cage, collar and finial from the reference silhouette.
  for (let i = 0; i < 3; i++) {
    const rib = new THREE.TorusGeometry(0.279, 0.013, 5, 24);
    rib.rotateY((i * Math.PI) / 3);
    add(rib, GLOBE_HEIGHT);
  }
  const belt = new THREE.TorusGeometry(0.283, 0.019, 6, 24);
  belt.rotateX(Math.PI / 2);
  add(belt, GLOBE_HEIGHT + 0.05);
  add(new THREE.CylinderGeometry(0.06, 0.19, 0.12, 16), 3.91);
  add(new THREE.CylinderGeometry(0.025, 0.085, 0.14, 12), 4.02);
  add(new THREE.SphereGeometry(0.034, 8, 6), 4.11);
  const normalized = parts.map((g) => (g.index ? g.toNonIndexed() : g));
  const result = mergeGeometries(normalized)!;
  new Set([...parts, ...normalized]).forEach((g) => g.dispose());
  return result;
}

// Clip the soft pavement pools at building walls; light cannot wash through a block.
function pavementPools(lamps: StreetLamp[], data: MapData) {
  const vertices: number[] = [],
    strength: number[] = [];
  for (const lamp of lamps) {
    const edges = data.buildings
      .filter((b) =>
        b.points.some((p) => Math.hypot(p[0] - lamp.x, p[1] - lamp.z) < 100),
      )
      .flatMap((b) => b.points.slice(1).map((p, i) => [b.points[i], p]));
    const rim = Array.from({ length: 32 }, (_, i) => {
      const angle = (i * Math.PI) / 16,
        dx = Math.cos(angle),
        dz = Math.sin(angle);
      let radius = 8;
      for (const [a, b] of edges) {
        const ex = b[0] - a[0],
          ez = b[1] - a[1],
          den = dx * ez - dz * ex;
        if (Math.abs(den) < 0.00001) continue;
        const ax = a[0] - lamp.x,
          az = a[1] - lamp.z;
        const t = (ax * ez - az * ex) / den,
          u = (ax * dz - az * dx) / den;
        if (t > 0 && u >= 0 && u <= 1) radius = Math.min(radius, t);
      }
      return { dx, dz, radius };
    });
    const point = (i: number, r: number) => {
      const p = rim[i % 32],
        distance = Math.min(r, p.radius);
      return [lamp.x + p.dx * distance, 0.55, lamp.z + p.dz * distance];
    };
    const alpha = (i: number, r: number) =>
      0.36 * Math.pow(1 - Math.min(r, rim[i % 32].radius) / 8, 2);
    for (let i = 0; i < 32; i++)
      for (const [inner, outer] of [
        [0, 2],
        [2, 5],
        [5, 8],
      ]) {
        for (const [n, r] of [
          [i, inner],
          [i, outer],
          [i + 1, outer],
          [i, inner],
          [i + 1, outer],
          [i + 1, inner],
        ]) {
          vertices.push(...point(n, r));
          strength.push(alpha(n, r));
        }
      }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setAttribute(
    "strength",
    new THREE.Float32BufferAttribute(strength, 1),
  );
  return geometry;
}

export function StreetLamps({
  data,
  night,
}: {
  data: MapData;
  night: boolean;
}) {
  const lamps = useMemo(
    () =>
      placeStreetLamps(
        data,
        installations.map((i) =>
          i.id === "the-anooki"
            ? [TOWN_HALL_FORECOURT.x, TOWN_HALL_FORECOURT.z]
            : project(...i.coordinates),
        ),
      ),
    [data],
  );
  const assets = useMemo(() => {
    const iron = lanternGeometry(),
      globe = new THREE.SphereGeometry(0.275, 16, 12),
      pools = pavementPools(lamps, data);
    globe.translate(0, GLOBE_HEIGHT, 0);
    const metal = new THREE.MeshStandardMaterial({
      color: "#182323",
      roughness: 0.55,
      metalness: 0.5,
    });
    const glass = new THREE.MeshStandardMaterial({
      color: "#eee8d7",
      roughness: 0.48,
      emissive: WARM,
    });
    const posts = new THREE.InstancedMesh(iron, metal, lamps.length);
    const bulbs = new THREE.InstancedMesh(globe, glass, lamps.length);
    const matrix = new THREE.Matrix4();
    lamps.forEach((p, i) => {
      matrix.makeTranslation(p.x, 0.08, p.z);
      posts.setMatrixAt(i, matrix);
      bulbs.setMatrixAt(i, matrix);
    });
    posts.castShadow = true;
    posts.receiveShadow = true;
    posts.computeBoundingSphere();
    bulbs.computeBoundingSphere();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(32, 32, 1, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255,225,180,0.7)");
    gradient.addColorStop(0.3, "rgba(255,208,145,0.15)");
    gradient.addColorStop(1, "rgba(255,208,145,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    const glowTexture = new THREE.CanvasTexture(canvas);
    const glowGeometry = new THREE.BufferGeometry();
    glowGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        lamps.flatMap((p) => [p.x, GLOBE_HEIGHT + 0.08, p.z]),
        3,
      ),
    );
    return {
      iron,
      globe,
      pools,
      metal,
      glass,
      posts,
      bulbs,
      glowTexture,
      glowGeometry,
    };
  }, [lamps, data]);
  useEffect(
    () => () => {
      assets.posts.dispose();
      assets.bulbs.dispose();
      for (const value of [
        assets.iron,
        assets.globe,
        assets.pools,
        assets.metal,
        assets.glass,
        assets.glowTexture,
        assets.glowGeometry,
      ])
        value.dispose();
    },
    [assets],
  );
  useEffect(() => {
    assets.glass.emissiveIntensity = night ? 4 : 0;
  }, [assets, night]);
  const lights = useRef<(THREE.PointLight | null)[]>([]);
  const assigned = useRef<number[]>([]);
  useFrame(({ camera, controls, gl, invalidate }, delta) => {
    const centre =
      (controls as OrbitControls | null)?.target ?? camera.position;
    const count = gl.domElement.clientWidth < 701 ? 4 : 8;
    const desired = lamps
      .map((p, i) => ({
        i,
        score:
          Math.hypot(p.x - centre.x, p.z - centre.z) +
          0.2 * Math.hypot(p.x - camera.position.x, p.z - camera.position.z),
      }))
      .sort((a, b) => a.score - b.score)
      .slice(0, count)
      .map((p) => p.i);
    const available = desired.filter((i) => !assigned.current.includes(i));
    let animating = false;
    lights.current.forEach((light, slot) => {
      if (!light) return;
      if (slot >= count || !desired.includes(assigned.current[slot])) {
        assigned.current[slot] = slot < count ? (available.shift() ?? -1) : -1;
        light.intensity = 0;
      }
      const lamp = lamps[assigned.current[slot]];
      light.visible = night && !!lamp;
      if (!lamp) return;
      light.position.set(lamp.x, GLOBE_HEIGHT + 0.08, lamp.z);
      const goal = night ? 105 : 0;
      light.intensity = THREE.MathUtils.damp(
        light.intensity,
        goal,
        12,
        Math.min(delta, 0.05),
      );
      if (Math.abs(light.intensity - goal) > 0.05) animating = true;
    });
    if (animating) invalidate();
  });
  return (
    <group name="City street lamps">
      <primitive object={assets.posts} />
      <primitive object={assets.bulbs} />
      <mesh
        geometry={assets.pools}
        visible={night}
        renderOrder={1}
        raycast={() => {}}
      >
        <shaderMaterial
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          uniforms={{ tint: { value: new THREE.Color(WARM) } }}
          vertexShader={`#include <common>
          #include <logdepthbuf_pars_vertex>
          attribute float strength; varying float alpha;
          void main(){alpha=strength;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
          #include <logdepthbuf_vertex>
          }`}
          fragmentShader={`#include <common>
          #include <logdepthbuf_pars_fragment>
          uniform vec3 tint; varying float alpha;
          void main(){
          #include <logdepthbuf_fragment>
          gl_FragColor=vec4(tint,alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          }`}
        />
      </mesh>
      <points geometry={assets.glowGeometry} visible={night} raycast={() => {}}>
        <pointsMaterial
          map={assets.glowTexture}
          size={1.5}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>
      {Array.from({ length: 8 }, (_, i) => (
        <pointLight
          key={i}
          ref={(light) => {
            lights.current[i] = light;
          }}
          color={WARM}
          intensity={0}
          distance={LAMP_LIGHT_RADIUS}
          decay={2}
        />
      ))}
    </group>
  );
}
