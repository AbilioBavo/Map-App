import { useEffect, useRef, useState } from 'react';

export type GeolocationStatus = 'idle' | 'pending' | 'granted' | 'error' | 'unsupported';

interface Coords {
  lat: number;
  lng: number;
}

interface UseGeolocationState {
  coords: Coords | null;
  status: GeolocationStatus;
  error: string | null;
}

export function useGeolocation(): UseGeolocationState {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [status, setStatus] = useState<GeolocationStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus('unsupported');
      setError('Geolocation is not supported by your browser.');
      return;
    }

    setStatus('pending');

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        if (now - lastUpdateRef.current < 1000) return;

        lastUpdateRef.current = now;
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setStatus('granted');
        setError(null);
      },
      (geoError) => {
        setStatus('error');
        setError(geoError.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 0,
      },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  return { coords, status, error };
}
