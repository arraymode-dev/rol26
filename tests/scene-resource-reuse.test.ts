import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  splitGhostGeometry,
  markBuildingGeometry,
  disposeGeometryView,
} from "../src/lib/ghost-geometry.ts";
import { applyCameraClearance } from "../src/lib/camera-clearance.ts";

function triangles(g: T.BufferGeometry) {
  const p = g.getAttribute("position");
  const n = Math.min(g.drawRange.count, g.index?.count ?? p.count);
  return Array.from({ length: n }, (_, i) => {
    const v = g.index?.getX(i) ?? i;
    return [p.getX(v), p.getY(v), p.getZ(v)];
  });
}
test("persistent cutaway views preserve all wall, window and furniture triangles without copying vertex buffers", () => {
  const parts = [
    new T.BoxGeometry(10, 20, 10),
    new T.BoxGeometry(2, 3, 0.1).translate(0, 8, 5.1),
    new T.BoxGeometry(10, 20, 10).translate(80, 10, 0),
    new T.BoxGeometry(100, 0.2, 100),
  ];
  parts.forEach((g, i) => markBuildingGeometry(g, i < 3));
  const source = mergeGeometries(parts);
  const footprint = {
    points: [
      [-6, -6],
      [6, -6],
      [6, 6],
      [-6, 6],
    ] as [number, number][],
  };
  const expected = splitGhostGeometry(source, new T.Matrix4(), [footprint])!;
  const cached = splitGhostGeometry(
    source,
    new T.Matrix4(),
    [footprint],
    false,
    false,
    true,
  )!;
  for (const key of ["solid", "ghost"] as const) {
    assert.deepEqual(triangles(cached[key]), triangles(expected[key]));
    for (const attribute of Object.keys(source.attributes))
      assert.equal(
        cached[key].getAttribute(attribute),
        source.getAttribute(attribute),
      );
    cached[key].addEventListener("dispose", () =>
      assert.equal(
        Object.keys(cached[key].attributes).length,
        0,
        "shared GPU attributes are not deleted with the view",
      ),
    );
    disposeGeometryView(cached[key]);
    expected[key].dispose();
  }
  assert.ok(source.getAttribute("position").count > 0);
  parts.forEach((g) => g.dispose());
  source.dispose();
});
test("selection updates the clearance uniform without recreating materials and overlays follow cutaway geometry", () => {
  const group = new T.Group();
  const geometry = new T.BoxGeometry(20, 30, 20);
  const material = new T.MeshStandardMaterial();
  const mesh = new T.Mesh(geometry, material);
  group.add(mesh);
  const clearance = applyCameraClearance(group, null);
  const shader = {
    uniforms: {},
    vertexShader: "#include <common>\n#include <project_vertex>",
    fragmentShader:
      "#include <common>\n#include <clipping_planes_fragment>\n#include <opaque_fragment>",
  } as unknown as T.WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader, {} as T.WebGLRenderer);
  const uniform = shader.uniforms.clearanceFocus;
  const version = material.version;
  const overlay = mesh.children[0] as T.Mesh;
  for (let i = 0; i < 100; i++) clearance.setFocus([i, -i]);
  assert.equal(shader.uniforms.clearanceFocus, uniform);
  assert.deepEqual(uniform.value.toArray(), [99, 1, -99]);
  assert.equal(material.version, version);
  assert.equal(mesh.material, material);
  assert.equal(mesh.children[0], overlay);
  const replacement = new T.BoxGeometry(10, 10, 10);
  mesh.geometry = replacement;
  clearance.update(new T.Vector3(0, 0, 0));
  assert.equal(overlay.geometry, replacement);
  assert.equal(overlay.visible, true);
  clearance.update(new T.Vector3(1000, 0, 0));
  assert.equal(overlay.visible, false);
  clearance.setFocus(null);
  assert.deepEqual(uniform.value.toArray(), [0, 0, 0]);
  clearance();
  assert.equal(mesh.children.length, 0);
  geometry.dispose();
  replacement.dispose();
  material.dispose();
});

test("GPU warmup restores hidden objects and culling before the presented frame, including on failure", async () => {
  const { warmScene } = await import("../src/lib/scene-warmup.ts");
  const scene = new T.Scene(),
    group = new T.Group(),
    mesh = new T.Mesh(new T.BoxGeometry(), new T.MeshBasicMaterial());
  const hiddenLight = new T.PointLight();
  group.add(hiddenLight);
  scene.add(group);
  group.add(mesh);
  group.visible = false;
  mesh.frustumCulled = false;
  let renders = 0;
  warmScene(scene, () => {
    renders++;
    assert.equal(group.visible, renders === 1);
    assert.equal(mesh.frustumCulled, false);
    assert.equal(
      hiddenLight.visible,
      renders !== 1,
      "warmup must preserve the effective light count",
    );
  });
  assert.equal(renders, 2);
  assert.equal(group.visible, false);
  assert.equal(group.frustumCulled, true);
  assert.throws(
    () =>
      warmScene(scene, () => {
        throw Error("context lost");
      }),
    /context lost/,
  );
  assert.equal(group.visible, false);
  assert.equal(group.frustumCulled, true);
  mesh.geometry.dispose();
  (mesh.material as T.Material).dispose();
});

test("fading the Anooki spill preserves light and shadow layout without rendering unused shadows", async () => {
  const { updateStablePointLight } = await import("../src/lib/stable-light.ts");
  const light = new T.PointLight();
  light.castShadow = true;
  updateStablePointLight(light, 0);
  assert.equal(
    light.shadow.needsUpdate,
    true,
    "allocate the shadow once during loading",
  );
  const map = new T.WebGLRenderTarget(1, 1);
  light.shadow.map = map;
  for (const intensity of [15, 2, 0, 0, 1, 15]) {
    updateStablePointLight(light, intensity);
    assert.equal(light.visible, true);
    assert.equal(light.castShadow, true);
    assert.equal(light.shadow.map, map);
    assert.equal(light.shadow.autoUpdate, false);
    assert.equal(light.shadow.needsUpdate, intensity > 0);
    assert.equal(light.intensity, intensity);
  }
  light.dispose();
});
