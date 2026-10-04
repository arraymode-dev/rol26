import * as THREE from "three";
import { nearFootprint, type Footprint } from "./attraction-boundary.ts";

// Semantic tag survives material batching; untagged geometry never ghosts.
export function markBuildingGeometry(
  geometry: THREE.BufferGeometry,
  building: boolean,
) {
  geometry.setAttribute(
    "building",
    new THREE.BufferAttribute(
      new Float32Array(geometry.getAttribute("position").count).fill(
        building ? 1 : 0,
      ),
      1,
    ),
  );
}

// Models batch walls, windows and paving together by material. Split triangles,
// not entire material batches, so nearby ground and unrelated buildings stay solid.
export function splitGhostGeometry(
  geometry: THREE.BufferGeometry,
  matrix: THREE.Matrix4,
  footprints: readonly Footprint[],
  buildingOnly = false,
  wholeBuilding = false,
  shareAttributes = false,
) {
  if (buildingOnly && wholeBuilding && footprints.length) {
    const solid = shareAttributes
      ? geometryView(geometry, [])
      : geometry.clone();
    solid.setDrawRange(0, 0);
    return {
      solid,
      ghost: shareAttributes ? geometryView(geometry) : geometry.clone(),
    };
  }
  const building = geometry.getAttribute("building");
  if (!buildingOnly && !building) return null;
  geometry.computeBoundingBox();
  const bounds = geometry
    .boundingBox!.clone()
    .applyMatrix4(matrix)
    .expandByScalar(2);
  const nearby = footprints.filter(({ points }) => {
    const xs = points.map((p) => p[0]),
      zs = points.map((p) => p[1]);
    return (
      Math.max(...xs) >= bounds.min.x &&
      Math.min(...xs) <= bounds.max.x &&
      Math.max(...zs) >= bounds.min.z &&
      Math.min(...zs) <= bounds.max.z
    );
  });
  if (!nearby.length) return null;
  const position = geometry.getAttribute("position");
  const index = geometry.index;
  const solid: number[] = [],
    ghost: number[] = [];
  const v = new THREE.Vector3();
  const count = index ? index.count : position.count;
  for (let i = 0; i < count; i += 3) {
    const ids = [0, 1, 2].map((k) => (index ? index.getX(i + k) : i + k));
    if (!buildingOnly && !ids.every((id) => building.getX(id) === 1)) {
      solid.push(...ids);
      continue;
    }
    let x = 0,
      z = 0;
    for (const id of ids) {
      v.fromBufferAttribute(position, id).applyMatrix4(matrix);
      x += v.x / 3;
      z += v.z / 3;
    }
    // A small footprint margin includes projecting cornices and window trim.
    const target = nearby.some((footprint) =>
      nearFootprint([x, z], footprint, 2),
    )
      ? ghost
      : solid;
    target.push(...ids);
  }
  if (!ghost.length) return null;
  const subset = (ids: number[]) => {
    if (shareAttributes) return geometryView(geometry, ids);
    const result = new THREE.BufferGeometry();
    for (const [name, attr] of Object.entries(geometry.attributes)) {
      const values = new Float32Array(ids.length * attr.itemSize);
      ids.forEach((id, i) => {
        for (let k = 0; k < attr.itemSize; k++)
          values[i * attr.itemSize + k] = attr.getComponent(id, k);
      });
      result.setAttribute(
        name,
        new THREE.BufferAttribute(values, attr.itemSize),
      );
    }
    result.computeBoundingSphere();
    return result;
  };
  return { solid: subset(solid), ghost: subset(ghost) };
}

/** Selection changes indices only. Vertex buffers are shared and uploaded once. */
export function geometryView(source: THREE.BufferGeometry, indices?: number[]) {
  const view = new THREE.BufferGeometry();
  syncGeometryAttributes(view, source);
  if (indices) view.setIndex(indices);
  else if (source.index) view.setIndex(source.index.clone());
  source.computeBoundingBox();
  source.computeBoundingSphere();
  view.boundingBox = source.boundingBox!.clone();
  view.boundingSphere = source.boundingSphere!.clone();
  return view;
}
export function syncGeometryAttributes(
  view: THREE.BufferGeometry,
  source: THREE.BufferGeometry,
) {
  for (const [name, attribute] of Object.entries(source.attributes))
    view.setAttribute(name, attribute);
}
export function disposeGeometryView(view: THREE.BufferGeometry) {
  // Three deletes GPU buffers on dispose, even when another geometry shares them.
  for (const name of Object.keys(view.attributes)) view.deleteAttribute(name);
  view.dispose();
}
