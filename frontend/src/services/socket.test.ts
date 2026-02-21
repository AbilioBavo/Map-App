import { describe, expect, it, vi } from 'vitest';
import { SocketService } from './socket';

const emit = vi.fn();
const on = vi.fn();
const off = vi.fn();
const disconnect = vi.fn();

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    connected: true,
    id: 'sock-1',
    emit,
    on,
    off,
    disconnect,
  })),
}));

describe('SocketService', () => {
  it('emits join and location updates', () => {
    const service = new SocketService();
    service.connect('http://localhost:4000');
    service.join('Alice');
    service.updateLocation(1, 2);

    expect(emit).toHaveBeenCalledWith('join', { name: 'Alice' });
    expect(emit).toHaveBeenCalledWith('update_location', { lat: 1, lng: 2 });
    expect(service.getSocketId()).toBe('sock-1');
  });

  it('subscribes to connect events', () => {
    const service = new SocketService();
    service.connect('http://localhost:4000');

    const callback = vi.fn();
    const unsubscribe = service.onConnect(callback);

    expect(on).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(callback).toHaveBeenCalledWith('sock-1');

    unsubscribe();
    expect(off).toHaveBeenCalledWith('connect', expect.any(Function));
  });
});
