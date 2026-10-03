import { project } from "./geo.ts";
import type { LocationFix } from "./trail-location.ts";

export const GPS_LOG_KEY = "rol-gps-field-log-v1";
export const GPS_CAPTURE_MAX_AGE = 10_000;
export interface GPSRecord {
  id: string;
  artworkId: string;
  artworkName: string;
  capturedAt: string;
  fix: LocationFix;
  scene: { x: number; z: number };
  mappedCoordinates: [number, number];
  offsetMetres: number;
  note: string;
}
export function captureGPS(
  fix: LocationFix | null,
  artwork: { id: string; name: string; coordinates: [number, number] },
  note: string,
  now = Date.now(),
): GPSRecord | null {
  if (
    !fix ||
    ![fix.latitude, fix.longitude, fix.accuracy, fix.timestamp].every(
      Number.isFinite,
    ) ||
    Math.abs(fix.latitude) > 90 ||
    Math.abs(fix.longitude) > 180 ||
    fix.accuracy < 0 ||
    now - fix.timestamp > GPS_CAPTURE_MAX_AGE ||
    fix.timestamp > now + 1000
  )
    return null;
  const [x, z] = project(fix.longitude, fix.latitude);
  const [mappedX, mappedZ] = project(...artwork.coordinates);
  return {
    id: `${now}-${artwork.id}`,
    artworkId: artwork.id,
    artworkName: artwork.name,
    capturedAt: new Date(now).toISOString(),
    fix: { ...fix },
    scene: { x: x || 0, z: z || 0 },
    mappedCoordinates: [...artwork.coordinates],
    offsetMetres: Math.hypot(x - mappedX, z - mappedZ),
    note: note.trim().slice(0, 500),
  };
}
export function parseGPSLog(raw: string | null): GPSRecord[] {
  try {
    const rows: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(rows)) return [];
    return rows
      .filter(
        (r): r is GPSRecord =>
          r &&
          typeof r.id === "string" &&
          typeof r.artworkId === "string" &&
          typeof r.artworkName === "string" &&
          typeof r.note === "string" &&
          typeof r.capturedAt === "string" &&
          r.fix &&
          [
            r.fix.latitude,
            r.fix.longitude,
            r.fix.accuracy,
            r.fix.timestamp,
            r.scene?.x,
            r.scene?.z,
            r.offsetMetres,
          ].every(Number.isFinite) &&
          Array.isArray(r.mappedCoordinates) &&
          r.mappedCoordinates.length === 2 &&
          r.mappedCoordinates.every(Number.isFinite),
      )
      .slice(-100);
  } catch {
    return [];
  }
}
export function exportGPSLog(records: GPSRecord[]) {
  return JSON.stringify(
    { version: 1, coordinateSystem: "WGS84", records },
    null,
    2,
  );
}
