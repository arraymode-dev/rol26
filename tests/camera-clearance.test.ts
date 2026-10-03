import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { applyCameraClearance } from "../src/lib/camera-clearance.ts";

test("camera cutaway composes shader hooks, supports instancing and restores shared materials", () => {
  const material = new THREE.MeshStandardMaterial();
  let calls = 0;
  const previous = () => {
    calls++;
  };
  material.onBeforeCompile = previous;
  material.customProgramCacheKey = () => "existing-palette";
  const originalKey = material.customProgramCacheKey;
  const root = new THREE.Group();
  root.add(new THREE.Mesh(new THREE.BoxGeometry(), material));
  root.add(new THREE.InstancedMesh(new THREE.BoxGeometry(), material, 2));
  const restore = applyCameraClearance(root, [10, 20]);
  const shader = {
    vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    uniforms: {},
  };
  material.onBeforeCompile(
    shader as THREE.WebGLProgramParametersWithUniforms,
    {} as THREE.WebGLRenderer,
  );
  assert.equal(calls, 1);
  assert.ok(shader.vertexShader.includes("instanceMatrix * clearancePosition"));
  assert.ok(shader.fragmentShader.includes("cameraPosition, clearanceWorld"));
  assert.ok(shader.fragmentShader.includes("coverage >= visibility"));
  assert.match(
    material.customProgramCacheKey(),
    /^existing-palette-camera-clearance/,
  );
  assert.equal(material.transparent, false);
  restore();
  assert.equal(material.onBeforeCompile, previous);
  assert.equal(material.customProgramCacheKey, originalKey);
});
