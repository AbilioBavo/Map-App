import { useEffect, useMemo, useRef } from 'react';
import type { UserPosition } from '../types';

type LngLat = [number, number];

type PopupInstance = {
  setLngLat: (coords: LngLat) => PopupInstance;
  setHTML: (html: string) => PopupInstance;
  addTo: (map: MapInstance) => PopupInstance;
  remove: () => void;
};

type MapInstance = {
  addControl: (control: unknown, position: 'bottom-right') => void;
  flyTo: (options: { center: LngLat; zoom?: number; duration?: number }) => void;
  remove: () => void;
};

type MarkerInstance = {
  setLngLat: (coords: LngLat) => MarkerInstance;
  addTo: (map: MapInstance) => MarkerInstance;
  remove: () => void;
  getElement: () => HTMLElement;
};

type MapProviderModule = {
  Map: new (options: Record<string, unknown>) => MapInstance;
  Marker: new (options: { element: HTMLElement }) => MarkerInstance;
  NavigationControl: new (options: Record<string, unknown>) => unknown;
  Popup: new (options: Record<string, unknown>) => PopupInstance;
};

interface MapViewProps {
  users: UserPosition[];
  localUserId: string | null;
  mapProvider: 'maplibre' | 'mapbox';
  mapboxToken?: string;
}

interface MarkerArtifacts {
  marker: MarkerInstance;
  popup: PopupInstance;
}

export function MapView({ users, localUserId, mapProvider, mapboxToken }: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const mapLibraryRef = useRef<MapProviderModule | null>(null);
  const markersRef = useRef<Map<string, MarkerArtifacts>>(new Map());
  const hasCenteredOnLocalRef = useRef(false);

  const styleUrl = useMemo(() => {
    if (mapProvider === 'mapbox' && mapboxToken) {
      return `mapbox://styles/mapbox/dark-v11?access_token=${mapboxToken}`;
    }

    // More detailed OSM-based style with roads/labels to avoid the plain green/water look.
    return 'https://tiles.openfreemap.org/styles/liberty';
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
        center: [-8.6291, 41.1579],
        zoom: 12,
        attributionControl: false,
      });

      mapRef.current.addControl(new lib.NavigationControl({ showCompass: true }), 'bottom-right');
    }

    void initMap();

    return () => {
      active = false;
      for (const { marker, popup } of markersRef.current.values()) {
        popup.remove();
        marker.remove();
      }
      markersRef.current.clear();
      mapRef.current?.remove();
      mapRef.current = null;
      hasCenteredOnLocalRef.current = false;
    };
  }, [styleUrl, mapProvider]);

  useEffect(() => {
    if (!mapRef.current || !mapLibraryRef.current) return;

    const Marker = mapLibraryRef.current.Marker;
    const Popup = mapLibraryRef.current.Popup;
    const liveIds = new Set(users.map((user) => user.id));

    for (const [id, artifact] of markersRef.current) {
      if (!liveIds.has(id)) {
        artifact.popup.remove();
        artifact.marker.remove();
        markersRef.current.delete(id);
      }
    }

    for (const user of users) {
      const popupHtml = `
        <div style="font-family: Inter, sans-serif; min-width: 180px;">
          <strong>${user.name}</strong>
          <div>Lat: ${user.lat.toFixed(6)}</div>
          <div>Lng: ${user.lng.toFixed(6)}</div>
          <div style="opacity:.75; font-size:12px;">${new Date(user.updatedAt).toLocaleTimeString()}</div>
        </div>
      `;

      const existing = markersRef.current.get(user.id);
      if (existing) {
        existing.marker.setLngLat([user.lng, user.lat]);
        existing.popup.setLngLat([user.lng, user.lat]).setHTML(popupHtml);
        continue;
      }

      const element = document.createElement('button');
      element.type = 'button';
      element.setAttribute('aria-label', `marker for ${user.name}`);

      const isLocal = user.id === localUserId;
      element.className = [
        'h-5 w-5 rounded-full border-2 shadow-[0_0_0_4px_rgba(255,255,255,0.18)] transition-transform duration-200 hover:scale-110',
        isLocal ? 'bg-accent border-white local-marker-pulse' : 'bg-white border-accent',
      ].join(' ');

      const popup = new Popup({ closeButton: false, closeOnClick: false })
        .setLngLat([user.lng, user.lat])
        .setHTML(popupHtml);

      element.addEventListener('mouseenter', () => popup.addTo(mapRef.current!));
      element.addEventListener('mouseleave', () => popup.remove());

      const marker = new Marker({ element }).setLngLat([user.lng, user.lat]).addTo(mapRef.current);
      markersRef.current.set(user.id, { marker, popup });
    }

    const localUser = users.find((user) => user.id === localUserId);
    if (localUser && !hasCenteredOnLocalRef.current) {
      mapRef.current.flyTo({ center: [localUser.lng, localUser.lat], zoom: 15, duration: 900 });
      hasCenteredOnLocalRef.current = true;
    }
  }, [users, localUserId]);

  return <div aria-label="realtime map" ref={mapContainerRef} className="h-full min-h-[60vh] w-full" />;
}
