import { RiverFurniture } from "./RiverFurniture";
import { GRASS_COLOUR } from "../lib/palette";
import { BuildingPalette } from "./BuildingPalette";
import { installations } from "../data/installations";
import { BUILDING_PROXIMITY } from "../lib/palette";
import { GHOST_DEPTH_LAYER } from "./BoundaryDepth";
import { WaterMaterial, WATER_LEVEL, RIVER_LEVEL } from "./WaterMaterial";
import { memo, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { MapData } from "../types";
import { project } from "../lib/geo";
import {
  circleIntersectsFootprint,
  nearFootprint,
  type Footprint,
} from "../lib/attraction-boundary";
import { GhostBuildings } from "./GhostBuildings";
import { AnchorCourtyard } from "./AnchorCourtyard";
import { DockRides } from "./DockRides";
import { ANCHOR_BUILDINGS, isAnchorTree } from "../lib/anchor-courtyard";
import exchangeFootprint from "../data/exchange-flags.json";
import dockFootprint from "../data/georges-dock.json";
import { ATTRACTION_RADIUS } from "../lib/attraction-boundary";
import {
  WaterfrontLandmarks,
  WATERFRONT_LANDMARK_IDS,
} from "./WaterfrontLandmarks";
import { WaterfrontLinks, WATERFRONT_BUILDINGS } from "./WaterfrontLinks";
import { PumpHouse, PUMP_BUILDINGS, isPumpTree } from "./PumpHouse";
import { WappingGate, isWappingTree } from "./WappingGate";
import { KingsParade, KINGS_BUILDINGS, isKingsTree } from "./KingsParade";
import { GeorgesDock } from "./GeorgesDock";
import { TownHall } from "./TownHall";
import { ExchangeFlags } from "./ExchangeFlags";
import { StPaulsSquare, ST_PAULS_BUILDINGS } from "./StPaulsSquare";

import { ChurchGardens, inChurchGarden } from "./ChurchGardens";

import { PierHead, PIER_CANAL, PIER_CUTOUT, isPierTree } from "./PierHead";

import { CunardForecourt, isCunardTree } from "./CunardForecourt";

function polygon(
  points: [number, number][],
  height = 0,
  elevation = 0,
  holes: number[][][] = [],
) {
  const shape = new THREE.Shape(
    points.map(([x, z]) => new THREE.Vector2(x, -z)),
  );
  shape.holes = holes.map(
    (points) =>
      new THREE.Path(points.map(([x, z]) => new THREE.Vector2(x, -z))),
  );
  const g = height
    ? new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false })
    : new THREE.ShapeGeometry(shape);
  g.rotateX(-Math.PI / 2);
  g.translate(0, elevation, 0);
  return g;
}
function combine(geometries: THREE.BufferGeometry[]) {
  if (!geometries.length) return new THREE.BufferGeometry();
  const normalized = geometries.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    n.deleteAttribute("uv");
    return n;
  });
  const merged = mergeGeometries(normalized, false)!;
  new Set([...geometries, ...normalized]).forEach((g) => g.dispose());
  return merged;
}
const landmarkIds = new Set([
  "24611033",
  "24611026",
  "24611035",
  "9074112",
  "84758669",
  "60261716",
]);
export const World = memo(function World({
  data,
  night,
  focus,
  selected,
  reducedMotion,
  animateRides,
}: {
  data: MapData & { coast: [number, number][] };
  night: boolean;
  focus: [number, number] | null;
  selected: string | null;
  reducedMotion: boolean;
  animateRides: boolean;
}) {
  const lightFootprints = useMemo(() => {
    const centres = installations.map((i) => project(...i.coordinates));
    return [
      // St John's Shopping Centre stays in the darker context-building tone.
      ...data.buildings.filter((b) => b.id !== "60982687"),
      { points: exchangeFootprint.outer as [number, number][] },
      { points: dockFootprint.building.points as [number, number][] },
    ].filter((b) =>
      centres.some((p) => nearFootprint(p, b, BUILDING_PROXIMITY)),
    );
  }, [data]);
  const ghostFootprints = useMemo(() => {
    if (!focus) return [];
    const footprints: Footprint[] = [
      ...data.buildings.filter((b) => b.id !== dockFootprint.building.id),
      {
        points: exchangeFootprint.outer as [number, number][],
        holes: [exchangeFootprint.inner as [number, number][]],
      },
      {
        points: dockFootprint.building.points as [number, number][],
        holes: [dockFootprint.building.hole as [number, number][]],
      },
    ];
    return footprints.filter((b) => nearFootprint(focus, b, ATTRACTION_RADIUS));
  }, [data, focus]);
  const geometry = useMemo(() => {
    const quiet: THREE.BufferGeometry[] = [],
      near: THREE.BufferGeometry[] = [],
      special: THREE.BufferGeometry[] = [];
    for (const b of data.buildings) {
      if (
        [
          "24611033",
          "60261716",
          "669726205",
          "31294107",
          "67328185",
          "24611026",
          "24611035",
          "9074112",
          ...ST_PAULS_BUILDINGS,
          ...ANCHOR_BUILDINGS,
          ...WATERFRONT_BUILDINGS,
          ...WATERFRONT_LANDMARK_IDS,
          ...PUMP_BUILDINGS,
          ...KINGS_BUILDINGS,
        ].includes(b.id)
      )
        continue; // Replaced by the photo-informed landmark.
      const landmark = landmarkIds.has(b.id);
      const h = landmark ? b.height! : Math.min(b.height!, 38);
      // Extend the walls through the ground and raised paving layers while
      // preserving the existing roof elevation.
      const g = polygon(b.points, h + 0.7, -0.1);
      g.setAttribute(
        "buildingTone",
        new THREE.BufferAttribute(
          new Float32Array(g.getAttribute("position").count).fill(
            lightFootprints.includes(b) ? 2 : 1,
          ),
          1,
        ),
      );
      (focus && circleIntersectsFootprint(focus, b.points)
        ? near
        : landmark
          ? special
          : quiet
      ).push(g);
    }
    const coast = data.coast;
    const land = polygon(
      [
        [coast[0][0], -8000],
        ...coast,
        [coast.at(-1)![0], 8000],
        [10000, 8000],
        [10000, -8000],
      ],
      0,
      0,
      [
        PIER_CUTOUT,
        ...data.water
          .filter((f) => f.id !== PIER_CANAL.id)
          .map((f) => f.points),
      ],
    );
    return {
      quiet: combine(quiet),
      near: combine(near),
      special: combine(special),
      land,
      sea: polygon(
        [
          // Share the shoreline with the land instead of putting a second
          // enormous, almost coplanar surface underneath the whole city.
          [coast[0][0], -8000],
          ...coast,
          [coast.at(-1)![0], 8000],
          [-10000, 8000],
          [-10000, -8000],
        ],
        0,
        RIVER_LEVEL,
      ),
      water: combine(
        data.water
          .filter((f) => f.id !== PIER_CANAL.id)
          .map((f) => polygon(f.points, 0, WATER_LEVEL)),
      ),
      quayWalls: combine(
        [
          ...data.water.filter((f) => f.id !== PIER_CANAL.id),
          { points: coast },
        ].map((f) => {
          const vertices: number[] = [];
          f.points.slice(0, -1).forEach((a, i) => {
            const b = f.points[i + 1];
            vertices.push(
              a[0],
              0,
              a[1],
              b[0],
              0,
              b[1],
              b[0],
              WATER_LEVEL - 0.3,
              b[1],
              a[0],
              0,
              a[1],
              b[0],
              WATER_LEVEL - 0.3,
              b[1],
              a[0],
              WATER_LEVEL - 0.3,
              a[1],
            );
          });
          const wall = new THREE.BufferGeometry();
          wall.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(vertices, 3),
          );
          wall.computeVertexNormals();
          return wall;
        }),
      ),
      parks: combine(data.parks.map((f) => polygon(f.points, 0, 0.36))),
      roads: combine(
        data.surfaces.roads.map(([outer, ...holes]) =>
          polygon(outer, 0, 0.3, holes),
        ),
      ),
      paths: combine(
        data.surfaces.paths.map(([outer, ...holes]) =>
          polygon(outer, 0, 0.48, holes),
        ),
      ),
      plazas: combine(
        data.surfaces.plazas.map(([outer, ...holes]) =>
          polygon(outer, 0, 0.4, holes),
        ),
      ),
    };
  }, [data, focus, lightFootprints]);
  useEffect(
    () => () => Object.values(geometry).forEach((g) => g.dispose()),
    [geometry],
  );
  return (
    <BuildingPalette
      night={night}
      footprints={lightFootprints}
      revision={geometry}
      buildings={data.buildings}
      focus={focus}
    >
      <mesh geometry={geometry.sea} receiveShadow>
        <WaterMaterial night={night} moving reducedMotion={reducedMotion} />
      </mesh>
      <mesh geometry={geometry.land} receiveShadow>
        <meshStandardMaterial
          color={night ? "#3b5059" : "#e9e3d3"}
          roughness={1}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh geometry={geometry.water} receiveShadow>
        <WaterMaterial night={night} />
      </mesh>
      <mesh geometry={geometry.quayWalls} receiveShadow>
        <meshStandardMaterial
          color={night ? "#344951" : "#a59e8e"}
          roughness={1}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh geometry={geometry.parks} receiveShadow>
        <meshStandardMaterial color={GRASS_COLOUR} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geometry.roads} receiveShadow>
        <meshStandardMaterial
          color={night ? "#476069" : "#c9c7bc"}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh geometry={geometry.plazas} receiveShadow>
        <meshStandardMaterial
          color={night ? "#3b5059" : "#e9e3d3"}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh geometry={geometry.paths} receiveShadow>
        <meshStandardMaterial
          color={night ? "#526870" : "#e1ddce"}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh geometry={geometry.quiet} castShadow receiveShadow>
        <meshStandardMaterial
          color={night ? "#61727a" : "#ddd9cf"}
          roughness={0.96}
          flatShading
        />
      </mesh>
      <mesh geometry={geometry.special} castShadow receiveShadow>
        <meshStandardMaterial
          color={night ? "#a6b2ac" : "#f4ead8"}
          roughness={0.9}
        />
      </mesh>
      <mesh
        geometry={geometry.near}
        renderOrder={2}
        onUpdate={(mesh) => mesh.layers.enable(GHOST_DEPTH_LAYER)}
      >
        <meshStandardMaterial
          color={night ? "#809a9e" : "#d4cfc1"}
          transparent
          opacity={0.18}
          depthWrite={false}
        />
      </mesh>
      <Trees
        points={data.trees.filter(
          ([x, z]) =>
            !inChurchGarden(x, z) &&
            !isPierTree([x, z]) &&
            !isCunardTree([x, z]) &&
            !isPumpTree([x, z]) &&
            !isKingsTree([x, z]) &&
            !isWappingTree([x, z]) &&
            !isAnchorTree([x, z]),
        )}
        night={night}
      />
      <GhostBuildings footprints={ghostFootprints} night={night}>
        <PierHead night={night} />
        <CunardForecourt night={night} />
        <GeorgesDock night={night} />
        <PumpHouse night={night} />
        <KingsParade night={night} />
        <WaterfrontLinks night={night} data={data} />
        <WaterfrontLandmarks buildings={data.buildings} night={night} />
        <group userData={{ ghostPreserve: selected === "the-anooki" }}>
          <TownHall night={night} />
        </group>
        <ExchangeFlags night={night} />
        <StPaulsSquare night={night} />
      </GhostBuildings>
      <AnchorCourtyard />
      <DockRides night={night} reducedMotion={!animateRides} />
      <RiverFurniture data={data} night={night} />
      <ChurchGardens night={night} />
      <WappingGate night={night} />
      <MapLabel
        coordinates={[-2.9996, 53.4038]}
        label="R I V E R   M E R S E Y"
        water
      />
      <MapLabel
        coordinates={[-2.9927, 53.4007]}
        label="ROYAL ALBERT DOCK"
        water
      />
      <MapLabel coordinates={[-2.9896, 53.4007]} label="SALTHOUSE DOCK" water />
      <MapLabel coordinates={[-2.9958, 53.4053]} label="THE THREE GRACES" />
      <MapLabel coordinates={[-2.9877, 53.4038]} label="LIVERPOOL ONE" />
    </BuildingPalette>
  );
});
function MapLabel({
  coordinates,
  label,
  water = false,
}: {
  coordinates: [number, number];
  label: string;
  water?: boolean;
}) {
  const [x, z] = project(...coordinates);
  return (
    <Html
      position={[x, water ? 2 : 65, z]}
      center
      zIndexRange={[1, 0]}
      style={{ pointerEvents: "none" }}
    >
      <span className={`map-label ${water ? "water-label" : ""}`}>{label}</span>
    </Html>
  );
}
function Trees({
  points,
  night,
}: {
  points: [number, number][];
  night: boolean;
}) {
  const trunks = useRef<THREE.InstancedMesh>(null),
    crowns = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = new THREE.Object3D();
    points.forEach(([x, z], i) => {
      const h = 5 + ((i * 17) % 8);
      m.position.set(x, h * 0.23, z);
      m.scale.set(0.7, h * 0.46, 0.7);
      m.updateMatrix();
      trunks.current!.setMatrixAt(i, m.matrix);
      m.position.y = h * 0.76;
      m.scale.set(h * 0.42, h * 0.62, h * 0.42);
      m.rotation.y = i;
      m.updateMatrix();
      crowns.current!.setMatrixAt(i, m.matrix);
      crowns.current!.setColorAt(
        i,
        new THREE.Color(
          night
            ? ["#385c4e", "#486658", "#587164"][i % 3]
            : ["#8fa778", "#a0b585", "#74936d"][i % 3],
        ),
      );
    });
    trunks.current!.instanceMatrix.needsUpdate = true;
    crowns.current!.instanceMatrix.needsUpdate = true;
    crowns.current!.instanceColor!.needsUpdate = true;
  }, [points, night]);
  return (
    <group>
      <instancedMesh ref={trunks} args={[undefined, undefined, points.length]}>
        <cylinderGeometry args={[1, 1, 1, 5]} />
        <meshStandardMaterial color={night ? "#4a5550" : "#9c8971"} />
      </instancedMesh>
      <instancedMesh
        ref={crowns}
        args={[undefined, undefined, points.length]}
        castShadow
      >
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial flatShading />
      </instancedMesh>
    </group>
  );
}
