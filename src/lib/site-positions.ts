// Shared map anchors for the hall, its figures and local lighting.
export const TOWN_HALL = { x: 24, z: -354, rotation: 0.486 };
export const TOWN_HALL_FORECOURT = {
  x: TOWN_HALL.x + Math.sin(TOWN_HALL.rotation) * 32,
  z: TOWN_HALL.z + Math.cos(TOWN_HALL.rotation) * 32,
};
