import { EVENT_POOLS } from "../lib/event-lighting";
import { Paradigm } from "./Paradigm";
import { PRIMARY } from "../lib/palette";
import { BoundaryMaterial } from "./BoundaryDepth";
import { memo, useMemo, useEffect, useLayoutEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { Installation } from "../types";
import { project } from "../lib/geo";
import { ATTRACTION_RADIUS } from "../lib/attraction-boundary";
import { AnookiOnColumns, TOWN_HALL, TOWN_HALL_FORECOURT } from "./TownHall";
import { WAPPING_GATE } from "./WappingGate";
import { KINGS_PLATFORM } from "./KingsParade";
import { GEORGES_DOCK } from "./GeorgesDock";
import { EXCHANGE } from "./ExchangeFlags";
import { CHURCH_GARDENS } from "./ChurchGardens";
import { ST_PAULS } from "./StPaulsSquare";
const palette = ["#ffa0d2", "#a8e2df", "#ffe293", "#b2a0ff", "#cde993"];
function Orb({
  p,
  s = 1,
  color,
  night,
}: {
  p: [number, number, number];
  s?: number | [number, number, number];
  color: string;
  night: boolean;
}) {
  return (
    <mesh position={p} scale={s} castShadow>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={night ? 0.8 : 0}
        roughness={0.5}
        flatShading
      />
    </mesh>
  );
}
function Rod({
  p,
  s,
  color,
  night = false,
}: {
  p: [number, number, number];
  s: [number, number, number];
  color: string;
  night?: boolean;
}) {
  return (
    <mesh position={p} castShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={night ? 0.8 : 0}
      />
    </mesh>
  );
}
function AttractionBeam({
  show,
  distance,
  floor,
  night,
  reducedMotion,
  spillColor,
  spillSecondary,
}: {
  spillColor: string;
  spillSecondary: string;
  show: boolean;
  distance: number;
  floor: number;
  night: boolean;
  reducedMotion: boolean;
}) {
  // The wave travels outwards while distant columns complete their motion
  // faster, keeping the tail of the ripple responsive.
  const delay = distance / 3600;
  const duration = THREE.MathUtils.lerp(
    0.24,
    0.12,
    Math.min(distance / 1200, 1),
  );
  const mesh = useRef<THREE.Mesh>(null);
  const height = useRef(show ? 1 : 0);
  const transition = useRef({
    from: height.current,
    to: height.current,
    elapsed: duration,
    startedAt: 0,
  });
  const invalidate = useThree((state) => state.invalidate);
  useLayoutEffect(() => {
    transition.current = {
      from: height.current,
      to: show ? 1 : 0,
      elapsed: 0,
      startedAt: performance.now() + (reducedMotion ? 0 : delay * 1000),
    };
    invalidate();
  }, [show, delay, duration, reducedMotion, invalidate]);
  useFrame(() => {
    const motion = transition.current;
    if (!mesh.current || motion.elapsed >= duration) return;
    motion.elapsed = reducedMotion
      ? duration
      : Math.min(
          duration,
          Math.max(0, (performance.now() - motion.startedAt) / 1000),
        );
    const t = motion.elapsed / duration;
    const ease = t * t * (3 - 2 * t);
    height.current = THREE.MathUtils.lerp(motion.from, motion.to, ease);
    // Collapse and expand from the ground, preserving circumference and the
    // shader's distance-dependent height and transparent upper edge.
    mesh.current.scale.y = Math.max(0.0001, height.current);
    mesh.current.position.y = floor + 90 * mesh.current.scale.y;
    mesh.current.visible = height.current > 0;
    if (motion.elapsed < duration) invalidate();
  });
  return (
    <mesh
      ref={mesh}
      visible={height.current > 0}
      position={[0, floor + 90 * Math.max(0.0001, height.current), 0]}
      scale={[1, Math.max(0.0001, height.current), 1]}
      raycast={() => {}}
      frustumCulled={false}
    >
      <cylinderGeometry
        args={[ATTRACTION_RADIUS, ATTRACTION_RADIUS, 180, 96, 1, true]}
      />
      <BoundaryMaterial
        color={PRIMARY}
        opacity={night ? 0.624 : 0.312}
        beam
        spillColor={spillColor}
        spillSecondary={spillSecondary}
      />
    </mesh>
  );
}

export const Artwork = memo(function Artwork({
  item,
  night,
  selected,
  seen,
  showBeam,
  beamOrigin,
  onHover,
  onSelect,
  reducedMotion,
  selectionSequence,
}: {
  reducedMotion: boolean;
  selectionSequence: number;
  item: Installation;
  night: boolean;
  selected: boolean;
  seen: boolean;
  showBeam: boolean;
  beamOrigin: [number, number] | null;
  onHover: (id: string, active: boolean) => void;
  onSelect: (id: string) => void;
}) {
  const [x, z] =
    item.id === "the-anooki"
      ? [TOWN_HALL_FORECOURT.x, TOWN_HALL_FORECOURT.z]
      : item.id === "together"
        ? [WAPPING_GATE.x, WAPPING_GATE.z]
        : item.id === "the-stars-come-out-at-night"
          ? [KINGS_PLATFORM.x, KINGS_PLATFORM.z]
          : item.id === "unity"
            ? [GEORGES_DOCK.x, GEORGES_DOCK.z]
            : item.id === "today-i-love-you"
              ? [CHURCH_GARDENS.x, CHURCH_GARDENS.z]
              : item.id === "loop"
                ? [ST_PAULS.x, ST_PAULS.z]
                : item.id === "flower-power"
                  ? [EXCHANGE.x, EXCHANGE.z]
                  : project(...item.coordinates);
  const treatment = EVENT_POOLS.find((pool) => pool.id === item.id)!;
  const floor =
    item.id === "today-i-love-you" ? CHURCH_GARDENS.elevation + 0.08 : 0.65;
  return (
    <group position={[x, 0, z]}>
      {!seen && (
        <AttractionBeam
          show={showBeam}
          spillColor={treatment.colour}
          spillSecondary={treatment.secondary}
          // Retain the last focus as the radial origin after hover-off.
          distance={
            beamOrigin ? Math.hypot(x - beamOrigin[0], z - beamOrigin[1]) : 0
          }
          floor={floor}
          night={night}
          reducedMotion={reducedMotion}
        />
      )}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, floor, 0]}
        renderOrder={1}
        onClick={(e) => {
          e.stopPropagation();
          if (!selected && e.delta <= 5) onSelect(item.id);
        }}
      >
        <circleGeometry args={[ATTRACTION_RADIUS, 96]} />
        <BoundaryMaterial
          color={seen ? "#88939e" : PRIMARY}
          opacity={seen ? 0.18 : night ? 0.5 : 0.32}
          radial
        />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, floor + 0.015, 0]}
        renderOrder={1}
      >
        <ringGeometry
          args={[ATTRACTION_RADIUS - 0.65, ATTRACTION_RADIUS, 96]}
        />
        <BoundaryMaterial
          color={seen ? "#88939e" : PRIMARY}
          opacity={selected ? 0.85 : 0.3}
        />
      </mesh>
      {item.artworkPlacement !== "pending" && (
        <group
          position={[
            0,
            item.id === "today-i-love-you" ? CHURCH_GARDENS.elevation : 0,
            0,
          ]}
          scale={
            [
              "the-anooki",
              "flower-power",
              "loop",
              "dream-herd",
              "paradigm",
            ].includes(item.id)
              ? 1
              : 1.7
          }
          onClick={(e) => {
            e.stopPropagation();
            if (!selected && e.delta <= 5) onSelect(item.id);
          }}
        >
          {item.id === "the-anooki" ? (
            <group position={[TOWN_HALL.x - x, 0, TOWN_HALL.z - z]}>
              <AnookiOnColumns
                night={night}
                reducedMotion={reducedMotion}
                selected={selected}
                selectionSequence={selectionSequence}
              />
            </group>
          ) : item.id === "loop" ? (
            <group
              position={[ST_PAULS.x - x, 0, ST_PAULS.z - z]}
              rotation={[0, ST_PAULS.rotation, 0]}
            >
              <Sculpture id={item.id} color={item.color} night={night} />
            </group>
          ) : item.id === "flower-power" ? (
            <group
              position={[EXCHANGE.x - x, 0, EXCHANGE.z - z]}
              rotation={[0, EXCHANGE.rotation, 0]}
            >
              <Sculpture id={item.id} color={item.color} night={night} />
            </group>
          ) : (
            <Sculpture id={item.id} color={item.color} night={night} />
          )}
        </group>
      )}
      <Html
        position={[
          item.id === "the-anooki" ? TOWN_HALL.x - x : 0,
          item.id === "the-anooki"
            ? 53
            : item.id === "together"
              ? selected
                ? 16
                : 22
              : item.id === "the-stars-come-out-at-night"
                ? selected
                  ? 7
                  : 18
                : item.id === "unity"
                  ? selected
                    ? 16
                    : 23
                  : selected
                    ? 38
                    : 30,
          item.id === "the-anooki" ? TOWN_HALL.z - z : 0,
        ]}
        center
        zIndexRange={[20, 5]}
      >
        <button
          className={`art-marker ${selected ? "selected" : ""}${seen ? " is-seen" : ""}`}
          style={
            { "--art-color": seen ? "#747f8b" : PRIMARY } as React.CSSProperties
          }
          onPointerEnter={(event) => {
            if (event.pointerType !== "touch") onHover(item.id, true);
          }}
          onPointerLeave={() => onHover(item.id, false)}
          onPointerCancel={() => onHover(item.id, false)}
          onClick={() => onSelect(item.id)}
          aria-label={`Explore ${item.name}${seen ? ", seen" : ""}`}
        >
          <span>{String(item.number).padStart(2, "0")}</span>
          <strong>{item.name}</strong>
        </button>
      </Html>
    </group>
  );
});
function Sculpture({
  id,
  color,
  night,
}: {
  id: string;
  color: string;
  night: boolean;
}) {
  if (id === "paradigm") return <Paradigm night={night} />;
  if (id === "loop")
    return (
      <>
        {Array.from({ length: 6 }, (_, i) => (
          <group
            position={[(i % 3) * 12 - 10, 3.8, Math.floor(i / 3) * 10 - 2]}
            key={i}
          >
            <mesh>
              <torusGeometry args={[2.7, 0.35, 8, 28]} />
              <meshStandardMaterial
                color="#eef1d2"
                emissive={color}
                emissiveIntensity={night ? 1 : 0}
              />
            </mesh>
            <Rod p={[0, -2, 0]} s={[4, 0.4, 1.5]} color={color} night={night} />
          </group>
        ))}
      </>
    );
  if (id === "flower-power")
    return (
      <>
        {[
          [-14, -12],
          [0, -20],
          [14, -12],
          [-15, 0],
          [15, 0],
          [-11, 14],
          [11, 14],
        ].map(([x, z], i) => (
          <group key={i} position={[x, 0, z]}>
            <Rod p={[0, 3.5, 0]} s={[0.3, 7, 0.3]} color="#7b9488" />
            <group position={[0, 7.5, 0]} rotation={[-0.35, i * 0.9, 0]}>
              {Array.from({ length: 5 }, (_, j) => (
                <mesh
                  key={j}
                  position={[
                    Math.cos(j * Math.PI * 0.4) * 1.6,
                    Math.sin(j * Math.PI * 0.4) * 1.6,
                    0,
                  ]}
                  rotation={[0, 0, j * Math.PI * 0.4]}
                  scale={[1.5, 0.85, 0.4]}
                >
                  <octahedronGeometry args={[1, 0]} />
                  <meshStandardMaterial
                    color={palette[(i + j) % 5]}
                    emissive={palette[(i + j) % 5]}
                    emissiveIntensity={night ? 0.8 : 0}
                    metalness={0.25}
                    roughness={0.35}
                  />
                </mesh>
              ))}
              <Orb p={[0, 0, 0.2]} s={0.6} color="#fff0b6" night={night} />
            </group>
          </group>
        ))}
      </>
    );
  if (id === "coloured-peonies")
    return (
      <>
        {Array.from({ length: 5 }, (_, i) => {
          const a = i * 2.4,
            r = i ? 7 : 0;
          return (
            <group key={i} position={[Math.cos(a) * r, 0, Math.sin(a) * r]}>
              <Rod p={[0, 3.5, 0]} s={[0.4, 7, 0.4]} color="#909c88" />
              {Array.from({ length: 5 }, (_, j) => (
                <Orb
                  key={j}
                  p={[
                    Math.cos(j * 1.256) * 1.5,
                    7.5,
                    Math.sin(j * 1.256) * 1.5,
                  ]}
                  s={[1.4, 0.6, 1.4]}
                  color={palette[i % 5]}
                  night={night}
                />
              ))}
              <Orb p={[0, 8, 0]} s={0.6} color="#ffffd6" night={night} />
            </group>
          );
        })}
      </>
    );
  if (id === "pop")
    return (
      <>
        {palette.map((c, i) => (
          <group key={c} position={[(i - 2) * 4, 0, Math.sin(i * 2) * 3]}>
            <Rod p={[0, 3, 0]} s={[2.7, 6, 2.7]} color={c} night={night} />
            <Orb p={[0, 7, 0]} s={[1.7, 2, 1.4]} color={c} night={night} />
            {[-0.55, 0.55].map((x) => (
              <Orb
                key={x}
                p={[x, 7.4, 1.3]}
                s={0.3}
                color="#202d38"
                night={false}
              />
            ))}
          </group>
        ))}
      </>
    );
  if (id === "dream-herd")
    return (
      <>
        {Array.from({ length: 8 }, (_, i) => (
          <group
            key={i}
            position={[
              Math.cos((i * Math.PI) / 4) * 10,
              0,
              Math.sin((i * Math.PI) / 4) * 10,
            ]}
            rotation={[0, (-i * Math.PI) / 4, 0]}
          >
            <Orb
              p={[0, 4, 0]}
              s={[2.5, 1.5, 1.5]}
              color={palette[i % 5]}
              night={night}
            />
            <Orb p={[2.4, 4.6, 0]} s={1} color="#edeee6" night={night} />
            {[-1, 1].flatMap((x) =>
              [-0.8, 0.8].map((z) => (
                <Rod
                  key={`${x}-${z}`}
                  p={[x, 2, z]}
                  s={[0.4, 4, 0.4]}
                  color={palette[i % 5]}
                  night={night}
                />
              )),
            )}
          </group>
        ))}
      </>
    );
  if (id === "unity")
    return (
      <>
        {palette.map((c, i) => {
          const a = (i * Math.PI * 2) / 5;
          return (
            <group
              key={c}
              position={[Math.cos(a) * 4, 0, Math.sin(a) * 4]}
              rotation={[0, -a, 0]}
            >
              <Orb p={[0, 6.5, 0]} s={1.5} color={c} night={night} />
              <Rod p={[0, 3.8, 0]} s={[1.8, 3, 1.8]} color={c} night={night} />
              <Rod p={[0, 4.5, 0]} s={[6, 1.2, 1.2]} color={c} night={night} />
              {[-0.7, 0.7].map((x) => (
                <Rod
                  key={x}
                  p={[x, 1.5, 0]}
                  s={[0.8, 3, 0.8]}
                  color={c}
                  night={night}
                />
              ))}
            </group>
          );
        })}
      </>
    );
  if (id === "colour-rush")
    return (
      <>
        {Array.from({ length: 10 }, (_, i) => (
          <mesh
            key={i}
            position={[0, i * 1.1 + 1, 0]}
            rotation={[0, i * 0.08, 0]}
          >
            <cylinderGeometry args={[2.7, 2.7, 1.1, 8]} />
            <meshStandardMaterial
              color={palette[i % 5]}
              emissive={palette[i % 5]}
              emissiveIntensity={night ? 1 : 0}
            />
          </mesh>
        ))}
      </>
    );
  if (id === "the-stars-come-out-at-night")
    return (
      <>
        <Rod p={[0, 2, 0]} s={[3, 4, 3]} color="#526b77" />
        <mesh position={[0, 6, 0]}>
          <dodecahedronGeometry args={[4, 0]} />
          <meshStandardMaterial
            color="#839bcc"
            emissive={color}
            emissiveIntensity={night ? 0.7 : 0}
            wireframe
          />
        </mesh>
        {Array.from({ length: 12 }, (_, i) => (
          <Orb
            key={i}
            p={[
              Math.cos(i * 2.4) * 3,
              5 + Math.sin(i) * 3,
              Math.sin(i * 2.4) * 3,
            ]}
            s={0.35}
            color="#ffffd7"
            night={night}
          />
        ))}
      </>
    );
  if (id === "today-i-love-you") return <LightText night={night} />;
  if (id === "together")
    return (
      <>
        {Array.from({ length: 12 }, (_, i) => (
          <Rod
            key={i}
            p={[(i - 5.5) * 1.8, 4, 0]}
            s={[1.8, 8, 0.5]}
            color={palette[i % 5]}
            night={night}
          />
        ))}
      </>
    );
  if (id === "invisible-cities")
    return (
      <>
        {Array.from({ length: 4 }, (_, i) => (
          <group
            key={i}
            position={[(i - 1.5) * 5, 4, Math.sin(i) * 4]}
            rotation={[0, i * 0.3, 0]}
          >
            <mesh>
              <torusGeometry args={[3.7, 1.1, 6, 16, Math.PI]} />
              <meshStandardMaterial
                color={palette[i % 5]}
                emissive={palette[i % 5]}
                emissiveIntensity={night ? 0.65 : 0}
              />
            </mesh>
            {[-3.7, 3.7].map((x) => (
              <Rod
                key={x}
                p={[x, -2, 0]}
                s={[2, 4, 2]}
                color={palette[i % 5]}
                night={night}
              />
            ))}
          </group>
        ))}
      </>
    );
  return (
    <>
      {Array.from({ length: 7 }, (_, i) => (
        <Rod
          key={i}
          p={[(i - 3) * 2.8, 4 + Math.sin(i) * 2, Math.cos(i) * 3]}
          s={[1, 8 + Math.sin(i) * 4, 1]}
          color={palette[i % 5]}
          night={night}
        />
      ))}
    </>
  );
}
function LightText({ night }: { night: boolean }) {
  const texture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 256;
    const ctx = c.getContext("2d")!;
    ctx.font = "bold 100px Arial";
    ctx.fillStyle = "#ffe8e8";
    ctx.textAlign = "center";
    ctx.fillText("TODAY I LOVE YOU", 512, 156);
    return new THREE.CanvasTexture(c);
  }, []);
  useEffectDispose(texture);
  return (
    <>
      <mesh position={[0, 6, 0]}>
        <planeGeometry args={[28, 7]} />
        <meshBasicMaterial
          map={texture}
          transparent
          side={THREE.DoubleSide}
          color={night ? "#ffffff" : "#b04b79"}
        />
      </mesh>
      {[-10, 10].map((x) => (
        <Rod key={x} p={[x, 3, 0]} s={[0.2, 6, 0.2]} color="#80958c" />
      ))}
    </>
  );
}
function useEffectDispose(texture: THREE.Texture) {
  useEffect(() => () => texture.dispose(), [texture]);
}
