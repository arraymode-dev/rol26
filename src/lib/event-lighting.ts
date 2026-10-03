import { TOWN_HALL_FORECOURT } from "./site-positions.ts";
import * as THREE from "three";
import { installations } from "../data/installations.ts";
import { project } from "./geo.ts";
import type { MapFeature } from "../types.ts";

// Photo-informed artistic washes, not a surveyed event lighting rig.
export const EVENT_SITE_IDS = installations.map((item) => item.id);
const treatments: Record<string, [number, string, string]> = {
  "the-anooki": [24, "#fff1c5", "#d0e6ff"],
  "flower-power": [36, "#ff76c9", "#d3a0ff"],
  loop: [28, "#57d6ff", "#aa78ff"],
  "today-i-love-you": [32, "#ffaf78", "#ffdcb3"],
  "invisible-cities": [38, "#8270ff", "#45c9ff"],
  "coloured-peonies": [30, "#ff72cb", "#b18aff"],
  unity: [32, "#ffaa6d", "#ff73aa"],
  "colour-rush": [34, "#ff518c", "#ffb24d"],
  "the-stars-come-out-at-night": [34, "#6194ff", "#cadfff"],
  together: [34, "#ffaf53", "#ba85ff"],
  paradigm: [25, "#ff6b1f", "#ffbf52"],
  "dream-herd": [28, "#ff9cce", "#bc98ff"],
  pop: [30, "#e88aff", "#7ecbff"],
};
export const EVENT_POOLS = installations.map((item) => {
  const [x, z] =
    item.id === "the-anooki"
      ? [TOWN_HALL_FORECOURT.x, TOWN_HALL_FORECOURT.z]
      : project(...item.coordinates);
  const [radius, colour, secondary] = treatments[item.id];
  return {
    id: item.id,
    x,
    z,
    y: item.id === "today-i-love-you" ? 3.8 : 0,
    radius,
    colour,
    secondary,
  };
});

export function eventFacadeFrames(buildings: readonly MapFeature[]) {
  return [
    { id: "24611033", angle: -1.04, height: 94, colour: "#ffbd64" },
    { id: "24611026", angle: -1.04, height: 37, colour: "#ffe0a1" },
    { id: "25695226", angle: 0, height: 26, colour: "#ffae64" },
    { id: "60261716", angle: 0.486, height: 42, colour: "#ffd49a" },
    { id: "31294107", angle: 0, height: 44, colour: "#ffd198" },
    { id: "6524513", angle: -1.102, height: 55, colour: "#ffe0a1" },
  ].flatMap((config) => {
    const building = buildings.find((b) => b.id === config.id);
    if (!building) return [];
    const c = Math.cos(config.angle),
      s = Math.sin(config.angle);
    const local = building.points.map(([x, z]) => [
      c * x - s * z,
      s * x + c * z,
    ]);
    const minX = Math.min(...local.map((p) => p[0])),
      maxX = Math.max(...local.map((p) => p[0]));
    const minZ = Math.min(...local.map((p) => p[1])),
      maxZ = Math.max(...local.map((p) => p[1]));
    const cx = (minX + maxX) / 2,
      cz = (minZ + maxZ) / 2;
    return [
      {
        ...config,
        x: c * cx + s * cz,
        z: -s * cx + c * cz,
        halfX: (maxX - minX) / 2,
        halfZ: (maxZ - minZ) / 2,
      },
    ];
  });
}

// Light only the elevations facing St Paul's Square, following their actual
// polygon edges rather than a bounding rectangle across these angled buildings.
export function loopFacadeEdges(buildings: readonly MapFeature[]) {
  const site = EVENT_POOLS.find((p) => p.id === "loop")!;
  return ["84823319", "288362583", "288362584", "288362585"].flatMap((id) => {
    const building = buildings.find((b) => b.id === id);
    if (!building) return [];
    const edges = building.points.slice(1).flatMap((b, i) => {
      const a = building.points[i];
      const dx = b[0] - a[0],
        dz = b[1] - a[1];
      const length = Math.hypot(dx, dz);
      if (length < 10) return [];
      const t = THREE.MathUtils.clamp(
        ((site.x - a[0]) * dx + (site.z - a[1]) * dz) / (length * length),
        0,
        1,
      );
      return [
        {
          id,
          a,
          b,
          length,
          dx: dx / length,
          dz: dz / length,
          distance: Math.hypot(site.x - a[0] - t * dx, site.z - a[1] - t * dz),
          height: Math.min(building.height ?? 28, 34),
          colour: id === "84823319" ? "#c4b7ff" : "#ffd49a",
        },
      ];
    });
    return edges.sort((a, b) => a.distance - b.distance).slice(0, 1);
  });
}

const f = (value: number) => value.toFixed(4);
const colour = (value: string) => {
  const c = new THREE.Color(value);
  return `vec3(${f(c.r)},${f(c.g)},${f(c.b)})`;
};

/** Add static lighting to existing surfaces: no new meshes, textures or render passes.
 * Called after architecture palette/ghost setup so all shader hooks compose and
 * are restored in the reverse order when the selection or scene changes. */
export function applyEventSurfaceLighting(
  root: THREE.Object3D,
  buildings: readonly MapFeature[],
) {
  const facades = eventFacadeFrames(buildings);
  const loopEdges = loopFacadeEdges(buildings);
  const restore: (() => void)[] = [];
  root.updateWorldMatrix(true, true);
  root.traverse((object) => {
    if (
      !(object instanceof THREE.Mesh) ||
      object instanceof THREE.InstancedMesh ||
      !(object.material instanceof THREE.MeshStandardMaterial)
    )
      return;
    object.geometry.computeBoundingBox();
    const bounds = object.geometry
      .boundingBox!.clone()
      .applyMatrix4(object.matrixWorld);
    // Leave water, transparent ghost architecture and remote city batches alone.
    if (bounds.max.y < 0 || object.material.transparent) return;
    const intersects = (x: number, z: number, rx: number, rz: number) =>
      bounds.max.x >= x - rx &&
      bounds.min.x <= x + rx &&
      bounds.max.z >= z - rz &&
      bounds.min.z <= z + rz;
    const pools = EVENT_POOLS.filter(
      (p) =>
        intersects(p.x, p.z, p.radius, p.radius) && bounds.min.y < p.y + 12,
    );
    const walls = facades.filter((p) => {
      const radius = Math.hypot(p.halfX, p.halfZ) + 5;
      return intersects(p.x, p.z, radius, radius) && bounds.max.y > 2;
    });
    const squareWalls = loopEdges.filter(
      (p) =>
        intersects(
          (p.a[0] + p.b[0]) / 2,
          (p.a[1] + p.b[1]) / 2,
          Math.abs(p.b[0] - p.a[0]) / 2 + 4,
          Math.abs(p.b[1] - p.a[1]) / 2 + 4,
        ) && bounds.max.y > 2,
    );
    if (!pools.length && !walls.length && !squareWalls.length) return;
    const original = object.material;
    const material = original.clone();
    const previousCompile = original.onBeforeCompile.bind(original);
    const previousKey = original.customProgramCacheKey();
    material.onBeforeCompile = (shader, renderer) => {
      previousCompile(shader, renderer);
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying vec3 eventPosition;",
        )
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\neventPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;",
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
        varying vec3 eventPosition;
        float eventPool(vec2 q, float radius) {
          float t = max(0.0, 1.0 - length(q) / radius);
          return t * t * (3.0 - 2.0 * t);
        }
      `,
        )
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
        vec3 eventNormal = inverseTransformDirection(normal, viewMatrix);
        float floorFacing = smoothstep(0.25, 0.9, eventNormal.y);

        ${pools
          .map(
            (p) => `{
          vec2 q = eventPosition.xz - vec2(${f(p.x)},${f(p.z)});
          float falloff = eventPool(q, ${f(p.radius)});
          vec3 hue = mix(${colour(p.colour)}, ${colour(p.secondary)}, smoothstep(-12.0,12.0,q.x+q.y*0.35));
          // Anchor to the site elevation, including the raised church garden.
          float h = eventPosition.y - ${f(p.y)};
          float paving = (1.0-smoothstep(1.5,5.0,h)) * step(-0.1,h);
          float wall = (1.0-smoothstep(1.5,12.0,h)) * step(-0.1,h);
          totalEmissiveRadiance += hue * falloff * (0.85*floorFacing*paving + 0.22*(1.0-floorFacing)*wall);
        }`,
          )
          .join("\n")}
        ${squareWalls
          .map(
            (p) => `{
          vec2 q = eventPosition.xz - vec2(${f(p.a[0])},${f(p.a[1])});
          vec2 tangent = vec2(${f(p.dx)},${f(p.dz)});
          float along = dot(q,tangent);
          float edgeDistance = abs(dot(q,vec2(-tangent.y,tangent.x)));
          float footprint = smoothstep(-1.0,1.0,along) * (1.0-smoothstep(${f(p.length - 1)},${f(p.length + 1)},along)) * (1.0-smoothstep(1.0,3.5,edgeDistance));
          float vertical = 1.0-smoothstep(0.15,0.65,abs(eventNormal.y));
          float h = eventPosition.y;
          float rise = smoothstep(0.0,1.0,h) * (1.0-smoothstep(${f(p.height * 0.45)},${f(p.height)},h));
          float spread = mix(14.0,3.0,clamp(h/${f(p.height)},0.0,1.0));
          float shafts = pow(0.5+0.5*cos(along*0.7),spread) * (1.0-smoothstep(0.6,2.5,fwidth(along)));
          totalEmissiveRadiance += ${colour(p.colour)} * footprint * vertical * rise * (0.09+0.85*shafts);
        }`,
          )
          .join("\n")}
        ${walls
          .map(
            (p) => `{
          vec2 q = eventPosition.xz - vec2(${f(p.x)},${f(p.z)});
          q = mat2(${f(Math.cos(p.angle))},${f(Math.sin(p.angle))},${f(-Math.sin(p.angle))},${f(Math.cos(p.angle))}) * q;
          vec2 edge = abs(abs(q) - vec2(${f(p.halfX)},${f(p.halfZ)}));
          float footprint = (1.0-smoothstep(${f(p.halfX + 2)},${f(p.halfX + 5)},abs(q.x))) * (1.0-smoothstep(${f(p.halfZ + 2)},${f(p.halfZ + 5)},abs(q.y)));
          float vertical = 1.0-smoothstep(0.15,0.65,abs(eventNormal.y));
          float along = edge.x < edge.y ? q.y : q.x;
          float resolved = 1.0-smoothstep(0.6,2.5,fwidth(along));
          float shaft = pow(0.5+0.5*cos(along*0.65),8.0) * resolved;
          float edgeWash = 1.0-smoothstep(1.0,5.0,min(edge.x,edge.y));
          float rise = smoothstep(0.0,2.0,eventPosition.y) * (1.0-smoothstep(${f(p.height * 0.55)},${f(p.height)},eventPosition.y));
          float crown = smoothstep(40.0,48.0,eventPosition.y) * 0.13;
          totalEmissiveRadiance += ${colour(p.colour)} * footprint * vertical * rise * (edgeWash*(0.055+shaft*0.48)+crown);
        }`,
          )
          .join("\n")}
      `,
        );
    };
    material.customProgramCacheKey = () =>
      `${previousKey}-event-wash-v2-${pools.map((p) => p.id).join(",")}-${walls.map((p) => p.id).join(",")}-${squareWalls.map((p) => p.id).join(",")}`;
    object.material = material;
    restore.push(() => {
      object.material = original;
      material.dispose();
    });
  });
  return () => restore.reverse().forEach((fn) => fn());
}
