import { GRASS_COLOUR, PATH_COLOURS } from "../lib/palette";
import { memo, useMemo, useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Detailed } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import site from "../data/wapping-gate.json";
import thumbnails from "../data/artwork-thumbnails.json" with { type: "json" };
export const WAPPING_GATE = { x: site.center[0], z: site.center[1] };
export const isWappingTree = ([x, z]: number[]) =>
  site.trees.some(([a, b]) => Math.hypot(x - a, z - b) < 1);
const origin = site.center;
function build() {
  const parts: Record<string, THREE.BufferGeometry[]> = {};
  let projectArtwork = true;
  const add = (g: THREE.BufferGeometry, p: number[], m: string, a = 0) => {
    g.setAttribute(
      "artworkSurface",
      new THREE.Float32BufferAttribute(
        new Float32Array(g.getAttribute("position").count).fill(
          projectArtwork ? 1 : 0,
        ),
        1,
      ),
    );
    g.rotateY(a);
    g.translate(p[0] - origin[0], p[1], p[2] - origin[1]);
    (parts[m] ??= []).push(g);
  };
  const box = (p: number[], s: [number, number, number], m: string, a = 0) =>
    add(new THREE.BoxGeometry(...s), p, m, a);
  const cyl = (
    p: number[],
    rt: number,
    rb: number,
    h: number,
    m: string,
    n = 12,
  ) => add(new THREE.CylinderGeometry(rt, rb, h, n), p, m);
  const beam = (a: number[], b: number[], r: number, m: string) => {
    const av = new THREE.Vector3(a[0], a[1], a[2]),
      bv = new THREE.Vector3(b[0], b[1], b[2]),
      delta = bv.clone().sub(av);
    const g = new THREE.CylinderGeometry(r, r, delta.length(), 5);
    g.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        delta.normalize(),
      ),
    );
    add(g, av.add(bv).multiplyScalar(0.5).toArray(), m);
  };
  const poly = (ps: number[][], y: number, h: number, m: string) => {
    const g = new THREE.ExtrudeGeometry(
      new THREE.Shape(ps.map(([x, z]) => new THREE.Vector2(x, -z))),
      { depth: h, bevelEnabled: false },
    );
    g.rotateX(-Math.PI / 2);
    add(g, [0, y, 0], m);
  };
  const angle = site.angle,
    c = Math.cos(angle),
    s = Math.sin(angle);
  const local = (u: number, y: number, v: number) => [
    origin[0] + c * u + s * v,
    y,
    origin[1] - s * u + c * v,
  ];
  const lb = (
    u: number,
    y: number,
    v: number,
    size: [number, number, number],
    m: string,
  ) => box(local(u, y, v), size, m, angle);
  const extrude = (
    points: number[][],
    depth: number,
    p: number[],
    m: string,
    a = angle,
  ) => {
    const g = new THREE.ExtrudeGeometry(
      new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y))),
      { depth, bevelEnabled: false },
    );
    g.translate(0, 0, -depth / 2);
    add(g, p, m, a);
  };
  const roof = (u: number) => 9.4 - (Math.abs(u) * 3) / 9.75;
  // One concave wall outline leaves the passage genuinely open all the way to the paving.
  const outline = [
    [-9.75, 0],
    [-9.75, 6.4],
    [0, 9.4],
    [9.75, 6.4],
    [9.75, 0],
    [3, 0],
    [3, 3.3],
  ];
  for (let i = 1; i <= 32; i++) {
    const a = (i * Math.PI) / 32;
    outline.push([3 * Math.cos(a), 3.3 + 2.2 * Math.sin(a)]);
  }
  outline.push([-3, 0]);
  extrude(outline, 0.8, local(0, 0.55, 0), "joint");
  // Irregular shallow stones on both faces, kept clear of the opening and recessed panel.
  const rand = (i: number) => {
    const v = Math.sin(i * 127.1 + 17.3) * 43758.5453;
    return v - Math.floor(v);
  };
  const inOpening = (u: number, y: number, margin: number) =>
    Math.abs(u) < 3 + margin &&
    y <
      3.3 + 2.2 * Math.sqrt(Math.max(0, 1 - (u / (3 + margin)) ** 2)) + margin;
  for (const face of [-1, 1])
    for (let row = 0; row < 31; row++) {
      const y = 0.16 + row * 0.3;
      for (let col = 0; col < 39; col++) {
        const seed = row * 43 + col,
          u = -9.5 + col * 0.5 + (row % 2) * 0.22;
        const w = 0.43 + rand(seed) * 0.08,
          h = 0.24 + rand(seed + 1) * 0.04;
        if (
          u + w / 2 > 9.75 ||
          y + h / 2 > roof(u) - 0.05 ||
          inOpening(u, y, 0.45)
        )
          continue;
        if (face === 1 && Math.abs(u) < 2.75 && y > 6.1 && y < 8.15) continue;
        extrude(
          [
            [-w / 2, -h * 0.4],
            [-w * 0.39, h * 0.46],
            [w * 0.16, h / 2],
            [w / 2, h * 0.15],
            [w * 0.42, -h / 2],
          ],
          0.07,
          local(u, y + 0.55, face * 0.425),
          seed % 4 ? "detail-stone" : "detail-stoneLight",
        );
      }
    }
  // Dressed jamb blocks and wedge-shaped voussoirs follow the elliptical arch.
  for (const u of [-3.3, 3.3])
    for (let i = 0; i < 5; i++)
      lb(u, 0.88 + i * 0.66, 0, [0.62, 0.64, 0.96], "stone");
  for (let i = 0; i < 21; i++) {
    const a = (i * Math.PI) / 21 + 0.009,
      b = ((i + 1) * Math.PI) / 21 - 0.009;
    extrude(
      [
        [3 * Math.cos(a), 3.3 + 2.2 * Math.sin(a)],
        [3.52 * Math.cos(a), 3.3 + 2.72 * Math.sin(a)],
        [3.52 * Math.cos(b), 3.3 + 2.72 * Math.sin(b)],
        [3 * Math.cos(b), 3.3 + 2.2 * Math.sin(b)],
      ],
      0.96,
      local(0, 0.55, 0),
      i % 3 ? "stone" : "stoneLight",
    );
  }
  for (const [a, b] of [
    [
      [-9.75, 6.4],
      [0, 9.4],
    ],
    [
      [0, 9.4],
      [9.75, 6.4],
    ],
  ]) {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = Math.ceil(length / 0.65);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n,
        g = new THREE.BoxGeometry(length / n - 0.018, 0.2, 1);
      g.rotateZ(Math.atan2(b[1] - a[1], b[0] - a[0]));
      add(
        g,
        local(a[0] + (b[0] - a[0]) * t, 0.6 + a[1] + (b[1] - a[1]) * t, 0),
        "stone",
        angle,
      );
    }
  }
  // South recess reads as an inset within raised dressed-stone borders; north face has a plaque.
  lb(0, 7.65, 0.408, [5.05, 1.8, 0.025], "stoneDark");
  for (const u of [-2.65, 2.65]) lb(u, 7.65, 0.5, [0.25, 2.1, 0.22], "stone");
  for (const y of [6.6, 8.7]) lb(0, y, 0.5, [5.55, 0.25, 0.22], "stone");
  lb(0, 8.0, -0.465, [1.85, 1.15, 0.12], "plaque");
  for (let i = 0; i < 5; i++)
    lb(
      0,
      8.35 - i * 0.15,
      -0.531,
      [1.4 - (i % 2) * 0.2, 0.025, 0.012],
      "detail-stoneDark",
    );
  // Side buttresses taper towards the top and project into the cobbled flanks.
  for (const u of [-9.15, 9.15]) {
    const g = new THREE.ExtrudeGeometry(
      new THREE.Shape([
        new THREE.Vector2(0, 0),
        new THREE.Vector2(2.4, 0),
        new THREE.Vector2(0.6, 5.7),
        new THREE.Vector2(0, 5.7),
      ]),
      { depth: 0.8, bevelEnabled: false },
    );
    g.rotateY(Math.PI / 2);
    add(g, local(u - 0.4, 0.55, -0.4), "joint", angle);
    for (let i = 0; i < 12; i++)
      lb(
        u,
        0.8 + i * 0.46,
        -0.7 - (2.05 - i * 0.145) / 2,
        [0.84, 0.43, 2.05 - i * 0.145],
        "detail-stone",
      );
  }
  lb(5.3, 1.75, 0.62, [0.72, 0.58, 0.28], "stoneDark");
  lb(5.3, 1.37, 0.8, [0.85, 0.2, 0.62], "stone");
  for (const u of [-3.9, 4.6]) {
    const g = new THREE.CylinderGeometry(0.25, 0.43, 1.1, 4);
    g.rotateY(Math.PI / 4);
    add(g, local(u, 1.1, 1.5), "stone");
  }
  // Slabs and setts stay within the mapped pedestrian polygon and outside the dock water.
  projectArtwork = false;
  const inside = (x: number, z: number) => {
    let yes = false;
    const ps = site.pavement.points;
    for (let i = 0, j = ps.length - 1; i < ps.length; j = i++) {
      const a = ps[i],
        b = ps[j];
      if (
        a[1] > z !== b[1] > z &&
        x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]
      )
        yes = !yes;
    }
    return yes;
  };
  for (let v = -55; v < 8; v += 0.8)
    for (let u = -13; u < 10; u += 0.8) {
      const p = local(u, 0.515, v);
      if (!inside(p[0], p[2])) continue;
      if (Math.abs(u) < 3) box(p, [0.775, 0.035, 0.775], "detail-flag", angle);
      else {
        box(p, [0.79, 0.025, 0.79], "joint", angle);
        for (let k = 0; k < 4; k++)
          lb(
            u + ((k % 2) - 0.5) * 0.39,
            0.544,
            v + (Math.floor(k / 2) - 0.5) * 0.39,
            [0.34, 0.025, 0.33],
            k % 3 ? "detail-cobble" : "detail-stone",
          );
      }
    }
  for (const u of [-3.1, 3.1])
    lb(u, 0.55, -23.5, [0.1, 0.025, 63], "stoneDark");
  for (const u of [-6, 6])
    for (const v of [-1.2, 1.2])
      cyl(local(u, 0.56, v), 0.15, 0.15, 0.035, "detail-lamp");
  const lamp = (x: number, z: number) => {
    cyl([x, 2.65, z], 0.075, 0.15, 4.2, "iron");
    cyl([x, 0.8, z], 0.16, 0.32, 0.5, "iron");
    add(new THREE.SphereGeometry(0.34, 12, 8), [x, 4.9, z], "lamp");
    add(
      new THREE.SphereGeometry(0.35, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      [x, 4.9, z],
      "iron",
    );
    cyl([x, 4.48, z], 0.23, 0.11, 0.18, "iron");
  };
  for (const [u, v] of [
    [-4, -1.2],
    [-10, -23],
    [-10, -44],
  ]) {
    const p = local(u, 0, v);
    lamp(p[0], p[2]);
  }
  lb(-6, 0.99, -1, [2.6, 0.85, 0.55], "iron");
  for (let i = 0; i < 3; i++)
    lb(-6.85 + i * 0.85, 1, -1.29, [0.015, 0.65, 0.02], "detail-trim");
  site.benches.forEach(([x, z]) => {
    // Bench length follows the dock edge; seats face west towards the water.
    const a = angle - Math.PI / 2,
      at = (u: number, y: number, v: number) => [
        x + Math.cos(a) * u + Math.sin(a) * v,
        y,
        z - Math.sin(a) * u + Math.cos(a) * v,
      ];
    for (const u of [-0.85, 0.85]) {
      box(at(u, 0.8, 0), [0.09, 0.65, 0.52], "iron", a);
      beam(at(u, 0.75, 0.28), at(u, 1.55, 0.28), 0.045, "iron");
    }
    for (let i = 0; i < 3; i++)
      box(at(0, 1.13, -0.2 + i * 0.18), [2.25, 0.065, 0.14], "wood", a);
    for (let i = 0; i < 3; i++)
      box(at(0, 1.25 + i * 0.16, 0.29), [2.25, 0.12, 0.06], "wood", a);
  });
  const [bx, bz] = site.bin;
  box([bx, 1.18, bz], [0.65, 1.25, 0.65], "iron");
  box([bx, 1.63, bz - 0.331], [0.45, 0.15, 0.02], "detail-black");
  for (const y of [0.65, 1.75])
    box([bx, y, bz], [0.67, 0.025, 0.67], "detail-gold");
  const fence = (p: number[], q: number[], height: number, m: string) => {
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]),
      n = Math.ceil(len / 0.25);
    const at = (t: number, y: number) => [
      p[0] + (q[0] - p[0]) * t,
      y,
      p[1] + (q[1] - p[1]) * t,
    ];
    for (const y of [0.8, height - 0.2]) beam(at(0, y), at(1, y), 0.045, m);
    for (let j = 0; j <= n; j++) {
      beam(at(j / n, 0.55), at(j / n, height), 0.03, m);
      cyl(at(j / n, height + 0.06), 0, 0.07, 0.18, m, 4);
    }
  };
  site.fences.forEach((f) =>
    f.points.slice(1).forEach((q, i) => fence(f.points[i], q, 2.65, "iron")),
  );
  site.chains.points.slice(1).forEach((q, i) => {
    const p = site.chains.points[i],
      len = Math.hypot(q[0] - p[0], q[1] - p[1]),
      n = Math.ceil(len / 2.6);
    const at = (t: number, y: number) => [
      p[0] + (q[0] - p[0]) * t + 0.35,
      y,
      p[1] + (q[1] - p[1]) * t,
    ];
    for (let j = 0; j <= n; j++)
      cyl(at(j / n, 1.18), 0.085, 0.14, 1.3, "iron", 8);
    for (let j = 0; j < n; j++)
      for (const y of [1, 1.38, 1.75])
        for (let k = 0; k < 5; k++)
          beam(
            at((j + k / 5) / n, y - Math.sin((k / 5) * Math.PI) * 0.25),
            at(
              (j + (k + 1) / 5) / n,
              y - Math.sin(((k + 1) / 5) * Math.PI) * 0.25,
            ),
            0.02,
            "detail-iron",
          );
  });
  // Bridge deck spans the water beneath the road and both pedestrian rails.
  poly(
    [
      [205.1, 479.6],
      [232.2, 468.4],
      [236, 477.6],
      [208.9, 488.8],
    ],
    0.32,
    0.19,
    "flag",
  );
  // Continuous neutral bridge approach along the saved road centreline.
  const ps = site.road.points;
  const offset = (w: number) =>
    ps.map((p, i) => {
      const a = ps[Math.max(0, i - 1)],
        b = ps[Math.min(ps.length - 1, i + 1)],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        l = Math.hypot(dx, dz);
      return [p[0] - (dz / l) * w, p[1] + (dx / l) * w];
    });
  poly([...offset(2.65), ...offset(-2.65).reverse()], 0.52, 0.025, "road");
  for (const side of [-1, 1]) {
    const p = [207 + side * 1.9, 484.2 + side * 4.6],
      q = [231 + side * 1.9, 474.3 + side * 4.6];
    for (const y of [0.9, 1.4, 1.9])
      beam([p[0], y, p[1]], [q[0], y, q[1]], 0.045, "trim");
    for (let i = 0; i <= 8; i++)
      cyl(
        [p[0] + ((q[0] - p[0]) * i) / 8, 1.25, p[1] + ((q[1] - p[1]) * i) / 8],
        0.045,
        0.045,
        1.4,
        "trim",
      );
  }
  poly(site.planter.points, 0.52, 0.6, "stone");
  poly(site.planter.points, 1.13, 0.03, "soil");
  site.trees.forEach(([x, z], i) => {
    cyl([x, 3.3, z], 0.17, 0.27, 4.5, "bark", 7);
    const g = new THREE.IcosahedronGeometry(1, 1);
    g.scale(2.1, 3.3, 2.1);
    add(g, [x, 5.6, z], i % 2 ? "leaf" : "leafLight");
  });
  return Object.fromEntries(
    Object.entries(parts).map(([m, gs]) => {
      const ns = gs.map((g) => {
        const n = g.index ? g.toNonIndexed() : g;
        n.deleteAttribute("uv");
        return n;
      });
      const merged = mergeGeometries(ns, false)!;
      new Set([...gs, ...ns]).forEach((g) => g.dispose());
      return [m, merged];
    }),
  );
}
export const WappingGate = memo(function WappingGate({
  night,
}: {
  night: boolean;
}) {
  const parts = useMemo(build, []);
  const invalidate = useThree((state) => state.invalidate);
  const image = useMemo(
    () => ({ texture: { value: new THREE.Texture() }, ready: { value: 0 } }),
    [],
  );
  useEffect(() => {
    let cancelled = false;
    const placeholder = image.texture.value;
    const texture = new THREE.TextureLoader().load(
      thumbnails.together,
      (loaded) => {
        if (cancelled) return;
        image.texture.value = loaded;
        image.ready.value = 1;
        invalidate();
      },
    );
    return () => {
      cancelled = true;
      texture.dispose();
      placeholder.dispose();
      image.ready.value = 0;
    };
  }, [image, invalidate]);
  const projection = useMemo(() => {
    const c = Math.cos(site.angle),
      s = Math.sin(site.angle);
    return (shader: THREE.WebGLProgramParametersWithUniforms) => {
      shader.uniforms.togetherImage = image.texture;
      shader.uniforms.projectionReady = image.ready;
      shader.uniforms.projectionLight = { value: night ? 0.72 : 0.08 };
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
        attribute float artworkSurface;
        varying vec2 artworkUV;
        varying float artworkMask;`,
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
        float gateX = position.x * ${c} - position.z * ${s};
        float facing = normal.x * ${s} + normal.z * ${c};
        // Reverse the back face horizontally so the image reads from either side.
        artworkUV = vec2(0.5 + gateX * sign(facing) / 19.5,
          mix(0.43, 0.874, clamp((position.y - 0.55) / 9.4, 0.0, 1.0)));
        artworkMask = artworkSurface * smoothstep(0.65, 0.95, abs(facing));
      `,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
        uniform sampler2D togetherImage;
        uniform float projectionLight;
        uniform float projectionReady;
        varying vec2 artworkUV;
        varying float artworkMask;`,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
        vec3 projectedArt = sRGBTransferEOTF(texture2D(togetherImage, artworkUV)).rgb;
        diffuseColor.rgb = mix(diffuseColor.rgb, projectedArt, artworkMask * 0.9 * projectionReady);
      `,
        )
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
        totalEmissiveRadiance += projectedArt * artworkMask * projectionLight * projectionReady;
      `,
        );
    };
  }, [image, night]);
  useEffect(
    () => () => Object.values(parts).forEach((g) => g.dispose()),
    [parts],
  );
  const colors: Record<string, string> = {
    joint: "#7b7a6d",
    stoneLight: "#b3ae98",
    stoneDark: "#797664",
    plaque: "#bfab84",
    wood: "#8f6d49",
    black: "#161d1c",
    gold: "#c0a35c",
    soil: "#535748",
    cobble: "#b9b4a5",
    stone: "#c2b7a2",
    flag: "#aaa18d",
    iron: "#2c3738",
    lamp: "#e4dabe",
    orange: "#ed8640",
    road: PATH_COLOURS[night ? "night" : "day"],
    yellow: "#d9b652",
    sign: "#475452",
    brick: "#93604c",
    glass: "#668687",
    roof: "#666d6d",
    trim: "#81918c",
    wheel: "#e3ded1",
    grass: GRASS_COLOUR,
    bark: "#857968",
    leaf: "#687a57",
    leafLight: "#7e8e66",
  };
  const mesh = (m: string, g: THREE.BufferGeometry) => (
    <mesh key={m} geometry={g} castShadow receiveShadow>
      <meshStandardMaterial
        key={night ? "projection-night" : "projection-day"}
        onBeforeCompile={projection}
        customProgramCacheKey={() => "together-projection-v1"}
        color={colors[m.replace("detail-", "")]}
        roughness={0.86}
        flatShading
        side={THREE.DoubleSide}
        emissive={m === "lamp" ? "#eedba7" : "#000000"}
        emissiveIntensity={night ? 0.5 : 0}
      />
    </mesh>
  );
  return (
    <group position={[origin[0], 0, origin[1]]}>
      {Object.entries(parts)
        .filter(([m]) => !m.startsWith("detail-"))
        .map(([m, g]) => mesh(m, g))}
      <Detailed distances={[0, 260]} hysteresis={0.12}>
        <group>
          {Object.entries(parts)
            .filter(([m]) => m.startsWith("detail-"))
            .map(([m, g]) => mesh(m, g))}
        </group>
        <group />
      </Detailed>
    </group>
  );
});
