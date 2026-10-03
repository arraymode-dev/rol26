import { memo, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as T from "three";
import {
  buildRide,
  cabinPosition,
  rideActive,
  rideAngle,
  type RideKind,
} from "../lib/ride-models";
import kings from "../data/kings-parade.json" with { type: "json" };
import pump from "../data/pump-house.json" with { type: "json" };

const Ride = memo(function Ride({
  kind,
  night,
  reducedMotion,
}: {
  kind: RideKind;
  night: boolean;
  reducedMotion: boolean;
}) {
  const invalidate = useThree((s) => s.invalidate);
  const rotor = useRef<T.Group>(null);
  const active = useRef(false),
    angle = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const worldCentre = useMemo(
    () =>
      new T.Vector3(
        ...((kind === "wheel"
          ? [kings.wheel.center[0], 31, kings.wheel.center[1]]
          : [pump.carousel.center[0], 3, pump.carousel.center[1]]) as [
          number,
          number,
          number,
        ]),
      ),
    [kind],
  );
  const assets = useMemo(() => {
    const batches = buildRide(kind);
    const paint = new T.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.68,
    });
    const glow = new T.MeshBasicMaterial({
      vertexColors: true,
      toneMapped: false,
    });
    const cabins = batches
      .filter((b) => b.layer === "cabin")
      .map((b) => {
        const mesh = new T.InstancedMesh(b.geometry, b.glow ? glow : paint, 36);
        mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
        // Constant conservative bounds avoid a per-frame bounds rebuild.
        mesh.boundingSphere = new T.Sphere(new T.Vector3(), 33);
        return mesh;
      });
    const matrix = new T.Matrix4();
    const updateCabins = (a: number) => {
      for (let i = 0; i < 36; i++) {
        matrix.makeTranslation(...cabinPosition(i, a));
        for (const m of cabins) m.setMatrixAt(i, matrix);
      }
      for (const m of cabins) m.instanceMatrix.needsUpdate = true;
    };
    updateCabins(0);
    return { batches, paint, glow, cabins, updateCabins };
  }, [kind]);
  const view = useMemo(
    () => ({
      frustum: new T.Frustum(),
      matrix: new T.Matrix4(),
      bounds: new T.Sphere(worldCentre, kind === "wheel" ? 34 : 9),
    }),
    [kind, worldCentre],
  );
  useEffect(() => {
    assets.glow.color.set(night ? "#ffffff" : "#8d877c");
    invalidate();
  }, [night, assets, invalidate]);
  useEffect(() => {
    const wake = () => {
      if (document.hidden && timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      invalidate();
    };
    document.addEventListener("visibilitychange", wake);
    return () => {
      document.removeEventListener("visibilitychange", wake);
      if (timer.current) clearTimeout(timer.current);
      assets.batches.forEach((b) => b.geometry.dispose());
      assets.paint.dispose();
      assets.glow.dispose();
      assets.cabins.forEach((m) => m.dispose());
    };
  }, [assets, invalidate]);
  useFrame(({ camera }, delta) => {
    view.frustum.setFromProjectionMatrix(
      view.matrix.multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse,
      ),
    );
    active.current = rideActive(
      kind,
      camera.position.distanceTo(worldCentre),
      active.current,
      reducedMotion,
      !document.hidden && view.frustum.intersectsSphere(view.bounds),
    );
    if (!active.current) {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      return;
    }
    angle.current = rideAngle(angle.current, delta, kind);
    if (kind === "wheel") {
      rotor.current!.rotation.z = angle.current;
      assets.updateCabins(angle.current);
    } else rotor.current!.rotation.y = angle.current;
    // Wake demand rendering at 30 Hz only while close. No React state updates,
    // new geometry, dynamic point lights or idle animation loop at overview.
    if (!timer.current)
      timer.current = setTimeout(() => {
        timer.current = null;
        invalidate();
      }, 33);
  });
  const mesh = (layer: string) =>
    assets.batches
      .filter((b) => b.layer === layer)
      .map((b, i) => (
        <mesh
          key={i}
          geometry={b.geometry}
          material={b.glow ? assets.glow : assets.paint}
        />
      ));
  return (
    <group
      position={
        kind === "wheel"
          ? [kings.wheel.center[0], 31, kings.wheel.center[1]]
          : [pump.carousel.center[0], 0, pump.carousel.center[1]]
      }
      rotation-y={kind === "wheel" ? kings.wheel.angle : 0}
    >
      {mesh("static")}
      <group ref={rotor}>{mesh("rotor")}</group>
      {assets.cabins.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </group>
  );
});
export function DockRides({
  night,
  reducedMotion,
}: {
  night: boolean;
  reducedMotion: boolean;
}) {
  return (
    <>
      <Ride kind="wheel" night={night} reducedMotion={reducedMotion} />
      <Ride kind="carousel" night={night} reducedMotion={reducedMotion} />
    </>
  );
}
