// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMapPointer, usePointerTracking } from '../src/system/map-pointer.ts';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Zeigerbewegung der Galaxie', () => {
  it('bündelt schnelle Bewegungen pro Bild und zeichnet den Kartenbesitzer nicht neu', () => {
    let frames = 0;
    let renders = 0;
    let flush: FrameRequestCallback = () => undefined;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      flush = callback;
      return ++frames;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('PointerEvent', MouseEvent);
    function Map() {
      renders++;
      return <div data-testid="map" onPointerMove={usePointerTracking()} />;
    }
    render(<Map />);
    const map = screen.getByTestId('map');
    const bounds = vi.spyOn(map, 'getBoundingClientRect').mockReturnValue({
      x: 10,
      y: 20,
      left: 10,
      top: 20,
      right: 510,
      bottom: 420,
      width: 500,
      height: 400,
      toJSON: () => ({}),
    });
    for (let i = 0; i < 30; i++) fireEvent.pointerMove(map, { clientX: 100 + i, clientY: 200 });
    expect(frames).toBe(1);
    expect(bounds).not.toHaveBeenCalled();
    act(() => flush(0));
    expect(bounds).toHaveBeenCalledTimes(1);
    expect(useMapPointer.getState().cursor).toEqual({ x: 119, y: 180 });
    expect(renders).toBe(1);
  });

  it('bricht ein ausstehendes Bild beim Verlassen der Karte ab', () => {
    vi.stubGlobal('requestAnimationFrame', () => 42);
    const cancel = vi.fn();
    vi.stubGlobal('cancelAnimationFrame', cancel);
    function Map() {
      return <div data-testid="map" onPointerMove={usePointerTracking()} />;
    }
    const { unmount } = render(<Map />);
    fireEvent.pointerMove(screen.getByTestId('map'));
    unmount();
    expect(cancel).toHaveBeenCalledWith(42);
  });
});
