import L from 'leaflet';

// leaflet-rotate erweitert das globale `L` – muss vor dem Plugin-Import gesetzt sein.
(window as unknown as { L: typeof L }).L = L;

declare module 'leaflet' {
  interface MapOptions {
    rotate?: boolean;
    bearing?: number;
    touchRotate?: boolean;
    shiftKeyRotate?: boolean;
    rotateControl?: boolean | object;
  }
  interface Map {
    setBearing(theta: number, options?: { animate?: boolean }): this;
    getBearing(): number;
  }
}
