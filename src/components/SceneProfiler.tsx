import { useEffect, useMemo, useRef, useState } from "react";
import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import type { OrbitControls } from "three-stdlib";
import * as THREE from "three";

type Sample = {
  frame: number;
  cpu: number;
  gpu?: number;
  calls: number;
  triangles: number;
  programs: number;
};
/** Opt-in development benchmark. Timings cover both scene render passes. */
export function SceneProfiler() {
  const { gl, invalidate } = useThree();
  const [report, setReport] = useState("Ready");
  const run = useRef<{
    start: number;
    transition: boolean;
    initialPrograms: Set<string>;
    previous: number;
    samples: Sample[];
    camera: THREE.Vector3 | null;
    target: THREE.Vector3 | null;
  } | null>(null);
  const gpu = useMemo(() => {
    const context = gl.getContext() as WebGL2RenderingContext;
    const ext = context.getExtension("EXT_disjoint_timer_query_webgl2");
    return {
      context,
      ext,
      pending: [] as { query: WebGLQuery; sample: Sample }[],
      active: null as WebGLQuery | null,
    };
  }, [gl]);
  const before = useRef(0),
    sample = useRef<Sample | null>(null);
  const scratch = useMemo(() => new THREE.Vector3(), []);
  const axis = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  useEffect(() => {
    const auto = gl.info.autoReset;
    gl.info.autoReset = false;
    return () => {
      gl.info.autoReset = auto;
      gpu.pending.forEach((p) => gpu.context.deleteQuery(p.query));
    };
  }, [gl, gpu]);
  useFrame(({ camera, controls }, delta) => {
    const state = run.current;
    if (!state || !controls || state.transition) return;
    const orbit = controls as OrbitControls;
    if (!state.camera) {
      state.camera = camera.position.clone();
      state.target = orbit.target.clone();
    }
    scratch
      .copy(camera.position)
      .sub(orbit.target)
      .applyAxisAngle(axis, Math.min(delta, 0.05) * 0.07);
    camera.position.copy(orbit.target).add(scratch);
    orbit.update();
  }, 0.8);
  useFrame(() => {
    const state = run.current;
    if (!state) return;
    const { context, ext } = gpu;
    for (let i = gpu.pending.length - 1; i >= 0; i--) {
      const p = gpu.pending[i];
      if (context.getQueryParameter(p.query, context.QUERY_RESULT_AVAILABLE)) {
        if (!context.getParameter(ext.GPU_DISJOINT_EXT))
          p.sample.gpu =
            context.getQueryParameter(p.query, context.QUERY_RESULT) / 1e6;
        context.deleteQuery(p.query);
        gpu.pending.splice(i, 1);
      }
    }
    const now = performance.now();
    sample.current = {
      frame: now - state.previous,
      cpu: 0,
      calls: 0,
      triangles: 0,
      programs: 0,
    };
    state.previous = now;
    gl.info.reset();
    if (ext && gpu.pending.length < 12) {
      gpu.active = context.createQuery();
      context.beginQuery(ext.TIME_ELAPSED_EXT, gpu.active!);
    }
    before.current = performance.now();
  }, 0.99);
  useFrame(({ camera, controls }) => {
    const state = run.current,
      p = sample.current;
    if (!state || !p) return;
    p.cpu = performance.now() - before.current;
    if (gpu.active) {
      gpu.context.endQuery(gpu.ext.TIME_ELAPSED_EXT);
      gpu.pending.push({ query: gpu.active, sample: p });
      gpu.active = null;
    }
    p.calls = gl.info.render.calls;
    p.triangles = gl.info.render.triangles;
    p.programs = gl.info.programs?.length ?? 0;
    const elapsed = performance.now() - state.start;
    if (state.transition || elapsed > 1000) state.samples.push(p);
    if (elapsed >= (state.transition ? 4000 : 7000)) {
      const percentile = (key: keyof Sample, fraction: number) => {
        const ns = state.samples
          .flatMap((s) => (typeof s[key] === "number" ? [s[key]!] : []))
          .sort((a, b) => a - b);
        return ns.length
          ? +ns[
              Math.min(ns.length - 1, Math.floor(ns.length * fraction))
            ].toFixed(2)
          : null;
      };
      setReport(
        JSON.stringify(
          {
            shaderCompilations: (gl.info.programs ?? []).filter(
              (p) => !state.initialPrograms.has(p.cacheKey),
            ).length,
            newPrograms: (gl.info.programs ?? [])
              .filter((p) => !state.initialPrograms.has(p.cacheKey))
              .map((p) => p.cacheKey),
            samples: state.samples.length,
            transition: state.transition,
            frameMax: Math.max(...state.samples.map((s) => s.frame)),
            over50ms: state.samples.filter((s) => s.frame > 50).length,
            slowFrames: state.samples.flatMap((s, i) =>
              s.frame > 16.7
                ? [
                    {
                      index: i,
                      programs: state.samples[i - 1]?.programs,
                      previousPrograms: state.samples[i - 2]?.programs,
                      frame: +s.frame.toFixed(1),
                      previousCPU: +(state.samples[i - 1]?.cpu ?? 0).toFixed(1),
                    },
                  ]
                : [],
            ),
            firstFrames: state.samples
              .slice(0, 12)
              .map((s) => +s.frame.toFixed(1)),
            viewport: [gl.domElement.clientWidth, gl.domElement.clientHeight],
            dpr: gl.getPixelRatio(),
            fps: +(
              1000 /
              (state.samples.reduce((sum, s) => sum + s.frame, 0) /
                state.samples.length)
            ).toFixed(1),
            frameP50: percentile("frame", 0.5),
            frameP95: percentile("frame", 0.95),
            cpuP50: percentile("cpu", 0.5),
            gpuP50: percentile("gpu", 0.5),
            gpuP95: percentile("gpu", 0.95),
            drawCalls: percentile("calls", 0.5),
            triangles: percentile("triangles", 0.5),
          },
          null,
          2,
        ),
      );
      if (state.camera && controls) {
        camera.position.copy(state.camera);
        (controls as OrbitControls).target.copy(state.target!);
        (controls as OrbitControls).update();
      }
      run.current = null;
    }
    invalidate();
  }, 1.1);
  return (
    <Html
      calculatePosition={() => [0, 0]}
      zIndexRange={[100000, 100000]}
      style={{ pointerEvents: "none" }}
    >
      <aside
        style={{
          position: "fixed",
          left: 16,
          top: 110,
          zIndex: 100000,
          background: "#07141ded",
          color: "white",
          padding: 12,
          borderRadius: 8,
          fontSize: 11,
          width: 230,
          maxWidth: "calc(100vw - 32px)",
          maxHeight: 460,
          overflow: "auto",
          pointerEvents: "auto",
        }}
      >
        <button
          style={{
            color: "white",
            background: "#493bb0",
            padding: "6px 10px",
            border: 0,
            borderRadius: 4,
          }}
          onClick={() => {
            const now = performance.now();
            run.current = {
              start: now,
              transition: false,
              initialPrograms: new Set(
                (gl.info.programs ?? []).map((p) => p.cacheKey),
              ),
              previous: now,
              samples: [],
              camera: null,
              target: null,
            };
            setReport("Profiling… 1s warm-up + 6s orbit");
            invalidate();
          }}
        >
          Run scene profile
        </button>
        <button
          onClick={() => {
            const now = performance.now();
            run.current = {
              start: now,
              previous: now,
              samples: [],
              camera: null,
              target: null,
              transition: true,
              initialPrograms: new Set(
                (gl.info.programs ?? []).map((p) => p.cacheKey),
              ),
            };
            setReport("Recording transition… select an artwork");
            invalidate();
          }}
        >
          Record next transition
        </button>
        <pre aria-label="Scene profile results">{report}</pre>
      </aside>
    </Html>
  );
}
