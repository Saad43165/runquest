export type LatLng = {
  latitude: number;
  longitude: number;
};

export type TerritoryHistoryEntry = {
  ownerId: string;
  ownerName: string;
  conqueredAt: number;
};

export type Territory = {
  id: string;
  name: string;
  ownerId: string;
  ownerDisplayName: string | null;
  ownerPhotoURL?: string | null;
  ownerUsername?: string | null;
  color: string;
  createdAt: number;
  polygon: LatLng[];
  perimeterMeters: number;
  areaSqMeters: number;
  // Feature 3: expiry
  expiresAt?: number;
  // Feature 4: history
  history?: TerritoryHistoryEntry[];
  // Feature 5: teams
  teamId?: string;
  teamColor?: string;
};

export type RunState = 'idle' | 'running' | 'paused' | 'finished';
