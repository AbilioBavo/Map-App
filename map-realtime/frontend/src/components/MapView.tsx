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
};

type MapProviderModule = {
  Map: new (options: Record<string, unknown>) => MapInstance;
  Marker: new (options: { element: HTMLElement }) => MarkerInstance;
  NavigationControl: new (options: Record<string, unknown>) => unknown;
  Popup: new (options: Record<string, unknown>) => PopupInstance;
};

type GoogleMap = {
  setCenter: (coords: { lat: number; lng: number }) => void;
};

type GoogleMarker = {
  setPosition: (coords: { lat: number; lng: number }) => void;
  setMap: (map: GoogleMap | null) => void;
  addListener: (eventName: string, handler: () => void) => { remove: () => void };
};

type GoogleInfoWindow = {
  setContent: (content: string) => void;
  open: (args: { anchor: GoogleMarker; map: GoogleMap }) => void;
  close: () => void;
};

interface GoogleMapsLib {
  maps: {
    Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMap;
    Marker: new (options: Record<string, unknown>) => GoogleMarker;
    InfoWindow: new (options?: Record<string, unknown>) => GoogleInfoWindow;
  };
}

declare global {
  interface Window {
    google?: GoogleMapsLib;
  }
}

interface MapViewProps {
  users: UserPosition[];
  localUserId: string | null;
  mapProvider: 'maplibre' | 'mapbox' | 'google';
  mapboxToken?: string;
  googleMapsApiKey?: string;
}

interface MarkerArtifacts {
  marker: MarkerInstance;
  popup: PopupInstance;
}

interface GoogleMarkerArtifacts {
  marker: GoogleMarker;
  info: GoogleInfoWindow;
  listeners: Array<{ remove: () => void }>;
}

function loadGoogleMaps(apiKey: string): Promise<GoogleMapsLib> {
  if (window.google) {
    return Promise.resolve(window.google);
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google) {
        resolve(window.google);
      } else {
        reject(new Error('Google Maps failed to initialize.'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load Google Maps script.'));
    document.head.appendChild(script);
  });
}

export function MapView({ users, localUserId, mapProvider, mapboxToken, googleMapsApiKey }: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const mapLibraryRef = useRef<MapProviderModule | null>(null);
  const markersRef = useRef<Map<string, MarkerArtifacts>>(new Map());

  const googleMapRef = useRef<GoogleMap | null>(null);
  const googleMarkersRef = useRef<Map<string, GoogleMarkerArtifacts>>(new Map());
  const hasCenteredOnLocalRef = useRef(false);

  const styleUrl = useMemo(() => {
    if (mapProvider === 'mapbox' && mapboxToken) {
      return `mapbox://styles/mapbox/dark-v11?access_token=${mapboxToken}`;
    }

    return 'https://tiles.openfreemap.org/styles/liberty';
  }, [mapProvider, mapboxToken]);

  useEffect(() => {
    let active = true;

    async function initMap(): Promise<void> {
      if (!mapContainerRef.current || mapRef.current || googleMapRef.current) return;

      if (mapProvider === 'google' && googleMapsApiKey) {
        const google = await loadGoogleMaps(googleMapsApiKey);
        if (!active) return;

        googleMapRef.current = new google.maps.Map(mapContainerRef.current, {
          center: { lat: 41.1579, lng: -8.6291 },
          zoom: 13,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        return;
      }

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

      for (const { marker, info, listeners } of googleMarkersRef.current.values()) {
        listeners.forEach((listener) => listener.remove());
        info.close();
        marker.setMap(null);
      }
      googleMarkersRef.current.clear();
      googleMapRef.current = null;

      hasCenteredOnLocalRef.current = false;
    };
  }, [styleUrl, mapProvider, googleMapsApiKey]);

  useEffect(() => {
    if (googleMapRef.current && window.google) {
      const liveIds = new Set(users.map((user) => user.id));

      for (const [id, artifact] of googleMarkersRef.current) {
        if (!liveIds.has(id)) {
          artifact.listeners.forEach((listener) => listener.remove());
          artifact.info.close();
          artifact.marker.setMap(null);
          googleMarkersRef.current.delete(id);
        }
      }

      for (const user of users) {
        const content = `
          <div style="font-family: Inter, sans-serif; min-width: 170px;">
            <strong>${user.name}</strong>
            <div>Lat: ${user.lat.toFixed(6)}</div>
            <div>Lng: ${user.lng.toFixed(6)}</div>
          </div>
        `;

        const existing = googleMarkersRef.current.get(user.id);
        if (existing) {
          existing.marker.setPosition({ lat: user.lat, lng: user.lng });
          existing.info.setContent(content);
          continue;
        }

        const isLocal = user.id === localUserId;
        const marker = new window.google.maps.Marker({
          map: googleMapRef.current,
          position: { lat: user.lat, lng: user.lng },
          title: user.name,
          icon: isLocal
            ? {
                path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',
                fillColor: '#ef4444',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
                scale: 1.5,
                anchor: { x: 12, y: 22 },
              }
            : undefined,
        });

        const info = new window.google.maps.InfoWindow({ content });
        const listeners = [
          marker.addListener('mouseover', () => info.open({ anchor: marker, map: googleMapRef.current! })),
          marker.addListener('mouseout', () => info.close()),
        ];

        googleMarkersRef.current.set(user.id, { marker, info, listeners });
      }

      const localUser = users.find((user) => user.id === localUserId);
      if (localUser && !hasCenteredOnLocalRef.current) {
        googleMapRef.current.setCenter({ lat: localUser.lat, lng: localUser.lng });
        hasCenteredOnLocalRef.current = true;
      }

      return;
    }

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
        isLocal ? 'bg-red-500 border-white local-marker-pulse' : 'bg-white border-accent',
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
