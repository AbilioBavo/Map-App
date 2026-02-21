import { useEffect, useMemo, useRef } from 'react';
import type { UserPosition } from '../types';
import type * as MapLibre from 'maplibre-gl';
import type { StyleSpecification } from 'maplibre-gl';

type LngLat = [number, number];

interface MapViewProps {
  users: UserPosition[];
  localUserId: string | null;
  mapProvider: 'maplibre' | 'mapbox';
  mapboxToken?: string;
}

const osmRasterStyle: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'osm',
      type: 'raster',
      source: 'osm',
    },
  ],
};

export function MapView({
  users,
  localUserId,
  mapProvider,
  mapboxToken,
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibre.Map | null>(null);
  const mapLibraryRef = useRef<typeof MapLibre | null>(null);
  const markersRef = useRef<Map<string, { marker: MapLibre.Marker; popup: MapLibre.Popup }>>(
    new Map()
  );
  const hasCenteredOnLocalRef = useRef(false);

  const style = useMemo<string | StyleSpecification>(() => {
    if (mapProvider === 'mapbox' && mapboxToken) {
      return `mapbox://styles/mapbox/streets-v12?access_token=${mapboxToken}`;
    }
    return osmRasterStyle;
  }, [mapProvider, mapboxToken]);

  useEffect(() => {
    let active = true;

    async function initMap(): Promise<void> {
      if (!mapContainerRef.current || mapRef.current) return;

      const imported =
        mapProvider === 'mapbox'
          ? (await import('mapbox-gl')).default
          : (await import('maplibre-gl')).default;

      if (!active) return;

      // Forçamos compatibilidade de tipos aqui
      const lib = imported as unknown as typeof MapLibre;

      mapLibraryRef.current = lib;

      mapRef.current = new lib.Map({
        container: mapContainerRef.current,
        style,
        center: [-8.6291, 41.1579],
        zoom: 12,
        attributionControl: false,
      });

      mapRef.current.addControl(
        new lib.NavigationControl({ showCompass: true }),
        'bottom-right'
      );
    }

    void initMap();

    return () => {
      active = false;

      markersRef.current.forEach(({ marker, popup }) => {
        popup.remove();
        marker.remove();
      });

      markersRef.current.clear();
      mapRef.current?.remove();
      mapRef.current = null;
      hasCenteredOnLocalRef.current = false;
    };
  }, [style, mapProvider]);

  useEffect(() => {
    if (!mapRef.current || !mapLibraryRef.current) return;

    const { Marker, Popup } = mapLibraryRef.current;
    const liveIds = new Set(users.map((u) => u.id));

    // Remove antigos
    for (const [id, artifact] of markersRef.current) {
      if (!liveIds.has(id)) {
        artifact.popup.remove();
        artifact.marker.remove();
        markersRef.current.delete(id);
      }
    }

    // Atualiza / adiciona
    for (const user of users) {
      const popupHtml = `
        <div style="font-family: Inter, sans-serif; min-width: 180px;">
          <strong>${user.name}</strong>
          <div>Lat: ${user.lat.toFixed(6)}</div>
          <div>Lng: ${user.lng.toFixed(6)}</div>
          <div style="opacity:.75; font-size:12px;">
            ${new Date(user.updatedAt).toLocaleTimeString()}
          </div>
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
        'h-6 w-6 rounded-full border-2 shadow-[0_0_0_4px_rgba(255,255,255,0.18)] transition-transform duration-200 hover:scale-110',
        isLocal
          ? 'bg-red-500 border-white local-marker-pulse'
          : 'bg-white border-accent',
      ].join(' ');

      const popup = new Popup({
        closeButton: false,
        closeOnClick: false,
      })
        .setLngLat([user.lng, user.lat])
        .setHTML(popupHtml);

      element.addEventListener('mouseenter', () =>
        popup.addTo(mapRef.current!)
      );
      element.addEventListener('mouseleave', () => popup.remove());

      const marker = new Marker({ element })
        .setLngLat([user.lng, user.lat])
        .addTo(mapRef.current);

      markersRef.current.set(user.id, { marker, popup });
    }

    const localUser = users.find((u) => u.id === localUserId);

    if (localUser && !hasCenteredOnLocalRef.current) {
      mapRef.current.flyTo({
        center: [localUser.lng, localUser.lat],
        zoom: 15,
        duration: 900,
      });

      hasCenteredOnLocalRef.current = true;
    }
  }, [users, localUserId]);

  return (
    <div
      aria-label="realtime map"
      ref={mapContainerRef}
      className="h-full min-h-[60vh] w-full"
    />
  );
}