export type LatLng = {
  latitude: number;
  longitude: number;
};

export type Territory = {
  id: string;
  name: string;
  ownerId: string;
  color: string;
  createdAt: number;
  polygon: LatLng[];
  perimeterMeters: number;
  areaSqMeters: number;
};

export type RunState = 'idle' | 'running' | 'paused' | 'finished';
