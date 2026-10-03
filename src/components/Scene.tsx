import { UserLocationMarker } from "./UserLocationMarker";
import type { TrailLocationStore } from "../lib/trail-location";
import { loadMap } from "../lib/map-loader";
import { useTouchCamera } from "../lib/use-touch-camera";
import { panelViewOffset } from "../lib/touch-camera";
import {
  trailCameraPose,
  shouldRestoreTrailView,
  type CameraPose,
} from "../lib/trail-camera";
import { approachArtwork, faceArtworkSurface } from "../lib/artwork-camera";
import wappingSite from "../data/wapping-gate.json" with { type: "json" };
import { WAPPING_GATE } from "./WappingGate";
import { EventLighting } from "./EventLighting";
import { useIdleOrbit } from "../lib/use-idle-orbit";
import { TOWN_HALL, TOWN_HALL_FORECOURT } from "./TownHall";
import { MapSunlight } from "./MapSunlight";
import { SceneProfiler } from "./SceneProfiler";
import { BoundaryDepth } from "./BoundaryDepth";
import { Trail, type TrailData } from "./Trail";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, PerformanceMonitor } from "@react-three/drei";
import type { OrbitControls as OrbitType } from "three-stdlib";
import * as THREE from "three";
import { World } from "./World";
import { Artwork } from "./Artwork";
import { EXCHANGE } from "./ExchangeFlags";
import { GEORGES_DOCK } from "./GeorgesDock";
import { PIER_HEAD } from "./PierHead";
import { CHURCH_GARDENS } from "./ChurchGardens";
import { ST_PAULS } from "./StPaulsSquare";
import { installations } from "../data/installations";
import { project } from "../lib/geo";
import type { MapData, Survey } from "../types";
import surveyData from "../data/survey.json" with { type: "json" };
const survey = surveyData as Survey;
function applySurvey(data: MapData): MapData {
  return {
    ...data,
    buildings: data.buildings.flatMap((b) => {
      const o = survey.buildingOverrides.find((o) => o.id === b.id);
      return o?.hidden ? [] : [{ ...b, height: o?.height ?? b.height }];
    }),
    trees: [...data.trees, ...survey.additionalTrees.map((p) => project(...p))],
  };
}

export interface Command {
  kind: "overview" | "in" | "out" | "north" | "trail-on" | "trail-off";
  sequence: number;
}
export interface SceneProps {
  lowQuality: boolean;
  night: boolean;
  selected: string | null;
  seen: ReadonlySet<string>;
  trail: boolean;
  trailLocation: TrailLocationStore;
  command: Command;
  reducedMotion: boolean;
  onSelect: (id: string) => void;
  selectionSequence: number;
  onDeselect: () => void;
  onReady: () => void;
  onProgress: (stage: string) => void;
  onError: () => void;
}
export default function Scene(props: SceneProps) {
  const [data, setData] = useState<MapData | null>(null);
  const [mobile] = useState(
    () => matchMedia("(max-width: 700px), (pointer: coarse)").matches,
  );
  const [dpr, setDpr] = useState(mobile ? 1.25 : 1.5);
  useEffect(() => {
    let cancelled = false;
    loadMap()
      .then(applySurvey)
      .then((map) => {
        if (cancelled) return;
        props.onProgress("Building the city and its lights…");
        // Give the status text a paint before constructing the detailed geometry.
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            if (!cancelled) setData(map);
          }),
        );
      })
      .catch(() => {
        if (!cancelled) props.onError();
      });
    return () => {
      cancelled = true;
    };
  }, [props.onError, props.onProgress]);
  if (!data) return null;
  return (
    <Canvas
      shadows={!props.lowQuality}
      dpr={props.lowQuality ? 1 : dpr}
      frameloop="demand"
      camera={{ position: [-1030, 1250, 1320], fov: 42, near: 1, far: 16000 }}
      gl={{
        antialias: true,
        logarithmicDepthBuffer: true,
        powerPreference: "high-performance",
      }}
      onCreated={({ gl }) => {
        gl.domElement.setAttribute(
          "aria-label",
          "Interactive 3D map of River of Light. Drag to pan; pinch or scroll to zoom.",
        );
        gl.domElement.setAttribute("tabindex", "0");
      }}
    >
      <color attach="background" args={[props.night ? "#152a36" : "#c4d6d3"]} />
      <fog
        attach="fog"
        args={[props.night ? "#152a36" : "#c4d6d3", 3200, 7200]}
      />
      <ambientLight intensity={props.night ? 0.85 : 0.65} />
      <hemisphereLight
        args={[
          props.night ? "#a4d8f3" : "#fff4db",
          props.night ? "#384e50" : "#b7b4a0",
          0.65,
        ]}
      />
      <MapSunlight
        night={props.night}
        shadows={!props.lowQuality}
        mobile={mobile}
      />
      <PerformanceMonitor onDecline={() => setDpr(1)}>
        <Content data={data} mobile={mobile} {...props} />
      </PerformanceMonitor>
    </Canvas>
  );
}
function Content({
  data,
  mobile,
  ...props
}: SceneProps & { data: MapData; mobile: boolean }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const onHover = useCallback((id: string, active: boolean) => {
    setHovered((current) => (active ? id : current === id ? null : current));
  }, []);
  const highlightedBeam = hovered ?? props.selected;
  const previousBeamFocus = useRef<string | null>(null);
  useEffect(() => {
    if (highlightedBeam) previousBeamFocus.current = highlightedBeam;
  }, [highlightedBeam]);
  const beamOriginId = highlightedBeam ?? previousBeamFocus.current;
  const beamOrigin = useMemo(() => {
    const item = installations.find((item) => item.id === beamOriginId);
    if (!item) return null;
    return item.id === "the-anooki"
      ? ([TOWN_HALL_FORECOURT.x, TOWN_HALL_FORECOURT.z] as [number, number])
      : project(...item.coordinates);
  }, [beamOriginId]);
  const focus = useMemo(() => {
    const a = installations.find((i) => i.id === props.selected);
    return a?.id === "the-anooki"
      ? ([TOWN_HALL_FORECOURT.x, TOWN_HALL_FORECOURT.z] as [number, number])
      : a
        ? project(...a.coordinates)
        : null;
  }, [props.selected]);
  const [route, setRoute] = useState<TrailData>({ segments: [], ribbons: [] });
  useEffect(() => {
    if (!props.trail || route.segments.length) return;
    const controller = new AbortController();
    fetch("/data/trail.json", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((r) =>
        setRoute({ segments: r.segments || [], ribbons: r.ribbons || [] }),
      )
      .catch(() => {});
    return () => controller.abort();
  }, [props.trail, route.segments.length]);
  return (
    <BoundaryDepth active={!!focus} lowQuality={props.lowQuality || mobile}>
      <FirstPaint onReady={props.onReady} />
      <World
        data={data}
        night={props.night}
        focus={focus}
        selected={props.selected}
        reducedMotion={props.reducedMotion || props.lowQuality}
      />
      {!props.lowQuality && <EventLighting night={props.night} />}
      {installations.map((item) => (
        <Artwork
          key={item.id}
          item={item}
          reducedMotion={props.reducedMotion}
          selectionSequence={props.selectionSequence}
          night={props.night}
          selected={props.selected === item.id}
          seen={props.seen.has(item.id)}
          showBeam={!highlightedBeam || highlightedBeam === item.id}
          beamOrigin={beamOrigin}
          onHover={onHover}
          onSelect={props.onSelect}
        />
      ))}
      {props.trail && (
        <Trail
          data={route}
          night={props.night}
          reducedMotion={props.reducedMotion}
        />
      )}
      {props.trail && <UserLocationMarker store={props.trailLocation} />}
      <CameraRig {...props} />
      {import.meta.env.DEV &&
        new URLSearchParams(location.search).has("profile") && (
          <SceneProfiler />
        )}
    </BoundaryDepth>
  );
}
// Runs after BoundaryDepth's render pass; readiness means pixels, not just a canvas.
function FirstPaint({ onReady }: { onReady: () => void }) {
  const rendered = useRef(false);
  useFrame(() => {
    if (!rendered.current) {
      rendered.current = true;
      requestAnimationFrame(onReady);
    }
  }, 2);
  return null;
}
function CameraRig({
  selected,
  trail,
  selectionSequence,
  onDeselect,
  command,
  reducedMotion,
  onError,
}: SceneProps) {
  const controls = useRef<OrbitType>(null);
  const { camera, invalidate, gl } = useThree();
  const idleOrbit = useIdleOrbit(
    selected,
    selectionSequence,
    reducedMotion,
    invalidate,
  );
  const orbitCentre = useRef(new THREE.Vector3());
  const orbitOffset = useMemo(() => new THREE.Vector3(), []);
  const orbitAxis = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const targetMotion = useRef<{
    from: THREE.Vector3;
    to: THREE.Vector3;
    lookFrom: THREE.Vector3;
    lookTo: THREE.Vector3;
    start: number;
  } | null>(null);
  const trailView = useRef<{
    previous: CameraPose;
    birdseye: CameraPose;
  } | null>(null);
  const cameraPose = (): CameraPose => ({
    position: camera.position.toArray(),
    target: controls.current!.target.toArray(),
  });
  const userZoom = useRef(false);
  const wheelDistance = useRef<number | null>(null);
  const zoomOffset = useMemo(() => new THREE.Vector3(), []);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const interruptTouch = useCallback(() => {
    wheelDistance.current = null;
    targetMotion.current = null;
    userZoom.current = true;
  }, []);
  useTouchCamera(
    controls,
    interruptTouch,
    reducedMotion,
    `${selected}:${selectionSequence}:${command.sequence}`,
  );
  useEffect(() => {
    const perspective = camera as THREE.PerspectiveCamera;
    const canvas = gl.domElement;
    const panel = document.querySelector(".detail-panel");
    const header = document.querySelector(".topbar");
    const footer = document.querySelector(".bottom-bar");
    const update = () => {
      if (canvas.clientWidth <= 700) {
        const rect = canvas.getBoundingClientRect();
        const offset = panelViewOffset(
          rect.height,
          (header?.getBoundingClientRect().bottom ?? rect.top) - rect.top,
          (panel?.getBoundingClientRect().top ??
            footer?.getBoundingClientRect().top ??
            rect.bottom) - rect.top,
        );
        perspective.setViewOffset(
          rect.width,
          rect.height,
          0,
          offset,
          rect.width,
          rect.height,
        );
      } else perspective.clearViewOffset();
      invalidate();
    };
    const observer = new ResizeObserver(update);
    observer.observe(canvas);
    if (panel) observer.observe(panel);
    if (header) observer.observe(header);
    if (footer) observer.observe(footer);
    // Toolbar expansion can move UI without resizing the large canvas.
    window.visualViewport?.addEventListener("resize", update);
    update();
    return () => {
      observer.disconnect();
      window.visualViewport?.removeEventListener("resize", update);
      perspective.clearViewOffset();
    };
  }, [camera, gl, selected, invalidate]);
  const overviewTarget = new THREE.Vector3(-40, 0, -70);
  const move = (to: THREE.Vector3, lookTo: THREE.Vector3) => {
    if (!controls.current) return;
    wheelDistance.current = null;
    targetMotion.current = null;
    if (reducedMotion) {
      camera.position.copy(to);
      controls.current.target.copy(lookTo);
      controls.current.update();
      invalidate();
      return;
    }
    targetMotion.current = {
      from: camera.position.clone(),
      to,
      lookFrom: controls.current.target.clone(),
      lookTo,
      start: performance.now(),
    };
    invalidate();
  };
  useEffect(() => {
    if (!selected || !controls.current) return;
    userZoom.current = false;
    const item = installations.find((i) => i.id === selected)!;
    const [mapX, mapZ] = project(...item.coordinates);
    const anchors: Record<string, { x: number; z: number }> = {
      "the-anooki": TOWN_HALL,
      together: WAPPING_GATE,
      unity: GEORGES_DOCK,
      "today-i-love-you": CHURCH_GARDENS,
      loop: ST_PAULS,
      "flower-power": EXCHANGE,
    };
    const { x, z } = anchors[selected] ?? { x: mapX, z: mapZ };
    const focus = new THREE.Vector3(
      x,
      selected === "the-anooki"
        ? 18
        : selected === "today-i-love-you"
          ? 13
          : selected === "together"
            ? 6.7
            : 4,
      z,
    );
    orbitCentre.current.copy(focus);
    if (selected === "the-anooki") {
      // The opening stop deliberately retains its centred street approach.
      move(new THREE.Vector3(x + 68, 90, z + 145), focus);
      return;
    }
    if (selected === "today-i-love-you") {
      // The church is the deliberate backdrop for stop 04, from every entry angle.
      move(new THREE.Vector3(x - 65, 83, z + 85), focus);
      return;
    }
    const distances: Record<string, number> = {
      "flower-power": 115,
      loop: 95,
      "today-i-love-you": 100,
      "invisible-cities": 110,
      "coloured-peonies": 110,
      unity: 95,
      "colour-rush": 85,
      "the-stars-come-out-at-night": 85,
      together: 75,
      paradigm: 80,
      "dream-herd": 100,
      pop: 100,
    };
    const destination = approachArtwork(
      camera.position,
      controls.current.target,
      focus,
      distances[selected] ?? 100,
      gl.domElement.clientWidth <= 700 ? Math.PI / 4 : undefined,
    );
    move(
      selected === "together"
        ? faceArtworkSurface(destination, focus, wappingSite.angle)
        : destination,
      focus,
    );
  }, [selected, selectionSequence]);
  useEffect(() => {
    if (!controls.current) return;
    if (command.kind === "out") userZoom.current = true;
    const t = controls.current.target.clone();
    if (command.kind === "trail-on") {
      const canvas = gl.domElement;
      const headerBottom =
        document.querySelector(".topbar")?.getBoundingClientRect().bottom ?? 0;
      const footerTop =
        document.querySelector(".bottom-bar")?.getBoundingClientRect().top ??
        canvas.clientHeight;
      const visibleHeight =
        canvas.clientWidth <= 700
          ? Math.max(160, footerTop - headerBottom - 24)
          : canvas.clientHeight;
      const visibleFov = THREE.MathUtils.radToDeg(
        2 *
          Math.atan(
            (Math.tan(
              THREE.MathUtils.degToRad(
                (camera as THREE.PerspectiveCamera).fov / 2,
              ),
            ) *
              visibleHeight) /
              canvas.clientHeight,
          ),
      );
      const birdseye = trailCameraPose(
        installations.map((item) => project(...item.coordinates)),
        canvas.clientWidth / visibleHeight,
        visibleFov,
      );
      trailView.current = { previous: cameraPose(), birdseye };
      userZoom.current = false;
      move(
        new THREE.Vector3(...birdseye.position),
        new THREE.Vector3(...birdseye.target),
      );
      return;
    }
    if (command.kind === "trail-off") {
      const saved = trailView.current;
      const motion = targetMotion.current;
      const destination = motion
        ? { position: motion.to.toArray(), target: motion.lookTo.toArray() }
        : undefined;
      if (
        saved &&
        shouldRestoreTrailView(cameraPose(), saved.birdseye, destination)
      ) {
        move(
          new THREE.Vector3(...saved.previous.position),
          new THREE.Vector3(...saved.previous.target),
        );
      }
      trailView.current = null;
      return;
    }
    if (command.kind === "overview")
      move(
        gl.domElement.clientWidth < 700
          ? new THREE.Vector3(-150, 2100, 1800)
          : new THREE.Vector3(-1030, 1250, 1320),
        overviewTarget,
      );
    if (command.kind === "north") {
      const d = camera.position.distanceTo(t);
      move(t.clone().add(new THREE.Vector3(0, d * 0.68, d * 0.73)), t);
    }
    if (command.kind === "in" || command.kind === "out")
      move(
        t.clone().add(
          camera.position
            .clone()
            .sub(t)
            .multiplyScalar(command.kind === "in" ? 0.72 : 1.4),
        ),
        t,
      );
  }, [command]);
  useEffect(() => {
    const canvas = gl.domElement;
    const wheel = (event: WheelEvent) => {
      const c = controls.current;
      if (!c || !c.enabled) return;
      // OrbitControls damps pan/rotation, but applies wheel dolly immediately.
      // Accumulate a destination instead, preserving fine trackpad deltas.
      event.preventDefault();
      event.stopImmediatePropagation();
      targetMotion.current = null;
      userZoom.current = true;
      const unit =
        event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? canvas.clientHeight
            : 1;
      const amount = THREE.MathUtils.clamp(
        event.deltaY * unit * (event.ctrlKey ? 0.005 : 0.0015),
        -0.3,
        0.3,
      );
      wheelDistance.current = THREE.MathUtils.clamp(
        (wheelDistance.current ?? camera.position.distanceTo(c.target)) *
          Math.exp(amount),
        c.minDistance,
        c.maxDistance,
      );
      invalidate();
    };
    const interrupt = () => {
      wheelDistance.current = null;
    };
    canvas.addEventListener("wheel", wheel, { capture: true, passive: false });
    canvas.addEventListener("pointerdown", interrupt, true);
    canvas.addEventListener("keydown", interrupt, true);
    window.addEventListener("blur", interrupt);
    return () => {
      canvas.removeEventListener("wheel", wheel, true);
      canvas.removeEventListener("pointerdown", interrupt, true);
      canvas.removeEventListener("keydown", interrupt, true);
      window.removeEventListener("blur", interrupt);
    };
  }, [camera, gl, invalidate]);
  useEffect(() => {
    const lost = (e: Event) => {
      e.preventDefault();
      onError();
    };
    gl.domElement.addEventListener("webglcontextlost", lost);
    return () => gl.domElement.removeEventListener("webglcontextlost", lost);
  }, [gl, onError]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (document.activeElement !== gl.domElement || !controls.current) return;
      targetMotion.current = null;
      const c = controls.current;
      const d = Math.max(8, camera.position.distanceTo(c.target) * 0.045);
      const shift = new THREE.Vector3();
      if (e.key === "ArrowUp") shift.z = -d;
      else if (e.key === "ArrowDown") shift.z = d;
      else if (e.key === "ArrowLeft") shift.x = -d;
      else if (e.key === "ArrowRight") shift.x = d;
      else if (e.key === "+" || e.key === "=") {
        move(
          c.target
            .clone()
            .add(camera.position.clone().sub(c.target).multiplyScalar(0.8)),
          c.target.clone(),
        );
        e.preventDefault();
        return;
      } else if (e.key === "-") {
        userZoom.current = true;
        move(
          c.target
            .clone()
            .add(camera.position.clone().sub(c.target).multiplyScalar(1.2)),
          c.target.clone(),
        );
        e.preventDefault();
        return;
      } else return;
      e.preventDefault();
      camera.position.add(shift);
      c.target.add(shift);
      c.update();
      invalidate();
    };
    gl.domElement.addEventListener("keydown", key);
    return () => gl.domElement.removeEventListener("keydown", key);
  }, [camera, gl, reducedMotion]);
  useFrame((_, delta) => {
    const m = targetMotion.current;
    if (!controls.current) return;
    if (wheelDistance.current !== null) {
      const c = controls.current;
      const distance = camera.position.distanceTo(c.target);
      const goal = wheelDistance.current;
      const blend = reducedMotion
        ? 1
        : 1 - Math.exp(-14 * Math.min(delta, 1 / 30));
      const next = THREE.MathUtils.lerp(distance, goal, blend);
      const settled = Math.abs(next - goal) < Math.max(0.01, goal * 0.0001);
      zoomOffset
        .copy(camera.position)
        .sub(c.target)
        .setLength(settled ? goal : next);
      camera.position.copy(c.target).add(zoomOffset);
      if (settled) wheelDistance.current = null;
      c.update();
      invalidate();
      return;
    }
    if (!m) {
      if (idleOrbit.current && selectedRef.current) {
        // About one third of a degree per second. Clamp the first demand-frame
        // delta so waking after inactivity cannot jump the camera.
        const angle = Math.min(delta, 0.05) * 0.006;
        for (const position of [camera.position, controls.current.target]) {
          orbitOffset
            .copy(position)
            .sub(orbitCentre.current)
            .applyAxisAngle(orbitAxis, angle);
          position.copy(orbitCentre.current).add(orbitOffset);
        }
        controls.current.update();
        invalidate();
      }
      return;
    }
    const t = Math.min(1, (performance.now() - m.start) / 950),
      e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    camera.position.lerpVectors(m.from, m.to, e);
    controls.current.target.lerpVectors(m.lookFrom, m.lookTo, e);
    controls.current.update();
    if (t === 1) targetMotion.current = null;
    invalidate();
  });
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={[-40, 0, -70]}
      enableDamping={!reducedMotion}
      dampingFactor={0.065}
      minDistance={70}
      maxDistance={trail ? 10000 : 3600}
      minPolarAngle={0.15}
      maxPolarAngle={Math.PI * 0.43}
      screenSpacePanning={false}
      mouseButtons={{
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE,
      }}
      touches={{ ONE: undefined, TWO: undefined }}
      onStart={() => {
        wheelDistance.current = null;
        userZoom.current = true;
        targetMotion.current = null;
      }}
      onChange={() => {
        if (
          selectedRef.current &&
          userZoom.current &&
          controls.current &&
          camera.position.distanceTo(controls.current.target) > 650
        ) {
          userZoom.current = false;
          onDeselect();
        }
        if (controls.current) {
          const t = controls.current.target,
            old = t.clone();
          t.x = THREE.MathUtils.clamp(t.x, -850, 850);
          t.z = THREE.MathUtils.clamp(t.z, -1000, 1000);
          camera.position.add(t.clone().sub(old));
        }
      }}
    />
  );
}
