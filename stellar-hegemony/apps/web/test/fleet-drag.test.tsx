// @vitest-environment jsdom
import { playerId, systemId, unitId, unitTypeId } from '@stellar/domain';
import { act, cleanup, fireEvent, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFleetDrag } from '../src/components/pieces/use-fleet-drag.ts';
import { useSettingsStore } from '../src/settings-store.ts';
import { FleetDrag, type FleetDragConfig, type FleetPointer } from '../src/system/fleet-drag.ts';
import type { FleetOrigin, FleetProjection } from '../src/system/fleet-placement.ts';
import { useMovementDraft } from '../src/system/movement-draft.ts';

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
let frames: Map<number, FrameRequestCallback>;
let sequence = 0;

beforeEach(() => {
  frames = new Map();
  sequence = 0;
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: FrameRequestCallback) => {
      frames.set(++sequence, callback);
      return sequence;
    }),
  );
  vi.stubGlobal(
    'cancelAnimationFrame',
    vi.fn((id: number) => frames.delete(id)),
  );
  useMovementDraft.setState({ scope: '', orders: {} });
  useSettingsStore.setState({ animations: false });
});

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

function flushFrame(): void {
  const queued = [...frames.values()];
  frames.clear();
  for (const callback of queued) callback(16);
}

function pointer() {
  const galaxy = document.createElement('div');
  galaxy.className = 'galaxy';
  galaxy.getBoundingClientRect = () => ({
    x: 100,
    y: 50,
    left: 100,
    top: 50,
    right: 1100,
    bottom: 850,
    width: 1000,
    height: 800,
    toJSON: () => ({}),
  });
  Object.defineProperties(galaxy, { clientLeft: { value: 3 }, clientTop: { value: 5 } });
  const element = document.createElement('button');
  const captured = new Set<number>();
  const setCapture = vi.fn((id: number) => {
    captured.add(id);
  });
  element.setPointerCapture = setCapture;
  element.hasPointerCapture = vi.fn((id: number) => captured.has(id));
  const releaseCapture = vi.fn((id: number) => {
    captured.delete(id);
  });
  element.releasePointerCapture = releaseCapture;
  galaxy.append(element);
  document.body.append(galaxy);
  const at = (x: number, y: number, id = 1): FleetPointer => ({
    pointerId: id,
    clientX: x + 103,
    clientY: y + 55,
    button: 0,
    currentTarget: element,
  });
  return { element, at, galaxy, setCapture, releaseCapture };
}

function controller() {
  const config: FleetDragConfig = {
    lift: vi.fn(),
    draw: vi.fn(),
    accept: vi.fn(() => true),
    stage: vi.fn(),
    settle: vi.fn(),
  };
  return { config, drag: new FleetDrag(() => config) };
}

describe('Aufnehmen und Ablegen einer Flotte', () => {
  it('fasst Zeigerbewegungen pro Bild zusammen und verwendet die jüngste Position relativ zum Kartenrand', () => {
    const { at } = pointer();
    const { config, drag } = controller();
    drag.start(at(10, 20), origin);
    expect(config.lift).toHaveBeenCalledWith({ origin, at: { x: 10, y: 20 } });
    drag.move(at(30, 40));
    drag.move(at(50, 60));
    drag.move(at(70, 80));
    expect(frames.size).toBe(1);
    expect(config.draw).not.toHaveBeenCalled();
    expect(config.stage).not.toHaveBeenCalled();
    flushFrame();
    expect(config.draw).toHaveBeenCalledExactlyOnceWith({ x: 70, y: 80 }, true);
    drag.move(at(90, 100));
    expect(frames.size).toBe(1);
    drag.dispose();
  });

  it('nimmt nur den gehaltenen Zeiger an und prüft beim Ablegen dessen letzte Position', () => {
    const { at, galaxy, releaseCapture } = pointer();
    const { config, drag } = controller();
    drag.start(at(10, 20), origin);
    expect(galaxy.hasAttribute('data-lifting-fleet')).toBe(true);
    drag.move(at(200, 200, 2));
    drag.release(at(200, 200, 2));
    drag.cancel(2);
    expect(drag.active).toBe(true);
    expect(frames.size).toBe(0);
    expect(config.stage).not.toHaveBeenCalled();
    drag.move(at(50, 60));
    drag.release(at(80, 90));
    expect(config.accept).toHaveBeenCalledWith({ x: 80, y: 90 });
    expect(config.stage).toHaveBeenCalledExactlyOnceWith(origin);
    expect(config.draw).toHaveBeenCalledExactlyOnceWith({ x: 80, y: 90 }, true);
    expect(config.settle).toHaveBeenCalledWith(
      expect.objectContaining({ origin, at: { x: 80, y: 90 } }),
      true,
    );
    expect(releaseCapture).toHaveBeenCalledExactlyOnceWith(1);
    expect(frames.size).toBe(0);
    expect(galaxy.hasAttribute('data-lifting-fleet')).toBe(false);
    expect(drag.consumeClick()).toBe(true);
    expect(drag.consumeClick()).toBe(false);
  });

  it('lässt einen zweiten Finger die laufende Geste nicht übernehmen', () => {
    const { at, setCapture } = pointer();
    const { config, drag } = controller();
    drag.start(at(10, 20), origin);
    drag.start(at(70, 80, 2), { ...origin, from: 'other' });
    expect(config.lift).toHaveBeenCalledTimes(1);
    expect(setCapture).toHaveBeenCalledExactlyOnceWith(1);
    drag.release(at(100, 100));
    expect(config.stage).toHaveBeenCalledExactlyOnceWith(origin);
  });

  it('ungültiges Ablegen, Abbrechen und Entsorgen übernehmen keine Schiffe und entfernen geplante Bilder', () => {
    const { at, releaseCapture } = pointer();
    const { config, drag } = controller();
    vi.mocked(config.accept).mockReturnValue(false);
    drag.start(at(10, 20), origin);
    drag.move(at(100, 100));
    drag.release(at(100, 100));
    expect(config.stage).not.toHaveBeenCalled();
    expect(config.draw).toHaveBeenCalledExactlyOnceWith({ x: 100, y: 100 }, false);
    vi.mocked(config.draw).mockClear();
    expect(config.settle).toHaveBeenLastCalledWith(expect.objectContaining({ origin }), false);
    drag.start(at(10, 20), origin);
    drag.move(at(100, 100));
    drag.cancel();
    expect(drag.active).toBe(false);
    expect(frames.size).toBe(0);
    expect(drag.consumeClick()).toBe(true);
    drag.start(at(10, 20), origin);
    drag.move(at(100, 100));
    drag.dispose();
    expect(drag.active).toBe(false);
    expect(releaseCapture).toHaveBeenCalledTimes(3);
    expect(frames.size).toBe(0);
    flushFrame();
    expect(config.stage).not.toHaveBeenCalled();
    expect(config.draw).not.toHaveBeenCalled();
  });

  it('kleine Klickbewegungen und die rechte Maustaste beginnen keine Ablage', () => {
    const { at, setCapture } = pointer();
    const { config, drag } = controller();
    drag.start({ ...at(0, 0), button: 2 }, origin);
    expect(drag.active).toBe(false);
    expect(setCapture).not.toHaveBeenCalled();
    drag.start(at(10, 20), origin);
    drag.release(at(12, 23));
    expect(config.accept).not.toHaveBeenCalled();
    expect(config.stage).not.toHaveBeenCalled();
    expect(drag.consumeClick()).toBe(false);
  });
});

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

describe('Abbruch einer angehobenen Flotte in React', () => {
  it('Escape, neue Serverversion und Unmount verwerfen die Geste ohne einen Entwurf zu übernehmen', () => {
    const { at } = pointer();
    const { result, rerender, unmount } = renderHook(
      ({ scope }) => useFleetDrag({ frame, active: 'target', scope }),
      { initialProps: { scope: 'version-1' } },
    );
    act(() => result.current.drag.start(at(10, 20), origin));
    act(() => result.current.drag.move(at(150, 150)));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(result.current.drag.active).toBe(false);
    expect(result.current.lifted).toBeNull();
    expect(useMovementDraft.getState().orders).toEqual({});
    expect(frames.size).toBe(0);
    act(() => result.current.drag.start(at(10, 20), origin));
    act(() => result.current.drag.move(at(150, 150)));
    rerender({ scope: 'version-2' });
    expect(result.current.drag.active).toBe(false);
    expect(result.current.lifted).toBeNull();
    expect(useMovementDraft.getState().orders).toEqual({});
    act(() => result.current.drag.start(at(10, 20), origin));
    act(() => result.current.drag.move(at(150, 150)));
    unmount();
    expect(frames.size).toBe(0);
    expect(useMovementDraft.getState().orders).toEqual({});
  });
});
