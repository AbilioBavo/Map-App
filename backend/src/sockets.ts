import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { z } from 'zod';
import type { UserPosition } from './types.js';

const TTL_MS = 30_000;
const UPDATE_INTERVAL_MS = 1_000;
const CLEANUP_INTERVAL_MS = 15_000;

const joinSchema = z.object({
  name: z.string().trim().min(1).max(64),
});

const updateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

type UserState = UserPosition & { lastReceivedAt: number };

export class RealtimeSocketManager {
  private readonly users = new Map<string, UserState>();
  private readonly updateLastSeen = new Map<string, number>();

  constructor(private readonly io: Server) {}

  bindEvents(): void {
    this.io.on('connection', (socket) => this.handleConnection(socket));

    setInterval(() => this.removeStaleUsers(), CLEANUP_INTERVAL_MS).unref();
    setInterval(() => this.broadcastSnapshot(), UPDATE_INTERVAL_MS).unref();
  }

  handleConnection(socket: Socket): void {
    socket.on('join', (rawPayload: unknown) => {
      const parsed = joinSchema.safeParse(rawPayload);
      if (!parsed.success) return;

      this.users.set(socket.id, {
        id: socket.id,
        name: parsed.data.name,
        lat: 0,
        lng: 0,
        updatedAt: Date.now(),
        lastReceivedAt: Date.now(),
      });

      this.broadcastSnapshot();
    });

    socket.on('update_location', (rawPayload: unknown) => {
      const parsed = updateSchema.safeParse(rawPayload);
      if (!parsed.success) return;

      const now = Date.now();
      const lastUpdate = this.updateLastSeen.get(socket.id) ?? 0;
      if (now - lastUpdate < UPDATE_INTERVAL_MS) {
        return;
      }
      this.updateLastSeen.set(socket.id, now);

      const current = this.users.get(socket.id);
      if (!current) return;

      this.users.set(socket.id, {
        ...current,
        lat: parsed.data.lat,
        lng: parsed.data.lng,
        updatedAt: now,
        lastReceivedAt: now,
      });
      this.broadcastSnapshot();
    });

    socket.on('disconnect', () => {
      this.users.delete(socket.id);
      this.updateLastSeen.delete(socket.id);
      this.broadcastSnapshot();
    });
  }

  removeStaleUsers(now = Date.now()): void {
    for (const [socketId, user] of this.users) {
      if (now - user.lastReceivedAt > TTL_MS) {
        this.users.delete(socketId);
        this.updateLastSeen.delete(socketId);
      }
    }
  }

  broadcastSnapshot(): void {
    const snapshot = [...this.users.values()].map(({ lastReceivedAt: _drop, ...user }) => user);
    this.io.emit('positions', snapshot);
  }

  getUsers(): UserPosition[] {
    return [...this.users.values()].map(({ lastReceivedAt: _drop, ...user }) => user);
  }
}

export function createSocketServer(server: HttpServer): Server {
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Production scaling with Redis adapter:
  // 1) npm i @socket.io/redis-adapter redis
  // 2) uncomment below and set REDIS_URL
  // import { createAdapter } from '@socket.io/redis-adapter';
  // import { createClient } from 'redis';
  // const redisUrl = process.env.REDIS_URL;
  // if (redisUrl) {
  //   const pubClient = createClient({ url: redisUrl });
  //   const subClient = pubClient.duplicate();
  //   await Promise.all([pubClient.connect(), subClient.connect()]);
  //   io.adapter(createAdapter(pubClient, subClient));
  // }

  const manager = new RealtimeSocketManager(io);
  manager.bindEvents();

  return io;
}
