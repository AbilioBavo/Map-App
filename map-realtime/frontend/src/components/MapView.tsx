import { useEffect, useMemo, useRef } from 'react';
import type { UserPosition } from '../types';

type MapInstance = {
  addControl: (control: unknown, position: 'bottom-right') => void;
  remove: () => void;
};

type MarkerInstance = {
  setLngLat: (coords: [number, number]) => MarkerInstance;
  addTo: (map: MapInstance) => MarkerInstance;
  remove: () => void;
};

type MapProviderModule = {
  Map: new (options: Record<string, unknown>) => MapInstance;
  Marker: new (options: { element: HTMLElement }) => MarkerInstance;
  NavigationControl: new (options: Record<string, unknown>) => unknown;
};

interface MapViewProps {
  users: UserPosition[];
  localUserId: string | null;
  mapProvider: 'maplibre' | 'mapbox';
  mapboxToken?: string;
}

export function MapView({ users, localUserId, mapProvider, mapboxToken }: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const mapLibraryRef = useRef<MapProviderModule | null>(null);
  const markersRef = useRef<Map<string, MarkerInstance>>(new Map());

  const styleUrl = useMemo(() => {
    if (mapProvider === 'mapbox' && mapboxToken) {
      return `mapbox://styles/mapbox/dark-v11?access_token=${mapboxToken}`;
    }

    return 'https://demotiles.maplibre.org/style.json';
  }, [mapProvider, mapboxToken]);

  useEffect(() => {
    let active = true;

    async function initMap(): Promise<void> {
      if (!mapContainerRef.current || mapRef.current) return;

      const lib: MapProviderModule =
        mapProvider === 'mapbox'
          ? (await import('mapbox-gl')).default
          : (await import('maplibre-gl')).default;

      if (!active) return;

      mapLibraryRef.current = lib;
      mapRef.current = new lib.Map({
        container: mapContainerRef.current,
        style: styleUrl,
        center: [-74.006, 40.7128],
        zoom: 9,
        attributionControl: false,
      });

      mapRef.current.addControl(new lib.NavigationControl({ showCompass: true }), 'bottom-right');
    }

    void initMap();

    return () => {
      active = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [styleUrl, mapProvider]);

  useEffect(() => {
    if (!mapRef.current || !mapLibraryRef.current) return;

    const Marker = mapLibraryRef.current.Marker;
    const liveIds = new Set(users.map((user) => user.id));

    for (const [id, marker] of markersRef.current) {
      if (!liveIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }

    for (const user of users) {
      const existing = markersRef.current.get(user.id);
      if (existing) {
        existing.setLngLat([user.lng, user.lat]);
        continue;
      }

      const element = document.createElement('div');
      const isLocal = user.id === localUserId;
      element.className = `h-4 w-4 rounded-full border-2 ${
        isLocal ? 'bg-accent border-white local-marker-pulse' : 'bg-white border-accent'
      }`;
      element.setAttribute(
        'title',
        `${user.name}\n(${user.lat.toFixed(4)}, ${user.lng.toFixed(4)})\n${new Date(user.updatedAt).toLocaleTimeString()}`,
      );

      const marker = new Marker({ element }).setLngLat([user.lng, user.lat]).addTo(mapRef.current);
      markersRef.current.set(user.id, marker);
    }
  }, [users, localUserId]);

  return <div aria-label="realtime map" ref={mapContainerRef} className="h-full min-h-[60vh] w-full" />;
}
