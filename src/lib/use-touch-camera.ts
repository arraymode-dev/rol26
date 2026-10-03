import { useEffect, type RefObject } from "react";
import { useThree } from "@react-three/fiber";
import type { PerspectiveCamera } from "three";
import type { OrbitControls } from "three-stdlib";
import { attachTouchCamera } from "./touch-controls";

/** Native map gestures: one finger pans; two pinch, twist and tilt together. */
export function useTouchCamera(
  controls: RefObject<OrbitControls | null>,
  interrupt: () => void,
  reducedMotion: boolean,
  resetKey: string,
) {
  const { camera, gl, invalidate } = useThree();
  useEffect(
    () =>
      attachTouchCamera(
        gl.domElement,
        camera as PerspectiveCamera,
        () => controls.current,
        interrupt,
        invalidate,
        window,
        { reducedMotion },
      ),
    [camera, gl, invalidate, controls, interrupt, reducedMotion, resetKey],
  );
}
