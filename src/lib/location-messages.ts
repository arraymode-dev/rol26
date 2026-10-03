import type { LocationStatus } from "./trail-location";
export const locationMessages: Record<LocationStatus, string> = {
  off: "Location off",
  locating: "Finding you… Allow location when asked",
  active: "You are here",
  denied: "Location blocked · allow location in browser settings",
  unavailable: "Location unavailable · check your phone’s location settings",
  timeout: "Waiting for GPS · try an open space",
  unsupported: "Location is unavailable in this browser",
  insecure: "Open this map over HTTPS to use GPS",
  paused: "Location paused while the map is in the background",
  stale: "GPS signal lost · waiting for a fresh location",
};
