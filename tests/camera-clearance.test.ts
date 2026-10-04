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
  assert.ok(shader.fragmentShader.includes("if (visibility < 0.999) discard;"));
  assert.match(
    material.customProgramCacheKey(),
    /^existing-palette-camera-clearance/,
  );
  assert.equal(material.transparent, false);
  const mesh = root.children[0] as THREE.Mesh;
  const overlay = mesh.children[0] as THREE.Mesh;
  const fade = overlay.material as THREE.MeshStandardMaterial;
  assert.equal(fade.transparent, true);
  assert.equal(fade.depthWrite, false);
  assert.equal(overlay.geometry, mesh.geometry);
  restore.update(new THREE.Vector3(0, 1000, 0));
  assert.equal(overlay.visible, false);
  restore.update(new THREE.Vector3(0, 20, 0));
  assert.equal(overlay.visible, true);
  const fadeShader = {
    vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    uniforms: {},
  };
  fade.onBeforeCompile(
    fadeShader as THREE.WebGLProgramParametersWithUniforms,
    {} as THREE.WebGLRenderer,
  );
  assert.match(fadeShader.fragmentShader, /diffuseColor.a \*= visibility/);
  assert.doesNotMatch(fadeShader.fragmentShader, /gl_FragCoord/);
  assert.match(fadeShader.fragmentShader, /visibility >= 0.999/);
  const instanced = root.children[1] as THREE.InstancedMesh;
  assert.equal(
    (instanced.children[0] as THREE.InstancedMesh).instanceMatrix,
    instanced.instanceMatrix,
  );
  restore();
  assert.equal(mesh.children.length, 0);
  assert.equal(instanced.children.length, 0);
  assert.equal(material.onBeforeCompile, previous);
  assert.equal(material.customProgramCacheKey, originalKey);
});

test("Together artwork vertices bypass proximity fading even without an active selection", () => {
  const root = new THREE.Group();
  const geometry = new THREE.BoxGeometry();
  geometry.setAttribute(
    "cameraProtected",
    new THREE.Float32BufferAttribute(
      new Float32Array(geometry.getAttribute("position").count).fill(1),
      1,
    ),
  );
  const material = new THREE.MeshStandardMaterial();
  root.add(new THREE.Mesh(geometry, material));
  const restore = applyCameraClearance(root, null);
  const shader = {
    vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    uniforms: {},
  };
  material.onBeforeCompile(
    shader as THREE.WebGLProgramParametersWithUniforms,
    {} as THREE.WebGLRenderer,
  );
  assert.match(shader.vertexShader, /clearanceProtected = cameraProtected/);
  assert.match(
    shader.fragmentShader,
    /if \(clearanceProtected > 0.5\) visibility = 1.0/,
  );
  assert.equal(
    (shader.uniforms as Record<string, { value: THREE.Vector3 }>).clearanceFocus
      .value.y,
    0,
  );
  restore();
  geometry.dispose();
  material.dispose();
});
