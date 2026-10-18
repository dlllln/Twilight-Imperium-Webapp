// @vitest-environment jsdom
import {
  actionCardId,
  playerId,
  systemId,
  unitId,
  type GameEvent,
  type ShipsMoved,
} from '@stellar/domain';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TabletopMapMotion } from '../src/components/pieces/TabletopMapMotion.tsx';
import { mapPieceMoves, mapPiecePath } from '../src/components/pieces/map-motion-events.ts';
import { MAP_MOTION_MS } from '../src/components/pieces/use-map-piece-motion.ts';
import { useGameStore } from '../src/game-store.ts';
import { useSettingsStore } from '../src/settings-store.ts';
import type { FleetProjection } from '../src/system/fleet-placement.ts';
import type { SceneHex } from '../src/render/scene-model.ts';
import { started } from './game-helpers.ts';

const reduced = vi.hoisted(() => ({ value: false }));
vi.mock('motion/react', () => ({ useReducedMotion: () => reduced.value }));
const animations: { frames: Keyframe[]; cancel: ReturnType<typeof vi.fn> }[] = [];
const originalAnimate = Object.getOwnPropertyDescriptor(Element.prototype, 'animate');

function fixture() {
  const before = started();
  const origin = Object.values(before.systems).find((system) => system.spaceUnits.length > 0);
  const ship = origin?.spaceUnits[0];
  const destinations = Object.values(before.systems)
    .filter((system) => system.id !== origin?.id)
    .slice(0, 2);
  const [middle, target] = destinations;
  if (origin === undefined || ship === undefined || middle === undefined || target === undefined)
    throw new Error('map');
  const event: ShipsMoved = {
    type: 'ShipsMoved',
    player: ship.owner,
    system: target.id,
    movements: [{ ship: ship.id, from: origin.id, path: [middle.id, target.id], cargo: [] }],
  };
  const hexes: SceneHex[] = [origin, middle, target].map((system) => ({
    key: system.id,
    systemId: system.id,
    position: system.position,
    kind: 'system',
    back: 'blue',
    seat: null,
    ships: [{ seat: 1, type: ship.type, count: 1 }],
    planets: [],
    tokens: [],
    highlight: 'none',
    control: null,
    frontier: false,
    cache: 0,
    wormholes: [],
  }));
  const frame: FleetProjection = {
    hexes,
    bounds: { minX: -500, minY: -400, width: 1000, height: 800 },
    size: { width: 1000, height: 800 },
    viewport: { panX: 0, panY: 0, zoom: 1 },
    view: { angle: 0.6, tilt: 0.8 },
  };
  return { before, event, frame, ship, target };
}

beforeEach(() => {
  vi.useFakeTimers();
  reduced.value = false;
  animations.length = 0;
  useGameStore.getState().leave();
  useSettingsStore.setState({ animations: true });
  Element.prototype.animate = vi.fn((frames) => {
    const entry = { frames: frames as Keyframe[], cancel: vi.fn() };
    animations.push(entry);
    return { cancel: entry.cancel } as unknown as Animation;
  });
});

afterEach(() => {
  cleanup();
  Object.defineProperty(
    Element.prototype,
    'animate',
    originalAnimate ?? { configurable: true, writable: true, value: undefined },
  );
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('Echte Spielsteine auf dem Tisch', () => {
  it('nimmt den eigenen aktivierten Marker aus dem sichtbaren Taktikfach und landet am projizierten System', () => {
    const { before, ship, target, frame } = fixture();
    useGameStore.setState({ game: before, me: ship.owner });
    render(
      <>
        <div className="sheet-tray" data-pool="tactic" />
        <TabletopMapMotion {...frame} />
      </>,
    );
    const tray = document.querySelector('.sheet-tray');
    if (tray === null) throw new Error('no tray');
    vi.spyOn(tray, 'getBoundingClientRect').mockReturnValue({
      left: 80,
      top: 600,
      width: 100,
      height: 30,
    } as DOMRect);
    act(() =>
      useGameStore.setState({
        lastEvents: {
          serial: 1,
          before,
          events: [{ type: 'SystemActivated', player: ship.owner, system: target.id }],
        },
      }),
    );
    expect(animations).toHaveLength(1);
    expect(animations[0]?.frames[0]?.transform).toContain('translate(130px, 615px)');
    expect(document.querySelector('[data-material="token"] img')?.getAttribute('src')).toContain(
      '/ti4/',
    );
    act(() => {
      vi.advanceTimersByTime(MAP_MOTION_MS);
    });
    expect(animations[0]?.cancel).toHaveBeenCalled();
  });

  it('extrahiert nur echte öffentliche Schiffe, Wege und aktivierte Marker; keine Handkarten oder Ladung', () => {
    const { before, event, ship, target } = fixture();
    const privateEvent: GameEvent = {
      type: 'ActionCardsDrawn',
      player: ship.owner,
      cards: [actionCardId('private-card')],
    };
    const moves = mapPieceMoves(before, [
      { type: 'SystemActivated', player: ship.owner, system: target.id },
      event,
      privateEvent,
    ]);
    expect(moves.map((move) => move.kind)).toEqual(['token', 'ship']);
    expect(moves[1]).toMatchObject({
      unit: ship.id,
      type: ship.type,
      path: [event.movements[0]?.from, ...(event.movements[0]?.path ?? [])],
    });
    expect(JSON.stringify(moves)).not.toContain('private-card');
    expect(JSON.stringify(moves)).not.toContain('cargo');
    const counterfeit = {
      ...event,
      movements: [
        {
          ...event.movements[0],
          ship: unitId('unknown'),
          from: systemId('missing'),
          path: [target.id],
          cargo: [],
        },
      ],
    };
    expect(mapPieceMoves(before, [counterfeit])).toEqual([]);
    expect(mapPieceMoves(before, [{ ...event, player: playerId('someone-else') }])).toEqual([]);
  });

  it('projiziert jeden echten Wegpunkt mit derselben gedrehten Kamera und verbirgt unbekannte Wege', () => {
    const { before, event, frame } = fixture();
    const move = mapPieceMoves(before, [event])[0];
    if (move === undefined) throw new Error('no ship');
    const path = mapPiecePath(frame, move);
    expect(path).toHaveLength(3);
    const moved = mapPiecePath({ ...frame, viewport: { ...frame.viewport, panX: 75 } }, move);
    path.forEach((point, index) => expect((moved[index]?.x ?? 0) - point.x).toBeCloseTo(75));
    expect(mapPiecePath({ ...frame, hexes: frame.hexes.slice(0, 1) }, move)).toEqual([]);
  });

  it('spielt vorhandene Verbindungsdaten nicht erneut; ein neuer Wurf endet von selbst und räumt auf', () => {
    const { before, event, frame } = fixture();
    useGameStore.setState({ game: before, lastEvents: { serial: 8, before, events: [event] } });
    render(<TabletopMapMotion {...frame} />);
    expect(animations).toHaveLength(0);
    act(() => useGameStore.setState({ lastEvents: { serial: 9, before, events: [event] } }));
    expect(animations).toHaveLength(1);
    expect(document.querySelectorAll('.tabletop-map-piece')).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(MAP_MOTION_MS);
    });
    expect(document.querySelectorAll('.tabletop-map-piece')).toHaveLength(0);
    expect(animations[0]?.cancel).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('bricht Bewegung bei Kameraänderung oder ausgeschalteten Animationen ab, ohne späteren Replay', () => {
    const { before, event, frame } = fixture();
    const view = render(<TabletopMapMotion {...frame} />);
    act(() => useGameStore.setState({ lastEvents: { serial: 1, before, events: [event] } }));
    expect(animations).toHaveLength(1);
    view.rerender(<TabletopMapMotion {...frame} viewport={{ ...frame.viewport, zoom: 2 }} />);
    expect(document.querySelectorAll('.tabletop-map-piece')).toHaveLength(0);
    expect(animations[0]?.cancel).toHaveBeenCalled();
    act(() => useSettingsStore.setState({ animations: false }));
    act(() => useGameStore.setState({ lastEvents: { serial: 2, before, events: [event] } }));
    act(() => useSettingsStore.setState({ animations: true }));
    expect(animations).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('startet mit weniger Bewegung keine Animation und verwendet keine dauernde Bildschleife', () => {
    const { before, event, frame } = fixture();
    reduced.value = true;
    render(<TabletopMapMotion {...frame} />);
    act(() => useGameStore.setState({ lastEvents: { serial: 1, before, events: [event] } }));
    expect(animations).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
