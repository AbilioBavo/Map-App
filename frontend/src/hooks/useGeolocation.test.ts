import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useGeolocation } from './useGeolocation';

describe('useGeolocation', () => {
  it('updates coords from watchPosition', () => {
    vi.useFakeTimers();
    const watchPosition = vi.fn((success: PositionCallback) => {
      success({ coords: { latitude: 1, longitude: 2 } } as GeolocationPosition);
      return 1;
    });

    vi.stubGlobal('navigator', {
      geolocation: {
        watchPosition,
        clearWatch: vi.fn(),
      },
    });

    const { result } = renderHook(() => useGeolocation());
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.coords).toEqual({ lat: 1, lng: 2 });
    expect(result.current.status).toBe('granted');
    vi.useRealTimers();
  });
});
