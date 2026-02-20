import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MapView } from './MapView';

vi.mock('maplibre-gl', () => {
  class FakeMap {
    addControl() {}
    remove() {}
  }
  class FakeMarker {
    setLngLat() {
      return this;
    }
    addTo() {
      return this;
    }
    remove() {}
  }
  return {
    default: {
      Map: FakeMap,
      Marker: FakeMarker,
      NavigationControl: class {},
    },
    Map: FakeMap,
    Marker: FakeMarker,
  };
});

describe('MapView', () => {
  it('renders map container with aria label', () => {
    render(<MapView users={[]} localUserId={null} mapProvider="maplibre" />);
    expect(screen.getByLabelText('realtime map')).toBeInTheDocument();
  });
});
