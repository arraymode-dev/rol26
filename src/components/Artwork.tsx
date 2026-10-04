import { EVENT_POOLS } from "../lib/event-lighting";
import { Sculpture } from "./Sculpture";
import { artworkDetail, type ArtworkDetail } from "../lib/artwork-detail";
import { PRIMARY } from "../lib/palette";
import { BoundaryMaterial } from "./BoundaryDepth";
import { memo, useState, useLayoutEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { Installation } from "../types";
import { project } from "../lib/geo";
import { ATTRACTION_RADIUS } from "../lib/attraction-boundary";
import { AnookiOnColumns, TOWN_HALL, TOWN_HALL_FORECOURT } from "./TownHall";
import { WAPPING_GATE } from "./WappingGate";
import { GEORGES_DOCK } from "./GeorgesDock";
import { EXCHANGE } from "./ExchangeFlags";
import { CHURCH_GARDENS } from "./ChurchGardens";
import { ST_PAULS } from "./StPaulsSquare";
import { WATER_LEVEL } from "./WaterMaterial";
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
        args={[ATTRACTION_RADIUS, ATTRACTION_RADIUS, 180, 32, 1, true]}
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
        : item.id === "unity"
          ? [GEORGES_DOCK.x, GEORGES_DOCK.z]
          : item.id === "today-i-love-you"
            ? [CHURCH_GARDENS.x, CHURCH_GARDENS.z]
            : item.id === "loop"
              ? [ST_PAULS.x, ST_PAULS.z]
              : item.id === "flower-power"
                ? [EXCHANGE.x, EXCHANGE.z]
                : project(...item.coordinates);
  const [detail, setDetail] = useState<ArtworkDetail>("overview");
  const detailRef = useRef<ArtworkDetail>("overview");
  const sampled = useRef(0);
  useFrame(({ camera, clock }) => {
    if (clock.elapsedTime - sampled.current < 0.15) return;
    sampled.current = clock.elapsedTime;
    const next = artworkDetail(
      Math.hypot(
        camera.position.x - x,
        camera.position.y,
        camera.position.z - z,
      ),
      detailRef.current,
    );
    if (next !== detailRef.current) {
      detailRef.current = next;
      setDetail(next);
    }
  });
  const near = selected || detail === "near";
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
        visible={near}
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
        visible={near}
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
      {item.id !== "together" && (
        <group
          position={[
            0,
            item.id === "today-i-love-you"
              ? CHURCH_GARDENS.elevation
              : item.id === "unity"
                ? 2.15
                : item.id === "the-anooki"
                  ? 0
                  : item.id === "paradigm"
                    ? WATER_LEVEL + 0.05
                    : 0.6,
            0,
          ]}
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
              <Sculpture id={item.id} night={night} />
            </group>
          ) : item.id === "flower-power" ? (
            <group
              position={[EXCHANGE.x - x, 0, EXCHANGE.z - z]}
              rotation={[0, EXCHANGE.rotation, 0]}
            >
              <Sculpture id={item.id} night={night} />
            </group>
          ) : (
            <Sculpture id={item.id} night={night} />
          )}
        </group>
      )}
      <Html
        position={[
          item.id === "the-anooki" ? TOWN_HALL.x - x : 0,
          item.id === "the-anooki"
            ? 53
            : near
              ? ({
                  "flower-power": 18,
                  loop: 11,
                  "today-i-love-you": 26,
                  "invisible-cities": 18,
                  "coloured-peonies": 19,
                  unity: 14,
                  "colour-rush": 16,
                  "the-stars-come-out-at-night": 11,
                  together: 16,
                  paradigm: 16,
                  "dream-herd": 18,
                  pop: 17,
                }[item.id] ?? 20)
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
