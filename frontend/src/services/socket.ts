import { io, type Socket } from 'socket.io-client';
import type { UserPosition } from '../types';

interface ServerToClientEvents {
  positions: (positions: UserPosition[]) => void;
}

interface ClientToServerEvents {
  join: (payload: { name: string }) => void;
  update_location: (payload: { lat: number; lng: number }) => void;
}

export class SocketService {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

  connect(url: string): void {
    if (this.socket?.connected) return;
    this.socket = io(url, {
      transports: ['websocket'],
      withCredentials: false,
    });
  }

  getSocketId(): string | null {
    return this.socket?.id ?? null;
  }

  onConnect(callback: (socketId: string) => void): () => void {
    if (!this.socket) return () => {};

    const handler = () => {
      if (this.socket?.id) callback(this.socket.id);
    };

    this.socket.on('connect', handler);
    if (this.socket.connected && this.socket.id) callback(this.socket.id);

    return () => this.socket?.off('connect', handler);
  }

  onPositions(callback: (positions: UserPosition[]) => void): () => void {
    if (!this.socket) return () => {};
    this.socket.on('positions', callback);
    return () => this.socket?.off('positions', callback);
  }

  join(name: string): void {
    this.socket?.emit('join', { name });
  }

  updateLocation(lat: number, lng: number): void {
    this.socket?.emit('update_location', { lat, lng });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }
}

export const socketService = new SocketService();
