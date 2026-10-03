import type { MapData } from "../types";

// Start alongside the UI bundle, rather than after the 3D bundle has loaded.
let pending: Promise<MapData> | undefined;
export function loadMap() {
  if (!pending) {
    pending = fetch("/data/map.json").then((response) => {
      if (!response.ok) throw new Error("Map unavailable");
      return response.json() as Promise<MapData>;
    });
    // Keep an early network failure handled until the scene subscribes.
    void pending.catch(() => {
      pending = undefined;
    });
  }
  return pending;
}
