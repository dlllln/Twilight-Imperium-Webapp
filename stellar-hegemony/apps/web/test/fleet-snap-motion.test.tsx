// @vitest-environment jsdom
import { playerId, systemId, unitId, unitTypeId } from '@stellar/domain';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFleetDrag } from '../src/components/pieces/use-fleet-drag.ts';
import { useSettingsStore } from '../src/settings-store.ts';
import type { FleetOrigin, FleetProjection } from '../src/system/fleet-placement.ts';

const preference = vi.hoisted(() => ({ reduced: false }));
vi.mock('motion/react', () => ({ useReducedMotion: () => preference.reduced }));
const originalAnimate = Object.getOwnPropertyDescriptor(Element.prototype, 'animate');
const cancel = vi.fn();
const animate = vi.fn<HTMLElement['animate']>(() => ({ cancel }) as unknown as Animation);

const origin: FleetOrigin = {
  from: 'origin',
  options: [
    {
      from: systemId('origin'),
      path: [systemId('target')],
      ship: {
        id: unitId('carrier'),
        type: unitTypeId('carrier'),
        owner: playerId('p1'),
        damaged: false,
      },
    },
  ],
};
const frame: FleetProjection = {
  hexes: [
    {
      key: '0,0',
      position: { q: 0, r: 0 },
      kind: 'system',
      systemId: 'target',
      back: 'blue',
      seat: null,
      planets: [],
      ships: [],
      tokens: [],
      highlight: 'active',
      control: null,
      frontier: false,
      cache: 0,
      wormholes: [],
    },
  ],
  bounds: { minX: -60, minY: -60, width: 120, height: 120 },
  viewport: { zoom: 1, panX: 0, panY: 0 },
  view: { angle: 0, tilt: 0 },
  size: { width: 300, height: 300 },
};

/** A real mounted ghost receives the ref; no null-ref shortcut can make these tests pass. */
function FleetGhost() {
  const api = useFleetDrag({ frame, active: 'target', scope: 'snap-test' });
  return (
    <>
      <button onClick={() => api.lift({ origin, at: { x: 10, y: 20 } })}>Lift</button>
      <button
        onClick={() => {
          if (api.lifted !== null) api.settle(api.lifted, true);
        }}
      >
        Drop
      </button>
      {api.lifted !== null && (
        <div ref={api.ghost} data-testid="ghost" style={{ transform: 'translate(10px, 20px)' }} />
      )}
    </>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  preference.reduced = false;
  cancel.mockClear();
  animate.mockClear();
  useSettingsStore.setState({ animations: true });
  Element.prototype.animate = animate;
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: preference.reduced,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Object.defineProperty(
    Element.prototype,
    'animate',
    originalAnimate ?? { configurable: true, writable: true, value: undefined },
  );
});

describe('Bewegungswunsch beim magnetischen Ablegen', () => {
  it.each([
    { animations: false, reduced: false, reason: 'deaktivierte Animationen' },
    { animations: true, reduced: true, reason: 'weniger Bewegung im Betriebssystem' },
  ])('überspringt den echten WAAPI-Aufruf bei $reason', ({ animations, reduced }) => {
    useSettingsStore.setState({ animations });
    preference.reduced = reduced;
    render(<FleetGhost />);
    fireEvent.click(screen.getByRole('button', { name: 'Lift' }));
    expect(screen.getByTestId('ghost')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Drop' }));
    expect(animate).not.toHaveBeenCalled();
    expect(screen.queryByTestId('ghost')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('bricht einen laufenden Snap beim Ausschalten ab und entfernt Figur sowie verzögerten Abschluss', () => {
    render(<FleetGhost />);
    fireEvent.click(screen.getByRole('button', { name: 'Lift' }));
    fireEvent.click(screen.getByRole('button', { name: 'Drop' }));
    expect(animate).toHaveBeenCalledOnce();
    expect(animate.mock.calls[0]?.[1]).toMatchObject({ duration: 220, fill: 'forwards' });
    expect(screen.getByTestId('ghost')).toBeTruthy();
    expect(vi.getTimerCount()).toBe(1);
    act(() => useSettingsStore.getState().toggle('animations'));
    expect(cancel).toHaveBeenCalledOnce();
    expect(screen.queryByTestId('ghost')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    act(() => {
      vi.runAllTimers();
    });
    expect(animate).toHaveBeenCalledTimes(1);
  });
});
