import { useEffect, useMemo, useState } from 'react';
import { MapView } from './components/MapView';
import { useGeolocation } from './hooks/useGeolocation';
import { socketService } from './services/socket';
import type { UserPosition } from './types';

const socketUrl =
  import.meta.env.REACT_APP_SOCKET_URL ?? import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:4000';
const mapProvider =
  (import.meta.env.MAP_PROVIDER ?? import.meta.env.VITE_MAP_PROVIDER ?? 'maplibre') as
    | 'maplibre'
    | 'mapbox'
    | 'google';
const mapboxToken = (import.meta.env.MAPBOX_TOKEN ?? import.meta.env.VITE_MAPBOX_TOKEN) as
  | string
  | undefined;
const googleMapsApiKey = (import.meta.env.GOOGLE_MAPS_API_KEY ?? import.meta.env.VITE_GOOGLE_MAPS_API_KEY) as
  | string
  | undefined;

function getStableUserName(): string {
  const key = 'map_realtime_name';
  const cached = localStorage.getItem(key);
  if (cached) return cached;
  const generated = `user-${Math.floor(Math.random() * 10000)}`;
  localStorage.setItem(key, generated);
  return generated;
}

export default function App() {
  const [users, setUsers] = useState<UserPosition[]>([]);
  const [name] = useState<string>(() => getStableUserName());
  const [localUserId, setLocalUserId] = useState<string | null>(null);
  const { coords, status, error } = useGeolocation();

  useEffect(() => {
    socketService.connect(socketUrl);
    socketService.join(name);

    const unsubscribe = socketService.onPositions((positions) => {
      setUsers(positions);
      const mine = positions.find((p) => p.name === name);
      if (mine) setLocalUserId(mine.id);
    });

    return () => {
      unsubscribe();
      socketService.disconnect();
    };
  }, [name]);

  useEffect(() => {
    if (!coords) return;
    socketService.updateLocation(coords.lat, coords.lng);
  }, [coords]);

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => Number(b.id === localUserId) - Number(a.id === localUserId)),
    [users, localUserId],
  );

  return (
    <main className="grid min-h-screen grid-rows-[1fr_auto] gap-2 p-2 md:grid-cols-[1fr_360px] md:grid-rows-1">
      <section className="overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
        <MapView
          users={users}
          localUserId={localUserId}
          mapProvider={mapProvider}
          mapboxToken={mapboxToken}
          googleMapsApiKey={googleMapsApiKey}
        />
      </section>

      <aside className="glass relative overflow-hidden rounded-2xl p-4" aria-label="Connected users panel">
        <div className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative">
          <h1 className="mb-1 text-xl font-semibold tracking-tight">Live Users</h1>
          <p className="mb-3 text-xs text-white/70">Status de localização: {status}</p>
          {coords ? (
            <div className="mb-4 rounded-xl border border-accent/30 bg-black/30 p-3 text-sm">
              <p className="font-medium text-accent">A sua posição</p>
              <p>Latitude: {coords.lat.toFixed(6)}</p>
              <p>Longitude: {coords.lng.toFixed(6)}</p>
            </div>
          ) : null}
          {error ? <p className="mb-2 text-xs text-red-300">{error}</p> : null}

          <ul className="max-h-[72vh] space-y-2 overflow-auto pr-1" aria-label="Connected users list">
            {sortedUsers.map((user) => (
              <li
                key={user.id}
                className="rounded-xl border border-white/15 bg-gradient-to-br from-white/10 to-white/5 p-3 text-sm backdrop-blur"
              >
                <div className="mb-1 flex items-center justify-between">
                  <strong>{user.name}</strong>
                  {user.id === localUserId ? (
                    <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs text-accent">Você</span>
                  ) : null}
                </div>
                <p className="text-white/85">lat: {user.lat.toFixed(5)}</p>
                <p className="text-white/85">lng: {user.lng.toFixed(5)}</p>
                <p className="text-xs text-white/60">{new Date(user.updatedAt).toLocaleTimeString()}</p>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </main>
  );
}
