import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { RealtimeSocketManager } from '../src/sockets.js';

class FakeSocket extends EventEmitter {
  constructor(public readonly id: string) {
    super();
  }
}

class FakeIo extends EventEmitter {
  public emitted: Array<{ event: string; payload: unknown }> = [];

  emit(event: string, payload?: unknown): boolean {
    this.emitted.push({ event, payload });
    return super.emit(event, payload);
  }
}

describe('RealtimeSocketManager', () => {
  it('rate limits update_location events to once per second', () => {
    vi.useFakeTimers();
    const io = new FakeIo();
    const manager = new RealtimeSocketManager(io as never);

    const socket = new FakeSocket('abc');
    manager.handleConnection(socket as never);

    socket.emit('join', { name: 'Alice' });
    socket.emit('update_location', { lat: 10, lng: 20 });
    socket.emit('update_location', { lat: 11, lng: 21 });

    const usersAfterLimitedUpdates = manager.getUsers();
    expect(usersAfterLimitedUpdates[0]?.lat).toBe(10);

    vi.advanceTimersByTime(1000);
    socket.emit('update_location', { lat: 12, lng: 22 });

    const users = manager.getUsers();
    expect(users[0]?.lat).toBe(12);

    vi.useRealTimers();
  });

  it('removes stale users based on ttl', () => {
    const io = new FakeIo();
    const manager = new RealtimeSocketManager(io as never);
    const socket = new FakeSocket('old');

    manager.handleConnection(socket as never);
    socket.emit('join', { name: 'Old User' });

    manager.removeStaleUsers(Date.now() + 35_000);
    expect(manager.getUsers()).toHaveLength(0);
  });
});
