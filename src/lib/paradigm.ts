import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// Illustrative dimensions inferred from the people in the supplied reference.
export const PARADIGM = { radius: 3, centreY: 3.3, rays: 280 };
export function buildParadigm() {
  const rods: THREE.BufferGeometry[] = [],
    sockets: THREE.BufferGeometry[] = [],
    tips: THREE.BufferGeometry[] = [];
  const glows: number[] = [];
  const centre = new THREE.Vector3(0, PARADIGM.centreY, 0);
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < PARADIGM.rays; i++) {
    // Evenly distributed directions keep the globe round from every map angle.
    const y = 1 - (2 * (i + 0.5)) / PARADIGM.rays,
      angle = i * Math.PI * (3 - Math.sqrt(5));
    const r = Math.sqrt(1 - y * y),
      dir = new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r);
    const radius = PARADIGM.radius - (i % 5) * 0.045;
    const rotation = new THREE.Quaternion().setFromUnitVectors(up, dir);
    const cylinder = (start: number, end: number, thickness: number) => {
      const g = new THREE.CylinderGeometry(
        thickness,
        thickness,
        end - start,
        5,
      );
      g.applyQuaternion(rotation);
      g.translate(
        ...centre
          .clone()
          .addScaledVector(dir, (start + end) / 2)
          .toArray(),
      );
      return g;
    };
    rods.push(cylinder(0.8, radius - 0.14, 0.022));
    sockets.push(cylinder(radius - 0.23, radius - 0.04, 0.064));
    const tip = new THREE.SphereGeometry(0.073, 6, 4);
    const p = centre.clone().addScaledVector(dir, radius);
    tip.translate(...p.toArray());
    tips.push(tip);
    glows.push(...p.toArray());
  }
  const merge = (parts: THREE.BufferGeometry[]) => {
    const geometry = mergeGeometries(parts, false)!;
    parts.forEach((p) => p.dispose());
    return geometry;
  };
  const glowGeometry = new THREE.BufferGeometry();
  glowGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(glows, 3),
  );
  return {
    rods: merge(rods),
    sockets: merge(sockets),
    tips: merge(tips),
    glows: glowGeometry,
  };
}
