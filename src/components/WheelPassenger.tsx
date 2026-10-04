import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as T from "three";
import { cabinPosition } from "../lib/ride-models";
import {
  PASSENGER_CABIN,
  PASSENGER_WINDOW,
  passengerFade,
  passengerMaterial,
  passengerVisible,
} from "../lib/wheel-passenger";

export function WheelPassenger({
  angle,
  night,
}: {
  angle: RefObject<number>;
  night: boolean;
}) {
  const group = useRef<T.Group>(null);
  const [requested, setRequested] = useState(false);
  const [material, setMaterial] = useState<T.ShaderMaterial | null>(null);
  const invalidate = useThree((s) => s.invalidate);
  const view = useMemo(
    () => ({
      position: new T.Vector3(),
      normal: new T.Vector3(),
      eye: new T.Vector3(),
      rotation: new T.Quaternion(),
      frustum: new T.Frustum(),
      matrix: new T.Matrix4(),
      sphere: new T.Sphere(new T.Vector3(), 2),
    }),
    [],
  );
  useEffect(() => {
    if (!requested) return;
    let disposed = false;
    let shader: T.ShaderMaterial | undefined;
    const texture = new T.TextureLoader().load(
      "/images/wheel-passenger.webp",
      () => {
        if (disposed) {
          texture.dispose();
          return;
        }
        texture.colorSpace = T.SRGBColorSpace;
        texture.anisotropy = 2;
        shader = passengerMaterial(texture, night);
        setMaterial(shader);
        invalidate();
      },
      undefined,
      () => {
        /* Preserve the ordinary window if the asset is unavailable. */
      },
    );
    return () => {
      disposed = true;
      shader?.dispose();
      texture.dispose();
    };
    // Night changes update only a uniform below, not the texture allocation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requested, invalidate]);
  useEffect(() => {
    if (material) material.uniforms.illumination.value = night ? 0.72 : 1;
    invalidate();
  }, [night, material, invalidate]);
  useFrame(({ camera }) => {
    const object = group.current;
    if (!object) return;
    object.position.set(...cabinPosition(PASSENGER_CABIN, angle.current));
    object.getWorldPosition(view.position);
    object.getWorldQuaternion(view.rotation);
    view.normal.set(-1, 0, 0).applyQuaternion(view.rotation);
    view.eye.copy(camera.position).sub(view.position);
    view.frustum.setFromProjectionMatrix(
      view.matrix.multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse,
      ),
    );
    view.sphere.center.copy(view.position);
    const visible = passengerVisible(
      view.eye.length(),
      true,
      !document.hidden &&
        view.eye.dot(view.normal) > 0 &&
        view.frustum.intersectsSphere(view.sphere),
    );
    object.visible = visible && !!material;
    if (visible && !requested) setRequested(true);
    if (material)
      material.uniforms.fade.value = passengerFade(view.eye.length());
  });
  return (
    <group ref={group} visible={false}>
      {material && (
        <mesh
          position={PASSENGER_WINDOW.position}
          rotation-y={PASSENGER_WINDOW.rotation}
          material={material}
        >
          <planeGeometry
            args={[PASSENGER_WINDOW.width, PASSENGER_WINDOW.height]}
          />
        </mesh>
      )}
    </group>
  );
}
