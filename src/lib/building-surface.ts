import * as THREE from "three";

/** Explicit surface roles survive material batching and the palette/light passes. */
export function isGlazingSurface(mesh: THREE.Mesh) {
  return ["glass", "glazing", "window", "door", "tunnel"].includes(
    mesh.userData.buildingSurface,
  );
}
export function isDarkBuildingSurface(mesh: THREE.Mesh) {
  const role = mesh.userData.buildingSurface;
  if (role === "roof") return false;
  if (isGlazingSurface(mesh) || ["metal", "iron"].includes(role)) return true;
  const material = mesh.material;
  return (
    material instanceof THREE.MeshStandardMaterial &&
    material.color.getHSL({ h: 0, s: 0, l: 0 }).l < 0.09
  );
}
