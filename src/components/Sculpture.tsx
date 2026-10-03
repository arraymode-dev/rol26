import { memo, useEffect, useMemo } from "react";
import * as THREE from "three";
import { buildSculpture } from "../lib/sculpture-models";
import { Paradigm } from "./Paradigm";
// Emission follows the shared batch's vertex palette, while surface lighting
// preserves depth on the inflatable forms and coloured frames.
function colourEmission(shader: THREE.WebGLProgramParametersWithUniforms) {
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <emissivemap_fragment>",
    "#include <emissivemap_fragment>\n#ifdef USE_COLOR\ntotalEmissiveRadiance *= vColor;\n#endif",
  );
}
export const Sculpture = memo(function Sculpture({
  id,
  detailed,
  night,
}: {
  id: string;
  detailed: boolean;
  night: boolean;
}) {
  const model = useMemo(() => buildSculpture(id, detailed), [id, detailed]);
  useEffect(() => () => model.forEach((g) => g.dispose()), [model]);
  if (id === "paradigm") return <Paradigm night={night} />;
  return (
    <group
      position={id === "today-i-love-you" ? [2, 0, 9] : [0, 0, 0]}
      rotation={id === "today-i-love-you" ? [0, -0.25, 0] : [0, 0, 0]}
      scale={id === "today-i-love-you" ? 0.85 : 1}
    >
      {model.map(
        (g, i) =>
          g.getAttribute("position") && (
            <mesh key={i} geometry={g}>
              {i === 1 &&
              night &&
              ["flower-power", "the-stars-come-out-at-night"].includes(id) ? (
                <meshBasicMaterial
                  vertexColors
                  toneMapped={false}
                  side={THREE.DoubleSide}
                />
              ) : (
                <meshStandardMaterial
                  vertexColors
                  roughness={0.42}
                  metalness={0.2}
                  emissive={i === 1 && night ? "#ffffff" : "#000000"}
                  emissiveIntensity={0.5}
                  onBeforeCompile={colourEmission}
                  side={THREE.DoubleSide}
                />
              )}
            </mesh>
          ),
      )}
      {id === "today-i-love-you" && <LightText />}
    </group>
  );
});
function LightText() {
  const texture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 2048;
    c.height = 256;
    const ctx = c.getContext("2d")!;
    ctx.font = "200 175px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#c9ffff";
    ctx.shadowBlur = 12;
    ctx.strokeStyle = "#f5ffff";
    ctx.lineWidth = 2;
    ctx.fillStyle = "#efffff";
    ctx.fillText("TODAY I LOVE YOU", 1024, 128, 1980);
    ctx.strokeText("TODAY I LOVE YOU", 1024, 128, 1980);
    return new THREE.CanvasTexture(c);
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={[0, 3.4, 0.06]}>
      <planeGeometry args={[24, 3]} />
      <meshBasicMaterial
        map={texture}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  );
}
