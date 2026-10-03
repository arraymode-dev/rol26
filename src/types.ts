export interface Photo {
  src: string;
  alt: string;
  credit: string;
  kind: "artwork" | "site";
}
export interface Installation {
  id: string;
  number: number;
  name: string;
  artist: string;
  location: string;
  area: string;
  coordinates: [number, number];
  color: string;
  description: string;
  source: string;
  photos: Photo[];
  artworkPlacement: "pending" | "illustrative";
  positionStatus: "approximate" | "surveyed";
}
export interface MapFeature {
  id: string;
  name: string;
  kind: string;
  points: [number, number][];
  holes?: [number, number][][];
  height?: number;
  area?: boolean;
  public?: boolean;
  walkable?: boolean;
  bridge?: boolean;
  indoor?: boolean;
}
export interface MapData {
  source: string;
  preparedAt: string;
  buildings: MapFeature[];
  roads: MapFeature[];
  water: MapFeature[];
  parks: MapFeature[];
  trees: [number, number][];
  coast: [number, number][];
  surfaces: Record<"roads" | "paths" | "plazas", [number, number][][][]>;
}
export interface Survey {
  photos: (Photo & {
    installationId: string;
    cameraCoordinates?: [number, number];
    direction?: string;
  })[];
  installationOverrides: { id: string; coordinates: [number, number] }[];
  buildingOverrides: { id: string; height?: number; hidden?: boolean }[];
  additionalTrees: [number, number][];
}
