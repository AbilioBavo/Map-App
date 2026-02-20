export interface Coordinates {
  lat: number;
  lng: number;
}

export interface UserPosition extends Coordinates {
  id: string;
  name: string;
  updatedAt: number;
}
