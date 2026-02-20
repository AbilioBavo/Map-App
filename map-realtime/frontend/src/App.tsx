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
    | 'mapbox';
const mapboxToken = (import.meta.env.MAPBOX_TOKEN ?? import.meta.env.VITE_MAPBOX_TOKEN) as
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
    <main className="grid min-h-screen grid-rows-[1fr_auto] md:grid-cols-[1fr_340px] md:grid-rows-1">
      <MapView users={users} localUserId={localUserId} mapProvider={mapProvider} mapboxToken={mapboxToken} />
      <aside className="glass m-3 rounded-2xl p-4" aria-label="Connected users panel">
        <h1 className="mb-3 text-lg font-semibold">Connected users</h1>
        <p className="mb-3 text-xs text-white/70">Status: {status}</p>
        {error ? <p className="mb-2 text-xs text-red-300">{error}</p> : null}
        <ul className="max-h-[72vh] space-y-2 overflow-auto" aria-label="Connected users list">
          {sortedUsers.map((user) => (
            <li key={user.id} className="rounded-lg border border-white/15 bg-black/20 p-3 text-sm">
              <div className="flex items-center justify-between">
                <strong>{user.name}</strong>
                {user.id === localUserId ? <span className="text-accent">You</span> : null}
              </div>
              <p className="text-white/80">lat: {user.lat.toFixed(5)}</p>
              <p className="text-white/80">lng: {user.lng.toFixed(5)}</p>
              <p className="text-xs text-white/60">{new Date(user.updatedAt).toLocaleTimeString()}</p>
            </li>
          ))}
        </ul>
      </aside>
    </main>
  );
}
