import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  isDarkBuildingSurface,
  isGlazingSurface,
} from "../src/lib/building-surface.ts";
import { applyEventSurfaceLighting } from "../src/lib/event-lighting.ts";
import { buildAnchorCourtyard } from "../src/lib/anchor-courtyard.ts";
import { hiddenTrailOpacity } from "../src/lib/trail-visibility.ts";
import { applyCameraClearance } from "../src/lib/camera-clearance.ts";
import { GHOST_DEPTH_LAYER } from "../src/lib/scene-layers.ts";

test("light glass remains glazing and dark roofs retain the masonry palette", () => {
  const mesh = new T.Mesh(
    new T.BoxGeometry(),
    new T.MeshStandardMaterial({ color: "#647b7c" }),
  );
  mesh.userData.buildingSurface = "glass";
  assert.equal(isDarkBuildingSurface(mesh), true);
  assert.equal(isGlazingSurface(mesh), true);
  mesh.material.color.set("#354047");
  mesh.userData.buildingSurface = "roof";
  assert.equal(isDarkBuildingSurface(mesh), false);
  mesh.geometry.dispose();
  mesh.material.dispose();
});
test("event masonry illumination never paints over window recesses", () => {
  const root = new T.Group();
  const window = new T.Mesh(
    new T.BoxGeometry(2, 3, 0.3),
    new T.MeshStandardMaterial(),
  );
  window.position.set(-300, 10, -150);
  window.userData.buildingSurface = "glass";
  const wall = new T.Mesh(
    new T.BoxGeometry(50, 40, 50),
    new T.MeshStandardMaterial(),
  );
  wall.position.set(-300, 20, -150);
  root.add(window, wall);
  const glassMaterial = window.material,
    stoneMaterial = wall.material;
  const reset = applyEventSurfaceLighting(root, [
    {
      id: "24611033",
      points: [
        [-325, -175],
        [-275, -175],
        [-275, -125],
        [-325, -125],
      ],
      height: 94,
    },
  ]);
  assert.equal(window.material, glassMaterial);
  assert.notEqual(wall.material, stoneMaterial);
  reset();
  for (const mesh of [window, wall]) {
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
});
test("warehouse windows stay architectural at all distances and cover both long wings", () => {
  const parts = buildAnchorCourtyard();
  const glass = parts.find((p) => p.material === "glass")!;
  assert.equal(glass.architectural, true);
  glass.geometry.computeBoundingBox();
  // Both warehouse wings extend well beyond the old 70m courtyard cutoff.
  assert.ok(
    glass.geometry.boundingBox!.getSize(new T.Vector3()).length() > 150,
  );
  parts.forEach((p) => p.geometry.dispose());
});
test("route reveal is zero up close and gently increases only at overview distances", () => {
  for (const d of [0, 50, 90, 150, 280]) assert.equal(hiddenTrailOpacity(d), 0);
  assert.equal(hiddenTrailOpacity(390), 0.1);
  assert.equal(hiddenTrailOpacity(500), 0.2);
  assert.equal(hiddenTrailOpacity(3000), 0.2);
});
test("fading walls and trees still contribute their full silhouette to route occlusion", () => {
  const root = new T.Group();
  const geometry = new T.BoxGeometry(10, 20, 10);
  const material = new T.MeshStandardMaterial();
  const mesh = new T.InstancedMesh(geometry, material, 1);
  root.add(mesh);
  const reset = applyCameraClearance(root, null);
  const overlay = mesh.children[0] as T.InstancedMesh;
  assert.ok(overlay.layers.isEnabled(GHOST_DEPTH_LAYER));
  assert.equal(overlay.instanceMatrix, mesh.instanceMatrix);
  reset.update(new T.Vector3(0, 10, 0));
  assert.equal(overlay.visible, true);
  reset.update(new T.Vector3(1000, 10, 0));
  assert.equal(overlay.visible, false);
  reset();
  geometry.dispose();
  material.dispose();
});

test("courtyard cutaways omit panes, bars and sills while keeping distant windows and paving", async () => {
  const { splitGhostGeometry, disposeGeometryView } =
    await import("../src/lib/ghost-geometry.ts");
  const { ANCHOR_ORIGIN } = await import("../src/lib/anchor-courtyard.ts");
  const parts = buildAnchorCourtyard();
  const matrix = new T.Matrix4().makeTranslation(
    ANCHOR_ORIGIN[0],
    0,
    ANCHOR_ORIGIN[1],
  );
  const footprints = [
    {
      points: [
        [50, 460],
        [110, 460],
        [110, 515],
        [50, 515],
      ] as [number, number][],
    },
  ];
  let removed = 0,
    retained = 0;
  for (const part of parts) {
    const split = splitGhostGeometry(
      part.geometry,
      matrix,
      footprints,
      false,
      false,
      true,
    );
    if (split) {
      const tags = split.ghost.getAttribute("facadeDetail");
      for (const index of split.ghost.index!.array)
        assert.equal(tags.getX(index), 0);
      if (part.material === "glass") {
        removed +=
          part.geometry.getAttribute("position").count -
          split.solid.index!.count;
        retained += split.solid.index!.count;
      }
      if (part.material === "paving")
        assert.fail("paving must not become a cutaway");
      disposeGeometryView(split.solid);
      disposeGeometryView(split.ghost);
    }
    part.geometry.dispose();
  }
  assert.ok(removed > 0, "nearby windows are absent from both cutaway passes");
  assert.ok(retained > 0, "remote windows remain solid");
});

test("camera clearance suppresses courtyard facade details in both passes and restores them outside the fade", () => {
  const root = new T.Group();
  const parts = buildAnchorCourtyard();
  for (const part of parts)
    root.add(new T.Mesh(part.geometry, new T.MeshStandardMaterial()));
  const reset = applyCameraClearance(root, null);
  for (const mesh of root.children as T.Mesh[]) {
    for (const pass of [mesh, mesh.children[0] as T.Mesh]) {
      const shader = {
        vertexShader: T.ShaderLib.standard.vertexShader,
        fragmentShader: T.ShaderLib.standard.fragmentShader,
        uniforms: {},
      };
      const material = pass.material as T.Material;
      material.onBeforeCompile(
        shader as T.WebGLProgramParametersWithUniforms,
        {} as T.WebGLRenderer,
      );
      assert.match(shader.vertexShader, /clearanceFacadeDetail = facadeDetail/);
      assert.match(
        shader.fragmentShader,
        /if \(clearanceFacadeDetail > 0.5 && visibility < 0.999\) discard/,
      );
    }
  }
  reset();
  for (const mesh of root.children as T.Mesh[]) {
    mesh.geometry.dispose();
    (mesh.material as T.Material).dispose();
  }
});
